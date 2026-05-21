import express  from "express";
import multer   from "multer";
import path     from "path";
import fs       from "fs";
import crypto   from "crypto";
import { pool } from "../server.js";
import { softAuth } from "../middleware/auth.js";

const router = express.Router();

/* ══════════════════════════════════════════════
   MULTER — images only, 10 MB max
══════════════════════════════════════════════ */
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/jpg", "image/png",
  "image/gif",  "image/webp", "image/heic",
]);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = "uploads/chat";
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const hash = crypto.randomBytes(12).toString("hex");
    const ext  = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}_${hash}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */

/** Build the public URL for an uploaded file */
function buildMediaUrl(req, filePath) {
  const baseUrl = process.env.BASE_URL ||
    `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}/${filePath.replace(/\\/g, "/")}`;
}

/** Fetch a single full message row (with sender info) */
async function fetchFullMessage(client, msgId) {
  const { rows } = await client.query(
    `SELECT
       m.id,
       m.thread_id,
       m.sender_id,
       m.message,
       m.message_type,
       m.media_url,
       m.reply_to_id,
       m.offer_amount,
       m.offer_original_price,
       m.offer_product_title,
       m.offer_note,
       m.offer_status,
       m.location_lat,
       m.location_lng,
       m.location_address,
       m.shared_product_id,
       m.shared_product_title,
       m.shared_product_price,
       m.shared_product_image,
       m.status,
       m.edited,
       m.deleted,
       m.client_message_id,
       m.created_at,
       u.name          AS sender_name,
       u.profile_image AS sender_image
     FROM  public.chat_messages m
     JOIN  public.users         u ON u.id = m.sender_id
     WHERE m.id = $1`,
    [msgId]
  );
  return rows[0] || null;
}

/** Shape a raw DB row into the format the frontend expects */
function shapeMessage(row) {
  if (!row) return null;

  const shaped = {
    id:                row.id,
    thread_id:         row.thread_id,
    sender_id:         row.sender_id,
    sender_name:       row.sender_name,
    sender_image:      row.sender_image,
    message:           row.message,
    message_type:      row.message_type,
    media_url:         row.media_url   || null,
    reply_to_id:       row.reply_to_id || null,
    status:            row.status,
    edited:            row.edited,
    deleted:           row.deleted,
    client_message_id: row.client_message_id,
    created_at:        row.created_at,
  };

  /* offer meta — only attach when present */
  if (row.offer_amount) {
    shaped._offerMeta = {
      amount:         Number(row.offer_amount),
      original_price: row.offer_original_price
        ? Number(row.offer_original_price)
        : null,
      product_title:  row.offer_product_title || null,
      note:           row.offer_note          || null,
      status:         row.offer_status        || "pending",
      type:           row.message_type === "offer" ? "offer" : "offer",
    };
  }

  /* location */
  if (row.location_lat) {
    shaped.location = {
      lat:     Number(row.location_lat),
      lng:     Number(row.location_lng),
      address: row.location_address || null,
    };
  }

  /* shared product card */
  if (row.shared_product_id || row.shared_product_title) {
    shaped.shared_product = {
      id:    row.shared_product_id    || null,
      title: row.shared_product_title || "",
      price: row.shared_product_price
        ? Number(row.shared_product_price)
        : null,
      image: row.shared_product_image || null,
    };
  }

  return shaped;
}

