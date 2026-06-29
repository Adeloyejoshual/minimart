/**
 * server/controllers/forgotPassword.js
 *
 * Handles OTP-based password reset flow:
 *
 *   POST /api/auth/forgot-password         — send OTP to email
 *   POST /api/auth/forgot-password/verify  — verify OTP → return reset_token
 */

const crypto      = require("crypto");
const bcrypt      = require("bcryptjs");
const { pool }    = require("../config/db");
const { sendPasswordResetOtp } = require("../services/emailService");

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const OTP_LENGTH        = 6;
const OTP_EXPIRY_MINS   = 15;
const MAX_ATTEMPTS      = 5;
const RESEND_COOLDOWN_S = 60;   // seconds between resends
const MAX_RESENDS_DAY   = 5;    // max resends per 24 hours

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

/** Cryptographically secure N-digit OTP */
const generateOtp = (length = OTP_LENGTH) => {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  return String(crypto.randomInt(min, max));
};

/** Never reveal whether email exists — always return same message */
const GENERIC_MSG =
  "If that email is registered, a reset code has been sent.";

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/forgot-password
   Body: { email }
═══════════════════════════════════════════════════════════════ */
const sendForgotOtp = async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();

    /* ── basic validation ── */
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    /* ── look up user (don't reveal if not found) ── */
    const { rows: users } = await pool.query(
      `SELECT id, name, email
       FROM   users
       WHERE  email = $1
       LIMIT  1`,
      [email]
    );

    /* ── if user not found, respond generically and exit ── */
    if (users.length === 0) {
      return res.status(200).json({ message: GENERIC_MSG });
    }

    const user = users[0];

    /* ── check existing OTP record ── */
    const { rows: existing } = await pool.query(
      `SELECT *
       FROM   password_reset_otps
       WHERE  user_id = $1
       ORDER  BY created_at DESC
       LIMIT  1`,
      [user.id]
    );

    const now = new Date();

    if (existing.length > 0) {
      const rec = existing[0];

      /* ── resend cooldown ── */
      const secondsSinceSent =
        (now - new Date(rec.created_at)) / 1000;

      if (secondsSinceSent < RESEND_COOLDOWN_S) {
        const wait = Math.ceil(RESEND_COOLDOWN_S - secondsSinceSent);
        return res.status(429).json({
          message : `Please wait ${wait}s before requesting a new code.`,
          wait,
        });
      }

      /* ── daily resend limit ── */
      const { rows: todayRows } = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM   password_reset_otps
         WHERE  user_id    = $1
           AND  created_at > NOW() - INTERVAL '24 hours'`,
        [user.id]
      );

      const todayCount = parseInt(todayRows[0].cnt, 10);
      if (todayCount >= MAX_RESENDS_DAY) {
        return res.status(429).json({
          message : "Daily reset limit reached. Please try again tomorrow.",
          code    : "DAILY_LIMIT",
        });
      }
    }

    /* ── generate OTP + hashed version ── */
    const otp       = generateOtp();
    const otpHash   = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(
      now.getTime() + OTP_EXPIRY_MINS * 60 * 1000
    );

    /* ── invalidate all previous OTPs for this user ── */
    await pool.query(
      `UPDATE password_reset_otps
       SET    used = TRUE
       WHERE  user_id = $1
         AND  used   = FALSE`,
      [user.id]
    );

    /* ── store new OTP ── */
    await pool.query(
      `INSERT INTO password_reset_otps
         (user_id, otp_hash, expires_at, attempts, used)
       VALUES
         ($1, $2, $3, 0, FALSE)`,
      [user.id, otpHash, expiresAt]
    );

    /* ── send email ── */
    let emailSent = true;
    try {
      await sendPasswordResetOtp({
        to   : user.email,
        name : user.name,
        otp,
      });
    } catch (mailErr) {
      console.error("[ForgotPassword] Email send failed:", mailErr.message);
      emailSent = false;
    }

    /* ── response ── */
    const response = { message: GENERIC_MSG };

    /* Dev mode: return OTP in response if email failed */
    if (!emailSent || process.env.NODE_ENV === "development") {
      response.dev_otp = otp;
    }

    return res.status(200).json(response);

  } catch (err) {
    console.error("[ForgotPassword] sendForgotOtp error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/forgot-password/verify
   Body: { email, otp }
═══════════════════════════════════════════════════════════════ */
const verifyForgotOtp = async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const otp   = (req.body.otp   || "").trim();

    /* ── validation ── */
    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and code are required.",
      });
    }
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: "Code must be exactly 6 digits.",
      });
    }

    /* ── look up user ── */
    const { rows: users } = await pool.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const userId = users[0].id;

    /* ── get latest unused OTP ── */
    const { rows: otpRows } = await pool.query(
      `SELECT *
       FROM   password_reset_otps
       WHERE  user_id = $1
         AND  used    = FALSE
       ORDER  BY created_at DESC
       LIMIT  1`,
      [userId]
    );

    if (otpRows.length === 0) {
      return res.status(400).json({
        message: "No active reset code found. Please request a new one.",
      });
    }

    const record = otpRows[0];

    /* ── check expiry ── */
    if (new Date() > new Date(record.expires_at)) {
      await pool.query(
        `UPDATE password_reset_otps SET used = TRUE WHERE id = $1`,
        [record.id]
      );
      return res.status(400).json({
        message : "Reset code has expired. Please request a new one.",
        code    : "OTP_EXPIRED",
      });
    }

    /* ── check attempt count ── */
    if (record.attempts >= MAX_ATTEMPTS) {
      await pool.query(
        `UPDATE password_reset_otps SET used = TRUE WHERE id = $1`,
        [record.id]
      );
      return res.status(429).json({
        message : "Too many incorrect attempts. Please request a new code.",
        code    : "OTP_LOCKED",
      });
    }

    /* ── verify OTP hash ── */
    const isMatch = await bcrypt.compare(otp, record.otp_hash);

    if (!isMatch) {
      /* increment attempts */
      await pool.query(
        `UPDATE password_reset_otps
         SET    attempts = attempts + 1
         WHERE  id = $1`,
        [record.id]
      );

      const attemptsLeft = MAX_ATTEMPTS - (record.attempts + 1);

      /* lock if out of attempts */
      if (attemptsLeft <= 0) {
        await pool.query(
          `UPDATE password_reset_otps SET used = TRUE WHERE id = $1`,
          [record.id]
        );
        return res.status(429).json({
          message      : "Too many incorrect attempts. Please request a new code.",
          code         : "OTP_LOCKED",
          attemptsLeft : 0,
        });
      }

      return res.status(400).json({
        message : "Incorrect code. Please try again.",
        attemptsLeft,
      });
    }

    /* ── OTP is correct — generate secure reset token ── */
    const resetToken       = crypto.randomBytes(32).toString("hex");
    const resetTokenHash   = await bcrypt.hash(resetToken, 10);
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    /* ── mark OTP as used ── */
    await pool.query(
      `UPDATE password_reset_otps SET used = TRUE WHERE id = $1`,
      [record.id]
    );

    /* ── store reset token ── */
    await pool.query(
      `INSERT INTO password_reset_tokens
         (user_id, token_hash, expires_at, used)
       VALUES
         ($1, $2, $3, FALSE)`,
      [userId, resetTokenHash, resetTokenExpiry]
    );

    return res.status(200).json({
      message     : "Code verified. You may now reset your password.",
      reset_token : resetToken,
    });

  } catch (err) {
    console.error("[ForgotPassword] verifyForgotOtp error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

module.exports = { sendForgotOtp, verifyForgotOtp };