// ════════════════════════════════════════════════════════════
// FILE: routes/support.js
// Mount: /api/support
// ════════════════════════════════════════════════════════════

import express          from "express";
import { pool }         from "../server.js";
import { authenticate } from "../middleware/auth.js";
import multer           from "multer";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";
import path   from "path";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   CLOUDFLARE R2
════════════════════════════════════════════════════════════ */
const s3 = new S3Client({
  region   : "auto",
  endpoint : process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId     : process.env.R2_ACCESS_KEY_ID,
    secretAccessKey : process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET    = process.env.R2_BUCKET_NAME;
const R2_PUBLIC = process.env.R2_PUBLIC_URL;

const upload = multer({
  storage    : multer.memoryStorage(),
  limits     : { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter(_req, file, cb) {
    const ALLOWED = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  },
});

async function uploadToR2(file, folder = "support") {
  const ext = path.extname(file.originalname).toLowerCase();
  const key = `${folder}/${crypto.randomUUID()}${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket             : BUCKET,
    Key                : key,
    Body               : file.buffer,
    ContentType        : file.mimetype,
    ContentDisposition : "inline",
    Metadata: {
      originalName : file.originalname,
      uploadedAt   : new Date().toISOString(),
    },
  }));

  return {
    key,
    url      : `${R2_PUBLIC}/${key}`,
    fileName : file.originalname,
    fileType : file.mimetype,
    fileSize : file.size,
  };
}

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function generateNumber(prefix) {
  const ts     = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${ts}-${random}`;
}

async function createNotification(client, {
  userId,
  type,
  title,
  message,
  referenceId   = null,
  referenceType = null,
}) {
  await client.query(
    `INSERT INTO public.support_notifications
       (user_id, notification_type, title, message, reference_id, reference_type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, message, referenceId, referenceType]
  );
}

async function logActivity(client, {
  ticketId,
  performedBy,
  action,
  oldValue    = null,
  newValue    = null,
  description = null,
}) {
  await client.query(
    `INSERT INTO public.ticket_activity_logs
       (ticket_id, performed_by, action, old_value, new_value, description)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [ticketId, performedBy, action, oldValue, newValue, description]
  );
}

/* ════════════════════════════════════════════════════════════
   TICKETS
════════════════════════════════════════════════════════════ */

/* ── POST /api/support/tickets ── */
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

    if (!category || !subject || !description) {
      return res.status(400).json({
        success : false,
        message : "category, subject and description are required",
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

      const ticketNumber = generateNumber("TKT");

      const { rows: [ticket] } = await client.query(
        `INSERT INTO public.support_tickets
           (ticket_number, user_id, category, subject, description, priority, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'open')
         RETURNING *`,
        [ticketNumber, req.user.id, category, subject, description, priority]
      );

      const { rows: [msg] } = await client.query(
        `INSERT INTO public.ticket_messages
           (ticket_id, sender_id, message)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [ticket.id, req.user.id, description]
      );

      const uploadedFiles = [];
      if (req.files?.length) {
        for (const file of req.files) {
          const uploaded = await uploadToR2(
            file,
            `support/tickets/${ticket.id}`
          );
          await client.query(
            `INSERT INTO public.ticket_attachments
               (ticket_id, message_id, uploaded_by,
                file_name, file_url, file_type, file_size)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              ticket.id, msg.id, req.user.id,
              uploaded.fileName, uploaded.url,
              uploaded.fileType, uploaded.fileSize,
            ]
          );
          uploadedFiles.push(uploaded);
        }
      }

      await logActivity(client, {
        ticketId    : ticket.id,
        performedBy : req.user.id,
        action      : "ticket_created",
        description : `Ticket ${ticketNumber} created with ${priority} priority`,
      });

      await createNotification(client, {
        userId        : req.user.id,
        type          : "ticket_created",
        title         : "Support Ticket Created",
        message       : `Your ticket ${ticketNumber} has been submitted. Our team will respond shortly.`,
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
      await client.query("ROLLBACK");
      console.error("[support] createTicket:", err.message);
      return res.status(500).json({
        success : false,
        message : "Failed to create ticket",
      });
    } finally {
      client.release();
    }
  }
);

/* ── GET /api/support/tickets ── */
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

  if (status)   {
    conditions.push(`t.status = $${p++}`);
    params.push(status);
  }
  if (priority) {
    conditions.push(`t.priority = $${p++}`);
    params.push(priority);
  }
  if (search)   {
    conditions.push(
      `(t.ticket_number ILIKE $${p} OR t.subject ILIKE $${p})`
    );
    params.push(`%${search}%`);
    p++;
  }

  const where = conditions.join(" AND ");

  try {
    const { rows: tickets } = await pool.query(
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

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM public.support_tickets t WHERE ${where}`,
      params
    );

    return res.json({
      success    : true,
      tickets,
      pagination : {
        total : Number(count),
        page  : Number(page),
        limit : Number(limit),
        pages : Math.ceil(Number(count) / Number(limit)),
      },
    });
  } catch (err) {
    console.error("[support] getTickets:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to fetch tickets",
    });
  }
});

/* ── GET /api/support/tickets/:id ── */
router.get("/tickets/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  /* Guard: reject obviously invalid IDs immediately */
  if (!id || id === "undefined" || id === "null") {
    return res.status(400).json({
      success : false,
      message : "Invalid ticket ID",
    });
  }

  try {
    const { rows: [ticket] } = await pool.query(
      `SELECT
         t.*,
         u.name  AS assigned_agent_name,
         u.email AS assigned_agent_email
       FROM public.support_tickets t
       LEFT JOIN public.users u ON u.id = t.assigned_to
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, req.user.id]
    );

    if (!ticket) {
      return res.status(404).json({
        success : false,
        message : "Ticket not found",
      });
    }

    /* Messages — exclude internal notes from user view */
    const { rows: messages } = await pool.query(
      `SELECT
         m.*,
         u.name       AS sender_name,
         u.avatar_url AS sender_avatar,
         u.role       AS sender_role
       FROM public.ticket_messages m
       LEFT JOIN public.users u ON u.id = m.sender_id
       WHERE m.ticket_id = $1
         AND (m.is_internal_note = false OR m.sender_id = $2)
         AND m.is_system_message = false
       ORDER BY m.created_at ASC`,
      [ticket.id, req.user.id]
    );

    /* Attachments */
    const { rows: attachments } = await pool.query(
      `SELECT * FROM public.ticket_attachments
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [ticket.id]
    );

    /* Group attachments by message_id */
    const attMap = {};
    for (const att of attachments) {
      const key = att.message_id ?? "__ticket__";
      if (!attMap[key]) attMap[key] = [];
      attMap[key].push(att);
    }

    const messagesWithAtt = messages.map((m) => ({
      ...m,
      attachments : attMap[m.id] || [],
    }));

    /* Activity log */
    const { rows: activity } = await pool.query(
      `SELECT * FROM public.ticket_activity_logs
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [ticket.id]
    );

    /*
     * Response shape:
     * { success: true, ticket: { id, ticket_number, status, messages, ... } }
     *
     * Frontend unwraps:  const ticketData = data?.ticket ?? data
     */
    return res.json({
      success : true,
      ticket  : {
        ...ticket,
        messages    : messagesWithAtt,
        activity,
        attachments,
      },
    });
  } catch (err) {
    console.error("[support] getTicketDetail:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to fetch ticket",
    });
  }
});