/* ══════════════════════════════════════════════
   GET /api/messages
   ?threadId=  &userId=  &before=  &limit=
══════════════════════════════════════════════ */
router.get("/", softAuth, async (req, res) => {
  const { threadId, before, limit = 50 } = req.query;
  const userId   = req.user?.id || req.query.userId;
  const pageSize = Math.min(parseInt(limit, 10) || 50, 100);

  console.log("📨 GET /messages", { threadId, userId });

  if (!threadId) {
    return res.status(400).json({ success:false, message:"threadId required" });
  }
  if (!userId) {
    return res.status(401).json({ success:false, message:"userId required" });
  }

  try {
    /* verify membership */
    const { rows: tr } = await pool.query(
      `SELECT id, buyer_id, seller_id
       FROM   public.chat_threads
       WHERE  id = $1`,
      [threadId]
    );

    if (!tr[0]) {
      return res.status(404).json({ success:false, message:"Thread not found" });
    }

    const isMember = tr[0].buyer_id === userId || tr[0].seller_id === userId;
    if (!isMember) {
      return res.status(403).json({ success:false, message:"Access denied" });
    }

    /* cursor pagination */
    const params = [threadId, pageSize];
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
         m.reply_to_id,
         m.offer_amount,
         m.offer_original_price,
         m.offer_product_title,
         m.offer_note,
         m.offer_status,
         m.location_lat,
         m.location_lng,
         m.location_address,
         m.shared_product_id,
         m.shared_product_title,
         m.shared_product_price,
         m.shared_product_image,
         m.status,
         m.edited,
         m.deleted,
         m.client_message_id,
         m.created_at,
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
    /* reverse so frontend gets oldest → newest */
    return res.json(rows.reverse().map(shapeMessage));

  } catch (err) {
    console.error("GET /messages error:", err);
    return res.status(500).json({ success:false, message:err.message });
  }
});

/* ══════════════════════════════════════════════
   GET /api/messages/unread-count
══════════════════════════════════════════════ */
router.get("/unread-count", softAuth, async (req, res) => {
  const userId = req.user?.id || req.query.userId;
  if (!userId) {
    return res.status(400).json({ success:false, message:"userId required" });
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
    return res.status(500).json({ success:false, message:err.message });
  }
});

/* ══════════════════════════════════════════════
   POST /api/messages/upload  (image only)
   MUST be before /:messageId
══════════════════════════════════════════════ */
router.post(
  "/upload",
  softAuth,
  upload.single("file"),
  async (req, res) => {
    /* multer error */
    if (!req.file) {
      return res.status(400).json({ success:false, message:"No image provided" });
    }

    const senderId        = req.user?.id || req.body.senderId;
    const threadId        = req.body.threadId;
    const clientMsgId     = req.body.clientMessageId || null;
    const replyToId       = req.body.reply_to_id     || null;

    if (!senderId || !threadId) {
      fs.unlinkSync(req.file.path); // clean up
      return res.status(400).json({
        success:false, message:"senderId and threadId required",
      });
    }

    const mediaUrl = buildMediaUrl(req, req.file.path);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* idempotency */
      if (clientMsgId) {
        const { rows: ex } = await client.query(
          `SELECT * FROM public.chat_messages
           WHERE client_message_id = $1 AND sender_id = $2`,
          [clientMsgId, senderId]
        );
        if (ex.length > 0) {
          await client.query("COMMIT");
          return res.status(200).json(shapeMessage(ex[0]));
        }
      }

      /* verify membership */
      const { rows: tr } = await client.query(
        `SELECT id, buyer_id, seller_id, is_blocked
         FROM   public.chat_threads WHERE id = $1`,
        [threadId]
      );

      if (!tr[0]) {
        await client.query("ROLLBACK");
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ success:false, message:"Thread not found" });
      }

      const isMember =
        tr[0].buyer_id === senderId || tr[0].seller_id === senderId;

      if (!isMember || tr[0].is_blocked) {
        await client.query("ROLLBACK");
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ success:false, message:"Access denied" });
      }

      /* insert */
      const { rows } = await client.query(
        `INSERT INTO public.chat_messages
           (thread_id, sender_id, message, message_type,
            media_url, reply_to_id, status, client_message_id)
         VALUES ($1, $2, 'Photo', 'media', $3, $4, 'sent', $5)
         RETURNING id`,
        [threadId, senderId, mediaUrl, replyToId, clientMsgId]
      );

      /* update thread preview */
      await client.query(
        `UPDATE public.chat_threads
         SET last_message = '[Photo]', last_message_at = NOW()
         WHERE id = $1`,
        [threadId]
      );

      await client.query("COMMIT");

      const full = await fetchFullMessage(client, rows[0].id);
      return res.status(201).json(shapeMessage(full));

    } catch (err) {
      await client.query("ROLLBACK");
      /* delete the uploaded file on error */
      try { fs.unlinkSync(req.file.path); } catch {}
      console.error("POST /upload error:", err);
      return res.status(500).json({ success:false, message:err.message });
    } finally {
      client.release();
    }
  }
);

