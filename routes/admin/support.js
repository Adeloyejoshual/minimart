// ════════════════════════════════════════════════════════════
// FILE: routes/admin/support.js
// Base: /api/admin/support
// Mounted in: routes/admin.js → router.use("/support", supportAdminRouter)
// ════════════════════════════════════════════════════════════

import express from "express";
import { pool } from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   GUARD — all routes in this file require admin auth
════════════════════════════════════════════════════════════ */
router.use(verifyAdmin);

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function paginate(page = 1, limit = 20) {
  const p      = Math.max(1, parseInt(page));
  const l      = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (p - 1) * l;
  return { page: p, limit: l, offset };
}

async function notifyUser(client, {
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

// ── GET /api/admin/support/tickets ───────────────────────────
// Query params: status, priority, assigned_to, search, page, limit
router.get("/tickets", async (req, res) => {
  const {
    status,
    priority,
    assigned_to,
    search,
    page,
    limit,
  } = req.query;

  const { page: pg, limit: lm, offset } = paginate(page, limit);

  const conditions = [];
  const params     = [];
  let   p          = 1;

  if (status) {
    conditions.push(`t.status = $${p++}`);
    params.push(status);
  }
  if (priority) {
    conditions.push(`t.priority = $${p++}`);
    params.push(priority);
  }
  if (assigned_to) {
    conditions.push(`t.assigned_to = $${p++}`);
    params.push(assigned_to);
  }
  if (search) {
    conditions.push(
      `(t.ticket_number ILIKE $${p}
        OR t.subject     ILIKE $${p}
        OR u.email       ILIKE $${p}
        OR u.name        ILIKE $${p})`
    );
    params.push(`%${search}%`);
    p++;
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const { rows: tickets } = await pool.query(
      `SELECT
         t.*,
         u.name        AS user_name,
         u.email       AS user_email,
         u.avatar_url  AS user_avatar,
         a.name        AS agent_name,
         a.email       AS agent_email,
         (
           SELECT COUNT(*)
           FROM public.ticket_messages m
           WHERE m.ticket_id = t.id
             AND m.is_internal_note = false
         ) AS message_count
       FROM public.support_tickets t
       LEFT JOIN public.users u ON u.id = t.user_id
       LEFT JOIN public.users a ON a.id = t.assigned_to
       ${where}
       ORDER BY
         CASE t.priority
           WHEN 'urgent' THEN 1
           WHEN 'high'   THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END,
         CASE t.status
           WHEN 'escalated'          THEN 1
           WHEN 'open'               THEN 2
           WHEN 'waiting_for_customer' THEN 3
           WHEN 'in_progress'        THEN 4
           ELSE 5
         END,
         t.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, lm, offset]
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)
       FROM public.support_tickets t
       LEFT JOIN public.users u ON u.id = t.user_id
       ${where}`,
      params
    );

    return res.json({
      success: true,
      tickets,
      pagination: {
        total: Number(count),
        page:  pg,
        limit: lm,
        pages: Math.ceil(Number(count) / lm),
      },
    });
  } catch (err) {
    console.error("[admin/support] getTickets:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch tickets" });
  }
});

// ── GET /api/admin/support/tickets/:id ───────────────────────
router.get("/tickets/:id", async (req, res) => {
  try {
    /* Ticket + user + agent */
    const { rows: [ticket] } = await pool.query(
      `SELECT
         t.*,
         u.name        AS user_name,
         u.email       AS user_email,
         u.phone       AS user_phone,
         u.avatar_url  AS user_avatar,
         u.created_at  AS user_joined,
         u.status      AS user_status,
         a.name        AS agent_name,
         a.email       AS agent_email
       FROM public.support_tickets t
       LEFT JOIN public.users u ON u.id = t.user_id
       LEFT JOIN public.users a ON a.id = t.assigned_to
       WHERE t.id = $1`,
      [req.params.id]
    );

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    /* All messages including internal notes */
    const { rows: messages } = await pool.query(
      `SELECT
         m.*,
         u.name        AS sender_name,
         u.email       AS sender_email,
         u.avatar_url  AS sender_avatar,
         u.role        AS sender_role
       FROM public.ticket_messages m
       LEFT JOIN public.users u ON u.id = m.sender_id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at ASC`,
      [ticket.id]
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
      attachments: attMap[m.id] || [],
    }));

    /* Activity log */
    const { rows: activity } = await pool.query(
      `SELECT
         l.*,
         u.name  AS performed_by_name,
         u.email AS performed_by_email
       FROM public.ticket_activity_logs l
       LEFT JOIN public.users u ON u.id = l.performed_by
       WHERE l.ticket_id = $1
       ORDER BY l.created_at ASC`,
      [ticket.id]
    );

    /* User's other tickets */
    const { rows: userHistory } = await pool.query(
      `SELECT id, ticket_number, subject, status, priority, created_at
       FROM public.support_tickets
       WHERE user_id = $1
         AND id != $2
       ORDER BY created_at DESC
       LIMIT 5`,
      [ticket.user_id, ticket.id]
    );

    /* Available agents (admins + support staff) */
    const { rows: agents } = await pool.query(
      `SELECT id, name, email, role
       FROM admins
       WHERE status = 'active'
         AND role IN ('admin', 'superadmin', 'support_agent', 'moderator')
       ORDER BY name ASC`
    );

    return res.json({
      success: true,
      ticket: {
        ...ticket,
        messages:     messagesWithAtt,
        attachments,
        activity,
        user_history: userHistory,
      },
      agents,
    });
  } catch (err) {
    console.error("[admin/support] getTicketDetail:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch ticket" });
  }
});