/* ── POST /api/support/tickets/:id/messages ── */
router.post(
  "/tickets/:id/messages",
  authenticate,
  upload.array("attachments", 5),
  async (req, res) => {
    const { message } = req.body;

    if (!message?.trim() && !req.files?.length) {
      return res.status(400).json({
        success : false,
        message : "message or at least one attachment is required",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: [ticket] } = await client.query(
        `SELECT id, status, ticket_number, user_id
         FROM public.support_tickets
         WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      );

      if (!ticket) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success : false,
          message : "Ticket not found",
        });
      }

      if (ticket.status === "closed") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success : false,
          message : "Cannot reply to a closed ticket",
        });
      }

      const { rows: [msg] } = await client.query(
        `INSERT INTO public.ticket_messages
           (ticket_id, sender_id, message)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [ticket.id, req.user.id, message?.trim() || ""]
      );

      const uploadedFiles = [];
      if (req.files?.length) {
        for (const file of req.files) {
          const uploaded = await uploadToR2(
            file,
            `support/tickets/${ticket.id}`
          );
          await client.query(
            `INSERT INTO public.ticket_attachments
               (ticket_id, message_id, uploaded_by,
                file_name, file_url, file_type, file_size)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              ticket.id, msg.id, req.user.id,
              uploaded.fileName, uploaded.url,
              uploaded.fileType, uploaded.fileSize,
            ]
          );
          uploadedFiles.push(uploaded);
        }
      }

      if (ticket.status === "waiting_for_customer") {
        await client.query(
          `UPDATE public.support_tickets
           SET status = 'open', updated_at = NOW()
           WHERE id = $1`,
          [ticket.id]
        );
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
      await client.query("ROLLBACK");
      console.error("[support] replyTicket:", err.message);
      return res.status(500).json({
        success : false,
        message : "Failed to send reply",
      });
    } finally {
      client.release();
    }
  }
);

/* ── PATCH /api/support/tickets/:id ── */
router.patch("/tickets/:id", authenticate, async (req, res) => {
  const { status } = req.body;

  const ALLOWED = ["closed"];
  if (!status || !ALLOWED.includes(status)) {
    return res.status(400).json({
      success : false,
      message : "Users can only set status to: closed",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [ticket] } = await client.query(
      `SELECT id, status, ticket_number, user_id
       FROM public.support_tickets
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (!ticket) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success : false,
        message : "Ticket not found",
      });
    }

    if (ticket.status === "closed") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success : false,
        message : "Ticket is already closed",
      });
    }

    const reopenDeadline = new Date();
    reopenDeadline.setDate(reopenDeadline.getDate() + 7);

    const { rows: [updated] } = await client.query(
      `UPDATE public.support_tickets
       SET status          = 'closed',
           closed_at       = NOW(),
           reopen_deadline = $1,
           updated_at      = NOW()
       WHERE id = $2
       RETURNING *`,
      [reopenDeadline.toISOString(), ticket.id]
    );

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
    await client.query("ROLLBACK");
    console.error("[support] closeTicket:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to close ticket",
    });
  } finally {
    client.release();
  }
});

