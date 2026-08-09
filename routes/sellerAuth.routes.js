/**
 * routes/sellerAuth.routes.js
 * ─────────────────────────────────────────────────────────────
 * Seller authentication — operates on market.users ONLY.
 * Never reads or writes public.users or password_reset_otps.
 *
 * market.users confirmed columns:
 *   id, name, email, password_hash, phone_number,
 *   country, city, profile_image, verified, status,
 *   created_at, updated_at, is_verified,
 *   verify_code, verify_expires, reset_code, reset_expires
 *
 * NOTE: column is "name"   NOT "full_name"
 *       column is "status" NOT "is_active"
 *       status values: 'active' | 'suspended' | 'banned'
 *
 * Routes:
 *   GET  /health
 *   GET  /debug/:email          (dev only)
 *   POST /debug/test-login      (dev only)
 *   POST /register
 *   POST /verify-email
 *   POST /resend-verification
 *   POST /login
 *   POST /forgot-password
 *   POST /verify-reset-code
 *   POST /reset-password
 *   GET  /me
 *
 * TOKEN KEY:
 *   JWT signed with { id, email } from market.users.
 *   Frontend MUST store as localStorage.setItem("sellerToken", data.token)
 *   PostAds.jsx reads "sellerToken" → sends to POST /api/products
 *   → authenticateSeller → req.user.id = market.users.id ✓
 * ─────────────────────────────────────────────────────────────
 */

import express  from "express";
import bcrypt   from "bcrypt";
import jwt      from "jsonwebtoken";
import { pool } from "../config/db.js";
import { generateOTP, hashCode } from "../utils/token.js";
import {
  sendVerificationCode,
  sendPasswordResetCode,
} from "../services/notificationService.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   CONFIG
════════════════════════════════════════════════════════════ */
const JWT_SECRET        = process.env.JWT_SECRET     || "supersecretkey";
const JWT_EXPIRES_IN    = process.env.JWT_EXPIRES_IN || "7d";
const BCRYPT_ROUNDS     = 12;
const OTP_TTL_MS        = 60 * 60_000;    // 1 hour
const RESET_TTL_MS      = 15 * 60_000;    // 15 minutes
const RATE_WINDOW_MS    = 15 * 60_000;
const RATE_MAX_ATTEMPTS = 10;
const EMAIL_RX          = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IS_DEV            = process.env.NODE_ENV !== "production";

/*
 * SELLER TOKEN STORAGE KEY
 * Frontend must store the JWT under this exact key:
 *   localStorage.setItem("sellerToken", data.token)
 *
 * Using "token" instead would overwrite the marketplace JWT
 * and cause public.users.id to be stored in market.products.user_id
 * — the seller's inventory would show 0 products.
 */
const SELLER_TOKEN_KEY = "sellerToken";

const L = (scope) => `[seller-auth][${scope}]`;

/* ════════════════════════════════════════════════════════════
   SCHEMA SELF-HEAL
   Runs once on import. Creates OTP columns if missing.
════════════════════════════════════════════════════════════ */
const REQUIRED_OTP_COLUMNS = [
  "verify_code",
  "verify_expires",
  "reset_code",
  "reset_expires",
];

let schemaReady  = false;
let schemaError  = null;
let schemaReport = null;

