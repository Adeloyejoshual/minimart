import express  from "express";
import { pool }             from "../config/db.js";
const router = express.Router();

// GET /api/messages?senderId=&receiverId=&productId=
router.get("/", async (req, res) => {
  const { senderId, receiverId, productId } = req.query;
  if (!senderId || !receiverId || !productId)
    return res.status(400).json({ error: "senderId, receiverId, productId required" });

  try {
    const { rows } = await pool.query(
      `SELECT id, sender_id, receiver_id, product_id, message, created_at
       FROM messages
       WHERE product_id = $1
         AND (
           (sender_id = $2 AND receiver_id = $3)
           OR
           (sender_id = $3 AND receiver_id = $2)
         )
       ORDER BY created_at ASC`,
      [productId, senderId, receiverId]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /messages error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages
router.post("/", async (req, res) => {
  const { senderId, receiverId, productId, message } = req.body;
  if (!senderId || !receiverId || !productId || !message)
    return res.status(400).json({ error: "All fields required" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, product_id, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, receiver_id, product_id, message, created_at`,
      [senderId, receiverId, productId, message]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /messages error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;