// routes/airtimeCoupons.js
// ═══════════════════════════════════════════════════════════════
// AIRTIME COUPONS — Production-hardened rewrite
//
// Fixes applied:
//   • Schema detection race condition (readiness guard)
//   • SQL injection in LIMIT/OFFSET (fully parameterized)
//   • safeEmail signature consistency enforced
//   • checkClaimLimits fails closed in production
//   • Coupon ownership check moved into WHERE clause
//   • detectNetwork logs unknown prefixes
//   • remarks input sanitized + length capped
//   • admin_note clearable by admins
//   • oldNetwork populated from user record
//   • releaseUserPhones uses schema-aware dynamic UPDATE
//   • /health requires auth in production
//   • page/limit validated as safe integers
// ═══════════════════════════════════════════════════════════════

import express   from "express";
import crypto    from "crypto";
import rateLimit from "express-rate-limit";
import { pool }  from "../config/db.js";
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
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const MAX_REMARKS_LENGTH = 500;
const MAX_PAGE_SIZE      = 100;
const DEFAULT_PAGE_SIZE  = 20;
const ADMIN_PAGE_SIZE    = 50;

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
  if (d.length < 7) return "****";
  return d.slice(0, 4) + "****" + d.slice(-3);
};

/* Network prefix map — extracted for clarity */
const NETWORK_PREFIX_MAP = {
  "0703":"MTN",  "0704":"MTN",  "0706":"MTN",  "0803":"MTN",
  "0806":"MTN",  "0810":"MTN",  "0813":"MTN",  "0814":"MTN",
  "0816":"MTN",  "0903":"MTN",  "0906":"MTN",  "0913":"MTN",
  "0916":"MTN",
  "0701":"Airtel","0708":"Airtel","0802":"Airtel","0808":"Airtel",
  "0812":"Airtel","0901":"Airtel","0902":"Airtel","0904":"Airtel",
  "0907":"Airtel","0912":"Airtel",
  "0705":"Glo",  "0805":"Glo",  "0807":"Glo",  "0811":"Glo",
  "0815":"Glo",  "0905":"Glo",  "0915":"Glo",
  "0809":"9mobile","0817":"9mobile","0818":"9mobile",
  "0908":"9mobile","0909":"9mobile",
};

const detectNetwork = (phone) => {
  const local   = normalizePhone(phone);
  const prefix  = local.slice(0, 4);
  const network = NETWORK_PREFIX_MAP[prefix];

  if (!network) {
    console.warn(`[detectNetwork] unknown prefix="${prefix}" phone=${maskPhone(phone)} — defaulting to MTN`);
  }

  return network ?? "MTN";
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
   INPUT SANITIZERS
═══════════════════════════════════════════════════════════════ */
const sanitizeRemarks = (raw) => {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_REMARKS_LENGTH) : null;
};

const parsePagination = (query, defaultLimit = DEFAULT_PAGE_SIZE) => {
  const rawLimit = parseInt(query.limit, 10);
  const rawPage  = parseInt(query.page,  10);

  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, MAX_PAGE_SIZE)
    : defaultLimit;

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  return { limit, page, offset: (page - 1) * limit };
};

/* ═══════════════════════════════════════════════════════════════
   SAFE EMAIL (fire and forget)
   All email functions MUST accept a single destructured object.
═══════════════════════════════════════════════════════════════ */
const safeEmail = (fn, payload) => {
  if (typeof fn !== "function") {
    console.warn("[airtime] safeEmail: fn is not a function");
    return;
  }
  try {
    Promise.resolve(fn(payload)).catch((e) =>
      console.warn(`[airtime] email failed: ${e.message}`)
    );
  } catch (e) {
    console.warn(`[airtime] email threw: ${e.message}`);
  }
};

/* ═══════════════════════════════════════════════════════════════
   CONFIG (env vars)
═══════════════════════════════════════════════════════════════ */
const CONFIG = Object.freeze({
  max_accounts_per_phone     : parseInt(process.env.MAX_ACCOUNTS_PER_PHONE  ?? "2",   10),
  phone_change_cooldown_days : parseInt(process.env.PHONE_COOLDOWN_DAYS     ?? "30",  10),
  daily_claim_limit          : parseInt(process.env.DAILY_CLAIM_LIMIT       ?? "3",   10),
  weekly_claim_limit         : parseInt(process.env.WEEKLY_CLAIM_LIMIT      ?? "10",  10),
  monthly_claim_limit        : parseInt(process.env.MONTHLY_CLAIM_LIMIT     ?? "30",  10),
  auto_approve               : process.env.AIRTIME_AUTO_APPROVE === "true",
  processing_sla_hours       : parseInt(process.env.PROCESSING_SLA_HOURS    ?? "24",  10),
});

console.log("[airtime] config:", CONFIG);

/* ═══════════════════════════════════════════════════════════════
   SCHEMA STATE
═══════════════════════════════════════════════════════════════ */
const SCHEMA = {
  ready: false,

  claims: {
    has_amount      : false,
    has_approved_at : false,
    has_ip_address  : false,
    has_user_agent  : false,
    has_device_hash : false,
  },

  history: {
    exists       : false,
    has_networks : false,
    has_ip       : false,
    has_ua       : false,
    has_device   : false,
    has_reason   : false,
    has_admin    : false,
  },

  users: {
    has_airtime_phone      : false,
    has_airtime_network    : false,
    has_airtime_updated_at : false,
    has_email_verified     : false,
    has_name               : false,
  },
};

