// routes/airtimeCoupons.js
import express      from "express";
import crypto       from "crypto";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();

const OTP_TTL_MINUTES  = 10;
const OTP_MAX_ATTEMPTS = 5;
const IS_PROD = process.env.NODE_ENV === "production";

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

const toIntlPhone = (local) => {
  const digits = String(local).replace(/\D/g, "");
  if (digits.startsWith("0")) return "+234" + digits.slice(1);
  return "+234" + digits;
};

const isValidPhone = (local) =>
  /^0[789][01]\d{8}$/.test(local);

const maskPhone = (phone) => {
  if (!phone) return null;
  const d = normalizePhone(phone);
  return d.slice(0, 4) + "****" + d.slice(-3);
};

const detectNetwork = (phone) => {
  const local  = normalizePhone(phone);
  const prefix = local.slice(0, 4);
  const map = {
    "0703":"MTN","0704":"MTN","0706":"MTN",
    "0803":"MTN","0806":"MTN","0810":"MTN",
    "0813":"MTN","0814":"MTN","0816":"MTN",
    "0903":"MTN","0906":"MTN","0913":"MTN","0916":"MTN",
    "0701":"Airtel","0708":"Airtel","0802":"Airtel",
    "0808":"Airtel","0812":"Airtel","0901":"Airtel",
    "0902":"Airtel","0904":"Airtel","0907":"Airtel","0912":"Airtel",
    "0705":"Glo","0805":"Glo","0807":"Glo",
    "0811":"Glo","0815":"Glo","0905":"Glo","0915":"Glo",
    "0809":"9mobile","0817":"9mobile","0818":"9mobile",
    "0908":"9mobile","0909":"9mobile",
  };
  return map[prefix] || null;
};

/* ═══════════════════════════════════════════════════════════════
   OTP HELPERS
═══════════════════════════════════════════════════════════════ */
const generateOtp = () =>
  crypto.randomInt(100_000, 999_999).toString();

/* ═══════════════════════════════════════════════════════════════
   SMS — Termii v4
   Uses the new v4 API endpoint (https://v4.api.termii.com)
   which is what modern "tlv_" prefixed keys authenticate against.
═══════════════════════════════════════════════════════════════ */
async function sendSms(intlPhone, otp) {
  const message =
    `Your Loemart verification code is ${otp}. ` +
    `Valid for ${OTP_TTL_MINUTES} minutes. Do not share it.`;

  if (process.env.TERMII_API_KEY) {
    const payload = {
      to      : intlPhone.replace(/^\+/, ""),          // "2348145244928"
      from    : process.env.TERMII_SENDER_ID || "N-Alert",
      sms     : message,
      type    : "plain",
      channel : "generic",                              // v4 default channel
      api_key : process.env.TERMII_API_KEY,
    };

    const res = await fetch("https://v4.api.termii.com/api/sms/send", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    /* Log the raw Termii response for debugging */
    console.log(
      `[termii v4] status=${res.status} response=${JSON.stringify(data)}`
    );

    /* Detect failure — v4 returns various error shapes */
    const failed =
      !res.ok ||
      data.code === "401" ||
      data.code === "403" ||
      /invalid|unauthor|forbidden/i.test(data.message || "") ||
      /invalid|unauthor|forbidden/i.test(data.error   || "");

    if (failed) {
      throw new Error(
        data.message ||
        data.error   ||
        `Termii HTTP ${res.status}`
      );
    }

    console.log(`[airtime] ✓ SMS sent via Termii v4 to ${intlPhone}`);
    return { ok: true };
  }

  /* ── Dev fallback — never runs in production ── */
  if (IS_PROD) {
    throw new Error("No SMS provider configured");
  }

  console.log(
    `\n[SMS DEV] ─────────────────────────\n` +
    `  To : ${intlPhone}\n`                   +
    `  OTP: ${otp}\n`                         +
    `────────────────────────────────────\n`
  );
  return { ok: true, dev_otp: otp };
}

/* ═══════════════════════════════════════════════════════════════
   DB SETUP — runs once on startup
   Creates phone_otps table if not there.
   Works with both "otp" and "otp_hash" column names.
═══════════════════════════════════════════════════════════════ */

/* Which column name does phone_otps actually have? */
let OTP_COL = "otp"; // default

async function setup() {
  /* Add phone columns to users if missing */
  await pool.query(`
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS phone             TEXT        NULL,
      ADD COLUMN IF NOT EXISTS phone_verified    BOOLEAN     NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS phone_network     TEXT        NULL
  `).catch((e) => console.warn("[airtime] users columns:", e.message));

  /* Create phone_otps if it doesn't exist */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.phone_otps (
      id         UUID        NOT NULL DEFAULT gen_random_uuid(),
      user_id    UUID        NOT NULL,
      phone      TEXT        NOT NULL,
      otp        TEXT        NOT NULL,
      attempts   INT2        NOT NULL DEFAULT 0,
      used       BOOLEAN     NOT NULL DEFAULT false,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT phone_otps_pkey PRIMARY KEY (id)
    )
  `).catch((e) => console.warn("[airtime] phone_otps table:", e.message));

  /* Detect actual column name (otp or otp_hash) */
  const { rows } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'phone_otps'
      AND column_name  IN ('otp', 'otp_hash')
  `);
  const names = rows.map((r) => r.column_name);
  OTP_COL = names.includes("otp_hash") ? "otp_hash" : "otp";

  /* Indexes */
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_otps_lookup
      ON public.phone_otps (user_id, phone, used, expires_at)
  `).catch(() => {});

  /* Unique index on users.phone */
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_users_phone
      ON public.users (phone) WHERE phone IS NOT NULL
  `).catch(() => {});

  console.log(`[airtime] ✓ ready | OTP column: "${OTP_COL}"`);
}

