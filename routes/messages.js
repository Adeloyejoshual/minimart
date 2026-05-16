import express  from "express";
import { pool } from "../config/db.js";

const router = express.Router();

// GET /api/messages?threadId=&userId=&cursor=&limit=
router.get("/", async (req, res) => {
  const { threadId, userId, cursor, limit = 40 } = req.query;
  if (!threadId || !userId)
    return res.status(400).json({ error: "threadId and userId required" });

  try {
    const params = [threadId, Math.min(Number(limit), 100)];
    let cursorClause = "";
    if (cursor) {
      cursorClause = `AND m.created_at < $3`;
      params.push(cursor);
    }

    const { rows } = await pool.query(
      `SELECT
         m.id, m.thread_id, m.sender_id, m.message,
         m.message_type, m.media_url, m.created_at,
         m.status, m.edited, m.deleted,
         m.client_message_id
       FROM chat_messages m
       WHERE m.thread_id = $1
         AND m.deleted = false
         ${cursorClause}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      params
    );

    // Return oldest-first for rendering
    res.json(rows.reverse());
  } catch (err) {
    console.error("GET /messages error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages
router.post("/", async (req, res) => {
  const {
    threadId, senderId, message,
    messageType = "text", mediaUrl = null,
    clientMessageId = null,
  } = req.body;

  if (!threadId || !senderId || !message)
    return res.status(400).json({ error: "threadId, senderId, message required" });

  try {
    // Idempotency — don't insert the same client message twice
    if (clientMessageId) {
      const { rows: existing } = await pool.query(
        `SELECT id FROM chat_messages WHERE client_message_id = $1 LIMIT 1`,
        [clientMessageId]
      );
      if (existing.length) return res.status(200).json(existing[0]);
    }

    const { rows } = await pool.query(
      `INSERT INTO chat_messages
         (thread_id, sender_id, message, message_type, media_url, client_message_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, thread_id, sender_id, message, message_type,
                 media_url, created_at, status, edited, deleted, client_message_id`,
      [threadId, senderId, message, messageType, mediaUrl, clientMessageId]
    );

    const saved = rows[0];

    // Update thread last_message
    await pool.query(
      `UPDATE chat_threads
       SET last_message = $1, last_message_at = now()
       WHERE id = $2`,
      [message.slice(0, 200), threadId]
    );

    res.status(201).json(saved);
  } catch (err) {
    console.error("POST /messages error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;