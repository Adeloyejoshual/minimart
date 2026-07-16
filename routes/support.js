// ════════════════════════════════════════════════════════════
// FILE: routes/support.js
// Mount: /api/support
// ════════════════════════════════════════════════════════════

import express        from "express";
import { pool }       from "../server.js";
import { authenticate } from "../middleware/auth.js";
import multer         from "multer";
import path           from "path";
import crypto         from "crypto";
import helmet         from "helmet";
import cors           from "cors";
import rateLimit      from "express-rate-limit";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fileTypeFromBuffer } from "file-type";   /* real MIME from bytes */
import nodemailer     from "nodemailer";
import { WebSocketServer } from "ws";             /* live updates          */

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   SECURITY MIDDLEWARE
════════════════════════════════════════════════════════════ */

/* Helmet — security headers */
router.use(helmet({
  contentSecurityPolicy : false,   /* adjust per your needs */
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));

/* CORS — whitelist only your domain */
router.use(cors({
  origin      : [
    process.env.FRONTEND_URL ?? "https://www.loemart.com",
    "https://loemart.com",
  ],
  methods     : ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  credentials : true,
}));

/* ════════════════════════════════════════════════════════════
   RATE LIMITERS
════════════════════════════════════════════════════════════ */

const makeLimit = (windowMin, max, message) =>
  rateLimit({
    windowMs        : windowMin * 60 * 1000,
    max,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => req.user?.id ?? req.ip,
    message         : { success: false, message },
  });

/* Ticket creation  — 5 per hour */
const ticketCreateLimit = makeLimit(60, 5,
  "You can only open 5 tickets per hour. Please wait before submitting another.");

/* Message replies  — 20 per hour */
const messageLimit = makeLimit(60, 20,
  "You can only send 20 messages per hour. Please slow down.");

/* Report / dispute / appeal — 3 per hour */
const reportLimit = makeLimit(60, 3,
  "You can only submit 3 reports per hour.");

/* General read endpoints — 120 per minute */
const readLimit = makeLimit(1, 120,
  "Too many requests. Please slow down.");

/* ════════════════════════════════════════════════════════════
   CLOUDFLARE R2
════════════════════════════════════════════════════════════ */
const r2 = new S3Client({
  region    : process.env.R2_REGION ?? "auto",
  endpoint  : process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId     : process.env.R2_ACCESS_KEY_ID,
    secretAccessKey : process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET     = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

/* ────────────────────────────────────────────────────────────
   UPLOAD CONFIG
──────────────────────────────────────────────────────────── */
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/webm", "video/quicktime",          /* short videos */
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/* Magic-byte signatures for real content validation */
const MAGIC = {
  "image/jpeg"  : [Buffer.from([0xFF, 0xD8, 0xFF])],
  "image/png"   : [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  "image/gif"   : [Buffer.from("GIF8")],
  "image/webp"  : [Buffer.from("RIFF")],               /* also check bytes 8-11 */
  "video/mp4"   : [Buffer.from("ftyp", "ascii")],      /* at offset 4 */
  "application/pdf": [Buffer.from("%PDF")],
};

const MAX_IMAGE_SIZE = 10  * 1024 * 1024;  /* 10 MB  */
const MAX_VIDEO_SIZE = 50  * 1024 * 1024;  /* 50 MB  */
const MAX_FILE_SIZE  = 10  * 1024 * 1024;  /* 10 MB  */
const MAX_VIDEO_DURATION_S = 60;            /* 60 sec — enforced server-side via metadata */

const upload = multer({
  storage   : multer.memoryStorage(),
  limits    : { fileSize: MAX_VIDEO_SIZE, files: 5 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error(`File type "${file.mimetype}" is not allowed.`));
  },
});

/* ────────────────────────────────────────────────────────────
   REAL CONTENT VALIDATION  (don't trust MIME type alone)
──────────────────────────────────────────────────────────── */
async function validateFileContent(buffer, declaredMime) {
  /* Use file-type library to detect real type from bytes */
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    /* For plain text / PDF that may not have magic bytes */
    if (declaredMime === "application/pdf") {
      if (buffer.slice(0, 4).toString() !== "%PDF") {
        throw new Error("File does not appear to be a valid PDF.");
      }
      return;
    }
    /* Unknown — reject */
    throw new Error(`Could not determine file type from content.`);
  }

  /* The detected MIME must match the declared MIME */
  if (detected.mime !== declaredMime) {
    throw new Error(
      `File content mismatch: declared "${declaredMime}" but detected "${detected.mime}". ` +
      `Potential spoofing attempt blocked.`
    );
  }

  /* Reject dangerous types even if MIME somehow slipped through */
  const BLOCKED = [
    "application/x-executable",
    "application/x-msdownload",
    "application/x-sh",
    "text/javascript",
    "application/javascript",
  ];
  if (BLOCKED.includes(detected.mime)) {
    throw new Error(`File type "${detected.mime}" is not permitted.`);
  }
}

/* ────────────────────────────────────────────────────────────
   UPLOAD TO R2  (with content validation + progress)
──────────────────────────────────────────────────────────── */
async function uploadToR2(file, folder = "support") {
  /* 1. Real size limits per type */
  const isVideo = file.mimetype.startsWith("video/");
  const limit   = isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;

  if (file.size > limit) {
    throw new Error(
      `"${file.originalname}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. ` +
      `${isVideo ? "Videos" : "Files"} must be under ${limit / 1024 / 1024} MB.`
    );
  }

  /* 2. Real content validation */
  await validateFileContent(file.buffer, file.mimetype);

  /* 3. Upload */
  const ext = path.extname(file.originalname || "file").toLowerCase() || ".bin";
  const key = `${folder}/${Date.now()}-${crypto.randomUUID()}${ext}`;

  await r2.send(new PutObjectCommand({
    Bucket            : R2_BUCKET,
    Key               : key,
    Body              : file.buffer,
    ContentType       : file.mimetype,
    ContentDisposition: "inline",
    Metadata: {
      originalName: file.originalname,
      uploadedAt  : new Date().toISOString(),
    },
  }));

  return {
    key,
    url      : `${R2_PUBLIC_URL}/${key}`,
    fileName : file.originalname,
    fileType : file.mimetype,
    fileSize : file.size,
    isVideo,
  };
}

/* ────────────────────────────────────────────────────────────
   SIGNED URL  (for sensitive attachments — expires in 1 hour)
──────────────────────────────────────────────────────────── */
async function getSignedAttachmentUrl(key, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}

/* ════════════════════════════════════════════════════════════
   EMAIL  (nodemailer)
════════════════════════════════════════════════════════════ */
const mailer = nodemailer.createTransport({
  host   : process.env.SMTP_HOST,
  port   : Number(process.env.SMTP_PORT ?? 587),
  secure : process.env.SMTP_SECURE === "true",
  auth   : {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail({ to, subject, html, text }) {
  if (!process.env.SMTP_HOST) return;   /* skip if not configured */
  try {
    await mailer.sendMail({
      from    : `"Loemart Support" <${process.env.SMTP_FROM ?? "support@loemart.com"}>`,
      to,
      subject,
      html,
      text    : text ?? html.replace(/<[^>]+>/g, ""),
    });
  } catch (err) {
    console.warn("[support] ⚠️  email send failed:", err.message);
  }
}

function buildTicketEmail(type, ticket, extra = {}) {
  const base = `https://www.loemart.com/support/tickets/${ticket.id}`;

  const templates = {
    ticket_created: {
      subject : `[${ticket.ticket_number}] Your support ticket has been received`,
      html    : `
        <h2>We've received your ticket</h2>
        <p><strong>Ticket:</strong> ${ticket.ticket_number}</p>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
        <p><strong>Priority:</strong> ${ticket.priority}</p>
        <p>Our team will respond shortly.
           <a href="${base}">View ticket →</a></p>`,
    },
    agent_replied: {
      subject : `[${ticket.ticket_number}] New reply from support`,
      html    : `
        <h2>Support replied to your ticket</h2>
        <p><strong>Ticket:</strong> ${ticket.ticket_number}</p>
        <p><strong>Agent:</strong> ${extra.agentName ?? "Support Agent"}</p>
        <p><a href="${base}">View reply →</a></p>`,
    },
    ticket_resolved: {
      subject : `[${ticket.ticket_number}] Your ticket has been resolved`,
      html    : `
        <h2>Ticket resolved</h2>
        <p>Your ticket <strong>${ticket.ticket_number}</strong> has been marked as resolved.</p>
        <p>If your issue is not resolved, you can reopen it within 7 days.
           <a href="${base}">View ticket →</a></p>`,
    },
    ticket_closed: {
      subject : `[${ticket.ticket_number}] Ticket closed`,
      html    : `
        <h2>Ticket closed</h2>
        <p>Your ticket <strong>${ticket.ticket_number}</strong> has been closed.</p>
        <p>You have 7 days to reopen it if needed.
           <a href="${base}">View ticket →</a></p>`,
    },
  };

  return templates[type] ?? null;
}

/* ════════════════════════════════════════════════════════════
   WEBSOCKET  (live updates)
   Attach to HTTP server in server.js:
     import { initSupportWS } from "./routes/support.js";
     initSupportWS(server);
════════════════════════════════════════════════════════════ */
const wsClients = new Map();   /* userId → Set<WebSocket> */

export function initSupportWS(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (!req.url.startsWith("/ws/support")) return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws, req) => {
    /* Expect ?token=JWT in query string */
    const url    = new URL(req.url, "http://x");
    const token  = url.searchParams.get("token");

    if (!token) { ws.close(4001, "No token"); return; }

    /* Verify token using your existing auth logic */
    import("../middleware/auth.js").then(({ verifyToken }) => {
      try {
        const user = verifyToken(token);
        const uid  = String(user.id);

        if (!wsClients.has(uid)) wsClients.set(uid, new Set());
        wsClients.get(uid).add(ws);

        ws.on("close", () => {
          wsClients.get(uid)?.delete(ws);
          if (wsClients.get(uid)?.size === 0) wsClients.delete(uid);
        });

        ws.on("message", (data) => {
          try {
            const msg = JSON.parse(data.toString());
            /* Handle typing indicator from client */
            if (msg.type === "typing" && msg.ticketId) {
              broadcastToTicketAgents(msg.ticketId, {
                type    : "typing",
                userId  : uid,
                ticketId: msg.ticketId,
              });
            }
          } catch { /* ignore malformed */ }
        });

        ws.send(JSON.stringify({ type: "connected", userId: uid }));
      } catch {
        ws.close(4001, "Invalid token");
      }
    });
  });
}

function broadcastToUser(userId, payload) {
  const conns = wsClients.get(String(userId));
  if (!conns) return;
  const msg = JSON.stringify(payload);
  for (const ws of conns) {
    if (ws.readyState === 1 /* OPEN */) ws.send(msg);
  }
}

async function broadcastToTicketAgents(ticketId, payload) {
  /* Find the agent assigned to this ticket and broadcast to them */
  try {
    const { rows } = await pool.query(
      `SELECT assigned_to FROM public.support_tickets WHERE id = $1`,
      [ticketId]
    );
    if (rows[0]?.assigned_to) {
      broadcastToUser(rows[0].assigned_to, payload);
    }
  } catch { /* non-fatal */ }
}

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function generateNumber(prefix) {
  const ts     = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${ts}-${random}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Return real pg error details in the response — never swallow. */
function pgError(res, err, step, extra = {}) {
  console.error(`[support] ❌ ${step}`);
  console.error("  message :", err.message);
  console.error("  pg code :", err.code   ?? "(none)");
  console.error("  detail  :", err.detail ?? "(none)");
  console.error("  hint    :", err.hint   ?? "(none)");
  console.error("  stack   :", err.stack);

  return res.status(500).json({
    success : false,
    message : err.message,
    pgCode  : err.code   ?? null,
    detail  : err.detail ?? null,
    hint    : err.hint   ?? null,
    step,
    ...extra,
  });
}

/** Non-fatal notification insert. */
async function createNotification(client, {
  userId, type, title, message,
  referenceId = null, referenceType = null,
}) {
  try {
    await client.query(
      `INSERT INTO public.support_notifications
         (user_id, notification_type, title, message,
          reference_id, reference_type)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, type, title, message, referenceId, referenceType]
    );
  } catch (err) {
    console.warn("[support] ⚠️  createNotification:", err.message);
  }
}

/** Non-fatal activity log insert. */
async function logActivity(client, {
  ticketId, performedBy, action,
  oldValue = null, newValue = null, description = null,
}) {
  try {
    await client.query(
      `INSERT INTO public.ticket_activity_logs
         (ticket_id, performed_by, action,
          old_value, new_value, description)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ticketId, performedBy, action, oldValue, newValue, description]
    );
  } catch (err) {
    console.warn("[support] ⚠️  logActivity:", err.message);
  }
}

/** Detect spam / repeated content. */
async function isSpam(userId, content, windowMinutes = 10) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM public.ticket_messages
       WHERE sender_id  = $1
         AND message    = $2
         AND created_at > NOW() - INTERVAL '${windowMinutes} minutes'`,
      [userId, content]
    );
    return Number(rows[0].cnt) > 0;
  } catch {
    return false;
  }
}

/** Detect scam/insult patterns. */
const SPAM_PATTERNS = [
  /bit\.ly\//i,
  /tinyurl\.com\//i,
  /\bt\.me\//i,
  /\bwhatsapp\.com\/\b/i,
  /send.*bitcoin/i,
  /click.*here.*to.*claim/i,
];

function containsSpamLinks(text) {
  return SPAM_PATTERNS.some((re) => re.test(text));
}

/** Auto-close tickets resolved for > 7 days with no reply. */
export async function runAutoClose() {
  try {
    const { rows } = await pool.query(
      `UPDATE public.support_tickets
       SET status          = 'closed',
           closed_at       = NOW(),
           reopen_deadline = NOW() + INTERVAL '7 days',
           updated_at      = NOW()
       WHERE status    = 'resolved'
         AND updated_at < NOW() - INTERVAL '7 days'
       RETURNING id, ticket_number, user_id, subject`
    );

    for (const ticket of rows) {
      /* Get user email */
      const { rows: users } = await pool.query(
        `SELECT email FROM public.users WHERE id = $1`,
        [ticket.user_id]
      );
      if (users[0]?.email) {
        const tpl = buildTicketEmail("ticket_closed", ticket);
        if (tpl) await sendEmail({ to: users[0].email, ...tpl });
      }

      await pool.query(
        `INSERT INTO public.ticket_activity_logs
           (ticket_id, action, description)
         VALUES ($1,'auto_closed',
           'Ticket auto-closed after 7 days with no reply following resolution.')`,
        [ticket.id]
      ).catch(() => {});
    }

    if (rows.length > 0) {
      console.log(`[support] auto-closed ${rows.length} ticket(s)`);
    }
  } catch (err) {
    console.error("[support] runAutoClose:", err.message);
  }
}

/* Run auto-close every hour */
setInterval(runAutoClose, 60 * 60 * 1000);

/* ════════════════════════════════════════════════════════════
   COLUMN PROBE CACHE
   Avoid querying information_schema on every request.
════════════════════════════════════════════════════════════ */
let _colCache = null;

async function getColumnSets() {
  if (_colCache) return _colCache;

  const { rows: msgCols } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ticket_messages'`
  );
  const { rows: usrCols } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users'`
  );

  const msgSet = new Set(msgCols.map((r) => r.column_name));
  const usrSet = new Set(usrCols.map((r) => r.column_name));

  /* Find the avatar column name */
  const avatarCol =
    ["avatar_url", "profile_image", "photo_url", "picture"]
      .find((c) => usrSet.has(c)) ?? null;

  _colCache = {
    hasInternalNote  : msgSet.has("is_internal_note"),
    hasSystemMessage : msgSet.has("is_system_message"),
    hasIsRead        : msgSet.has("is_read"),
    hasSeenAt        : msgSet.has("seen_at"),
    hasDeletedAt     : msgSet.has("deleted_at"),
    hasSenderRole    : usrSet.has("role"),
    avatarCol,
  };

  return _colCache;
}