/* ── POST /api/support/tickets/:id/reopen ── */
router.post("/tickets/:id/reopen", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [ticket] } = await client.query(
      `SELECT id, status, ticket_number, reopen_deadline, user_id
       FROM public.support_tickets
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (!ticket) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success : false,
        message : "Ticket not found",
      });
    }

    if (ticket.status !== "closed") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success : false,
        message : "Ticket is not closed",
      });
    }

    if (
      ticket.reopen_deadline &&
      new Date(ticket.reopen_deadline) < new Date()
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success : false,
        message : "Reopen window has expired. Please create a new ticket.",
      });
    }

    const { rows: [updated] } = await client.query(
      `UPDATE public.support_tickets
       SET status     = 'open',
           closed_at  = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [ticket.id]
    );

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
    await client.query("ROLLBACK");
    console.error("[support] reopenTicket:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to reopen ticket",
    });
  } finally {
    client.release();
  }
});

/* ── POST /api/support/tickets/:id/rate ── */
router.post("/tickets/:id/rate", authenticate, async (req, res) => {
  const { rating, comment } = req.body;
  const ratingNum = Number(rating);

  if (!rating || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({
      success : false,
      message : "rating must be between 1 and 5",
    });
  }

  try {
    const { rows: [ticket] } = await pool.query(
      `SELECT id, status FROM public.support_tickets
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (!ticket) {
      return res.status(404).json({
        success : false,
        message : "Ticket not found",
      });
    }

    if (!["resolved", "closed"].includes(ticket.status)) {
      return res.status(400).json({
        success : false,
        message : "You can only rate resolved or closed tickets",
      });
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE public.support_tickets
       SET satisfaction_rating  = $1,
           satisfaction_comment = $2,
           updated_at           = NOW()
       WHERE id = $3
       RETURNING satisfaction_rating, satisfaction_comment`,
      [ratingNum, comment || null, ticket.id]
    );

    return res.json({ success: true, rating: updated });
  } catch (err) {
    console.error("[support] rateTicket:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to submit rating",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   REPORTS
════════════════════════════════════════════════════════════ */

/* ── POST /api/support/reports ── */
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
        message : "subject and description are required",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const evidenceUrls = [];
      if (req.files?.length) {
        for (const file of req.files) {
          const uploaded = await uploadToR2(
            file,
            `support/reports/${req.user.id}`
          );
          evidenceUrls.push(uploaded.url);
        }
      }

      const reportNumber = generateNumber("RPT");

      const { rows: [report] } = await client.query(
        `INSERT INTO public.reports
           (report_number, reporter_id, report_type, subject, description,
            reported_user_id, reported_listing_id, reported_order_id,
            evidence_urls)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          reportNumber, req.user.id, report_type, subject, description,
          reported_user_id, reported_listing_id, reported_order_id,
          evidenceUrls,
        ]
      );

      await createNotification(client, {
        userId  : req.user.id,
        type    : "report_submitted",
        title   : "Report Submitted",
        message : `Your report ${reportNumber} has been received. Our safety team will review it.`,
      });

      await client.query("COMMIT");

      return res.status(201).json({
        success      : true,
        reportNumber : report.report_number,
        report,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[support] createReport:", err.message);
      return res.status(500).json({
        success : false,
        message : "Failed to submit report",
      });
    } finally {
      client.release();
    }
  }
);

/* ── GET /api/support/reports ── */
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
    console.error("[support] getReports:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to fetch reports",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   DISPUTES
════════════════════════════════════════════════════════════ */

/* ── POST /api/support/disputes ── */
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
        message : "order_id, seller_id, dispute_type, subject and description are required",
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

      const evidenceUrls = [];
      if (req.files?.length) {
        for (const file of req.files) {
          const uploaded = await uploadToR2(
            file,
            `support/disputes/${req.user.id}`
          );
          evidenceUrls.push(uploaded.url);
        }
      }

      const disputeNumber = generateNumber("DSP");
      const deadline      = new Date();
      deadline.setDate(deadline.getDate() + 14);

      const { rows: [dispute] } = await client.query(
        `INSERT INTO public.disputes
           (dispute_number, order_id, buyer_id, seller_id, dispute_type,
            subject, description, evidence_urls, deadline)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          disputeNumber, order_id, req.user.id, seller_id, dispute_type,
          subject, description, evidenceUrls, deadline.toISOString(),
        ]
      );

      await createNotification(client, {
        userId        : req.user.id,
        type          : "dispute_created",
        title         : "Dispute Filed",
        message       : `Your dispute ${disputeNumber} has been filed. Both parties have 14 days to resolve.`,
        referenceId   : dispute.id,
        referenceType : "dispute",
      });

      await createNotification(client, {
        userId        : seller_id,
        type          : "dispute_received",
        title         : "Dispute Filed Against You",
        message       : `A dispute ${disputeNumber} has been filed regarding order ${order_id}. Please respond within 14 days.`,
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
      await client.query("ROLLBACK");
      console.error("[support] createDispute:", err.message);
      return res.status(500).json({
        success : false,
        message : "Failed to file dispute",
      });
    } finally {
      client.release();
    }
  }
);

/* ── GET /api/support/disputes ── */
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
    console.error("[support] getDisputes:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to fetch disputes",
    });
  }
});

