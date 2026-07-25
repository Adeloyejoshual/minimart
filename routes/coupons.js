// routes/coupons.js
import express      from "express";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();

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

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_airtime_code
    ON public.airtime_coupons (code)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_airtime_user
    ON public.airtime_coupons (user_id)
  `);

  /* ── Safe column migrations ── */
  const couponMigrations = [
    `ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS is_private  BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS created_by  UUID    NULL`,
    `ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS description TEXT    NULL`,
    /* airtime_coupons extra columns */
    `ALTER TABLE public.airtime_coupons ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NULL`,
    `ALTER TABLE public.airtime_coupons ADD COLUMN IF NOT EXISTS status     TEXT        NOT NULL DEFAULT 'available'`,
  ];

  for (const sql of couponMigrations) {
    try { await pool.query(sql); }
    catch (e) {
      if (!e.message.includes("already exists")) {
        console.warn("[coupons] migration:", e.message);
      }
    }
  }

  /* ── Mark existing spin wheel coupons as private ── */
  await pool.query(`
    UPDATE public.coupons
    SET is_private = true
    WHERE is_private = false
      AND created_by IS NOT NULL
      AND description LIKE '%Spin & Win%'
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_coupon_code
    ON public.coupons (code)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_coupons_active
    ON public.coupons (is_active)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_coupons_expires
    ON public.coupons (expires_at)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_coupons_private
    ON public.coupons (is_private, created_by)
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

  const redemptionMigrations = [
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS redeemed_by_admin      UUID    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS redeemed_by_admin_name TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_type            TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_value           DECIMAL NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_description     TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS admin_note             TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS verified_user_id       UUID    NULL`,
    `ALTER TABLE public.coupon_redemptions ALTER COLUMN user_id DROP NOT NULL`,
  ];

  for (const sql of redemptionMigrations) {
    try { await pool.query(sql); }
    catch (e) {
      if (!e.message.includes("already exists")) {
        console.warn("[coupons] redemption migration:", e.message);
      }
    }
  }

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_user_coupon
    ON public.coupon_redemptions (coupon_id, user_id)
    WHERE user_id IS NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_redemptions_coupon
    ON public.coupon_redemptions (coupon_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_redemptions_user
    ON public.coupon_redemptions (user_id)
    WHERE user_id IS NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_redemptions_admin
    ON public.coupon_redemptions (redeemed_by_admin)
    WHERE redeemed_by_admin IS NOT NULL
  `);

  console.log("[coupons] ✓ all tables ready");
}

ensureTables().catch((err) =>
  console.warn("[coupons] table init:", err.message)
);

/* ═══════════════════════════════════════════════════════════════
   HELPER — shape a raw coupons row into the API response shape
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
    /* tag so the frontend knows which tab to place it in */
    coupon_kind  : "discount",
  };
}