/* ════════════════════════════════════════════════════════════
   ╔══════════════════════════════════════╗
   ║          T I C K E T S              ║
   ╚══════════════════════════════════════╝
════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────
   POST /api/support/tickets   [5/hr]
──────────────────────────────────────────────────────────── */
router.post(
  "/tickets",
  authenticate,
  ticketCreateLimit,
  upload.array("attachments", 5),
  async (req, res) => {
    const { category, subject, description, priority = "medium" } = req.body;

    if (!category || !subject || !description) {
      return res.status(400).json({
        success : false,
        message : "category, subject, and description are required.",
      });
    }

    const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success : false,
        message : `priority must be one of: ${VALID_PRIORITIES.join(", ")}`,
      });
    }

    /* Spam detection */
    if (containsSpamLinks(description)) {
      return res.status(400).json({
        success : false,
        message : "Your message contains suspicious links and could not be submitted.",
      });
    }

    /* Duplicate detection — same subject within 1 hour */
    try {
      const { rows: dupes } = await pool.query(
        `SELECT id FROM public.support_tickets
         WHERE user_id    = $1
           AND subject    = $2
           AND created_at > NOW() - INTERVAL '1 hour'
         LIMIT 1`,
        [req.user.id, subject]
      );
      if (dupes.length > 0) {
        return res.status(409).json({
          success : false,
          message : "A ticket with this subject was already submitted in the last hour.",
        });
      }
    } catch { /* non-fatal */ }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* Insert ticket */
      let ticket;
      try {
        const { rows } = await client.query(
          `INSERT INTO public.support_tickets
             (ticket_number, user_id, category, subject,
              description, priority, status)
           VALUES ($1,$2,$3,$4,$5,$6,'open')
           RETURNING *`,
          [generateNumber("TKT"), req.user.id, category, subject, description, priority]
        );
        ticket = rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "create_ticket_insert");
      }

      /* Insert opening message */
      let msgId;
      try {
        const { rows } = await client.query(
          `INSERT INTO public.ticket_messages (ticket_id, sender_id, message)
           VALUES ($1,$2,$3) RETURNING id`,
          [ticket.id, req.user.id, description]
        );
        msgId = rows[0].id;
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "create_ticket_message", { ticketId: ticket.id });
      }

      /* Upload attachments */
      const uploadedFiles = [];
      if (req.files?.length) {
        for (const file of req.files) {
          try {
            const uploaded = await uploadToR2(file, `support/tickets/${ticket.id}`);
            await client.query(
              `INSERT INTO public.ticket_attachments
                 (ticket_id, message_id, uploaded_by,
                  file_name, file_url, file_type, file_size, file_key)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [
                ticket.id, msgId, req.user.id,
                uploaded.fileName, uploaded.url,
                uploaded.fileType, uploaded.fileSize,
                uploaded.key,
              ]
            );
            uploadedFiles.push(uploaded);
          } catch (err) {
            console.warn("[support] ⚠️  attachment upload failed:", err.message);
          }
        }
      }

      await logActivity(client, {
        ticketId    : ticket.id,
        performedBy : req.user.id,
        action      : "ticket_created",
        description : `Ticket ${ticket.ticket_number} created`,
      });

      await createNotification(client, {
        userId        : req.user.id,
        type          : "ticket_created",
        title         : "Support Ticket Created",
        message       : `Ticket ${ticket.ticket_number} submitted. We will respond shortly.`,
        referenceId   : ticket.id,
        referenceType : "ticket",
      });

      await client.query("COMMIT");

      /* Email notification */
      const { rows: [usr] } = await pool.query(
        `SELECT email, name FROM public.users WHERE id = $1`, [req.user.id]
      ).catch(() => ({ rows: [] }));

      if (usr?.email) {
        const tpl = buildTicketEmail("ticket_created", ticket);
        if (tpl) await sendEmail({ to: usr.email, ...tpl });
      }

      /* WebSocket broadcast */
      broadcastToUser(req.user.id, {
        type  : "ticket_created",
        ticket: { id: ticket.id, ticket_number: ticket.ticket_number },
      });

      return res.status(201).json({
        success      : true,
        ticketNumber : ticket.ticket_number,
        ticketId     : ticket.id,
        ticket,
        attachments  : uploadedFiles,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      return pgError(res, err, "create_ticket_unexpected");
    } finally {
      client.release();
    }
  }
);

/* ────────────────────────────────────────────────────────────
   GET /api/support/tickets   [120/min]
──────────────────────────────────────────────────────────── */
router.get("/tickets", authenticate, readLimit, async (req, res) => {
  const { status, priority, search, page = 1, limit = 20 } = req.query;

  const offset     = (Number(page) - 1) * Number(limit);
  const conditions = ["t.user_id = $1"];
  const params     = [req.user.id];
  let   p          = 2;

  if (status)   { conditions.push(`t.status = $${p++}`);    params.push(status);   }
  if (priority) { conditions.push(`t.priority = $${p++}`);  params.push(priority); }
  if (search)   {
    conditions.push(`(t.ticket_number ILIKE $${p} OR t.subject ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }

  const where = conditions.join(" AND ");

  let tickets = [];
  let total   = 0;

  try {
    const { rows } = await pool.query(
      `SELECT
         t.*,
         u.name  AS assigned_agent_name,
         u.email AS assigned_agent_email,
         (SELECT COUNT(*) FROM public.ticket_messages m
          WHERE m.ticket_id = t.id AND m.is_system_message = false
         ) AS message_count,
         /* SLA: first_response_at vs created_at */
         EXTRACT(EPOCH FROM (
           COALESCE(t.first_response_at, NOW()) - t.created_at
         )) / 60 AS response_minutes,
         /* remaining SLA in minutes — target 60 min first response */
         GREATEST(0,
           60 - EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 60
         ) AS sla_remaining_minutes
       FROM public.support_tickets t
       LEFT JOIN public.users u ON u.id = t.assigned_to
       WHERE ${where}
       ORDER BY t.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, Number(limit), offset]
    );
    tickets = rows;
  } catch (err) {
    return pgError(res, err, "list_tickets");
  }

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM public.support_tickets t WHERE ${where}`,
      params
    );
    total = Number(rows[0].count);
  } catch (err) {
    console.warn("[support] ⚠️  ticket count:", err.message);
  }

  return res.json({
    success    : true,
    tickets,
    pagination : {
      total,
      page  : Number(page),
      limit : Number(limit),
      pages : Math.ceil(total / Number(limit)),
    },
  });
});

/* ────────────────────────────────────────────────────────────
   GET /api/support/tickets/search?ticket=TKT-12345
──────────────────────────────────────────────────────────── */
router.get("/tickets/search", authenticate, readLimit, async (req, res) => {
  const { ticket: ticketNumber } = req.query;

  if (!ticketNumber?.trim()) {
    return res.status(400).json({
      success : false,
      message : "ticket query parameter is required. Example: ?ticket=TKT-12345",
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT t.*,
         u.name  AS assigned_agent_name,
         u.email AS assigned_agent_email
       FROM public.support_tickets t
       LEFT JOIN public.users u ON u.id = t.assigned_to
       WHERE t.user_id       = $1
         AND t.ticket_number ILIKE $2`,
      [req.user.id, `%${ticketNumber.trim()}%`]
    );

    return res.json({ success: true, tickets: rows });
  } catch (err) {
    return pgError(res, err, "search_ticket_by_number");
  }
});

/* ────────────────────────────────────────────────────────────
   GET /api/support/tickets/:id
──────────────────────────────────────────────────────────── */
router.get("/tickets/:id", authenticate, readLimit, async (req, res) => {
  const { id }  = req.params;
  const userId  = req.user?.id;

  if (!id || id === "undefined" || id === "null") {
    return res.status(400).json({ success: false, message: "No ticket ID provided." });
  }
  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, message: `Invalid ticket ID: "${id}"` });
  }

  /* ── Step 1: ticket row ── */
  let ticket;
  try {
    const { rows } = await pool.query(
      `SELECT t.*,
         u.name  AS assigned_agent_name,
         u.email AS assigned_agent_email,
         /* SLA */
         EXTRACT(EPOCH FROM (
           COALESCE(t.first_response_at, NOW()) - t.created_at
         )) / 60 AS response_minutes,
         GREATEST(0,
           60 - EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 60
         ) AS sla_remaining_minutes
       FROM public.support_tickets t
       LEFT JOIN public.users u ON u.id = t.assigned_to
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, userId]
    );
    ticket = rows[0] ?? null;
  } catch (err) {
    return pgError(res, err, "get_ticket_row", { ticketId: id });
  }

  if (!ticket) {
    return res.status(404).json({
      success : false,
      message : "Ticket not found. It may have been deleted or belong to a different account.",
    });
  }

  /* ── Step 2: probe columns (cached) ── */
  const cols = await getColumnSets().catch(() => ({
    hasInternalNote: false, hasSystemMessage: false,
    hasSeenAt: false, hasDeletedAt: false,
    hasSenderRole: false, avatarCol: null,
  }));

  const avatarSelect  = cols.avatarCol ? `u.${cols.avatarCol} AS sender_avatar` : "NULL AS sender_avatar";
  const roleSelect    = cols.hasSenderRole ? "u.role AS sender_role" : "'user' AS sender_role";

  const msgWhere = ["m.ticket_id = $1"];
  const msgParams = [ticket.id];
  if (cols.hasInternalNote)  { msgWhere.push("(m.is_internal_note = false OR m.sender_id = $2)"); msgParams.push(userId); }
  if (cols.hasSystemMessage) { msgWhere.push("m.is_system_message = false"); }
  if (cols.hasDeletedAt)     { msgWhere.push("m.deleted_at IS NULL"); }

  /* ── Step 3: messages ── */
  let messages = [];
  try {
    const seenSelect = cols.hasSeenAt ? ", m.seen_at" : "";
    const { rows } = await pool.query(
      `SELECT m.*, u.name AS sender_name,
         ${avatarSelect}, ${roleSelect}${seenSelect}
       FROM public.ticket_messages m
       LEFT JOIN public.users u ON u.id = m.sender_id
       WHERE ${msgWhere.join(" AND ")}
       ORDER BY m.created_at ASC`,
      msgParams
    );
    messages = rows;
  } catch (err) {
    return pgError(res, err, "get_ticket_messages", { ticketId: id });
  }

  /* Mark messages as seen (read receipts) */
  if (cols.hasSeenAt && messages.length > 0) {
    const unseenIds = messages
      .filter((m) => !m.seen_at && String(m.sender_id) !== String(userId))
      .map((m) => m.id);

    if (unseenIds.length > 0) {
      pool.query(
        `UPDATE public.ticket_messages
         SET seen_at = NOW()
         WHERE id = ANY($1)`,
        [unseenIds]
      ).catch(() => {});
    }
  }

  /* ── Step 4: attachments (with signed URLs for private files) ── */
  let attachments = [];
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.ticket_attachments
       WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [ticket.id]
    );

    /* Sign URLs for private content if key is available */
    attachments = await Promise.all(
      rows.map(async (att) => {
        if (att.file_key && process.env.R2_SIGN_URLS === "true") {
          try {
            att.signed_url = await getSignedAttachmentUrl(att.file_key);
          } catch { /* fall back to public url */ }
        }
        return att;
      })
    );
  } catch (err) {
    return pgError(res, err, "get_ticket_attachments", { ticketId: id });
  }

  /* ── Step 5: activity log (non-fatal) ── */
  let activity = [];
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.ticket_activity_logs
       WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [ticket.id]
    );
    activity = rows;
  } catch (err) {
    console.warn("[getTicket] ⚠️  activity log:", err.message);
  }

  /* ── Step 6: assemble ── */
  const attMap = {};
  for (const att of attachments) {
    const key = att.message_id ?? "__ticket__";
    (attMap[key] ??= []).push(att);
  }

  const messagesWithAtt = messages.map((m) => ({
    ...m,
    attachments: attMap[m.id] ?? [],
  }));

  /* SLA summary */
  const sla = {
    response_minutes     : Math.round(Number(ticket.response_minutes ?? 0)),
    sla_remaining_minutes: Math.round(Number(ticket.sla_remaining_minutes ?? 0)),
    first_response_at    : ticket.first_response_at ?? null,
    target_minutes       : 60,
  };

  return res.json({
    success : true,
    ticket  : {
      ...ticket,
      messages    : messagesWithAtt,
      activity,
      attachments,
      sla,
    },
  });
});

