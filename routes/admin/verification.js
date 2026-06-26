// ════════════════════════════════════════════════════════════════
// FILE: routes/admin/verification.js — v6
//
// Changes from v5:
//  - /:userId/approve  store is now fully optional (no 404 when
//    user has no store record)
//  - /:userId/approve  identity query accepts ANY non-approved
//    status (pending / flagged / reset / rejected)
//  - /:userId/approve  store_verified only set TRUE when a store
//    record actually exists
//  - /:userId/approve  email_verified guard is a warning not a
//    hard block (admin override)
//  - All granular routes lock user row before refreshAndPersistTrust
//  - downgradeListings helper used in every reject path
//  - Bulk routes registered before /:id routes (Express fix)
//  - timingSafeEqual length-mismatch crash fixed
//  - offset capped at MAX_OFFSET
//  - timeline + duplicate_warnings returned on identity list/single
//  - rate limiting on bulk endpoints
//  - store optional in unified approve
// ════════════════════════════════════════════════════════════════

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
const PAGE_SIZE        = 50;
const MAX_LIMIT        = 200;
const MAX_OFFSET       = 10_000;
const BULK_MAX         = 50;
const BULK_CONCURRENCY = 5;
const NOTE_MAX_LEN     = 1_000;
const REASON_MAX_LEN   = 500;
const SIGNED_URL_TTL   = 60 * 15; // 15 min

const VALID_ID_STATUSES = new Set([
  "pending", "approved", "rejected", "reset", "flagged", "all",
]);
const VALID_STORE_STATUSES = new Set([
  "pending", "approved", "rejected", "reset", "all",
]);
const VALID_DOC_FIELDS = new Set(["front", "back", "selfie"]);

/* ══════════════════════════════════════════════════════════════
   TRUST SCORE
   email_verified    → 30
   identity_verified → 35
   store_verified    → 20
   age > 30 d        → 10
   age > 90 d        →  5
   cap               → 100
══════════════════════════════════════════════════════════════ */
const computeTrustScore = ({
  email_verified    = false,
  identity_verified = false,
  store_verified    = false,
  created_at,
}) => {
  let s = 0;
  if (email_verified)    s += 30;
  if (identity_verified) s += 35;
  if (store_verified)    s += 20;
  const days = (Date.now() - new Date(created_at).getTime()) / 86_400_000;
  if (days > 30) s += 10;
  if (days > 90) s +=  5;
  return Math.min(s, 100);
};

/* ══════════════════════════════════════════════════════════════
   SMALL HELPERS
══════════════════════════════════════════════════════════════ */
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, error: message, ...extra });

const safeInt = (val, fallback, max = Infinity) => {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
};

const getIp = (req) =>
  req.ip ?? req.socket?.remoteAddress ?? null;

/* ══════════════════════════════════════════════════════════════
   TRUST  — recompute & persist
   Caller MUST hold FOR UPDATE on the users row before calling.
══════════════════════════════════════════════════════════════ */
const refreshAndPersistTrust = async (client, userId) => {
  const { rows } = await client.query(
    `SELECT email_verified, identity_verified, store_verified, created_at
     FROM   public.users
     WHERE  id = $1`,
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

/* ══════════════════════════════════════════════════════════════
   NOTES

   @param {import('pg').Pool | import('pg').PoolClient} db
     Pass the open PoolClient when inside a transaction so the
     insert is part of the same atomic unit.
     Pass pool only for standalone non-transactional inserts.
══════════════════════════════════════════════════════════════ */
const addNote = (db, { verificationId, verificationType, adminId, action, note }) =>
  db.query(
    `INSERT INTO verification_notes
       (verification_id, verification_type, admin_id, action, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [verificationId, verificationType, adminId, action, note]
  );

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

const TIMELINE_LABELS = {
  approved : "Approved",
  rejected : "Rejected",
  reset    : "Reset — Resubmission Requested",
  flagged  : "Flagged for Review",
  note     : "Note Added",
  assigned : "Assigned to Reviewer",
};

const getTimeline = async (db, verificationId, verificationType) => {
  const { rows } = await db.query(
    `SELECT
       vn.action    AS type,
       vn.note,
       vn.created_at,
       u.name       AS admin_name
     FROM   verification_notes vn
     JOIN   public.users u ON u.id = vn.admin_id
     WHERE  vn.verification_id   = $1
       AND  vn.verification_type = $2
     ORDER  BY vn.created_at ASC`,
    [verificationId, verificationType]
  );
  return rows.map((r) => ({
    ...r,
    label: TIMELINE_LABELS[r.type] ?? r.type.replace(/_/g, " "),
  }));
};

/* ══════════════════════════════════════════════════════════════
   LISTING DOWNGRADE
   Extracted so every reject / reset path uses the same logic.
══════════════════════════════════════════════════════════════ */
const downgradeListings = (client, userId) =>
  client.query(
    `UPDATE products
     SET    status = 'active_limited', updated_at = NOW()
     WHERE  seller_id        = $1
       AND  status           = 'active'
       AND  is_first_product = TRUE`,
    [userId]
  );

/* ══════════════════════════════════════════════════════════════
   DUPLICATE WARNINGS
══════════════════════════════════════════════════════════════ */
const buildDuplicateWarnings = async (db, userId, docHash) => {
  if (!docHash) return [];
  const { rows } = await db.query(
    `SELECT iv.user_id
     FROM   identity_verifications iv
     WHERE  iv.document_number_hash = $1
       AND  iv.user_id             <> $2
       AND  iv.status               = 'approved'
     LIMIT  5`,
    [docHash, userId]
  );
  if (!rows.length) return [];
  return [{
    type              : "document_reuse",
    severity          : "critical",
    detail            :
      `This document is already approved on ${rows.length} other account(s).`,
    matching_user_ids : rows.map((r) => r.user_id),
  }];
};

/* ══════════════════════════════════════════════════════════════
   AUDIT  — fire-and-forget, errors never thrown
══════════════════════════════════════════════════════════════ */
const log = ({
  adminId, action, targetId,
  details, meta = null, userId = null, ip = null,
}) =>
  Promise.all([
    pool.query(
      `INSERT INTO admin_logs
         (admin_id, action, target_type, target_id, details, metadata)
       VALUES ($1, $2, 'verification', $3, $4, $5)`,
      [adminId, action, targetId, details,
       meta ? JSON.stringify(meta) : null]
    ),
    writeAudit({
      actorId    : adminId,
      action,
      targetType : "verification",
      targetId,
      metadata   : { ...(meta ?? {}), details, affected_user: userId },
      ipAddress  : ip,
    }),
  ]).catch((e) => console.error("[audit]", action, e.message));

/* ══════════════════════════════════════════════════════════════
   SIGNED URLS
══════════════════════════════════════════════════════════════ */
const generateSignedUrl = (verificationId, field, adminId) => {
  if (!verificationId || !field || !adminId)
    throw new Error("generateSignedUrl: all three params are required");

  const expires = Math.floor(Date.now() / 1_000) + SIGNED_URL_TTL;
  const secret  = process.env.SIGNED_URL_SECRET ?? "dev-secret";
  const sig     = crypto
    .createHmac("sha256", secret)
    .update(`${verificationId}:${field}:${adminId}:${expires}`)
    .digest("hex");
  return { expires, signature: sig };
};

/**
 * Returns null on success, or an error string on failure.
 */
const verifySignedToken = (token, verificationId, field, adminId) => {
  if (!token) return "Token required.";

  const parts = token.split(":");
  if (parts.length !== 2) return "Invalid token format.";
  const [expiresStr, signature] = parts;

  if (parseInt(expiresStr, 10) < Math.floor(Date.now() / 1_000))
    return "Token expired. Request a new document link.";

  const secret   = process.env.SIGNED_URL_SECRET ?? "dev-secret";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${verificationId}:${field}:${adminId}:${expiresStr}`)
    .digest("hex");

  let sigBuf, expBuf;
  try {
    sigBuf = Buffer.from(signature, "hex");
    expBuf = Buffer.from(expected,  "hex");
  } catch {
    return "Invalid token encoding.";
  }

  if (sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf))
    return "Invalid token signature.";

  return null;
};

