const express    = require("express");
const router     = express.Router();
const bcrypt     = require("bcryptjs");          // bcryptjs — safe on all platforms
const crypto     = require("crypto");
const rateLimit  = require("express-rate-limit");
const { pool }   = require("../db");
const { authMiddleware }          = require("../middleware/auth");
const { sendVerificationEmail }   = require("../services/email");

// ══════════════════════════════════════════════════════════════════════════════
// RATE LIMITERS
// ══════════════════════════════════════════════════════════════════════════════
const sendOtpLimiter = rateLimit({
  windowMs     : 10 * 60 * 1000,   // 10 minutes
  max          : 5,
  keyGenerator : (req) => req.user?.id || req.ip,
  handler      : (req, res) =>
    res.status(429).json({
      error      : "Too many OTP requests. Try again in 10 minutes.",
      retryAfter : 600,
    }),
});

const verifyOtpLimiter = rateLimit({
  windowMs     : 15 * 60 * 1000,
  max          : 10,
  keyGenerator : (req) => req.user?.id || req.ip,
  handler      : (req, res) =>
    res.status(429).json({
      error: "Too many failed attempts. Try again in 15 minutes.",
    }),
});

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

// 6-digit OTP
const generateOTP = () =>
  crypto.randomInt(100_000, 999_999).toString();

