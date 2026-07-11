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
import nodeCrypto     from "crypto";
import { pool }       from "../config/db.js";
import { writeAudit } from "../lib/audit.js";
import { sendEmailVerificationOtp }   from "../services/email.js";
import { generateUniqueReferralCode } from "../lib/generateReferralCode.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ════════════════════════════════════════════════════════════
   STARTUP GUARD
════════════════════════════════════════════════════════════ */
if (!process.env.JWT_SECRET) {
  throw new Error("[auth] FATAL: JWT_SECRET is not set.");
}

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const HASH_ROUNDS        = 12;
const OTP_EXPIRY_MINUTES = 15;
const OTP_LENGTH         = 6;
const OTP_MIN            = 10 ** (OTP_LENGTH - 1);
const OTP_RANGE          = 10 **  OTP_LENGTH - OTP_MIN;

const BANNED_STATUSES = Object.freeze(["banned", "suspended", "flagged"]);
const INVITE_CODE_RE  = /^[A-Z0-9]{4,20}$/;
const EMAIL_RE        = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
   HELPERS
════════════════════════════════════════════════════════════ */
const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  req.socket?.remoteAddress ??
  null;

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const normalizeEmail = (raw = "") => raw.trim().toLowerCase();
const isValidEmail   = (e)        => EMAIL_RE.test(e);

const makeJwt = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role ?? null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" }
  );

const generateOtp = () => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return String(OTP_MIN + (buf[0] % OTP_RANGE));
};

const hashOtp = (raw) =>
  nodeCrypto.createHash("sha256").update(String(raw)).digest("hex");

