// routes/messages.js
import express from "express";
import { pub } from "../config/redis.js";
import { pool } from "../config/db.js";
import { v4 as uuid } from "uuid";

const router = express.Router();

/**
 * Get threads
 */
router.get("/threads", async (req, res) => {
  const userId = req.user.id;

  const { rows } = await pool.query(`
    SELECT t.*, 
      u.name AS other_user_name
    FROM chat_threads t
    JOIN users u 
      ON u.id = CASE 
        WHEN t.buyer_id = $1 THEN t.seller_id
        ELSE t.buyer_id
      END
    WHERE t.buyer_id = $1 OR t.seller_id = $1
    ORDER BY t.last_message_at DESC
  `, [userId]);

  res.json(rows);
});

/**
 * Get messages
 */
router.get("/:threadId", async (req, res) => {
  const { threadId } = req.params;

  const { rows } = await pool.query(`
    SELECT * FROM chat_messages
    WHERE thread_id = $1
    ORDER BY created_at ASC
    LIMIT 100
  `, [threadId]);

  res.json(rows);
});

/**
 * Send message (publish only)
 */
router.post("/send", async (req, res) => {
  const userId = req.user.id;
  const { threadId, message, clientMessageId } = req.body;

  const payload = {
    id: uuid(),
    thread_id: threadId,
    sender_id: userId,
    message,
    client_message_id: clientMessageId,
    created_at: new Date(),
    status: "sent",
  };

  await pub.publish("chat_events", JSON.stringify({
    type: "NEW_MESSAGE",
    threadId,
    payload,
  }));

  res.json(payload);
});

export default router;