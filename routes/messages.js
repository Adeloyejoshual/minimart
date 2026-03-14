// routes/messages.js
import express from "express";
import { pool } from "../server.js";

const router = express.Router();

// -------------------
// GET all conversations for a user
// -------------------
router.get("/conversations", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const query = `
      SELECT DISTINCT ON (product_id, other_user_id)
        product_id,
        CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS other_user_id,
        MAX(message) AS last_message,
        MAX(created_at) AS last_message_at
      FROM public.messages
      WHERE sender_id = $1 OR receiver_id = $1
      GROUP BY product_id, other_user_id
      ORDER BY product_id, other_user_id, last_message_at DESC
    `;
    const { rows } = await pool.query(query, [userId]);

    // Fetch other user names
    for (const row of rows) {
      const userRes = await pool.query("SELECT name FROM users WHERE id=$1", [row.other_user_id]);
      row.other_user_name = userRes.rows[0]?.name || "Unknown";
    }

    res.json(rows);
  } catch (err) {
    console.error("GET /conversations error:", err);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

// -------------------
// GET all messages for a conversation
// -------------------
router.get("/", async (req, res) => {
  const { senderId, receiverId, productId } = req.query;
  if (!senderId || !receiverId || !productId) {
    return res.status(400).json({ message: "senderId, receiverId, productId required" });
  }

  try {
    const query = `
      SELECT id, sender_id, receiver_id, product_id, message, created_at
      FROM public.messages
      WHERE product_id = $1
        AND ((sender_id = $2 AND receiver_id = $3)
          OR (sender_id = $3 AND receiver_id = $2))
      ORDER BY created_at ASC
    `;
    const { rows } = await pool.query(query, [productId, senderId, receiverId]);
    res.json(rows);
  } catch (err) {
    console.error("GET /messages error:", err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// -------------------
// POST a new message
// -------------------
router.post("/", async (req, res) => {
  const { senderId, receiverId, productId, message } = req.body;
  if (!senderId || !receiverId || !productId || !message) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const query = `
      INSERT INTO public.messages (sender_id, receiver_id, product_id, message, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    const { rows } = await pool.query(query, [senderId, receiverId, productId, message]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /messages error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

export default router;