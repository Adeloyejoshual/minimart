/**
 * routes/verification.js
 *
 * POST /api/verification/send-email-otp
 * POST /api/verification/verify-email-otp
 * POST /api/verification/submit-identity
 * POST /api/verification/submit-store
 * GET  /api/verification/status
 */

import express      from "express";
import bcrypt       from "bcrypt";
import crypto       from "crypto";
import multer       from "multer";
import path         from "path";
import rateLimit    from "express-rate-limit";

import { pool }          from "../config/db.js";
import { authenticate }  from "../middleware/auth.js";
import { writeAudit }    from "../lib/audit.js";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
}                        from "../services/email.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════════════════════
   POLICY
   All limits are environment-aware so you flip one env var per deployment.
══════════════════════════════════════════════════════════════════════════════ */
const IS_PROD = process.env.NODE_ENV === "production";

const POLICY = {
  DAILY_SEND_LIMIT        : IS_PROD ?  3 : 50,
  RESEND_COOLDOWN_SECS    : IS_PROD ? 60 : 30,
  OTP_EXPIRY_MINUTES      : 10,
  MAX_VERIFY_ATTEMPTS     : IS_PROD ?  5 : 10,
  ABUSE_WINDOW_MINUTES    : 10,
  ABUSE_THRESHOLD         : IS_PROD ?  5 : 40,
  BCRYPT_ROUNDS           : 10,
};

/* ══════════════════════════════════════════════════════════════════════════════
   ALLOWED FILE TYPES
══════════════════════════════════════════════════════════════════════════════ */
const ALLOWED_DOC_MIME  = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const ALLOWED_IMG_MIME  = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const EXT_MIME_MAP = {
  ".jpg"  : "image/jpeg",
  ".jpeg" : "image/jpeg",
  ".png"  : "image/png",
  ".webp" : "image/webp",
  ".pdf"  : "application/pdf",
};
const DOC_TYPES = new Set(["nin", "passport", "drivers_license", "voters_card"]);

const MAX_DOC_BYTES  = 5  * 1_048_576; // 5 MB
const MAX_LOGO_BYTES = 2  * 1_048_576; // 2 MB

/* ══════════════════════════════════════════════════════════════════════════════
   MULTER
══════════════════════════════════════════════════════════════════════════════ */
const memStorage = multer.memoryStorage();

const docFilter = (_req, file, cb) => {
  if (ALLOWED_DOC_MIME.has(file.mimetype)) return cb(null, true);
  cb(Object.assign(
    new Error(`Invalid file type "${file.mimetype}". Allowed: JPG, PNG, WebP, PDF.`),
    { code: "INVALID_MIME" }
  ));
};

const logoFilter = (_req, file, cb) => {
  if (ALLOWED_IMG_MIME.has(file.mimetype)) return cb(null, true);
  cb(Object.assign(
    new Error(`Invalid logo type "${file.mimetype}". Allowed: JPG, PNG, WebP.`),
    { code: "INVALID_MIME" }
  ));
};

const uploadDocs = multer({
  storage    : memStorage,
  limits     : { fileSize: MAX_DOC_BYTES, files: 3 },
  fileFilter : docFilter,
}).fields([
  { name: "doc_front", maxCount: 1 },
  { name: "doc_back",  maxCount: 1 },
  { name: "selfie",    maxCount: 1 },
]);

const uploadLogo = multer({
  storage    : memStorage,
  limits     : { fileSize: MAX_LOGO_BYTES, files: 1 },
  fileFilter : logoFilter,
}).single("store_logo");

/* ── multer middleware wrapper — normalises errors ── */
const withUpload = (handler) => (req, res, next) => {
  handler(req, res, (err) => {
    if (!err) return next();

    const isMulter = err.code === "LIMIT_FILE_SIZE" ||
                     err.code === "LIMIT_FILE_COUNT"||
                     err.code === "INVALID_MIME";

    if (isMulter || err.message?.includes("Invalid")) {
      return res.status(400).json({ success: false, message: err.message });
    }

    next(err);
  });
};

/* ══════════════════════════════════════════════════════════════════════════════
   CLOUDINARY  (lazy — only loads when keys are present)
══════════════════════════════════════════════════════════════════════════════ */
let _cld        = null;
let _streamifier= null;