// ── PATCH /api/admin/support/tickets/:id ─────────────────────
// Body: { status, priority, assigned_to }
router.patch("/tickets/:id", async (req, res) => {
  const { status, priority, assigned_to } = req.body;

  const VALID_STATUSES = [
    "open",
    "waiting_for_customer",
    "in_progress",
    "escalated",
    "resolved",
    "closed",
  ];
  const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      success: false,
      message: `priority must be one of: ${VALID_PRIORITIES.join(", ")}`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [old] } = await client.query(
      `SELECT id, status, priority, assigned_to, user_id, ticket_number
       FROM public.support_tickets
       WHERE id = $1`,
      [req.params.id]
    );

    if (!old) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    /* Build dynamic SET */
    const sets    = ["updated_at = NOW()"];
    const vals    = [];
    let   idx     = 1;
    const changes = [];

    if (status && status !== old.status) {
      sets.push(`status = $${idx++}`);
      vals.push(status);
      changes.push({ field: "status", old: old.status, new: status });

      if (status === "resolved") {
        sets.push(`resolved_at = NOW()`);
      }
      if (status === "escalated") {
        sets.push(`escalated_at = NOW()`);
        sets.push(`escalated_to = $${idx++}`);
        vals.push(req.admin.id);
      }
      if (status === "closed") {
        sets.push(`closed_at = NOW()`);
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 7);
        sets.push(`reopen_deadline = $${idx++}`);
        vals.push(deadline.toISOString());
      }
    }

    if (priority && priority !== old.priority) {
      sets.push(`priority = $${idx++}`);
      vals.push(priority);
      changes.push({ field: "priority", old: old.priority, new: priority });
    }

    if (assigned_to !== undefined && assigned_to !== old.assigned_to) {
      sets.push(`assigned_to = $${idx++}`);
      vals.push(assigned_to || null);
      changes.push({
        field: "assigned_to",
        old:   old.assigned_to,
        new:   assigned_to,
      });

      /* Auto set in_progress when assigned — only if status not being set */
      if (!status && assigned_to) {
        sets.push(`status = 'in_progress'`);
        changes.push({ field: "status", old: old.status, new: "in_progress" });
      }
    }

    if (vals.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    vals.push(req.params.id);

    const { rows: [updated] } = await client.query(
      `UPDATE public.support_tickets
       SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING *`,
      vals
    );

    /* Activity log for each change */
    for (const change of changes) {
      await logActivity(client, {
        ticketId:    req.params.id,
        performedBy: req.admin.id,
        action:      `${change.field}_changed`,
        oldValue:    String(change.old ?? ""),
        newValue:    String(change.new ?? ""),
        description: `${change.field} changed from ${change.old} to ${change.new}`,
      });
    }

    /* Notify user of status change */
    const statusChanged = changes.find((c) => c.field === "status");
    if (statusChanged) {
      await notifyUser(client, {
        userId:        old.user_id,
        type:          "ticket_status_changed",
        title:         "Ticket Updated",
        message:       `Your ticket ${old.ticket_number} status has been updated to ${statusChanged.new.replace(/_/g, " ")}.`,
        referenceId:   old.id,
        referenceType: "ticket",
      });
    }

    await client.query("COMMIT");

    return res.json({ success: true, ticket: updated });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/support] updateTicket:", err.message);
    return res.status(500).json({ success: false, message: "Failed to update ticket" });
  } finally {
    client.release();
  }
});

// ── POST /api/admin/support/tickets/:id/reply ────────────────
// Body: { message, is_internal }
router.post("/tickets/:id/reply", async (req, res) => {
  const { message, is_internal = false } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ success: false, message: "message is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [ticket] } = await client.query(
      `SELECT id, status, user_id, ticket_number
       FROM public.support_tickets
       WHERE id = $1`,
      [req.params.id]
    );

    if (!ticket) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    if (ticket.status === "closed") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Cannot reply to a closed ticket. Reopen it first.",
      });
    }

    /* Insert message */
    const { rows: [msg] } = await client.query(
      `INSERT INTO public.ticket_messages
         (ticket_id, sender_id, message, is_internal_note)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ticket.id, req.admin.id, message.trim(), Boolean(is_internal)]
    );

    if (!is_internal) {
      /* Set to waiting_for_customer */
      await client.query(
        `UPDATE public.support_tickets
         SET status = 'waiting_for_customer', updated_at = NOW()
         WHERE id = $1`,
        [ticket.id]
      );

      /* Notify user */
      await notifyUser(client, {
        userId:        ticket.user_id,
        type:          "ticket_reply",
        title:         "New Reply on Your Ticket",
        message:       `Support has replied to your ticket ${ticket.ticket_number}. Please review and respond.`,
        referenceId:   ticket.id,
        referenceType: "ticket",
      });
    }

    await logActivity(client, {
      ticketId:    ticket.id,
      performedBy: req.admin.id,
      action:      is_internal ? "internal_note_added" : "agent_reply_sent",
      description: is_internal ? "Internal note added by agent" : "Agent replied to user",
    });

    await client.query("COMMIT");

    return res.status(201).json({ success: true, message: msg });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/support] agentReply:", err.message);
    return res.status(500).json({ success: false, message: "Failed to send reply" });
  } finally {
    client.release();
  }
});

// ── POST /api/admin/support/tickets/:id/escalate ─────────────
// Body: { reason }
router.post("/tickets/:id/escalate", async (req, res) => {
  const { reason } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [ticket] } = await client.query(
      `SELECT id, status, user_id, ticket_number
       FROM public.support_tickets
       WHERE id = $1`,
      [req.params.id]
    );

    if (!ticket) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    if (ticket.status === "closed" || ticket.status === "resolved") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Cannot escalate a resolved or closed ticket",
      });
    }

    const { rows: [updated] } = await client.query(
      `UPDATE public.support_tickets
       SET status       = 'escalated',
           escalated_to = $1,
           escalated_at = NOW(),
           updated_at   = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.admin.id, ticket.id]
    );

    await logActivity(client, {
      ticketId:    ticket.id,
      performedBy: req.admin.id,
      action:      "ticket_escalated",
      oldValue:    ticket.status,
      newValue:    "escalated",
      description: reason || "Ticket escalated by agent",
    });

    await notifyUser(client, {
      userId:        ticket.user_id,
      type:          "ticket_escalated",
      title:         "Ticket Escalated",
      message:       `Your ticket ${ticket.ticket_number} has been escalated to a senior agent for priority handling.`,
      referenceId:   ticket.id,
      referenceType: "ticket",
    });

    await client.query("COMMIT");

    return res.json({ success: true, ticket: updated });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/support] escalateTicket:", err.message);
    return res.status(500).json({ success: false, message: "Failed to escalate ticket" });
  } finally {
    client.release();
  }
});

