/**
 * routes/resetPassword.js
 *
 * POST /api/auth/reset-password
 *
 * Mounted in server.js as:
 *   app.use("/api/auth", resetPasswordRouter)
 *
 * Flow:
 *   1. Validate password strength
 *   2. Verify JWT reset_token (issued by forgotPassword.js → verifyForgotOtp)
 *   3. Confirm OTP record still valid (verified=true, used=false, not expired)
 *   4. Block reuse of same password
 *   5. Hash + save new password
 *   6. Mark OTP as used — one-time only
 *   7. Clean up all other OTPs for this user
 *   8. Return fresh JWT + user → ResetPassword.jsx auto-login
 */

import express     from "express";
import bcrypt      from "bcrypt";
import jwt         from "jsonwebtoken";
import rateLimit   from "express-rate-limit";
import { pool }    from "../config/db.js";
import { writeAudit } from "../lib/audit.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const HASH_ROUNDS    = 12;
const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

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

/**
 * Safe user fields returned to frontend.
 * Matches SAFE_FIELDS in auth.routes.js exactly —
 * never exposes password_hash.
 */
const SAFE_FIELDS = `
  id, name, email, phone_number,
  country, state, city,
  profile_image, store_name, store_description, store_logo,
  store_verified, status, last_login,
  rating, trust_score, verified, products_count,
  total_sales, total_purchases, created_at,
  "role", is_online, email_verified, identity_verified, seller_type
`;

/**
 * Password strength check.
 * Mirrors ResetPassword.jsx getStrength() — score >= 2 (Fair):
 *   ✅ 8+ chars
 *   ✅ uppercase
 *   ✅ number
 */
const isStrongEnough = (pw) => {
  if (!pw || typeof pw !== "string") return false;
  if (pw.length < 8)                 return false;
  if (!/[A-Z]/.test(pw))            return false;
  if (!/[0-9]/.test(pw))            return false;
  return true;
};

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITER
═══════════════════════════════════════════════════════════════ */
const resetLimiter = rateLimit({
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
      message : "Too many reset attempts. Please try again later.",
    }),
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/reset-password
═══════════════════════════════════════════════════════════════ */
router.post("/reset-password", resetLimiter, async (req, res, next) => {
  const { reset_token, password } = req.body;
  const ip                        = getIp(req);

  /* ── 1. Basic presence ── */
  if (!reset_token || !password) {
    return fail(res, 400, "Reset token and new password are required.");
  }

  /* ── 2. Password strength ──
     Mirrors ResetPassword.jsx:
       if (strength.score < 2) → "Password is too weak"
     score 2 = Fair = needs 8+ chars + uppercase + number
  ── */
  if (!isStrongEnough(password)) {
    return fail(res, 400,
      "Password must be at least 8 characters and include " +
      "an uppercase letter and a number."
    );
  }

  /* ── 3. Verify JWT reset_token ──
     Issued in forgotPassword.js → verifyForgotOtp
     Payload: { sub: userId, otp_id, purpose: "password_reset" }
  ── */
  let payload;
  try {
    payload = jwt.verify(reset_token, JWT_SECRET);
  } catch (jwtErr) {
    const isExpired = jwtErr.name === "TokenExpiredError";
    return fail(res, 400,
      isExpired
        ? "Your reset session has expired. Please start over."
        : "Invalid reset token. Please start over.",
      { code: "RESET_TOKEN_INVALID" }
    );
  }

  if (payload.purpose !== "password_reset") {
    return fail(res, 400, "Invalid reset token.", {
      code: "RESET_TOKEN_INVALID",
    });
  }

  const { sub: userId, otp_id } = payload;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── 4. Confirm OTP record is still valid ──
       - verified = true  → step 2 (OTP verify) was completed
       - used     = false → not already consumed by a reset
       - expires_at > NOW() → within 15-minute window
       FOR UPDATE locks the row to prevent race conditions
    ── */
    const { rows: otpRows } = await client.query(
      `SELECT id
       FROM   password_reset_otps
       WHERE  id         = $1
         AND  user_id    = $2
         AND  verified   = true
         AND  used       = false
         AND  expires_at > NOW()
       FOR UPDATE`,
      [otp_id, userId]
    );

    if (!otpRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 400,
        "This reset session is invalid or has already been used. Please start over.",
        { code: "RESET_SESSION_INVALID" }
      );
    }

    /* ── 5. Fetch user ── */
    const { rows: userRows } = await client.query(
      `SELECT ${SAFE_FIELDS}, password_hash
       FROM   users
       WHERE  id = $1
       LIMIT  1`,
      [userId]
    );

    if (!userRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "User not found.");
    }

    const user = userRows[0];

    /* ── 6. Block reuse of same password ── */
    if (user.password_hash) {
      const isSame = await bcrypt.compare(password, user.password_hash);
      if (isSame) {
        await client.query("ROLLBACK");
        return fail(res, 400,
          "New password must be different from your current password."
        );
      }
    }

    /* ── 7. Hash new password ── */
    const newHash = await bcrypt.hash(password, HASH_ROUNDS);

    /* ── 8. Save new password ── */
    await client.query(
      `UPDATE users
       SET    password_hash = $1,
              updated_at    = NOW()
       WHERE  id = $2`,
      [newHash, userId]
    );

    /* ── 9. Mark THIS OTP as used — one-time only ── */
    await client.query(
      `UPDATE password_reset_otps
       SET    used = true
       WHERE  id = $1`,
      [otp_id]
    );

    /* ── 10. Clean up ALL other OTPs for this user ── */
    await client.query(
      `UPDATE password_reset_otps
       SET    used = true
       WHERE  user_id = $1
         AND  used    = false`,
      [userId]
    );

    await client.query("COMMIT");

    /* ── 11. Issue fresh JWT for auto-login ──
       ResetPassword.jsx:
         startLoginCountdown(data.user, data.token)
         → setUser(user, token, navigate, from)
         → logs user in + redirects to "/"
    ── */
    const { password_hash, ...safeUser } = user;

    const token = jwt.sign(
      {
        id    : safeUser.id,
        email : safeUser.email,
        role  : safeUser.role ?? null,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    /* ── 12. Audit log (fire-and-forget) ── */
    writeAudit({
      actorId    : userId,
      action     : "password_reset_completed",
      targetType : "user",
      targetId   : userId,
      ipAddress  : ip,
    }).catch(console.error);

    console.log(`[resetPassword] ✓ complete  user=${userId}  ip=${ip}`);

    /* ── 13. Response ──
       ResetPassword.jsx destructures:
         const { data } = await axios.post(...)
         startLoginCountdown(data.user, data.token)
    ── */
    return res.status(200).json({
      success : true,
      message : "Password reset successfully.",
      token,
      user    : safeUser,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[resetPassword] error:", err.message);
    console.error("[resetPassword] stack:", err.stack);
    next(err);
  } finally {
    client.release();
  }
});

export default router;