// routes/coupons.js
import express      from "express";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";
import crypto       from "crypto";
import {
  cacheGet,
  cacheSet,
  cacheDel,
} from "../lib/redis.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   REDIS KEY HELPERS
═══════════════════════════════════════════════════════════════ */
const KEY = {
  otpSession   : (sessionId)        => `airtime:otp:session:${sessionId}`,
  otpRateLimit : (userId, couponId) => `airtime:otp:ratelimit:${userId}:${couponId}`,
  userCoupons  : (userId)           => `coupons:user:${userId}`,
  userHistory  : (userId)           => `coupons:history:${userId}`,
  userMe       : (userId)           => `user:me:${userId}`, // ← invalidate /users/me too
};

const TTL = {
  OTP_SESSION   : 10 * 60,   // 10 min (seconds)
  RATE_LIMIT    : 10 * 60,   // 10 min
  COUPON_CACHE  :  2 * 60,   //  2 min
  HISTORY_CACHE :  2 * 60,   //  2 min
};

/* ═══════════════════════════════════════════════════════════════
   PHONE HELPERS
═══════════════════════════════════════════════════════════════ */

/* Normalise any phone → 08012345678 */
const normalisePhone = (raw) => {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.startsWith("0"))   return digits;
  if (digits.length === 10)     return "0" + digits;
  return digits;
};

/* Convert 0812... → 2348012... (for SMS providers) */
const toIntlFormat = (phone) => {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0"))   return "234" + digits.slice(1);
  return "234" + digits;
};

/* Validate Nigerian number */
const isValidNgPhone = (phone) => {
  const digits = normalisePhone(phone);
  return !!digits && /^0[789][01]\d{8}$/.test(digits);
};

/* Mask phone for safe display: 0812****678 */
const maskPhone = (phone) => {
  const d = String(phone).replace(/\D/g, "");
  if (d.length < 7) return d;
  return d.slice(0, 4) + "****" + d.slice(-3);
};

const VALID_NETWORKS = ["mtn", "airtel", "glo", "9mobile"];

