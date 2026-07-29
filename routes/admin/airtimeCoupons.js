// routes/admin/airtimeCoupons.js
// ════════════════════════════════════════════════════════════
// Admin operations — complete with all GET + POST routes
// Cache invalidation + coupon status sync
// ════════════════════════════════════════════════════════════

import express from "express";
import crypto  from "crypto";
import { pool } from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";
import { invalidateUserCache } from "../coupons.js";

let notifications = {};
try {
  notifications = await import("../../services/airtimenotifications.js");
} catch (e) {
  console.warn("[admin/airtime] notifications not available:", e.message);
}

const {
  sendAirtimeClaimApprovedEmail,
  sendAirtimeClaimCompletedEmail,
  sendAirtimeClaimRejectedEmail,
} = notifications;

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

const ALL_STATUSES = Object.values(CLAIM_STATUS);

const LEGACY_STATUS_ALIASES = {
  redeemed  : CLAIM_STATUS.PENDING,
  claimed   : CLAIM_STATUS.PENDING,
  processing: CLAIM_STATUS.APPROVED,
  credited  : CLAIM_STATUS.COMPLETED,
};

const CLAIM_TRANSITIONS = Object.freeze({
  [CLAIM_STATUS.PENDING]   : ["approved", "rejected"],
  [CLAIM_STATUS.APPROVED]  : ["sent", "failed", "rejected"],
  [CLAIM_STATUS.SENT]      : ["completed", "failed"],
  [CLAIM_STATUS.COMPLETED] : [],
  [CLAIM_STATUS.REJECTED]  : [],
  [CLAIM_STATUS.FAILED]    : ["approved"],
});

const COUPON_STATUS = Object.freeze({
  AVAILABLE : "available",
  REDEEMED  : "redeemed",
  EXPIRED   : "expired",
});

/* ═══════════════════════════════════════════════════════════════
   SCHEMA INTROSPECTION
═══════════════════════════════════════════════════════════════ */
const SCHEMA = {
  claims_has_amount      : false,
  claims_has_approved_at : false,
  claims_has_ip_address  : false,
  claims_has_user_agent  : false,
  claims_has_device_hash : false,
  history_table_exists   : false,
  ready                  : false,
};

async function detectSchema() {
  try {
    const { rows: claimCols } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'airtime_claims'`
    );
    const s = new Set(claimCols.map((r) => r.column_name));
    SCHEMA.claims_has_amount      = s.has("amount");
    SCHEMA.claims_has_approved_at = s.has("approved_at");
    SCHEMA.claims_has_ip_address  = s.has("ip_address");
    SCHEMA.claims_has_user_agent  = s.has("user_agent");
    SCHEMA.claims_has_device_hash = s.has("device_hash");

    const { rows: h } = await pool.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'airtime_phone_history'`
    );
    SCHEMA.history_table_exists = h.length > 0;
    SCHEMA.ready = true;
    console.log("[admin/airtime] SCHEMA:", SCHEMA);
  } catch (err) {
    console.error("[admin/airtime] schema detection failed:", err.message);
  }
}

detectSchema();

const amountSelect = () =>
  SCHEMA.claims_has_amount ? "COALESCE(ac.amount, c.amount)" : "c.amount";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const maskPhone = (phone) => {
  if (!phone) return null;
  const d = String(phone).replace(/\D/g, "");
  const local = d.startsWith("234") ? "0" + d.slice(3) : d;
  return local.slice(0, 4) + "****" + local.slice(-3);
};

const nairaFmt = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const safeEmail = (fn, args) => {
  if (typeof fn !== "function") return;
  try {
    fn(args).catch((e) => console.warn("[admin/airtime] email failed:", e.message));
  } catch (e) {
    console.warn("[admin/airtime] email threw:", e.message);
  }
};

const normalizeStatus = (raw) => LEGACY_STATUS_ALIASES[raw] || raw;

