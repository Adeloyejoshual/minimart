// ════════════════════════════════════════════════════════════
// FILE: routes/verification.js
// ════════════════════════════════════════════════════════════

import express   from "express";
import bcrypt    from "bcrypt";
import crypto    from "crypto";
import multer    from "multer";
import path      from "path";
import rateLimit from "express-rate-limit";

import { pool }         from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../services/email.js";
import { reactivateLimitedListings } from "./addproduct.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ════════════════════════════════════════════════════════════
   POLICY
════════════════════════════════════════════════════════════ */
const POLICY = Object.freeze({
  DAILY_SEND_LIMIT     : IS_PROD ?  3 : 50,
  RESEND_COOLDOWN_SECS : IS_PROD ? 60 : 30,
  OTP_EXPIRY_MINUTES   : 10,
  MAX_VERIFY_ATTEMPTS  : IS_PROD ?  5 : 10,
  ABUSE_WINDOW_MINUTES : 10,
  ABUSE_THRESHOLD      : IS_PROD ?  5 : 40,
  BCRYPT_ROUNDS        : 10,
});

/* ════════════════════════════════════════════════════════════
   TRUST SCORE
════════════════════════════════════════════════════════════ */
const computeTrustScore = (user) => {
  let s = 0;
  if (user.email_verified)    s += 30;
  if (user.identity_verified) s += 35;
  if (user.store_verified)    s += 20;
  const age = (Date.now() - new Date(user.created_at).getTime()) / 86_400_000;
  if (age > 30) s += 10;
  if (age > 90) s +=  5;
  return Math.min(s, 100);
};

/* ════════════════════════════════════════════════════════════
   FILE POLICY
════════════════════════════════════════════════════════════ */
const DOC_MIME = new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
const IMG_MIME = new Set(["image/jpeg","image/png","image/webp"]);
const EXT_MIME = {
  ".jpg"  : "image/jpeg",
  ".jpeg" : "image/jpeg",
  ".png"  : "image/png",
  ".webp" : "image/webp",
  ".pdf"  : "application/pdf",
};
const MAX_DOC_BYTES  = 5 * 1_048_576;
const MAX_LOGO_BYTES = 2 * 1_048_576;

const VALID_DOC_TYPES = new Set([
  "nin","passport","drivers_license","voters_card",
]);

const DOC_VALIDATORS = {
  nin             : (v) => /^\d{11}$/.test(v.replace(/\s/g,"")),
  passport        : (v) => /^[A-Za-z]\d{8}$/.test(v.replace(/\s/g,"")),
  drivers_license : (v) => /^[A-Za-z]{3}\d{6}[A-Za-z]{2}$/.test(v.replace(/[\s-]/g,"")),
  voters_card     : (v) => /^[A-Za-z0-9]{19}$/.test(v.replace(/\s/g,"")),
};

/* ════════════════════════════════════════════════════════════
   MULTER
════════════════════════════════════════════════════════════ */
const memStore = multer.memoryStorage();

const makeFilter = (allowed) => (_req, file, cb) => {
  if (allowed.has(file.mimetype)) return cb(null, true);
  const err = new Error(`Invalid file type "${file.mimetype}".`);
  err.code  = "INVALID_MIME";
  cb(err);
};

const uploadSubmit = multer({
  storage    : memStore,
  limits     : { fileSize: MAX_DOC_BYTES, files: 5 },
  fileFilter : (_req, file, cb) => {
    const all = new Set([...DOC_MIME, ...IMG_MIME]);
    if (all.has(file.mimetype)) return cb(null, true);
    const err = new Error(`Invalid file type "${file.mimetype}".`);
    err.code  = "INVALID_MIME";
    cb(err);
  },
}).fields([
  { name: "doc_front",      maxCount: 1 },
  { name: "doc_back",       maxCount: 1 },
  { name: "selfie",         maxCount: 1 },
  { name: "store_logo",     maxCount: 1 },
  { name: "liveness_frame", maxCount: 1 },
]);

const uploadFaceCheck = multer({
  storage    : memStore,
  limits     : { fileSize: MAX_DOC_BYTES, files: 2 },
  fileFilter : makeFilter(IMG_MIME),
}).fields([
  { name: "selfie",    maxCount: 1 },
  { name: "doc_front", maxCount: 1 },
]);

const withUpload = (handler) => (req, res, next) =>
  handler(req, res, (err) => {
    if (!err) return next();
    if (["LIMIT_FILE_SIZE","LIMIT_FILE_COUNT","INVALID_MIME"].includes(err.code))
      return res.status(400).json({ success: false, message: err.message });
    return next(err);
  });

