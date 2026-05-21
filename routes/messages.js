import express          from "express";
import { pool }         from "../server.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════
   GET /api/messages?threadId=&userId=&before=&limit=
   Cursor-paginated history (newest-first internally,
   returned oldest-first so UI can append)
═══════════════════════════════════════════════════════════ */
router.get("/", authenticate, async (req, res) => {
  const {
    threadId,
    before,          // ISO timestamp cursor for pagination
    limit   = 50,
    /* legacy — ignored when JWT present */
    userId  = req.user.id,
  } = req.query;

  if (!threadId) {
    return res.status(400).json({ success: false, message: "threadId required" });
  }

  const pageSize = Math.min(parseInt(limit, 10) || 50, 100);

  try {
    /* ── Access guard ── */
    const { rowCount } = await pool.query(
      `SELECT 1 FROM public.chat_threads
       WHERE id = $1
         AND (buyer_id = $2 OR seller_id = $2)
         AND is_archived = false`,
      [threadId, userId]
    );
    if (!rowCount) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    /* ── Build cursor clause ── */
    const params        = [threadId, pageSize];
    const cursorClause  = before
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
        u.name          AS sender_name,
        u.profile_image AS sender_image
      FROM  public.chat_messages m
      JOIN  public.users         u ON u.id = m.sender_id
      WHERE m.thread_id = $1
        AND m.deleted   = false
        ${cursorClause}
      ORDER  BY m.created_at DESC
      LIMIT  $2
      `,
      params
    );

    /* Return oldest-first so the UI renders top→bottom */
    return res.json(rows.reverse());
  } catch (err) {
    console.error("GET /messages:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
});

/* ═══════════════════════════════════════════════════════════
   POST /api/messages
   Send a new message — fully idempotent via client_message_id
   Body: { threadId, senderId?, message, messageType?,
           mediaUrl?, clientMessageId }
═══════════════════════════════════════════════════════════ */
router.post("/", authenticate, async (req, res) => {
  const {
    threadId,
    message,
    messageType     = "text",
    mediaUrl        = null,
    clientMessageId = null,
    /* allow legacy senderId; JWT wins */
    senderId        = req.user.id,
  } = req.body;

  if (!threadId) {
    return res.status(400).json({ success: false, message: "threadId required" });
  }
  if (!message && !mediaUrl) {
    return res.status(400).json({ success: false, message: "message or mediaUrl required" });
  }
  if (message && message.length > 5000) {
    return res.status(400).json({ success: false, message: "Message too long (max 5000 chars)" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Idempotency: return existing row for same client id ── */
    if (clientMessageId) {
      const { rows: existing } = await client.query(
        `SELECT m.*, u.name AS sender_name, u.profile_image AS sender_image
         FROM   public.chat_messages m
         JOIN   public.users u ON u.id = m.sender_id
         WHERE  m.client_message_id = $1
           AND  m.sender_id         = $2`,
        [clientMessageId, senderId]
      );
      if (existing.length > 0) {
        await client.query("COMMIT");
        return res.status(200).json(existing[0]);
      }
    }

    /* ── Verify sender is in thread and it isn't blocked ── */
    const { rowCount } = await client.query(
      `SELECT 1 FROM public.chat_threads
       WHERE  id         = $1
         AND  (buyer_id  = $2 OR seller_id = $2)
         AND  is_blocked = false`,
      [threadId, senderId]
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: "Access denied or conversation is blocked",
      });
    }

    /* ── Insert message ── */
    const { rows } = await client.query(
      `
      INSERT INTO public.chat_messages
        (thread_id, sender_id, message, message_type,
         media_url, status, client_message_id)
      VALUES ($1, $2, $3, $4, $5, 'sent', $6)
      RETURNING *
      `,
      [threadId, senderId, message ?? null, messageType, mediaUrl, clientMessageId]
    );

    const saved = rows[0];

    /* ── Update thread summary ── */
    const preview =
      messageType === "text"
        ? (message.length > 80 ? message.slice(0, 80) + "…" : message)
        : `[${messageType}]`;

    await client.query(
      `UPDATE public.chat_threads
       SET   last_message    = $1,
             last_message_at = $2
       WHERE id = $3`,
      [preview, saved.created_at, threadId]
    );

    await client.query("COMMIT");

    /* ── Return with sender info attached ── */
    const { rows: withUser } = await pool.query(
      `SELECT m.*, u.name AS sender_name, u.profile_image AS sender_image
       FROM   public.chat_messages m
       JOIN   public.users         u ON u.id = m.sender_id
       WHERE  m.id = $1`,
      [saved.id]
    );

    return res.status(201).json(withUser[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /messages:", err);
    return res.status(500).json({ success: false, message: "Failed to send message" });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════
   PATCH /api/messages/:messageId
   Edit your own message
   Body: { message }
═══════════════════════════════════════════════════════════ */
router.patch("/:messageId", authenticate, async (req, res) => {
  const { messageId }    = req.params;
  const { message }      = req.body;
  const senderId         = req.user.id;

  if (!message?.trim()) {
    return res.status(400).json({ success: false, message: "message required" });
  }
  if (message.length > 5000) {
    return res.status(400).json({ success: false, message: "Message too long" });
  }

  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE public.chat_messages
       SET    message = $1,
              edited  = true
       WHERE  id        = $2
         AND  sender_id = $3
         AND  deleted   = false
       RETURNING *`,
      [message.trim(), messageId, senderId]
    );

    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("PATCH /messages/:messageId:", err);
    return res.status(500).json({ success: false, message: "Failed to edit message" });
  }
});

