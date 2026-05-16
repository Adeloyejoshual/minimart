import express  from "express";
import { pool } from "../config/db.js";

const router = express.Router();

// GET /api/conversations?userId=
// Returns all threads for a user with other party info
router.get("/", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    const { rows } = await pool.query(
      `SELECT
         t.id              AS thread_id,
         t.product_id,
         t.last_message,
         t.last_message_at,
         t.is_archived,
         t.is_blocked,
         -- who is the other person?
         CASE WHEN t.buyer_id = $1 THEN t.seller_id ELSE t.buyer_id END AS other_user_id,
         u.name            AS other_user_name,
         u.profile_image   AS other_user_avatar,
         u.is_online       AS other_user_online,
         p.title           AS product_title,
         p.images          AS product_images,
         -- unread count
         (
           SELECT COUNT(*)
           FROM chat_messages m
           WHERE m.thread_id = t.id
             AND m.sender_id != $1
             AND m.status != 'read'
             AND m.deleted = false
         ) AS unread_count
       FROM chat_threads t
       JOIN users u
         ON u.id = CASE WHEN t.buyer_id = $1 THEN t.seller_id ELSE t.buyer_id END
       LEFT JOIN products p ON p.id = t.product_id
       WHERE (t.buyer_id = $1 OR t.seller_id = $1)
         AND t.is_archived = false
       ORDER BY t.last_message_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /conversations error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/conversations/start
// Find or create a thread between buyer → seller for a product
router.post("/start", async (req, res) => {
  const { buyerId, sellerId, productId } = req.body;
  if (!buyerId || !sellerId)
    return res.status(400).json({ error: "buyerId and sellerId required" });

  // Prevent seller chatting with themselves
  if (buyerId === sellerId)
    return res.status(400).json({ error: "Cannot start chat with yourself" });

  try {
    // Upsert — if thread exists return it, else create
    const { rows } = await pool.query(
      `INSERT INTO chat_threads (buyer_id, seller_id, product_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (buyer_id, seller_id, product_id) DO UPDATE
         SET last_message_at = chat_threads.last_message_at
       RETURNING id`,
      [buyerId, sellerId, productId || null]
    );
    res.json({ threadId: rows[0].id });
  } catch (err) {
    console.error("POST /conversations/start error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/conversations/:threadId/read
router.patch("/:threadId/read", async (req, res) => {
  const { threadId } = req.params;
  const { userId }   = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    // Get latest message id in thread
    const { rows: latest } = await pool.query(
      `SELECT id FROM chat_messages
       WHERE thread_id = $1 AND deleted = false
       ORDER BY created_at DESC LIMIT 1`,
      [threadId]
    );
    const lastId = latest[0]?.id || null;

    // Upsert read receipt
    await pool.query(
      `INSERT INTO chat_read_receipts (thread_id, user_id, last_read_message_id, last_read_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (thread_id, user_id) DO UPDATE
         SET last_read_message_id = $3,
             last_read_at         = now()`,
      [threadId, userId, lastId]
    );

    // Mark messages as read
    await pool.query(
      `UPDATE chat_messages
       SET status = 'read'
       WHERE thread_id = $1
         AND sender_id != $2
         AND status != 'read'`,
      [threadId, userId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /conversations/:threadId/read error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;