// ── POST /api/admin/support/tickets/:id/assign ───────────────
// Body: { agent_id }
router.post("/tickets/:id/assign", async (req, res) => {
  const { agent_id } = req.body;

  if (!agent_id) {
    return res.status(400).json({ success: false, message: "agent_id is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [ticket] } = await client.query(
      `SELECT id, user_id, ticket_number, assigned_to
       FROM public.support_tickets WHERE id = $1`,
      [req.params.id]
    );

    if (!ticket) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    /* Verify agent exists */
    const { rows: [agent] } = await client.query(
      `SELECT id, name FROM admins WHERE id = $1 AND status = 'active'`,
      [agent_id]
    );

    if (!agent) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Agent not found or inactive" });
    }

    const { rows: [updated] } = await client.query(
      `UPDATE public.support_tickets
       SET assigned_to = $1,
           status      = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
           updated_at  = NOW()
       WHERE id = $2
       RETURNING *`,
      [agent_id, ticket.id]
    );

    await logActivity(client, {
      ticketId:    ticket.id,
      performedBy: req.admin.id,
      action:      "ticket_assigned",
      oldValue:    ticket.assigned_to,
      newValue:    agent_id,
      description: `Ticket assigned to ${agent.name}`,
    });

    await client.query("COMMIT");

    return res.json({ success: true, ticket: updated, agent });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/support] assignTicket:", err.message);
    return res.status(500).json({ success: false, message: "Failed to assign ticket" });
  } finally {
    client.release();
  }
});

// ── POST /api/admin/support/tickets/:id/close ────────────────
router.post("/tickets/:id/close", async (req, res) => {
  const { note } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [ticket] } = await client.query(
      `SELECT id, status, user_id, ticket_number
       FROM public.support_tickets WHERE id = $1`,
      [req.params.id]
    );

    if (!ticket) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    if (ticket.status === "closed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Ticket is already closed" });
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    const { rows: [updated] } = await client.query(
      `UPDATE public.support_tickets
       SET status          = 'closed',
           closed_at       = NOW(),
           reopen_deadline = $1,
           updated_at      = NOW()
       WHERE id = $2
       RETURNING *`,
      [deadline.toISOString(), ticket.id]
    );

    if (note?.trim()) {
      await client.query(
        `INSERT INTO public.ticket_messages
           (ticket_id, sender_id, message, is_internal_note)
         VALUES ($1, $2, $3, true)`,
        [ticket.id, req.admin.id, note.trim()]
      );
    }

    await logActivity(client, {
      ticketId:    ticket.id,
      performedBy: req.admin.id,
      action:      "ticket_closed",
      oldValue:    ticket.status,
      newValue:    "closed",
      description: note || "Ticket closed by admin",
    });

    await notifyUser(client, {
      userId:        ticket.user_id,
      type:          "ticket_closed",
      title:         "Ticket Closed",
      message:       `Your ticket ${ticket.ticket_number} has been closed. You have 7 days to reopen it if needed.`,
      referenceId:   ticket.id,
      referenceType: "ticket",
    });

    await client.query("COMMIT");

    return res.json({ success: true, ticket: updated });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/support] adminCloseTicket:", err.message);
    return res.status(500).json({ success: false, message: "Failed to close ticket" });
  } finally {
    client.release();
  }
});

// ── POST /api/admin/support/tickets/:id/reopen ───────────────
router.post("/tickets/:id/reopen", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [ticket] } = await client.query(
      `SELECT id, status, user_id, ticket_number
       FROM public.support_tickets WHERE id = $1`,
      [req.params.id]
    );

    if (!ticket) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    if (ticket.status !== "closed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Ticket is not closed" });
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
      ticketId:    ticket.id,
      performedBy: req.admin.id,
      action:      "ticket_reopened",
      oldValue:    "closed",
      newValue:    "open",
      description: "Ticket reopened by admin",
    });

    await notifyUser(client, {
      userId:        ticket.user_id,
      type:          "ticket_reopened",
      title:         "Ticket Reopened",
      message:       `Your ticket ${ticket.ticket_number} has been reopened by our support team.`,
      referenceId:   ticket.id,
      referenceType: "ticket",
    });

    await client.query("COMMIT");

    return res.json({ success: true, ticket: updated });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/support] adminReopenTicket:", err.message);
    return res.status(500).json({ success: false, message: "Failed to reopen ticket" });
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   REPORTS
════════════════════════════════════════════════════════════ */

