/**
 * routes/auth.routes.js
 *
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/forgot-password
 * GET  /api/auth/reset-password/:token   — validate token (called by ResetPanel on mount)
 * POST /api/auth/reset-password          — set new password
 */

import express   from "express";
import bcrypt    from "bcrypt";
import crypto    from "crypto";
import jwt       from "jsonwebtoken";
import rateLimit from "express-rate-limit";

import { pool }                   from "../config/db.js";
import { sendPasswordResetEmail } from "../services/email.js";
import { writeAudit }             from "../lib/audit.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const HASH_ROUNDS          = 12;
const TOKEN_BYTES          = 32;   // raw token = 64 hex chars
const RESET_EXPIRY_MINUTES = 30;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  req.socket?.remoteAddress ??
  null;

const ok   = (res, data = {})          => res.json({ success: true,  ...data });
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const hashToken = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

/* ── safe user fields returned to the client ── */
const SAFE_FIELDS = `
  id, name, email, phone_number,
  country, state, city,
  profile_image, store_name, store_description, store_logo,
  store_verified, status, last_login,
  rating, trust_score, verified, products_count,
  total_sales, total_purchases, created_at,
  "role", is_online, email_verified, identity_verified, seller_type
`;

const makeJwt = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role ?? null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" }
  );

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const mkLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60 * 1_000,
    max             : IS_PROD ? max : max * 50,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? req.ip),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const authLimiter   = mkLimiter({ windowMin: 15, max: 10,  message: "Too many attempts. Try again later."              });