/* ══════════════════════════════════════════════════════════════
   RATE LIMITER  — graceful degradation if package absent
══════════════════════════════════════════════════════════════ */
let _bulkLimiter = null;
const bulkRateLimit = async (req, res, next) => {
  if (!_bulkLimiter) {
    try {
      const { rateLimit } = await import("express-rate-limit");
      _bulkLimiter = rateLimit({
        windowMs       : 60_000,
        max            : 5,
        keyGenerator   : (r) => `bulk:${r.admin?.id ?? "anon"}`,
        standardHeaders: true,
        legacyHeaders  : false,
        message        : {
          success: false,
          error  : "Too many bulk operations. Please wait 60 seconds.",
        },
      });
    } catch {
      _bulkLimiter = (_q, _r, n) => n(); // no-op if not installed
    }
  }
  return _bulkLimiter(req, res, next);
};

/* ══════════════════════════════════════════════════════════════
   PARALLEL BULK RUNNER
   Runs fn(id) for every id with at most BULK_CONCURRENCY
   in-flight at once.
══════════════════════════════════════════════════════════════ */
const runParallel = (ids, fn) => {
  const executing = [];
  const all = ids.map((id) => {
    const p = Promise.resolve().then(() => fn(id));
    if (ids.length > BULK_CONCURRENCY) {
      const e = p.finally(() =>
        executing.splice(executing.indexOf(e), 1)
      );
      executing.push(e);
      if (executing.length >= BULK_CONCURRENCY)
        return Promise.race(executing).then(() => p);
    }
    return p;
  });
  return Promise.allSettled(all);
};

/* ══════════════════════════════════════════════════════════════
   NOTIFICATIONS  — fire-and-forget
══════════════════════════════════════════════════════════════ */
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
  ]).catch((e) => console.error("[notify] approve:", e.message));

const notifyRejected = ({ userId, email, name, reason }) =>
  Promise.all([
    sendVerificationRejectedEmail({ to: email, name, reason }),
    createNotification({
      userId,
      type    : "verification_rejected",
      title   : "Verification Not Approved",
      message : `Your verification was not approved. Reason: ${reason}`,
    }),
  ]).catch((e) => console.error("[notify] reject:", e.message));

const notifyReset = ({ userId, email, name, note }) =>
  Promise.all([
    sendVerificationResetEmail({ to: email, name, note }),
    createNotification({
      userId,
      type    : "verification_reset",
      title   : "Resubmit Verification Documents",
      message :
        `Please resubmit your documents.${note ? ` Note: ${note}` : ""}`,
    }),
  ]).catch((e) => console.error("[notify] reset:", e.message));

const notifyIdentityApproved = ({ userId, email, name }) =>
  Promise.all([
    sendIdentityStatusEmail({ to: email, name, approved: true }),
    createNotification({
      userId,
      type    : "identity_approved",
      title   : "Identity Verified ✓",
      message :
        "Your identity has been verified. " +
        "Your listings are now permanent and your account has been upgraded.",
    }),
  ]).catch((e) => console.error("[notify] identity approve:", e.message));

const notifyIdentityRejected = ({ userId, email, name, reason }) =>
  Promise.all([
    sendIdentityStatusEmail({ to: email, name, approved: false, reason }),
    createNotification({
      userId,
      type    : "identity_rejected",
      title   : "Identity Verification Update",
      message :
        `Your identity verification was not approved. Reason: ${reason}`,
    }),
  ]).catch((e) => console.error("[notify] identity reject:", e.message));