/* ═══════════════════════════════════════════════════════════════
   SMS SENDER — pluggable (Termii / Twilio / dev fallback)
═══════════════════════════════════════════════════════════════ */
async function sendSms(phone, message) {
  /* ── Termii (popular in Nigeria) ── */
  if (process.env.TERMII_API_KEY) {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method  : "POST",
      headers : { "Content-Type": "application/json" },
      body    : JSON.stringify({
        to      : phone,
        from    : process.env.TERMII_SENDER_ID || "N-Alert",
        sms     : message,
        type    : "plain",
        channel : "dnd",
        api_key : process.env.TERMII_API_KEY,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "SMS failed via Termii");
    return data;
  }

  /* ── Twilio fallback ── */
  if (process.env.TWILIO_ACCOUNT_SID) {
    const { default: Twilio } = await import("twilio");
    const client = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    return client.messages.create({
      body : message,
      from : process.env.TWILIO_PHONE_NUMBER,
      to   : `+${phone}`,
    });
  }

  /* ── Dev fallback — log only ── */
  console.log(`\n[SMS DEV] ────────────────────────────`);
  console.log(`  To     : ${phone}`);
  console.log(`  Message: ${message}`);
  console.log(`──────────────────────────────────────\n`);
  return { dev: true };
}

/* ═══════════════════════════════════════════════════════════════
   ENSURE TABLES + INDEXES
═══════════════════════════════════════════════════════════════ */
async function ensureTables() {

  /* ── Coupons ── */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.coupons (
      id           UUID        NOT NULL DEFAULT gen_random_uuid(),
      code         TEXT        NOT NULL,
      type         TEXT        NOT NULL DEFAULT 'percentage',
      value        DECIMAL     NOT NULL DEFAULT 0,
      min_purchase DECIMAL     NOT NULL DEFAULT 0,
      max_discount DECIMAL     NULL,
      usage_limit  INT8        NULL,
      usage_count  INT8        NOT NULL DEFAULT 0,
      expires_at   TIMESTAMPTZ NULL,
      is_active    BOOLEAN     NOT NULL DEFAULT true,
      is_private   BOOLEAN     NOT NULL DEFAULT false,
      description  TEXT        NULL,
      created_by   UUID        NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT coupons_pkey PRIMARY KEY (id)
    )
  `);

  /* ── Airtime coupons ── */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.airtime_coupons (
      id         UUID        NOT NULL DEFAULT gen_random_uuid(),
      code       TEXT        NOT NULL,
      amount     DECIMAL     NOT NULL DEFAULT 0,
      user_id    UUID        NOT NULL,
      status     TEXT        NOT NULL DEFAULT 'available',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      claimed_at TIMESTAMPTZ NULL,
      CONSTRAINT airtime_coupons_pkey PRIMARY KEY (id)
    )
  `);

  /* ── Airtime claims — stores verified phone + network ── */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.airtime_claims (
      id                UUID        NOT NULL DEFAULT gen_random_uuid(),
      airtime_coupon_id UUID        NOT NULL,
      user_id           UUID        NOT NULL,
      phone             TEXT        NOT NULL,
      network           TEXT        NOT NULL,
      status            TEXT        NOT NULL DEFAULT 'pending',
      claimed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      credited_at       TIMESTAMPTZ NULL,
      admin_note        TEXT        NULL,
      credited_by       UUID        NULL,
      CONSTRAINT airtime_claims_pkey PRIMARY KEY (id)
    )
  `);

  /* ── Coupon redemptions ── */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
      id                     UUID        NOT NULL DEFAULT gen_random_uuid(),
      coupon_id              UUID        NOT NULL,
      user_id                UUID        NULL,
      order_id               UUID        NULL,
      discount               DECIMAL     NOT NULL DEFAULT 0,
      redeemed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      redeemed_by_admin      UUID        NULL,
      redeemed_by_admin_name TEXT        NULL,
      reward_type            TEXT        NULL,
      reward_value           DECIMAL     NULL,
      reward_description     TEXT        NULL,
      admin_note             TEXT        NULL,
      verified_user_id       UUID        NULL,
      CONSTRAINT coupon_redemptions_pkey PRIMARY KEY (id)
    )
  `);

  const migrations = [
    /* coupons */
    `ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS is_private  BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS created_by  UUID    NULL`,
    `ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS description TEXT    NULL`,
    /* airtime_coupons */
    `ALTER TABLE public.airtime_coupons ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NULL`,
    `ALTER TABLE public.airtime_coupons ADD COLUMN IF NOT EXISTS status     TEXT        NOT NULL DEFAULT 'available'`,
    /* airtime_claims */
    `ALTER TABLE public.airtime_claims ADD COLUMN IF NOT EXISTS credited_at TIMESTAMPTZ NULL`,
    `ALTER TABLE public.airtime_claims ADD COLUMN IF NOT EXISTS admin_note  TEXT        NULL`,
    `ALTER TABLE public.airtime_claims ADD COLUMN IF NOT EXISTS credited_by UUID        NULL`,
    /* coupon_redemptions */
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS redeemed_by_admin      UUID    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS redeemed_by_admin_name TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_type            TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_value           DECIMAL NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_description     TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS admin_note             TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS verified_user_id       UUID    NULL`,
    `ALTER TABLE public.coupon_redemptions ALTER COLUMN user_id DROP NOT NULL`,
  ];

  for (const sql of migrations) {
    try { await pool.query(sql); }
    catch (e) {
      if (!e.message.includes("already exists")) {
        console.warn("[coupons] migration:", e.message);
      }
    }
  }

  /* ── Mark spin wheel coupons as private ── */
  await pool.query(`
    UPDATE public.coupons
    SET is_private = true
    WHERE is_private = false
      AND created_by IS NOT NULL
      AND description LIKE '%Spin & Win%'
  `);

  const indexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS unique_coupon_code        ON public.coupons              (code)`,
    `CREATE        INDEX IF NOT EXISTS idx_coupons_active        ON public.coupons              (is_active)`,
    `CREATE        INDEX IF NOT EXISTS idx_coupons_expires       ON public.coupons              (expires_at)`,
    `CREATE        INDEX IF NOT EXISTS idx_coupons_private       ON public.coupons              (is_private, created_by)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS unique_airtime_code       ON public.airtime_coupons      (code)`,
    `CREATE        INDEX IF NOT EXISTS idx_airtime_user          ON public.airtime_coupons      (user_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS unique_airtime_claim      ON public.airtime_claims       (airtime_coupon_id)`,
    `CREATE        INDEX IF NOT EXISTS idx_airtime_claims_user   ON public.airtime_claims       (user_id)`,
    `CREATE        INDEX IF NOT EXISTS idx_airtime_claims_status ON public.airtime_claims       (status)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS unique_user_coupon        ON public.coupon_redemptions   (coupon_id, user_id) WHERE user_id IS NOT NULL`,
    `CREATE        INDEX IF NOT EXISTS idx_redemptions_coupon    ON public.coupon_redemptions   (coupon_id)`,
    `CREATE        INDEX IF NOT EXISTS idx_redemptions_user      ON public.coupon_redemptions   (user_id) WHERE user_id IS NOT NULL`,
    `CREATE        INDEX IF NOT EXISTS idx_redemptions_admin     ON public.coupon_redemptions   (redeemed_by_admin) WHERE redeemed_by_admin IS NOT NULL`,
  ];

  for (const sql of indexes) {
    try { await pool.query(sql); }
    catch (e) {
      if (!e.message.includes("already exists")) {
        console.warn("[coupons] index:", e.message);
      }
    }
  }

  console.log("[coupons] ✓ all tables & indexes ready");
}

