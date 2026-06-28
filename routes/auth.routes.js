/**
 * routes/auth.routes.js
 *
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/forgot-password      — send 6-digit OTP to email
 * POST /api/auth/forgot-password/verify — verify OTP
 * POST /api/auth/reset-password       — set new password (after OTP verified)
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
const HASH_ROUNDS        = 12;
const OTP_EXPIRY_MINUTES = 15;
const OTP_MAX_ATTEMPTS   = 5;

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

/** 6-digit numeric OTP */
const generateOtp = () =>
  String(crypto.randomInt(100_000, 999_999));

/** Hash OTP before storing — never store raw */
const hashOtp = (raw) =>
  crypto.createHash("sha256").update(String(raw)).digest("hex");

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
   AUTO-MIGRATION
   Creates password_reset_otps table on first startup.
═══════════════════════════════════════════════════════════════ */
async function ensureOtpTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        otp_hash     TEXT        NOT NULL,
        expires_at   TIMESTAMPTZ NOT NULL,
        attempts     INT         NOT NULL DEFAULT 0,
        verified     BOOLEAN     NOT NULL DEFAULT false,
        used         BOOLEAN     NOT NULL DEFAULT false,
        ip_address   TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pro_user_id
        ON password_reset_otps (user_id)
        WHERE used = false
    `);
    console.log("[auth] ✓ password_reset_otps table ready");
  } catch (err) {
    console.error("[auth] ensureOtpTable error:", err.message);
  }
}

ensureOtpTable();

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

const authLimiter   = mkLimiter({
  windowMin : 15,
  max       : 10,
  message   : "Too many attempts. Please try again later.",
});
const forgotLimiter = mkLimiter({
  windowMin : 60,
  max       : 5,
  message   : "Too many reset requests. Please try again in an hour.",
});
const verifyLimiter = mkLimiter({
  windowMin : 15,
  max       : 10,
  message   : "Too many verification attempts. Please try again later.",
});
const resetLimiter  = mkLimiter({
  windowMin : 15,
  max       : 10,
  message   : "Too many reset attempts. Please try again later.",
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/register
═══════════════════════════════════════════════════════════════ */
router.post("/register", authLimiter, async (req, res, next) => {
  const { name, email, password, phone_number, country, state, city } = req.body;

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

    const { rows: existing } = await client.query(
      `SELECT id FROM users WHERE email = $1`, [cleanEmail]
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
      [cleanName, cleanEmail, password_hash, cleanPhone,
       country ?? null, state ?? null, city ?? null]
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
      `SELECT ${SAFE_FIELDS}, password_hash FROM users WHERE email = $1`,
      [cleanEmail]
    );

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

    pool.query(
      "UPDATE users SET last_login = NOW(), is_online = true WHERE id = $1",
      [row.id]
    ).catch((e) => console.error("[auth] last_login update failed:", e.message));

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

    return res.json({ success: true, message: "Login successful.", token, user });

  } catch (err) {
    console.error("[auth] login error:", err.message);
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/forgot-password
   Step 1 — send 6-digit OTP to the user's email.
   Always returns 200 — never reveals if email exists.
═══════════════════════════════════════════════════════════════ */
router.post("/forgot-password", forgotLimiter, async (req, res, next) => {
  const { email } = req.body;
  const ip        = getIp(req);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail(res, 400, "A valid email address is required.");

  const SAFE_RESPONSE = {
    success : true,
    message : "If an account exists for that email, a 6-digit code has been sent.",
  };

  try {
    const cleanEmail = email.trim().toLowerCase();
    console.log(`[auth] forgot-password OTP request  email=${cleanEmail}`);

    const { rows } = await pool.query(
      `SELECT id, name, email FROM users WHERE email = $1`,
      [cleanEmail]
    );

    if (!rows.length) {
      console.log(`[auth] forgot-password: no account → ${cleanEmail}`);
      return res.json(SAFE_RESPONSE);
    }

    const user = rows[0];

    /* invalidate all previous unused OTPs for this user */
    await pool.query(
      `UPDATE password_reset_otps
       SET used = true WHERE user_id = $1 AND used = false`,
      [user.id]
    );

    /* generate and hash OTP */
    const rawOtp  = generateOtp();
    const otpHash = hashOtp(rawOtp);

    await pool.query(
      `INSERT INTO password_reset_otps
         (user_id, otp_hash, expires_at, ip_address)
       VALUES ($1, $2, NOW() + ($3 || ' minutes')::INTERVAL, $4)`,
      [user.id, otpHash, String(OTP_EXPIRY_MINUTES), ip]
    );

    /* dev — always print the OTP to console */
    if (!IS_PROD) {
      console.log("\n" + "═".repeat(60));
      console.log("[auth] 🔑  PASSWORD RESET OTP (dev mode)");
      console.log(`   Email : ${user.email}`);
      console.log(`   OTP   : ${rawOtp}`);
      console.log(`   Exp   : ${OTP_EXPIRY_MINUTES} minutes`);
      console.log("═".repeat(60) + "\n");
    }

    /* send email */
    try {
      await sendPasswordResetEmail({
        to      : user.email,
        name    : user.name,
        otp     : rawOtp,
        expiry  : OTP_EXPIRY_MINUTES,
      });
      console.log(`[auth] ✓ reset OTP email sent → ${user.email}`);
    } catch (mailErr) {
      console.error("[auth] email send failed:", mailErr.message);

      if (!IS_PROD) {
        /* dev: don't fail — user can use the OTP from the console */
        return res.json({
          ...SAFE_RESPONSE,
          dev_otp  : rawOtp,
          dev_hint : "Email failed in dev — use the OTP printed in your server console.",
        });
      }

      /* prod: invalidate the OTP and surface the error */
      await pool.query(
        `UPDATE password_reset_otps SET used = true WHERE otp_hash = $1`,
        [otpHash]
      ).catch(() => {});

      return fail(res, 500, "Failed to send reset code. Please try again.");
    }

    writeAudit({
      actorId    : user.id,
      action     : "password_reset_otp_sent",
      targetType : "user",
      targetId   : user.id,
      ipAddress  : ip,
    }).catch(console.error);

    return res.json(SAFE_RESPONSE);

  } catch (err) {
    console.error("[auth] forgot-password error:", err.message);
    console.error("[auth] forgot-password stack:", err.stack);
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/forgot-password/verify
   Step 2 — verify the 6-digit OTP.
   Returns a short-lived reset_token the client uses in step 3.
═══════════════════════════════════════════════════════════════ */
router.post("/forgot-password/verify", verifyLimiter, async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp)
    return fail(res, 400, "Email and OTP code are required.");
  if (!/^\d{6}$/.test(String(otp)))
    return fail(res, 400, "OTP must be a 6-digit number.");

  try {
    const cleanEmail = email.trim().toLowerCase();
    const otpHash    = hashOtp(otp);

    /* find user */
    const { rows: userRows } = await pool.query(
      `SELECT id FROM users WHERE email = $1`, [cleanEmail]
    );
    if (!userRows.length)
      return fail(res, 400, "Invalid code. Please try again.", { code: "OTP_INVALID" });

    const userId = userRows[0].id;

    /* find matching valid OTP */
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

    if (!otpRows.length) {
      /* increment attempts on the most recent unexpired OTP */
      await pool.query(
        `UPDATE password_reset_otps
         SET    attempts = attempts + 1
         WHERE  user_id    = $1
           AND  used       = false
           AND  verified   = false
           AND  expires_at > NOW()`,
        [userId]
      ).catch(() => {});

      /* check if too many attempts */
      const { rows: attemptRows } = await pool.query(
        `SELECT attempts FROM password_reset_otps
         WHERE  user_id    = $1
           AND  used       = false
           AND  expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      ).catch(() => ({ rows: [] }));

      const attempts     = attemptRows[0]?.attempts ?? 0;
      const attemptsLeft = Math.max(0, OTP_MAX_ATTEMPTS - attempts);

      if (attemptsLeft === 0) {
        /* lock the OTP */
        await pool.query(
          `UPDATE password_reset_otps
           SET used = true
           WHERE user_id = $1 AND used = false`,
          [userId]
        ).catch(() => {});
        return fail(res, 400,
          "Too many incorrect attempts. Please request a new code.",
          { code: "OTP_LOCKED", attemptsLeft: 0 }
        );
      }

      return fail(res, 400,
        `Incorrect code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining.`,
        { code: "OTP_INVALID", attemptsLeft }
      );
    }

    const otpRecord = otpRows[0];

    /* mark OTP as verified (not yet used — step 3 will mark it used) */
    await pool.query(
      `UPDATE password_reset_otps
       SET verified = true WHERE id = $1`,
      [otpRecord.id]
    );

    /* issue a short-lived reset_token the client sends in step 3 */
    const resetToken = jwt.sign(
      { sub: userId, otp_id: otpRecord.id, purpose: "password_reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    console.log(`[auth] ✓ reset OTP verified  user=${userId}`);

    return res.json({
      success      : true,
      message      : "Code verified. You can now set your new password.",
      reset_token  : resetToken,
    });

  } catch (err) {
    console.error("[auth] forgot-password/verify error:", err.message);
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/reset-password
   Step 3 — set new password using the reset_token from step 2.
═══════════════════════════════════════════════════════════════ */
router.post("/reset-password", resetLimiter, async (req, res, next) => {
  const { reset_token, password } = req.body;
  const ip                        = getIp(req);

  if (!reset_token || !password)
    return fail(res, 400, "Reset token and new password are required.");
  if (password.length < 8)
    return fail(res, 400, "Password must be at least 8 characters.");
  if (!/[A-Z]/.test(password))
    return fail(res, 400, "Password must contain at least one uppercase letter.");
  if (!/[0-9]/.test(password))
    return fail(res, 400, "Password must contain at least one number.");

  /* verify the JWT reset token */
  let payload;
  try {
    payload = jwt.verify(reset_token, process.env.JWT_SECRET);
  } catch (jwtErr) {
    return fail(res, 400,
      jwtErr.name === "TokenExpiredError"
        ? "Your session has expired. Please start over."
        : "Invalid reset token. Please start over.",
      { code: "RESET_TOKEN_INVALID" }
    );
  }

  if (payload.purpose !== "password_reset")
    return fail(res, 400, "Invalid reset token.", { code: "RESET_TOKEN_INVALID" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* confirm the OTP record is still verified and not used */
    const { rows: otpRows } = await client.query(
      `SELECT id FROM password_reset_otps
       WHERE  id       = $1
         AND  user_id  = $2
         AND  verified = true
         AND  used     = false
         AND  expires_at > NOW()
       FOR UPDATE`,
      [payload.otp_id, payload.sub]
    );

    if (!otpRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 400,
        "This reset session is invalid or has expired. Please start over.",
        { code: "RESET_SESSION_INVALID" }
      );
    }

    const password_hash = await bcrypt.hash(password, HASH_ROUNDS);

    /* update password */
    await client.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [password_hash, payload.sub]
    );

    /* mark OTP used — one-time only */
    await client.query(
      `UPDATE password_reset_otps SET used = true WHERE id = $1`,
      [payload.otp_id]
    );

    /* clean up all other OTPs for this user */
    await client.query(
      `UPDATE password_reset_otps
       SET used = true WHERE user_id = $1 AND used = false`,
      [payload.sub]
    );

    await client.query("COMMIT");

    writeAudit({
      actorId    : payload.sub,
      action     : "password_reset_completed",
      targetType : "user",
      targetId   : payload.sub,
      ipAddress  : ip,
    }).catch(console.error);

    console.log(`[auth] ✓ password reset complete  user=${payload.sub}`);

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