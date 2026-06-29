/**
 * server/controllers/resetPassword.js
 *
 * Handles the final step of password reset:
 *
 *   POST /api/auth/reset-password
 *   Body: { reset_token, password }
 *
 * On success:
 *   - New password is hashed and saved
 *   - Reset token is invalidated
 *   - All other reset tokens for user are cleared
 *   - Fresh JWT is returned for auto-login
 */

const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const { pool } = require("../config/db");

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const SALT_ROUNDS    = 12;

/* ═══════════════════════════════════════════════════════════════
   PASSWORD STRENGTH CHECK
   Mirror of frontend logic — always validate server-side too
═══════════════════════════════════════════════════════════════ */
const isStrongPassword = (pw) => {
  if (!pw || typeof pw !== "string") return false;
  if (pw.length < 8)                 return false;
  if (!/[A-Z]/.test(pw))            return false;
  if (!/[0-9]/.test(pw))            return false;
  if (!/[^A-Za-z0-9]/.test(pw))    return false;
  return true;
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/reset-password
   Body: { reset_token, password }
═══════════════════════════════════════════════════════════════ */
const resetPassword = async (req, res) => {
  try {
    const { reset_token, password } = req.body;

    /* ── basic validation ── */
    if (!reset_token || !password) {
      return res.status(400).json({
        message: "Reset token and new password are required.",
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include " +
          "an uppercase letter, a number, and a symbol.",
      });
    }

    /* ── find all valid (unused, unexpired) reset tokens ── */
    const { rows: tokenRows } = await pool.query(
      `SELECT *
       FROM   password_reset_tokens
       WHERE  used       = FALSE
         AND  expires_at > NOW()
       ORDER  BY created_at DESC`,
      []
    );

    if (tokenRows.length === 0) {
      return res.status(400).json({
        message : "Reset link has expired or already been used. Please start over.",
        code    : "TOKEN_INVALID",
      });
    }

    /* ── find the matching token by bcrypt compare ──
       We loop because we store only hashes.
       In practice there is at most 1–2 rows per user. ── */
    let matchedToken = null;

    for (const row of tokenRows) {
      const isMatch = await bcrypt.compare(reset_token, row.token_hash);
      if (isMatch) {
        matchedToken = row;
        break;
      }
    }

    if (!matchedToken) {
      return res.status(400).json({
        message : "Invalid reset token. Please start over.",
        code    : "TOKEN_INVALID",
      });
    }

    const userId = matchedToken.user_id;

    /* ── fetch user ── */
    const { rows: users } = await pool.query(
      `SELECT id, name, email, role, is_verified
       FROM   users
       WHERE  id = $1
       LIMIT  1`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = users[0];

    /* ── prevent reuse of same password ── */
    const isSamePassword = await bcrypt.compare(password, user.password_hash ?? "");
    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from your current password.",
      });
    }

    /* ── hash new password ── */
    const newHash = await bcrypt.hash(password, SALT_ROUNDS);

    /* ── update password in DB ── */
    await pool.query(
      `UPDATE users
       SET    password_hash = $1,
              updated_at    = NOW()
       WHERE  id = $2`,
      [newHash, userId]
    );

    /* ── invalidate ALL reset tokens for this user ── */
    await pool.query(
      `UPDATE password_reset_tokens
       SET    used = TRUE
       WHERE  user_id = $1`,
      [userId]
    );

    /* ── invalidate ALL OTPs for this user too ── */
    await pool.query(
      `UPDATE password_reset_otps
       SET    used = TRUE
       WHERE  user_id = $1`,
      [userId]
    );

    /* ── generate fresh JWT for auto-login ── */
    const token = jwt.sign(
      {
        id    : user.id,
        email : user.email,
        role  : user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    /* ── optional: log password reset event ── */
    try {
      await pool.query(
        `INSERT INTO security_logs
           (user_id, event, ip_address, created_at)
         VALUES
           ($1, 'password_reset', $2, NOW())`,
        [userId, req.ip || null]
      );
    } catch {
      // Non-critical — don't fail the request
    }

    return res.status(200).json({
      message : "Password reset successfully.",
      token,
      user    : {
        id          : user.id,
        name        : user.name,
        email       : user.email,
        role        : user.role,
        is_verified : user.is_verified,
      },
    });

  } catch (err) {
    console.error("[ResetPassword] error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

module.exports = { resetPassword };