/* ────────────────────────────────────────────────────────────
   POST /api/support/tickets/:id/messages   [20/hr]
──────────────────────────────────────────────────────────── */
router.post(
  "/tickets/:id/messages",
  authenticate,
  messageLimit,
  upload.array("attachments", 5),
  async (req, res) => {
    const { id }      = req.params;
    const { message } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({ success: false, message: `Invalid ticket ID: "${id}"` });
    }

    if (!message?.trim() && !req.files?.length) {
      return res.status(400).json({
        success : false,
        message : "A message or at least one attachment is required.",
      });
    }

    /* Spam checks */
    if (message?.trim() && containsSpamLinks(message)) {
      return res.status(400).json({
        success : false,
        message : "Your message contains suspicious links.",
      });
    }

    if (message?.trim() && await isSpam(req.user.id, message.trim())) {
      return res.status(429).json({
        success : false,
        message : "Duplicate message detected. Please wait before sending the same message again.",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let ticket;
      try {
        const { rows } = await client.query(
          `SELECT id, status, ticket_number, user_id, assigned_to
           FROM public.support_tickets
           WHERE id = $1 AND user_id = $2`,
          [id, req.user.id]
        );
        ticket = rows[0] ?? null;
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "reply_ticket_lookup", { ticketId: id });
      }

      if (!ticket) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Ticket not found." });
      }

      if (ticket.status === "closed") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success : false,
          message : "Cannot reply to a closed ticket. Please reopen it first.",
        });
      }

      /* Insert message */
      let msg;
      try {
        const { rows } = await client.query(
          `INSERT INTO public.ticket_messages (ticket_id, sender_id, message)
           VALUES ($1,$2,$3) RETURNING *`,
          [ticket.id, req.user.id, message?.trim() || ""]
        );
        msg = rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "reply_insert_message", { ticketId: id });
      }

      /* Upload attachments */
      const uploadedFiles = [];
      if (req.files?.length) {
        for (const file of req.files) {
          try {
            const uploaded = await uploadToR2(file, `support/tickets/${ticket.id}`);
            await client.query(
              `INSERT INTO public.ticket_attachments
                 (ticket_id, message_id, uploaded_by,
                  file_name, file_url, file_type, file_size, file_key)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [
                ticket.id, msg.id, req.user.id,
                uploaded.fileName, uploaded.url,
                uploaded.fileType, uploaded.fileSize,
                uploaded.key,
              ]
            );
            uploadedFiles.push(uploaded);
          } catch (err) {
            console.warn("[support] ⚠️  reply attachment upload:", err.message);
          }
        }
      }

      /* Auto-reopen if waiting_for_customer */
      if (ticket.status === "waiting_for_customer") {
        try {
          await client.query(
            `UPDATE public.support_tickets
             SET status = 'open', updated_at = NOW() WHERE id = $1`,
            [ticket.id]
          );
        } catch (err) {
          console.warn("[support] ⚠️  status reopen:", err.message);
        }
      }

      await logActivity(client, {
        ticketId    : ticket.id,
        performedBy : req.user.id,
        action      : "message_sent",
        description : "User replied to ticket",
      });

      await client.query("COMMIT");

      /* Email agent */
      if (ticket.assigned_to) {
        const { rows: [agent] } = await pool.query(
          `SELECT email, name FROM public.users WHERE id = $1`, [ticket.assigned_to]
        ).catch(() => ({ rows: [] }));

        if (agent?.email) {
          await sendEmail({
            to      : agent.email,
            subject : `[${ticket.ticket_number}] New user reply`,
            html    : `<p>The user has replied to ticket <strong>${ticket.ticket_number}</strong>.</p>
                       <p><a href="https://www.loemart.com/admin/support/${ticket.id}">View →</a></p>`,
          });
        }
      }

      /* WebSocket — broadcast new message to ticket participants */
      broadcastToUser(req.user.id, {
        type    : "new_message",
        ticketId: ticket.id,
        message : { ...msg, attachments: uploadedFiles },
      });

      if (ticket.assigned_to) {
        broadcastToUser(ticket.assigned_to, {
          type    : "new_message",
          ticketId: ticket.id,
          message : { ...msg, attachments: uploadedFiles },
        });
      }

      return res.status(201).json({
        success     : true,
        message     : { ...msg, attachments: uploadedFiles },
        attachments : uploadedFiles,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      return pgError(res, err, "reply_ticket_unexpected", { ticketId: id });
    } finally {
      client.release();
    }
  }
);

/* ────────────────────────────────────────────────────────────
   PATCH /api/support/tickets/:id/messages/:messageId
   Soft delete a message (sender only, within 5 minutes).
──────────────────────────────────────────────────────────── */
router.patch(
  "/tickets/:id/messages/:messageId",
  authenticate,
  async (req, res) => {
    const { id, messageId } = req.params;
    const { action } = req.body;   /* "delete" */

    if (!isValidUUID(id) || !isValidUUID(messageId)) {
      return res.status(400).json({ success: false, message: "Invalid ID format." });
    }

    if (action !== "delete") {
      return res.status(400).json({ success: false, message: "Only action='delete' is supported." });
    }

    const cols = await getColumnSets().catch(() => ({ hasDeletedAt: false }));

    if (!cols.hasDeletedAt) {
      return res.status(501).json({
        success : false,
        message : "Message deletion is not enabled. Add deleted_at column to ticket_messages.",
      });
    }

    try {
      /* Only sender can delete, only within 5 minutes */
      const { rows } = await pool.query(
        `UPDATE public.ticket_messages
         SET deleted_at = NOW()
         WHERE id        = $1
           AND ticket_id = $2
           AND sender_id = $3
           AND created_at > NOW() - INTERVAL '5 minutes'
           AND deleted_at IS NULL
         RETURNING id`,
        [messageId, id, req.user.id]
      );

      if (!rows[0]) {
        return res.status(403).json({
          success : false,
          message : "Cannot delete this message. You can only delete your own messages within 5 minutes of sending.",
        });
      }

      /* Broadcast deletion */
      broadcastToUser(req.user.id, {
        type      : "message_deleted",
        ticketId  : id,
        messageId,
      });

      return res.json({ success: true, message: "Message deleted." });
    } catch (err) {
      return pgError(res, err, "delete_message", { ticketId: id, messageId });
    }
  }
);

/* ────────────────────────────────────────────────────────────
   PATCH /api/support/tickets/:id   (close)
──────────────────────────────────────────────────────────── */
router.patch("/tickets/:id", authenticate, async (req, res) => {
  const { id }     = req.params;
  const { status } = req.body;

  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, message: `Invalid ticket ID: "${id}"` });
  }
  if (status !== "closed") {
    return res.status(400).json({ success: false, message: "Users may only set status to: closed" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let ticket;
    try {
      const { rows } = await client.query(
        `SELECT id, status, ticket_number, user_id
         FROM public.support_tickets WHERE id = $1 AND user_id = $2`,
        [id, req.user.id]
      );
      ticket = rows[0] ?? null;
    } catch (err) {
      await client.query("ROLLBACK");
      return pgError(res, err, "close_ticket_lookup", { ticketId: id });
    }

    if (!ticket) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }
    if (ticket.status === "closed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Ticket is already closed." });
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    let updated;
    try {
      const { rows } = await client.query(
        `UPDATE public.support_tickets
         SET status = 'closed', closed_at = NOW(),
             reopen_deadline = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [deadline.toISOString(), ticket.id]
      );
      updated = rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      return pgError(res, err, "close_ticket_update", { ticketId: id });
    }

    await logActivity(client, {
      ticketId    : ticket.id,
      performedBy : req.user.id,
      action      : "ticket_closed",
      oldValue    : ticket.status,
      newValue    : "closed",
      description : "Ticket closed by user",
    });

    await client.query("COMMIT");

    /* Email */
    const { rows: [usr] } = await pool.query(
      `SELECT email FROM public.users WHERE id = $1`, [req.user.id]
    ).catch(() => ({ rows: [] }));
    if (usr?.email) {
      const tpl = buildTicketEmail("ticket_closed", ticket);
      if (tpl) await sendEmail({ to: usr.email, ...tpl });
    }

    broadcastToUser(req.user.id, { type: "ticket_closed", ticketId: id });

    return res.json({ success: true, ticket: updated });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return pgError(res, err, "close_ticket_unexpected", { ticketId: id });
  } finally {
    client.release();
  }
});