/* ═══════════════════════════════════════════════════════════
   DELETE /api/messages/:messageId
   Soft-delete your own message
═══════════════════════════════════════════════════════════ */
router.delete("/:messageId", authenticate, async (req, res) => {
  const { messageId } = req.params;
  const senderId      = req.user.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows, rowCount } = await client.query(
      `UPDATE public.chat_messages
       SET    deleted = true
       WHERE  id        = $1
         AND  sender_id = $2
       RETURNING thread_id`,
      [messageId, senderId]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    /* Re-compute thread preview after deletion */
    await client.query(
      `UPDATE public.chat_threads t
       SET   last_message = (
               SELECT message
               FROM   public.chat_messages
               WHERE  thread_id = $1
                 AND  deleted   = false
               ORDER  BY created_at DESC
               LIMIT  1
             ),
             last_message_at = (
               SELECT created_at
               FROM   public.chat_messages
               WHERE  thread_id = $1
                 AND  deleted   = false
               ORDER  BY created_at DESC
               LIMIT  1
             )
       WHERE t.id = $1`,
      [rows[0].thread_id]
    );

    await client.query("COMMIT");
    return res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /messages/:messageId:", err);
    return res.status(500).json({ success: false, message: "Failed to delete message" });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════
   GET /api/messages/unread-count?userId=
   Total unread across all threads — for nav badge
═══════════════════════════════════════════════════════════ */
router.get("/unread-count", authenticate, async (req, res) => {
  const userId = req.query.userId ?? req.user.id;

  try {
    const { rows } = await pool.query(
      `
      SELECT COUNT(m.id)::INT AS total_unread
      FROM   public.chat_threads          t
      JOIN   public.chat_messages         m  ON m.thread_id  = t.id
      LEFT   JOIN public.chat_read_receipts rr
             ON  rr.thread_id = t.id
             AND rr.user_id   = $1
      WHERE  (t.buyer_id  = $1 OR t.seller_id = $1)
        AND  t.is_archived  = false
        AND  m.sender_id   <> $1
        AND  m.deleted      = false
        AND  (rr.last_read_at IS NULL OR m.created_at > rr.last_read_at)
      `,
      [userId]
    );

    return res.json({ unreadCount: rows[0].total_unread });
  } catch (err) {
    console.error("GET /messages/unread-count:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch unread count" });
  }
});

export default router;