const invalidateCache = (userId) => {
  if (!userId) return;
  try {
    invalidateUserCache(userId).catch((e) =>
      console.warn("[admin/airtime] cache fail:", e.message)
    );
  } catch (e) {
    console.warn("[admin/airtime] cache error:", e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   LEGACY MIGRATION
═══════════════════════════════════════════════════════════════ */
async function fixLegacyStatuses() {
  try {
    for (const [old, nw] of Object.entries(LEGACY_STATUS_ALIASES)) {
      const { rowCount } = await pool.query(
        `UPDATE public.airtime_claims SET status = $1 WHERE status = $2`,
        [nw, old]
      );
      if (rowCount > 0) console.log(`[admin/airtime] migrated ${rowCount} "${old}" → "${nw}"`);
    }
  } catch (err) {
    console.warn("[admin/airtime] legacy migration:", err.message);
  }
}
fixLegacyStatuses();

/* ═══════════════════════════════════════════════════════════════
   GET /debug
═══════════════════════════════════════════════════════════════ */
router.get("/debug", verifyAdmin, async (_req, res) => {
  try {
    const [statusRows, tableInfo, sample] = await Promise.all([
      pool.query(`SELECT status, COUNT(*)::int AS count FROM public.airtime_claims GROUP BY status`),
      pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='airtime_claims' ORDER BY ordinal_position`),
      pool.query(`SELECT id, status, phone, claimed_at FROM public.airtime_claims ORDER BY claimed_at DESC LIMIT 5`),
    ]);
    return res.json({
      success: true,
      schema: SCHEMA,
      total_claims: statusRows.rows.reduce((s, r) => s + r.count, 0),
      by_status: statusRows.rows,
      table_columns: tableInfo.rows,
      recent_claims: sample.rows,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET / — List claims with filters
═══════════════════════════════════════════════════════════════ */
router.get("/", verifyAdmin, async (req, res) => {
  try {
    if (!SCHEMA.ready) await detectSchema();

    const rawStatus = req.query.status || "pending";
    const status    = normalizeStatus(rawStatus);
    const search    = req.query.search?.trim() || "";
    const sort      = req.query.sort   || "oldest";
    const page      = Math.max(1,   parseInt(req.query.page)  || 1);
    const limit     = Math.min(100, parseInt(req.query.limit) || 20);
    const offset    = (page - 1) * limit;

    const validStatuses = [...ALL_STATUSES, "all"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status "${status}".` });
    }

    /* Build WHERE */
    const conditions = [];
    const params     = [];

    if (status !== "all") {
      const legacyFor = Object.entries(LEGACY_STATUS_ALIASES)
        .filter(([_, v]) => v === status).map(([k]) => k);
      const all = [status, ...legacyFor];
      const ph  = all.map((s) => { params.push(s); return `$${params.length}`; });
      conditions.push(`ac.status IN (${ph.join(",")})`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(c.code ILIKE $${idx} OR u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR ac.phone ILIKE $${idx})`);
    }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    const sortMap = {
      oldest : "ac.claimed_at ASC",
      newest : "ac.claimed_at DESC",
      highest: `${amountSelect()} DESC NULLS LAST`,
      lowest : `${amountSelect()} ASC NULLS LAST`,
    };
    const orderBy = sortMap[sort] || sortMap.oldest;

    /* Optional columns */
    const opt = [];
    if (SCHEMA.claims_has_approved_at) opt.push("ac.approved_at");
    if (SCHEMA.claims_has_ip_address)  opt.push("ac.ip_address");
    if (SCHEMA.claims_has_device_hash) opt.push("ac.device_hash");
    const optStr = opt.length ? ", " + opt.join(", ") : "";

    const { rows } = await pool.query(
      `SELECT ac.id, ac.status, ac.phone, ac.network,
              ${amountSelect()} AS amount,
              ac.claimed_at, ac.credited_at, ac.admin_note
              ${optStr},
              c.id AS coupon_id, c.code AS coupon_code, c.amount AS coupon_amount,
              u.id AS user_id, u.name AS user_name, u.email AS user_email
       FROM public.airtime_claims ac
       JOIN public.airtime_coupons c ON c.id = ac.airtime_coupon_id
       JOIN public.users u           ON u.id = ac.user_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const { rows: cnt } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.airtime_claims ac
       JOIN public.airtime_coupons c ON c.id = ac.airtime_coupon_id
       JOIN public.users u           ON u.id = ac.user_id
       ${where}`,
      params
    );

    /* Summary */
    const amtCol = SCHEMA.claims_has_amount
      ? "COALESCE(SUM(COALESCE(amount,0)),0)::numeric" : "0::numeric";

    const { rows: sumRows } = await pool.query(
      `SELECT status, COUNT(*)::int AS count, ${amtCol} AS total_amount
       FROM public.airtime_claims GROUP BY status`
    );

    const summary = {};
    ALL_STATUSES.forEach((s) => { summary[s] = { count: 0, amount: 0 }; });
    sumRows.forEach((r) => {
      const n = normalizeStatus(r.status);
      if (!summary[n]) summary[n] = { count: 0, amount: 0 };
      summary[n].count  += r.count;
      summary[n].amount += Number(r.total_amount || 0);
    });

    /* Pending amount */
    const pq = SCHEMA.claims_has_amount
      ? `SELECT COALESCE(SUM(COALESCE(amount,0)),0)::numeric AS total FROM public.airtime_claims WHERE status IN ('pending','approved','sent')`
      : `SELECT COALESCE(SUM(c.amount),0)::numeric AS total FROM public.airtime_claims ac JOIN public.airtime_coupons c ON c.id=ac.airtime_coupon_id WHERE ac.status IN ('pending','approved','sent')`;
    const { rows: pa } = await pool.query(pq);

    return res.json({
      success: true,
      total: cnt[0].total,
      page,
      pages: Math.max(1, Math.ceil(cnt[0].total / limit)),
      summary,
      pending_amount: Number(pa[0].total),
      claims: rows.map((r) => {
        const ns = normalizeStatus(r.status);
        return {
          id: r.id, coupon_id: r.coupon_id, coupon_code: r.coupon_code,
          amount: Number(r.amount || 0), amount_fmt: nairaFmt(r.amount || 0),
          status: ns, raw_status: r.status,
          phone: r.phone, phone_masked: maskPhone(r.phone),
          network: r.network,
          claimed_at: r.claimed_at, approved_at: r.approved_at || null,
          credited_at: r.credited_at, admin_note: r.admin_note,
          ip_address: r.ip_address || null, device_hash: r.device_hash || null,
          user: { id: r.user_id, name: r.user_name, email: r.user_email },
          allowed_transitions: CLAIM_TRANSITIONS[ns] || [],
        };
      }),
    });
  } catch (err) {
    console.error("[admin/airtime] GET /:", err.message);
    return res.status(500).json({ success: false, message: "Server error.", debug: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /stats/summary
═══════════════════════════════════════════════════════════════ */
router.get("/stats/summary", verifyAdmin, async (_req, res) => {
  try {
    if (!SCHEMA.ready) await detectSchema();
    const amtCol = SCHEMA.claims_has_amount ? "COALESCE(amount,0)" : "0";

    const [statusRows, totalRows, todayRows, networkRows, topPhones] = await Promise.all([
      pool.query(`SELECT status, COUNT(*)::int AS count, COALESCE(SUM(${amtCol}),0)::numeric AS total_amount FROM public.airtime_claims GROUP BY status`),
      SCHEMA.claims_has_amount
        ? pool.query(`SELECT COALESCE(SUM(COALESCE(amount,0)),0)::numeric AS total FROM public.airtime_claims WHERE status='completed'`)
        : pool.query(`SELECT COALESCE(SUM(c.amount),0)::numeric AS total FROM public.airtime_claims ac JOIN public.airtime_coupons c ON c.id=ac.airtime_coupon_id WHERE ac.status='completed'`),
      pool.query(`SELECT COUNT(*)::int AS claim_count, COALESCE(SUM(${amtCol}),0)::numeric AS claim_total, COUNT(*) FILTER (WHERE status='completed')::int AS completed_count, COALESCE(SUM(${amtCol}) FILTER (WHERE status='completed'),0)::numeric AS completed_total FROM public.airtime_claims WHERE claimed_at >= CURRENT_DATE`),
      pool.query(`SELECT network, COUNT(*)::int AS count, COALESCE(SUM(${amtCol}),0)::numeric AS total FROM public.airtime_claims WHERE status='completed' AND network IS NOT NULL GROUP BY network ORDER BY total DESC`),
      pool.query(`SELECT airtime_phone AS phone, COUNT(*)::int AS user_count FROM public.users WHERE airtime_phone IS NOT NULL GROUP BY airtime_phone HAVING COUNT(*)>1 ORDER BY user_count DESC LIMIT 10`).catch(() => ({ rows: [] })),
    ]);

    const byStatus = {};
    ALL_STATUSES.forEach((s) => { byStatus[s] = { count: 0, total: 0 }; });
    statusRows.rows.forEach((r) => {
      const n = normalizeStatus(r.status);
      if (!byStatus[n]) byStatus[n] = { count: 0, total: 0 };
      byStatus[n].count += r.count;
      byStatus[n].total += Number(r.total_amount || 0);
    });

    return res.json({
      success: true,
      by_status: byStatus,
      total_sent: Number(totalRows.rows[0].total),
      today: {
        claims: todayRows.rows[0].claim_count,
        claims_amount: Number(todayRows.rows[0].claim_total),
        completed: todayRows.rows[0].completed_count,
        completed_amount: Number(todayRows.rows[0].completed_total),
      },
      by_network: networkRows.rows.map((r) => ({ network: r.network, count: r.count, total: Number(r.total) })),
      shared_phones: topPhones.rows.map((r) => ({ phone: maskPhone(r.phone), user_count: r.user_count })),
    });
  } catch (err) {
    console.error("[admin/airtime] GET /stats/summary:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /:id — Single claim detail
═══════════════════════════════════════════════════════════════ */
router.get("/:id", verifyAdmin, async (req, res) => {
  try {
    if (!SCHEMA.ready) await detectSchema();

    const opt = [];
    if (SCHEMA.claims_has_approved_at) opt.push("ac.approved_at");
    if (SCHEMA.claims_has_ip_address)  opt.push("ac.ip_address");
    if (SCHEMA.claims_has_user_agent)  opt.push("ac.user_agent");
    if (SCHEMA.claims_has_device_hash) opt.push("ac.device_hash");
    const optStr = opt.length ? ", " + opt.join(", ") : "";

    const { rows } = await pool.query(
      `SELECT ac.id, ac.status, ac.phone, ac.network,
              ${amountSelect()} AS amount,
              ac.claimed_at, ac.credited_at, ac.admin_note, ac.airtime_coupon_id
              ${optStr},
              c.code AS coupon_code, c.amount AS coupon_amount,
              u.id AS user_id, u.name AS user_name, u.email AS user_email,
              u.airtime_phone AS user_airtime_phone,
              u.airtime_network AS user_airtime_network,
              u.email_verified AS user_email_verified
       FROM public.airtime_claims ac
       JOIN public.airtime_coupons c ON c.id = ac.airtime_coupon_id
       JOIN public.users u           ON u.id = ac.user_id
       WHERE ac.id = $1 LIMIT 1`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: "Claim not found." });

    const r  = rows[0];
    const ns = normalizeStatus(r.status);

    /* Other claims */
    const { rows: otherClaims } = await pool.query(
      `SELECT ac.id, ac.status, ${amountSelect()} AS amount, ac.claimed_at
       FROM public.airtime_claims ac
       JOIN public.airtime_coupons c ON c.id = ac.airtime_coupon_id
       WHERE ac.user_id = $1 AND ac.id != $2
       ORDER BY ac.claimed_at DESC LIMIT 5`,
      [r.user_id, r.id]
    );

    /* Phone history */
    const phoneHistory = SCHEMA.history_table_exists
      ? (await pool.query(
          `SELECT old_phone, new_phone, reason, created_at FROM public.airtime_phone_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5`,
          [r.user_id]
        ).catch(() => ({ rows: [] }))).rows
      : [];

    return res.json({
      success: true,
      claim: {
        id: r.id, coupon_id: r.airtime_coupon_id, coupon_code: r.coupon_code,
        amount: Number(r.amount || 0), amount_fmt: nairaFmt(r.amount || 0),
        status: ns, raw_status: r.status,
        phone: r.phone, phone_masked: maskPhone(r.phone), network: r.network,
        claimed_at: r.claimed_at, approved_at: r.approved_at || null,
        credited_at: r.credited_at, admin_note: r.admin_note,
        ip_address: r.ip_address || null, user_agent: r.user_agent || null,
        device_hash: r.device_hash || null,
        user: {
          id: r.user_id, name: r.user_name, email: r.user_email,
          email_verified: r.user_email_verified,
          airtime_phone: r.user_airtime_phone, airtime_network: r.user_airtime_network,
        },
        allowed_transitions: CLAIM_TRANSITIONS[ns] || [],
        recent_claims: otherClaims.map((c) => ({
          id: c.id, status: normalizeStatus(c.status),
          amount: Number(c.amount || 0), amount_fmt: nairaFmt(c.amount || 0),
          claimed_at: c.claimed_at,
        })),
        phone_history: phoneHistory.map((h) => ({
          old_phone: maskPhone(h.old_phone), new_phone: maskPhone(h.new_phone),
          reason: h.reason, created_at: h.created_at,
        })),
      },
    });
  } catch (err) {
    console.error("[admin/airtime] GET /:id:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /user/:userId/claims
═══════════════════════════════════════════════════════════════ */
router.get("/user/:userId/claims", verifyAdmin, async (req, res) => {
  try {
    if (!SCHEMA.ready) await detectSchema();
    const { rows } = await pool.query(
      `SELECT ac.id, ac.status, ac.phone, ac.network,
              ${amountSelect()} AS amount,
              ac.claimed_at, ac.credited_at, ac.admin_note,
              c.code AS coupon_code
       FROM public.airtime_claims ac
       JOIN public.airtime_coupons c ON c.id = ac.airtime_coupon_id
       WHERE ac.user_id = $1
       ORDER BY ac.claimed_at DESC`,
      [req.params.userId]
    );
    return res.json({
      success: true, total: rows.length,
      claims: rows.map((r) => ({
        ...r, status: normalizeStatus(r.status),
        amount: Number(r.amount || 0), amount_fmt: nairaFmt(r.amount || 0),
      })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   STATUS UPDATE ENDPOINTS
═══════════════════════════════════════════════════════════════ */
router.post("/:id/approve", verifyAdmin, async (req, res) => {
  await updateClaimStatus({ req, res, targetStatus: CLAIM_STATUS.APPROVED });
});

router.post("/:id/send", verifyAdmin, async (req, res) => {
  await updateClaimStatus({ req, res, targetStatus: CLAIM_STATUS.SENT });
});

router.post("/:id/complete", verifyAdmin, async (req, res) => {
  await updateClaimStatus({ req, res, targetStatus: CLAIM_STATUS.COMPLETED });
});

router.post("/:id/reject", verifyAdmin, async (req, res) => {
  if (!req.body.note?.trim()) {
    return res.status(400).json({ success: false, message: "A rejection reason is required." });
  }
  await updateClaimStatus({ req, res, targetStatus: CLAIM_STATUS.REJECTED, releaseCoupon: true });
});

router.post("/:id/fail", verifyAdmin, async (req, res) => {
  if (!req.body.note?.trim()) {
    return res.status(400).json({ success: false, message: "A failure reason is required." });
  }
  await updateClaimStatus({ req, res, targetStatus: CLAIM_STATUS.FAILED });
});

/* ═══════════════════════════════════════════════════════════════
   POST /bulk-action
═══════════════════════════════════════════════════════════════ */
router.post("/bulk-action", verifyAdmin, async (req, res) => {
  const { ids, action, note } = req.body;
  const adminId = req.admin.id;

  const validActions = ["approve", "send", "complete", "reject", "fail"];
  if (!validActions.includes(action)) {
    return res.status(400).json({ success: false, message: `Invalid action.` });
  }
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
    return res.status(400).json({ success: false, message: "ids must be 1-50 items." });
  }
  if ((action === "reject" || action === "fail") && !note?.trim()) {
    return res.status(400).json({ success: false, message: `Note required for ${action}.` });
  }

  const statusMap = {
    approve: CLAIM_STATUS.APPROVED, send: CLAIM_STATUS.SENT,
    complete: CLAIM_STATUS.COMPLETED, reject: CLAIM_STATUS.REJECTED,
    fail: CLAIM_STATUS.FAILED,
  };

  const targetStatus    = statusMap[action];
  const results         = [];
  const failures        = [];
  const affectedUserIds = new Set();

  for (const id of ids) {
    try {
      const result = await performStatusUpdate({
        id, targetStatus, adminId, note, releaseCoupon: action === "reject",
      });
      if (result.success) {
        results.push({ id, status: targetStatus });
        notifyUserOfStatusChange(result.claim, targetStatus, note);
        if (result.claim.user_id) affectedUserIds.add(result.claim.user_id);
      } else {
        failures.push({ id, reason: result.error });
      }
    } catch (e) {
      failures.push({ id, reason: e.message });
    }
  }

  for (const userId of affectedUserIds) invalidateCache(userId);

  return res.status(207).json({
    success: failures.length === 0,
    processed: results.length, failed: failures.length,
    results, failures,
  });
});

/* ═══════════════════════════════════════════════════════════════
   POST /assign
═══════════════════════════════════════════════════════════════ */
router.post("/assign", verifyAdmin, async (req, res) => {
  const { user_id, amount, code } = req.body;
  if (!user_id || !amount) return res.status(400).json({ success: false, message: "user_id and amount required." });
  if (Number(amount) <= 0 || Number(amount) > 10000) return res.status(400).json({ success: false, message: "Amount must be ₦1-₦10,000." });

  const couponCode = code?.trim().toUpperCase() || `AIR${Math.round(amount)}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  try {
    const { rows: u } = await pool.query(`SELECT id, name, email, email_verified FROM public.users WHERE id=$1 LIMIT 1`, [user_id]);
    if (!u.length) return res.status(404).json({ success: false, message: "User not found." });

    const { rows } = await pool.query(
      `INSERT INTO public.airtime_coupons (code, amount, user_id, status) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING RETURNING id, code, amount, status, created_at`,
      [couponCode, Number(amount), user_id, COUPON_STATUS.AVAILABLE]
    );
    if (!rows.length) return res.status(409).json({ success: false, message: `Code "${couponCode}" exists.` });

    invalidateCache(user_id);

    return res.status(201).json({
      success: true,
      message: `${nairaFmt(amount)} assigned to ${u[0].name}.`,
      coupon: { ...rows[0], amount: Number(rows[0].amount), amount_fmt: nairaFmt(rows[0].amount), user: u[0] },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /bulk-assign
═══════════════════════════════════════════════════════════════ */
router.post("/bulk-assign", verifyAdmin, async (req, res) => {
  const { assignments } = req.body;
  if (!Array.isArray(assignments) || !assignments.length || assignments.length > 100) {
    return res.status(400).json({ success: false, message: "1-100 assignments required." });
  }

  const results = [], failures = [], affected = new Set();

  for (const { user_id, amount } of assignments) {
    if (!user_id || !amount || Number(amount) <= 0) {
      failures.push({ user_id, reason: "Invalid." }); continue;
    }
    const code = `AIR${Math.round(amount)}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    try {
      const { rows: u } = await pool.query(`SELECT id, name FROM public.users WHERE id=$1 LIMIT 1`, [user_id]);
      if (!u.length) { failures.push({ user_id, reason: "Not found." }); continue; }
      const { rows } = await pool.query(
        `INSERT INTO public.airtime_coupons (code, amount, user_id, status) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING RETURNING id, code, amount`,
        [code, Number(amount), user_id, COUPON_STATUS.AVAILABLE]
      );
      if (!rows.length) { failures.push({ user_id, reason: "Code collision." }); }
      else { results.push({ user_id, user_name: u[0].name, code: rows[0].code, amount: Number(rows[0].amount), amount_fmt: nairaFmt(rows[0].amount) }); affected.add(user_id); }
    } catch (e) { failures.push({ user_id, reason: e.message }); }
  }

  for (const uid of affected) invalidateCache(uid);
  return res.status(207).json({ success: !failures.length, assigned: results.length, failed: failures.length, results, failures });
});

/* ═══════════════════════════════════════════════════════════════
   INTERNAL — updateClaimStatus
═══════════════════════════════════════════════════════════════ */
async function updateClaimStatus({ req, res, targetStatus, releaseCoupon = false }) {
  const { id } = req.params;
  const { note } = req.body;
  const adminId = req.admin.id;

  try {
    const result = await performStatusUpdate({ id, targetStatus, adminId, note, releaseCoupon });

    if (!result.success) {
      return res.status(result.notFound ? 404 : result.invalidTransition ? 409 : 500)
        .json({ success: false, message: result.error });
    }

    invalidateCache(result.claim.user_id);
    notifyUserOfStatusChange(result.claim, targetStatus, note);

    return res.json({
      success: true,
      message: `Claim marked as ${targetStatus}.`,
      claim: {
        id: result.claim.id, status: result.claim.status,
        amount: Number(result.claim.amount || 0), amount_fmt: nairaFmt(result.claim.amount || 0),
        credited_at: result.claim.credited_at, approved_at: result.claim.approved_at || null,
        admin_note: result.claim.admin_note,
      },
    });
  } catch (err) {
    console.error(`[admin/airtime] → ${targetStatus}:`, err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
}

/* ═══════════════════════════════════════════════════════════════
   INTERNAL — performStatusUpdate
═══════════════════════════════════════════════════════════════ */
async function performStatusUpdate({ id, targetStatus, adminId, note = null, releaseCoupon = false }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT ac.id, ac.status, ac.airtime_coupon_id, ac.user_id,
              ${amountSelect()} AS amount, ac.phone, ac.network,
              c.code AS coupon_code, u.name AS user_name, u.email AS user_email
       FROM public.airtime_claims ac
       JOIN public.airtime_coupons c ON c.id = ac.airtime_coupon_id
       JOIN public.users u           ON u.id = ac.user_id
       WHERE ac.id = $1 LIMIT 1 FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return { success: false, notFound: true, error: "Claim not found." };
    }

    const claim     = rows[0];
    const currentNs = normalizeStatus(claim.status);
    const allowed   = CLAIM_TRANSITIONS[currentNs] || [];

    if (!allowed.includes(targetStatus)) {
      await client.query("ROLLBACK");
      return { success: false, invalidTransition: true, error: `Cannot move "${currentNs}" → "${targetStatus}". Allowed: ${allowed.join(", ") || "none"}.` };
    }

    /* Build UPDATE */
    const setFields = ["status=$1", "credited_by=$2", "admin_note=COALESCE($3, admin_note)"];
    if (targetStatus === CLAIM_STATUS.APPROVED && SCHEMA.claims_has_approved_at) setFields.push("approved_at=NOW()");
    if (["sent", "completed", "rejected", "failed"].includes(targetStatus)) setFields.push("credited_at=NOW()");

    const { rows: updated } = await client.query(
      `UPDATE public.airtime_claims SET ${setFields.join(",")} WHERE id=$4
       RETURNING id, status, credited_at, admin_note${SCHEMA.claims_has_approved_at ? ", approved_at" : ""}`,
      [targetStatus, adminId, note?.trim() || null, id]
    );

    if (!updated.length) {
      await client.query("ROLLBACK");
      return { success: false, error: "Claim was modified. Refresh." };
    }

    /* ★ SYNC airtime_coupons.status */
    const couponStatusMap = {
      [CLAIM_STATUS.APPROVED] : "processing",
      [CLAIM_STATUS.SENT]     : "processing",
      [CLAIM_STATUS.COMPLETED]: "completed",
      [CLAIM_STATUS.FAILED]   : "failed",
    };

    if (releaseCoupon && targetStatus === CLAIM_STATUS.REJECTED) {
      await client.query(
        `UPDATE public.airtime_coupons SET status='available', redeemed_at=NULL, phone=NULL, network=NULL WHERE id=$1`,
        [claim.airtime_coupon_id]
      );
    } else if (couponStatusMap[targetStatus]) {
      await client.query(
        `UPDATE public.airtime_coupons SET status=$1 WHERE id=$2`,
        [couponStatusMap[targetStatus], claim.airtime_coupon_id]
      );
    }

    await client.query("COMMIT");

    return {
      success: true,
      claim: {
        ...updated[0], amount: claim.amount, coupon_code: claim.coupon_code,
        phone: claim.phone, network: claim.network,
        user_id: claim.user_id, user_name: claim.user_name, user_email: claim.user_email,
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
   INTERNAL — notifyUserOfStatusChange
═══════════════════════════════════════════════════════════════ */
function notifyUserOfStatusChange(claim, newStatus, adminNote = null) {
  if (!claim.user_email) return;
  const payload = {
    to: claim.user_email, name: claim.user_name,
    amount: Number(claim.amount || 0), phone: maskPhone(claim.phone), network: claim.network,
  };
  if (newStatus === CLAIM_STATUS.APPROVED) safeEmail(sendAirtimeClaimApprovedEmail, payload);
  else if (newStatus === CLAIM_STATUS.SENT || newStatus === CLAIM_STATUS.COMPLETED) safeEmail(sendAirtimeClaimCompletedEmail, payload);
  else if (newStatus === CLAIM_STATUS.REJECTED) safeEmail(sendAirtimeClaimRejectedEmail, { ...payload, remarks: adminNote });
}

export default router;