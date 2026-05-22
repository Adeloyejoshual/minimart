import express      from "express";
import bcrypt       from "bcrypt";          // ← bcrypt as requested
import crypto       from "crypto";
import multer       from "multer";
import path         from "path";
import rateLimit    from "express-rate-limit";
import { pool }     from "../config/db.js";
import { authenticate }          from "../middleware/auth.js";
import { sendVerificationEmail, sendWelcomeEmail } from "../services/email.js";
import { writeAudit }            from "../lib/audit.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════════════════════
   OTP POLICY
══════════════════════════════════════════════════════════════════════════════ */
const OTP_POLICY = {
  DAILY_SEND_LIMIT        : 50,   // high for testing — set to 3 in production
  RESEND_COOLDOWN_SECONDS : 30,   // low for testing — set to 60 in production
  OTP_EXPIRY_MINUTES      : 10,
  MAX_VERIFY_ATTEMPTS     : 10,   // high for testing — set to 5 in production
  ABUSE_WINDOW_MINUTES    : 10,
  ABUSE_THRESHOLD         : 40,   // high for testing
};

/* ══════════════════════════════════════════════════════════════════════════════
   ALLOWED DOCS
══════════════════════════════════════════════════════════════════════════════ */
const DOC_TYPES = ["nin", "passport", "drivers_license", "voters_card"];

const ALLOWED_MIME      = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE_DOC = 5 * 1024 * 1024;  // 5MB
const MAX_FILE_SIZE_LOGO = 2 * 1024 * 1024; // 2MB

/* ══════════════════════════════════════════════════════════════════════════════
   MULTER
══════════════════════════════════════════════════════════════════════════════ */
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPG, PNG, WebP, PDF allowed.`));
  }
};

const uploadDocs = multer({
  storage,
  limits    : { fileSize: MAX_FILE_SIZE_DOC },
  fileFilter,
}).fields([
  { name: "doc_front", maxCount: 1 },
  { name: "doc_back",  maxCount: 1 },
  { name: "selfie",    maxCount: 1 },
]);

const uploadLogo = multer({
  storage,
  limits    : { fileSize: MAX_FILE_SIZE_LOGO },
  fileFilter,
}).single("store_logo");

/* ══════════════════════════════════════════════════════════════════════════════
   CLOUDINARY UPLOAD
══════════════════════════════════════════════════════════════════════════════ */
let cloudinary = null;
let streamifier = null;

// Lazy load — only if cloudinary is configured
const getCloudinary = async () => {
  if (cloudinary) return cloudinary;
  try {
    const { v2: cld } = await import("cloudinary");
    const sf = await import("streamifier");
    cld.config({
      cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
      api_key    : process.env.CLOUDINARY_API_KEY,
      api_secret : process.env.CLOUDINARY_API_SECRET,
    });
    cloudinary  = cld;
    streamifier = sf.default;
    return cloudinary;
  } catch {
    return null;
  }
};

const uploadBuffer = async (buffer, folder, userId) => {
  const cld = await getCloudinary();

  // If no Cloudinary configured — skip upload (development mode)
  if (!cld || !process.env.CLOUDINARY_CLOUD_NAME) {
    console.warn("[upload] Cloudinary not configured — skipping file upload");
    return { secure_url: `local://${folder}/${userId}/${Date.now()}` };
  }

  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        folder          : `verification/${folder}/${userId}`,
        resource_type   : "auto",
        allowed_formats : ["jpg", "jpeg", "png", "webp", "pdf"],
      },
      (err, result) => { if (err) reject(err); else resolve(result); }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

/* ══════════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════════ */
const generateOTP   = () => crypto.randomInt(100_000, 999_999).toString();
const getIp         = (req) => req.ip || req.socket?.remoteAddress || null;
const maskEmail     = (email) => email.replace(/(.{2}).*(@.*)/, "$1***$2");
const getTodayUTC   = () => new Date().toISOString().slice(0, 10);