/* ════════════════════════════════════════════════════════════
   CLOUDINARY
════════════════════════════════════════════════════════════ */
let _cld = null;
let _sf  = null;

async function getCld() {
  if (_cld) return _cld;
  const {
    CLOUDINARY_CLOUD_NAME : cn,
    CLOUDINARY_API_KEY    : ak,
    CLOUDINARY_API_SECRET : as,
  } = process.env;
  if (!cn || !ak || !as) return null;
  try {
    const { v2: cld } = await import("cloudinary");
    const sf = await import("streamifier");
    cld.config({ cloud_name: cn, api_key: ak, api_secret: as, secure: true });
    _cld = cld;
    _sf  = sf.default ?? sf;
    return _cld;
  } catch (e) {
    console.error("[cloudinary] init failed:", e.message);
    return null;
  }
}

const uploadBuffer = async (buffer, folder, userId) => {
  const cld = await getCld();
  if (!cld) {
    return { secure_url: `local://${folder}/${userId}/${Date.now()}` };
  }
  return new Promise((ok, no) => {
    const s = cld.uploader.upload_stream(
      {
        folder          : `loemart/verification/${folder}/${userId}`,
        resource_type   : "auto",
        allowed_formats : ["jpg","jpeg","png","webp","pdf"],
        overwrite       : false,
        unique_filename : true,
      },
      (e, r) => (e ? no(new Error(`Cloudinary: ${e.message}`)) : ok(r))
    );
    _sf.createReadStream(buffer).pipe(s);
  });
};

/* ════════════════════════════════════════════════════════════
   FACE MATCH SERVICE
════════════════════════════════════════════════════════════ */
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL ?? null;

