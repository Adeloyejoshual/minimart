import express from "express";
import { pool } from "../server.js"; // CockroachDB pool
const router = express.Router();

// -------------------
// GET all messages for a conversation
// -------------------
// GET /messages?senderId=...&receiverId=...&productId=...
router.get("/", async (req, res) => {
  const { senderId, receiverId, productId } = req.query;

  if (!senderId || !receiverId || !productId) {
    return res.status(400).json({ message: "Missing required query params" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM messages
       WHERE product_id=$1
         AND ((sender_id=$2 AND receiver_id=$3) OR (sender_id=$3 AND receiver_id=$2))
       ORDER BY created_at ASC`,
      [productId, senderId, receiverId]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /messages error:", err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// -------------------
// GET all conversations for a user
// -------------------
// GET /messages/conversations?userId=...
router.get("/conversations", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: "Missing userId" });

  try {
    const { rows } = await pool.query(
      `
      SELECT DISTINCT ON (product_id, other_user_id) 
        product_id,
        CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END AS other_user_id,
        MAX(message) AS last_message,
        MAX(created_at) AS last_message_at
      FROM messages
      WHERE sender_id=$1 OR receiver_id=$1
      GROUP BY product_id, other_user_id
      ORDER BY product_id, other_user_id, last_message_at DESC
      `,
      [userId]
    );

    // Fetch names of other users
    for (const row of rows) {
      const userRes = await pool.query("SELECT name FROM users WHERE id=$1", [
        row.other_user_id,
      ]);
      row.other_user_name = userRes.rows[0]?.name || "Unknown";
    }

    res.json(rows);
  } catch (err) {
    console.error("GET /messages/conversations error:", err);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

// -------------------
// POST a new message
// -------------------
// POST /messages
router.post("/", async (req, res) => {
  const { senderId, receiverId, productId, message } = req.body;
  if (!senderId || !receiverId || !productId || !message) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, product_id, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [senderId, receiverId, productId, message]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /messages error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

export default router;