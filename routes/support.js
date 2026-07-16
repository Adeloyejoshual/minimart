// ════════════════════════════════════════════════════════════
// FILE: routes/support.js
// Mount: /api/support
// ════════════════════════════════════════════════════════════

import express from "express";
import { pool } from "../server.js";
import { authenticate } from "../middleware/auth.js";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   CLOUDFLARE R2
════════════════════════════════════════════════════════════ */
const s3 = new S3Client({
  region  : "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId    : process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET    = process.env.R2_BUCKET_NAME;
const R2_PUBLIC = process.env.R2_PUBLIC_URL;

const upload = multer({
  storage   : multer.memoryStorage(),
  limits    : { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter(_req, file, cb) {
    const ALLOWED = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`File type "${file.mimetype}" is not allowed`));
  },
});

async function uploadToR2(file, folder = "support") {
  const ext = path.extname(file.originalname).toLowerCase();
  const key = `${folder}/${crypto.randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket            : BUCKET,
      Key               : key,
      Body              : file.buffer,
      ContentType       : file.mimetype,
      ContentDisposition: "inline",
      Metadata: {
        originalName: file.originalname,
        uploadedAt  : new Date().toISOString(),
      },
    })
  );

  return {
    key,
    url     : `${R2_PUBLIC}/${key}`,
    fileName: file.originalname,
    fileType: file.mimetype,
    fileSize: file.size,
  };
}

/* ════════════════════════════════════════════════════════════
   SHARED HELPERS
════════════════════════════════════════════════════════════ */

function generateNumber(prefix) {
  const ts     = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${ts}-${random}`;
}

/**
 * Validate UUID v4 format.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Build a structured 500 response from a pg error.
 * Always includes the real pg error message, code, detail, hint.
 */
function pgError(res, err, step, extra = {}) {
  console.error(`[support] ❌ ${step}`);
  console.error("  message :", err.message);
  console.error("  pg code :", err.code   ?? "(none)");
  console.error("  detail  :", err.detail ?? "(none)");
  console.error("  hint    :", err.hint   ?? "(none)");
  console.error("  stack   :", err.stack);

  return res.status(500).json({
    success : false,
    message : err.message,            /* real DB error — never swallowed */
    pgCode  : err.code   ?? null,
    detail  : err.detail ?? null,
    hint    : err.hint   ?? null,
    step,
    ...extra,
  });
}

/**
 * Insert a support notification (non-fatal — logs on failure).
 */
async function createNotification(client, {
  userId,
  type,
  title,
  message,
  referenceId   = null,
  referenceType = null,
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
    /* Non-fatal — ticket must not fail because of a notification error */
    console.warn("[support] ⚠️  createNotification failed:", err.message);
  }
}

/**
 * Insert an activity log entry (non-fatal).
 */
async function logActivity(client, {
  ticketId,
  performedBy,
  action,
  oldValue    = null,
  newValue    = null,
  description = null,
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
    /* Non-fatal */
    console.warn("[support] ⚠️  logActivity failed:", err.message);
  }
}

/* ════════════════════════════════════════════════════════════
   ╔══════════════════════════════════════╗
   ║          T I C K E T S              ║
   ╚══════════════════════════════════════╝
════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────
   POST /api/support/tickets
   Create a new support ticket.
──────────────────────────────────────────────────────────── */
router.post(
  "/tickets",
  authenticate,
  upload.array("attachments", 5),
  async (req, res) => {
    const {
      category,
      subject,
      description,
      priority = "medium",
    } = req.body;

    /* ── Validation ── */
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

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* ── Insert ticket ── */
      let ticket;
      try {
        const ticketNumber = generateNumber("TKT");
        const { rows } = await client.query(
          `INSERT INTO public.support_tickets
             (ticket_number, user_id, category, subject,
              description, priority, status)
           VALUES ($1,$2,$3,$4,$5,$6,'open')
           RETURNING *`,
          [
            ticketNumber,
            req.user.id,
            category,
            subject,
            description,
            priority,
          ]
        );
        ticket = rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "create_ticket_insert");
      }

      /* ── Insert opening message ── */
      let msgId;
      try {
        const { rows } = await client.query(
          `INSERT INTO public.ticket_messages
             (ticket_id, sender_id, message)
           VALUES ($1,$2,$3)
           RETURNING id`,
          [ticket.id, req.user.id, description]
        );
        msgId = rows[0].id;
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "create_ticket_message", { ticketId: ticket.id });
      }

      /* ── Upload attachments (if any) ── */
      const uploadedFiles = [];
      if (req.files?.length) {
        for (const file of req.files) {
          try {
            const uploaded = await uploadToR2(
              file,
              `support/tickets/${ticket.id}`
            );
            await client.query(
              `INSERT INTO public.ticket_attachments
                 (ticket_id, message_id, uploaded_by,
                  file_name, file_url, file_type, file_size)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [
                ticket.id,
                msgId,
                req.user.id,
                uploaded.fileName,
                uploaded.url,
                uploaded.fileType,
                uploaded.fileSize,
              ]
            );
            uploadedFiles.push(uploaded);
          } catch (err) {
            /* Non-fatal — continue without this attachment */
            console.warn("[support] ⚠️  attachment upload failed:", err.message);
          }
        }
      }

      /* ── Activity log + notification (both non-fatal) ── */
      await logActivity(client, {
        ticketId    : ticket.id,
        performedBy : req.user.id,
        action      : "ticket_created",
        description : `Ticket ${ticket.ticket_number} created with ${priority} priority`,
      });

      await createNotification(client, {
        userId        : req.user.id,
        type          : "ticket_created",
        title         : "Support Ticket Created",
        message       : `Your ticket ${ticket.ticket_number} has been submitted. We will respond shortly.`,
        referenceId   : ticket.id,
        referenceType : "ticket",
      });

      await client.query("COMMIT");

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
   GET /api/support/tickets
   List tickets for the authenticated user.
──────────────────────────────────────────────────────────── */
router.get("/tickets", authenticate, async (req, res) => {
  const {
    status,
    priority,
    search,
    page  = 1,
    limit = 20,
  } = req.query;

  const offset     = (Number(page) - 1) * Number(limit);
  const conditions = ["t.user_id = $1"];
  const params     = [req.user.id];
  let   p          = 2;

  if (status) {
    conditions.push(`t.status = $${p++}`);
    params.push(status);
  }
  if (priority) {
    conditions.push(`t.priority = $${p++}`);
    params.push(priority);
  }
  if (search) {
    conditions.push(
      `(t.ticket_number ILIKE $${p} OR t.subject ILIKE $${p})`
    );
    params.push(`%${search}%`);
    p++;
  }

  const where = conditions.join(" AND ");

  /* ── Tickets ── */
  let tickets;
  try {
    const { rows } = await pool.query(
      `SELECT
         t.*,
         u.name  AS assigned_agent_name,
         u.email AS assigned_agent_email,
         (
           SELECT COUNT(*)
           FROM public.ticket_messages m
           WHERE m.ticket_id = t.id
             AND m.is_system_message = false
         ) AS message_count
       FROM public.support_tickets t
       LEFT JOIN public.users u ON u.id = t.assigned_to
       WHERE ${where}
       ORDER BY t.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, Number(limit), offset]
    );
    tickets = rows;
  } catch (err) {
    return pgError(res, err, "list_tickets_query");
  }

  /* ── Count ── */
  let total = 0;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM public.support_tickets t
       WHERE ${where}`,
      params
    );
    total = Number(rows[0].count);
  } catch (err) {
    /* Non-fatal — return tickets without pagination total */
    console.warn("[support] ⚠️  ticket count failed:", err.message);
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
   GET /api/support/tickets/:id
   Fetch a single ticket with messages, attachments, activity.
   Every query is its own try/catch — crash step is identified
   and the real pg error is returned to the client.
──────────────────────────────────────────────────────────── */
router.get("/tickets/:id", authenticate, async (req, res) => {
  const { id }   = req.params;
  const userId   = req.user?.id;

  /* ── Guard: missing / invalid ID ── */
  if (!id || id === "undefined" || id === "null") {
    return res.status(400).json({
      success : false,
      message : "No ticket ID was provided.",
    });
  }

  if (!isValidUUID(id)) {
    return res.status(400).json({
      success : false,
      message : `"${id}" is not a valid ticket ID.`,
    });
  }

  console.log(`[getTicket] → id=${id}  userId=${userId}`);

  /* ══════════════════════════════════════════════════════
     STEP 1 — ticket row
  ══════════════════════════════════════════════════════ */
  let ticket;
  try {
    const { rows } = await pool.query(
      `SELECT
         t.*,
         u.name  AS assigned_agent_name,
         u.email AS assigned_agent_email
       FROM public.support_tickets t
       LEFT JOIN public.users u ON u.id = t.assigned_to
       WHERE t.id = $1
         AND t.user_id = $2`,
      [id, userId]
    );
    ticket = rows[0] ?? null;
  } catch (err) {
    return pgError(res, err, "get_ticket_row", { ticketId: id });
  }

  if (!ticket) {
    console.warn(`[getTicket] 404 — ticket ${id} not found for user ${userId}`);
    return res.status(404).json({
      success : false,
      message :
        "Ticket not found. It may have been deleted or belong to a different account.",
    });
  }

  console.log(`[getTicket] ✓ ticket found — status=${ticket.status}`);

  /* ══════════════════════════════════════════════════════
     STEP 2 — messages
     We probe for optional columns (is_internal_note,
     is_system_message) before using them, so the query
     never crashes on a missing column.
  ══════════════════════════════════════════════════════ */

  /*
   * Check which optional columns exist on ticket_messages.
   * We do this once and cache the result.
   */
  let hasInternalNote   = false;
  let hasSystemMessage  = false;
  let hasSenderAvatar   = false;
  let hasSenderRole     = false;

  try {
    const { rows: cols } = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'ticket_messages'`,
    );
    const colNames = new Set(cols.map((c) => c.column_name));
    hasInternalNote  = colNames.has("is_internal_note");
    hasSystemMessage = colNames.has("is_system_message");

    /* Check users table for avatar column */
    const { rows: userCols } = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'users'`,
    );
    const userColNames = new Set(userCols.map((c) => c.column_name));
    hasSenderAvatar = userColNames.has("avatar_url") ||
                      userColNames.has("profile_image") ||
                      userColNames.has("photo_url");
    hasSenderRole   = userColNames.has("role");

    console.log(
      `[getTicket] columns — is_internal_note=${hasInternalNote}`,
      `is_system_message=${hasSystemMessage}`,
      `avatar=${hasSenderAvatar}`,
      `role=${hasSenderRole}`
    );
  } catch (err) {
    /* Non-fatal — carry on with safe defaults */
    console.warn("[getTicket] ⚠️  column probe failed:", err.message);
  }

  /* Build avatar SELECT safely */
  let avatarSelect = "NULL AS sender_avatar";
  try {
    const { rows: userCols } = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'users'
         AND column_name  IN ('avatar_url','profile_image','photo_url','picture')`,
    );
    if (userCols.length > 0) {
      avatarSelect = `u.${userCols[0].column_name} AS sender_avatar`;
    }
  } catch {
    /* stay with NULL */
  }

  const roleSelect = hasSenderRole ? "u.role AS sender_role" : "'user' AS sender_role";

  /* Build WHERE clause for messages */
  const msgWhereParts = ["m.ticket_id = $1"];
  if (hasInternalNote)  msgWhereParts.push(`(m.is_internal_note = false OR m.sender_id = $2)`);
  if (hasSystemMessage) msgWhereParts.push(`m.is_system_message = false`);
  const msgWhere = msgWhereParts.join(" AND ");
  const msgParams = hasInternalNote ? [ticket.id, userId] : [ticket.id];

  let messages = [];
  try {
    const { rows } = await pool.query(
      `SELECT
         m.*,
         u.name       AS sender_name,
         ${avatarSelect},
         ${roleSelect}
       FROM public.ticket_messages m
       LEFT JOIN public.users u ON u.id = m.sender_id
       WHERE ${msgWhere}
       ORDER BY m.created_at ASC`,
      msgParams
    );
    messages = rows;
    console.log(`[getTicket] ✓ ${messages.length} message(s)`);
  } catch (err) {
    return pgError(res, err, "get_ticket_messages", { ticketId: id });
  }

  /* ══════════════════════════════════════════════════════
     STEP 3 — attachments
  ══════════════════════════════════════════════════════ */
  let attachments = [];
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM public.ticket_attachments
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [ticket.id]
    );
    attachments = rows;
    console.log(`[getTicket] ✓ ${attachments.length} attachment(s)`);
  } catch (err) {
    return pgError(res, err, "get_ticket_attachments", { ticketId: id });
  }

  /* ══════════════════════════════════════════════════════
     STEP 4 — activity log (NON-FATAL)
  ══════════════════════════════════════════════════════ */
  let activity = [];
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM public.ticket_activity_logs
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [ticket.id]
    );
    activity = rows;
  } catch (err) {
    /* Non-fatal — activity log missing or broken; still return ticket */
    console.warn("[getTicket] ⚠️  activity log unavailable:", err.message);
  }

  /* ══════════════════════════════════════════════════════
     STEP 5 — assemble & respond
  ══════════════════════════════════════════════════════ */

  /* Group attachments by message_id */
  const attMap = {};
  for (const att of attachments) {
    const key = att.message_id ?? "__ticket__";
    (attMap[key] ??= []).push(att);
  }

  const messagesWithAtt = messages.map((m) => ({
    ...m,
    attachments : attMap[m.id] ?? [],
  }));

  console.log(`[getTicket] ✓ returning ticket ${id}`);

  return res.status(200).json({
    success : true,
    ticket  : {
      ...ticket,
      messages    : messagesWithAtt,
      activity,
      attachments,
    },
  });
});

