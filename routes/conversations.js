import express       from "express";
import { pool }      from "../server.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════
   GET /api/conversations?userId=<uuid>
   All threads for a user with unread counts + last message
═══════════════════════════════════════════════════════════ */
router.get("/", authenticate, async (req, res) => {
  /* Support both ?userId= (legacy frontend) and JWT user */
  const userId = req.query.userId ?? req.user.id;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        t.id                                              AS thread_id,
        t.product_id,
        t.last_message,
        t.last_message_at,
        t.is_archived,
        t.is_blocked,
        t.buyer_id,
        t.seller_id,
        t.created_at,

        /* ── other participant ── */
        CASE
          WHEN t.buyer_id = $1 THEN t.seller_id
          ELSE t.buyer_id
        END                                               AS other_user_id,

        u.name                                            AS other_user_name,
        u.profile_image                                   AS other_user_image,
        u.is_online                                       AS other_user_online,
        u.store_name                                      AS other_user_store,

        /* ── product snapshot ── */
        p.title                                           AS product_title,
        p.images->>0                                      AS product_image,
        p.price                                           AS product_price,
        p.status                                          AS product_status,

        /* ── unread count ── */
        COUNT(m.id) FILTER (
          WHERE m.sender_id <> $1
            AND m.deleted    = false
            AND (
              rr.last_read_at IS NULL
              OR m.created_at > rr.last_read_at
            )
        )::INT                                            AS unread_count,

        /* ── last message sender (to show "You: …") ── */
        lm.sender_id                                      AS last_sender_id

      FROM  public.chat_threads          t

      /* other participant profile */
      JOIN  public.users                 u
            ON u.id = CASE
                        WHEN t.buyer_id  = $1 THEN t.seller_id
                        ELSE t.buyer_id
                      END

      LEFT JOIN public.products          p   ON p.id  = t.product_id
      LEFT JOIN public.chat_messages     m   ON m.thread_id = t.id
      LEFT JOIN public.chat_read_receipts rr ON rr.thread_id = t.id
                                           AND rr.user_id    = $1

      /* last message sender lookup */
      LEFT JOIN LATERAL (
        SELECT sender_id
        FROM   public.chat_messages
        WHERE  thread_id = t.id
          AND  deleted   = false
        ORDER  BY created_at DESC
        LIMIT  1
      ) lm ON true

      WHERE (t.buyer_id = $1 OR t.seller_id = $1)
        AND  t.is_archived = false

      GROUP BY
        t.id, t.product_id, t.last_message, t.last_message_at,
        t.is_archived, t.is_blocked, t.buyer_id, t.seller_id, t.created_at,
        u.name, u.profile_image, u.is_online, u.store_name,
        p.title, p.images, p.price, p.status,
        rr.last_read_at,
        lm.sender_id

      ORDER BY t.last_message_at DESC NULLS LAST
      `,
      [userId]
    );

    return res.json(rows);
  } catch (err) {
    console.error("GET /conversations:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch conversations" });
  }
});

/* ═══════════════════════════════════════════════════════════
   GET /api/conversations/:threadId
   Single thread detail — verify user is a participant
═══════════════════════════════════════════════════════════ */
router.get("/:threadId", authenticate, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.user.id;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        t.*,
        u.name          AS other_user_name,
        u.profile_image AS other_user_image,
        u.is_online     AS other_user_online,
        p.title         AS product_title,
        p.images->>0    AS product_image,
        p.price         AS product_price
      FROM  public.chat_threads t
      JOIN  public.users u
            ON u.id = CASE
                        WHEN t.buyer_id = $2 THEN t.seller_id
                        ELSE t.buyer_id
                      END
      LEFT JOIN public.products p ON p.id = t.product_id
      WHERE t.id = $1
        AND (t.buyer_id = $2 OR t.seller_id = $2)
      `,
      [threadId, userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("GET /conversations/:threadId:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch thread" });
  }
});