const compareFaces = async (selfieBuffer, docFrontBuffer) => {
  if (!FACE_SERVICE_URL) {
    return {
      match      : null,
      confidence : null,
      skipped    : true,
      message    : "Face service not configured",
    };
  }
  try {
    const fd = new FormData();
    fd.append("selfie",    new Blob([selfieBuffer]),   "selfie.jpg");
    fd.append("doc_front", new Blob([docFrontBuffer]), "doc_front.jpg");
    const r = await fetch(`${FACE_SERVICE_URL}/compare`, {
      method : "POST",
      body   : fd,
      signal : AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error(`Face service ${r.status}`);
    const d = await r.json();
    return {
      match      : Boolean(d.match),
      confidence : d.confidence ?? null,
      skipped    : false,
      message    : d.message ?? "OK",
    };
  } catch (e) {
    console.error("[face-check] service:", e.message);
    return { match: null, confidence: null, skipped: true, message: e.message };
  }
};

/* ════════════════════════════════════════════════════════════
   RATE LIMITERS
════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60_000,
    max,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? req.ip),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const sendOtpLimiter   = makeLimiter({ windowMin: 10, max: IS_PROD ?  5 : 50,  message: "Too many send requests."   });
const verifyOtpLimiter = makeLimiter({ windowMin: 15, max: IS_PROD ? 10 : 50,  message: "Too many verify attempts." });
const submitLimiter    = makeLimiter({ windowMin: 60, max: IS_PROD ?  5 : 30,  message: "Too many submissions."     });
const faceCheckLimiter = makeLimiter({ windowMin: 15, max: IS_PROD ? 20 : 100, message: "Too many face checks."     });

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const generateOtp = () => crypto.randomInt(100_000, 999_999).toString();
const getIp       = (req) => req.ip ?? req.socket?.remoteAddress ?? null;
const maskEmail   = (e) => String(e).replace(/(.{2})(.*)(@.*)/, (_, a, _b, c) => `${a}***${c}`);
const getTodayUTC = () => new Date().toISOString().slice(0, 10);
const fail        = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const makeDeviceHash = (req) =>
  crypto
    .createHash("sha256")
    .update([
      req.headers["user-agent"]      ?? "",
      req.headers["accept-language"] ?? "",
      req.headers["sec-ch-ua"]       ?? "",
    ].join("|"))
    .digest("hex");

const extMatchesMime = (file) =>
  EXT_MIME[path.extname(file.originalname).toLowerCase()] === file.mimetype;

const getDailySendCount = async (db, userId) => {
  const today = getTodayUTC();
  const { rows } = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM email_verifications
     WHERE user_id    = $1
       AND created_at >= $2::date
       AND created_at <  ($2::date + INTERVAL '1 day')`,
    [userId, today]
  );
  return parseInt(rows[0].cnt, 10);
};

const flagAccount = async (db, userId, reason, ip) => {
  await db.query(
    `UPDATE users
     SET status = 'flagged',
         total_reports = COALESCE(total_reports, 0) + 1,
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
  writeAudit({
    actorId    : userId,
    action     : "user_flagged",
    targetType : "user",
    targetId   : userId,
    metadata   : { reason },
    ipAddress  : ip,
  }).catch(() => {});
};

const refreshTrustScore = async (client, userId) => {
  const { rows } = await client.query(
    `SELECT email_verified, identity_verified, store_verified, created_at
     FROM users WHERE id = $1`,
    [userId]
  );
  if (!rows.length) return 0;
  const score = computeTrustScore(rows[0]);
  await client.query(
    `UPDATE users SET trust_score = $1, updated_at = NOW() WHERE id = $2`,
    [score, userId]
  );
  return score;
};

const DOC_HASH_SECRET = process.env.DOC_HASH_SECRET ?? null;
const hashDocNumber   = (docType, docNumber) => {
  if (!DOC_HASH_SECRET) return null;
  const norm = String(docNumber).toLowerCase().replace(/[\s\-_]/g,"").trim();
  return crypto
    .createHmac("sha256", DOC_HASH_SECRET)
    .update(`${docType.toLowerCase()}:${norm}`)
    .digest("hex");
};

/* ════════════════════════════════════════════════════════════
   GRANT REFERRAL REWARD ON VERIFY

   ✅ FIXED: Replaced grant_referral_reward($1) DB function
      (which doesn't exist in CockroachDB) with inline JS logic.

   Flow:
     1. Find pending referral for this user
     2. Check BOTH referee_id and invitee_id (schema compat)
     3. Atomic UPDATE pending → verified (prevents double grant)
     4. Log email_verified event
     5. Inline: UPDATE referrals status → rewarded
     6. Inline: UPDATE users bonus_spins + 1 (inviter)
     7. Log reward_granted event
     8. Update inviter's total_referrals count

   Never throws — referral failure must NOT break verification.
════════════════════════════════════════════════════════════ */
async function grantReferralRewardOnVerify(verifiedUserId, ip) {
  if (!verifiedUserId) return;

  console.log(
    `[referral] grantReferralRewardOnVerify START — user=${verifiedUserId}`
  );

  try {
    /* ── 1. Find pending referral ──
            Check BOTH referee_id AND invitee_id because some rows
            were inserted before the schema migration.              ── */
    const { rows: [referral] } = await pool.query(
      `SELECT id, inviter_id, status
       FROM   referrals
       WHERE  (referee_id = $1 OR invitee_id = $1)
       LIMIT  1`,
      [verifiedUserId]
    );

    if (!referral) {
      console.log(
        `[referral] no referral row found for user=${verifiedUserId} — not referred`
      );
      return;
    }

    console.log(
      `[referral] found referral id=${referral.id} ` +
      `status=${referral.status} inviter=${referral.inviter_id}`
    );

    /* ── 2. Already rewarded? Skip ── */
    if (referral.status === "rewarded") {
      console.log(`[referral] already rewarded — skipping`);
      return;
    }

    /* ── 3. Atomic: pending → verified ──
            WHERE status = 'pending' prevents double processing.    ── */
    const { rowCount: verifiedCount } = await pool.query(
      `UPDATE referrals
       SET    status      = 'verified',
              verified_at = now()
       WHERE  id     = $1
         AND  status IN ('pending', 'verified')`,
      [referral.id]
    );

    if (verifiedCount === 0) {
      console.warn(
        `[referral] UPDATE to verified returned 0 rows — ` +
        `may already be rewarded, referral=${referral.id}`
      );
    } else {
      console.log(`[referral] ✓ status → verified`);
    }

    /* ── 4. Log email_verified event ── */
    try {
      await pool.query(
        `INSERT INTO referral_events
           (referral_id, event_type, description, metadata)
         VALUES ($1, 'email_verified',
                 'Referee verified their email address',
                 $2::JSONB)`,
        [
          referral.id,
          JSON.stringify({
            referee_id : String(verifiedUserId),
            inviter_id : String(referral.inviter_id),
          }),
        ]
      );
      console.log(`[referral] ✓ email_verified event logged`);
    } catch (evtErr) {
      /* Non-fatal — referral_events may not exist yet */
      console.warn(`[referral] email_verified event skipped: ${evtErr.message}`);
    }

    /* ── 5. Atomic: verified → rewarded ──
            ✅ INLINE — no DB stored function needed.
            Only fires when status = 'verified' (idempotent).       ── */
    const REWARD_VALUE = 1;

    const { rowCount: rewardedCount } = await pool.query(
      `UPDATE referrals
       SET    status          = 'rewarded',
              reward_value    = $1,
              reward_given_at = now()
       WHERE  id     = $2
         AND  status = 'verified'`,
      [REWARD_VALUE, referral.id]
    );

    if (rewardedCount === 0) {
      /* Check current state for debugging */
      const { rows: [cur] } = await pool.query(
        `SELECT status FROM referrals WHERE id = $1`,
        [referral.id]
      ).catch(() => ({ rows: [] }));
      console.warn(
        `[referral] verified→rewarded returned 0 rows ` +
        `current_status=${cur?.status ?? "not found"}`
      );
      return;
    }

    console.log(`[referral] ✓ status → rewarded`);

    /* ── 6. Credit inviter +1 bonus spin ── */
    const { rows: [updatedUser] } = await pool.query(
      `UPDATE users
       SET    bonus_spins = COALESCE(bonus_spins, 0) + $1,
              updated_at  = now()
       WHERE  id = $2
       RETURNING bonus_spins`,
      [REWARD_VALUE, referral.inviter_id]
    );

    console.log(
      `[referral] ✓ bonus spin credited ` +
      `inviter=${referral.inviter_id} ` +
      `new_total=${updatedUser?.bonus_spins ?? "?"}`
    );

    /* ── 7. Log reward_granted event ── */
    try {
      await pool.query(
        `INSERT INTO referral_events
           (referral_id, event_type, description, metadata)
         VALUES ($1, 'reward_granted',
                 'Bonus spin awarded to inviter',
                 $2::JSONB)`,
        [
          referral.id,
          JSON.stringify({
            inviter_id   : String(referral.inviter_id),
            referee_id   : String(verifiedUserId),
            reward_value : REWARD_VALUE,
          }),
        ]
      );
      console.log(`[referral] ✓ reward_granted event logged`);
    } catch (evtErr) {
      console.warn(`[referral] reward_granted event skipped: ${evtErr.message}`);
    }

    /* ── 8. Sync inviter's total_referrals count ── */
    try {
      await pool.query(
        `UPDATE users
         SET    total_referrals = (
           SELECT COUNT(*)::INT
           FROM   referrals
           WHERE  inviter_id = $1
             AND  status IN ('rewarded', 'verified')
         ),
         updated_at = now()
         WHERE id = $1`,
        [referral.inviter_id]
      );
      console.log(
        `[referral] ✓ total_referrals synced for inviter=${referral.inviter_id}`
      );
    } catch (cntErr) {
      console.warn(`[referral] total_referrals sync skipped: ${cntErr.message}`);
    }

    /* ── 9. Audit log ── */
    writeAudit({
      actorId    : verifiedUserId,
      action     : "referral_reward_granted",
      targetType : "user",
      targetId   : referral.inviter_id,
      metadata   : {
        referral_id  : referral.id,
        reward_value : REWARD_VALUE,
        referee_id   : verifiedUserId,
      },
      ipAddress  : ip,
    }).catch(() => {});

    console.log(
      `[referral] ✓ COMPLETE  inviter=${referral.inviter_id}  ` +
      `referee=${verifiedUserId}  +${REWARD_VALUE} spin`
    );

  } catch (err) {
    /* NEVER crash email verification because of a referral error */
    console.error(
      `[referral] grantReferralRewardOnVerify FAILED (non-fatal): ` +
      `${err.message}\n${err.stack}`
    );
  }
}

/* ════════════════════════════════════════════════════════════
   POST /send-email-otp
════════════════════════════════════════════════════════════ */
router.post(
  "/send-email-otp",
  authenticate,
  sendOtpLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);
    if (!userId) return fail(res, 401, "Not authenticated.");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: users } = await client.query(
        `SELECT id, email, name, email_verified, status
         FROM users WHERE id = $1`,
        [userId]
      );
      if (!users.length) {
        await client.query("ROLLBACK");
        return fail(res, 404, "User not found.");
      }

      const user = users[0];

      if (user.email_verified) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Email already verified.");
      }
      if (user.status === "flagged" || user.status === "banned") {
        await client.query("ROLLBACK");
        return fail(res, 403, "Account restricted.");
      }

      const dailyCount = await getDailySendCount(client, userId);
      if (dailyCount >= POLICY.DAILY_SEND_LIMIT) {
        await client.query("ROLLBACK");
        return fail(
          res, 429,
          `Daily limit (${POLICY.DAILY_SEND_LIMIT}/day) reached.`,
          { remaining: 0 }
        );
      }

      const cooldownCutoff = new Date(Date.now() - POLICY.RESEND_COOLDOWN_SECS * 1_000);
      const abuseCutoff    = new Date(Date.now() - POLICY.ABUSE_WINDOW_MINUTES * 60 * 1_000);
      const expiresAt      = new Date(Date.now() + POLICY.OTP_EXPIRY_MINUTES * 60 * 1_000);

      const { rows: recent } = await client.query(
        `SELECT created_at FROM email_verifications
         WHERE user_id    = $1
           AND created_at > $2
         ORDER BY created_at DESC LIMIT 1`,
        [userId, cooldownCutoff]
      );
      if (recent.length) {
        const wait = Math.ceil(
          POLICY.RESEND_COOLDOWN_SECS -
          (Date.now() - new Date(recent[0].created_at).getTime()) / 1_000
        );
        await client.query("ROLLBACK");
        return fail(
          res, 429,
          `Wait ${wait}s before requesting another code.`,
          {
            retryAfter : wait,
            remaining  : POLICY.DAILY_SEND_LIMIT - dailyCount,
          }
        );
      }

      const { rows: abr } = await client.query(
        `SELECT COUNT(*) AS cnt FROM email_verifications
         WHERE user_id = $1 AND created_at > $2`,
        [userId, abuseCutoff]
      );
      if (parseInt(abr[0].cnt, 10) >= POLICY.ABUSE_THRESHOLD) {
        await flagAccount(client, userId, "otp_abuse", ip);
        await client.query("COMMIT");
        return fail(res, 429, "Account flagged for suspicious activity.");
      }

      await client.query(
        `UPDATE email_verifications
         SET status = 'expired', used_at = NOW()
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      const otp    = generateOtp();
      const hash   = await bcrypt.hash(otp, POLICY.BCRYPT_ROUNDS);
      const device = makeDeviceHash(req);

      await client.query(
        `INSERT INTO email_verifications
           (user_id, otp_hash, expires_at, status, device_hash, ip_address)
         VALUES ($1, $2, $3, 'active', $4, $5)`,
        [userId, hash, expiresAt, device, ip]
      );

      await client.query(
        `INSERT INTO user_devices
           (user_id, device_hash, ip_address, user_agent, last_seen)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, device_hash)
         DO UPDATE SET
           last_seen  = NOW(),
           ip_address = EXCLUDED.ip_address`,
        [userId, device, ip, req.headers["user-agent"] ?? null]
      );

      await client.query("COMMIT");

      try {
        await sendVerificationEmail({ to: user.email, name: user.name, otp });
      } catch (mailErr) {
        pool.query(
          `UPDATE email_verifications
           SET status = 'expired', used_at = NOW()
           WHERE user_id = $1 AND status = 'active'`,
          [userId]
        ).catch(() => {});
        return fail(res, 500, `Email delivery failed: ${mailErr.message}`);
      }

      const remaining = POLICY.DAILY_SEND_LIMIT - (dailyCount + 1);

      writeAudit({
        actorId    : userId,
        action     : "otp_sent",
        targetType : "user",
        targetId   : userId,
        metadata   : { remaining },
        ipAddress  : ip,
      }).catch(() => {});

      return res.json({
        success   : true,
        message   : "Verification code sent.",
        email     : maskEmail(user.email),
        expiresIn : POLICY.OTP_EXPIRY_MINUTES * 60,
        remaining,
        ...(IS_PROD ? {} : { dev_otp: otp }),
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[send-otp] ERROR:", err.message, "\n", err.stack);
      return fail(res, 500, `Database error: ${err.message}`);
    } finally {
      client.release();
    }
  }
);

/* ════════════════════════════════════════════════════════════
   POST /verify-email-otp

   ✅ Calls grantReferralRewardOnVerify AFTER transaction
      commits so the new user row is visible to the
      referral query.
════════════════════════════════════════════════════════════ */
router.post(
  "/verify-email-otp",
  authenticate,
  verifyOtpLimiter,
  async (req, res) => {
    const rawOtp = String(req.body?.otp ?? "").trim();
    const userId = req.user?.id;
    const ip     = getIp(req);

    if (!userId)                 return fail(res, 401, "Not authenticated.");
    if (!/^\d{6}$/.test(rawOtp)) return fail(res, 400, "OTP must be 6 digits.");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* ── Find active OTP ── */
      const { rows } = await client.query(
        `SELECT id, otp_hash, attempts FROM email_verifications
         WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      if (!rows.length) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Code expired or not found.");
      }

      const rec = rows[0];

      /* ── Max attempts ── */
      if (rec.attempts >= POLICY.MAX_VERIFY_ATTEMPTS) {
        await client.query(
          `UPDATE email_verifications SET status = 'blocked' WHERE id = $1`,
          [rec.id]
        );
        await flagAccount(client, userId, "otp_max_attempts", ip);
        await client.query("COMMIT");
        return fail(res, 429, "Too many failed attempts. Account flagged.");
      }

      /* ── Verify OTP ── */
      const valid = await bcrypt.compare(rawOtp, rec.otp_hash);
      if (!valid) {
        await client.query(
          `UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1`,
          [rec.id]
        );
        await client.query("COMMIT");
        return fail(res, 400, "Incorrect code.", {
          attemptsLeft: Math.max(0, POLICY.MAX_VERIFY_ATTEMPTS - 1 - rec.attempts),
        });
      }

      /* ── Mark OTP used ── */
      const { rows: marked } = await client.query(
        `UPDATE email_verifications
         SET status = 'used', used_at = NOW()
         WHERE id = $1 AND status = 'active'
         RETURNING id`,
        [rec.id]
      );
      if (!marked.length) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Code already used.");
      }

      /* ── Mark user email verified ── */
      await client.query(
        `UPDATE users
         SET email_verified    = TRUE,
             email_verified_at = NOW(),
             verified          = TRUE,
             updated_at        = NOW()
         WHERE id = $1`,
        [userId]
      );

      /* ── Refresh trust score ── */
      const trustScore = await refreshTrustScore(client, userId);

      await client.query("COMMIT");

      /* ══════════════════════════════════════════════════════
         GRANT REFERRAL REWARD — after COMMIT
         ✅ Runs AFTER the transaction commits so the user's
            email_verified = true is visible to the query.
         ✅ Uses inline JS — no DB stored function.
         ✅ Awaited so errors are logged immediately.
      ══════════════════════════════════════════════════════ */
      try {
        await grantReferralRewardOnVerify(userId, ip);
      } catch (refErr) {
        /* Already caught inside the function — belt and braces */
        console.error(
          "[verify-otp] referral reward outer catch:", refErr.message
        );
      }

      /* ── Reactivate limited listings ── */
      reactivateLimitedListings(userId).catch((e) =>
        console.error("[verify-otp] reactivate failed:", e.message)
      );

      /* ── Audit ── */
      writeAudit({
        actorId    : userId,
        action     : "email_verified",
        targetType : "user",
        targetId   : userId,
        metadata   : { trust_score: trustScore },
        ipAddress  : ip,
      }).catch(() => {});

      /* ── Welcome email ── */
      pool.query(
        `SELECT email, name FROM users WHERE id = $1`, [userId]
      ).then(({ rows: u }) => {
        if (u[0]) {
          sendWelcomeEmail({
            to   : u[0].email,
            name : u[0].name,
          }).catch(() => {});
        }
      }).catch(() => {});

      return res.json({
        success     : true,
        message     : "Email verified successfully.",
        trust_score : trustScore,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[verify-otp] ERROR:", err.message, "\n", err.stack);
      return fail(res, 500, `Database error: ${err.message}`);
    } finally {
      client.release();
    }
  }
);