/* ────────────────────────────────────────────────────────────
   POST /api/support/tickets/:id/reopen
──────────────────────────────────────────────────────────── */
router.post("/tickets/:id/reopen", authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, message: `Invalid ticket ID: "${id}"` });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let ticket;
    try {
      const { rows } = await client.query(
        `SELECT id, status, ticket_number, reopen_deadline, user_id
         FROM public.support_tickets WHERE id = $1 AND user_id = $2`,
        [id, req.user.id]
      );
      ticket = rows[0] ?? null;
    } catch (err) {
      await client.query("ROLLBACK");
      return pgError(res, err, "reopen_ticket_lookup", { ticketId: id });
    }

    if (!ticket) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }
    if (ticket.status !== "closed") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success : false,
        message : `Ticket is not closed — current status is "${ticket.status}".`,
      });
    }
    if (ticket.reopen_deadline && new Date(ticket.reopen_deadline) < new Date()) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success : false,
        message : "The reopen window has expired. Please create a new ticket.",
      });
    }

    let updated;
    try {
      const { rows } = await client.query(
        `UPDATE public.support_tickets
         SET status = 'open', closed_at = NULL, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [ticket.id]
      );
      updated = rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      return pgError(res, err, "reopen_ticket_update", { ticketId: id });
    }

    await logActivity(client, {
      ticketId    : ticket.id,
      performedBy : req.user.id,
      action      : "ticket_reopened",
      oldValue    : "closed",
      newValue    : "open",
      description : "Ticket reopened by user",
    });

    await client.query("COMMIT");

    broadcastToUser(req.user.id, { type: "ticket_reopened", ticketId: id });

    return res.json({ success: true, ticket: updated });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return pgError(res, err, "reopen_ticket_unexpected", { ticketId: id });
  } finally {
    client.release();
  }
});

/* ────────────────────────────────────────────────────────────
   POST /api/support/tickets/:id/rate
──────────────────────────────────────────────────────────── */
router.post("/tickets/:id/rate", authenticate, async (req, res) => {
  const { id }             = req.params;
  const { rating, comment } = req.body;
  const ratingNum           = Number(rating);

  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, message: `Invalid ticket ID: "${id}"` });
  }
  if (!rating || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ success: false, message: "rating must be 1–5." });
  }

  let ticket;
  try {
    const { rows } = await pool.query(
      `SELECT id, status FROM public.support_tickets WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );
    ticket = rows[0] ?? null;
  } catch (err) {
    return pgError(res, err, "rate_ticket_lookup", { ticketId: id });
  }

  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });
  if (!["resolved", "closed"].includes(ticket.status)) {
    return res.status(400).json({ success: false, message: "Can only rate resolved or closed tickets." });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE public.support_tickets
       SET satisfaction_rating  = $1,
           satisfaction_comment = $2,
           updated_at           = NOW()
       WHERE id = $3
       RETURNING satisfaction_rating, satisfaction_comment`,
      [ratingNum, comment ?? null, ticket.id]
    );
    return res.json({ success: true, rating: rows[0] });
  } catch (err) {
    return pgError(res, err, "rate_ticket_update", { ticketId: id });
  }
});

/* ────────────────────────────────────────────────────────────
   GET /api/support/tickets/analytics/satisfaction
──────────────────────────────────────────────────────────── */
router.get("/tickets/analytics/satisfaction", authenticate, readLimit, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE satisfaction_rating IS NOT NULL)     AS total_rated,
         ROUND(AVG(satisfaction_rating)::numeric, 2)                 AS average_rating,
         COUNT(*) FILTER (WHERE satisfaction_rating = 5)             AS five_star,
         COUNT(*) FILTER (WHERE satisfaction_rating = 4)             AS four_star,
         COUNT(*) FILTER (WHERE satisfaction_rating = 3)             AS three_star,
         COUNT(*) FILTER (WHERE satisfaction_rating = 2)             AS two_star,
         COUNT(*) FILTER (WHERE satisfaction_rating = 1)             AS one_star,
         COUNT(*) FILTER (WHERE status IN ('resolved','closed'))      AS total_resolved,
         ROUND(
           AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60)
           ::numeric, 1
         ) AS avg_first_response_minutes,
         ROUND(
           AVG(EXTRACT(EPOCH FROM (
             CASE WHEN status IN ('resolved','closed')
               THEN updated_at ELSE NULL END - created_at
           )) / 3600)::numeric, 2
         ) AS avg_resolution_hours
       FROM public.support_tickets
       WHERE user_id = $1`,
      [req.user.id]
    );
    return res.json({ success: true, analytics: rows[0] });
  } catch (err) {
    return pgError(res, err, "satisfaction_analytics");
  }
});

