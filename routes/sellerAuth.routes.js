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
// RATE LIMITER — in-memory, per IP
// ─────────────────────────────────────────────────────────────
const _attempts = new Map();

const authLimiter = (req, res, next) => {
  const ip  =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
    req.socket.remoteAddress ??
    "unknown";
  const now = Date.now();
  const key = `seller-auth:${ip}`;
  let   rec = _attempts.get(key);

  if (!rec || now - rec.time > 15 * 60_000) {
    rec = { count: 1, time: now };
  } else {
    rec.count++;
  }

  _attempts.set(key, rec);

  if (rec.count > 10) {
    return res.status(429).json({
      success:    false,
      message:    "Too many attempts. Try again in 15 minutes.",
      retryAfter: Math.ceil((15 * 60_000 - (now - rec.time)) / 1000),
    });
  }

  next();
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

// Always return a generic success for sensitive endpoints
// Prevents email enumeration attacks
const genericOk = (res, message) =>
  res.json({ success: true, message });

// ════════════════════════════════════════════════════════════
// POST /api/seller-auth/register
// Creates seller in market.users + sends email OTP
// ════════════════════════════════════════════════════════════
router.post("/register", authLimiter, async (req, res) => {
  const { name, email, phone, password } = req.body;

  // ── Validation ───────────────────────────────────────────
  if (!name?.trim())
    return res.status(400).json({
      success: false, message: "Name is required",
    });

  if (!email?.trim())
    return res.status(400).json({
      success: false, message: "Email is required",
    });

  if (!password)
    return res.status(400).json({
      success: false, message: "Password is required",
    });

  if (password.length < 8)
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters",
    });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim()))
    return res.status(400).json({
      success: false, message: "Enter a valid email address",
    });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Check duplicate in market.users ─────────────────
    const { rows: existing } = await client.query(
      `SELECT id, is_verified FROM market.users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (existing.length) {
      await client.query("ROLLBACK");

      // Account exists but not verified → resend OTP
      if (!existing[0].is_verified) {
        const otp        = generateOTP();
        const hashedCode = hashCode(otp);
        const expires    = new Date(Date.now() + 60 * 60_000);

        await pool.query(
          `UPDATE market.users
           SET verify_code = $1, verify_expires = $2
           WHERE id = $3`,
          [hashedCode, expires, existing[0].id]
        );

        try {
          await sendVerificationCode({
            to:   email.toLowerCase().trim(),
            name: name.trim(),
            code: otp,
          });
        } catch (mailErr) {
          console.error("[register] ⚠️ Resend email failed:", mailErr.message);
        }

        return res.status(409).json({
          success: false,
          code:    "EMAIL_TAKEN_UNVERIFIED",
          message:
            "An unverified account exists. " +
            "We've resent your verification code — please check your email.",
          email: email.toLowerCase().trim(),
        });
      }

      return res.status(409).json({
        success: false,
        code:    "EMAIL_TAKEN",
        message: "A seller account with this email already exists",
      });
    }

    // ── Hash password ────────────────────────────────────
    const password_hash = await bcrypt.hash(password, 12);

    // ── Generate email verification OTP ─────────────────
    const otp        = generateOTP();
    const hashedCode = hashCode(otp);
    const expires    = new Date(Date.now() + 60 * 60_000); // 1 hour

    // ── INSERT into market.users ─────────────────────────
    const { rows: [user] } = await client.query(
      `INSERT INTO market.users
         (name, email, password_hash, phone_number, status,
          is_verified, verify_code, verify_expires)
       VALUES ($1, $2, $3, $4, 'active', FALSE, $5, $6)
       RETURNING id, name, email, phone_number, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
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
      console.error("[register] ⚠️ Email failed:", mailErr.message);
    }

    console.log("[seller-auth][register] ✅ created:", user.id);

    return res.status(201).json({
      success: true,
      message:
        "Account created! Please check your email for the verification code.",
      email: user.email,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[seller-auth][register] ❌", {
      message: err.message,
      code:    err.code,
      detail:  err.detail,
    });

    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A seller account with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });

  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-auth/verify-email
