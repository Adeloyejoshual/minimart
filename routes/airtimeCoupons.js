// routes/airtimeCoupons.js
// ═══════════════════════════════════════════════════════════════
// AIRTIME COUPONS — Production-grade fraud-hardened implementation
// ═══════════════════════════════════════════════════════════════
import express      from "express";
import crypto       from "crypto";
import rateLimit    from "express-rate-limit";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";

import { notify }                       from "../lib/notifications.js";
import { addFraudPoints, isSuspended }  from "../lib/fraudScoring.js";
import { checkSuspiciousActivity }      from "../lib/suspiciousActivity.js";

const router  = express.Router();
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

const isValidPhone = (p) => /^0[789][01]\d{8}$/.test(p);

const maskPhone = (phone) => {
  if (!phone) return null;
  const d = normalizePhone(phone);
  return d.slice(0, 4) + "****" + d.slice(-3);
};

const detectNetwork = (phone) => {
  const local  = normalizePhone(phone);
  const prefix = local.slice(0, 4);
  const map = {
    "0703":"MTN","0704":"MTN","0706":"MTN","0803":"MTN","0806":"MTN",
    "0810":"MTN","0813":"MTN","0814":"MTN","0816":"MTN","0903":"MTN",
    "0906":"MTN","0913":"MTN","0916":"MTN",
    "0701":"Airtel","0708":"Airtel","0802":"Airtel","0808":"Airtel",
    "0812":"Airtel","0901":"Airtel","0902":"Airtel","0904":"Airtel",
    "0907":"Airtel","0912":"Airtel",
    "0705":"Glo","0805":"Glo","0807":"Glo","0811":"Glo",
    "0815":"Glo","0905":"Glo","0915":"Glo",
    "0809":"9mobile","0817":"9mobile","0818":"9mobile",
    "0908":"9mobile","0909":"9mobile",
  };
  return map[prefix] || null;
};

/* ═══════════════════════════════════════════════════════════════
   REQUEST METADATA
═══════════════════════════════════════════════════════════════ */
const getIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.socket?.remoteAddress ||
  null;

