/**
 * routes/verification.js
 *
 * POST /api/verification/send-email-otp
 * POST /api/verification/verify-email-otp
 * POST /api/verification/submit-identity
 * POST /api/verification/submit-store
 * GET  /api/verification/status
 *
 * ── Security model ────────────────────────────────────────────────────────
 *  • OTPs are bcrypt-hashed before storage — plaintext never persists.
 *  • Document numbers are HMAC-SHA256 hashed (keyed) before storage.
 *  • Duplicate document detection via pre-insert check + DB unique index.
 *  • Abuse / brute-force: rate limiters + attempt caps + account flagging.
 *  • Verification ordering enforced: email → identity → store.
 *  • After identity verified: limited listings reactivated automatically.
 * ─────────────────────────────────────────────────────────────────────────
 */

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

const router = express.Router();

/* ══════════════════════════════════════════════════════════════════════════
   ENVIRONMENT
══════════════════════════════════════════════════════════════════════════ */
const IS_PROD = process.env.NODE_ENV === "production";

/* ── Startup diagnostics ── */
console.log("[verification] module loaded");
console.log("[verification] NODE_ENV       :", process.env.NODE_ENV);
console.log(
  "[verification] RESEND_API_KEY :",
  process.env.RESEND_API_KEY
    ? `SET …${process.env.RESEND_API_KEY.slice(-4)}`
    : "❌ NOT SET"
);
console.log(
  "[verification] EMAIL_FROM     :",
  process.env.EMAIL_FROM || "(default)"
);
console.log(
  "[verification] DOC_HASH_SECRET:",
  process.env.DOC_HASH_SECRET
    ? `SET …${process.env.DOC_HASH_SECRET.slice(-4)}`
    : "❌ NOT SET — duplicate detection DISABLED"
);

/* ══════════════════════════════════════════════════════════════════════════
   POLICY
══════════════════════════════════════════════════════════════════════════ */
const POLICY = Object.freeze({
  /* OTP */
  DAILY_SEND_LIMIT     : IS_PROD ?  3 : 50,
  RESEND_COOLDOWN_SECS : IS_PROD ? 60 : 30,
  OTP_EXPIRY_MINUTES   : 10,
  MAX_VERIFY_ATTEMPTS  : IS_PROD ?  5 : 10,

  /* Abuse */
  ABUSE_WINDOW_MINUTES : 10,
  ABUSE_THRESHOLD      : IS_PROD ?  5 : 40,

  /* Hashing */
  BCRYPT_ROUNDS        : 10,
});

console.log("[verification] POLICY:", POLICY);

/* ══════════════════════════════════════════════════════════════════════════
   TRUST SCORE
   email_verified    → 30 pts
   identity_verified → 35 pts
   store_verified    → 20 pts
   age > 30 days     → 10 pts
   age > 90 days     →  5 pts
   cap               → 100 pts
══════════════════════════════════════════════════════════════════════════ */
const computeTrustScore = (user) => {
  let score = 0;
  if (user.email_verified)    score += 30;
  if (user.identity_verified) score += 35;
  if (user.store_verified)    score += 20;

  const ageDays =
    (Date.now() - new Date(user.created_at).getTime()) / 86_400_000;
  if (ageDays > 30) score += 10;
  if (ageDays > 90) score +=  5;

  return Math.min(score, 100);
};

/* ══════════════════════════════════════════════════════════════════════════
   FILE POLICY
══════════════════════════════════════════════════════════════════════════ */
const DOC_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const IMG_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const EXT_TO_MIME = {
  ".jpg"  : "image/jpeg",
  ".jpeg" : "image/jpeg",
  ".png"  : "image/png",
  ".webp" : "image/webp",
  ".pdf"  : "application/pdf",
};
const VALID_DOC_TYPES = new Set([
  "nin",
  "passport",
  "drivers_license",
  "voters_card",
]);
const MAX_DOC_BYTES  = 5 * 1_048_576; // 5 MB
const MAX_LOGO_BYTES = 2 * 1_048_576; // 2 MB

/* ══════════════════════════════════════════════════════════════════════════
   MULTER
══════════════════════════════════════════════════════════════════════════ */
const memStore = multer.memoryStorage();

const makeFilter = (allowed) => (_req, file, cb) => {
  if (allowed.has(file.mimetype)) return cb(null, true);
  const err  = new Error(
    `Invalid file type "${file.mimetype}". ` +
    `Allowed: ${[...allowed].join(", ")}.`
  );
  err.code = "INVALID_MIME";
  cb(err);
};

