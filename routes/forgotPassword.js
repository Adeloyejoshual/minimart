/**
 * routes/resetPassword.js
 *
 * POST /api/auth/reset-password
 *
 * Consumes the reset_token JWT issued by forgotPassword.js
 * after OTP verification, validates the new password, and
 * updates the user's password_hash.
 *
 * Guards:
 *   ✓ JWT must be valid + not expired
 *   ✓ JWT purpose must be "password_reset"
 *   ✓ OTP record must be verified = true, used = false
 *   ✓ OTP must not be expired
 *   ✓ New password must pass strength rules
 *   ✓ New password must NOT match the current password
 *   ✓ Token is single-use — OTP row marked used = true on success
 */

import express   from "express";
import bcrypt    from "bcrypt";
import jwt       from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { pool }  from "../config/db.js";
import { writeAudit } from "../lib/audit.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ════════════════════════════════════════════════════════════
   CONFIG
════════════════════════════════════════════════════════════ */
const HASH_ROUNDS = Math.max(
  10,
  parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10)
);

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("[resetPassword] FATAL: JWT_SECRET is not set.");
}

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const getIp = (req) => {
  const raw =
    req.ip ??
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
    req.socket?.remoteAddress ??
    null;
  return raw?.replace(/^::ffff:/, "") ?? null;
};

/* ════════════════════════════════════════════════════════════
   PASSWORD RULES
   Must stay in sync with the frontend strength checker so the
   server and client agree on what is "strong enough".
════════════════════════════════════════════════════════════ */
const PASSWORD_RULES = [
  { test: (p) => p.length >= 8,          msg: "Password must be at least 8 characters."              },
  { test: (p) => /[A-Z]/.test(p),        msg: "Password must contain at least one uppercase letter." },
  { test: (p) => /[0-9]/.test(p),        msg: "Password must contain at least one number."           },
  { test: (p) => /[^A-Za-z0-9]/.test(p), msg: "Password must contain at least one special character."},
];

const validatePassword = (pw) => {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(pw)) return rule.msg;
  }
  return null;
};

/* ════════════════════════════════════════════════════════════
   RATE LIMITER
   Tight window — reset tokens are short-lived and precious.
════════════════════════════════════════════════════════════ */
const resetLimiter = rateLimit({
  windowMs        : 15 * 60 * 1_000,
  max             : IS_PROD ? 5 : 100,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) => {
    const raw =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
      req.socket?.remoteAddress ??
      "unknown";
    return raw.replace(/^::ffff:/, "");
  },
  handler : (_req, res) =>
    res.status(429).json({
      success : false,
      message : "Too many reset attempts. Please try again later.",
    }),
});

/* ════════════════════════════════════════════════════════════
   POST /api/auth/reset-password
════════════════════════════════════════════════════════════ */
router.post("/reset-password", resetLimiter, async (req, res, next) => {
  const ip          = getIp(req);
  const resetToken  = String(req.body?.reset_token  ?? "").trim();
  const newPassword = String(req.body?.new_password ?? "");

  /* ── 1. Presence check ── */
  if (!resetToken)  return fail(res, 400, "Reset token is required.");
  if (!newPassword) return fail(res, 400, "New password is required.");

  /* ── 2. Password strength ── */
  const strengthError = validatePassword(newPassword);
  if (strengthError) return fail(res, 400, strengthError);

  /* ── 3. Verify JWT ── */
  let payload;
  try {
    payload = jwt.verify(resetToken, JWT_SECRET);
  } catch (err) {
    const isExpired = err.name === "TokenExpiredError";
    return fail(
      res,
      401,
      isExpired
        ? "Reset link has expired. Please request a new one."
        : "Invalid reset token.",
      { code: isExpired ? "TOKEN_EXPIRED" : "TOKEN_INVALID" }
    );
  }

  /* ── 4. Purpose check ── */
  if (payload.purpose !== "password_reset") {
    return fail(res, 401, "Invalid reset token.", { code: "TOKEN_INVALID" });
  }

  const userId = payload.sub;
  const otpId  = payload.otp_id;

  if (!userId || !otpId) {
    return fail(res, 401, "Invalid reset token.", { code: "TOKEN_INVALID" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── 5. Validate OTP record ──
       Must be: verified = true, used = false, not expired.
       This is the single-use gate — once we mark used = true
       the token can never be replayed.
    ── */
    const { rows: otpRows } = await client.query(
      `SELECT id
       FROM   password_reset_otps
       WHERE  id         = $1
         AND  user_id    = $2
         AND  verified   = true
         AND  used       = false
         AND  expires_at > NOW()
       LIMIT  1`,
      [otpId, userId]
    );

    if (!otpRows.length) {
      await client.query("ROLLBACK");
      return fail(
        res,
        401,
        "Reset link has expired. Please request a new one.",
        { code: "TOKEN_EXPIRED" }
      );
    }

    /* ── 6. Fetch current password hash ── */
    const { rows: userRows } = await client.query(
      `SELECT id, email, name, password_hash, status
       FROM   users
       WHERE  id = $1
       LIMIT  1`,
      [userId]
    );

    if (!userRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Account not found.");
    }

    const user = userRows[0];

    if (["banned", "suspended"].includes(user.status)) {
      await client.query("ROLLBACK");
      return fail(res, 403,
        "Your account has been suspended. Please contact support.",
        { code: "ACCOUNT_SUSPENDED" }
      );
    }

    /* ── 7. Reject if same as current password ──────────────────
       This is the core fix.
       bcrypt.compare() checks the plaintext new password against
       the stored hash of the OLD password.  If they match it means
       the user typed their existing password — reject it clearly.
    ─────────────────────────────────────────────────────────── */
    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.password_hash
    );

    if (isSamePassword) {
      await client.query("ROLLBACK");
      return fail(
        res,
        400,
        "Your new password cannot be the same as your current password. Please choose a different one.",
        { code: "SAME_PASSWORD" }
      );
    }

    /* ── 8. Hash new password ── */
    const newHash = await bcrypt.hash(newPassword, HASH_ROUNDS);

    /* ── 9. Update password ── */
    await client.query(
      `UPDATE users
       SET    password_hash      = $1,
              updated_at         = NOW(),
              password_changed_at = NOW()
       WHERE  id = $2`,
      [newHash, userId]
    );

    /* ── 10. Consume the OTP record — prevents replay ── */
    await client.query(
      `UPDATE password_reset_otps
       SET    used    = true,
              used_at = NOW()
       WHERE  id = $1`,
      [otpId]
    );

    /* ── 11. Invalidate all other unused reset OTPs for this user ── */
    await client.query(
      `UPDATE password_reset_otps
       SET    used = true
       WHERE  user_id = $1
         AND  used   = false
         AND  id     != $2`,
      [userId, otpId]
    );

    await client.query("COMMIT");

    /* ── 12. Audit ── */
    writeAudit({
      actorId    : userId,
      action     : "password_reset",
      targetType : "user",
      targetId   : userId,
      ipAddress  : ip,
    }).catch((e) => console.error("[resetPassword] audit failed:", e.message));

    console.log(
      `[resetPassword] ✓ password reset  user=${userId}  ip=${ip}`
    );

    return res.json({
      success : true,
      message : "Password reset successfully. You can now log in.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[resetPassword] error:", err.message, "\n", err.stack);
    next(err);
  } finally {
    client.release();
  }
});

export default router;