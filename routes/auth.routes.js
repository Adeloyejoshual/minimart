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

   Runs INSIDE the registration transaction (same pg client).
   Uses the exact schema from your exported table:
     inviter_id  UUID NOT NULL
     invitee_id  UUID NOT NULL  ← legacy NOT NULL col
     referee_id  UUID NULL      ← new col, used everywhere
     invite_code VARCHAR(20)
     status      VARCHAR(20)    DEFAULT 'pending'
     reward_type VARCHAR(30)    DEFAULT 'bonus_spin'
     reward_value DECIMAL(12,2)

   Both invitee_id AND referee_id are written on every insert
   so the NOT NULL constraint is satisfied and all new queries
   work against referee_id.

   NO ON CONFLICT clause — the unique index does not exist yet.
   Duplicate prevention is done with an explicit SELECT first.
════════════════════════════════════════════════════════════ */
async function recordReferral(client, inviteCode, newUserId) {
  /* ── Entry log — confirms function was called ── */
  console.log("[referral] recordReferral() called");
  console.log("[referral]   invite_code :", inviteCode);
  console.log("[referral]   new_user_id :", newUserId);

  if (!inviteCode || !newUserId) {
    console.warn("[referral] missing inviteCode or newUserId — aborting");
    return;
  }

  const code = String(inviteCode).toUpperCase().trim();

  /* ── 1. Find inviter ── */
  console.log("[referral] looking up inviter by referral_code:", code);

  const { rows: [inviter] } = await client.query(
    `SELECT id, status
     FROM   users
     WHERE  referral_code = $1
     LIMIT  1`,
    [code]
  );

  if (!inviter) {
    console.warn(`[referral] no user found with referral_code=${code}`);
    return;
  }

  console.log(`[referral] inviter found: id=${inviter.id} status=${inviter.status}`);

  /* ── 2. Guards ── */
  if (String(inviter.id) === String(newUserId)) {
    console.warn("[referral] self-referral blocked");
    return;
  }

  if (BANNED_STATUSES.includes(inviter.status)) {
    console.warn(`[referral] inviter is ${inviter.status} — skipping`);
    return;
  }

  /* ── 3. Duplicate check — check BOTH columns ── */
  const { rows: existing } = await client.query(
    `SELECT id
     FROM   referrals
     WHERE  referee_id  = $1
        OR  invitee_id  = $1
     LIMIT  1`,
    [newUserId]
  );

  if (existing.length > 0) {
    console.warn(`[referral] user ${newUserId} already has a referral — skipping`);
    return;
  }

  /* ── 4. Insert referral — NO ON CONFLICT clause ──
          Writes both invitee_id (NOT NULL) and referee_id.  ── */
  console.log("[referral] inserting referral row...");

  const { rows: [referral] } = await client.query(
    `INSERT INTO referrals
       (inviter_id,  invitee_id, referee_id,
        invite_code, status,
        reward_type, reward_value)
     VALUES
       ($1, $2, $2,
        $3, 'pending',
        'bonus_spin', 1)
     RETURNING id`,
    [inviter.id, newUserId, code]
  );

  if (!referral) {
    console.error("[referral] INSERT returned no row — unexpected");
    return;
  }

  console.log(`[referral] referral row inserted: id=${referral.id}`);

  /* ── 5. Store referred_by on new user (if column exists) ── */
  try {
    await client.query(
      `UPDATE users
       SET    referred_by = $1
       WHERE  id          = $2
         AND  referred_by IS NULL`,
      [inviter.id, newUserId]
    );
    console.log(`[referral] referred_by set on user ${newUserId}`);
  } catch (e) {
    /* Column may not exist — non-fatal */
    console.warn(`[referral] referred_by update skipped: ${e.message}`);
  }

  /* ── 6. Increment inviter's total_referrals ── */
  try {
    await client.query(
      `UPDATE users
       SET    total_referrals = COALESCE(total_referrals, 0) + 1
       WHERE  id = $1`,
      [inviter.id]
    );
    console.log(`[referral] total_referrals incremented for inviter ${inviter.id}`);
  } catch (e) {
    console.warn(`[referral] total_referrals update skipped: ${e.message}`);
  }

  /* ── 7. Log signed_up event ── */
  try {
    await client.query(
      `INSERT INTO referral_events
         (referral_id, event_type, description, metadata)
       VALUES
         ($1, 'signed_up',
          'New user signed up using invite code',
          $2::JSONB)`,
      [
        referral.id,
        JSON.stringify({
          invite_code : code,
          inviter_id  : String(inviter.id),
          referee_id  : String(newUserId),
        }),
      ]
    );
    console.log(`[referral] signed_up event logged for referral ${referral.id}`);
  } catch (e) {
    /* referral_events may not exist — non-fatal */
    console.warn(`[referral] event log skipped: ${e.message}`);
  }

  console.log(
    `[referral] ✓ DONE  inviter=${inviter.id}  ` +
    `referee=${newUserId}  code=${code}  referral_id=${referral.id}`
  );
}