// ── GET /api/admin/support/reports ───────────────────────────
// Query params: status, report_type, page, limit
router.get("/reports", async (req, res) => {
  const { status, report_type, page, limit } = req.query;
  const { page: pg, limit: lm, offset } = paginate(page, limit);

  const conditions = [];
  const params     = [];
  let   p          = 1;

  if (status) {
    conditions.push(`r.status = $${p++}`);
    params.push(status);
  }
  if (report_type) {
    conditions.push(`r.report_type = $${p++}`);
    params.push(report_type);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const { rows: reports } = await pool.query(
      `SELECT
         r.*,
         u.name        AS reporter_name,
         u.email       AS reporter_email,
         u.avatar_url  AS reporter_avatar,
         ru.name       AS reported_user_name,
         ru.email      AS reported_user_email
       FROM public.reports r
       LEFT JOIN public.users u  ON u.id  = r.reporter_id
       LEFT JOIN public.users ru ON ru.id = r.reported_user_id
       ${where}
       ORDER BY
         CASE r.status WHEN 'pending' THEN 1 ELSE 2 END,
         r.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, lm, offset]
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM public.reports r ${where}`,
      params
    );

    return res.json({
      success: true,
      reports,
      pagination: {
        total: Number(count),
        page:  pg,
        limit: lm,
        pages: Math.ceil(Number(count) / lm),
      },
    });
  } catch (err) {
    console.error("[admin/support] getReports:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch reports" });
  }
});

// ── GET /api/admin/support/reports/:id ───────────────────────
router.get("/reports/:id", async (req, res) => {
  try {
    const { rows: [report] } = await pool.query(
      `SELECT
         r.*,
         u.name       AS reporter_name,
         u.email      AS reporter_email,
         u.avatar_url AS reporter_avatar,
         ru.name      AS reported_user_name,
         ru.email     AS reported_user_email,
         rv.name      AS reviewed_by_name
       FROM public.reports r
       LEFT JOIN public.users  u  ON u.id  = r.reporter_id
       LEFT JOIN public.users  ru ON ru.id = r.reported_user_id
       LEFT JOIN admins        rv ON rv.id  = r.reviewed_by
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    return res.json({ success: true, report });
  } catch (err) {
    console.error("[admin/support] getReportDetail:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch report" });
  }
});

// ── PATCH /api/admin/support/reports/:id ─────────────────────
// Body: { status, resolution_notes }
router.patch("/reports/:id", async (req, res) => {
  const { status, resolution_notes } = req.body;

  const VALID = ["pending", "under_review", "resolved", "dismissed"];
  if (!status || !VALID.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID.join(", ")}`,
    });
  }

  try {
    const { rows: [report] } = await pool.query(
      `UPDATE public.reports
       SET status           = $1,
           resolution_notes = $2,
           reviewed_by      = $3,
           reviewed_at      = NOW(),
           updated_at       = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, resolution_notes || null, req.admin.id, req.params.id]
    );

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    return res.json({ success: true, report });
  } catch (err) {
    console.error("[admin/support] updateReport:", err.message);
    return res.status(500).json({ success: false, message: "Failed to update report" });
  }
});

/* ════════════════════════════════════════════════════════════
   DISPUTES
════════════════════════════════════════════════════════════ */

// ── GET /api/admin/support/disputes ──────────────────────────
// Query params: status, dispute_type, page, limit
router.get("/disputes", async (req, res) => {
  const { status, dispute_type, page, limit } = req.query;
  const { page: pg, limit: lm, offset } = paginate(page, limit);

  const conditions = [];
  const params     = [];
  let   p          = 1;

  if (status) {
    conditions.push(`d.status = $${p++}`);
    params.push(status);
  }
  if (dispute_type) {
    conditions.push(`d.dispute_type = $${p++}`);
    params.push(dispute_type);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const { rows: disputes } = await pool.query(
      `SELECT
         d.*,
         b.name  AS buyer_name,
         b.email AS buyer_email,
         s.name  AS seller_name,
         s.email AS seller_email,
         (
           SELECT COUNT(*)
           FROM public.dispute_messages dm
           WHERE dm.dispute_id = d.id AND dm.is_internal = false
         ) AS message_count
       FROM public.disputes d
       LEFT JOIN public.users b ON b.id = d.buyer_id
       LEFT JOIN public.users s ON s.id = d.seller_id
       ${where}
       ORDER BY
         CASE d.status WHEN 'open' THEN 1 WHEN 'under_review' THEN 2 ELSE 3 END,
         d.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, lm, offset]
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM public.disputes d ${where}`,
      params
    );

    return res.json({
      success: true,
      disputes,
      pagination: {
        total: Number(count),
        page:  pg,
        limit: lm,
        pages: Math.ceil(Number(count) / lm),
      },
    });
  } catch (err) {
    console.error("[admin/support] getDisputes:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch disputes" });
  }
});

// ── GET /api/admin/support/disputes/:id ──────────────────────
router.get("/disputes/:id", async (req, res) => {
  try {
    const { rows: [dispute] } = await pool.query(
      `SELECT
         d.*,
         b.name  AS buyer_name,
         b.email AS buyer_email,
         s.name  AS seller_name,
         s.email AS seller_email,
         rv.name AS resolved_by_name
       FROM public.disputes d
       LEFT JOIN public.users  b  ON b.id  = d.buyer_id
       LEFT JOIN public.users  s  ON s.id  = d.seller_id
       LEFT JOIN admins        rv ON rv.id  = d.resolved_by
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (!dispute) {
      return res.status(404).json({ success: false, message: "Dispute not found" });
    }

    const { rows: messages } = await pool.query(
      `SELECT
         m.*,
         u.name AS sender_name,
         u.email AS sender_email
       FROM public.dispute_messages m
       LEFT JOIN public.users u ON u.id = m.sender_id
       WHERE m.dispute_id = $1
       ORDER BY m.created_at ASC`,
      [dispute.id]
    );

    return res.json({
      success: true,
      dispute: { ...dispute, messages },
    });
  } catch (err) {
    console.error("[admin/support] getDisputeDetail:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch dispute" });
  }
});