/* ── GET /api/support/disputes/:id ── */
router.get("/disputes/:id", authenticate, async (req, res) => {
  try {
    const { rows: [dispute] } = await pool.query(
      `SELECT * FROM public.disputes
       WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
      [req.params.id, req.user.id]
    );

    if (!dispute) {
      return res.status(404).json({
        success : false,
        message : "Dispute not found",
      });
    }

    const { rows: messages } = await pool.query(
      `SELECT m.*, u.name AS sender_name
       FROM public.dispute_messages m
       LEFT JOIN public.users u ON u.id = m.sender_id
       WHERE m.dispute_id = $1
         AND m.is_internal = false
       ORDER BY m.created_at ASC`,
      [dispute.id]
    );

    return res.json({
      success : true,
      dispute : { ...dispute, messages },
    });
  } catch (err) {
    console.error("[support] getDisputeDetail:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to fetch dispute",
    });
  }
});

/* ── POST /api/support/disputes/:id/messages ── */
router.post(
  "/disputes/:id/messages",
  authenticate,
  upload.array("attachments", 5),
  async (req, res) => {
    const { message } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: [dispute] } = await client.query(
        `SELECT id, status, buyer_id, seller_id
         FROM public.disputes
         WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
        [req.params.id, req.user.id]
      );

      if (!dispute) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success : false,
          message : "Dispute not found",
        });
      }

      if (["resolved", "closed"].includes(dispute.status)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success : false,
          message : "Cannot reply to a resolved or closed dispute",
        });
      }

      const attachmentUrls = [];
      if (req.files?.length) {
        for (const file of req.files) {
          const uploaded = await uploadToR2(
            file,
            `support/disputes/${dispute.id}`
          );
          attachmentUrls.push(uploaded.url);
        }
      }

      const { rows: [msg] } = await client.query(
        `INSERT INTO public.dispute_messages
           (dispute_id, sender_id, message, attachments)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [dispute.id, req.user.id, message?.trim() || "", attachmentUrls]
      );

      const notifyId = dispute.buyer_id === req.user.id
        ? dispute.seller_id
        : dispute.buyer_id;

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
      await client.query("ROLLBACK");
      console.error("[support] disputeMessage:", err.message);
      return res.status(500).json({
        success : false,
        message : "Failed to send message",
      });
    } finally {
      client.release();
    }
  }
);

/* ════════════════════════════════════════════════════════════
   APPEALS
════════════════════════════════════════════════════════════ */

/* ── POST /api/support/appeals ── */
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
        message : "subject and description are required",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const evidenceUrls = [];
      if (req.files?.length) {
        for (const file of req.files) {
          const uploaded = await uploadToR2(
            file,
            `support/appeals/${req.user.id}`
          );
          evidenceUrls.push(uploaded.url);
        }
      }

      const appealNumber = generateNumber("APL");

      const { rows: [appeal] } = await client.query(
        `INSERT INTO public.appeals
           (appeal_number, user_id, appeal_type, subject, description,
            reference_id, evidence_urls)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          appealNumber, req.user.id, appeal_type, subject, description,
          reference_id, evidenceUrls,
        ]
      );

      await createNotification(client, {
        userId  : req.user.id,
        type    : "appeal_submitted",
        title   : "Appeal Submitted",
        message : `Your appeal ${appealNumber} has been submitted. Our team will respond within 3 to 5 business days.`,
      });

      await client.query("COMMIT");

      return res.status(201).json({
        success      : true,
        appealNumber : appeal.appeal_number,
        appeal,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[support] createAppeal:", err.message);
      return res.status(500).json({
        success : false,
        message : "Failed to submit appeal",
      });
    } finally {
      client.release();
    }
  }
);