/* ══════════════════════════════════════════════
   POST /api/messages  (text / offer / location / product)
══════════════════════════════════════════════ */
router.post("/", softAuth, async (req, res) => {
  const {
    threadId,
    message,
    messageType     = "text",
    mediaUrl        = null,
    clientMessageId = null,
    reply_to_id     = null,
    /* offer fields */
    offerMeta       = null,
    /* location fields */
    location        = null,
    /* shared product */
    sharedProduct   = null,
  } = req.body;

  const senderId = req.user?.id || req.body.senderId;

  console.log("📤 POST /messages", { threadId, senderId, messageType });

  if (!threadId || !senderId) {
    return res.status(400).json({
      success:false, message:"threadId and senderId required",
    });
  }
  if (!message && !mediaUrl && !offerMeta && !location && !sharedProduct) {
    return res.status(400).json({
      success:false, message:"No content provided",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* idempotency */
    if (clientMessageId) {
      const { rows: ex } = await client.query(
        `SELECT * FROM public.chat_messages
         WHERE client_message_id = $1 AND sender_id = $2`,
        [clientMessageId, senderId]
      );
      if (ex.length > 0) {
        await client.query("COMMIT");
        const full = await fetchFullMessage(client, ex[0].id);
        return res.status(200).json(shapeMessage(full));
      }
    }

    /* verify thread */
    const { rows: tr } = await client.query(
      `SELECT id, buyer_id, seller_id, is_blocked
       FROM   public.chat_threads WHERE id = $1`,
      [threadId]
    );

    if (!tr[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success:false, message:"Thread not found" });
    }

    const isMember =
      tr[0].buyer_id === senderId || tr[0].seller_id === senderId;

    if (!isMember) {
      await client.query("ROLLBACK");
      return res.status(403).json({ success:false, message:"Access denied" });
    }

    if (tr[0].is_blocked) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success:false, message:"Conversation is blocked",
      });
    }

    /* ── build insert ── */
    const { rows } = await client.query(
      `INSERT INTO public.chat_messages (
         thread_id,
         sender_id,
         message,
         message_type,
         media_url,
         reply_to_id,
         status,
         client_message_id,
         /* offer */
         offer_amount,
         offer_original_price,
         offer_product_title,
         offer_note,
         offer_status,
         /* location */
         location_lat,
         location_lng,
         location_address,
         /* shared product */
         shared_product_id,
         shared_product_title,
         shared_product_price,
         shared_product_image
       ) VALUES (
         $1, $2, $3, $4, $5, $6, 'sent', $7,
         $8, $9, $10, $11, $12,
         $13, $14, $15,
         $16, $17, $18, $19
       )
       RETURNING id`,
      [
        threadId,
        senderId,
        message  ?? null,
        messageType,
        mediaUrl ?? null,
        reply_to_id ?? null,
        clientMessageId ?? null,
        /* offer */
        offerMeta?.amount         ?? null,
        offerMeta?.original_price ?? null,
        offerMeta?.product_title  ?? null,
        offerMeta?.note           ?? null,
        offerMeta ? "pending"     : null,
        /* location */
        location?.lat     ?? null,
        location?.lng     ?? null,
        location?.address ?? null,
        /* shared product */
        sharedProduct?.id    ?? null,
        sharedProduct?.title ?? null,
        sharedProduct?.price ?? null,
        sharedProduct?.image ?? null,
      ]
    );

    /* thread preview */
    const preview =
      messageType === "text"  ? (message?.slice(0, 80) || "Message")
      : messageType === "offer"    ? `Offer: ৳${offerMeta?.amount ?? ""}`
      : messageType === "location" ? "📍 Location"
      : messageType === "product"  ? `Product: ${sharedProduct?.title || ""}`
      : messageType === "media"    ? "[Photo]"
      : "Message";

    await client.query(
      `UPDATE public.chat_threads
       SET last_message = $1, last_message_at = NOW()
       WHERE id = $2`,
      [preview, threadId]
    );

    await client.query("COMMIT");

    const full = await fetchFullMessage(client, rows[0].id);
    return res.status(201).json(shapeMessage(full));

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /messages error:", err);
    return res.status(500).json({ success:false, message:err.message });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════
   PATCH /api/messages/:messageId/offer
   Accept / decline / counter an offer
══════════════════════════════════════════════ */
router.patch("/:messageId/offer", softAuth, async (req, res) => {
  const { messageId } = req.params;
  const { status }    = req.body;          // accepted | declined | countered
  const userId        = req.user?.id || req.body.userId;

  const VALID = new Set(["accepted", "declined", "countered"]);
  if (!VALID.has(status)) {
    return res.status(400).json({
      success:false, message:"status must be accepted | declined | countered",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* load the message to verify the responder is the OTHER party */
    const { rows: msgRows } = await client.query(
      `SELECT m.sender_id, m.thread_id, t.buyer_id, t.seller_id
       FROM   public.chat_messages m
       JOIN   public.chat_threads  t ON t.id = m.thread_id
       WHERE  m.id           = $1
         AND  m.message_type = 'offer'
         AND  m.deleted      = false`,
      [messageId]
    );

    if (!msgRows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success:false, message:"Offer not found" });
    }

    const row      = msgRows[0];
    const isMember = row.buyer_id === userId || row.seller_id === userId;

    if (!isMember) {
      await client.query("ROLLBACK");
      return res.status(403).json({ success:false, message:"Access denied" });
    }

    /* update offer_status */
    const { rows: updated } = await client.query(
      `UPDATE public.chat_messages
       SET    offer_status = $1
       WHERE  id = $2
       RETURNING *`,
      [status, messageId]
    );

    await client.query("COMMIT");
    const full = await fetchFullMessage(client, updated[0].id);
    return res.json(shapeMessage(full));

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /offer error:", err);
    return res.status(500).json({ success:false, message:err.message });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════
   PATCH /api/messages/:messageId  (edit text)
══════════════════════════════════════════════ */
router.patch("/:messageId", softAuth, async (req, res) => {
  const { messageId } = req.params;
  const { message }   = req.body;
  const senderId      = req.user?.id || req.body.senderId;

  if (!message?.trim()) {
    return res.status(400).json({ success:false, message:"message required" });
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
      return res.status(404).json({ success:false, message:"Message not found" });
    }

    const full = await fetchFullMessage(pool, rows[0].id);
    return res.json(shapeMessage(full));
  } catch (err) {
    console.error("PATCH /messages error:", err);
    return res.status(500).json({ success:false, message:err.message });
  }
});

/* ══════════════════════════════════════════════
   DELETE /api/messages/:messageId  (soft delete)
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
      return res.status(404).json({ success:false, message:"Message not found" });
    }

    /* recompute thread preview */
    await client.query(
      `UPDATE public.chat_threads t
       SET
         last_message = (
           SELECT message FROM public.chat_messages
           WHERE  thread_id = $1 AND deleted = false
           ORDER  BY created_at DESC LIMIT 1
         ),
         last_message_at = (
           SELECT created_at FROM public.chat_messages
           WHERE  thread_id = $1 AND deleted = false
           ORDER  BY created_at DESC LIMIT 1
         )
       WHERE t.id = $1`,
      [rows[0].thread_id]
    );

    await client.query("COMMIT");
    return res.json({ success:true });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /messages error:", err);
    return res.status(500).json({ success:false, message:err.message });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════
   PATCH /api/conversations/:threadId/read
   (kept here so messages.js is self-contained)
══════════════════════════════════════════════ */
router.patch("/read/:threadId", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.user?.id || req.body.userId;

  if (!userId || !threadId) {
    return res.status(400).json({ success:false, message:"userId and threadId required" });
  }

  try {
    /* upsert read receipt */
    await pool.query(
      `INSERT INTO public.chat_read_receipts (thread_id, user_id, last_read_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (thread_id, user_id)
       DO UPDATE SET last_read_at = NOW()`,
      [threadId, userId]
    );

    /* mark unread messages in this thread as delivered/read */
    await pool.query(
      `UPDATE public.chat_messages
       SET    status = 'read'
       WHERE  thread_id  = $1
         AND  sender_id <> $2
         AND  status    <> 'read'
         AND  deleted    = false`,
      [threadId, userId]
    );

    return res.json({ success:true });
  } catch (err) {
    console.error("PATCH /read error:", err);
    return res.status(500).json({ success:false, message:err.message });
  }
});

export default router;