// ── PATCH /api/admin/support/disputes/:id ────────────────────
// Body: { status, resolution, resolution_notes }
router.patch("/disputes/:id", async (req, res) => {
  const { status, resolution, resolution_notes } = req.body;

  const VALID_STATUSES = [
    "open", "under_review", "awaiting_seller",
    "awaiting_buyer", "resolved", "closed", "escalated",
  ];
  const VALID_RESOLUTIONS = [
    "refund_approved", "refund_rejected",
    "replacement_approved", "dismissed", "other",
  ];

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }
  if (resolution && !VALID_RESOLUTIONS.includes(resolution)) {
    return res.status(400).json({
      success: false,
      message: `resolution must be one of: ${VALID_RESOLUTIONS.join(", ")}`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [dispute] } = await client.query(
      `SELECT id, buyer_id, seller_id, dispute_number, status
       FROM public.disputes WHERE id = $1`,
      [req.params.id]
    );

    if (!dispute) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Dispute not found" });
    }

    const sets = ["updated_at = NOW()"];
    const vals = [];
    let   idx  = 1;

    if (status) {
      sets.push(`status = $${idx++}`);
      vals.push(status);
    }
    if (resolution) {
      sets.push(`resolution = $${idx++}`);
      vals.push(resolution);
    }
    if (resolution_notes !== undefined) {
      sets.push(`resolution_notes = $${idx++}`);
      vals.push(resolution_notes || null);
    }
    if (status && ["resolved", "closed"].includes(status)) {
      sets.push(`resolved_by = $${idx++}`);
      sets.push(`resolved_at = NOW()`);
      vals.push(req.admin.id);
    }

    vals.push(dispute.id);

    const { rows: [updated] } = await client.query(
      `UPDATE public.disputes
       SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING *`,
      vals
    );

    /* Notify both parties */
    const notifyMsg = resolution_notes
      ? `Dispute ${dispute.dispute_number} update: ${resolution_notes}`
      : `Your dispute ${dispute.dispute_number} status has been updated to ${status?.replace(/_/g, " ")}.`;

    for (const userId of [dispute.buyer_id, dispute.seller_id]) {
      await notifyUser(client, {
        userId,
        type:          "dispute_updated",
        title:         "Dispute Updated",
        message:       notifyMsg,
        referenceId:   dispute.id,
        referenceType: "dispute",
      });
    }

    await client.query("COMMIT");

    return res.json({ success: true, dispute: updated });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/support] updateDispute:", err.message);
    return res.status(500).json({ success: false, message: "Failed to update dispute" });
  } finally {
    client.release();
  }
});

// ── POST /api/admin/support/disputes/:id/message ─────────────
// Body: { message, is_internal }
router.post("/disputes/:id/message", async (req, res) => {
  const { message, is_internal = true } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ success: false, message: "message is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [dispute] } = await client.query(
      `SELECT id, buyer_id, seller_id FROM public.disputes WHERE id = $1`,
      [req.params.id]
    );

    if (!dispute) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Dispute not found" });
    }

    const { rows: [msg] } = await client.query(
      `INSERT INTO public.dispute_messages
         (dispute_id, sender_id, message, is_internal)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [dispute.id, req.admin.id, message.trim(), Boolean(is_internal)]
    );

    if (!is_internal) {
      for (const userId of [dispute.buyer_id, dispute.seller_id]) {
        await notifyUser(client, {
          userId,
          type:          "dispute_message",
          title:         "New Message on Your Dispute",
          message:       "Support has sent a message regarding your dispute.",
          referenceId:   dispute.id,
          referenceType: "dispute",
        });
      }
    }

    await client.query("COMMIT");

    return res.status(201).json({ success: true, message: msg });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/support] disputeAdminMessage:", err.message);
    return res.status(500).json({ success: false, message: "Failed to send message" });
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   APPEALS
════════════════════════════════════════════════════════════ */

// ── GET /api/admin/support/appeals ───────────────────────────
// Query params: status, appeal_type, page, limit
router.get("/appeals", async (req, res) => {
  const { status, appeal_type, page, limit } = req.query;
  const { page: pg, limit: lm, offset } = paginate(page, limit);

  const conditions = [];
  const params     = [];
  let   p          = 1;

  if (status) {
    conditions.push(`a.status = $${p++}`);
    params.push(status);
  }
  if (appeal_type) {
    conditions.push(`a.appeal_type = $${p++}`);
    params.push(appeal_type);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const { rows: appeals } = await pool.query(
      `SELECT
         a.*,
         u.name       AS user_name,
         u.email      AS user_email,
         u.avatar_url AS user_avatar,
         rv.name      AS reviewed_by_name
       FROM public.appeals a
       LEFT JOIN public.users u  ON u.id  = a.user_id
       LEFT JOIN admins       rv ON rv.id = a.reviewed_by
       ${where}
       ORDER BY
         CASE a.status WHEN 'pending' THEN 1 WHEN 'under_review' THEN 2 ELSE 3 END,
         a.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, lm, offset]
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM public.appeals a ${where}`,
      params
    );

    return res.json({
      success: true,
      appeals,
      pagination: {
        total: Number(count),
        page:  pg,
        limit: lm,
        pages: Math.ceil(Number(count) / lm),
      },
    });
  } catch (err) {
    console.error("[admin/support] getAppeals:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch appeals" });
  }
});

// ── GET /api/admin/support/appeals/:id ───────────────────────
router.get("/appeals/:id", async (req, res) => {
  try {
    const { rows: [appeal] } = await pool.query(
      `SELECT
         a.*,
         u.name       AS user_name,
         u.email      AS user_email,
         u.avatar_url AS user_avatar,
         rv.name      AS reviewed_by_name
       FROM public.appeals a
       LEFT JOIN public.users u  ON u.id  = a.user_id
       LEFT JOIN admins       rv ON rv.id = a.reviewed_by
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (!appeal) {
      return res.status(404).json({ success: false, message: "Appeal not found" });
    }

    return res.json({ success: true, appeal });
  } catch (err) {
    console.error("[admin/support] getAppealDetail:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch appeal" });
  }
});

