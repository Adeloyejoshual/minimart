// routes/messages.js
import express from "express";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// -------------------
// GET all conversations for a user
// -------------------
router.get("/conversations", async (req, res) => {
  const { userId } = req.query;
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

    // Optional: fetch other user name
    for (const row of rows) {
      const userRes = await pool.query("SELECT name FROM users WHERE id=$1", [row.other_user_id]);
      row.other_user_name = userRes.rows[0]?.name || "Unknown";
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

// -------------------
// GET messages between two users for a product
// -------------------
router.get("/", async (req, res) => {
  const { senderId, receiverId, productId } = req.query;
  try {
    const { rows } = await pool.query(
      `
      SELECT * 
      FROM public.messages 
      WHERE product_id=$1 AND
            ((sender_id=$2 AND receiver_id=$3) OR
             (sender_id=$3 AND receiver_id=$2))
      ORDER BY created_at ASC
      `,
      [productId, senderId, receiverId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// -------------------
// POST a new message
// -------------------
router.post("/", async (req, res) => {
  const { senderId, receiverId, productId, message } = req.body;
  try {
    const { rows } = await pool.query(
      `
      INSERT INTO public.messages (sender_id, receiver_id, product_id, message, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
      `,
      [senderId, receiverId, productId, message]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

export default router;