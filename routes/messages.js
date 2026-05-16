import express  from "express";
import { pool } from "../config/db.js";

const router = express.Router();

// GET /api/messages?threadId=&userId=
router.get("/", async (req, res) => {
  const { threadId, userId } = req.query;
  if (!threadId || !userId)
    return res.status(400).json({ error: "threadId and userId required" });

  try {
    const { rows } = await pool.query(
      `SELECT
         id, thread_id, sender_id, message,
         created_at, status
       FROM chat_messages
       WHERE thread_id = $1
         AND deleted = false
       ORDER BY created_at ASC`,
      [threadId]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /messages:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages
router.post("/", async (req, res) => {
  const { threadId, senderId, message, clientMessageId } = req.body;
  if (!threadId || !senderId || !message)
    return res.status(400).json({ error: "threadId, senderId, message required" });

  try {
    // Idempotency — don't double-insert
    if (clientMessageId) {
      const { rows: found } = await pool.query(
        `SELECT id, thread_id, sender_id, message, created_at, status
         FROM chat_messages WHERE client_message_id = $1 LIMIT 1`,
        [clientMessageId]
      );
      if (found.length) return res.status(200).json(found[0]);
    }

    const { rows } = await pool.query(
      `INSERT INTO chat_messages (thread_id, sender_id, message, client_message_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, thread_id, sender_id, message, created_at, status`,
      [threadId, senderId, message, clientMessageId || null]
    );

    const saved = rows[0];

    // Update thread preview + unread for the other person
    await pool.query(
      `UPDATE chat_threads
       SET
         last_message    = $1,
         last_message_at = now(),
         unread_buyer    = CASE WHEN buyer_id  != $3 THEN unread_buyer  + 1 ELSE unread_buyer  END,
         unread_seller   = CASE WHEN seller_id != $3 THEN unread_seller + 1 ELSE unread_seller END
       WHERE id = $2`,
      [message.slice(0, 200), threadId, senderId]
    );

    res.status(201).json(saved);
  } catch (err) {
    console.error("POST /messages:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;