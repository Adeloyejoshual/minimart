import express            from "express";
import jwt                from "jsonwebtoken";
import { pool }           from "../server.js";
import { softAuth }       from "../middleware/auth.js";  // ← import softAuth

const router = express.Router();

/* ══════════════════════════════════════════════
   GET /api/messages?threadId=&userId=
══════════════════════════════════════════════ */
router.get("/", softAuth, async (req, res) => {
  const { threadId, before, limit = 50 } = req.query;

  /* JWT wins, query param is fallback */
  const userId = req.user?.id || req.query.userId;

  console.log("📨 GET /messages", {
    threadId,
    userId,
    fromJWT:   !!req.user?.id,
    fromParam: !!req.query.userId,
  });

  if (!threadId) {
    return res.status(400).json({ success: false, message: "threadId required" });
  }
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "userId or auth token required",
    });
  }

  const pageSize = Math.min(parseInt(limit, 10) || 50, 100);

  try {
    /* ── Verify user belongs to thread ── */
    const { rows: threadRows } = await pool.query(
      `SELECT id, buyer_id, seller_id
       FROM   public.chat_threads
       WHERE  id = $1`,
      [threadId]
    );

    if (!threadRows[0]) {
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    const t        = threadRows[0];
    const isMember = t.buyer_id === userId || t.seller_id === userId;

    console.log("🧵 Thread:", t);
    console.log("👤 userId:", userId, "| isMember:", isMember);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: `Access denied — user ${userId} not in thread`,
      });
    }

    /* ── Build query ── */
    const params       = [threadId, pageSize];
    const cursorClause = before
      ? `AND m.created_at < $${params.push(before) && params.length}`
      : "";

    const { rows } = await pool.query(
      `SELECT
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
       ORDER BY m.created_at DESC
       LIMIT $2`,
      params
    );

    console.log(`✅ Returning ${rows.length} messages`);
    return res.json(rows.reverse());

  } catch (err) {
    console.error("GET /messages error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   GET /api/messages/unread-count
   MUST be before /:messageId
══════════════════════════════════════════════ */
router.get("/unread-count", softAuth, async (req, res) => {
  const userId = req.user?.id || req.query.userId;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(m.id)::INT AS total_unread
       FROM   public.chat_threads            t
       JOIN   public.chat_messages           m
              ON  m.thread_id = t.id
       LEFT   JOIN public.chat_read_receipts rr
              ON  rr.thread_id = t.id
              AND rr.user_id   = $1
       WHERE  (t.buyer_id  = $1 OR t.seller_id = $1)
         AND  t.is_archived  = false
         AND  m.sender_id   <> $1
         AND  m.deleted      = false
         AND  (rr.last_read_at IS NULL
               OR m.created_at > rr.last_read_at)`,
      [userId]
    );

    return res.json({ unreadCount: rows[0].total_unread });
  } catch (err) {
    console.error("GET /unread-count error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   POST /api/messages
══════════════════════════════════════════════ */
router.post("/", softAuth, async (req, res) => {
  const {
    threadId,
    message,
    messageType     = "text",
    mediaUrl        = null,
    clientMessageId = null,
  } = req.body;

  const senderId = req.user?.id || req.body.senderId;

  console.log("📤 POST /messages", { threadId, senderId, messageType });

  if (!threadId || !senderId) {
    return res.status(400).json({
      success: false,
      message: "threadId and senderId required",
    });
  }
  if (!message && !mediaUrl) {
    return res.status(400).json({
      success: false,
      message: "message or mediaUrl required",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Idempotency ── */
    if (clientMessageId) {
      const { rows: existing } = await client.query(
        `SELECT * FROM public.chat_messages
         WHERE  client_message_id = $1
           AND  sender_id         = $2`,
        [clientMessageId, senderId]
      );
      if (existing.length > 0) {
        await client.query("COMMIT");
        return res.status(200).json(existing[0]);
      }
    }

    /* ── Verify sender is in thread ── */
    const { rows: threadRows } = await client.query(
      `SELECT id, buyer_id, seller_id, is_blocked
       FROM   public.chat_threads
       WHERE  id = $1`,
      [threadId]
    );

    if (!threadRows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    const t        = threadRows[0];
    const isMember = t.buyer_id === senderId || t.seller_id === senderId;

    if (!isMember) {
      await client.query("ROLLBACK");
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (t.is_blocked) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: "Conversation is blocked",
      });
    }

    /* ── Insert ── */
    const { rows } = await client.query(
      `INSERT INTO public.chat_messages
         (thread_id, sender_id, message, message_type,
          media_url, status, client_message_id)
       VALUES ($1, $2, $3, $4, $5, 'sent', $6)
       RETURNING *`,
      [threadId, senderId, message ?? null, messageType, mediaUrl, clientMessageId]
    );

    const saved   = rows[0];
    const preview =
      messageType === "text"
        ? message.length > 80
          ? message.slice(0, 80) + "…"
          : message
        : `[${messageType}]`;

    /* ── Update thread summary ── */
    await client.query(
      `UPDATE public.chat_threads
       SET    last_message    = $1,
              last_message_at = $2
       WHERE  id = $3`,
      [preview, saved.created_at, threadId]
    );

    await client.query("COMMIT");

    /* ── Return with sender info ── */
    const { rows: full } = await pool.query(
      `SELECT m.*,
              u.name          AS sender_name,
              u.profile_image AS sender_image
       FROM   public.chat_messages m
       JOIN   public.users         u ON u.id = m.sender_id
       WHERE  m.id = $1`,
      [saved.id]
    );

    return res.status(201).json(full[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /messages error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════
   PATCH /api/messages/:messageId  (edit)
══════════════════════════════════════════════ */
router.patch("/:messageId", softAuth, async (req, res) => {
  const { messageId } = req.params;
  const { message }   = req.body;
  const senderId      = req.user?.id || req.body.senderId;

  if (!message?.trim()) {
    return res.status(400).json({ success: false, message: "message required" });
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
    console.error("PATCH /messages error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   DELETE /api/messages/:messageId  (soft)
══════════════════════════════════════════════ */
router.delete("/:messageId", softAuth, async (req, res) => {
  const { messageId } = req.params;
  const senderId      = req.user?.id || req.body.senderId;

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

    /* Recompute thread preview */
    await client.query(
      `UPDATE public.chat_threads t
       SET    last_message = (
                SELECT message FROM public.chat_messages
                WHERE  thread_id = $1 AND deleted = false
                ORDER  BY created_at DESC LIMIT 1
              ),
              last_message_at = (
                SELECT created_at FROM public.chat_messages
                WHERE  thread_id = $1 AND deleted = false
                ORDER  BY created_at DESC LIMIT 1
              )
       WHERE  t.id = $1`,
      [rows[0].thread_id]
    );

    await client.query("COMMIT");
    return res.json({ success: true });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /messages error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

export default router;