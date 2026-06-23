/**
 * routes/admin/verification.js
 *
 * GET    /stats
 *
 * GET    /identity                           list
 * GET    /identity/:id                       single + notes history
 * POST   /identity/:id/approve
 * POST   /identity/:id/reject
 * POST   /identity/:id/reset
 * POST   /identity/:id/assign
 * POST   /identity/:id/note                  add note without action
 * POST   /identity/bulk-approve
 * POST   /identity/bulk-reject
 * GET    /identity/:id/files/:field          signed document URL
 *
 * GET    /store                              list
 * GET    /store/:id                          single + notes history
 * POST   /store/:id/approve
 * POST   /store/:id/reject
 * POST   /store/:id/reset
 * POST   /store/:id/assign
 * POST   /store/:id/note
 *
 * POST   /email/:userId/force-verify         super-admin only
 * POST   /email/:userId/revoke               super-admin only
 *
 * POST   /trust/:userId/recalculate
 */

import express  from "express";
import crypto   from "crypto";

import { pool }                            from "../../server.js";
import { verifyAdmin, requireSuperAdmin }  from "./middleware.js";
import { reactivateLimitedListings }       from "../addproduct.js";
import { writeAudit }                      from "../../lib/audit.js";
import {
  sendIdentityStatusEmail,
  sendStoreStatusEmail,
} from "../../services/email.js";
import { createNotification }              from "../../services/notifications.js";

const router = express.Router();
router.use(verifyAdmin);

/* ══════════════════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════════════════ */
const MAX_LIMIT        = 200;
const BULK_MAX         = 50;
const NOTE_MAX_LEN     = 1_000;
const REASON_MAX_LEN   = 500;

const VALID_ID_STATUSES    = new Set(["pending", "approved", "rejected", "reset", "flagged", "all"]);
const VALID_STORE_STATUSES = new Set(["pending", "approved", "rejected", "reset", "all"]);

/* Signed URL TTL — documents expire quickly */
const SIGNED_URL_TTL_SECS = 60 * 15; // 15 minutes

/* ══════════════════════════════════════════════════════════════════════════
   CANONICAL TRUST SCORE
   Must match verification.js exactly.
   email_verified    → 30
   identity_verified → 35
   store_verified    → 20
   age > 30d         → 10
   age > 90d         →  5
   cap               → 100
══════════════════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════ */
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

/* ── Recompute trust score and persist ── */
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

