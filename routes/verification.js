// ════════════════════════════════════════════════════════════
// FILE: routes/verification.js — v9
// CRDB SAFE: All time calculations done in JS, not SQL
// ════════════════════════════════════════════════════════════
import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import rateLimit from "express-rate-limit";

import { pool } from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";
import { sendVerificationEmail, sendWelcomeEmail } from "../services/email.js";
import { reactivateLimitedListings } from "./addproduct.js";

const router = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

const POLICY = Object.freeze({
  DAILY_SEND_LIMIT: IS_PROD ? 3 : 50,
  RESEND_COOLDOWN_SECS: IS_PROD ? 60 : 10, // reduced for testing
  OTP_EXPIRY_MINUTES: 10,
  MAX_VERIFY_ATTEMPTS: IS_PROD ? 5 : 10,
  ABUSE_WINDOW_MINUTES: 10,
  ABUSE_THRESHOLD: IS_PROD ? 5 : 40,
  BCRYPT_ROUNDS: 10,
});

const generateOtp = () => crypto.randomInt(100_000, 999_999).toString();
const getIp = (req) => req.ip ?? req.socket?.remoteAddress ?? null;
const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });
const getTodayUTC = () => new Date().toISOString().slice(0, 10);
const maskEmail = (e) => String(e).replace(/(.{2})(.*)(@.*)/, (_, a, _b, c) => `${a}***${c}`);

const makeLimiter = ({ windowMin, max, message }) => rateLimit({
  windowMs: windowMin * 60_000, max, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id ?? req.ip),
  handler: (_req, res) => res.status(429).json({ success: false, message }),
});

const sendOtpLimiter = makeLimiter({ windowMin: 10, max: 50, message: "Too many send requests." });
const verifyOtpLimiter = makeLimiter({ windowMin: 15, max: 50, message: "Too many verify attempts." });

// ── DAILY COUNT (safe: literal interval) ──
const getDailySendCount = async (db, userId) => {
  const today = getTodayUTC();
  const { rows } = await db.query(
    `SELECT COUNT(*) AS cnt FROM email_verifications
     WHERE user_id = $1 AND created_at >= $2::date AND created_at < ($2::date + INTERVAL '1 day')`,
    [userId, today]
  );
  return parseInt(rows[0].cnt, 10);
};