// ── PATCH /api/admin/support/appeals/:id ─────────────────────
// Body: { status, decision_notes }
router.patch("/appeals/:id", async (req, res) => {
  const { status, decision_notes } = req.body;

  const VALID = ["pending", "under_review", "approved", "rejected", "closed"];
  if (!status || !VALID.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID.join(", ")}`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [appeal] } = await client.query(
      `SELECT id, user_id, appeal_number FROM public.appeals WHERE id = $1`,
      [req.params.id]
    );

    if (!appeal) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Appeal not found" });
    }

    const { rows: [updated] } = await client.query(
      `UPDATE public.appeals
       SET status         = $1,
           decision_notes = $2,
           reviewed_by    = $3,
           reviewed_at    = NOW(),
           updated_at     = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, decision_notes || null, req.admin.id, appeal.id]
    );

    await notifyUser(client, {
      userId:        appeal.user_id,
      type:          "appeal_decision",
      title:         "Appeal Decision",
      message:       `Your appeal ${appeal.appeal_number} has been ${status}.${decision_notes ? " " + decision_notes : ""}`,
      referenceId:   appeal.id,
      referenceType: "appeal",
    });

    await client.query("COMMIT");

    return res.json({ success: true, appeal: updated });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/support] updateAppeal:", err.message);
    return res.status(500).json({ success: false, message: "Failed to update appeal" });
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   FAQ MANAGEMENT
════════════════════════════════════════════════════════════ */

// ── GET /api/admin/support/faq/categories ────────────────────
router.get("/faq/categories", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         c.*,
         COUNT(a.id) FILTER (WHERE a.is_published = true)  AS published_count,
         COUNT(a.id)                                        AS total_count
       FROM public.faq_categories c
       LEFT JOIN public.faq_articles a ON a.category_id = c.id
       GROUP BY c.id
       ORDER BY c.display_order ASC`
    );
    return res.json({ success: true, categories: rows });
  } catch (err) {
    console.error("[admin/support] faqCategories:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
});

// ── POST /api/admin/support/faq/categories ───────────────────
// Body: { name, slug, icon, description, display_order }
router.post("/faq/categories", async (req, res) => {
  const { name, slug, icon = null, description = null, display_order = 0 } = req.body;

  if (!name?.trim() || !slug?.trim()) {
    return res.status(400).json({ success: false, message: "name and slug are required" });
  }

  try {
    const { rows: [cat] } = await pool.query(
      `INSERT INTO public.faq_categories
         (name, slug, icon, description, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name.trim(), slug.trim(), icon, description, display_order]
    );
    return res.status(201).json({ success: true, category: cat });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Slug already exists" });
    }
    console.error("[admin/support] createFaqCategory:", err.message);
    return res.status(500).json({ success: false, message: "Failed to create category" });
  }
});