// Stronger device fingerprint
const getDeviceHash = (req) => {
  const raw = [
    req.headers["user-agent"]       || "",
    req.headers["accept-language"]  || "",
    req.headers["sec-ch-ua"]        || "",
    req.ip                          || "",
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
};

// Trust score — single source of truth
const computeTrustScore = (user) => {
  let score = 0;

  if (user.email_verified)  score += 40;
  if (user.store_verified)  score += 20;
  // future: phone +20, identity +20

  const ageInDays = (Date.now() - new Date(user.created_at)) / 86_400_000;
  if (ageInDays > 30)  score += 10;
  if (ageInDays > 90)  score += 10;

  return Math.min(score, 100);
};

// Flag suspicious account
const flagAccount = async (client, userId) => {
  await client.query(`
    UPDATE users
    SET
      status        = 'flagged',
      total_reports = total_reports + 1,
      updated_at    = NOW()
    WHERE id = $1
  `, [userId]);
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/verification/send-email-otp
// ══════════════════════════════════════════════════════════════════════════════
router.post(
  "/send-email-otp",
  authMiddleware,
  sendOtpLimiter,
  async (req, res) => {
    const userId = req.user.id;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // ── 1. Fetch only needed fields ───────────────────────────────────────
      const { rows: users } = await client.query(`
        SELECT
          id, email, name,
          email_verified,
          created_at, status
        FROM users
        WHERE id = $1
      `, [userId]);

      const user = users[0];
      if (!user) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      // ── 2. Generic response — avoid email enumeration ─────────────────────
      if (user.email_verified) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "If verification is needed, a code has been sent.",
        });
      }

      // ── 3. Abuse check — 5 OTPs in 10 min ────────────────────────────────
      const { rows: recentOtps } = await client.query(`
        SELECT COUNT(*) AS count
        FROM email_verifications
        WHERE user_id   = $1
          AND created_at > NOW() - INTERVAL '10 minutes'
      `, [userId]);

      if (parseInt(recentOtps[0].count) >= 5) {
        await flagAccount(client, userId);
        await client.query("COMMIT");
        return res.status(429).json({
          error: "Too many requests. Account flagged for review.",
        });
      }

      // ── 4. Resend cooldown (60 seconds) ───────────────────────────────────
      const { rows: lastOtp } = await client.query(`
        SELECT created_at
        FROM email_verifications
        WHERE user_id   = $1
          AND created_at > NOW() - INTERVAL '60 seconds'
        ORDER BY created_at DESC
        LIMIT 1
      `, [userId]);

      if (lastOtp.length > 0) {
        const waitSecs = Math.ceil(
          60 - (Date.now() - new Date(lastOtp[0].created_at)) / 1000
        );
        await client.query("ROLLBACK");
        return res.status(429).json({
          error      : `Wait ${waitSecs}s before requesting another code.`,
          retryAfter : waitSecs,
        });
      }

      // ── 5. Invalidate old unused OTPs (set used_at) ───────────────────────
      await client.query(`
        UPDATE email_verifications
        SET used_at = NOW()
        WHERE user_id = $1
          AND used_at IS NULL
      `, [userId]);

      // ── 6. Generate & hash OTP ────────────────────────────────────────────
      const otp     = generateOTP();
      const otpHash = await bcrypt.hash(otp, 10);

      // ── 7. Store OTP ──────────────────────────────────────────────────────
      await client.query(`
        INSERT INTO email_verifications (user_id, otp_hash, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
      `, [userId, otpHash]);

      // ── 8. Track device ───────────────────────────────────────────────────
      const deviceHash = getDeviceHash(req);
      const ip         = req.ip || req.socket?.remoteAddress;
      const userAgent  = req.headers["user-agent"];

      await client.query(`
        INSERT INTO user_devices
          (user_id, device_hash, ip_address, user_agent, last_seen)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id, device_hash)
        DO UPDATE SET
          last_seen  = NOW(),
          ip_address = EXCLUDED.ip_address
      `, [userId, deviceHash, ip, userAgent]);

      await client.query("COMMIT");

      // ── 9. Send email (outside transaction — not DB) ──────────────────────
      await sendVerificationEmail({ to: user.email, name: user.name, otp });

      // Mask email in response
      const maskedEmail = user.email.replace(/(.{2}).*(@.*)/, "$1***$2");

      res.json({
        success   : true,
        message   : "Verification code sent to your email",
        email     : maskedEmail,
        expiresIn : 600,
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[send-email-otp]", err.message);
      res.status(500).json({ error: "Failed to send verification code" });
    } finally {
      client.release();
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/verification/verify-email-otp
// ══════════════════════════════════════════════════════════════════════════════
router.post(
  "/verify-email-otp",
  authMiddleware,
  verifyOtpLimiter,
  async (req, res) => {
    const { otp } = req.body;
    const userId  = req.user.id;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: "OTP must be exactly 6 digits" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // ── 1. Fetch latest valid (unused, unexpired) OTP ─────────────────────
      const { rows } = await client.query(`
        SELECT id, otp_hash, attempts, expires_at
        FROM email_verifications
        WHERE user_id   = $1
          AND used_at   IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `, [userId]);

      if (rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Code expired or not found. Please request a new one.",
        });
      }

      const record = rows[0];

      // ── 2. Max attempts (5) ───────────────────────────────────────────────
      if (record.attempts >= 5) {
        await flagAccount(client, userId);
        await client.query("COMMIT");
        return res.status(400).json({
          error: "Too many failed attempts. Request a new code.",
        });
      }

      // ── 3. Compare OTP ────────────────────────────────────────────────────
      const isValid = await bcrypt.compare(otp, record.otp_hash);

      if (!isValid) {
        // Increment attempts
        await client.query(`
          UPDATE email_verifications
          SET attempts = attempts + 1
          WHERE id = $1
        `, [record.id]);

        await client.query("COMMIT");

        const attemptsLeft = Math.max(0, 4 - record.attempts);
        return res.status(400).json({
          error        : "Incorrect code. Please try again.",
          attemptsLeft,
        });
      }

      // ── 4. Mark OTP used — race condition fix ─────────────────────────────
      //    Only succeeds if still unused (prevents double-use)
      const { rows: updated } = await client.query(`
        UPDATE email_verifications
        SET used_at = NOW()
        WHERE id      = $1
          AND used_at IS NULL
        RETURNING id
      `, [record.id]);

      if (updated.length === 0) {
        // Another request already used this OTP
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Code already used. Please request a new one.",
        });
      }

      // ── 5. Update user — no trust_score here, compute separately ─────────
      const { rows: updatedUsers } = await client.query(`
        UPDATE users
        SET
          email_verified    = true,
          email_verified_at = NOW(),
          verified          = true,
          updated_at        = NOW()
        WHERE id = $1
        RETURNING
          id, email_verified, store_verified,
          created_at, status, role
      `, [userId]);

      const updatedUser = updatedUsers[0];

      // ── 6. Compute trust score — single source of truth ───────────────────
      const newScore = computeTrustScore(updatedUser);

      await client.query(`
        UPDATE users
        SET trust_score = $1
        WHERE id = $2
      `, [newScore, userId]);

      await client.query("COMMIT");

      res.json({
        success     : true,
        message     : "Email verified successfully!",
        trust_score : newScore,
        verified    : true,
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[verify-email-otp]", err.message);
      res.status(500).json({ error: "Verification failed. Please try again." });
    } finally {
      client.release();
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/verification/status
// ══════════════════════════════════════════════════════════════════════════════
router.get("/status", authMiddleware, async (req, res) => {
  try {
    // ── Only fetch needed fields ──────────────────────────────────────────────
    const { rows } = await pool.query(`
      SELECT
        id, email, name,
        email_verified,
        email_verified_at,
        store_verified,
        trust_score,
        status, role, rating,
        created_at
      FROM users
      WHERE id = $1
    `, [req.user.id]);

    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];

    // ── Store verification review status ──────────────────────────────────────
    const { rows: storeRows } = await pool.query(`
      SELECT status
      FROM store_verifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [req.user.id]);

    // ── Mask email ────────────────────────────────────────────────────────────
    const maskedEmail = user.email
      ? user.email.replace(/(.{2}).*(@.*)/, "$1***$2")
      : null;

    res.json({
      // Identity
      email              : maskedEmail,
      name               : user.name,
      role               : user.role,
      status             : user.status,
      rating             : user.rating,

      // Verification flags
      email_verified     : user.email_verified,
      email_verified_at  : user.email_verified_at,
      store_verified     : user.store_verified,
      store_review_status: storeRows[0]?.status || null,

      // Score
      trust_score        : user.trust_score,

      // Feature gates
      can_chat           : user.email_verified,
      can_post           : user.email_verified,
      can_buy            : user.email_verified,
      can_withdraw       : user.email_verified && user.store_verified,
    });

  } catch (err) {
    console.error("[verification/status]", err.message);
    res.status(500).json({ error: "Failed to fetch verification status" });
  }
});

module.exports = router;