async function ensureOtpColumns() {
  try {
    const { rows: existing } = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'market'
         AND table_name   = 'users'
         AND column_name  = ANY($1::text[])`,
      [REQUIRED_OTP_COLUMNS]
    );

    const found   = existing.map((r) => r.column_name);
    const missing = REQUIRED_OTP_COLUMNS.filter((c) => !found.includes(c));

    console.log(`${L("schema")} OTP columns present:`, found);

    if (missing.length) {
      console.warn(`${L("schema")} ⚠️  MISSING columns:`, missing);
      await pool.query(`
        ALTER TABLE market.users
          ADD COLUMN IF NOT EXISTS verify_code    TEXT,
          ADD COLUMN IF NOT EXISTS verify_expires TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS reset_code     TEXT,
          ADD COLUMN IF NOT EXISTS reset_expires  TIMESTAMPTZ
      `);
      console.log(`${L("schema")} ✅ Columns created:`, missing);
    }

    const { rows: after } = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'market'
         AND table_name   = 'users'
         AND column_name  = ANY($1::text[])
       ORDER BY column_name`,
      [REQUIRED_OTP_COLUMNS]
    );

    schemaReport = {
      required : REQUIRED_OTP_COLUMNS,
      present  : after.map((r) => ({ name: r.column_name, type: r.data_type })),
      missing  : REQUIRED_OTP_COLUMNS.filter(
        (c) => !after.some((r) => r.column_name === c)
      ),
      healed   : missing,
    };

    schemaReady = schemaReport.missing.length === 0;

    if (schemaReady) {
      console.log(`${L("schema")} ✅ All OTP columns ready`);
    } else {
      console.error(`${L("schema")} ❌ Still missing:`, schemaReport.missing);
    }

  } catch (err) {
    schemaError = err.message;
    console.error(`${L("schema")} ❌ ensureOtpColumns failed:`, err.message);
    console.error(`${L("schema")} Run this SQL manually:
      ALTER TABLE market.users
        ADD COLUMN IF NOT EXISTS verify_code    TEXT,
        ADD COLUMN IF NOT EXISTS verify_expires TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS reset_code     TEXT,
        ADD COLUMN IF NOT EXISTS reset_expires  TIMESTAMPTZ;
    `);
  }
}

ensureOtpColumns();

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const cleanEmail = (raw) => raw?.trim().toLowerCase() ?? "";

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const genericOk = (res, message) =>
  res.json({ success: true, message });

const maskEmail = (e) => {
  if (!e?.includes("@")) return "***";
  const [u, d] = e.split("@");
  return `${u.slice(0, 2)}${"*".repeat(Math.max(u.length - 2, 1))}@${d}`;
};

/**
 * Persist an OTP and confirm the write succeeded.
 * Returns { ok, hasCode, expires }.
 */
async function persistOtp({ userId, column, hashedCode, expires }) {
  const codeCol    = column === "verify" ? "verify_code"    : "reset_code";
  const expiresCol = column === "verify" ? "verify_expires" : "reset_expires";

  const { rows } = await pool.query(
    `UPDATE market.users
     SET ${codeCol} = $1, ${expiresCol} = $2
     WHERE id = $3
     RETURNING id,
               ${codeCol}    IS NOT NULL AS has_code,
               ${expiresCol} AS expires_at`,
    [hashedCode, expires, userId]
  );

  const row = rows[0];
  return {
    ok     : Boolean(row?.has_code),
    hasCode: Boolean(row?.has_code),
    expires: row?.expires_at ?? null,
  };
}

/**
 * Wrap an email send so a mail failure never breaks the request.
 */
async function trySendMail(label, fn, args) {
  try {
    const result = await fn(args);
    if (result) {
      console.log(`${L(label)} ✅ email queued, id:`, result?.id ?? "(no id)");
      return { sent: true, id: result?.id ?? null, error: null };
    }
    console.warn(`${L(label)} ⚠️  email returned null — check RESEND_API_KEY`);
    return { sent: false, id: null, error: "mail_returned_null" };
  } catch (err) {
    console.error(`${L(label)} ❌ email threw:`, err.message);
    return { sent: false, id: null, error: err.message };
  }
}

/* ════════════════════════════════════════════════════════════
   RATE LIMITER — in-memory, per IP
════════════════════════════════════════════════════════════ */
const _attempts = new Map();

const getIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
  req.socket.remoteAddress ??
  "unknown";

const authLimiter = (req, res, next) => {
  const ip  = getIp(req);
  const now = Date.now();
  const key = `seller-auth:${ip}`;
  let   rec = _attempts.get(key);

  if (!rec || now - rec.time > RATE_WINDOW_MS) {
    rec = { count: 1, time: now };
  } else {
    rec.count++;
  }

  _attempts.set(key, rec);

  if (rec.count > RATE_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil(
      (RATE_WINDOW_MS - (now - rec.time)) / 1000
    );
    console.warn(`${L("rate-limit")} 429 ip=${ip} count=${rec.count}`);
    return res.status(429).json({
      success    : false,
      message    : "Too many attempts. Please wait 15 minutes and try again.",
      retryAfter,
    });
  }

  next();
};