/* ═══════════════════════════════════════════════════════════
   POST /send-email-otp  — FIXED
═══════════════════════════════════════════════════════════ */
router.post("/send-email-otp", authenticate, sendOtpLimiter, async (req, res) => {
  const userId = req.user?.id;
  const ip = getIp(req);
  if (!userId) return fail(res, 401, "Not authenticated.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: users } = await client.query("SELECT id, email, name, email_verified, status FROM users WHERE id = $1", [userId]);
    if (!users.length) { await client.query("ROLLBACK"); return fail(res, 404, "User not found."); }
    const user = users[0];
    if (user.email_verified) { await client.query("ROLLBACK"); return fail(res, 400, "Email already verified."); }

    const dailyCount = await getDailySendCount(client, userId);
    if (dailyCount >= POLICY.DAILY_SEND_LIMIT) {
      await client.query("ROLLBACK");
      return fail(res, 429, `Daily limit reached (${POLICY.DAILY_SEND_LIMIT}/day)`, { remaining: 0 });
    }

    // ✅ JS DATE MATH — CRDB SAFE
    const cooldownCutoff = new Date(Date.now() - POLICY.RESEND_COOLDOWN_SECS * 1000);
    const abuseCutoff = new Date(Date.now() - POLICY.ABUSE_WINDOW_MINUTES * 60 * 1000);
    const expiresAt = new Date(Date.now() + POLICY.OTP_EXPIRY_MINUTES * 60 * 1000);

    const { rows: recent } = await client.query(
      `SELECT created_at FROM email_verifications WHERE user_id = $1 AND created_at > $2 ORDER BY created_at DESC LIMIT 1`,
      [userId, cooldownCutoff]
    );
    if (recent.length) {
      const wait = Math.ceil(POLICY.RESEND_COOLDOWN_SECS - (Date.now() - new Date(recent[0].created_at).getTime()) / 1000);
      await client.query("ROLLBACK");
      return fail(res, 429, `Wait ${wait}s before requesting another code.`, { retryAfter: wait, remaining: POLICY.DAILY_SEND_LIMIT - dailyCount });
    }

    const { rows: abr } = await client.query(
      `SELECT COUNT(*) AS cnt FROM email_verifications WHERE user_id = $1 AND created_at > $2`,
      [userId, abuseCutoff]
    );
    if (parseInt(abr[0].cnt, 10) >= POLICY.ABUSE_THRESHOLD) {
      await client.query("COMMIT");
      return fail(res, 429, "Too many requests. Try later.");
    }

    await client.query(`UPDATE email_verifications SET status='expired', used_at=NOW() WHERE user_id=$1 AND status='active'`, [userId]);

    const otp = generateOtp();
    const hash = await bcrypt.hash(otp, POLICY.BCRYPT_ROUNDS);

    await client.query(
      `INSERT INTO email_verifications (user_id, otp_hash, expires_at, status, ip_address)
       VALUES ($1, $2, $3, 'active', $4)`,
      [userId, hash, expiresAt, ip]
    );
    await client.query("COMMIT");

    try {
      await sendVerificationEmail({ to: user.email, name: user.name, otp });
    } catch (mailErr) {
      return fail(res, 500, `Email delivery failed: ${mailErr.message}`, { mail_error: true });
    }

    return res.json({
      success: true,
      message: "Verification code sent.",
      email: maskEmail(user.email),
      expiresIn: POLICY.OTP_EXPIRY_MINUTES * 60,
      remaining: POLICY.DAILY_SEND_LIMIT - dailyCount - 1,
      dev_otp: IS_PROD ? undefined : otp, // shows in dev
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[send-otp] ERROR:", err);
    return fail(res, 500, "Server error while sending OTP", { error: err.message, stack: IS_PROD ? undefined : err.stack });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════
   POST /verify-email-otp — UNCHANGED LOGIC, BETTER ERRORS
═══════════════════════════════════════════════════════════ */
router.post("/verify-email-otp", authenticate, verifyOtpLimiter, async (req, res) => {
  const rawOtp = String(req.body?.otp ?? "").trim();
  const userId = req.user?.id;
  if (!/^\d{6}$/.test(rawOtp)) return fail(res, 400, "OTP must be 6 digits.", { code: "INVALID_FORMAT" });

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, otp_hash, attempts FROM email_verifications 
       WHERE user_id=$1 AND status='active' AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`, [userId]
    );
    if (!rows.length) return fail(res, 400, "Code expired or not found.", { code: "EXPIRED" });

    const rec = rows[0];
    const valid = await bcrypt.compare(rawOtp, rec.otp_hash);
    if (!valid) {
      await client.query("UPDATE email_verifications SET attempts = attempts + 1 WHERE id=$1", [rec.id]);
      return fail(res, 400, "Incorrect code.", { attemptsLeft: POLICY.MAX_VERIFY_ATTEMPTS - rec.attempts - 1, code: "WRONG_OTP" });
    }

    await client.query("BEGIN");
    await client.query("UPDATE email_verifications SET status='used', used_at=NOW() WHERE id=$1", [rec.id]);
    await client.query("UPDATE users SET email_verified=TRUE, email_verified_at=NOW(), verified=TRUE WHERE id=$1", [userId]);
    await client.query("COMMIT");

    reactivateLimitedListings(userId).catch(()=>{});
    sendWelcomeEmail({ to: req.user.email, name: req.user.name }).catch(()=>{});

    return res.json({ success: true, message: "Email verified." });
  } catch (err) {
    await client.query("ROLLBACK").catch(()=>{});
    console.error("[verify-otp]", err);
    return fail(res, 500, "Verification failed", { error: err.message });
  } finally {
    client.release();
  }
});

export default router;