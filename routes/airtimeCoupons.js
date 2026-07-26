// routes/airtimeCoupons.js
// Base: /api/airtime-coupons
// User-facing routes ONLY — no admin routes here

import express        from "express";
import crypto         from "crypto";
import { pool }       from "../config/db.js";
import authenticate   from "../middleware/auth.js";
import {
  cacheGet,
  cacheSet,
  cacheDel,
} from "../lib/redis.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const OTP_TTL_MINUTES      = 10;
const OTP_MAX_ATTEMPTS     = 5;
const OTP_SEND_LIMIT       = 3;
const OTP_RESEND_COOLDOWN  = 60;       // seconds
const CHANGE_COOLDOWN_DAYS = 60;
const RATE_LIMIT_WINDOW    = 10 * 60;  // seconds  (matches OTP_TTL_MINUTES)

const AIRTIME_STATUS = Object.freeze({
  AVAILABLE  : "available",
  REDEEMED   : "redeemed",
  PROCESSING : "processing",
  COMPLETED  : "completed",
  FAILED     : "failed",
});

// Hardcoded for DDL — never interpolated from runtime data
const AIRTIME_STATUS_DDL =
  `'available','redeemed','processing','completed','failed'`;

const VALID_PURPOSES = Object.freeze(["verify", "change", "reclaim"]);

const IS_PROD = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   REDIS KEYS
═══════════════════════════════════════════════════════════════ */
const KEY = {
  otpSendLimit  : (userId, phone) => `airtime:otp:limit:${userId}:${phone}`,
  otpResendCool : (userId, phone) => `airtime:otp:cooldown:${userId}:${phone}`,
  phoneStatus   : (userId)        => `airtime:phone-status:${userId}`,
  userCoupons   : (userId)        => `airtime:user-coupons:${userId}`,
  userMe        : (userId)        => `user:me:${userId}`,
  mergedCoupons : (userId)        => `coupons:user:${userId}`,
  mergedHistory : (userId)        => `coupons:history:${userId}`,
};

const TTL = {
  RATE_LIMIT   : RATE_LIMIT_WINDOW,
  RESEND_COOL  : OTP_RESEND_COOLDOWN,
  PHONE_STATUS : 2 * 60,
  USER_COUPONS : 2 * 60,
};

/* ═══════════════════════════════════════════════════════════════
   PHONE HELPERS
═══════════════════════════════════════════════════════════════ */

/**
 * Normalise any phone format to a local 11-digit Nigerian number.
 * e.g. "+2348012345678" → "08012345678"
 */
const normalizePhone = (raw) => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.startsWith("0"))   return digits;
  if (digits.length === 10)     return "0" + digits;
  return digits;
};

/**
 * Convert a local Nigerian number to E.164 format.
 * e.g. "08012345678" → "+2348012345678"
 */
const toIntlPhone = (localPhone) => {
  const digits = String(localPhone).replace(/\D/g, "");
  if (digits.startsWith("234")) return "+" + digits;
  if (digits.startsWith("0"))   return "+234" + digits.slice(1);
  return "+234" + digits;
};

/** Validates a normalised 11-digit Nigerian local number. */
const isValidNigerianPhone = (localPhone) =>
  /^0[789][01]\d{8}$/.test(localPhone);

/**
 * Mask a phone number for safe display/logging.
 * e.g. "08012345678" → "0801****678"
 */
const maskPhone = (phone) => {
  if (!phone) return null;
  const local = normalizePhone(phone);
  if (local.length < 7) return local;
  return local.slice(0, 4) + "****" + local.slice(-3);
};

const daysSince = (date) =>
  Math.floor((Date.now() - new Date(date)) / 86_400_000);

/* ═══════════════════════════════════════════════════════════════
   OTP HELPERS
═══════════════════════════════════════════════════════════════ */

/** Generate a cryptographically random 6-digit OTP string. */
const generateOtp = () =>
  crypto.randomInt(100_000, 999_999).toString();

/**
 * Hash an OTP with SHA-256 before storage.
 * Never store plaintext OTPs in the database.
 */
const hashOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");

/**
 * Timing-safe comparison between a stored hash and a candidate OTP.
 * Hashes the candidate before comparing to prevent timing attacks.
 */
