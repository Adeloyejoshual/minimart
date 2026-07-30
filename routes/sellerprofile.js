// routes/sellerprofile.js — v3
//
// Changes from v2:
//  - NEW: All :id params accept EITHER a UUID or a username
//         /api/seller/abc-uuid           → looks up by users.id
//         /api/seller/loemart            → looks up by users.username
//  - NEW: resolveSellerId() helper — one DB round-trip to detect
//         UUID vs username and return the canonical UUID
//  - Case-insensitive username matching
//  - 301 redirect suggestion: frontend can call /:id and, if a
//    username was passed, use canonical_id in the response
//  - Consistent 404 shape for both lookups

import express  from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const ACTIVE_STATUSES = `('active', 'active_limited')`;

const ACTIVE_WHERE = `
  is_active  = TRUE
  AND is_deleted IS NOT TRUE
  AND status     IN ${ACTIVE_STATUSES}
  AND (active_until IS NULL OR active_until > NOW())
`;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const safeInt   = (n, fb = 0) => { const p = parseInt(n, 10); return isNaN(p) ? fb : p; };
const safeFloat = (n, fb = 0) => { const p = parseFloat(n);   return isNaN(p) ? fb : p; };

/* ✅ UUID v4 detector */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUUID = (v) => typeof v === "string" && UUID_RE.test(v);

/* ✅ Username format — matches editProfile.js validation */
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const isValidUsername = (v) =>
  typeof v === "string" && USERNAME_RE.test(v.toLowerCase());

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
   ✅ RESOLVE SELLER ID
   Accepts either a UUID or a username and returns the canonical
   users.id (UUID). Returns null if not found or invalid.
═══════════════════════════════════════════════════════════════ */
async function resolveSellerId(param) {
  if (!param || typeof param !== "string") return null;

  const trimmed = param.trim();
  if (!trimmed) return null;

  /* Case 1: UUID — verify it exists */
  if (isUUID(trimmed)) {
    const { rows } = await pool.query(
      `SELECT id FROM public.users WHERE id = $1 LIMIT 1`,
      [trimmed]
    );
    return rows[0]?.id ?? null;
  }

  /* Case 2: Username — look up (case-insensitive) */
  if (isValidUsername(trimmed)) {
    const { rows } = await pool.query(
      `SELECT id
       FROM   public.users
       WHERE  LOWER(username) = LOWER($1)
       LIMIT  1`,
      [trimmed]
    );
    return rows[0]?.id ?? null;
  }

  /* Neither UUID nor valid username format */
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE PRODUCT
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
    images              : p.main_image ? [p.main_image] : [],
    views               : safeInt(p.views, 0),
    created_at          : p.created_at,
    is_promoted         : !!p.is_promoted,
    promotion_priority  : safeInt(p.promotion_priority, 0),
    engagement_score    : safeInt(p.engagement_score,   0),
    boost_score         : safeInt(p.boost_score,        0),
    location_city       : p.location_city  ?? null,
    location_state      : p.location_state ?? null,
    active_until        : p.active_until   ?? null,

    trial_listing       : isTrialListing,
    trial_expires_at    : trialExpiresAt,
    trial_days_remaining: trialDaysRemaining,
  };
};

