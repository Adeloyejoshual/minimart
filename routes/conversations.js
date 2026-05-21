const express = require("express");
const router  = express.Router();
const { pool } = require("../db");

/* ─────────────────────────────────────────────────────────
   GET /api/conversations?userId=<uuid>
   Returns all threads for a user with unread counts
───────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    const { rows } = await pool.query(
      `
      SELECT
        t.id                                       AS thread_id,
        t.product_id,
        t.last_message,
        t.last_message_at,
        t.is_archived,
        t.is_blocked,
        t.buyer_id,
        t.seller_id,

        /* other participant */
        CASE WHEN t.buyer_id = $1 THEN t.seller_id
             ELSE t.buyer_id
        END                                        AS other_user_id,

        /* other user profile */
        u.name                                     AS other_user_name,
        u.profile_image                            AS other_user_image,
        u.is_online                                AS other_user_online,

        /* product snapshot */
        p.title                                    AS product_title,
        p.images->>0                               AS product_image,
        p.price                                    AS product_price,

        /* unread count — messages after last read */
        COUNT(m.id) FILTER (
          WHERE m.sender_id <> $1
            AND m.deleted   =  false
            AND (rr.last_read_at IS NULL
                 OR m.created_at > rr.last_read_at)
        )                                          AS unread_count

      FROM  public.chat_threads        t
      JOIN  public.users               u
            ON  u.id = CASE WHEN t.buyer_id = $1
                             THEN t.seller_id
                             ELSE t.buyer_id END
      LEFT JOIN public.products        p  ON p.id  = t.product_id
      LEFT JOIN public.chat_messages   m  ON m.thread_id = t.id
      LEFT JOIN public.chat_read_receipts rr
            ON  rr.thread_id = t.id AND rr.user_id = $1

      WHERE (t.buyer_id = $1 OR t.seller_id = $1)
        AND t.is_archived = false

      GROUP BY
        t.id, t.product_id, t.last_message, t.last_message_at,
        t.is_archived, t.is_blocked, t.buyer_id, t.seller_id,
        u.name, u.profile_image, u.is_online,
        p.title, p.images, p.price,
        rr.last_read_at

      ORDER BY t.last_message_at DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("GET /conversations:", err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/conversations
   Create or return existing thread
   Body: { buyerId, sellerId, productId? }
───────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  const { buyerId, sellerId, productId = null } = req.body;

  if (!buyerId || !sellerId)
    return res.status(400).json({ error: "buyerId and sellerId required" });

  if (buyerId === sellerId)
    return res.status(400).json({ error: "Cannot create thread with yourself" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Upsert — unique constraint: (buyer_id, seller_id, product_id) */
    const { rows } = await client.query(
      `
      INSERT INTO public.chat_threads (buyer_id, seller_id, product_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (buyer_id, seller_id, product_id) DO UPDATE
        SET last_message_at = EXCLUDED.last_message_at   -- no-op keeps row
      RETURNING id AS thread_id, buyer_id, seller_id, product_id,
                last_message, last_message_at, created_at
      `,
      [buyerId, sellerId, productId]
    );

    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /conversations:", err);
    res.status(500).json({ error: "Failed to create conversation" });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────────────────
   PATCH /api/conversations/:threadId/read
   Update read receipt for the calling user
   Body: { userId }
───────────────────────────────────────────────────────── */
router.patch("/:threadId/read", async (req, res) => {
  const { threadId } = req.params;
  const { userId }   = req.body;

  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    /* Upsert read receipt with the latest message id */
    await pool.query(
      `
      INSERT INTO public.chat_read_receipts
        (thread_id, user_id, last_read_message_id, last_read_at)
      SELECT
        $1, $2,
        (SELECT id FROM public.chat_messages
         WHERE thread_id = $1 AND deleted = false
         ORDER BY created_at DESC LIMIT 1),
        now()
      ON CONFLICT (thread_id, user_id) DO UPDATE
        SET last_read_message_id = EXCLUDED.last_read_message_id,
            last_read_at         = now()
      `,
      [threadId, userId]
    );

    /* Mark all messages from the other person as read */
    await pool.query(
      `
      UPDATE public.chat_messages
      SET    status = 'read'
      WHERE  thread_id  = $1
        AND  sender_id <> $2
        AND  status    <> 'read'
        AND  deleted    = false
      `,
      [threadId, userId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /conversations/:threadId/read:", err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

/* ─────────────────────────────────────────────────────────
   PATCH /api/conversations/:threadId/archive
   Body: { userId, archive: bool }
───────────────────────────────────────────────────────── */
router.patch("/:threadId/archive", async (req, res) => {
  const { threadId }        = req.params;
  const { userId, archive } = req.body;

  try {
    const { rowCount } = await pool.query(
      `UPDATE public.chat_threads
       SET    is_archived = $1
       WHERE  id = $2 AND (buyer_id = $3 OR seller_id = $3)`,
      [!!archive, threadId, userId]
    );

    if (rowCount === 0)
      return res.status(404).json({ error: "Thread not found" });

    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /archive:", err);
    res.status(500).json({ error: "Failed to archive" });
  }
});

/* ─────────────────────────────────────────────────────────
   DELETE /api/conversations/:threadId
   Soft-delete: archives + marks all messages deleted
   Body: { userId }
───────────────────────────────────────────────────────── */
router.delete("/:threadId", async (req, res) => {
  const { threadId } = req.params;
  const { userId }   = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE public.chat_threads
       SET    is_archived = true
       WHERE  id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
      [threadId, userId]
    );

    await client.query(
      `UPDATE public.chat_messages
       SET    deleted = true
       WHERE  thread_id = $1 AND sender_id = $2`,
      [threadId, userId]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /conversations:", err);
    res.status(500).json({ error: "Failed to delete" });
  } finally {
    client.release();
  }
});

module.exports = router;