/* ── GET /api/support/appeals ── */
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
    console.error("[support] getAppeals:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to fetch appeals",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   FEEDBACK
════════════════════════════════════════════════════════════ */

/* ── POST /api/support/feedback ── */
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
        message : "rating must be between 1 and 5",
      });
    }
  }

  try {
    const { rows: [feedback] } = await pool.query(
      `INSERT INTO public.support_feedback
         (user_id, ticket_id, feedback_type, rating, comment, suggestion)
       VALUES ($1, $2, $3, $4, $5, $6)
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

    return res.status(201).json({ success: true, feedback });
  } catch (err) {
    console.error("[support] createFeedback:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to submit feedback",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   NOTIFICATIONS
   ─────────────────────────────────────────────────────────
   IMPORTANT: "read-all" must come BEFORE "/:id/read"
   Otherwise Express matches "read-all" as :id and the
   /:id/read handler receives id="read-all" → 404.
════════════════════════════════════════════════════════════ */

/* ── PATCH /api/support/notifications/read-all ── */
/* FIX: this MUST be registered before /:id/read  */
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
    console.error("[support] markAllRead:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to mark notifications",
    });
  }
});

/* ── GET /api/support/notifications ── */
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

  try {
    const { rows: notifications } = await pool.query(
      `SELECT * FROM public.support_notifications
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, Number(limit), offset]
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM public.support_notifications WHERE ${where}`,
      params
    );

    const { rows: [{ unread }] } = await pool.query(
      `SELECT COUNT(*) AS unread
       FROM public.support_notifications
       WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );

    return res.json({
      success      : true,
      notifications,
      unread_count : Number(unread),
      pagination   : {
        total : Number(count),
        page  : Number(page),
        limit : Number(limit),
        pages : Math.ceil(Number(count) / Number(limit)),
      },
    });
  } catch (err) {
    console.error("[support] getNotifications:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to fetch notifications",
    });
  }
});