const clearRateLimit = (req) =>
  _attempts.delete(`seller-auth:${getIp(req)}`);

/* ════════════════════════════════════════════════════════════
   GET /health
════════════════════════════════════════════════════════════ */
router.get("/health", async (_req, res) => {
  const report = {
    ok   : true,
    time : new Date().toISOString(),

    email: {
      resend_api_key_set : Boolean(process.env.RESEND_API_KEY),
      resend_key_prefix  : process.env.RESEND_API_KEY
        ? process.env.RESEND_API_KEY.slice(0, 5) + "…"
        : null,
      from_address  : process.env.EMAIL_FROM    ?? "(default) Loemart <no-reply@loemart.com>",
      support_email : process.env.EMAIL_SUPPORT ?? "(default) support@loemart.com",
      brand         : process.env.EMAIL_BRAND   ?? "(default) Loemart",
      app_url       : process.env.APP_URL       ?? "(default) https://loemart.com",
    },

    auth: {
      jwt_secret_set     : Boolean(process.env.JWT_SECRET),
      jwt_using_fallback : !process.env.JWT_SECRET,
      jwt_expires_in     : JWT_EXPIRES_IN,
      bcrypt_rounds      : BCRYPT_ROUNDS,
      node_env           : process.env.NODE_ENV ?? "(not set)",
      frontend_token_key : SELLER_TOKEN_KEY,
    },

    schema: {
      ready  : schemaReady,
      error  : schemaError,
      detail : schemaReport,
    },

    database: null,
  };

  try {
    const { rows } = await pool.query("SELECT NOW() AS now");
    report.database = { connected: true, server_time: rows[0].now };
  } catch (err) {
    report.database = { connected: false, error: err.message };
    report.ok = false;
  }

  const warnings = [];
  if (!process.env.RESEND_API_KEY)
    warnings.push("RESEND_API_KEY is not set — no emails will ever send");
  if (!process.env.JWT_SECRET)
    warnings.push("JWT_SECRET is not set — using insecure fallback");
  if (!schemaReady)
    warnings.push("OTP columns missing on market.users — OTPs cannot be stored");

  report.warnings = warnings;
  report.ok       = report.ok && warnings.length === 0;

  return res.json(report);
});

