/**
 * routes/auth.routes.js
 *
 * POST /api/auth/register
 * POST /api/auth/login
 */

import express        from "express";
import bcrypt         from "bcrypt";
import jwt            from "jsonwebtoken";
import rateLimit      from "express-rate-limit";
import nodeCrypto     from "crypto";                      // Node.js crypto — for hashOtp
import { pool }       from "../config/db.js";
import { writeAudit } from "../lib/audit.js";
import { sendEmailVerificationOtp } from "../services/email.js";
import { generateUniqueReferralCode } from "../lib/generateReferralCode.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ════════════════════════════════════════════════════════════
   STARTUP CHECKS
   Fail fast — catch missing env vars before any request hits.
════════════════════════════════════════════════════════════ */
if (!process.env.JWT_SECRET) {
  throw new Error("[auth] FATAL: JWT_SECRET is not set in environment.");
}

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const HASH_ROUNDS        = 12;
const OTP_EXPIRY_MINUTES = 15;
const OTP_LENGTH         = 6;
const OTP_MIN            = 10 ** (OTP_LENGTH - 1);          // 100_000
const OTP_RANGE          = 10 **  OTP_LENGTH - OTP_MIN;     // 900_000

const BANNED_STATUSES  = Object.freeze(["banned", "suspended", "flagged"]);
const INVITE_CODE_RE   = /^[A-Z0-9]{4,20}$/;
const EMAIL_RE         = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ════════════════════════════════════════════════════════════
   SAFE FIELDS
   Every column we are allowed to return to the client.
   password_hash is NEVER included here.
════════════════════════════════════════════════════════════ */
const SAFE_FIELDS = `
  id, name, email, phone_number,
  country, state, city,
  profile_image,
  store_name, store_description, store_logo, store_verified,
  status, last_login,
  rating, trust_score, verified,
  products_count, total_sales, total_purchases,
  created_at, "role",
  is_online, email_verified, identity_verified,
  seller_type, referral_code, bonus_spins, total_referrals
`;

/* ════════════════════════════════════════════════════════════
   HELPERS — general
════════════════════════════════════════════════════════════ */
const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  req.socket?.remoteAddress ??
  null;

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const normalizeEmail  = (raw = "") => raw.trim().toLowerCase();
const isValidEmail    = (e)        => EMAIL_RE.test(e);

/* ════════════════════════════════════════════════════════════
   HELPERS — JWT
════════════════════════════════════════════════════════════ */
const makeJwt = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role ?? null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" }
  );

/* ════════════════════════════════════════════════════════════
   HELPERS — OTP
   generateOtp  → uses globalThis.crypto (Web Crypto, built-in Node 19+)
   hashOtp      → uses nodeCrypto (Node built-in, imported above)
════════════════════════════════════════════════════════════ */
const generateOtp = () => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);           // Web Crypto — no import needed
  return String(OTP_MIN + (buf[0] % OTP_RANGE));    // always exactly OTP_LENGTH digits
};

const hashOtp = (raw) =>
  nodeCrypto                                        // Node crypto — imported at top
    .createHash("sha256")
    .update(String(raw))
    .digest("hex");

/* ════════════════════════════════════════════════════════════
   HELPERS — input validation
════════════════════════════════════════════════════════════ */
const validateRegisterBody = (body) => {
  const { name, email, password, invite_code } = body;

  if (!name || !email || !password)
    return "Name, email and password are required.";

  if (typeof name !== "string" || name.trim().length < 2)
    return "Name must be at least 2 characters.";

  if (!isValidEmail(normalizeEmail(email)))
    return "Please enter a valid email address.";

  if (typeof password !== "string" || password.length < 8)
    return "Password must be at least 8 characters.";

  if (!/[A-Z]/.test(password))
    return "Password must contain at least one uppercase letter.";

  if (!/[0-9]/.test(password))
    return "Password must contain at least one number.";

  if (invite_code) {
    const clean = String(invite_code).trim().toUpperCase();
    if (!INVITE_CODE_RE.test(clean))
      return "Invalid invite code format.";
  }

  return null; // ✅ all good
};

const validateLoginBody = (body) => {
  const { email, password } = body;

  if (!email || !password)
    return "Email and password are required.";

  if (!isValidEmail(normalizeEmail(email)))
    return "Please enter a valid email address.";

  return null; // ✅ all good
};

