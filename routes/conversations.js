import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/conversations?userId=
router.get("/", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    const result = await pool.query(
      `
      SELECT DISTINCT ON (
        LEAST(m.sender_id::text, m.receiver_id::text) || m.product_id::text
      )
        m.id,
        m.product_id,
        m.message        AS last_message,
        m.created_at,
        CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS other_user_id,
        u.name           AS other_user_name,
        u.profile_image  AS other_user_avatar,
        u.is_online      AS other_user_online,
        p.title          AS product_title,
        p.images[1]      AS product_image
      FROM messages m
      JOIN users   u ON u.id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
      LEFT JOIN products p ON p.id = m.product_id
      WHERE m.sender_id = $1 OR m.receiver_id = $1
      ORDER BY
        LEAST(m.sender_id::text, m.receiver_id::text) || m.product_id::text,
        m.created_at DESC
      `,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/conversations/start  { senderId, receiverId, productId }
// Idempotent — just returns redirect info; messages table is the source of truth
router.post("/start", async (req, res) => {
  const { senderId, receiverId, productId } = req.body;
  if (!senderId || !receiverId || !productId)
    return res.status(400).json({ error: "senderId, receiverId, productId required" });

  try {
    const { rows } = await pool.query(
      `SELECT id FROM messages
       WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
         AND product_id = $3
       LIMIT 1`,
      [senderId, receiverId, productId]
    );
    res.json({ exists: rows.length > 0, receiverId, productId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;