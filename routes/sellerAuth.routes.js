// routes/sellerAuth.routes.js
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
const BCRYPT_ROUNDS     = 12;
const OTP_TTL_MS        = 60 * 60_000;   // 1 hour
const RESET_TTL_MS      = 15 * 60_000;   // 15 minutes
const RATE_WINDOW_MS    = 15 * 60_000;
const RATE_MAX_ATTEMPTS = 10;
const EMAIL_RX          = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IS_DEV            = process.env.NODE_ENV !== "production";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const cleanEmail = (raw) => raw?.trim().toLowerCase() ?? "";

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const genericOk = (res, message) =>
  res.json({ success: true, message });

// ─────────────────────────────────────────────────────────────
// RATE LIMITER
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
    return res.status(429).json({
      success:     false,
      message:     "Too many attempts. Please wait 15 minutes and try again.",
      retryAfter:  Math.ceil((RATE_WINDOW_MS - (now - rec.time)) / 1000),
    });
  }

  next();
};

const clearRateLimit = (req) =>
  _attempts.delete(`seller-auth:${getIp(req)}`);

// ─────────────────────────────────────────────────────────────
// DEBUG — GET /api/seller-auth/debug/:email
// Returns DB state for a seller account without exposing hash.
// Development only — blocked in production.
// ─────────────────────────────────────────────────────────────
router.get("/debug/:email", async (req, res) => {
  if (!IS_DEV)
    return res.status(404).json({ message: "Not found" });

  const email_ = req.params.email?.trim().toLowerCase();

  try {
    const { rows } = await pool.query(
      `SELECT
         id,
         name,
         email,
         status,
         is_verified,
         LEFT(password_hash, 7)        AS hash_prefix,
         LENGTH(password_hash)         AS hash_length,
         reset_code    IS NOT NULL     AS has_reset_code,
         reset_expires,
         reset_expires > NOW()         AS reset_code_still_valid,
         verify_code   IS NOT NULL     AS has_verify_code,
         verify_expires,
         verify_expires > NOW()        AS verify_code_still_valid,
         created_at,
         updated_at
       FROM market.users
       WHERE email = $1`,
      [email_]
    );

    if (!rows.length) {
      return res.json({
        found:   false,
        email:   email_,
        message: "No account found in market.users with this email",
      });
    }

    const u = rows[0];
    return res.json({
      found: true,
      email: u.email,
      id:    u.id,
      name:  u.name,
      status:      u.status,
      is_verified: u.is_verified,
      password: {
        hash_prefix:  u.hash_prefix,
        hash_length:  u.hash_length,
        looks_valid:
          u.hash_prefix?.startsWith("$2") && u.hash_length === 60,
      },
      reset: {
        has_reset_code:         u.has_reset_code,
        reset_expires:          u.reset_expires,
        reset_code_still_valid: u.reset_code_still_valid,
      },
      verify: {
        has_verify_code:         u.has_verify_code,
        verify_expires:          u.verify_expires,
        verify_code_still_valid: u.verify_code_still_valid,
      },
      timestamps: {
        created_at: u.created_at,
        updated_at: u.updated_at,
      },
    });

  } catch (err) {
    return res.status(500).json({
      error:   true,
      message: err.message,
      hint:    "Check that market.users has an updated_at column",
    });
  }
});