/* ════════════════════════════════════════════════════════════
   REFERRAL — grantReferralRewardOnVerify
   Called after email verification. Never throws.
════════════════════════════════════════════════════════════ */
async function grantReferralRewardOnVerify(verifiedUserId) {
  if (!verifiedUserId) return;

  console.log(`[referral] grantReferralRewardOnVerify called — user=${verifiedUserId}`);

  try {
    /* Check both columns for compatibility */
    const { rows: [referral] } = await pool.query(
      `SELECT id, inviter_id
       FROM   referrals
       WHERE  (referee_id = $1 OR invitee_id = $1)
         AND  status = 'pending'
       LIMIT  1`,
      [verifiedUserId]
    );

    if (!referral) {
      console.log(`[referral] no pending referral for user=${verifiedUserId} — skipping`);
      return;
    }

    console.log(`[referral] found pending referral=${referral.id}`);

    /* Atomic transition — only succeeds once */
    const { rowCount } = await pool.query(
      `UPDATE referrals
       SET    status      = 'verified',
              verified_at = now()
       WHERE  id     = $1
         AND  status = 'pending'`,
      [referral.id]
    );

    if (!rowCount) {
      console.warn(`[referral] referral ${referral.id} already processed`);
      return;
    }

    /* Log email_verified event */
    try {
      await pool.query(
        `INSERT INTO referral_events
           (referral_id, event_type, description)
         VALUES ($1, 'email_verified',
                 'Referee verified their email address')`,
        [referral.id]
      );
    } catch (e) {
      console.warn(`[referral] email_verified event log skipped: ${e.message}`);
    }

    /* Grant bonus spin */
    await grantBonusSpin(referral.id, referral.inviter_id, verifiedUserId);

  } catch (err) {
    console.error(
      `[referral] grantReferralRewardOnVerify error (non-fatal): ` +
      `${err.message}\n${err.stack}`
    );
  }
}