const notifyStoreApproved = ({ userId, email, name }) =>
  Promise.all([
    sendStoreStatusEmail({ to: email, name, storeName: name, approved: true }),
    createNotification({
      userId,
      type    : "store_approved",
      title   : "Store Approved ✓",
      message :
        "Your store has been approved and is now live on the platform.",
    }),
  ]).catch((e) => console.error("[notify] store approve:", e.message));

const notifyStoreRejected = ({ userId, email, name, reason }) =>
  Promise.all([
    sendStoreStatusEmail({
      to: email, name, storeName: name, approved: false, reason,
    }),
    createNotification({
      userId,
      type    : "store_rejected",
      title   : "Store Verification Update",
      message :
        `Your store verification was not approved. Reason: ${reason}`,
    }),
  ]).catch((e) => console.error("[notify] store reject:", e.message));

/* ══════════════════════════════════════════════════════════════
   ████████████████████████████████████████████████████████████

   ROUTE ORDER (critical for Express param matching):
     1. /stats
     2. /identity          (GET list)
     3. /identity/bulk-*   (POST — must come before /:id)
     4. /identity/:id/*    (GET|POST single)
     5. /store             (GET list)
     6. /store/:id/*       (GET|POST single)
     7. /email/:userId/*   (super-admin)
     8. /trust/:userId/*
     9. /:userId/*         (unified — catch-all, registered last)

   ████████████████████████████████████████████████████████████
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   1.  GET /stats
══════════════════════════════════════════════════════════════ */
router.get("/stats", async (req, res) => {
  try {
    const [idQ, stQ, usQ, liQ, noQ] = await Promise.all([

      pool.query(`
        SELECT
          COUNT(*)                                               ::INT AS total,
          COUNT(*) FILTER (WHERE status = 'pending')            ::INT AS pending,
          COUNT(*) FILTER (WHERE status = 'approved')           ::INT AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected')           ::INT AS rejected,
          COUNT(*) FILTER (WHERE status = 'reset')              ::INT AS reset,
          COUNT(*) FILTER (WHERE status = 'flagged')            ::INT AS flagged,
          COUNT(*) FILTER (WHERE status = 'all')                ::INT AS all,
          COUNT(*) FILTER (
            WHERE status = 'pending'
              AND created_at < NOW() - INTERVAL '24 hours'
          )                                                      ::INT AS overdue,
          COUNT(*) FILTER (
            WHERE assigned_admin_id IS NULL AND status = 'pending'
          )                                                      ::INT AS unassigned
        FROM identity_verifications
      `),

      pool.query(`
        SELECT
          COUNT(*)                                               ::INT AS total,
          COUNT(*) FILTER (WHERE status = 'pending')            ::INT AS pending,
          COUNT(*) FILTER (WHERE status = 'approved')           ::INT AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected')           ::INT AS rejected,
          COUNT(*) FILTER (WHERE status = 'reset')              ::INT AS reset,
          COUNT(*) FILTER (
            WHERE status = 'pending'
              AND created_at < NOW() - INTERVAL '24 hours'
          )                                                      ::INT AS overdue,
          COUNT(*) FILTER (
            WHERE assigned_admin_id IS NULL AND status = 'pending'
          )                                                      ::INT AS unassigned
        FROM store_verifications
      `),

      pool.query(`
        SELECT
          COUNT(*)                                               ::INT  AS total,
          COUNT(*) FILTER (WHERE email_verified    = TRUE)      ::INT  AS email_verified,
          COUNT(*) FILTER (WHERE identity_verified = TRUE)      ::INT  AS identity_verified,
          COUNT(*) FILTER (WHERE store_verified    = TRUE)      ::INT  AS store_verified,
          COUNT(*) FILTER (WHERE status = 'flagged')            ::INT  AS flagged,
          COUNT(*) FILTER (WHERE status = 'banned')             ::INT  AS banned,
          COALESCE(AVG(trust_score)::NUMERIC(5,2), 0)                  AS avg_trust_score
        FROM public.users
      `),

      pool.query(`
        SELECT
          COUNT(*)                                               ::INT AS total,
          COUNT(*) FILTER (WHERE active_until < NOW())          ::INT AS expired,
          COUNT(*) FILTER (
            WHERE active_until >= NOW() OR active_until IS NULL
          )                                                      ::INT AS live
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
      identity         : idQ.rows[0],
      store            : stQ.rows[0],
      users            : usQ.rows[0],
      limited_listings : liQ.rows[0],
      notes_last_7d    : noQ.rows[0].total,
    });

  } catch (err) {
    console.error("[stats]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   2.  GET /identity  — list
══════════════════════════════════════════════════════════════ */
router.get("/identity", async (req, res) => {
  const rawStatus = req.query.status ?? "pending";
  if (!VALID_ID_STATUSES.has(rawStatus))
    return fail(res, 400,
      `Invalid status. Valid values: ${[...VALID_ID_STATUSES].join(", ")}.`
    );

  const limit      = safeInt(req.query.limit,  PAGE_SIZE, MAX_LIMIT);
  const offset     = safeInt(req.query.offset, 0,         MAX_OFFSET);
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
         iv.id,
         iv.document_type,
         iv.status,
         iv.rejection_reason,
         iv.reviewed_by,
         iv.reviewed_at,
         iv.assigned_admin_id,
         iv.assigned_at,
         iv.created_at,
         iv.updated_at,
         iv.front_image_url,
         iv.back_image_url,
         iv.selfie_url,
         iv.document_number_hash,
         COALESCE(iv.risk_score,         0)            AS risk_score,
         COALESCE(iv.risk_flags,         '[]'::jsonb)  AS risk_flags,
         COALESCE(iv.flagged_for_review, FALSE)         AS flagged_for_review,
         COALESCE(iv.duplicate_warnings, '[]'::jsonb)  AS duplicate_warnings,
         COALESCE(iv.face_skipped,       FALSE)         AS face_skipped,
         iv.liveness_frame_url,
         iv.liveness_passed,
         iv.face_match,
         iv.face_confidence,
         u.id            AS user_id,
         u.name          AS user_name,
         u.email         AS user_email,
         u.phone_number  AS user_phone,
         u.status        AS user_status,
         u.trust_score,
         u.identity_verified,
         u.email_verified,
         aa.name         AS assigned_admin_name
       FROM  identity_verifications iv
       JOIN  public.users  u  ON u.id  = iv.user_id
       LEFT  JOIN public.users aa ON aa.id = iv.assigned_admin_id
       ${where}
       ORDER BY COALESCE(iv.risk_score, 0) DESC, iv.created_at ASC
       LIMIT  $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const { rows: cr } = await pool.query(
      `SELECT COUNT(*)::INT AS total
       FROM   identity_verifications iv ${where}`,
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
    if (err.code === "42703") {
      console.error(
        "[GET /identity] Missing column —",
        "run migrations/add_verification_risk_columns.sql\n",
        err.message
      );
      return fail(res, 503,
        "Database schema is out of date. " +
        "Run the latest migration and restart the server."
      );
    }
    console.error("[GET /identity]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   3a. POST /identity/bulk-approve
       MUST be before /identity/:id routes.
══════════════════════════════════════════════════════════════ */
router.post("/identity/bulk-approve", bulkRateLimit, async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const ids     = Array.isArray(req.body.ids) ? req.body.ids : [];
  const note    = (req.body.note ?? "Bulk approved.").trim();

  if (!ids.length)       return fail(res, 400, "ids array is required.");
  if (ids.length > BULK_MAX)
    return fail(res, 400, `Maximum ${BULK_MAX} records per bulk action.`);

  const results = { approved: [], skipped: [], failed: [] };

  await runParallel(ids, async (id) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `SELECT iv.user_id, iv.status, u.email, u.name
         FROM   identity_verifications iv
         JOIN   public.users u ON u.id = iv.user_id
         WHERE  iv.id = $1
         FOR UPDATE OF iv`,
        [id]
      );

      if (!rows.length || rows[0].status !== "pending") {
        await client.query("ROLLBACK");
        results.skipped.push(id);
        return;
      }

      const rec = rows[0];

      await client.query(
        "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
        [rec.user_id]
      );

      await client.query(
        `UPDATE identity_verifications
         SET    status             = 'approved',
                reviewed_by       = $2,
                reviewed_at       = NOW(),
                updated_at        = NOW()
         WHERE  id = $1`,
        [id, adminId]
      );

      await client.query(
        `UPDATE public.users
         SET    identity_verified    = TRUE,
                identity_verified_at = NOW(),
                updated_at           = NOW()
         WHERE  id = $1`,
        [rec.user_id]
      );

      const trustScore = await refreshAndPersistTrust(client, rec.user_id);

      await addNote(client, {
        verificationId  : id,
        verificationType: "identity",
        adminId,
        action          : "approved",
        note,
      });

      await client.query("COMMIT");

      reactivateLimitedListings(rec.user_id).catch(() => {});
      notifyIdentityApproved({
        userId: rec.user_id, email: rec.email, name: rec.name,
      });

      results.approved.push({
        id, user_id: rec.user_id, trust_score: trustScore,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      results.failed.push({ id, error: err.message });
    } finally {
      client.release();
    }
  });

  log({
    adminId,
    action   : "bulk_approve_identity",
    targetId : "bulk",
    details  :
      `Bulk approved ${results.approved.length} of ${ids.length} identities`,
    meta     : results,
    ip,
  });

  return res.json({ success: true, results });
});

/* ══════════════════════════════════════════════════════════════
   3b. POST /identity/bulk-reject
       MUST be before /identity/:id routes.
══════════════════════════════════════════════════════════════ */
router.post("/identity/bulk-reject", bulkRateLimit, async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const ids     = Array.isArray(req.body.ids) ? req.body.ids : [];
  const reason  = (req.body.reason ?? "").trim();

  if (!ids.length) return fail(res, 400, "ids array is required.");
  if (!reason)     return fail(res, 400, "Rejection reason is required.");
  if (reason.length > REASON_MAX_LEN)
    return fail(res, 400, `Reason must be ≤ ${REASON_MAX_LEN} characters.`);
  if (ids.length > BULK_MAX)
    return fail(res, 400, `Maximum ${BULK_MAX} records per bulk action.`);

  const results = { rejected: [], skipped: [], failed: [] };

  await runParallel(ids, async (id) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `SELECT iv.user_id, iv.status, u.email, u.name
         FROM   identity_verifications iv
         JOIN   public.users u ON u.id = iv.user_id
         WHERE  iv.id = $1
         FOR UPDATE OF iv`,
        [id]
      );

      if (!rows.length || rows[0].status !== "pending") {
        await client.query("ROLLBACK");
        results.skipped.push(id);
        return;
      }

      const { user_id, email, name } = rows[0];

      await client.query(
        "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
        [user_id]
      );

      await client.query(
        `UPDATE identity_verifications
         SET    status           = 'rejected',
                rejection_reason = $2,
                reviewed_by      = $3,
                reviewed_at      = NOW(),
                updated_at       = NOW()
         WHERE  id = $1`,
        [id, reason, adminId]
      );

      await client.query(
        `UPDATE public.users
         SET    identity_verified = FALSE, updated_at = NOW()
         WHERE  id = $1`,
        [user_id]
      );

      await downgradeListings(client, user_id);

      const trustScore = await refreshAndPersistTrust(client, user_id);

      await addNote(client, {
        verificationId  : id,
        verificationType: "identity",
        adminId,
        action          : "rejected",
        note            : reason,
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
  });

  log({
    adminId,
    action   : "bulk_reject_identity",
    targetId : "bulk",
    details  :
      `Bulk rejected ${results.rejected.length} of ${ids.length} identities`,
    meta     : results,
    ip,
  });

  return res.json({ success: true, results });
});

/* ══════════════════════════════════════════════════════════════
   4a. GET /identity/:id  — single
══════════════════════════════════════════════════════════════ */
router.get("/identity/:id", async (req, res) => {
  try {
    const [verRes, notes, timeline] = await Promise.all([
      pool.query(
        `SELECT
           iv.id, iv.document_type, iv.status,
           iv.rejection_reason, iv.reviewed_by, iv.reviewed_at,
           iv.assigned_admin_id, iv.assigned_at,
           iv.created_at, iv.updated_at,
           iv.front_image_url, iv.back_image_url, iv.selfie_url,
           iv.document_number_hash,
           COALESCE(iv.risk_score,         0)            AS risk_score,
           COALESCE(iv.risk_flags,         '[]'::jsonb)  AS risk_flags,
           COALESCE(iv.flagged_for_review, FALSE)         AS flagged_for_review,
           COALESCE(iv.duplicate_warnings, '[]'::jsonb)  AS duplicate_warnings,
           COALESCE(iv.face_skipped,       FALSE)         AS face_skipped,
           iv.liveness_frame_url,
           iv.liveness_passed,
           iv.face_match,
           iv.face_confidence,
           u.id            AS user_id,
           u.name          AS user_name,
           u.email         AS user_email,
           u.phone_number  AS user_phone,
           u.status        AS user_status,
           u.trust_score,
           u.identity_verified,
           u.email_verified,
           u.store_verified,
           u.created_at    AS user_created_at
         FROM identity_verifications iv
         JOIN public.users u ON u.id = iv.user_id
         WHERE iv.id = $1`,
        [req.params.id]
      ),
      getNotes(pool, req.params.id, "identity"),
      getTimeline(pool, req.params.id, "identity"),
    ]);

    if (!verRes.rows.length)
      return fail(res, 404, "Identity verification not found.");

    const rec = verRes.rows[0];

    /* Compute duplicate warnings if not already stored */
    const duplicateWarnings =
      rec.duplicate_warnings?.length
        ? rec.duplicate_warnings
        : await buildDuplicateWarnings(
            pool, rec.user_id, rec.document_number_hash
          );

    const { expires, signature } = generateSignedUrl(
      req.params.id, "front", req.admin.id
    );

    return res.json({
      success      : true,
      verification : {
        ...rec,
        duplicate_warnings : duplicateWarnings,
        timeline,
        document_urls : {
          front  : `/api/admin/verification/identity/${req.params.id}/files/front`,
          back   : `/api/admin/verification/identity/${req.params.id}/files/back`,
          selfie : `/api/admin/verification/identity/${req.params.id}/files/selfie`,
          token  : `${expires}:${signature}`,
          ttl    : SIGNED_URL_TTL,
        },
      },
      notes,
    });

  } catch (err) {
    console.error("[GET /identity/:id]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   4b. GET /identity/:id/files/:field  — signed document redirect
══════════════════════════════════════════════════════════════ */
router.get("/identity/:id/files/:field", async (req, res) => {
  const { id, field } = req.params;

  if (!VALID_DOC_FIELDS.has(field))
    return fail(res, 400, "Invalid field. Use: front, back, selfie.");

  const tokenErr = verifySignedToken(
    req.query.token, id, field, req.admin.id
  );
  if (tokenErr) return fail(res, 401, tokenErr);

  try {
    const colMap = {
      front  : "front_image_url",
      back   : "back_image_url",
      selfie : "selfie_url",
    };
    const { rows } = await pool.query(
      `SELECT ${colMap[field]} AS url
       FROM   identity_verifications WHERE id = $1`,
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
   4c. POST /identity/:id/approve  — granular (identity only)
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
      `SELECT iv.id, iv.user_id, iv.status AS current_status,
              iv.document_number_hash, u.email, u.name
       FROM   identity_verifications iv
       JOIN   public.users u ON u.id = iv.user_id
       WHERE  iv.id = $1
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
      const { rows: dup } = await client.query(
        `SELECT id FROM identity_verifications
         WHERE  document_number_hash = $1
           AND  user_id             <> $2
           AND  status               = 'approved'
         LIMIT 3`,
        [rec.document_number_hash, rec.user_id]
      );
      if (dup.length) {
        await client.query(
          `UPDATE identity_verifications
           SET    status = 'flagged', flagged_for_review = TRUE,
                  risk_score = GREATEST(COALESCE(risk_score,0), 90),
                  updated_at = NOW()
           WHERE  id = $1`,
          [req.params.id]
        );
        await addNote(client, {
          verificationId  : req.params.id,
          verificationType: "identity",
          adminId,
          action          : "flagged",
          note            : `Blocked: document matches ${dup.length} approved account(s).`,
        });
        await client.query("COMMIT");
        return fail(res, 409,
          "Duplicate document. Verification flagged.", { flagged: true }
        );
      }
    }

    /* Lock user row */
    await client.query(
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [rec.user_id]
    );

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
    notifyIdentityApproved({
      userId: rec.user_id, email: rec.email, name: rec.name,
    });

    log({
      adminId, action: "approve_identity", targetId: req.params.id,
      details : `Approved identity for user ${rec.user_id}`,
      meta    : { trust_score: trustScore, note },
      userId  : rec.user_id, ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Identity approved. Approval email sent.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /identity/:id/approve]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   4d. POST /identity/:id/reject
══════════════════════════════════════════════════════════════ */
router.post("/identity/:id/reject", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const reason  = (req.body.reason ?? "").trim();

  if (!reason)
    return fail(res, 400, "Rejection reason is required.");
  if (reason.length > REASON_MAX_LEN)
    return fail(res, 400, `Reason must be ≤ ${REASON_MAX_LEN} characters.`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT iv.user_id, iv.status AS current_status, u.email, u.name
       FROM   identity_verifications iv
       JOIN   public.users u ON u.id = iv.user_id
       WHERE  iv.id = $1
       FOR UPDATE OF iv`,
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
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [user_id]
    );

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

    await downgradeListings(client, user_id);

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
      message     : "Identity rejected. Rejection email sent.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /identity/:id/reject]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   4e. POST /identity/:id/reset
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
       WHERE  iv.id = $1
       FOR UPDATE OF iv`,
      [req.params.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Identity verification not found.");
    }

    const { user_id, email, name } = rows[0];

    await client.query(
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [user_id]
    );

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
      message     : "Identity reset. Resubmission email sent.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /identity/:id/reset]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   4f. POST /identity/:id/assign
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
   4g. POST /identity/:id/note
══════════════════════════════════════════════════════════════ */
router.post("/identity/:id/note", async (req, res) => {
  const adminId = req.admin.id;
  const note    = (req.body.note ?? "").trim();

  if (!note) return fail(res, 400, "Note is required.");
  if (note.length > NOTE_MAX_LEN)
    return fail(res, 400, `Note must be ≤ ${NOTE_MAX_LEN} characters.`);

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
   5.  GET /store  — list
══════════════════════════════════════════════════════════════ */
router.get("/store", async (req, res) => {
  const rawStatus = req.query.status ?? "pending";
  if (!VALID_STORE_STATUSES.has(rawStatus))
    return fail(res, 400,
      `Invalid status. Valid values: ${[...VALID_STORE_STATUSES].join(", ")}.`
    );

  const limit  = safeInt(req.query.limit,  PAGE_SIZE, MAX_LIMIT);
  const offset = safeInt(req.query.offset, 0,         MAX_OFFSET);

  try {
    const params     = [];
    const conditions = [];

    if (rawStatus !== "all") {
      params.push(rawStatus);
      conditions.push(`sv.status = $${params.length}`);
    }

    const where      = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const listParams = [...params, limit, offset];

    const { rows } = await pool.query(
      `SELECT
         sv.id, sv.documents_url, sv.status,
         sv.rejection_reason, sv.reviewed_by, sv.reviewed_at,
         sv.assigned_admin_id, sv.assigned_at,
         sv.created_at, sv.updated_at,
         u.id            AS user_id,
         u.name          AS user_name,
         u.email         AS user_email,
         u.phone_number  AS user_phone,
         u.status        AS user_status,
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
      `SELECT COUNT(*)::INT AS total
       FROM store_verifications sv ${where}`,
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
    console.error("[GET /store]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   6a. GET /store/:id  — single
══════════════════════════════════════════════════════════════ */
router.get("/store/:id", async (req, res) => {
  try {
    const [verRes, notes, timeline] = await Promise.all([
      pool.query(
        `SELECT
           sv.id, sv.documents_url, sv.status,
           sv.rejection_reason, sv.reviewed_by, sv.reviewed_at,
           sv.assigned_admin_id, sv.assigned_at,
           sv.created_at, sv.updated_at,
           u.id            AS user_id,
           u.name          AS user_name,
           u.email         AS user_email,
           u.phone_number  AS user_phone,
           u.status        AS user_status,
           u.trust_score,
           u.store_verified,
           u.identity_verified,
           u.email_verified,
           u.created_at    AS user_created_at
         FROM store_verifications sv
         JOIN public.users u ON u.id = sv.user_id
         WHERE sv.id = $1`,
        [req.params.id]
      ),
      getNotes(pool, req.params.id, "store"),
      getTimeline(pool, req.params.id, "store"),
    ]);

    if (!verRes.rows.length)
      return fail(res, 404, "Store verification not found.");

    return res.json({
      success      : true,
      verification : { ...verRes.rows[0], timeline },
      notes,
    });

  } catch (err) {
    console.error("[GET /store/:id]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   6b. POST /store/:id/approve
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
       WHERE sv.id = $1
       FOR UPDATE OF sv`,
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
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [rec.user_id]
    );

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

    notifyStoreApproved({
      userId: rec.user_id, email: rec.email, name: rec.name,
    });

    log({
      adminId, action: "approve_store", targetId: req.params.id,
      details : `Approved store for user ${rec.user_id}`,
      meta    : { trust_score: trustScore, note },
      userId  : rec.user_id, ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Store approved. Approval email sent.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /store/:id/approve]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   6c. POST /store/:id/reject
══════════════════════════════════════════════════════════════ */
router.post("/store/:id/reject", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const reason  = (req.body.reason ?? "").trim();

  if (!reason)
    return fail(res, 400, "Rejection reason is required.");
  if (reason.length > REASON_MAX_LEN)
    return fail(res, 400, `Reason must be ≤ ${REASON_MAX_LEN} characters.`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT sv.user_id, sv.status AS current_status, u.email, u.name
       FROM   store_verifications sv
       JOIN   public.users u ON u.id = sv.user_id
       WHERE  sv.id = $1
       FOR UPDATE OF sv`,
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
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [user_id]
    );

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
      message     : "Store rejected. Rejection email sent.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /store/:id/reject]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   6d. POST /store/:id/reset
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
       WHERE  sv.id = $1
       FOR UPDATE OF sv`,
      [req.params.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Store verification not found.");
    }

    const { user_id, email, name } = rows[0];

    await client.query(
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [user_id]
    );

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
      message     : "Store reset. Resubmission email sent.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /store/:id/reset]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   6e. POST /store/:id/assign
══════════════════════════════════════════════════════════════ */
router.post("/store/:id/assign", async (req, res) => {
  const adminId         = req.admin.id;
  const ip              = getIp(req);
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

    log({
      adminId, action: "assign_store", targetId: req.params.id,
      details : `Assigned store to admin ${assignedAdminId}`,
      meta    : { assigned_to: assignedAdminId },
      userId  : rows[0].user_id, ip,
    });

    return res.json({ success: true, assigned_to: assignedAdminId });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   6f. POST /store/:id/note
══════════════════════════════════════════════════════════════ */
router.post("/store/:id/note", async (req, res) => {
  const adminId = req.admin.id;
  const note    = (req.body.note ?? "").trim();

  if (!note) return fail(res, 400, "Note is required.");
  if (note.length > NOTE_MAX_LEN)
    return fail(res, 400, `Note must be ≤ ${NOTE_MAX_LEN} characters.`);

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
   7a. POST /email/:userId/force-verify  (super-admin)
══════════════════════════════════════════════════════════════ */
router.post(
  "/email/:userId/force-verify",
  requireSuperAdmin,
  async (req, res) => {
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
  }
);

/* ══════════════════════════════════════════════════════════════
   7b. POST /email/:userId/revoke  (super-admin)
══════════════════════════════════════════════════════════════ */
router.post(
  "/email/:userId/revoke",
  requireSuperAdmin,
  async (req, res) => {
    const adminId = req.admin.id;
    const ip      = getIp(req);
    const userId  = req.params.userId;
    const reason  =
      (req.body.reason ?? "Revoked by super-admin.").trim();

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
        message :
          `Your email verification has been revoked. Reason: ${reason}`,
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
  }
);

/* ══════════════════════════════════════════════════════════════
   8.  POST /trust/:userId/recalculate
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

/* ══════════════════════════════════════════════════════════════
   ████████████████████████████████████████████████████████████
   9.  UNIFIED ENDPOINTS  —  /:userId/approve|reject|reset
       Registered LAST so all static-prefix routes above
       match first.
   ████████████████████████████████████████████████████████████
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   POST /:userId/approve
   • store record is fully optional
   • accepts any non-approved identity status
   • email_verified is a warning, not a hard block
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

    /* Already fully verified — nothing to do */
    if (user.identity_verified && user.store_verified) {
      await client.query("ROLLBACK");
      return res.json({
        success : true,
        message : "User is already fully verified.",
      });
    }

    /* Restricted account */
    if (user.status === "flagged" || user.status === "banned") {
      await client.query("ROLLBACK");
      return fail(res, 403, "Account is restricted and cannot be approved.");
    }

    /* Email warning — log but do not block */
    if (!user.email_verified) {
      console.warn(
        "[approve-all] approving user with unverified email:", userId
      );
    }

    /* ── Lock latest identity — any non-approved status ── */
    const { rows: idRows } = await client.query(
      `SELECT id, document_number_hash, status
       FROM   identity_verifications
       WHERE  user_id = $1
         AND  status != 'approved'
       ORDER  BY created_at DESC
       LIMIT  1
       FOR UPDATE`,
      [userId]
    );

    if (!idRows.length) {
      await client.query("ROLLBACK");

      /* Precise error: distinguish "never submitted" from "already approved" */
      const { rows: any } = await client.query(
        `SELECT status FROM identity_verifications
         WHERE  user_id = $1
         ORDER  BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (!any.length)
        return fail(res, 404,
          "No identity verification found. " +
          "The user has not submitted documents yet."
        );

      return res.json({
        success : true,
        message :
          `Identity is already approved (status: ${any[0].status}). ` +
          "Nothing to do.",
      });
    }

    const idRec = idRows[0];

    /* ── Duplicate document guard ── */
    if (idRec.document_number_hash) {
      const { rows: dup } = await client.query(
        `SELECT id FROM identity_verifications
         WHERE  document_number_hash = $1
           AND  user_id             <> $2
           AND  status               = 'approved'
         LIMIT  3`,
        [idRec.document_number_hash, userId]
      );

      if (dup.length) {
        await client.query(
          `UPDATE identity_verifications
           SET    status             = 'flagged',
                  flagged_for_review = TRUE,
                  risk_score        = GREATEST(COALESCE(risk_score,0), 90),
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
            `Blocked: document hash matches ${dup.length} ` +
            `already-approved account(s). Manual review required.`,
        });
        await client.query("COMMIT");
        log({
          adminId,
          action   : "flag_identity_duplicate",
          targetId : idRec.id,
          details  : `Duplicate document for user ${userId}`,
          meta     : { duplicate_count: dup.length, risk_score: 90 },
          userId, ip,
        });
        return fail(
          res, 409,
          `Duplicate document detected across ${dup.length} approved account(s). ` +
          `Verification flagged for manual review.`,
          { flagged: true }
        );
      }
    }

    /* ── Store record — optional ── */
    const { rows: storeRows } = await client.query(
      `SELECT id, status
       FROM   store_verifications
       WHERE  user_id = $1
       ORDER  BY created_at DESC
       LIMIT  1
       FOR UPDATE`,
      [userId]
    );

    const storeRec         = storeRows[0] ?? null;
    const hasStore         = storeRec !== null;
    const storeNeedsUpdate = hasStore && storeRec.status !== "approved";

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

    /* ── Approve store if it exists and is not already approved ── */
    if (storeNeedsUpdate) {
      await client.query(
        `UPDATE store_verifications
         SET    status      = 'approved',
                reviewed_by = $2,
                reviewed_at = NOW(),
                updated_at  = NOW()
         WHERE  id = $1`,
        [storeRec.id, adminId]
      );
    }

    /* ── Update user flags ── */
    await client.query(
      `UPDATE public.users
       SET    identity_verified    = TRUE,
              identity_verified_at = NOW(),
              store_verified       = CASE WHEN $2 THEN TRUE
                                         ELSE store_verified END,
              store_verified_at    = CASE WHEN $2 THEN NOW()
                                         ELSE store_verified_at END,
              updated_at           = NOW()
       WHERE  id = $1`,
      [userId, hasStore]
    );

    /* ── Trust score (user row already locked) ── */
    const trustScore = await refreshAndPersistTrust(client, userId);

    /* ── Notes ── */
    const noteOps = [
      addNote(client, {
        verificationId  : idRec.id,
        verificationType: "identity",
        adminId, action: "approved", note,
      }),
    ];
    if (storeNeedsUpdate) {
      noteOps.push(
        addNote(client, {
          verificationId  : storeRec.id,
          verificationType: "store",
          adminId, action: "approved", note,
        })
      );
    }
    await Promise.all(noteOps);

    await client.query("COMMIT");

    console.log(
      "[admin] ✓ approve-all",
      "userId:", userId,
      "| idStatus:", idRec.status,
      "| storeStatus:", storeRec?.status ?? "none",
      "| trust:", trustScore
    );

    /* ── Post-commit side effects ── */
    reactivateLimitedListings(userId).catch((e) =>
      console.error("[approve-all] reactivate:", e.message)
    );
    notifyApproved({ userId, email: user.email, name: user.name });

    log({
      adminId,
      action   : "approve_all",
      targetId : userId,
      details  :
        `Approved identity${hasStore ? " + store" : ""} for user ${userId}`,
      meta : {
        identity_verification_id : idRec.id,
        identity_previous_status : idRec.status,
        store_verification_id    : storeRec?.id     ?? null,
        store_previous_status    : storeRec?.status ?? "none",
        store_was_pre_approved   : hasStore && !storeNeedsUpdate,
        has_store                : hasStore,
        trust_score              : trustScore,
        note,
      },
      userId, ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      approved    : {
        identity : idRec.id,
        store    : storeRec?.id ?? null,
      },
      message :
        `Identity${hasStore ? " and store" : ""} approved. ` +
        "Approval email sent. Listings reactivated.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /:userId/approve]", err.message, err.stack);
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
    return fail(res, 400, `Reason must be ≤ ${REASON_MAX_LEN} characters.`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: userRows } = await client.query(
      `SELECT id, email, name, status
       FROM public.users WHERE id = $1
       FOR UPDATE`,
      [userId]
    );

    if (!userRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "User not found.");
    }

    const user = userRows[0];

    /* Lock pending identity */
    const { rows: idRows } = await client.query(
      `SELECT id, status FROM identity_verifications
       WHERE user_id = $1
         AND status IN ('pending','flagged')
       ORDER BY created_at DESC LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    /* Lock pending store */
    const { rows: storeRows } = await client.query(
      `SELECT id, status FROM store_verifications
       WHERE user_id = $1
         AND status IN ('pending','reset')
       ORDER BY created_at DESC LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (!idRows.length && !storeRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404,
        "No pending verifications found for this user."
      );
    }

    if (idRows.length) {
      await client.query(
        `UPDATE identity_verifications
         SET    status = 'rejected', rejection_reason = $2,
                reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE  id = $1`,
        [idRows[0].id, reason, adminId]
      );
      await addNote(client, {
        verificationId  : idRows[0].id,
        verificationType: "identity",
        adminId, action: "rejected", note: reason,
      });
    }

    if (storeRows.length) {
      await client.query(
        `UPDATE store_verifications
         SET    status = 'rejected', rejection_reason = $2,
                reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE  id = $1`,
        [storeRows[0].id, reason, adminId]
      );
      await addNote(client, {
        verificationId  : storeRows[0].id,
        verificationType: "store",
        adminId, action: "rejected", note: reason,
      });
    }

    await client.query(
      `UPDATE public.users
       SET    identity_verified = FALSE,
              store_verified    = FALSE,
              updated_at        = NOW()
       WHERE  id = $1`,
      [userId]
    );

    /* Always downgrade listings on any rejection */
    await downgradeListings(client, userId);

    const trustScore = await refreshAndPersistTrust(client, userId);

    await client.query("COMMIT");

    console.log(
      "[admin] ✓ reject-all",
      "userId:", userId, "| trust:", trustScore
    );

    notifyRejected({
      userId, email: user.email, name: user.name, reason,
    });

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
      userId, ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      rejected    : {
        identity : idRows[0]?.id    ?? null,
        store    : storeRows[0]?.id ?? null,
      },
      message : "Verification rejected. Rejection email sent.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /:userId/reject]", err.message, err.stack);
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

    const { rows: userRows } = await client.query(
      `SELECT id, email, name FROM public.users WHERE id = $1 FOR UPDATE`,
      [userId]
    );

    if (!userRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "User not found.");
    }

    const user = userRows[0];

    const { rows: idRows } = await client.query(
      `SELECT id FROM identity_verifications
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1
       FOR UPDATE`,
      [userId]
    );

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

    if (idRows.length) {
      await client.query(
        `UPDATE identity_verifications
         SET    status = 'reset', rejection_reason = $2,
                reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE  id = $1`,
        [idRows[0].id, note, adminId]
      );
      await addNote(client, {
        verificationId  : idRows[0].id,
        verificationType: "identity",
        adminId, action: "reset", note,
      });
    }

    if (storeRows.length) {
      await client.query(
        `UPDATE store_verifications
         SET    status = 'reset', rejection_reason = $2,
                reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE  id = $1`,
        [storeRows[0].id, note, adminId]
      );
      await addNote(client, {
        verificationId  : storeRows[0].id,
        verificationType: "store",
        adminId, action: "reset", note,
      });
    }

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
      "[admin] ✓ reset-all",
      "userId:", userId, "| trust:", trustScore
    );

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
      userId, ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      reset       : {
        identity : idRows[0]?.id    ?? null,
        store    : storeRows[0]?.id ?? null,
      },
      message : "Verification reset. Resubmission email sent.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /:userId/reset]", err.message, err.stack);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

export default router;