// ─────────────────────────────────────────────────────────────
// DEBUG — POST /api/seller-auth/debug/test-login
// Runs the exact login logic and returns a per-step breakdown.
// Development only — blocked in production.
// ─────────────────────────────────────────────────────────────
router.post("/debug/test-login", async (req, res) => {
  if (!IS_DEV)
    return res.status(404).json({ message: "Not found" });

  const { email, password } = req.body;
  const email_ = cleanEmail(email);

  const result = {
    step_1_input: {
      email_received:              email,
      email_after_clean:           email_,
      password_type:               typeof password,
      password_length:             password?.length,
      password_has_leading_space:  password?.startsWith(" "),
      password_has_trailing_space: password?.endsWith(" "),
    },
    step_2_db_lookup:      null,
    step_3_status_check:   null,
    step_4_verified_check: null,
    step_5_bcrypt:         null,
    conclusion:            null,
  };

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, status, is_verified
       FROM market.users WHERE email = $1`,
      [email_]
    );

    if (!rows.length) {
      result.step_2_db_lookup = { found: false };
      result.conclusion = "FAIL — no account found with this email in market.users";
      return res.json(result);
    }

    const user = rows[0];
    result.step_2_db_lookup = {
      found:        true,
      id:           user.id,
      email_in_db:  user.email,
      status:       user.status,
      is_verified:  user.is_verified,
      hash_prefix:  user.password_hash?.substring(0, 7),
      hash_length:  user.password_hash?.length,
    };

    // Step 3 — status
    if (user.status !== "active") {
      result.step_3_status_check = { passed: false, status: user.status };
      result.conclusion = `FAIL — account status is "${user.status}", not "active"`;
      return res.json(result);
    }
    result.step_3_status_check = { passed: true };

    // Step 4 — verified
    if (!user.is_verified) {
      result.step_4_verified_check = { passed: false };
      result.conclusion = "FAIL — email not verified (is_verified = false)";
      return res.json(result);
    }
    result.step_4_verified_check = { passed: true };

    // Step 5 — bcrypt
    const match        = await bcrypt.compare(password,         user.password_hash);
    const trimmedMatch = await bcrypt.compare(password?.trim(), user.password_hash);

    result.step_5_bcrypt = {
      password_length:  password?.length,
      hash_prefix:      user.password_hash?.substring(0, 7),
      hash_length:      user.password_hash?.length,
      match,
      trimmed_match:    trimmedMatch,
      hint: match
        ? "✅ Passwords match — login should succeed"
        : trimmedMatch
        ? "⚠️ Only matches when trimmed — a space was added during reset or on the client"
        : "❌ Does not match raw or trimmed — wrong password or hash was overwritten",
    };

    result.conclusion = match
      ? "✅ PASS — login would succeed"
      : "FAIL — bcrypt.compare returned false";

    return res.json(result);

  } catch (err) {
    result.conclusion = `ERROR — ${err.message}`;
    return res.status(500).json(result);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /register
// ─────────────────────────────────────────────────────────────
router.post("/register", authLimiter, async (req, res) => {
  const { name, email, phone, password } = req.body;
  const email_ = cleanEmail(email);

  if (!name?.trim())       return fail(res, 400, "Name is required");
  if (!email_)             return fail(res, 400, "Email is required");
  if (!EMAIL_RX.test(email_)) return fail(res, 400, "Enter a valid email address");
  if (!password)           return fail(res, 400, "Password is required");
  if (password.length < 8) return fail(res, 400, "Password must be at least 8 characters");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existing } = await client.query(
      `SELECT id, is_verified FROM market.users WHERE email = $1`,
      [email_]
    );

    if (existing.length) {
      const user = existing[0];
      await client.query("ROLLBACK");

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
          await sendVerificationCode({ to: email_, name: name.trim(), code: otp });
        } catch (e) {
          console.error("[register] resend email failed:", e.message);
        }

        return res.status(409).json({
          success: false,
          code:    "EMAIL_TAKEN_UNVERIFIED",
          message: "An unverified account already exists. We've resent your verification code.",
          email:   email_,
        });
      }

      return res.status(409).json({
        success: false,
        code:    "EMAIL_TAKEN",
        message: "A seller account with this email already exists.",
      });
    }

    // password is NOT trimmed — login also never trims
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const otp           = generateOTP();
    const hashedCode    = hashCode(otp);
    const expires       = new Date(Date.now() + OTP_TTL_MS);

    const { rows: [user] } = await client.query(
      `INSERT INTO market.users
         (name, email, password_hash, phone_number, status,
          is_verified, verify_code, verify_expires)
       VALUES ($1,$2,$3,$4,'active',FALSE,$5,$6)
       RETURNING id, name, email, created_at`,
      [name.trim(), email_, password_hash, phone?.trim() ?? null, hashedCode, expires]
    );

    await client.query("COMMIT");

    try {
      await sendVerificationCode({ to: user.email, name: user.name, code: otp });
    } catch (e) {
      console.error("[register] email failed:", e.message);
    }

    console.log("[seller-auth][register] ✅", user.id);
    return res.status(201).json({
      success: true,
      message: "Account created! Check your email for the 6-digit verification code.",
      email:   user.email,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[seller-auth][register] ❌", err.message, err.code);
    if (err.code === "23505")
      return fail(res, 409, "A seller account with this email already exists.");
    return fail(res, 500, "Registration failed. Please try again.");
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// POST /verify-email
// ─────────────────────────────────────────────────────────────
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;
  const email_ = cleanEmail(email);

  if (!email_)       return fail(res, 400, "Email is required");
  if (!code?.trim()) return fail(res, 400, "Verification code is required");

  try {
    const { rows } = await pool.query(
      `SELECT id, is_verified, verify_code, verify_expires
       FROM market.users WHERE email = $1`,
      [email_]
    );

    if (!rows.length)
      return fail(res, 404, "No seller account found with this email.");

    const user = rows[0];

    if (user.is_verified)
      return res.json({ success: true, message: "Email already verified. You can sign in." });

    if (new Date() > new Date(user.verify_expires))
      return fail(res, 400, "Verification code has expired. Please request a new one.", { code: "CODE_EXPIRED" });

    if (hashCode(code.trim()) !== user.verify_code)
      return fail(res, 400, "Invalid verification code. Please check and try again.", { code: "INVALID_CODE" });

    await pool.query(
      `UPDATE market.users
       SET is_verified = TRUE, verify_code = NULL, verify_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    console.log("[seller-auth][verify-email] ✅", user.id);
    return res.json({ success: true, message: "Email verified successfully! You can now sign in." });

  } catch (err) {
    console.error("[seller-auth][verify-email] ❌", err.message);
    return fail(res, 500, "Verification failed. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// POST /resend-verification
// ─────────────────────────────────────────────────────────────
router.post("/resend-verification", authLimiter, async (req, res) => {
  const email_ = cleanEmail(req.body.email);

  if (!email_) return fail(res, 400, "Email is required");

  try {
    const { rows } = await pool.query(
      `SELECT id, name, is_verified FROM market.users WHERE email = $1`,
      [email_]
    );

    if (!rows.length || rows[0].is_verified)
      return genericOk(res, "If an unverified account exists, a new code has been sent.");

    const user       = rows[0];
    const otp        = generateOTP();
    const hashedCode = hashCode(otp);
    const expires    = new Date(Date.now() + OTP_TTL_MS);

    await pool.query(
      `UPDATE market.users SET verify_code = $1, verify_expires = $2 WHERE id = $3`,
      [hashedCode, expires, user.id]
    );

    try {
      await sendVerificationCode({ to: email_, name: user.name, code: otp });
    } catch (e) {
      console.error("[resend-verification] email failed:", e.message);
    }

    console.log("[seller-auth][resend-verification] ✅", user.id);
    return genericOk(res, "If an unverified account exists, a new code has been sent.");

  } catch (err) {
    console.error("[seller-auth][resend-verification] ❌", err.message);
    return fail(res, 500, "Failed to resend verification code.");
  }
});

// ─────────────────────────────────────────────────────────────
// POST /login
//
// Check order: suspended → unverified → wrong password → token
// is_verified is checked BEFORE bcrypt.compare so a just-reset
// user never sees "incorrect password" due to ordering.
// password is never trimmed — must match hash exactly.
// ─────────────────────────────────────────────────────────────
router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const email_ = cleanEmail(email);

  if (!email_ || !password)
    return fail(res, 400, "Email and password are required");

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, status, is_verified
       FROM market.users WHERE email = $1`,
      [email_]
    );

    if (!rows.length)
      return fail(res, 401, "No seller account found with this email. Please create one to continue.");

    const user = rows[0];

    // 1. Suspended
    if (user.status !== "active")
      return fail(res, 403, "Your seller account has been suspended.", { code: "ACCOUNT_SUSPENDED" });

    // 2. Not verified — BEFORE bcrypt so this error is never masked
    if (!user.is_verified)
      return fail(res, 403, "Please verify your email before signing in.", {
        code:  "EMAIL_NOT_VERIFIED",
        email: user.email,
      });

    // 3. Wrong password
    // password = raw req.body value, never trimmed
    // password_hash = bcrypt of raw value from register/reset
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return fail(res, 401, "Incorrect email or password.");

    // 4. Issue token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log("[seller-auth][login] ✅", user.id);
    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });

  } catch (err) {
    console.error("[seller-auth][login] ❌", err.message);
    return fail(res, 500, "Sign in failed. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// POST /forgot-password
// ─────────────────────────────────────────────────────────────
router.post("/forgot-password", authLimiter, async (req, res) => {
  const email_ = cleanEmail(req.body.email);

  if (!email_)              return fail(res, 400, "Email is required");
  if (!EMAIL_RX.test(email_)) return fail(res, 400, "Enter a valid email address");

  try {
    const { rows } = await pool.query(
      `SELECT id, name, status FROM market.users WHERE email = $1`,
      [email_]
    );

    if (rows.length && rows[0].status !== "active")
      return fail(res, 403, "Your account has been suspended. Contact support.");

    if (rows.length) {
      const user       = rows[0];
      const otp        = generateOTP();
      const hashedCode = hashCode(otp);
      const expires    = new Date(Date.now() + RESET_TTL_MS);

      await pool.query(
        `UPDATE market.users SET reset_code = $1, reset_expires = $2 WHERE id = $3`,
        [hashedCode, expires, user.id]
      );

      try {
        await sendPasswordResetCode({ to: email_, name: user.name, code: otp });
        console.log("[seller-auth][forgot-password] ✅", user.id);
      } catch (e) {
        console.error("[seller-auth][forgot-password] email failed:", e.message);
      }
    } else {
      console.log("[seller-auth][forgot-password] no account:", email_);
    }

    return genericOk(res, "If a seller account exists with this email, a reset code has been sent.");

  } catch (err) {
    console.error("[seller-auth][forgot-password] ❌", err.message);
    return fail(res, 500, "Failed to send reset code. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// POST /verify-reset-code
// ─────────────────────────────────────────────────────────────
router.post("/verify-reset-code", authLimiter, async (req, res) => {
  const { email, code } = req.body;
  const email_ = cleanEmail(email);

  if (!email_)       return fail(res, 400, "Email is required");
  if (!code?.trim()) return fail(res, 400, "Reset code is required");

  try {
    const { rows } = await pool.query(
      `SELECT id, reset_code, reset_expires FROM market.users WHERE email = $1`,
      [email_]
    );

    if (!rows.length)
      return fail(res, 400, "Invalid or expired reset code.", { code: "INVALID_CODE" });

    const user = rows[0];

    if (!user.reset_code || !user.reset_expires)
      return fail(res, 400, "No password reset was requested. Please use Forgot Password first.", {
        code: "NO_RESET_REQUESTED",
      });

    if (new Date() > new Date(user.reset_expires))
      return fail(res, 400, "Reset code has expired. Please request a new one.", { code: "CODE_EXPIRED" });

    if (hashCode(code.trim()) !== user.reset_code)
      return fail(res, 400, "Invalid reset code. Please check and try again.", { code: "INVALID_CODE" });

    // Do NOT clear yet — step 2 re-verifies it
    console.log("[seller-auth][verify-reset-code] ✅", user.id);
    return res.json({ success: true, message: "Reset code verified. Please set your new password." });

  } catch (err) {
    console.error("[seller-auth][verify-reset-code] ❌", err.message);
    return fail(res, 500, "Verification failed. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// POST /reset-password
//
// newPassword is hashed WITHOUT trimming.
// Login also never trims — bcrypt.compare(raw, hash) matches.
// Rate limit cleared on success so user can sign in immediately.
// ─────────────────────────────────────────────────────────────
router.post("/reset-password", authLimiter, async (req, res) => {
  const { email, code, newPassword } = req.body;
  const email_ = cleanEmail(email);

  if (!email_)                      return fail(res, 400, "Email is required");
  if (!code?.trim())                return fail(res, 400, "Reset code is required");
  if (!newPassword || newPassword.length < 8)
    return fail(res, 400, "Password must be at least 8 characters");

  try {
    const { rows } = await pool.query(
      `SELECT id, reset_code, reset_expires FROM market.users WHERE email = $1`,
      [email_]
    );

    if (!rows.length)
      return fail(res, 400, "Invalid or expired reset code.");

    const user = rows[0];

    if (!user.reset_code || !user.reset_expires)
      return fail(res, 400, "No password reset was requested.", { code: "NO_RESET_REQUESTED" });

    if (new Date() > new Date(user.reset_expires))
      return fail(res, 400, "Reset code has expired. Please request a new one.", { code: "CODE_EXPIRED" });

    if (hashCode(code.trim()) !== user.reset_code)
      return fail(res, 400, "Invalid reset code.", { code: "INVALID_CODE" });

    // Hash raw — never trim password
    const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await pool.query(
      `UPDATE market.users
       SET password_hash = $1, reset_code = NULL, reset_expires = NULL
       WHERE id = $2`,
      [password_hash, user.id]
    );

    // Clear rate limit — user must be able to sign in immediately
    clearRateLimit(req);

    console.log("[seller-auth][reset-password] ✅", user.id);
    return res.json({ success: true, message: "Password reset successfully! You can now sign in." });

  } catch (err) {
    console.error("[seller-auth][reset-password] ❌", err.message);
    return fail(res, 500, "Password reset failed. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// GET /me
// ─────────────────────────────────────────────────────────────
router.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return fail(res, 401, "No token provided");

  try {
    const token   = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { rows } = await pool.query(
      `SELECT id, name, email, phone_number, status, is_verified, created_at
       FROM market.users WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length) return fail(res, 404, "Seller account not found");
    return res.json({ success: true, user: rows[0] });

  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError")
      return fail(res, 401, "Invalid or expired token");
    console.error("[seller-auth][/me] ❌", err.message);
    return fail(res, 500, "Server error");
  }
});

export default router;