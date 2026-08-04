// ════════════════════════════════════════════════════════════
// FILE: routes/auth.routes.js
//
// POST /api/auth/register
// POST /api/auth/login
// ════════════════════════════════════════════════════════════

import express   from "express";
import bcrypt    from "bcrypt";
import jwt       from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { pool }  from "../config/db.js";

import { writeAudit }                 from "../lib/audit.js";
import { generateUniqueReferralCode } from "../lib/generateReferralCode.js";
import { sendEmailOtp }               from "../lib/sendEmailOtp.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ════════════════════════════════════════════════════════════
   STARTUP GUARDS
════════════════════════════════════════════════════════════ */
if (!process.env.JWT_SECRET) {
  throw new Error("[auth] FATAL: JWT_SECRET is not set.");
}

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const HASH_ROUNDS = Math.max(
  10,
  parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10)
);

const BANNED_STATUSES = Object.freeze(["banned", "suspended", "flagged"]);
const INVITE_CODE_RE  = /^[A-Z0-9]{4,20}$/;
const EMAIL_RE        = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ════════════════════════════════════════════════════════════
   ALLOWED TRAFFIC SOURCES
════════════════════════════════════════════════════════════ */
const ALLOWED_SOURCES = Object.freeze([
  // Social Media
  "tiktok",
  "instagram",
  "facebook",
  "twitter",
  "snapchat",
  "pinterest",
  "linkedin",
  "reddit",
  "youtube",
  "threads",

  // Messaging Apps
  "whatsapp",
  "telegram",
  "discord",
  "signal",
  "viber",
  "wechat",
  "slack",
  "line",
  "skype",
  "kakao",

  // Search Engines
  "google",
  "bing",
  "yahoo",
  "duckduckgo",

  // Other Traffic
  "email",
  "sms",
  "blog",
  "podcast",
  "referral",
  "direct",
  "other",
]);

/* Columns returned to the client — never add sensitive cols here */
const AUTH_FIELDS = `
  id, name, email, phone_number,
  country, state, city,
  profile_image,
  store_name, store_logo, store_verified,
  status, last_login,
  verified, "role",
  is_online, email_verified,
  seller_type, referral_code,
  source,
  created_at
`;

/* Extended projection used only in INSERT RETURNING */
const SAFE_FIELDS = `
  ${AUTH_FIELDS},
  store_description,
  rating, trust_score,
  products_count, total_sales, total_purchases,
  identity_verified,
  bonus_spins, total_referrals
`;

const AUTH_FIELD_NAMES = new Set([
  "id", "name", "email", "phone_number",
  "country", "state", "city",
  "profile_image",
  "store_name", "store_logo", "store_verified",
  "status", "last_login",
  "verified", "role",
  "is_online", "email_verified",
  "seller_type", "referral_code",
  "source",
  "created_at",
]);

/* Timing-safe dummy hash — used when email is not found at login */
const DUMMY_HASH =
  "$2b$12$invalidsaltinvalidsaltininvalidhashpadding000000000000";

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const getIp = (req) => {
  const raw =
    req.ip ??
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
    req.socket?.remoteAddress ??
    null;
  return raw?.replace(/^::ffff:/, "") ?? null;
};

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const normalizeEmail = (raw = "") => raw.trim().toLowerCase();
const isValidEmail   = (e)        => EMAIL_RE.test(e);
const nullIfEmpty    = (val)      =>
  val && String(val).trim() !== "" ? String(val).trim() : null;

const makeJwt = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role ?? null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" }
  );

/* Strip every column not in AUTH_FIELD_NAMES */
const toPublicUser = (row) =>
  Object.fromEntries(
    Object.entries(row).filter(([k]) => AUTH_FIELD_NAMES.has(k))
  );

/*
  cleanSource
  ─────────────────────────────────────────────────────────────
  Sanitises the raw utm_source value coming from the frontend.
  • Trims whitespace and lowercases
  • Only accepts values in ALLOWED_SOURCES
  • Falls back to "direct" for anything unknown or missing
  • Never throws — always returns a safe string
*/
const cleanSource = (raw) => {
  if (!raw) return "direct";
  const val = String(raw).trim().toLowerCase();
  return ALLOWED_SOURCES.includes(val) ? val : "direct";
};

