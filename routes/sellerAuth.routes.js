// routes/sellerAuth.routes.js
// ─────────────────────────────────────────────────────────────
// Seller authentication — operates on market.users ONLY.
// Never reads or writes public.users or password_reset_otps.
//
// Routes:
//   POST /register
//   POST /verify-email
//   POST /resend-verification
//   POST /login
//   POST /forgot-password
//   POST /verify-reset-code
//   POST /reset-password
//   GET  /me
// ─────────────────────────────────────────────────────────────
import express  from "express";
import bcrypt   from "bcrypt";
import jwt      from "jsonwebtoken";
import { pool } from "../server.js";
import { generateOTP, hashCode } from "../utils/token.js";
import {
  sendVerificationCode,
  sendPasswordResetCode,
} from "../services/notificationService.js";

const router         = express.Router();
const JWT_SECRET     = process.env.JWT_SECRET     || "supersecretkey";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const BCRYPT_ROUNDS      = 12;
const OTP_TTL_MS         = 60 * 60_000;       // 1 hour  (verify email)
const RESET_TTL_MS       = 15 * 60_000;       // 15 mins (password reset)
const RATE_WINDOW_MS     = 15 * 60_000;       // 15 min window
const RATE_MAX_ATTEMPTS  = 10;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sanitise incoming email */
const cleanEmail = (raw) => raw?.trim().toLowerCase() ?? "";

/** Generic success — prevents email enumeration */
const genericOk = (res, message) =>
  res.json({ success: true, message });

/** Build a clean error response */
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

// ─────────────────────────────────────────────────────────────
// RATE LIMITER — in-memory, per IP
// Resets per-IP on successful password reset.
// Note: resets on server restart — use Redis for production.
// ─────────────────────────────────────────────────────────────
const _attempts = new Map();

const getIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
  req.socket.remoteAddress ??
  "unknown";

const authLimiter = (req, res, next) => {
  const ip  = getIp(req);
  const now = Date.now();
  const key = `seller-auth:${ip}`;
  let   rec = _attempts.get(key);

  if (!rec || now - rec.time > RATE_WINDOW_MS) {
    rec = { count: 1, time: now };
  } else {
    rec.count++;
  }

  _attempts.set(key, rec);

  if (rec.count > RATE_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil(
      (RATE_WINDOW_MS - (now - rec.time)) / 1000
    );
    return res.status(429).json({
      success:    false,
      message:    "Too many attempts. Please wait 15 minutes and try again.",
      retryAfter,
    });
  }

  next();
};

/** Clear the rate limit for an IP — called after successful reset */
const clearRateLimit = (req) => {
  const key = `seller-auth:${getIp(req)}`;
  _attempts.delete(key);
};

