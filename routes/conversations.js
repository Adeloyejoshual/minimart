// routes/conversations.js
import express      from "express";
import { pool }     from "../server.js";
import { softAuth } from "../middleware/auth.js";

const router = express.Router();

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */

/** Shape a conversation row into a clean frontend object */
function shapeConversation(row) {
  return {
    thread_id:          row.thread_id,
    id:                 row.thread_id,
    product_id:         row.product_id         || null,
    last_message:       row.last_message        || null,
    last_message_at:    row.last_message_at     || null,
    is_archived:        row.is_archived         || false,
    is_blocked:         row.is_blocked          || false,
    buyer_id:           row.buyer_id,
    seller_id:          row.seller_id,
    created_at:         row.created_at,

    /* other participant */
    other_user_id:      row.other_user_id       || null,
    other_user_name:    row.other_user_name     || "User",
    other_user_image:   row.other_user_image    || null,
    other_user_online:  row.other_user_online   || false,
    other_user_store:   row.other_user_store    || null,
    last_login:         row.last_login          || null,

    /* product */
    product_title:      row.product_title       || null,
    product_price:      row.product_price
      ? Number(row.product_price) : null,
    product_image:      row.product_image       || null,

    /* last message meta */
    last_sender_id:     row.last_sender_id      || null,

    /* unread */
    unread_count:       Number(row.unread_count || 0),
  };
}