/* ════════════════════════════════════════════════════════════
   ╔══════════════════════════════════════╗
   ║          R E P O R T S              ║
   ╚══════════════════════════════════════╝
════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────
   POST /api/support/reports   [3/hr]
──────────────────────────────────────────────────────────── */
router.post(
  "/reports",
  authenticate,
  reportLimit,
  upload.array("evidence", 5),
  async (req, res) => {
    const {
      report_type, subject, description,
      reported_user_id    = null,
      reported_listing_id = null,
      reported_order_id   = null,
    } = req.body;

    const VALID_TYPES = [
      "scam","fraud","fake_product","fake_seller","fake_buyer",
      "offensive_content","copyright_violation",
      "payment_issue","delivery_issue","technical_bug","other",
    ];

    if (!report_type || !VALID_TYPES.includes(report_type)) {
      return res.status(400).json({
        success : false,
        message : `report_type must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

    if (!subject || !description) {
      return res.status(400).json({ success: false, message: "subject and description are required." });
    }

    /* Duplicate detection — same report type + reported user/listing within 24h */
    try {
      const { rows } = await pool.query(
        `SELECT id FROM public.reports
         WHERE reporter_id          = $1
           AND report_type          = $2
           AND reported_user_id     IS NOT DISTINCT FROM $3
           AND reported_listing_id  IS NOT DISTINCT FROM $4
           AND created_at           > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [req.user.id, report_type, reported_user_id, reported_listing_id]
      );
      if (rows.length > 0) {
        return res.status(409).json({
          success : false,
          message : "You have already submitted this report in the last 24 hours.",
        });
      }
    } catch { /* non-fatal */ }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const evidenceUrls = [];
      if (req.files?.length) {
        for (const file of req.files) {
          try {
            const uploaded = await uploadToR2(file, `support/reports/${req.user.id}`);
            evidenceUrls.push({ url: uploaded.url, key: uploaded.key });
          } catch (err) {
            console.warn("[support] ⚠️  evidence upload:", err.message);
          }
        }
      }

      let report;
      try {
        const { rows } = await client.query(
          `INSERT INTO public.reports
             (report_number, reporter_id, report_type, subject, description,
              reported_user_id, reported_listing_id, reported_order_id, evidence_urls)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [
            generateNumber("RPT"), req.user.id, report_type, subject, description,
            reported_user_id, reported_listing_id, reported_order_id,
            evidenceUrls.map((e) => e.url),
          ]
        );
        report = rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "create_report_insert");
      }

      await createNotification(client, {
        userId  : req.user.id,
        type    : "report_submitted",
        title   : "Report Submitted",
        message : `Report ${report.report_number} received. Our safety team will review it.`,
      });

      await client.query("COMMIT");

      return res.status(201).json({ success: true, reportNumber: report.report_number, report });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      return pgError(res, err, "create_report_unexpected");
    } finally {
      client.release();
    }
  }
);

router.get("/reports", authenticate, readLimit, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.reports WHERE reporter_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, reports: rows });
  } catch (err) {
    return pgError(res, err, "list_reports");
  }
});

/* ════════════════════════════════════════════════════════════
   ╔══════════════════════════════════════╗
   ║        D I S P U T E S             ║
   ╚══════════════════════════════════════╝
════════════════════════════════════════════════════════════ */

router.post(
  "/disputes",
  authenticate,
  reportLimit,
  upload.array("evidence", 5),
  async (req, res) => {
    const { order_id, seller_id, dispute_type, subject, description } = req.body;

    const VALID_TYPES = [
      "wrong_item","item_not_received","damaged_item",
      "refund_request","delivery_dispute","other",
    ];

    if (!order_id || !seller_id || !dispute_type || !subject || !description) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }
    if (!VALID_TYPES.includes(dispute_type)) {
      return res.status(400).json({
        success : false,
        message : `dispute_type must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const evidenceUrls = [];
      for (const file of (req.files ?? [])) {
        try {
          const up = await uploadToR2(file, `support/disputes/${req.user.id}`);
          evidenceUrls.push(up.url);
        } catch (err) {
          console.warn("[support] ⚠️  dispute evidence:", err.message);
        }
      }

      let dispute;
      try {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 14);
        const { rows } = await client.query(
          `INSERT INTO public.disputes
             (dispute_number, order_id, buyer_id, seller_id, dispute_type,
              subject, description, evidence_urls, deadline)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [
            generateNumber("DSP"), order_id, req.user.id, seller_id, dispute_type,
            subject, description, evidenceUrls, deadline.toISOString(),
          ]
        );
        dispute = rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "create_dispute_insert");
      }

      await createNotification(client, {
        userId: req.user.id, type: "dispute_created", title: "Dispute Filed",
        message: `Dispute ${dispute.dispute_number} filed. Both parties have 14 days to resolve.`,
        referenceId: dispute.id, referenceType: "dispute",
      });

      await createNotification(client, {
        userId: seller_id, type: "dispute_received", title: "Dispute Filed Against You",
        message: `A dispute has been filed regarding order ${order_id}. Please respond within 14 days.`,
        referenceId: dispute.id, referenceType: "dispute",
      });

      await client.query("COMMIT");

      broadcastToUser(seller_id, { type: "dispute_received", disputeId: dispute.id });

      return res.status(201).json({
        success: true, disputeNumber: dispute.dispute_number, disputeId: dispute.id, dispute,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      return pgError(res, err, "create_dispute_unexpected");
    } finally {
      client.release();
    }
  }
);

router.get("/disputes", authenticate, readLimit, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.disputes
       WHERE buyer_id = $1 OR seller_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, disputes: rows });
  } catch (err) {
    return pgError(res, err, "list_disputes");
  }
});

router.get("/disputes/:id", authenticate, readLimit, async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ success: false, message: `Invalid dispute ID.` });

  let dispute;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.disputes WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
      [id, req.user.id]
    );
    dispute = rows[0] ?? null;
  } catch (err) { return pgError(res, err, "get_dispute_row", { disputeId: id }); }

  if (!dispute) return res.status(404).json({ success: false, message: "Dispute not found." });

  let messages = [];
  try {
    const { rows } = await pool.query(
      `SELECT m.*, u.name AS sender_name
       FROM public.dispute_messages m
       LEFT JOIN public.users u ON u.id = m.sender_id
       WHERE m.dispute_id = $1 AND m.is_internal = false
       ORDER BY m.created_at ASC`,
      [dispute.id]
    );
    messages = rows;
  } catch (err) { return pgError(res, err, "get_dispute_messages", { disputeId: id }); }

  return res.json({ success: true, dispute: { ...dispute, messages } });
});

router.post(
  "/disputes/:id/messages",
  authenticate,
  messageLimit,
  upload.array("attachments", 5),
  async (req, res) => {
    const { id }      = req.params;
    const { message } = req.body;
    if (!isValidUUID(id)) return res.status(400).json({ success: false, message: "Invalid dispute ID." });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let dispute;
      try {
        const { rows } = await client.query(
          `SELECT id, status, buyer_id, seller_id FROM public.disputes
           WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
          [id, req.user.id]
        );
        dispute = rows[0] ?? null;
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "dispute_message_lookup", { disputeId: id });
      }

      if (!dispute) { await client.query("ROLLBACK"); return res.status(404).json({ success: false, message: "Dispute not found." }); }
      if (["resolved","closed"].includes(dispute.status)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Cannot reply to a resolved or closed dispute." });
      }

      const attachmentUrls = [];
      for (const file of (req.files ?? [])) {
        try {
          const up = await uploadToR2(file, `support/disputes/${dispute.id}`);
          attachmentUrls.push(up.url);
        } catch (err) { console.warn("[support] ⚠️  dispute attach:", err.message); }
      }

      let msg;
      try {
        const { rows } = await client.query(
          `INSERT INTO public.dispute_messages (dispute_id, sender_id, message, attachments)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [dispute.id, req.user.id, message?.trim() || "", attachmentUrls]
        );
        msg = rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "dispute_message_insert", { disputeId: id });
      }

      const notifyId = dispute.buyer_id === req.user.id ? dispute.seller_id : dispute.buyer_id;
      await createNotification(client, {
        userId: notifyId, type: "dispute_message", title: "New Dispute Reply",
        message: "A new message has been added to your dispute.",
        referenceId: dispute.id, referenceType: "dispute",
      });

      await client.query("COMMIT");

      broadcastToUser(notifyId, { type: "new_dispute_message", disputeId: id, message: msg });

      return res.status(201).json({ success: true, message: msg });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      return pgError(res, err, "dispute_message_unexpected", { disputeId: id });
    } finally {
      client.release();
    }
  }
);

/* ════════════════════════════════════════════════════════════
   ╔══════════════════════════════════════╗
   ║         A P P E A L S              ║
   ╚══════════════════════════════════════╝
════════════════════════════════════════════════════════════ */

router.post(
  "/appeals",
  authenticate,
  reportLimit,
  upload.array("evidence", 5),
  async (req, res) => {
    const { appeal_type, subject, description, reference_id = null } = req.body;
    const VALID_TYPES = [
      "suspended_account","removed_listing","rejected_listing","enforcement_action","other",
    ];

    if (!appeal_type || !VALID_TYPES.includes(appeal_type)) {
      return res.status(400).json({ success: false, message: `appeal_type must be one of: ${VALID_TYPES.join(", ")}` });
    }
    if (!subject || !description) {
      return res.status(400).json({ success: false, message: "subject and description are required." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const evidenceUrls = [];
      for (const file of (req.files ?? [])) {
        try {
          const up = await uploadToR2(file, `support/appeals/${req.user.id}`);
          evidenceUrls.push(up.url);
        } catch (err) { console.warn("[support] ⚠️  appeal evidence:", err.message); }
      }

      let appeal;
      try {
        const { rows } = await client.query(
          `INSERT INTO public.appeals
             (appeal_number, user_id, appeal_type, subject, description,
              reference_id, evidence_urls)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [generateNumber("APL"), req.user.id, appeal_type, subject, description, reference_id, evidenceUrls]
        );
        appeal = rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "create_appeal_insert");
      }

      await createNotification(client, {
        userId: req.user.id, type: "appeal_submitted", title: "Appeal Submitted",
        message: `Appeal ${appeal.appeal_number} submitted. We respond within 3–5 business days.`,
      });

      await client.query("COMMIT");

      return res.status(201).json({ success: true, appealNumber: appeal.appeal_number, appeal });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      return pgError(res, err, "create_appeal_unexpected");
    } finally {
      client.release();
    }
  }
);

