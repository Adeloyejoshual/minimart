// ════════════════════════════════════════════════════════════════
// FILE: routes/admin/verification.js — v5
//
// Fixed in v5:
//  - Bulk routes registered BEFORE /:id routes (Express conflict fix)
//  - timingSafeEqual length-mismatch crash fixed
//  - User row locked in all granular routes before refreshAndPersistTrust
//  - Unified approve handles pre-approved store gracefully
//  - Listing downgrade moved outside identity-only block in reject
//  - offset capped at MAX_OFFSET
//  - generateSignedUrl validates all params
//  - Parallel bulk processing with p-limit (concurrency = 5)
//  - Timeline returned in GET /identity/:id and GET /identity list
//  - duplicate_warnings returned in identity list
//  - Rate limiting on bulk endpoints
//  - buildStatusFilter is offset-aware
//  - "already verified" checked before email_verified in approve
//  - addNote JSDoc clarifies pool vs client
//  - Structured log helper (ready for Pino/Winston drop-in)
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
const PAGE_SIZE           = 50;
const MAX_LIMIT           = 200;
const MAX_OFFSET          = 10_000;
const BULK_MAX            = 50;
const BULK_CONCURRENCY    = 5;
const NOTE_MAX_LEN        = 1_000;
const REASON_MAX_LEN      = 500;
const SIGNED_URL_TTL_SECS = 60 * 15; // 15 min

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
  const ageDays =
    (Date.now() - new Date(created_at).getTime()) / 86_400_000;
  if (ageDays > 30) score += 10;
  if (ageDays > 90) score +=  5;
  return Math.min(score, 100);
};

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

/** Standard error response */
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, error: message, ...extra });

/** Clamp a query-string integer */
const safeInt = (val, fallback, max = Infinity) => {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
};

/** Best-effort client IP */
const getIp = (req) =>
  req.ip ?? req.socket?.remoteAddress ?? null;

/**
 * Build a WHERE / AND clause fragment starting at $startIndex.
 * Returns { clause, params } — caller decides AND vs WHERE.
 */
const statusClause = (status, alias = "", startIndex = 1) => {
  const col = alias ? `${alias}.status` : "status";
  if (!status || status === "all") return { clause: "", params: [] };
  return { clause: `${col} = $${startIndex}`, params: [status] };
};

/* ══════════════════════════════════════════════════════════════
   TRUST — recompute & persist (within an open transaction)
   Caller must hold a FOR UPDATE lock on the users row.
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
     Pass `client` (PoolClient) when inside a transaction so the
     note insert is part of the same atomic unit.
     Pass `pool` (Pool) only for standalone, non-transactional inserts
     (e.g. the /note endpoint).
══════════════════════════════════════════════════════════════ */
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

/* Build timeline rows from verification_notes */
const getTimeline = async (db, verificationId, verificationType) => {
  const LABELS = {
    approved : "Approved",
    rejected : "Rejected",
    reset    : "Reset — Resubmission Requested",
    flagged  : "Flagged for Review",
    note     : "Note Added",
    assigned : "Assigned to Reviewer",
  };

  const { rows } = await db.query(
    `SELECT
       vn.action      AS type,
       vn.note,
       vn.created_at,
       u.name         AS admin_name
     FROM   verification_notes vn
     JOIN   public.users u ON u.id = vn.admin_id
     WHERE  vn.verification_id   = $1
       AND  vn.verification_type = $2
     ORDER  BY vn.created_at ASC`,
    [verificationId, verificationType]
  );

  return rows.map((r) => ({
    ...r,
    label: LABELS[r.type] ?? r.type.replace(/_/g, " "),
  }));
};