/* ═══════════════════════════════════════════════════════════════
   SCHEMA INTROSPECTION
   Export initSchema() so the app entry point can await it
   before starting the HTTP server.
═══════════════════════════════════════════════════════════════ */
export async function initSchema() {
  try {
    const colQuery = (table) =>
      pool.query(
        `SELECT column_name
         FROM   information_schema.columns
         WHERE  table_schema = 'public'
           AND  table_name   = $1`,
        [table]
      );

    const [claimRes, histRes, userRes] = await Promise.all([
      colQuery("airtime_claims"),
      colQuery("airtime_phone_history"),
      colQuery("users"),
    ]);

    const cSet = new Set(claimRes.rows.map((r) => r.column_name));
    SCHEMA.claims.has_amount      = cSet.has("amount");
    SCHEMA.claims.has_approved_at = cSet.has("approved_at");
    SCHEMA.claims.has_ip_address  = cSet.has("ip_address");
    SCHEMA.claims.has_user_agent  = cSet.has("user_agent");
    SCHEMA.claims.has_device_hash = cSet.has("device_hash");

    SCHEMA.history.exists = histRes.rows.length > 0;
    if (SCHEMA.history.exists) {
      const hSet = new Set(histRes.rows.map((r) => r.column_name));
      SCHEMA.history.has_networks = hSet.has("old_network") && hSet.has("new_network");
      SCHEMA.history.has_ip       = hSet.has("ip_address");
      SCHEMA.history.has_ua       = hSet.has("user_agent");
      SCHEMA.history.has_device   = hSet.has("device_hash");
      SCHEMA.history.has_reason   = hSet.has("reason");
      SCHEMA.history.has_admin    = hSet.has("admin_id");
    }

    const uSet = new Set(userRes.rows.map((r) => r.column_name));
    SCHEMA.users.has_airtime_phone      = uSet.has("airtime_phone");
    SCHEMA.users.has_airtime_network    = uSet.has("airtime_network");
    SCHEMA.users.has_airtime_updated_at = uSet.has("airtime_phone_updated_at");
    SCHEMA.users.has_email_verified     = uSet.has("email_verified");
    SCHEMA.users.has_name               = uSet.has("name");

    SCHEMA.ready = true;
    console.log("[airtime] schema ready:", JSON.stringify(SCHEMA, null, 2));
  } catch (err) {
    console.error("[airtime] schema detection failed:", err.message);
    throw err; // Let the caller decide whether to abort startup
  }
}

/* ═══════════════════════════════════════════════════════════════
   READINESS GUARD MIDDLEWARE
   Blocks all requests until schema detection has completed.
═══════════════════════════════════════════════════════════════ */
router.use((req, res, next) => {
  if (!SCHEMA.ready) {
    return res.status(503).json({
      success : false,
      code    : "SERVICE_INITIALIZING",
      message : "Service is initializing. Please retry in a moment.",
    });
  }
  next();
});

/* ═══════════════════════════════════════════════════════════════
   ANTI-FRAUD HELPERS
═══════════════════════════════════════════════════════════════ */
async function countAccountsUsingPhone(phone, excludeUserId) {
  if (!SCHEMA.users.has_airtime_phone) return 0;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::INT AS cnt
       FROM   public.users
       WHERE  airtime_phone = $1
         AND  id           != $2`,
      [phone, excludeUserId]
    );
    return rows[0]?.cnt ?? 0;
  } catch (e) {
    console.warn("[countAccounts] failed:", e.message);
    return 0;
  }
}

async function getCooldownStatus(userId) {
  if (!SCHEMA.users.has_airtime_updated_at) {
    return { in_cooldown: false, next_change_at: null, days_left: 0 };
  }
  try {
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
    nextChange.setDate(nextChange.getDate() + CONFIG.phone_change_cooldown_days);
    const now      = new Date();
    const inCool   = now < nextChange;
    const daysLeft = Math.max(0, Math.ceil((nextChange - now) / 86_400_000));

    return {
      in_cooldown     : inCool,
      next_change_at  : nextChange.toISOString(),
      days_left       : daysLeft,
      last_changed_at : lastUpdate,
    };
  } catch {
    return { in_cooldown: false, next_change_at: null, days_left: 0 };
  }
}

async function checkClaimLimits(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE claimed_at >= NOW() - INTERVAL '1 day')   AS daily,
         COUNT(*) FILTER (WHERE claimed_at >= NOW() - INTERVAL '7 days')  AS weekly,
         COUNT(*) FILTER (WHERE claimed_at >= NOW() - INTERVAL '30 days') AS monthly
       FROM public.airtime_claims
       WHERE user_id = $1
         AND status != 'rejected'`,
      [userId]
    );
    const r = rows[0];
    const daily   = Number(r.daily);
    const weekly  = Number(r.weekly);
    const monthly = Number(r.monthly);

    return {
      daily_used   : daily,
      weekly_used  : weekly,
      monthly_used : monthly,
      daily_left   : Math.max(0, CONFIG.daily_claim_limit   - daily),
      weekly_left  : Math.max(0, CONFIG.weekly_claim_limit  - weekly),
      monthly_left : Math.max(0, CONFIG.monthly_claim_limit - monthly),
      can_claim    :
        daily   < CONFIG.daily_claim_limit   &&
        weekly  < CONFIG.weekly_claim_limit  &&
        monthly < CONFIG.monthly_claim_limit,
    };
  } catch (e) {
    console.error("[checkClaimLimits] DB error:", e.message);

    /*
     * Fail CLOSED in production — a DB outage must not grant
     * unlimited claims. Fail open only in development so local
     * testing is not blocked.
     */
    if (IS_PROD) {
      return {
        daily_used: 0, weekly_used: 0, monthly_used: 0,
        daily_left: 0, weekly_left: 0, monthly_left: 0,
        can_claim: false,
        error: "limit_check_unavailable",
      };
    }

    return {
      daily_used: 0, weekly_used: 0, monthly_used: 0,
      daily_left: 999, weekly_left: 999, monthly_left: 999,
      can_claim: true,
    };
  }
}