/* ── Add a note to verification_notes history ── */
const addNote = async (
  client,
  { verificationId, verificationType, adminId, action, note }
) => {
  await client.query(
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
     WHERE  vn.verification_id  = $1
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

/* ── Compute risk flags for a document submission ── */
const computeRiskFlags = async (client, { userId, documentHash, documentType }) => {
  const flags = [];
  let riskScore = 0;

  if (documentHash) {
    /* Check if another verified/pending account uses same document */
    const { rows: dupRows } = await client.query(
      `SELECT iv.user_id, iv.status, u.email
       FROM   identity_verifications iv
       JOIN   public.users u ON u.id = iv.user_id
       WHERE  iv.document_number_hash = $1
         AND  iv.user_id             <> $2
         AND  iv.status IN ('pending', 'approved')
       LIMIT  5`,
      [documentHash, userId]
    );

    if (dupRows.length) {
      flags.push({
        type    : "duplicate_document",
        severity: "critical",
        detail  : `Document hash matches ${dupRows.length} other account(s)`,
        accounts: dupRows.map((r) => ({ user_id: r.user_id, status: r.status })),
      });
      riskScore += 80;
    }
  }

  /* Check: account age < 1 day */
  const { rows: userRows } = await client.query(
    `SELECT created_at, total_reports, status
     FROM   public.users WHERE id = $1`,
    [userId]
  );

  if (userRows.length) {
    const u       = userRows[0];
    const ageDays = (Date.now() - new Date(u.created_at).getTime()) / 86_400_000;

    if (ageDays < 1) {
      flags.push({
        type    : "very_new_account",
        severity: "medium",
        detail  : `Account created ${Math.round(ageDays * 24)} hours ago`,
      });
      riskScore += 20;
    }

    if (u.total_reports > 0) {
      flags.push({
        type    : "prior_reports",
        severity: "high",
        detail  : `User has ${u.total_reports} prior report(s)`,
      });
      riskScore += u.total_reports * 15;
    }

    if (u.status === "flagged") {
      flags.push({
        type    : "account_flagged",
        severity: "critical",
        detail  : "User account is currently flagged",
      });
      riskScore += 60;
    }
  }

  return { flags, riskScore: Math.min(riskScore, 100) };
};

/* ── Generate a short-lived signed URL for a document ── */
const generateSignedUrl = (verificationId, field, adminId) => {
  const expires   = Math.floor(Date.now() / 1_000) + SIGNED_URL_TTL_SECS;
  const secret    = process.env.SIGNED_URL_SECRET ?? "dev-secret";
  const payload   = `${verificationId}:${field}:${adminId}:${expires}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return { expires, signature };
};

/* ══════════════════════════════════════════════════════════════════════════
   GET /stats
══════════════════════════════════════════════════════════════════════════ */
router.get("/stats", async (req, res) => {
  try {
    const [idStats, storeStats, userStats, limitedStats, noteStats] =
      await Promise.all([

        pool.query(`
          SELECT
            COUNT(*)                                           ::INT AS total,
            COUNT(*) FILTER (WHERE status = 'pending')        ::INT AS pending,
            COUNT(*) FILTER (WHERE status = 'approved')       ::INT AS approved,
            COUNT(*) FILTER (WHERE status = 'rejected')       ::INT AS rejected,
            COUNT(*) FILTER (WHERE status = 'reset')          ::INT AS reset,
            COUNT(*) FILTER (WHERE status = 'flagged')        ::INT AS flagged,
            COUNT(*) FILTER (
              WHERE status = 'pending'
                AND created_at < NOW() - INTERVAL '24 hours'
            )                                                 ::INT AS overdue,
            COUNT(*) FILTER (WHERE assigned_admin_id IS NULL
              AND status = 'pending')                         ::INT AS unassigned
          FROM identity_verifications
        `),

        pool.query(`
          SELECT
            COUNT(*)                                           ::INT AS total,
            COUNT(*) FILTER (WHERE status = 'pending')        ::INT AS pending,
            COUNT(*) FILTER (WHERE status = 'approved')       ::INT AS approved,
            COUNT(*) FILTER (WHERE status = 'rejected')       ::INT AS rejected,
            COUNT(*) FILTER (WHERE status = 'reset')          ::INT AS reset,
            COUNT(*) FILTER (
              WHERE status = 'pending'
                AND created_at < NOW() - INTERVAL '24 hours'
            )                                                 ::INT AS overdue,
            COUNT(*) FILTER (WHERE assigned_admin_id IS NULL
              AND status = 'pending')                         ::INT AS unassigned
          FROM store_verifications
        `),

        pool.query(`
          SELECT
            COUNT(*)                                               ::INT AS total,
            COUNT(*) FILTER (WHERE email_verified    = TRUE)      ::INT AS email_verified,
            COUNT(*) FILTER (WHERE identity_verified = TRUE)      ::INT AS identity_verified,
            COUNT(*) FILTER (WHERE store_verified    = TRUE)      ::INT AS store_verified,
            COUNT(*) FILTER (WHERE status = 'flagged')            ::INT AS flagged,
            COUNT(*) FILTER (WHERE status = 'banned')             ::INT AS banned,
            COALESCE(
              AVG(trust_score)::NUMERIC(5,2),
              0
            )                                                      AS avg_trust_score
          FROM public.users
        `),

        /* Limited listings breakdown */
        pool.query(`
          SELECT
            COUNT(*)                                              ::INT AS total,
            COUNT(*) FILTER (WHERE active_until < NOW())         ::INT AS expired,
            COUNT(*) FILTER (WHERE active_until >= NOW()
              OR active_until IS NULL)                           ::INT AS live
          FROM products
          WHERE status = 'active_limited'
        `),

        /* Notes activity last 7 days */
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

/* ══════════════════════════════════════════════════════════════════════════
   IDENTITY — LIST
══════════════════════════════════════════════════════════════════════════ */
router.get("/identity", async (req, res) => {
  const rawStatus = req.query.status ?? "pending";
  if (!VALID_ID_STATUSES.has(rawStatus))
    return fail(res, 400, `Invalid status. Use: ${[...VALID_ID_STATUSES].join(", ")}.`);

  const limit      = safeInt(req.query.limit,  50, MAX_LIMIT);
  const offset     = safeInt(req.query.offset,  0);
  const assignedTo = req.query.assigned_to ?? null; // filter by assigned admin

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

    const where = conditions.length
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
         iv.rejection_reason,
         iv.reviewed_by,
         iv.reviewed_at,
         iv.assigned_admin_id,
         iv.assigned_at,
         iv.created_at,
         iv.updated_at,
         u.id              AS user_id,
         u.name            AS user_name,
         u.email           AS user_email,
         u.phone_number    AS user_phone,
         u.status          AS user_status,
         u.trust_score,
         u.identity_verified,
         u.email_verified,
         -- Assigned admin name
         aa.name           AS assigned_admin_name
       FROM identity_verifications iv
       JOIN public.users u  ON u.id  = iv.user_id
       LEFT JOIN public.users aa ON aa.id = iv.assigned_admin_id
       ${where}
       ORDER BY iv.risk_score DESC, iv.created_at ASC
       LIMIT  $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const { rows: cr } = await pool.query(
      `SELECT COUNT(*)::INT AS total
       FROM identity_verifications iv
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
    console.error("[admin GET /identity]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   IDENTITY — SINGLE (with notes history)
══════════════════════════════════════════════════════════════════════════ */
router.get("/identity/:id", async (req, res) => {
  try {
    const [verRes, notes] = await Promise.all([
      pool.query(
        `SELECT
           iv.id,
           iv.document_type,
           iv.status,
           iv.risk_score,
           iv.risk_flags,
           iv.flagged_for_review,
           iv.rejection_reason,
           iv.reviewed_by,
           iv.reviewed_at,
           iv.assigned_admin_id,
           iv.assigned_at,
           iv.created_at,
           iv.updated_at,
           u.id              AS user_id,
           u.name            AS user_name,
           u.email           AS user_email,
           u.phone_number    AS user_phone,
           u.status          AS user_status,
           u.trust_score,
           u.identity_verified,
           u.email_verified,
           u.store_verified,
           u.created_at      AS user_created_at
         FROM identity_verifications iv
         JOIN public.users u ON u.id = iv.user_id
         WHERE iv.id = $1`,
        [req.params.id]
      ),
      getNotes(pool, req.params.id, "identity"),
    ]);

    if (!verRes.rows.length)
      return fail(res, 404, "Identity verification not found.");

    const verification = verRes.rows[0];

    /* Signed URLs — never expose permanent storage URLs */
    const adminId    = req.admin.id;
    const { expires, signature } = generateSignedUrl(
      req.params.id, "front", adminId
    );

    return res.json({
      success      : true,
      verification : {
        ...verification,
        /* Document URLs are NOT included — use signed endpoint instead */
        document_urls : {
          front  : `/api/admin/verification/identity/${req.params.id}/files/front`,
          back   : `/api/admin/verification/identity/${req.params.id}/files/back`,
          selfie : `/api/admin/verification/identity/${req.params.id}/files/selfie`,
          /* Token for client to attach */
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

/* ══════════════════════════════════════════════════════════════════════════
   IDENTITY — SIGNED DOCUMENT URLs
══════════════════════════════════════════════════════════════════════════ */
router.get("/identity/:id/files/:field", async (req, res) => {
  const { id, field } = req.params;
  const { token }     = req.query;

  if (!["front", "back", "selfie"].includes(field))
    return fail(res, 400, "Invalid field. Use: front, back, selfie.");

  /* Verify token */
  if (!token) return fail(res, 401, "Token required.");

  try {
    const [expires, signature] = token.split(":");
    if (!expires || !signature) return fail(res, 401, "Invalid token format.");

    if (parseInt(expires, 10) < Math.floor(Date.now() / 1_000))
      return fail(res, 401, "Token expired. Request a new document link.");

    const adminId = req.admin.id;
    const payload = `${id}:${field}:${adminId}:${expires}`;
    const expected = crypto
      .createHmac("sha256", process.env.SIGNED_URL_SECRET ?? "dev-secret")
      .update(payload)
      .digest("hex");

    if (!crypto.timingSafeEqual(
      Buffer.from(signature,  "hex"),
      Buffer.from(expected, "hex")
    )) {
      return fail(res, 401, "Invalid token signature.");
    }
  } catch {
    return fail(res, 401, "Token verification failed.");
  }

  /* Fetch the actual URL */
  try {
    const colMap = { front: "front_image_url", back: "back_image_url", selfie: "selfie_url" };
    const col    = colMap[field];

    const { rows } = await pool.query(
      `SELECT ${col} AS url FROM identity_verifications WHERE id = $1`,
      [id]
    );

    if (!rows.length || !rows[0].url)
      return fail(res, 404, "Document not found.");

    /* Redirect to the actual storage URL (Cloudinary etc.)
       The client never sees this URL — the browser follows the redirect. */
    return res.redirect(302, rows[0].url);

  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   IDENTITY — APPROVE
══════════════════════════════════════════════════════════════════════════ */
router.post("/identity/:id/approve", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const note    = (req.body.note ?? "Approved.").trim();

  if (!note)
    return fail(res, 400, "A note is required when approving.");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* Lock the record */
    const { rows } = await client.query(
      `SELECT
         iv.id,
         iv.user_id,
         iv.status            AS current_status,
         iv.document_number_hash,
         iv.document_type,
         iv.risk_score,
         iv.risk_flags,
         u.email,
         u.name,
         u.email_verified,
         u.store_verified,
         u.created_at         AS user_created_at
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

    /* Idempotency */
    if (rec.current_status === "approved") {
      await client.query("ROLLBACK");
      return res.json({ success: true, message: "Already approved." });
    }

    /* ── Duplicate document check before approval ── */
    if (rec.document_number_hash) {
      const { rows: dupRows } = await client.query(
        `SELECT iv.user_id, iv.status
         FROM   identity_verifications iv
         WHERE  iv.document_number_hash = $1
           AND  iv.user_id             <> $2
           AND  iv.status               = 'approved'
         LIMIT  3`,
        [rec.document_number_hash, rec.user_id]
      );

      if (dupRows.length) {
        /* Flag for review instead of blocking — admin must decide */
        await client.query(
          `UPDATE identity_verifications
           SET    status            = 'flagged',
                  flagged_for_review = TRUE,
                  risk_score        = GREATEST(risk_score, 90),
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
            `Blocked approval: document hash matches ${dupRows.length} ` +
            `already-approved account(s). Manual review required.`,
        });

        await client.query("COMMIT");

        log({
          adminId,
          action   : "flag_identity_duplicate",
          targetId : req.params.id,
          details  : `Duplicate document detected for user ${rec.user_id}`,
          meta     : { duplicate_count: dupRows.length, risk_score: 90 },
          userId   : rec.user_id,
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

    /* ── Update verification record ── */
    await client.query(
      `UPDATE identity_verifications
       SET    status            = 'approved',
              flagged_for_review = FALSE,
              reviewed_by       = $2,
              reviewed_at       = NOW(),
              updated_at        = NOW()
       WHERE  id = $1`,
      [req.params.id, adminId]
    );

    /* ── Set user identity_verified ── */
    await client.query(
      `UPDATE public.users
       SET    identity_verified    = TRUE,
              identity_verified_at = NOW(),
              updated_at           = NOW()
       WHERE  id = $1`,
      [rec.user_id]
    );

    /* ── Recompute trust score ── */
    const trustScore = await refreshAndPersistTrust(client, rec.user_id);

    /* ── Save note to history ── */
    await addNote(client, {
      verificationId  : req.params.id,
      verificationType: "identity",
      adminId,
      action          : "approved",
      note,
    });

    await client.query("COMMIT");

    console.log(
      "[admin] ✓ identity approved  userId:", rec.user_id,
      " trust_score:", trustScore
    );

    /* ── Post-commit: reactivate listings ── */
    reactivateLimitedListings(rec.user_id).catch((e) =>
      console.error("[admin] reactivate listings err:", e.message)
    );

    /* ── Notify user ── */
    Promise.all([
      sendIdentityStatusEmail({
        to       : rec.email,
        name     : rec.name,
        approved : true,
      }),
      createNotification({
        userId  : rec.user_id,
        type    : "identity_approved",
        title   : "Identity Verified",
        message :
          "Your identity has been verified. Your listings are now permanent " +
          "and your account has been upgraded.",
      }),
    ]).catch((e) =>
      console.error("[admin] identity approval notification err:", e.message)
    );

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
      message     : "Identity approved. User notified. Listings reactivated.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin approve identity]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   IDENTITY — REJECT
══════════════════════════════════════════════════════════════════════════ */
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
      `SELECT iv.user_id, iv.status AS current_status,
              u.email, u.name
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

    /* ── Update record ── */
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

    /* ── Clear user flag ── */
    await client.query(
      `UPDATE public.users
       SET    identity_verified = FALSE,
              updated_at        = NOW()
       WHERE  id = $1`,
      [user_id]
    );

    /* ── Suspend limited products (don't destroy — just limit) ── */
    await client.query(
      `UPDATE products
       SET    status     = 'active_limited',
              updated_at = NOW()
       WHERE  seller_id  = $1
         AND  status     = 'active'
         AND  is_first_product = TRUE`,
      [user_id]
    );

    /* ── Recompute trust score ── */
    const trustScore = await refreshAndPersistTrust(client, user_id);

    /* ── Save note to history ── */
    await addNote(client, {
      verificationId  : req.params.id,
      verificationType: "identity",
      adminId,
      action          : "rejected",
      note            : reason,
    });

    await client.query("COMMIT");

    /* ── Notify user ── */
    Promise.all([
      sendIdentityStatusEmail({
        to       : email,
        name,
        approved : false,
        reason,
      }),
      createNotification({
        userId  : user_id,
        type    : "identity_rejected",
        title   : "Identity Verification Update",
        message : `Your identity verification was not approved. Reason: ${reason}`,
      }),
    ]).catch((e) =>
      console.error("[admin] identity rejection notification err:", e.message)
    );

    log({
      adminId,
      action   : "reject_identity",
      targetId : req.params.id,
      details  : `Rejected identity for user ${user_id}: ${reason}`,
      meta     : { reason, trust_score: trustScore },
      userId   : user_id,
      ip,
    });

    return res.json({ success: true, trust_score: trustScore });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin reject identity]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   IDENTITY — RESET (allow resubmit)
══════════════════════════════════════════════════════════════════════════ */
router.post("/identity/:id/reset", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const note    = (req.body.note ?? "").trim() || "Resubmission requested by admin.";

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
       SET    identity_verified = FALSE,
              updated_at        = NOW()
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

    createNotification({
      userId  : user_id,
      type    : "identity_reset",
      title   : "Resubmit Identity Documents",
      message : `Please resubmit your identity documents. Note: ${note}`,
    }).catch(() => {});

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
      message     : "User can now resubmit identity documents.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin reset identity]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   IDENTITY — ASSIGN to admin
══════════════════════════════════════════════════════════════════════════ */
router.post("/identity/:id/assign", async (req, res) => {
  const adminId        = req.admin.id;
  const ip             = getIp(req);
  const assignedAdminId = req.body.admin_id ?? adminId; // default: self

  try {
    const { rows } = await pool.query(
      `UPDATE identity_verifications
       SET    assigned_admin_id = $2,
              assigned_at       = NOW(),
              updated_at        = NOW()
       WHERE  id     = $1
         AND  status = 'pending'
       RETURNING id, user_id`,
      [req.params.id, assignedAdminId]
    );

    if (!rows.length)
      return fail(res, 404, "Verification not found or not in pending state.");

    log({
      adminId,
      action   : "assign_identity",
      targetId : req.params.id,
      details  : `Assigned identity review to admin ${assignedAdminId}`,
      meta     : { assigned_to: assignedAdminId },
      userId   : rows[0].user_id,
      ip,
    });

    return res.json({ success: true, assigned_to: assignedAdminId });

  } catch (err) {
    console.error("[admin assign identity]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   IDENTITY — ADD NOTE (without status change)
══════════════════════════════════════════════════════════════════════════ */
router.post("/identity/:id/note", async (req, res) => {
  const adminId = req.admin.id;
  const note    = (req.body.note ?? "").trim();

  if (!note)        return fail(res, 400, "Note is required.");
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
      adminId,
      action          : "note",
      note,
    });

    return res.json({ success: true });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   IDENTITY — BULK APPROVE
══════════════════════════════════════════════════════════════════════════ */
router.post("/identity/bulk-approve", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const ids     = Array.isArray(req.body.ids) ? req.body.ids : [];
  const note    = (req.body.note ?? "Bulk approved.").trim();

  if (!ids.length)       return fail(res, 400, "IDs array is required.");
  if (ids.length > BULK_MAX)
    return fail(res, 400, `Maximum ${BULK_MAX} records per bulk action.`);

  const results = { approved: [], skipped: [], failed: [] };

  for (const id of ids) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `SELECT iv.user_id, iv.status, iv.document_number_hash,
                u.email, u.name
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
         SET    status      = 'approved', reviewed_by = $2,
                reviewed_at = NOW(),      updated_at  = NOW()
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
      createNotification({
        userId  : rec.user_id,
        type    : "identity_approved",
        title   : "Identity Verified",
        message : "Your identity has been verified. Your listings are now permanent.",
      }).catch(() => {});

      results.approved.push({ id, user_id: rec.user_id, trust_score: trustScore });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      results.failed.push({ id, error: err.message });
    } finally {
      client.release();
    }
  }

  log({
    adminId,
    action   : "bulk_approve_identity",
    targetId : "bulk",
    details  : `Bulk approved ${results.approved.length} identities`,
    meta     : results,
    ip,
  });

  return res.json({ success: true, results });
});

/* ══════════════════════════════════════════════════════════════════════════
   IDENTITY — BULK REJECT
══════════════════════════════════════════════════════════════════════════ */
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

      const { user_id } = rows[0];

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
        adminId,
        action          : "rejected",
        note            : reason,
      });

      await client.query("COMMIT");

      createNotification({
        userId  : user_id,
        type    : "identity_rejected",
        title   : "Identity Verification Update",
        message : `Your identity verification was not approved. Reason: ${reason}`,
      }).catch(() => {});

      results.rejected.push({ id, user_id, trust_score: trustScore });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      results.failed.push({ id, error: err.message });
    } finally {
      client.release();
    }
  }

  log({
    adminId,
    action   : "bulk_reject_identity",
    targetId : "bulk",
    details  : `Bulk rejected ${results.rejected.length} identities`,
    meta     : results,
    ip,
  });

  return res.json({ success: true, results });
});

/* ══════════════════════════════════════════════════════════════════════════
   STORE — LIST
══════════════════════════════════════════════════════════════════════════ */
router.get("/store", async (req, res) => {
  const rawStatus = req.query.status ?? "pending";
  if (!VALID_STORE_STATUSES.has(rawStatus))
    return fail(res, 400, `Invalid status. Use: ${[...VALID_STORE_STATUSES].join(", ")}.`);

  const limit  = safeInt(req.query.limit,  50, MAX_LIMIT);
  const offset = safeInt(req.query.offset,  0);

  try {
    const { where, params } = buildStatusFilter(rawStatus, "sv");

    const listParams = [...params, limit, offset];
    const { rows } = await pool.query(
      `SELECT
         sv.id, sv.store_name, sv.store_description, sv.logo_url,
         sv.status, sv.rejection_reason, sv.review_action,
         sv.reviewed_by, sv.assigned_admin_id, sv.assigned_at,
         sv.created_at, sv.updated_at,
         u.id              AS user_id,
         u.name            AS user_name,
         u.email           AS user_email,
         u.phone_number    AS user_phone,
         u.status          AS user_status,
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

/* ══════════════════════════════════════════════════════════════════════════
   STORE — SINGLE
══════════════════════════════════════════════════════════════════════════ */
router.get("/store/:id", async (req, res) => {
  try {
    const [verRes, notes] = await Promise.all([
      pool.query(
        `SELECT sv.*, u.id AS user_id, u.name AS user_name,
                u.email AS user_email, u.phone_number AS user_phone,
                u.status AS user_status, u.trust_score,
                u.store_verified, u.identity_verified, u.email_verified,
                u.created_at AS user_created_at
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

/* ══════════════════════════════════════════════════════════════════════════
   STORE — APPROVE
══════════════════════════════════════════════════════════════════════════ */
router.post("/store/:id/approve", async (req, res) => {
  const adminId       = req.admin.id;
  const ip            = getIp(req);
  const review_action = (req.body.review_action ?? "approved").trim();
  const note          = (req.body.note          ?? "Approved." ).trim();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT sv.user_id, sv.status AS current_status, sv.store_name,
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

    /* Require identity first */
    if (!rec.identity_verified) {
      await client.query("ROLLBACK");
      return fail(
        res, 422,
        "Cannot approve store — seller has not completed identity verification."
      );
    }

    await client.query(
      `UPDATE store_verifications
       SET    status        = 'approved',
              review_action = $2,
              reviewed_by   = $3,
              reviewed_at   = NOW(),
              updated_at    = NOW()
       WHERE  id = $1`,
      [req.params.id, review_action, adminId]
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

    Promise.all([
      sendStoreStatusEmail({
        to        : rec.email,
        name      : rec.name,
        storeName : rec.store_name,
        approved  : true,
      }),
      createNotification({
        userId  : rec.user_id,
        type    : "store_approved",
        title   : "Store Approved",
        message : `Your store "${rec.store_name}" is now live on the platform.`,
      }),
    ]).catch((e) =>
      console.error("[admin] store approval notification err:", e.message)
    );

    log({
      adminId,
      action   : "approve_store",
      targetId : req.params.id,
      details  : `Approved store for user ${rec.user_id}`,
      meta     : { trust_score: trustScore, review_action, note },
      userId   : rec.user_id,
      ip,
    });

    return res.json({ success: true, trust_score: trustScore });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin approve store]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   STORE — REJECT
══════════════════════════════════════════════════════════════════════════ */
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
      `SELECT sv.user_id, sv.status AS current_status, sv.store_name,
              u.email, u.name
       FROM   store_verifications sv
       JOIN   public.users u ON u.id = sv.user_id
       WHERE  sv.id = $1 FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Store verification not found.");
    }

    const { user_id, current_status, email, name, store_name } = rows[0];

    if (current_status === "rejected") {
      await client.query("ROLLBACK");
      return res.json({ success: true, message: "Already rejected." });
    }

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

    Promise.all([
      sendStoreStatusEmail({
        to        : email,
        name,
        storeName : store_name,
        approved  : false,
        reason,
      }),
      createNotification({
        userId  : user_id,
        type    : "store_rejected",
        title   : "Store Verification Update",
        message : `Your store verification was not approved. Reason: ${reason}`,
      }),
    ]).catch(() => {});

    log({
      adminId,
      action   : "reject_store",
      targetId : req.params.id,
      details  : `Rejected store for user ${user_id}: ${reason}`,
      meta     : { reason, trust_score: trustScore },
      userId   : user_id,
      ip,
    });

    return res.json({ success: true, trust_score: trustScore });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin reject store]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   STORE — RESET
══════════════════════════════════════════════════════════════════════════ */
router.post("/store/:id/reset", async (req, res) => {
  const adminId = req.admin.id;
  const ip      = getIp(req);
  const note    = (req.body.note ?? "").trim() || "Resubmission requested by admin.";

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

    createNotification({
      userId  : user_id,
      type    : "store_reset",
      title   : "Resubmit Store Profile",
      message : `Please resubmit your store profile. Note: ${note}`,
    }).catch(() => {});

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
      message     : "User can now resubmit store details.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin reset store]", err.message);
    return fail(res, 500, err.message);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   STORE — ASSIGN + NOTE
══════════════════════════════════════════════════════════════════════════ */
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

router.post("/store/:id/note", async (req, res) => {
  const adminId = req.admin.id;
  const note    = (req.body.note ?? "").trim();

  if (!note)              return fail(res, 400, "Note is required.");
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
      adminId,
      action          : "note",
      note,
    });

    return res.json({ success: true });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   EMAIL — FORCE VERIFY / REVOKE (super-admin)
══════════════════════════════════════════════════════════════════════════ */
router.post("/email/:userId/force-verify", requireSuperAdmin, async (req, res) => {
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
    if (!rows.length) { await client.query("ROLLBACK"); return fail(res, 404, "User not found."); }

    await client.query(
      `UPDATE public.users
       SET    email_verified    = TRUE, email_verified_at = NOW(),
              verified          = TRUE, updated_at        = NOW()
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
      message : "Your email address has been verified.",
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
    if (!rows.length) { await client.query("ROLLBACK"); return fail(res, 404, "User not found."); }

    await client.query(
      `UPDATE public.users
       SET    email_verified    = FALSE, email_verified_at = NULL,
              verified          = FALSE, updated_at        = NOW()
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

/* ══════════════════════════════════════════════════════════════════════════
   TRUST SCORE — manual recalculate
══════════════════════════════════════════════════════════════════════════ */
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
    if (!rows.length) { await client.query("ROLLBACK"); return fail(res, 404, "User not found."); }

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