setup().catch((e) =>
  console.error("[airtime] setup failed:", e.message)
);

/* ═══════════════════════════════════════════════════════════════
   ROUTE 1 — POST /api/airtime-coupons/send-otp
   Body: { phone }
   1. Validates phone
   2. Stores OTP in DB
   3. Sends SMS via Termii v4
═══════════════════════════════════════════════════════════════ */
router.post("/send-otp", authenticate, async (req, res) => {
  const userId = req.user.id;
  const phone  = normalizePhone(req.body?.phone);

  /* Validate */
  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "Phone number is required.",
    });
  }

  if (!isValidPhone(phone)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid 11-digit Nigerian number.",
    });
  }

  const network = detectNetwork(phone);

  try {
    /* Invalidate any existing unused OTPs for this user */
    await pool.query(
      `UPDATE public.phone_otps
       SET used = true
       WHERE user_id = $1 AND phone = $2 AND used = false`,
      [userId, phone]
    );

    /* Generate OTP */
    const otp       = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    /* Save OTP to DB */
    await pool.query(
      `INSERT INTO public.phone_otps
         (user_id, phone, ${OTP_COL}, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, phone, otp, expiresAt]
    );

    /* Send SMS */
    const smsResult = await sendSms(toIntlPhone(phone), otp);

    console.log(
      `[airtime] OTP sent | user=${userId} | phone=${maskPhone(phone)}`
    );

    return res.json({
      success     : true,
      message     : `Code sent to ${maskPhone(phone)}.`,
      masked      : maskPhone(phone),
      network,
      resend_after: 60,
      expires_in  : OTP_TTL_MINUTES * 60,
      /* Only included outside production */
      ...(!IS_PROD && smsResult.dev_otp
        ? { dev_otp: smsResult.dev_otp }
        : {}
      ),
    });

  } catch (err) {
    console.error("[airtime] send-otp error:", err.message);

    const msg = String(err.message || "").toLowerCase();

    /* SMS-specific errors */
    if (msg.includes("invalid") && (msg.includes("api") || msg.includes("key"))) {
      return res.status(502).json({
        success: false,
        code   : "SMS_AUTH_FAILED",
        message: "SMS service authentication failed. Please contact support.",
        ...(!IS_PROD && { debug: err.message }),
      });
    }

    if (msg.includes("insufficient") || msg.includes("balance") || msg.includes("credit")) {
      return res.status(502).json({
        success: false,
        code   : "SMS_NO_CREDIT",
        message: "SMS service is out of credit. Please contact support.",
      });
    }

    if (msg.includes("no sms provider")) {
      return res.status(503).json({
        success: false,
        code   : "SMS_NOT_CONFIGURED",
        message: "SMS service is not configured.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to send verification code. Please try again.",
      ...(!IS_PROD && { debug: err.message }),
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ROUTE 2 — POST /api/airtime-coupons/verify-otp
   Body: { phone, otp }
   1. Checks OTP
   2. Saves phone + verified = true to users table
═══════════════════════════════════════════════════════════════ */
router.post("/verify-otp", authenticate, async (req, res) => {
  const userId = req.user.id;
  const phone  = normalizePhone(req.body?.phone);
  const otp    = String(req.body?.otp || "").trim();

  /* Validate */
  if (!phone || !otp) {
    return res.status(400).json({
      success: false,
      message: "Phone and OTP are required.",
    });
  }

  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      success: false,
      message: "OTP must be 6 digits.",
    });
  }

  try {
    /* Find the active OTP */
    const { rows } = await pool.query(
      `SELECT id, ${OTP_COL} AS otp_value, attempts
       FROM public.phone_otps
       WHERE user_id    = $1
         AND phone      = $2
         AND used       = false
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, phone]
    );

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        code   : "OTP_EXPIRED",
        message: "Code expired or not found. Please request a new one.",
      });
    }

    const record = rows[0];

    /* Too many attempts */
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await pool.query(
        `UPDATE public.phone_otps SET used = true WHERE id = $1`,
        [record.id]
      );
      return res.status(429).json({
        success: false,
        code   : "OTP_MAX_ATTEMPTS",
        message: "Too many incorrect attempts. Request a new code.",
      });
    }

    /* Increment attempt count */
    await pool.query(
      `UPDATE public.phone_otps SET attempts = attempts + 1 WHERE id = $1`,
      [record.id]
    );

    /* Check OTP */
    if (record.otp_value !== otp) {
      const remaining = OTP_MAX_ATTEMPTS - (record.attempts + 1);
      return res.status(400).json({
        success  : false,
        code     : "OTP_INCORRECT",
        message  : remaining > 0
          ? `Wrong code. ${remaining} attempt(s) left.`
          : "Too many incorrect attempts. Request a new code.",
        remaining,
      });
    }

    /* ✓ OTP correct — mark used */
    await pool.query(
      `UPDATE public.phone_otps SET used = true WHERE id = $1`,
      [record.id]
    );

    const network = detectNetwork(phone);

    /* Save phone to users table */
    await pool.query(
      `UPDATE public.users
       SET
         phone             = $1,
         phone_verified    = true,
         phone_verified_at = NOW(),
         phone_network     = $2,
         updated_at        = NOW()
       WHERE id = $3`,
      [phone, network, userId]
    );

    console.log(
      `[airtime] Phone verified ✓ | user=${userId} | ` +
      `phone=${maskPhone(phone)} | network=${network}`
    );

    return res.json({
      success: true,
      message: "Phone number verified successfully.",
      phone  : {
        masked  : maskPhone(phone),
        network,
        verified: true,
      },
    });

  } catch (err) {
    console.error("[airtime] verify-otp error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Verification failed. Please try again.",
      ...(!IS_PROD && { debug: err.message }),
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ROUTE 3 — GET /api/airtime-coupons/phone-status
   Returns the user's current phone state
═══════════════════════════════════════════════════════════════ */
router.get("/phone-status", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT phone, phone_verified, phone_verified_at, phone_network
       FROM public.users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const u = rows[0];

    return res.json({
      success: true,
      phone  : {
        has_phone  : !!u.phone,
        masked     : maskPhone(u.phone),
        verified   : u.phone_verified || false,
        network    : u.phone_network  || null,
        verified_at: u.phone_verified_at,
      },
    });

  } catch (err) {
    console.error("[airtime] phone-status error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch phone status.",
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ROUTE 4 — GET /api/airtime-coupons
   Returns user's airtime coupons
═══════════════════════════════════════════════════════════════ */
router.get("/", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT id, code, amount, status, redeemed_at,
              phone, network, created_at
       FROM public.airtime_coupons
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({
      success : true,
      coupons : rows.map((c) => ({
        id         : c.id,
        code       : c.code,
        amount     : Number(c.amount),
        status     : c.status,
        can_redeem : c.status === "available",
        redeemed_at: c.redeemed_at,
        phone      : maskPhone(c.phone),
        network    : c.network,
        created_at : c.created_at,
      })),
    });

  } catch (err) {
    console.error("[airtime] list error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch coupons.",
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ROUTE 5 — POST /api/airtime-coupons/redeem
   Body: { code }
═══════════════════════════════════════════════════════════════ */
router.post("/redeem", authenticate, async (req, res) => {
  const userId = req.user.id;
  const code   = String(req.body?.code || "").trim();

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Coupon code is required.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Lock coupon row */
    const { rows: couponRows } = await client.query(
      `SELECT id, user_id, status, amount
       FROM public.airtime_coupons
       WHERE UPPER(code) = UPPER($1)
       LIMIT 1 FOR UPDATE`,
      [code]
    );

    if (!couponRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    const coupon = couponRows[0];

    if (coupon.user_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: "This coupon does not belong to your account.",
      });
    }

    if (coupon.status !== "available") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `This coupon has already been ${coupon.status}.`,
      });
    }

    /* Check phone is verified */
    const { rows: userRows } = await client.query(
      `SELECT phone, phone_verified, phone_network
       FROM public.users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    const user = userRows[0];

    if (!user?.phone || !user?.phone_verified) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        code   : "PHONE_NOT_VERIFIED",
        message: "Please verify your phone number first.",
      });
    }

    const phone   = normalizePhone(user.phone);
    const network = user.phone_network || detectNetwork(phone);

    /* Mark coupon redeemed */
    const { rows: updated } = await client.query(
      `UPDATE public.airtime_coupons
       SET status = 'redeemed', redeemed_by = $1,
           redeemed_at = NOW(), phone = $2, network = $3
       WHERE id = $4 AND status = 'available'
       RETURNING id, code, amount, status, redeemed_at`,
      [userId, phone, network, coupon.id]
    );

    if (!updated.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Coupon was already redeemed.",
      });
    }

    await client.query("COMMIT");

    const r = updated[0];

    console.log(
      `[airtime] Redeemed ✓ | user=${userId} | ` +
      `code=${r.code} | ₦${r.amount} | phone=${maskPhone(phone)}`
    );

    return res.json({
      success: true,
      message: `₦${r.amount} airtime coupon redeemed. We'll process it shortly.`,
      coupon : {
        id         : r.id,
        code       : r.code,
        amount     : Number(r.amount),
        status     : r.status,
        redeemed_at: r.redeemed_at,
        phone      : maskPhone(phone),
        network,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[airtime] redeem error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Redemption failed. Please try again.",
    });
  } finally {
    client.release();
  }
});

export default router;