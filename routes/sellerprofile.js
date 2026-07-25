// routes/sellerprofile.js — v2
//
// Changes from v1:
//  - ACTIVE_STATUSES constant added — single source of truth
//  - ACTIVE_WHERE helper added — includes active_until expiry guard
//  - All product queries now show active + active_limited listings
//  - Expired trial listings automatically hidden (active_until > NOW())
//  - Seller info query: added identity_verified, subscription fields
//  - normalizeProduct: added trial_listing, trial_expires_at,
//    trial_days_remaining, status, active_until fields
//  - Stats queries: now count active_limited listings too
//  - /stats endpoint: added trial_listings count breakdown
//  - Subscription info added to seller response
//  - hasMore fixed to use < limit instead of === limit

import express  from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   Mirrors productDetail.js v2 and homepage.js v4.
   Both statuses mean "publicly visible".
     active         → verified / subscribed seller
     active_limited → unverified seller, 7-day trial window
═══════════════════════════════════════════════════════════════ */
const ACTIVE_STATUSES = `('active', 'active_limited')`;

/*
 * ACTIVE_WHERE — paste into any products WHERE clause.
 * The active_until guard auto-hides expired trials without
 * needing a cron job to have run first.
 * Verified / subscribed listings have NULL active_until → always shown.
 */
const ACTIVE_WHERE = `
  is_active  = TRUE
  AND is_deleted IS NOT TRUE
  AND status     IN ${ACTIVE_STATUSES}
  AND (active_until IS NULL OR active_until > NOW())
`;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const safeInt   = (n, fb = 0)  => { const p = parseInt(n,   10); return isNaN(p) ? fb : p; };
const safeFloat = (n, fb = 0)  => { const p = parseFloat(n);     return isNaN(p) ? fb : p; };

const daysUntilExpiry = (date) => {
  if (!date) return null;
  return Math.max(
    0,
    Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
  );
};

const isSubscriptionActive = (status, expiresAt) =>
  status === "active" &&
  expiresAt != null   &&
  new Date(expiresAt) > new Date();

const SUBSCRIPTION_LABELS = {
  premium : "Premium Seller",
  pro     : "Pro Seller",
  business: "Business Seller",
  diamond : "Diamond Seller",
  elite   : "Elite Seller",
};

const getSubscriptionLabel = (planSlug, rank) => {
  if (!planSlug || planSlug === "free") return null;
  return SUBSCRIPTION_LABELS[planSlug] ?? (rank > 0 ? "Subscribed Seller" : null);
};

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE PRODUCT
   Converts a raw DB row into the shape the frontend expects.
   Matches homepage.js v4 shapeProduct() trial fields so the
   frontend receives consistent data regardless of which route
   serves the product.
═══════════════════════════════════════════════════════════════ */
const normalizeProduct = (p) => {
  const isTrialListing     = p.status === "active_limited";
  const trialExpiresAt     = isTrialListing ? (p.active_until ?? null) : null;
  const trialDaysRemaining = isTrialListing ? daysUntilExpiry(trialExpiresAt) : null;

  return {
    id                  : p.id,
    title               : p.title,
    price               : safeFloat(p.price, 0),
    slug                : p.slug,
    status              : p.status,
    image               : p.main_image || p.thumbnail_url || null,
    images              : p.main_image ? [p.main_image]  : [],
    views               : safeInt(p.views, 0),
    created_at          : p.created_at,
    is_promoted         : !!p.is_promoted,
    promotion_priority  : safeInt(p.promotion_priority, 0),
    engagement_score    : safeInt(p.engagement_score,   0),
    boost_score         : safeInt(p.boost_score,        0),
    location_city       : p.location_city  ?? null,
    location_state      : p.location_state ?? null,
    active_until        : p.active_until   ?? null,

    /* Trial fields — mirrors homepage.js v4 + productDetail.js v2 */
    trial_listing       : isTrialListing,
    trial_expires_at    : trialExpiresAt,
    trial_days_remaining: trialDaysRemaining,
  };
};