router.get("/appeals", authenticate, readLimit, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.appeals WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, appeals: rows });
  } catch (err) {
    return pgError(res, err, "list_appeals");
  }
});

/* ════════════════════════════════════════════════════════════
   ╔══════════════════════════════════════╗
   ║       F E E D B A C K              ║
   ╚══════════════════════════════════════╝
════════════════════════════════════════════════════════════ */

router.post("/feedback", authenticate, makeLimit(60, 5, "Too many feedback submissions."), async (req, res) => {
  const { feedback_type, rating = null, comment = null, suggestion = null, ticket_id = null } = req.body;

  const VALID_TYPES = ["support_rating","feature_suggestion","bug_report","general"];
  if (!feedback_type || !VALID_TYPES.includes(feedback_type)) {
    return res.status(400).json({ success: false, message: `feedback_type must be one of: ${VALID_TYPES.join(", ")}` });
  }
  if (rating !== null) {
    const r = Number(rating);
    if (isNaN(r) || r < 1 || r > 5) {
      return res.status(400).json({ success: false, message: "rating must be 1–5." });
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.support_feedback
         (user_id, ticket_id, feedback_type, rating, comment, suggestion)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, ticket_id, feedback_type, rating ? Number(rating) : null, comment, suggestion]
    );
    return res.status(201).json({ success: true, feedback: rows[0] });
  } catch (err) {
    return pgError(res, err, "create_feedback");
  }
});