const forgotLimiter = mkLimiter({ windowMin: 60, max: 5,   message: "Too many reset requests. Try again in an hour."   });
const resetLimiter  = mkLimiter({ windowMin: 15, max: 10,  message: "Too many reset attempts. Try again later."        });

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/register
═══════════════════════════════════════════════════════════════ */
router.post("/register", authLimiter, async (req, res, next) => {
  const {
    name, email, password,
    phone_number, country, state, city,
  } = req.body;

  /* ── validation ── */
  if (!name || !email || !password)
    return fail(res, 400, "Name, email and password are required.");
  if (typeof name !== "string" || name.trim().length < 2)
    return fail(res, 400, "Name must be at least 2 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail(res, 400, "Please enter a valid email address.");
  if (password.length < 8)
    return fail(res, 400, "Password must be at least 8 characters.");

  const cleanName  = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone_number?.trim() || null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* duplicate email check */
    const { rows: existing } = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [cleanEmail]
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
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SAFE_FIELDS}`,
      [
        cleanName,
        cleanEmail,
        password_hash,
        cleanPhone,
        country ?? null,
        state   ?? null,
        city    ?? null,
      ]
    );

    await client.query("COMMIT");

    const token = makeJwt(user);

    writeAudit({
      actorId    : user.id,
      action     : "user_registered",
      targetType : "user",
      targetId   : user.id,
      ipAddress  : getIp(req),
    }).catch(console.error);

    console.log(`[auth] ✓ register  user=${user.id}  email=${cleanEmail}`);

    return res.status(201).json({
      success : true,
      message : "Account created successfully.",
      token,
      user,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});

    /* unique constraint on phone */
    if (err.code === "23505") {
      const detail = (err.detail ?? "").toLowerCase();
      if (detail.includes("phone"))
        return fail(res, 409, "Phone number already registered.", { code: "PHONE_TAKEN" });
      return fail(res, 409, "An account with this email already exists.", { code: "EMAIL_TAKEN" });
    }

    console.error("[auth] register error:", err.message);
    next(err);
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/login
═══════════════════════════════════════════════════════════════ */
router.post("/login", authLimiter, async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password)
    return fail(res, 400, "Email and password are required.");

  const cleanEmail = email.trim().toLowerCase();

  try {
    const { rows } = await pool.query(
      `SELECT ${SAFE_FIELDS}, password_hash
       FROM   users
       WHERE  email = $1`,
      [cleanEmail]
    );

    /* same message for missing user and wrong password — no enumeration */
    if (!rows.length)
      return fail(res, 401, "Invalid email or password.");

    const row = rows[0];

    if (row.status === "flagged" || row.status === "banned") {
      return fail(res, 403, "Your account has been suspended. Contact support.", {
        code: "ACCOUNT_SUSPENDED",
      });
    }

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid)
      return fail(res, 401, "Invalid email or password.");

    /* fire-and-forget last_login */
    pool.query(
      "UPDATE users SET last_login = NOW(), is_online = true WHERE id = $1",
      [row.id]
    ).catch((e) => console.error("[auth] last_login update failed:", e.message));

    /* strip password_hash before sending */
    const { password_hash, ...user } = row;
    const token = makeJwt(user);

    writeAudit({
      actorId    : user.id,
      action     : "user_login",
      targetType : "user",
      targetId   : user.id,
      ipAddress  : getIp(req),
    }).catch(console.error);

    console.log(`[auth] ✓ login  user=${user.id}  email=${cleanEmail}`);

    return res.json({
      success : true,
      message : "Login successful.",
      token,
      user,
    });

  } catch (err) {
    console.error("[auth] login error:", err.message);
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/forgot-password
   Always returns 200 — never reveals whether the email exists.
═══════════════════════════════════════════════════════════════ */
router.post("/forgot-password", forgotLimiter, async (req, res, next) => {
  const { email } = req.body;
  const ip        = getIp(req);

  /* basic format check — still 400 for garbage input */
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail(res, 400, "A valid email address is required.");

  /* universal safe response — same text whether or not email exists */
  const SAFE_RESPONSE = {
    success : true,
    message : "If an account exists for that email, a reset link has been sent.",
  };

  try {
    const cleanEmail = email.trim().toLowerCase();

    const { rows } = await pool.query(
      `SELECT id, name, email FROM users WHERE email = $1`,
      [cleanEmail]
    );

    /* no user — return safe response, do nothing else */
    if (!rows.length) {
      console.log(`[auth] forgot-password: no account for ${cleanEmail}`);
      return res.json(SAFE_RESPONSE);
    }

    const user = rows[0];

    /* invalidate any existing unused tokens for this user */
    await pool.query(
      `UPDATE password_reset_tokens
       SET    used = true
       WHERE  user_id = $1 AND used = false`,
      [user.id]
    );

    /* generate a cryptographically secure raw token */
    const rawToken  = crypto.randomBytes(TOKEN_BYTES).toString("hex"); // 64 hex chars
    const tokenHash = hashToken(rawToken);

    /* store hashed token — raw token is ONLY sent in the email */
    await pool.query(
      `INSERT INTO password_reset_tokens
         (user_id, token_hash, expires_at, ip_address)
       VALUES (
         $1, $2,
         NOW() + ($3 || ' minutes')::INTERVAL,
         $4
       )`,
      [user.id, tokenHash, String(RESET_EXPIRY_MINUTES), ip]
    );

    /*
     * Reset URL: frontend reads ?token= and shows ResetPanel.
     * Uses /auth?token= — NOT /reset-password?token=
     */
    const CLIENT_URL = process.env.CLIENT_URL || "https://www.loemart.com";
    const resetUrl   = `${CLIENT_URL}/auth?token=${rawToken}`;

    /* send email — on failure, invalidate token and surface the error */
    try {
      await sendPasswordResetEmail({
        to      : user.email,
        name    : user.name,
        resetUrl,
      });
      console.log(`[auth] ✓ reset email sent → ${user.email}`);
    } catch (mailErr) {
      console.error("[auth] forgot-password email failed:", mailErr.message);

      /* invalidate so the user can cleanly retry */
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
    console.error("[auth] forgot-password error:", err.message);
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/auth/reset-password/:token
   Called by ResetPanel on mount to validate before showing form.
   Returns masked email + minutes remaining so UI can show context.
═══════════════════════════════════════════════════════════════ */
router.get("/reset-password/:token", async (req, res, next) => {
  const { token } = req.params;

  /* token must be exactly 64 hex chars */
  if (!token || token.length !== TOKEN_BYTES * 2)
    return fail(res, 400, "Invalid reset token.", { code: "TOKEN_INVALID" });

  try {
    const tokenHash = hashToken(token);

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

    const rec       = rows[0];
    const expiresIn = Math.max(
      0,
      Math.round((new Date(rec.expires_at) - Date.now()) / 60_000)
    );

    return res.json({
      success   : true,
      valid     : true,
      /* mask email — show just enough for the user to recognise their account */
      email     : rec.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
      expiresIn,   // minutes remaining
    });

  } catch (err) {
    console.error("[auth] validate-token error:", err.message);
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/reset-password
   Validates token, updates password, marks token used — atomically.
═══════════════════════════════════════════════════════════════ */
router.post("/reset-password", resetLimiter, async (req, res, next) => {
  const { token, password } = req.body;
  const ip                  = getIp(req);

  /* ── input validation ── */
  if (!token || !password)
    return fail(res, 400, "Token and new password are required.");
  if (token.length !== TOKEN_BYTES * 2)
    return fail(res, 400, "Invalid reset token.", { code: "TOKEN_INVALID" });
  if (password.length < 8)
    return fail(res, 400, "Password must be at least 8 characters.");
  if (!/[A-Z]/.test(password))
    return fail(res, 400, "Password must contain at least one uppercase letter.");
  if (!/[0-9]/.test(password))
    return fail(res, 400, "Password must contain at least one number.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tokenHash = hashToken(token);

    /* lock the token row — prevents concurrent reuse */
    const { rows } = await client.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, u.email, u.name
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

    /* double-check expiry after lock */
    if (new Date(rec.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return fail(
        res, 400,
        `This reset link expired ${RESET_EXPIRY_MINUTES} minutes after it was sent. ` +
        "Please request a new one.",
        { code: "TOKEN_EXPIRED" }
      );
    }

    /* hash new password — same rounds as register */
    const password_hash = await bcrypt.hash(password, HASH_ROUNDS);

    /* update password */
    await client.query(
      `UPDATE users
       SET    password_hash = $1,
              updated_at    = NOW()
       WHERE  id = $2`,
      [password_hash, rec.user_id]
    );

    /* mark token used — one-time use enforced atomically */
    const { rows: marked } = await client.query(
      `UPDATE password_reset_tokens
       SET    used = true
       WHERE  id   = $1
         AND  used = false
       RETURNING id`,
      [rec.id]
    );

    /* guard: if another request consumed the token between our SELECT and UPDATE */
    if (!marked.length) {
      await client.query("ROLLBACK");
      return fail(res, 400, "This reset link has already been used.", {
        code: "TOKEN_USED",
      });
    }

    /* invalidate any remaining tokens for this user (cleanup) */
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

    console.log(`[auth] ✓ password reset  user=${rec.user_id}`);

    return res.json({
      success : true,
      message : "Password reset successfully. You can now log in.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[auth] reset-password error:", err.message);
    next(err);
  } finally {
    client.release();
  }
});

export default router;