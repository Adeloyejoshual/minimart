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
      description  TEXT        NULL,
      created_by   UUID        NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT coupons_pkey PRIMARY KEY (id)
    )
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

  /* ── Coupon redemptions ── */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
      id          UUID        NOT NULL DEFAULT gen_random_uuid(),
      coupon_id   UUID        NOT NULL,
      user_id     UUID        NOT NULL,
      order_id    UUID        NULL,
      discount    DECIMAL     NOT NULL DEFAULT 0,
      redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT coupon_redemptions_pkey PRIMARY KEY (id)
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_user_coupon
    ON public.coupon_redemptions (coupon_id, user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_redemptions_coupon
    ON public.coupon_redemptions (coupon_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_redemptions_user
    ON public.coupon_redemptions (user_id)
  `);
}

ensureTables().catch((err) =>
  console.warn("[coupons] table init:", err.message)
);

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons
   All active coupons with per-user usability flags
   Returns both usable and used/expired so the frontend
   can show the Available tab and the Used tab
═══════════════════════════════════════════════════════════════ */
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
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
         c.created_at,
         COUNT(r.id) FILTER (WHERE r.user_id = $1)::int AS user_usage_count
       FROM public.coupons c
       LEFT JOIN public.coupon_redemptions r ON r.coupon_id = c.id
       WHERE c.is_active = true
       GROUP BY
         c.id, c.code, c.type, c.value, c.min_purchase,
         c.max_discount, c.usage_limit, c.usage_count,
         c.expires_at, c.description, c.created_at
       ORDER BY
         CASE
           WHEN (c.expires_at IS NULL OR c.expires_at > NOW())
            AND (c.usage_limit IS NULL OR c.usage_count < c.usage_limit)
           THEN 0 ELSE 1
         END,
         c.created_at DESC`,
      [userId]
    );

    const now     = new Date();
    const coupons = rows.map((c) => {
      const expiresAt = c.expires_at ? new Date(c.expires_at) : null;
      const isExpired = expiresAt ? expiresAt < now : false;
      const isUsed    = c.user_usage_count > 0;
      const isFull    = c.usage_limit
        ? Number(c.usage_count) >= Number(c.usage_limit)
        : false;
      const daysLeft  = expiresAt
        ? Math.max(0, Math.ceil((expiresAt - now) / 86_400_000))
        : null;

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
        is_expired   : isExpired,
        is_used      : isUsed,
        is_full      : isFull,
        days_left    : daysLeft,
        usable       : !isExpired && !isUsed && !isFull,
      };
    });

    return res.json({ success: true, coupons });

  } catch (err) {
    console.error("[coupons] GET /:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/coupons/validate
   Validate a coupon code and calculate the discount
   Body: { code, order_amount }
═══════════════════════════════════════════════════════════════ */
router.post("/validate", authenticate, async (req, res) => {
  const { code, order_amount = 0 } = req.body;
  const userId = req.user.id;

  if (!code?.trim()) {
    return res.status(400).json({ success: false, message: "Coupon code is required." });
  }

  try {
    /* ── Find coupon ── */
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

    /* ── Expiry check ── */
    if (c.expires_at && new Date(c.expires_at) < now) {
      return res.status(400).json({ success: false, message: "This coupon has expired." });
    }

    /* ── Usage limit check ── */
    if (c.usage_limit && Number(c.usage_count) >= Number(c.usage_limit)) {
      return res.status(400).json({
        success: false,
        message: "This coupon has reached its usage limit.",
      });
    }

    /* ── Already used by this user? ── */
    const { rows: used } = await pool.query(
      `SELECT id FROM public.coupon_redemptions
       WHERE coupon_id = $1
         AND user_id   = $2
       LIMIT 1`,
      [c.id, userId]
    );

    if (used.length) {
      return res.status(400).json({
        success: false,
        message: "You have already used this coupon.",
      });
    }

    /* ── Minimum purchase check ── */
    const amount = Number(order_amount);

    if (Number(c.min_purchase) > 0 && amount < Number(c.min_purchase)) {
      return res.status(400).json({
        success: false,
        message: `A minimum order of ₦${Number(c.min_purchase).toLocaleString("en-NG")} is required for this coupon.`,
      });
    }

    /* ── Calculate discount ── */
    let discount = 0;
    let message  = "";

    if (c.type === "percentage") {
      discount = (amount * Number(c.value)) / 100;
      if (c.max_discount) {
        discount = Math.min(discount, Number(c.max_discount));
      }
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
        id         : c.id,
        code       : c.code,
        type       : c.type,
        value      : Number(c.value),
        description: c.description,
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
   Record coupon use after a successful order
   Body: { code, order_id, discount }
═══════════════════════════════════════════════════════════════ */
router.post("/redeem", authenticate, async (req, res) => {
  const { code, order_id, discount } = req.body;
  const userId = req.user.id;

  if (!code?.trim()) {
    return res.status(400).json({ success: false, message: "Coupon code is required." });
  }

  try {
    /* ── Find coupon ── */
    const { rows } = await pool.query(
      `SELECT id FROM public.coupons
       WHERE UPPER(code) = UPPER($1)
         AND is_active   = true
       LIMIT 1`,
      [code.trim()]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }

    const couponId = rows[0].id;

    /* ── Guard: already redeemed by this user? ── */
    const { rows: existing } = await pool.query(
      `SELECT id FROM public.coupon_redemptions
       WHERE coupon_id = $1
         AND user_id   = $2
       LIMIT 1`,
      [couponId, userId]
    );

    if (existing.length) {
      return res.status(409).json({
        success: false,
        message: "You have already redeemed this coupon.",
      });
    }

    /* ── Insert redemption record ── */
    await pool.query(
      `INSERT INTO public.coupon_redemptions
         (coupon_id, user_id, order_id, discount)
       VALUES ($1, $2, $3, $4)`,
      [couponId, userId, order_id || null, Number(discount || 0)]
    );

    /* ── Increment usage count ── */
    await pool.query(
      `UPDATE public.coupons
       SET usage_count = usage_count + 1
       WHERE id = $1`,
      [couponId]
    );

    return res.json({ success: true, message: "Coupon redeemed successfully." });

  } catch (err) {
    console.error("[coupons] POST /redeem:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons/history
   The current user's coupon redemption history
═══════════════════════════════════════════════════════════════ */
router.get("/history", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT
         r.id,
         r.discount,
         r.redeemed_at,
         r.order_id,
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
    );

    return res.json({
      success : true,
      history : rows.map((r) => ({
        ...r,
        discount : Number(r.discount || 0),
        value    : Number(r.value    || 0),
      })),
    });

  } catch (err) {
    console.error("[coupons] GET /history:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

export default router;