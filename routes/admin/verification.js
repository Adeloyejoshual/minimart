// ════════════════════════════════════════════════════════════
// FILE: routes/admin/verification.js — v4
//
// Unified single-action endpoints:
//   POST /api/admin/verification/:userId/approve
//   POST /api/admin/verification/:userId/reject
//   POST /api/admin/verification/:userId/reset
//
// Plus granular edge-case routes kept.
// All admin actions send email + in-app notifications.
//
// store_verifications actual schema:
//   id, user_id, documents_url (jsonb), status,
//   reviewed_by, reviewed_at, rejection_reason,
//   created_at, updated_at, assigned_admin_id, assigned_at
// ════════════════════════════════════════════════════════════

import express from "express";
import crypto  from "crypto";

import { pool }                           from "../../server.js";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";
import { reactivateLimitedListings }      from "../addproduct.js";
import { writeAudit }                     from "../../lib/audit.js";
import {
  sendIdentityStatusEmail,
  sendStoreStatusEmail,
  sendVerificationApprovedEmail,
  sendVerificationRejectedEmail,
  sendVerificationResetEmail,
} from "../../services/email.js";
import { createNotification } from "../../services/notifications.js";

const router = express.Router();
router.use(verifyAdmin);

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const MAX_LIMIT           = 200;
const BULK_MAX            = 50;
const NOTE_MAX_LEN        = 1_000;
const REASON_MAX_LEN      = 500;
const SIGNED_URL_TTL_SECS = 60 * 15; // 15 min

const VALID_ID_STATUSES = new Set([
  "pending", "approved", "rejected", "reset", "flagged", "all",
]);
const VALID_STORE_STATUSES = new Set([
  "pending", "approved", "rejected", "reset", "all",
]);

/* ══════════════════════════════════════════════════════════════
   TRUST SCORE  (mirrors verification.js exactly)
   email_verified    → 30
   identity_verified → 35
   store_verified    → 20
   age > 30d         → 10
   age > 90d         →  5
   cap               → 100
══════════════════════════════════════════════════════════════ */
const computeTrustScore = ({
  email_verified    = false,
  identity_verified = false,
  store_verified    = false,
  created_at,
}) => {
  let score = 0;
  if (email_verified)    score += 30;
  if (identity_verified) score += 35;
  if (store_verified)    score += 20;
  const ageDays = (Date.now() - new Date(created_at).getTime()) / 86_400_000;
  if (ageDays > 30) score += 10;
  if (ageDays > 90) score +=  5;
  return Math.min(score, 100);
};

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, error: message, ...extra });

const safeInt = (val, fallback, max = Infinity) => {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
};

const getIp = (req) => req.ip ?? req.socket?.remoteAddress ?? null;

const buildStatusFilter = (status, alias = "") => {
  const col = alias ? `${alias}.status` : "status";
  if (!status || status === "all") return { where: "", params: [] };
  return { where: `WHERE ${col} = $1`, params: [status] };
};

/* ── Recompute + persist trust score ── */
const refreshAndPersistTrust = async (client, userId) => {
  const { rows } = await client.query(
    `SELECT email_verified, identity_verified, store_verified, created_at
     FROM   public.users WHERE id = $1`,
    [userId]
  );
  if (!rows.length) return 0;
  const score = computeTrustScore(rows[0]);
  await client.query(
    `UPDATE public.users
     SET    trust_score = $1, updated_at = NOW()
     WHERE  id = $2`,
    [score, userId]
  );
  return score;
};