/* ════════════════════════════════════════════════════════════
   VALIDATION
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
  return null;
};

const validateLoginBody = (body) => {
  const { email, password } = body;
  if (!email || !password)
    return "Email and password are required.";
  if (!isValidEmail(normalizeEmail(email)))
    return "Please enter a valid email address.";
  return null;
};

/* ════════════════════════════════════════════════════════════
   REFERRAL — recordReferral
   ✅ Now accepts a DB client so it runs INSIDE the registration
      transaction. The referral row is committed atomically with
      the user row — no more timing / replication issues.
════════════════════════════════════════════════════════════ */
async function recordReferral(client, inviteCode, newUserId) {
  if (!inviteCode || !newUserId) return;

  const code = String(inviteCode).toUpperCase().trim();

  /* ── Find inviter ── */
  const { rows: [inviter] } = await client.query(
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
  const { rowCount: alreadyReferred } = await client.query(
    `SELECT 1 FROM referrals WHERE referee_id = $1 LIMIT 1`,
    [newUserId]
  );

  if (alreadyReferred) {
    console.warn(`[referral] user ${newUserId} already referred — skipping`);
    return;
  }

  /* ── Insert referral row ── */
  const { rows: [referral] } = await client.query(
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
  await client.query(
    `UPDATE users SET referred_by = $1 WHERE id = $2`,
    [inviter.id, newUserId]
  );

  /* ── Log signed_up event ── */
  await client.query(
    `INSERT INTO referral_events
       (referral_id, event_type, description, metadata)
     VALUES ($1, 'signed_up',
             'New user signed up using invite code',
             $2::JSONB)`,
    [
      referral.id,
      JSON.stringify({
        invite_code : code,
        inviter_id  : inviter.id,
        referee_id  : newUserId,
      }),
    ]
  );

  /* ── Increment inviter's total_referrals counter ── */
  await client.query(
    `UPDATE users
     SET total_referrals = COALESCE(total_referrals, 0) + 1
     WHERE id = $1`,
    [inviter.id]
  );

  console.log(
    `[referral] ✓ recorded  ` +
    `inviter=${inviter.id}  referee=${newUserId}  code=${code}`
  );
}

/* ════════════════════════════════════════════════════════════
   REFERRAL — grantReferralRewardOnVerify
   Called after email verification. Never throws.
════════════════════════════════════════════════════════════ */
async function grantReferralRewardOnVerify(verifiedUserId) {
  if (!verifiedUserId) return;

  try {
    const { rows: [referral] } = await pool.query(
      `SELECT id, inviter_id
       FROM   referrals
       WHERE  referee_id = $1
         AND  status     = 'pending'
       LIMIT  1`,
      [verifiedUserId]
    );

    if (!referral) return;

    /* Atomic — prevents double-grant */
    const { rowCount } = await pool.query(
      `UPDATE referrals
       SET    status      = 'verified',
              verified_at = NOW()
       WHERE  id     = $1
         AND  status = 'pending'`,
      [referral.id]
    );

    if (!rowCount) {
      console.warn(
        `[referral] referral ${referral.id} already processed — skipping`
      );
      return;
    }

    await pool.query(
      `INSERT INTO referral_events
         (referral_id, event_type, description)
       VALUES ($1, 'email_verified',
               'Referee verified their email address')`,
      [referral.id]
    );

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
  const cleanPhone      = phone_number?.trim() || null;
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

    /* ── 3. Validate invite code (if provided) ── */
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

    /* ── 5. Generate referral code for the new user ── */
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
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SAFE_FIELDS}`,
      [
        cleanName,
        cleanEmail,
        password_hash,
        cleanPhone,
        country         ?? null,
        state           ?? null,
        city            ?? null,
        newReferralCode,
      ]
    );

    /* ── 7. Record referral INSIDE the transaction ──
            ✅ Now uses the same client — committed atomically
               with the user row. No timing issues.            ── */
    if (cleanInviteCode) {
      try {
        await recordReferral(client, cleanInviteCode, user.id);
      } catch (refErr) {
        /* Non-fatal — log and continue */
        console.error(
          `[auth] recordReferral error (non-fatal): ${refErr.message}`
        );
      }
    }

    /* ── 8. Commit everything ── */
    await client.query("COMMIT");

    /* ── 9. Sign JWT ── */
    const token = makeJwt(user);

    /* ── 10. Generate & store OTP ── */
    const rawOtp  = generateOtp();
    const otpHash = hashOtp(rawOtp);

    try {
      await pool.query(
        `INSERT INTO email_verification_otps
           (user_id, otp_hash, expires_at)
         VALUES ($1, $2, NOW() + ($3 || ' minutes')::INTERVAL)`,
        [user.id, otpHash, String(OTP_EXPIRY_MINUTES)]
      );
    } catch (otpErr) {
      console.error(
        `[auth] OTP store failed (non-fatal): ${otpErr.message}`
      );
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

    /* ── 12. Dev output ── */
    if (!IS_PROD) {
      console.log("\n" + "═".repeat(60));
      console.log("[auth] 🔑  DEV — EMAIL VERIFICATION OTP");
      console.log(`   User ID     : ${user.id}`);
      console.log(`   Email       : ${user.email}`);
      console.log(`   OTP         : ${rawOtp}`);
      console.log(`   Expiry      : ${OTP_EXPIRY_MINUTES} minutes`);
      console.log(`   Referral    : ${newReferralCode  ?? "(none)"}`);
      console.log(`   Invite Code : ${cleanInviteCode  ?? "(none)"}`);
      console.log(`   Email sent  : ${emailSent}`);
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

    if (!IS_PROD && !emailSent) {
      responseBody.dev_otp  = rawOtp;
      responseBody.dev_hint =
        "Email delivery failed — use the OTP in the server console.";
    }

    return res.status(201).json(responseBody);

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});

    if (err.code === "23505") {
      const detail = (err.detail ?? "").toLowerCase();
      if (detail.includes("phone"))
        return fail(res, 409, "Phone number already registered.", {
          code: "PHONE_TAKEN",
        });
      if (detail.includes("referral_code"))
        return fail(res, 500,
          "Could not generate a unique referral code. Please try again.", {
            code: "REFERRAL_CODE_CONFLICT",
          });
      return fail(res, 409, "An account with this email already exists.", {
        code: "EMAIL_TAKEN",
      });
    }

    console.error(`[auth] register error: ${err.message}\n${err.stack}`);
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

  const validationError = validateLoginBody(req.body);
  if (validationError) return fail(res, 400, validationError);

  const cleanEmail = normalizeEmail(req.body.email);

  try {
    const { rows } = await pool.query(
      `SELECT ${SAFE_FIELDS}, password_hash
       FROM   users
       WHERE  email = $1`,
      [cleanEmail]
    );

    if (!rows.length)
      return fail(res, 401, "Invalid email or password.");

    const row = rows[0];

    if (BANNED_STATUSES.includes(row.status)) {
      return fail(res, 403,
        "Your account has been suspended. Please contact support.", {
          code: "ACCOUNT_SUSPENDED",
        });
    }

    const valid = await bcrypt.compare(req.body.password, row.password_hash);
    if (!valid)
      return fail(res, 401, "Invalid email or password.");

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

    const { password_hash, ...user } = row;
    const token = makeJwt(user);

    writeAudit({
      actorId    : user.id,
      action     : "user_login",
      targetType : "user",
      targetId   : user.id,
      ipAddress  : ip,
    }).catch((e) =>
      console.error(`[auth] audit write failed: ${e.message}`)
    );

    console.log(`[auth] ✓ login  user=${user.id}  email=${cleanEmail}`);

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