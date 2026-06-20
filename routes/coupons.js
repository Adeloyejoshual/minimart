// routes/coupons.js
import express      from "express";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   CREATE TABLE IF NOT EXISTS
═══════════════════════════════════════════════════════════════ */
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.coupons (
      id            UUID        NOT NULL DEFAULT gen_random_uuid(),
      code          STRING      NOT NULL,
      type          STRING      NOT NULL DEFAULT 'percentage', -- percentage | fixed | free_shipping
      value         DECIMAL     NOT NULL DEFAULT 0,
      min_purchase  DECIMAL     NULL DEFAULT 0,
      max_discount  DECIMAL     NULL,
      usage_limit   INT8        NULL,
      usage_count   INT8        NOT NULL DEFAULT 0,
      expires_at    TIMESTAMP   NULL,
      is_active     BOOL        NOT NULL DEFAULT true,
      description   STRING      NULL,
      created_by    UUID        NULL,
      created_at    TIMESTAMP   NOT NULL DEFAULT now(),
      CONSTRAINT coupons_pkey PRIMARY KEY (id ASC),
      UNIQUE INDEX unique_coupon_code (code ASC)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
      id          UUID      NOT NULL DEFAULT gen_random_uuid(),
      coupon_id   UUID      NOT NULL,
      user_id     UUID      NOT NULL,
      order_id    UUID      NULL,
      discount    DECIMAL   NOT NULL DEFAULT 0,
      redeemed_at TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT coupon_redemptions_pkey PRIMARY KEY (id ASC),
      INDEX idx_redemptions_coupon (coupon_id ASC),
      INDEX idx_redemptions_user   (user_id   ASC)
    )
  `);

  // Seed some default coupons if none exist
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM public.coupons`
  );

  if (rows[0].total === 0) {
    await pool.query(`
      INSERT INTO public.coupons
        (code, type, value, min_purchase, max_discount, usage_limit, expires_at, description)
      VALUES
        ('WELCOME10',  'percentage',  10, 0,      5000,  1000, NOW() + INTERVAL '365 days', 'Get 10% off your first purchase'),
        ('SAVE500',    'fixed',      500, 2000,    NULL,   500, NOW() + INTERVAL '90 days',  'Save ₦500 on orders above ₦2,000'),
        ('LOEMART20',  'percentage',  20, 5000,   10000,  200, NOW() + INTERVAL '30 days',  '20% off orders above ₦5,000'),
        ('FREESHIP',   'free_shipping', 0, 1000,  NULL,   300, NOW() + INTERVAL '60 days',  'Free delivery on all orders'),
        ('FLASH50',    'percentage',  50, 10000,  25000,  100, NOW() + INTERVAL '7 days',   '50% off — Flash sale!')
      ON CONFLICT (code) DO NOTHING
    `);
  }
}

ensureTables().catch((err) =>
  console.warn("[coupons] table init:", err.message)
);

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons
   Get available coupons for the current user