/* ═══════════════════════════════════════════════════════════════
   DYNAMIC INSERT BUILDER — airtime_claims
═══════════════════════════════════════════════════════════════ */
function buildClaimInsert({
  userId, couponId, phone, network, amount,
  status, ip, userAgent, deviceHash, approvedAt,
}) {
  const cols = ["user_id", "airtime_coupon_id", "phone", "network", "status"];
  const vals = [userId, couponId, phone, network, status];

  if (SCHEMA.claims.has_amount)      { cols.push("amount");      vals.push(amount);     }
  if (SCHEMA.claims.has_ip_address)  { cols.push("ip_address");  vals.push(ip);         }
  if (SCHEMA.claims.has_user_agent)  { cols.push("user_agent");  vals.push(userAgent);  }
  if (SCHEMA.claims.has_device_hash) { cols.push("device_hash"); vals.push(deviceHash); }
  if (SCHEMA.claims.has_approved_at) { cols.push("approved_at"); vals.push(approvedAt); }

  const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");

  return {
    sql: `INSERT INTO public.airtime_claims (${cols.join(", ")})
          VALUES (${placeholders})
          RETURNING id, status, claimed_at`,
    vals,
  };
}

/* ═══════════════════════════════════════════════════════════════
   DYNAMIC INSERT BUILDER — airtime_phone_history
═══════════════════════════════════════════════════════════════ */
function buildHistoryInsert({
  userId, oldPhone, newPhone, oldNetwork, newNetwork,
  ip, userAgent, deviceHash, reason, adminId,
}) {
  if (!SCHEMA.history.exists) return null;

  const cols = ["user_id", "old_phone", "new_phone"];
  const vals = [userId, oldPhone, newPhone];

  if (SCHEMA.history.has_networks) {
    cols.push("old_network", "new_network");
    vals.push(oldNetwork ?? null, newNetwork);
  }
  if (SCHEMA.history.has_ip)     { cols.push("ip_address");  vals.push(ip);        }
  if (SCHEMA.history.has_ua)     { cols.push("user_agent");  vals.push(userAgent); }
  if (SCHEMA.history.has_device) { cols.push("device_hash"); vals.push(deviceHash);}
  if (SCHEMA.history.has_reason) { cols.push("reason");      vals.push(reason);    }
  if (SCHEMA.history.has_admin && adminId) {
    cols.push("admin_id"); vals.push(adminId);
  }

  const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");

  return {
    sql : `INSERT INTO public.airtime_phone_history (${cols.join(", ")})
           VALUES (${placeholders})`,
    vals,
  };
}

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const makeLimit = ({ windowMs, max, msg }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? req.ip),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, code: "RATE_LIMITED", message: msg }),
  });

const checkPhoneLimit  = makeLimit({ windowMs: 60_000, max: 30, msg: "Too many checks. Slow down."    });
const redeemLimit      = makeLimit({ windowMs: 60_000, max: 5,  msg: "Too many claims. Wait a minute." });
const phoneUpdateLimit = makeLimit({ windowMs: 60_000, max: 10, msg: "Too many updates. Slow down."   });

/* ═══════════════════════════════════════════════════════════════
   RELEASE USER PHONES — call on account deletion
═══════════════════════════════════════════════════════════════ */
export async function releaseUserPhones(userId) {
  if (!SCHEMA.users.has_airtime_phone) return;
  try {
    const fields = ["airtime_phone = NULL"];
    if (SCHEMA.users.has_airtime_network)    fields.push("airtime_network = NULL");
    if (SCHEMA.users.has_airtime_updated_at) fields.push("airtime_phone_updated_at = NULL");

    await pool.query(
      `UPDATE public.users SET ${fields.join(", ")} WHERE id = $1`,
      [userId]
    );
    console.log(`[airtime] released phones for user=${userId}`);
  } catch (err) {
    console.error("[releaseUserPhones]:", err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   MIDDLEWARE HELPERS
═══════════════════════════════════════════════════════════════ */
const requireAdmin = (req, res, next) => {
  if (req.user?.role === "admin" || req.user?.is_admin === true) return next();
  return res.status(403).json({ success: false, message: "Admin access required." });
};

/*
 * Health endpoints are unauthenticated in development.
 * In production they require a valid session to avoid leaking
 * config and schema details to unauthenticated callers.
 */
const healthAuth = IS_PROD ? authenticate : (_req, _res, next) => next();

/* ════════════════════════════════════════════════════════════════
                          USER ROUTES
════════════════════════════════════════════════════════════════ */

/* ── GET /health ── */
router.get("/health", healthAuth, (_req, res) =>
  res.json({
    success  : true,
    service  : "airtime-coupons",
    time     : new Date().toISOString(),
    config   : CONFIG,
    schema   : SCHEMA,
    node_env : process.env.NODE_ENV || "unknown",
    uptime_s : Math.round(process.uptime()),
  })
);

/* ── GET /health/db ── */
router.get("/health/db", healthAuth, async (_req, res) => {
  try {
    const start      = Date.now();
    const { rows }   = await pool.query("SELECT NOW() AS now");
    return res.json({
      success   : true,
      db        : "connected",
      db_time   : rows[0].now,
      latency_ms: Date.now() - start,
    });
  } catch (err) {
    return res.status(500).json({ success: false, db: "error", error: err.message });
  }
});

/* ── GET /api/airtime-coupons ── */
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
    console.error("[airtime] list:", err.message);
    return res.status(500).json({ success: false, message: "Could not fetch coupons." });
  }
});