// ── PATCH /api/admin/support/faq/categories/:id ──────────────
router.patch("/faq/categories/:id", async (req, res) => {
  const { name, icon, description, display_order, is_active } = req.body;

  const sets = ["updated_at = NOW()"];
  const vals = [];
  let   idx  = 1;

  if (name          !== undefined) { sets.push(`name = $${idx++}`);          vals.push(name); }
  if (icon          !== undefined) { sets.push(`icon = $${idx++}`);          vals.push(icon); }
  if (description   !== undefined) { sets.push(`description = $${idx++}`);   vals.push(description); }
  if (display_order !== undefined) { sets.push(`display_order = $${idx++}`); vals.push(display_order); }
  if (is_active     !== undefined) { sets.push(`is_active = $${idx++}`);     vals.push(is_active); }

  if (vals.length === 0) {
    return res.status(400).json({ success: false, message: "No valid fields to update" });
  }

  vals.push(req.params.id);

  try {
    const { rows: [cat] } = await pool.query(
      `UPDATE public.faq_categories SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!cat) return res.status(404).json({ success: false, message: "Category not found" });
    return res.json({ success: true, category: cat });
  } catch (err) {
    console.error("[admin/support] updateFaqCategory:", err.message);
    return res.status(500).json({ success: false, message: "Failed to update category" });
  }
});

// ── GET /api/admin/support/faq/articles ──────────────────────
// Query params: category_id, is_published, page, limit
router.get("/faq/articles", async (req, res) => {
  const { category_id, is_published, search, page, limit } = req.query;
  const { page: pg, limit: lm, offset } = paginate(page, limit);

  const conditions = [];
  const params     = [];
  let   p          = 1;

  if (category_id) {
    conditions.push(`a.category_id = $${p++}`);
    params.push(category_id);
  }
  if (is_published !== undefined) {
    conditions.push(`a.is_published = $${p++}`);
    params.push(is_published === "true");
  }
  if (search) {
    conditions.push(`(a.title ILIKE $${p} OR a.content ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const { rows: articles } = await pool.query(
      `SELECT
         a.*,
         c.name AS category_name,
         c.slug AS category_slug
       FROM public.faq_articles a
       JOIN public.faq_categories c ON c.id = a.category_id
       ${where}
       ORDER BY a.display_order ASC, a.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, lm, offset]
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM public.faq_articles a
       JOIN public.faq_categories c ON c.id = a.category_id
       ${where}`,
      params
    );

    return res.json({
      success: true,
      articles,
      pagination: {
        total: Number(count),
        page:  pg,
        limit: lm,
        pages: Math.ceil(Number(count) / lm),
      },
    });
  } catch (err) {
    console.error("[admin/support] getAdminFaqArticles:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch articles" });
  }
});

// ── POST /api/admin/support/faq/articles ─────────────────────
// Body: { category_id, title, content, slug, tags, display_order, is_published }
router.post("/faq/articles", async (req, res) => {
  const {
    category_id,
    title,
    content,
    slug,
    tags          = [],
    display_order = 0,
    is_published  = true,
  } = req.body;

  if (!category_id || !title?.trim() || !content?.trim() || !slug?.trim()) {
    return res.status(400).json({
      success: false,
      message: "category_id, title, content and slug are required",
    });
  }

  try {
    const { rows: [article] } = await pool.query(
      `INSERT INTO public.faq_articles
         (category_id, title, content, slug, tags, display_order, is_published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        category_id,
        title.trim(),
        content.trim(),
        slug.trim(),
        tags,
        display_order,
        is_published,
        req.admin.id,
      ]
    );
    return res.status(201).json({ success: true, article });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Slug already exists" });
    }
    console.error("[admin/support] createFaqArticle:", err.message);
    return res.status(500).json({ success: false, message: "Failed to create article" });
  }
});

// ── PATCH /api/admin/support/faq/articles/:id ────────────────
// Body: { title, content, tags, display_order, is_published }
router.patch("/faq/articles/:id", async (req, res) => {
  const { title, content, tags, display_order, is_published } = req.body;

  const sets = ["updated_at = NOW()", `updated_by = $1`];
  const vals = [req.admin.id];
  let   idx  = 2;

  if (title         !== undefined) { sets.push(`title = $${idx++}`);         vals.push(title); }
  if (content       !== undefined) { sets.push(`content = $${idx++}`);       vals.push(content); }
  if (tags          !== undefined) { sets.push(`tags = $${idx++}`);          vals.push(tags); }
  if (display_order !== undefined) { sets.push(`display_order = $${idx++}`); vals.push(display_order); }
  if (is_published  !== undefined) { sets.push(`is_published = $${idx++}`);  vals.push(is_published); }

  if (vals.length === 1) {
    return res.status(400).json({ success: false, message: "No valid fields to update" });
  }

  vals.push(req.params.id);

  try {
    const { rows: [article] } = await pool.query(
      `UPDATE public.faq_articles
       SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING *`,
      vals
    );

    if (!article) {
      return res.status(404).json({ success: false, message: "Article not found" });
    }

    return res.json({ success: true, article });
  } catch (err) {
    console.error("[admin/support] updateFaqArticle:", err.message);
    return res.status(500).json({ success: false, message: "Failed to update article" });
  }
});

// ── DELETE /api/admin/support/faq/articles/:id ───────────────
router.delete("/faq/articles/:id", async (req, res) => {
  try {
    const { rows: [article] } = await pool.query(
      `DELETE FROM public.faq_articles WHERE id = $1 RETURNING id, title`,
      [req.params.id]
    );

    if (!article) {
      return res.status(404).json({ success: false, message: "Article not found" });
    }

    return res.json({ success: true, deleted: article });
  } catch (err) {
    console.error("[admin/support] deleteFaqArticle:", err.message);
    return res.status(500).json({ success: false, message: "Failed to delete article" });
  }
});

/* ════════════════════════════════════════════════════════════
   ANALYTICS
════════════════════════════════════════════════════════════ */

// ── GET /api/admin/support/analytics ─────────────────────────
router.get("/analytics", async (req, res) => {
  const { days = 30 } = req.query;
  const interval      = `${Math.min(90, Math.max(7, parseInt(days)))} days`;

  try {
    const [
      statusBreakdown,
      priorityBreakdown,
      categoryBreakdown,
      volumeTrend,
      avgResponseTime,
      ratingStats,
      reportStats,
      disputeStats,
      appealStats,
      topAgents,
      feedbackSummary,
    ] = await Promise.all([

      /* Tickets by status */
      pool.query(
        `SELECT status, COUNT(*) AS count
         FROM public.support_tickets
         GROUP BY status
         ORDER BY count DESC`
      ),

      /* Tickets by priority */
      pool.query(
        `SELECT priority, COUNT(*) AS count
         FROM public.support_tickets
         GROUP BY priority
         ORDER BY count DESC`
      ),

      /* Tickets by category */
      pool.query(
        `SELECT category, COUNT(*) AS count
         FROM public.support_tickets
         GROUP BY category
         ORDER BY count DESC
         LIMIT 12`
      ),

      /* Volume trend */
      pool.query(
        `SELECT
           DATE_TRUNC('day', created_at) AS day,
           COUNT(*)                       AS total,
           COUNT(*) FILTER (WHERE status IN ('resolved','closed')) AS resolved
         FROM public.support_tickets
         WHERE created_at >= NOW() - INTERVAL '${interval}'
         GROUP BY day
         ORDER BY day ASC`
      ),

      /* Avg first response time (minutes) */
      pool.query(
        `SELECT
           ROUND(
             AVG(
               EXTRACT(EPOCH FROM (m.created_at - t.created_at)) / 60
             )
           , 1) AS avg_first_response_minutes
         FROM public.support_tickets t
         JOIN public.ticket_messages m ON m.ticket_id = t.id
           AND m.is_system_message = false
           AND m.sender_id != t.user_id
         WHERE t.created_at >= NOW() - INTERVAL '${interval}'
           AND m.created_at = (
             SELECT MIN(m2.created_at)
             FROM public.ticket_messages m2
             WHERE m2.ticket_id = t.id
               AND m2.sender_id != t.user_id
               AND m2.is_system_message = false
           )`
      ),

      /* Rating stats */
      pool.query(
        `SELECT
           ROUND(AVG(satisfaction_rating), 2) AS avg_rating,
           COUNT(satisfaction_rating)          AS total_rated,
           COUNT(*) FILTER (WHERE satisfaction_rating = 5) AS five_star,
           COUNT(*) FILTER (WHERE satisfaction_rating = 4) AS four_star,
           COUNT(*) FILTER (WHERE satisfaction_rating = 3) AS three_star,
           COUNT(*) FILTER (WHERE satisfaction_rating <= 2) AS low_star
         FROM public.support_tickets
         WHERE satisfaction_rating IS NOT NULL`
      ),

      /* Reports by status */
      pool.query(
        `SELECT status, COUNT(*) AS count
         FROM public.reports
         GROUP BY status`
      ),

      /* Disputes by status */
      pool.query(
        `SELECT status, COUNT(*) AS count
         FROM public.disputes
         GROUP BY status`
      ),

      /* Appeals by status */
      pool.query(
        `SELECT status, COUNT(*) AS count
         FROM public.appeals
         GROUP BY status`
      ),

      /* Top agents by tickets resolved */
      pool.query(
        `SELECT
           a.id,
           a.name,
           a.email,
           COUNT(t.id) AS tickets_assigned,
           COUNT(t.id) FILTER (WHERE t.status IN ('resolved','closed')) AS tickets_resolved,
           ROUND(AVG(t.satisfaction_rating), 2) AS avg_rating
         FROM admins a
         JOIN public.support_tickets t ON t.assigned_to = a.id
         WHERE t.created_at >= NOW() - INTERVAL '${interval}'
         GROUP BY a.id, a.name, a.email
         ORDER BY tickets_resolved DESC
         LIMIT 10`
      ),

      /* Feedback type breakdown */
      pool.query(
        `SELECT feedback_type, COUNT(*) AS count
         FROM public.support_feedback
         GROUP BY feedback_type`
      ),
    ]);

    /* Build totals */
    const ticketTotal = statusBreakdown.rows.reduce(
      (sum, r) => sum + Number(r.count), 0
    );

    return res.json({
      success: true,
      period:  `Last ${days} days`,
      analytics: {
        tickets: {
          total:       ticketTotal,
          by_status:   statusBreakdown.rows,
          by_priority: priorityBreakdown.rows,
          by_category: categoryBreakdown.rows,
          volume_trend: volumeTrend.rows,
          avg_first_response_minutes:
            avgResponseTime.rows[0]?.avg_first_response_minutes ?? null,
          ratings: ratingStats.rows[0] ?? {},
        },
        reports:  { by_status: reportStats.rows },
        disputes: { by_status: disputeStats.rows },
        appeals:  { by_status: appealStats.rows },
        top_agents: topAgents.rows,
        feedback: { by_type: feedbackSummary.rows },
      },
    });
  } catch (err) {
    console.error("[admin/support] analytics:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch analytics" });
  }
});

/* ════════════════════════════════════════════════════════════
   FEEDBACK (read + review)
════════════════════════════════════════════════════════════ */

// ── GET /api/admin/support/feedback ──────────────────────────
router.get("/feedback", async (req, res) => {
  const { feedback_type, is_reviewed, page, limit } = req.query;
  const { page: pg, limit: lm, offset } = paginate(page, limit);

  const conditions = [];
  const params     = [];
  let   p          = 1;

  if (feedback_type) {
    conditions.push(`f.feedback_type = $${p++}`);
    params.push(feedback_type);
  }
  if (is_reviewed !== undefined) {
    conditions.push(`f.is_reviewed = $${p++}`);
    params.push(is_reviewed === "true");
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const { rows: feedback } = await pool.query(
      `SELECT
         f.*,
         u.name  AS user_name,
         u.email AS user_email
       FROM public.support_feedback f
       LEFT JOIN public.users u ON u.id = f.user_id
       ${where}
       ORDER BY f.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, lm, offset]
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM public.support_feedback f ${where}`,
      params
    );

    return res.json({
      success: true,
      feedback,
      pagination: {
        total: Number(count),
        page:  pg,
        limit: lm,
        pages: Math.ceil(Number(count) / lm),
      },
    });
  } catch (err) {
    console.error("[admin/support] getFeedback:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch feedback" });
  }
});

// ── PATCH /api/admin/support/feedback/:id/review ─────────────
router.patch("/feedback/:id/review", async (req, res) => {
  try {
    const { rows: [fb] } = await pool.query(
      `UPDATE public.support_feedback
       SET is_reviewed = true,
           reviewed_by = $1
       WHERE id = $2
       RETURNING *`,
      [req.admin.id, req.params.id]
    );

    if (!fb) {
      return res.status(404).json({ success: false, message: "Feedback not found" });
    }

    return res.json({ success: true, feedback: fb });
  } catch (err) {
    console.error("[admin/support] reviewFeedback:", err.message);
    return res.status(500).json({ success: false, message: "Failed to review feedback" });
  }
});

export default router;