ensureTables().catch((err) =>
  console.warn("[coupons] table init:", err.message)
);

/* ═══════════════════════════════════════════════════════════════
   SHAPE HELPERS
═══════════════════════════════════════════════════════════════ */
function shapeCoupon(c, now) {
  const expiresAt     = c.expires_at ? new Date(c.expires_at) : null;
  const isExpired     = expiresAt ? expiresAt < now : false;
  const isUsed        = c.user_usage_count > 0;
  const isFull        = c.usage_limit
    ? Number(c.usage_count) >= Number(c.usage_limit)
    : false;
  const isDeactivated = !c.is_active;
  const daysLeft      = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - now) / 86_400_000))
    : null;
  const usable = !isExpired && !isUsed && !isFull && !isDeactivated;

  return {
    id           : c.id,
    code         : c.code,
    type         : c.type,
    description  : c.description,
    value        : Number(c.value        || 0),
    min_purchase : Number(c.min_purchase || 0),
    max_discount : c.max_discount ? Number(c.max_discount) : null,
    usage_count  : Number(c.usage_count  || 0),
    usage_limit  : c.usage_limit  ? Number(c.usage_limit)  : null,
    expires_at   : c.expires_at,
    created_at   : c.created_at,
    is_private   : c.is_private,
    is_active    : c.is_active,
    is_expired   : isExpired,
    is_used      : isUsed || isDeactivated,
    is_full      : isFull,
    days_left    : daysLeft,
    usable,
    coupon_kind  : "discount",
  };
}

function shapeAirtime(a) {
  const isUsed = a.status !== "available";
  return {
    id            : a.id,
    code          : a.code,
    type          : "airtime",
    description   : `🎡 Spin & Win — ₦${Number(a.amount)} Airtime`,
    value         : Number(a.amount || 0),
    min_purchase  : 0,
    max_discount  : null,
    usage_count   : isUsed ? 1 : 0,
    usage_limit   : 1,
    expires_at    : null,
    created_at    : a.created_at,
    is_private    : true,
    is_active     : !isUsed,
    is_expired    : false,
    is_used       : isUsed,
    is_full       : isUsed,
    days_left     : null,
    usable        : !isUsed,
    coupon_kind   : "airtime",
    status        : a.status,
    claimed_at    : a.claimed_at    ?? null,
    claim_phone   : a.claim_phone   ?? null,
    claim_network : a.claim_network ?? null,
  };
}