/* ════════════════════════════════════════════════════════════
   ╔══════════════════════════════════════════════════════╗
   ║   N O T I F I C A T I O N S                        ║
   ║   read-all MUST be before /:id/read                 ║
   ╚══════════════════════════════════════════════════════╝
════════════════════════════════════════════════════════════ */

router.patch("/notifications/read-all", authenticate, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE public.support_notifications SET is_read = true
       WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    return res.json({ success: true, updated: rowCount });
  } catch (err) {
    return pgError(res, err, "notifications_read_all");
  }
});

router.get("/notifications", authenticate, readLimit, async (req, res) => {
  const { page = 1, limit = 20, unread_only } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const where  = unread_only === "true"
    ? "user_id = $1 AND is_read = false"
    : "user_id = $1";

  let notifications = [], total = 0, unreadCount = 0;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.support_notifications
       WHERE ${where} ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, Number(limit), offset]
    );
    notifications = rows;
  } catch (err) {
    return pgError(res, err, "list_notifications");
  }

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM public.support_notifications WHERE ${where}`,
      [req.user.id]
    );
    total = Number(rows[0].count);
  } catch { /* non-fatal */ }

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS unread FROM public.support_notifications
       WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    unreadCount = Number(rows[0].unread);
  } catch { /* non-fatal */ }

  return res.json({
    success      : true,
    notifications,
    unread_count : unreadCount,
    pagination   : { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
  });
});

router.patch("/notifications/:id/read", authenticate, async (req, res) => {
  const { id } = req.params;
  if (id === "read-all") {
    return res.status(400).json({ success: false, message: "Use PATCH /notifications/read-all." });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE public.support_notifications SET is_read = true
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: "Notification not found." });
    return res.json({ success: true, notification: rows[0] });
  } catch (err) {
    return pgError(res, err, "notification_read_one", { notificationId: id });
  }
});

/* ════════════════════════════════════════════════════════════
   ╔══════════════════════════════════════╗
   ║     F A Q  (public — no auth)       ║
   ╚══════════════════════════════════════╝
════════════════════════════════════════════════════════════ */

router.get("/faq/categories", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
         COUNT(a.id) FILTER (WHERE a.is_published = true) AS article_count
       FROM public.faq_categories c
       LEFT JOIN public.faq_articles a ON a.category_id = c.id
       WHERE c.is_active = true
       GROUP BY c.id ORDER BY c.display_order ASC`
    );
    return res.json({ success: true, categories: rows });
  } catch (err) { return pgError(res, err, "faq_categories"); }
});

