// routes/admin/airtimeCoupons.js
// ════════════════════════════════════════════════════════════
// Admin operations — with cache invalidation for real-time updates
// ════════════════════════════════════════════════════════════

import express from "express";
import crypto  from "crypto";
import { pool } from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

/* ★ Import cache invalidation helper */
import { invalidateUserCache } from "../coupons.js";

/* Try to import notification services — non-fatal if missing */
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
   CONSTANTS (same as before)
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
   SCHEMA INTROSPECTION (same as before)
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
    const claimSet = new Set(claimCols.map((r) => r.column_name));
    SCHEMA.claims_has_amount      = claimSet.has("amount");
    SCHEMA.claims_has_approved_at = claimSet.has("approved_at");
    SCHEMA.claims_has_ip_address  = claimSet.has("ip_address");
    SCHEMA.claims_has_user_agent  = claimSet.has("user_agent");
    SCHEMA.claims_has_device_hash = claimSet.has("device_hash");

    const { rows: histCheck } = await pool.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'airtime_phone_history'`
    );
    SCHEMA.history_table_exists = histCheck.length > 0;
    SCHEMA.ready = true;
    console.log("[admin/airtime] SCHEMA detected:", SCHEMA);
  } catch (err) {
    console.error("[admin/airtime] schema detection failed:", err.message);
  }
}

detectSchema();

const amountSelect = () =>
  SCHEMA.claims_has_amount ? "COALESCE(ac.amount, c.amount)" : "c.amount";

/* ═══════════════════════════════════════════════════════════════
   HELPERS (same as before)
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

/* ★ Safe cache invalidation wrapper */
const invalidateCache = (userId) => {
  if (!userId) return;
  try {
    invalidateUserCache(userId).catch((e) =>
      console.warn("[admin/airtime] cache invalidation failed:", e.message)
    );
  } catch (e) {
    console.warn("[admin/airtime] cache invalidation error:", e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   LEGACY MIGRATION (same as before)
═══════════════════════════════════════════════════════════════ */
async function fixLegacyStatuses() {
  try {
    for (const [oldStatus, newStatus] of Object.entries(LEGACY_STATUS_ALIASES)) {
      const { rowCount } = await pool.query(
        `UPDATE public.airtime_claims SET status = $1 WHERE status = $2`,
        [newStatus, oldStatus]
      );
      if (rowCount > 0) {
        console.log(`[admin/airtime] migrated ${rowCount} claims "${oldStatus}" → "${newStatus}"`);
      }
    }
  } catch (err) {
    console.warn("[admin/airtime] legacy migration failed:", err.message);
  }
}
fixLegacyStatuses();

/* ═══════════════════════════════════════════════════════════════
   All the GET routes remain identical — 
   /debug, /, /stats/summary, /:id, /user/:userId/claims, etc.
   
   Copy them from your existing file — no changes needed.
   
   Only the WRITE routes below have cache invalidation added.
═══════════════════════════════════════════════════════════════ */

/* ... (keep all existing GET routes unchanged) ... */

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/airtime-coupons/:id/approve
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
    return res.status(400).json({
      success: false,
      message: "A rejection reason (note) is required.",
    });
  }
  await updateClaimStatus({
    req, res,
    targetStatus  : CLAIM_STATUS.REJECTED,
    releaseCoupon : true,
  });
});

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
   POST /bulk-action — with cache invalidation
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

  const targetStatus       = statusMap[action];
  const results            = [];
  const failures           = [];
  const affectedUserIds    = new Set();  /* ★ Track affected users */

  for (const id of ids) {
    try {
      const result = await performStatusUpdate({
        id, targetStatus, adminId, note,
        releaseCoupon: action === "reject",
      });

      if (result.success) {
        results.push({ id, status: targetStatus });
        notifyUserOfStatusChange(result.claim, targetStatus, note);
        /* ★ Track user for cache invalidation */
        if (result.claim.user_id) affectedUserIds.add(result.claim.user_id);
      } else {
        failures.push({ id, reason: result.error });
      }
    } catch (e) {
      failures.push({ id, reason: e.message });
    }
  }

  /* ★ Invalidate cache for all affected users */
  for (const userId of affectedUserIds) {
    invalidateCache(userId);
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
   POST /assign — with cache invalidation
═══════════════════════════════════════════════════════════════ */
router.post("/assign", verifyAdmin, async (req, res) => {
  const { user_id, amount, code } = req.body;

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

    /* ★ Invalidate user cache so they see the new coupon immediately */
    invalidateCache(user_id);

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
   POST /bulk-assign — with cache invalidation
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

  const results          = [];
  const failures         = [];
  const affectedUserIds  = new Set();  /* ★ Track for cache */

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
        affectedUserIds.add(user_id);   /* ★ Track for cache */
      }
    } catch (e) {
      failures.push({ user_id, reason: e.message });
    }
  }

  /* ★ Invalidate cache for all affected users */
  for (const userId of affectedUserIds) {
    invalidateCache(userId);
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
   INTERNAL — updateClaimStatus wrapper
═══════════════════════════════════════════════════════════════ */
async function updateClaimStatus({ req, res, targetStatus, releaseCoupon = false }) {
  const { id }   = req.params;
  const { note } = req.body;
  const adminId  = req.admin.id;

  try {
    const result = await performStatusUpdate({
      id, targetStatus, adminId, note, releaseCoupon,
    });

    if (!result.success) {
      const statusCode = result.notFound          ? 404
                       : result.invalidTransition ? 409
                       : 500;
      return res.status(statusCode).json({
        success: false,
        message: result.error,
      });
    }

    /* ★ Invalidate cache immediately */
    invalidateCache(result.claim.user_id);

    /* Send notification */
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
        approved_at : result.claim.approved_at || null,
        admin_note  : result.claim.admin_note,
      },
    });

  } catch (err) {
    console.error(`[admin/airtime] status → ${targetStatus}:`, err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
}

/* ═══════════════════════════════════════════════════════════════
   INTERNAL — performStatusUpdate (unchanged, returns user_id)
═══════════════════════════════════════════════════════════════ */
async function performStatusUpdate({
  id, targetStatus, adminId, note = null, releaseCoupon = false,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT ac.id, ac.status, ac.airtime_coupon_id, ac.user_id,
              ${amountSelect()} AS amount,
              ac.phone, ac.network,
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
    const currentNorm = normalizeStatus(claim.status);
    const allowed = CLAIM_TRANSITIONS[currentNorm] || [];

    if (!allowed.includes(targetStatus)) {
      await client.query("ROLLBACK");
      return {
        success            : false,
        invalidTransition  : true,
        error              : `Cannot move from "${currentNorm}" to "${targetStatus}". Allowed: ${allowed.join(", ") || "none"}.`,
      };
    }

    const setFields = [
      "status       = $1",
      "credited_by  = $2",
      "admin_note   = COALESCE($3, admin_note)",
    ];

    if (targetStatus === CLAIM_STATUS.APPROVED && SCHEMA.claims_has_approved_at) {
      setFields.push("approved_at = NOW()");
    }

    if (["sent", "completed", "rejected", "failed"].includes(targetStatus)) {
      setFields.push("credited_at = NOW()");
    }

    const { rows: updated } = await client.query(
      `UPDATE public.airtime_claims
       SET ${setFields.join(", ")}
       WHERE id = $4
       RETURNING id, status, credited_at, admin_note
                 ${SCHEMA.claims_has_approved_at ? ", approved_at" : ""}`,
      [targetStatus, adminId, note?.trim() || null, id]
    );

    if (!updated.length) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error  : "Claim was modified. Please refresh.",
      };
    }

    /* Update airtime_coupons.status to reflect claim state */
    let newCouponStatus = null;
    if (targetStatus === CLAIM_STATUS.REJECTED) {
      newCouponStatus = "available";
    } else if (targetStatus === CLAIM_STATUS.COMPLETED) {
      newCouponStatus = "completed";
    } else if (targetStatus === CLAIM_STATUS.FAILED) {
      newCouponStatus = "failed";
    } else if (["approved", "sent"].includes(targetStatus)) {
      newCouponStatus = "processing";
    }

    if (releaseCoupon && targetStatus === CLAIM_STATUS.REJECTED) {
      /* Full reset for rejection */
      await client.query(
        `UPDATE public.airtime_coupons
         SET    status = 'available',
                redeemed_at = NULL,
                phone = NULL,
                network = NULL
         WHERE  id = $1`,
        [claim.airtime_coupon_id]
      );
    } else if (newCouponStatus) {
      /* Update coupon status to match claim */
      await client.query(
        `UPDATE public.airtime_coupons
         SET    status = $1
         WHERE  id = $2`,
        [newCouponStatus, claim.airtime_coupon_id]
      );
    }

    await client.query("COMMIT");

    return {
      success: true,
      claim  : {
        ...updated[0],
        amount      : claim.amount,
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
   INTERNAL — notifyUserOfStatusChange (unchanged)
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