/* ═══════════════════════════════════════════════════════════════
   SHARED PRODUCT COLUMNS
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
   :id can be UUID or username
═══════════════════════════════════════════════════════════════ */
router.get("/:id", async (req, res) => {
  const { id: rawParam } = req.params;

  try {
    /* ✅ Resolve UUID or username → canonical UUID */
    const sellerId = await resolveSellerId(rawParam);

    if (!sellerId) {
      return res.status(404).json({
        error: "Seller not found",
        detail: `No seller with id or username "${rawParam}"`,
      });
    }

    /* ── Seller info ── */
    const { rows: userRows } = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.username,
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
      [sellerId]
    );

    if (!userRows[0]) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const u          = userRows[0];
    const subActive  = isSubscriptionActive(u.subscription_status, u.subscription_expires_at);
    const subLabel   = getSubscriptionLabel(u.subscription_plan, safeInt(u.subscription_rank, 0));

    const seller = {
      id                : u.id,
      username          : u.username          ?? null,   /* ✅ canonical username */
      name              : u.name,
      store_name        : u.store_name        ?? null,
      store_description : u.store_description ?? null,
      store_logo        : u.store_logo        ?? null,
      profile_image     : u.profile_image     ?? null,
      verified          : !!u.verified,
      identity_verified : !!u.identity_verified,
      store_verified    : !!u.store_verified,
      rating            : safeFloat(u.rating,       0),
      products_count    : safeInt(u.products_count, 0),
      total_sales       : safeInt(u.total_sales,    0),
      created_at        : u.created_at,
      last_login        : u.last_login        ?? null,
      is_online         : !!u.is_online,
      trust_score       : safeFloat(u.trust_score, 50),

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
      [sellerId]
    );

    /* ── Stats ── */
    const { rows: statsRows } = await pool.query(
      `SELECT
         COUNT(*)::int                              AS total_products,
         COALESCE(SUM(views),            0)::int   AS total_views,
         COALESCE(SUM(clicks_count),     0)::int   AS total_clicks,
         COALESCE(AVG(conversion_rate),  0)        AS avg_conversion,
         SUM(CASE WHEN status = 'active'         THEN 1 ELSE 0 END)::int
           AS verified_listings,
         SUM(CASE WHEN status = 'active_limited' THEN 1 ELSE 0 END)::int
           AS trial_listings
       FROM public.products
       WHERE seller_id = $1
         AND ${ACTIVE_WHERE}`,
      [sellerId]
    );

    const s = statsRows[0] ?? {};

    return res.json({
      seller,
      products: productRows.map(normalizeProduct),
      stats: {
        total_products   : safeInt(s.total_products,    0),
        total_views      : safeInt(s.total_views,       0),
        total_clicks     : safeInt(s.total_clicks,      0),
        avg_conversion   : safeFloat(s.avg_conversion,  0),
        verified_listings: safeInt(s.verified_listings, 0),
        trial_listings   : safeInt(s.trial_listings,    0),
      },
      hasMore: productRows.length >= 50,

      /* ✅ Tell frontend which param type was used — enables
         canonical URL redirect if desired */
      resolved_by: isUUID(rawParam) ? "id" : "username",
      canonical_id      : u.id,
      canonical_username: u.username ?? null,
    });

  } catch (err) {
    console.error("[sellerprofile] GET /:id →", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller/:id/products
═══════════════════════════════════════════════════════════════ */
router.get("/:id/products", async (req, res) => {
  const { id: rawParam } = req.params;
  const page   = Math.max(1,  safeInt(req.query.page,  1));
  const limit  = Math.min(50, safeInt(req.query.limit, 20));
  const offset = (page - 1) * limit;

  try {
    const sellerId = await resolveSellerId(rawParam);
    if (!sellerId) {
      return res.status(404).json({
        error: "Seller not found",
        detail: `No seller with id or username "${rawParam}"`,
      });
    }

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
      [sellerId, limit, offset]
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
  const { id: rawParam } = req.params;

  try {
    const sellerId = await resolveSellerId(rawParam);
    if (!sellerId) {
      return res.status(404).json({
        error: "Seller not found",
        detail: `No seller with id or username "${rawParam}"`,
      });
    }

    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int                               AS total_products,
         COALESCE(SUM(views),             0)::int   AS total_views,
         COALESCE(SUM(clicks_count),      0)::int   AS total_clicks,
         COALESCE(SUM(favorites_count),   0)::int   AS total_favorites,
         COALESCE(SUM(share_count),       0)::int   AS total_shares,
         SUM(CASE WHEN status = 'active'         THEN 1 ELSE 0 END)::int
           AS verified_listings,
         SUM(CASE WHEN status = 'active_limited' THEN 1 ELSE 0 END)::int
           AS trial_listings
       FROM public.products
       WHERE seller_id = $1
         AND ${ACTIVE_WHERE}`,
      [sellerId]
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