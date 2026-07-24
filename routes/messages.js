import express           from "express";
import multer            from "multer";
import path              from "path";
import fs                from "fs";
import crypto            from "crypto";
import sharp             from "sharp";
import ffmpeg            from "fluent-ffmpeg";
import ffmpegInstaller   from "@ffmpeg-installer/ffmpeg";
import { pool }          from "../server.js";
import { softAuth }      from "../middleware/auth.js";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

/* ══════════════════════════════════════════════
   FFMPEG
══════════════════════════════════════════════ */
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/* ══════════════════════════════════════════════
   R2 CLIENT
══════════════════════════════════════════════ */
const r2 = new S3Client({
  region     : process.env.R2_REGION ?? "auto",
  endpoint   : process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId    : process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET     = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

/* ══════════════════════════════════════════════
   CONSTANTS / LIMITS
══════════════════════════════════════════════ */
const IMAGE_MAX_BYTES      = 5  * 1024 * 1024;   // 5  MB per image
const VIDEO_MAX_BYTES      = 10 * 1024 * 1024;   // 10 MB per video
const IMAGE_MAX_COUNT      = 10;                  // max 10 images per message
const VIDEO_MAX_COUNT      = 3;                   // max  3 videos per message
const VIDEO_MAX_SECONDS    = 60;                  // max 60 sec per video
const IMAGE_MAX_WIDTH      = 1080;                // resize if wider
const IMAGE_QUALITY        = 70;                  // q70 → ~200–500 KB output

/* ══════════════════════════════════════════════
   ALLOWED MIME TYPES
══════════════════════════════════════════════ */
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg", "image/jpg",  "image/png",
  "image/gif",  "image/webp", "image/heic", "image/avif",
]);

const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4", "video/quicktime", "video/x-msvideo",
  "video/webm", "video/3gpp",    "video/x-matroska",
]);

/* ══════════════════════════════════════════════
   MULTER  — memory storage (straight to R2)
══════════════════════════════════════════════ */
const imageUpload = multer({
  storage   : multer.memoryStorage(),
  limits    : { fileSize: IMAGE_MAX_BYTES },
  fileFilter: (req, file, cb) =>
    ALLOWED_IMAGE_MIME.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only image files are allowed")),
});

const videoUpload = multer({
  storage   : multer.memoryStorage(),
  limits    : { fileSize: VIDEO_MAX_BYTES },
  fileFilter: (req, file, cb) =>
    ALLOWED_VIDEO_MIME.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only video files are allowed")),
});

/* ══════════════════════════════════════════════
   R2 HELPERS
══════════════════════════════════════════════ */

/**
 * Upload buffer → R2, return public URL.
 */
async function uploadToR2(buffer, key, contentType) {
  await r2.send(
    new PutObjectCommand({
      Bucket     : R2_BUCKET,
      Key        : key,
      Body       : buffer,
      ContentType: contentType,
    })
  );
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Delete R2 object by public URL. Never throws.
 */
async function deleteFromR2(publicUrl) {
  try {
    if (!publicUrl || !R2_PUBLIC_URL) return;
    const key = publicUrl.replace(`${R2_PUBLIC_URL}/`, "");
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (err) {
    console.warn("R2 delete warning:", err.message);
  }
}

/**
 * Delete an array of R2 URLs. Never throws.
 */
async function deleteAllFromR2(urls = []) {
  await Promise.allSettled(urls.map(deleteFromR2));
}

/* ══════════════════════════════════════════════
   IMAGE COMPRESSION  (Sharp)
   Input  : up to 5 MB
   Output : ~150 KB – 500 KB
   Rules  : max 1080px | q70 | mozjpeg
══════════════════════════════════════════════ */
async function compressImage(buffer, mimetype) {
  /* GIF — Sharp cannot re-animate, pass through */
  if (mimetype === "image/gif")
    return { buffer, ext: ".gif", mime: "image/gif" };

  const img  = sharp(buffer);
  const meta = await img.metadata();

  /* Downscale if wider than IMAGE_MAX_WIDTH */
  if ((meta.width ?? 0) > IMAGE_MAX_WIDTH)
    img.resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true });

  /* JPEG / HEIC / AVIF → JPEG (mozjpeg) */
  if (["image/jpeg", "image/jpg", "image/heic", "image/avif"].includes(mimetype)) {
    const out = await img.jpeg({ quality: IMAGE_QUALITY, mozjpeg: true }).toBuffer();
    return { buffer: out, ext: ".jpg", mime: "image/jpeg" };
  }

  /* PNG / WebP / anything else → WebP */
  const out = await img.webp({ quality: IMAGE_QUALITY }).toBuffer();
  return { buffer: out, ext: ".webp", mime: "image/webp" };
}

