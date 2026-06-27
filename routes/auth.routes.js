/**
 * routes/auth.routes.js
 *
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/forgot-password
 * GET  /api/auth/reset-password/:token   (validate — optional, kept for safety)
 * POST /api/auth/reset-password
 */

import express   from "express";
import bcrypt    from "bcryptjs";
import crypto    from "crypto";
import jwt       from "jsonwebtoken";
import rateLimit from "express-rate-limit";

import { pool }                   from "../config/db.js";
import { sendPasswordResetEmail } from "../services/email.js";
import { writeAudit }             from "../lib/audit.js";

const router = express.Router();

/* ── helpers ─────────────────────────────────────────────────── */
const getIp = (req) => req.ip ?? req.socket?.remoteAddress ?? null;
const fail  = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const HASH_ROUNDS          = 12;
const TOKEN_BYTES          = 32;    // 64 hex chars
const RESET_EXPIRY_MINUTES = 30;

/* ── rate limiters ───────────────────────────────────────────── */
const authLimiter = rateLimit({
  windowMs : 15 * 60 * 1_000,
  max      : 10,
  message  : { success: false, message: "Too many attempts. Try again later." },
});

const forgotLimiter = rateLimit({
  windowMs : 60 * 60 * 1_000,
  max      : 5,
  message  : { success: false, message: "Too many reset requests. Try again in an hour." },
});

const resetLimiter = rateLimit({
  windowMs : 15 * 60 * 1_000,
  max      : 10,
  message  : { success: false, message: "Too many reset attempts. Try again later." },
});

/* ════════════════════════════════════════════════════════════════
   POST /api/auth/register
════════════════════════════════════════════════════════════════ */
router.post("/register", authLimiter, async (req, res, next) => {
  const {
    name, email, password,
    phone_number, country, state, city,
  } = req.body;

  if (!name || !email || !password)
    return fail(res, 400, "Name, email and password are required.");
  if (password.length < 8)
    return fail(res, 400, "Password must be at least 8 characters.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existing } = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    if (existing.length) {
      await client.query("ROLLBACK");
      return fail(res, 409, "An account with this email already exists.", {
        code: "EMAIL_TAKEN",
      });
    }

    const password_hash = await bcrypt.hash(password, HASH_ROUNDS);

    const { rows: [user] } = await client.query(
      `INSERT INTO users
         (name, email, password_hash, phone_number, country, state, city)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, name, email, phone_number, status, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        password_hash,
        phone_number?.trim() ?? null,
        country ?? null,
        state   ?? null,
        city    ?? null,
      ]
    );

    await client.query("COMMIT");

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" }
    );

    writeAudit({
      actorId    : user.id,
      action     : "user_registered",
      targetType : "user",
      targetId   : user.id,
      ipAddress  : getIp(req),
    }).catch(console.error);

    return res.status(201).json({
      success : true,
      message : "Account created successfully.",
      token,
      user    : {
        id    : user.id,
        name  : user.name,
        email : user.email,
        phone : user.phone_number,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════════
   POST /api/auth/login
════════════════════════════════════════════════════════════════ */
router.post("/login", authLimiter, async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password)
    return fail(res, 400, "Email and password are required.");

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, status, role
       FROM   users
       WHERE  email = $1`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length)
      return fail(res, 401, "Invalid email or password.");

    const user = rows[0];

    if (user.status === "flagged" || user.status === "banned") {
      return fail(res, 403, "Your account has been suspended. Contact support.", {
        code: "ACCOUNT_SUSPENDED",
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return fail(res, 401, "Invalid email or password.");

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" }
    );

    writeAudit({
      actorId    : user.id,
      action     : "user_login",
      targetType : "user",
      targetId   : user.id,
      ipAddress  : getIp(req),
    }).catch(console.error);

    return res.json({
      success : true,
      message : "Login successful.",
      token,
      user    : {
        id    : user.id,
        name  : user.name,
        email : user.email,
        role  : user.role,
      },
    });

  } catch (err) {
    next(err);
  }
});

/* ════════════════════════════════════════════════════════════════
   POST /api/auth/forgot-password
   Always returns 200 — never reveals whether email exists
════════════════════════════════════════════════════════════════ */
router.post("/forgot-password", forgotLimiter, async (req, res, next) => {
  const { email } = req.body;
  const ip        = getIp(req);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail(res, 400, "A valid email address is required.");

  /* Always the same response — prevents email enumeration */
  const SAFE_RESPONSE = {
    success : true,
    message : "If an account exists for that email, a reset link has been sent.",
  };

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length) return res.json(SAFE_RESPONSE);

    const user = rows[0];

    /* Invalidate any existing unused tokens for this user */
    await pool.query(
      `UPDATE password_reset_tokens
       SET    used = true
       WHERE  user_id = $1 AND used = false`,
      [user.id]
    );

    /* Generate a secure random token */
    const rawToken  = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    await pool.query(
      `INSERT INTO password_reset_tokens
         (user_id, token_hash, expires_at, ip_address)
       VALUES (
         $1, $2,
         NOW() + ($3 || ' minutes')::INTERVAL,
         $4
       )`,
      [user.id, tokenHash, RESET_EXPIRY_MINUTES, ip]
    );

    /*
     * ✅ FIXED: reset link now points to /auth?token=
     * so AuthPage.jsx ResetPanel picks it up via ?token= param
     * (was incorrectly /reset-password?token= pointing to a
     *  non-existent separate page)
     */
    const CLIENT_URL = process.env.CLIENT_URL || "https://www.loemart.com";
    const resetUrl   = `${CLIENT_URL}/auth?token=${rawToken}`;

    try {
      await sendPasswordResetEmail({
        to       : user.email,
        name     : user.name,
        resetUrl,
      });
      console.log(`[forgot-password] ✓ reset email sent → ${user.email}`);
    } catch (mailErr) {
      console.error("[forgot-password] email send failed:", mailErr.message);
      /* Invalidate the token so the user can try again cleanly */
      await pool.query(
        `UPDATE password_reset_tokens SET used = true WHERE token_hash = $1`,
        [tokenHash]
      ).catch(() => {});
      return fail(res, 500, "Failed to send reset email. Please try again.");
    }

    writeAudit({
      actorId    : user.id,
      action     : "password_reset_requested",
      targetType : "user",
      targetId   : user.id,
      ipAddress  : ip,
    }).catch(console.error);

    return res.json(SAFE_RESPONSE);

  } catch (err) {
    next(err);
  }
});