const verifyOtp = (storedHash, candidateOtp) => {
  const candidateHash = hashOtp(candidateOtp);
  const bufA = Buffer.from(storedHash,     "hex");
  const bufB = Buffer.from(candidateHash,  "hex");
  // SHA-256 hashes are always 32 bytes — lengths always match
  // but guard anyway in case of unexpected input
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/* ═══════════════════════════════════════════════════════════════
   NETWORK DETECTION
═══════════════════════════════════════════════════════════════ */
const PREFIX_MAP = Object.freeze({
  // MTN
  "0703": "MTN",    "0704": "MTN",    "0706": "MTN",
  "0803": "MTN",    "0806": "MTN",    "0810": "MTN",
  "0813": "MTN",    "0814": "MTN",    "0816": "MTN",
  "0903": "MTN",    "0906": "MTN",    "0913": "MTN",
  "0916": "MTN",
  // Airtel
  "0701": "Airtel", "0708": "Airtel",
  "0802": "Airtel", "0808": "Airtel", "0812": "Airtel",
  "0901": "Airtel", "0902": "Airtel", "0904": "Airtel",
  "0907": "Airtel", "0912": "Airtel",
  // Glo
  "0705": "Glo",    "0805": "Glo",    "0807": "Glo",
  "0811": "Glo",    "0815": "Glo",    "0905": "Glo",
  "0915": "Glo",
  // 9mobile
  "0809": "9mobile","0817": "9mobile","0818": "9mobile",
  "0908": "9mobile","0909": "9mobile",
});

const detectNetwork = (phone) => {
  const local  = normalizePhone(phone);
  const prefix = local.slice(0, 4);
  return PREFIX_MAP[prefix] || null;
};

/* ═══════════════════════════════════════════════════════════════
   CACHE HELPERS
   Safe wrappers — a Redis outage never crashes the API.
═══════════════════════════════════════════════════════════════ */
async function safeCacheGet(key) {
  try {
    return await cacheGet(key);
  } catch (e) {
    console.warn(`[airtime-coupons] cache GET failed (${key}):`, e.message);
    return null;
  }
}

/**
 * Always requires a positive TTL — refuses to create keys that
 * could persist forever on a mis-call.
 */
async function safeCacheSet(key, val, ttl) {
  if (!ttl || typeof ttl !== "number" || ttl <= 0) {
    console.warn(
      `[airtime-coupons] safeCacheSet rejected: missing TTL for key "${key}"`
    );
    return null;
  }
  try {
    return await cacheSet(key, val, ttl);
  } catch (e) {
    console.warn(`[airtime-coupons] cache SET failed (${key}):`, e.message);
    return null;
  }
}

/**
 * Atomically increment a rate-limit counter and always (re)set its TTL.
 * Returns the new count, or 1 on cache failure (fail-open).
 */
async function incrementRateLimit(key, windowSeconds) {
  try {
    const current  = await cacheGet(key);
    const newCount = (Number(current) || 0) + 1;
    await cacheSet(key, newCount, windowSeconds); // always refreshes TTL
    return newCount;
  } catch (e) {
    console.warn(`[airtime-coupons] rate-limit increment failed (${key}):`, e.message);
    return 1; // fail open — allow the request rather than locking everyone out
  }
}

/* ═══════════════════════════════════════════════════════════════
   CACHE INVALIDATION
═══════════════════════════════════════════════════════════════ */
async function invalidateUserPhoneCache(userId) {
  await Promise.allSettled([
    cacheDel(KEY.phoneStatus(userId)),
    cacheDel(KEY.userCoupons(userId)),
    cacheDel(KEY.userMe(userId)),
    cacheDel(KEY.mergedCoupons(userId)),
    cacheDel(KEY.mergedHistory(userId)),
  ]);
}

async function invalidateUserCouponsCache(userId) {
  await Promise.allSettled([
    cacheDel(KEY.userCoupons(userId)),
    cacheDel(KEY.mergedCoupons(userId)),
    cacheDel(KEY.mergedHistory(userId)),
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   ERROR CLASSIFIER
   Maps any thrown error → { status, code, layer, message, detail }
═══════════════════════════════════════════════════════════════ */
function classifyError(err) {
  const msg  = String(err?.message || "").toLowerCase();
  const code = err?.code || "";

  /* ── Database: connection failures ── */
  if (
    (code === "ECONNREFUSED" && msg.includes("5432")) ||
    msg.includes("database is starting up")           ||
    msg.includes("connection terminated")             ||
    msg.includes("pool ended")                        ||
    msg.includes("client has encountered a connection error")
  ) {
    return {
      status : 503, code: "DB_UNAVAILABLE", layer: "database",
      message: "Database is temporarily unreachable. Please try again shortly.",
      detail : err.message,
    };
  }

  /* ── Postgres SQLSTATE codes ── */
  if (typeof code === "string" && code.length === 5) {
    if (code === "23505") return {
      status: 409, code: "DUPLICATE", layer: "database",
      message: err.detail || "This entry already exists.",
      detail : err.detail || err.message,
    };
    if (code === "23502") return {
      status: 400, code: "MISSING_FIELD", layer: "database",
      message: `Missing required field: ${err.column || "unknown"}`,
      detail : err.message,
    };
    if (code === "23503") return {
      status: 400, code: "FK_VIOLATION", layer: "database",
      message: "Referenced record does not exist.",
      detail : err.detail || err.message,
    };
    if (code === "23514") return {
      status: 400, code: "CHECK_VIOLATION", layer: "database",
      message: "Invalid value for a database field.",
      detail : err.detail || err.message,
    };
    if (code === "42P01") return {
      status: 500, code: "TABLE_MISSING", layer: "database",
      message: `Database table does not exist${err.table ? ": " + err.table : ""}.`,
      detail : err.message,
    };
    if (code === "42703") return {
      status: 500, code: "COLUMN_MISSING", layer: "database",
      message: `Database column does not exist${err.column ? ": " + err.column : ""}.`,
      detail : err.message,
    };
    if (code.startsWith("42")) return {
      status: 500, code: "SQL_SYNTAX", layer: "database",
      message: "Database query error.",
      detail : err.message,
    };
    if (code === "40001" || code === "40P01") return {
      status: 409, code: "DB_CONFLICT", layer: "database",
      message: "Concurrent update conflict. Please try again.",
      detail : err.message,
    };
    return {
      status: 500, code: `DB_${code}`, layer: "database",
      message: err.message || "Database error.",
      detail : err.message,
    };
  }

  /* ── Redis / cache ── */
  if (
    msg.includes("redis")                            ||
    msg.includes("ioredis")                          ||
    (code === "ECONNREFUSED" && msg.includes("6379"))||
    msg.includes("stream isn't writeable")
  ) {
    return {
      status: 503, code: "CACHE_UNAVAILABLE", layer: "cache",
      message: "Cache is temporarily unavailable. Please try again.",
      detail : err.message,
    };
  }

  /* ── SMS provider ── */
  if (msg.includes("termii") || msg.includes("twilio") || msg.includes("sms provider")) {
    if (msg.includes("insufficient") || msg.includes("balance") || msg.includes("credit")) {
      return {
        status: 502, code: "SMS_NO_CREDIT", layer: "sms",
        message: "SMS service is out of credit. Please contact support.",
        detail : err.message,
      };
    }
    if (msg.includes("invalid") && (msg.includes("number") || msg.includes("phone"))) {
      return {
        status: 400, code: "SMS_INVALID_NUMBER", layer: "sms",
        message: "SMS provider rejected this phone number.",
        detail : err.message,
      };
    }
    if (msg.includes("rate") || msg.includes("throttle") || msg.includes("too many")) {
      return {
        status: 429, code: "SMS_RATE_LIMITED", layer: "sms",
        message: "Too many SMS requests. Please wait a moment.",
        detail : err.message,
      };
    }
    if (msg.includes("unauthorized") || msg.includes("invalid api key")) {
      return {
        status: 502, code: "SMS_AUTH_FAILED", layer: "sms",
        message: "SMS provider authentication failed. Please contact support.",
        detail : err.message,
      };
    }
    return {
      status: 502, code: "SMS_PROVIDER_ERROR", layer: "sms",
      message: "Could not send SMS. Please check your number or try again.",
      detail : err.message,
    };
  }

  /* ── Network / upstream ── */
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND"    ||
    code === "ETIMEDOUT"    ||
    code === "ECONNRESET"   ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  ) {
    return {
      status: 502, code: "UPSTREAM_UNAVAILABLE", layer: "network",
      message: "A dependent service is unreachable. Please try again.",
      detail : err.message,
    };
  }

  /* ── Auth / JWT — specific matches only ── */
  if (
    err.name === "JsonWebTokenError" ||
    err.name === "TokenExpiredError" ||
    msg.includes("invalid signature") ||
    msg.includes("jwt expired")       ||
    msg.includes("jwt malformed")     ||
    msg.includes("not before")
  ) {
    return {
      status: 401, code: "AUTH_INVALID", layer: "auth",
      message: "Authentication failed. Please log in again.",
      detail : err.message,
    };
  }

  /* ── Fallback ── */
  return {
    status: 500, code: "INTERNAL_ERROR", layer: "server",
    message: "An unexpected error occurred.",
    detail : err.message,
  };
}

function sendError(res, err, context = "") {
  const c = classifyError(err);

  console.error(
    `\n════════════════════════════════════════════\n` +
    `[airtime-coupons] ${context} FAILED\n`          +
    `  Layer   : ${c.layer}\n`                        +
    `  Code    : ${c.code}\n`                         +
    `  Status  : ${c.status}\n`                       +
    `  Message : ${c.message}\n`                      +
    `  Detail  : ${c.detail}\n`                       +
    `  Original: ${err.message}\n`                    +
    (err.stack
      ? `  Stack   :\n${err.stack.split("\n").slice(0, 6).join("\n")}\n`
      : ""
    )                                                  +
    `════════════════════════════════════════════\n`
  );

  const payload = {
    success : false,
    code    : c.code,
    layer   : c.layer,
    message : c.message,
  };

  if (!IS_PROD) {
    payload.debug = {
      original_message : err.message,
      original_code    : err.code,
      original_detail  : err.detail,
      table            : err.table,
      column           : err.column,
      constraint       : err.constraint,
      stack            : err.stack?.split("\n").slice(0, 5).join("\n"),
    };
  }

  return res.status(c.status).json(payload);
}

/* ═══════════════════════════════════════════════════════════════
   SMS SENDER
═══════════════════════════════════════════════════════════════ */

/* Twilio singleton — instantiated once, never per-request */
let _twilioClient = null;
function getTwilioClient() {
  if (_twilioClient) return _twilioClient;
  // Dynamic import is only called once; thereafter the singleton is reused.
  // We use require() here because top-level await isn't available in all
  // module contexts and we need lazy initialisation.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Twilio   = require("twilio");
  _twilioClient  = new Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  return _twilioClient;
}

async function sendSms(intlPhone, message) {
  /* ── Termii ── */
  if (process.env.TERMII_API_KEY) {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method  : "POST",
      headers : { "Content-Type": "application/json" },
      body    : JSON.stringify({
        to      : intlPhone.replace(/^\+/, ""),
        from    : process.env.TERMII_SENDER_ID || "N-Alert",
        sms     : message,
        type    : "plain",
        channel : "dnd",
        api_key : process.env.TERMII_API_KEY,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Prefix so classifyError's SMS branch catches it
      throw new Error(`termii: ${data.message || `HTTP ${res.status}`}`);
    }
    return data;
  }

  /* ── Twilio ── */
  if (process.env.TWILIO_ACCOUNT_SID) {
    try {
      return await getTwilioClient().messages.create({
        body : message,
        from : process.env.TWILIO_PHONE_NUMBER,
        to   : intlPhone,
      });
    } catch (e) {
      throw new Error(`sms provider: twilio: ${e.message}`);
    }
  }

  /* ── Dev fallback — logs OTP to console, never reaches production ── */
  if (IS_PROD) {
    throw new Error("sms provider: no SMS provider configured");
  }
  console.log(
    `\n[SMS DEV] ───────────────────────────\n` +
    `  To     : ${intlPhone}\n`                 +
    `  Message: ${message}\n`                   +
    `─────────────────────────────────────\n`
  );
  return { dev: true };
}

/* ═══════════════════════════════════════════════════════════════
   SCHEMA MIGRATIONS
   Idempotent — tracked in schema_migrations to avoid re-running
   expensive ALTER TABLE statements on every boot.
═══════════════════════════════════════════════════════════════ */
async function ensureTables() {
  /* Migration tracker */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version    TEXT        NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
    )
  `);

  /* ── Migration v1: phone columns on users ── */
  const { rows: m1 } = await pool.query(
    `SELECT 1 FROM public.schema_migrations WHERE version = 'airtime_v1'`
  );
  if (!m1.length) {
    try {
      await pool.query(`
        ALTER TABLE public.users
          ADD COLUMN IF NOT EXISTS phone             TEXT        NULL,
          ADD COLUMN IF NOT EXISTS phone_verified    BOOLEAN     NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ NULL,
          ADD COLUMN IF NOT EXISTS phone_changed_at  TIMESTAMPTZ NULL,
          ADD COLUMN IF NOT EXISTS phone_network     TEXT        NULL,
          ADD COLUMN IF NOT EXISTS phone_number      TEXT        NULL
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_users_phone
          ON public.users (phone)
          WHERE phone IS NOT NULL
      `);
      await pool.query(
        `INSERT INTO public.schema_migrations (version) VALUES ('airtime_v1')`
      );
      console.log("[airtime-coupons] ✓ migration airtime_v1 applied");
    } catch (e) {
      console.warn("[airtime-coupons] migration airtime_v1:", e.message);
    }
  }

  /* ── phone_otps table ── */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.phone_otps (
      id         UUID        NOT NULL DEFAULT gen_random_uuid(),
      user_id    UUID        NOT NULL,
      phone      TEXT        NOT NULL,
      otp_hash   TEXT        NOT NULL,
      purpose    TEXT        NOT NULL DEFAULT 'verify',
      attempts   INT2        NOT NULL DEFAULT 0,
      used       BOOLEAN     NOT NULL DEFAULT false,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT phone_otps_pkey PRIMARY KEY (id)
    )
  `);

  /* ── Migration v2: rename otp → otp_hash if upgrading from old schema ── */
  const { rows: m2 } = await pool.query(
    `SELECT 1 FROM public.schema_migrations WHERE version = 'airtime_v2'`
  );
  if (!m2.length) {
    try {
      // Rename old plaintext column if it exists
      await pool.query(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'phone_otps' AND column_name = 'otp'
          ) THEN
            ALTER TABLE public.phone_otps RENAME COLUMN otp TO otp_hash;
          END IF;
        END $$
      `);
      await pool.query(
        `INSERT INTO public.schema_migrations (version) VALUES ('airtime_v2')`
      );
      console.log("[airtime-coupons] ✓ migration airtime_v2 applied");
    } catch (e) {
      console.warn("[airtime-coupons] migration airtime_v2:", e.message);
    }
  }

  /* ── phone_otps indexes ── */
  const otpIndexes = [
    `CREATE INDEX IF NOT EXISTS idx_otps_user
       ON public.phone_otps (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_otps_expires
       ON public.phone_otps (expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_otps_lookup
       ON public.phone_otps (user_id, phone, purpose, used, expires_at)`,
  ];
  for (const sql of otpIndexes) {
    try { await pool.query(sql); }
    catch (e) {
      if (!e.message.includes("already exists"))
        console.warn("[airtime-coupons] otp index:", e.message);
    }
  }

  /* ── airtime_coupons table — DDL is static, never interpolated ── */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.airtime_coupons (
      id           UUID        NOT NULL DEFAULT gen_random_uuid(),
      code         TEXT        NOT NULL,
      amount       DECIMAL     NOT NULL,
      user_id      UUID        NULL,
      status       TEXT        NOT NULL DEFAULT 'available'
                               CHECK (status IN (${AIRTIME_STATUS_DDL})),
      redeemed_by  UUID        NULL,
      redeemed_at  TIMESTAMPTZ NULL,
      phone        TEXT        NULL,
      network      TEXT        NULL,
      processed_by UUID        NULL,
      processed_at TIMESTAMPTZ NULL,
      admin_note   TEXT        NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT airtime_coupons_pkey PRIMARY KEY (id)
    )
  `);

  const couponIndexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS unique_airtime_code
       ON public.airtime_coupons (code)`,
    `CREATE INDEX IF NOT EXISTS idx_airtime_user
       ON public.airtime_coupons (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_airtime_status
       ON public.airtime_coupons (status)`,
    `CREATE INDEX IF NOT EXISTS idx_airtime_redeemed_by
       ON public.airtime_coupons (redeemed_by)`,
    `CREATE INDEX IF NOT EXISTS idx_airtime_user_status
       ON public.airtime_coupons (user_id, status)`,
  ];
  for (const sql of couponIndexes) {
    try { await pool.query(sql); }
    catch (e) {
      if (!e.message.includes("already exists"))
        console.warn("[airtime-coupons] coupon index:", e.message);
    }
  }

  console.log("[airtime-coupons] ✓ all tables ready");
}

ensureTables().catch((err) =>
  console.error("[airtime-coupons] FATAL: table init failed:", err.message)
);

/* ═══════════════════════════════════════════════════════════════
   OTP EXPIRY CLEANUP  (fire-and-forget, non-blocking)
   Piggybacks on /send-otp traffic to keep phone_otps from
   growing unbounded. Deletes records older than 24 hours.
═══════════════════════════════════════════════════════════════ */
function purgeExpiredOtps() {
  pool.query(
    `DELETE FROM public.phone_otps
     WHERE expires_at < NOW() - INTERVAL '24 hours'`
  ).catch((e) =>
    console.warn("[airtime-coupons] OTP purge failed:", e.message)
  );
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/airtime-coupons/phone-status
═══════════════════════════════════════════════════════════════ */
router.get("/phone-status", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const cached = await safeCacheGet(KEY.phoneStatus(userId));
    if (cached) return res.json({ ...cached, cached: true });

    const { rows } = await pool.query(
      `SELECT
         phone,
         phone_number,
         phone_verified,
         phone_verified_at,
         phone_changed_at,
         phone_network
       FROM public.users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false, code: "USER_NOT_FOUND", layer: "auth",
        message: "User not found.",
      });
    }

    const u = rows[0];

    /*
     * Phone resolution priority:
     *   1. Verified phone column
     *   2. Legacy phone_number column (read-only migration path)
     *   3. Unverified phone column
     */
    const bestPhone =
      (u.phone_verified && u.phone) ? normalizePhone(u.phone)         :
      u.phone_number                ? normalizePhone(u.phone_number)   :
      u.phone                       ? normalizePhone(u.phone)          :
      null;

    const hasPhone = !!bestPhone;

    const canChange = !u.phone_changed_at ||
      daysSince(u.phone_changed_at) >= CHANGE_COOLDOWN_DAYS;

    const daysUntilChange = u.phone_changed_at
      ? Math.max(0, CHANGE_COOLDOWN_DAYS - daysSince(u.phone_changed_at))
      : 0;

    const source =
      u.phone_verified && u.phone ? "verified"   :
      u.phone_number              ? "registered" :
      u.phone                     ? "unverified" :
      null;

    const payload = {
      success : true,
      phone   : {
        has_phone         : hasPhone,
        /*
         * local_number is only exposed while unverified so the UI can
         * pre-fill the input field. Once verified it is masked.
         */
        local_number      : (hasPhone && !u.phone_verified) ? bestPhone : null,
        masked            : maskPhone(bestPhone),
        verified          : u.phone_verified || false,
        network           : u.phone_network  || detectNetwork(bestPhone) || null,
        verified_at       : u.phone_verified_at,
        can_change        : canChange,
        days_until_change : daysUntilChange,
        source,
      },
    };

    await safeCacheSet(KEY.phoneStatus(userId), payload, TTL.PHONE_STATUS);
    return res.json(payload);

  } catch (err) {
    return sendError(res, err, "GET /phone-status");
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/airtime-coupons/send-otp
   Body: { phone, purpose }
═══════════════════════════════════════════════════════════════ */
router.post("/send-otp", authenticate, async (req, res) => {
  const { phone, purpose = "verify" } = req.body;
  const userId = req.user.id;

  /* ── Input validation ── */
  if (!phone?.trim()) {
    return res.status(400).json({
      success: false, code: "MISSING_PHONE", layer: "input",
      message: "Phone number is required.",
    });
  }

  if (!VALID_PURPOSES.includes(purpose)) {
    return res.status(400).json({
      success: false, code: "INVALID_PURPOSE", layer: "input",
      message: `Invalid purpose. Must be one of: ${VALID_PURPOSES.join(", ")}.`,
    });
  }

  const localPhone = normalizePhone(phone.trim());

  if (!isValidNigerianPhone(localPhone)) {
    return res.status(400).json({
      success: false, code: "INVALID_PHONE", layer: "input",
      message: "Enter a valid Nigerian phone number (e.g. 0803 123 4567).",
    });
  }

  const intlPhone = toIntlPhone(localPhone);
  const network   = detectNetwork(localPhone);

  if (!network) {
    return res.status(400).json({
      success: false, code: "UNKNOWN_NETWORK", layer: "input",
      message: "This phone number has an unrecognised network prefix.",
    });
  }

  /* Piggyback OTP cleanup — non-blocking */
  purgeExpiredOtps();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /*
     * Check for cross-account phone conflict inside a transaction
     * with a row lock so two concurrent requests can't both claim
     * the same number.
     */
    const { rows: conflict } = await client.query(
      `SELECT id FROM public.users
       WHERE phone = $1 AND phone_verified = true AND id != $2
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
      [localPhone, userId]
    );

    if (conflict.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false, code: "PHONE_TAKEN", layer: "policy",
        message: "This phone number is already linked to another account.",
      });
    }

    /* Change cooldown check */
    if (purpose === "change") {
      const { rows: userRows } = await client.query(
        `SELECT phone_changed_at FROM public.users WHERE id = $1 LIMIT 1`,
        [userId]
      );
      const changedAt = userRows[0]?.phone_changed_at;
      if (changedAt && daysSince(changedAt) < CHANGE_COOLDOWN_DAYS) {
        await client.query("ROLLBACK");
        const daysLeft = CHANGE_COOLDOWN_DAYS - daysSince(changedAt);
        return res.status(429).json({
          success        : false,
          code           : "CHANGE_COOLDOWN",
          layer          : "policy",
          message        : `You can change your phone number in ${daysLeft} day(s).`,
          days_remaining : daysLeft,
        });
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return sendError(res, err, "POST /send-otp (conflict check)");
  } finally {
    client.release();
  }

  try {
    /* Resend cooldown */
    const cooldownKey  = KEY.otpResendCool(userId, localPhone);
    const inCooldown   = await safeCacheGet(cooldownKey);
    if (inCooldown) {
      const secondsLeft = Number(inCooldown) || OTP_RESEND_COOLDOWN;
      return res.status(429).json({
        success     : false,
        code        : "RESEND_COOLDOWN",
        layer       : "policy",
        message     : `Please wait ${secondsLeft}s before requesting another code.`,
        retry_after : secondsLeft,
      });
    }

    /* Hard send-limit */
    const rateLimitKey = KEY.otpSendLimit(userId, localPhone);
    const currentCount = Number(await safeCacheGet(rateLimitKey)) || 0;

    if (currentCount >= OTP_SEND_LIMIT) {
      return res.status(429).json({
        success: false, code: "RATE_LIMITED", layer: "policy",
        message: `Too many OTP requests. Please wait ${OTP_TTL_MINUTES} minutes before trying again.`,
      });
    }

    /* Invalidate any existing pending OTPs for this user+phone+purpose */
    await pool.query(
      `UPDATE public.phone_otps
       SET used = true
       WHERE user_id = $1 AND phone = $2 AND purpose = $3 AND used = false`,
      [userId, localPhone, purpose]
    );

    /* Generate OTP, hash it, then store the hash */
    const otp       = generateOtp();
    const otpHash   = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    await pool.query(
      `INSERT INTO public.phone_otps
         (user_id, phone, otp_hash, purpose, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, localPhone, otpHash, purpose, expiresAt]
    );

    /* Send SMS — on failure we roll back the DB insert */
    try {
      await sendSms(
        intlPhone,
        `Your Loemart code is ${otp}. Valid for ${OTP_TTL_MINUTES} minutes. Do not share it.`
      );
    } catch (smsErr) {
      /* Clean up the OTP row since the user never received the code */
      await pool.query(
        `UPDATE public.phone_otps SET used = true
         WHERE user_id = $1 AND phone = $2 AND purpose = $3
           AND used = false AND otp_hash = $4`,
        [userId, localPhone, purpose, otpHash]
      );
      return sendError(res, smsErr, "POST /send-otp (SMS)");
    }

    /*
     * Increment rate-limit counters AFTER successful SMS delivery.
     * incrementRateLimit always sets a TTL — no risk of persistent keys.
     */
    await Promise.allSettled([
      incrementRateLimit(rateLimitKey, TTL.RATE_LIMIT),
      safeCacheSet(cooldownKey, OTP_RESEND_COOLDOWN, TTL.RESEND_COOL),
    ]);

    console.log(
      `[airtime-coupons] OTP sent | user=${userId} | ` +
      `phone=${maskPhone(localPhone)} | purpose=${purpose} | ` +
      `attempt=${currentCount + 1}/${OTP_SEND_LIMIT}`
    );

    return res.json({
      success       : true,
      message       : `OTP sent to ${maskPhone(localPhone)}.`,
      masked        : maskPhone(localPhone),
      network,
      expires_in    : OTP_TTL_MINUTES * 60,
      resend_after  : OTP_RESEND_COOLDOWN,
      attempts_left : OTP_SEND_LIMIT - (currentCount + 1),
      /* dev_otp is ONLY included outside production */
      ...(!IS_PROD && { dev_otp: otp }),
    });

  } catch (err) {
    return sendError(res, err, "POST /send-otp");
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/airtime-coupons/verify-otp
   Body: { phone, otp, purpose }
═══════════════════════════════════════════════════════════════ */
router.post("/verify-otp", authenticate, async (req, res) => {
  const { phone, otp, purpose = "verify" } = req.body;
  const userId = req.user.id;

  /* ── Input validation ── */
  if (!phone?.trim() || !otp?.trim()) {
    return res.status(400).json({
      success: false, code: "MISSING_FIELDS", layer: "input",
      message: "Phone and OTP are required.",
    });
  }

  if (!/^\d{6}$/.test(otp.trim())) {
    return res.status(400).json({
      success: false, code: "INVALID_OTP_FORMAT", layer: "input",
      message: "OTP must be exactly 6 digits.",
    });
  }

  if (!VALID_PURPOSES.includes(purpose)) {
    return res.status(400).json({
      success: false, code: "INVALID_PURPOSE", layer: "input",
      message: `Invalid purpose. Must be one of: ${VALID_PURPOSES.join(", ")}.`,
    });
  }

  const localPhone = normalizePhone(phone.trim());

  try {
    /* Fetch the most recent active OTP record */
    const { rows } = await pool.query(
      `SELECT id, otp_hash, attempts
       FROM public.phone_otps
       WHERE user_id    = $1
         AND phone      = $2
         AND purpose    = $3
         AND used       = false
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, localPhone, purpose]
    );

    if (!rows.length) {
      return res.status(400).json({
        success: false, code: "OTP_EXPIRED", layer: "policy",
        message: "OTP expired or not found. Please request a new one.",
      });
    }

    const record = rows[0];

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      /* Mark exhausted record as used */
      await pool.query(
        `UPDATE public.phone_otps SET used = true WHERE id = $1`,
        [record.id]
      );
      return res.status(429).json({
        success: false, code: "OTP_MAX_ATTEMPTS", layer: "policy",
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    /*
     * Atomically increment the attempt counter AND enforce the max
     * in a single round-trip. The UPDATE only succeeds when:
     *   - record still exists and is unused
     *   - attempts has not yet reached the limit
     * This eliminates the TOCTOU gap between the SELECT and UPDATE.
     */
    const { rows: incremented } = await pool.query(
      `UPDATE public.phone_otps
       SET attempts = attempts + 1
       WHERE id       = $1
         AND used     = false
         AND expires_at > NOW()
         AND attempts < $2
       RETURNING id, otp_hash, attempts`,
      [record.id, OTP_MAX_ATTEMPTS]
    );

    if (!incremented.length) {
      /* Record was concurrently invalidated between SELECT and UPDATE */
      return res.status(429).json({
        success: false, code: "OTP_MAX_ATTEMPTS", layer: "policy",
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    const updatedRecord = incremented[0];

    if (!verifyOtp(updatedRecord.otp_hash, otp.trim())) {
      const remaining = OTP_MAX_ATTEMPTS - updatedRecord.attempts;
      return res.status(400).json({
        success   : false,
        code      : "OTP_INCORRECT",
        layer     : "input",
        message   : remaining > 0
          ? `Incorrect OTP. ${remaining} attempt(s) remaining.`
          : "Too many incorrect attempts. Please request a new OTP.",
        remaining,
      });
    }

    /* OTP is correct — detect network */
    const network = detectNetwork(localPhone);
    if (!network) {
      return res.status(400).json({
        success: false, code: "UNKNOWN_NETWORK", layer: "input",
        message: "Could not detect the network for this number.",
      });
    }

    /* Mark OTP used */
    await pool.query(
      `UPDATE public.phone_otps SET used = true WHERE id = $1`,
      [record.id]
    );

    /* Update user profile atomically */
    const { rows: updatedRows } = await pool.query(
      `UPDATE public.users
       SET
         phone             = $1,
         phone_verified    = true,
         phone_verified_at = NOW(),
         phone_network     = $2,
         phone_changed_at  = CASE WHEN $3 THEN NOW() ELSE phone_changed_at END,
         updated_at        = NOW()
       WHERE id = $4
       RETURNING id, phone, phone_verified, phone_network`,
      [localPhone, network, purpose === "change", userId]
    );

    if (!updatedRows.length) {
      return res.status(404).json({
        success: false, code: "USER_NOT_FOUND", layer: "auth",
        message: "User not found.",
      });
    }

    /* Flush all caches associated with this user's phone state */
    await Promise.allSettled([
      invalidateUserPhoneCache(userId),
      cacheDel(KEY.otpSendLimit(userId, localPhone)),
      cacheDel(KEY.otpResendCool(userId, localPhone)),
    ]);

    console.log(
      `[airtime-coupons] Phone verified ✓ | user=${userId} | ` +
      `phone=${maskPhone(localPhone)} | network=${network} | purpose=${purpose}`
    );

    return res.json({
      success : true,
      message : "Phone number verified successfully.",
      phone   : {
        has_phone    : true,
        local_number : null,      // never return the full number post-verification
        masked       : maskPhone(localPhone),
        network,
        verified     : true,
        source       : "verified",
      },
    });

  } catch (err) {
    return sendError(res, err, "POST /verify-otp");
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/airtime-coupons
═══════════════════════════════════════════════════════════════ */
router.get("/", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const cached = await safeCacheGet(KEY.userCoupons(userId));
    if (cached) return res.json({ ...cached, cached: true });

    const { rows } = await pool.query(
      `SELECT
         id, code, amount, status,
         redeemed_at, processed_at,
         phone, network, admin_note,
         created_at
       FROM public.airtime_coupons
       WHERE user_id = $1
       ORDER BY
         CASE status
           WHEN 'available'  THEN 0
           WHEN 'redeemed'   THEN 1
           WHEN 'processing' THEN 2
           WHEN 'completed'  THEN 3
           WHEN 'failed'     THEN 4
           ELSE 5
         END,
         created_at DESC`,
      [userId]
    );

    const coupons = rows.map((c) => ({
      id           : c.id,
      code         : c.code,
      amount       : Number(c.amount),
      status       : c.status,
      can_redeem   : c.status === AIRTIME_STATUS.AVAILABLE,
      redeemed_at  : c.redeemed_at,
      processed_at : c.processed_at,
      phone_masked : maskPhone(c.phone),
      // phone_local is intentionally omitted — never expose full numbers
      network      : c.network,
      admin_note   : c.admin_note,
      created_at   : c.created_at,
    }));

    const counts = {
      total      : coupons.length,
      available  : 0,
      redeemed   : 0,
      processing : 0,
      completed  : 0,
      failed     : 0,
    };
    for (const c of coupons) {
      if (counts[c.status] !== undefined) counts[c.status]++;
    }

    const payload = { success: true, coupons, counts };

    await safeCacheSet(KEY.userCoupons(userId), payload, TTL.USER_COUPONS);
    return res.json(payload);

  } catch (err) {
    return sendError(res, err, "GET /");
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/airtime-coupons/redeem
   Body: { code }
═══════════════════════════════════════════════════════════════ */
router.post("/redeem", authenticate, async (req, res) => {
  const { code } = req.body;
  const userId   = req.user.id;

  if (!code?.trim()) {
    return res.status(400).json({
      success: false, code: "MISSING_CODE", layer: "input",
      message: "Coupon code is required.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Lock the coupon row to prevent concurrent redemptions */
    const { rows: couponRows } = await client.query(
      `SELECT id, user_id, status, amount
       FROM public.airtime_coupons
       WHERE UPPER(code) = UPPER($1)
       LIMIT 1
       FOR UPDATE`,
      [code.trim()]
    );

    if (!couponRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false, code: "COUPON_NOT_FOUND", layer: "database",
        message: "Coupon not found.",
      });
    }

    const coupon = couponRows[0];

    if (coupon.user_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false, code: "NOT_OWNER", layer: "policy",
        message: "This coupon does not belong to your account.",
      });
    }

    if (coupon.status !== AIRTIME_STATUS.AVAILABLE) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success : false,
        code    : `ALREADY_${coupon.status.toUpperCase()}`,
        layer   : "policy",
        message : `This coupon has already been ${coupon.status}.`,
      });
    }

    /* Fetch verified phone — must be verified to redeem */
    const { rows: userRows } = await client.query(
      `SELECT phone, phone_verified, phone_network
       FROM public.users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    const user = userRows[0];

    if (!user?.phone || !user?.phone_verified) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false, code: "PHONE_NOT_VERIFIED", layer: "policy",
        message: "Please verify your phone number before redeeming airtime.",
      });
    }

    const localPhone = normalizePhone(user.phone);
    const network    = user.phone_network || detectNetwork(localPhone);

    if (!network) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false, code: "UNKNOWN_NETWORK", layer: "input",
        message: "Could not detect your network. Please contact support.",
      });
    }

    /*
     * UPDATE with status guard as a second line of defence against
     * race conditions — even with FOR UPDATE, this makes intent explicit.
     */
    const { rows: updated } = await client.query(
      `UPDATE public.airtime_coupons
       SET
         status      = $1,
         redeemed_by = $2,
         redeemed_at = NOW(),
         phone       = $3,
         network     = $4
       WHERE id = $5 AND status = $6
       RETURNING id, code, amount, status, redeemed_at, phone, network`,
      [
        AIRTIME_STATUS.REDEEMED, userId,
        localPhone, network,
        coupon.id, AIRTIME_STATUS.AVAILABLE,
      ]
    );

    if (!updated.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false, code: "RACE_CONDITION", layer: "database",
        message: "This coupon has already been redeemed.",
      });
    }

    await client.query("COMMIT");
    await invalidateUserCouponsCache(userId);

    const result = updated[0];

    console.log(
      `[airtime-coupons] Redeemed ✓ | user=${userId} | ` +
      `code=${result.code} | amount=₦${result.amount} | ` +
      `phone=${maskPhone(localPhone)} | network=${network}`
    );

    return res.json({
      success : true,
      message : `₦${result.amount} airtime coupon redeemed. We will process it shortly.`,
      coupon  : {
        id           : result.id,
        code         : result.code,
        amount       : Number(result.amount),
        status       : result.status,
        can_redeem   : false,
        redeemed_at  : result.redeemed_at,
        phone_masked : maskPhone(result.phone),
        // phone_local intentionally omitted — never expose full numbers
        network      : result.network,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return sendError(res, err, "POST /redeem");
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/airtime-coupons/:code
═══════════════════════════════════════════════════════════════ */
router.get("/:code", authenticate, async (req, res) => {
  const userId = req.user.id;
  const code   = req.params.code?.trim();

  if (!code) {
    return res.status(400).json({
      success: false, code: "MISSING_CODE", layer: "input",
      message: "Coupon code required.",
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         id, code, amount, status,
         redeemed_at, processed_at,
         phone, network, admin_note,
         created_at
       FROM public.airtime_coupons
       WHERE UPPER(code) = UPPER($1) AND user_id = $2
       LIMIT 1`,
      [code, userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false, code: "COUPON_NOT_FOUND", layer: "database",
        message: "Coupon not found.",
      });
    }

    const c = rows[0];
    return res.json({
      success : true,
      coupon  : {
        id           : c.id,
        code         : c.code,
        amount       : Number(c.amount),
        status       : c.status,
        can_redeem   : c.status === AIRTIME_STATUS.AVAILABLE,
        redeemed_at  : c.redeemed_at,
        processed_at : c.processed_at,
        phone_masked : maskPhone(c.phone),
        // phone_local intentionally omitted
        network      : c.network,
        admin_note   : c.admin_note,
        created_at   : c.created_at,
      },
    });

  } catch (err) {
    return sendError(res, err, "GET /:code");
  }
});

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
═══════════════════════════════════════════════════════════════ */
export {
  AIRTIME_STATUS,
  normalizePhone,
  detectNetwork,
  maskPhone,
  hashOtp,
  verifyOtp,
  classifyError,
  sendError,
  invalidateUserCouponsCache,
  invalidateUserPhoneCache,
};
export default router;