// Body: { email, code }
// Verifies email OTP — market.users only
// ════════════════════════════════════════════════════════════
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;

  if (!email?.trim())
    return res.status(400).json({
      success: false, message: "Email is required",
    });

  if (!code?.trim())
    return res.status(400).json({
      success: false, message: "Verification code is required",
    });

  try {
    const { rows } = await pool.query(
      `SELECT id, is_verified, verify_code, verify_expires
       FROM market.users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length)
      return res.status(404).json({
        success: false,
        message: "No seller account found with this email",
      });

    const user = rows[0];

    // ── Already verified ─────────────────────────────────
    if (user.is_verified)
      return res.json({
        success: true,
        message: "Email already verified. You can log in.",
      });

    // ── Expired ──────────────────────────────────────────
    if (new Date() > new Date(user.verify_expires))
      return res.status(400).json({
        success: false,
        code:    "CODE_EXPIRED",
        message: "Verification code has expired. Please request a new one.",
      });

    // ── Wrong code ───────────────────────────────────────
    if (hashCode(code.trim()) !== user.verify_code)
      return res.status(400).json({
        success: false,
        code:    "INVALID_CODE",
        message: "Invalid verification code. Please check and try again.",
      });

    // ── Mark verified ────────────────────────────────────
    await pool.query(
      `UPDATE market.users
       SET is_verified    = TRUE,
           verify_code    = NULL,
           verify_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    console.log("[seller-auth][verify-email] ✅ verified:", user.id);

    return res.json({
      success: true,
      message: "Email verified successfully! You can now log in.",
    });

  } catch (err) {
    console.error("[seller-auth][verify-email] ❌", err.message);
    return res.status(500).json({
      success: false,
      message: "Verification failed. Please try again.",
    });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-auth/resend-verification
// Body: { email }
// Resends email OTP — market.users only
// ════════════════════════════════════════════════════════════
router.post("/resend-verification", authLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email?.trim())
    return res.status(400).json({
      success: false, message: "Email is required",
    });

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, is_verified
       FROM market.users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    // Generic — never reveal if email exists
    if (!rows.length || rows[0].is_verified) {
      return genericOk(
        res,
        "If an unverified account exists, a new code has been sent."
      );
    }

    const user = rows[0];

    const otp        = generateOTP();
    const hashedCode = hashCode(otp);
    const expires    = new Date(Date.now() + 60 * 60_000);

    await pool.query(
      `UPDATE market.users
       SET verify_code = $1, verify_expires = $2
       WHERE id = $3`,
      [hashedCode, expires, user.id]
    );

    try {
      await sendVerificationCode({
        to:   user.email,
        name: user.name,
        code: otp,
      });
    } catch (mailErr) {
      console.error("[seller-auth][resend-verification] ⚠️ Email failed:", mailErr.message);
    }

    console.log("[seller-auth][resend-verification] ✅ sent to:", user.id);

    return genericOk(
      res,
      "If an unverified account exists, a new code has been sent."
    );

  } catch (err) {
    console.error("[seller-auth][resend-verification] ❌", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to resend verification code.",
    });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-auth/login
// Checks market.users ONLY
// ════════════════════════════════════════════════════════════
router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password)
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, status, is_verified
       FROM market.users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length)
      return res.status(401).json({
        success: false,
        message: "No seller account found with this email. Please create one.",
      });

    const user = rows[0];

    // ── Suspended ────────────────────────────────────────
    if (user.status !== "active")
      return res.status(403).json({
        success: false,
        code:    "ACCOUNT_SUSPENDED",
        message: "Your seller account has been suspended",
      });

    // ── Wrong password ───────────────────────────────────
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });

    // ── Email not verified ───────────────────────────────
    if (!user.is_verified)
      return res.status(403).json({
        success: false,
        code:    "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before logging in.",
        email:   user.email,
      });

    // ── Issue token ──────────────────────────────────────
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log("[seller-auth][login] ✅ market.users:", user.id);

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
    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-auth/forgot-password