async function getCld() {
  if (_cld) return _cld;

  const hasKeys =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY    &&
    process.env.CLOUDINARY_API_SECRET;

  if (!hasKeys) return null;

  try {
    const { v2: cld } = await import("cloudinary");
    const sf           = await import("streamifier");

    cld.config({
      cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
      api_key    : process.env.CLOUDINARY_API_KEY,
      api_secret : process.env.CLOUDINARY_API_SECRET,
      secure     : true,
    });

    _cld         = cld;
    _streamifier = sf.default ?? sf;
    return _cld;
  } catch (err) {
    console.error("[cloudinary] failed to load:", err.message);
    return null;
  }
}

async function uploadBuffer(buffer, folder, userId) {
  const cld = await getCld();

  if (!cld) {
    const url = `local://${folder}/${userId}/${Date.now()}`;
    console.warn(`[upload] Cloudinary not configured — fake URL: ${url}`);
    return { secure_url: url };
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
        if (err) return reject(new Error(`Cloudinary upload failed: ${err.message}`));
        resolve(result);
      }
    );
    _streamifier.createReadStream(buffer).pipe(stream);
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   RATE LIMITERS
══════════════════════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs     : windowMin * 60 * 1_000,
    max,
    standardHeaders: true,
    legacyHeaders  : false,
    keyGenerator   : (req) => String(req.user?.id ?? req.ip),
    handler        : (_req, res) =>
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
  message   : "Too many submissions. Please wait before trying again.",
});

/* ══════════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════════ */
const generateOtp   = () => crypto.randomInt(100_000, 999_999).toString();
const getIp         = (req) => req.ip ?? req.socket?.remoteAddress ?? null;
const maskEmail     = (e) => e.replace(/(.{2})(.*)(@.*)/, (_, a, _b, c) => `${a}***${c}`);
const getTodayUTC   = () => new Date().toISOString().slice(0, 10);

const getDeviceHash = (req) =>
  crypto
    .createHash("sha256")
    .update([
      req.headers["user-agent"]      ?? "",
      req.headers["accept-language"] ?? "",
      req.headers["sec-ch-ua"]       ?? "",
    ].join("|"))
    .digest("hex");

/* Validate extension matches MIME — prevents renamed files */
const extMatchesMime = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return EXT_MIME_MAP[ext] === file.mimetype;
};

const getDailySendCount = async (client, userId) => {
  const today = getTodayUTC();
  const { rows } = await client.query(`
    SELECT COUNT(*) AS cnt
    FROM   email_verifications
    WHERE  user_id    = $1
      AND  created_at >= $2::date
      AND  created_at <  ($2::date + INTERVAL '1 day')
  `, [userId, today]);
  return parseInt(rows[0].cnt, 10);
};

const computeTrustScore = (u) => {
  let score = 0;
  if (u.email_verified)    score += 30;
  if (u.identity_verified) score += 30;
  if (u.store_verified)    score += 20;
  const ageDays = (Date.now() - new Date(u.created_at)) / 86_400_000;
  if (ageDays > 30)  score += 10;
  if (ageDays > 90)  score += 10;
  return Math.min(score, 100);
};

const flagAccount = async (client, userId, reason, ip) => {
  await client.query(`
    UPDATE users
    SET    status        = 'flagged',
           total_reports = COALESCE(total_reports, 0) + 1,
           updated_at    = NOW()
    WHERE  id = $1
  `, [userId]);

  await writeAudit({
    actorId    : userId,
    action     : "user_flagged",
    targetType : "user",
    targetId   : userId,
    metadata   : { reason },
    ipAddress  : ip,
  });
};

