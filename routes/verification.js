import express              from "express";
import bcrypt               from "bcrypt";
import crypto               from "crypto";
import rateLimit            from "express-rate-limit";
import { pool } from "../config/db.js";
import { authMiddleware }   from "../middleware/auth.js";
import { sendVerificationEmail } from "../services/email.js";
import { getCapabilities, computeTrustScore } from "../lib/permissions.js";
import { writeAudit }       from "../lib/audit.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════════════════════
   OTP POLICY — single config, change here only
══════════════════════════════════════════════════════════════════════════════ */
const OTP_POLICY = {
  DAILY_RESEND_LIMIT      : 2,     // max sends per user per day
  RESEND_COOLDOWN_SECONDS : 60,    // seconds between sends
  OTP_EXPIRY_MINUTES      : 10,    // OTP validity window
  MAX_VERIFY_ATTEMPTS     : 5,     // attempts before OTP is blocked
};

/* ══════════════════════════════════════════════════════════════════════════════
   RATE LIMITERS — IP-level, express layer
   DB-level daily limit enforced separately in handler
══════════════════════════════════════════════════════════════════════════════ */
const sendOtpLimiter = rateLimit({
  windowMs     : 10 * 60 * 1000,
  max          : 10,                // generous — DB layer enforces real limit
  keyGenerator : (req) => req.user?.id || req.ip,
  handler      : (_req, res) => res.status(429).json({
    success    : false,
    message    : "Too many requests. Try again later.",
    retryAfter : 600,
  }),
});

const verifyOtpLimiter = rateLimit({
  windowMs     : 15 * 60 * 1000,
  max          : 10,
  keyGenerator : (req) => req.user?.id || req.ip,
  handler      : (_req, res) => res.status(429).json({
    success : false,
    message : "Too many attempts. Try again in 15 minutes.",
  }),
});