// Sends 6-digit reset OTP to seller — market.users ONLY
// Never touches public.users or password_reset_otps table
// ════════════════════════════════════════════════════════════
router.post("/forgot-password", authLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email?.trim())
    return res.status(400).json({
      success: false, message: "Email is required",
    });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim()))
    return res.status(400).json({
      success: false, message: "Enter a valid email address",
    });

  const cleanEmail = email.toLowerCase().trim();

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, status
       FROM market.users
       WHERE email = $1`,
      [cleanEmail]
    );

    // ── Suspended ────────────────────────────────────────
    if (rows.length && rows[0].status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Contact support.",
      });
    }

    // ── User found → generate and send OTP ───────────────
    if (rows.length) {
      const user = rows[0];

      const otp        = generateOTP();
      const hashedCode = hashCode(otp);
      const expires    = new Date(Date.now() + 15 * 60_000); // 15 minutes

      // Writes reset_code to market.users — NOT to password_reset_otps
      await pool.query(
        `UPDATE market.users
         SET reset_code    = $1,
             reset_expires = $2
         WHERE id = $3`,
        [hashedCode, expires, user.id]
      );

      try {
        await sendPasswordResetCode({
          to:   user.email,
          name: user.name,
          code: otp,
        });
        console.log("[seller-auth][forgot-password] ✅ sent to:", user.id);
      } catch (mailErr) {
        console.error("[seller-auth][forgot-password] ⚠️ Email failed:", mailErr.message);
      }
    } else {
      // No account found — still return generic, don't reveal
      console.log("[seller-auth][forgot-password] no account:", cleanEmail);
    }

    // Always return generic response
    return genericOk(
      res,
      "If a seller account exists with this email, a reset code has been sent."
    );

  } catch (err) {
    console.error("[seller-auth][forgot-password] ❌", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send reset code.",
    });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-auth/verify-reset-code
// Body: { email, code }
// Step 1 of reset — validates OTP without changing password
// Reads from market.users — NOT from password_reset_otps
// ════════════════════════════════════════════════════════════
router.post("/verify-reset-code", authLimiter, async (req, res) => {
  const { email, code } = req.body;

  if (!email?.trim())
    return res.status(400).json({
      success: false, message: "Email is required",
    });

  if (!code?.trim())
    return res.status(400).json({
      success: false, message: "Reset code is required",
    });

  try {
    const { rows } = await pool.query(
      `SELECT id, reset_code, reset_expires
       FROM market.users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    // ── Not found ────────────────────────────────────────
    if (!rows.length)
      return res.status(400).json({
        success: false,
        code:    "INVALID_CODE",
        message: "Invalid or expired reset code",
      });

    const user = rows[0];

    // ── No reset requested ───────────────────────────────
    if (!user.reset_code || !user.reset_expires)
      return res.status(400).json({
        success: false,
        code:    "NO_RESET_REQUESTED",
        message: "No password reset was requested. Please use forgot password.",
      });

    // ── Expired ──────────────────────────────────────────
    if (new Date() > new Date(user.reset_expires))
      return res.status(400).json({
        success: false,
        code:    "CODE_EXPIRED",
        message: "Reset code has expired. Please request a new one.",
      });

    // ── Wrong code ───────────────────────────────────────
    if (hashCode(code.trim()) !== user.reset_code)
      return res.status(400).json({
        success: false,
        code:    "INVALID_CODE",
        message: "Invalid reset code. Please check and try again.",
      });

    // ── Code is valid ────────────────────────────────────
    // Don't clear yet — needed for the next step
    console.log("[seller-auth][verify-reset-code] ✅ code verified:", user.id);

    return res.json({
      success: true,
      message: "Reset code verified. You can now set a new password.",
    });

  } catch (err) {
    console.error("[seller-auth][verify-reset-code] ❌", err.message);
    return res.status(500).json({
      success: false,
      message: "Verification failed. Please try again.",
    });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-auth/reset-password
// Body: { email, code, newPassword }
// Step 2 of reset — re-verifies code + sets new password
// Reads/writes market.users — NOT public.users
// ════════════════════════════════════════════════════════════
router.post("/reset-password", authLimiter, async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email?.trim())
    return res.status(400).json({
      success: false, message: "Email is required",
    });

  if (!code?.trim())
    return res.status(400).json({
      success: false, message: "Reset code is required",
    });

  if (!newPassword || newPassword.length < 8)
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters",
    });

  try {
    const { rows } = await pool.query(
      `SELECT id, reset_code, reset_expires
       FROM market.users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length)
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code",
      });

    const user = rows[0];

    // ── No reset requested ───────────────────────────────
    if (!user.reset_code || !user.reset_expires)
      return res.status(400).json({
        success: false,
        code:    "NO_RESET_REQUESTED",
        message: "No password reset was requested.",
      });

    // ── Expired ──────────────────────────────────────────
    if (new Date() > new Date(user.reset_expires))
      return res.status(400).json({
        success: false,
        code:    "CODE_EXPIRED",
        message: "Reset code has expired. Please request a new one.",
      });

    // ── Re-verify code ───────────────────────────────────
    // Prevents hitting this endpoint directly without step 1
    if (hashCode(code.trim()) !== user.reset_code)
      return res.status(400).json({
        success: false,
        code:    "INVALID_CODE",
        message: "Invalid reset code.",
      });

    // ── Hash new password + clear reset fields ────────────
    const password_hash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      `UPDATE market.users
       SET password_hash = $1,
           reset_code    = NULL,
           reset_expires = NULL
       WHERE id = $2`,
      [password_hash, user.id]
    );

    console.log("[seller-auth][reset-password] ✅ password updated:", user.id);

    return res.json({
      success: true,
      message: "Password reset successfully! You can now log in.",
    });

  } catch (err) {
    console.error("[seller-auth][reset-password] ❌", err.message);
    return res.status(500).json({
      success: false,
      message: "Password reset failed. Please try again.",
    });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-auth/me
// Returns seller from market.users ONLY
// ════════════════════════════════════════════════════════════
router.get("/me", async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      return res.status(401).json({
        success: false, message: "No token provided",
      });

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
      return res.status(404).json({
        success: false, message: "Seller account not found",
      });

    return res.json({ success: true, user: rows[0] });

  } catch (err) {
    if (
      err.name === "JsonWebTokenError" ||
      err.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false, message: "Invalid or expired token",
      });
    }
    return res.status(500).json({
      success: false, message: "Server error",
    });
  }
});

export default router;