/* Reusable JSON error sender */
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/verification/send-email-otp
══════════════════════════════════════════════════════════════════════════════ */
router.post(
  "/send-email-otp",
  authenticate,
  sendOtpLimiter,
  async (req, res) => {
    const userId = req.user.id;
    const ip     = getIp(req);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      /* ── 1. Fetch user ───────────────────────────────────────────────────── */
      const { rows: users } = await client.query(`
        SELECT id, email, name, email_verified, status
        FROM   users
        WHERE  id = $1
        FOR    UPDATE
      `, [userId]);

      if (!users.length) {
        await client.query("ROLLBACK");
        return fail(res, 404, "User not found.");
      }

      const user = users[0];

      if (user.email_verified) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Email is already verified.");
      }

      if (user.status === "flagged" || user.status === "banned") {
        await client.query("ROLLBACK");
        return fail(res, 403, "Account restricted. Contact support.");
      }

      /* ── 2. Daily limit ──────────────────────────────────────────────────── */
      const dailyCount = await getDailySendCount(client, userId);

      if (dailyCount >= POLICY.DAILY_SEND_LIMIT) {
        await client.query("ROLLBACK");
        return fail(res, 429, `Daily limit reached (${POLICY.DAILY_SEND_LIMIT}/day). Try tomorrow.`, {
          remaining : 0,
        });
      }

      /* ── 3. Cooldown check ───────────────────────────────────────────────── */
      const { rows: recent } = await client.query(`
        SELECT created_at
        FROM   email_verifications
        WHERE  user_id    = $1
          AND  created_at > NOW() - ($2 || ' seconds')::INTERVAL
        ORDER  BY created_at DESC
        LIMIT  1
      `, [userId, POLICY.RESEND_COOLDOWN_SECS]);

      if (recent.length) {
        const elapsedSecs = (Date.now() - new Date(recent[0].created_at)) / 1_000;
        const waitSecs    = Math.ceil(POLICY.RESEND_COOLDOWN_SECS - elapsedSecs);
        await client.query("ROLLBACK");
        return fail(res, 429, `Wait ${waitSecs}s before requesting another code.`, {
          retryAfter : waitSecs,
          remaining  : POLICY.DAILY_SEND_LIMIT - dailyCount,
        });
      }

      /* ── 4. Abuse detection ──────────────────────────────────────────────── */
      const { rows: abuse } = await client.query(`
        SELECT COUNT(*) AS cnt
        FROM   email_verifications
        WHERE  user_id    = $1
          AND  created_at > NOW() - ($2 || ' minutes')::INTERVAL
      `, [userId, POLICY.ABUSE_WINDOW_MINUTES]);

      if (parseInt(abuse[0].cnt, 10) >= POLICY.ABUSE_THRESHOLD) {
        await flagAccount(client, userId, "otp_abuse", ip);
        await client.query("COMMIT");
        return fail(res, 429, "Account flagged for suspicious activity. Contact support.");
      }

      /* ── 5. Expire previous active OTPs ─────────────────────────────────── */
      await client.query(`
        UPDATE email_verifications
        SET    status  = 'expired',
               used_at = NOW()
        WHERE  user_id = $1
          AND  status  = 'active'
      `, [userId]);

      /* ── 6. Generate + hash OTP ──────────────────────────────────────────── */
      const otp    = generateOtp();
      const hash   = await bcrypt.hash(otp, POLICY.BCRYPT_ROUNDS);
      const device = getDeviceHash(req);

      await client.query(`
        INSERT INTO email_verifications
          (user_id, otp_hash, expires_at, status, device_hash, ip_address)
        VALUES (
          $1, $2,
          NOW() + ($3 || ' minutes')::INTERVAL,
          'active', $4, $5
        )
      `, [userId, hash, POLICY.OTP_EXPIRY_MINUTES, device, ip]);

      /* ── 7. Upsert device record ─────────────────────────────────────────── */
      await client.query(`
        INSERT INTO user_devices
          (user_id, device_hash, ip_address, user_agent, last_seen)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id, device_hash)
        DO UPDATE SET
          last_seen  = NOW(),
          ip_address = EXCLUDED.ip_address
      `, [userId, device, ip, req.headers["user-agent"] ?? null]);

      await client.query("COMMIT");

      /* ── 8. Send email AFTER commit ──────────────────────────────────────── */
      try {
        await sendVerificationEmail({ to: user.email, name: user.name, otp });
      } catch (mailErr) {
        console.error("[send-email-otp] mail failed:", mailErr.message);

        // Best-effort OTP cleanup — don't break if this fails
        await pool
          .query(`
            UPDATE email_verifications
            SET    status = 'expired', used_at = NOW()
            WHERE  user_id    = $1
              AND  status     = 'active'
              AND  created_at > NOW() - INTERVAL '2 minutes'
          `, [userId])
          .catch((e) => console.error("[send-email-otp] cleanup failed:", e.message));

        return fail(res, 500, `Failed to send email: ${mailErr.message}`);
      }

      const remaining = POLICY.DAILY_SEND_LIMIT - (dailyCount + 1);

      await writeAudit({
        actorId    : userId,
        action     : "otp_sent",
        targetType : "user",
        targetId   : userId,
        metadata   : { method: "email", remaining },
        ipAddress  : ip,
      }).catch(console.error); // audit failure must never break the response

      /* In development expose the OTP so you can test without a real inbox */
      const devPayload = !IS_PROD ? { dev_otp: otp } : {};

      return res.json({
        success   : true,
        message   : "Verification code sent to your email.",
        email     : maskEmail(user.email),
        expiresIn : POLICY.OTP_EXPIRY_MINUTES * 60,
        remaining,
        ...devPayload,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[send-email-otp]", err);
      return fail(res, 500, "Server error. Please try again.");
    } finally {
      client.release();
    }
  }
);

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/verification/verify-email-otp
══════════════════════════════════════════════════════════════════════════════ */
router.post(
  "/verify-email-otp",
  authenticate,
  verifyOtpLimiter,
  async (req, res) => {
    const rawOtp = String(req.body?.otp ?? "").trim();
    const userId = req.user.id;
    const ip     = getIp(req);

    /* Basic format check before touching DB */
    if (!/^\d{6}$/.test(rawOtp)) {
      return fail(res, 400, "OTP must be exactly 6 digits.");
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      /* ── 1. Load active, unexpired record ───────────────────────────────── */
      const { rows } = await client.query(`
        SELECT id, otp_hash, attempts
        FROM   email_verifications
        WHERE  user_id    = $1
          AND  status     = 'active'
          AND  expires_at > NOW()
        ORDER  BY created_at DESC
        LIMIT  1
      `, [userId]);

      if (!rows.length) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Code expired or not found. Request a new one.");
      }

      const rec = rows[0];

      /* ── 2. Attempt limit ───────────────────────────────────────────────── */
      if (rec.attempts >= POLICY.MAX_VERIFY_ATTEMPTS) {
        await client.query(`
          UPDATE email_verifications
          SET    status = 'blocked'
          WHERE  id = $1
        `, [rec.id]);
        await flagAccount(client, userId, "otp_max_attempts", ip);
        await client.query("COMMIT");
        return fail(res, 429, "Too many failed attempts. Account flagged.");
      }

      /* ── 3. Compare ─────────────────────────────────────────────────────── */
      const valid = await bcrypt.compare(rawOtp, rec.otp_hash);

      if (!valid) {
        await client.query(`
          UPDATE email_verifications
          SET    attempts = attempts + 1
          WHERE  id = $1
        `, [rec.id]);
        await client.query("COMMIT");

        const left = Math.max(0, POLICY.MAX_VERIFY_ATTEMPTS - 1 - rec.attempts);
        return fail(res, 400, "Incorrect code.", { attemptsLeft: left });
      }

      /* ── 4. Atomic mark-used — prevents race conditions ─────────────────── */
      const { rows: marked } = await client.query(`
        UPDATE email_verifications
        SET    status  = 'used',
               used_at = NOW()
        WHERE  id     = $1
          AND  status = 'active'
        RETURNING id
      `, [rec.id]);

      if (!marked.length) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Code was already used. Request a new one.");
      }

      /* ── 5. Mark user verified ───────────────────────────────────────────── */
      const { rows: updated } = await client.query(`
        UPDATE users
        SET    email_verified    = true,
               email_verified_at = NOW(),
               verified          = true,
               updated_at        = NOW()
        WHERE  id = $1
        RETURNING id, email_verified, identity_verified,
                  store_verified, created_at
      `, [userId]);

      const trustScore = computeTrustScore({
        ...updated[0],
        email_verified: true,
      });

      await client.query(`
        UPDATE users SET trust_score = $1 WHERE id = $2
      `, [trustScore, userId]);

      await client.query("COMMIT");

      /* ── 6. Audit ───────────────────────────────────────────────────────── */
      await writeAudit({
        actorId    : userId,
        action     : "email_verified",
        targetType : "user",
        targetId   : userId,
        metadata   : { trust_score: trustScore },
        ipAddress  : ip,
      }).catch(console.error);

      /* ── 7. Welcome email — background, non-blocking ─────────────────────── */
      pool
        .query("SELECT email, name FROM users WHERE id = $1", [userId])
        .then(({ rows: u }) => {
          if (u[0]) {
            sendWelcomeEmail({ to: u[0].email, name: u[0].name })
              .catch((e) => console.error("[verify-email-otp] welcome mail:", e.message));
          }
        })
        .catch(console.error);

      return res.json({
        success     : true,
        message     : "Email verified successfully.",
        trust_score : trustScore,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[verify-email-otp]", err);
      return fail(res, 500, "Server error. Please try again.");
    } finally {
      client.release();
    }
  }
);

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/verification/submit-identity
══════════════════════════════════════════════════════════════════════════════ */
router.post(
  "/submit-identity",
  authenticate,
  submitLimiter,
  withUpload(uploadDocs),
  async (req, res) => {
    const userId = req.user.id;
    const ip     = getIp(req);

    const { document_type, document_number } = req.body;

    /* ── Validate doc type ───────────────────────────────────────────────── */
    if (!document_type || !DOC_TYPES.has(document_type)) {
      return fail(res, 400, `Invalid document type. Choose: ${[...DOC_TYPES].join(", ")}.`);
    }

    /* ── Validate doc number ─────────────────────────────────────────────── */
    if (!document_number || document_number.trim().length < 4) {
      return fail(res, 400, "Document number required (minimum 4 characters).");
    }
    if (document_number.trim().length > 30) {
      return fail(res, 400, "Document number too long (maximum 30 characters).");
    }

    const frontFile  = req.files?.doc_front?.[0] ?? null;
    const backFile   = req.files?.doc_back?.[0]  ?? null;
    const selfieFile = req.files?.selfie?.[0]    ?? null;

    /* ── Required file checks ────────────────────────────────────────────── */
    if (!frontFile)  return fail(res, 400, "Front of document is required.");
    if (!selfieFile) return fail(res, 400, "Selfie photo is required.");
    if (!backFile)   return fail(res, 400, "Back of document is required.");

    /* ── Extension/MIME consistency ──────────────────────────────────────── */
    const allFiles = [frontFile, backFile, selfieFile].filter(Boolean);
    for (const f of allFiles) {
      if (!extMatchesMime(f)) {
        return fail(
          res, 400,
          `File "${f.originalname}" extension does not match its content. Do not rename files.`
        );
      }
    }

    /* ── No duplicate pending ────────────────────────────────────────────── */
    const { rows: pending } = await pool.query(`
      SELECT id FROM identity_verifications
      WHERE  user_id = $1 AND status = 'pending'
    `, [userId]);

    if (pending.length) {
      return fail(res, 409, "You already have a pending identity review. Wait for the result.");
    }

    /* ── Check not already verified ──────────────────────────────────────── */
    const { rows: userRow } = await pool.query(
      "SELECT identity_verified FROM users WHERE id = $1",
      [userId]
    );
    if (userRow[0]?.identity_verified) {
      return fail(res, 400, "Identity is already verified.");
    }

    try {
      /* ── Upload files ────────────────────────────────────────────────────── */
      const [frontResult, backResult, selfieResult] = await Promise.all([
        uploadBuffer(frontFile.buffer,  "id_documents", userId),
        uploadBuffer(backFile.buffer,   "id_documents", userId),
        uploadBuffer(selfieFile.buffer, "selfies",      userId),
      ]);

      /* ── Persist ─────────────────────────────────────────────────────────── */
      await pool.query(`
        INSERT INTO identity_verifications
          (user_id, document_type, document_number,
           front_image_url, back_image_url, selfie_url, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      `, [
        userId,
        document_type,
        document_number.trim(),
        frontResult.secure_url,
        backResult.secure_url,
        selfieResult.secure_url,
      ]);

      await writeAudit({
        actorId    : userId,
        action     : "identity_submitted",
        targetType : "user",
        targetId   : userId,
        metadata   : { document_type },
        ipAddress  : ip,
      }).catch(console.error);

      return res.status(202).json({
        success : true,
        message : "Identity documents submitted. Our team will review within 24 hours.",
      });

    } catch (err) {
      console.error("[submit-identity]", err);
      return fail(res, 500, `Submission failed: ${err.message}`);
    }
  }
);

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/verification/submit-store
══════════════════════════════════════════════════════════════════════════════ */
router.post(
  "/submit-store",
  authenticate,
  submitLimiter,
  withUpload(uploadLogo),
  async (req, res) => {
    const userId = req.user.id;
    const ip     = getIp(req);

    const storeName = (req.body.store_name        ?? "").trim();
    const storeDesc = (req.body.store_description ?? "").trim();

    /* ── Validate ────────────────────────────────────────────────────────── */
    if (storeName.length < 2) {
      return fail(res, 400, "Store name required (minimum 2 characters).");
    }
    if (storeName.length > 60) {
      return fail(res, 400, "Store name too long (maximum 60 characters).");
    }
    if (storeDesc.length > 300) {
      return fail(res, 400, "Description too long (maximum 300 characters).");
    }

    /* ── No duplicate pending ────────────────────────────────────────────── */
    const { rows: pending } = await pool.query(`
      SELECT id FROM store_verifications
      WHERE  user_id = $1 AND status = 'pending'
    `, [userId]);

    if (pending.length) {
      return fail(res, 409, "You already have a pending store review. Wait for the result.");
    }

    /* ── Check not already verified ──────────────────────────────────────── */
    const { rows: userRow } = await pool.query(
      "SELECT store_verified FROM users WHERE id = $1",
      [userId]
    );
    if (userRow[0]?.store_verified) {
      return fail(res, 400, "Store is already verified.");
    }

    try {
      let logoUrl = null;

      if (req.file) {
        if (!extMatchesMime(req.file)) {
          return fail(res, 400, "Logo file extension does not match its content.");
        }
        const result = await uploadBuffer(req.file.buffer, "store_logos", userId);
        logoUrl = result.secure_url;
      }

      await pool.query(`
        INSERT INTO store_verifications
          (user_id, store_name, store_description, logo_url, status)
        VALUES ($1, $2, $3, $4, 'pending')
      `, [userId, storeName, storeDesc || null, logoUrl]);

      await writeAudit({
        actorId    : userId,
        action     : "store_submitted",
        targetType : "user",
        targetId   : userId,
        metadata   : { store_name: storeName },
        ipAddress  : ip,
      }).catch(console.error);

      return res.status(202).json({
        success : true,
        message : "Store profile submitted. Our team will review within 24 hours.",
      });

    } catch (err) {
      console.error("[submit-store]", err);
      return fail(res, 500, `Submission failed: ${err.message}`);
    }
  }
);

