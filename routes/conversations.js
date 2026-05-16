import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    const result = await pool.query(
      `
      SELECT
        m.id,
        m.product_id,
        m.message        AS last_message,
        m.created_at,
        CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS other_user_id,
        u.name           AS other_user_name,
        u.profile_image  AS other_user_avatar,
        u.is_online      AS other_user_online,
        p.title          AS product_title
      FROM messages m
      JOIN users u ON u.id = CASE
        WHEN m.sender_id = $1 THEN m.receiver_id
        ELSE m.sender_id
      END
      LEFT JOIN products p ON p.id = m.product_id
      WHERE (m.sender_id = $1 OR m.receiver_id = $1)
        AND m.created_at = (
          SELECT MAX(m2.created_at)
          FROM messages m2
          WHERE m2.product_id = m.product_id
            AND (
              (m2.sender_id = m.sender_id AND m2.receiver_id = m.receiver_id)
              OR
              (m2.sender_id = m.receiver_id AND m2.receiver_id = m.sender_id)
            )
        )
      ORDER BY m.created_at DESC
      `,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Conversations error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

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
    console.error("Start error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;