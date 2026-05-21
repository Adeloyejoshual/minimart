// routes/conversations.js
import express      from "express";
import { pool }     from "../server.js";
import { softAuth } from "../middleware/auth.js";

const router = express.Router();

/* ══════════════════════════════════════════════
   GET /api/conversations?userId=
══════════════════════════════════════════════ */
router.get("/", softAuth, async (req, res) => {
  const userId = req.user?.id || req.query.userId;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         t.id                AS thread_id,
         t.id                AS id,
         t.product_id,
         t.last_message,
         t.last_message_at,
         t.is_archived,
         t.is_blocked,
         t.buyer_id,
         t.seller_id,
         t.created_at,
         CASE
           WHEN t.buyer_id = $1 THEN t.seller_id
           ELSE t.buyer_id
         END                 AS other_user_id,
         u.name              AS other_user_name,
         u.profile_image     AS other_user_image,
         u.is_online         AS other_user_online,
         u.store_name        AS other_user_store,
         p.title             AS product_title,
         p.images->>0        AS product_image,
         p.price             AS product_price,
         COUNT(m.id) FILTER (
           WHERE m.sender_id <> $1
             AND m.deleted    = false
             AND (rr.last_read_at IS NULL OR m.created_at > rr.last_read_at)
         )::INT              AS unread_count
       FROM  public.chat_threads           t
       JOIN  public.users                  u
             ON u.id = CASE
                         WHEN t.buyer_id = $1 THEN t.seller_id
                         ELSE t.buyer_id
                       END
       LEFT JOIN public.products           p  ON p.id = t.product_id
       LEFT JOIN public.chat_messages      m  ON m.thread_id = t.id
       LEFT JOIN public.chat_read_receipts rr ON rr.thread_id = t.id
                                             AND rr.user_id   = $1
       WHERE (t.buyer_id = $1 OR t.seller_id = $1)
       GROUP BY
         t.id, t.product_id, t.last_message, t.last_message_at,
         t.is_archived, t.is_blocked, t.buyer_id, t.seller_id, t.created_at,
         u.name, u.profile_image, u.is_online, u.store_name,
         p.title, p.images, p.price,
         rr.last_read_at
       ORDER BY t.last_message_at DESC NULLS LAST`,
      [userId]
    );

    return res.json(rows);
  } catch (err) {
    console.error("GET /conversations:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   GET /api/conversations/:threadId
══════════════════════════════════════════════ */
router.get("/:threadId", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.user?.id || req.query.userId;

  try {
    const { rows } = await pool.query(
      `SELECT
         t.*,
         t.id            AS thread_id,
         CASE
           WHEN t.buyer_id = $2 THEN t.seller_id
           ELSE t.buyer_id
         END             AS other_user_id,
         u.name          AS other_user_name,
         u.profile_image AS other_user_image,
         u.is_online     AS other_user_online,
         u.store_name    AS other_user_store,
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
       WHERE t.id = $1`,
      [threadId, userId || "00000000-0000-0000-0000-000000000000"]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("GET /conversations/:threadId:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   POST /api/conversations
   Body: { buyerId, sellerId, productId? }
══════════════════════════════════════════════ */
router.post("/", softAuth, async (req, res) => {
  const buyerId   = req.user?.id        || req.body.buyerId;
  const sellerId  = req.body.sellerId;
  const productId = req.body.productId  || null;

  console.log("📝 POST /conversations", { buyerId, sellerId, productId });

  if (!buyerId || !sellerId) {
    return res.status(400).json({
      success: false,
      message: `buyerId and sellerId required — got buyerId=${buyerId} sellerId=${sellerId}`,
    });
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

    /* ── Check if seller exists ── */
    const { rowCount: sellerExists } = await client.query(
      "SELECT 1 FROM public.users WHERE id = $1",
      [sellerId]
    );

    if (!sellerExists) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: `Seller not found: ${sellerId}`,
      });
    }

    /* ── Check if buyer exists ── */
    const { rowCount: buyerExists } = await client.query(
      "SELECT 1 FROM public.users WHERE id = $1",
      [buyerId]
    );

    if (!buyerExists) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: `Buyer not found: ${buyerId}`,
      });
    }

    /* ── Look for existing thread ── */
    let findQuery;
    let findParams;

    if (productId) {
      findQuery = `
        SELECT id AS thread_id, id, buyer_id, seller_id,
               product_id, last_message, last_message_at,
               created_at, is_archived, is_blocked
        FROM   public.chat_threads
        WHERE  buyer_id   = $1
          AND  seller_id  = $2
          AND  product_id = $3
        LIMIT 1
      `;
      findParams = [buyerId, sellerId, productId];
    } else {
      findQuery = `
        SELECT id AS thread_id, id, buyer_id, seller_id,
               product_id, last_message, last_message_at,
               created_at, is_archived, is_blocked
        FROM   public.chat_threads
        WHERE  buyer_id    = $1
          AND  seller_id   = $2
          AND  product_id IS NULL
        LIMIT 1
      `;
      findParams = [buyerId, sellerId];
    }

    const { rows: existing } = await client.query(findQuery, findParams);

    if (existing.length > 0) {
      await client.query("COMMIT");
      console.log("♻️  Existing thread:", existing[0].thread_id);
      return res.status(200).json(existing[0]);
    }

    /* ── Create new thread ── */
    const { rows: created } = await client.query(
      `INSERT INTO public.chat_threads
         (buyer_id, seller_id, product_id)
       VALUES ($1, $2, $3)
       RETURNING
         id AS thread_id,
         id,
         buyer_id,
         seller_id,
         product_id,
         last_message,
         last_message_at,
         created_at,
         is_archived,
         is_blocked`,
      [buyerId, sellerId, productId]
    );

    await client.query("COMMIT");
    console.log("✅ New thread created:", created[0].thread_id);
    return res.status(201).json(created[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /conversations error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════
   PATCH /api/conversations/:threadId/read
══════════════════════════════════════════════ */
router.patch("/:threadId/read", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.user?.id || req.body.userId;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO public.chat_read_receipts
         (thread_id, user_id, last_read_message_id, last_read_at)
       SELECT $1, $2,
         (SELECT id FROM public.chat_messages
          WHERE  thread_id = $1 AND deleted = false
          ORDER  BY created_at DESC LIMIT 1),
         now()
       ON CONFLICT (thread_id, user_id) DO UPDATE
         SET last_read_message_id = EXCLUDED.last_read_message_id,
             last_read_at         = now()`,
      [threadId, userId]
    );

    const { rowCount } = await client.query(
      `UPDATE public.chat_messages
       SET    status = 'read'
       WHERE  thread_id  = $1
         AND  sender_id <> $2
         AND  status    <> 'read'
         AND  deleted    = false`,
      [threadId, userId]
    );

    await client.query("COMMIT");
    return res.json({ success: true, messagesUpdated: rowCount });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /read error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════
   PATCH /api/conversations/:threadId/archive
══════════════════════════════════════════════ */
router.patch("/:threadId/archive", softAuth, async (req, res) => {
  const { threadId }       = req.params;
  const { archive = true } = req.body;
  const userId             = req.user?.id || req.body.userId;

  try {
    const { rowCount } = await pool.query(
      `UPDATE public.chat_threads
       SET    is_archived = $1
       WHERE  id = $2
         AND  (buyer_id = $3 OR seller_id = $3)`,
      [!!archive, threadId, userId]
    );

    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("PATCH /archive error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   DELETE /api/conversations/:threadId
══════════════════════════════════════════════ */
router.delete("/:threadId", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.user?.id || req.body.userId;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rowCount } = await client.query(
      `UPDATE public.chat_threads
       SET    is_archived = true
       WHERE  id = $1
         AND  (buyer_id = $2 OR seller_id = $2)`,
      [threadId, userId]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    await client.query(
      `UPDATE public.chat_messages
       SET    deleted = true
       WHERE  thread_id = $1 AND sender_id = $2`,
      [threadId, userId]
    );

    await client.query("COMMIT");
    return res.json({ success: true });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /conversations error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

export default router;