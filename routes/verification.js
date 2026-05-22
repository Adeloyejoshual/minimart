import express                   from "express";
import bcrypt                    from "bcrypt";
import crypto                    from "crypto";
import rateLimit                 from "express-rate-limit";
import { pool }                  from "../config/db.js";
import { authenticate }          from "../middleware/auth.js";
import { sendVerificationEmail } from "../services/email.js";
import { getCapabilities, computeTrustScore } from "../lib/permissions.js";
import { writeAudit }            from "../lib/audit.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════════════════════
   OTP POLICY
══════════════════════════════════════════════════════════════════════════════ */
const OTP_POLICY = {
  DAILY_SEND_LIMIT        : 2,
  RESEND_COOLDOWN_SECONDS : 60,
  OTP_EXPIRY_MINUTES      : 10,
  MAX_VERIFY_ATTEMPTS     : 5,
  ABUSE_WINDOW_MINUTES    : 10,
  ABUSE_THRESHOLD         : 5,
};

/* ══════════════════════════════════════════════════════════════════════════════
   RATE LIMITERS
══════════════════════════════════════════════════════════════════════════════ */
const sendOtpLimiter = rateLimit({
  windowMs     : OTP_POLICY.ABUSE_WINDOW_MINUTES * 60 * 1000,
  max          : 10,
  keyGenerator : (req) => req.user?.id || req.ip,
  handler      : (_req, res) => res.status(429).json({
    success    : false,
    message    : "Too many requests. Try again later.",
    retryAfter : OTP_POLICY.ABUSE_WINDOW_MINUTES * 60,
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
const getTodayUTC   = () => new Date().toISOString().slice(0, 10);

const getDeviceHash = (req) => {
  const raw = [
    req.headers["user-agent"]      || "",
    req.headers["accept-language"] || "",
    req.headers["sec-ch-ua"]       || "",
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
};

const getDailySendCount = async (clientOrPool, userId) => {
  const today = getTodayUTC();
  const { rows } = await clientOrPool.query(`
    SELECT COUNT(*) AS count
    FROM email_verifications
    WHERE user_id    = $1
      AND created_at >= $2::date
      AND created_at <  $2::date + INTERVAL '1 day'
  `, [userId, today]);
  return parseInt(rows[0].count, 10);
};

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
   POST /api/verification/send-email-otp
══════════════════════════════════════════════════════════════════════════════ */
router.post(
  "/send-email-otp",
  authenticate,        // ← authenticate (not authMiddleware)
  sendOtpLimiter,
  async (req, res) => {
    const userId = req.user.id;
    const ip     = getIp(req);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // ── 1. Fetch user ────────────────────────────────────────────────────
      const { rows: users } = await client.query(`
        SELECT id, email, name, email_verified, status
        FROM users
        WHERE id = $1
      `, [userId]);

      const user = users[0];

      if (!user) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "User not found." });
      }

      // ── 2. Already verified ──────────────────────────────────────────────
      if (user.email_verified) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success : false,
          message : "Email already verified.",
        });
      }

      // ── 3. Daily send limit ──────────────────────────────────────────────
      const dailyCount = await getDailySendCount(client, userId);

      if (dailyCount >= OTP_POLICY.DAILY_SEND_LIMIT) {
        await client.query("ROLLBACK");

        await writeAudit({
          actorId    : userId,
          action     : "otp_daily_limit_reached",
          targetType : "user",
          targetId   : userId,
          metadata   : { dailyCount, limit: OTP_POLICY.DAILY_SEND_LIMIT },
          ipAddress  : ip,
        });

        return res.status(429).json({
          success   : false,
          message   : `Daily limit reached (${OTP_POLICY.DAILY_SEND_LIMIT}/day). Try again tomorrow.`,
          remaining : 0,
          resetAt   : "midnight UTC",
        });
      }

      // ── 4. Cooldown ──────────────────────────────────────────────────────
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
          remaining  : OTP_POLICY.DAILY_SEND_LIMIT - dailyCount,
        });
      }

      // ── 5. Abuse detection ───────────────────────────────────────────────
      const { rows: abuse } = await client.query(`
        SELECT COUNT(*) AS count
        FROM email_verifications
        WHERE user_id    = $1
          AND created_at > NOW() - INTERVAL '${OTP_POLICY.ABUSE_WINDOW_MINUTES} minutes'
      `, [userId]);

      if (parseInt(abuse[0].count, 10) >= OTP_POLICY.ABUSE_THRESHOLD) {
        await flagAccount(client, userId, "otp_abuse", ip);
        await client.query("COMMIT");
        return res.status(429).json({
          success : false,
          message : "Too many requests. Account flagged for review.",
        });
      }

      // ── 6. Invalidate old OTPs ───────────────────────────────────────────
      await client.query(`
        UPDATE email_verifications
        SET status  = 'expired',
            used_at = NOW()
        WHERE user_id = $1
          AND status  = 'active'
      `, [userId]);

      // ── 7. Generate + store OTP ──────────────────────────────────────────
      const otp        = generateOTP();
      const otpHash    = await bcrypt.hash(otp, 10);
      const deviceHash = getDeviceHash(req);

      await client.query(`
        INSERT INTO email_verifications
          (user_id, otp_hash, expires_at, status, device_hash)
        VALUES (
          $1, $2,
          NOW() + INTERVAL '${OTP_POLICY.OTP_EXPIRY_MINUTES} minutes',
          'active',
          $3
        )
      `, [userId, otpHash, deviceHash]);

      // ── 8. Track device ──────────────────────────────────────────────────
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

      // ── 9. Send email — after commit ─────────────────────────────────────
      try {
        await sendVerificationEmail({ to: user.email, name: user.name, otp });
      } catch (mailErr) {
        console.error("[email-send-failed]", mailErr.message);

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

      // ── 10. Audit ────────────────────────────────────────────────────────
      const newDailyCount = dailyCount + 1;
      const remaining     = OTP_POLICY.DAILY_SEND_LIMIT - newDailyCount;

      await writeAudit({
        actorId    : userId,
        action     : "otp_sent",
        targetType : "user",
        targetId   : userId,
        metadata   : { method: "email", dailyCount: newDailyCount, remaining },
        ipAddress  : ip,
      });

      return res.json({
        success   : true,
        message   : "Verification code sent.",
        email     : maskEmail(user.email),
        expiresIn : OTP_POLICY.OTP_EXPIRY_MINUTES * 60,
        remaining,
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
  }
);

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/verification/verify-email-otp
══════════════════════════════════════════════════════════════════════════════ */
router.post(
  "/verify-email-otp",
  authenticate,        // ← authenticate (not authMiddleware)
  verifyOtpLimiter,
  async (req, res) => {
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

      // ── 1. Fetch valid OTP ───────────────────────────────────────────────
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

      // ── 2. Device mismatch — audit only ─────────────────────────────────
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

      // ── 3. Max attempts ──────────────────────────────────────────────────
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

      // ── 4. Compare OTP ───────────────────────────────────────────────────
      const isValid = await bcrypt.compare(String(otp).trim(), record.otp_hash);

      if (!isValid) {
        await client.query(`
          UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1
        `, [record.id]);

        await client.query("COMMIT");

        const attemptsLeft = Math.max(
          0,
          OTP_POLICY.MAX_VERIFY_ATTEMPTS - 1 - record.attempts
        );

        await writeAudit({
          actorId    : userId,
          action     : "otp_failed",
          targetType : "user",
          targetId   : userId,
          metadata   : { attemptsLeft },
          ipAddress  : ip,
        });

        return res.status(400).json({
          success : false,
          message : "Incorrect code.",
          attemptsLeft,
        });
      }

      // ── 5. Atomic mark used ──────────────────────────────────────────────
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

      // ── 6. Update user ───────────────────────────────────────────────────
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

      // ── 7. Compute trust score ───────────────────────────────────────────
      const newScore = computeTrustScore({
        ...updatedUser,
        email_verified : true,
      });

      await client.query(
        "UPDATE users SET trust_score = $1 WHERE id = $2",
        [newScore, userId]
      );

      await client.query("COMMIT");

      // ── 8. Audit ─────────────────────────────────────────────────────────
      await writeAudit({
        actorId    : userId,
        action     : "email_verified",
        targetType : "user",
        targetId   : userId,
        metadata   : { trust_score: newScore },
        ipAddress  : ip,
      });

      const caps = getCapabilities({
        ...updatedUser,
        email_verified : true,
        trust_score    : newScore,
      });

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
  }
);

/* ══════════════════════════════════════════════════════════════════════════════
   GET /api/verification/status
══════════════════════════════════════════════════════════════════════════════ */
router.get(
  "/status",
  authenticate,        // ← authenticate (not authMiddleware)
  async (req, res) => {
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
        return res.status(404).json({
          success : false,
          message : "User not found.",
        });
      }

      const user = rows[0];

      const { rows: storeRows } = await pool.query(`
        SELECT status, message, review_action, reviewed_by, updated_at
        FROM store_verifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [req.user.id]);

      const dailyCount      = await getDailySendCount(pool, req.user.id);
      const resendRemaining = Math.max(0, OTP_POLICY.DAILY_SEND_LIMIT - dailyCount);

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
        capability_hints  : caps.toDetailedJSON(),
        resend_remaining  : resendRemaining,
        resend_limit      : OTP_POLICY.DAILY_SEND_LIMIT,
      });

    } catch (err) {
      console.error("[verification/status]", err.message);
      return res.status(500).json({
        success : false,
        message : "Failed to fetch verification status.",
      });
    }
  }
);

export default router;