const getDeviceHash = (req) => {
  const raw = [
    req.headers["user-agent"]      || "",
    req.headers["accept-language"] || "",
    req.headers["accept-encoding"] || "",
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
};

/* ═══════════════════════════════════════════════════════════════
   SETTINGS CACHE (5-minute TTL)
═══════════════════════════════════════════════════════════════ */
let settingsCache     = null;
let settingsCacheTime = 0;
const SETTINGS_TTL_MS = 5 * 60_000;

async function getSettings() {
  if (settingsCache && Date.now() - settingsCacheTime < SETTINGS_TTL_MS) {
    return settingsCache;
  }
  const { rows } = await pool.query(
    `SELECT key, value FROM public.airtime_settings`
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  settingsCache = {
    max_accounts_per_phone     : parseInt(map.max_accounts_per_phone     ?? "2",  10),
    phone_change_cooldown_days : parseInt(map.phone_change_cooldown_days ?? "30", 10),
    daily_claim_limit          : parseInt(map.daily_claim_limit          ?? "3",  10),
    weekly_claim_limit         : parseInt(map.weekly_claim_limit         ?? "10", 10),
    monthly_claim_limit        : parseInt(map.monthly_claim_limit        ?? "30", 10),
    auto_approve               : map.auto_approve === "true",
    processing_sla_hours       : parseInt(map.processing_sla_hours       ?? "24", 10),
    max_accounts_per_ip        : parseInt(map.max_accounts_per_ip        ?? "5",  10),
    max_accounts_per_device    : parseInt(map.max_accounts_per_device    ?? "3",  10),
  };
  settingsCacheTime = Date.now();
  return settingsCache;
}

const invalidateSettings = () => { settingsCache = null; };

/* ═══════════════════════════════════════════════════════════════
   FRAUD LOG (structured event log for admin review)
═══════════════════════════════════════════════════════════════ */
async function logFraud(client, {
  userId, phone, event, metadata, ipAddress, userAgent,
}) {
  try {
    await (client || pool).query(
      `INSERT INTO public.airtime_fraud_log
         (user_id, phone, event, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, phone, event, JSON.stringify(metadata ?? {}), ipAddress, userAgent]
    );
  } catch (e) {
    console.warn("[fraud-log] failed:", e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   ANTI-FRAUD CHECKS
═══════════════════════════════════════════════════════════════ */
async function countAccountsUsingPhone(client, phone, excludeUserId) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::INT AS cnt
     FROM   public.users
     WHERE  airtime_phone = $1
       AND  id           != $2
       AND  deleted_at IS NULL`,
    [phone, excludeUserId]
  );
  return rows[0]?.cnt ?? 0;
}

async function getCooldownStatus(client, userId, cooldownDays) {
  const { rows } = await client.query(
    `SELECT airtime_phone_updated_at
     FROM   public.users
     WHERE  id = $1
     LIMIT  1`,
    [userId]
  );
  const lastUpdate = rows[0]?.airtime_phone_updated_at;
  if (!lastUpdate) return { in_cooldown: false, next_change_at: null, days_left: 0 };

  const nextChange = new Date(lastUpdate);
  nextChange.setDate(nextChange.getDate() + cooldownDays);
  const now       = new Date();
  const inCool    = now < nextChange;
  const daysLeft  = Math.max(0, Math.ceil((nextChange - now) / (1000 * 60 * 60 * 24)));

  return {
    in_cooldown    : inCool,
    next_change_at : nextChange.toISOString(),
    days_left      : daysLeft,
    last_changed_at: lastUpdate,
  };
}

async function checkClaimLimits(client, userId, settings) {
  const { rows } = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE submitted_at >= NOW() - INTERVAL '1 day')  AS daily,
       COUNT(*) FILTER (WHERE submitted_at >= NOW() - INTERVAL '7 days') AS weekly,
       COUNT(*) FILTER (WHERE submitted_at >= NOW() - INTERVAL '30 days')AS monthly
     FROM public.airtime_claims
     WHERE user_id = $1
       AND status != 'rejected'`,
    [userId]
  );
  const r = rows[0];
  return {
    daily_used   : Number(r.daily),
    weekly_used  : Number(r.weekly),
    monthly_used : Number(r.monthly),
    daily_left   : Math.max(0, settings.daily_claim_limit   - Number(r.daily)),
    weekly_left  : Math.max(0, settings.weekly_claim_limit  - Number(r.weekly)),
    monthly_left : Math.max(0, settings.monthly_claim_limit - Number(r.monthly)),
    can_claim    :
      Number(r.daily)   < settings.daily_claim_limit &&
      Number(r.weekly)  < settings.weekly_claim_limit &&
      Number(r.monthly) < settings.monthly_claim_limit,
  };
}

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const makeLimit = (opts) => rateLimit({
  standardHeaders: true,
  legacyHeaders  : false,
  keyGenerator   : (req) => String(req.user?.id ?? req.ip),
  handler        : (_req, res) => res.status(429).json({
    success: false,
    code   : "RATE_LIMITED",
    message: opts.msg,
  }),
  ...opts,
});

const checkPhoneLimit  = makeLimit({ windowMs: 60_000, max: 20, msg: "Too many checks. Slow down." });
const redeemLimit      = makeLimit({ windowMs: 60_000, max: 5,  msg: "Too many claims. Wait a minute." });
const phoneUpdateLimit = makeLimit({ windowMs: 60_000, max: 10, msg: "Too many updates. Slow down." });

/* ═══════════════════════════════════════════════════════════════
   RELEASE USER PHONES — call on account deletion
═══════════════════════════════════════════════════════════════ */
export async function releaseUserPhones(userId) {
  try {
    await pool.query(
      `UPDATE public.users
       SET    airtime_phone            = NULL,
              airtime_network          = NULL,
              airtime_phone_updated_at = NULL,
              deleted_at               = COALESCE(deleted_at, NOW())
       WHERE  id = $1`,
      [userId]
    );
    await pool.query(
      `UPDATE public.airtime_phone_registry
       SET    is_active   = false,
              released_at = NOW()
       WHERE  user_id = $1 AND is_active = true`,
      [userId]
    );
    console.log(`[airtime] ✓ released phones for deleted user=${userId}`);
  } catch (err) {
    console.error("[releaseUserPhones]:", err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   STARTUP
═══════════════════════════════════════════════════════════════ */
async function setup() {
  console.log("[airtime] initializing…");
  await getSettings();
  console.log("[airtime] ✓ ready");
}
setup().catch((e) => console.error("[airtime] setup failed:", e.message));

/* ════════════════════════════════════════════════════════════════
   ═══════════════════════════════════════════════════════════════
                            USER ROUTES
   ═══════════════════════════════════════════════════════════════
════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   GET /api/airtime-coupons
   List user's airtime coupons
═══════════════════════════════════════════════════════════════ */
router.get("/", authenticate, async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(
      `SELECT id, code, amount, status,
              redeemed_at, phone, network, created_at
       FROM   public.airtime_coupons
       WHERE  user_id = $1
       ORDER  BY created_at DESC`,
      [userId]
    );
    return res.json({
      success: true,
      coupons: rows.map((c) => ({
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
    console.error("[airtime] list:", err.message);
    return res.status(500).json({ success: false, message: "Could not fetch coupons." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/airtime-coupons/airtime-phone
   Returns saved airtime phone + cooldown info
═══════════════════════════════════════════════════════════════ */
router.get("/airtime-phone", authenticate, async (req, res) => {
  const userId   = req.user.id;
  const settings = await getSettings();

  try {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT airtime_phone, airtime_network, airtime_phone_updated_at
         FROM   public.users WHERE id = $1 LIMIT 1`,
        [userId]
      );
      if (!rows.length) {
        return res.status(404).json({ success: false, message: "User not found." });
      }

      const u        = rows[0];
      const cooldown = await getCooldownStatus(client, userId, settings.phone_change_cooldown_days);

      return res.json({
        success: true,
        airtime: {
          has_saved       : !!u.airtime_phone,
          phone           : u.airtime_phone   || null,
          masked          : maskPhone(u.airtime_phone),
          network         : u.airtime_network || null,
          updated_at      : u.airtime_phone_updated_at,
          in_cooldown     : cooldown.in_cooldown,
          next_change_at  : cooldown.next_change_at,
          days_left       : cooldown.days_left,
          cooldown_days   : settings.phone_change_cooldown_days,
        },
      });
    } finally { client.release(); }
  } catch (err) {
    console.error("[airtime] airtime-phone:", err.message);
    return res.status(500).json({ success: false, message: "Could not fetch airtime phone." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/airtime-coupons/check-phone/:phone
   Live availability check (rate-limited, no info leak)
═══════════════════════════════════════════════════════════════ */
router.get("/check-phone/:phone", authenticate, checkPhoneLimit, async (req, res) => {
  const userId   = req.user.id;
  const phone    = normalizePhone(req.params.phone);
  const settings = await getSettings();

  if (!phone || !isValidPhone(phone)) {
    return res.status(400).json({
      success: false, available: false,
      message: "Invalid phone number format.",
    });
  }

  try {
    const client = await pool.connect();
    let count = 0;
    try {
      count = await countAccountsUsingPhone(client, phone, userId);
    } finally { client.release(); }

    const available = count < settings.max_accounts_per_phone;

    return res.json({
      success  : true,
      available,
      message  : available
        ? "Number can be used."
        : "This phone number has reached the maximum number of allowed accounts.",
    });
  } catch (err) {
    console.error("[airtime] check-phone:", err.message);
    return res.status(500).json({ success: false, message: "Check failed." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/airtime-coupons/redeem
   Full redemption pipeline with fraud detection
═══════════════════════════════════════════════════════════════ */
router.post("/redeem", authenticate, redeemLimit, async (req, res) => {
  const userId        = req.user.id;
  const code          = String(req.body?.code || "").trim();
  const phone         = normalizePhone(req.body?.phone);
  const saveAsDefault = req.body?.save_as_default !== false;
  const ip            = getIp(req);
  const userAgent     = req.headers["user-agent"];
  const deviceHash    = getDeviceHash(req);
  const settings      = await getSettings();

  console.log("[redeem] START", { userId, code, phone: maskPhone(phone), saveAsDefault });

  /* ── Input validation ── */
  if (!code) {
    return res.status(400).json({ success: false, message: "Coupon code is required." });
  }
  if (!phone) {
    return res.status(400).json({ success: false, message: "Phone number is required." });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid 11-digit Nigerian mobile number.",
    });
  }

  /* ── Suspension check (pre-transaction, cheap read) ── */
  if (await isSuspended(userId)) {
    return res.status(403).json({
      success: false, code: "GIVEAWAYS_SUSPENDED",
      message: "Your giveaway access has been suspended. Contact support.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── Step 1: Fetch user + verify eligibility ── */
    const { rows: userRows } = await client.query(
      `SELECT id, email, name, email_verified,
              airtime_phone, airtime_phone_updated_at,
              giveaways_suspended, deleted_at
       FROM   public.users
       WHERE  id = $1
       LIMIT  1
       FOR UPDATE`,
      [userId]
    );

    if (!userRows.length || userRows[0].deleted_at) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const user = userRows[0];

    if (user.giveaways_suspended) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false, code: "GIVEAWAYS_SUSPENDED",
        message: "Your giveaway access has been suspended. Contact support.",
      });
    }

    if (!user.email_verified) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false, code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email address before redeeming.",
        email  : user.email,
      });
    }

    /* ── Step 2: Check per-user claim limits ── */
    const limits = await checkClaimLimits(client, userId, settings);
    if (!limits.can_claim) {
      await client.query("ROLLBACK");
      return res.status(429).json({
        success: false, code: "CLAIM_LIMIT_REACHED",
        message: "You have reached your claim limit. Try again later.",
        limits,
      });
    }

    /* ── Step 3: Cooldown check (only if changing phone AND saving) ── */
    const phoneIsChanging = user.airtime_phone && user.airtime_phone !== phone;
    const phoneIsNew      = !user.airtime_phone;

    if (phoneIsChanging && saveAsDefault) {
      const cooldown = await getCooldownStatus(client, userId, settings.phone_change_cooldown_days);
      if (cooldown.in_cooldown) {
        await client.query("ROLLBACK");

        await logFraud(client, {
          userId, phone, event: "cooldown_bypass_attempt",
          metadata: {
            current   : user.airtime_phone,
            attempted : phone,
            days_left : cooldown.days_left,
          },
          ipAddress: ip, userAgent,
        });

        /* Add fraud points (fire-and-forget) */
        addFraudPoints(userId, "cooldown_bypass_attempt", {
          current: user.airtime_phone, attempted: phone,
        }).catch(() => {});

        return res.status(400).json({
          success: false, code: "PHONE_COOLDOWN_ACTIVE",
          message: `You can change your default airtime number in ${cooldown.days_left} day${cooldown.days_left !== 1 ? "s" : ""}.`,
          cooldown,
        });
      }
    }

    /* ── Step 4: Anti-fraud phone limit ── */
    if (user.airtime_phone !== phone) {
      const usedByOthers = await countAccountsUsingPhone(client, phone, userId);
      if (usedByOthers >= settings.max_accounts_per_phone) {
        await client.query("ROLLBACK");

        await logFraud(client, {
          userId, phone, event: "phone_limit_reached",
          metadata: { max: settings.max_accounts_per_phone, count: usedByOthers },
          ipAddress: ip, userAgent,
        });

        addFraudPoints(userId, "phone_limit_reached", {
          phone: maskPhone(phone), count: usedByOthers,
        }).catch(() => {});

        return res.status(400).json({
          success: false, code: "PHONE_LIMIT_REACHED",
          message: "This phone number has reached the maximum number of allowed accounts.",
        });
      }
    }

    /* ── Step 5: Lock and validate coupon ── */
    const { rows: couponRows } = await client.query(
      `SELECT id, user_id, status, amount
       FROM   public.airtime_coupons
       WHERE  UPPER(code) = UPPER($1)
       LIMIT  1
       FOR UPDATE`,
      [code]
    );
    if (!couponRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }
    const coupon = couponRows[0];
    if (coupon.user_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false, message: "This coupon does not belong to your account.",
      });
    }
    if (coupon.status !== "available") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false, message: `This coupon has already been ${coupon.status}.`,
      });
    }

    const network     = detectNetwork(phone);
    const finalStatus = settings.auto_approve ? "approved" : "pending";

    /* ── Step 6: Mark coupon redeemed ── */
    const { rows: updated } = await client.query(
      `UPDATE public.airtime_coupons
       SET    status      = 'redeemed',
              redeemed_by = $1, redeemed_at = NOW(),
              phone       = $2, network     = $3
       WHERE  id = $4 AND status = 'available'
       RETURNING id`,
      [userId, phone, network, coupon.id]
    );

    if (!updated.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false, message: "Coupon was just redeemed. Please refresh.",
      });
    }

    /* ── Step 7: Create claim record ── */
    const { rows: claimRows } = await client.query(
      `INSERT INTO public.airtime_claims
         (user_id, coupon_id, phone, network, amount, status,
          ip_address, user_agent, device_hash, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, status, submitted_at`,
      [
        userId, coupon.id, phone, network, coupon.amount, finalStatus,
        ip, userAgent, deviceHash,
        finalStatus === "approved" ? new Date() : null,
      ]
    );
    const claim = claimRows[0];

    /* ── Step 8: Save airtime_phone + update registry ── */
    let phoneSaved = false;
    const oldPhone = user.airtime_phone;

    if (phoneIsNew || (phoneIsChanging && saveAsDefault)) {
      /* Update user's default */
      await client.query(
        `UPDATE public.users
         SET    airtime_phone            = $1,
                airtime_network          = $2,
                airtime_phone_updated_at = NOW(),
                updated_at               = NOW()
         WHERE  id = $3`,
        [phone, network, userId]
      );

      /* Mark old phone as released in registry */
      if (oldPhone) {
        await client.query(
          `UPDATE public.airtime_phone_registry
           SET    is_active   = false,
                  released_at = NOW()
           WHERE  phone = $1 AND user_id = $2`,
          [oldPhone, userId]
        );
      }

      /* Upsert new phone registry entry */
      await client.query(
        `INSERT INTO public.airtime_phone_registry
           (phone, user_id, first_used_at, last_used_at, claim_count, is_active)
         VALUES ($1, $2, NOW(), NOW(), 1, true)
         ON CONFLICT (phone, user_id) DO UPDATE
           SET last_used_at = NOW(),
               claim_count  = airtime_phone_registry.claim_count + 1,
               is_active    = true,
               released_at  = NULL`,
        [phone, userId]
      );

      /* History row with full audit info */
      await client.query(
        `INSERT INTO public.airtime_phone_history
           (user_id, old_phone, new_phone, old_network, new_network,
            ip_address, old_ip, user_agent, device_hash, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9)`,
        [
          userId, oldPhone, phone, null, network,
          ip, userAgent, deviceHash,
          phoneIsNew ? "first_claim" : "user_update",
        ]
      );
      phoneSaved = true;
    } else {
      /* Just bump last_used_at + claim_count */
      await client.query(
        `INSERT INTO public.airtime_phone_registry
           (phone, user_id, first_used_at, last_used_at, claim_count, is_active)
         VALUES ($1, $2, NOW(), NOW(), 1, true)
         ON CONFLICT (phone, user_id) DO UPDATE
           SET last_used_at = NOW(),
               claim_count  = airtime_phone_registry.claim_count + 1,
               is_active    = true`,
        [phone, userId]
      );
    }

    await client.query("COMMIT");

    console.log(
      `[airtime] ✓ redeemed | claim=${claim.id} | status=${claim.status} | ` +
      `₦${coupon.amount} | phone=${maskPhone(phone)}`
    );

    /* ── Post-commit async tasks ── */

    /* Suspicious pattern check (non-blocking) */
    checkSuspiciousActivity({ userId, phone, ip, deviceHash })
      .catch((e) => console.warn("[suspicious-check]:", e.message));

    /* Notify user of claim submission */
    notify({
      userId, template: "claim_submitted",
      payload: {
        name         : user.name,
        amount       : Number(coupon.amount),
        masked_phone : maskPhone(phone),
      },
    }).catch(() => {});

    /* Notify user if their default phone changed */
    if (phoneIsChanging && phoneSaved) {
      notify({
        userId, template: "phone_changed",
        payload: {
          name         : user.name,
          masked_phone : maskPhone(phone),
          old_masked   : maskPhone(oldPhone),
          ip,
        },
      }).catch(() => {});
    }

    return res.json({
      success            : true,
      message            : settings.auto_approve
        ? `₦${coupon.amount} airtime claim approved — processing now.`
        : `₦${coupon.amount} airtime claim submitted! We'll process it within ${settings.processing_sla_hours} hours.`,
      airtime_phone_saved: phoneSaved,
      claim: {
        id           : claim.id,
        status       : claim.status,
        amount       : Number(coupon.amount),
        phone        : maskPhone(phone),
        network,
        submitted_at : claim.submitted_at,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("╔═══ [airtime] REDEEM ERROR ═══");
    console.error("║ message :", err.message);
    console.error("║ code    :", err.code);
    console.error("║ detail  :", err.detail);
    console.error("║ column  :", err.column);
    console.error("╚═══════════════════════════════");

    let userMsg = "Redemption failed. Please try again.";
    if (err.code === "23514") userMsg = "Invalid coupon state. Contact support.";
    if (err.code === "42703") userMsg = "Database column missing. Contact support.";

    return res.status(500).json({
      success: false,
      message: userMsg,
      ...(IS_PROD ? {} : { debug: { error: err.message, code: err.code } }),
    });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/airtime-coupons/airtime-phone
   Update default airtime phone (respects cooldown + limit)
═══════════════════════════════════════════════════════════════ */
router.patch("/airtime-phone", authenticate, phoneUpdateLimit, async (req, res) => {
  const userId    = req.user.id;
  const phone     = normalizePhone(req.body?.phone);
  const ip        = getIp(req);
  const userAgent = req.headers["user-agent"];
  const deviceHash = getDeviceHash(req);
  const settings  = await getSettings();

  if (!phone || !isValidPhone(phone)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid 11-digit Nigerian mobile number.",
    });
  }

  if (await isSuspended(userId)) {
    return res.status(403).json({
      success: false, code: "GIVEAWAYS_SUSPENDED",
      message: "Your giveaway access has been suspended.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: userRows } = await client.query(
      `SELECT airtime_phone, airtime_phone_updated_at, name, deleted_at
       FROM   public.users WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [userId]
    );
    if (!userRows.length || userRows[0].deleted_at) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "User not found." });
    }
    const user = userRows[0];

    /* Same number — no-op */
    if (user.airtime_phone === phone) {
      await client.query("ROLLBACK");
      return res.json({
        success: true,
        message: "This is already your saved airtime number.",
        airtime: { phone, masked: maskPhone(phone), network: detectNetwork(phone) },
      });
    }

    /* Cooldown */
    if (user.airtime_phone) {
      const cooldown = await getCooldownStatus(client, userId, settings.phone_change_cooldown_days);
      if (cooldown.in_cooldown) {
        await client.query("ROLLBACK");
        await logFraud(client, {
          userId, phone, event: "cooldown_bypass_attempt",
          metadata: { current: user.airtime_phone, attempted: phone, days_left: cooldown.days_left },
          ipAddress: ip, userAgent,
        });
        addFraudPoints(userId, "cooldown_bypass_attempt", {
          current: user.airtime_phone, attempted: phone,
        }).catch(() => {});
        return res.status(400).json({
          success: false, code: "PHONE_COOLDOWN_ACTIVE",
          message: `You can change your default airtime number in ${cooldown.days_left} day${cooldown.days_left !== 1 ? "s" : ""}.`,
          cooldown,
        });
      }
    }

    /* Phone limit */
    const usedByOthers = await countAccountsUsingPhone(client, phone, userId);
    if (usedByOthers >= settings.max_accounts_per_phone) {
      await client.query("ROLLBACK");
      await logFraud(client, {
        userId, phone, event: "phone_limit_reached",
        metadata: { max: settings.max_accounts_per_phone, count: usedByOthers },
        ipAddress: ip, userAgent,
      });
      addFraudPoints(userId, "phone_limit_reached", {
        phone: maskPhone(phone), count: usedByOthers,
      }).catch(() => {});
      return res.status(400).json({
        success: false, code: "PHONE_LIMIT_REACHED",
        message: "This phone number has reached the maximum number of allowed accounts.",
      });
    }

    const network  = detectNetwork(phone);
    const oldPhone = user.airtime_phone;

    /* Update user */
    await client.query(
      `UPDATE public.users
       SET    airtime_phone            = $1,
              airtime_network          = $2,
              airtime_phone_updated_at = NOW(),
              updated_at               = NOW()
       WHERE  id = $3`,
      [phone, network, userId]
    );

    /* Release old phone from registry */
    if (oldPhone) {
      await client.query(
        `UPDATE public.airtime_phone_registry
         SET    is_active = false, released_at = NOW()
         WHERE  phone = $1 AND user_id = $2`,
        [oldPhone, userId]
      );
    }

    /* Register new phone */
    await client.query(
      `INSERT INTO public.airtime_phone_registry
         (phone, user_id, first_used_at, last_used_at, claim_count, is_active)
       VALUES ($1, $2, NOW(), NOW(), 0, true)
       ON CONFLICT (phone, user_id) DO UPDATE
         SET is_active = true, released_at = NULL, last_used_at = NOW()`,
      [phone, userId]
    );

    /* History */
    await client.query(
      `INSERT INTO public.airtime_phone_history
         (user_id, old_phone, new_phone, new_network,
          ip_address, old_ip, user_agent, device_hash, reason)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, 'user_update')`,
      [userId, oldPhone, phone, network, ip, userAgent, deviceHash]
    );

    await client.query("COMMIT");

    /* Notify user (async) */
    notify({
      userId, template: "phone_changed",
      payload: {
        name         : user.name,
        masked_phone : maskPhone(phone),
        old_masked   : maskPhone(oldPhone),
        ip,
      },
    }).catch(() => {});

    return res.json({
      success: true,
      message: "Airtime number updated successfully.",
      airtime: { phone, masked: maskPhone(phone), network },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[airtime] phone update:", err.message);
    return res.status(500).json({ success: false, message: "Could not update airtime number." });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/airtime-coupons/claims
   User's own claim history
═══════════════════════════════════════════════════════════════ */
router.get("/claims", authenticate, async (req, res) => {
  const userId = req.user.id;
  const limit  = Math.min(50, parseInt(req.query.limit ?? "20", 10));
  const page   = Math.max(1,  parseInt(req.query.page  ?? "1",  10));
  const offset = (page - 1) * limit;

  try {
    const [{ rows }, { rows: cnt }] = await Promise.all([
      pool.query(
        `SELECT ac.id, ac.phone, ac.network, ac.amount, ac.status,
                ac.submitted_at, ac.approved_at, ac.processed_at, ac.remarks,
                c.code AS coupon_code
         FROM   public.airtime_claims ac
         JOIN   public.airtime_coupons c ON c.id = ac.coupon_id
         WHERE  ac.user_id = $1
         ORDER  BY ac.submitted_at DESC
         LIMIT  $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::INT AS total FROM public.airtime_claims WHERE user_id = $1`,
        [userId]
      ),
    ]);

    return res.json({
      success: true,
      page,
      limit,
      total  : cnt[0]?.total ?? 0,
      claims : rows.map((c) => ({
        id           : c.id,
        coupon_code  : c.coupon_code,
        amount       : Number(c.amount),
        phone        : maskPhone(c.phone),
        network      : c.network,
        status       : c.status,
        submitted_at : c.submitted_at,
        approved_at  : c.approved_at,
        processed_at : c.processed_at,
        remarks      : c.remarks,
      })),
    });
  } catch (err) {
    console.error("[airtime] claims:", err.message);
    return res.status(500).json({ success: false, message: "Could not fetch claims." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/airtime-coupons/status/:id
═══════════════════════════════════════════════════════════════ */
router.get("/status/:id", authenticate, async (req, res) => {
  const userId   = req.user.id;
  const couponId = req.params.id;

  try {
    const { rows } = await pool.query(
      `SELECT id, code, amount, status, redeemed_at, phone, network
       FROM   public.airtime_coupons
       WHERE  id = $1 AND user_id = $2
       LIMIT  1`,
      [couponId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }

    const c = rows[0];
    return res.json({
      success: true,
      coupon : {
        id         : c.id,
        code       : c.code,
        amount     : Number(c.amount),
        status     : c.status,
        redeemed_at: c.redeemed_at,
        phone      : maskPhone(c.phone),
        network    : c.network,
      },
    });
  } catch (err) {
    console.error("[airtime] status:", err.message);
    return res.status(500).json({ success: false, message: "Could not fetch coupon status." });
  }
});

/* ════════════════════════════════════════════════════════════════
   ═══════════════════════════════════════════════════════════════
                            ADMIN ROUTES
   ═══════════════════════════════════════════════════════════════
════════════════════════════════════════════════════════════════ */

const requireAdmin = (req, res, next) => {
  const isAdmin = req.user?.role === "admin" || req.user?.is_admin === true;
  if (!isAdmin) return res.status(403).json({ success: false, message: "Admin access required." });
  next();
};

/* ═══════════════════════════════════════════════════════════════
   GET /admin/dashboard — Overall stats
═══════════════════════════════════════════════════════════════ */
router.get("/admin/dashboard", authenticate, requireAdmin, async (_req, res) => {
  try {
    const [claims, phones, fraud] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')                                AS pending,
          COUNT(*) FILTER (WHERE status = 'approved')                               AS approved,
          COUNT(*) FILTER (WHERE status = 'sent')                                   AS sent,
          COUNT(*) FILTER (WHERE status = 'completed')                              AS completed,
          COUNT(*) FILTER (WHERE status = 'rejected')                               AS rejected,
          COUNT(*) FILTER (WHERE status = 'failed')                                 AS failed,
          COUNT(*)                                                                  AS total,
          COALESCE(SUM(amount) FILTER (WHERE status IN ('completed','sent')), 0)    AS total_paid,
          COALESCE(SUM(amount) FILTER (WHERE status = 'pending'),             0)    AS pending_amount
        FROM public.airtime_claims
      `),
      pool.query(`
        SELECT phone, COUNT(DISTINCT user_id)::INT AS user_count
        FROM   public.airtime_phone_registry
        GROUP  BY phone
        HAVING COUNT(DISTINCT user_id) > 1
        ORDER  BY user_count DESC
        LIMIT  20
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day')   AS today,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS month,
          COUNT(*)                                                        AS total
        FROM public.airtime_fraud_log
      `),
    ]);

    const { rows: flagged } = await pool.query(`
      SELECT id, email, name, fraud_score, fraud_status, giveaways_suspended
      FROM   public.users
      WHERE  fraud_status != 'clean'
      ORDER  BY fraud_score DESC
      LIMIT  10
    `);

    return res.json({
      success: true,
      dashboard: {
        claims          : claims.rows[0],
        top_shared_phones: phones.rows.map((r) => ({
          masked      : maskPhone(r.phone),
          user_count  : r.user_count,
        })),
        fraud           : fraud.rows[0],
        flagged_users   : flagged,
      },
    });
  } catch (err) {
    console.error("[admin/dashboard]:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /admin/claims — Search & filter claims
═══════════════════════════════════════════════════════════════ */
router.get("/admin/claims", authenticate, requireAdmin, async (req, res) => {
  const status = req.query.status || "pending";
  const search = req.query.search?.trim().toLowerCase();
  const limit  = Math.min(100, parseInt(req.query.limit ?? "50", 10));
  const page   = Math.max(1,   parseInt(req.query.page  ?? "1",  10));
  const offset = (page - 1) * limit;

  try {
    let where  = `WHERE ac.status = $1`;
    const args = [status];

    if (search) {
      args.push(`%${search}%`);
      where += ` AND (
        ac.phone ILIKE $${args.length} OR
        LOWER(u.email) LIKE $${args.length} OR
        UPPER(c.code)  LIKE UPPER($${args.length})
      )`;
    }

    const { rows } = await pool.query(
      `SELECT ac.id, ac.user_id, ac.phone, ac.network, ac.amount,
              ac.status, ac.submitted_at, ac.approved_at, ac.processed_at,
              ac.remarks, ac.ip_address,
              c.code AS coupon_code,
              u.email, u.name, u.fraud_score, u.fraud_status
       FROM   public.airtime_claims ac
       JOIN   public.airtime_coupons c ON c.id = ac.coupon_id
       JOIN   public.users u           ON u.id = ac.user_id
       ${where}
       ORDER  BY ac.submitted_at ASC
       LIMIT  ${limit} OFFSET ${offset}`,
      args
    );

    return res.json({ success: true, claims: rows });
  } catch (err) {
    console.error("[admin/claims]:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch claims." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /admin/claims/:id/process — Approve/reject/complete claim
═══════════════════════════════════════════════════════════════ */
router.post("/admin/claims/:id/process", authenticate, requireAdmin, async (req, res) => {
  const adminId  = req.user.id;
  const claimId  = req.params.id;
  const action   = req.body?.action;
  const remarks  = req.body?.remarks || null;

  if (!["approve", "send", "complete", "reject", "fail"].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid action." });
  }

  const statusMap = {
    approve : "approved",
    send    : "sent",
    complete: "completed",
    reject  : "rejected",
    fail    : "failed",
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, status, coupon_id, user_id, amount, phone
       FROM   public.airtime_claims
       WHERE  id = $1
       LIMIT  1
       FOR UPDATE`,
      [claimId]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Claim not found." });
    }

    const claim     = rows[0];
    const newStatus = statusMap[action];

    await client.query(
      `UPDATE public.airtime_claims
       SET    status       = $1,
              processed_at = CASE WHEN $1 IN ('completed','sent','rejected','failed') THEN NOW() ELSE processed_at END,
              approved_at  = CASE WHEN $1 = 'approved' AND approved_at IS NULL THEN NOW() ELSE approved_at END,
              processed_by = $2,
              remarks      = COALESCE($3, remarks)
       WHERE  id = $4`,
      [newStatus, adminId, remarks, claimId]
    );

    /* If rejected, release the coupon so admin can reissue */
    if (newStatus === "rejected") {
      await client.query(
        `UPDATE public.airtime_coupons
         SET    status = 'available', redeemed_at = NULL, phone = NULL, network = NULL
         WHERE  id = $1`,
        [claim.coupon_id]
      );
    }

    await client.query("COMMIT");

    /* ── Post-commit notifications ── */
    const { rows: userRow } = await pool.query(
      `SELECT name FROM public.users WHERE id = $1`,
      [claim.user_id]
    );
    const userName = userRow[0]?.name;

    const templateMap = {
      approved : "claim_approved",
      completed: "claim_completed",
      rejected : "claim_rejected",
    };

    if (templateMap[newStatus]) {
      notify({
        userId  : claim.user_id,
        template: templateMap[newStatus],
        payload : {
          name         : userName,
          amount       : Number(claim.amount),
          masked_phone : maskPhone(claim.phone),
          remarks,
        },
      }).catch(() => {});
    }

    /* Fraud points for rejected claims */
    if (newStatus === "rejected") {
      addFraudPoints(claim.user_id, "claim_rejected_by_admin", {
        claim_id: claimId, remarks,
      }).catch(() => {});
    }

    return res.json({ success: true, message: `Claim ${newStatus}.`, status: newStatus });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin/process]:", err.message);
    return res.status(500).json({ success: false, message: "Failed to process claim." });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET / PATCH /admin/settings
═══════════════════════════════════════════════════════════════ */
router.get("/admin/settings", authenticate, requireAdmin, async (_req, res) => {
  return res.json({ success: true, settings: await getSettings() });
});

router.patch("/admin/settings", authenticate, requireAdmin, async (req, res) => {
  const adminId = req.user.id;
  const updates = req.body?.settings || {};

  const allowedKeys = [
    "max_accounts_per_phone",
    "phone_change_cooldown_days",
    "daily_claim_limit",
    "weekly_claim_limit",
    "monthly_claim_limit",
    "auto_approve",
    "processing_sla_hours",
    "max_accounts_per_ip",
    "max_accounts_per_device",
    "fraud_score_warn",
    "fraud_score_review",
    "fraud_score_suspend",
  ];

  try {
    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys.includes(key)) continue;
      await pool.query(
        `INSERT INTO public.airtime_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key) DO UPDATE
           SET value      = EXCLUDED.value,
               updated_by = EXCLUDED.updated_by,
               updated_at = NOW()`,
        [key, String(value), adminId]
      );
    }
    invalidateSettings();
    return res.json({ success: true, settings: await getSettings() });
  } catch (err) {
    console.error("[admin/settings]:", err.message);
    return res.status(500).json({ success: false, message: "Failed to update settings." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /admin/reset-cooldown/:userId
═══════════════════════════════════════════════════════════════ */
router.post("/admin/reset-cooldown/:userId", authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.users SET airtime_phone_updated_at = NULL WHERE id = $1`,
      [req.params.userId]
    );
    return res.json({ success: true, message: "Cooldown reset." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /admin/free-phone — Free a phone from all users
═══════════════════════════════════════════════════════════════ */
router.post("/admin/free-phone", authenticate, requireAdmin, async (req, res) => {
  const { phone } = req.body;
  const p = normalizePhone(phone);
  if (!p) return res.status(400).json({ success: false, message: "Phone required." });

  try {
    const { rowCount: userCount } = await pool.query(
      `UPDATE public.users
       SET    airtime_phone   = NULL,
              airtime_network = NULL
       WHERE  airtime_phone   = $1`,
      [p]
    );
    await pool.query(
      `UPDATE public.airtime_phone_registry
       SET    is_active = false, released_at = NOW()
       WHERE  phone = $1`,
      [p]
    );
    return res.json({
      success        : true,
      message        : `Phone ${maskPhone(p)} freed from ${userCount} account(s).`,
      accounts_freed : userCount,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /admin/change-user-phone
═══════════════════════════════════════════════════════════════ */
router.post("/admin/change-user-phone", authenticate, requireAdmin, async (req, res) => {
  const adminId    = req.user.id;
  const { userId, phone, reason } = req.body;
  const p          = normalizePhone(phone);
  const ip         = getIp(req);
  const userAgent  = req.headers["user-agent"];

  if (!userId || !p || !isValidPhone(p)) {
    return res.status(400).json({ success: false, message: "Invalid inputs." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [old] } = await client.query(
      `SELECT airtime_phone, name FROM public.users WHERE id = $1`,
      [userId]
    );

    const network = detectNetwork(p);

    await client.query(
      `UPDATE public.users
       SET    airtime_phone            = $1,
              airtime_network          = $2,
              airtime_phone_updated_at = NOW()
       WHERE  id = $3`,
      [p, network, userId]
    );

    /* Update registries */
    if (old?.airtime_phone) {
      await client.query(
        `UPDATE public.airtime_phone_registry
         SET    is_active = false, released_at = NOW()
         WHERE  phone = $1 AND user_id = $2`,
        [old.airtime_phone, userId]
      );
    }

    await client.query(
      `INSERT INTO public.airtime_phone_registry
         (phone, user_id, first_used_at, last_used_at, claim_count, is_active)
       VALUES ($1, $2, NOW(), NOW(), 0, true)
       ON CONFLICT (phone, user_id) DO UPDATE
         SET is_active = true, released_at = NULL`,
      [p, userId]
    );

    await client.query(
      `INSERT INTO public.airtime_phone_history
         (user_id, old_phone, new_phone, new_network,
          ip_address, user_agent, admin_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, old?.airtime_phone, p, network, ip, userAgent, adminId,
       `admin_override: ${reason || "N/A"}`]
    );

    await client.query("COMMIT");

    /* Notify user */
    notify({
      userId, template: "phone_changed",
      payload: {
        name         : old?.name,
        masked_phone : maskPhone(p),
        old_masked   : maskPhone(old?.airtime_phone),
      },
    }).catch(() => {});

    return res.json({ success: true, message: "Phone changed by admin." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /admin/clear-fraud-score/:userId
═══════════════════════════════════════════════════════════════ */
router.post("/admin/clear-fraud-score/:userId", authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.users
       SET    fraud_score          = 0,
              fraud_status         = 'clean',
              fraud_status_reason  = NULL,
              giveaways_suspended  = false,
              updated_at           = NOW()
       WHERE  id = $1`,
      [req.params.userId]
    );
    return res.json({ success: true, message: "Fraud score cleared." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /admin/suspend/:userId — Manual suspension
═══════════════════════════════════════════════════════════════ */
router.post("/admin/suspend/:userId", authenticate, requireAdmin, async (req, res) => {
  const { reason } = req.body;
  try {
    await pool.query(
      `UPDATE public.users
       SET    giveaways_suspended = true,
              fraud_status        = 'suspended',
              fraud_status_reason = $1,
              fraud_status_at     = NOW()
       WHERE  id = $2`,
      [reason || "Manual admin suspension", req.params.userId]
    );

    notify({
      userId: req.params.userId,
      template: "giveaways_suspended",
      payload: { reason: reason || "Policy violation" },
    }).catch(() => {});

    return res.json({ success: true, message: "User suspended from giveaways." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /admin/phone-history/:userId
═══════════════════════════════════════════════════════════════ */
router.get("/admin/phone-history/:userId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, old_phone, new_phone, old_network, new_network,
              reason, ip_address, old_ip, device_hash,
              admin_id, user_agent, created_at
       FROM   public.airtime_phone_history
       WHERE  user_id = $1
       ORDER  BY created_at DESC`,
      [req.params.userId]
    );
    return res.json({
      success: true,
      history: rows.map((r) => ({
        ...r,
        old_phone: maskPhone(r.old_phone),
        new_phone: maskPhone(r.new_phone),
      })),
    });
  } catch (err) {
    console.error("[admin/history]:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch history." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /admin/phone-registry/:phone — Lifetime users of a phone
═══════════════════════════════════════════════════════════════ */
router.get("/admin/phone-registry/:phone", authenticate, requireAdmin, async (req, res) => {
  const p = normalizePhone(req.params.phone);
  if (!p) return res.status(400).json({ success: false, message: "Invalid phone." });

  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.user_id, r.first_used_at, r.last_used_at,
              r.claim_count, r.is_active, r.released_at,
              u.email, u.name, u.fraud_score, u.fraud_status
       FROM   public.airtime_phone_registry r
       LEFT   JOIN public.users u ON u.id = r.user_id
       WHERE  r.phone = $1
       ORDER  BY r.first_used_at DESC`,
      [p]
    );

    return res.json({
      success       : true,
      phone         : maskPhone(p),
      total_users   : rows.length,
      active_users  : rows.filter((r) => r.is_active).length,
      registry      : rows,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /admin/fraud-log
═══════════════════════════════════════════════════════════════ */
router.get("/admin/fraud-log", authenticate, requireAdmin, async (req, res) => {
  const limit  = Math.min(200, parseInt(req.query.limit ?? "50", 10));
  const event  = req.query.event;

  try {
    const args = [limit];
    let where  = "";
    if (event) {
      args.push(event);
      where = `WHERE event = $${args.length}`;
    }

    const { rows } = await pool.query(
      `SELECT id, user_id, phone, event, metadata,
              ip_address, user_agent, created_at
       FROM   public.airtime_fraud_log
       ${where}
       ORDER  BY created_at DESC
       LIMIT  $1`,
      args
    );
    return res.json({
      success: true,
      events : rows.map((r) => ({ ...r, phone: maskPhone(r.phone) })),
    });
  } catch (err) {
    console.error("[admin/fraud-log]:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch fraud log." });
  }
});

export default router;