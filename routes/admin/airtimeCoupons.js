// routes/admin/airtimeCoupons.js
// Base: /api/admin/airtime-coupons
// ════════════════════════════════════════════════════════════

import express from "express";
import crypto  from "crypto";
import { pool } from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const AIRTIME_STATUS = Object.freeze({
  AVAILABLE  : "available",
  REDEEMED   : "redeemed",
  PROCESSING : "processing",
  COMPLETED  : "completed",
  FAILED     : "failed",
});

const ADMIN_TRANSITIONS = Object.freeze({
  [AIRTIME_STATUS.REDEEMED]   : [AIRTIME_STATUS.PROCESSING, AIRTIME_STATUS.FAILED],
  [AIRTIME_STATUS.PROCESSING] : [AIRTIME_STATUS.COMPLETED,  AIRTIME_STATUS.FAILED],
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const maskPhone = (phone) => {
  if (!phone) return null;
  const local = phone.replace("+234", "0");
  return local.slice(0, 4) + "****" + local.slice(-3);
};

const nairaFmt = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/airtime-coupons
   List all redemption requests with filters + pagination
   Query: ?status=redeemed&page=1&limit=20&search=
═══════════════════════════════════════════════════════════════ */
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const status  = req.query.status  || "all";
    const search  = req.query.search?.trim() || "";
    const page    = Math.max(1,   parseInt(req.query.page)   || 1);
    const limit   = Math.min(100, parseInt(req.query.limit)  || 20);
    const offset  = (page - 1) * limit;

    /* ── Validate status ── */
    const validStatuses = [...Object.values(AIRTIME_STATUS), "all"];
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
      conditions.push(`a.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(
        `(a.code ILIKE $${idx} OR u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR a.phone ILIKE $${idx})`
      );
    }

    const whereClause = conditions.length
      ? "WHERE " + conditions.join(" AND ")
      : "";

    /* ── Main query ── */
    const { rows } = await pool.query(
      `SELECT
         a.id,
         a.code,
         a.amount,
         a.status,
         a.phone,
         a.network,
         a.redeemed_at,
         a.processed_at,
         a.admin_note,
         a.created_at,
         u.id    AS user_id,
         u.name  AS user_name,
         u.email AS user_email,
         p.name  AS processed_by_name
       FROM public.airtime_coupons a
       LEFT JOIN public.users  u ON u.id = a.redeemed_by
       LEFT JOIN public.admins p ON p.id = a.processed_by
       ${whereClause}
       ORDER BY
         CASE a.status
           WHEN 'redeemed'   THEN 0
           WHEN 'processing' THEN 1
           WHEN 'available'  THEN 2
           WHEN 'completed'  THEN 3
           ELSE 4
         END,
         a.redeemed_at DESC NULLS LAST
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    /* ── Count ── */
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.airtime_coupons a
       LEFT JOIN public.users u ON u.id = a.redeemed_by
       ${whereClause}`,
      params
    );

    /* ── Summary counts ── */
    const { rows: summaryRows } = await pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM public.airtime_coupons
       GROUP BY status`
    );

    const summary = Object.fromEntries(
      Object.values(AIRTIME_STATUS).map((s) => [s, 0])
    );
    summaryRows.forEach((r) => { summary[r.status] = r.count; });

    /* ── Total amount pending ── */
    const { rows: pendingAmtRows } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM public.airtime_coupons
       WHERE status IN ('redeemed', 'processing')`
    );

    return res.json({
      success        : true,
      total          : countRows[0].total,
      page,
      pages          : Math.ceil(countRows[0].total / limit),
      summary,
      pending_amount : Number(pendingAmtRows[0].total),
      requests       : rows.map((r) => ({
        id              : r.id,
        code            : r.code,
        amount          : Number(r.amount),
        amount_fmt      : nairaFmt(r.amount),
        status          : r.status,
        phone           : r.phone,            // full number for admin
        phone_masked    : maskPhone(r.phone),
        network         : r.network,
        redeemed_at     : r.redeemed_at,
        processed_at    : r.processed_at,
        admin_note      : r.admin_note,
        created_at      : r.created_at,
        processed_by    : r.processed_by_name || null,
        user: {
          id    : r.user_id,
          name  : r.user_name,
          email : r.user_email,
        },
      })),
    });

  } catch (err) {
    console.error("[admin/airtime] GET /:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/airtime-coupons/:id
   Single redemption detail
═══════════════════════════════════════════════════════════════ */
router.get("/:id", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         a.id,
         a.code,
         a.amount,
         a.status,
         a.phone,
         a.network,
         a.redeemed_at,
         a.processed_at,
         a.admin_note,
         a.created_at,
         u.id         AS user_id,
         u.name       AS user_name,
         u.email      AS user_email,
         p.name       AS processed_by_name,
         p.email      AS processed_by_email
       FROM public.airtime_coupons a
       LEFT JOIN public.users  u ON u.id = a.redeemed_by
       LEFT JOIN public.admins p ON p.id = a.processed_by
       WHERE a.id = $1
       LIMIT 1`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }

    const r = rows[0];

    return res.json({
      success: true,
      request: {
        id           : r.id,
        code         : r.code,
        amount       : Number(r.amount),
        amount_fmt   : nairaFmt(r.amount),
        status       : r.status,
        phone        : r.phone,
        phone_masked : maskPhone(r.phone),
        network      : r.network,
        redeemed_at  : r.redeemed_at,
        processed_at : r.processed_at,
        admin_note   : r.admin_note,
        created_at   : r.created_at,
        processed_by : r.processed_by_name
          ? { name: r.processed_by_name, email: r.processed_by_email }
          : null,
        user: {
          id    : r.user_id,
          name  : r.user_name,
          email : r.user_email,
        },
        allowed_transitions: ADMIN_TRANSITIONS[r.status] || [],
      },
    });

  } catch (err) {
    console.error("[admin/airtime] GET /:id:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/:id/processing
   Move redeemed → processing
═══════════════════════════════════════════════════════════════ */
router.post("/:id/processing", verifyAdmin, async (req, res) => {
  await updateStatus({ req, res, targetStatus: AIRTIME_STATUS.PROCESSING });
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/:id/completed
   Move processing → completed
═══════════════════════════════════════════════════════════════ */
router.post("/:id/completed", verifyAdmin, async (req, res) => {
  await updateStatus({ req, res, targetStatus: AIRTIME_STATUS.COMPLETED });
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/:id/failed
   Mark as failed — note is required
   Body: { note }
═══════════════════════════════════════════════════════════════ */
router.post("/:id/failed", verifyAdmin, async (req, res) => {
  if (!req.body.note?.trim()) {
    return res.status(400).json({
      success: false,
      message: "A note explaining the failure is required.",
    });
  }
  await updateStatus({ req, res, targetStatus: AIRTIME_STATUS.FAILED });
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/assign
   Assign a new airtime coupon to a user
   Body: { user_id, amount, code? }
═══════════════════════════════════════════════════════════════ */
router.post("/assign", verifyAdmin, async (req, res) => {
  const { user_id, amount, code } = req.body;

  if (!user_id || !amount) {
    return res.status(400).json({
      success: false,
      message: "user_id and amount are required.",
    });
  }

  if (Number(amount) <= 0) {
    return res.status(400).json({
      success: false,
      message: "Amount must be greater than 0.",
    });
  }

  const couponCode = code?.trim().toUpperCase() ||
    `AIR${Math.round(amount)}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  try {
    /* ── User exists? ── */
    const { rows: userRows } = await pool.query(
      `SELECT id, name, email FROM public.users WHERE id = $1 LIMIT 1`,
      [user_id]
    );

    if (!userRows.length) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    /* ── Insert coupon ── */
    const { rows } = await pool.query(
      `INSERT INTO public.airtime_coupons
         (code, amount, user_id, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO NOTHING
       RETURNING id, code, amount, status, created_at`,
      [couponCode, Number(amount), user_id, AIRTIME_STATUS.AVAILABLE]
    );

    if (!rows.length) {
      return res.status(409).json({
        success: false,
        message: `Code "${couponCode}" already exists. Try a different code.`,
      });
    }

    return res.status(201).json({
      success : true,
      message : `${nairaFmt(amount)} airtime coupon assigned to ${userRows[0].name}.`,
      coupon  : {
        ...rows[0],
        amount     : Number(rows[0].amount),
        amount_fmt : nairaFmt(rows[0].amount),
        user: {
          id    : userRows[0].id,
          name  : userRows[0].name,
          email : userRows[0].email,
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
   Body: { assignments: [{ user_id, amount }] }
═══════════════════════════════════════════════════════════════ */
router.post("/bulk-assign", verifyAdmin, async (req, res) => {
  const { assignments } = req.body;

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
        [couponCode, Number(amount), user_id, AIRTIME_STATUS.AVAILABLE]
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
   GET /api/admin/airtime-coupons/stats/summary
   Overall airtime stats for the admin dashboard
═══════════════════════════════════════════════════════════════ */
router.get("/stats/summary", verifyAdmin, async (req, res) => {
  try {
    const [statusRows, totalRows, todayRows, networkRows] = await Promise.all([

      /* Count by status */
      pool.query(
        `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::numeric AS total_amount
         FROM public.airtime_coupons
         GROUP BY status`
      ),

      /* Total amount sent (completed only) */
      pool.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS total
         FROM public.airtime_coupons
         WHERE status = $1`,
        [AIRTIME_STATUS.COMPLETED]
      ),

      /* Today's redemptions */
      pool.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::numeric AS total
         FROM public.airtime_coupons
         WHERE redeemed_at >= CURRENT_DATE`
      ),

      /* Breakdown by network */
      pool.query(
        `SELECT network, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::numeric AS total
         FROM public.airtime_coupons
         WHERE status = $1
           AND network IS NOT NULL
         GROUP BY network
         ORDER BY total DESC`,
        [AIRTIME_STATUS.COMPLETED]
      ),
    ]);

    const byStatus = Object.fromEntries(
      Object.values(AIRTIME_STATUS).map((s) => [s, { count: 0, total: 0 }])
    );
    statusRows.rows.forEach((r) => {
      byStatus[r.status] = {
        count : r.count,
        total : Number(r.total_amount),
      };
    });

    return res.json({
      success      : true,
      by_status    : byStatus,
      total_sent   : Number(totalRows.rows[0].total),
      today        : {
        count : todayRows.rows[0].count,
        total : Number(todayRows.rows[0].total),
      },
      by_network   : networkRows.rows.map((r) => ({
        network : r.network,
        count   : r.count,
        total   : Number(r.total),
      })),
    });

  } catch (err) {
    console.error("[admin/airtime] GET /stats/summary:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   SHARED STATUS UPDATE HELPER
   Used by /processing, /completed, /failed
═══════════════════════════════════════════════════════════════ */
async function updateStatus({ req, res, targetStatus }) {
  const { id }   = req.params;
  const { note } = req.body;
  const adminId  = req.admin.id;   // admin JWT — req.admin not req.user

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── Lock row ── */
    const { rows } = await client.query(
      `SELECT id, status, code, amount
       FROM public.airtime_coupons
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }

    const current = rows[0];
    const allowed = ADMIN_TRANSITIONS[current.status];

    /* ── Validate transition ── */
    if (!allowed) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Status "${current.status}" cannot be updated further.`,
      });
    }

    if (!allowed.includes(targetStatus)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot move from "${current.status}" to "${targetStatus}". Allowed: ${allowed.join(", ")}.`,
      });
    }

    /* ── Apply update ── */
    const { rows: updated } = await client.query(
      `UPDATE public.airtime_coupons
       SET
         status       = $1,
         processed_by = $2,
         processed_at = NOW(),
         admin_note   = COALESCE($3, admin_note)
       WHERE id     = $4
         AND status = $5
       RETURNING id, code, amount, status, processed_at, admin_note`,
      [targetStatus, adminId, note?.trim() || null, id, current.status]
    );

    if (!updated.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Coupon status was changed by another request. Please refresh.",
      });
    }

    await client.query("COMMIT");

    const result = updated[0];

    return res.json({
      success: true,
      message: `Coupon ${result.code} marked as ${targetStatus}.`,
      coupon: {
        id          : result.id,
        code        : result.code,
        amount      : Number(result.amount),
        amount_fmt  : nairaFmt(result.amount),
        status      : result.status,
        processed_at: result.processed_at,
        admin_note  : result.admin_note,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[admin/airtime] status → ${targetStatus}:`, err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  } finally {
    client.release();
  }
}

export default router;