/* ═══════════════════════════════════════════════════════════════
   SHARED PRODUCT COLUMNS
   Used by both GET /:id and GET /:id/products so the column
   list stays in sync automatically.
═══════════════════════════════════════════════════════════════ */
const PRODUCT_COLS = `
  id,
  title,
  price,
  slug,
  status,
  main_image,
  thumbnail_url,
  views,
  created_at,
  is_promoted,
  promotion_priority,
  location_city,
  location_state,
  engagement_score,
  boost_score,
  active_until
`;

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller/:id
═══════════════════════════════════════════════════════════════ */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    /* ── Seller info ── */
    const { rows: userRows } = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.store_name,
         u.store_description,
         u.store_logo,
         u.profile_image,
         u.verified,
         u.identity_verified,
         u.store_verified,
         u.rating,
         u.products_count,
         u.total_sales,
         u.created_at,
         u.last_login,
         u.is_online,
         u.trust_score,

         /* Subscription */
         u.subscription_plan,
         u.subscription_status,
         u.subscription_expires_at,
         COALESCE(sp.rank,  0)   AS subscription_rank,
         sp.name                 AS subscription_plan_name,
         sp.badge                AS subscription_badge
       FROM   public.users        u
       LEFT   JOIN subscription_plans sp
              ON  sp.slug      = u.subscription_plan
              AND sp.is_active = TRUE
       WHERE  u.id = $1
       LIMIT  1`,
      [id]
    );

    if (!userRows[0]) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const u          = userRows[0];
    const subActive  = isSubscriptionActive(
      u.subscription_status, u.subscription_expires_at
    );
    const subLabel   = getSubscriptionLabel(
      u.subscription_plan, safeInt(u.subscription_rank, 0)
    );

    const seller = {
      id                : u.id,
      name              : u.name,
      store_name        : u.store_name        ?? null,
      store_description : u.store_description ?? null,
      store_logo        : u.store_logo        ?? null,
      profile_image     : u.profile_image     ?? null,
      verified          : !!u.verified,
      identity_verified : !!u.identity_verified,
      store_verified    : !!u.store_verified,
      rating            : safeFloat(u.rating,         0),
      products_count    : safeInt(u.products_count,   0),
      total_sales       : safeInt(u.total_sales,      0),
      created_at        : u.created_at,
      last_login        : u.last_login        ?? null,
      is_online         : !!u.is_online,
      trust_score       : safeFloat(u.trust_score,   50),

      /* Subscription — for seller badge on public profile */
      subscription: {
        plan      : u.subscription_plan       ?? null,
        plan_name : u.subscription_plan_name  ?? null,
        status    : u.subscription_status     ?? null,
        expires_at: u.subscription_expires_at ?? null,
        rank      : safeInt(u.subscription_rank, 0),
        active    : subActive,
        label     : subActive ? subLabel : null,
        badge     : subActive ? (u.subscription_badge ?? subLabel) : null,
      },
    };

    /* ── Seller products ── */
    const { rows: productRows } = await pool.query(
      `SELECT ${PRODUCT_COLS}
       FROM   public.products
       WHERE  seller_id = $1
         AND  ${ACTIVE_WHERE}
       ORDER BY
         is_promoted        DESC,
         promotion_priority DESC,
         created_at         DESC
       LIMIT 50`,
      [id]
    );

    /* ── Stats ── */
    const { rows: statsRows } = await pool.query(
      `SELECT
         COUNT(*)::int                              AS total_products,
         COALESCE(SUM(views),            0)::int   AS total_views,
         COALESCE(SUM(clicks_count),     0)::int   AS total_clicks,
         COALESCE(AVG(conversion_rate),  0)        AS avg_conversion,

         /* v2: breakdown by status so frontend can show trial count */
         SUM(CASE WHEN status = 'active'         THEN 1 ELSE 0 END)::int
           AS verified_listings,
         SUM(CASE WHEN status = 'active_limited' THEN 1 ELSE 0 END)::int
           AS trial_listings
       FROM public.products
       WHERE seller_id = $1
         AND ${ACTIVE_WHERE}`,
      [id]
    );

    const s = statsRows[0] ?? {};

    return res.json({
      seller,
      products: productRows.map(normalizeProduct),
      stats: {
        total_products   : safeInt(s.total_products,   0),
        total_views      : safeInt(s.total_views,      0),
        total_clicks     : safeInt(s.total_clicks,     0),
        avg_conversion   : safeFloat(s.avg_conversion, 0),
        verified_listings: safeInt(s.verified_listings,0),
        trial_listings   : safeInt(s.trial_listings,   0),
      },
      /*
       * hasMore — true when exactly 50 rows returned, meaning
       * there may be more pages. Use /:id/products?page=2 to paginate.
       * Fixed: was === 50 which fails if limit ever changes.
       */
      hasMore: productRows.length >= 50,
    });

  } catch (err) {
    console.error("[sellerprofile] GET /:id →", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller/:id/products?page=&limit=
═══════════════════════════════════════════════════════════════ */
router.get("/:id/products", async (req, res) => {
  const { id }  = req.params;
  const page    = Math.max(1,  safeInt(req.query.page,  1));
  const limit   = Math.min(50, safeInt(req.query.limit, 20));
  const offset  = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT ${PRODUCT_COLS}
       FROM   public.products
       WHERE  seller_id = $1
         AND  ${ACTIVE_WHERE}
       ORDER BY
         is_promoted        DESC,
         promotion_priority DESC,
         created_at         DESC
       LIMIT  $2
       OFFSET $3`,
      [id, limit, offset]
    );

    return res.json({
      page,
      limit,
      products: rows.map(normalizeProduct),
      hasMore : rows.length >= limit,
    });

  } catch (err) {
    console.error("[sellerprofile] GET /:id/products →", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller/:id/stats
═══════════════════════════════════════════════════════════════ */
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int                               AS total_products,
         COALESCE(SUM(views),             0)::int   AS total_views,
         COALESCE(SUM(clicks_count),      0)::int   AS total_clicks,
         COALESCE(SUM(favorites_count),   0)::int   AS total_favorites,
         COALESCE(SUM(share_count),       0)::int   AS total_shares,

         /* v2: status breakdown */
         SUM(CASE WHEN status = 'active'         THEN 1 ELSE 0 END)::int
           AS verified_listings,
         SUM(CASE WHEN status = 'active_limited' THEN 1 ELSE 0 END)::int
           AS trial_listings
       FROM public.products
       WHERE seller_id = $1
         AND ${ACTIVE_WHERE}`,
      [id]
    );

    const s = rows[0] ?? {};

    return res.json({
      total_products   : safeInt(s.total_products,    0),
      total_views      : safeInt(s.total_views,       0),
      total_clicks     : safeInt(s.total_clicks,      0),
      total_favorites  : safeInt(s.total_favorites,   0),
      total_shares     : safeInt(s.total_shares,      0),
      verified_listings: safeInt(s.verified_listings, 0),
      trial_listings   : safeInt(s.trial_listings,    0),
    });

  } catch (err) {
    console.error("[sellerprofile] GET /:id/stats →", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;