/* ════════════════════════════════════════════════════════════
   grantBonusSpin
   Inline reward — no DB stored procedure needed.
   Idempotent: only fires when status = 'verified'.
════════════════════════════════════════════════════════════ */
async function grantBonusSpin(referralId, inviterId, refereeId) {
  const REWARD = 1;

  const { rowCount } = await pool.query(
    `UPDATE referrals
     SET    status          = 'rewarded',
            reward_value    = $1,
            reward_given_at = now()
     WHERE  id     = $2
       AND  status = 'verified'`,
    [REWARD, referralId]
  );

  if (!rowCount) {
    console.warn(
      `[referral] grantBonusSpin — referral ${referralId} not in verified state`
    );
    return;
  }

  /* Credit inviter */
  await pool.query(
    `UPDATE users
     SET    bonus_spins = COALESCE(bonus_spins, 0) + $1
     WHERE  id = $2`,
    [REWARD, inviterId]
  );

  /* Log reward_granted event */
  try {
    await pool.query(
      `INSERT INTO referral_events
         (referral_id, event_type, description, metadata)
       VALUES ($1, 'reward_granted',
               'Bonus spin awarded to inviter',
               $2::JSONB)`,
      [
        referralId,
        JSON.stringify({
          inviter_id   : String(inviterId),
          referee_id   : String(refereeId),
          reward_value : REWARD,
        }),
      ]
    );
  } catch (e) {
    console.warn(`[referral] reward_granted event log skipped: ${e.message}`);
  }

  console.log(
    `[referral] ✓ bonus spin granted  ` +
    `inviter=${inviterId}  referee=${refereeId}  +${REWARD} spin`
  );
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

  /* ── Log raw body in dev so we can confirm invite_code arrives ── */
  if (!IS_PROD) {
    console.log("[auth] register body received:", {
      name         : req.body.name,
      email        : req.body.email,
      phone_number : req.body.phone_number,
      country      : req.body.country,
      invite_code  : req.body.invite_code ?? "(not sent)",
    });
  }

  /* ── 1. Validate ── */
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

  /* ── Log whether invite code is present ── */
  console.log(
    `[auth] register — email=${cleanEmail}  ` +
    `invite_code=${cleanInviteCode ?? "(none)"}`
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── 2. Duplicate email ── */
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

    /* ── 3. Validate invite code exists ── */
    if (cleanInviteCode) {
      console.log(`[auth] validating invite code: ${cleanInviteCode}`);

      const { rowCount: codeValid } = await client.query(
        `SELECT 1
         FROM   users
         WHERE  referral_code = $1
           AND  status NOT IN ('banned', 'suspended', 'flagged')`,
        [cleanInviteCode]
      );

      if (!codeValid) {
        console.warn(`[auth] invite code ${cleanInviteCode} not found in users`);
        await client.query("ROLLBACK");
        return fail(res, 400, "Invalid or expired invite code.", {
          code: "INVALID_INVITE_CODE",
        });
      }

      console.log(`[auth] invite code ${cleanInviteCode} is valid`);
    }

    /* ── 4. Hash password ── */
    const password_hash = await bcrypt.hash(password, HASH_ROUNDS);

    /* ── 5. Generate referral code for new user ── */
    let newReferralCode = null;
    try {
      newReferralCode = await generateUniqueReferralCode();
      console.log(`[auth] generated referral code for new user: ${newReferralCode}`);
    } catch (genErr) {
      console.error(
        `[auth] referral code gen failed (non-fatal): ${genErr.message}`
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

    console.log(`[auth] user inserted: id=${user.id}`);

    /* ── 7. Record referral — inside transaction ──
            ✅ Same client = committed atomically with user row
            ✅ Writes both invitee_id (NOT NULL) + referee_id
            ✅ No ON CONFLICT — explicit duplicate check first
            ✅ Every step has its own try/catch so one failure
               doesn't abort the whole registration           ── */
    if (cleanInviteCode) {
      console.log(
        `[auth] calling recordReferral — code=${cleanInviteCode} user=${user.id}`
      );
      try {
        await recordReferral(client, cleanInviteCode, user.id);
      } catch (refErr) {
        /* Non-fatal — user is registered even if referral fails */
        console.error(
          `[auth] recordReferral threw (non-fatal): ` +
          `${refErr.message}\n${refErr.stack}`
        );
      }
    } else {
      console.log("[auth] no invite code — skipping recordReferral");
    }

    /* ── 8. Commit ── */
    await client.query("COMMIT");
    console.log(`[auth] transaction committed for user=${user.id}`);

    /* ── 9. JWT ── */
    const token = makeJwt(user);

    /* ── 10. OTP ── */
    const rawOtp  = generateOtp();
    const otpHash = hashOtp(rawOtp);

    try {
      await pool.query(
        `INSERT INTO email_verification_otps
           (user_id, otp_hash, expires_at)
         VALUES ($1, $2, now() + ($3 || ' minutes')::INTERVAL)`,
        [user.id, otpHash, String(OTP_EXPIRY_MINUTES)]
      );
      console.log(`[auth] OTP stored for user=${user.id}`);
    } catch (otpErr) {
      console.error(`[auth] OTP store failed (non-fatal): ${otpErr.message}`);
    }

    /* ── 11. Send email ── */
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
      console.log(`   Referral    : ${newReferralCode  ?? "(none — gen failed)"}`);
      console.log(`   Invite Code : ${cleanInviteCode  ?? "(none)"}`);
      console.log(`   Email sent  : ${emailSent}`);
      console.log("═".repeat(60) + "\n");
    }

    /* ── 13. Audit ── */
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
    }).catch((e) => console.error(`[auth] audit failed: ${e.message}`));

    console.log(
      `[auth] ✓ registered  user=${user.id}  email=${cleanEmail}` +
      (cleanInviteCode ? `  invite=${cleanInviteCode}`   : "") +
      (newReferralCode ? `  referral=${newReferralCode}` : "")
    );

    /* ── 14. Response ── */
    const body = {
      success : true,
      message : "Account created successfully.",
      token,
      user,
    };

    if (!IS_PROD && !emailSent) {
      body.dev_otp  = rawOtp;
      body.dev_hint =
        "Email delivery failed — use the OTP in the server console.";
    }

    return res.status(201).json(body);

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});

    /* CockroachDB uses "duplicate key" in message, not err.code === "23505" */
    const isDuplicate =
      err.code === "23505" ||
      err.message?.toLowerCase().includes("duplicate key");

    if (isDuplicate) {
      const detail = (err.detail ?? err.message ?? "").toLowerCase();

      if (detail.includes("phone"))
        return fail(res, 409, "Phone number already registered.", {
          code: "PHONE_TAKEN",
        });

      if (detail.includes("referral_code"))
        return fail(res, 500,
          "Could not generate a unique referral code. Please try again.", {
            code: "REFERRAL_CODE_CONFLICT",
          });

      /* referee_id / invitee_id duplicate means already referred —
         this should not reach here because we check first, but just in case */
      if (detail.includes("referee") || detail.includes("invitee")) {
        console.warn("[auth] duplicate referee constraint hit — referral skipped");
        /* Don't fail the whole registration for this */
      } else {
        return fail(res, 409, "An account with this email already exists.", {
          code: "EMAIL_TAKEN",
        });
      }
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
        }
      );
    }

    const valid = await bcrypt.compare(req.body.password, row.password_hash);
    if (!valid)
      return fail(res, 401, "Invalid email or password.");

    pool.query(
      `UPDATE users
       SET    last_login = now(),
              is_online  = true
       WHERE  id = $1`,
      [row.id]
    ).catch((e) =>
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
    }).catch((e) => console.error(`[auth] audit failed: ${e.message}`));

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