/* ────────────────────────────────────────────────────────────
   POST /api/support/tickets/:id/messages
   Add a reply to a ticket.
──────────────────────────────────────────────────────────── */
router.post(
  "/tickets/:id/messages",
  authenticate,
  upload.array("attachments", 5),
  async (req, res) => {
    const { id }    = req.params;
    const { message } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success : false,
        message : `Invalid ticket ID: "${id}"`,
      });
    }

    if (!message?.trim() && !req.files?.length) {
      return res.status(400).json({
        success : false,
        message : "A message or at least one attachment is required.",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* ── Verify ticket exists & belongs to user ── */
      let ticket;
      try {
        const { rows } = await client.query(
          `SELECT id, status, ticket_number, user_id
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
        return res.status(404).json({
          success : false,
          message : "Ticket not found.",
        });
      }

      if (ticket.status === "closed") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success : false,
          message : "Cannot reply to a closed ticket. Please reopen it first.",
        });
      }

      /* ── Insert message ── */
      let msg;
      try {
        const { rows } = await client.query(
          `INSERT INTO public.ticket_messages
             (ticket_id, sender_id, message)
           VALUES ($1,$2,$3)
           RETURNING *`,
          [ticket.id, req.user.id, message?.trim() || ""]
        );
        msg = rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "reply_insert_message", { ticketId: id });
      }

      /* ── Upload attachments ── */
      const uploadedFiles = [];
      if (req.files?.length) {
        for (const file of req.files) {
          try {
            const uploaded = await uploadToR2(
              file,
              `support/tickets/${ticket.id}`
            );
            await client.query(
              `INSERT INTO public.ticket_attachments
                 (ticket_id, message_id, uploaded_by,
                  file_name, file_url, file_type, file_size)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [
                ticket.id,
                msg.id,
                req.user.id,
                uploaded.fileName,
                uploaded.url,
                uploaded.fileType,
                uploaded.fileSize,
              ]
            );
            uploadedFiles.push(uploaded);
          } catch (err) {
            console.warn("[support] ⚠️  attachment upload failed:", err.message);
          }
        }
      }

      /* ── Reopen if waiting_for_customer ── */
      if (ticket.status === "waiting_for_customer") {
        try {
          await client.query(
            `UPDATE public.support_tickets
             SET status = 'open', updated_at = NOW()
             WHERE id = $1`,
            [ticket.id]
          );
        } catch (err) {
          console.warn("[support] ⚠️  status reopen failed:", err.message);
        }
      }

      await logActivity(client, {
        ticketId    : ticket.id,
        performedBy : req.user.id,
        action      : "message_sent",
        description : "User replied to ticket",
      });

      await client.query("COMMIT");

      return res.status(201).json({
        success     : true,
        message     : msg,
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
   PATCH /api/support/tickets/:id
   Close a ticket.
──────────────────────────────────────────────────────────── */
router.patch("/tickets/:id", authenticate, async (req, res) => {
  const { id }     = req.params;
  const { status } = req.body;

  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, message: `Invalid ticket ID: "${id}"` });
  }

  if (status !== "closed") {
    return res.status(400).json({
      success : false,
      message : "Users may only set status to: closed",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let ticket;
    try {
      const { rows } = await client.query(
        `SELECT id, status, ticket_number, user_id
         FROM public.support_tickets
         WHERE id = $1 AND user_id = $2`,
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

    const reopenDeadline = new Date();
    reopenDeadline.setDate(reopenDeadline.getDate() + 7);

    let updated;
    try {
      const { rows } = await client.query(
        `UPDATE public.support_tickets
         SET status          = 'closed',
             closed_at       = NOW(),
             reopen_deadline = $1,
             updated_at      = NOW()
         WHERE id = $2
         RETURNING *`,
        [reopenDeadline.toISOString(), ticket.id]
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
   Reopen a closed ticket within the deadline.
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
         FROM public.support_tickets
         WHERE id = $1 AND user_id = $2`,
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
         SET status     = 'open',
             closed_at  = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
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
   Rate a resolved or closed ticket.
──────────────────────────────────────────────────────────── */
router.post("/tickets/:id/rate", authenticate, async (req, res) => {
  const { id }      = req.params;
  const { rating, comment } = req.body;
  const ratingNum   = Number(rating);

  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, message: `Invalid ticket ID: "${id}"` });
  }

  if (!rating || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({
      success : false,
      message : "rating must be a number between 1 and 5.",
    });
  }

  let ticket;
  try {
    const { rows } = await pool.query(
      `SELECT id, status
       FROM public.support_tickets
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );
    ticket = rows[0] ?? null;
  } catch (err) {
    return pgError(res, err, "rate_ticket_lookup", { ticketId: id });
  }

  if (!ticket) {
    return res.status(404).json({ success: false, message: "Ticket not found." });
  }

  if (!["resolved", "closed"].includes(ticket.status)) {
    return res.status(400).json({
      success : false,
      message : "You can only rate resolved or closed tickets.",
    });
  }

  let updated;
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
    updated = rows[0];
  } catch (err) {
    return pgError(res, err, "rate_ticket_update", { ticketId: id });
  }

  return res.json({ success: true, rating: updated });
});

/* ════════════════════════════════════════════════════════════
   ╔══════════════════════════════════════╗
   ║          R E P O R T S              ║
   ╚══════════════════════════════════════╝
════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────
   POST /api/support/reports
──────────────────────────────────────────────────────────── */
router.post(
  "/reports",
  authenticate,
  upload.array("evidence", 5),
  async (req, res) => {
    const {
      report_type,
      subject,
      description,
      reported_user_id    = null,
      reported_listing_id = null,
      reported_order_id   = null,
    } = req.body;

    const VALID_TYPES = [
      "scam", "fraud", "fake_product", "fake_seller", "fake_buyer",
      "offensive_content", "copyright_violation",
      "payment_issue", "delivery_issue", "technical_bug", "other",
    ];

    if (!report_type || !VALID_TYPES.includes(report_type)) {
      return res.status(400).json({
        success : false,
        message : `report_type must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

    if (!subject || !description) {
      return res.status(400).json({
        success : false,
        message : "subject and description are required.",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* ── Upload evidence ── */
      const evidenceUrls = [];
      if (req.files?.length) {
        for (const file of req.files) {
          try {
            const uploaded = await uploadToR2(
              file,
              `support/reports/${req.user.id}`
            );
            evidenceUrls.push(uploaded.url);
          } catch (err) {
            console.warn("[support] ⚠️  evidence upload failed:", err.message);
          }
        }
      }

      /* ── Insert report ── */
      let report;
      try {
        const reportNumber = generateNumber("RPT");
        const { rows } = await client.query(
          `INSERT INTO public.reports
             (report_number, reporter_id, report_type, subject, description,
              reported_user_id, reported_listing_id, reported_order_id,
              evidence_urls)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING *`,
          [
            reportNumber,
            req.user.id,
            report_type,
            subject,
            description,
            reported_user_id,
            reported_listing_id,
            reported_order_id,
            evidenceUrls,
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
        message : `Your report ${report.report_number} has been received. Our safety team will review it.`,
      });

      await client.query("COMMIT");

      return res.status(201).json({
        success      : true,
        reportNumber : report.report_number,
        report,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      return pgError(res, err, "create_report_unexpected");
    } finally {
      client.release();
    }
  }
);

/* ────────────────────────────────────────────────────────────
   GET /api/support/reports
──────────────────────────────────────────────────────────── */
router.get("/reports", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.reports
       WHERE reporter_id = $1
       ORDER BY created_at DESC`,
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

/* ────────────────────────────────────────────────────────────
   POST /api/support/disputes
──────────────────────────────────────────────────────────── */
router.post(
  "/disputes",
  authenticate,
  upload.array("evidence", 5),
  async (req, res) => {
    const {
      order_id,
      seller_id,
      dispute_type,
      subject,
      description,
    } = req.body;

    const VALID_TYPES = [
      "wrong_item", "item_not_received", "damaged_item",
      "refund_request", "delivery_dispute", "other",
    ];

    if (!order_id || !seller_id || !dispute_type || !subject || !description) {
      return res.status(400).json({
        success : false,
        message :
          "order_id, seller_id, dispute_type, subject, and description are required.",
      });
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

      /* ── Upload evidence ── */
      const evidenceUrls = [];
      if (req.files?.length) {
        for (const file of req.files) {
          try {
            const uploaded = await uploadToR2(
              file,
              `support/disputes/${req.user.id}`
            );
            evidenceUrls.push(uploaded.url);
          } catch (err) {
            console.warn("[support] ⚠️  evidence upload failed:", err.message);
          }
        }
      }

      /* ── Insert dispute ── */
      let dispute;
      try {
        const disputeNumber = generateNumber("DSP");
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 14);

        const { rows } = await client.query(
          `INSERT INTO public.disputes
             (dispute_number, order_id, buyer_id, seller_id, dispute_type,
              subject, description, evidence_urls, deadline)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING *`,
          [
            disputeNumber,
            order_id,
            req.user.id,
            seller_id,
            dispute_type,
            subject,
            description,
            evidenceUrls,
            deadline.toISOString(),
          ]
        );
        dispute = rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "create_dispute_insert");
      }

      await createNotification(client, {
        userId        : req.user.id,
        type          : "dispute_created",
        title         : "Dispute Filed",
        message       : `Your dispute ${dispute.dispute_number} has been filed. Both parties have 14 days to resolve.`,
        referenceId   : dispute.id,
        referenceType : "dispute",
      });

      await createNotification(client, {
        userId        : seller_id,
        type          : "dispute_received",
        title         : "Dispute Filed Against You",
        message       : `A dispute ${dispute.dispute_number} has been filed regarding order ${order_id}. Please respond within 14 days.`,
        referenceId   : dispute.id,
        referenceType : "dispute",
      });

      await client.query("COMMIT");

      return res.status(201).json({
        success       : true,
        disputeNumber : dispute.dispute_number,
        disputeId     : dispute.id,
        dispute,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      return pgError(res, err, "create_dispute_unexpected");
    } finally {
      client.release();
    }
  }
);

/* ────────────────────────────────────────────────────────────
   GET /api/support/disputes
──────────────────────────────────────────────────────────── */
router.get("/disputes", authenticate, async (req, res) => {
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

/* ────────────────────────────────────────────────────────────
   GET /api/support/disputes/:id
──────────────────────────────────────────────────────────── */
router.get("/disputes/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, message: `Invalid dispute ID: "${id}"` });
  }

  let dispute;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.disputes
       WHERE id = $1
         AND (buyer_id = $2 OR seller_id = $2)`,
      [id, req.user.id]
    );
    dispute = rows[0] ?? null;
  } catch (err) {
    return pgError(res, err, "get_dispute_row", { disputeId: id });
  }

  if (!dispute) {
    return res.status(404).json({ success: false, message: "Dispute not found." });
  }

  let messages = [];
  try {
    const { rows } = await pool.query(
      `SELECT m.*, u.name AS sender_name
       FROM public.dispute_messages m
       LEFT JOIN public.users u ON u.id = m.sender_id
       WHERE m.dispute_id = $1
         AND m.is_internal = false
       ORDER BY m.created_at ASC`,
      [dispute.id]
    );
    messages = rows;
  } catch (err) {
    return pgError(res, err, "get_dispute_messages", { disputeId: id });
  }

  return res.json({ success: true, dispute: { ...dispute, messages } });
});

/* ────────────────────────────────────────────────────────────
   POST /api/support/disputes/:id/messages
──────────────────────────────────────────────────────────── */
router.post(
  "/disputes/:id/messages",
  authenticate,
  upload.array("attachments", 5),
  async (req, res) => {
    const { id }      = req.params;
    const { message } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success : false,
        message : `Invalid dispute ID: "${id}"`,
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let dispute;
      try {
        const { rows } = await client.query(
          `SELECT id, status, buyer_id, seller_id
           FROM public.disputes
           WHERE id = $1
             AND (buyer_id = $2 OR seller_id = $2)`,
          [id, req.user.id]
        );
        dispute = rows[0] ?? null;
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "dispute_message_lookup", { disputeId: id });
      }

      if (!dispute) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Dispute not found." });
      }

      if (["resolved", "closed"].includes(dispute.status)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success : false,
          message : "Cannot reply to a resolved or closed dispute.",
        });
      }

      /* ── Upload attachments ── */
      const attachmentUrls = [];
      if (req.files?.length) {
        for (const file of req.files) {
          try {
            const uploaded = await uploadToR2(
              file,
              `support/disputes/${dispute.id}`
            );
            attachmentUrls.push(uploaded.url);
          } catch (err) {
            console.warn("[support] ⚠️  dispute attachment upload failed:", err.message);
          }
        }
      }

      let msg;
      try {
        const { rows } = await client.query(
          `INSERT INTO public.dispute_messages
             (dispute_id, sender_id, message, attachments)
           VALUES ($1,$2,$3,$4)
           RETURNING *`,
          [dispute.id, req.user.id, message?.trim() || "", attachmentUrls]
        );
        msg = rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "dispute_message_insert", { disputeId: id });
      }

      /* Notify the other party */
      const notifyId =
        dispute.buyer_id === req.user.id ? dispute.seller_id : dispute.buyer_id;

      await createNotification(client, {
        userId        : notifyId,
        type          : "dispute_message",
        title         : "New Dispute Reply",
        message       : "A new message has been added to your dispute.",
        referenceId   : dispute.id,
        referenceType : "dispute",
      });

      await client.query("COMMIT");

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

/* ────────────────────────────────────────────────────────────
   POST /api/support/appeals
──────────────────────────────────────────────────────────── */
router.post(
  "/appeals",
  authenticate,
  upload.array("evidence", 5),
  async (req, res) => {
    const {
      appeal_type,
      subject,
      description,
      reference_id = null,
    } = req.body;

    const VALID_TYPES = [
      "suspended_account", "removed_listing", "rejected_listing",
      "enforcement_action", "other",
    ];

    if (!appeal_type || !VALID_TYPES.includes(appeal_type)) {
      return res.status(400).json({
        success : false,
        message : `appeal_type must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

    if (!subject || !description) {
      return res.status(400).json({
        success : false,
        message : "subject and description are required.",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const evidenceUrls = [];
      if (req.files?.length) {
        for (const file of req.files) {
          try {
            const uploaded = await uploadToR2(
              file,
              `support/appeals/${req.user.id}`
            );
            evidenceUrls.push(uploaded.url);
          } catch (err) {
            console.warn("[support] ⚠️  appeal evidence upload failed:", err.message);
          }
        }
      }

      let appeal;
      try {
        const appealNumber = generateNumber("APL");
        const { rows } = await client.query(
          `INSERT INTO public.appeals
             (appeal_number, user_id, appeal_type, subject, description,
              reference_id, evidence_urls)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING *`,
          [
            appealNumber,
            req.user.id,
            appeal_type,
            subject,
            description,
            reference_id,
            evidenceUrls,
          ]
        );
        appeal = rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        return pgError(res, err, "create_appeal_insert");
      }

      await createNotification(client, {
        userId  : req.user.id,
        type    : "appeal_submitted",
        title   : "Appeal Submitted",
        message : `Your appeal ${appeal.appeal_number} has been submitted. We will respond within 3–5 business days.`,
      });

      await client.query("COMMIT");

      return res.status(201).json({
        success      : true,
        appealNumber : appeal.appeal_number,
        appeal,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      return pgError(res, err, "create_appeal_unexpected");
    } finally {
      client.release();
    }
  }
);

/* ────────────────────────────────────────────────────────────
   GET /api/support/appeals
──────────────────────────────────────────────────────────── */
router.get("/appeals", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.appeals
       WHERE user_id = $1
       ORDER BY created_at DESC`,
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

/* ────────────────────────────────────────────────────────────
   POST /api/support/feedback
──────────────────────────────────────────────────────────── */
router.post("/feedback", authenticate, async (req, res) => {
  const {
    feedback_type,
    rating     = null,
    comment    = null,
    suggestion = null,
    ticket_id  = null,
  } = req.body;

  const VALID_TYPES = [
    "support_rating", "feature_suggestion", "bug_report", "general",
  ];

  if (!feedback_type || !VALID_TYPES.includes(feedback_type)) {
    return res.status(400).json({
      success : false,
      message : `feedback_type must be one of: ${VALID_TYPES.join(", ")}`,
    });
  }

  if (rating !== null) {
    const r = Number(rating);
    if (isNaN(r) || r < 1 || r > 5) {
      return res.status(400).json({
        success : false,
        message : "rating must be between 1 and 5.",
      });
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.support_feedback
         (user_id, ticket_id, feedback_type, rating, comment, suggestion)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        req.user.id,
        ticket_id,
        feedback_type,
        rating ? Number(rating) : null,
        comment,
        suggestion,
      ]
    );
    return res.status(201).json({ success: true, feedback: rows[0] });
  } catch (err) {
    return pgError(res, err, "create_feedback");
  }
});

/* ════════════════════════════════════════════════════════════
   ╔══════════════════════════════════════════════════════╗
   ║   N O T I F I C A T I O N S                        ║
   ║                                                      ║
   ║   IMPORTANT — route order matters:                   ║
   ║   "read-all" MUST be registered BEFORE "/:id/read"   ║
   ║   or Express matches "read-all" as :id.              ║
   ╚══════════════════════════════════════════════════════╝
════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────
   PATCH /api/support/notifications/read-all      ← FIRST
──────────────────────────────────────────────────────────── */
router.patch("/notifications/read-all", authenticate, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE public.support_notifications
       SET is_read = true
       WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    return res.json({ success: true, updated: rowCount });
  } catch (err) {
    return pgError(res, err, "notifications_read_all");
  }
});

/* ────────────────────────────────────────────────────────────
   GET /api/support/notifications
──────────────────────────────────────────────────────────── */
router.get("/notifications", authenticate, async (req, res) => {
  const { page = 1, limit = 20, unread_only } = req.query;
  const offset     = (Number(page) - 1) * Number(limit);
  const conditions = ["user_id = $1"];
  const params     = [req.user.id];
  let   p          = 2;

  if (unread_only === "true") {
    conditions.push("is_read = false");
  }

  const where = conditions.join(" AND ");

  let notifications = [];
  let total         = 0;
  let unreadCount   = 0;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.support_notifications
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, Number(limit), offset]
    );
    notifications = rows;
  } catch (err) {
    return pgError(res, err, "list_notifications");
  }

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM public.support_notifications
       WHERE ${where}`,
      params
    );
    total = Number(rows[0].count);
  } catch (err) {
    console.warn("[support] ⚠️  notification count failed:", err.message);
  }

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS unread
       FROM public.support_notifications
       WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    unreadCount = Number(rows[0].unread);
  } catch (err) {
    console.warn("[support] ⚠️  unread count failed:", err.message);
  }

  return res.json({
    success       : true,
    notifications,
    unread_count  : unreadCount,
    pagination    : {
      total,
      page  : Number(page),
      limit : Number(limit),
      pages : Math.ceil(total / Number(limit)),
    },
  });
});

/* ────────────────────────────────────────────────────────────
   PATCH /api/support/notifications/:id/read     ← AFTER read-all
──────────────────────────────────────────────────────────── */
router.patch("/notifications/:id/read", authenticate, async (req, res) => {
  const { id } = req.params;

  /* Prevent "read-all" being treated as an :id */
  if (id === "read-all") {
    return res.status(400).json({
      success : false,
      message : "Use PATCH /notifications/read-all to mark all as read.",
    });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE public.support_notifications
       SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success : false,
        message : "Notification not found.",
      });
    }

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

/* ────────────────────────────────────────────────────────────
   GET /api/support/faq/categories
──────────────────────────────────────────────────────────── */
router.get("/faq/categories", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         c.*,
         COUNT(a.id) FILTER (WHERE a.is_published = true) AS article_count
       FROM public.faq_categories c
       LEFT JOIN public.faq_articles a ON a.category_id = c.id
       WHERE c.is_active = true
       GROUP BY c.id
       ORDER BY c.display_order ASC`
    );
    return res.json({ success: true, categories: rows });
  } catch (err) {
    return pgError(res, err, "faq_categories");
  }
});

/* ────────────────────────────────────────────────────────────
   GET /api/support/faq/articles
──────────────────────────────────────────────────────────── */
router.get("/faq/articles", async (req, res) => {
  const { search, category, page = 1, limit = 20 } = req.query;
  const offset     = (Number(page) - 1) * Number(limit);
  const conditions = ["a.is_published = true"];
  const params     = [];
  let   p          = 1;

  if (category) {
    conditions.push(`c.slug = $${p++}`);
    params.push(category);
  }
  if (search) {
    conditions.push(`(a.title ILIKE $${p} OR a.content ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }

  const where = conditions.join(" AND ");

  let articles = [];
  let total    = 0;

  try {
    const { rows } = await pool.query(
      `SELECT
         a.*,
         c.name AS category_name,
         c.slug AS category_slug
       FROM public.faq_articles a
       JOIN public.faq_categories c ON c.id = a.category_id
       WHERE ${where}
       ORDER BY a.display_order ASC, a.view_count DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, Number(limit), offset]
    );
    articles = rows;
  } catch (err) {
    return pgError(res, err, "faq_articles_list");
  }

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM public.faq_articles a
       JOIN public.faq_categories c ON c.id = a.category_id
       WHERE ${where}`,
      params
    );
    total = Number(rows[0].count);
  } catch (err) {
    console.warn("[support] ⚠️  faq article count failed:", err.message);
  }

  return res.json({
    success    : true,
    articles,
    pagination : {
      total,
      page  : Number(page),
      limit : Number(limit),
      pages : Math.ceil(total / Number(limit)),
    },
  });
});

/* ────────────────────────────────────────────────────────────
   GET /api/support/faq/articles/:slug
──────────────────────────────────────────────────────────── */
router.get("/faq/articles/:slug", async (req, res) => {
  let article;
  try {
    const { rows } = await pool.query(
      `SELECT
         a.*,
         c.name AS category_name,
         c.slug AS category_slug
       FROM public.faq_articles a
       JOIN public.faq_categories c ON c.id = a.category_id
       WHERE a.slug = $1 AND a.is_published = true`,
      [req.params.slug]
    );
    article = rows[0] ?? null;
  } catch (err) {
    return pgError(res, err, "faq_article_by_slug");
  }

  if (!article) {
    return res.status(404).json({ success: false, message: "Article not found." });
  }

  /* Fire-and-forget view count increment */
  pool.query(
    `UPDATE public.faq_articles
     SET view_count = view_count + 1
     WHERE id = $1`,
    [article.id]
  ).catch(() => {});

  return res.json({ success: true, article });
});

/* ────────────────────────────────────────────────────────────
   POST /api/support/faq/articles/:id/helpful
──────────────────────────────────────────────────────────── */
router.post("/faq/articles/:id/helpful", async (req, res) => {
  const { helpful } = req.body;

  if (typeof helpful !== "boolean") {
    return res.status(400).json({
      success : false,
      message : "helpful must be a boolean (true or false).",
    });
  }

  const field = helpful ? "helpful_count" : "not_helpful_count";

  try {
    const { rows } = await pool.query(
      `UPDATE public.faq_articles
       SET ${field} = ${field} + 1
       WHERE id = $1 AND is_published = true
       RETURNING helpful_count, not_helpful_count`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: "Article not found." });
    }

    return res.json({ success: true, ...rows[0] });
  } catch (err) {
    return pgError(res, err, "faq_article_helpful");
  }
});

/* ════════════════════════════════════════════════════════════
   EXPORT
════════════════════════════════════════════════════════════ */
export default router;