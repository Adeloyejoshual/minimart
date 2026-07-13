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

  /* ── Safe column migrations ── */
  const couponMigrations = [
    `ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS is_private  BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS created_by  UUID    NULL`,
    `ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS description TEXT    NULL`,
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
      id                    UUID        NOT NULL DEFAULT gen_random_uuid(),
      coupon_id             UUID        NOT NULL,
      user_id               UUID        NULL,
      order_id              UUID        NULL,
      discount              DECIMAL     NOT NULL DEFAULT 0,
      redeemed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      redeemed_by_admin      UUID        NULL,
      redeemed_by_admin_name TEXT        NULL,
      reward_type           TEXT        NULL,
      reward_value          DECIMAL     NULL,
      reward_description    TEXT        NULL,
      admin_note            TEXT        NULL,
      verified_user_id      UUID        NULL,
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
}

ensureTables().catch((err) =>
  console.warn("[coupons] table init:", err.message)
);

/* ═══════════════════════════════════════════════════════════════
   GET /api/coupons

   Returns coupons visible to this user:

   RULE 1 — Active public coupons
     is_active = true AND is_private = false
     → everyone sees these

   RULE 2 — Active private coupons the user owns
     is_active = true AND is_private = true AND created_by = userId
     → only the winner sees their spin coupon

   RULE 3 — Coupons this user has already redeemed
     Even if is_active = false (deactivated after admin redemption)
     we still show them in the Used tab so the user can see history.
     We identify these via coupon_redemptions WHERE user_id = userId.

   Without Rule 3, admin-redeemed coupons disappear from the
   user's coupon page entirely because is_active = false.
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
         c.is_private,
         c.is_active,
         c.created_at,
         COUNT(r.id) FILTER (WHERE r.user_id = $1)::int AS user_usage_count
       FROM public.coupons c
       LEFT JOIN public.coupon_redemptions r ON r.coupon_id = c.id
       WHERE
         /* Rule 1: active public coupons */
         (c.is_active = true AND c.is_private = false)

         /* Rule 2: active private coupons owned by this user */
         OR (c.is_active = true AND c.is_private = true AND c.created_by = $1)

         /* Rule 3: any coupon this user has redeemed
            even if is_active = false (admin redeemed it) */
         OR (
           EXISTS (
             SELECT 1 FROM public.coupon_redemptions rx
             WHERE rx.coupon_id = c.id
               AND rx.user_id   = $1
           )
         )

       GROUP BY
         c.id, c.code, c.type, c.value, c.min_purchase,
         c.max_discount, c.usage_limit, c.usage_count,
         c.expires_at, c.description, c.is_private, c.is_active, c.created_at
       ORDER BY
         /* Usable coupons first */
         CASE
           WHEN c.is_active = true
            AND (c.expires_at IS NULL OR c.expires_at > NOW())
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

      /*
       * isUsed:
       * true if this user has a redemption record for this coupon.
       * This covers BOTH:
       *   - user redeemed themselves (via /api/coupons/redeem)
       *   - admin redeemed on their behalf (is_active flipped to false)
       */
      const isUsed = c.user_usage_count > 0;

      /*
       * isFull:
       * true if the global usage limit has been reached.
       * For single-use spin coupons this will be true after admin redeems.
       */
      const isFull = c.usage_limit
        ? Number(c.usage_count) >= Number(c.usage_limit)
        : false;

      /*
       * isDeactivated:
       * Coupon was explicitly turned off (e.g. admin redeemed a spin coupon).
       * Treat the same as "used" for display purposes.
       */
      const isDeactivated = !c.is_active;

      const daysLeft = expiresAt
        ? Math.max(0, Math.ceil((expiresAt - now) / 86_400_000))
        : null;

      /*
       * usable:
       * Can this user still use this coupon?
       * No if: expired / already used by them / limit full / deactivated
       */
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
        is_used      : isUsed || isDeactivated,  // treat deactivated = used
        is_full      : isFull,
        days_left    : daysLeft,
        usable,
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
        message: `A minimum order of ₦${Number(c.min_purchase).toLocaleString("en-NG")} is required for this coupon.`,
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

    const isSingleUse = coupon.usage_limit !== null && Number(coupon.usage_limit) === 1;

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
    );

    return res.json({
      success : true,
      history : rows.map((r) => ({
        ...r,
        discount             : Number(r.discount || 0),
        value                : Number(r.value    || 0),
        redeemed_by_admin    : !!r.redeemed_by_admin_name,
        redeemed_by_admin_name: r.redeemed_by_admin_name || null,
      })),
    });

  } catch (err) {
    console.error("[coupons] GET /history:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

export default router;