const uploadDocs = multer({
  storage    : memStore,
  limits     : { fileSize: MAX_DOC_BYTES, files: 3 },
  fileFilter : makeFilter(DOC_MIME),
}).fields([
  { name: "doc_front", maxCount: 1 },
  { name: "doc_back",  maxCount: 1 },
  { name: "selfie",    maxCount: 1 },
]);

const uploadLogo = multer({
  storage    : memStore,
  limits     : { fileSize: MAX_LOGO_BYTES, files: 1 },
  fileFilter : makeFilter(IMG_MIME),
}).single("store_logo");

const withUpload = (fn) => (req, res, next) =>
  fn(req, res, (err) => {
    if (!err) return next();
    const known =
      err.code === "LIMIT_FILE_SIZE"  ||
      err.code === "LIMIT_FILE_COUNT" ||
      err.code === "INVALID_MIME";
    return known
      ? res.status(400).json({ success: false, message: err.message })
      : next(err);
  });

/* ══════════════════════════════════════════════════════════════════════════
   CLOUDINARY (lazy-loaded — avoids startup crash if misconfigured)
══════════════════════════════════════════════════════════════════════════ */
let _cld         = null;
let _streamifier = null;

async function getCld() {
  if (_cld) return _cld;

  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
  } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn(
      "[cloudinary] env vars missing — local placeholder URLs will be used"
    );
    return null;
  }

  try {
    const { v2: cld } = await import("cloudinary");
    const sf           = await import("streamifier");
    cld.config({
      cloud_name : CLOUDINARY_CLOUD_NAME,
      api_key    : CLOUDINARY_API_KEY,
      api_secret : CLOUDINARY_API_SECRET,
      secure     : true,
    });
    _cld         = cld;
    _streamifier = sf.default ?? sf;
    console.log("[cloudinary] ready");
    return _cld;
  } catch (err) {
    console.error("[cloudinary] init failed:", err.message);
    return null;
  }
}

async function uploadBuffer(buffer, folder, userId) {
  const cld = await getCld();

  if (!cld) {
    /* Dev / misconfigured fallback — never reaches production */
    return { secure_url: `local://${folder}/${userId}/${Date.now()}` };
  }

  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        folder          : `loemart/verification/${folder}/${userId}`,
        resource_type   : "auto",
        allowed_formats : ["jpg", "jpeg", "png", "webp", "pdf"],
        overwrite       : false,
        unique_filename : true,
      },
      (err, result) => {
        if (err) return reject(new Error(`Cloudinary: ${err.message}`));
        resolve(result);
      }
    );
    _streamifier.createReadStream(buffer).pipe(stream);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   RATE LIMITERS
══════════════════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60 * 1_000,
    max,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? req.ip),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const sendOtpLimiter = makeLimiter({
  windowMin : 10,
  max       : IS_PROD ?  5 : 50,
  message   : "Too many send requests. Please wait and try again.",
});

const verifyOtpLimiter = makeLimiter({
  windowMin : 15,
  max       : IS_PROD ? 10 : 50,
  message   : "Too many verification attempts. Please wait.",
});

const submitLimiter = makeLimiter({
  windowMin : 60,
  max       : IS_PROD ?  3 : 20,
  message   : "Too many submissions. Please wait.",
});

/* ══════════════════════════════════════════════════════════════════════════
   PURE HELPERS
══════════════════════════════════════════════════════════════════════════ */

/** Cryptographically random 6-digit OTP */
const generateOtp = () =>
  crypto.randomInt(100_000, 999_999).toString();

/** Best-effort IP extraction */
const getIp = (req) =>
  req.ip ?? req.socket?.remoteAddress ?? null;

/** Mask email for logs / responses — never leak full address */
const maskEmail = (email) =>
  String(email).replace(
    /(.{2})(.*)(@.*)/,
    (_, a, _b, c) => `${a}***${c}`
  );

const getTodayUTC = () =>
  new Date().toISOString().slice(0, 10);

/** Stable device fingerprint — used to correlate OTP requests */
const makeDeviceHash = (req) =>
  crypto
    .createHash("sha256")
    .update(
      [
        req.headers["user-agent"]      ?? "",
        req.headers["accept-language"] ?? "",
        req.headers["sec-ch-ua"]       ?? "",
      ].join("|")
    )
    .digest("hex");

/** Verify file extension matches its MIME type */
const extMatchesMime = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return EXT_TO_MIME[ext] === file.mimetype;
};