// ─────────────────────────────────────────────────────────────
// POST /api/seller-auth/register
// Creates seller account in market.users + sends email OTP.
// ─────────────────────────────────────────────────────────────
router.post("/register", authLimiter, async (req, res) => {
  const { name, email, phone, password } = req.body;
  const email_ = cleanEmail(email);

  // ── Validation ──────────────────────────────────────────
  if (!name?.trim())
    return fail(res, 400, "Name is required");

  if (!email_)
    return fail(res, 400, "Email is required");

  if (!EMAIL_RX.test(email_))
    return fail(res, 400, "Enter a valid email address");

  if (!password)
    return fail(res, 400, "Password is required");

  if (password.length < 8)
    return fail(res, 400, "Password must be at least 8 characters");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Check for existing account ───────────────────────
    const { rows: existing } = await client.query(
      `SELECT id, is_verified
       FROM market.users
       WHERE email = $1`,
      [email_]
    );

    if (existing.length) {
      const user = existing[0];
      await client.query("ROLLBACK");

      // Unverified → resend OTP instead of rejecting
      if (!user.is_verified) {
        const otp        = generateOTP();
        const hashedCode = hashCode(otp);
        const expires    = new Date(Date.now() + OTP_TTL_MS);

        await pool.query(
          `UPDATE market.users
           SET verify_code = $1, verify_expires = $2
           WHERE id = $3`,
          [hashedCode, expires, user.id]
        );

        try {
          await sendVerificationCode({
            to:   email_,
            name: name.trim(),
            code: otp,
          });
        } catch (mailErr) {
          console.error("[register] resend email failed:", mailErr.message);
        }

        return res.status(409).json({
          success: false,
          code:    "EMAIL_TAKEN_UNVERIFIED",
          message:
            "An unverified account already exists for this email. " +
            "We've resent your verification code — please check your inbox.",
          email: email_,
        });
      }

      return res.status(409).json({
        success: false,
        code:    "EMAIL_TAKEN",
        message: "A seller account with this email already exists.",
      });
    }

    // ── Hash password ────────────────────────────────────
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // Note: password is NOT trimmed here.
    // Login also never trims — so the bcrypt comparison matches.

    // ── Generate OTP ─────────────────────────────────────
    const otp        = generateOTP();
    const hashedCode = hashCode(otp);
    const expires    = new Date(Date.now() + OTP_TTL_MS);

    // ── Insert into market.users ─────────────────────────
    const { rows: [user] } = await client.query(
      `INSERT INTO market.users
         (name, email, password_hash, phone_number, status,
          is_verified, verify_code, verify_expires)
       VALUES ($1, $2, $3, $4, 'active', FALSE, $5, $6)
       RETURNING id, name, email, created_at`,
      [
        name.trim(),
        email_,
        password_hash,
        phone?.trim() ?? null,
        hashedCode,
        expires,
      ]
    );

    await client.query("COMMIT");

    // ── Send OTP email ───────────────────────────────────
    try {
      await sendVerificationCode({
        to:   user.email,
        name: user.name,
        code: otp,
      });
    } catch (mailErr) {
      console.error("[register] email send failed:", mailErr.message);
      // Non-fatal — user can request a resend
    }

    console.log("[seller-auth][register] ✅ created user:", user.id);

    return res.status(201).json({
      success: true,
      message:
        "Account created! Please check your email for the 6-digit " +
        "verification code.",
      email: user.email,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[seller-auth][register] ❌", {
      message: err.message,
      code:    err.code,
    });

    if (err.code === "23505") {
      return fail(res, 409, "A seller account with this email already exists.");
    }

    return fail(res, 500, "Registration failed. Please try again.");

  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/seller-auth/verify-email
// Body: { email, code }
// ─────────────────────────────────────────────────────────────
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;
  const email_ = cleanEmail(email);

  if (!email_)
    return fail(res, 400, "Email is required");

  if (!code?.trim())
    return fail(res, 400, "Verification code is required");

  try {
    const { rows } = await pool.query(
      `SELECT id, is_verified, verify_code, verify_expires
       FROM market.users
       WHERE email = $1`,
      [email_]
    );

    if (!rows.length)
      return fail(res, 404, "No seller account found with this email.");

    const user = rows[0];

    if (user.is_verified)
      return res.json({
        success: true,
        message: "Email already verified. You can sign in.",
      });

    if (new Date() > new Date(user.verify_expires))
      return fail(res, 400, "Verification code has expired. Please request a new one.", {
        code: "CODE_EXPIRED",
      });

    if (hashCode(code.trim()) !== user.verify_code)
      return fail(res, 400, "Invalid verification code. Please check and try again.", {
        code: "INVALID_CODE",
      });

    await pool.query(
      `UPDATE market.users
       SET is_verified    = TRUE,
           verify_code    = NULL,
           verify_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    console.log("[seller-auth][verify-email] ✅ verified user:", user.id);

    return res.json({
      success: true,
      message: "Email verified successfully! You can now sign in.",
    });

  } catch (err) {
    console.error("[seller-auth][verify-email] ❌", err.message);
    return fail(res, 500, "Verification failed. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/seller-auth/resend-verification
// Body: { email }
// ─────────────────────────────────────────────────────────────
router.post("/resend-verification", authLimiter, async (req, res) => {
  const { email } = req.body;
  const email_ = cleanEmail(email);

  if (!email_)
    return fail(res, 400, "Email is required");

  try {
    const { rows } = await pool.query(
      `SELECT id, name, is_verified
       FROM market.users
       WHERE email = $1`,
      [email_]
    );

    // Always return generic — never reveal if email exists
    if (!rows.length || rows[0].is_verified)
      return genericOk(
        res,
        "If an unverified account exists, a new code has been sent."
      );

    const user       = rows[0];
    const otp        = generateOTP();
    const hashedCode = hashCode(otp);
    const expires    = new Date(Date.now() + OTP_TTL_MS);

    await pool.query(
      `UPDATE market.users
       SET verify_code = $1, verify_expires = $2
       WHERE id = $3`,
      [hashedCode, expires, user.id]
    );

    try {
      await sendVerificationCode({
        to:   email_,
        name: user.name,
        code: otp,
      });
    } catch (mailErr) {
      console.error("[resend-verification] email failed:", mailErr.message);
    }

    console.log("[seller-auth][resend-verification] ✅ resent to:", user.id);

    return genericOk(
      res,
      "If an unverified account exists, a new code has been sent."
    );

  } catch (err) {
    console.error("[seller-auth][resend-verification] ❌", err.message);
    return fail(res, 500, "Failed to resend verification code.");
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/seller-auth/login
// Checks market.users ONLY — never public.users.
//
// FIX: is_verified is checked BEFORE bcrypt.compare.
// Previously the order was: suspended → wrong-password → unverified.
// This caused "Incorrect password" to appear for unverified users
// who had just reset their password (the new hash was valid but
// the unverified check ran after, so they never reached it).
//
// Correct order: suspended → unverified → wrong-password → token.
// ─────────────────────────────────────────────────────────────
router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const email_ = cleanEmail(email);

  if (!email_ || !password)
    return fail(res, 400, "Email and password are required");

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, status, is_verified
       FROM market.users
       WHERE email = $1`,
      [email_]
    );

    // ── No account found ─────────────────────────────────
    if (!rows.length)
      return fail(
        res, 401,
        "No seller account found with this email. " +
        "Please create one to continue."
      );

    const user = rows[0];

    // ── 1. Check suspended ───────────────────────────────
    if (user.status !== "active")
      return fail(res, 403, "Your seller account has been suspended.", {
        code: "ACCOUNT_SUSPENDED",
      });

    // ── 2. Check email verified ──────────────────────────
    // FIX: moved BEFORE bcrypt.compare so the user gets a clear,
    // actionable error rather than a misleading "wrong password".
    if (!user.is_verified)
      return fail(res, 403, "Please verify your email before signing in.", {
        code:  "EMAIL_NOT_VERIFIED",
        email: user.email,
      });

    // ── 3. Check password ────────────────────────────────
    // password is the raw value from req.body — never trimmed.
    // password_hash was created from the raw value too (in register
    // and reset-password). So bcrypt.compare will match correctly.
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid)
      return fail(res, 401, "Incorrect email or password.");

    // ── 4. Issue JWT ─────────────────────────────────────
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log("[seller-auth][login] ✅ signed in user:", user.id);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
      },
    });

  } catch (err) {
    console.error("[seller-auth][login] ❌", err.message);
    return fail(res, 500, "Sign in failed. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/seller-auth/forgot-password
// Sends 6-digit reset OTP to seller email.
// Writes reset_code to market.users — NOT to password_reset_otps.
// Always returns generic success to prevent email enumeration.
// ─────────────────────────────────────────────────────────────
router.post("/forgot-password", authLimiter, async (req, res) => {
  const { email } = req.body;
  const email_ = cleanEmail(email);

  if (!email_)
    return fail(res, 400, "Email is required");

  if (!EMAIL_RX.test(email_))
    return fail(res, 400, "Enter a valid email address");

  try {
    const { rows } = await pool.query(
      `SELECT id, name, status
       FROM market.users
       WHERE email = $1`,
      [email_]
    );

    // Suspended — the only case worth surfacing explicitly
    if (rows.length && rows[0].status !== "active") {
      return fail(res, 403, "Your account has been suspended. Contact support.");
    }

    if (rows.length) {
      const user       = rows[0];
      const otp        = generateOTP();
      const hashedCode = hashCode(otp);
      const expires    = new Date(Date.now() + RESET_TTL_MS);

      await pool.query(
        `UPDATE market.users
         SET reset_code    = $1,
             reset_expires = $2
         WHERE id = $3`,
        [hashedCode, expires, user.id]
      );

      try {
        await sendPasswordResetCode({
          to:   email_,
          name: user.name,
          code: otp,
        });
        console.log("[seller-auth][forgot-password] ✅ code sent to:", user.id);
      } catch (mailErr) {
        console.error("[seller-auth][forgot-password] email failed:", mailErr.message);
      }

    } else {
      console.log("[seller-auth][forgot-password] no account:", email_);
    }

    return genericOk(
      res,
      "If a seller account exists with this email, a reset code has been sent."
    );

  } catch (err) {
    console.error("[seller-auth][forgot-password] ❌", err.message);
    return fail(res, 500, "Failed to send reset code. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/seller-auth/verify-reset-code
// Body: { email, code }
// Step 1 of reset — validates OTP, does NOT change password yet.
// ─────────────────────────────────────────────────────────────
router.post("/verify-reset-code", authLimiter, async (req, res) => {
  const { email, code } = req.body;
  const email_ = cleanEmail(email);

  if (!email_)
    return fail(res, 400, "Email is required");

  if (!code?.trim())
    return fail(res, 400, "Reset code is required");

  try {
    const { rows } = await pool.query(
      `SELECT id, reset_code, reset_expires
       FROM market.users
       WHERE email = $1`,
      [email_]
    );

    if (!rows.length)
      return fail(res, 400, "Invalid or expired reset code.", {
        code: "INVALID_CODE",
      });

    const user = rows[0];

    if (!user.reset_code || !user.reset_expires)
      return fail(
        res, 400,
        "No password reset was requested. Please use Forgot Password first.",
        { code: "NO_RESET_REQUESTED" }
      );

    if (new Date() > new Date(user.reset_expires))
      return fail(res, 400, "Reset code has expired. Please request a new one.", {
        code: "CODE_EXPIRED",
      });

    if (hashCode(code.trim()) !== user.reset_code)
      return fail(res, 400, "Invalid reset code. Please check and try again.", {
        code: "INVALID_CODE",
      });

    // Code is valid — do NOT clear it yet (needed for step 2)
    console.log("[seller-auth][verify-reset-code] ✅ code valid for:", user.id);

    return res.json({
      success: true,
      message: "Reset code verified. Please set your new password.",
    });

  } catch (err) {
    console.error("[seller-auth][verify-reset-code] ❌", err.message);
    return fail(res, 500, "Verification failed. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/seller-auth/reset-password
// Body: { email, code, newPassword }
// Step 2 of reset — re-verifies OTP + sets new password.
//
// FIX: newPassword is hashed WITHOUT trimming.
// The login route also uses password raw (no trim).
// This ensures bcrypt.compare(raw, hash) matches after reset.
//
// FIX: rate limiter cleared on success so the user can
// immediately sign in without hitting the 429 limit.
// ─────────────────────────────────────────────────────────────
router.post("/reset-password", authLimiter, async (req, res) => {
  const { email, code, newPassword } = req.body;
  const email_ = cleanEmail(email);

  if (!email_)
    return fail(res, 400, "Email is required");

  if (!code?.trim())
    return fail(res, 400, "Reset code is required");

  if (!newPassword || newPassword.length < 8)
    return fail(res, 400, "Password must be at least 8 characters");

  try {
    const { rows } = await pool.query(
      `SELECT id, reset_code, reset_expires
       FROM market.users
       WHERE email = $1`,
      [email_]
    );

    if (!rows.length)
      return fail(res, 400, "Invalid or expired reset code.");

    const user = rows[0];

    if (!user.reset_code || !user.reset_expires)
      return fail(res, 400, "No password reset was requested.", {
        code: "NO_RESET_REQUESTED",
      });

    if (new Date() > new Date(user.reset_expires))
      return fail(res, 400, "Reset code has expired. Please request a new one.", {
        code: "CODE_EXPIRED",
      });

    if (hashCode(code.trim()) !== user.reset_code)
      return fail(res, 400, "Invalid reset code.", {
        code: "INVALID_CODE",
      });

    // ── Hash the new password — no trim, consistent with login ──
    const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await pool.query(
      `UPDATE market.users
       SET password_hash = $1,
           reset_code    = NULL,
           reset_expires = NULL
       WHERE id = $2`,
      [password_hash, user.id]
    );

    // FIX: Clear rate limit so the user can sign in immediately
    // after resetting without being blocked by accumulated attempts
    clearRateLimit(req);

    console.log("[seller-auth][reset-password] ✅ password updated:", user.id);

    return res.json({
      success: true,
      message: "Password reset successfully! You can now sign in.",
    });

  } catch (err) {
    console.error("[seller-auth][reset-password] ❌", err.message);
    return fail(res, 500, "Password reset failed. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/seller-auth/me
// Returns the authenticated seller from market.users.
// ─────────────────────────────────────────────────────────────
router.get("/me", async (req, res) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer "))
    return fail(res, 401, "No token provided");

  try {
    const token   = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { rows } = await pool.query(
      `SELECT id, name, email, phone_number,
              status, is_verified, created_at
       FROM market.users
       WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length)
      return fail(res, 404, "Seller account not found");

    return res.json({ success: true, user: rows[0] });

  } catch (err) {
    if (
      err.name === "JsonWebTokenError" ||
      err.name === "TokenExpiredError"
    ) {
      return fail(res, 401, "Invalid or expired token");
    }
    console.error("[seller-auth][/me] ❌", err.message);
    return fail(res, 500, "Server error");
  }
});

export default router;