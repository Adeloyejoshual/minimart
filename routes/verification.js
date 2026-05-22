const express   = require('express');
const router    = express.Router();
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const { pool }  = require('../db');
const { authMiddleware }        = require('../middleware/auth');
const { sendVerificationEmail } = require('../services/email');
const { getCapabilities, computeTrustScore } = require('../lib/permissions');
const { writeAudit }            = require('../lib/audit');

// ── Rate limiters ─────────────────────────────────────────────────────────────
const sendOtpLimiter = rateLimit({
  windowMs     : 10 * 60 * 1000,
  max          : 5,
  keyGenerator : (req) => req.user?.id || req.ip,
  handler      : (_req, res) => res.status(429).json({
    error: 'Too many requests. Try again in 10 minutes.', retryAfter: 600,
  }),
});

const verifyOtpLimiter = rateLimit({
  windowMs     : 15 * 60 * 1000,
  max          : 10,
  keyGenerator : (req) => req.user?.id || req.ip,
  handler      : (_req, res) => res.status(429).json({
    error: 'Too many failed attempts. Try again in 15 minutes.',
  }),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const generateOTP    = () => crypto.randomInt(100_000, 999_999).toString();
const getIp          = (req) => req.ip || req.socket?.remoteAddress || null;
const getDeviceHash  = (req) => {
  const raw = [
    req.headers['user-agent']      || '',
    req.headers['accept-language'] || '',
    req.headers['sec-ch-ua']       || '',
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
};

const flagAccount = async (client, userId, reason, ip) => {
  await client.query(`
    UPDATE users
    SET status        = 'flagged',
        total_reports = total_reports + 1,
        updated_at    = NOW()
    WHERE id = $1
  `, [userId]);

  await writeAudit({
    actorId    : userId,
    action     : 'user_flagged',
    targetType : 'user',
    targetId   : userId,
    metadata   : { reason },
    ipAddress  : ip,
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/verification/send-email-otp
// ══════════════════════════════════════════════════════════════════════════════
router.post('/send-email-otp', authMiddleware, sendOtpLimiter, async (req, res) => {
  const userId = req.user.id;
  const ip     = getIp(req);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: users } = await client.query(`
      SELECT id, email, name, email_verified, status
      FROM users WHERE id = $1
    `, [userId]);

    const user = users[0];
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Generic response — prevent enumeration
    if (user.email_verified) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'If verification is needed, a code has been sent.',
      });
    }

    // Abuse check
    const { rows: abuse } = await client.query(`
      SELECT COUNT(*) AS count FROM email_verifications
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '10 minutes'
    `, [userId]);

    if (parseInt(abuse[0].count) >= 5) {
      await flagAccount(client, userId, 'otp_abuse', ip);
      await client.query('COMMIT');
      return res.status(429).json({ error: 'Too many requests. Account flagged.' });
    }

    // Cooldown check
    const { rows: recent } = await client.query(`
      SELECT created_at FROM email_verifications
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '60 seconds'
      ORDER BY created_at DESC LIMIT 1
    `, [userId]);

    if (recent.length > 0) {
      const waitSecs = Math.ceil(
        60 - (Date.now() - new Date(recent[0].created_at)) / 1000
      );
      await client.query('ROLLBACK');
      return res.status(429).json({
        error: `Wait ${waitSecs}s before requesting another code.`,
        retryAfter: waitSecs,
      });
    }

    // Invalidate old OTPs
    await client.query(`
      UPDATE email_verifications
      SET status = 'expired', used_at = NOW()
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);

    // Generate + store
    const otp        = generateOTP();
    const otpHash    = await bcrypt.hash(otp, 10);
    const deviceHash = getDeviceHash(req);

    await client.query(`
      INSERT INTO email_verifications
        (user_id, otp_hash, expires_at, status, device_hash)
      VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 'active', $3)
    `, [userId, otpHash, deviceHash]);

    await client.query(`
      INSERT INTO user_devices (user_id, device_hash, ip_address, user_agent, last_seen)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, device_hash)
      DO UPDATE SET last_seen = NOW(), ip_address = EXCLUDED.ip_address
    `, [userId, deviceHash, ip, req.headers['user-agent'] || null]);

    await client.query('COMMIT');

    // Send email after commit
    try {
      await sendVerificationEmail({ to: user.email, name: user.name, otp });
    } catch (mailErr) {
      console.error('[email-send-failed]', mailErr.message);
      await pool.query(`
        UPDATE email_verifications
        SET status = 'expired', used_at = NOW()
        WHERE user_id = $1 AND status = 'active'
          AND created_at > NOW() - INTERVAL '1 minute'
      `, [userId]);
      return res.status(500).json({ error: 'Failed to send verification email.' });
    }

    await writeAudit({
      actorId: userId, action: 'otp_sent',
      targetType: 'user', targetId: userId,
      metadata: { method: 'email' }, ipAddress: ip,
    });

    res.json({
      success   : true,
      message   : 'Verification code sent',
      email     : user.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      expiresIn : 600,
    });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[send-email-otp]', err.message);
    res.status(500).json({ error: 'Failed to send verification code' });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/verification/verify-email-otp
// ══════════════════════════════════════════════════════════════════════════════
router.post('/verify-email-otp', authMiddleware, verifyOtpLimiter, async (req, res) => {
  const { otp }    = req.body;
  const userId     = req.user.id;
  const ip         = getIp(req);
  const deviceHash = getDeviceHash(req);

  if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
    return res.status(400).json({ error: 'OTP must be exactly 6 digits' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(`
      SELECT id, otp_hash, attempts, device_hash
      FROM email_verifications
      WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `, [userId]);

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Code expired or not found. Please request a new one.',
      });
    }

    const record = rows[0];

    // Device mismatch — audit but don't block (mobile IPs shift)
    if (record.device_hash && record.device_hash !== deviceHash) {
      await writeAudit({
        actorId: userId, action: 'otp_device_mismatch',
        targetType: 'user', targetId: userId,
        metadata: { stored: record.device_hash, received: deviceHash },
        ipAddress: ip,
      });
    }

    // Max attempts
    if (record.attempts >= 5) {
      await client.query(`
        UPDATE email_verifications SET status = 'blocked' WHERE id = $1
      `, [record.id]);
      await flagAccount(client, userId, 'otp_max_attempts', ip);
      await client.query('COMMIT');
      return res.status(400).json({ error: 'Too many failed attempts. Request a new code.' });
    }

    // Compare
    const isValid = await bcrypt.compare(String(otp).trim(), record.otp_hash);

    if (!isValid) {
      await client.query(`
        UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1
      `, [record.id]);
      await client.query('COMMIT');

      const attemptsLeft = Math.max(0, 4 - record.attempts);
      await writeAudit({
        actorId: userId, action: 'otp_failed',
        targetType: 'user', targetId: userId,
        metadata: { attemptsLeft }, ipAddress: ip,
      });

      return res.status(400).json({
        error: 'Incorrect code. Please try again.',
        attemptsLeft,
      });
    }

    // Atomic mark — race condition fix
    const { rows: marked } = await client.query(`
      UPDATE email_verifications
      SET status = 'used', used_at = NOW()
      WHERE id = $1 AND status = 'active'
      RETURNING id
    `, [record.id]);

    if (!marked.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Code already used. Request a new one.' });
    }

    // Update user
    const { rows: updatedUsers } = await client.query(`
      UPDATE users
      SET email_verified = true, email_verified_at = NOW(),
          verified = true, updated_at = NOW()
      WHERE id = $1
      RETURNING id, role, seller_type, status, email_verified,
                store_verified, trust_score, created_at
    `, [userId]);

    const updatedUser = updatedUsers[0];
    const newScore    = computeTrustScore({ ...updatedUser, email_verified: true });

    await client.query(
      'UPDATE users SET trust_score = $1 WHERE id = $2',
      [newScore, userId]
    );

    await client.query('COMMIT');

    await writeAudit({
      actorId: userId, action: 'email_verified',
      targetType: 'user', targetId: userId,
      metadata: { trust_score: newScore }, ipAddress: ip,
    });

    // Return capability-based permissions
    const caps = getCapabilities({ ...updatedUser, email_verified: true, trust_score: newScore });

    res.json({
      success     : true,
      message     : 'Email verified successfully!',
      trust_score : newScore,
      permissions : caps.toJSON(),
    });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[verify-email-otp]', err.message);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/verification/status
// ══════════════════════════════════════════════════════════════════════════════
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id, email, name, role, seller_type, status, rating,
        email_verified, email_verified_at,
        store_verified, trust_score, created_at
      FROM users WHERE id = $1
    `, [req.user.id]);

    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const user = rows[0];

    const { rows: storeRows } = await pool.query(`
      SELECT status, review_action, review_notes, updated_at
      FROM store_verifications
      WHERE user_id = $1
      ORDER BY created_at DESC LIMIT 1
    `, [req.user.id]);

    const caps = getCapabilities(user);

    res.json({
      // Identity
      email      : user.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      name       : user.name,
      role       : user.role,
      seller_type: user.seller_type,
      status     : user.status,
      rating     : user.rating,

      // Verification state
      email_verified    : user.email_verified,
      email_verified_at : user.email_verified_at,
      store_verified    : user.store_verified,
      store_review      : storeRows[0] || null,

      // Trust
      trust_score : user.trust_score,

      // Capabilities — structured with action hints
      permissions : caps.toJSON(),

      // Detailed hints for frontend CTAs
      capability_hints: caps.toDetailedJSON(),
    });

  } catch (err) {
    console.error('[verification/status]', err.message);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

module.exports = router;