/* ══════════════════════════════════════════════════════════════════════════════
   GET /api/verification/status
══════════════════════════════════════════════════════════════════════════════ */
router.get("/status", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    /* Run all three queries in parallel */
    const [userResult, idResult, storeResult] = await Promise.all([
      pool.query(`
        SELECT
          id, email, name, role, seller_type, status,
          email_verified, email_verified_at,
          identity_verified, store_verified,
          trust_score, created_at
        FROM  users
        WHERE id = $1
      `, [userId]),

      pool.query(`
        SELECT document_type, status, rejection_reason, updated_at
        FROM   identity_verifications
        WHERE  user_id = $1
        ORDER  BY created_at DESC
        LIMIT  1
      `, [userId]),

      pool.query(`
        SELECT status, rejection_reason AS message, updated_at
        FROM   store_verifications
        WHERE  user_id = $1
        ORDER  BY created_at DESC
        LIMIT  1
      `, [userId]),
    ]);

    if (!userResult.rows.length) {
      return fail(res, 404, "User not found.");
    }

    const user       = userResult.rows[0];
    const idReview   = idResult.rows[0]    ?? null;
    const storeReview= storeResult.rows[0] ?? null;

    /* Daily resend remaining */
    const dailyCount     = await getDailySendCount(pool, userId);
    const resendRemaining= Math.max(0, POLICY.DAILY_SEND_LIMIT - dailyCount);

    return res.json({
      success           : true,

      /* user */
      email             : maskEmail(user.email),
      name              : user.name,
      role              : user.role,
      seller_type       : user.seller_type,
      status            : user.status,

      /* email */
      email_verified    : user.email_verified,
      email_verified_at : user.email_verified_at,

      /* identity */
      identity_verified : user.identity_verified,
      identity_review   : idReview,

      /* store */
      store_verified    : user.store_verified,
      store_review      : storeReview,

      /* trust */
      trust_score       : user.trust_score ?? 0,

      /* resend */
      resend_remaining  : resendRemaining,
      resend_limit      : POLICY.DAILY_SEND_LIMIT,
    });

  } catch (err) {
    console.error("[status]", err);
    return fail(res, 500, "Server error. Please try again.");
  }
});

export default router;