const getDeviceHash = (req) => {
  const raw = [
    req.headers["user-agent"]      || "",
    req.headers["accept-language"] || "",
    req.headers["sec-ch-ua"]       || "",
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
};

const getDailySendCount = async (client, userId) => {
  const today = getTodayUTC();
  const { rows } = await client.query(`
    SELECT COUNT(*) AS count FROM email_verifications
    WHERE user_id    = $1
      AND created_at >= $2::date
      AND created_at <  $2::date + INTERVAL '1 day'
  `, [userId, today]);
  return parseInt(rows[0].count, 10);
};

const computeTrustScore = (user) => {
  let score = 0;
  if (user.email_verified)    score += 30;
  if (user.identity_verified) score += 30;
  if (user.store_verified)    score += 20;
  const age = (Date.now() - new Date(user.created_at)) / 86_400_000;
  if (age > 30) score += 10;
  if (age > 90) score += 10;
  return Math.min(score, 100);
};

const flagAccount = async (client, userId, reason, ip) => {
  await client.query(`
    UPDATE users
    SET status        = 'flagged',
        total_reports = total_reports + 1,
        updated_at    = NOW()
    WHERE id = $1
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

// Validate extension matches MIME — never trust frontend filename
const validateExtMime = (file) => {
  const ext     = path.extname(file.originalname).toLowerCase();
  const mimeMap = {
    ".jpg"  : "image/jpeg",
    ".jpeg" : "image/jpeg",
    ".png"  : "image/png",
    ".webp" : "image/webp",
    ".pdf"  : "application/pdf",
  };
  return mimeMap[ext] === file.mimetype;
};

/* ══════════════════════════════════════════════════════════════════════════════
   RATE LIMITERS
══════════════════════════════════════════════════════════════════════════════ */
const sendOtpLimiter = rateLimit({
  windowMs     : 10 * 60 * 1000,
  max          : 50,                    // high for testing
  keyGenerator : (req) => req.user?.id || req.ip,
  handler      : (_req, res) => res.status(429).json({
    success : false,
    message : "Too many requests. Try again later.",
  }),
});

const verifyOtpLimiter = rateLimit({
  windowMs     : 15 * 60 * 1000,
  max          : 50,                    // high for testing
  keyGenerator : (req) => req.user?.id || req.ip,
  handler      : (_req, res) => res.status(429).json({
    success : false,
    message : "Too many attempts. Try again later.",
  }),
});

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/verification/send-email-otp
══════════════════════════════════════════════════════════════════════════════ */
router.post("/send-email-otp", authenticate, sendOtpLimiter, async (req, res) => {
  const userId = req.user.id;
  const ip     = getIp(req);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── 1. Fetch user ────────────────────────────────────────────────────────
    const { rows: users } = await client.query(`
      SELECT id, email, name, email_verified, status
      FROM users WHERE id = $1
    `, [userId]);

    const user = users[0];

    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.email_verified) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Email already verified." });
    }

    // ── 2. Daily limit ───────────────────────────────────────────────────────
    const dailyCount = await getDailySendCount(client, userId);

    if (dailyCount >= OTP_POLICY.DAILY_SEND_LIMIT) {
      await client.query("ROLLBACK");
      return res.status(429).json({
        success   : false,
        message   : `Daily limit reached (${OTP_POLICY.DAILY_SEND_LIMIT}/day). Try tomorrow.`,
        remaining : 0,
      });
    }

    // ── 3. Cooldown check ────────────────────────────────────────────────────
    const { rows: recent } = await client.query(`
      SELECT created_at FROM email_verifications
      WHERE user_id    = $1
        AND created_at > NOW() - INTERVAL '${OTP_POLICY.RESEND_COOLDOWN_SECONDS} seconds'
      ORDER BY created_at DESC LIMIT 1
    `, [userId]);

    if (recent.length > 0) {
      const elapsed  = (Date.now() - new Date(recent[0].created_at)) / 1000;
      const waitSecs = Math.ceil(OTP_POLICY.RESEND_COOLDOWN_SECONDS - elapsed);
      await client.query("ROLLBACK");
      return res.status(429).json({
        success    : false,
        message    : `Wait ${waitSecs}s before requesting another code.`,
        retryAfter : waitSecs,
        remaining  : OTP_POLICY.DAILY_SEND_LIMIT - dailyCount,
      });
    }

    // ── 4. Abuse check ───────────────────────────────────────────────────────
    const { rows: abuse } = await client.query(`
      SELECT COUNT(*) AS count FROM email_verifications
      WHERE user_id    = $1
        AND created_at > NOW() - INTERVAL '${OTP_POLICY.ABUSE_WINDOW_MINUTES} minutes'
    `, [userId]);

    if (parseInt(abuse[0].count, 10) >= OTP_POLICY.ABUSE_THRESHOLD) {
      await flagAccount(client, userId, "otp_abuse", ip);
      await client.query("COMMIT");
      return res.status(429).json({ success: false, message: "Account flagged for review." });
    }

    // ── 5. Invalidate old active OTPs ────────────────────────────────────────
    await client.query(`
      UPDATE email_verifications
      SET status  = 'expired',
          used_at = NOW()
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);

    // ── 6. Generate + hash OTP ───────────────────────────────────────────────
    const otp    = generateOTP();
    const hash   = await bcrypt.hash(otp, 10);
    const device = getDeviceHash(req);

    await client.query(`
      INSERT INTO email_verifications
        (user_id, otp_hash, expires_at, status, device_hash)
      VALUES (
        $1, $2,
        NOW() + INTERVAL '${OTP_POLICY.OTP_EXPIRY_MINUTES} minutes',
        'active', $3
      )
    `, [userId, hash, device]);

    // ── 7. Track device ──────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO user_devices
        (user_id, device_hash, ip_address, user_agent, last_seen)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, device_hash)
      DO UPDATE SET last_seen = NOW(), ip_address = EXCLUDED.ip_address
    `, [userId, device, ip, req.headers["user-agent"] || null]);

    await client.query("COMMIT");

    // ── 8. Send email AFTER commit ───────────────────────────────────────────
    console.log("[OTP] Sending to:", user.email);
    console.log("[OTP] Code:", otp); // REMOVE IN PRODUCTION

    try {
      await sendVerificationEmail({ to: user.email, name: user.name, otp });
      console.log("[OTP] Email sent successfully");
    } catch (mailErr) {
      console.error("[OTP] Email FAILED:", mailErr.message);
      console.error("[OTP] Full error:", mailErr);

      // Cleanup OTP
      await pool.query(`
        UPDATE email_verifications
        SET status = 'expired', used_at = NOW()
        WHERE user_id    = $1
          AND status     = 'active'
          AND created_at > NOW() - INTERVAL '1 minute'
      `, [userId]);

      return res.status(500).json({
        success : false,
        message : `Failed to send email: ${mailErr.message}`,
      });
    }

    const remaining = OTP_POLICY.DAILY_SEND_LIMIT - (dailyCount + 1);

    await writeAudit({
      actorId    : userId,
      action     : "otp_sent",
      targetType : "user",
      targetId   : userId,
      metadata   : { method: "email", remaining },
      ipAddress  : ip,
    });

    return res.json({
      success   : true,
      message   : "Verification code sent to your email.",
      email     : maskEmail(user.email),
      expiresIn : OTP_POLICY.OTP_EXPIRY_MINUTES * 60,
      remaining,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[send-email-otp] Error:", err.message);
    console.error("[send-email-otp] Stack:", err.stack);
    return res.status(500).json({ success: false, message: `Server error: ${err.message}` });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/verification/verify-email-otp
══════════════════════════════════════════════════════════════════════════════ */
router.post("/verify-email-otp", authenticate, verifyOtpLimiter, async (req, res) => {
  const { otp } = req.body;
  const userId  = req.user.id;
  const ip      = getIp(req);

  if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
    return res.status(400).json({ success: false, message: "OTP must be exactly 6 digits." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(`
      SELECT id, otp_hash, attempts, device_hash
      FROM email_verifications
      WHERE user_id    = $1
        AND status     = 'active'
        AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `, [userId]);

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success : false,
        message : "Code expired or not found. Request a new one.",
      });
    }

    const rec = rows[0];

    if (rec.attempts >= OTP_POLICY.MAX_VERIFY_ATTEMPTS) {
      await client.query("UPDATE email_verifications SET status = 'blocked' WHERE id = $1", [rec.id]);
      await flagAccount(client, userId, "otp_max_attempts", ip);
      await client.query("COMMIT");
      return res.status(400).json({ success: false, message: "Too many failed attempts." });
    }

    const valid = await bcrypt.compare(String(otp).trim(), rec.otp_hash);

    if (!valid) {
      await client.query("UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1", [rec.id]);
      await client.query("COMMIT");
      const left = Math.max(0, OTP_POLICY.MAX_VERIFY_ATTEMPTS - 1 - rec.attempts);
      return res.status(400).json({ success: false, message: "Incorrect code.", attemptsLeft: left });
    }

    // Atomic mark — race condition fix
    const { rows: marked } = await client.query(`
      UPDATE email_verifications
      SET status = 'used', used_at = NOW()
      WHERE id = $1 AND status = 'active'
      RETURNING id
    `, [rec.id]);

    if (!marked.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Code already used." });
    }

    // Update user
    const { rows: updated } = await client.query(`
      UPDATE users
      SET email_verified    = true,
          email_verified_at = NOW(),
          verified          = true,
          updated_at        = NOW()
      WHERE id = $1
      RETURNING id, email_verified, identity_verified, store_verified, created_at
    `, [userId]);

    const score = computeTrustScore({ ...updated[0], email_verified: true });

    await client.query("UPDATE users SET trust_score = $1 WHERE id = $2", [score, userId]);
    await client.query("COMMIT");

    await writeAudit({
      actorId    : userId,
      action     : "email_verified",
      targetType : "user",
      targetId   : userId,
      metadata   : { trust_score: score },
      ipAddress  : ip,
    });

    // Send welcome email in background — don't await
    pool.query("SELECT email, name FROM users WHERE id = $1", [userId]).then(({ rows: u }) => {
      if (u[0]) sendWelcomeEmail({ to: u[0].email, name: u[0].name }).catch(console.error);
    });

    return res.json({ success: true, message: "Email verified.", trust_score: score });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[verify-otp] Error:", err.message);
    return res.status(500).json({ success: false, message: `Server error: ${err.message}` });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/verification/submit-identity
══════════════════════════════════════════════════════════════════════════════ */
router.post("/submit-identity", authenticate, (req, res, next) => {
  uploadDocs(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, async (req, res) => {
  const userId = req.user.id;
  const ip     = getIp(req);

  const { document_type, document_number } = req.body;

  // ── Validate document type ─────────────────────────────────────────────────
  if (!document_type || !DOC_TYPES.includes(document_type)) {
    return res.status(400).json({
      success : false,
      message : `Invalid document type. Choose: ${DOC_TYPES.join(", ")}`,
    });
  }

  // ── Validate document number ───────────────────────────────────────────────
  if (!document_number || document_number.trim().length < 4) {
    return res.status(400).json({
      success : false,
      message : "Document number is required (min 4 characters).",
    });
  }

  const frontFile  = req.files?.doc_front?.[0];
  const backFile   = req.files?.doc_back?.[0];
  const selfieFile = req.files?.selfie?.[0];

  // ── Validate required files ────────────────────────────────────────────────
  if (!frontFile) {
    return res.status(400).json({ success: false, message: "Front of document is required." });
  }

  if (document_type === "drivers_license" && !backFile) {
    return res.status(400).json({ success: false, message: "Back of license is required." });
  }

  if (!selfieFile) {
    return res.status(400).json({ success: false, message: "Selfie photo is required." });
  }

  // ── Validate file extension matches MIME ───────────────────────────────────
  const allFiles = [frontFile, backFile, selfieFile].filter(Boolean);
  for (const f of allFiles) {
    if (!validateExtMime(f)) {
      return res.status(400).json({
        success : false,
        message : `File "${f.originalname}" has mismatched extension. Do not rename files.`,
      });
    }
  }

  // ── Check existing pending ─────────────────────────────────────────────────
  const { rows: existing } = await pool.query(
    "SELECT id FROM identity_verifications WHERE user_id = $1 AND status = 'pending'",
    [userId]
  );

  if (existing.length > 0) {
    return res.status(400).json({ success: false, message: "Already pending review. Wait for result." });
  }

  try {
    // ── Upload files ───────────────────────────────────────────────────────
    const frontResult  = await uploadBuffer(frontFile.buffer, "id_documents", userId);
    const backResult   = backFile ? await uploadBuffer(backFile.buffer, "id_documents", userId) : null;
    const selfieResult = await uploadBuffer(selfieFile.buffer, "selfies", userId);

    // ── Store in DB ────────────────────────────────────────────────────────
    await pool.query(`
      INSERT INTO identity_verifications
        (user_id, document_type, document_number, front_image_url, back_image_url, selfie_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
    `, [
      userId,
      document_type,
      document_number.trim(),
      frontResult.secure_url,
      backResult?.secure_url || null,
      selfieResult.secure_url,
    ]);

    await writeAudit({
      actorId    : userId,
      action     : "identity_submitted",
      targetType : "user",
      targetId   : userId,
      metadata   : { document_type },
      ipAddress  : ip,
    });

    return res.json({ success: true, message: "Identity submitted. Under review." });

  } catch (err) {
    console.error("[submit-identity]", err.message);
    return res.status(500).json({ success: false, message: `Upload failed: ${err.message}` });
  }
});

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/verification/submit-store
══════════════════════════════════════════════════════════════════════════════ */
router.post("/submit-store", authenticate, (req, res, next) => {
  uploadLogo(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, async (req, res) => {
  const userId = req.user.id;
  const ip     = getIp(req);

  const { store_name, store_description } = req.body;

  if (!store_name || store_name.trim().length < 2) {
    return res.status(400).json({ success: false, message: "Store name required (min 2 chars)." });
  }

  const { rows: existing } = await pool.query(
    "SELECT id FROM store_verifications WHERE user_id = $1 AND status = 'pending'",
    [userId]
  );

  if (existing.length > 0) {
    return res.status(400).json({ success: false, message: "Store already under review." });
  }

  try {
    let logoUrl = null;

    if (req.file) {
      if (!validateExtMime(req.file)) {
        return res.status(400).json({ success: false, message: "Invalid logo file." });
      }
      const result = await uploadBuffer(req.file.buffer, "store_logos", userId);
      logoUrl = result.secure_url;
    }

    await pool.query(`
      INSERT INTO store_verifications
        (user_id, store_name, store_description, logo_url, status)
      VALUES ($1, $2, $3, $4, 'pending')
    `, [userId, store_name.trim(), store_description?.trim() || null, logoUrl]);

    await writeAudit({
      actorId    : userId,
      action     : "store_submitted",
      targetType : "user",
      targetId   : userId,
      metadata   : { store_name: store_name.trim() },
      ipAddress  : ip,
    });

    return res.json({ success: true, message: "Store submitted for review." });

  } catch (err) {
    console.error("[submit-store]", err.message);
    return res.status(500).json({ success: false, message: `Submission failed: ${err.message}` });
  }
});

/* ══════════════════════════════════════════════════════════════════════════════
   GET /api/verification/status
══════════════════════════════════════════════════════════════════════════════ */
router.get("/status", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id, email, name, role, seller_type, status, rating,
        email_verified, email_verified_at,
        identity_verified, store_verified,
        trust_score, created_at
      FROM users WHERE id = $1
    `, [req.user.id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const user = rows[0];

    const { rows: idRows } = await pool.query(`
      SELECT document_type, status, rejection_reason, updated_at
      FROM identity_verifications
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [req.user.id]);

    const { rows: storeRows } = await pool.query(`
      SELECT status, rejection_reason AS message, review_action, updated_at
      FROM store_verifications
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [req.user.id]);

    const dailyCount      = await getDailySendCount(pool, req.user.id);
    const resendRemaining = Math.max(0, OTP_POLICY.DAILY_SEND_LIMIT - dailyCount);

    return res.json({
      email             : maskEmail(user.email),
      name              : user.name,
      role              : user.role,
      seller_type       : user.seller_type,
      status            : user.status,
      email_verified    : user.email_verified,
      email_verified_at : user.email_verified_at,
      identity_verified : user.identity_verified,
      identity_review   : idRows[0] || null,
      store_verified    : user.store_verified,
      store_review      : storeRows[0] || null,
      trust_score       : user.trust_score,
      resend_remaining  : resendRemaining,
      resend_limit      : OTP_POLICY.DAILY_SEND_LIMIT,
    });

  } catch (err) {
    console.error("[status]", err.message);
    return res.status(500).json({ success: false, message: `Server error: ${err.message}` });
  }
});

export default router;