═══════════════════════════════════════════════════════════════ */
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    /* Get all active coupons with user's redemption info */
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
         c.is_active,
         c.description,
         c.created_at,
         COUNT(r.id) FILTER (WHERE r.user_id = $1)::int AS user_usage_count
       FROM public.coupons c
       LEFT JOIN public.coupon_redemptions r
         ON r.coupon_id = c.id
       WHERE c.is_active  = true
         AND (c.expires_at IS NULL OR c.expires_at > NOW())
         AND (c.usage_limit IS NULL OR c.usage_count < c.usage_limit)
       GROUP BY c.id, c.code, c.type, c.value, c.min_purchase,
                c.max_discount, c.usage_limit, c.usage_count,
                c.expires_at, c.is_active, c.description, c.created_at
       ORDER BY c.created_at DESC`,
      [userId]
    );

    /* Mark which coupons user has already used */
    const now = new Date();
    const coupons = rows.map((c) => {
      const expiresAt  = c.expires_at ? new Date(c.expires_at) : null;
      const isExpired  = expiresAt ? expiresAt < now : false;
      const isUsed     = c.user_usage_count > 0;
      const isFull     = c.usage_limit ? c.usage_count >= c.usage_limit : false;
      const daysLeft   = expiresAt
        ? Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
        : null;

      return {
        ...c,
        value        : Number(c.value       || 0),
        min_purchase : Number(c.min_purchase || 0),
        max_discount : c.max_discount ? Number(c.max_discount) : null,
        usage_count  : Number(c.usage_count  || 0),
        usage_limit  : c.usage_limit ? Number(c.usage_limit) : null,
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
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/coupons/validate
   Validate a coupon code + calculate discount
═══════════════════════════════════════════════════════════════ */
router.post("/validate", authenticate, async (req, res) => {
  const { code, order_amount = 0 } = req.body;
  const userId = req.user.id;

  if (!code?.trim()) {
    return res.status(400).json({ success: false, message: "Coupon code required" });
  }

  try {
    /* Find coupon */
    const { rows } = await pool.query(
      `SELECT * FROM public.coupons
       WHERE UPPER(code) = UPPER($1) AND is_active = true
       LIMIT 1`,
      [code.trim()]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Invalid coupon code" });
    }

    const c   = rows[0];
    const now = new Date();

    /* Check expiry */
    if (c.expires_at && new Date(c.expires_at) < now) {
      return res.status(400).json({ success: false, message: "This coupon has expired" });
    }

    /* Check usage limit */
    if (c.usage_limit && c.usage_count >= c.usage_limit) {
      return res.status(400).json({ success: false, message: "This coupon has reached its usage limit" });
    }

    /* Check if user already used this coupon */
    const { rows: used } = await pool.query(
      `SELECT id FROM public.coupon_redemptions
       WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
      [c.id, userId]
    );

    if (used.length) {
      return res.status(400).json({ success: false, message: "You have already used this coupon" });
    }

    /* Check minimum purchase */
    const amount = Number(order_amount);
    if (c.min_purchase && amount < Number(c.min_purchase)) {
      return res.status(400).json({
        success : false,
        message : `Minimum order of ₦${Number(c.min_purchase).toLocaleString("en-NG")} required`,
      });
    }

    /* Calculate discount */
    let discount = 0;

    if (c.type === "percentage") {
      discount = (amount * Number(c.value)) / 100;
      if (c.max_discount) {
        discount = Math.min(discount, Number(c.max_discount));
      }
    } else if (c.type === "fixed") {
      discount = Math.min(Number(c.value), amount);
    } else if (c.type === "free_shipping") {
      discount = 0; // applied at checkout level
    }

    discount = Math.round(discount);

    return res.json({
      success  : true,
      valid    : true,
      coupon   : {
        id          : c.id,
        code        : c.code,
        type        : c.type,
        value       : Number(c.value),
        description : c.description,
      },
      discount,
      final_amount : Math.max(0, amount - discount),
      message      : `Coupon applied! You save ₦${discount.toLocaleString("en-NG")}`,
    });

  } catch (err) {
    console.error("[coupons] POST /validate:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/coupons/redeem
   Mark coupon as used after order is placed
═══════════════════════════════════════════════════════════════ */
router.post("/redeem", authenticate, async (req, res) => {
  const { code, order_id, discount } = req.body;
  const userId = req.user.id;

  if (!code?.trim()) {
    return res.status(400).json({ success: false, message: "Coupon code required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id FROM public.coupons WHERE UPPER(code) = UPPER($1) AND is_active = true LIMIT 1`,
      [code.trim()]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    const couponId = rows[0].id;

    /* Insert redemption */
    await pool.query(
      `INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [couponId, userId, order_id || null, Number(discount || 0)]
    );

    /* Increment usage count */
    await pool.query(
      `UPDATE public.coupons SET usage_count = usage_count + 1 WHERE id = $1`,
      [couponId]
    );

    return res.json({ success: true, message: "Coupon redeemed" });

  } catch (err) {
    console.error("[coupons] POST /redeem:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons/history
   User's coupon redemption history
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
       LIMIT 20`,
      [userId]
    );

    return res.json({
      success  : true,
      history  : rows.map((r) => ({
        ...r,
        discount : Number(r.discount || 0),
        value    : Number(r.value    || 0),
      })),
    });

  } catch (err) {
    console.error("[coupons] GET /history:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;