/* ════════════════════════════════════════════════════════════
   POST /face-check
════════════════════════════════════════════════════════════ */
router.post(
  "/face-check",
  authenticate,
  faceCheckLimiter,
  withUpload(uploadFaceCheck),
  async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 401, "Not authenticated.");

    const selfieFile   = req.files?.selfie?.[0]    ?? null;
    const docFrontFile = req.files?.doc_front?.[0] ?? null;

    if (!selfieFile)   return fail(res, 400, "Selfie photo is required.");
    if (!docFrontFile) return fail(res, 400, "Document front image is required.");

    try {
      const result = await compareFaces(selfieFile.buffer, docFrontFile.buffer);
      return res.json({
        success    : true,
        match      : result.match,
        confidence : result.confidence,
        skipped    : result.skipped,
        message    : result.message,
      });
    } catch (err) {
      console.error("[face-check] ERROR:", err.message, "\n", err.stack);
      return res.json({
        success  : true,
        match    : null,
        skipped  : true,
        message  : err.message,
      });
    }
  }
);

/* ════════════════════════════════════════════════════════════
   POST /submit
════════════════════════════════════════════════════════════ */
router.post(
  "/submit",
  authenticate,
  submitLimiter,
  withUpload(uploadSubmit),
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);
    if (!userId) return fail(res, 401, "Not authenticated.");

    const docType        = (req.body.document_type   ?? "").trim();
    const docNumber      = (req.body.document_number ?? "").trim();
    const livenessPassed = req.body.liveness_passed  === "true";

    if (!VALID_DOC_TYPES.has(docType))
      return fail(res, 400, "Invalid document type.");

    const validateDoc = DOC_VALIDATORS[docType];
    if (!validateDoc || !validateDoc(docNumber))
      return fail(res, 400, `Invalid ${docType.replace(/_/g," ")} format.`);

    const frontFile  = req.files?.doc_front?.[0]     ?? null;
    const backFile   = req.files?.doc_back?.[0]      ?? null;
    const selfieFile = req.files?.selfie?.[0]         ?? null;
    const logoFile   = req.files?.store_logo?.[0]     ?? null;
    const lvFile     = req.files?.liveness_frame?.[0] ?? null;

    if (!frontFile)  return fail(res, 400, "Document front photo is required.");
    if (!backFile)   return fail(res, 400, "Document back photo is required.");
    if (!selfieFile) return fail(res, 400, "Selfie photo is required.");

    for (const f of [frontFile, backFile, selfieFile]) {
      if (!extMatchesMime(f))
        return fail(
          res, 400,
          `File "${f.originalname}" extension does not match content.`
        );
    }

    if (logoFile && logoFile.size > MAX_LOGO_BYTES)
      return fail(res, 400, "Store logo must be 2 MB or smaller.");

    const docHash = hashDocNumber(docType, docNumber);

    const [userRes, pendingIdRes, pendingStRes, dupRes] = await Promise.all([
      pool.query(
        `SELECT email_verified, identity_verified, store_verified, status
         FROM users WHERE id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT id FROM identity_verifications
         WHERE user_id = $1 AND status IN ('pending','approved') LIMIT 1`,
        [userId]
      ),
      pool.query(
        `SELECT id FROM store_verifications
         WHERE user_id = $1 AND status IN ('pending','approved') LIMIT 1`,
        [userId]
      ),
      docHash
        ? pool.query(
            `SELECT id FROM identity_verifications
             WHERE document_number_hash = $1
               AND status IN ('pending','approved') LIMIT 1`,
            [docHash]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const user = userRes.rows[0];
    if (!user)                                                   return fail(res, 404, "User account not found.");
    if (user.status === "flagged" || user.status === "banned")   return fail(res, 403, "Account restricted.");
    if (!user.email_verified)                                    return fail(res, 403, "Verify email address first.");
    if (user.identity_verified)                                  return fail(res, 400, "Identity already verified.");
    if (pendingIdRes.rows.length)                                return fail(res, 409, "Identity review is already pending.");
    if (pendingStRes.rows.length)                                return fail(res, 409, "Store review is already pending.");
    if (dupRes.rows.length) {
      writeAudit({
        actorId    : userId,
        action     : "identity_duplicate_rejected",
        targetType : "user",
        targetId   : userId,
        metadata   : { document_type: docType },
        ipAddress  : ip,
      }).catch(() => {});
      return fail(res, 409, "This document number is already registered.");
    }

    const faceResult = await compareFaces(
      selfieFile.buffer, frontFile.buffer
    );

    if (!faceResult.skipped && faceResult.match === false) {
      writeAudit({
        actorId    : userId,
        action     : "verification_face_mismatch",
        targetType : "user",
        targetId   : userId,
        metadata   : { confidence: faceResult.confidence },
        ipAddress  : ip,
      }).catch(() => {});
      return fail(res, 422, "Selfie face does not match document photo.");
    }

    let front, back, selfie, logo, liveness;
    try {
      [front, back, selfie, logo, liveness] = await Promise.all([
        uploadBuffer(frontFile.buffer,  "id_documents",   userId),
        uploadBuffer(backFile.buffer,   "id_documents",   userId),
        uploadBuffer(selfieFile.buffer, "selfies",         userId),
        logoFile ? uploadBuffer(logoFile.buffer, "store_logos",    userId) : Promise.resolve(null),
        lvFile   ? uploadBuffer(lvFile.buffer,  "liveness_frames", userId) : Promise.resolve(null),
      ]);
    } catch (uploadErr) {
      console.error("[submit] upload error:", uploadErr.message);
      return fail(res, 500, `Upload failed: ${uploadErr.message}`);
    }

    const storeDocuments = {
      ...(logo?.secure_url ? { logo_url: logo.secure_url } : {}),
    };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO identity_verifications
           (user_id, document_type, document_number_hash,
            front_image_url, back_image_url, selfie_url,
            liveness_frame_url, liveness_passed,
            face_match, face_confidence, face_skipped, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')`,
        [
          userId, docType, docHash ?? null,
          front.secure_url, back.secure_url, selfie.secure_url,
          liveness?.secure_url ?? null, livenessPassed,
          faceResult.match, faceResult.confidence, faceResult.skipped,
        ]
      );

      await client.query(
        `INSERT INTO store_verifications (user_id, documents_url, status)
         VALUES ($1, $2, 'pending')`,
        [userId, JSON.stringify(storeDocuments)]
      );

      await client.query("COMMIT");
    } catch (dbErr) {
      await client.query("ROLLBACK").catch(() => {});
      if (dbErr.code === "23505")
        return fail(res, 409, "Document already registered.");
      console.error("[submit] DB ERROR:", dbErr.message, "\n", dbErr.stack);
      return fail(res, 500, `Database transaction failed: ${dbErr.message}`);
    } finally {
      client.release();
    }

    writeAudit({
      actorId    : userId,
      action     : "verification_submitted",
      targetType : "user",
      targetId   : userId,
      metadata   : {
        document_type    : docType,
        liveness_passed  : livenessPassed,
        face_match       : faceResult.match,
        face_confidence  : faceResult.confidence,
        face_skipped     : faceResult.skipped,
        store_logo_saved : !!logo?.secure_url,
      },
      ipAddress  : ip,
    }).catch(() => {});

    return res.status(202).json({
      success : true,
      message : "Submission received. Our team will review within 24 hours.",
    });
  }
);

