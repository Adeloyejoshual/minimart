// routes/admin/airtimeCoupons.js
// Base: /api/admin/airtime-coupons
// ════════════════════════════════════════════════════════════
// Admin operations for airtime coupons AND claims
// Uses actual schema:
//   airtime_coupons  → issued coupons users can redeem
//   airtime_claims   → user redemption records (what admins process)
// ════════════════════════════════════════════════════════════

import express from "express";
import crypto  from "crypto";
import { pool } from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

import {
  sendAirtimeClaimApprovedEmail,
  sendAirtimeClaimCompletedEmail,
  sendAirtimeClaimRejectedEmail,
} from "../../services/airtimenotifications.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const CLAIM_STATUS = Object.freeze({
  PENDING   : "pending",
  APPROVED  : "approved",
  SENT      : "sent",
  COMPLETED : "completed",
  REJECTED  : "rejected",
  FAILED    : "failed",
});

/* Which transitions are allowed from each state */
const CLAIM_TRANSITIONS = Object.freeze({
  [CLAIM_STATUS.PENDING]   : ["approved", "rejected"],
  [CLAIM_STATUS.APPROVED]  : ["sent", "failed", "rejected"],
  [CLAIM_STATUS.SENT]      : ["completed", "failed"],
  [CLAIM_STATUS.COMPLETED] : [],   // terminal
  [CLAIM_STATUS.REJECTED]  : [],   // terminal
  [CLAIM_STATUS.FAILED]    : ["approved"],   // can retry
});