/* ══════════════════════════════════════════════
   GET /api/conversations
   ?userId=  &page=  &limit=
══════════════════════════════════════════════ */
router.get("/", softAuth, async (req, res) => {
  const userId = req.user?.id || req.query.userId;
  const limit  = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const offset = (Math.max(parseInt(req.query.page, 10) || 1, 1) - 1) * limit;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "userId required" });
  }

  console.log("📋 GET /conversations", { userId, limit, offset });

  try {
    const { rows } = await pool.query(
      `SELECT
         t.id                  AS thread_id,
         t.product_id,
         t.last_message,
         t.last_message_at,
         t.is_archived,
         t.is_blocked,
         t.buyer_id,
         t.seller_id,
         t.created_at,

         -- other participant
         CASE
           WHEN t.buyer_id = $1 THEN t.seller_id
           ELSE t.buyer_id
         END                   AS other_user_id,

         u.name                AS other_user_name,
         u.profile_image       AS other_user_image,
         u.is_online           AS other_user_online,
         u.store_name          AS other_user_store,
         u.last_login          AS last_login,

         -- product snapshot
         p.title               AS product_title,
         p.price               AS product_price,
         p.main_image          AS product_image,

         -- last message sender
         lm.sender_id          AS last_sender_id,

         -- unread count
         COUNT(m.id) FILTER (
           WHERE m.sender_id <> $1
             AND m.deleted    = false
             AND (
               rr.last_read_at IS NULL
               OR m.created_at > rr.last_read_at
             )
         )::INT                AS unread_count

       FROM  public.chat_threads           t

       JOIN  public.users                  u
             ON u.id = CASE
                         WHEN t.buyer_id  = $1 THEN t.seller_id
                         ELSE t.buyer_id
                       END

       LEFT JOIN public.products           p
             ON p.id = t.product_id

       LEFT JOIN public.chat_messages      m
             ON m.thread_id = t.id

       LEFT JOIN public.chat_read_receipts rr
             ON rr.thread_id = t.id
            AND rr.user_id   = $1

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
         u.name, u.profile_image, u.is_online, u.store_name, u.last_login,
         p.title, p.price, p.main_image,
         rr.last_read_at,
         lm.sender_id

       ORDER BY t.last_message_at DESC NULLS LAST
       LIMIT  $2
       OFFSET $3`,
      [userId, limit, offset]
    );

    console.log(`✅ Found ${rows.length} conversations`);
    return res.json(rows.map(shapeConversation));

  } catch (err) {
    console.error("GET /conversations error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   GET /api/conversations/:threadId
══════════════════════════════════════════════ */
router.get("/:threadId", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.user?.id || req.query.userId;

  console.log("🔍 GET /conversations/:threadId", { threadId, userId });

  try {
    const { rows } = await pool.query(
      `SELECT
         t.id                  AS thread_id,
         t.product_id,
         t.last_message,
         t.last_message_at,
         t.is_archived,
         t.is_blocked,
         t.buyer_id,
         t.seller_id,
         t.created_at,

         CASE
           WHEN t.buyer_id = $2 THEN t.seller_id
           ELSE t.buyer_id
         END                   AS other_user_id,

         u.name                AS other_user_name,
         u.profile_image       AS other_user_image,
         u.is_online           AS other_user_online,
         u.store_name          AS other_user_store,
         u.last_login          AS last_login,

         p.title               AS product_title,
         p.price               AS product_price,
         p.main_image          AS product_image,
         p.id                  AS product_id_ref

       FROM  public.chat_threads t

       JOIN  public.users u
             ON u.id = CASE
                         WHEN t.buyer_id = $2 THEN t.seller_id
                         ELSE t.buyer_id
                       END

       LEFT JOIN public.products p ON p.id = t.product_id

       WHERE t.id = $1`,
      [
        threadId,
        /* fallback UUID so CASE never errors when userId is missing */
        userId || "00000000-0000-0000-0000-000000000000",
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        message: `Thread not found: ${threadId}`,
      });
    }

    return res.json(shapeConversation(rows[0]));

  } catch (err) {
    console.error("GET /conversations/:threadId error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   POST /api/conversations
   Create or return existing thread
══════════════════════════════════════════════ */
router.post("/", softAuth, async (req, res) => {
  const buyerId   = req.user?.id    || req.body.buyerId;
  const sellerId  = req.body.sellerId;
  const productId = req.body.productId || null;

  console.log("📝 POST /conversations", { buyerId, sellerId, productId });

  if (!buyerId) {
    return res.status(400).json({ success: false, message: "buyerId required" });
  }
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

    /* verify both users exist */
    const { rows: users } = await client.query(
      `SELECT id FROM public.users WHERE id = ANY($1::uuid[])`,
      [[buyerId, sellerId]]
    );

    const foundIds = new Set(users.map(u => u.id));

    if (!foundIds.has(buyerId)) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: `Buyer not found: ${buyerId}`,
      });
    }
    if (!foundIds.has(sellerId)) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: `Seller not found: ${sellerId}`,
      });
    }

    /* find existing thread */
    const existQuery = productId
      ? `SELECT id AS thread_id, id, buyer_id, seller_id,
                product_id, last_message, last_message_at,
                created_at, is_archived, is_blocked
         FROM public.chat_threads
         WHERE buyer_id   = $1
           AND seller_id  = $2
           AND product_id = $3
         LIMIT 1`
      : `SELECT id AS thread_id, id, buyer_id, seller_id,
                product_id, last_message, last_message_at,
                created_at, is_archived, is_blocked
         FROM public.chat_threads
         WHERE buyer_id    = $1
           AND seller_id   = $2
           AND product_id IS NULL
         LIMIT 1`;

    const existParams = productId
      ? [buyerId, sellerId, productId]
      : [buyerId, sellerId];

    const { rows: existing } = await client.query(existQuery, existParams);

    if (existing.length > 0) {
      await client.query("COMMIT");
      console.log("♻️  Existing thread:", existing[0].thread_id);
      return res.status(200).json(shapeConversation(existing[0]));
    }

    /* create new thread */
    const { rows: created } = await client.query(
      `INSERT INTO public.chat_threads (buyer_id, seller_id, product_id)
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
    console.log("✅ New thread:", created[0].thread_id);
    return res.status(201).json(shapeConversation(created[0]));

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /conversations error:", err.message);

    /* unique constraint race condition fallback */
    if (err.code === "23505") {
      try {
        const { rows: fb } = await pool.query(
          productId
            ? `SELECT id AS thread_id, id, buyer_id, seller_id,
                      product_id, last_message, last_message_at,
                      created_at, is_archived, is_blocked
               FROM public.chat_threads
               WHERE buyer_id   = $1
                 AND seller_id  = $2
                 AND product_id = $3
               LIMIT 1`
            : `SELECT id AS thread_id, id, buyer_id, seller_id,
                      product_id, last_message, last_message_at,
                      created_at, is_archived, is_blocked
               FROM public.chat_threads
               WHERE buyer_id    = $1
                 AND seller_id   = $2
                 AND product_id IS NULL
               LIMIT 1`,
          productId ? [buyerId, sellerId, productId] : [buyerId, sellerId]
        );

        if (fb.length > 0) {
          return res.status(200).json(shapeConversation(fb[0]));
        }
      } catch (fbErr) {
        console.error("Fallback query failed:", fbErr.message);
      }
    }

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

  if (!userId || !threadId) {
    return res.status(400).json({
      success: false,
      message: "userId and threadId required",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* verify user is in this thread */
    const { rows: tr } = await client.query(
      `SELECT id FROM public.chat_threads
       WHERE id = $1
         AND (buyer_id = $2 OR seller_id = $2)`,
      [threadId, userId]
    );

    if (!tr[0]) {
      await client.query("ROLLBACK");
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    /* upsert read receipt */
    await client.query(
      `INSERT INTO public.chat_read_receipts
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
         NOW()
       ON CONFLICT (thread_id, user_id) DO UPDATE
         SET last_read_message_id = EXCLUDED.last_read_message_id,
             last_read_at         = NOW()`,
      [threadId, userId]
    );

    /* mark incoming messages as read */
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
    console.error("PATCH /read error:", err.message);
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

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE public.chat_threads
       SET    is_archived = $1
       WHERE  id          = $2
         AND  (buyer_id   = $3 OR seller_id = $3)`,
      [!!archive, threadId, userId]
    );

    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    return res.json({ success: true, archived: !!archive });
  } catch (err) {
    console.error("PATCH /archive error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   PATCH /api/conversations/:threadId/block
══════════════════════════════════════════════ */
router.patch("/:threadId/block", softAuth, async (req, res) => {
  const { threadId }     = req.params;
  const { block = true } = req.body;
  const userId           = req.user?.id || req.body.userId;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE public.chat_threads
       SET    is_blocked = $1
       WHERE  id         = $2
         AND  (buyer_id  = $3 OR seller_id = $3)`,
      [!!block, threadId, userId]
    );

    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    return res.json({ success: true, blocked: !!block });
  } catch (err) {
    console.error("PATCH /block error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   PATCH /api/conversations/:threadId/mute
   NEW — frontend uses this for notification mute
══════════════════════════════════════════════ */
router.patch("/:threadId/mute", softAuth, async (req, res) => {
  const { threadId }   = req.params;
  const { mute = true} = req.body;
  const userId         = req.user?.id || req.body.userId;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }

  try {
    /* upsert into a per-user mute table
       If you don't have one yet, we store it in chat_read_receipts
       as an extra column — or create a dedicated table below */
    await pool.query(
      `INSERT INTO public.chat_mutes (thread_id, user_id, muted, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (thread_id, user_id) DO UPDATE
         SET muted      = $3,
             updated_at = NOW()`,
      [threadId, userId, !!mute]
    );

    return res.json({ success: true, muted: !!mute });
  } catch (err) {
    console.error("PATCH /mute error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   DELETE /api/conversations/:threadId
   Soft-delete: archives thread + hides user's messages
══════════════════════════════════════════════ */
router.delete("/:threadId", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.user?.id || req.body.userId;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rowCount } = await client.query(
      `UPDATE public.chat_threads
       SET    is_archived = true
       WHERE  id          = $1
         AND  (buyer_id   = $2 OR seller_id = $2)`,
      [threadId, userId]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ success: false, message: "Thread not found" });
    }

    /* soft-delete only the requesting user's own messages */
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
    console.error("DELETE /conversations error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

export default router;