/* ═══════════════════════════════════════════════════════════════
   HELPER — shape an airtime_coupons row into the API response
═══════════════════════════════════════════════════════════════ */
function shapeAirtime(a, now) {
  const isUsed   = a.status !== "available";
  const daysLeft = null; // airtime coupons don't expire on a fixed schedule

  return {
    id           : a.id,
    code         : a.code,
    type         : "airtime",
    description  : `🎡 Spin & Win — ₦${Number(a.amount)} Airtime`,
    value        : Number(a.amount || 0),
    min_purchase : 0,
    max_discount : null,
    usage_count  : isUsed ? 1 : 0,
    usage_limit  : 1,
    expires_at   : null,
    created_at   : a.created_at,
    is_private   : true,
    is_active    : !isUsed,
    is_expired   : false,
    is_used      : isUsed,
    is_full      : isUsed,
    days_left    : daysLeft,
    usable       : !isUsed,
    coupon_kind  : "airtime",
    /* airtime-specific */
    status       : a.status,
    claimed_at   : a.claimed_at ?? null,
  };
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons
   Returns discount coupons + airtime coupons merged together.

   DISCOUNT COUPON RULES
   ─────────────────────
   Rule 1 — Active public coupons        (everyone sees these)
   Rule 2 — Active private coupons owned by this user
             (only the spin winner sees their coupon)
   Rule 3 — Any coupon this user has already redeemed
             (keeps history visible even after admin deactivates it)

   AIRTIME COUPONS
   ───────────────
   All airtime_coupons rows WHERE user_id = this user.
   They are always private by nature (stored per-user).
═══════════════════════════════════════════════════════════════ */
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const now    = new Date();

    /* ── 1. Discount coupons ── */
    const { rows: discountRows } = await pool.query(
      `SELECT
         c.id,
         c.code,
         c.type,
         c.value,
         c.min_purchase,
         c.max_discount,
         c.usage_limit,
         c.usage_count,
         c.expires_at,
         c.description,
         c.is_private,
         c.is_active,
         c.created_at,
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

    /* ── 2. Airtime coupons ── */
    const { rows: airtimeRows } = await pool.query(
      `SELECT id, code, amount, status, created_at, claimed_at
       FROM   public.airtime_coupons
       WHERE  user_id = $1
       ORDER  BY created_at DESC`,
      [userId]
    );

    /* ── 3. Merge & return ── */
    const discountCoupons = discountRows.map((c) => shapeCoupon(c, now));
    const airtimeCoupons  = airtimeRows.map((a)  => shapeAirtime(a, now));

    /*
     * Put usable airtime at the very top, then usable discounts,
     * then used/expired items at the bottom.
     */
    const usable  = [
      ...airtimeCoupons .filter((c) => c.usable),
      ...discountCoupons.filter((c) => c.usable),
    ];
    const inactive = [
      ...airtimeCoupons .filter((c) => !c.usable),
      ...discountCoupons.filter((c) => !c.usable),
    ];

    const coupons = [...usable, ...inactive];

    return res.json({
      success : true,
      coupons,
      counts  : {
        total   : coupons.length,
        usable  : usable.length,
        airtime : airtimeCoupons.length,
        discount: discountCoupons.length,
      },
    });

  } catch (err) {
    console.error("[coupons] GET /:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons/airtime
   Returns only this user's airtime coupons.
   Useful for a dedicated Airtime tab on the frontend.
═══════════════════════════════════════════════════════════════ */
router.get("/airtime", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const now    = new Date();

    const { rows } = await pool.query(
      `SELECT id, code, amount, status, created_at, claimed_at
       FROM   public.airtime_coupons
       WHERE  user_id = $1
       ORDER  BY created_at DESC`,
      [userId]
    );

    return res.json({
      success         : true,
      airtime_coupons : rows.map((a) => shapeAirtime(a, now)),
    });

  } catch (err) {
    console.error("[coupons] GET /airtime:", err.message);
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
        success: false,
        message: "This coupon is not valid for your account.",
      });
    }

    if (c.expires_at && new Date(c.expires_at) < now) {
      return res.status(400).json({ success: false, message: "This coupon has expired." });
    }

    if (c.usage_limit && Number(c.usage_count) >= Number(c.usage_limit)) {
      return res.status(400).json({
        success: false,
        message: "This coupon has reached its usage limit.",
      });
    }

    const { rows: used } = await pool.query(
      `SELECT id FROM public.coupon_redemptions
       WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
      [c.id, userId]
    );

    if (used.length) {
      return res.status(400).json({
        success: false,
        message: "You have already used this coupon.",
      });
    }

    const amount = Number(order_amount);

    if (Number(c.min_purchase) > 0 && amount < Number(c.min_purchase)) {
      return res.status(400).json({
        success: false,
        message: `A minimum order of ₦${Number(c.min_purchase).toLocaleString("en-NG")} is required.`,
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
      success      : true,
      valid        : true,
      coupon: {
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
        success: false,
        message: "This coupon is not valid for your account.",
      });
    }

    const { rows: existing } = await pool.query(
      `SELECT id FROM public.coupon_redemptions
       WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
      [coupon.id, userId]
    );

    if (existing.length) {
      return res.status(409).json({
        success: false,
        message: "You have already redeemed this coupon.",
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

    return res.json({ success: true, message: "Coupon redeemed successfully." });

  } catch (err) {
    console.error("[coupons] POST /redeem:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/coupons/airtime/claim
   Body: { code }
   Marks an airtime coupon as claimed (pending admin credit).
═══════════════════════════════════════════════════════════════ */
router.post("/airtime/claim", authenticate, async (req, res) => {
  const { code } = req.body;
  const userId   = req.user.id;

  if (!code?.trim()) {
    return res.status(400).json({ success: false, message: "Airtime code is required." });
  }

  try {
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
        success: false,
        message: "This airtime coupon does not belong to your account.",
      });
    }

    if (ac.status !== "available") {
      return res.status(409).json({
        success: false,
        message: `This airtime coupon has already been ${ac.status}.`,
      });
    }

    await pool.query(
      `UPDATE public.airtime_coupons
       SET    status     = 'claimed',
              claimed_at = NOW()
       WHERE  id = $1`,
      [ac.id]
    );

    return res.json({
      success : true,
      message : `✅ ₦${Number(ac.amount)} airtime claim submitted. We will credit your number shortly.`,
      code    : code.trim().toUpperCase(),
      amount  : Number(ac.amount),
    });

  } catch (err) {
    console.error("[coupons] POST /airtime/claim:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons/history
   The current user's coupon redemption history
   (discount coupons + airtime coupons merged)
═══════════════════════════════════════════════════════════════ */
router.get("/history", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const [discountRes, airtimeRes] = await Promise.all([
      pool.query(
        `SELECT
           r.id,
           r.discount,
           r.redeemed_at,
           r.order_id,
           r.redeemed_by_admin_name,
           c.code,
           c.type,
           c.value,
           c.description
         FROM public.coupon_redemptions r
         JOIN public.coupons c ON c.id = r.coupon_id
         WHERE r.user_id = $1
         ORDER BY r.redeemed_at DESC
         LIMIT 50`,
        [userId]
      ),
      pool.query(
        `SELECT
           id,
           code,
           amount  AS value,
           status,
           created_at,
           claimed_at AS redeemed_at
         FROM public.airtime_coupons
         WHERE user_id = $1
           AND status  != 'available'
         ORDER BY claimed_at DESC
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
      order_id               : null,
      redeemed_by_admin      : false,
      redeemed_by_admin_name : null,
    }));

    /* merge & sort newest first */
    const history = [...discountHistory, ...airtimeHistory].sort(
      (a, b) => new Date(b.redeemed_at) - new Date(a.redeemed_at)
    );

    return res.json({ success: true, history });

  } catch (err) {
    console.error("[coupons] GET /history:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

export default router;