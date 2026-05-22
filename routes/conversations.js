// routes/conversations.js
import express      from "express";
import { pool }     from "../server.js";
import { softAuth } from "../middleware/auth.js";

const router = express.Router();

/* ── helpers ── */
function shapeConversation(row) {
  return {
    thread_id:         row.thread_id,
    id:                row.thread_id,
    product_id:        row.product_id      || null,
    last_message:      row.last_message    || null,
    last_message_at:   row.last_message_at || null,
    is_archived:       row.is_archived     || false,
    is_blocked:        row.is_blocked      || false,
    buyer_id:          row.buyer_id,
    seller_id:         row.seller_id,
    created_at:        row.created_at,
    other_user_id:     row.other_user_id   || null,
    other_user_name:   row.other_user_name || "User",
    other_user_image:  row.other_user_image || null,
    other_user_online: row.other_user_online || false,
    other_user_store:  row.other_user_store  || null,
    last_login:        row.last_login        || null,
    product_title:     row.product_title  || null,
    product_price:     row.product_price ? Number(row.product_price) : null,
    product_image:     row.product_image  || null,
    product_id_ref:    row.product_id     || null,
    last_sender_id:    row.last_sender_id  || null,
    unread_count:      Number(row.unread_count || 0),
  };
}

/* ══════════════════════════════════════════════
   GET /api/conversations
══════════════════════════════════════════════ */
router.get("/", softAuth, async (req, res) => {
  const userId = req.user?.id || req.query.userId;
  const limit  = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const offset = (Math.max(parseInt(req.query.page, 10) || 1, 1) - 1) * limit;

  if (!userId)
    return res.status(400).json({ success: false, message: "userId required" });

  try {
    const { rows } = await pool.query(
      `SELECT
         t.id                  AS thread_id,
         t.product_id,
         t.last_message,
         t.last_message_at,
         t.is_archived,
         t.is_blocked,
         t.buyer_id,
         t.seller_id,
         t.created_at,

         CASE WHEN t.buyer_id = $1 THEN t.seller_id
              ELSE t.buyer_id END              AS other_user_id,

         u.name                               AS other_user_name,
         u.profile_image                      AS other_user_image,
         u.is_online                          AS other_user_online,
         u.store_name                         AS other_user_store,
         u.last_login,

         p.title    AS product_title,
         p.price    AS product_price,
         p.main_image AS product_image,

         lm.sender_id AS last_sender_id,

         COUNT(m.id) FILTER (
           WHERE m.sender_id <> $1
             AND m.deleted = false
             AND (rr.last_read_at IS NULL OR m.created_at > rr.last_read_at)
         )::INT AS unread_count

       FROM public.chat_threads t

       JOIN public.users u
         ON u.id = CASE WHEN t.buyer_id = $1 THEN t.seller_id ELSE t.buyer_id END

       LEFT JOIN public.products           p  ON p.id = t.product_id
       LEFT JOIN public.chat_messages      m  ON m.thread_id = t.id
       LEFT JOIN public.chat_read_receipts rr ON rr.thread_id = t.id AND rr.user_id = $1

       LEFT JOIN LATERAL (
         SELECT sender_id FROM public.chat_messages
         WHERE  thread_id = t.id AND deleted = false
         ORDER  BY created_at DESC LIMIT 1
       ) lm ON true

       WHERE (t.buyer_id = $1 OR t.seller_id = $1)
         AND t.is_archived = false
         /* hide soft-deleted for this user */
         AND (
           (t.buyer_id  = $1 AND (t.deleted_by_buyer  = false OR t.deleted_by_buyer  IS NULL))
           OR
           (t.seller_id = $1 AND (t.deleted_by_seller = false OR t.deleted_by_seller IS NULL))
         )

       GROUP BY
         t.id, t.product_id, t.last_message, t.last_message_at,
         t.is_archived, t.is_blocked, t.buyer_id, t.seller_id, t.created_at,
         u.name, u.profile_image, u.is_online, u.store_name, u.last_login,
         p.title, p.price, p.main_image, rr.last_read_at, lm.sender_id

       ORDER BY t.last_message_at DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.json(rows.map(shapeConversation));
  } catch (err) {
    console.error("GET /conversations error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   GET /api/conversations/:threadId
══════════════════════════════════════════════ */
router.get("/:threadId", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.user?.id || req.query.userId;

  try {
    const { rows } = await pool.query(
      `SELECT
         t.id AS thread_id, t.product_id,
         t.last_message, t.last_message_at,
         t.is_archived, t.is_blocked,
         t.buyer_id, t.seller_id, t.created_at,
         CASE WHEN t.buyer_id = $2 THEN t.seller_id ELSE t.buyer_id END AS other_user_id,
         u.name AS other_user_name, u.profile_image AS other_user_image,
         u.is_online AS other_user_online, u.store_name AS other_user_store,
         u.last_login,
         p.title AS product_title, p.price AS product_price,
         p.main_image AS product_image, p.id AS product_id_ref
       FROM  public.chat_threads t
       JOIN  public.users u ON u.id = CASE WHEN t.buyer_id = $2 THEN t.seller_id ELSE t.buyer_id END
       LEFT JOIN public.products p ON p.id = t.product_id
       WHERE t.id = $1`,
      [threadId, userId || "00000000-0000-0000-0000-000000000000"]
    );

    if (!rows[0])
      return res.status(404).json({ success: false, message: "Thread not found" });

    return res.json(shapeConversation(rows[0]));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════
   POST /api/conversations
══════════════════════════════════════════════ */
router.post("/", softAuth, async (req, res) => {
  const buyerId   = req.user?.id || req.body.buyerId;
  const sellerId  = req.body.sellerId;
  const productId = req.body.productId || null;

  if (!buyerId)  return res.status(400).json({ success:false, message:"buyerId required" });
  if (!sellerId) return res.status(400).json({ success:false, message:"sellerId required" });
  if (buyerId === sellerId)
    return res.status(400).json({ success:false, message:"Cannot chat with yourself" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: users } = await client.query(
      `SELECT id FROM public.users WHERE id = ANY($1::uuid[])`,
      [[buyerId, sellerId]]
    );
    const found = new Set(users.map(u => u.id));
    if (!found.has(buyerId))
      return (await client.query("ROLLBACK"), client.release(),
        res.status(404).json({ success:false, message:"Buyer not found" }));
    if (!found.has(sellerId))
      return (await client.query("ROLLBACK"), client.release(),
        res.status(404).json({ success:false, message:"Seller not found" }));

    const findQ = productId
      ? `SELECT id AS thread_id, id, buyer_id, seller_id, product_id,
                last_message, last_message_at, created_at, is_archived, is_blocked
         FROM public.chat_threads
         WHERE buyer_id=$1 AND seller_id=$2 AND product_id=$3 LIMIT 1`
      : `SELECT id AS thread_id, id, buyer_id, seller_id, product_id,
                last_message, last_message_at, created_at, is_archived, is_blocked
         FROM public.chat_threads
         WHERE buyer_id=$1 AND seller_id=$2 AND product_id IS NULL LIMIT 1`;

    const { rows: existing } = await client.query(
      findQ,
      productId ? [buyerId, sellerId, productId] : [buyerId, sellerId]
    );

    if (existing.length > 0) {
      /* if buyer previously deleted it, restore visibility */
      await client.query(
        `UPDATE public.chat_threads
         SET deleted_by_buyer = false, deleted_at_buyer = NULL
         WHERE id = $1 AND buyer_id = $2 AND deleted_by_buyer = true`,
        [existing[0].id, buyerId]
      );
      await client.query("COMMIT");
      return res.status(200).json(shapeConversation(existing[0]));
    }

    const { rows: created } = await client.query(
      `INSERT INTO public.chat_threads (buyer_id, seller_id, product_id)
       VALUES ($1, $2, $3)
       RETURNING id AS thread_id, id, buyer_id, seller_id, product_id,
                 last_message, last_message_at, created_at, is_archived, is_blocked`,
      [buyerId, sellerId, productId]
    );
    await client.query("COMMIT");
    return res.status(201).json(shapeConversation(created[0]));

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") {
      /* race condition — fetch existing */
      const { rows: fb } = await pool.query(
        productId
          ? `SELECT id AS thread_id, id, buyer_id, seller_id, product_id,
                    last_message, last_message_at, created_at, is_archived, is_blocked
             FROM public.chat_threads
             WHERE buyer_id=$1 AND seller_id=$2 AND product_id=$3 LIMIT 1`
          : `SELECT id AS thread_id, id, buyer_id, seller_id, product_id,
                    last_message, last_message_at, created_at, is_archived, is_blocked
             FROM public.chat_threads
             WHERE buyer_id=$1 AND seller_id=$2 AND product_id IS NULL LIMIT 1`,
        productId ? [buyerId, sellerId, productId] : [buyerId, sellerId]
      );
      if (fb.length > 0) return res.status(200).json(shapeConversation(fb[0]));
    }
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════
   PATCH /api/conversations/:threadId/read
══════════════════════════════════════════════ */
router.patch("/:threadId/read", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.user?.id || req.body.userId;

  if (!userId)
    return res.status(400).json({ success:false, message:"userId required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: tr } = await client.query(
      `SELECT id FROM public.chat_threads
       WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)`,
      [threadId, userId]
    );
    if (!tr[0]) {
      await client.query("ROLLBACK");
      return res.status(403).json({ success:false, message:"Access denied" });
    }

    await client.query(
      `INSERT INTO public.chat_read_receipts (thread_id, user_id, last_read_message_id, last_read_at)
       SELECT $1, $2,
         (SELECT id FROM public.chat_messages
          WHERE thread_id=$1 AND deleted=false ORDER BY created_at DESC LIMIT 1),
         NOW()
       ON CONFLICT (thread_id, user_id) DO UPDATE
         SET last_read_message_id = EXCLUDED.last_read_message_id,
             last_read_at         = NOW()`,
      [threadId, userId]
    );

    const { rowCount } = await client.query(
      `UPDATE public.chat_messages
       SET status='read'
       WHERE thread_id=$1 AND sender_id<>$2 AND status<>'read' AND deleted=false`,
      [threadId, userId]
    );

    await client.query("COMMIT");
    return res.json({ success:true, messagesUpdated: rowCount });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ success:false, message:err.message });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════
   DELETE /api/conversations/:threadId
   Soft-delete — hides from user's inbox for 90 days
══════════════════════════════════════════════ */
router.delete("/:threadId", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.user?.id || req.body.userId;

  if (!userId)
    return res.status(400).json({ success:false, message:"userId required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* find thread and determine role */
    const { rows: tr } = await client.query(
      `SELECT id, buyer_id, seller_id, is_under_review
       FROM public.chat_threads
       WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)`,
      [threadId, userId]
    );

    if (!tr[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success:false, message:"Thread not found" });
    }

    const isBuyer  = tr[0].buyer_id  === userId;
    const isSeller = tr[0].seller_id === userId;

    if (isBuyer) {
      await client.query(
        `UPDATE public.chat_threads
         SET deleted_by_buyer=true, deleted_at_buyer=NOW()
         WHERE id=$1`,
        [threadId]
      );
    } else if (isSeller) {
      await client.query(
        `UPDATE public.chat_threads
         SET deleted_by_seller=true, deleted_at_seller=NOW()
         WHERE id=$1`,
        [threadId]
      );
    }

    await client.query("COMMIT");
    return res.json({ success:true, message:"Chat hidden from your inbox" });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ success:false, message:err.message });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════
   POST /api/conversations/:threadId/report
   Buyer only — submit a report
══════════════════════════════════════════════ */
router.post("/:threadId/report", softAuth, async (req, res) => {
  const { threadId }  = req.params;
  const userId        = req.user?.id || req.body.userId;
  const { reason, details = "", messageId = null } = req.body;

  const VALID_REASONS = [
    "spam",
    "scam",
    "harassment",
    "fake_payment",
    "threats",
    "inappropriate_content",
    "other",
  ];

  if (!userId)
    return res.status(401).json({ success:false, message:"Auth required" });
  if (!reason || !VALID_REASONS.includes(reason))
    return res.status(400).json({
      success:false,
      message:`reason must be one of: ${VALID_REASONS.join(", ")}`,
    });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* verify reporter is in this thread AND is the buyer */
    const { rows: tr } = await client.query(
      `SELECT id, buyer_id, seller_id FROM public.chat_threads
       WHERE id=$1`,
      [threadId]
    );

    if (!tr[0])
      return (await client.query("ROLLBACK"), client.release(),
        res.status(404).json({ success:false, message:"Thread not found" }));

    const isMember = tr[0].buyer_id === userId || tr[0].seller_id === userId;
    if (!isMember)
      return (await client.query("ROLLBACK"), client.release(),
        res.status(403).json({ success:false, message:"Access denied" }));

    /* Only buyer can report (per spec) */
    if (tr[0].buyer_id !== userId)
      return (await client.query("ROLLBACK"), client.release(),
        res.status(403).json({
          success:false,
          message:"Only the buyer can submit a report",
        }));

    /* prevent duplicate pending reports */
    const { rows: existing } = await client.query(
      `SELECT id FROM public.chat_reports
       WHERE conversation_id=$1 AND reporter_id=$2 AND status='pending'`,
      [threadId, userId]
    );
    if (existing.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success:false,
        message:"You already have a pending report for this conversation",
      });
    }

    /* insert report */
    const { rows: report } = await client.query(
      `INSERT INTO public.chat_reports
         (reporter_id, conversation_id, message_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, threadId, messageId || null, reason, details.slice(0, 1000)]
    );

    /* lock the conversation from cleanup */
    await client.query(
      `UPDATE public.chat_threads
       SET is_under_review=true
       WHERE id=$1`,
      [threadId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Report submitted. Our team will review within 24–48 hours.",
      reportId: report[0].id,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /report error:", err.message);
    return res.status(500).json({ success:false, message:err.message });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════
   PATCH /api/conversations/:threadId/archive
══════════════════════════════════════════════ */
router.patch("/:threadId/archive", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const { archive = true } = req.body;
  const userId = req.user?.id || req.body.userId;

  try {
    const { rowCount } = await pool.query(
      `UPDATE public.chat_threads SET is_archived=$1
       WHERE id=$2 AND (buyer_id=$3 OR seller_id=$3)`,
      [!!archive, threadId, userId]
    );
    if (!rowCount)
      return res.status(404).json({ success:false, message:"Thread not found" });
    return res.json({ success:true, archived: !!archive });
  } catch (err) {
    return res.status(500).json({ success:false, message:err.message });
  }
});

/* ══════════════════════════════════════════════
   PATCH /api/conversations/:threadId/block
══════════════════════════════════════════════ */
router.patch("/:threadId/block", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const { block = true } = req.body;
  const userId = req.user?.id || req.body.userId;

  try {
    const { rowCount } = await pool.query(
      `UPDATE public.chat_threads SET is_blocked=$1
       WHERE id=$2 AND (buyer_id=$3 OR seller_id=$3)`,
      [!!block, threadId, userId]
    );
    if (!rowCount)
      return res.status(404).json({ success:false, message:"Thread not found" });
    return res.json({ success:true, blocked: !!block });
  } catch (err) {
    return res.status(500).json({ success:false, message:err.message });
  }
});

/* ══════════════════════════════════════════════
   PATCH /api/conversations/:threadId/mute
══════════════════════════════════════════════ */
router.patch("/:threadId/mute", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const { mute = true } = req.body;
  const userId = req.user?.id || req.body.userId;

  try {
    await pool.query(
      `INSERT INTO public.chat_mutes (thread_id, user_id, muted, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (thread_id, user_id) DO UPDATE
         SET muted=EXCLUDED.muted, updated_at=NOW()`,
      [threadId, userId, !!mute]
    );
    return res.json({ success:true, muted: !!mute });
  } catch (err) {
    return res.status(500).json({ success:false, message:err.message });
  }
});

export default router;