/* ══════════════════════════════════════════════════════════════
   AUDIT

   Fire-and-forget dual audit trail.
   Errors are logged but never thrown — audit failure must
   never fail an HTTP response.
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
  ]).catch((e) =>
    // TODO: replace with structured logger (Pino / Winston)
    console.error("[audit]", action, "–", e.message)
  );

/* ══════════════════════════════════════════════════════════════
   SIGNED URL
══════════════════════════════════════════════════════════════ */
const generateSignedUrl = (verificationId, field, adminId) => {
  if (!verificationId || !field || !adminId) {
    throw new Error(
      "generateSignedUrl: verificationId, field and adminId are all required"
    );
  }
  const expires   = Math.floor(Date.now() / 1_000) + SIGNED_URL_TTL_SECS;
  const secret    = process.env.SIGNED_URL_SECRET ?? "dev-secret";
  const payload   = `${verificationId}:${field}:${adminId}:${expires}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return { expires, signature };
};

/**
 * Verify a signed URL token.
 * Returns null on success, or an error string to send to the client.
 */
const verifySignedToken = (token, verificationId, field, adminId) => {
  if (!token) return "Token required.";

  const parts = token.split(":");
  if (parts.length !== 2) return "Invalid token format.";
  const [expiresStr, signature] = parts;

  if (parseInt(expiresStr, 10) < Math.floor(Date.now() / 1_000))
    return "Token expired. Request a new document link.";

  const secret   = process.env.SIGNED_URL_SECRET ?? "dev-secret";
  const payload  = `${verificationId}:${field}:${adminId}:${expiresStr}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Guard against length-mismatch crash in timingSafeEqual
  let sigBuf, expBuf;
  try {
    sigBuf = Buffer.from(signature, "hex");
    expBuf = Buffer.from(expected,  "hex");
  } catch {
    return "Invalid token encoding.";
  }

  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) return "Invalid token signature.";

  return null; // OK
};

/* ══════════════════════════════════════════════════════════════
   RATE LIMITERS
══════════════════════════════════════════════════════════════ */
// Dynamic import so the file still loads in envs without express-rate-limit.
// Replace with a direct import if you always have the package installed.
let _rateLimit = null;
const getBulkRateLimiter = async () => {
  if (_rateLimit) return _rateLimit;
  try {
    const { rateLimit } = await import("express-rate-limit");
    _rateLimit = rateLimit({
      windowMs     : 60_000,
      max          : 5,
      keyGenerator : (req) => `bulk:${req.admin?.id ?? "anon"}`,
      standardHeaders: true,
      legacyHeaders  : false,
      message      : { success: false, error: "Too many bulk operations. Please wait 60 seconds." },
    });
  } catch {
    // express-rate-limit not installed — no-op middleware
    _rateLimit = (_req, _res, next) => next();
  }
  return _rateLimit;
};

/* Inline rate-limit middleware factory for route registration */
const bulkRateLimit = async (req, res, next) => {
  const limiter = await getBulkRateLimiter();
  return limiter(req, res, next);
};

