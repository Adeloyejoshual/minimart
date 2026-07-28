// routes/airtimeCoupons.js
// ═══════════════════════════════════════════════════════════════
// AIRTIME COUPONS — Simplified production-ready implementation
// ═══════════════════════════════════════════════════════════════
import express      from "express";
import crypto       from "crypto";
import rateLimit    from "express-rate-limit";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";

import {
  sendAirtimeClaimSubmittedEmail,
  sendAirtimeClaimApprovedEmail,
  sendAirtimeClaimCompletedEmail,
  sendAirtimeClaimRejectedEmail,
  sendAirtimePhoneChangedEmail,
  sendAirtimeCooldownReminderEmail,
} from "../services/airtimenotifications.js";

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
   SAFE EMAIL (fire and forget)
═══════════════════════════════════════════════════════════════ */
const safeEmail = (fn, args) => {
  try {
    fn(args).catch((e) => console.warn(`[airtime] email failed:`, e.message));
  } catch (e) {
    console.warn(`[airtime] email threw:`, e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   CONFIG DEFAULTS (from env or hardcoded)
   No DB dependency — always available
═══════════════════════════════════════════════════════════════ */
const CONFIG = {
  max_accounts_per_phone     : parseInt(process.env.MAX_ACCOUNTS_PER_PHONE     ?? "2",  10),
  phone_change_cooldown_days : parseInt(process.env.PHONE_COOLDOWN_DAYS        ?? "30", 10),
  daily_claim_limit          : parseInt(process.env.DAILY_CLAIM_LIMIT          ?? "3",  10),
  weekly_claim_limit         : parseInt(process.env.WEEKLY_CLAIM_LIMIT         ?? "10", 10),
  monthly_claim_limit        : parseInt(process.env.MONTHLY_CLAIM_LIMIT        ?? "30", 10),
  auto_approve               : process.env.AIRTIME_AUTO_APPROVE === "true",
  processing_sla_hours       : parseInt(process.env.PROCESSING_SLA_HOURS       ?? "24", 10),
};

console.log("[airtime] config:", CONFIG);

/* ═══════════════════════════════════════════════════════════════
   ANTI-FRAUD CHECKS
═══════════════════════════════════════════════════════════════ */
async function countAccountsUsingPhone(phone, excludeUserId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::INT AS cnt
     FROM   public.users
     WHERE  airtime_phone = $1
       AND  id           != $2`,
    [phone, excludeUserId]
  );
  return rows[0]?.cnt ?? 0;
}

async function getCooldownStatus(userId, cooldownDays) {
  const { rows } = await pool.query(
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

async function checkClaimLimits(userId) {
  const { rows } = await pool.query(
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
    daily_left   : Math.max(0, CONFIG.daily_claim_limit   - Number(r.daily)),
    weekly_left  : Math.max(0, CONFIG.weekly_claim_limit  - Number(r.weekly)),
    monthly_left : Math.max(0, CONFIG.monthly_claim_limit - Number(r.monthly)),
    can_claim    :
      Number(r.daily)   < CONFIG.daily_claim_limit &&
      Number(r.weekly)  < CONFIG.weekly_claim_limit &&
      Number(r.monthly) < CONFIG.monthly_claim_limit,
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

const checkPhoneLimit  = makeLimit({ windowMs: 60_000, max: 30, msg: "Too many checks. Slow down." });
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
              airtime_phone_updated_at = NULL
       WHERE  id = $1`,
      [userId]
    );
    console.log(`[airtime] ✓ released phones for user=${userId}`);
  } catch (err) {
    console.error("[releaseUserPhones]:", err.message);
  }
}

/* ════════════════════════════════════════════════════════════════
   ═══════════════════════════════════════════════════════════════
                            USER ROUTES
   ═══════════════════════════════════════════════════════════════
════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   GET /api/airtime-coupons/health — public, no auth, no DB
═══════════════════════════════════════════════════════════════ */
router.get("/health", (_req, res) => {
  return res.json({
    success   : true,
    service   : "airtime-coupons",
    time      : new Date().toISOString(),
    config    : CONFIG,
    node_env  : process.env.NODE_ENV || "unknown",
    uptime_s  : Math.round(process.uptime()),
  });
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/airtime-coupons/health/db — with auth check
═══════════════════════════════════════════════════════════════ */
router.get("/health/db", async (_req, res) => {
  try {
    const start = Date.now();
    const { rows } = await pool.query("SELECT NOW() AS now");
    const latency = Date.now() - start;
    return res.json({
      success   : true,
      db        : "connected",
      db_time   : rows[0].now,
      latency_ms: latency,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      db     : "error",
      error  : err.message,
    });
  }
});

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
═══════════════════════════════════════════════════════════════ */
router.get("/airtime-phone", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT airtime_phone, airtime_network, airtime_phone_updated_at
       FROM   public.users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const u        = rows[0];
    const cooldown = await getCooldownStatus(userId, CONFIG.phone_change_cooldown_days);

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
        cooldown_days   : CONFIG.phone_change_cooldown_days,
      },
    });
  } catch (err) {
    console.error("[airtime] airtime-phone:", err.message);
    return res.status(500).json({ success: false, message: "Could not fetch airtime phone." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/airtime-coupons/check-phone/:phone
   Simple, fast — uses pool.query directly (no client checkout)
═══════════════════════════════════════════════════════════════ */
router.get("/check-phone/:phone", authenticate, checkPhoneLimit, async (req, res) => {
  const userId = req.user.id;
  const phone  = normalizePhone(req.params.phone);

  console.log(`[check-phone] user=${userId} phone=${maskPhone(phone)}`);

  if (!phone || !isValidPhone(phone)) {
    return res.status(400).json({
      success  : false,
      available: false,
      message  : "Invalid phone number format.",
    });
  }

  try {
    const count     = await countAccountsUsingPhone(phone, userId);
    const available = count < CONFIG.max_accounts_per_phone;

    console.log(`[check-phone] ✓ count=${count} available=${available}`);

    return res.json({
      success  : true,
      available,
      message  : available
        ? "Number can be used."
        : "This phone number has reached the maximum number of allowed accounts.",
    });
  } catch (err) {
    console.error("[check-phone] error:", err.message);
    /* Fail open — don't block the user */
    return res.json({
      success  : true,
      available: true,
      message  : "",
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/airtime-coupons/redeem
═══════════════════════════════════════════════════════════════ */
router.post("/redeem", authenticate, redeemLimit, async (req, res) => {
  const userId        = req.user.id;
  const code          = String(req.body?.code || "").trim();
  const phone         = normalizePhone(req.body?.phone);
  const saveAsDefault = req.body?.save_as_default !== false;
  const ip            = getIp(req);
  const userAgent     = req.headers["user-agent"];
  const deviceHash    = getDeviceHash(req);

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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── Step 1: Fetch user + verify eligibility ── */
    const { rows: userRows } = await client.query(
      `SELECT id, email, name, email_verified,
              airtime_phone, airtime_phone_updated_at
       FROM   public.users
       WHERE  id = $1
       LIMIT  1
       FOR UPDATE`,
      [userId]
    );

    if (!userRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const user = userRows[0];

    if (!user.email_verified) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false, code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email address before redeeming.",
        email  : user.email,
      });
    }

    /* ── Step 2: Check per-user claim limits ── */
    const limits = await checkClaimLimits(userId);
    if (!limits.can_claim) {
      await client.query("ROLLBACK");
      return res.status(429).json({
        success: false, code: "CLAIM_LIMIT_REACHED",
        message: "You have reached your claim limit. Try again later.",
        limits,
      });
    }

    /* ── Step 3: Cooldown check (only when changing + saving) ── */
    const phoneIsChanging = user.airtime_phone && user.airtime_phone !== phone;
    const phoneIsNew      = !user.airtime_phone;

    if (phoneIsChanging && saveAsDefault) {
      const cooldown = await getCooldownStatus(userId, CONFIG.phone_change_cooldown_days);
      if (cooldown.in_cooldown) {
        await client.query("ROLLBACK");

        safeEmail(sendAirtimeCooldownReminderEmail, {
          to             : user.email,
          name           : user.name,
          currentMasked  : maskPhone(user.airtime_phone),
          nextChangeAt   : cooldown.next_change_at,
          daysLeft       : cooldown.days_left,
        });

        return res.status(400).json({
          success: false, code: "PHONE_COOLDOWN_ACTIVE",
          message: `You can change your default airtime number in ${cooldown.days_left} day${cooldown.days_left !== 1 ? "s" : ""}.`,
          cooldown,
        });
      }
    }

    /* ── Step 4: Anti-fraud phone limit ── */
    if (user.airtime_phone !== phone) {
      const usedByOthers = await countAccountsUsingPhone(phone, userId);
      if (usedByOthers >= CONFIG.max_accounts_per_phone) {
        await client.query("ROLLBACK");
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
    const finalStatus = CONFIG.auto_approve ? "approved" : "pending";

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

    /* ── Step 8: Save airtime_phone (separate from account phone) ── */
    let phoneSaved = false;
    const oldPhone = user.airtime_phone;

    if (phoneIsNew || (phoneIsChanging && saveAsDefault)) {
      await client.query(
        `UPDATE public.users
         SET    airtime_phone            = $1,
                airtime_network          = $2,
                airtime_phone_updated_at = NOW(),
                updated_at               = NOW()
         WHERE  id = $3`,
        [phone, network, userId]
      );

      /* Best-effort history record (silent fail) */
      await client.query(
        `INSERT INTO public.airtime_phone_history
           (user_id, old_phone, new_phone, old_network, new_network,
            ip_address, user_agent, device_hash, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId, oldPhone, phone, null, network,
          ip, userAgent, deviceHash,
          phoneIsNew ? "first_claim" : "user_update",
        ]
      ).catch((e) => console.warn("[history] insert failed:", e.message));

      phoneSaved = true;
    }

    await client.query("COMMIT");

    console.log(
      `[airtime] ✓ redeemed | claim=${claim.id} | status=${claim.status} | ` +
      `₦${coupon.amount} | phone=${maskPhone(phone)}`
    );

    /* ═══════════════════════════════════════════════════════
       POST-COMMIT ASYNC TASKS
    ═══════════════════════════════════════════════════════ */

    /* Notify user */
    if (finalStatus === "approved") {
      safeEmail(sendAirtimeClaimApprovedEmail, {
        to      : user.email,
        name    : user.name,
        amount  : Number(coupon.amount),
        phone   : maskPhone(phone),
        network,
      });
    } else {
      safeEmail(sendAirtimeClaimSubmittedEmail, {
        to      : user.email,
        name    : user.name,
        amount  : Number(coupon.amount),
        phone   : maskPhone(phone),
        network,
        slaHours: CONFIG.processing_sla_hours,
      });
    }

    /* Notify if phone changed */
    if (phoneIsChanging && phoneSaved) {
      safeEmail(sendAirtimePhoneChangedEmail, {
        to        : user.email,
        name      : user.name,
        newMasked : maskPhone(phone),
        oldMasked : maskPhone(oldPhone),
        ip,
        changedAt : new Date(),
      });
    }

    return res.json({
      success            : true,
      message            : CONFIG.auto_approve
        ? `₦${coupon.amount} airtime claim approved — processing now.`
        : `₦${coupon.amount} airtime claim submitted! We'll process it within ${CONFIG.processing_sla_hours} hours.`,
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
    if (err.code === "42P01") userMsg = "Database table missing. Contact support.";

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
═══════════════════════════════════════════════════════════════ */
router.patch("/airtime-phone", authenticate, phoneUpdateLimit, async (req, res) => {
  const userId     = req.user.id;
  const phone      = normalizePhone(req.body?.phone);
  const ip         = getIp(req);
  const userAgent  = req.headers["user-agent"];
  const deviceHash = getDeviceHash(req);

  if (!phone || !isValidPhone(phone)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid 11-digit Nigerian mobile number.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: userRows } = await client.query(
      `SELECT airtime_phone, airtime_phone_updated_at, name, email
       FROM   public.users WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [userId]
    );
    if (!userRows.length) {
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
      const cooldown = await getCooldownStatus(userId, CONFIG.phone_change_cooldown_days);
      if (cooldown.in_cooldown) {
        await client.query("ROLLBACK");

        safeEmail(sendAirtimeCooldownReminderEmail, {
          to             : user.email,
          name           : user.name,
          currentMasked  : maskPhone(user.airtime_phone),
          nextChangeAt   : cooldown.next_change_at,
          daysLeft       : cooldown.days_left,
        });

        return res.status(400).json({
          success: false, code: "PHONE_COOLDOWN_ACTIVE",
          message: `You can change your default airtime number in ${cooldown.days_left} day${cooldown.days_left !== 1 ? "s" : ""}.`,
          cooldown,
        });
      }
    }

    /* Phone limit */
    const usedByOthers = await countAccountsUsingPhone(phone, userId);
    if (usedByOthers >= CONFIG.max_accounts_per_phone) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false, code: "PHONE_LIMIT_REACHED",
        message: "This phone number has reached the maximum number of allowed accounts.",
      });
    }

    const network  = detectNetwork(phone);
    const oldPhone = user.airtime_phone;

    await client.query(
      `UPDATE public.users
       SET    airtime_phone            = $1,
              airtime_network          = $2,
              airtime_phone_updated_at = NOW(),
              updated_at               = NOW()
       WHERE  id = $3`,
      [phone, network, userId]
    );

    /* History (best effort) */
    await client.query(
      `INSERT INTO public.airtime_phone_history
         (user_id, old_phone, new_phone, new_network,
          ip_address, user_agent, device_hash, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'user_update')`,
      [userId, oldPhone, phone, network, ip, userAgent, deviceHash]
    ).catch((e) => console.warn("[history] insert failed:", e.message));

    await client.query("COMMIT");

    safeEmail(sendAirtimePhoneChangedEmail, {
      to        : user.email,
      name      : user.name,
      newMasked : maskPhone(phone),
      oldMasked : maskPhone(oldPhone),
      ip,
      changedAt : new Date(),
    });

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
   GET /api/airtime-coupons/claims — user's claim history
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
   GET /admin/dashboard
═══════════════════════════════════════════════════════════════ */
router.get("/admin/dashboard", authenticate, requireAdmin, async (_req, res) => {
  try {
    const [claims, phones] = await Promise.all([
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
        SELECT airtime_phone, COUNT(*)::INT AS user_count
        FROM   public.users
        WHERE  airtime_phone IS NOT NULL
        GROUP  BY airtime_phone
        HAVING COUNT(*) > 1
        ORDER  BY user_count DESC
        LIMIT  20
      `),
    ]);

    return res.json({
      success: true,
      dashboard: {
        claims           : claims.rows[0],
        top_shared_phones: phones.rows.map((r) => ({
          masked      : maskPhone(r.airtime_phone),
          user_count  : r.user_count,
        })),
      },
    });
  } catch (err) {
    console.error("[admin/dashboard]:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /admin/claims
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
              u.email, u.name
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
   POST /admin/claims/:id/process
═══════════════════════════════════════════════════════════════ */
router.post("/admin/claims/:id/process", authenticate, requireAdmin, async (req, res) => {
  const adminId = req.user.id;
  const claimId = req.params.id;
  const action  = req.body?.action;
  const remarks = req.body?.remarks || null;

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
      `SELECT id, status, coupon_id, user_id, amount, phone, network
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

    /* If rejected, release the coupon */
    if (newStatus === "rejected") {
      await client.query(
        `UPDATE public.airtime_coupons
         SET    status = 'available', redeemed_at = NULL, phone = NULL, network = NULL
         WHERE  id = $1`,
        [claim.coupon_id]
      );
    }

    await client.query("COMMIT");

    /* Notifications */
    const { rows: userRow } = await pool.query(
      `SELECT name, email FROM public.users WHERE id = $1`,
      [claim.user_id]
    );
    const user = userRow[0];

    if (user) {
      if (newStatus === "approved") {
        safeEmail(sendAirtimeClaimApprovedEmail, {
          to      : user.email,
          name    : user.name,
          amount  : Number(claim.amount),
          phone   : maskPhone(claim.phone),
          network : claim.network,
        });
      } else if (newStatus === "completed" || newStatus === "sent") {
        safeEmail(sendAirtimeClaimCompletedEmail, {
          to      : user.email,
          name    : user.name,
          amount  : Number(claim.amount),
          phone   : maskPhone(claim.phone),
          network : claim.network,
        });
      } else if (newStatus === "rejected") {
        safeEmail(sendAirtimeClaimRejectedEmail, {
          to      : user.email,
          name    : user.name,
          amount  : Number(claim.amount),
          phone   : maskPhone(claim.phone),
          remarks,
        });
      }
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
   POST /admin/free-phone
═══════════════════════════════════════════════════════════════ */
router.post("/admin/free-phone", authenticate, requireAdmin, async (req, res) => {
  const { phone } = req.body;
  const p = normalizePhone(phone);
  if (!p) return res.status(400).json({ success: false, message: "Phone required." });

  try {
    const { rowCount } = await pool.query(
      `UPDATE public.users
       SET    airtime_phone   = NULL,
              airtime_network = NULL
       WHERE  airtime_phone   = $1`,
      [p]
    );
    return res.json({
      success       : true,
      message       : `Phone ${maskPhone(p)} freed from ${rowCount} account(s).`,
      accounts_freed: rowCount,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /admin/change-user-phone
═══════════════════════════════════════════════════════════════ */
router.post("/admin/change-user-phone", authenticate, requireAdmin, async (req, res) => {
  const adminId   = req.user.id;
  const { userId, phone, reason } = req.body;
  const p         = normalizePhone(phone);
  const ip        = getIp(req);
  const userAgent = req.headers["user-agent"];

  if (!userId || !p || !isValidPhone(p)) {
    return res.status(400).json({ success: false, message: "Invalid inputs." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [old] } = await client.query(
      `SELECT airtime_phone, name, email FROM public.users WHERE id = $1`,
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

    /* History */
    await client.query(
      `INSERT INTO public.airtime_phone_history
         (user_id, old_phone, new_phone, new_network,
          ip_address, user_agent, admin_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, old?.airtime_phone, p, network, ip, userAgent, adminId,
       `admin_override: ${reason || "N/A"}`]
    ).catch((e) => console.warn("[history] insert failed:", e.message));

    await client.query("COMMIT");

    if (old?.email) {
      safeEmail(sendAirtimePhoneChangedEmail, {
        to        : old.email,
        name      : old.name,
        newMasked : maskPhone(p),
        oldMasked : maskPhone(old.airtime_phone),
        ip        : "admin-override",
        changedAt : new Date(),
      });
    }

    return res.json({ success: true, message: "Phone changed by admin." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /admin/phone-history/:userId
═══════════════════════════════════════════════════════════════ */
router.get("/admin/phone-history/:userId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, old_phone, new_phone, old_network, new_network,
              reason, ip_address, device_hash,
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

export default router;