/**
 * routes/forgotPassword.js
 *
 * POST /api/auth/forgot-password          — send 6-digit OTP to email
 * POST /api/auth/forgot-password/verify   — verify OTP → return reset_token (JWT)
 *
 * Mounted in server.js as:
 *   app.use("/api/auth", forgotPasswordRouter)
 *
 * Flow:
 *   Step 1 — User enters email
 *             → generate 6-digit OTP
 *             → hash OTP with SHA-256 before storing
 *             → send OTP email
 *             → always return 200 (never reveal if email exists)
 *
 *   Step 2 — User enters OTP
 *             → hash submitted OTP + compare with stored hash
 *             → track attempts (max 5)
 *             → on success: mark OTP verified, issue JWT reset_token
 *             → ForgotPassword.jsx navigates to /reset-password
 *               with { state: { reset_token, email } }
 */

import express    from "express";
import crypto     from "crypto";
import jwt        from "jsonwebtoken";
import rateLimit  from "express-rate-limit";
import { pool }   from "../config/db.js";
import { sendPasswordResetEmail } from "../services/email.js";
import { writeAudit }             from "../lib/audit.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const OTP_EXPIRY_MINUTES  = 15;
const OTP_MAX_ATTEMPTS    = 5;
const RESEND_COOLDOWN_S   = 60;    // seconds between resend requests
const MAX_RESENDS_PER_DAY = 5;     // max OTPs per user per 24 hours
const JWT_SECRET          = process.env.JWT_SECRET;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  req.socket?.remoteAddress ??
  null;

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/** Always trim + lowercase */
const normalizeEmail = (raw = "") => raw.trim().toLowerCase();

/** Matches frontend EMAIL_RE exactly */
const EMAIL_RE     = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isValidEmail = (e) => EMAIL_RE.test(e);

/** Cryptographically secure 6-digit OTP */
const generateOtp = () =>
  String(crypto.randomInt(100_000, 999_999));

/**
 * SHA-256 hash — fast for OTP comparison.
 * We don't need bcrypt here because OTPs are:
 *   - Short-lived (15 min)
 *   - Already rate-limited (5 attempts max)
 *   - Random 6-digit codes (not user-chosen)
 */
const hashOtp = (raw) =>
  crypto.createHash("sha256").update(String(raw)).digest("hex");

/**
 * Safe 200 response — always returned whether email exists or not.
 * Never reveals if an account exists for the given email.
 */
const SAFE_RESPONSE = {
  success : true,
  message : "If an account exists for that email, a 6-digit code has been sent.",
};

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const forgotLimiter = rateLimit({
  windowMs        : 60 * 60 * 1_000,       // 1 hour
  max             : IS_PROD ? 5 : 250,      // relaxed in dev
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) =>
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
    req.socket?.remoteAddress ??
    "unknown",
  handler: (_req, res) =>
    res.status(429).json({
      success : false,
      message : "Too many reset requests. Please try again in an hour.",
    }),
});

const verifyLimiter = rateLimit({
  windowMs        : 15 * 60 * 1_000,       // 15 minutes
  max             : IS_PROD ? 10 : 500,     // relaxed in dev
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) =>
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
    req.socket?.remoteAddress ??
    "unknown",
  handler: (_req, res) =>
    res.status(429).json({
      success : false,
      message : "Too many verification attempts. Please try again later.",
    }),
});

