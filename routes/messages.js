import express  from "express";
import { pool } from "../server.js";

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

export default router;