/* ════════════════════════════════════════════════════════════
   REFERRAL — recordReferral
   Called fire-and-forget after a new user is inserted.
   NEVER throws — referral failure must not break registration.
════════════════════════════════════════════════════════════ */
async function recordReferral(inviteCode, newUserId) {
  if (!inviteCode || !newUserId) return;

  const code = String(inviteCode).toUpperCase().trim();

  try {
    /* ── Find inviter ── */
    const { rows: [inviter] } = await pool.query(
      `SELECT id, status
       FROM   users
       WHERE  referral_code = $1
       LIMIT  1`,
      [code]
    );

    if (!inviter) {
      console.warn(`[referral] code not found: ${code}`);
      return;
    }

    if (inviter.id === newUserId) {
      console.warn(`[referral] self-referral blocked — user=${newUserId}`);
      return;
    }

    if (BANNED_STATUSES.includes(inviter.status)) {
      console.warn(
        `[referral] inviter ${inviter.id} is ${inviter.status} — skipping`
      );
      return;
    }

    /* ── Guard: one referral per referee ── */
    const { rowCount: alreadyReferred } = await pool.query(
      `SELECT 1 FROM referrals WHERE referee_id = $1 LIMIT 1`,
      [newUserId]
    );

    if (alreadyReferred) {
      console.warn(
        `[referral] user ${newUserId} already referred — skipping`
      );
      return;
    }

    /* ── Insert referral row ── */
    const { rows: [referral] } = await pool.query(
      `INSERT INTO referrals
         (inviter_id, referee_id, invite_code,
          status, reward_type, reward_value)
       VALUES ($1, $2, $3, 'pending', 'bonus_spin', 1)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [inviter.id, newUserId, code]
    );

    if (!referral) {
      console.warn(`[referral] insert conflict — duplicate skipped`);
      return;
    }

    /* ── Store referred_by on new user ── */
    await pool.query(
      `UPDATE users SET referred_by = $1 WHERE id = $2`,
      [inviter.id, newUserId]
    );

    /* ── Log signed_up event ── */
    await pool.query(
      `INSERT INTO referral_events
         (referral_id, event_type, description, metadata)
       VALUES ($1, 'signed_up',
               'New user signed up using invite code',
               $2::JSONB)`,
      [
        referral.id,
        JSON.stringify({ invite_code: code, inviter_id: inviter.id }),
      ]
    );

    console.log(
      `[referral] ✓ recorded  ` +
      `inviter=${inviter.id}  referee=${newUserId}  code=${code}`
    );

  } catch (err) {
    console.error(
      `[referral] recordReferral error (non-fatal): ${err.message}`
    );
  }
}

/* ════════════════════════════════════════════════════════════
   REFERRAL — grantReferralRewardOnVerify
   Called fire-and-forget after email verification succeeds.
   NEVER throws — reward failure must not break verification.
════════════════════════════════════════════════════════════ */
async function grantReferralRewardOnVerify(verifiedUserId) {
  if (!verifiedUserId) return;

  try {
    /* ── Find pending referral ── */
    const { rows: [referral] } = await pool.query(
      `SELECT id, inviter_id
       FROM   referrals
       WHERE  referee_id = $1
         AND  status     = 'pending'
       LIMIT  1`,
      [verifiedUserId]
    );

    if (!referral) return; // user was not referred — perfectly normal

    /* ── Atomic status update — prevents double-grant ── */
    const { rowCount } = await pool.query(
      `UPDATE referrals
       SET    status      = 'verified',
              verified_at = NOW()
       WHERE  id     = $1
         AND  status = 'pending'`,   // only succeeds once
      [referral.id]
    );

    if (!rowCount) {
      console.warn(
        `[referral] referral ${referral.id} already processed — skipping`
      );
      return;
    }

    /* ── Log email_verified event ── */
    await pool.query(
      `INSERT INTO referral_events
         (referral_id, event_type, description)
       VALUES ($1, 'email_verified',
               'Referee verified their email address')`,
      [referral.id]
    );

    /* ── Call DB function to grant reward ── */
    const { rows: [result] } = await pool.query(
      `SELECT grant_referral_reward($1) AS result`,
      [referral.id]
    );

    const reward = result?.result;

    if (reward?.success) {
      console.log(
        `[referral] ✓ reward granted  ` +
        `inviter=${reward.inviter_id}  ` +
        `referee=${verifiedUserId}  ` +
        `+${reward.reward_value} spin`
      );
    } else {
      console.warn(
        `[referral] reward not granted  ` +
        `reason=${reward?.reason ?? "unknown"}  ` +
        `referral=${referral.id}`
      );
    }

  } catch (err) {
    console.error(
      `[referral] grantReferralRewardOnVerify error (non-fatal): ${err.message}`
    );
  }
}

/* ════════════════════════════════════════════════════════════
   RATE LIMITERS
════════════════════════════════════════════════════════════ */
const mkLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60 * 1_000,
    max             : IS_PROD ? max : max * 50,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? getIp(req)),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const authLimiter = mkLimiter({
  windowMin : 15,
  max       : 10,
  message   : "Too many attempts. Please try again later.",
});

/* ════════════════════════════════════════════════════════════
   POST /api/auth/register
════════════════════════════════════════════════════════════ */
router.post("/register", authLimiter, async (req, res, next) => {
  const ip = getIp(req);

  /* ── 1. Validate input ── */
  const validationError = validateRegisterBody(req.body);
  if (validationError) return fail(res, 400, validationError);

  const {
    name, email, password,
    phone_number, country, state, city,
    invite_code,
  } = req.body;

  const cleanEmail      = normalizeEmail(email);
  const cleanName       = name.trim();
  const cleanPhone      = phone_number?.trim()  || null;
  const cleanInviteCode = invite_code
    ? String(invite_code).trim().toUpperCase()
    : null;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── 2. Duplicate email check ── */
    const { rowCount: emailTaken } = await client.query(
      `SELECT 1 FROM users WHERE email = $1`,
      [cleanEmail]
    );

    if (emailTaken) {
      await client.query("ROLLBACK");
      return fail(res, 409, "An account with this email already exists.", {
        code: "EMAIL_TAKEN",
      });
    }

    /* ── 3. Validate invite code exists in DB (if provided) ── */
    if (cleanInviteCode) {
      const { rowCount: codeValid } = await client.query(
        `SELECT 1
         FROM   users
         WHERE  referral_code = $1
           AND  status NOT IN ('banned', 'suspended', 'flagged')`,
        [cleanInviteCode]
      );

      if (!codeValid) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Invalid or expired invite code.", {
          code: "INVALID_INVITE_CODE",
        });
      }
    }

    /* ── 4. Hash password ── */
    const password_hash = await bcrypt.hash(password, HASH_ROUNDS);

    /* ── 5. Generate referral code for the NEW user ──
            Non-fatal: if generation fails the user still registers.
            The DB trigger (if any) acts as the final safety net.    ── */
    let newReferralCode = null;
    try {
      newReferralCode = await generateUniqueReferralCode();
    } catch (genErr) {
      console.error(
        `[auth] referral code generation failed (non-fatal): ${genErr.message}`
      );
    }

    /* ── 6. Insert user ── */
    const { rows: [user] } = await client.query(
      `INSERT INTO users
         (name, email, password_hash, phone_number,
          country, state, city, referral_code)
       VALUES
         ($1, $2, $3, $4,
          $5, $6, $7, $8)
       RETURNING ${SAFE_FIELDS}`,
      [
        cleanName,
        cleanEmail,
        password_hash,
        cleanPhone,
        country         ?? null,
        state           ?? null,
        city            ?? null,
        newReferralCode,          // null-safe — trigger handles null if set up
      ]
    );

    await client.query("COMMIT");

    /* ── 7. Record referral — fire-and-forget ──
            Runs AFTER commit so the new user row is visible to
            the referral query. Never blocks the response.           ── */
    if (cleanInviteCode) {
      recordReferral(cleanInviteCode, user.id).catch((err) =>
        console.error(`[auth] recordReferral unexpected: ${err.message}`)
      );
    }

    /* ── 8. Sign JWT ── */
    const token = makeJwt(user);

    /* ── 9. Generate OTP ── */
    const rawOtp  = generateOtp();
    const otpHash = hashOtp(rawOtp);

    /* ── 10. Store OTP — separate try/catch, outside the transaction ── */
    try {
      await pool.query(
        `INSERT INTO email_verification_otps
           (user_id, otp_hash, expires_at)
         VALUES
           ($1, $2, NOW() + ($3 || ' minutes')::INTERVAL)`,
        [user.id, otpHash, String(OTP_EXPIRY_MINUTES)]
      );
    } catch (otpErr) {
      /* Non-fatal — user can request a new OTP from account settings */
      console.error(`[auth] OTP store failed (non-fatal): ${otpErr.message}`);
    }

    /* ── 11. Send verification email ── */
    let emailSent = true;
    try {
      await sendEmailVerificationOtp({
        to     : user.email,
        name   : user.name,
        otp    : rawOtp,
        expiry : OTP_EXPIRY_MINUTES,
      });
      console.log(`[auth] ✓ OTP email sent → ${user.email}`);
    } catch (mailErr) {
      emailSent = false;
      console.error(`[auth] OTP email failed: ${mailErr.message}`);
    }

    /* ── 12. Dev console output ── */
    if (!IS_PROD) {
      console.log("\n" + "═".repeat(60));
      console.log("[auth] 🔑  DEV MODE — EMAIL VERIFICATION OTP");
      console.log(`   User ID      : ${user.id}`);
      console.log(`   Email        : ${user.email}`);
      console.log(`   OTP          : ${rawOtp}`);
      console.log(`   Expires      : ${OTP_EXPIRY_MINUTES} minutes`);
      console.log(`   Referral     : ${newReferralCode  ?? "(none — generation failed)"}`);
      console.log(`   Invite Code  : ${cleanInviteCode  ?? "(none)"}`);
      console.log(`   Email sent   : ${emailSent}`);
      console.log("═".repeat(60) + "\n");
    }

    /* ── 13. Audit log ── */
    writeAudit({
      actorId    : user.id,
      action     : "user_registered",
      targetType : "user",
      targetId   : user.id,
      ipAddress  : ip,
      metadata   : {
        invite_code   : cleanInviteCode ?? null,
        referral_code : newReferralCode ?? null,
        email_sent    : emailSent,
      },
    }).catch((e) =>
      console.error(`[auth] audit write failed: ${e.message}`)
    );

    console.log(
      `[auth] ✓ registered  user=${user.id}  email=${cleanEmail}` +
      (cleanInviteCode ? `  invite=${cleanInviteCode}`   : "") +
      (newReferralCode ? `  referral=${newReferralCode}` : "")
    );

    /* ── 14. Response ── */
    const responseBody = {
      success : true,
      message : "Account created successfully.",
      token,
      user,
    };

    /* Surface OTP in dev when email delivery failed */
    if (!IS_PROD && !emailSent) {
      responseBody.dev_otp  = rawOtp;
      responseBody.dev_hint =
        "Email delivery failed — use the OTP printed in the server console.";
    }

    return res.status(201).json(responseBody);

  } catch (err) {
    /* Always rollback on unexpected error */
    await client.query("ROLLBACK").catch(() => {});

    /* ── Handle known Postgres unique violations ── */
    if (err.code === "23505") {
      const detail = (err.detail ?? "").toLowerCase();

      if (detail.includes("phone"))
        return fail(res, 409, "Phone number already registered.", {
          code: "PHONE_TAKEN",
        });

      if (detail.includes("referral_code"))
        return fail(
          res,
          500,
          "Could not generate a unique referral code. Please try again.",
          { code: "REFERRAL_CODE_CONFLICT" }
        );

      return fail(res, 409, "An account with this email already exists.", {
        code: "EMAIL_TAKEN",
      });
    }

    /* ── Unknown error — log full stack, forward to error middleware ── */
    console.error(
      `[auth] register error: ${err.message}\n${err.stack}`
    );
    next(err);

  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/auth/login
════════════════════════════════════════════════════════════ */
router.post("/login", authLimiter, async (req, res, next) => {
  const ip = getIp(req);

  /* ── 1. Validate input ── */
  const validationError = validateLoginBody(req.body);
  if (validationError) return fail(res, 400, validationError);

  const cleanEmail = normalizeEmail(req.body.email);

  try {
    /* ── 2. Fetch user + password hash ── */
    const { rows } = await pool.query(
      `SELECT ${SAFE_FIELDS}, password_hash
       FROM   users
       WHERE  email = $1`,
      [cleanEmail]
    );

    /* Intentionally vague — never reveal whether email exists */
    if (!rows.length)
      return fail(res, 401, "Invalid email or password.");

    const row = rows[0];

    /* ── 3. Account status check ── */
    if (BANNED_STATUSES.includes(row.status)) {
      return fail(
        res,
        403,
        "Your account has been suspended. Please contact support.",
        { code: "ACCOUNT_SUSPENDED" }
      );
    }

    /* ── 4. Password check ── */
    const valid = await bcrypt.compare(req.body.password, row.password_hash);
    if (!valid)
      return fail(res, 401, "Invalid email or password.");

    /* ── 5. Update last_login + is_online — fire-and-forget ── */
    pool
      .query(
        `UPDATE users
         SET    last_login = NOW(),
                is_online  = true
         WHERE  id = $1`,
        [row.id]
      )
      .catch((e) =>
        console.error(`[auth] last_login update failed: ${e.message}`)
      );

    /* ── 6. Build response — strip password_hash ── */
    const { password_hash, ...user } = row;
    const token = makeJwt(user);

    /* ── 7. Audit log ── */
    writeAudit({
      actorId    : user.id,
      action     : "user_login",
      targetType : "user",
      targetId   : user.id,
      ipAddress  : ip,
    }).catch((e) =>
      console.error(`[auth] audit write failed: ${e.message}`)
    );

    console.log(
      `[auth] ✓ login  user=${user.id}  email=${cleanEmail}`
    );

    return res.json({
      success : true,
      message : "Login successful.",
      token,
      user,
    });

  } catch (err) {
    console.error(`[auth] login error: ${err.message}\n${err.stack}`);
    next(err);
  }
});

/* ════════════════════════════════════════════════════════════
   EXPORTS
════════════════════════════════════════════════════════════ */
export { grantReferralRewardOnVerify };
export default router;