/* ── GET /api/airtime-coupons/airtime-phone ── */
router.get("/airtime-phone", authenticate, async (req, res) => {
  const userId = req.user.id;

  if (!SCHEMA.users.has_airtime_phone) {
    return res.json({
      success: true,
      airtime: {
        has_saved      : false,
        phone          : null,
        masked         : null,
        network        : null,
        updated_at     : null,
        in_cooldown    : false,
        next_change_at : null,
        days_left      : 0,
        cooldown_days  : CONFIG.phone_change_cooldown_days,
      },
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT airtime_phone, airtime_network, airtime_phone_updated_at
       FROM   public.users
       WHERE  id = $1
       LIMIT  1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const u        = rows[0];
    const cooldown = await getCooldownStatus(userId);

    return res.json({
      success: true,
      airtime: {
        has_saved      : !!u.airtime_phone,
        phone          : u.airtime_phone   || null,
        masked         : maskPhone(u.airtime_phone),
        network        : u.airtime_network || null,
        updated_at     : u.airtime_phone_updated_at,
        in_cooldown    : cooldown.in_cooldown,
        next_change_at : cooldown.next_change_at,
        days_left      : cooldown.days_left,
        cooldown_days  : CONFIG.phone_change_cooldown_days,
      },
    });
  } catch (err) {
    console.error("[airtime] airtime-phone:", err.message);
    return res.status(500).json({ success: false, message: "Could not fetch airtime phone." });
  }
});

/* ── GET /api/airtime-coupons/check-phone/:phone ── */
router.get("/check-phone/:phone", authenticate, checkPhoneLimit, async (req, res) => {
  const userId = req.user.id;
  const phone  = normalizePhone(req.params.phone);

  if (!phone || !isValidPhone(phone)) {
    return res.status(400).json({
      success   : false,
      available : false,
      message   : "Invalid phone number format.",
    });
  }

  try {
    const count     = await countAccountsUsingPhone(phone, userId);
    const available = count < CONFIG.max_accounts_per_phone;
    return res.json({
      success  : true,
      available,
      message  : available
        ? "Number can be used."
        : "This phone number has reached the maximum number of allowed accounts.",
    });
  } catch (err) {
    console.error("[check-phone]:", err.message);
    return res.json({ success: true, available: true, message: "" });
  }
});

/* ── GET /api/airtime-coupons/claims ── */
router.get("/claims", authenticate, async (req, res) => {
  const userId              = req.user.id;
  const { limit, page, offset } = parsePagination(req.query);

  const selectCols = [
    "ac.id", "ac.phone", "ac.network", "ac.status", "ac.claimed_at",
    "ac.credited_at", "ac.admin_note",
  ];
  if (SCHEMA.claims.has_amount)      selectCols.push("ac.amount");
  if (SCHEMA.claims.has_approved_at) selectCols.push("ac.approved_at");
  selectCols.push("c.code AS coupon_code");

  try {
    const [{ rows }, { rows: cnt }] = await Promise.all([
      pool.query(
        `SELECT ${selectCols.join(", ")}
         FROM   public.airtime_claims ac
         JOIN   public.airtime_coupons c ON c.id = ac.airtime_coupon_id
         WHERE  ac.user_id = $1
         ORDER  BY ac.claimed_at DESC
         LIMIT  $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::INT AS total
         FROM   public.airtime_claims
         WHERE  user_id = $1`,
        [userId]
      ),
    ]);

    return res.json({
      success : true,
      page,
      limit,
      total   : cnt[0]?.total ?? 0,
      claims  : rows.map((c) => ({
        id           : c.id,
        coupon_code  : c.coupon_code,
        amount       : Number(c.amount || 0),
        phone        : maskPhone(c.phone),
        network      : c.network,
        status       : c.status,
        submitted_at : c.claimed_at,
        approved_at  : c.approved_at || null,
        processed_at : c.credited_at,
        remarks      : c.admin_note,
      })),
    });
  } catch (err) {
    console.error("[airtime] claims:", err.message);
    return res.status(500).json({ success: false, message: "Could not fetch claims." });
  }
});

/* ── GET /api/airtime-coupons/status/:id ── */
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
      success : true,
      coupon  : {
        id          : c.id,
        code        : c.code,
        amount      : Number(c.amount),
        status      : c.status,
        redeemed_at : c.redeemed_at,
        phone       : maskPhone(c.phone),
        network     : c.network,
      },
    });
  } catch (err) {
    console.error("[airtime] status:", err.message);
    return res.status(500).json({ success: false, message: "Could not fetch coupon status." });
  }
});