/* ═══════════════════════════════════════════════════════════════
   CACHE INVALIDATION HELPER
═══════════════════════════════════════════════════════════════ */
async function invalidateUserCache(userId, alsoMe = false) {
  const jobs = [
    cacheDel(KEY.userCoupons(userId)),
    cacheDel(KEY.userHistory(userId)),
  ];
  if (alsoMe) jobs.push(cacheDel(KEY.userMe(userId)));
  await Promise.allSettled(jobs);
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons
═══════════════════════════════════════════════════════════════ */
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const now    = new Date();

    /* ── Try Redis cache first ── */
    const cached = await cacheGet(KEY.userCoupons(userId));
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    /* ── Discount coupons ── */
    const { rows: discountRows } = await pool.query(
      `SELECT
         c.id, c.code, c.type, c.value, c.min_purchase, c.max_discount,
         c.usage_limit, c.usage_count, c.expires_at, c.description,
         c.is_private, c.is_active, c.created_at,
         COUNT(r.id) FILTER (WHERE r.user_id = $1)::int AS user_usage_count
       FROM public.coupons c
       LEFT JOIN public.coupon_redemptions r ON r.coupon_id = c.id
       WHERE
         (c.is_active = true AND c.is_private = false)
         OR (c.is_active = true AND c.is_private = true AND c.created_by = $1)
         OR (
           EXISTS (
             SELECT 1 FROM public.coupon_redemptions rx
             WHERE rx.coupon_id = c.id AND rx.user_id = $1
           )
         )
       GROUP BY
         c.id, c.code, c.type, c.value, c.min_purchase,
         c.max_discount, c.usage_limit, c.usage_count,
         c.expires_at, c.description, c.is_private, c.is_active, c.created_at
       ORDER BY
         CASE
           WHEN c.is_active = true
            AND (c.expires_at IS NULL OR c.expires_at > NOW())
            AND (c.usage_limit IS NULL OR c.usage_count < c.usage_limit)
           THEN 0 ELSE 1
         END,
         c.created_at DESC`,
      [userId]
    );

    /* ── Airtime coupons + joined claim info ── */
    const { rows: airtimeRows } = await pool.query(
      `SELECT
         ac.id, ac.code, ac.amount, ac.status, ac.created_at, ac.claimed_at,
         cl.phone   AS claim_phone,
         cl.network AS claim_network
       FROM public.airtime_coupons ac
       LEFT JOIN public.airtime_claims cl ON cl.airtime_coupon_id = ac.id
       WHERE ac.user_id = $1
       ORDER BY ac.created_at DESC`,
      [userId]
    );

    const discountCoupons = discountRows.map((c) => shapeCoupon(c, now));
    const airtimeCoupons  = airtimeRows.map(shapeAirtime);

    const usable = [
      ...airtimeCoupons .filter((c) =>  c.usable),
      ...discountCoupons.filter((c) =>  c.usable),
    ];
    const inactive = [
      ...airtimeCoupons .filter((c) => !c.usable),
      ...discountCoupons.filter((c) => !c.usable),
    ];

    const coupons = [...usable, ...inactive];

    const payload = {
      success : true,
      coupons,
      counts  : {
        total    : coupons.length,
        usable   : usable.length,
        airtime  : airtimeCoupons.length,
        discount : discountCoupons.length,
      },
    };

    await cacheSet(KEY.userCoupons(userId), payload, TTL.COUPON_CACHE);
    return res.json(payload);

  } catch (err) {
    console.error("[coupons] GET /:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons/airtime
═══════════════════════════════════════════════════════════════ */
router.get("/airtime", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT
         ac.id, ac.code, ac.amount, ac.status, ac.created_at, ac.claimed_at,
         cl.phone   AS claim_phone,
         cl.network AS claim_network
       FROM public.airtime_coupons ac
       LEFT JOIN public.airtime_claims cl ON cl.airtime_coupon_id = ac.id
       WHERE ac.user_id = $1
       ORDER BY ac.created_at DESC`,
      [userId]
    );

    return res.json({
      success         : true,
      airtime_coupons : rows.map(shapeAirtime),
    });

  } catch (err) {
    console.error("[coupons] GET /airtime:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/coupons/airtime/send-otp
   Body: { code, phone, network }
═══════════════════════════════════════════════════════════════ */
router.post("/airtime/send-otp", authenticate, async (req, res) => {
  const { code, phone, network } = req.body;
  const userId = req.user.id;

  if (!code?.trim())  return res.status(400).json({ success: false, message: "Airtime code is required." });
  if (!phone?.trim()) return res.status(400).json({ success: false, message: "Phone number is required." });
  if (!network || !VALID_NETWORKS.includes(network.toLowerCase())) {
    return res.status(400).json({
      success : false,
      message : `Network must be one of: ${VALID_NETWORKS.join(", ")}.`,
    });
  }

  const cleanPhone = normalisePhone(phone);

  if (!isValidNgPhone(cleanPhone)) {
    return res.status(400).json({
      success : false,
      message : "Enter a valid 11-digit Nigerian phone number (e.g. 08012345678).",
    });
  }

  try {
    /* ── Verify coupon ownership + status ── */
    const { rows } = await pool.query(
      `SELECT id, amount, status, user_id
       FROM   public.airtime_coupons
       WHERE  UPPER(code) = UPPER($1)
       LIMIT  1`,
      [code.trim()]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Airtime coupon not found." });
    }

    const ac = rows[0];

    if (ac.user_id !== userId) {
      return res.status(403).json({
        success : false,
        message : "This coupon does not belong to your account.",
      });
    }

    if (ac.status !== "available") {
      return res.status(409).json({
        success : false,
        message : `This coupon has already been ${ac.status}.`,
      });
    }

    /* ── Rate limit ── */
    const rateLimitKey = KEY.otpRateLimit(userId, ac.id);
    const currentCount = await cacheGet(rateLimitKey);
    const sendCount    = currentCount ? Number(currentCount) : 0;

    if (sendCount >= 3) {
      return res.status(429).json({
        success : false,
        message : "Too many OTP requests. Please wait 10 minutes before trying again.",
      });
    }

    await cacheSet(
      rateLimitKey,
      sendCount + 1,
      sendCount === 0 ? TTL.RATE_LIMIT : undefined
    );

    /* ── Generate OTP + session ── */
    const otp       = crypto.randomInt(100_000, 999_999).toString();
    const sessionId = crypto.randomUUID();
    const intlPhone = toIntlFormat(cleanPhone);

    await cacheSet(
      KEY.otpSession(sessionId),
      {
        otp,
        phone     : cleanPhone,           // stored in 0812... format
        intlPhone,                         // 234812... for SMS
        network   : network.toLowerCase(),
        code      : code.trim().toUpperCase(),
        couponId  : ac.id,
        userId,
        amount    : Number(ac.amount),
        attempts  : 0,
      },
      TTL.OTP_SESSION
    );

    /* ── Send SMS ── */
    const smsText =
      `Your airtime claim verification code is: ${otp}\n` +
      `Valid for 10 minutes. Do not share this code with anyone.`;

    await sendSms(intlPhone, smsText);

    console.log(
      `[coupons] OTP sent | user=${userId} | phone=${maskPhone(cleanPhone)} | ` +
      `coupon=${code.trim().toUpperCase()} | attempt=${sendCount + 1}/3`
    );

    return res.json({
      success    : true,
      session_id : sessionId,
      message    : `Verification code sent to ${maskPhone(cleanPhone)}.`,
      expires_in : TTL.OTP_SESSION,
      ...(process.env.NODE_ENV === "development" && { dev_otp: otp }),
    });

  } catch (err) {
    console.error("[coupons] POST /airtime/send-otp:", err.message);

    if (err.message?.toLowerCase().includes("sms")) {
      return res.status(502).json({
        success : false,
        message : "Could not send SMS. Please check your number and try again.",
      });
    }

    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/coupons/airtime/verify-claim
   Body: { code, otp, session_id }

   Flow:
   1. Load Redis session, validate OTP
   2. DB transaction:
        a. Mark coupon claimed
        b. Insert airtime_claims record
        c. Update user.phone + phone_verified + phone_network
   3. Clean Redis + invalidate caches
═══════════════════════════════════════════════════════════════ */
router.post("/airtime/verify-claim", authenticate, async (req, res) => {
  const { otp, session_id } = req.body;
  const userId = req.user.id;

  if (!session_id?.trim()) {
    return res.status(400).json({ success: false, message: "Session ID is required." });
  }
  if (!otp || !/^\d{6}$/.test(otp.trim())) {
    return res.status(400).json({ success: false, message: "Enter the 6-digit code." });
  }

  const sessionKey = KEY.otpSession(session_id);
  const session    = await cacheGet(sessionKey);

  if (!session) {
    return res.status(400).json({
      success : false,
      message : "Verification session expired or not found. Please request a new code.",
    });
  }

  if (session.userId !== userId) {
    return res.status(403).json({ success: false, message: "Session mismatch." });
  }

  /* ── Max wrong attempts (5) ── */
  if (session.attempts >= 5) {
    await cacheDel(sessionKey);
    return res.status(429).json({
      success : false,
      message : "Too many incorrect attempts. Please request a new code.",
    });
  }

  /* ── OTP comparison ── */
  if (session.otp !== otp.trim()) {
    const updated = { ...session, attempts: session.attempts + 1 };
    await cacheSet(sessionKey, updated, TTL.OTP_SESSION);

    const remaining = 5 - updated.attempts;
    if (remaining <= 0) {
      await cacheDel(sessionKey);
      return res.status(429).json({
        success : false,
        message : "Too many incorrect attempts. Please request a new code.",
      });
    }

    return res.status(400).json({
      success   : false,
      message   : `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      remaining,
    });
  }

  /* ════════════════════════════════════════════════════════
     OTP CORRECT — DB TRANSACTION
  ════════════════════════════════════════════════════════ */
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── Re-check coupon with row lock ── */
    const { rows } = await client.query(
      `SELECT id, amount, status, user_id
       FROM   public.airtime_coupons
       WHERE  UPPER(code) = UPPER($1)
       FOR    UPDATE`,
      [session.code]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }

    const ac = rows[0];

    if (ac.user_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success : false,
        message : "This coupon does not belong to your account.",
      });
    }

    if (ac.status !== "available") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success : false,
        message : `This coupon has already been ${ac.status}.`,
      });
    }

    /* ── Mark coupon claimed ── */
    await client.query(
      `UPDATE public.airtime_coupons
       SET    status     = 'claimed',
              claimed_at = NOW()
       WHERE  id = $1`,
      [ac.id]
    );

    /* ── Insert claim record ── */
    await client.query(
      `INSERT INTO public.airtime_claims
         (airtime_coupon_id, user_id, phone, network, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (airtime_coupon_id) DO NOTHING`,
      [ac.id, userId, session.phone, session.network]
    );

    /* ── Update user profile with verified phone ──
       Uses "phone" column (not phone_number) so we don't
       overwrite the registration phone.
    */
    try {
      await client.query(
        `UPDATE public.users
         SET    phone             = $1,
                phone_network     = $2,
                phone_verified    = true,
                phone_verified_at = NOW(),
                updated_at        = NOW()
         WHERE  id = $3`,
        [session.phone, session.network, userId]
      );
    } catch (e) {
      /* Non-fatal — most common cause is unique_phone conflict */
      console.warn(
        `[coupons] Could not update user.phone for user=${userId}: ${e.message}`
      );
    }

    await client.query("COMMIT");

    /* ── Clean up Redis + caches ── */
    await Promise.allSettled([
      cacheDel(sessionKey),
      cacheDel(KEY.otpRateLimit(userId, ac.id)),
      invalidateUserCache(userId, true), // also invalidate /users/me cache
    ]);

    console.log(
      `[coupons] Airtime claimed ✓ | user=${userId} | ` +
      `coupon=${session.code} | phone=${maskPhone(session.phone)} | ` +
      `network=${session.network}`
    );

    return res.json({
      success : true,
      message : `✅ ₦${ac.amount} airtime claim submitted! You'll receive it within 24 hours.`,
      code    : session.code,
      amount  : Number(ac.amount),
      phone   : session.phone,
      network : session.network,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[coupons] POST /airtime/verify-claim:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/coupons/airtime/claim  (direct — phone already verified)
   Body: { code, phone, network }
   Used when the user's phone is already verified.
═══════════════════════════════════════════════════════════════ */
router.post("/airtime/claim", authenticate, async (req, res) => {
  const { code, phone, network } = req.body;
  const userId = req.user.id;

  if (!code?.trim()) {
    return res.status(400).json({ success: false, message: "Airtime code is required." });
  }

  if (phone && !isValidNgPhone(phone)) {
    return res.status(400).json({ success: false, message: "Invalid phone number." });
  }

  if (network && !VALID_NETWORKS.includes(network?.toLowerCase())) {
    return res.status(400).json({ success: false, message: "Invalid network." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, amount, status, user_id
       FROM   public.airtime_coupons
       WHERE  UPPER(code) = UPPER($1)
       FOR    UPDATE`,
      [code.trim()]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Airtime coupon not found." });
    }

    const ac = rows[0];

    if (ac.user_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success : false,
        message : "This coupon does not belong to your account.",
      });
    }

    if (ac.status !== "available") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success : false,
        message : `This coupon has already been ${ac.status}.`,
      });
    }

    /* ── Mark claimed ── */
    await client.query(
      `UPDATE public.airtime_coupons
       SET    status     = 'claimed',
              claimed_at = NOW()
       WHERE  id = $1`,
      [ac.id]
    );

    /* ── Insert claim record ── */
    let finalPhone   = null;
    let finalNetwork = null;

    if (phone && network) {
      finalPhone   = normalisePhone(phone);
      finalNetwork = network.toLowerCase();

      await client.query(
        `INSERT INTO public.airtime_claims
           (airtime_coupon_id, user_id, phone, network, status)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT (airtime_coupon_id) DO NOTHING`,
        [ac.id, userId, finalPhone, finalNetwork]
      );
    } else {
      /* Fall back to user's saved verified phone */
      const { rows: uRows } = await client.query(
        `SELECT phone, phone_network, phone_verified
         FROM   public.users
         WHERE  id = $1`,
        [userId]
      );

      if (uRows[0]?.phone_verified && uRows[0]?.phone) {
        finalPhone   = normalisePhone(uRows[0].phone);
        finalNetwork = uRows[0].phone_network || null;

        await client.query(
          `INSERT INTO public.airtime_claims
             (airtime_coupon_id, user_id, phone, network, status)
           VALUES ($1, $2, $3, $4, 'pending')
           ON CONFLICT (airtime_coupon_id) DO NOTHING`,
          [ac.id, userId, finalPhone, finalNetwork]
        );
      }
    }

    await client.query("COMMIT");

    /* ── Invalidate caches ── */
    await invalidateUserCache(userId);

    return res.json({
      success : true,
      message : `✅ ₦${Number(ac.amount)} airtime claim submitted. We'll credit your number shortly.`,
      code    : code.trim().toUpperCase(),
      amount  : Number(ac.amount),
      phone   : finalPhone,
      network : finalNetwork,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[coupons] POST /airtime/claim:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/coupons/validate
   Body: { code, order_amount }
═══════════════════════════════════════════════════════════════ */
router.post("/validate", authenticate, async (req, res) => {
  const { code, order_amount = 0 } = req.body;
  const userId = req.user.id;

  if (!code?.trim()) {
    return res.status(400).json({ success: false, message: "Coupon code is required." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.coupons
       WHERE UPPER(code) = UPPER($1)
         AND is_active   = true
       LIMIT 1`,
      [code.trim()]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Invalid coupon code." });
    }

    const c   = rows[0];
    const now = new Date();

    if (c.is_private && c.created_by !== userId) {
      return res.status(403).json({
        success : false,
        message : "This coupon is not valid for your account.",
      });
    }

    if (c.expires_at && new Date(c.expires_at) < now) {
      return res.status(400).json({ success: false, message: "This coupon has expired." });
    }

    if (c.usage_limit && Number(c.usage_count) >= Number(c.usage_limit)) {
      return res.status(400).json({
        success : false,
        message : "This coupon has reached its usage limit.",
      });
    }

    const { rows: used } = await pool.query(
      `SELECT id FROM public.coupon_redemptions
       WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
      [c.id, userId]
    );

    if (used.length) {
      return res.status(400).json({
        success : false,
        message : "You have already used this coupon.",
      });
    }

    const amount = Number(order_amount);

    if (Number(c.min_purchase) > 0 && amount < Number(c.min_purchase)) {
      return res.status(400).json({
        success : false,
        message : `A minimum order of ₦${Number(c.min_purchase).toLocaleString("en-NG")} is required.`,
      });
    }

    let discount = 0;
    let message  = "";

    if (c.type === "percentage") {
      discount = (amount * Number(c.value)) / 100;
      if (c.max_discount) discount = Math.min(discount, Number(c.max_discount));
      discount = Math.round(discount);
      message  = `Coupon applied! You save ₦${discount.toLocaleString("en-NG")}.`;
    } else if (c.type === "fixed") {
      discount = Math.round(Math.min(Number(c.value), amount));
      message  = `Coupon applied! You save ₦${discount.toLocaleString("en-NG")}.`;
    } else if (c.type === "free_shipping") {
      discount = 0;
      message  = "Free shipping applied! Your delivery fee is waived at checkout.";
    }

    return res.json({
      success : true,
      valid   : true,
      coupon  : {
        id          : c.id,
        code        : c.code,
        type        : c.type,
        value       : Number(c.value),
        description : c.description,
      },
      discount,
      final_amount : Math.max(0, amount - discount),
      message,
    });

  } catch (err) {
    console.error("[coupons] POST /validate:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/coupons/redeem
   Body: { code, order_id, discount }
═══════════════════════════════════════════════════════════════ */
router.post("/redeem", authenticate, async (req, res) => {
  const { code, order_id, discount } = req.body;
  const userId = req.user.id;

  if (!code?.trim()) {
    return res.status(400).json({ success: false, message: "Coupon code is required." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, is_private, created_by, usage_limit FROM public.coupons
       WHERE UPPER(code) = UPPER($1) AND is_active = true LIMIT 1`,
      [code.trim()]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }

    const coupon = rows[0];

    if (coupon.is_private && coupon.created_by !== userId) {
      return res.status(403).json({
        success : false,
        message : "This coupon is not valid for your account.",
      });
    }

    const { rows: existing } = await pool.query(
      `SELECT id FROM public.coupon_redemptions
       WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
      [coupon.id, userId]
    );

    if (existing.length) {
      return res.status(409).json({
        success : false,
        message : "You have already redeemed this coupon.",
      });
    }

    await pool.query(
      `INSERT INTO public.coupon_redemptions
         (coupon_id, user_id, order_id, discount)
       VALUES ($1, $2, $3, $4)`,
      [coupon.id, userId, order_id || null, Number(discount || 0)]
    );

    const isSingleUse =
      coupon.usage_limit !== null && Number(coupon.usage_limit) === 1;

    await pool.query(
      `UPDATE public.coupons
       SET
         usage_count = usage_count + 1,
         is_active   = CASE WHEN $1 THEN false ELSE is_active END
       WHERE id = $2`,
      [isSingleUse, coupon.id]
    );

    /* ── Invalidate caches ── */
    await invalidateUserCache(userId);

    return res.json({ success: true, message: "Coupon redeemed successfully." });

  } catch (err) {
    console.error("[coupons] POST /redeem:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons/history
═══════════════════════════════════════════════════════════════ */
router.get("/history", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    /* ── Try cache ── */
    const cached = await cacheGet(KEY.userHistory(userId));
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const [discountRes, airtimeRes] = await Promise.all([
      pool.query(
        `SELECT
           r.id, r.discount, r.redeemed_at, r.order_id,
           r.redeemed_by_admin_name,
           c.code, c.type, c.value, c.description
         FROM public.coupon_redemptions r
         JOIN public.coupons c ON c.id = r.coupon_id
         WHERE r.user_id = $1
         ORDER BY r.redeemed_at DESC
         LIMIT 50`,
        [userId]
      ),
      pool.query(
        `SELECT
           ac.id, ac.code,
           ac.amount     AS value,
           ac.status,
           ac.created_at,
           ac.claimed_at AS redeemed_at,
           cl.phone      AS claim_phone,
           cl.network    AS claim_network
         FROM public.airtime_coupons ac
         LEFT JOIN public.airtime_claims cl ON cl.airtime_coupon_id = ac.id
         WHERE ac.user_id = $1
           AND ac.status  != 'available'
         ORDER BY ac.claimed_at DESC
         LIMIT 50`,
        [userId]
      ),
    ]);

    const discountHistory = discountRes.rows.map((r) => ({
      ...r,
      coupon_kind            : "discount",
      discount               : Number(r.discount || 0),
      value                  : Number(r.value    || 0),
      redeemed_by_admin      : !!r.redeemed_by_admin_name,
      redeemed_by_admin_name : r.redeemed_by_admin_name || null,
    }));

    const airtimeHistory = airtimeRes.rows.map((r) => ({
      id                     : r.id,
      coupon_kind            : "airtime",
      code                   : r.code,
      type                   : "airtime",
      description            : `₦${Number(r.value)} Airtime — ${r.status}`,
      value                  : Number(r.value || 0),
      discount               : Number(r.value || 0),
      status                 : r.status,
      redeemed_at            : r.redeemed_at,
      claim_phone            : r.claim_phone   ?? null,
      claim_network          : r.claim_network ?? null,
      order_id               : null,
      redeemed_by_admin      : false,
      redeemed_by_admin_name : null,
    }));

    const history = [...discountHistory, ...airtimeHistory].sort(
      (a, b) => new Date(b.redeemed_at) - new Date(a.redeemed_at)
    );

    const payload = { success: true, history };
    await cacheSet(KEY.userHistory(userId), payload, TTL.HISTORY_CACHE);

    return res.json(payload);

  } catch (err) {
    console.error("[coupons] GET /history:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

export default router;