const COUPON_STATUS = Object.freeze({
  AVAILABLE : "available",
  REDEEMED  : "redeemed",
  EXPIRED   : "expired",
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const maskPhone = (phone) => {
  if (!phone) return null;
  const d = String(phone).replace(/\D/g, "");
  const local = d.startsWith("234") ? "0" + d.slice(3) : d;
  return local.slice(0, 4) + "****" + local.slice(-3);
};

const nairaFmt = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

const safeEmail = (fn, args) => {
  try {
    fn(args).catch((e) => console.warn("[admin/airtime] email failed:", e.message));
  } catch (e) {
    console.warn("[admin/airtime] email threw:", e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/airtime-coupons
   List all CLAIMS (not coupons) with filters + pagination
   Query: ?status=pending&page=1&limit=20&search=&sort=oldest
═══════════════════════════════════════════════════════════════ */
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const status = req.query.status || "pending";
    const search = req.query.search?.trim() || "";
    const sort   = req.query.sort   || "oldest";   // "oldest" | "newest" | "highest" | "lowest"
    const page   = Math.max(1,   parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    /* ── Validate status ── */
    const validStatuses = [...Object.values(CLAIM_STATUS), "all"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}.`,
      });
    }

    /* ── Build WHERE ── */
    const conditions = [];
    const params     = [];

    if (status !== "all") {
      params.push(status);
      conditions.push(`ac.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(
        c.code    ILIKE $${idx} OR
        u.name    ILIKE $${idx} OR
        u.email   ILIKE $${idx} OR
        ac.phone  ILIKE $${idx}
      )`);
    }

    const whereClause = conditions.length
      ? "WHERE " + conditions.join(" AND ")
      : "";

    /* ── Sort ── */
    const sortMap = {
      oldest  : "ac.claimed_at ASC",
      newest  : "ac.claimed_at DESC",
      highest : "ac.amount DESC NULLS LAST",
      lowest  : "ac.amount ASC NULLS LAST",
    };
    const orderBy = sortMap[sort] || sortMap.oldest;

    /* ── Main query ── */
    const { rows } = await pool.query(
      `SELECT
         ac.id,
         ac.status,
         ac.phone,
         ac.network,
         ac.amount,
         ac.claimed_at,
         ac.approved_at,
         ac.credited_at,
         ac.admin_note,
         ac.ip_address,
         ac.user_agent,
         ac.device_hash,
         c.id       AS coupon_id,
         c.code     AS coupon_code,
         c.amount   AS coupon_amount,
         u.id       AS user_id,
         u.name     AS user_name,
         u.email    AS user_email,
         p.name     AS processed_by_name,
         p.email    AS processed_by_email
       FROM public.airtime_claims ac
       JOIN public.airtime_coupons c ON c.id = ac.airtime_coupon_id
       JOIN public.users u           ON u.id = ac.user_id
       LEFT JOIN public.admins p     ON p.id = ac.credited_by
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    /* ── Total count for pagination ── */
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.airtime_claims ac
       JOIN public.airtime_coupons c ON c.id = ac.airtime_coupon_id
       JOIN public.users u           ON u.id = ac.user_id
       ${whereClause}`,
      params
    );

    /* ── Summary counts (all statuses) ── */
    const { rows: summaryRows } = await pool.query(
      `SELECT
         status,
         COUNT(*)::int AS count,
         COALESCE(SUM(amount), 0)::numeric AS total_amount
       FROM public.airtime_claims
       GROUP BY status`
    );

    const summary = Object.fromEntries(
      Object.values(CLAIM_STATUS).map((s) => [s, { count: 0, amount: 0 }])
    );
    summaryRows.forEach((r) => {
      summary[r.status] = { count: r.count, amount: Number(r.total_amount) };
    });

    /* ── Total amount pending payout ── */
    const { rows: pendingAmtRows } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM public.airtime_claims
       WHERE status IN ('pending', 'approved', 'sent')`
    );

    return res.json({
      success        : true,
      total          : countRows[0].total,
      page,
      pages          : Math.ceil(countRows[0].total / limit),
      summary,
      pending_amount : Number(pendingAmtRows[0].total),
      claims         : rows.map((r) => ({
        id            : r.id,
        coupon_id     : r.coupon_id,
        coupon_code   : r.coupon_code,
        amount        : Number(r.amount || r.coupon_amount || 0),
        amount_fmt    : nairaFmt(r.amount || r.coupon_amount || 0),
        status        : r.status,
        phone         : r.phone,                  // full number for admin
        phone_masked  : maskPhone(r.phone),
        network       : r.network,
        claimed_at    : r.claimed_at,
        approved_at   : r.approved_at,
        credited_at   : r.credited_at,
        admin_note    : r.admin_note,
        ip_address    : r.ip_address,
        device_hash   : r.device_hash,
        processed_by  : r.processed_by_name
          ? { name: r.processed_by_name, email: r.processed_by_email }
          : null,
        user: {
          id    : r.user_id,
          name  : r.user_name,
          email : r.user_email,
        },
        allowed_transitions: CLAIM_TRANSITIONS[r.status] || [],
      })),
    });

  } catch (err) {
    console.error("[admin/airtime] GET /:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/airtime-coupons/stats/summary
   Overall stats for admin dashboard
═══════════════════════════════════════════════════════════════ */
router.get("/stats/summary", verifyAdmin, async (_req, res) => {
  try {
    const [statusRows, totalRows, todayRows, networkRows, topPhones] = await Promise.all([

      /* Count by claim status */
      pool.query(
        `SELECT status, COUNT(*)::int AS count,
                COALESCE(SUM(amount), 0)::numeric AS total_amount
         FROM public.airtime_claims
         GROUP BY status`
      ),

      /* Total sent (completed only) */
      pool.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS total
         FROM public.airtime_claims
         WHERE status = $1`,
        [CLAIM_STATUS.COMPLETED]
      ),

      /* Today's activity */
      pool.query(
        `SELECT
           COUNT(*)                            ::int      AS claim_count,
           COALESCE(SUM(amount), 0)            ::numeric  AS claim_total,
           COUNT(*) FILTER (WHERE status = 'completed')::int      AS completed_count,
           COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::numeric AS completed_total
         FROM public.airtime_claims
         WHERE claimed_at >= CURRENT_DATE`
      ),

      /* Breakdown by network */
      pool.query(
        `SELECT network, COUNT(*)::int AS count,
                COALESCE(SUM(amount), 0)::numeric AS total
         FROM public.airtime_claims
         WHERE status = $1
           AND network IS NOT NULL
         GROUP BY network
         ORDER BY total DESC`,
        [CLAIM_STATUS.COMPLETED]
      ),

      /* Top shared phone numbers (flagged for review) */
      pool.query(
        `SELECT airtime_phone AS phone,
                COUNT(*)::int AS user_count
         FROM   public.users
         WHERE  airtime_phone IS NOT NULL
         GROUP  BY airtime_phone
         HAVING COUNT(*) > 1
         ORDER  BY user_count DESC
         LIMIT 10`
      ),
    ]);

    const byStatus = Object.fromEntries(
      Object.values(CLAIM_STATUS).map((s) => [s, { count: 0, total: 0 }])
    );
    statusRows.rows.forEach((r) => {
      byStatus[r.status] = {
        count : r.count,
        total : Number(r.total_amount),
      };
    });

    return res.json({
      success       : true,
      by_status     : byStatus,
      total_sent    : Number(totalRows.rows[0].total),
      today         : {
        claims          : todayRows.rows[0].claim_count,
        claims_amount   : Number(todayRows.rows[0].claim_total),
        completed       : todayRows.rows[0].completed_count,
        completed_amount: Number(todayRows.rows[0].completed_total),
      },
      by_network    : networkRows.rows.map((r) => ({
        network : r.network,
        count   : r.count,
        total   : Number(r.total),
      })),
      shared_phones : topPhones.rows.map((r) => ({
        phone      : maskPhone(r.phone),
        user_count : r.user_count,
      })),
    });

  } catch (err) {
    console.error("[admin/airtime] GET /stats/summary:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/airtime-coupons/:id
   Single claim detail
═══════════════════════════════════════════════════════════════ */
router.get("/:id", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         ac.*,
         c.code     AS coupon_code,
         c.amount   AS coupon_amount,
         u.id       AS user_id,
         u.name     AS user_name,
         u.email    AS user_email,
         u.airtime_phone       AS user_airtime_phone,
         u.airtime_network     AS user_airtime_network,
         u.fraud_score         AS user_fraud_score,
         u.fraud_status        AS user_fraud_status,
         u.email_verified      AS user_email_verified,
         u.giveaways_suspended AS user_suspended,
         p.name     AS processed_by_name,
         p.email    AS processed_by_email
       FROM public.airtime_claims ac
       JOIN public.airtime_coupons c ON c.id = ac.airtime_coupon_id
       JOIN public.users u           ON u.id = ac.user_id
       LEFT JOIN public.admins p     ON p.id = ac.credited_by
       WHERE ac.id = $1
       LIMIT 1`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Claim not found." });
    }

    const r = rows[0];

    /* Also fetch user's other claims (context for admin) */
    const { rows: otherClaims } = await pool.query(
      `SELECT id, status, amount, claimed_at
       FROM   public.airtime_claims
       WHERE  user_id = $1 AND id != $2
       ORDER  BY claimed_at DESC
       LIMIT 5`,
      [r.user_id, r.id]
    );

    /* User's phone history */
    const { rows: phoneHistory } = await pool.query(
      `SELECT old_phone, new_phone, reason, created_at
       FROM   public.airtime_phone_history
       WHERE  user_id = $1
       ORDER  BY created_at DESC
       LIMIT 5`,
      [r.user_id]
    ).catch(() => ({ rows: [] }));

    /* Recent fraud events for user */
    const { rows: fraudEvents } = await pool.query(
      `SELECT event, metadata, created_at
       FROM   public.airtime_fraud_log
       WHERE  user_id = $1
       ORDER  BY created_at DESC
       LIMIT 5`,
      [r.user_id]
    ).catch(() => ({ rows: [] }));

    return res.json({
      success: true,
      claim: {
        id           : r.id,
        coupon_id    : r.airtime_coupon_id,
        coupon_code  : r.coupon_code,
        amount       : Number(r.amount || r.coupon_amount || 0),
        amount_fmt   : nairaFmt(r.amount || r.coupon_amount || 0),
        status       : r.status,
        phone        : r.phone,
        phone_masked : maskPhone(r.phone),
        network      : r.network,
        claimed_at   : r.claimed_at,
        approved_at  : r.approved_at,
        credited_at  : r.credited_at,
        admin_note   : r.admin_note,
        ip_address   : r.ip_address,
        user_agent   : r.user_agent,
        device_hash  : r.device_hash,
        processed_by : r.processed_by_name
          ? { name: r.processed_by_name, email: r.processed_by_email }
          : null,
        user: {
          id             : r.user_id,
          name           : r.user_name,
          email          : r.user_email,
          email_verified : r.user_email_verified,
          suspended      : r.user_suspended,
          fraud_score    : r.user_fraud_score,
          fraud_status   : r.user_fraud_status,
          airtime_phone  : r.user_airtime_phone,
          airtime_network: r.user_airtime_network,
        },
        allowed_transitions: CLAIM_TRANSITIONS[r.status] || [],
        recent_claims      : otherClaims.map((c) => ({
          id         : c.id,
          status     : c.status,
          amount     : Number(c.amount || 0),
          amount_fmt : nairaFmt(c.amount || 0),
          claimed_at : c.claimed_at,
        })),
        phone_history : phoneHistory.map((h) => ({
          old_phone  : maskPhone(h.old_phone),
          new_phone  : maskPhone(h.new_phone),
          reason     : h.reason,
          created_at : h.created_at,
        })),
        fraud_events  : fraudEvents,
      },
    });

  } catch (err) {
    console.error("[admin/airtime] GET /:id:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/:id/approve
   pending → approved
═══════════════════════════════════════════════════════════════ */
router.post("/:id/approve", verifyAdmin, async (req, res) => {
  await updateClaimStatus({ req, res, targetStatus: CLAIM_STATUS.APPROVED });
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/:id/send
   approved → sent (airtime dispatched)
═══════════════════════════════════════════════════════════════ */
router.post("/:id/send", verifyAdmin, async (req, res) => {
  await updateClaimStatus({ req, res, targetStatus: CLAIM_STATUS.SENT });
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/:id/complete
   sent → completed (delivery confirmed)
═══════════════════════════════════════════════════════════════ */
router.post("/:id/complete", verifyAdmin, async (req, res) => {
  await updateClaimStatus({ req, res, targetStatus: CLAIM_STATUS.COMPLETED });
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/:id/reject
   any → rejected (with mandatory reason)
   Body: { note }
═══════════════════════════════════════════════════════════════ */
router.post("/:id/reject", verifyAdmin, async (req, res) => {
  if (!req.body.note?.trim()) {
    return res.status(400).json({
      success: false,
      message: "A rejection reason (note) is required.",
    });
  }
  await updateClaimStatus({
    req, res, targetStatus: CLAIM_STATUS.REJECTED,
    releaseCoupon: true,
  });
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/:id/fail
   any → failed (with mandatory reason)
   Body: { note }
═══════════════════════════════════════════════════════════════ */
router.post("/:id/fail", verifyAdmin, async (req, res) => {
  if (!req.body.note?.trim()) {
    return res.status(400).json({
      success: false,
      message: "A failure reason (note) is required.",
    });
  }
  await updateClaimStatus({ req, res, targetStatus: CLAIM_STATUS.FAILED });
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/bulk-action
   Batch approve, reject, complete
   Body: { ids: [], action: "approve" | "reject" | "complete", note? }
═══════════════════════════════════════════════════════════════ */
router.post("/bulk-action", verifyAdmin, async (req, res) => {
  const { ids, action, note } = req.body;
  const adminId = req.admin.id;

  const validActions = ["approve", "send", "complete", "reject", "fail"];
  if (!validActions.includes(action)) {
    return res.status(400).json({
      success: false,
      message: `Invalid action. Must be one of: ${validActions.join(", ")}.`,
    });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: "ids must be a non-empty array.",
    });
  }

  if (ids.length > 50) {
    return res.status(400).json({
      success: false,
      message: "Maximum 50 items per bulk action.",
    });
  }

  if ((action === "reject" || action === "fail") && !note?.trim()) {
    return res.status(400).json({
      success: false,
      message: `A note is required for '${action}' action.`,
    });
  }

  const statusMap = {
    approve  : CLAIM_STATUS.APPROVED,
    send     : CLAIM_STATUS.SENT,
    complete : CLAIM_STATUS.COMPLETED,
    reject   : CLAIM_STATUS.REJECTED,
    fail     : CLAIM_STATUS.FAILED,
  };

  const targetStatus = statusMap[action];
  const results  = [];
  const failures = [];

  for (const id of ids) {
    try {
      const result = await performStatusUpdate({
        id,
        targetStatus,
        adminId,
        note,
        releaseCoupon: action === "reject",
      });

      if (result.success) {
        results.push({ id, status: targetStatus });
        /* Fire notification (async) */
        notifyUserOfStatusChange(result.claim, targetStatus, note);
      } else {
        failures.push({ id, reason: result.error });
      }
    } catch (e) {
      failures.push({ id, reason: e.message });
    }
  }

  return res.status(207).json({
    success   : failures.length === 0,
    processed : results.length,
    failed    : failures.length,
    results,
    failures,
  });
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/assign
   Issue a new airtime coupon to a user
   Body: { user_id, amount, code?, expires_in_days? }
═══════════════════════════════════════════════════════════════ */
router.post("/assign", verifyAdmin, async (req, res) => {
  const { user_id, amount, code, expires_in_days = 30 } = req.body;

  if (!user_id || !amount) {
    return res.status(400).json({
      success: false,
      message: "user_id and amount are required.",
    });
  }

  if (Number(amount) <= 0 || Number(amount) > 10000) {
    return res.status(400).json({
      success: false,
      message: "Amount must be between ₦1 and ₦10,000.",
    });
  }

  const couponCode =
    code?.trim().toUpperCase() ||
    `AIR${Math.round(amount)}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  try {
    /* Validate user */
    const { rows: userRows } = await pool.query(
      `SELECT id, name, email, email_verified
       FROM public.users
       WHERE id = $1
       LIMIT 1`,
      [user_id]
    );

    if (!userRows.length) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const user = userRows[0];

    /* Insert coupon */
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(expires_in_days));

    const { rows } = await pool.query(
      `INSERT INTO public.airtime_coupons
         (code, amount, user_id, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO NOTHING
       RETURNING id, code, amount, status, created_at`,
      [couponCode, Number(amount), user_id, COUPON_STATUS.AVAILABLE]
    );

    if (!rows.length) {
      return res.status(409).json({
        success: false,
        message: `Code "${couponCode}" already exists. Try a different code.`,
      });
    }

    console.log(
      `[admin/airtime] ✓ assigned ${nairaFmt(amount)} to user=${user_id} ` +
      `code=${couponCode} by admin=${req.admin.id}`
    );

    return res.status(201).json({
      success : true,
      message : `${nairaFmt(amount)} airtime coupon assigned to ${user.name}.`,
      coupon  : {
        ...rows[0],
        amount     : Number(rows[0].amount),
        amount_fmt : nairaFmt(rows[0].amount),
        user: {
          id             : user.id,
          name           : user.name,
          email          : user.email,
          email_verified : user.email_verified,
        },
      },
    });

  } catch (err) {
    console.error("[admin/airtime] POST /assign:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/bulk-assign
   Assign airtime coupons to multiple users at once
   Body: { assignments: [{ user_id, amount }], expires_in_days? }
═══════════════════════════════════════════════════════════════ */
router.post("/bulk-assign", verifyAdmin, async (req, res) => {
  const { assignments, expires_in_days = 30 } = req.body;

  if (!Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({
      success: false,
      message: "assignments must be a non-empty array.",
    });
  }

  if (assignments.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Maximum 100 assignments per request.",
    });
  }

  const results  = [];
  const failures = [];

  for (const item of assignments) {
    const { user_id, amount } = item;

    if (!user_id || !amount || Number(amount) <= 0) {
      failures.push({ user_id, reason: "Invalid user_id or amount." });
      continue;
    }

    const couponCode =
      `AIR${Math.round(amount)}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    try {
      const { rows: userRows } = await pool.query(
        `SELECT id, name FROM public.users WHERE id = $1 LIMIT 1`,
        [user_id]
      );

      if (!userRows.length) {
        failures.push({ user_id, reason: "User not found." });
        continue;
      }

      const { rows } = await pool.query(
        `INSERT INTO public.airtime_coupons
           (code, amount, user_id, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO NOTHING
         RETURNING id, code, amount, status`,
        [couponCode, Number(amount), user_id, COUPON_STATUS.AVAILABLE]
      );

      if (!rows.length) {
        failures.push({ user_id, reason: "Code collision — try again." });
      } else {
        results.push({
          user_id,
          user_name  : userRows[0].name,
          code       : rows[0].code,
          amount     : Number(rows[0].amount),
          amount_fmt : nairaFmt(rows[0].amount),
        });
      }
    } catch (e) {
      failures.push({ user_id, reason: e.message });
    }
  }

  return res.status(207).json({
    success  : failures.length === 0,
    assigned : results.length,
    failed   : failures.length,
    results,
    failures,
  });
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/airtime-coupons/user/:userId/claims
   All claims for a specific user (fraud investigation)
═══════════════════════════════════════════════════════════════ */
router.get("/user/:userId/claims", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         ac.id, ac.status, ac.phone, ac.network, ac.amount,
         ac.claimed_at, ac.approved_at, ac.credited_at,
         ac.admin_note, ac.ip_address,
         c.code AS coupon_code
       FROM public.airtime_claims ac
       JOIN public.airtime_coupons c ON c.id = ac.airtime_coupon_id
       WHERE ac.user_id = $1
       ORDER BY ac.claimed_at DESC`,
      [req.params.userId]
    );

    return res.json({
      success: true,
      total  : rows.length,
      claims : rows.map((r) => ({
        ...r,
        amount     : Number(r.amount || 0),
        amount_fmt : nairaFmt(r.amount || 0),
      })),
    });

  } catch (err) {
    console.error("[admin/airtime] GET /user/:userId/claims:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/airtime-coupons/search-by-ip/:ip
   All claims from an IP (fraud investigation)
═══════════════════════════════════════════════════════════════ */
router.get("/search-by-ip/:ip", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         ac.id, ac.status, ac.phone, ac.network, ac.amount,
         ac.claimed_at, ac.ip_address, ac.user_agent,
         u.id AS user_id, u.name AS user_name, u.email AS user_email
       FROM public.airtime_claims ac
       JOIN public.users u ON u.id = ac.user_id
       WHERE ac.ip_address = $1
       ORDER BY ac.claimed_at DESC
       LIMIT 100`,
      [req.params.ip]
    );

    return res.json({
      success       : true,
      ip            : req.params.ip,
      total         : rows.length,
      unique_users  : new Set(rows.map((r) => r.user_id)).size,
      claims        : rows,
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/airtime-coupons/search-by-device/:hash
   All claims from a device (fraud investigation)
═══════════════════════════════════════════════════════════════ */
router.get("/search-by-device/:hash", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         ac.id, ac.status, ac.phone, ac.amount, ac.claimed_at,
         u.id AS user_id, u.name AS user_name, u.email AS user_email
       FROM public.airtime_claims ac
       JOIN public.users u ON u.id = ac.user_id
       WHERE ac.device_hash = $1
       ORDER BY ac.claimed_at DESC
       LIMIT 100`,
      [req.params.hash]
    );

    return res.json({
      success      : true,
      device_hash  : req.params.hash,
      total        : rows.length,
      unique_users : new Set(rows.map((r) => r.user_id)).size,
      claims       : rows,
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   INTERNAL — updateClaimStatus (used by single-claim actions)
═══════════════════════════════════════════════════════════════ */
async function updateClaimStatus({ req, res, targetStatus, releaseCoupon = false }) {
  const { id }    = req.params;
  const { note } = req.body;
  const adminId   = req.admin.id;

  try {
    const result = await performStatusUpdate({
      id, targetStatus, adminId, note, releaseCoupon,
    });

    if (!result.success) {
      const statusCode = result.notFound ? 404
                       : result.invalidTransition ? 409
                       : 500;
      return res.status(statusCode).json({
        success: false,
        message: result.error,
      });
    }

    /* Notify user (async, non-blocking) */
    notifyUserOfStatusChange(result.claim, targetStatus, note);

    return res.json({
      success: true,
      message: `Claim marked as ${targetStatus}.`,
      claim  : {
        id          : result.claim.id,
        status      : result.claim.status,
        amount      : Number(result.claim.amount || 0),
        amount_fmt  : nairaFmt(result.claim.amount || 0),
        credited_at : result.claim.credited_at,
        approved_at : result.claim.approved_at,
        admin_note  : result.claim.admin_note,
      },
    });

  } catch (err) {
    console.error(`[admin/airtime] status → ${targetStatus}:`, err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
}

/* ═══════════════════════════════════════════════════════════════
   INTERNAL — performStatusUpdate (reusable transaction logic)
═══════════════════════════════════════════════════════════════ */
async function performStatusUpdate({
  id, targetStatus, adminId, note = null, releaseCoupon = false,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* Lock the claim */
    const { rows } = await client.query(
      `SELECT ac.id, ac.status, ac.airtime_coupon_id, ac.user_id,
              ac.amount, ac.phone, ac.network,
              c.code AS coupon_code,
              u.name AS user_name, u.email AS user_email
       FROM public.airtime_claims ac
       JOIN public.airtime_coupons c ON c.id = ac.airtime_coupon_id
       JOIN public.users u           ON u.id = ac.user_id
       WHERE ac.id = $1
       LIMIT 1
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return { success: false, notFound: true, error: "Claim not found." };
    }

    const claim   = rows[0];
    const allowed = CLAIM_TRANSITIONS[claim.status] || [];

    /* Validate transition */
    if (!allowed.includes(targetStatus)) {
      await client.query("ROLLBACK");
      return {
        success            : false,
        invalidTransition  : true,
        error              : `Cannot move from "${claim.status}" to "${targetStatus}". Allowed: ${allowed.join(", ") || "none"}.`,
      };
    }

    /* Build SET clause based on target status */
    const setFields = [
      "status       = $1",
      "credited_by  = $2",
      "admin_note   = COALESCE($3, admin_note)",
    ];

    /* approved_at set only when going TO approved */
    if (targetStatus === CLAIM_STATUS.APPROVED) {
      setFields.push("approved_at = NOW()");
    }

    /* credited_at set on any terminal-ish state */
    if (["sent", "completed", "rejected", "failed"].includes(targetStatus)) {
      setFields.push("credited_at = NOW()");
    }

    /* Apply update */
    const { rows: updated } = await client.query(
      `UPDATE public.airtime_claims
       SET ${setFields.join(", ")}
       WHERE id     = $4
         AND status = $5
       RETURNING id, status, amount, credited_at, approved_at, admin_note`,
      [targetStatus, adminId, note?.trim() || null, id, claim.status]
    );

    if (!updated.length) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error  : "Claim was modified by another request. Please refresh.",
      };
    }

    /* If rejected → release the coupon back to "available" */
    if (releaseCoupon && targetStatus === CLAIM_STATUS.REJECTED) {
      await client.query(
        `UPDATE public.airtime_coupons
         SET    status = 'available',
                redeemed_at = NULL,
                phone = NULL,
                network = NULL
         WHERE  id = $1`,
        [claim.airtime_coupon_id]
      );
    }

    await client.query("COMMIT");

    /* Return combined claim + user info for notifications */
    return {
      success: true,
      claim  : {
        ...updated[0],
        coupon_code : claim.coupon_code,
        phone       : claim.phone,
        network     : claim.network,
        user_id     : claim.user_id,
        user_name   : claim.user_name,
        user_email  : claim.user_email,
      },
    };

  } catch (err) {
    await client.query("ROLLBACK");
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

/* ═══════════════════════════════════════════════════════════════
   INTERNAL — notifyUserOfStatusChange (async, non-blocking)
═══════════════════════════════════════════════════════════════ */
function notifyUserOfStatusChange(claim, newStatus, adminNote = null) {
  if (!claim.user_email) return;

  const payload = {
    to      : claim.user_email,
    name    : claim.user_name,
    amount  : Number(claim.amount || 0),
    phone   : maskPhone(claim.phone),
    network : claim.network,
  };

  if (newStatus === CLAIM_STATUS.APPROVED) {
    safeEmail(sendAirtimeClaimApprovedEmail, payload);
  } else if (newStatus === CLAIM_STATUS.SENT ||
             newStatus === CLAIM_STATUS.COMPLETED) {
    safeEmail(sendAirtimeClaimCompletedEmail, payload);
  } else if (newStatus === CLAIM_STATUS.REJECTED) {
    safeEmail(sendAirtimeClaimRejectedEmail, {
      ...payload,
      remarks: adminNote,
    });
  }
}

export default router;