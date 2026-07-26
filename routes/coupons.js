// routes/coupons.js
// ═══════════════════════════════════════════════════════════════
// DISCOUNT COUPONS
// Airtime coupons are handled by routes/airtimeCoupons.js
// This file also merges airtime data into the /coupons and
// /history endpoints so the frontend can show everything at once.
// ═══════════════════════════════════════════════════════════════

import express      from "express";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";
import {
  cacheGet,
  cacheSet,
  cacheDel,
} from "../lib/redis.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   REDIS KEYS + TTL
═══════════════════════════════════════════════════════════════ */
const KEY = {
  userCoupons : (userId) => `coupons:user:${userId}`,
  userHistory : (userId) => `coupons:history:${userId}`,
  userMe      : (userId) => `user:me:${userId}`,
};

const TTL = {
  COUPON_CACHE  : 2 * 60,   // 2 min
  HISTORY_CACHE : 2 * 60,   // 2 min
};

async function invalidateUserCache(userId, alsoMe = false) {
  const jobs = [
    cacheDel(KEY.userCoupons(userId)),
    cacheDel(KEY.userHistory(userId)),
  ];
  if (alsoMe) jobs.push(cacheDel(KEY.userMe(userId)));
  await Promise.allSettled(jobs);
}

/* ═══════════════════════════════════════════════════════════════
   PHONE HELPERS (for masking / history display)
═══════════════════════════════════════════════════════════════ */
const normalisePhone = (raw) => {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  if (d.startsWith("234")) return "0" + d.slice(3);
  if (d.startsWith("0"))   return d;
  if (d.length === 10)     return "0" + d;
  return d;
};

const maskPhone = (phone) => {
  if (!phone) return null;
  const local = normalisePhone(phone);
  if (!local || local.length < 7) return local;
  return local.slice(0, 4) + "****" + local.slice(-3);
};

/* ═══════════════════════════════════════════════════════════════
   ENSURE TABLES + INDEXES
   Only creates discount-coupon tables here.
   The airtime_coupons table is owned by routes/airtimeCoupons.js.
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
  try {
    await pool.query(`
      UPDATE public.coupons
      SET is_private = true
      WHERE is_private = false
        AND created_by IS NOT NULL
        AND description LIKE '%Spin & Win%'
    `);
  } catch (e) {
    console.warn("[coupons] spin-wheel privacy update:", e.message);
  }

  const indexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS unique_coupon_code        ON public.coupons              (code)`,
    `CREATE        INDEX IF NOT EXISTS idx_coupons_active        ON public.coupons              (is_active)`,
    `CREATE        INDEX IF NOT EXISTS idx_coupons_expires       ON public.coupons              (expires_at)`,
    `CREATE        INDEX IF NOT EXISTS idx_coupons_private       ON public.coupons              (is_private, created_by)`,
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

  console.log("[coupons] ✓ discount coupon tables ready");
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

/*
 * Shapes an airtime_coupons row (schema from routes/airtimeCoupons.js).
 * That table uses:
 *   status       : available | redeemed | processing | completed | failed
 *   redeemed_at  : when the user claimed it
 *   phone        : the number airtime will be sent to
 *   network      : MTN / Airtel / Glo / 9mobile
 */
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
    claimed_at    : a.redeemed_at ?? null,
    claim_phone   : a.phone ? normalisePhone(a.phone) : null,
    claim_masked  : maskPhone(a.phone),
    claim_network : a.network ?? null,
  };
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons
   Merged: discount coupons + airtime coupons
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

    /* ── Airtime coupons (schema from airtimeCoupons.js) ── */
    let airtimeRows = [];
    try {
      const r = await pool.query(
        `SELECT
           id, code, amount, status,
           created_at, redeemed_at,
           phone, network
         FROM public.airtime_coupons
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );
      airtimeRows = r.rows;
    } catch (e) {
      /* Non-fatal — table may not exist yet if airtimeCoupons.js hasn't run */
      console.warn("[coupons] airtime query failed (non-fatal):", e.message);
    }

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

    await invalidateUserCache(userId);

    return res.json({ success: true, message: "Coupon redeemed successfully." });

  } catch (err) {
    console.error("[coupons] POST /redeem:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons/history
   Merged: discount redemptions + airtime redemptions
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
      /* Airtime — pulls from airtime_coupons directly */
      pool.query(
        `SELECT
           id, code,
           amount   AS value,
           status,
           created_at,
           redeemed_at,
           phone    AS claim_phone,
           network  AS claim_network
         FROM public.airtime_coupons
         WHERE user_id = $1
           AND status  != 'available'
         ORDER BY redeemed_at DESC NULLS LAST
         LIMIT 50`,
        [userId]
      ).catch((e) => {
        console.warn("[coupons] history airtime query failed:", e.message);
        return { rows: [] };
      }),
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
      claim_phone            : r.claim_phone ? normalisePhone(r.claim_phone) : null,
      claim_masked           : maskPhone(r.claim_phone),
      claim_network          : r.claim_network ?? null,
      order_id               : null,
      redeemed_by_admin      : false,
      redeemed_by_admin_name : null,
    }));

    const history = [...discountHistory, ...airtimeHistory].sort(
      (a, b) => new Date(b.redeemed_at || 0) - new Date(a.redeemed_at || 0)
    );

    const payload = { success: true, history };
    await cacheSet(KEY.userHistory(userId), payload, TTL.HISTORY_CACHE);

    return res.json(payload);

  } catch (err) {
    console.error("[coupons] GET /history:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   AIRTIME ENDPOINTS — 410 Gone (moved)
   Everything airtime-related lives in /api/airtime-coupons now.
═══════════════════════════════════════════════════════════════ */
const airtimeMovedResponse = (res) =>
  res.status(410).json({
    success   : false,
    moved     : true,
    message   : "Airtime endpoints have moved to /api/airtime-coupons.",
    new_paths : {
      list         : "GET  /api/airtime-coupons",
      status       : "GET  /api/airtime-coupons/phone-status",
      send_otp     : "POST /api/airtime-coupons/send-otp",
      verify_otp   : "POST /api/airtime-coupons/verify-otp",
      redeem       : "POST /api/airtime-coupons/redeem",
    },
  });

router.get ("/airtime",              authenticate, (_req, res) => airtimeMovedResponse(res));
router.post("/airtime/send-otp",     authenticate, (_req, res) => airtimeMovedResponse(res));
router.post("/airtime/verify-claim", authenticate, (_req, res) => airtimeMovedResponse(res));
router.post("/airtime/claim",        authenticate, (_req, res) => airtimeMovedResponse(res));

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
═══════════════════════════════════════════════════════════════ */
export { invalidateUserCache };
export default router;