/* ══════════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════════ */
const generateOTP   = () => crypto.randomInt(100_000, 999_999).toString();
const getIp         = (req) => req.ip || req.socket?.remoteAddress || null;
const maskEmail     = (email) => email.replace(/(.{2}).*(@.*)/, "$1***$2");
const getDeviceHash = (req) => {
  const raw = [
    req.headers["user-agent"]      || "",
    req.headers["accept-language"] || "",
    req.headers["sec-ch-ua"]       || "",
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
};

// Today's date key — resets at midnight UTC
const getTodayKey = () => new Date().toISOString().slice(0, 10); // "2024-01-15"

const flagAccount = async (client, userId, reason, ip) => {
  await client.query(`
    UPDATE users
    SET
      status        = 'flagged',
      total_reports = total_reports + 1,
      updated_at    = NOW()
    WHERE id = $1
  `, [userId]);

  await writeAudit({
    actorId    : userId,
    action     : "user_flagged",
    targetType : "user",
    targetId   : userId,
    metadata   : { reason },
    ipAddress  : ip,
  });
};

/* ══════════════════════════════════════════════════════════════════════════════
   DAILY RESEND COUNTER — stored in DB (no Redis dependency)
   Uses email_verifications table with a daily_send_count column
   OR a separate lightweight otp_send_log table
══════════════════════════════════════════════════════════════════════════════ */

// Get how many OTPs this user has sent today
const getDailySendCount = async (client, userId) => {
  const today = getTodayKey();

  const { rows } = await client.query(`
    SELECT COUNT(*) AS count
    FROM email_verifications
    WHERE user_id    = $1
      AND created_at >= $2::date
      AND created_at <  $2::date + INTERVAL '1 day'
  `, [userId, today]);

  return parseInt(rows[0].count, 10);
};

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/verification/send-email-otp
══════════════════════════════════════════════════════════════════════════════ */
router.post("/send-email-otp", authMiddleware, sendOtpLimiter, async (req, res) => {
  const userId = req.user.id;
  const ip     = getIp(req);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── 1. Fetch user ─────────────────────────────────────────────────────
    const { rows: users } = await client.query(`
      SELECT id, email, name, email_verified, status
      FROM users
      WHERE id = $1
    `, [userId]);

    const user = users[0];
    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ── 2. Already verified — generic response ────────────────────────────
    if (user.email_verified) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success : false,
        message : "Email already verified.",
      });
    }

    // ── 3. DAILY RESEND LIMIT — real enforcement, not UI-only ────────────
    const dailyCount = await getDailySendCount(client, userId);

    if (dailyCount >= OTP_POLICY.DAILY_RESEND_LIMIT) {
      await client.query("ROLLBACK");

      await writeAudit({
        actorId    : userId,
        action     : "otp_daily_limit_reached",
        targetType : "user",
        targetId   : userId,
        metadata   : { dailyCount, limit: OTP_POLICY.DAILY_RESEND_LIMIT },
        ipAddress  : ip,
      });

      return res.status(429).json({
        success   : false,
        message   : `Daily limit reached (${OTP_POLICY.DAILY_RESEND_LIMIT}/day). Try again tomorrow.`,
        remaining : 0,
        resetAt   : "midnight UTC",
      });
    }

    // ── 4. Cooldown check — 60 seconds between sends ──────────────────────
    const { rows: recent } = await client.query(`
      SELECT created_at
      FROM email_verifications
      WHERE user_id    = $1
        AND created_at > NOW() - INTERVAL '${OTP_POLICY.RESEND_COOLDOWN_SECONDS} seconds'
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    if (recent.length > 0) {
      const elapsed  = (Date.now() - new Date(recent[0].created_at)) / 1000;
      const waitSecs = Math.ceil(OTP_POLICY.RESEND_COOLDOWN_SECONDS - elapsed);
      await client.query("ROLLBACK");

      return res.status(429).json({
        success    : false,
        message    : `Wait ${waitSecs}s before requesting another code.`,
        retryAfter : waitSecs,
        remaining  : OTP_POLICY.DAILY_RESEND_LIMIT - dailyCount,
      });
    }

    // ── 5. Abuse check — too many in 10 min → flag ────────────────────────
    const { rows: abuse } = await client.query(`
      SELECT COUNT(*) AS count
      FROM email_verifications
      WHERE user_id    = $1
        AND created_at > NOW() - INTERVAL '10 minutes'
    `, [userId]);

    if (parseInt(abuse[0].count, 10) >= 5) {
      await flagAccount(client, userId, "otp_abuse", ip);
      await client.query("COMMIT");

      return res.status(429).json({
        success : false,
        message : "Too many requests. Account flagged for review.",
      });
    }

    // ── 6. Invalidate previous active OTPs ────────────────────────────────
    await client.query(`
      UPDATE email_verifications
      SET status  = 'expired',
          used_at = NOW()
      WHERE user_id = $1
        AND status  = 'active'
    `, [userId]);

    // ── 7. Generate + hash OTP ────────────────────────────────────────────
    const otp        = generateOTP();
    const otpHash    = await bcrypt.hash(otp, 10);
    const deviceHash = getDeviceHash(req);

    await client.query(`
      INSERT INTO email_verifications
        (user_id, otp_hash, expires_at, status, device_hash)
      VALUES ($1, $2, NOW() + INTERVAL '${OTP_POLICY.OTP_EXPIRY_MINUTES} minutes', 'active', $3)
    `, [userId, otpHash, deviceHash]);

    // ── 8. Track device ───────────────────────────────────────────────────
    await client.query(`
      INSERT INTO user_devices
        (user_id, device_hash, ip_address, user_agent, last_seen)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, device_hash)
      DO UPDATE SET
        last_seen  = NOW(),
        ip_address = EXCLUDED.ip_address
    `, [userId, deviceHash, ip, req.headers["user-agent"] || null]);

    await client.query("COMMIT");

    // ── 9. Send email — AFTER commit ──────────────────────────────────────
    try {
      await sendVerificationEmail({ to: user.email, name: user.name, otp });
    } catch (mailErr) {
      console.error("[email-send-failed]", mailErr.message);

      // Best-effort cleanup
      await pool.query(`
        UPDATE email_verifications
        SET status  = 'expired',
            used_at = NOW()
        WHERE user_id    = $1
          AND status     = 'active'
          AND created_at > NOW() - INTERVAL '1 minute'
      `, [userId]);

      return res.status(500).json({
        success : false,
        message : "Failed to send verification email. Please try again.",
      });
    }

    // ── 10. Audit ─────────────────────────────────────────────────────────
    await writeAudit({
      actorId    : userId,
      action     : "otp_sent",
      targetType : "user",
      targetId   : userId,
      metadata   : {
        method     : "email",
        dailyCount : dailyCount + 1,
        remaining  : OTP_POLICY.DAILY_RESEND_LIMIT - (dailyCount + 1),
      },
      ipAddress : ip,
    });

    // ── 11. Response — includes remaining for frontend display ────────────
    return res.json({
      success   : true,
      message   : "Verification code sent.",
      email     : maskEmail(user.email),
      expiresIn : OTP_POLICY.OTP_EXPIRY_MINUTES * 60,
      remaining : OTP_POLICY.DAILY_RESEND_LIMIT - (dailyCount + 1), // frontend display only
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[send-email-otp]", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to send verification code.",
    });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/verification/verify-email-otp
══════════════════════════════════════════════════════════════════════════════ */
router.post("/verify-email-otp", authMiddleware, verifyOtpLimiter, async (req, res) => {
  const { otp } = req.body;
  const userId  = req.user.id;
  const ip      = getIp(req);
  const deviceHash = getDeviceHash(req);

  if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
    return res.status(400).json({
      success : false,
      message : "OTP must be exactly 6 digits.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Fetch valid OTP ───────────────────────────────────────────────────
    const { rows } = await client.query(`
      SELECT id, otp_hash, attempts, device_hash
      FROM email_verifications
      WHERE user_id    = $1
        AND status     = 'active'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success : false,
        message : "Code expired or not found. Request a new one.",
      });
    }

    const record = rows[0];

    // ── Device mismatch — audit only, do not block ────────────────────────
    if (record.device_hash && record.device_hash !== deviceHash) {
      await writeAudit({
        actorId    : userId,
        action     : "otp_device_mismatch",
        targetType : "user",
        targetId   : userId,
        metadata   : { stored: record.device_hash, received: deviceHash },
        ipAddress  : ip,
      });
    }

    // ── Max attempts ──────────────────────────────────────────────────────
    if (record.attempts >= OTP_POLICY.MAX_VERIFY_ATTEMPTS) {
      await client.query(`
        UPDATE email_verifications SET status = 'blocked' WHERE id = $1
      `, [record.id]);
      await flagAccount(client, userId, "otp_max_attempts", ip);
      await client.query("COMMIT");

      return res.status(400).json({
        success : false,
        message : "Too many failed attempts. Request a new code.",
      });
    }

    // ── Compare ───────────────────────────────────────────────────────────
    const isValid = await bcrypt.compare(String(otp).trim(), record.otp_hash);

    if (!isValid) {
      await client.query(`
        UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1
      `, [record.id]);
      await client.query("COMMIT");

      const attemptsLeft = Math.max(0, OTP_POLICY.MAX_VERIFY_ATTEMPTS - 1 - record.attempts);

      await writeAudit({
        actorId    : userId,
        action     : "otp_failed",
        targetType : "user",
        targetId   : userId,
        metadata   : { attemptsLeft },
        ipAddress  : ip,
      });

      return res.status(400).json({
        success      : false,
        message      : "Incorrect code.",
        attemptsLeft,
      });
    }

    // ── Atomic mark used — prevents race condition ────────────────────────
    const { rows: marked } = await client.query(`
      UPDATE email_verifications
      SET status  = 'used',
          used_at = NOW()
      WHERE id     = $1
        AND status = 'active'
      RETURNING id
    `, [record.id]);

    if (!marked.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success : false,
        message : "Code already used. Request a new one.",
      });
    }

    // ── Update user ───────────────────────────────────────────────────────
    const { rows: updatedUsers } = await client.query(`
      UPDATE users
      SET
        email_verified    = true,
        email_verified_at = NOW(),
        verified          = true,
        updated_at        = NOW()
      WHERE id = $1
      RETURNING
        id, role, seller_type, status,
        email_verified, store_verified,
        trust_score, created_at
    `, [userId]);

    const updatedUser = updatedUsers[0];
    const newScore    = computeTrustScore({ ...updatedUser, email_verified: true });

    await client.query(
      "UPDATE users SET trust_score = $1 WHERE id = $2",
      [newScore, userId]
    );

    await client.query("COMMIT");

    await writeAudit({
      actorId    : userId,
      action     : "email_verified",
      targetType : "user",
      targetId   : userId,
      metadata   : { trust_score: newScore },
      ipAddress  : ip,
    });

    const caps = getCapabilities({ ...updatedUser, email_verified: true, trust_score: newScore });

    return res.json({
      success     : true,
      message     : "Email verified.",
      trust_score : newScore,
      permissions : caps.toJSON(),
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[verify-email-otp]", err.message);
    return res.status(500).json({
      success : false,
      message : "Verification failed. Please try again.",
    });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════════════════════
   GET /api/verification/status
══════════════════════════════════════════════════════════════════════════════ */
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id, email, name, role, seller_type,
        status, rating, email_verified,
        email_verified_at, store_verified,
        trust_score, created_at
      FROM users
      WHERE id = $1
    `, [req.user.id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = rows[0];

    // Daily send count — for frontend display hint
    const dailyCount = await getDailySendCount(pool, req.user.id);

    const { rows: storeRows } = await pool.query(`
      SELECT status, message, reviewed_by, updated_at
      FROM store_verifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [req.user.id]);

    const caps = getCapabilities(user);

    return res.json({
      email             : maskEmail(user.email),
      name              : user.name,
      role              : user.role,
      seller_type       : user.seller_type,
      status            : user.status,
      rating            : user.rating,
      email_verified    : user.email_verified,
      email_verified_at : user.email_verified_at,
      store_verified    : user.store_verified,
      store_review      : storeRows[0] || null,
      trust_score       : user.trust_score,
      permissions       : caps.toJSON(),

      // Resend budget — display only, backend enforces the real limit
      resend_remaining  : Math.max(0, OTP_POLICY.DAILY_RESEND_LIMIT - dailyCount),
      resend_limit      : OTP_POLICY.DAILY_RESEND_LIMIT,
    });

  } catch (err) {
    console.error("[verification/status]", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch status" });
  }
});

export default router;