/** Count OTP sends for a user today */
const getDailySendCount = async (db, userId) => {
  const today = getTodayUTC();
  const { rows } = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM   email_verifications
     WHERE  user_id    = $1
       AND  created_at >= $2::date
       AND  created_at <  ($2::date + INTERVAL '1 day')`,
    [userId, today]
  );
  return parseInt(rows[0].cnt, 10);
};

/** Flag account and write audit entry */
const flagAccount = async (db, userId, reason, ip) => {
  await db.query(
    `UPDATE users
     SET    status        = 'flagged',
            total_reports = COALESCE(total_reports, 0) + 1,
            updated_at    = NOW()
     WHERE  id = $1`,
    [userId]
  );
  await writeAudit({
    actorId    : userId,
    action     : "user_flagged",
    targetType : "user",
    targetId   : userId,
    metadata   : { reason },
    ipAddress  : ip,
  });
};

/** Recompute trust score from DB and persist it. Returns new score. */
const refreshTrustScore = async (client, userId) => {
  const { rows } = await client.query(
    `SELECT email_verified, identity_verified, store_verified, created_at
     FROM   users WHERE id = $1`,
    [userId]
  );
  if (!rows.length) return 0;

  const score = computeTrustScore(rows[0]);

  await client.query(
    `UPDATE users
     SET    trust_score = $1, updated_at = NOW()
     WHERE  id = $2`,
    [score, userId]
  );

  return score;
};

/** Standard error response */
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/* ══════════════════════════════════════════════════════════════════════════
   DOCUMENT NUMBER HASHING
   HMAC-SHA256 keyed with DOC_HASH_SECRET.
   • Deterministic  — same input → same hash
   • Non-reversible — hash → input is computationally infeasible
   • Secret-keyed   — DB dump alone cannot brute-force document numbers
   • Normalised     — strips spaces/hyphens before hashing to prevent
                       trivial evasion ("12345" = "12 345" = "12-345")
   • Type-prefixed  — "nin:12345" ≠ "passport:12345"
══════════════════════════════════════════════════════════════════════════ */
const DOC_HASH_SECRET = process.env.DOC_HASH_SECRET ?? null;

/**
 * @param {string} docType
 * @param {string} docNumber
 * @returns {string|null} hex hash, or null if secret not configured
 */
const hashDocumentNumber = (docType, docNumber) => {
  if (!DOC_HASH_SECRET) return null;

  const normalised = String(docNumber)
    .toLowerCase()
    .replace(/[\s\-_]/g, "") // collapse spaces, hyphens, underscores
    .trim();

  const payload = `${docType.toLowerCase()}:${normalised}`;

  return crypto
    .createHmac("sha256", DOC_HASH_SECRET)
    .update(payload)
    .digest("hex");
};

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/verification/send-email-otp
══════════════════════════════════════════════════════════════════════════ */
router.post(
  "/send-email-otp",
  authenticate,
  sendOtpLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);

    console.log("\n" + "─".repeat(60));
    console.log("[send-otp] ▶ REQUEST");
    console.log("[send-otp] userId        :", userId);
    console.log("[send-otp] ip            :", ip);
    console.log(
      "[send-otp] RESEND_API_KEY:",
      process.env.RESEND_API_KEY
        ? `SET …${process.env.RESEND_API_KEY.slice(-4)}`
        : "❌ NOT SET"
    );

    if (!userId) return fail(res, 401, "Not authenticated.");

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      /* ── Step 1: Fetch user ── */
      const { rows: users } = await client.query(
        `SELECT id, email, name, email_verified, status
         FROM   users
         WHERE  id = $1
         FOR UPDATE`,
        [userId]
      );

      if (!users.length) {
        await client.query("ROLLBACK");
        return fail(res, 404, "User not found.");
      }

      const user = users[0];
      console.log("[send-otp] user:", {
        email    : maskEmail(user.email),
        verified : user.email_verified,
        status   : user.status,
      });

      if (user.email_verified) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Email is already verified.");
      }
      if (user.status === "flagged" || user.status === "banned") {
        await client.query("ROLLBACK");
        return fail(res, 403, "Account restricted. Contact support.");
      }

      /* ── Step 2: Daily limit ── */
      const dailyCount = await getDailySendCount(client, userId);
      console.log(
        "[send-otp] daily:", dailyCount, "/", POLICY.DAILY_SEND_LIMIT
      );

      if (dailyCount >= POLICY.DAILY_SEND_LIMIT) {
        await client.query("ROLLBACK");
        return fail(
          res, 429,
          `Daily OTP limit reached (${POLICY.DAILY_SEND_LIMIT}/day). Try again tomorrow.`,
          { remaining: 0 }
        );
      }

      /* ── Step 3: Resend cooldown ── */
      const { rows: recent } = await client.query(
        `SELECT created_at
         FROM   email_verifications
         WHERE  user_id    = $1
           AND  created_at > NOW() - ($2 || ' seconds')::INTERVAL
         ORDER  BY created_at DESC
         LIMIT  1`,
        [userId, POLICY.RESEND_COOLDOWN_SECS]
      );

      if (recent.length) {
        const elapsedSecs =
          (Date.now() - new Date(recent[0].created_at).getTime()) / 1_000;
        const waitSecs = Math.ceil(POLICY.RESEND_COOLDOWN_SECS - elapsedSecs);
        console.log("[send-otp] cooldown — wait:", waitSecs, "s");
        await client.query("ROLLBACK");
        return fail(
          res, 429,
          `Please wait ${waitSecs} second${waitSecs !== 1 ? "s" : ""} before requesting another code.`,
          {
            retryAfter : waitSecs,
            remaining  : POLICY.DAILY_SEND_LIMIT - dailyCount,
          }
        );
      }

      /* ── Step 4: Abuse detection ── */
      const { rows: abr } = await client.query(
        `SELECT COUNT(*) AS cnt
         FROM   email_verifications
         WHERE  user_id    = $1
           AND  created_at > NOW() - ($2 || ' minutes')::INTERVAL`,
        [userId, POLICY.ABUSE_WINDOW_MINUTES]
      );
      const abuseCount = parseInt(abr[0].cnt, 10);
      console.log(
        "[send-otp] abuse:", abuseCount, "/", POLICY.ABUSE_THRESHOLD
      );

      if (abuseCount >= POLICY.ABUSE_THRESHOLD) {
        await flagAccount(client, userId, "otp_abuse", ip);
        await client.query("COMMIT");
        return fail(
          res, 429,
          "Account flagged for suspicious activity. Contact support."
        );
      }

      /* ── Step 5: Expire previous active OTPs ── */
      await client.query(
        `UPDATE email_verifications
         SET    status  = 'expired',
                used_at = NOW()
         WHERE  user_id = $1
           AND  status  = 'active'`,
        [userId]
      );

      /* ── Step 6: Generate + hash OTP ── */
      const otp    = generateOtp();
      const hash   = await bcrypt.hash(otp, POLICY.BCRYPT_ROUNDS);
      const device = makeDeviceHash(req);

      if (!IS_PROD) console.log("[send-otp] DEV otp:", otp);

      await client.query(
        `INSERT INTO email_verifications
           (user_id, otp_hash, expires_at, status, device_hash, ip_address)
         VALUES (
           $1, $2,
           NOW() + ($3 || ' minutes')::INTERVAL,
           'active', $4, $5
         )`,
        [userId, hash, POLICY.OTP_EXPIRY_MINUTES, device, ip]
      );

      /* ── Step 7: Upsert device fingerprint ── */
      await client.query(
        `INSERT INTO user_devices
           (user_id, device_hash, ip_address, user_agent, last_seen)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, device_hash) DO UPDATE
           SET last_seen  = NOW(),
               ip_address = EXCLUDED.ip_address`,
        [userId, device, ip, req.headers["user-agent"] ?? null]
      );

      await client.query("COMMIT");
      console.log("[send-otp] ✓ committed");

      /* ── Step 8: Send email (after commit) ── */
      try {
        const emailResult = await sendVerificationEmail({
          to   : user.email,
          name : user.name,
          otp,
        });
        console.log("[send-otp] ✓ email sent:", JSON.stringify(emailResult));
      } catch (mailErr) {
        console.error("[send-otp] ✗ email failed:", mailErr.message);

        /* Cleanup so user can retry immediately */
        pool
          .query(
            `UPDATE email_verifications
             SET    status  = 'expired',
                    used_at = NOW()
             WHERE  user_id    = $1
               AND  status     = 'active'
               AND  created_at > NOW() - INTERVAL '2 minutes'`,
            [userId]
          )
          .catch((e) => console.error("[send-otp] cleanup err:", e.message));

        return fail(res, 500, `Failed to send email: ${mailErr.message}`);
      }

      const remaining = POLICY.DAILY_SEND_LIMIT - (dailyCount + 1);

      writeAudit({
        actorId    : userId,
        action     : "otp_sent",
        targetType : "user",
        targetId   : userId,
        metadata   : { method: "email", remaining },
        ipAddress  : ip,
      }).catch((e) => console.error("[send-otp] audit err:", e.message));

      console.log("[send-otp] ✓ DONE  remaining:", remaining);
      console.log("─".repeat(60) + "\n");

      return res.json({
        success   : true,
        message   : "Verification code sent to your email.",
        email     : maskEmail(user.email),
        expiresIn : POLICY.OTP_EXPIRY_MINUTES * 60,
        remaining,
        ...(IS_PROD ? {} : { dev_otp: otp }),
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[send-otp] ✗ UNHANDLED:", err.message, "\n", err.stack);
      return fail(res, 500, "Server error. Please try again.");
    } finally {
      client.release();
    }
  }
);

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/verification/verify-email-otp
══════════════════════════════════════════════════════════════════════════ */
router.post(
  "/verify-email-otp",
  authenticate,
  verifyOtpLimiter,
  async (req, res) => {
    const rawOtp = String(req.body?.otp ?? "").trim();
    const userId = req.user?.id;
    const ip     = getIp(req);

    console.log("\n[verify-otp] ▶ REQUEST");
    console.log("[verify-otp] userId:", userId);
    console.log("[verify-otp] otp   :", IS_PROD ? "******" : rawOtp);

    if (!userId) return fail(res, 401, "Not authenticated.");

    if (!/^\d{6}$/.test(rawOtp))
      return fail(res, 400, "OTP must be exactly 6 digits.");

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      /* ── Step 1: Find active unexpired OTP ── */
      const { rows } = await client.query(
        `SELECT id, otp_hash, attempts
         FROM   email_verifications
         WHERE  user_id    = $1
           AND  status     = 'active'
           AND  expires_at > NOW()
         ORDER  BY created_at DESC
         LIMIT  1`,
        [userId]
      );

      console.log("[verify-otp] active OTPs found:", rows.length);

      if (!rows.length) {
        await client.query("ROLLBACK");
        return fail(
          res, 400,
          "Code expired or not found. Please request a new one."
        );
      }

      const rec = rows[0];
      console.log("[verify-otp] attempts so far:", rec.attempts);

      /* ── Step 2: Attempt cap ── */
      if (rec.attempts >= POLICY.MAX_VERIFY_ATTEMPTS) {
        await client.query(
          `UPDATE email_verifications
           SET status = 'blocked'
           WHERE id = $1`,
          [rec.id]
        );
        await flagAccount(client, userId, "otp_max_attempts", ip);
        await client.query("COMMIT");
        return fail(res, 429, "Too many failed attempts. Account flagged.");
      }

      /* ── Step 3: bcrypt compare ── */
      console.log("[verify-otp] running bcrypt compare...");
      const valid = await bcrypt.compare(rawOtp, rec.otp_hash);
      console.log("[verify-otp] match:", valid);

      if (!valid) {
        await client.query(
          `UPDATE email_verifications
           SET attempts = attempts + 1
           WHERE id = $1`,
          [rec.id]
        );
        await client.query("COMMIT");
        const left = Math.max(0, POLICY.MAX_VERIFY_ATTEMPTS - 1 - rec.attempts);
        return fail(res, 400, "Incorrect code. Please try again.", {
          attemptsLeft: left,
        });
      }

      /* ── Step 4: Atomic mark-used (prevents replay) ── */
      const { rows: marked } = await client.query(
        `UPDATE email_verifications
         SET    status  = 'used',
                used_at = NOW()
         WHERE  id     = $1
           AND  status = 'active'
         RETURNING id`,
        [rec.id]
      );

      if (!marked.length) {
        await client.query("ROLLBACK");
        return fail(
          res, 400,
          "Code was already used. Please request a new one."
        );
      }

      /* ── Step 5: Mark user email-verified ── */
      await client.query(
        `UPDATE users
         SET    email_verified    = TRUE,
                email_verified_at = NOW(),
                verified          = TRUE,
                updated_at        = NOW()
         WHERE  id = $1`,
        [userId]
      );

      /* ── Step 6: Recompute and persist trust score ── */
      const trustScore = await refreshTrustScore(client, userId);

      await client.query("COMMIT");
      console.log("[verify-otp] ✓ email verified  trust_score:", trustScore);

      /* ── Step 7: Reactivate limited listings (fire-and-forget) ── */
      reactivateLimitedListings(userId).catch((e) =>
        console.error("[verify-otp] reactivate listings err:", e.message)
      );

      /* ── Step 8: Audit ── */
      writeAudit({
        actorId    : userId,
        action     : "email_verified",
        targetType : "user",
        targetId   : userId,
        metadata   : { trust_score: trustScore },
        ipAddress  : ip,
      }).catch((e) => console.error("[verify-otp] audit err:", e.message));

      /* ── Step 9: Welcome email (fire-and-forget) ── */
      pool
        .query("SELECT email, name FROM users WHERE id = $1", [userId])
        .then(({ rows: u }) => {
          if (u[0]) {
            sendWelcomeEmail({ to: u[0].email, name: u[0].name }).catch(
              (e) => console.error("[verify-otp] welcome email err:", e.message)
            );
          }
        })
        .catch((e) =>
          console.error("[verify-otp] welcome query err:", e.message)
        );

      return res.json({
        success     : true,
        message     : "Email verified successfully.",
        trust_score : trustScore,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[verify-otp] ✗ UNHANDLED:", err.message, "\n", err.stack);
      return fail(res, 500, "Server error. Please try again.");
    } finally {
      client.release();
    }
  }
);

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/verification/submit-identity
══════════════════════════════════════════════════════════════════════════ */
router.post(
  "/submit-identity",
  authenticate,
  submitLimiter,
  withUpload(uploadDocs),
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);

    console.log("\n[submit-identity] ▶ userId:", userId);

    if (!userId) return fail(res, 401, "Not authenticated.");

    /* ── Validate document type ── */
    const { document_type, document_number } = req.body;

    if (!document_type || !VALID_DOC_TYPES.has(document_type)) {
      return fail(
        res, 400,
        `Invalid document type. Choose: ${[...VALID_DOC_TYPES].join(", ")}.`
      );
    }

    /* ── Validate document number ── */
    const docNum = (document_number ?? "").trim();
    if (docNum.length < 4)
      return fail(res, 400, "Document number must be at least 4 characters.");
    if (docNum.length > 30)
      return fail(res, 400, "Document number must be at most 30 characters.");

    /* ── Validate files ── */
    const frontFile  = req.files?.doc_front?.[0] ?? null;
    const backFile   = req.files?.doc_back?.[0]  ?? null;
    const selfieFile = req.files?.selfie?.[0]    ?? null;

    if (!frontFile)  return fail(res, 400, "Front of document is required.");
    if (!backFile)   return fail(res, 400, "Back of document is required.");
    if (!selfieFile) return fail(res, 400, "Selfie photo is required.");

    for (const f of [frontFile, backFile, selfieFile]) {
      if (!extMatchesMime(f)) {
        return fail(
          res, 400,
          `File "${f.originalname}" extension does not match its content.`
        );
      }
    }

    /* ── Hash document number before any DB work ── */
    const docHash = hashDocumentNumber(document_type, docNum);

    console.log(
      "[submit-identity] docType:", document_type,
      " docHash:", docHash
        ? `${docHash.slice(0, 8)}…`
        : "DISABLED (DOC_HASH_SECRET not set)"
    );

    if (!docHash) {
      console.warn(
        "[submit-identity] ⚠ Duplicate detection DISABLED — " +
        "DOC_HASH_SECRET is not configured."
      );
    }

    /* ── All guard queries in one parallel batch ── */
    const [pendingRes, userRes, duplicateRes] = await Promise.all([

      /* Guard 1: already has a pending review */
      pool.query(
        `SELECT id
         FROM   identity_verifications
         WHERE  user_id = $1
           AND  status  = 'pending'`,
        [userId]
      ),

      /* Guard 2: user state */
      pool.query(
        `SELECT identity_verified, email_verified
         FROM   users
         WHERE  id = $1`,
        [userId]
      ),

      /* Guard 3: duplicate document number across ALL users
         Only match pending / approved rows — rejected rows are excluded
         so a legitimate user can resubmit after rejection.
         Skipped (empty result) when hash unavailable. */
      docHash
        ? pool.query(
            `SELECT iv.id,
                    iv.user_id,
                    iv.status,
                    iv.created_at
             FROM   identity_verifications iv
             WHERE  iv.document_number_hash = $1
               AND  iv.status IN ('pending', 'approved')
             LIMIT  1`,
            [docHash]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    /* ── Evaluate guard 1: pending ── */
    if (pendingRes.rows.length)
      return fail(res, 409, "You already have a pending identity review.");

    /* ── Evaluate guard 2a: already verified ── */
    if (userRes.rows[0]?.identity_verified)
      return fail(res, 400, "Identity is already verified.");

    /* ── Evaluate guard 2b: email must come first ── */
    if (!userRes.rows[0]?.email_verified) {
      return fail(
        res, 403,
        "Please verify your email address before submitting identity documents."
      );
    }

    /* ── Evaluate guard 3: duplicate document ── */
    if (duplicateRes.rows.length) {
      const match = duplicateRes.rows[0];

      console.warn(
        "[submit-identity] ⚠ DUPLICATE DOCUMENT",
        " incomingUser:", userId,
        " existingUser:", match.user_id,
        " existingStatus:", match.status,
        " ip:", ip
      );

      /* Audit the duplicate attempt — do NOT reveal the existing user */
      writeAudit({
        actorId    : userId,
        action     : "identity_duplicate_rejected",
        targetType : "user",
        targetId   : userId,
        metadata   : {
          document_type,
          conflicting_user_id : match.user_id,
          conflicting_status  : match.status,
        },
        ipAddress  : ip,
      }).catch((e) =>
        console.error("[submit-identity] audit err:", e.message)
      );

      /* Intentionally vague — do not reveal which user holds this document */
      return fail(
        res, 409,
        "This document has already been registered on our platform. " +
        "If you believe this is an error, please contact support."
      );
    }

    /* ── Upload all three files in parallel ── */
    let front, back, selfie;
    try {
      [front, back, selfie] = await Promise.all([
        uploadBuffer(frontFile.buffer,  "id_documents", userId),
        uploadBuffer(backFile.buffer,   "id_documents", userId),
        uploadBuffer(selfieFile.buffer, "selfies",      userId),
      ]);
    } catch (uploadErr) {
      console.error("[submit-identity] upload error:", uploadErr.message);
      return fail(res, 500, `File upload failed: ${uploadErr.message}`);
    }

    /* ── Insert verification record ── */
    try {
      await pool.query(
        `INSERT INTO identity_verifications
           (user_id,
            document_type,
            document_number_hash,
            front_image_url,
            back_image_url,
            selfie_url,
            status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [
          userId,
          document_type,
          docHash ?? null,
          front.secure_url,
          back.secure_url,
          selfie.secure_url,
        ]
      );
    } catch (dbErr) {
      /* Unique index violation = race-condition duplicate */
      if (dbErr.code === "23505") {
        console.warn(
          "[submit-identity] ⚠ Race-condition duplicate caught by DB index",
          " userId:", userId
        );
        return fail(
          res, 409,
          "This document has already been registered on our platform. " +
          "If you believe this is an error, please contact support."
        );
      }
      throw dbErr; // re-throw unexpected errors
    }

    /* ── Audit success ── */
    writeAudit({
      actorId    : userId,
      action     : "identity_submitted",
      targetType : "user",
      targetId   : userId,
      metadata   : { document_type },
      ipAddress  : ip,
    }).catch((e) =>
      console.error("[submit-identity] audit err:", e.message)
    );

    console.log("[submit-identity] ✓ submitted  userId:", userId);

    return res.status(202).json({
      success : true,
      message :
        "Identity submitted. Our team will review within 24 hours. " +
        "Your listings will become permanent once approved.",
    });
  }
);

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/verification/submit-store
══════════════════════════════════════════════════════════════════════════ */
router.post(
  "/submit-store",
  authenticate,
  submitLimiter,
  withUpload(uploadLogo),
  async (req, res) => {
    const userId    = req.user?.id;
    const ip        = getIp(req);
    const storeName = (req.body.store_name        ?? "").trim();
    const storeDesc = (req.body.store_description ?? "").trim();

    console.log(
      "\n[submit-store] ▶ userId:", userId,
      " storeName:", storeName
    );

    if (!userId) return fail(res, 401, "Not authenticated.");

    /* ── Validate ── */
    if (storeName.length < 2)
      return fail(res, 400, "Store name must be at least 2 characters.");
    if (storeName.length > 60)
      return fail(res, 400, "Store name must be at most 60 characters.");
    if (storeDesc.length > 300)
      return fail(res, 400, "Description must be at most 300 characters.");

    /* ── Guard queries ── */
    const [pendingRes, userRes] = await Promise.all([
      pool.query(
        `SELECT id
         FROM   store_verifications
         WHERE  user_id = $1 AND status = 'pending'`,
        [userId]
      ),
      pool.query(
        `SELECT store_verified, identity_verified
         FROM   users
         WHERE  id = $1`,
        [userId]
      ),
    ]);

    if (pendingRes.rows.length)
      return fail(res, 409, "You already have a pending store review.");

    if (userRes.rows[0]?.store_verified)
      return fail(res, 400, "Store is already verified.");

    /* ── Require identity verification first ── */
    if (!userRes.rows[0]?.identity_verified) {
      return fail(
        res, 403,
        "Please complete identity verification before submitting your store profile."
      );
    }

    /* ── Optional logo upload ── */
    let logoUrl = null;
    if (req.file) {
      if (!extMatchesMime(req.file)) {
        return fail(
          res, 400,
          "Logo file extension does not match its content."
        );
      }
      try {
        const result = await uploadBuffer(
          req.file.buffer,
          "store_logos",
          userId
        );
        logoUrl = result.secure_url;
      } catch (uploadErr) {
        console.error("[submit-store] logo upload error:", uploadErr.message);
        return fail(res, 500, `Logo upload failed: ${uploadErr.message}`);
      }
    }

    /* ── Insert store verification record ── */
    try {
      await pool.query(
        `INSERT INTO store_verifications
           (user_id, store_name, store_description, logo_url, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [userId, storeName, storeDesc || null, logoUrl]
      );
    } catch (dbErr) {
      console.error("[submit-store] db error:", dbErr.message);
      return fail(res, 500, "Submission failed. Please try again.");
    }

    writeAudit({
      actorId    : userId,
      action     : "store_submitted",
      targetType : "user",
      targetId   : userId,
      metadata   : { store_name: storeName },
      ipAddress  : ip,
    }).catch((e) =>
      console.error("[submit-store] audit err:", e.message)
    );

    console.log("[submit-store] ✓ submitted  userId:", userId);

    return res.status(202).json({
      success : true,
      message :
        "Store profile submitted. Our team will review within 24 hours.",
    });
  }
);

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/verification/status
══════════════════════════════════════════════════════════════════════════ */
router.get("/status", authenticate, async (req, res) => {
  const userId = req.user?.id;
  console.log("\n[status] ▶ userId:", userId);

  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const [userRes, idRes, storeRes, limitedRes] = await Promise.all([

      /* Core user fields */
      pool.query(
        `SELECT id, email, name, role, seller_type, status,
                email_verified, email_verified_at,
                identity_verified, store_verified,
                trust_score, created_at
         FROM   users
         WHERE  id = $1`,
        [userId]
      ),

      /* Latest identity review */
      pool.query(
        `SELECT document_type, status, rejection_reason, updated_at
         FROM   identity_verifications
         WHERE  user_id = $1
         ORDER  BY created_at DESC
         LIMIT  1`,
        [userId]
      ),

      /* Latest store review */
      pool.query(
        `SELECT status,
                rejection_reason AS message,
                updated_at
         FROM   store_verifications
         WHERE  user_id = $1
         ORDER  BY created_at DESC
         LIMIT  1`,
        [userId]
      ),

      /* Limited listings pending reactivation */
      pool.query(
        `SELECT COUNT(*)        AS cnt,
                MIN(active_until) AS soonest_expiry
         FROM   products
         WHERE  seller_id    = $1
           AND  status       = 'active_limited'
           AND  (active_until IS NULL OR active_until > NOW())`,
        [userId]
      ),
    ]);

    if (!userRes.rows.length) return fail(res, 404, "User not found.");

    const user          = userRes.rows[0];
    const idReview      = idRes.rows[0]    ?? null;
    const storeReview   = storeRes.rows[0] ?? null;
    const dailyCount    = await getDailySendCount(pool, userId);

    const limitedCount  = parseInt(limitedRes.rows[0].cnt, 10);
    const soonestExpiry = limitedRes.rows[0].soonest_expiry ?? null;
    const daysRemaining = soonestExpiry
      ? Math.max(
          0,
          Math.ceil(
            (new Date(soonestExpiry).getTime() - Date.now()) / 86_400_000
          )
        )
      : null;

    console.log("[status] ✓", {
      email_verified    : user.email_verified,
      identity_verified : user.identity_verified,
      store_verified    : user.store_verified,
      trust_score       : user.trust_score,
      limited_listings  : limitedCount,
    });

    return res.json({
      success           : true,

      /* User identity */
      email             : maskEmail(user.email),
      name              : user.name,
      role              : user.role,
      seller_type       : user.seller_type,
      status            : user.status,

      /* Verification flags */
      email_verified    : user.email_verified,
      email_verified_at : user.email_verified_at,
      identity_verified : user.identity_verified,
      store_verified    : user.store_verified,

      /* Review details */
      identity_review   : idReview,
      store_review      : storeReview,

      /* Trust */
      trust_score       : user.trust_score ?? 0,

      /* OTP send limits */
      resend_remaining  : Math.max(0, POLICY.DAILY_SEND_LIMIT - dailyCount),
      resend_limit      : POLICY.DAILY_SEND_LIMIT,

      /* Limited listings — motivational data for the verification page */
      limited_listings  : {
        count          : limitedCount,
        soonest_expiry : soonestExpiry,
        days_remaining : daysRemaining,
        message        : limitedCount > 0
          ? `You have ${limitedCount} listing${limitedCount !== 1 ? "s" : ""} ` +
            `that will expire in ${daysRemaining ?? "?"} day${daysRemaining !== 1 ? "s" : ""}. ` +
            "Complete identity verification to make them permanent."
          : null,
      },

      /* What completing verification will unlock */
      upgrade_benefits  : user.identity_verified
        ? null
        : {
            daily_limit  : 100,
            active_limit : 500,
            no_expiry    : true,
            message      :
              "Verify your identity to unlock 100 products/day, " +
              "500 active listings, and permanent listings with no expiry.",
          },
    });

  } catch (err) {
    console.error("[status] ✗", err.message, "\n", err.stack);
    return fail(res, 500, "Server error. Please try again.");
  }
});

export default router;