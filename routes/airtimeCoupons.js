// routes/airtimeCoupons.js
import express      from "express";
import crypto       from "crypto";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";
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
const OTP_RESEND_COOLDOWN  = 60;
const CHANGE_COOLDOWN_DAYS = 60;
const IS_PROD = process.env.NODE_ENV === "production";

const AIRTIME_STATUS = Object.freeze({
  AVAILABLE  : "available",
  REDEEMED   : "redeemed",
  PROCESSING : "processing",
  COMPLETED  : "completed",
  FAILED     : "failed",
});

const VALID_PURPOSES = Object.freeze(["verify", "change", "reclaim"]);

/* ═══════════════════════════════════════════════════════════════
   SCHEMA AUTO-DETECTION
   Detects whether phone_otps uses "otp" or "otp_hash" column.
   Works with both old and new schemas — no migration needed.
═══════════════════════════════════════════════════════════════ */
let _otpColumnName = null;   // "otp" or "otp_hash"
let _useHashing    = false;  // true if column is otp_hash

async function detectOtpColumn() {
  if (_otpColumnName) return;

  try {
    const { rows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'phone_otps'
        AND column_name  IN ('otp', 'otp_hash')
      ORDER BY column_name
    `);

    const names = rows.map((r) => r.column_name);

    if (names.includes("otp_hash")) {
      _otpColumnName = "otp_hash";
      _useHashing    = true;
    } else if (names.includes("otp")) {
      _otpColumnName = "otp";
      _useHashing    = false;
    } else {
      throw new Error("Neither 'otp' nor 'otp_hash' column found in phone_otps");
    }

    console.log(
      `[airtime-coupons] OTP column detected: "${_otpColumnName}" ` +
      `(hashing: ${_useHashing})`
    );
  } catch (err) {
    console.error("[airtime-coupons] OTP column detection failed:", err.message);
    // Default to plaintext so existing deployments don't break
    _otpColumnName = "otp";
    _useHashing    = false;
  }
}

// Run on startup
detectOtpColumn().catch(() => {});

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
  RATE_LIMIT   : 10 * 60,
  RESEND_COOL  : 60,
  PHONE_STATUS : 2 * 60,
  USER_COUPONS : 2 * 60,
};

/* ═══════════════════════════════════════════════════════════════
   PHONE HELPERS
═══════════════════════════════════════════════════════════════ */
const normalizePhone = (raw) => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.startsWith("0"))   return digits;
  if (digits.length === 10)     return "0" + digits;
  return digits;
};

const toIntlPhone = (localPhone) => {
  const digits = String(localPhone).replace(/\D/g, "");
  if (digits.startsWith("234")) return "+" + digits;
  if (digits.startsWith("0"))   return "+234" + digits.slice(1);
  return "+234" + digits;
};

const isValidNigerianPhone = (localPhone) =>
  /^0[789][01]\d{8}$/.test(localPhone);

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
const generateOtp = () =>
  crypto.randomInt(100_000, 999_999).toString();

const hashOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");

/**
 * Prepare OTP value for storage based on detected schema.
 * - otp_hash column → stores SHA-256 hash
 * - otp column → stores plaintext (legacy)
 */
const prepareOtpForStorage = (otp) =>
  _useHashing ? hashOtp(otp) : otp;

/**
 * Compare a candidate OTP against the stored value.
 * Handles both hashed and plaintext schemas.
 */
const compareOtp = (storedValue, candidateOtp) => {
  if (_useHashing) {
    const candidateHash = hashOtp(candidateOtp);
    const bufA = Buffer.from(storedValue);
    const bufB = Buffer.from(candidateHash);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
  // Plaintext comparison (still timing-safe)
  const bufA = Buffer.from(String(storedValue));
  const bufB = Buffer.from(String(candidateOtp));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/* ═══════════════════════════════════════════════════════════════
   NETWORK DETECTION
═══════════════════════════════════════════════════════════════ */
const PREFIX_MAP = Object.freeze({
  "0703":"MTN","0704":"MTN","0706":"MTN",
  "0803":"MTN","0806":"MTN","0810":"MTN",
  "0813":"MTN","0814":"MTN","0816":"MTN",
  "0903":"MTN","0906":"MTN","0913":"MTN","0916":"MTN",
  "0701":"Airtel","0708":"Airtel",
  "0802":"Airtel","0808":"Airtel","0812":"Airtel",
  "0901":"Airtel","0902":"Airtel","0904":"Airtel",
  "0907":"Airtel","0912":"Airtel",
  "0705":"Glo","0805":"Glo","0807":"Glo",
  "0811":"Glo","0815":"Glo","0905":"Glo","0915":"Glo",
  "0809":"9mobile","0817":"9mobile","0818":"9mobile",
  "0908":"9mobile","0909":"9mobile",
});

const detectNetwork = (phone) => {
  const local  = normalizePhone(phone);
  const prefix = local.slice(0, 4);
  return PREFIX_MAP[prefix] || null;
};

/* ═══════════════════════════════════════════════════════════════
   CACHE HELPERS
═══════════════════════════════════════════════════════════════ */
async function safeCacheGet(key) {
  try { return await cacheGet(key); }
  catch (e) {
    console.warn(`[airtime] cache GET failed (${key}):`, e.message);
    return null;
  }
}

async function safeCacheSet(key, val, ttl) {
  if (!ttl || typeof ttl !== "number" || ttl <= 0) return null;
  try { return await cacheSet(key, val, ttl); }
  catch (e) {
    console.warn(`[airtime] cache SET failed (${key}):`, e.message);
    return null;
  }
}

async function safeCacheDel(key) {
  try { return await cacheDel(key); }
  catch (e) {
    console.warn(`[airtime] cache DEL failed (${key}):`, e.message);
    return null;
  }
}

async function incrementRateLimit(key, windowSeconds) {
  try {
    const current  = await cacheGet(key);
    const newCount = (Number(current) || 0) + 1;
    await cacheSet(key, newCount, windowSeconds);
    return newCount;
  } catch (e) {
    console.warn(`[airtime] rate-limit failed (${key}):`, e.message);
    return 1;
  }
}

async function invalidateUserPhoneCache(userId) {
  await Promise.allSettled([
    safeCacheDel(KEY.phoneStatus(userId)),
    safeCacheDel(KEY.userCoupons(userId)),
    safeCacheDel(KEY.userMe(userId)),
    safeCacheDel(KEY.mergedCoupons(userId)),
    safeCacheDel(KEY.mergedHistory(userId)),
  ]);
}

async function invalidateUserCouponsCache(userId) {
  await Promise.allSettled([
    safeCacheDel(KEY.userCoupons(userId)),
    safeCacheDel(KEY.mergedCoupons(userId)),
    safeCacheDel(KEY.mergedHistory(userId)),
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   ERROR HANDLER
═══════════════════════════════════════════════════════════════ */
function classifyError(err) {
  const msg  = String(err?.message || "").toLowerCase();
  const code = err?.code || "";

  if (
    (code === "ECONNREFUSED" && msg.includes("5432")) ||
    msg.includes("database is starting up") ||
    msg.includes("connection terminated") ||
    msg.includes("pool ended")
  ) {
    return {
      status: 503, code: "DB_UNAVAILABLE", layer: "database",
      message: "Database is temporarily unreachable.",
      detail: err.message,
    };
  }

  if (typeof code === "string" && code.length === 5) {
    if (code === "23505") return {
      status: 409, code: "DUPLICATE", layer: "database",
      message: err.detail || "Entry already exists.",
      detail: err.message,
    };
    if (code === "23502") return {
      status: 400, code: "MISSING_FIELD", layer: "database",
      message: `Missing required field: ${err.column || "unknown"}`,
      detail: err.message,
    };
    if (code === "23503") return {
      status: 400, code: "FK_VIOLATION", layer: "database",
      message: "Referenced record does not exist.",
      detail: err.message,
    };
    if (code === "42P01") return {
      status: 500, code: "TABLE_MISSING", layer: "database",
      message: "Database table does not exist.",
      detail: err.message,
    };
    if (code === "42703") return {
      status: 500, code: "COLUMN_MISSING", layer: "database",
      message: "Database column does not exist.",
      detail: err.message,
    };
    if (code.startsWith("42")) return {
      status: 500, code: "SQL_SYNTAX", layer: "database",
      message: "Database query error.",
      detail: err.message,
    };
    if (code === "40001" || code === "40P01") return {
      status: 409, code: "DB_CONFLICT", layer: "database",
      message: "Concurrent update conflict. Please retry.",
      detail: err.message,
    };
    return {
      status: 500, code: `DB_${code}`, layer: "database",
      message: err.message || "Database error.",
      detail: err.message,
    };
  }

  if (msg.includes("redis") || msg.includes("ioredis") ||
      (code === "ECONNREFUSED" && msg.includes("6379"))) {
    return {
      status: 503, code: "CACHE_UNAVAILABLE", layer: "cache",
      message: "Cache is temporarily unavailable.",
      detail: err.message,
    };
  }

  if (msg.includes("termii") || msg.includes("twilio") || msg.includes("sms provider")) {
    if (msg.includes("insufficient") || msg.includes("balance")) return {
      status: 502, code: "SMS_NO_CREDIT", layer: "sms",
      message: "SMS service out of credit.", detail: err.message,
    };
    if (msg.includes("invalid") && msg.includes("number")) return {
      status: 400, code: "SMS_INVALID_NUMBER", layer: "sms",
      message: "SMS provider rejected this number.", detail: err.message,
    };
    return {
      status: 502, code: "SMS_PROVIDER_ERROR", layer: "sms",
      message: "Could not send SMS.", detail: err.message,
    };
  }

  if (code === "ECONNREFUSED" || code === "ENOTFOUND" ||
      code === "ETIMEDOUT"    || code === "ECONNRESET") {
    return {
      status: 502, code: "UPSTREAM_UNAVAILABLE", layer: "network",
      message: "A dependent service is unreachable.",
      detail: err.message,
    };
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return {
      status: 401, code: "AUTH_INVALID", layer: "auth",
      message: "Authentication failed. Please log in again.",
      detail: err.message,
    };
  }

  return {
    status: 500, code: "INTERNAL_ERROR", layer: "server",
    message: "An unexpected error occurred.",
    detail: err.message,
  };
}

function sendError(res, err, context = "") {
  const c = classifyError(err);

  console.error(
    `[airtime] ${context} FAILED | ${c.layer}/${c.code} | ${err.message}`
  );

  const payload = {
    success: false,
    code   : c.code,
    layer  : c.layer,
    message: c.message,
  };

  if (!IS_PROD) {
    payload.debug = {
      original_message: err.message,
      original_code   : err.code,
      stack           : err.stack?.split("\n").slice(0, 5).join("\n"),
    };
  }

  return res.status(c.status).json(payload);
}

/* ═══════════════════════════════════════════════════════════════
   SMS SENDER
═══════════════════════════════════════════════════════════════ */
let _twilioClient = null;

async function sendSms(intlPhone, message) {
  if (process.env.TERMII_API_KEY) {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({
        to      : intlPhone.replace(/^\+/, ""),
        from    : process.env.TERMII_SENDER_ID || "N-Alert",
        sms     : message,
        type    : "plain",
        channel : "dnd",
        api_key : process.env.TERMII_API_KEY,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`termii: ${data.message || `HTTP ${res.status}`}`);
    return data;
  }

  if (process.env.TWILIO_ACCOUNT_SID) {
    if (!_twilioClient) {
      const Twilio  = (await import("twilio")).default;
      _twilioClient = new Twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
    try {
      return await _twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to  : intlPhone,
      });
    } catch (e) {
      throw new Error(`sms provider: twilio: ${e.message}`);
    }
  }

  if (IS_PROD) throw new Error("sms provider: no SMS provider configured");

  console.log(`[SMS DEV] To: ${intlPhone} | Message: ${message}`);
  return { dev: true };
}

/* ═══════════════════════════════════════════════════════════════
   OTP EXPIRY CLEANUP (fire-and-forget)
═══════════════════════════════════════════════════════════════ */
function purgeExpiredOtps() {
  pool.query(
    `DELETE FROM public.phone_otps WHERE expires_at < NOW() - INTERVAL '24 hours'`
  ).catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════
   SAFE TABLE SETUP
   Never throws. Never crashes. Logs warnings only.
═══════════════════════════════════════════════════════════════ */
let _tablesReady = false;

async function ensureTables() {
  try {
    // Users columns
    await pool.query(`
      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS phone             TEXT        NULL,
        ADD COLUMN IF NOT EXISTS phone_verified    BOOLEAN     NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS phone_changed_at  TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS phone_network     TEXT        NULL,
        ADD COLUMN IF NOT EXISTS phone_number      TEXT        NULL
    `).catch((e) => console.warn("[airtime] users migration:", e.message));

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_users_phone
        ON public.users (phone) WHERE phone IS NOT NULL
    `).catch((e) => {
      if (!e.message.includes("already exists"))
        console.warn("[airtime] unique_users_phone:", e.message);
    });

    // phone_otps table — detect which column name to use
    const { rows: existingCols } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'phone_otps'
    `);

    if (existingCols.length === 0) {
      // Table doesn't exist yet — create with the column name we prefer
      // Use "otp" for maximum compatibility with existing code
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.phone_otps (
          id         UUID        NOT NULL DEFAULT gen_random_uuid(),
          user_id    UUID        NOT NULL,
          phone      TEXT        NOT NULL,
          otp        TEXT        NOT NULL,
          purpose    TEXT        NOT NULL DEFAULT 'verify',
          attempts   INT2        NOT NULL DEFAULT 0,
          used       BOOLEAN     NOT NULL DEFAULT false,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT phone_otps_pkey PRIMARY KEY (id)
        )
      `);
    }

    // Re-detect column after table is confirmed to exist
    await detectOtpColumn();

    // Indexes
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_otps_user    ON public.phone_otps (user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_otps_expires ON public.phone_otps (expires_at)`,
      `CREATE INDEX IF NOT EXISTS idx_otps_lookup  ON public.phone_otps (user_id, phone, purpose, used, expires_at)`,
    ];
    for (const sql of indexes) {
      await pool.query(sql).catch((e) => {
        if (!e.message.includes("already exists"))
          console.warn("[airtime] index:", e.message);
      });
    }

    // airtime_coupons table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.airtime_coupons (
        id           UUID        NOT NULL DEFAULT gen_random_uuid(),
        code         TEXT        NOT NULL,
        amount       DECIMAL     NOT NULL,
        user_id      UUID        NULL,
        status       TEXT        NOT NULL DEFAULT 'available'
                     CHECK (status IN ('available','redeemed','processing','completed','failed')),
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
      `CREATE UNIQUE INDEX IF NOT EXISTS unique_airtime_code     ON public.airtime_coupons (code)`,
      `CREATE INDEX IF NOT EXISTS idx_airtime_user               ON public.airtime_coupons (user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_airtime_status             ON public.airtime_coupons (status)`,
      `CREATE INDEX IF NOT EXISTS idx_airtime_redeemed_by        ON public.airtime_coupons (redeemed_by)`,
      `CREATE INDEX IF NOT EXISTS idx_airtime_user_status        ON public.airtime_coupons (user_id, status)`,
    ];
    for (const sql of couponIndexes) {
      await pool.query(sql).catch((e) => {
        if (!e.message.includes("already exists"))
          console.warn("[airtime] coupon index:", e.message);
      });
    }

    _tablesReady = true;
    console.log(
      `[airtime] ✓ tables ready (OTP column: "${_otpColumnName}", hashing: ${_useHashing})`
    );
  } catch (err) {
    console.error("[airtime] ensureTables failed:", err.message);
    // Do NOT re-throw — let routes handle gracefully
  }
}

ensureTables();

/* ═══════════════════════════════════════════════════════════════
   GET /phone-status
═══════════════════════════════════════════════════════════════ */
router.get("/phone-status", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const cached = await safeCacheGet(KEY.phoneStatus(userId));
    if (cached) return res.json({ ...cached, cached: true });

    const { rows } = await pool.query(
      `SELECT phone, phone_number, phone_verified, phone_verified_at,
              phone_changed_at, phone_network
       FROM public.users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false, code: "USER_NOT_FOUND", layer: "auth",
        message: "User not found.",
      });
    }

    const u = rows[0];

    const bestPhone =
      (u.phone_verified && u.phone) ? normalizePhone(u.phone)       :
      u.phone_number                ? normalizePhone(u.phone_number) :
      u.phone                       ? normalizePhone(u.phone)        :
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
      success: true,
      phone: {
        has_phone         : hasPhone,
        local_number      : hasPhone && !u.phone_verified ? bestPhone : null,
        masked            : maskPhone(bestPhone),
        verified          : u.phone_verified || false,
        network           : u.phone_network || detectNetwork(bestPhone) || null,
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
   POST /send-otp
   Body: { phone, purpose }
═══════════════════════════════════════════════════════════════ */
router.post("/send-otp", authenticate, async (req, res) => {
  const { phone, purpose = "verify" } = req.body;
  const userId = req.user.id;

  try {
    /* ── Re-detect column if not yet detected ── */
    if (!_otpColumnName) await detectOtpColumn();

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
        message: "Unrecognized network prefix.",
      });
    }

    /* Piggyback cleanup */
    purgeExpiredOtps();

    /* ── Cross-account conflict ── */
    const { rows: conflict } = await pool.query(
      `SELECT id FROM public.users
       WHERE phone = $1 AND phone_verified = true AND id != $2
       LIMIT 1`,
      [localPhone, userId]
    );

    if (conflict.length) {
      return res.status(409).json({
        success: false, code: "PHONE_TAKEN", layer: "policy",
        message: "This phone number is linked to another account.",
      });
    }

    /* ── Change cooldown ── */
    if (purpose === "change") {
      const { rows: userRows } = await pool.query(
        `SELECT phone_changed_at FROM public.users WHERE id = $1 LIMIT 1`,
        [userId]
      );
      const changedAt = userRows[0]?.phone_changed_at;
      if (changedAt && daysSince(changedAt) < CHANGE_COOLDOWN_DAYS) {
        const daysLeft = CHANGE_COOLDOWN_DAYS - daysSince(changedAt);
        return res.status(429).json({
          success: false, code: "CHANGE_COOLDOWN", layer: "policy",
          message: `You can change your phone in ${daysLeft} day(s).`,
          days_remaining: daysLeft,
        });
      }
    }

    /* ── Resend cooldown ── */
    const cooldownKey = KEY.otpResendCool(userId, localPhone);
    const inCooldown  = await safeCacheGet(cooldownKey);
    if (inCooldown) {
      const secondsLeft = Number(inCooldown) || OTP_RESEND_COOLDOWN;
      return res.status(429).json({
        success: false, code: "RESEND_COOLDOWN", layer: "policy",
        message: `Please wait ${secondsLeft}s before requesting another code.`,
        retry_after: secondsLeft,
      });
    }

    /* ── Hard rate limit ── */
    const rateLimitKey = KEY.otpSendLimit(userId, localPhone);
    const currentCount = Number(await safeCacheGet(rateLimitKey)) || 0;

    if (currentCount >= OTP_SEND_LIMIT) {
      return res.status(429).json({
        success: false, code: "RATE_LIMITED", layer: "policy",
        message: `Too many OTP requests. Wait ${OTP_TTL_MINUTES} minutes.`,
      });
    }

    /* ── Invalidate pending OTPs ── */
    await pool.query(
      `UPDATE public.phone_otps SET used = true
       WHERE user_id = $1 AND phone = $2 AND purpose = $3 AND used = false`,
      [userId, localPhone, purpose]
    );

    /* ── Generate + store OTP ── */
    const otp       = generateOtp();
    const stored    = prepareOtpForStorage(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    /*
     * CRITICAL: Use the detected column name.
     * This is the line that was causing the COLUMN_MISSING crash.
     */
    await pool.query(
      `INSERT INTO public.phone_otps
         (user_id, phone, ${_otpColumnName}, purpose, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, localPhone, stored, purpose, expiresAt]
    );

    /* ── Send SMS ── */
    try {
      await sendSms(
        intlPhone,
        `Your Loemart code is ${otp}. Valid for ${OTP_TTL_MINUTES} minutes. Do not share it.`
      );
    } catch (smsErr) {
      // Clean up the OTP row since user never got the code
      await pool.query(
        `UPDATE public.phone_otps SET used = true
         WHERE user_id = $1 AND phone = $2 AND purpose = $3
           AND used = false AND ${_otpColumnName} = $4`,
        [userId, localPhone, purpose, stored]
      ).catch(() => {});
      return sendError(res, smsErr, "POST /send-otp (SMS)");
    }

    /* ── Update rate-limit counters AFTER successful SMS ── */
    await Promise.allSettled([
      incrementRateLimit(rateLimitKey, TTL.RATE_LIMIT),
      safeCacheSet(cooldownKey, OTP_RESEND_COOLDOWN, TTL.RESEND_COOL),
    ]);

    console.log(
      `[airtime] OTP sent | user=${userId} | phone=${maskPhone(localPhone)} | ` +
      `purpose=${purpose} | attempt=${currentCount + 1}/${OTP_SEND_LIMIT} | ` +
      `column=${_otpColumnName} | hashing=${_useHashing}`
    );

    return res.json({
      success      : true,
      message      : `OTP sent to ${maskPhone(localPhone)}.`,
      masked       : maskPhone(localPhone),
      network,
      expires_in   : OTP_TTL_MINUTES * 60,
      resend_after : OTP_RESEND_COOLDOWN,
      attempts_left: OTP_SEND_LIMIT - (currentCount + 1),
      ...(!IS_PROD && { dev_otp: otp }),
    });

  } catch (err) {
    return sendError(res, err, "POST /send-otp");
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /verify-otp
   Body: { phone, otp, purpose }
═══════════════════════════════════════════════════════════════ */
router.post("/verify-otp", authenticate, async (req, res) => {
  const { phone, otp, purpose = "verify" } = req.body;
  const userId = req.user.id;

  try {
    if (!_otpColumnName) await detectOtpColumn();

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

    /* Fetch latest active OTP — use detected column name */
    const { rows } = await pool.query(
      `SELECT id, ${_otpColumnName} AS otp_value, attempts
       FROM public.phone_otps
       WHERE user_id = $1 AND phone = $2 AND purpose = $3
         AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, localPhone, purpose]
    );

    if (!rows.length) {
      return res.status(400).json({
        success: false, code: "OTP_EXPIRED", layer: "policy",
        message: "OTP expired or not found. Request a new one.",
      });
    }

    const record = rows[0];

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await pool.query(
        `UPDATE public.phone_otps SET used = true WHERE id = $1`,
        [record.id]
      );
      return res.status(429).json({
        success: false, code: "OTP_MAX_ATTEMPTS", layer: "policy",
        message: "Too many incorrect attempts. Request a new OTP.",
      });
    }

    /* Atomic increment + check */
    const { rows: incremented } = await pool.query(
      `UPDATE public.phone_otps
       SET attempts = attempts + 1
       WHERE id = $1 AND used = false AND expires_at > NOW() AND attempts < $2
       RETURNING id, ${_otpColumnName} AS otp_value, attempts`,
      [record.id, OTP_MAX_ATTEMPTS]
    );

    if (!incremented.length) {
      return res.status(429).json({
        success: false, code: "OTP_MAX_ATTEMPTS", layer: "policy",
        message: "Too many incorrect attempts. Request a new OTP.",
      });
    }

    const updated = incremented[0];

    if (!compareOtp(updated.otp_value, otp.trim())) {
      const remaining = OTP_MAX_ATTEMPTS - updated.attempts;
      return res.status(400).json({
        success  : false,
        code     : "OTP_INCORRECT",
        layer    : "input",
        message  : remaining > 0
          ? `Incorrect OTP. ${remaining} attempt(s) remaining.`
          : "Too many incorrect attempts. Request a new OTP.",
        remaining,
      });
    }

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

    /* Update user profile */
    const { rows: updatedRows } = await pool.query(
      `UPDATE public.users
       SET phone = $1, phone_verified = true, phone_verified_at = NOW(),
           phone_network = $2,
           phone_changed_at = CASE WHEN $3 THEN NOW() ELSE phone_changed_at END,
           updated_at = NOW()
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

    await Promise.allSettled([
      invalidateUserPhoneCache(userId),
      safeCacheDel(KEY.otpSendLimit(userId, localPhone)),
      safeCacheDel(KEY.otpResendCool(userId, localPhone)),
    ]);

    console.log(
      `[airtime] Phone verified ✓ | user=${userId} | ` +
      `phone=${maskPhone(localPhone)} | network=${network}`
    );

    return res.json({
      success: true,
      message: "Phone number verified successfully.",
      phone: {
        has_phone   : true,
        local_number: null,
        masked      : maskPhone(localPhone),
        network,
        verified    : true,
        source      : "verified",
      },
    });

  } catch (err) {
    return sendError(res, err, "POST /verify-otp");
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /  (list user's airtime coupons)
═══════════════════════════════════════════════════════════════ */
router.get("/", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const cached = await safeCacheGet(KEY.userCoupons(userId));
    if (cached) return res.json({ ...cached, cached: true });

    const { rows } = await pool.query(
      `SELECT id, code, amount, status, redeemed_at, processed_at,
              phone, network, admin_note, created_at
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
      id          : c.id,
      code        : c.code,
      amount      : Number(c.amount),
      status      : c.status,
      can_redeem  : c.status === AIRTIME_STATUS.AVAILABLE,
      redeemed_at : c.redeemed_at,
      processed_at: c.processed_at,
      phone_masked: maskPhone(c.phone),
      network     : c.network,
      admin_note  : c.admin_note,
      created_at  : c.created_at,
    }));

    const counts = { total: coupons.length, available: 0, redeemed: 0,
                     processing: 0, completed: 0, failed: 0 };
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
   POST /redeem
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

    const { rows: couponRows } = await client.query(
      `SELECT id, user_id, status, amount
       FROM public.airtime_coupons
       WHERE UPPER(code) = UPPER($1)
       LIMIT 1 FOR UPDATE`,
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
        success: false,
        code   : `ALREADY_${coupon.status.toUpperCase()}`,
        layer  : "policy",
        message: `This coupon has already been ${coupon.status}.`,
      });
    }

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
        message: "Verify your phone number before redeeming airtime.",
      });
    }

    const localPhone = normalizePhone(user.phone);
    const network    = user.phone_network || detectNetwork(localPhone);

    if (!network) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false, code: "UNKNOWN_NETWORK", layer: "input",
        message: "Could not detect your network.",
      });
    }

    const { rows: updated } = await client.query(
      `UPDATE public.airtime_coupons
       SET status = $1, redeemed_by = $2, redeemed_at = NOW(),
           phone = $3, network = $4
       WHERE id = $5 AND status = $6
       RETURNING id, code, amount, status, redeemed_at, phone, network`,
      [AIRTIME_STATUS.REDEEMED, userId, localPhone, network,
       coupon.id, AIRTIME_STATUS.AVAILABLE]
    );

    if (!updated.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false, code: "RACE_CONDITION", layer: "database",
        message: "This coupon was already redeemed.",
      });
    }

    await client.query("COMMIT");
    await invalidateUserCouponsCache(userId);

    const result = updated[0];

    console.log(
      `[airtime] Redeemed ✓ | user=${userId} | code=${result.code} | ` +
      `₦${result.amount} | phone=${maskPhone(localPhone)} | network=${network}`
    );

    return res.json({
      success: true,
      message: `₦${result.amount} airtime coupon redeemed. We will process it shortly.`,
      coupon: {
        id          : result.id,
        code        : result.code,
        amount      : Number(result.amount),
        status      : result.status,
        can_redeem  : false,
        redeemed_at : result.redeemed_at,
        phone_masked: maskPhone(result.phone),
        network     : result.network,
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
   GET /:code
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
      `SELECT id, code, amount, status, redeemed_at, processed_at,
              phone, network, admin_note, created_at
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
      success: true,
      coupon: {
        id          : c.id,
        code        : c.code,
        amount      : Number(c.amount),
        status      : c.status,
        can_redeem  : c.status === AIRTIME_STATUS.AVAILABLE,
        redeemed_at : c.redeemed_at,
        processed_at: c.processed_at,
        phone_masked: maskPhone(c.phone),
        network     : c.network,
        admin_note  : c.admin_note,
        created_at  : c.created_at,
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
  classifyError,
  sendError,
  invalidateUserCouponsCache,
  invalidateUserPhoneCache,
};
export default router;