/* ═══════════════════════════════════════════════════════════════
   AUTO-MIGRATION
   Creates password_reset_otps table on first startup if missing.
   Safe to run multiple times — uses IF NOT EXISTS.
═══════════════════════════════════════════════════════════════ */
async function ensureOtpTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        otp_hash    TEXT        NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        attempts    INT         NOT NULL DEFAULT 0,
        verified    BOOLEAN     NOT NULL DEFAULT false,
        used        BOOLEAN     NOT NULL DEFAULT false,
        ip_address  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pro_user_id
        ON password_reset_otps (user_id)
        WHERE used = false
    `);
    console.log("[forgotPassword] ✓ password_reset_otps table ready");
  } catch (err) {
    console.error("[forgotPassword] ensureOtpTable error:", err.message);
  }
}

ensureOtpTable();

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/forgot-password
   Step 1 — Send OTP to email
═══════════════════════════════════════════════════════════════ */
router.post("/forgot-password", forgotLimiter, async (req, res, next) => {
  const ip         = getIp(req);
  const cleanEmail = normalizeEmail(req.body.email ?? "");

  /* ── Validate email format ── */
  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return fail(res, 400, "A valid email address is required.");
  }

  try {
    console.log(`[forgotPassword] OTP request  email=${cleanEmail}  ip=${ip}`);

    /* ── Look up user ──
       If not found: return safe response — never reveal this
    ── */
    const { rows: userRows } = await pool.query(
      `SELECT id, name, email
       FROM   users
       WHERE  email = $1
       LIMIT  1`,
      [cleanEmail]
    );

    if (!userRows.length) {
      console.log(`[forgotPassword] no account → ${cleanEmail}`);
      return res.json(SAFE_RESPONSE);
    }

    const user = userRows[0];

    /* ── Resend cooldown ──
       Check most recent OTP — enforce RESEND_COOLDOWN_S gap
    ── */
    const { rows: recentRows } = await pool.query(
      `SELECT created_at
       FROM   password_reset_otps
       WHERE  user_id = $1
       ORDER  BY created_at DESC
       LIMIT  1`,
      [user.id]
    );

    if (recentRows.length) {
      const secondsSinceLast =
        (Date.now() - new Date(recentRows[0].created_at).getTime()) / 1_000;

      if (secondsSinceLast < RESEND_COOLDOWN_S) {
        const wait = Math.ceil(RESEND_COOLDOWN_S - secondsSinceLast);
        return res.status(429).json({
          success : false,
          message : `Please wait ${wait}s before requesting a new code.`,
          wait,
        });
      }
    }

    /* ── Daily resend limit ──
       Max MAX_RESENDS_PER_DAY OTPs per user per 24 hours
    ── */
    const { rows: dailyRows } = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM   password_reset_otps
       WHERE  user_id    = $1
         AND  created_at > NOW() - INTERVAL '24 hours'`,
      [user.id]
    );

    if (parseInt(dailyRows[0].cnt, 10) >= MAX_RESENDS_PER_DAY) {
      return res.status(429).json({
        success : false,
        message : "Daily reset limit reached. Please try again tomorrow.",
        code    : "DAILY_LIMIT",
      });
    }

    /* ── Invalidate all previous unused OTPs for this user ── */
    await pool.query(
      `UPDATE password_reset_otps
       SET    used = true
       WHERE  user_id = $1
         AND  used   = false`,
      [user.id]
    );

    /* ── Generate OTP + hash ── */
    const rawOtp  = generateOtp();
    const otpHash = hashOtp(rawOtp);

    /* ── Store OTP ── */
    await pool.query(
      `INSERT INTO password_reset_otps
         (user_id, otp_hash, expires_at, ip_address)
       VALUES
         ($1, $2, NOW() + ($3 || ' minutes')::INTERVAL, $4)`,
      [user.id, otpHash, String(OTP_EXPIRY_MINUTES), ip]
    );

    /* ── Always log OTP in dev console ── */
    if (!IS_PROD) {
      console.log("\n" + "═".repeat(60));
      console.log("[forgotPassword] 🔑  PASSWORD RESET OTP (dev mode)");
      console.log(`   Email : ${user.email}`);
      console.log(`   OTP   : ${rawOtp}`);
      console.log(`   Exp   : ${OTP_EXPIRY_MINUTES} minutes`);
      console.log("═".repeat(60) + "\n");
    }

    /* ── Send email ── */
    let emailSent = true;
    try {
      await sendPasswordResetEmail({
        to     : user.email,
        name   : user.name,
        otp    : rawOtp,
        expiry : OTP_EXPIRY_MINUTES,
      });
      console.log(`[forgotPassword] ✓ OTP email sent → ${user.email}`);
    } catch (mailErr) {
      emailSent = false;
      console.error("[forgotPassword] email send failed:", mailErr.message);
    }

    /* ── Prod: if email fails → invalidate OTP + surface error ── */
    if (IS_PROD && !emailSent) {
      await pool.query(
        `UPDATE password_reset_otps
         SET    used = true
         WHERE  otp_hash = $1`,
        [otpHash]
      ).catch(() => {});

      return fail(res, 500,
        "Failed to send reset code. Please try again."
      );
    }

    /* ── Audit log ── */
    writeAudit({
      actorId    : user.id,
      action     : "password_reset_otp_sent",
      targetType : "user",
      targetId   : user.id,
      ipAddress  : ip,
    }).catch(console.error);

    /* ── Response ──
       Dev: expose OTP in response if email failed
       Prod: always SAFE_RESPONSE only
    ── */
    if (!IS_PROD && !emailSent) {
      return res.json({
        ...SAFE_RESPONSE,
        dev_otp  : rawOtp,
        dev_hint : "Email failed in dev — use the OTP from your server console.",
      });
    }

    return res.json(SAFE_RESPONSE);

  } catch (err) {
    console.error("[forgotPassword] sendOtp error:", err.message);
    console.error("[forgotPassword] sendOtp stack:", err.stack);
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/forgot-password/verify
   Step 2 — Verify OTP → return JWT reset_token
═══════════════════════════════════════════════════════════════ */
router.post("/forgot-password/verify", verifyLimiter, async (req, res, next) => {
  const cleanEmail = normalizeEmail(req.body.email ?? "");
  const otp        = String(req.body.otp ?? "").trim();

  /* ── Validate inputs ── */
  if (!cleanEmail || !otp) {
    return fail(res, 400, "Email and code are required.");
  }
  if (!isValidEmail(cleanEmail)) {
    return fail(res, 400, "Please enter a valid email address.");
  }
  if (!/^\d{6}$/.test(otp)) {
    return fail(res, 400, "Code must be exactly 6 digits.");
  }

  try {
    /* ── Look up user ── */
    const { rows: userRows } = await pool.query(
      `SELECT id
       FROM   users
       WHERE  email = $1
       LIMIT  1`,
      [cleanEmail]
    );

    if (!userRows.length) {
      return fail(res, 400, "Invalid request.", { code: "OTP_INVALID" });
    }

    const userId  = userRows[0].id;
    const otpHash = hashOtp(otp);

    /* ── Find matching valid OTP ──
       Matches on: user_id + otp_hash + not used + not verified + not expired
    ── */
    const { rows: otpRows } = await pool.query(
      `SELECT id, attempts, expires_at
       FROM   password_reset_otps
       WHERE  user_id    = $1
         AND  otp_hash   = $2
         AND  used       = false
         AND  verified   = false
         AND  expires_at > NOW()
       LIMIT  1`,
      [userId, otpHash]
    );

    /* ── Wrong OTP ── */
    if (!otpRows.length) {

      /* increment attempts on most recent unexpired OTP */
      await pool.query(
        `UPDATE password_reset_otps
         SET    attempts = attempts + 1
         WHERE  user_id    = $1
           AND  used       = false
           AND  verified   = false
           AND  expires_at > NOW()`,
        [userId]
      ).catch(() => {});

      /* read updated attempt count */
      const { rows: attemptRows } = await pool.query(
        `SELECT attempts
         FROM   password_reset_otps
         WHERE  user_id    = $1
           AND  used       = false
           AND  expires_at > NOW()
         ORDER  BY created_at DESC
         LIMIT  1`,
        [userId]
      ).catch(() => ({ rows: [] }));

      const attempts     = attemptRows[0]?.attempts ?? 0;
      const attemptsLeft = Math.max(0, OTP_MAX_ATTEMPTS - attempts);

      /* ── Lock if max attempts reached ── */
      if (attemptsLeft === 0) {
        await pool.query(
          `UPDATE password_reset_otps
           SET    used = true
           WHERE  user_id = $1
             AND  used   = false`,
          [userId]
        ).catch(() => {});

        console.log(`[forgotPassword] OTP locked  user=${userId}`);

        return fail(res, 429,
          "Too many incorrect attempts. Please request a new code.",
          { code: "OTP_LOCKED", attemptsLeft: 0 }
        );
      }

      /* ── Return remaining attempts ──
         ForgotPassword.jsx shows: "X attempts remaining"
      ── */
      return fail(res, 400,
        `Incorrect code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining.`,
        { code: "OTP_INVALID", attemptsLeft }
      );
    }

    /* ── OTP is correct ──
       Mark as verified (not yet used — resetPassword.js will mark used)
    ── */
    const otpRecord = otpRows[0];

    await pool.query(
      `UPDATE password_reset_otps
       SET    verified = true
       WHERE  id = $1`,
      [otpRecord.id]
    );

    /* ── Issue short-lived JWT reset_token ──
       Payload carries userId + otp_id so resetPassword.js
       can verify the exact OTP record without extra DB lookup.
       Expires in 15 min — same window as OTP.
    ── */
    const resetToken = jwt.sign(
      {
        sub     : userId,
        otp_id  : otpRecord.id,
        purpose : "password_reset",
      },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    /* ── Audit log ── */
    writeAudit({
      actorId    : userId,
      action     : "password_reset_otp_verified",
      targetType : "user",
      targetId   : userId,
    }).catch(console.error);

    console.log(`[forgotPassword] ✓ OTP verified  user=${userId}`);

    /* ── Response ──
       ForgotPassword.jsx receives reset_token + navigates to:
         /reset-password with state: { reset_token, email }
    ── */
    return res.json({
      success     : true,
      message     : "Code verified. You can now set your new password.",
      reset_token : resetToken,
    });

  } catch (err) {
    console.error("[forgotPassword] verifyOtp error:", err.message);
    console.error("[forgotPassword] verifyOtp stack:", err.stack);
    next(err);
  }
});

export default router;