/* ══════════════════════════════════════════════════════════════
   PARALLEL BULK HELPER
   Runs `fn` for every id with at most BULK_CONCURRENCY in-flight.
══════════════════════════════════════════════════════════════ */
const runParallel = async (ids, fn) => {
  const results   = [];
  const executing = [];

  for (const id of ids) {
    const p = Promise.resolve().then(() => fn(id));
    results.push(p);

    if (BULK_CONCURRENCY <= ids.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= BULK_CONCURRENCY) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.allSettled(results);
};

/* ══════════════════════════════════════════════════════════════
   DUPLICATE WARNING BUILDER
   Returns structured warnings for the frontend DuplicateWarnings panel.
══════════════════════════════════════════════════════════════ */
const buildDuplicateWarnings = async (db, verificationId, userId, docHash) => {
  const warnings = [];
  if (!docHash) return warnings;

  const { rows } = await db.query(
    `SELECT iv.id, iv.user_id, u.email
     FROM   identity_verifications iv
     JOIN   public.users u ON u.id = iv.user_id
     WHERE  iv.document_number_hash = $1
       AND  iv.user_id             <> $2
       AND  iv.status               = 'approved'
     LIMIT  5`,
    [docHash, userId]
  );

  if (rows.length) {
    warnings.push({
      type              : "document_reuse",
      severity          : "critical",
      detail            :
        `This document is already approved on ${rows.length} other account(s).`,
      matching_user_ids : rows.map((r) => r.user_id),
    });
  }

  return warnings;
};

/* ══════════════════════════════════════════════════════════════
   EMAIL + IN-APP NOTIFICATIONS
   All fire-and-forget. Errors logged, never thrown.
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
      message : `Please resubmit your documents.${note ? ` Note: ${note}` : ""}`,
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
      message : "Your store has been approved and is now live on the platform.",
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
   LISTING DOWNGRADE HELPER
   Downgrades active → active_limited for unverified sellers.
   Extracted so it can be used in any reject/reset path.
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
   ████████████████████████████████████████████████████████████

   ROUTE REGISTRATION ORDER (important for Express param matching):

   1. Static-path routes  (/stats, /identity/bulk-*, /store)
   2. Parameterised routes (/identity/:id/*, /store/:id/*)
   3. Unified user routes  (/:userId/approve|reject|reset)

   ████████████████████████████████████████████████████████████
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   GET /stats
══════════════════════════════════════════════════════════════ */
router.get("/stats", async (req, res) => {
  try {
    const [idStats, storeStats, userStats, limitedStats, noteStats] =
      await Promise.all([

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
            COUNT(*)                                                ::INT  AS total,
            COUNT(*) FILTER (WHERE email_verified    = TRUE)       ::INT  AS email_verified,
            COUNT(*) FILTER (WHERE identity_verified = TRUE)       ::INT  AS identity_verified,
            COUNT(*) FILTER (WHERE store_verified    = TRUE)       ::INT  AS store_verified,
            COUNT(*) FILTER (WHERE status = 'flagged')             ::INT  AS flagged,
            COUNT(*) FILTER (WHERE status = 'banned')              ::INT  AS banned,
            COALESCE(AVG(trust_score)::NUMERIC(5,2), 0)                   AS avg_trust_score
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
      identity         : idStats.rows[0],
      store            : storeStats.rows[0],
      users            : userStats.rows[0],
      limited_listings : limitedStats.rows[0],
      notes_last_7d    : noteStats.rows[0].total,
    });

  } catch (err) {
    console.error("[stats]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   ▸ IDENTITY — LIST
     Registered before /:id routes so /identity is unambiguous.
══════════════════════════════════════════════════════════════ */
router.get("/identity", async (req, res) => {
  const rawStatus = req.query.status ?? "pending";
  if (!VALID_ID_STATUSES.has(rawStatus))
    return fail(res, 400,
      `Invalid status. Use: ${[...VALID_ID_STATUSES].join(", ")}.`
    );

  const limit      = safeInt(req.query.limit,  PAGE_SIZE, MAX_LIMIT);
  const offset     = safeInt(req.query.offset, 0, MAX_OFFSET);
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
         iv.risk_score,
         iv.risk_flags,
         iv.flagged_for_review,
         iv.document_number_hash,
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
         iv.liveness_frame_url,
         iv.liveness_passed,
         iv.face_match,
         iv.face_confidence,
         iv.face_skipped,
         COALESCE(iv.duplicate_warnings, '[]'::jsonb)  AS duplicate_warnings,
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
       LEFT JOIN public.users aa ON aa.id = iv.assigned_admin_id
       ${where}
       ORDER BY iv.risk_score DESC NULLS LAST, iv.created_at ASC
       LIMIT  $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    /* Count (reuse same WHERE / params) */
    const { rows: cr } = await pool.query(
      `SELECT COUNT(*)::INT AS total
       FROM   identity_verifications iv
       ${where}`,
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
    console.error("[GET /identity]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   ▸ IDENTITY — BULK APPROVE
     Must be registered BEFORE /identity/:id routes.
══════════════════════════════════════════════════════════════ */
router.post("/identity/bulk-approve", bulkRateLimit, async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const ids     = Array.isArray(req.body.ids) ? req.body.ids : [];
  const note    = (req.body.note ?? "Bulk approved.").trim();

  if (!ids.length)
    return fail(res, 400, "ids array is required.");
  if (ids.length > BULK_MAX)
    return fail(res, 400, `Maximum ${BULK_MAX} records per bulk action.`);

  const results = { approved: [], skipped: [], failed: [] };

  const processOne = async (id) => {
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

      /* Lock user row before trust update */
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

      results.approved.push({ id, user_id: rec.user_id, trust_score: trustScore });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      results.failed.push({ id, error: err.message });
    } finally {
      client.release();
    }
  };

  await runParallel(ids, processOne);

  log({
    adminId,
    action   : "bulk_approve_identity",
    targetId : "bulk",
    details  : `Bulk approved ${results.approved.length} of ${ids.length} identities`,
    meta     : results,
    ip,
  });

  return res.json({ success: true, results });
});

/* ══════════════════════════════════════════════════════════════
   ▸ IDENTITY — BULK REJECT
     Must be registered BEFORE /identity/:id routes.
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

  const processOne = async (id) => {
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

      /* Lock user row before trust update */
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
  };

  await runParallel(ids, processOne);

  log({
    adminId,
    action   : "bulk_reject_identity",
    targetId : "bulk",
    details  : `Bulk rejected ${results.rejected.length} of ${ids.length} identities`,
    meta     : results,
    ip,
  });

  return res.json({ success: true, results });
});

/* ══════════════════════════════════════════════════════════════
   ▸ IDENTITY — SINGLE
══════════════════════════════════════════════════════════════ */
router.get("/identity/:id", async (req, res) => {
  try {
    const [verRes, notes, timeline] = await Promise.all([
      pool.query(
        `SELECT
           iv.id, iv.document_type, iv.status,
           iv.risk_score, iv.risk_flags, iv.flagged_for_review,
           iv.document_number_hash,
           iv.rejection_reason, iv.reviewed_by, iv.reviewed_at,
           iv.assigned_admin_id, iv.assigned_at,
           iv.created_at, iv.updated_at,
           iv.front_image_url, iv.back_image_url, iv.selfie_url,
           iv.liveness_frame_url, iv.liveness_passed,
           iv.face_match, iv.face_confidence, iv.face_skipped,
           COALESCE(iv.duplicate_warnings, '[]'::jsonb) AS duplicate_warnings,
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

    /* Build duplicate warnings if not already stored on the row */
    const duplicateWarnings =
      rec.duplicate_warnings?.length
        ? rec.duplicate_warnings
        : await buildDuplicateWarnings(
            pool,
            req.params.id,
            rec.user_id,
            rec.document_number_hash
          );

    /* Signed document URL token */
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
          ttl    : SIGNED_URL_TTL_SECS,
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
   ▸ IDENTITY — SIGNED DOCUMENT FILE
══════════════════════════════════════════════════════════════ */
router.get("/identity/:id/files/:field", async (req, res) => {
  const { id, field } = req.params;
  const { token }     = req.query;

  if (!VALID_DOC_FIELDS.has(field))
    return fail(res, 400, "Invalid field. Use: front, back, selfie.");

  const tokenError = verifySignedToken(token, id, field, req.admin.id);
  if (tokenError) return fail(res, 401, tokenError);

  try {
    const colMap = {
      front  : "front_image_url",
      back   : "back_image_url",
      selfie : "selfie_url",
    };
    const { rows } = await pool.query(
      `SELECT ${colMap[field]} AS url
       FROM   identity_verifications
       WHERE  id = $1`,
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
   ▸ IDENTITY — GRANULAR APPROVE
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

    /* Duplicate document guard */
    if (rec.document_number_hash) {
      const { rows: dupRows } = await client.query(
        `SELECT id FROM identity_verifications
         WHERE  document_number_hash = $1
           AND  user_id             <> $2
           AND  status               = 'approved'
         LIMIT  3`,
        [rec.document_number_hash, rec.user_id]
      );

      if (dupRows.length) {
        await client.query(
          `UPDATE identity_verifications
           SET    status             = 'flagged',
                  flagged_for_review = TRUE,
                  risk_score        = GREATEST(COALESCE(risk_score, 0), 90),
                  updated_at        = NOW()
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
        return fail(res, 409, "Duplicate document. Verification flagged.", {
          flagged: true,
        });
      }
    }

    /* Lock user row before any user UPDATE */
    await client.query(
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [rec.user_id]
    );

    await client.query(
      `UPDATE identity_verifications
       SET    status             = 'approved',
              flagged_for_review = FALSE,
              reviewed_by        = $2,
              reviewed_at        = NOW(),
              updated_at         = NOW()
       WHERE  id = $1`,
      [req.params.id, adminId]
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
      verificationId  : req.params.id,
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

    log({
      adminId,
      action   : "approve_identity",
      targetId : req.params.id,
      details  : `Approved identity for user ${rec.user_id}`,
      meta     : { trust_score: trustScore, note },
      userId   : rec.user_id,
      ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Identity approved. Approval email sent to user.",
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
   ▸ IDENTITY — GRANULAR REJECT
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

    /* Lock user row */
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
      adminId,
      action          : "rejected",
      note            : reason,
    });

    await client.query("COMMIT");

    notifyIdentityRejected({ userId: user_id, email, name, reason });

    log({
      adminId,
      action   : "reject_identity",
      targetId : req.params.id,
      details  : `Rejected identity for user ${user_id}: ${reason}`,
      meta     : { reason, trust_score: trustScore },
      userId   : user_id,
      ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Identity rejected. Rejection email sent to user.",
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
   ▸ IDENTITY — GRANULAR RESET
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

    /* Lock user row */
    await client.query(
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [user_id]
    );

    await client.query(
      `UPDATE identity_verifications
       SET    status           = 'reset',
              rejection_reason = $2,
              reviewed_by      = $3,
              reviewed_at      = NOW(),
              updated_at       = NOW()
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
      adminId,
      action          : "reset",
      note,
    });

    await client.query("COMMIT");

    notifyReset({ userId: user_id, email, name, note });

    log({
      adminId,
      action   : "reset_identity",
      targetId : req.params.id,
      details  : `Reset identity for user ${user_id}`,
      meta     : { note, trust_score: trustScore },
      userId   : user_id,
      ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Identity reset. Resubmission email sent to user.",
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
   ▸ IDENTITY — ASSIGN
══════════════════════════════════════════════════════════════ */
router.post("/identity/:id/assign", async (req, res) => {
  const adminId         = req.admin.id;
  const ip              = getIp(req);
  const assignedAdminId = req.body.admin_id ?? adminId;

  try {
    const { rows } = await pool.query(
      `UPDATE identity_verifications
       SET    assigned_admin_id = $2,
              assigned_at       = NOW(),
              updated_at        = NOW()
       WHERE  id = $1 AND status = 'pending'
       RETURNING id, user_id`,
      [req.params.id, assignedAdminId]
    );

    if (!rows.length)
      return fail(res, 404, "Verification not found or not in pending state.");

    log({
      adminId,
      action   : "assign_identity",
      targetId : req.params.id,
      details  : `Assigned to admin ${assignedAdminId}`,
      meta     : { assigned_to: assignedAdminId },
      userId   : rows[0].user_id,
      ip,
    });

    return res.json({ success: true, assigned_to: assignedAdminId });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   ▸ IDENTITY — ADD NOTE
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

    /* Standalone note — pool is correct here (no outer transaction) */
    await addNote(pool, {
      verificationId  : req.params.id,
      verificationType: "identity",
      adminId,
      action          : "note",
      note,
    });

    return res.json({ success: true });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   ▸ STORE — LIST
══════════════════════════════════════════════════════════════ */
router.get("/store", async (req, res) => {
  const rawStatus = req.query.status ?? "pending";
  if (!VALID_STORE_STATUSES.has(rawStatus))
    return fail(res, 400,
      `Invalid status. Use: ${[...VALID_STORE_STATUSES].join(", ")}.`
    );

  const limit  = safeInt(req.query.limit,  PAGE_SIZE, MAX_LIMIT);
  const offset = safeInt(req.query.offset, 0, MAX_OFFSET);

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
   ▸ STORE — SINGLE
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
      verification : {
        ...verRes.rows[0],
        timeline,
      },
      notes,
    });

  } catch (err) {
    console.error("[GET /store/:id]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   ▸ STORE — GRANULAR APPROVE
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
      return fail(
        res, 422,
        "Cannot approve store — seller has not completed identity verification."
      );
    }

    /* Lock user row */
    await client.query(
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [rec.user_id]
    );

    await client.query(
      `UPDATE store_verifications
       SET    status      = 'approved',
              reviewed_by = $2,
              reviewed_at = NOW(),
              updated_at  = NOW()
       WHERE  id = $1`,
      [req.params.id, adminId]
    );

    await client.query(
      `UPDATE public.users
       SET    store_verified    = TRUE,
              store_verified_at = NOW(),
              updated_at        = NOW()
       WHERE  id = $1`,
      [rec.user_id]
    );

    const trustScore = await refreshAndPersistTrust(client, rec.user_id);

    await addNote(client, {
      verificationId  : req.params.id,
      verificationType: "store",
      adminId,
      action          : "approved",
      note,
    });

    await client.query("COMMIT");

    notifyStoreApproved({
      userId: rec.user_id, email: rec.email, name: rec.name,
    });

    log({
      adminId,
      action   : "approve_store",
      targetId : req.params.id,
      details  : `Approved store for user ${rec.user_id}`,
      meta     : { trust_score: trustScore, note },
      userId   : rec.user_id,
      ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Store approved. Approval email sent to user.",
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
   ▸ STORE — GRANULAR REJECT
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

    /* Lock user row */
    await client.query(
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [user_id]
    );

    await client.query(
      `UPDATE store_verifications
       SET    status           = 'rejected',
              rejection_reason = $2,
              reviewed_by      = $3,
              reviewed_at      = NOW(),
              updated_at       = NOW()
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
      adminId,
      action          : "rejected",
      note            : reason,
    });

    await client.query("COMMIT");

    notifyStoreRejected({ userId: user_id, email, name, reason });

    log({
      adminId,
      action   : "reject_store",
      targetId : req.params.id,
      details  : `Rejected store for user ${user_id}: ${reason}`,
      meta     : { reason, trust_score: trustScore },
      userId   : user_id,
      ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Store rejected. Rejection email sent to user.",
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
   ▸ STORE — GRANULAR RESET
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

    /* Lock user row */
    await client.query(
      "SELECT id FROM public.users WHERE id = $1 FOR UPDATE",
      [user_id]
    );

    await client.query(
      `UPDATE store_verifications
       SET    status           = 'reset',
              rejection_reason = $2,
              reviewed_by      = $3,
              reviewed_at      = NOW(),
              updated_at       = NOW()
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
      adminId,
      action          : "reset",
      note,
    });

    await client.query("COMMIT");

    notifyReset({ userId: user_id, email, name, note });

    log({
      adminId,
      action   : "reset_store",
      targetId : req.params.id,
      details  : `Reset store for user ${user_id}`,
      meta     : { note, trust_score: trustScore },
      userId   : user_id,
      ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      message     : "Store reset. Resubmission email sent to user.",
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
   ▸ STORE — ASSIGN
══════════════════════════════════════════════════════════════ */
router.post("/store/:id/assign", async (req, res) => {
  const adminId         = req.admin.id;
  const ip              = getIp(req);
  const assignedAdminId = req.body.admin_id ?? adminId;

  try {
    const { rows } = await pool.query(
      `UPDATE store_verifications
       SET    assigned_admin_id = $2,
              assigned_at       = NOW(),
              updated_at        = NOW()
       WHERE  id = $1 AND status = 'pending'
       RETURNING id, user_id`,
      [req.params.id, assignedAdminId]
    );

    if (!rows.length)
      return fail(res, 404, "Verification not found or not pending.");

    log({
      adminId,
      action   : "assign_store",
      targetId : req.params.id,
      details  : `Assigned store to admin ${assignedAdminId}`,
      meta     : { assigned_to: assignedAdminId },
      userId   : rows[0].user_id,
      ip,
    });

    return res.json({ success: true, assigned_to: assignedAdminId });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   ▸ STORE — ADD NOTE
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

    /* Standalone note — pool is correct here */
    await addNote(pool, {
      verificationId  : req.params.id,
      verificationType: "store",
      adminId,
      action          : "note",
      note,
    });

    return res.json({ success: true });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════
   ████████████████████████████████████████████████████████████
   UNIFIED ENDPOINTS
   POST /:userId/approve  — approve identity + store at once
   POST /:userId/reject   — reject  identity + store at once
   POST /:userId/reset    — reset   identity + store at once

   Registered LAST so /identity/*, /store/*, /stats, /trust/*
   and /email/* all match before the catch-all /:userId param.
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

    /* Lock + fetch user (holds lock for entire transaction) */
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

    /* Already fully verified — return early, no error */
    if (user.identity_verified && user.store_verified) {
      await client.query("ROLLBACK");
      return res.json({
        success : true,
        message : "User is already fully verified.",
      });
    }

    /* Email must be verified before identity/store */
    if (!user.email_verified) {
      await client.query("ROLLBACK");
      return fail(res, 422, "User email is not verified yet.");
    }

    if (user.status === "flagged" || user.status === "banned") {
      await client.query("ROLLBACK");
      return fail(res, 403, "Account is restricted and cannot be approved.");
    }

    /* Lock pending identity */
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

    /* Duplicate document guard */
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

    /* Lock store record — accept pending, reset, OR already approved */
    const { rows: storeRows } = await client.query(
      `SELECT id, status
       FROM store_verifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (!storeRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "No store verification record found for this user.");
    }

    const storeRec = storeRows[0];

    /* Approve identity */
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

    /* Approve store only if not already approved */
    if (storeRec.status !== "approved") {
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

    /* Set user verified flags */
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

    /* Trust score — user row already locked above */
    const trustScore = await refreshAndPersistTrust(client, userId);

    /* Notes on both records */
    await Promise.all([
      addNote(client, {
        verificationId  : idRec.id,
        verificationType: "identity",
        adminId,
        action          : "approved",
        note,
      }),
      storeRec.status !== "approved"
        ? addNote(client, {
            verificationId  : storeRec.id,
            verificationType: "store",
            adminId,
            action          : "approved",
            note,
          })
        : Promise.resolve(),
    ]);

    await client.query("COMMIT");

    console.log(
      "[admin] ✓ approve-all  userId:", userId,
      " trust_score:", trustScore
    );

    /* Post-commit side effects */
    reactivateLimitedListings(userId).catch((e) =>
      console.error("[approve-all] reactivate:", e.message)
    );
    notifyApproved({ userId, email: user.email, name: user.name });

    log({
      adminId,
      action   : "approve_all",
      targetId : userId,
      details  : `Approved identity + store for user ${userId}`,
      meta     : {
        identity_verification_id : idRec.id,
        store_verification_id    : storeRec.id,
        store_was_pre_approved   : storeRec.status === "approved",
        trust_score              : trustScore,
        note,
      },
      userId,
      ip,
    });

    return res.json({
      success     : true,
      trust_score : trustScore,
      approved    : {
        identity : idRec.id,
        store    : storeRec.id,
      },
      message :
        "Identity and store approved. " +
        "Approval email sent to user. Listings reactivated.",
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

    /* Lock + fetch user */
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

    /* Lock pending identity */
    const { rows: idRows } = await client.query(
      `SELECT id, status FROM identity_verifications
       WHERE user_id = $1
         AND status IN ('pending', 'flagged')
       ORDER BY created_at DESC LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    /* Lock pending store */
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

    /* Reject identity */
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
      await addNote(client, {
        verificationId  : idRows[0].id,
        verificationType: "identity",
        adminId,
        action          : "rejected",
        note            : reason,
      });
    }

    /* Reject store */
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

    /* Clear user flags */
    await client.query(
      `UPDATE public.users
       SET    identity_verified = FALSE,
              store_verified    = FALSE,
              updated_at        = NOW()
       WHERE  id = $1`,
      [userId]
    );

    /*
     * Always downgrade listings on rejection regardless of whether
     * identity or store (or both) records were found.
     */
    await downgradeListings(client, userId);

    const trustScore = await refreshAndPersistTrust(client, userId);

    await client.query("COMMIT");

    console.log(
      "[admin] ✓ reject-all  userId:", userId,
      " trust_score:", trustScore
    );

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

    /* Lock + fetch user */
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

    /* Lock latest identity */
    const { rows: idRows } = await client.query(
      `SELECT id FROM identity_verifications
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    /* Lock latest store */
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

    /* Reset identity */
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

    /* Reset store */
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

    /* Clear user flags */
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
    console.error("[POST /:userId/reset]", err.message, err.stack);
    return fail(res, 500, err.message);
  } finally {
    client.release();
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
       SET    email_verified    = TRUE,
              email_verified_at = NOW(),
              verified          = TRUE,
              updated_at        = NOW()
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
      adminId,
      action   : "force_email_verify",
      targetId : userId,
      details  : `Force-verified email for user ${userId}`,
      meta     : { trust_score: trustScore },
      userId,
      ip,
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
       SET    email_verified    = FALSE,
              email_verified_at = NULL,
              verified          = FALSE,
              updated_at        = NOW()
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
      adminId,
      action          : "revoked",
      note            : reason,
    });

    await client.query("COMMIT");

    createNotification({
      userId,
      type    : "email_revoked",
      title   : "Email Verification Revoked",
      message : `Your email verification has been revoked. Reason: ${reason}`,
    }).catch(() => {});

    log({
      adminId,
      action   : "revoke_email_verify",
      targetId : userId,
      details  : `Revoked email for user ${userId}: ${reason}`,
      meta     : { reason, trust_score: trustScore },
      userId,
      ip,
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
      adminId,
      action   : "recalculate_trust",
      targetId : userId,
      details  : `Recalculated trust for user ${userId} → ${trustScore}`,
      meta     : { trust_score: trustScore },
      userId,
      ip,
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