/* ════════════════════════════════════════════════════════════
   GET /status
════════════════════════════════════════════════════════════ */
router.get("/status", authenticate, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const [userRes, idRes, storeRes, limitedRes] = await Promise.all([
      pool.query(
        `SELECT id, email, name, role, seller_type, status,
                email_verified, email_verified_at,
                identity_verified, store_verified,
                trust_score, created_at,
                referral_code, bonus_spins, total_referrals
         FROM users WHERE id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT document_type, status, rejection_reason,
                face_match, face_confidence, face_skipped,
                liveness_passed, updated_at
         FROM identity_verifications
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      ),
      pool.query(
        `SELECT status, rejection_reason, updated_at
         FROM store_verifications
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) AS cnt, MIN(active_until) AS soonest
         FROM products
         WHERE seller_id  = $1
           AND status     = 'active_limited'
           AND (active_until IS NULL OR active_until > NOW())`,
        [userId]
      ),
    ]);

    if (!userRes.rows.length) return fail(res, 404, "User not found.");

    const user        = userRes.rows[0];
    const idReview    = idRes.rows[0]    ?? null;
    const storeReview = storeRes.rows[0] ?? null;

    const dailyCount   = await getDailySendCount(pool, userId);
    const limitedCount = parseInt(limitedRes.rows[0].cnt, 10);
    const soonest      = limitedRes.rows[0].soonest ?? null;
    const daysLeft     = soonest
      ? Math.max(0, Math.ceil(
          (new Date(soonest).getTime() - Date.now()) / 86_400_000
        ))
      : null;

    return res.json({
      success           : true,
      email             : maskEmail(user.email),
      name              : user.name,
      role              : user.role,
      seller_type       : user.seller_type,
      status            : user.status,
      email_verified    : user.email_verified,
      email_verified_at : user.email_verified_at,
      identity_verified : user.identity_verified,
      store_verified    : user.store_verified,
      identity_review   : idReview,
      store_review      : storeReview,
      trust_score       : user.trust_score ?? 0,
      resend_remaining  : Math.max(0, POLICY.DAILY_SEND_LIMIT - dailyCount),
      resend_limit      : POLICY.DAILY_SEND_LIMIT,
      referral          : {
        code            : user.referral_code  ?? null,
        bonus_spins     : user.bonus_spins    ?? 0,
        total_referrals : user.total_referrals ?? 0,
      },
      limited_listings  : {
        count          : limitedCount,
        soonest_expiry : soonest,
        days_remaining : daysLeft,
        message        : limitedCount > 0
          ? `${limitedCount} listing${limitedCount !== 1 ? "s" : ""} will expire in ${daysLeft ?? "?"} day${daysLeft !== 1 ? "s" : ""}.`
          : null,
      },
    });

  } catch (err) {
    console.error("[status] ERROR:", err.message, "\n", err.stack);
    return fail(res, 500, `Database error: ${err.message}`);
  }
});

export default router;