router.get("/faq/articles", async (req, res) => {
  const { search, category, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const conds  = ["a.is_published = true"];
  const params = [];
  let p = 1;

  if (category) { conds.push(`c.slug = $${p++}`); params.push(category); }
  if (search)   { conds.push(`(a.title ILIKE $${p} OR a.content ILIKE $${p})`); params.push(`%${search}%`); p++; }

  const where = conds.join(" AND ");

  let articles = [], total = 0;
  try {
    const { rows } = await pool.query(
      `SELECT a.*, c.name AS category_name, c.slug AS category_slug
       FROM public.faq_articles a
       JOIN public.faq_categories c ON c.id = a.category_id
       WHERE ${where}
       ORDER BY a.display_order ASC, a.view_count DESC
       LIMIT $${p} OFFSET $${p+1}`,
      [...params, Number(limit), offset]
    );
    articles = rows;
  } catch (err) { return pgError(res, err, "faq_articles_list"); }

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM public.faq_articles a
       JOIN public.faq_categories c ON c.id = a.category_id WHERE ${where}`,
      params
    );
    total = Number(rows[0].count);
  } catch { /* non-fatal */ }

  return res.json({ success: true, articles, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } });
});

router.get("/faq/articles/:slug", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, c.name AS category_name, c.slug AS category_slug
       FROM public.faq_articles a
       JOIN public.faq_categories c ON c.id = a.category_id
       WHERE a.slug = $1 AND a.is_published = true`,
      [req.params.slug]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: "Article not found." });
    pool.query(`UPDATE public.faq_articles SET view_count = view_count + 1 WHERE id = $1`, [rows[0].id]).catch(() => {});
    return res.json({ success: true, article: rows[0] });
  } catch (err) { return pgError(res, err, "faq_article_by_slug"); }
});

router.post("/faq/articles/:id/helpful", async (req, res) => {
  const { helpful } = req.body;
  if (typeof helpful !== "boolean") {
    return res.status(400).json({ success: false, message: "helpful must be true or false." });
  }
  const field = helpful ? "helpful_count" : "not_helpful_count";
  try {
    const { rows } = await pool.query(
      `UPDATE public.faq_articles SET ${field} = ${field} + 1
       WHERE id = $1 AND is_published = true
       RETURNING helpful_count, not_helpful_count`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: "Article not found." });
    return res.json({ success: true, ...rows[0] });
  } catch (err) { return pgError(res, err, "faq_article_helpful"); }
});

/* ════════════════════════════════════════════════════════════
   SQL INDEXES  (run once — safe to re-run)
   Call this at startup: await createSupportIndexes()
════════════════════════════════════════════════════════════ */
export async function createSupportIndexes() {
  const indexes = [
    /* Tickets */
    `CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id
       ON public.support_tickets (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_support_tickets_status
       ON public.support_tickets (status)`,
    `CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at
       ON public.support_tickets (created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number
       ON public.support_tickets (ticket_number)`,
    `CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status
       ON public.support_tickets (user_id, status)`,

    /* Messages */
    `CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id
       ON public.ticket_messages (ticket_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_id
       ON public.ticket_messages (sender_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at
       ON public.ticket_messages (created_at ASC)`,

    /* Attachments */
    `CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id
       ON public.ticket_attachments (ticket_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ticket_attachments_message_id
       ON public.ticket_attachments (message_id)`,

    /* Notifications */
    `CREATE INDEX IF NOT EXISTS idx_support_notifs_user_id
       ON public.support_notifications (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_support_notifs_user_unread
       ON public.support_notifications (user_id, is_read)`,

    /* Activity log */
    `CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket_id
       ON public.ticket_activity_logs (ticket_id)`,

    /* Reports */
    `CREATE INDEX IF NOT EXISTS idx_reports_reporter_id
       ON public.reports (reporter_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reports_created_at
       ON public.reports (created_at DESC)`,

    /* Disputes */
    `CREATE INDEX IF NOT EXISTS idx_disputes_buyer_id
       ON public.disputes (buyer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_disputes_seller_id
       ON public.disputes (seller_id)`,
  ];

  for (const sql of indexes) {
    try {
      await pool.query(sql);
    } catch (err) {
      console.warn("[support] index creation warning:", err.message);
    }
  }

  console.log("[support] ✓ indexes verified");
}

export default router;