/* ── Add note to verification_notes ── */
const addNote = async (
  db,
  { verificationId, verificationType, adminId, action, note }
) => {
  await db.query(
    `INSERT INTO verification_notes
       (verification_id, verification_type, admin_id, action, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [verificationId, verificationType, adminId, action, note]
  );
};

/* ── Fetch notes history ── */
const getNotes = async (db, verificationId, verificationType) => {
  const { rows } = await db.query(
    `SELECT
       vn.id, vn.action, vn.note, vn.created_at,
       u.name  AS admin_name,
       u.email AS admin_email
     FROM   verification_notes vn
     JOIN   public.users u ON u.id = vn.admin_id
     WHERE  vn.verification_id   = $1
       AND  vn.verification_type = $2
     ORDER  BY vn.created_at ASC`,
    [verificationId, verificationType]
  );
  return rows;
};

/* ── Dual audit trail (admin_logs + writeAudit) ── */
const log = async ({
  adminId, action, targetId,
  details, meta = null, userId = null, ip = null,
}) => {
  await Promise.all([
    pool.query(
      `INSERT INTO admin_logs
         (admin_id, action, target_type, target_id, details, metadata)
       VALUES ($1, $2, 'verification', $3, $4, $5)`,
      [adminId, action, targetId, details, meta ? JSON.stringify(meta) : null]
    ),
    writeAudit({
      actorId    : adminId,
      action,
      targetType : "verification",
      targetId,
      metadata   : { ...(meta ?? {}), details, affected_user: userId },
      ipAddress  : ip,
    }),
  ]).catch((e) =>
    console.error("[admin verification] log error:", e.message)
  );
};

/* ── Signed URL generator ── */
const generateSignedUrl = (verificationId, field, adminId) => {
  const expires   = Math.floor(Date.now() / 1_000) + SIGNED_URL_TTL_SECS;
  const secret    = process.env.SIGNED_URL_SECRET ?? "dev-secret";
  const payload   = `${verificationId}:${field}:${adminId}:${expires}`;
  const signature = crypto
    .createHmac("sha256", secret).update(payload).digest("hex");
  return { expires, signature };
};

/* ══════════════════════════════════════════════════════════════
   EMAIL + NOTIFICATION HELPERS
   All fire both email and in-app notification.
   All errors are logged — never thrown (fire-and-forget).
══════════════════════════════════════════════════════════════ */

/* ── Full approval (identity + store approved together) ── */
const notifyApproved = ({ userId, email, name }) =>
  Promise.all([
    sendVerificationApprovedEmail({ to: email, name }),
    createNotification({
      userId,
      type    : "verification_approved",
      title   : "Account Fully Verified ✓",
      message :
        "Your identity and store have been verified. " +
        "Your listings are now permanent and your account is fully upgraded.",
    }),
  ]).catch((e) => console.error("[admin notify] approve:", e.message));

/* ── Full rejection (identity + store rejected together) ── */
const notifyRejected = ({ userId, email, name, reason }) =>
  Promise.all([
    sendVerificationRejectedEmail({ to: email, name, reason }),
    createNotification({
      userId,
      type    : "verification_rejected",
      title   : "Verification Not Approved",
      message : `Your verification was not approved. Reason: ${reason}`,
    }),
  ]).catch((e) => console.error("[admin notify] reject:", e.message));

/* ── Reset — ask user to resubmit ── */
const notifyReset = ({ userId, email, name, note }) =>
  Promise.all([
    sendVerificationResetEmail({ to: email, name, note }),
    createNotification({
      userId,
      type    : "verification_reset",
      title   : "Resubmit Verification Documents",
      message : `Please resubmit your documents. Note: ${note}`,
    }),
  ]).catch((e) => console.error("[admin notify] reset:", e.message));

/* ── Identity-only approved ── */
const notifyIdentityApproved = ({ userId, email, name }) =>
  Promise.all([
    sendIdentityStatusEmail({ to: email, name, approved: true }),
    createNotification({
      userId,
      type    : "identity_approved",
      title   : "Identity Verified ✓",
      message :
        "Your identity has been verified. Your listings are now permanent " +
        "and your account has been upgraded.",
    }),
  ]).catch((e) => console.error("[admin notify] identity approve:", e.message));

/* ── Identity-only rejected ── */
const notifyIdentityRejected = ({ userId, email, name, reason }) =>
  Promise.all([
    sendIdentityStatusEmail({ to: email, name, approved: false, reason }),
    createNotification({
      userId,
      type    : "identity_rejected",
      title   : "Identity Verification Update",
      message : `Your identity verification was not approved. Reason: ${reason}`,
    }),
  ]).catch((e) => console.error("[admin notify] identity reject:", e.message));

/* ── Store-only approved ── */
const notifyStoreApproved = ({ userId, email, name }) =>
  Promise.all([
    sendStoreStatusEmail({ to: email, name, storeName: name, approved: true }),
    createNotification({
      userId,
      type    : "store_approved",
      title   : "Store Approved ✓",
      message : "Your store has been approved and is now live on the platform.",
    }),
  ]).catch((e) => console.error("[admin notify] store approve:", e.message));

/* ── Store-only rejected ── */
const notifyStoreRejected = ({ userId, email, name, reason }) =>
  Promise.all([
    sendStoreStatusEmail({ to: email, name, storeName: name, approved: false, reason }),
    createNotification({
      userId,
      type    : "store_rejected",
      title   : "Store Verification Update",
      message : `Your store verification was not approved. Reason: ${reason}`,
    }),
  ]).catch((e) => console.error("[admin notify] store reject:", e.message));

/* ══════════════════════════════════════════════════════════════
   GET /stats
══════════════════════════════════════════════════════════════ */
router.get("/stats", async (req, res) => {
  try {
    const [idStats, storeStats, userStats, limitedStats, noteStats] =
      await Promise.all([

        pool.query(`
          SELECT
            COUNT(*)                                             ::INT AS total,
            COUNT(*) FILTER (WHERE status = 'pending')          ::INT AS pending,
            COUNT(*) FILTER (WHERE status = 'approved')         ::INT AS approved,
            COUNT(*) FILTER (WHERE status = 'rejected')         ::INT AS rejected,
            COUNT(*) FILTER (WHERE status = 'reset')            ::INT AS reset,
            COUNT(*) FILTER (WHERE status = 'flagged')          ::INT AS flagged,
            COUNT(*) FILTER (
              WHERE status = 'pending'
                AND created_at < NOW() - INTERVAL '24 hours'
            )                                                   ::INT AS overdue,
            COUNT(*) FILTER (
              WHERE assigned_admin_id IS NULL AND status = 'pending'
            )                                                   ::INT AS unassigned
          FROM identity_verifications
        `),

        pool.query(`
          SELECT
            COUNT(*)                                             ::INT AS total,
            COUNT(*) FILTER (WHERE status = 'pending')          ::INT AS pending,
            COUNT(*) FILTER (WHERE status = 'approved')         ::INT AS approved,
            COUNT(*) FILTER (WHERE status = 'rejected')         ::INT AS rejected,
            COUNT(*) FILTER (WHERE status = 'reset')            ::INT AS reset,
            COUNT(*) FILTER (
              WHERE status = 'pending'
                AND created_at < NOW() - INTERVAL '24 hours'
            )                                                   ::INT AS overdue,
            COUNT(*) FILTER (
              WHERE assigned_admin_id IS NULL AND status = 'pending'
            )                                                   ::INT AS unassigned
          FROM store_verifications
        `),

        pool.query(`
          SELECT
            COUNT(*)                                                 ::INT AS total,
            COUNT(*) FILTER (WHERE email_verified    = TRUE)        ::INT AS email_verified,
            COUNT(*) FILTER (WHERE identity_verified = TRUE)        ::INT AS identity_verified,
            COUNT(*) FILTER (WHERE store_verified    = TRUE)        ::INT AS store_verified,
            COUNT(*) FILTER (WHERE status = 'flagged')              ::INT AS flagged,
            COUNT(*) FILTER (WHERE status = 'banned')               ::INT AS banned,
            COALESCE(AVG(trust_score)::NUMERIC(5,2), 0)             AS avg_trust_score
          FROM public.users
        `),

        pool.query(`
          SELECT
            COUNT(*)                                                ::INT AS total,
            COUNT(*) FILTER (WHERE active_until < NOW())           ::INT AS expired,
            COUNT(*) FILTER (
              WHERE active_until >= NOW() OR active_until IS NULL
            )                                                       ::INT AS live
          FROM products
          WHERE status = 'active_limited'
        `),

        pool.query(`
          SELECT COUNT(*)::INT AS total
          FROM   verification_notes
          WHERE  created_at > NOW() - INTERVAL '7 days'
        `),
      ]);

    return res.json({
      success          : true,
      identity         : idStats.rows[0],
      store            : storeStats.rows[0],
      users            : userStats.rows[0],
      limited_listings : limitedStats.rows[0],
      notes_last_7d    : noteStats.rows[0].total,
    });

  } catch (err) {
    console.error("[admin stats]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   ████████████████████████████████████████████████████████████
   UNIFIED ENDPOINTS
   POST /:userId/approve  — approve identity + store at once
   POST /:userId/reject   — reject  identity + store at once
   POST /:userId/reset    — reset   identity + store at once
   ████████████████████████████████████████████████████████████
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   POST /:userId/approve
══════════════════════════════════════════════════════════════ */
router.post("/:userId/approve", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const userId  = req.params.userId;
  const note    = (req.body.note ?? "Approved.").trim();

  if (!note) return fail(res, 400, "A note is required.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Lock + fetch user ── */
    const { rows: userRows } = await client.query(
      `SELECT
         id, email, name,
         email_verified, identity_verified, store_verified,
         status, created_at
       FROM public.users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );

    if (!userRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "User not found.");
    }

    const user = userRows[0];

    if (user.status === "flagged" || user.status === "banned") {
      await client.query("ROLLBACK");
      return fail(res, 403, "Account is restricted.");
    }

    if (!user.email_verified) {
      await client.query("ROLLBACK");
      return fail(res, 422, "User email is not verified yet.");
    }

    if (user.identity_verified && user.store_verified) {
      await client.query("ROLLBACK");
      return res.json({ success: true, message: "User is already fully verified." });
    }

    /* ── Lock pending identity verification ── */
    const { rows: idRows } = await client.query(
      `SELECT id, document_number_hash, status
       FROM identity_verifications
       WHERE user_id = $1
         AND status IN ('pending', 'flagged')
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (!idRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "No pending identity verification found for this user.");
    }

    const idRec = idRows[0];

    /* ── Duplicate document guard ── */
    if (idRec.document_number_hash) {
      const { rows: dupRows } = await client.query(
        `SELECT id FROM identity_verifications
         WHERE  document_number_hash = $1
           AND  user_id             <> $2
           AND  status               = 'approved'
         LIMIT  3`,
        [idRec.document_number_hash, userId]
      );

      if (dupRows.length) {
        await client.query(
          `UPDATE identity_verifications
           SET    status             = 'flagged',
                  flagged_for_review = TRUE,
                  risk_score        = GREATEST(COALESCE(risk_score, 0), 90),
                  updated_at        = NOW()
           WHERE  id = $1`,
          [idRec.id]
        );

        await addNote(client, {
          verificationId  : idRec.id,
          verificationType: "identity",
          adminId,
          action          : "flagged",
          note            :
            `Blocked: document hash matches ${dupRows.length} ` +
            `already-approved account(s). Manual review required.`,
        });

        await client.query("COMMIT");

        log({
          adminId,
          action   : "flag_identity_duplicate",
          targetId : idRec.id,
          details  : `Duplicate document for user ${userId}`,
          meta     : { duplicate_count: dupRows.length, risk_score: 90 },
          userId,
          ip,
        });

        return fail(
          res, 409,
          `Duplicate document detected across ${dupRows.length} approved account(s). ` +
          `Verification flagged for manual review.`,
          { flagged: true }
        );
      }
    }

    /* ── Lock pending store verification ── */
    const { rows: storeRows } = await client.query(
      `SELECT id, status
       FROM store_verifications
       WHERE user_id = $1
         AND status IN ('pending', 'reset')
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (!storeRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "No pending store verification found for this user.");
    }

    const storeRec = storeRows[0];

    /* ── Approve identity ── */
    await client.query(
      `UPDATE identity_verifications
       SET    status             = 'approved',
              flagged_for_review = FALSE,
              reviewed_by        = $2,
              reviewed_at        = NOW(),
              updated_at         = NOW()
       WHERE  id = $1`,
      [idRec.id, adminId]
    );

    /* ── Approve store ── */
    await client.query(
      `UPDATE store_verifications
       SET    status      = 'approved',
              reviewed_by = $2,
              reviewed_at = NOW(),
              updated_at  = NOW()
       WHERE  id = $1`,
      [storeRec.id, adminId]
    );

    /* ── Set user verified flags ── */
    await client.query(
      `UPDATE public.users
       SET    identity_verified    = TRUE,
              identity_verified_at = NOW(),
              store_verified       = TRUE,
              store_verified_at    = NOW(),
              updated_at           = NOW()
       WHERE  id = $1`,
      [userId]
    );

    /* ── Recompute trust score ── */
    const trustScore = await refreshAndPersistTrust(client, userId);

    /* ── Notes on both records ── */
    await Promise.all([
      addNote(client, {
        verificationId  : idRec.id,
        verificationType: "identity",
        adminId,
        action          : "approved",
        note,
      }),
      addNote(client, {
        verificationId  : storeRec.id,
        verificationType: "store",
        adminId,
        action          : "approved",
        note,
      }),
    ]);

    await client.query("COMMIT");

    console.log(
      "[admin] ✓ approve-all  userId:", userId,
      " trust_score:", trustScore
    );

    /* ── Post-commit side effects ── */
    reactivateLimitedListings(userId).catch((e) =>
      console.error("[admin approve-all] reactivate:", e.message)
    );

    /* ── Send approval email + in-app notification ── */
    notifyApproved({ userId, email: user.email, name: user.name });

    log({
      adminId,
      action   : "approve_all",
      targetId : userId,
      details  : `Approved identity + store for user ${userId}`,
      meta     : {
        identity_verification_id : idRec.id,
        store_verification_id    : storeRec.id,
        trust_score              : trustScore,
        note,
      },
      userId,
      ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      approved    : { identity: idRec.id, store: storeRec.id },
      message     :
        "Identity and store approved. " +
        "Approval email sent to user. Listings reactivated.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin /:userId/approve]", err.message, err.stack);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /:userId/reject
══════════════════════════════════════════════════════════════ */
router.post("/:userId/reject", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const userId  = req.params.userId;
  const reason  = (req.body.reason ?? "").trim();

  if (!reason)
    return fail(res, 400, "Rejection reason is required.");
  if (reason.length > REASON_MAX_LEN)
    return fail(res, 400, `Reason must be at most ${REASON_MAX_LEN} characters.`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Lock + fetch user ── */
    const { rows: userRows } = await client.query(
      `SELECT id, email, name, status
       FROM public.users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );

    if (!userRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "User not found.");
    }

    const user = userRows[0];

    /* ── Lock pending identity ── */
    const { rows: idRows } = await client.query(
      `SELECT id, status FROM identity_verifications
       WHERE user_id = $1
         AND status IN ('pending', 'flagged')
       ORDER BY created_at DESC LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    /* ── Lock pending store ── */
    const { rows: storeRows } = await client.query(
      `SELECT id, status FROM store_verifications
       WHERE user_id = $1
         AND status IN ('pending', 'reset')
       ORDER BY created_at DESC LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (!idRows.length && !storeRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "No pending verifications found for this user.");
    }

    /* ── Reject identity ── */
    if (idRows.length) {
      await client.query(
        `UPDATE identity_verifications
         SET    status           = 'rejected',
                rejection_reason = $2,
                reviewed_by      = $3,
                reviewed_at      = NOW(),
                updated_at       = NOW()
         WHERE  id = $1`,
        [idRows[0].id, reason, adminId]
      );

      /* Downgrade active listings → active_limited */
      await client.query(
        `UPDATE products
         SET    status = 'active_limited', updated_at = NOW()
         WHERE  seller_id        = $1
           AND  status           = 'active'
           AND  is_first_product = TRUE`,
        [userId]
      );

      await addNote(client, {
        verificationId  : idRows[0].id,
        verificationType: "identity",
        adminId,
        action          : "rejected",
        note            : reason,
      });
    }

    /* ── Reject store ── */
    if (storeRows.length) {
      await client.query(
        `UPDATE store_verifications
         SET    status           = 'rejected',
                rejection_reason = $2,
                reviewed_by      = $3,
                reviewed_at      = NOW(),
                updated_at       = NOW()
         WHERE  id = $1`,
        [storeRows[0].id, reason, adminId]
      );

      await addNote(client, {
        verificationId  : storeRows[0].id,
        verificationType: "store",
        adminId,
        action          : "rejected",
        note            : reason,
      });
    }

    /* ── Clear user verification flags ── */
    await client.query(
      `UPDATE public.users
       SET    identity_verified = FALSE,
              store_verified    = FALSE,
              updated_at        = NOW()
       WHERE  id = $1`,
      [userId]
    );

    const trustScore = await refreshAndPersistTrust(client, userId);

    await client.query("COMMIT");

    console.log(
      "[admin] ✓ reject-all  userId:", userId,
      " trust_score:", trustScore
    );

    /* ── Send rejection email + in-app notification ── */
    notifyRejected({ userId, email: user.email, name: user.name, reason });

    log({
      adminId,
      action   : "reject_all",
      targetId : userId,
      details  : `Rejected identity + store for user ${userId}: ${reason}`,
      meta     : {
        identity_verification_id : idRows[0]?.id    ?? null,
        store_verification_id    : storeRows[0]?.id ?? null,
        reason,
        trust_score              : trustScore,
      },
      userId,
      ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      rejected    : {
        identity : idRows[0]?.id    ?? null,
        store    : storeRows[0]?.id ?? null,
      },
      message : "Verification rejected. Rejection email sent to user.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin /:userId/reject]", err.message, err.stack);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /:userId/reset
══════════════════════════════════════════════════════════════ */
router.post("/:userId/reset", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const userId  = req.params.userId;
  const note    =
    (req.body.note ?? "").trim() || "Resubmission requested by admin.";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Lock + fetch user ── */
    const { rows: userRows } = await client.query(
      `SELECT id, email, name
       FROM public.users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );

    if (!userRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "User not found.");
    }

    const user = userRows[0];

    /* ── Lock latest identity ── */
    const { rows: idRows } = await client.query(
      `SELECT id FROM identity_verifications
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    /* ── Lock latest store ── */
    const { rows: storeRows } = await client.query(
      `SELECT id FROM store_verifications
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (!idRows.length && !storeRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "No verification records found for this user.");
    }

    /* ── Reset identity ── */
    if (idRows.length) {
      await client.query(
        `UPDATE identity_verifications
         SET    status           = 'reset',
                rejection_reason = $2,
                reviewed_by      = $3,
                reviewed_at      = NOW(),
                updated_at       = NOW()
         WHERE  id = $1`,
        [idRows[0].id, note, adminId]
      );

      await addNote(client, {
        verificationId  : idRows[0].id,
        verificationType: "identity",
        adminId,
        action          : "reset",
        note,
      });
    }

    /* ── Reset store ── */
    if (storeRows.length) {
      await client.query(
        `UPDATE store_verifications
         SET    status           = 'reset',
                rejection_reason = $2,
                reviewed_by      = $3,
                reviewed_at      = NOW(),
                updated_at       = NOW()
         WHERE  id = $1`,
        [storeRows[0].id, note, adminId]
      );

      await addNote(client, {
        verificationId  : storeRows[0].id,
        verificationType: "store",
        adminId,
        action          : "reset",
        note,
      });
    }

    /* ── Clear user flags ── */
    await client.query(
      `UPDATE public.users
       SET    identity_verified = FALSE,
              store_verified    = FALSE,
              updated_at        = NOW()
       WHERE  id = $1`,
      [userId]
    );

    const trustScore = await refreshAndPersistTrust(client, userId);

    await client.query("COMMIT");

    console.log(
      "[admin] ✓ reset-all  userId:", userId,
      " trust_score:", trustScore
    );

    /* ── Send resubmit email + in-app notification ── */
    notifyReset({ userId, email: user.email, name: user.name, note });

    log({
      adminId,
      action   : "reset_all",
      targetId : userId,
      details  : `Reset identity + store for user ${userId}`,
      meta     : {
        identity_verification_id : idRows[0]?.id    ?? null,
        store_verification_id    : storeRows[0]?.id ?? null,
        note,
        trust_score              : trustScore,
      },
      userId,
      ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      reset       : {
        identity : idRows[0]?.id    ?? null,
        store    : storeRows[0]?.id ?? null,
      },
      message : "Verification reset. Resubmission email sent to user.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin /:userId/reset]", err.message, err.stack);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   IDENTITY — LIST
══════════════════════════════════════════════════════════════ */
router.get("/identity", async (req, res) => {
  const rawStatus = req.query.status ?? "pending";
  if (!VALID_ID_STATUSES.has(rawStatus))
    return fail(res, 400,
      `Invalid status. Use: ${[...VALID_ID_STATUSES].join(", ")}.`
    );

  const limit      = safeInt(req.query.limit,  50, MAX_LIMIT);
  const offset     = safeInt(req.query.offset,  0);
  const assignedTo = req.query.assigned_to ?? null;

  try {
    const conditions = [];
    const params     = [];

    if (rawStatus !== "all") {
      params.push(rawStatus);
      conditions.push(`iv.status = $${params.length}`);
    }
    if (assignedTo) {
      params.push(assignedTo);
      conditions.push(`iv.assigned_admin_id = $${params.length}`);
    }

    const where      = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const listParams = [...params, limit, offset];

    const { rows } = await pool.query(
      `SELECT
         iv.id, iv.document_type, iv.status,
         iv.risk_score, iv.risk_flags, iv.flagged_for_review,
         iv.rejection_reason, iv.reviewed_by, iv.reviewed_at,
         iv.assigned_admin_id, iv.assigned_at,
         iv.created_at, iv.updated_at,
         iv.front_image_url, iv.back_image_url, iv.selfie_url,
         u.id           AS user_id,
         u.name         AS user_name,
         u.email        AS user_email,
         u.phone_number AS user_phone,
         u.status       AS user_status,
         u.trust_score,
         u.identity_verified,
         u.email_verified,
         aa.name        AS assigned_admin_name
       FROM identity_verifications iv
       JOIN public.users u   ON u.id  = iv.user_id
       LEFT JOIN public.users aa ON aa.id = iv.assigned_admin_id
       ${where}
       ORDER BY iv.risk_score DESC NULLS LAST, iv.created_at ASC
       LIMIT  $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const { rows: cr } = await pool.query(
      `SELECT COUNT(*)::INT AS total
       FROM identity_verifications iv ${where}`,
      params
    );

    return res.json({
      success       : true,
      verifications : rows,
      total         : cr[0].total,
      limit,
      offset,
    });

  } catch (err) {
    console.error("[admin GET /identity]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   IDENTITY — SINGLE
══════════════════════════════════════════════════════════════ */
router.get("/identity/:id", async (req, res) => {
  try {
    const [verRes, notes] = await Promise.all([
      pool.query(
        `SELECT
           iv.id, iv.document_type, iv.status,
           iv.risk_score, iv.risk_flags, iv.flagged_for_review,
           iv.rejection_reason, iv.reviewed_by, iv.reviewed_at,
           iv.assigned_admin_id, iv.assigned_at,
           iv.created_at, iv.updated_at,
           u.id           AS user_id,
           u.name         AS user_name,
           u.email        AS user_email,
           u.phone_number AS user_phone,
           u.status       AS user_status,
           u.trust_score,
           u.identity_verified,
           u.email_verified,
           u.store_verified,
           u.created_at   AS user_created_at
         FROM identity_verifications iv
         JOIN public.users u ON u.id = iv.user_id
         WHERE iv.id = $1`,
        [req.params.id]
      ),
      getNotes(pool, req.params.id, "identity"),
    ]);

    if (!verRes.rows.length)
      return fail(res, 404, "Identity verification not found.");

    const { expires, signature } = generateSignedUrl(
      req.params.id, "front", req.admin.id
    );

    return res.json({
      success      : true,
      verification : {
        ...verRes.rows[0],
        document_urls : {
          front  : `/api/admin/verification/identity/${req.params.id}/files/front`,
          back   : `/api/admin/verification/identity/${req.params.id}/files/back`,
          selfie : `/api/admin/verification/identity/${req.params.id}/files/selfie`,
          token  : `${expires}:${signature}`,
          ttl    : SIGNED_URL_TTL_SECS,
        },
      },
      notes,
    });

  } catch (err) {
    console.error("[admin GET /identity/:id]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   IDENTITY — SIGNED DOCUMENT URL
══════════════════════════════════════════════════════════════ */
router.get("/identity/:id/files/:field", async (req, res) => {
  const { id, field } = req.params;
  const { token }     = req.query;

  if (!["front", "back", "selfie"].includes(field))
    return fail(res, 400, "Invalid field. Use: front, back, selfie.");

  if (!token) return fail(res, 401, "Token required.");

  try {
    const [expires, signature] = token.split(":");
    if (!expires || !signature)
      return fail(res, 401, "Invalid token format.");

    if (parseInt(expires, 10) < Math.floor(Date.now() / 1_000))
      return fail(res, 401, "Token expired. Request a new document link.");

    const adminId  = req.admin.id;
    const payload  = `${id}:${field}:${adminId}:${expires}`;
    const expected = crypto
      .createHmac("sha256", process.env.SIGNED_URL_SECRET ?? "dev-secret")
      .update(payload)
      .digest("hex");

    if (!crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected,  "hex")
    )) return fail(res, 401, "Invalid token signature.");

  } catch {
    return fail(res, 401, "Token verification failed.");
  }

  try {
    const colMap = {
      front  : "front_image_url",
      back   : "back_image_url",
      selfie : "selfie_url",
    };
    const { rows } = await pool.query(
      `SELECT ${colMap[field]} AS url FROM identity_verifications WHERE id = $1`,
      [id]
    );
    if (!rows.length || !rows[0].url)
      return fail(res, 404, "Document not found.");

    return res.redirect(302, rows[0].url);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   IDENTITY — GRANULAR APPROVE (edge case: identity only)
══════════════════════════════════════════════════════════════ */
router.post("/identity/:id/approve", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const note    = (req.body.note ?? "Approved.").trim();

  if (!note) return fail(res, 400, "A note is required.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT
         iv.id, iv.user_id,
         iv.status AS current_status,
         iv.document_number_hash,
         u.email, u.name
       FROM identity_verifications iv
       JOIN public.users u ON u.id = iv.user_id
       WHERE iv.id = $1
       FOR UPDATE OF iv`,
      [req.params.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Identity verification not found.");
    }

    const rec = rows[0];

    if (rec.current_status === "approved") {
      await client.query("ROLLBACK");
      return res.json({ success: true, message: "Already approved." });
    }

    /* Duplicate guard */
    if (rec.document_number_hash) {
      const { rows: dupRows } = await client.query(
        `SELECT id FROM identity_verifications
         WHERE  document_number_hash = $1
           AND  user_id             <> $2
           AND  status               = 'approved'
         LIMIT 3`,
        [rec.document_number_hash, rec.user_id]
      );

      if (dupRows.length) {
        await client.query(
          `UPDATE identity_verifications
           SET    status = 'flagged', flagged_for_review = TRUE,
                  risk_score = GREATEST(COALESCE(risk_score, 0), 90),
                  updated_at = NOW()
           WHERE  id = $1`,
          [req.params.id]
        );
        await addNote(client, {
          verificationId  : req.params.id,
          verificationType: "identity",
          adminId,
          action          : "flagged",
          note            :
            `Blocked: document matches ${dupRows.length} approved account(s).`,
        });
        await client.query("COMMIT");
        return fail(res, 409, "Duplicate document. Verification flagged.", { flagged: true });
      }
    }

    await client.query(
      `UPDATE identity_verifications
       SET    status = 'approved', flagged_for_review = FALSE,
              reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
       WHERE  id = $1`,
      [req.params.id, adminId]
    );

    await client.query(
      `UPDATE public.users
       SET    identity_verified = TRUE, identity_verified_at = NOW(),
              updated_at = NOW()
       WHERE  id = $1`,
      [rec.user_id]
    );

    const trustScore = await refreshAndPersistTrust(client, rec.user_id);

    await addNote(client, {
      verificationId  : req.params.id,
      verificationType: "identity",
      adminId, action: "approved", note,
    });

    await client.query("COMMIT");

    reactivateLimitedListings(rec.user_id).catch(() => {});
    notifyIdentityApproved({ userId: rec.user_id, email: rec.email, name: rec.name });

    log({
      adminId, action: "approve_identity", targetId: req.params.id,
      details : `Approved identity for user ${rec.user_id}`,
      meta    : { trust_score: trustScore, note },
      userId  : rec.user_id, ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Identity approved. Approval email sent to user.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin approve identity]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   IDENTITY — GRANULAR REJECT
══════════════════════════════════════════════════════════════ */
router.post("/identity/:id/reject", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const reason  = (req.body.reason ?? "").trim();

  if (!reason)
    return fail(res, 400, "Rejection reason is required.");
  if (reason.length > REASON_MAX_LEN)
    return fail(res, 400, `Reason must be at most ${REASON_MAX_LEN} characters.`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT iv.user_id, iv.status AS current_status, u.email, u.name
       FROM   identity_verifications iv
       JOIN   public.users u ON u.id = iv.user_id
       WHERE  iv.id = $1 FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Identity verification not found.");
    }

    const { user_id, current_status, email, name } = rows[0];

    if (current_status === "rejected") {
      await client.query("ROLLBACK");
      return res.json({ success: true, message: "Already rejected." });
    }

    await client.query(
      `UPDATE identity_verifications
       SET    status = 'rejected', rejection_reason = $2,
              reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE  id = $1`,
      [req.params.id, reason, adminId]
    );

    await client.query(
      `UPDATE public.users
       SET    identity_verified = FALSE, updated_at = NOW()
       WHERE  id = $1`,
      [user_id]
    );

    await client.query(
      `UPDATE products
       SET    status = 'active_limited', updated_at = NOW()
       WHERE  seller_id = $1 AND status = 'active' AND is_first_product = TRUE`,
      [user_id]
    );

    const trustScore = await refreshAndPersistTrust(client, user_id);

    await addNote(client, {
      verificationId  : req.params.id,
      verificationType: "identity",
      adminId, action: "rejected", note: reason,
    });

    await client.query("COMMIT");

    notifyIdentityRejected({ userId: user_id, email, name, reason });

    log({
      adminId, action: "reject_identity", targetId: req.params.id,
      details : `Rejected identity for user ${user_id}: ${reason}`,
      meta    : { reason, trust_score: trustScore },
      userId  : user_id, ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Identity rejected. Rejection email sent to user.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin reject identity]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   IDENTITY — GRANULAR RESET
══════════════════════════════════════════════════════════════ */
router.post("/identity/:id/reset", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const note    =
    (req.body.note ?? "").trim() || "Resubmission requested by admin.";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT iv.user_id, u.email, u.name
       FROM   identity_verifications iv
       JOIN   public.users u ON u.id = iv.user_id
       WHERE  iv.id = $1 FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Identity verification not found.");
    }

    const { user_id, email, name } = rows[0];

    await client.query(
      `UPDATE identity_verifications
       SET    status = 'reset', rejection_reason = $2,
              reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE  id = $1`,
      [req.params.id, note, adminId]
    );

    await client.query(
      `UPDATE public.users
       SET    identity_verified = FALSE, updated_at = NOW()
       WHERE  id = $1`,
      [user_id]
    );

    const trustScore = await refreshAndPersistTrust(client, user_id);

    await addNote(client, {
      verificationId  : req.params.id,
      verificationType: "identity",
      adminId, action: "reset", note,
    });

    await client.query("COMMIT");

    notifyReset({ userId: user_id, email, name, note });

    log({
      adminId, action: "reset_identity", targetId: req.params.id,
      details : `Reset identity for user ${user_id}`,
      meta    : { note, trust_score: trustScore },
      userId  : user_id, ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Identity reset. Resubmission email sent to user.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin reset identity]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   IDENTITY — ASSIGN
══════════════════════════════════════════════════════════════ */
router.post("/identity/:id/assign", async (req, res) => {
  const adminId         = req.admin.id;
  const ip              = getIp(req);
  const assignedAdminId = req.body.admin_id ?? adminId;

  try {
    const { rows } = await pool.query(
      `UPDATE identity_verifications
       SET    assigned_admin_id = $2, assigned_at = NOW(), updated_at = NOW()
       WHERE  id = $1 AND status = 'pending'
       RETURNING id, user_id`,
      [req.params.id, assignedAdminId]
    );

    if (!rows.length)
      return fail(res, 404, "Verification not found or not in pending state.");

    log({
      adminId, action: "assign_identity", targetId: req.params.id,
      details : `Assigned to admin ${assignedAdminId}`,
      meta    : { assigned_to: assignedAdminId },
      userId  : rows[0].user_id, ip,
    });

    return res.json({ success: true, assigned_to: assignedAdminId });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   IDENTITY — ADD NOTE
══════════════════════════════════════════════════════════════ */
router.post("/identity/:id/note", async (req, res) => {
  const adminId = req.admin.id;
  const note    = (req.body.note ?? "").trim();

  if (!note) return fail(res, 400, "Note is required.");
  if (note.length > NOTE_MAX_LEN)
    return fail(res, 400, `Note must be at most ${NOTE_MAX_LEN} characters.`);

  try {
    const { rows } = await pool.query(
      "SELECT id FROM identity_verifications WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return fail(res, 404, "Verification not found.");

    await addNote(pool, {
      verificationId  : req.params.id,
      verificationType: "identity",
      adminId, action: "note", note,
    });

    return res.json({ success: true });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   IDENTITY — BULK APPROVE
══════════════════════════════════════════════════════════════ */
router.post("/identity/bulk-approve", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const ids     = Array.isArray(req.body.ids) ? req.body.ids : [];
  const note    = (req.body.note ?? "Bulk approved.").trim();

  if (!ids.length)         return fail(res, 400, "IDs array is required.");
  if (ids.length > BULK_MAX)
    return fail(res, 400, `Maximum ${BULK_MAX} records per bulk action.`);

  const results = { approved: [], skipped: [], failed: [] };

  for (const id of ids) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `SELECT iv.user_id, iv.status, u.email, u.name
         FROM   identity_verifications iv
         JOIN   public.users u ON u.id = iv.user_id
         WHERE  iv.id = $1 FOR UPDATE OF iv`,
        [id]
      );

      if (!rows.length || rows[0].status !== "pending") {
        await client.query("ROLLBACK");
        results.skipped.push(id);
        continue;
      }

      const rec = rows[0];

      await client.query(
        `UPDATE identity_verifications
         SET    status = 'approved', reviewed_by = $2,
                reviewed_at = NOW(), updated_at = NOW()
         WHERE  id = $1`,
        [id, adminId]
      );

      await client.query(
        `UPDATE public.users
         SET    identity_verified = TRUE, identity_verified_at = NOW(),
                updated_at = NOW()
         WHERE  id = $1`,
        [rec.user_id]
      );

      const trustScore = await refreshAndPersistTrust(client, rec.user_id);

      await addNote(client, {
        verificationId  : id,
        verificationType: "identity",
        adminId, action: "approved", note,
      });

      await client.query("COMMIT");

      reactivateLimitedListings(rec.user_id).catch(() => {});
      notifyIdentityApproved({ userId: rec.user_id, email: rec.email, name: rec.name });

      results.approved.push({ id, user_id: rec.user_id, trust_score: trustScore });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      results.failed.push({ id, error: err.message });
    } finally {
      client.release();
    }
  }

  log({
    adminId, action: "bulk_approve_identity", targetId: "bulk",
    details : `Bulk approved ${results.approved.length} identities`,
    meta    : results, ip,
  });

  return res.json({ success: true, results });
});

/* ══════════════════════════════════════════════════════════════
   IDENTITY — BULK REJECT
══════════════════════════════════════════════════════════════ */
router.post("/identity/bulk-reject", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const ids     = Array.isArray(req.body.ids) ? req.body.ids : [];
  const reason  = (req.body.reason ?? "").trim();

  if (!ids.length) return fail(res, 400, "IDs array is required.");
  if (!reason)     return fail(res, 400, "Rejection reason is required.");
  if (ids.length > BULK_MAX)
    return fail(res, 400, `Maximum ${BULK_MAX} records per bulk action.`);

  const results = { rejected: [], skipped: [], failed: [] };

  for (const id of ids) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `SELECT iv.user_id, iv.status, u.email, u.name
         FROM   identity_verifications iv
         JOIN   public.users u ON u.id = iv.user_id
         WHERE  iv.id = $1 FOR UPDATE OF iv`,
        [id]
      );

      if (!rows.length || rows[0].status !== "pending") {
        await client.query("ROLLBACK");
        results.skipped.push(id);
        continue;
      }

      const { user_id, email, name } = rows[0];

      await client.query(
        `UPDATE identity_verifications
         SET    status = 'rejected', rejection_reason = $2,
                reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE  id = $1`,
        [id, reason, adminId]
      );

      await client.query(
        `UPDATE public.users
         SET    identity_verified = FALSE, updated_at = NOW()
         WHERE  id = $1`,
        [user_id]
      );

      const trustScore = await refreshAndPersistTrust(client, user_id);

      await addNote(client, {
        verificationId  : id,
        verificationType: "identity",
        adminId, action: "rejected", note: reason,
      });

      await client.query("COMMIT");

      notifyIdentityRejected({ userId: user_id, email, name, reason });

      results.rejected.push({ id, user_id, trust_score: trustScore });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      results.failed.push({ id, error: err.message });
    } finally {
      client.release();
    }
  }

  log({
    adminId, action: "bulk_reject_identity", targetId: "bulk",
    details : `Bulk rejected ${results.rejected.length} identities`,
    meta    : results, ip,
  });

  return res.json({ success: true, results });
});

/* ══════════════════════════════════════════════════════════════
   STORE — LIST
   Only real columns — no store_name / logo_url / review_action
══════════════════════════════════════════════════════════════ */
router.get("/store", async (req, res) => {
  const rawStatus = req.query.status ?? "pending";
  if (!VALID_STORE_STATUSES.has(rawStatus))
    return fail(res, 400,
      `Invalid status. Use: ${[...VALID_STORE_STATUSES].join(", ")}.`
    );

  const limit  = safeInt(req.query.limit,  50, MAX_LIMIT);
  const offset = safeInt(req.query.offset,  0);

  try {
    const { where, params } = buildStatusFilter(rawStatus, "sv");
    const listParams        = [...params, limit, offset];

    const { rows } = await pool.query(
      `SELECT
         sv.id,
         sv.documents_url,
         sv.status,
         sv.rejection_reason,
         sv.reviewed_by,
         sv.reviewed_at,
         sv.assigned_admin_id,
         sv.assigned_at,
         sv.created_at,
         sv.updated_at,
         u.id           AS user_id,
         u.name         AS user_name,
         u.email        AS user_email,
         u.phone_number AS user_phone,
         u.status       AS user_status,
         u.trust_score,
         u.store_verified,
         u.identity_verified,
         u.email_verified
       FROM store_verifications sv
       JOIN public.users u ON u.id = sv.user_id
       ${where}
       ORDER BY sv.created_at ASC
       LIMIT  $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const { rows: cr } = await pool.query(
      `SELECT COUNT(*)::INT AS total FROM store_verifications sv ${where}`,
      params
    );

    return res.json({
      success       : true,
      verifications : rows,
      total         : cr[0].total,
      limit,
      offset,
    });

  } catch (err) {
    console.error("[admin GET /store]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   STORE — SINGLE
══════════════════════════════════════════════════════════════ */
router.get("/store/:id", async (req, res) => {
  try {
    const [verRes, notes] = await Promise.all([
      pool.query(
        `SELECT
           sv.id, sv.documents_url, sv.status,
           sv.rejection_reason, sv.reviewed_by, sv.reviewed_at,
           sv.assigned_admin_id, sv.assigned_at,
           sv.created_at, sv.updated_at,
           u.id           AS user_id,
           u.name         AS user_name,
           u.email        AS user_email,
           u.phone_number AS user_phone,
           u.status       AS user_status,
           u.trust_score,
           u.store_verified,
           u.identity_verified,
           u.email_verified,
           u.created_at   AS user_created_at
         FROM store_verifications sv
         JOIN public.users u ON u.id = sv.user_id
         WHERE sv.id = $1`,
        [req.params.id]
      ),
      getNotes(pool, req.params.id, "store"),
    ]);

    if (!verRes.rows.length)
      return fail(res, 404, "Store verification not found.");

    return res.json({
      success      : true,
      verification : verRes.rows[0],
      notes,
    });

  } catch (err) {
    console.error("[admin GET /store/:id]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   STORE — GRANULAR APPROVE (edge case: store only)
══════════════════════════════════════════════════════════════ */
router.post("/store/:id/approve", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const note    = (req.body.note ?? "Approved.").trim();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT sv.user_id, sv.status AS current_status,
              u.email, u.name, u.identity_verified
       FROM store_verifications sv
       JOIN public.users u ON u.id = sv.user_id
       WHERE sv.id = $1 FOR UPDATE OF sv`,
      [req.params.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Store verification not found.");
    }

    const rec = rows[0];

    if (rec.current_status === "approved") {
      await client.query("ROLLBACK");
      return res.json({ success: true, message: "Already approved." });
    }

    if (!rec.identity_verified) {
      await client.query("ROLLBACK");
      return fail(res, 422,
        "Cannot approve store — seller has not completed identity verification."
      );
    }

    await client.query(
      `UPDATE store_verifications
       SET    status = 'approved', reviewed_by = $2,
              reviewed_at = NOW(), updated_at = NOW()
       WHERE  id = $1`,
      [req.params.id, adminId]
    );

    await client.query(
      `UPDATE public.users
       SET    store_verified = TRUE, store_verified_at = NOW(),
              updated_at = NOW()
       WHERE  id = $1`,
      [rec.user_id]
    );

    const trustScore = await refreshAndPersistTrust(client, rec.user_id);

    await addNote(client, {
      verificationId  : req.params.id,
      verificationType: "store",
      adminId, action: "approved", note,
    });

    await client.query("COMMIT");

    notifyStoreApproved({ userId: rec.user_id, email: rec.email, name: rec.name });

    log({
      adminId, action: "approve_store", targetId: req.params.id,
      details : `Approved store for user ${rec.user_id}`,
      meta    : { trust_score: trustScore, note },
      userId  : rec.user_id, ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Store approved. Approval email sent to user.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin approve store]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   STORE — GRANULAR REJECT
══════════════════════════════════════════════════════════════ */
router.post("/store/:id/reject", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const reason  = (req.body.reason ?? "").trim();

  if (!reason)
    return fail(res, 400, "Rejection reason is required.");
  if (reason.length > REASON_MAX_LEN)
    return fail(res, 400, `Reason must be at most ${REASON_MAX_LEN} characters.`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT sv.user_id, sv.status AS current_status, u.email, u.name
       FROM   store_verifications sv
       JOIN   public.users u ON u.id = sv.user_id
       WHERE  sv.id = $1 FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Store verification not found.");
    }

    const { user_id, current_status, email, name } = rows[0];

    if (current_status === "rejected") {
      await client.query("ROLLBACK");
      return res.json({ success: true, message: "Already rejected." });
    }

    await client.query(
      `UPDATE store_verifications
       SET    status = 'rejected', rejection_reason = $2,
              reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE  id = $1`,
      [req.params.id, reason, adminId]
    );

    await client.query(
      `UPDATE public.users
       SET    store_verified = FALSE, updated_at = NOW()
       WHERE  id = $1`,
      [user_id]
    );

    const trustScore = await refreshAndPersistTrust(client, user_id);

    await addNote(client, {
      verificationId  : req.params.id,
      verificationType: "store",
      adminId, action: "rejected", note: reason,
    });

    await client.query("COMMIT");

    notifyStoreRejected({ userId: user_id, email, name, reason });

    log({
      adminId, action: "reject_store", targetId: req.params.id,
      details : `Rejected store for user ${user_id}: ${reason}`,
      meta    : { reason, trust_score: trustScore },
      userId  : user_id, ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Store rejected. Rejection email sent to user.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin reject store]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   STORE — GRANULAR RESET
══════════════════════════════════════════════════════════════ */
router.post("/store/:id/reset", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const note    =
    (req.body.note ?? "").trim() || "Resubmission requested by admin.";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT sv.user_id, u.email, u.name
       FROM   store_verifications sv
       JOIN   public.users u ON u.id = sv.user_id
       WHERE  sv.id = $1 FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Store verification not found.");
    }

    const { user_id, email, name } = rows[0];

    await client.query(
      `UPDATE store_verifications
       SET    status = 'reset', rejection_reason = $2,
              reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE  id = $1`,
      [req.params.id, note, adminId]
    );

    await client.query(
      `UPDATE public.users
       SET    store_verified = FALSE, updated_at = NOW()
       WHERE  id = $1`,
      [user_id]
    );

    const trustScore = await refreshAndPersistTrust(client, user_id);

    await addNote(client, {
      verificationId  : req.params.id,
      verificationType: "store",
      adminId, action: "reset", note,
    });

    await client.query("COMMIT");

    notifyReset({ userId: user_id, email, name, note });

    log({
      adminId, action: "reset_store", targetId: req.params.id,
      details : `Reset store for user ${user_id}`,
      meta    : { note, trust_score: trustScore },
      userId  : user_id, ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Store reset. Resubmission email sent to user.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin reset store]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   STORE — ASSIGN
══════════════════════════════════════════════════════════════ */
router.post("/store/:id/assign", async (req, res) => {
  const adminId         = req.admin.id;
  const assignedAdminId = req.body.admin_id ?? adminId;

  try {
    const { rows } = await pool.query(
      `UPDATE store_verifications
       SET    assigned_admin_id = $2, assigned_at = NOW(), updated_at = NOW()
       WHERE  id = $1 AND status = 'pending'
       RETURNING id, user_id`,
      [req.params.id, assignedAdminId]
    );

    if (!rows.length)
      return fail(res, 404, "Verification not found or not pending.");

    return res.json({ success: true, assigned_to: assignedAdminId });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   STORE — ADD NOTE
══════════════════════════════════════════════════════════════ */
router.post("/store/:id/note", async (req, res) => {
  const adminId = req.admin.id;
  const note    = (req.body.note ?? "").trim();

  if (!note) return fail(res, 400, "Note is required.");
  if (note.length > NOTE_MAX_LEN)
    return fail(res, 400, `Note must be at most ${NOTE_MAX_LEN} characters.`);

  try {
    const { rows } = await pool.query(
      "SELECT id FROM store_verifications WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return fail(res, 404, "Verification not found.");

    await addNote(pool, {
      verificationId  : req.params.id,
      verificationType: "store",
      adminId, action: "note", note,
    });

    return res.json({ success: true });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   EMAIL — FORCE VERIFY (super-admin only)
══════════════════════════════════════════════════════════════ */
router.post("/email/:userId/force-verify", requireSuperAdmin, async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const userId  = req.params.userId;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT id, email, name FROM public.users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "User not found.");
    }

    const user = rows[0];

    await client.query(
      `UPDATE public.users
       SET    email_verified = TRUE, email_verified_at = NOW(),
              verified = TRUE, updated_at = NOW()
       WHERE  id = $1`,
      [userId]
    );

    const trustScore = await refreshAndPersistTrust(client, userId);

    await addNote(client, {
      verificationId  : userId,
      verificationType: "email",
      adminId,
      action          : "force_verified",
      note            : "Email force-verified by super-admin.",
    });

    await client.query("COMMIT");

    reactivateLimitedListings(userId).catch(() => {});

    createNotification({
      userId,
      type    : "email_verified",
      title   : "Email Verified",
      message : "Your email address has been verified by an administrator.",
    }).catch(() => {});

    log({
      adminId, action: "force_email_verify", targetId: userId,
      details : `Force-verified email for user ${userId}`,
      meta    : { trust_score: trustScore },
      userId, ip,
    });

    return res.json({ success: true, trust_score: trustScore });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   EMAIL — REVOKE (super-admin only)
══════════════════════════════════════════════════════════════ */
router.post("/email/:userId/revoke", requireSuperAdmin, async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const userId  = req.params.userId;
  const reason  = (req.body.reason ?? "Revoked by super-admin.").trim();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "User not found.");
    }

    await client.query(
      `UPDATE public.users
       SET    email_verified = FALSE, email_verified_at = NULL,
              verified = FALSE, updated_at = NOW()
       WHERE  id = $1`,
      [userId]
    );

    await client.query(
      `UPDATE email_verifications
       SET    status = 'expired', used_at = NOW()
       WHERE  user_id = $1 AND status = 'active'`,
      [userId]
    );

    const trustScore = await refreshAndPersistTrust(client, userId);

    await addNote(client, {
      verificationId  : userId,
      verificationType: "email",
      adminId, action: "revoked", note: reason,
    });

    await client.query("COMMIT");

    createNotification({
      userId,
      type    : "email_revoked",
      title   : "Email Verification Revoked",
      message : `Your email verification has been revoked. Reason: ${reason}`,
    }).catch(() => {});

    log({
      adminId, action: "revoke_email_verify", targetId: userId,
      details : `Revoked email for user ${userId}: ${reason}`,
      meta    : { reason, trust_score: trustScore },
      userId, ip,
    });

    return res.json({ success: true, trust_score: trustScore });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   TRUST SCORE — manual recalculate
══════════════════════════════════════════════════════════════ */
router.post("/trust/:userId/recalculate", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const userId  = req.params.userId;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "User not found.");
    }

    const trustScore = await refreshAndPersistTrust(client, userId);
    await client.query("COMMIT");

    log({
      adminId, action: "recalculate_trust", targetId: userId,
      details : `Recalculated trust for user ${userId} → ${trustScore}`,
      meta    : { trust_score: trustScore },
      userId, ip,
    });

    return res.json({ success: true, trust_score: trustScore });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

export default router;