/* ── PATCH /api/support/notifications/:id/read ── */
router.patch("/notifications/:id/read", authenticate, async (req, res) => {
  try {
    const { rows: [notif] } = await pool.query(
      `UPDATE public.support_notifications
       SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (!notif) {
      return res.status(404).json({
        success : false,
        message : "Notification not found",
      });
    }

    return res.json({ success: true, notification: notif });
  } catch (err) {
    console.error("[support] markRead:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to mark notification",
    });
  }
});

/* ════════════════════════════════════════════════════════════
   FAQ  (public — no auth required)
════════════════════════════════════════════════════════════ */

/* ── GET /api/support/faq/categories ── */
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
    console.error("[support] faqCategories:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to fetch categories",
    });
  }
});

/* ── GET /api/support/faq/articles ── */
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

  try {
    const { rows: articles } = await pool.query(
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

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)
       FROM public.faq_articles a
       JOIN public.faq_categories c ON c.id = a.category_id
       WHERE ${where}`,
      params
    );

    return res.json({
      success    : true,
      articles,
      pagination : {
        total : Number(count),
        page  : Number(page),
        limit : Number(limit),
        pages : Math.ceil(Number(count) / Number(limit)),
      },
    });
  } catch (err) {
    console.error("[support] faqArticles:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to fetch articles",
    });
  }
});

/* ── GET /api/support/faq/articles/:slug ── */
router.get("/faq/articles/:slug", async (req, res) => {
  try {
    const { rows: [article] } = await pool.query(
      `SELECT
         a.*,
         c.name AS category_name,
         c.slug AS category_slug
       FROM public.faq_articles a
       JOIN public.faq_categories c ON c.id = a.category_id
       WHERE a.slug = $1 AND a.is_published = true`,
      [req.params.slug]
    );

    if (!article) {
      return res.status(404).json({
        success : false,
        message : "Article not found",
      });
    }

    /* Fire-and-forget view count */
    pool.query(
      `UPDATE public.faq_articles
       SET view_count = view_count + 1
       WHERE id = $1`,
      [article.id]
    ).catch(() => {});

    return res.json({ success: true, article });
  } catch (err) {
    console.error("[support] faqArticle:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to fetch article",
    });
  }
});

/* ── POST /api/support/faq/articles/:id/helpful ── */
router.post("/faq/articles/:id/helpful", async (req, res) => {
  const { helpful } = req.body;

  if (typeof helpful !== "boolean") {
    return res.status(400).json({
      success : false,
      message : "helpful must be a boolean",
    });
  }

  try {
    const field = helpful ? "helpful_count" : "not_helpful_count";

    const { rows: [article] } = await pool.query(
      `UPDATE public.faq_articles
       SET ${field} = ${field} + 1
       WHERE id = $1 AND is_published = true
       RETURNING helpful_count, not_helpful_count`,
      [req.params.id]
    );

    if (!article) {
      return res.status(404).json({
        success : false,
        message : "Article not found",
      });
    }

    return res.json({ success: true, ...article });
  } catch (err) {
    console.error("[support] articleHelpful:", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to record feedback",
    });
  }
});

export default router;