/* ════════════════════════════════════════════════════════════
   GET /debug/:email                               (dev only)
════════════════════════════════════════════════════════════ */
router.get("/debug/:email", async (req, res) => {
  if (!IS_DEV) return res.status(404).json({ message: "Not found" });

  const email_ = cleanEmail(req.params.email);

  try {
    const { rows } = await pool.query(
      `SELECT
         id,
         name,
         email,
         status,
         is_verified,
         LEFT(password_hash, 7)     AS hash_prefix,
         LENGTH(password_hash)      AS hash_length,
         verify_code   IS NOT NULL  AS has_verify_code,
         verify_expires,
         verify_expires > NOW()     AS verify_code_still_valid,
         reset_code    IS NOT NULL  AS has_reset_code,
         reset_expires,
         reset_expires > NOW()      AS reset_code_still_valid,
         created_at
       FROM market.users
       WHERE email = $1`,
      [email_]
    );

    if (!rows.length) {
      return res.json({
        found   : false,
        email   : email_,
        message : "No account found in market.users with this email",
      });
    }

    const u = rows[0];
    return res.json({
      found       : true,
      id          : u.id,
      name        : u.name,
      email       : u.email,
      status      : u.status,
      is_verified : u.is_verified,

      password: {
        hash_prefix : u.hash_prefix,
        hash_length : u.hash_length,
        looks_valid : u.hash_prefix?.startsWith("$2") && u.hash_length === 60,
      },

      verify: {
        has_verify_code         : u.has_verify_code,
        verify_expires          : u.verify_expires,
        verify_code_still_valid : u.verify_code_still_valid,
      },

      reset: {
        has_reset_code         : u.has_reset_code,
        reset_expires          : u.reset_expires,
        reset_code_still_valid : u.reset_code_still_valid,
      },

      timestamps         : { created_at: u.created_at },
      schema             : schemaReport,
      frontend_token_key : SELLER_TOKEN_KEY,
    });

  } catch (err) {
    return res.status(500).json({
      error   : true,
      message : err.message,
      hint    : "If this mentions a missing column, restart the server " +
                "so ensureOtpColumns() can run.",
      schema  : schemaReport,
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /debug/test-login                          (dev only)
════════════════════════════════════════════════════════════ */
router.post("/debug/test-login", async (req, res) => {
  if (!IS_DEV) return res.status(404).json({ message: "Not found" });

  const { email, password } = req.body;
  const email_ = cleanEmail(email);

  const out = {
    step_1_input: {
      email_received              : email,
      email_after_clean           : email_,
      password_type               : typeof password,
      password_length             : password?.length,
      password_has_leading_space  : password?.startsWith(" "),
      password_has_trailing_space : password?.endsWith(" "),
    },
    step_2_db_lookup      : null,
    step_3_status_check   : null,
    step_4_verified_check : null,
    step_5_bcrypt         : null,
    conclusion            : null,
    frontend_token_key    : SELLER_TOKEN_KEY,
  };

  try {
    /* Only query columns that exist in market.users */
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, status, is_verified
       FROM market.users WHERE email = $1`,
      [email_]
    );

    if (!rows.length) {
      out.step_2_db_lookup = { found: false };
      out.conclusion = "FAIL — no account with this email in market.users";
      return res.json(out);
    }

    const u = rows[0];
    out.step_2_db_lookup = {
      found       : true,
      id          : u.id,
      name        : u.name,
      email_in_db : u.email,
      status      : u.status,
      is_verified : u.is_verified,
      hash_prefix : u.password_hash?.slice(0, 7),
      hash_length : u.password_hash?.length,
    };

    if (u.status !== "active") {
      out.step_3_status_check = { passed: false, status: u.status };
      out.conclusion = `FAIL — status is "${u.status}", expected "active"`;
      return res.json(out);
    }
    out.step_3_status_check = { passed: true };

    if (!u.is_verified) {
      out.step_4_verified_check = { passed: false };
      out.conclusion =
        "FAIL — is_verified = false. Complete the email OTP step first.";
      return res.json(out);
    }
    out.step_4_verified_check = { passed: true };

    const match        = await bcrypt.compare(password,         u.password_hash);
    const trimmedMatch = await bcrypt.compare(password?.trim(), u.password_hash);

    out.step_5_bcrypt = {
      password_length : password?.length,
      hash_prefix     : u.password_hash?.slice(0, 7),
      hash_length     : u.password_hash?.length,
      match,
      trimmed_match   : trimmedMatch,
      hint: match
        ? "✅ Match — login should succeed"
        : trimmedMatch
        ? "⚠️ Matches only when trimmed — whitespace added somewhere"
        : "❌ No match raw or trimmed — wrong password or hash overwritten",
    };

    out.conclusion = match
      ? "✅ PASS — login would succeed"
      : "FAIL — bcrypt.compare returned false";

    return res.json(out);

  } catch (err) {
    out.conclusion = `ERROR — ${err.message}`;
    return res.status(500).json(out);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /register
════════════════════════════════════════════════════════════ */
router.post("/register", authLimiter, async (req, res) => {
  const { name, email, phone, password } = req.body;
  const email_ = cleanEmail(email);

  console.log(`${L("register")} ── start ── ${maskEmail(email_)}`);

  if (!name?.trim())          return fail(res, 400, "Name is required");
  if (!email_)                return fail(res, 400, "Email is required");
  if (!EMAIL_RX.test(email_)) return fail(res, 400, "Enter a valid email address");
  if (!password)              return fail(res, 400, "Password is required");
  if (password.length < 8)
    return fail(res, 400, "Password must be at least 8 characters");

  if (!schemaReady) {
    console.error(`${L("register")} ❌ schema not ready:`, schemaReport?.missing);
    return fail(
      res, 503,
      "Service is initialising. Please try again in a moment.",
      IS_DEV ? { code: "SCHEMA_NOT_READY", schema: schemaReport } : {}
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Check existing */
    const { rows: existing } = await client.query(
      `SELECT id, is_verified FROM market.users WHERE email = $1`,
      [email_]
    );

    if (existing.length) {
      const user = existing[0];
      await client.query("ROLLBACK");

      console.log(
        `${L("register")} existing id=${user.id} verified=${user.is_verified}`
      );

      /* Resend OTP for unverified account */
      if (!user.is_verified) {
        const otp        = generateOTP();
        const hashedCode = hashCode(otp);
        const expires    = new Date(Date.now() + OTP_TTL_MS);

        const write = await persistOtp({
          userId: user.id, column: "verify", hashedCode, expires,
        });
        console.log(`${L("register")} OTP resend write:`, write);

        if (!write.ok)
          return fail(res, 500, "Could not generate verification code. Try again.");

        const mail = await trySendMail("register/resend", sendVerificationCode, {
          to: email_, name: name.trim(), code: otp,
        });

        return res.status(409).json({
          success : false,
          code    : "EMAIL_TAKEN_UNVERIFIED",
          message : "An unverified account already exists. " +
                    "We've resent your verification code — check your inbox.",
          email   : email_,
          ...(IS_DEV ? { _debug: { otp_persisted: write.ok, mail } } : {}),
        });
      }

      return res.status(409).json({
        success : false,
        code    : "EMAIL_TAKEN",
        message : "A seller account with this email already exists.",
      });
    }

    /* Create account */
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const otp           = generateOTP();
    const hashedCode    = hashCode(otp);
    const expires       = new Date(Date.now() + OTP_TTL_MS);

    /*
     * INSERT uses "name" column (not "full_name")
     * phone_number column exists in schema
     */
    const { rows: [user] } = await client.query(
      `INSERT INTO market.users
         (name, email, password_hash, phone_number, status,
          is_verified, verify_code, verify_expires)
       VALUES ($1, $2, $3, $4, 'active', FALSE, $5, $6)
       RETURNING id, name, email, created_at,
                 verify_code IS NOT NULL AS has_verify_code,
                 verify_expires`,
      [
        name.trim(),
        email_,
        password_hash,
        phone?.trim() ?? null,
        hashedCode,
        expires,
      ]
    );

    console.log(`${L("register")} insert result:`, {
      id              : user.id,
      has_verify_code : user.has_verify_code,
      verify_expires  : user.verify_expires,
    });

    if (!user.has_verify_code) {
      await client.query("ROLLBACK");
      console.error(`${L("register")} ❌ verify_code null after INSERT`);
      return fail(
        res, 500,
        "Could not generate verification code. Please try again.",
        IS_DEV ? { code: "OTP_NOT_PERSISTED", schema: schemaReport } : {}
      );
    }

    await client.query("COMMIT");
    console.log(`${L("register")} ✅ committed user ${user.id}`);

    const mail = await trySendMail("register", sendVerificationCode, {
      to: user.email, name: user.name, code: otp,
    });

    return res.status(201).json({
      success : true,
      message : "Account created! Check your email for the 6-digit verification code.",
      email   : user.email,
      ...(IS_DEV ? { _debug: { otp_persisted: true, mail } } : {}),
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`${L("register")} ❌`, {
      message: err.message, code: err.code, detail: err.detail,
    });

    if (err.code === "23505")
      return fail(res, 409, "A seller account with this email already exists.");

    if (err.code === "42703") {
      console.error(`${L("register")} ❌ undefined column — re-running schema heal`);
      ensureOtpColumns();
      return fail(
        res, 500,
        "Server is updating its database. Please try again in a moment.",
        IS_DEV ? { code: "UNDEFINED_COLUMN", detail: err.message } : {}
      );
    }

    return fail(res, 500, "Registration failed. Please try again.");

  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   POST /verify-email
════════════════════════════════════════════════════════════ */
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;
  const email_ = cleanEmail(email);

  if (!email_)       return fail(res, 400, "Email is required");
  if (!code?.trim()) return fail(res, 400, "Verification code is required");

  try {
    const { rows } = await pool.query(
      `SELECT id, is_verified, verify_code, verify_expires
       FROM market.users WHERE email = $1`,
      [email_]
    );

    if (!rows.length)
      return fail(res, 404, "No seller account found with this email.");

    const user = rows[0];

    if (user.is_verified) {
      return res.json({
        success : true,
        message : "Email already verified. You can sign in.",
      });
    }

    if (!user.verify_code || !user.verify_expires) {
      console.warn(`${L("verify-email")} no stored code for ${maskEmail(email_)}`);
      return fail(
        res, 400,
        "No verification code found. Please tap Resend to get a new code.",
        { code: "NO_CODE_ISSUED" }
      );
    }

    if (new Date() > new Date(user.verify_expires))
      return fail(
        res, 400,
        "Verification code has expired. Please request a new one.",
        { code: "CODE_EXPIRED" }
      );

    if (hashCode(code.trim()) !== user.verify_code)
      return fail(
        res, 400,
        "Invalid verification code. Please check and try again.",
        { code: "INVALID_CODE" }
      );

    await pool.query(
      `UPDATE market.users
       SET is_verified = TRUE, verify_code = NULL, verify_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    console.log(`${L("verify-email")} ✅ verified ${user.id}`);

    return res.json({
      success : true,
      message : "Email verified successfully! You can now sign in.",
    });

  } catch (err) {
    console.error(`${L("verify-email")} ❌`, err.message);
    return fail(res, 500, "Verification failed. Please try again.");
  }
});

/* ════════════════════════════════════════════════════════════
   POST /resend-verification
════════════════════════════════════════════════════════════ */
router.post("/resend-verification", authLimiter, async (req, res) => {
  const email_ = cleanEmail(req.body.email);

  if (!email_) return fail(res, 400, "Email is required");

  console.log(`${L("resend")} ── start ── ${maskEmail(email_)}`);

  if (!schemaReady) {
    console.error(`${L("resend")} ❌ schema not ready`);
    return fail(res, 503, "Service is initialising. Please try again shortly.");
  }

  try {
    /* Only columns that exist: name, is_verified */
    const { rows } = await pool.query(
      `SELECT id, name, is_verified FROM market.users WHERE email = $1`,
      [email_]
    );

    if (!rows.length || rows[0].is_verified) {
      console.log(
        `${L("resend")} no-op (missing or already verified) ${maskEmail(email_)}`
      );
      return genericOk(
        res,
        "If an unverified account exists, a new code has been sent."
      );
    }

    const user       = rows[0];
    const otp        = generateOTP();
    const hashedCode = hashCode(otp);
    const expires    = new Date(Date.now() + OTP_TTL_MS);

    const write = await persistOtp({
      userId: user.id, column: "verify", hashedCode, expires,
    });
    console.log(`${L("resend")} OTP write:`, write);

    if (!write.ok) {
      console.error(`${L("resend")} ❌ OTP failed to persist for ${user.id}`);
      return fail(res, 500, "Could not generate a new code. Please try again.");
    }

    const mail = await trySendMail("resend", sendVerificationCode, {
      to: email_, name: user.name, code: otp,
    });

    return res.json({
      success : true,
      message : "If an unverified account exists, a new code has been sent.",
      ...(IS_DEV ? { _debug: { otp_persisted: write.ok, mail } } : {}),
    });

  } catch (err) {
    console.error(`${L("resend")} ❌`, err.message);
    return fail(res, 500, "Failed to resend verification code.");
  }
});

/* ════════════════════════════════════════════════════════════
   POST /login
   ─────────────────────────────────────────────────────────
   Check order: suspended/banned → unverified → password → token

   CRITICAL — token storage:
   Response includes tokenKey = "sellerToken".
   Frontend MUST do:
     localStorage.setItem(data.tokenKey, data.token)
   NOT:
     localStorage.setItem("token", data.token)  ← breaks inventory
════════════════════════════════════════════════════════════ */
router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const email_ = cleanEmail(email);

  if (!email_ || !password)
    return fail(res, 400, "Email and password are required");

  try {
    /*
     * Only query columns confirmed in schema:
     *   name, email, password_hash, status, is_verified
     * NOT full_name, NOT is_active
     */
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, status, is_verified
       FROM market.users WHERE email = $1`,
      [email_]
    );

    if (!rows.length) {
      console.log(`${L("login")} no account ${maskEmail(email_)}`);
      return fail(
        res, 401,
        "No seller account found with this email. Please create one to continue."
      );
    }

    const user = rows[0];

    /* 1. Suspended / banned */
    if (user.status !== "active") {
      console.log(`${L("login")} blocked status=${user.status} id=${user.id}`);
      return fail(res, 403, "Your seller account has been suspended.", {
        code: "ACCOUNT_SUSPENDED",
      });
    }

    /* 2. Not verified — checked BEFORE bcrypt */
    if (!user.is_verified) {
      console.log(`${L("login")} blocked unverified id=${user.id}`);
      return fail(res, 403, "Please verify your email before signing in.", {
        code  : "EMAIL_NOT_VERIFIED",
        email : user.email,
      });
    }

    /* 3. Password — raw value, no trimming */
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      console.log(`${L("login")} bad password id=${user.id}`);
      return fail(res, 401, "Incorrect email or password.");
    }

    /* 4. Sign token with market.users.id */
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`${L("login")} ✅ ${user.id}`);

    return res.json({
      success  : true,
      message  : "Login successful",
      token,
      tokenKey : SELLER_TOKEN_KEY,   // "sellerToken" — frontend must use this
      user     : {
        id    : user.id,
        name  : user.name,           // "name" column not "full_name"
        email : user.email,
      },
    });

  } catch (err) {
    console.error(`${L("login")} ❌`, err.message);
    return fail(res, 500, "Sign in failed. Please try again.");
  }
});

/* ════════════════════════════════════════════════════════════
   POST /forgot-password
════════════════════════════════════════════════════════════ */
router.post("/forgot-password", authLimiter, async (req, res) => {
  const email_ = cleanEmail(req.body.email);

  if (!email_)                return fail(res, 400, "Email is required");
  if (!EMAIL_RX.test(email_)) return fail(res, 400, "Enter a valid email address");

  console.log(`${L("forgot-password")} ── start ── ${maskEmail(email_)}`);

  if (!schemaReady) {
    console.error(`${L("forgot-password")} ❌ schema not ready`);
    return fail(res, 503, "Service is initialising. Please try again shortly.");
  }

  try {
    /* Only columns that exist: name, status */
    const { rows } = await pool.query(
      `SELECT id, name, status FROM market.users WHERE email = $1`,
      [email_]
    );

    if (rows.length && rows[0].status !== "active")
      return fail(res, 403, "Your account has been suspended. Contact support.");

    let debug = null;

    if (rows.length) {
      const user       = rows[0];
      const otp        = generateOTP();
      const hashedCode = hashCode(otp);
      const expires    = new Date(Date.now() + RESET_TTL_MS);

      const write = await persistOtp({
        userId: user.id, column: "reset", hashedCode, expires,
      });
      console.log(`${L("forgot-password")} OTP write:`, write);

      if (!write.ok) {
        console.error(`${L("forgot-password")} ❌ reset code failed to persist`);
        return fail(res, 500, "Could not generate reset code. Please try again.");
      }

      const mail = await trySendMail(
        "forgot-password", sendPasswordResetCode,
        { to: email_, name: user.name, code: otp }
      );

      debug = { otp_persisted: write.ok, mail };

    } else {
      console.log(`${L("forgot-password")} no account ${maskEmail(email_)}`);
    }

    return res.json({
      success : true,
      message : "If a seller account exists with this email, a reset code has been sent.",
      ...(IS_DEV && debug ? { _debug: debug } : {}),
    });

  } catch (err) {
    console.error(`${L("forgot-password")} ❌`, err.message);
    return fail(res, 500, "Failed to send reset code. Please try again.");
  }
});

/* ════════════════════════════════════════════════════════════
   POST /verify-reset-code   (step 1 of 2)
════════════════════════════════════════════════════════════ */
router.post("/verify-reset-code", authLimiter, async (req, res) => {
  const { email, code } = req.body;
  const email_ = cleanEmail(email);

  if (!email_)       return fail(res, 400, "Email is required");
  if (!code?.trim()) return fail(res, 400, "Reset code is required");

  try {
    const { rows } = await pool.query(
      `SELECT id, reset_code, reset_expires
       FROM market.users WHERE email = $1`,
      [email_]
    );

    if (!rows.length)
      return fail(res, 400, "Invalid or expired reset code.", {
        code: "INVALID_CODE",
      });

    const user = rows[0];

    if (!user.reset_code || !user.reset_expires)
      return fail(
        res, 400,
        "No password reset was requested. Please use Forgot Password first.",
        { code: "NO_RESET_REQUESTED" }
      );

    if (new Date() > new Date(user.reset_expires))
      return fail(
        res, 400,
        "Reset code has expired. Please request a new one.",
        { code: "CODE_EXPIRED" }
      );

    if (hashCode(code.trim()) !== user.reset_code)
      return fail(
        res, 400,
        "Invalid reset code. Please check and try again.",
        { code: "INVALID_CODE" }
      );

    /* Do NOT clear — step 2 re-verifies */
    console.log(`${L("verify-reset-code")} ✅ ${user.id}`);

    return res.json({
      success : true,
      message : "Reset code verified. Please set your new password.",
    });

  } catch (err) {
    console.error(`${L("verify-reset-code")} ❌`, err.message);
    return fail(res, 500, "Verification failed. Please try again.");
  }
});

/* ════════════════════════════════════════════════════════════
   POST /reset-password      (step 2 of 2)
════════════════════════════════════════════════════════════ */
router.post("/reset-password", authLimiter, async (req, res) => {
  const { email, code, newPassword } = req.body;
  const email_ = cleanEmail(email);

  if (!email_)       return fail(res, 400, "Email is required");
  if (!code?.trim()) return fail(res, 400, "Reset code is required");
  if (!newPassword || newPassword.length < 8)
    return fail(res, 400, "Password must be at least 8 characters");

  try {
    const { rows } = await pool.query(
      `SELECT id, reset_code, reset_expires
       FROM market.users WHERE email = $1`,
      [email_]
    );

    if (!rows.length)
      return fail(res, 400, "Invalid or expired reset code.");

    const user = rows[0];

    if (!user.reset_code || !user.reset_expires)
      return fail(res, 400, "No password reset was requested.", {
        code: "NO_RESET_REQUESTED",
      });

    if (new Date() > new Date(user.reset_expires))
      return fail(
        res, 400,
        "Reset code has expired. Please request a new one.",
        { code: "CODE_EXPIRED" }
      );

    if (hashCode(code.trim()) !== user.reset_code)
      return fail(res, 400, "Invalid reset code.", { code: "INVALID_CODE" });

    /* Hash raw value — no trimming anywhere in the pipeline */
    const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    const { rows: [updated] } = await pool.query(
      `UPDATE market.users
       SET password_hash = $1,
           reset_code    = NULL,
           reset_expires = NULL
       WHERE id = $2
       RETURNING id, LENGTH(password_hash) AS hash_length`,
      [password_hash, user.id]
    );

    console.log(
      `${L("reset-password")} ✅ ${updated.id} hash_length=${updated.hash_length}`
    );

    clearRateLimit(req);

    return res.json({
      success : true,
      message : "Password reset successfully! You can now sign in.",
    });

  } catch (err) {
    console.error(`${L("reset-password")} ❌`, err.message);
    return fail(res, 500, "Password reset failed. Please try again.");
  }
});

/* ════════════════════════════════════════════════════════════
   GET /me
   Only queries columns confirmed in market.users schema.
════════════════════════════════════════════════════════════ */
router.get("/me", async (req, res) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer "))
    return fail(res, 401, "No token provided");

  try {
    const token   = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    /*
     * Confirmed columns: id, name, email, phone_number,
     * country, city, profile_image, status, is_verified, created_at
     * NOT full_name, NOT is_active
     */
    const { rows } = await pool.query(
      `SELECT
         id,
         name,
         email,
         phone_number,
         country,
         city,
         profile_image,
         status,
         is_verified,
         created_at
       FROM market.users
       WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length)
      return fail(res, 404, "Seller account not found");

    return res.json({ success: true, user: rows[0] });

  } catch (err) {
    if (
      err.name === "JsonWebTokenError" ||
      err.name === "TokenExpiredError"
    ) return fail(res, 401, "Invalid or expired token");

    console.error(`${L("me")} ❌`, err.message);
    return fail(res, 500, "Server error");
  }
});

export default router;