/* ══════════════════════════════════════════════
   VIDEO DURATION CHECK  (ffprobe)
   Writes buffer → tmp file → probes → removes
══════════════════════════════════════════════ */
function getVideoDuration(buffer) {
  return new Promise((resolve, reject) => {
    const tmpPath = path.join(
      process.env.TMPDIR || "/tmp",
      `vid_${crypto.randomBytes(8).toString("hex")}.tmp`
    );

    fs.writeFile(tmpPath, buffer, (writeErr) => {
      if (writeErr) return reject(writeErr);

      ffmpeg.ffprobe(tmpPath, (err, metadata) => {
        fs.unlink(tmpPath, () => {});          // clean up always
        if (err) return reject(err);
        resolve(metadata?.format?.duration ?? 0);
      });
    });
  });
}

/* ══════════════════════════════════════════════
   media_url HELPERS
   Stored as JSON array string in DB.
   e.g. '["https://…/a.jpg","https://…/b.jpg"]'
══════════════════════════════════════════════ */

/** Parse media_url column → always string[] | null */
function parseMediaUrl(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [raw];
  } catch {
    return [raw];
  }
}

/** Encode string[] → JSON string for DB */
function encodeMediaUrl(urls) {
  return JSON.stringify(urls);
}

/* ══════════════════════════════════════════════
   DB HELPERS
══════════════════════════════════════════════ */
async function fetchFullMessage(queryable, msgId) {
  const { rows } = await queryable.query(
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

function shapeMessage(row) {
  if (!row) return null;

  const shaped = {
    id               : row.id,
    thread_id        : row.thread_id,
    sender_id        : row.sender_id,
    sender_name      : row.sender_name  || null,
    sender_image     : row.sender_image || null,
    message          : row.message      || null,
    message_type     : row.message_type,
    media_url        : parseMediaUrl(row.media_url),  // always array | null
    reply_to_id      : row.reply_to_id  || null,
    status           : row.status,
    edited           : row.edited       || false,
    deleted          : row.deleted      || false,
    client_message_id: row.client_message_id || null,
    created_at       : row.created_at,
  };

  /* offer meta */
  if (row.offer_amount != null) {
    shaped._offerMeta = {
      amount        : Number(row.offer_amount),
      original_price: row.offer_original_price != null
        ? Number(row.offer_original_price) : null,
      product_title : row.offer_product_title || null,
      note          : row.offer_note          || null,
      status        : row.offer_status        || "pending",
      type          : "offer",
    };
  }

  /* location */
  if (row.location_lat != null) {
    shaped.location = {
      lat    : Number(row.location_lat),
      lng    : Number(row.location_lng),
      address: row.location_address || null,
    };
  }

  /* shared product */
  if (row.shared_product_id || row.shared_product_title) {
    shaped.shared_product = {
      id   : row.shared_product_id    || null,
      title: row.shared_product_title || "",
      price: row.shared_product_price != null
        ? Number(row.shared_product_price) : null,
      image: row.shared_product_image || null,
    };
  }

  return shaped;
}

/* ══════════════════════════════════════════════
   THREAD MEMBERSHIP HELPER
══════════════════════════════════════════════ */
async function verifyThreadMember(client, threadId, userId) {
  const { rows } = await client.query(
    `SELECT id, buyer_id, seller_id, is_blocked
     FROM public.chat_threads WHERE id = $1`,
    [threadId]
  );

  if (!rows[0])
    return { error: 404, message: "Thread not found" };

  const t        = rows[0];
  const isMember = t.buyer_id === userId || t.seller_id === userId;

  if (!isMember)    return { error: 403, message: "Access denied" };
  if (t.is_blocked) return { error: 403, message: "Conversation is blocked" };

  return { thread: t };
}

/* ══════════════════════════════════════════════
   ROUTER
══════════════════════════════════════════════ */
const router = express.Router();

/* ──────────────────────────────────────────────
   GET /api/messages
   ?threadId=  &userId=  &before=  &limit=
────────────────────────────────────────────── */
router.get("/", softAuth, async (req, res) => {
  const { threadId, before, limit = 50 } = req.query;
  const userId   = req.user?.id || req.query.userId;
  const pageSize = Math.min(parseInt(limit, 10) || 50, 100);

  if (!threadId)
    return res.status(400).json({ success: false, message: "threadId required" });
  if (!userId)
    return res.status(401).json({ success: false, message: "userId required" });

  try {
    /* verify membership */
    const { rows: tr } = await pool.query(
      `SELECT id, buyer_id, seller_id
       FROM   public.chat_threads
       WHERE  id = $1`,
      [threadId]
    );

    if (!tr[0])
      return res.status(404).json({ success: false, message: "Thread not found" });

    if (tr[0].buyer_id !== userId && tr[0].seller_id !== userId)
      return res.status(403).json({ success: false, message: "Access denied" });

    /* cursor pagination */
    let queryText = `
      SELECT
        m.id, m.thread_id, m.sender_id,
        m.message, m.message_type, m.media_url, m.reply_to_id,
        m.offer_amount, m.offer_original_price,
        m.offer_product_title, m.offer_note, m.offer_status,
        m.location_lat, m.location_lng, m.location_address,
        m.shared_product_id, m.shared_product_title,
        m.shared_product_price, m.shared_product_image,
        m.status, m.edited, m.deleted, m.client_message_id, m.created_at,
        u.name          AS sender_name,
        u.profile_image AS sender_image
      FROM  public.chat_messages m
      JOIN  public.users         u ON u.id = m.sender_id
      WHERE m.thread_id = $1
        AND m.deleted   = false
    `;

    const params = [threadId, pageSize];

    if (before) {
      params.push(before);
      queryText += ` AND m.created_at < $${params.length}`;
    }

    queryText += ` ORDER BY m.created_at DESC LIMIT $2`;

    const { rows } = await pool.query(queryText, params);

    /* return oldest → newest */
    return res.json(rows.reverse().map(shapeMessage));

  } catch (err) {
    console.error("GET /messages error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ──────────────────────────────────────────────
   GET /api/messages/unread-count
   MUST stay above /:messageId
────────────────────────────────────────────── */
router.get("/unread-count", softAuth, async (req, res) => {
  const userId = req.user?.id || req.query.userId;
  if (!userId)
    return res.status(400).json({ success: false, message: "userId required" });

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(m.id)::INT AS total_unread
       FROM   public.chat_threads            t
       JOIN   public.chat_messages           m  ON m.thread_id = t.id
       LEFT   JOIN public.chat_read_receipts rr
                ON rr.thread_id = t.id AND rr.user_id = $1
       WHERE  (t.buyer_id = $1 OR t.seller_id = $1)
         AND  t.is_archived = false
         AND  m.sender_id  <> $1
         AND  m.deleted     = false
         AND  (rr.last_read_at IS NULL OR m.created_at > rr.last_read_at)`,
      [userId]
    );

    return res.json({ unreadCount: rows[0].total_unread });
  } catch (err) {
    console.error("GET /unread-count error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ──────────────────────────────────────────────
   POST /api/messages/upload
   Multi-image → compress → R2
   Max : 10 images | 5 MB each | 1080px | q70
   MUST stay above /:messageId
────────────────────────────────────────────── */
router.post(
  "/upload",
  softAuth,
  imageUpload.array("files", IMAGE_MAX_COUNT),
  async (req, res) => {
    /* ── basic validation ── */
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: "No images provided" });

    if (req.files.length > IMAGE_MAX_COUNT)
      return res.status(400).json({
        success: false,
        message: `Max ${IMAGE_MAX_COUNT} images allowed per message`,
      });

    const senderId    = req.user?.id || req.body.senderId;
    const threadId    = req.body.threadId;
    const clientMsgId = req.body.clientMessageId || null;
    const replyToId   = req.body.reply_to_id     || null;

    if (!senderId || !threadId)
      return res.status(400).json({
        success: false, message: "senderId and threadId required",
      });

    const uploadedUrls = [];

    try {
      /* ── compress each image & upload to R2 ── */
      for (const file of req.files) {
        const { buffer: compressed, ext, mime } =
          await compressImage(file.buffer, file.mimetype);

        const hash  = crypto.randomBytes(12).toString("hex");
        const r2Key = `chat/images/${Date.now()}_${hash}${ext}`;
        const url   = await uploadToR2(compressed, r2Key, mime);
        uploadedUrls.push(url);
      }

      const count       = uploadedUrls.length;
      const previewText = count === 1 ? "Photo" : `${count} Photos`;
      const mediaUrl    = encodeMediaUrl(uploadedUrls);

      /* ── DB transaction ── */
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        /* idempotency */
        if (clientMsgId) {
          const { rows: ex } = await client.query(
            `SELECT id FROM public.chat_messages
             WHERE client_message_id = $1 AND sender_id = $2`,
            [clientMsgId, senderId]
          );
          if (ex.length > 0) {
            const full = await fetchFullMessage(client, ex[0].id);
            await client.query("COMMIT");
            await deleteAllFromR2(uploadedUrls);   // orphan cleanup
            return res.status(200).json(shapeMessage(full));
          }
        }

        /* verify thread */
        const { error, message } =
          await verifyThreadMember(client, threadId, senderId);

        if (error) {
          await client.query("ROLLBACK");
          await deleteAllFromR2(uploadedUrls);
          return res.status(error).json({ success: false, message });
        }

        /* insert */
        const { rows } = await client.query(
          `INSERT INTO public.chat_messages
             (thread_id, sender_id, message, message_type,
              media_url, reply_to_id, status, client_message_id)
           VALUES ($1, $2, $3, 'media', $4, $5, 'sent', $6)
           RETURNING id`,
          [threadId, senderId, previewText, mediaUrl, replyToId, clientMsgId]
        );

        /* thread preview */
        await client.query(
          `UPDATE public.chat_threads
           SET last_message = $1, last_message_at = NOW()
           WHERE id = $2`,
          [previewText, threadId]
        );

        const full = await fetchFullMessage(client, rows[0].id);
        await client.query("COMMIT");
        return res.status(201).json(shapeMessage(full));

      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        await deleteAllFromR2(uploadedUrls);
        throw err;
      } finally {
        client.release();
      }

    } catch (err) {
      console.error("POST /upload (images) error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/* ──────────────────────────────────────────────
   POST /api/messages/upload-video
   Multi-video → duration check → R2
   Max : 3 videos | 10 MB each | 60 sec each | no compression
   MUST stay above /:messageId
────────────────────────────────────────────── */
router.post(
  "/upload-video",
  softAuth,
  videoUpload.array("files", VIDEO_MAX_COUNT),
  async (req, res) => {
    /* ── basic validation ── */
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: "No videos provided" });

    if (req.files.length > VIDEO_MAX_COUNT)
      return res.status(400).json({
        success: false,
        message: `Max ${VIDEO_MAX_COUNT} videos allowed per message`,
      });

    const senderId    = req.user?.id || req.body.senderId;
    const threadId    = req.body.threadId;
    const clientMsgId = req.body.clientMessageId || null;
    const replyToId   = req.body.reply_to_id     || null;

    if (!senderId || !threadId)
      return res.status(400).json({
        success: false, message: "senderId and threadId required",
      });

    const uploadedUrls = [];

    try {
      /* ── duration check & upload each video ── */
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        const duration = await getVideoDuration(file.buffer);
        if (duration > VIDEO_MAX_SECONDS) {
          await deleteAllFromR2(uploadedUrls);   // clean already uploaded
          return res.status(400).json({
            success: false,
            message:
              `Video ${i + 1} is too long. ` +
              `Max ${VIDEO_MAX_SECONDS}s (got ${Math.round(duration)}s).`,
          });
        }

        const hash  = crypto.randomBytes(12).toString("hex");
        const ext   = path.extname(file.originalname).toLowerCase() || ".mp4";
        const r2Key = `chat/videos/${Date.now()}_${hash}${ext}`;
        const url   = await uploadToR2(file.buffer, r2Key, file.mimetype);
        uploadedUrls.push(url);
      }

      const count       = uploadedUrls.length;
      const previewText = count === 1 ? "Video" : `${count} Videos`;
      const mediaUrl    = encodeMediaUrl(uploadedUrls);

      /* ── DB transaction ── */
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        /* idempotency */
        if (clientMsgId) {
          const { rows: ex } = await client.query(
            `SELECT id FROM public.chat_messages
             WHERE client_message_id = $1 AND sender_id = $2`,
            [clientMsgId, senderId]
          );
          if (ex.length > 0) {
            const full = await fetchFullMessage(client, ex[0].id);
            await client.query("COMMIT");
            await deleteAllFromR2(uploadedUrls);
            return res.status(200).json(shapeMessage(full));
          }
        }

        /* verify thread */
        const { error, message } =
          await verifyThreadMember(client, threadId, senderId);

        if (error) {
          await client.query("ROLLBACK");
          await deleteAllFromR2(uploadedUrls);
          return res.status(error).json({ success: false, message });
        }

        /* insert */
        const { rows } = await client.query(
          `INSERT INTO public.chat_messages
             (thread_id, sender_id, message, message_type,
              media_url, reply_to_id, status, client_message_id)
           VALUES ($1, $2, $3, 'video', $4, $5, 'sent', $6)
           RETURNING id`,
          [threadId, senderId, previewText, mediaUrl, replyToId, clientMsgId]
        );

        /* thread preview */
        await client.query(
          `UPDATE public.chat_threads
           SET last_message = $1, last_message_at = NOW()
           WHERE id = $2`,
          [previewText, threadId]
        );

        const full = await fetchFullMessage(client, rows[0].id);
        await client.query("COMMIT");
        return res.status(201).json(shapeMessage(full));

      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        await deleteAllFromR2(uploadedUrls);
        throw err;
      } finally {
        client.release();
      }

    } catch (err) {
      console.error("POST /upload-video error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/* ──────────────────────────────────────────────
   POST /api/messages
   text | offer | location | product | media
────────────────────────────────────────────── */
router.post("/", softAuth, async (req, res) => {
  const {
    threadId,
    message         = null,
    messageType     = "text",
    mediaUrl        = null,
    clientMessageId = null,
    reply_to_id     = null,
    offerMeta       = null,
    location        = null,
    sharedProduct   = null,
  } = req.body;

  const senderId = req.user?.id || req.body.senderId;

  if (!threadId || !senderId)
    return res.status(400).json({
      success: false, message: "threadId and senderId required",
    });

  if (!message && !mediaUrl && !offerMeta && !location && !sharedProduct)
    return res.status(400).json({ success: false, message: "No content provided" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* idempotency */
    if (clientMessageId) {
      const { rows: ex } = await client.query(
        `SELECT id FROM public.chat_messages
         WHERE client_message_id = $1 AND sender_id = $2`,
        [clientMessageId, senderId]
      );
      if (ex.length > 0) {
        const full = await fetchFullMessage(client, ex[0].id);
        await client.query("COMMIT");
        return res.status(200).json(shapeMessage(full));
      }
    }

    /* verify thread */
    const { error, message: errMsg } =
      await verifyThreadMember(client, threadId, senderId);

    if (error) {
      await client.query("ROLLBACK");
      return res.status(error).json({ success: false, message: errMsg });
    }

    /* insert */
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
         offer_amount,
         offer_original_price,
         offer_product_title,
         offer_note,
         offer_status,
         location_lat,
         location_lng,
         location_address,
         shared_product_id,
         shared_product_title,
         shared_product_price,
         shared_product_image
       ) VALUES (
         $1,  $2,  $3,  $4,  $5,
         $6,  'sent', $7,
         $8,  $9,  $10, $11, $12,
         $13, $14, $15,
         $16, $17, $18, $19
       )
       RETURNING id`,
      [
        threadId,
        senderId,
        message         ?? null,
        messageType,
        mediaUrl        ?? null,
        reply_to_id     ?? null,
        clientMessageId ?? null,
        offerMeta?.amount         ?? null,
        offerMeta?.original_price ?? null,
        offerMeta?.product_title  ?? null,
        offerMeta?.note           ?? null,
        offerMeta ? "pending"     : null,
        location?.lat             ?? null,
        location?.lng             ?? null,
        location?.address         ?? null,
        sharedProduct?.id         ?? null,
        sharedProduct?.title      ?? null,
        sharedProduct?.price      ?? null,
        sharedProduct?.image      ?? null,
      ]
    );

    /* thread preview */
    const preview =
      messageType === "offer"
        ? `Offer: ₦${offerMeta?.amount?.toLocaleString() ?? ""}`
        : messageType === "location"
        ? "Location shared"
        : messageType === "product"
        ? sharedProduct?.title || "Product shared"
        : messageType === "media"
        ? "Photo"
        : messageType === "video"
        ? "Video"
        : (message?.slice(0, 80) || "Message");

    await client.query(
      `UPDATE public.chat_threads
       SET last_message = $1, last_message_at = NOW()
       WHERE id = $2`,
      [preview, threadId]
    );

    const full = await fetchFullMessage(client, rows[0].id);
    await client.query("COMMIT");
    return res.status(201).json(shapeMessage(full));

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /messages error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

/* ──────────────────────────────────────────────
   PATCH /api/messages/:messageId/offer
   Accept / decline / counter
   MUST stay above plain /:messageId
────────────────────────────────────────────── */
router.patch("/:messageId/offer", softAuth, async (req, res) => {
  const { messageId } = req.params;
  const { status }    = req.body;
  const userId        = req.user?.id || req.body.userId;

  const VALID = new Set(["accepted", "declined", "countered"]);
  if (!VALID.has(status))
    return res.status(400).json({
      success: false,
      message: "status must be: accepted | declined | countered",
    });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

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
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    const { buyer_id, seller_id } = msgRows[0];
    if (buyer_id !== userId && seller_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { rows: updated } = await client.query(
      `UPDATE public.chat_messages
       SET offer_status = $1
       WHERE id = $2
       RETURNING id`,
      [status, messageId]
    );

    const full = await fetchFullMessage(client, updated[0].id);
    await client.query("COMMIT");
    return res.json(shapeMessage(full));

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PATCH /offer error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

/* ──────────────────────────────────────────────
   PATCH /api/messages/:messageId  (edit text)
────────────────────────────────────────────── */
router.patch("/:messageId", softAuth, async (req, res) => {
  const { messageId } = req.params;
  const { message }   = req.body;
  const senderId      = req.user?.id || req.body.senderId;

  if (!message?.trim())
    return res.status(400).json({ success: false, message: "message required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows, rowCount } = await client.query(
      `UPDATE public.chat_messages
       SET message = $1, edited = true
       WHERE id        = $2
         AND sender_id = $3
         AND deleted   = false
       RETURNING id`,
      [message.trim(), messageId, senderId]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const full = await fetchFullMessage(client, rows[0].id);
    await client.query("COMMIT");
    return res.json(shapeMessage(full));

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PATCH /messages error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

/* ──────────────────────────────────────────────
   DELETE /api/messages/:messageId  (soft delete)
────────────────────────────────────────────── */
router.delete("/:messageId", softAuth, async (req, res) => {
  const { messageId } = req.params;
  const senderId      = req.user?.id || req.body.senderId;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows, rowCount } = await client.query(
      `UPDATE public.chat_messages
       SET deleted = true
       WHERE id        = $1
         AND sender_id = $2
       RETURNING thread_id`,
      [messageId, senderId]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    /* recompute thread preview */
    await client.query(
      `UPDATE public.chat_threads
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
       WHERE id = $1`,
      [rows[0].thread_id]
    );

    await client.query("COMMIT");
    return res.json({ success: true });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /messages error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

/* ──────────────────────────────────────────────
   PATCH /api/messages/read/:threadId
────────────────────────────────────────────── */
router.patch("/read/:threadId", softAuth, async (req, res) => {
  const { threadId } = req.params;
  const userId       = req.user?.id || req.body.userId;

  if (!userId || !threadId)
    return res.status(400).json({
      success: false, message: "userId and threadId required",
    });

  try {
    await pool.query(
      `INSERT INTO public.chat_read_receipts (thread_id, user_id, last_read_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (thread_id, user_id)
       DO UPDATE SET last_read_at = NOW()`,
      [threadId, userId]
    );

    await pool.query(
      `UPDATE public.chat_messages
       SET    status = 'read'
       WHERE  thread_id  = $1
         AND  sender_id <> $2
         AND  status    <> 'read'
         AND  deleted    = false`,
      [threadId, userId]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("PATCH /read error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;