/* ════════════════════════════════════════════════════════════════
   GET /api/auth/reset-password/:token
   Called by ResetPanel on mount to validate before showing form
════════════════════════════════════════════════════════════════ */
router.get("/reset-password/:token", async (req, res, next) => {
  const { token } = req.params;

  if (!token || token.length !== TOKEN_BYTES * 2)
    return fail(res, 400, "Invalid reset token.");

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const { rows } = await pool.query(
      `SELECT prt.id, prt.expires_at, u.email
       FROM   password_reset_tokens prt
       JOIN   users u ON u.id = prt.user_id
       WHERE  prt.token_hash = $1
         AND  prt.used       = false
         AND  prt.expires_at > NOW()`,
      [tokenHash]
    );

    if (!rows.length) {
      return fail(res, 400, "This reset link is invalid or has expired.", {
        code: "TOKEN_INVALID",
      });
    }

    const expiresIn = Math.round(
      (new Date(rows[0].expires_at) - Date.now()) / 60_000
    );

    return res.json({
      success   : true,
      valid     : true,
      /* mask email — show enough for user to recognise their account */
      email     : rows[0].email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
      expiresIn,    // minutes remaining
    });

  } catch (err) {
    next(err);
  }
});

/* ════════════════════════════════════════════════════════════════
   POST /api/auth/reset-password
   Actually updates the password
════════════════════════════════════════════════════════════════ */
router.post("/reset-password", resetLimiter, async (req, res, next) => {
  const { token, password } = req.body;
  const ip                  = getIp(req);

  if (!token || !password)
    return fail(res, 400, "Token and new password are required.");
  if (token.length !== TOKEN_BYTES * 2)
    return fail(res, 400, "Invalid reset token.");
  if (password.length < 8)
    return fail(res, 400, "Password must be at least 8 characters.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    /* Lock the token row to prevent concurrent reuse */
    const { rows } = await client.query(
      `SELECT prt.id, prt.user_id, u.email, u.name
       FROM   password_reset_tokens prt
       JOIN   users u ON u.id = prt.user_id
       WHERE  prt.token_hash = $1
         AND  prt.used       = false
         AND  prt.expires_at > NOW()
       FOR    UPDATE OF prt`,
      [tokenHash]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return fail(res, 400, "This reset link is invalid or has expired.", {
        code: "TOKEN_INVALID",
      });
    }

    const rec = rows[0];

    const password_hash = await bcrypt.hash(password, HASH_ROUNDS);

    /* Update password */
    await client.query(
      `UPDATE users
       SET    password_hash = $1,
              updated_at    = NOW()
       WHERE  id = $2`,
      [password_hash, rec.user_id]
    );

    /* Mark token used — one-time use enforced atomically */
    const { rows: marked } = await client.query(
      `UPDATE password_reset_tokens
       SET    used = true
       WHERE  id   = $1 AND used = false
       RETURNING id`,
      [rec.id]
    );

    if (!marked.length) {
      /* Another request consumed this token between our SELECT and UPDATE */
      await client.query("ROLLBACK");
      return fail(res, 400, "This reset link has already been used.", {
        code: "TOKEN_USED",
      });
    }

    /* Invalidate any other tokens for this user (cleanup) */
    await client.query(
      `UPDATE password_reset_tokens
       SET    used = true
       WHERE  user_id = $1 AND used = false`,
      [rec.user_id]
    );

    await client.query("COMMIT");

    writeAudit({
      actorId    : rec.user_id,
      action     : "password_reset_completed",
      targetType : "user",
      targetId   : rec.user_id,
      ipAddress  : ip,
    }).catch(console.error);

    console.log(`[reset-password] ✓ password updated — user: ${rec.user_id}`);

    return res.json({
      success : true,
      message : "Password reset successfully. You can now log in.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

export default router;