/* ════════════════════════════════════════════════════════════
   STRUCTURED LOGGER
   info/dev  → silent in production (no PII in prod logs)
   warn/error → always emitted
════════════════════════════════════════════════════════════ */
const log = {
  info  : (...a) => { if (!IS_PROD) console.log(...a);  },
  warn  : (...a) =>               console.warn(...a),
  error : (...a) =>               console.error(...a),
  dev   : (...a) => { if (!IS_PROD) console.log(...a);  },
};

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
  if (invite_code && !INVITE_CODE_RE.test(String(invite_code).trim().toUpperCase()))
    return "Invalid invite code format.";

  return null;
};

const validateLoginBody = ({ email, password } = {}) => {
  if (!email || !password)    return "Email and password are required.";
  if (!isValidEmail(normalizeEmail(email)))
    return "Please enter a valid email address.";
  return null;
};

/* ════════════════════════════════════════════════════════════
   REFERRAL — recordReferral
   Runs INSIDE the registration transaction (same pg client).
════════════════════════════════════════════════════════════ */
async function recordReferral(client, inviteCode, newUserId) {
  if (!inviteCode || !newUserId) {
    log.warn("[referral] missing inviteCode or newUserId — aborting");
    return;
  }

  const code = String(inviteCode).toUpperCase().trim();

  /* 1. Find inviter */
  const { rows: [inviter] } = await client.query(
    `SELECT id, status FROM users WHERE referral_code = $1 LIMIT 1`,
    [code]
  );

  if (!inviter) {
    log.warn(`[referral] no user found with referral_code=${code}`);
    return;
  }

  if (String(inviter.id) === String(newUserId)) {
    log.warn("[referral] self-referral blocked");
    return;
  }

  if (BANNED_STATUSES.includes(inviter.status)) {
    log.warn(`[referral] inviter is ${inviter.status} — skipping`);
    return;
  }

  /* 2. Duplicate guard */
  const { rows: existing } = await client.query(
    `SELECT id FROM referrals
     WHERE referee_id = $1 OR invitee_id = $1
     LIMIT 1`,
    [newUserId]
  );

  if (existing.length > 0) {
    log.warn(`[referral] user ${newUserId} already has a referral — skipping`);
    return;
  }

  /* 3. Insert referral row */
  const { rows: [referral] } = await client.query(
    `INSERT INTO referrals
       (inviter_id, invitee_id, referee_id, invite_code,
        status, reward_type, reward_value)
     VALUES ($1, $2, $2, $3, 'pending', 'bonus_spin', 1)
     RETURNING id`,
    [inviter.id, newUserId, code]
  );

  if (!referral) {
    log.error("[referral] INSERT returned no row — unexpected");
    return;
  }

  log.info(`[referral] referral row inserted: id=${referral.id}`);

  /* 4. referred_by */
  try {
    await client.query(
      `UPDATE users SET referred_by = $1
       WHERE id = $2 AND referred_by IS NULL`,
      [inviter.id, newUserId]
    );
  } catch (e) {
    log.warn(`[referral] referred_by update skipped: ${e.message}`);
  }

  /* 5. Increment total_referrals */
  try {
    await client.query(
      `UPDATE users
       SET total_referrals = COALESCE(total_referrals, 0) + 1
       WHERE id = $1`,
      [inviter.id]
    );
  } catch (e) {
    log.warn(`[referral] total_referrals update skipped: ${e.message}`);
  }

  /* 6. signed_up event */
  try {
    await client.query(
      `INSERT INTO referral_events
         (referral_id, event_type, description, metadata)
       VALUES ($1, 'signed_up',
               'New user signed up using invite code', $2::JSONB)`,
      [
        referral.id,
        JSON.stringify({
          invite_code : code,
          inviter_id  : String(inviter.id),
          referee_id  : String(newUserId),
        }),
      ]
    );
  } catch (e) {
    log.warn(`[referral] event log skipped: ${e.message}`);
  }

  log.info(
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

  log.info(`[referral] grantReferralRewardOnVerify — user=${verifiedUserId}`);

  try {
    const { rows: [referral] } = await pool.query(
      `SELECT id, inviter_id FROM referrals
       WHERE (referee_id = $1 OR invitee_id = $1) AND status = 'pending'
       LIMIT 1`,
      [verifiedUserId]
    );

    if (!referral) {
      log.info(
        `[referral] no pending referral for user=${verifiedUserId} — skipping`
      );
      return;
    }

    /* Atomic: pending → verified */
    const { rowCount } = await pool.query(
      `UPDATE referrals
       SET status = 'verified', verified_at = now()
       WHERE id = $1 AND status = 'pending'`,
      [referral.id]
    );

    if (!rowCount) {
      log.warn(`[referral] referral ${referral.id} already processed`);
      return;
    }

    /* email_verified event */
    try {
      await pool.query(
        `INSERT INTO referral_events (referral_id, event_type, description)
         VALUES ($1, 'email_verified', 'Referee verified their email address')`,
        [referral.id]
      );
    } catch (e) {
      log.warn(`[referral] email_verified event log skipped: ${e.message}`);
    }

    await grantBonusSpin(referral.id, referral.inviter_id, verifiedUserId);

  } catch (err) {
    log.error(
      `[referral] grantReferralRewardOnVerify error (non-fatal): ` +
      `${err.message}\n${err.stack}`
    );
  }
}

/* ════════════════════════════════════════════════════════════
   grantBonusSpin — idempotent, only fires when status = 'verified'
════════════════════════════════════════════════════════════ */
async function grantBonusSpin(referralId, inviterId, refereeId) {
  const REWARD = 1;

  const { rowCount } = await pool.query(
    `UPDATE referrals
     SET status = 'rewarded', reward_value = $1, reward_given_at = now()
     WHERE id = $2 AND status = 'verified'`,
    [REWARD, referralId]
  );

  if (!rowCount) {
    log.warn(
      `[referral] grantBonusSpin — referral ${referralId} not in verified state`
    );
    return;
  }

  await pool.query(
    `UPDATE users SET bonus_spins = COALESCE(bonus_spins, 0) + $1
     WHERE id = $2`,
    [REWARD, inviterId]
  );

  try {
    await pool.query(
      `INSERT INTO referral_events
         (referral_id, event_type, description, metadata)
       VALUES ($1, 'reward_granted', 'Bonus spin awarded to inviter', $2::JSONB)`,
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
    log.warn(`[referral] reward_granted event log skipped: ${e.message}`);
  }

  log.info(
    `[referral] ✓ bonus spin granted  ` +
    `inviter=${inviterId}  referee=${refereeId}  +${REWARD} spin`
  );
}

/* ════════════════════════════════════════════════════════════
   RATE LIMITER
   Key: normalised email + IP
     • IP-only   → shared NAT blocks innocent users
     • email-only → attacker can enumerate existing accounts
     • email + IP → fair to legitimate users, hard to abuse
════════════════════════════════════════════════════════════ */
const authLimiter = rateLimit({
  windowMs        : 15 * 60 * 1_000,
  max             : IS_PROD ? 10 : 500,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) => {
    const email = normalizeEmail(req.body?.email ?? "");
    const ip    = getIp(req) ?? "unknown";
    return `${email}::${ip}`;
  },
  handler : (_req, res) =>
    res.status(429).json({
      success : false,
      message : "Too many attempts. Please try again later.",
    }),
});

/* ════════════════════════════════════════════════════════════
   POST /api/auth/register
════════════════════════════════════════════════════════════ */
router.post("/register", authLimiter, async (req, res, next) => {
  const ip = getIp(req);

  log.dev("[auth] register body received:", {
    name         : req.body.name,
    email        : req.body.email,
    phone_number : req.body.phone_number,
    country      : req.body.country,
    invite_code  : req.body.invite_code  ?? "(not sent)",
    source       : req.body.source       ?? "(not sent)",
  });

  /* 1. Validate */
  const validationError = validateRegisterBody(req.body);
  if (validationError) return fail(res, 400, validationError);

  const {
    name, email, password,
    phone_number, country, state, city,
    invite_code,
    source,
  } = req.body;

  const cleanEmail      = normalizeEmail(email);
  const cleanName       = name.trim();
  const cleanPhone      = nullIfEmpty(phone_number);
  const cleanInviteCode = invite_code
    ? String(invite_code).trim().toUpperCase()
    : null;
  const cleanSourceVal  = cleanSource(source);

  log.info(
    `[auth] register — email=${cleanEmail}  ` +
    `invite_code=${cleanInviteCode ?? "(none)"}  ` +
    `source=${cleanSourceVal}`
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* 2. Duplicate email check */
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

    /* 3. Validate invite code */
    if (cleanInviteCode) {
      const { rowCount: codeValid } = await client.query(
        `SELECT 1 FROM users
         WHERE referral_code = $1
           AND status NOT IN ('banned', 'suspended', 'flagged')`,
        [cleanInviteCode]
      );

      if (!codeValid) {
        log.warn(`[auth] invite code ${cleanInviteCode} not found`);
        await client.query("ROLLBACK");
        return fail(res, 400, "Invalid or expired invite code.", {
          code: "INVALID_INVITE_CODE",
        });
      }
    }

    /* 4. Hash password */
    const password_hash = await bcrypt.hash(password, HASH_ROUNDS);

    /* 5. Generate referral code */
    let newReferralCode = null;
    try {
      newReferralCode = await generateUniqueReferralCode();
    } catch (genErr) {
      log.error(
        `[auth] referral code gen failed (non-fatal): ${genErr.message}`
      );
    }

    /* 6. Insert user — source column included */
    const { rows: [userRow] } = await client.query(
      `INSERT INTO users
         (name, email, password_hash, phone_number,
          country, state, city, referral_code,
          source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${SAFE_FIELDS}`,
      [
        cleanName,
        cleanEmail,
        password_hash,
        cleanPhone,
        nullIfEmpty(country),
        nullIfEmpty(state),
        nullIfEmpty(city),
        newReferralCode,
        cleanSourceVal,
      ]
    );

    log.info(`[auth] user inserted: id=${userRow.id}  source=${userRow.source}`);

    /* 7. Record referral (inside transaction) */
    if (cleanInviteCode) {
      try {
        await recordReferral(client, cleanInviteCode, userRow.id);
      } catch (refErr) {
        log.error(
          `[auth] recordReferral threw (non-fatal): ` +
          `${refErr.message}\n${refErr.stack}`
        );
      }
    }

    /* 8. Commit */
    await client.query("COMMIT");
    log.info(`[auth] transaction committed for user=${userRow.id}`);

    /* 9. JWT */
    const token = makeJwt(userRow);

    /* 10. Send OTP via shared sender
       NOTE: sendEmailOtp writes a bcrypt-hashed row to
       email_verifications — the same table and algorithm
       that /verify-email-otp reads. Do NOT generate OTPs
       inline here or the hashing algorithm will mismatch. */
    const otpResult = await sendEmailOtp({
      userId : userRow.id,
      email  : userRow.email,
      name   : userRow.name,
      req,
      ip,
    });

    const emailSent = otpResult.success;

    /* 11. Dev console output */
    log.dev(
      "\n" + "═".repeat(60) + "\n" +
      "[auth] 🔑  DEV — EMAIL VERIFICATION OTP\n" +
      `   User ID     : ${userRow.id}\n` +
      `   Email       : ${userRow.email}\n` +
      `   OTP         : ${otpResult.dev_otp ?? "(check email)"}\n` +
      `   Expiry      : 10 minutes\n` +
      `   Referral    : ${newReferralCode  ?? "(none — gen failed)"}\n` +
      `   Invite Code : ${cleanInviteCode  ?? "(none)"}\n` +
      `   Source      : ${cleanSourceVal}\n` +
      `   Email sent  : ${emailSent}\n` +
      (otpResult.error ? `   OTP error   : ${otpResult.error}\n` : "") +
      "═".repeat(60)
    );

    /* 12. Audit */
    writeAudit({
      actorId    : userRow.id,
      action     : "user_registered",
      targetType : "user",
      targetId   : userRow.id,
      ipAddress  : ip,
      metadata   : {
        invite_code   : cleanInviteCode  ?? null,
        referral_code : newReferralCode  ?? null,
        email_sent    : emailSent,
        source        : cleanSourceVal,
      },
    }).catch((e) => log.error(`[auth] audit failed: ${e.message}`));

    log.info(
      `[auth] ✓ registered  user=${userRow.id}  email=${cleanEmail}` +
      (cleanInviteCode ? `  invite=${cleanInviteCode}`   : "") +
      (newReferralCode ? `  referral=${newReferralCode}` : "") +
      `  source=${cleanSourceVal}`
    );

    /* 13. Response */
    const publicUser = toPublicUser(userRow);

    const body = {
      success             : true,
      message             : "Account created successfully.",
      token,
      user                : publicUser,
      requires_otp_resend : !emailSent,
    };

    if (!IS_PROD) {
      if (otpResult.dev_otp) body.dev_otp  = otpResult.dev_otp;
      if (!emailSent)        body.dev_hint = otpResult.error ?? "OTP send failed.";
    }

    return res.status(201).json(body);

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});

    const isDuplicate =
      err.code === "23505" ||
      err.message?.toLowerCase().includes("duplicate key");

    if (isDuplicate) {
      const CONSTRAINT_MAP = {
        users_email_key : {
          status : 409,
          msg    : "An account with this email already exists.",
          code   : "EMAIL_TAKEN",
        },
        users_phone_key : {
          status : 409,
          msg    : "Phone number already registered.",
          code   : "PHONE_TAKEN",
        },
        users_referral_code_key : {
          status : 500,
          msg    : "Could not generate a unique referral code. Please try again.",
          code   : "REFERRAL_CODE_CONFLICT",
        },
        referrals_referee_unique : { status: 200, msg: null },
      };

      const mapped = CONSTRAINT_MAP[err.constraint];
      if (mapped) {
        if (!mapped.msg) {
          log.warn("[auth] duplicate referee constraint hit — referral skipped");
          return res.status(201).json({
            success : true,
            message : "Account created successfully.",
          });
        }
        return fail(res, mapped.status, mapped.msg, { code: mapped.code });
      }

      /* CockroachDB / unnamed constraint fallback */
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
      if (detail.includes("referee") || detail.includes("invitee")) {
        log.warn("[auth] duplicate referee constraint hit — referral skipped");
        return res.status(201).json({
          success : true,
          message : "Account created successfully.",
        });
      }

      return fail(res, 409, "An account with this email already exists.", {
        code: "EMAIL_TAKEN",
      });
    }

    log.error(`[auth] register error: ${err.message}\n${err.stack}`);
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
      `SELECT ${AUTH_FIELDS}, password_hash
       FROM   users
       WHERE  email = $1`,
      [cleanEmail]
    );

    /*
      Timing-safe: always run bcrypt even when email is not found.
      An early return here would be ~1 ms vs ~100 ms for bcrypt —
      trivially detectable via response-time measurement.
    */
    const row         = rows[0] ?? null;
    const hashToCheck = row ? row.password_hash : DUMMY_HASH;
    const valid       = await bcrypt.compare(req.body.password, hashToCheck);

    if (!row || !valid)
      return fail(res, 401, "Invalid email or password.");

    if (BANNED_STATUSES.includes(row.status))
      return fail(res, 403,
        "Your account has been suspended. Please contact support.", {
          code: "ACCOUNT_SUSPENDED",
        }
      );

    /* Fire-and-forget — does not block the response */
    pool.query(
      `UPDATE users SET last_login = now(), is_online = true WHERE id = $1`,
      [row.id]
    ).catch((e) => log.error(`[auth] last_login update failed: ${e.message}`));

    const { password_hash: _ph, ...fullRow } = row;
    const publicUser = toPublicUser(fullRow);
    const token      = makeJwt(publicUser);

    writeAudit({
      actorId    : publicUser.id,
      action     : "user_login",
      targetType : "user",
      targetId   : publicUser.id,
      ipAddress  : ip,
    }).catch((e) => log.error(`[auth] audit failed: ${e.message}`));

    log.info(`[auth] ✓ login  user=${publicUser.id}  email=${cleanEmail}`);

    return res.json({
      success : true,
      message : "Login successful.",
      token,
      user    : publicUser,
    });

  } catch (err) {
    log.error(`[auth] login error: ${err.message}\n${err.stack}`);
    next(err);
  }
});

/* ════════════════════════════════════════════════════════════
   EXPORTS
════════════════════════════════════════════════════════════ */
export { grantReferralRewardOnVerify };
export default router;