/* ════════════════════════════════════════════════════════════════
   POST /api/airtime-coupons/redeem
════════════════════════════════════════════════════════════════ */
router.post("/redeem", authenticate, redeemLimit, async (req, res) => {
  const userId        = req.user.id;
  const code          = String(req.body?.code || "").trim();
  const phone         = normalizePhone(req.body?.phone);
  const saveAsDefault = req.body?.save_as_default !== false;
  const ip            = getIp(req);
  const userAgent     = req.headers["user-agent"];
  const deviceHash    = getDeviceHash(req);

  console.log("[redeem] START", { userId, code, phone: maskPhone(phone), saveAsDefault });

  /* Input validation */
  if (!code) {
    return res.status(400).json({ success: false, message: "Coupon code is required." });
  }
  if (!phone) {
    return res.status(400).json({ success: false, message: "Phone number is required." });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({
      success : false,
      message : "Enter a valid 11-digit Nigerian mobile number.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── Step 1: Fetch & lock user ── */
    const userCols = ["id", "email"];
    if (SCHEMA.users.has_name)               userCols.push("name");
    if (SCHEMA.users.has_email_verified)     userCols.push("email_verified");
    if (SCHEMA.users.has_airtime_phone)      userCols.push("airtime_phone");
    if (SCHEMA.users.has_airtime_network)    userCols.push("airtime_network");
    if (SCHEMA.users.has_airtime_updated_at) userCols.push("airtime_phone_updated_at");

    const { rows: userRows } = await client.query(
      `SELECT ${userCols.join(", ")}
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

    /* Email verification */
    if (SCHEMA.users.has_email_verified && !user.email_verified) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success : false,
        code    : "EMAIL_NOT_VERIFIED",
        message : "Please verify your email address before redeeming.",
        email   : user.email,
      });
    }

    /* ── Step 2: Claim limits ── */
    const limits = await checkClaimLimits(userId);
    if (!limits.can_claim) {
      await client.query("ROLLBACK");
      return res.status(429).json({
        success : false,
        code    : "CLAIM_LIMIT_REACHED",
        message : limits.error
          ? "Claim limit check is unavailable. Please try again shortly."
          : "You have reached your claim limit. Try again later.",
        limits,
      });
    }

    /* ── Step 3: Phone change flags ── */
    const savedPhone      = SCHEMA.users.has_airtime_phone ? user.airtime_phone : null;
    const phoneIsNew      = SCHEMA.users.has_airtime_phone && !savedPhone;
    const phoneIsChanging = SCHEMA.users.has_airtime_phone && !!savedPhone && savedPhone !== phone;

    /* ── Step 4: Cooldown ── */
    if (phoneIsChanging && saveAsDefault) {
      const cooldown = await getCooldownStatus(userId);
      if (cooldown.in_cooldown) {
        await client.query("ROLLBACK");

        safeEmail(sendAirtimeCooldownReminderEmail, {
          to            : user.email,
          name          : user.name,
          currentMasked : maskPhone(savedPhone),
          nextChangeAt  : cooldown.next_change_at,
          daysLeft      : cooldown.days_left,
        });

        return res.status(400).json({
          success  : false,
          code     : "PHONE_COOLDOWN_ACTIVE",
          message  : `You can change your default airtime number in ${cooldown.days_left} day${cooldown.days_left !== 1 ? "s" : ""}.`,
          cooldown,
        });
      }
    }

    /* ── Step 5: Phone account limit ── */
    if (SCHEMA.users.has_airtime_phone && savedPhone !== phone) {
      const usedByOthers = await countAccountsUsingPhone(phone, userId);
      if (usedByOthers >= CONFIG.max_accounts_per_phone) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success : false,
          code    : "PHONE_LIMIT_REACHED",
          message : "This phone number has reached the maximum number of allowed accounts.",
        });
      }
    }

    /* ── Step 6: Lock & validate coupon
          Ownership is checked IN the WHERE clause to:
          a) Avoid locking rows that belong to other users
          b) Prevent coupon code enumeration (same 404 for both cases)
    ── */
    const { rows: couponRows } = await client.query(
      `SELECT id, user_id, status, amount
       FROM   public.airtime_coupons
       WHERE  UPPER(code) = UPPER($1)
         AND  user_id     = $2
       LIMIT  1
       FOR UPDATE`,
      [code, userId]
    );

    if (!couponRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }

    const coupon = couponRows[0];

    if (coupon.status !== "available") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success : false,
        message : `This coupon has already been ${coupon.status}.`,
      });
    }

    const network     = detectNetwork(phone);
    const finalStatus = CONFIG.auto_approve ? "approved" : "pending";

    /* ── Step 7: Mark coupon redeemed ── */
    const { rows: updated } = await client.query(
      `UPDATE public.airtime_coupons
       SET    status      = 'redeemed',
              redeemed_by = $1,
              redeemed_at = NOW(),
              phone       = $2,
              network     = $3
       WHERE  id = $4 AND status = 'available'
       RETURNING id`,
      [userId, phone, network, coupon.id]
    );

    if (!updated.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success : false,
        message : "Coupon was just redeemed. Please refresh.",
      });
    }

    /* ── Step 8: Create claim record ── */
    const { sql: claimSql, vals: claimVals } = buildClaimInsert({
      userId,
      couponId   : coupon.id,
      phone,
      network,
      amount     : coupon.amount,
      status     : finalStatus,
      ip,
      userAgent,
      deviceHash,
      approvedAt : finalStatus === "approved" ? new Date() : null,
    });

    let claim;
    try {
      ({ rows: [claim] } = await client.query(claimSql, claimVals));
    } catch (insertErr) {
      console.error(
        "[redeem] claim insert failed — attempting minimal fallback:",
        insertErr.message,
        { code: insertErr.code, column: insertErr.column, detail: insertErr.detail }
      );

      /* Absolute minimal fallback — only guaranteed columns */
      ({ rows: [claim] } = await client.query(
        `INSERT INTO public.airtime_claims
           (user_id, airtime_coupon_id, phone, network, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, status, claimed_at`,
        [userId, coupon.id, phone, network, finalStatus]
      ));

      console.warn("[redeem] minimal fallback succeeded");
    }

    /* ── Step 9: Persist airtime phone ── */
    let phoneSaved = false;
    const oldPhone   = savedPhone;
    const oldNetwork = SCHEMA.users.has_airtime_network ? user.airtime_network : null;

    const shouldSavePhone =
      SCHEMA.users.has_airtime_phone &&
      (phoneIsNew || (phoneIsChanging && saveAsDefault));

    if (shouldSavePhone) {
      const updateFields = ["airtime_phone = $1"];
      const updateVals   = [phone];
      let   paramIdx     = 2;

      if (SCHEMA.users.has_airtime_network) {
        updateFields.push(`airtime_network = $${paramIdx++}`);
        updateVals.push(network);
      }
      if (SCHEMA.users.has_airtime_updated_at) {
        updateFields.push("airtime_phone_updated_at = NOW()");
      }

      updateVals.push(userId);

      try {
        await client.query(
          `UPDATE public.users
           SET    ${updateFields.join(", ")}
           WHERE  id = $${paramIdx}`,
          updateVals
        );
        phoneSaved = true;
      } catch (e) {
        console.warn("[redeem] user phone update failed:", e.message);
      }

      /* History (best effort — failure does not abort the transaction) */
      const histQuery = buildHistoryInsert({
        userId,
        oldPhone,
        newPhone   : phone,
        oldNetwork,
        newNetwork : network,
        ip,
        userAgent,
        deviceHash,
        reason     : phoneIsNew ? "first_claim" : "user_update",
      });

      if (histQuery) {
        try {
          await client.query(histQuery.sql, histQuery.vals);
        } catch (e) {
          console.warn("[redeem] history insert failed:", e.message);
        }
      }
    }

    await client.query("COMMIT");

    console.log(
      `[airtime] redeemed | claim=${claim.id} status=${claim.status} ` +
      `₦${coupon.amount} phone=${maskPhone(phone)}`
    );

    /* ── Post-commit notifications ── */
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
        to       : user.email,
        name     : user.name,
        amount   : Number(coupon.amount),
        phone    : maskPhone(phone),
        network,
        slaHours : CONFIG.processing_sla_hours,
      });
    }

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
        submitted_at : claim.claimed_at,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("╔═══ [airtime] REDEEM ERROR ═══");
    console.error("║ message   :", err.message);
    console.error("║ code      :", err.code);
    console.error("║ detail    :", err.detail);
    console.error("║ table     :", err.table);
    console.error("║ column    :", err.column);
    console.error("║ constraint:", err.constraint);
    console.error("║ hint      :", err.hint);
    console.error("╚═══════════════════════════════");

    return res.status(500).json({
      success : false,
      message : "Redemption failed. Please try again.",
      ...(IS_PROD
        ? {}
        : {
            debug: {
              error      : err.message,
              code       : err.code,
              column     : err.column     || null,
              table      : err.table      || null,
              constraint : err.constraint || null,
              detail     : err.detail     || null,
              hint       : err.hint       || null,
            },
          }),
    });
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════════
   PATCH /api/airtime-coupons/airtime-phone
════════════════════════════════════════════════════════════════ */
router.patch("/airtime-phone", authenticate, phoneUpdateLimit, async (req, res) => {
  const userId     = req.user.id;
  const phone      = normalizePhone(req.body?.phone);
  const ip         = getIp(req);
  const userAgent  = req.headers["user-agent"];
  const deviceHash = getDeviceHash(req);

  if (!phone || !isValidPhone(phone)) {
    return res.status(400).json({
      success : false,
      message : "Enter a valid 11-digit Nigerian mobile number.",
    });
  }

  if (!SCHEMA.users.has_airtime_phone) {
    return res.status(501).json({
      success : false,
      message : "Airtime phone feature not enabled.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userCols = ["airtime_phone", "email"];
    if (SCHEMA.users.has_name)               userCols.push("name");
    if (SCHEMA.users.has_airtime_network)    userCols.push("airtime_network");
    if (SCHEMA.users.has_airtime_updated_at) userCols.push("airtime_phone_updated_at");

    const { rows: userRows } = await client.query(
      `SELECT ${userCols.join(", ")}
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

    if (user.airtime_phone === phone) {
      await client.query("ROLLBACK");
      return res.json({
        success : true,
        message : "This is already your saved airtime number.",
        airtime : { phone, masked: maskPhone(phone), network: detectNetwork(phone) },
      });
    }

    /* Cooldown */
    if (user.airtime_phone) {
      const cooldown = await getCooldownStatus(userId);
      if (cooldown.in_cooldown) {
        await client.query("ROLLBACK");

        safeEmail(sendAirtimeCooldownReminderEmail, {
          to            : user.email,
          name          : user.name,
          currentMasked : maskPhone(user.airtime_phone),
          nextChangeAt  : cooldown.next_change_at,
          daysLeft      : cooldown.days_left,
        });

        return res.status(400).json({
          success  : false,
          code     : "PHONE_COOLDOWN_ACTIVE",
          message  : `You can change your default airtime number in ${cooldown.days_left} day${cooldown.days_left !== 1 ? "s" : ""}.`,
          cooldown,
        });
      }
    }

    /* Account limit */
    const usedByOthers = await countAccountsUsingPhone(phone, userId);
    if (usedByOthers >= CONFIG.max_accounts_per_phone) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success : false,
        code    : "PHONE_LIMIT_REACHED",
        message : "This phone number has reached the maximum number of allowed accounts.",
      });
    }

    const network    = detectNetwork(phone);
    const oldPhone   = user.airtime_phone;
    const oldNetwork = SCHEMA.users.has_airtime_network ? user.airtime_network : null;

    /* Dynamic UPDATE */
    const updateFields = ["airtime_phone = $1"];
    const updateVals   = [phone];
    let   paramIdx     = 2;

    if (SCHEMA.users.has_airtime_network) {
      updateFields.push(`airtime_network = $${paramIdx++}`);
      updateVals.push(network);
    }
    if (SCHEMA.users.has_airtime_updated_at) {
      updateFields.push("airtime_phone_updated_at = NOW()");
    }

    updateVals.push(userId);

    await client.query(
      `UPDATE public.users
       SET    ${updateFields.join(", ")}
       WHERE  id = $${paramIdx}`,
      updateVals
    );

    /* History */
    const histQuery = buildHistoryInsert({
      userId,
      oldPhone,
      newPhone   : phone,
      oldNetwork,
      newNetwork : network,
      ip,
      userAgent,
      deviceHash,
      reason     : "user_update",
    });

    if (histQuery) {
      try {
        await client.query(histQuery.sql, histQuery.vals);
      } catch (e) {
        console.warn("[patch] history insert failed:", e.message);
      }
    }

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
      success : true,
      message : "Airtime number updated successfully.",
      airtime : { phone, masked: maskPhone(phone), network },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[airtime] phone update:", err.message);
    return res.status(500).json({ success: false, message: "Could not update airtime number." });
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════════
                          ADMIN ROUTES
════════════════════════════════════════════════════════════════ */

/* ── GET /admin/dashboard ── */
router.get("/admin/dashboard", authenticate, requireAdmin, async (_req, res) => {
  try {
    const amountSelect = SCHEMA.claims.has_amount
      ? `COALESCE(SUM(amount) FILTER (WHERE status IN ('completed','sent')), 0) AS total_paid,
         COALESCE(SUM(amount) FILTER (WHERE status  = 'pending'),            0) AS pending_amount`
      : `0 AS total_paid, 0 AS pending_amount`;

    const [claimsRes, phonesRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
          COUNT(*) FILTER (WHERE status = 'approved')  AS approved,
          COUNT(*) FILTER (WHERE status = 'sent')      AS sent,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          COUNT(*) FILTER (WHERE status = 'rejected')  AS rejected,
          COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
          COUNT(*)                                     AS total,
          ${amountSelect}
        FROM public.airtime_claims
      `),
      SCHEMA.users.has_airtime_phone
        ? pool.query(`
            SELECT airtime_phone, COUNT(*)::INT AS user_count
            FROM   public.users
            WHERE  airtime_phone IS NOT NULL
            GROUP  BY airtime_phone
            HAVING COUNT(*) > 1
            ORDER  BY user_count DESC
            LIMIT  20
          `)
        : Promise.resolve({ rows: [] }),
    ]);

    return res.json({
      success   : true,
      dashboard : {
        claims            : claimsRes.rows[0],
        top_shared_phones : phonesRes.rows.map((r) => ({
          masked     : maskPhone(r.airtime_phone),
          user_count : r.user_count,
        })),
      },
    });
  } catch (err) {
    console.error("[admin/dashboard]:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ── GET /admin/claims ── */
router.get("/admin/claims", authenticate, requireAdmin, async (req, res) => {
  const status              = req.query.status || "pending";
  const search              = req.query.search?.trim().toLowerCase();
  const { limit, page, offset } = parsePagination(req.query, ADMIN_PAGE_SIZE);

  const selectCols = [
    "ac.id", "ac.user_id", "ac.phone", "ac.network",
    "ac.status", "ac.claimed_at", "ac.credited_at", "ac.admin_note",
  ];
  if (SCHEMA.claims.has_amount)      selectCols.push("ac.amount");
  if (SCHEMA.claims.has_approved_at) selectCols.push("ac.approved_at");
  if (SCHEMA.claims.has_ip_address)  selectCols.push("ac.ip_address");
  selectCols.push("c.code AS coupon_code", "u.email");
  if (SCHEMA.users.has_name)         selectCols.push("u.name");

  try {
    const args = [status];
    let where  = "WHERE ac.status = $1";

    if (search) {
      args.push(`%${search}%`);
      const p = args.length;
      where += ` AND (
        ac.phone       ILIKE $${p} OR
        LOWER(u.email)  LIKE $${p} OR
        UPPER(c.code)   LIKE UPPER($${p})
      )`;
    }

    /* Fully parameterized LIMIT / OFFSET */
    args.push(limit, offset);
    const limitParam  = args.length - 1;
    const offsetParam = args.length;

    const { rows } = await pool.query(
      `SELECT ${selectCols.join(", ")}
       FROM   public.airtime_claims  ac
       JOIN   public.airtime_coupons c  ON c.id  = ac.airtime_coupon_id
       JOIN   public.users           u  ON u.id  = ac.user_id
       ${where}
       ORDER  BY ac.claimed_at ASC
       LIMIT  $${limitParam} OFFSET $${offsetParam}`,
      args
    );

    return res.json({
      success : true,
      page,
      limit,
      claims  : rows.map((c) => ({
        ...c,
        submitted_at : c.claimed_at,
        processed_at : c.credited_at,
        remarks      : c.admin_note,
      })),
    });
  } catch (err) {
    console.error("[admin/claims]:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch claims." });
  }
});

/* ── POST /admin/claims/:id/process ── */
router.post("/admin/claims/:id/process", authenticate, requireAdmin, async (req, res) => {
  const adminId = req.user.id;
  const claimId = req.params.id;
  const action  = req.body?.action;

  /*
   * Sanitize remarks — allow explicit empty string to CLEAR a note,
   * but convert to null so COALESCE logic works correctly when
   * remarks is intentionally omitted (undefined).
   */
  const remarks = req.body && Object.prototype.hasOwnProperty.call(req.body, "remarks")
    ? sanitizeRemarks(req.body.remarks) // may be null if empty
    : undefined;                        // undefined = do not change existing note

  const VALID_ACTIONS = ["approve", "send", "complete", "reject", "fail"];
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid action." });
  }

  const statusMap = {
    approve  : "approved",
    send     : "sent",
    complete : "completed",
    reject   : "rejected",
    fail     : "failed",
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const claimCols = ["id", "status", "airtime_coupon_id", "user_id", "phone", "network"];
    if (SCHEMA.claims.has_amount) claimCols.push("amount");

    const { rows } = await client.query(
      `SELECT ${claimCols.join(", ")}
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

    /*
     * admin_note handling:
     *   remarks === undefined → keep existing note (COALESCE)
     *   remarks === null      → clear the note
     *   remarks === "string"  → set new note
     */
    const noteExpr = remarks === undefined
      ? "admin_note = COALESCE($3, admin_note)"  // preserve if $3 is null
      : "admin_note = $3";                        // allow explicit clear

    const setFields = [
      "status      = $1",
      `credited_at = CASE WHEN $1 IN ('completed','sent','rejected','failed')
                         THEN NOW() ELSE credited_at END`,
      "credited_by = $2",
      noteExpr,
    ];

    if (SCHEMA.claims.has_approved_at) {
      setFields.push(
        `approved_at = CASE WHEN $1 = 'approved' AND approved_at IS NULL
                            THEN NOW() ELSE approved_at END`
      );
    }

    await client.query(
      `UPDATE public.airtime_claims
       SET    ${setFields.join(", ")}
       WHERE  id = $4`,
      [newStatus, adminId, remarks ?? null, claimId]
    );

    /* Restore coupon if rejected */
    if (newStatus === "rejected") {
      await client.query(
        `UPDATE public.airtime_coupons
         SET    status = 'available', redeemed_at = NULL,
                phone  = NULL,        network     = NULL
         WHERE  id = $1`,
        [claim.airtime_coupon_id]
      );
    }

    await client.query("COMMIT");

    /* Notifications */
    const userCols2 = ["email"];
    if (SCHEMA.users.has_name) userCols2.push("name");

    const { rows: userRow } = await pool.query(
      `SELECT ${userCols2.join(", ")} FROM public.users WHERE id = $1 LIMIT 1`,
      [claim.user_id]
    );
    const user   = userRow[0];
    const amount = Number(claim.amount || 0);

    if (user) {
      if (newStatus === "approved") {
        safeEmail(sendAirtimeClaimApprovedEmail, {
          to: user.email, name: user.name,
          amount, phone: maskPhone(claim.phone), network: claim.network,
        });
      } else if (newStatus === "completed" || newStatus === "sent") {
        safeEmail(sendAirtimeClaimCompletedEmail, {
          to: user.email, name: user.name,
          amount, phone: maskPhone(claim.phone), network: claim.network,
        });
      } else if (newStatus === "rejected") {
        safeEmail(sendAirtimeClaimRejectedEmail, {
          to: user.email, name: user.name,
          amount, phone: maskPhone(claim.phone),
          remarks: remarks ?? null,
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

/* ── POST /admin/reset-cooldown/:userId ── */
router.post("/admin/reset-cooldown/:userId", authenticate, requireAdmin, async (req, res) => {
  if (!SCHEMA.users.has_airtime_updated_at) {
    return res.status(501).json({ success: false, message: "Cooldown tracking not enabled." });
  }
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

/* ── POST /admin/free-phone ── */
router.post("/admin/free-phone", authenticate, requireAdmin, async (req, res) => {
  const p = normalizePhone(req.body?.phone);
  if (!p) return res.status(400).json({ success: false, message: "Phone required." });

  if (!SCHEMA.users.has_airtime_phone) {
    return res.status(501).json({ success: false, message: "Not supported." });
  }

  try {
    const fields = ["airtime_phone = NULL"];
    if (SCHEMA.users.has_airtime_network) fields.push("airtime_network = NULL");

    const { rowCount } = await pool.query(
      `UPDATE public.users SET ${fields.join(", ")} WHERE airtime_phone = $1`,
      [p]
    );

    return res.json({
      success        : true,
      message        : `Phone ${maskPhone(p)} freed from ${rowCount} account(s).`,
      accounts_freed : rowCount,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;