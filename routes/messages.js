const express = require("express");
const router  = express.Router();
const { pool } = require("../db");

/* ─────────────────────────────────────────────────────────
   GET /api/messages?threadId=&userId=&before=&limit=
   Paginated message history (cursor-based via `before`)
───────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  const { threadId, userId, before, limit = 50 } = req.query;
  if (!threadId || !userId)
    return res.status(400).json({ error: "threadId and userId required" });

  const pageSize = Math.min(parseInt(limit, 10) || 50, 100);

  try {
    /* Verify user belongs to thread */
    const { rowCount } = await pool.query(
      `SELECT 1 FROM public.chat_threads
       WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
      [threadId, userId]
    );
    if (rowCount === 0)
      return res.status(403).json({ error: "Access denied" });

    const params = [threadId, pageSize];
    const cursorClause = before
      ? `AND m.created_at < $${params.push(before) && params.length}`
      : "";

    const { rows } = await pool.query(
      `
      SELECT
        m.id,
        m.thread_id,
        m.sender_id,
        m.message,
        m.message_type,
        m.media_url,
        m.created_at,
        m.status,
        m.edited,
        m.deleted,
        m.client_message_id,
        u.name        AS sender_name,
        u.profile_image AS sender_image
      FROM  public.chat_messages m
      JOIN  public.users u ON u.id = m.sender_id
      WHERE m.thread_id = $1
        AND m.deleted   = false
        ${cursorClause}
      ORDER BY m.created_at DESC
      LIMIT $2
      `,
      params
    );

    /* Return oldest-first so the UI can append naturally */
    res.json(rows.reverse());
  } catch (err) {
    console.error("GET /messages:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/messages
   Send a message — idempotent via client_message_id
   Body: { threadId, senderId, message, messageType?,
           mediaUrl?, clientMessageId }
───────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  const {
    threadId,
    senderId,
    message,
    messageType     = "text",
    mediaUrl        = null,
    clientMessageId = null,
  } = req.body;

  if (!threadId || !senderId)
    return res.status(400).json({ error: "threadId and senderId required" });

  if (!message && !mediaUrl)
    return res.status(400).json({ error: "message or mediaUrl required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Idempotency: return existing if same client id ── */
    if (clientMessageId) {
      const { rows: existing } = await client.query(
        `SELECT * FROM public.chat_messages
         WHERE client_message_id = $1 AND sender_id = $2`,
        [clientMessageId, senderId]
      );
      if (existing.length > 0) {
        await client.query("COMMIT");
        return res.status(200).json(existing[0]);
      }
    }

    /* ── Verify sender is in thread ── */
    const { rowCount } = await client.query(
      `SELECT 1 FROM public.chat_threads
       WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)
         AND is_blocked = false`,
      [threadId, senderId]
    );
    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Access denied or thread blocked" });
    }

    /* ── Insert message ── */
    const { rows } = await client.query(
      `
      INSERT INTO public.chat_messages
        (thread_id, sender_id, message, message_type, media_url,
         status, client_message_id)
      VALUES ($1, $2, $3, $4, $5, 'sent', $6)
      RETURNING *
      `,
      [threadId, senderId, message ?? null, messageType, mediaUrl, clientMessageId]
    );

    const saved = rows[0];

    /* ── Update thread summary ── */
    await client.query(
      `
      UPDATE public.chat_threads
      SET   last_message    = $1,
            last_message_at = $2
      WHERE id = $3
      `,
      [
        messageType === "text" ? message : `[${messageType}]`,
        saved.created_at,
        threadId,
      ]
    );

    await client.query("COMMIT");
    res.status(201).json(saved);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /messages:", err);
    res.status(500).json({ error: "Failed to send message" });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────────────────
   PATCH /api/messages/:messageId
   Edit a message
   Body: { senderId, message }
───────────────────────────────────────────────────────── */
router.patch("/:messageId", async (req, res) => {
  const { messageId }      = req.params;
  const { senderId, message } = req.body;

  if (!message?.trim())
    return res.status(400).json({ error: "message required" });

  try {
    const { rows, rowCount } = await pool.query(
      `
      UPDATE public.chat_messages
      SET    message = $1, edited = true
      WHERE  id = $2 AND sender_id = $3 AND deleted = false
      RETURNING *
      `,
      [message.trim(), messageId, senderId]
    );

    if (rowCount === 0)
      return res.status(404).json({ error: "Message not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("PATCH /messages/:messageId:", err);
    res.status(500).json({ error: "Failed to edit message" });
  }
});

/* ─────────────────────────────────────────────────────────
   DELETE /api/messages/:messageId
   Soft-delete a single message
   Body: { senderId }
───────────────────────────────────────────────────────── */
router.delete("/:messageId", async (req, res) => {
  const { messageId } = req.params;
  const { senderId }  = req.body;

  try {
    const { rowCount } = await pool.query(
      `UPDATE public.chat_messages
       SET    deleted = true
       WHERE  id = $1 AND sender_id = $2`,
      [messageId, senderId]
    );

    if (rowCount === 0)
      return res.status(404).json({ error: "Message not found" });

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /messages/:messageId:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

module.exports = router;