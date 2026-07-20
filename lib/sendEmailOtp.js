/**
 * lib/sendEmailOtp.js
 *
 * Single source of truth for OTP generation and storage.
 * Used by:
 *   - routes/auth.routes.js   (after registration)
 *   - routes/verification.js  (resend endpoint)
 *
 * Writes to: email_verifications  (bcrypt hash, 'active' status)
 * NOT:        email_verification_otps  (the old sha256 table)
 */

import bcrypt from "bcrypt";
import crypto from "crypto";
import { pool }                    from "../config/db.js";
import { sendVerificationEmail }   from "../services/email.js";

const IS_PROD = process.env.NODE_ENV === "production";

const POLICY = Object.freeze({
  OTP_EXPIRY_MINUTES   : 10,
  BCRYPT_ROUNDS        : 10,
  RESEND_COOLDOWN_SECS : IS_PROD ? 60 : 30,
  DAILY_SEND_LIMIT     : IS_PROD ?  3 : 50,
});

const generateOtp   = () => crypto.randomInt(100_000, 999_999).toString();
const maskEmail     = (e) =>
  String(e).replace(/(.{2})(.*)(@.*)/, (_, a, _b, c) => `${a}***${c}`);

const makeDeviceHash = (req) =>
  crypto
    .createHash("sha256")
    .update([
      req.headers?.["user-agent"]      ?? "",
      req.headers?.["accept-language"] ?? "",
      req.headers?.["sec-ch-ua"]       ?? "",
    ].join("|"))
    .digest("hex");

const getTodayUTC = () => new Date().toISOString().slice(0, 10);

export const getDailySendCount = async (db, userId) => {
  const today = getTodayUTC();
  const { rows } = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM   email_verifications
     WHERE  user_id    = $1
       AND  created_at >= $2::date
       AND  created_at <  ($2::date + INTERVAL '1 day')`,
    [userId, today]
  );
  return parseInt(rows[0].cnt, 10);
};

/**
 * sendEmailOtp
 *
 * Generates, stores (bcrypt), and emails an OTP for a user.
 * Returns { success, maskedEmail, remaining, dev_otp? }
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.email
 * @param {string} params.name
 * @param {object} [params.req]   - Express request (for device hash / IP).
 *                                  Pass null when calling outside a request
 *                                  context (e.g. from a queue worker).
 * @param {string} [params.ip]
 * @returns {Promise<{
 *   success     : boolean,
 *   maskedEmail : string,
 *   remaining   : number,
 *   dev_otp?    : string,
 *   error?      : string,
 * }>}
 */
export async function sendEmailOtp({ userId, email, name, req = null, ip = null }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── Daily send limit ── */
    const dailyCount = await getDailySendCount(client, userId);
    if (dailyCount >= POLICY.DAILY_SEND_LIMIT) {
      await client.query("ROLLBACK");
      return {
        success   : false,
        error     : `Daily limit (${POLICY.DAILY_SEND_LIMIT}/day) reached.`,
        remaining : 0,
        code      : "DAILY_LIMIT",
      };
    }

    /* ── Cooldown check ── */
    const cooldownCutoff = new Date(
      Date.now() - POLICY.RESEND_COOLDOWN_SECS * 1_000
    );
    const { rows: recent } = await client.query(
      `SELECT created_at FROM email_verifications
       WHERE  user_id    = $1
         AND  created_at > $2
       ORDER  BY created_at DESC LIMIT 1`,
      [userId, cooldownCutoff]
    );
    if (recent.length) {
      const wait = Math.ceil(
        POLICY.RESEND_COOLDOWN_SECS -
        (Date.now() - new Date(recent[0].created_at).getTime()) / 1_000
      );
      await client.query("ROLLBACK");
      return {
        success    : false,
        error      : `Wait ${wait}s before requesting another code.`,
        retryAfter : wait,
        remaining  : POLICY.DAILY_SEND_LIMIT - dailyCount,
        code       : "COOLDOWN",
      };
    }

    /* ── Expire previous active OTPs ── */
    await client.query(
      `UPDATE email_verifications
       SET    status = 'expired', used_at = NOW()
       WHERE  user_id = $1 AND status = 'active'`,
      [userId]
    );

    /* ── Generate and store new OTP ── */
    const otp       = generateOtp();
    const hash      = await bcrypt.hash(otp, POLICY.BCRYPT_ROUNDS);
    const expiresAt = new Date(
      Date.now() + POLICY.OTP_EXPIRY_MINUTES * 60 * 1_000
    );
    const device    = req ? makeDeviceHash(req) : null;
    const clientIp  = ip ?? null;

    await client.query(
      `INSERT INTO email_verifications
         (user_id, otp_hash, expires_at, status, device_hash, ip_address)
       VALUES ($1, $2, $3, 'active', $4, $5)`,
      [userId, hash, expiresAt, device, clientIp]
    );

    /* ── Optionally log device ── */
    if (req && device) {
      await client.query(
        `INSERT INTO user_devices
           (user_id, device_hash, ip_address, user_agent, last_seen)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, device_hash)
         DO UPDATE SET
           last_seen  = NOW(),
           ip_address = EXCLUDED.ip_address`,
        [userId, device, clientIp, req.headers?.["user-agent"] ?? null]
      ).catch(() => {
        /* user_devices table may not exist — non-fatal */
      });
    }

    await client.query("COMMIT");

    /* ── Send email ── */
    try {
      await sendVerificationEmail({ to: email, name, otp });
    } catch (mailErr) {
      /* Roll back the stored OTP so the user can try again */
      await pool.query(
        `UPDATE email_verifications
         SET    status = 'expired', used_at = NOW()
         WHERE  user_id = $1 AND status = 'active'`,
        [userId]
      ).catch(() => {});

      return {
        success : false,
        error   : `Email delivery failed: ${mailErr.message}`,
        code    : "EMAIL_FAILED",
        /* Surface OTP in dev so the developer is not stuck */
        ...(IS_PROD ? {} : { dev_otp: otp }),
      };
    }

    const remaining = POLICY.DAILY_SEND_LIMIT - (dailyCount + 1);

    return {
      success     : true,
      maskedEmail : maskEmail(email),
      remaining,
      expiresIn   : POLICY.OTP_EXPIRY_MINUTES * 60,
      ...(IS_PROD ? {} : { dev_otp: otp }),
    };

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err; // let the caller handle unexpected DB errors
  } finally {
    client.release();
  }
}