/* ═══════════════════════════════════════════════════════════
   POST /api/conversations
   Create or return existing thread (upsert)
   Body: { buyerId, sellerId, productId? }
         — or uses JWT user as buyer automatically
═══════════════════════════════════════════════════════════ */
router.post("/", authenticate, async (req, res) => {
  const {
    sellerId,
    productId = null,
    /* allow explicit buyerId for admin tools; default to JWT user */
    buyerId   = req.user.id,
  } = req.body;

  if (!sellerId) {
    return res.status(400).json({ success: false, message: "sellerId required" });
  }

  if (buyerId === sellerId) {
    return res.status(400).json({
      success: false,
      message: "Cannot start a conversation with yourself",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Verify seller exists */
    const { rowCount: sellerExists } = await client.query(
      "SELECT 1 FROM public.users WHERE id = $1",
      [sellerId]
    );
    if (!sellerExists) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    /* Upsert — unique (buyer_id, seller_id, product_id) */
    const { rows } = await client.query(
      `
      INSERT INTO public.chat_threads (buyer_id, seller_id, product_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (buyer_id, seller_id, product_id)
        DO UPDATE SET last_message_at = chat_threads.last_message_at   -- no-op
      RETURNING
        id          AS thread_id,
        buyer_id,
        seller_id,
        product_id,
        last_message,
        last_message_at,
        created_at,
        is_archived,
        is_blocked
      `,
      [buyerId, sellerId, productId]
    );

    await client.query("COMMIT");

    const statusCode = rows[0]._created ? 201 : 200;
    return res.status(statusCode).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /conversations:", err);
    return res.status(500).json({ success: false, message: "Failed to create conversation" });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════
   PATCH /api/conversations/:threadId/read
   Upsert read receipt + mark incoming messages as 'read'
   Body: { userId? }  — falls back to JWT user
═══════════════════════════════════════════════════════════ */
router.patch("/:threadId/read", authenticate, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.body.userId ?? req.user.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Verify membership */
    const { rowCount } = await client.query(
      `SELECT 1 FROM public.chat_threads
       WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
      [threadId, userId]
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    /* Upsert read receipt pointing at latest message */
    await client.query(
      `
      INSERT INTO public.chat_read_receipts
        (thread_id, user_id, last_read_message_id, last_read_at)
      SELECT
        $1,
        $2,
        (
          SELECT id
          FROM   public.chat_messages
          WHERE  thread_id = $1
            AND  deleted   = false
          ORDER  BY created_at DESC
          LIMIT  1
        ),
        now()
      ON CONFLICT (thread_id, user_id) DO UPDATE
        SET last_read_message_id = EXCLUDED.last_read_message_id,
            last_read_at         = now()
      `,
      [threadId, userId]
    );

    /* Flip status → 'read' for messages sent by the other person */
    const { rowCount: updated } = await client.query(
      `
      UPDATE public.chat_messages
      SET    status = 'read'
      WHERE  thread_id  = $1
        AND  sender_id <> $2
        AND  status    <> 'read'
        AND  deleted    = false
      `,
      [threadId, userId]
    );

    await client.query("COMMIT");

    return res.json({ success: true, messagesUpdated: updated });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /conversations/:threadId/read:", err);
    return res.status(500).json({ success: false, message: "Failed to mark as read" });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════
   PATCH /api/conversations/:threadId/archive
   Body: { archive: bool }
═══════════════════════════════════════════════════════════ */
router.patch("/:threadId/archive", authenticate, async (req, res) => {
  const { threadId }       = req.params;
  const { archive = true } = req.body;
  const userId             = req.user.id;

  try {
    const { rowCount } = await pool.query(
      `UPDATE public.chat_threads
       SET    is_archived = $1
       WHERE  id          = $2
         AND  (buyer_id = $3 OR seller_id = $3)`,
      [!!archive, threadId, userId]
    );

    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("PATCH /archive:", err);
    return res.status(500).json({ success: false, message: "Failed to archive" });
  }
});

/* ═══════════════════════════════════════════════════════════
   PATCH /api/conversations/:threadId/block
   Body: { block: bool }   — only seller or buyer can block
═══════════════════════════════════════════════════════════ */
router.patch("/:threadId/block", authenticate, async (req, res) => {
  const { threadId }     = req.params;
  const { block = true } = req.body;
  const userId           = req.user.id;

  try {
    const { rowCount } = await pool.query(
      `UPDATE public.chat_threads
       SET    is_blocked = $1
       WHERE  id         = $2
         AND  (buyer_id = $3 OR seller_id = $3)`,
      [!!block, threadId, userId]
    );

    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("PATCH /block:", err);
    return res.status(500).json({ success: false, message: "Failed to update block status" });
  }
});

/* ═══════════════════════════════════════════════════════════
   DELETE /api/conversations/:threadId
   Soft-delete: archive thread + mark caller's messages deleted
═══════════════════════════════════════════════════════════ */
router.delete("/:threadId", authenticate, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.user.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rowCount } = await client.query(
      `UPDATE public.chat_threads
       SET    is_archived = true
       WHERE  id          = $1
         AND  (buyer_id = $2 OR seller_id = $2)`,
      [threadId, userId]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    /* Soft-delete only the calling user's messages */
    await client.query(
      `UPDATE public.chat_messages
       SET    deleted = true
       WHERE  thread_id = $1
         AND  sender_id = $2`,
      [threadId, userId]
    );

    await client.query("COMMIT");
    return res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /conversations/:threadId:", err);
    return res.status(500).json({ success: false, message: "Failed to delete conversation" });
  } finally {
    client.release();
  }
});

export default router;