/**
 * routes/homepage.js — v5
 *
 * Feed ranking (top → bottom):
 *  1. is_promoted DESC          — paid per-product promotion
 *  2. promotion_priority DESC   — Elite=4 > Premium=3 > Basic=2 > Starter=1
 *  3. search_priority DESC      — subscription rank
 *                                 elite=10, diamond=5, business=3,
 *                                 pro=2, premium=1, free=0
 *  4. engagement_score DESC     — organic tiebreaker
 *  5. created_at DESC           — newest tiebreaker
 *
 * v5 changes:
 *  - Optional auth (softAuth) — never blocks anonymous requests
 *  - meta.unread_notifications returned when a user is logged in
 *  - Frontend uses this directly for bell badge (no 2nd request)
 *  - Cache stays user-agnostic; notification count added per-request
 *
 * v4 legacy (unchanged):
 *  - active_limited products are visible on homepage
 *  - active_until expiry guard hides expired trials automatically
 *  - Trial listing flags on each product for optional UI badges
 */

import express from "express";
import { pool } from "../config/db.js";
import { cacheGet, cacheSet, cacheDel, cacheStats } from "../lib/redis.js";
import { softAuth } from "../middleware/auth.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   CACHE TTL (seconds)
══════════════════════════════════════════════════════════════ */
const CACHE_TTL = {
  all     : 60,
  deals   : 120,
  trending: 90,
  latest  : 30,
  nearby  : 0,   // never cache GPS
};

/* ══════════════════════════════════════════════════════════════
   CACHE KEY  (excludes user-specific data)
══════════════════════════════════════════════════════════════ */
function buildCacheKey(params) {
  const {
    section = "all", page = 0, limit = 40,
    category_id, max_price, min_price,
    sort, state, city, lat, lng,
  } = params;

  // GPS = personal data → never cache
  if (lat && lng) return null;

  return [
    "hp",
    section,
    `p${page}`,
    `l${limit}`,
    category_id ? `c${String(category_id).slice(0, 8)}`                 : "",
    max_price   ? `mx${max_price}`                                       : "",
    min_price   ? `mn${min_price}`                                       : "",
    sort        ? `s${sort}`                                             : "",
    state       ? `st${String(state).toLowerCase().replace(/\s/g, "_")}`: "",
    city        ? `cy${String(city).toLowerCase().replace(/\s/g, "_")}` : "",
  ].filter(Boolean).join(":");
}

/* ══════════════════════════════════════════════════════════════
   PROMOTION BADGE HELPER
══════════════════════════════════════════════════════════════ */
function getPromotionBadge(isPromoted, promotionType) {
  if (!isPromoted) return null;
  const pt = String(promotionType ?? "").toLowerCase();
  if (pt === "elite")   return "featured";  // ⭐ Elite badge
  if (pt === "premium") return "premium";   // 🔝 Premium badge
  return "promoted";                         // 📢 Starter / Basic
}

/* ══════════════════════════════════════════════════════════════
   HAVERSINE  (JS fallback for distance display)
══════════════════════════════════════════════════════════════ */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return (
    Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
  );
}

/* ══════════════════════════════════════════════════════════════
   GET UNREAD NOTIFICATION COUNT  (safe helper)
   Returns 0 if user is not logged in or query fails.
══════════════════════════════════════════════════════════════ */
async function getUnreadCount(userId) {
  if (!userId) return 0;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::INT AS count
       FROM   public.notifications
       WHERE  user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return rows[0]?.count ?? 0;
  } catch (err) {
    console.warn("[homepage] unread-count fetch failed:", err.message);
    return 0;
  }
}

/* ══════════════════════════════════════════════════════════════
   SHAPE ONE PRODUCT ROW
   v4: adds trial_listing + trial_expires_at fields
══════════════════════════════════════════════════════════════ */
function shapeProduct(p, lat, lng) {
  /* ── Primary image ── */
  let image = p.main_image || p.thumbnail_url || null;
  if (!image && Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    image = typeof first === "string" ? first : first?.url || null;
  }

  /* ── Images array ── */
  let imagesArr = [];
  if (Array.isArray(p.images) && p.images.length > 0) {
    imagesArr = p.images
      .map((img) => (typeof img === "string" ? img : img?.url || null))
      .filter(Boolean);
  } else if (image) {
    imagesArr = [image];
  }

  /* ── Distance ── */
  let distance_km = null;
  if (lat && lng && p.latitude != null && p.longitude != null) {
    distance_km = haversineKm(
      Number(lat), Number(lng),
      Number(p.latitude), Number(p.longitude)
    );
  }

  /* ── CTR ── */
  const impressions = Number(p.impression_count || 0);
  const clicks      = Number(p.clicks_count     || 0);
  const vw          = Number(p.views            || 0);
  const ctr = impressions > 0
    ? clicks / impressions
    : vw > 0 ? clicks / vw : 0;

  /* ── Discount ── */
  const origPrice = Number(p.attributes?.original_price || 0);
  const currPrice = Number(p.price || 0);
  const discountPct =
    origPrice > currPrice && currPrice > 0
      ? Math.round(((origPrice - currPrice) / origPrice) * 100)
      : 0;

  /* ── Trial listing flags (v4) ── */
  const isTrialListing = p.status === "active_limited";
  const trialExpiresAt = isTrialListing ? (p.active_until || null) : null;

  let trialDaysRemaining = null;
  if (isTrialListing && trialExpiresAt) {
    trialDaysRemaining = Math.max(
      0,
      Math.ceil(
        (new Date(trialExpiresAt).getTime() - Date.now()) / 86_400_000
      )
    );
  }

  return {
    id                  : p.id,
    title               : p.title,
    description         : p.description,
    price               : currPrice,
    slug                : p.slug,
    status              : p.status,
    image,
    images              : imagesArr,
    video_url           : p.video_url   || null,
    attributes          : p.attributes  || {},
    brand               : p.brand       || null,
    model               : p.model       || null,
    condition           : p.condition   || null,
    negotiable          : !!p.negotiable,
    views               : vw,
    clicks_count        : clicks,
    impression_count    : impressions,
    engagement_score    : Number(p.engagement_score    || 0),
    search_priority     : Number(p.search_priority     || 0),
    promotion_priority  : Number(p.promotion_priority  || 0),
    promotion_type      : p.promotion_type              || null,
    promotion_expires_at: p.promotion_expires_at        || null,
    promotion_badge     : getPromotionBadge(p.is_promoted, p.promotion_type),
    is_promoted         : !!p.is_promoted,
    is_featured         : !!p.is_featured,
    boost_score         : Number(p.boost_score         || 0),
    quality_score       : Number(p.quality_score       || 0),
    conversion_rate     : Number(p.conversion_rate     || 0),
    favorites_count     : Number(p.favorites_count     || 0),
    share_count         : Number(p.share_count         || 0),
    average_rating      : Number(p.average_rating      || 0),
    reviews_count       : Number(p.reviews_count       || 0),
    offer_type          : p.offer_type  || null,
    swap_for            : p.swap_for    || null,
    is_p2p              : !!p.is_p2p,
    delivery            : p.delivery    || null,
    contact             : p.contact     || null,
    whatsapp            : p.whatsapp    || null,
    phone               : p.phone       || null,
    created_at          : p.created_at,
    category_id         : p.category_id    || null,
    subcategory_id      : p.subcategory_id || null,
    stock_quantity      : p.stock_quantity ?? null,
    stock_status        : p.stock_status   || null,
    active_until        : p.active_until   || null,
    ctr,
    discount_pct        : discountPct,
    distance_km,
    location_city       : p.location_city  || null,
    location_state      : p.location_state || null,
    location: {
      city : p.location_city  || null,
      state: p.location_state || null,
      label:
        [p.location_city, p.location_state].filter(Boolean).join(", ") || null,
    },

    /* ── Trial fields (v4) ── */
    trial_listing       : isTrialListing,
    trial_expires_at    : trialExpiresAt,
    trial_days_remaining: trialDaysRemaining,

    seller: {
      id              : p.seller_id   || null,
      name            : p.seller_name || null,
      verified        : !!p.seller_verified,
      subscriptionPlan: p.seller_subscription_plan || null,
      subscriptionRank: Number(p.seller_subscription_rank || 0),
    },
  };
}

/* ══════════════════════════════════════════════════════════════
   GET /api/homepage
   Optional auth via softAuth — never blocks anonymous requests
══════════════════════════════════════════════════════════════ */
router.get("/", softAuth, async (req, res) => {
  const {
    page        = 0,
    limit       = 40,
    lat,
    lng,
    category_id,
    section,
    state,
    city,
    sort,
    max_price,
    min_price,
  } = req.query;

  const userId = req.user?.id ?? null;

  /* ══════════════════════════════════════════════════════════
     CACHE LOOKUP
     Cache holds products/featured (shared data).
     Notification count is per-user and always fetched fresh.
  ══════════════════════════════════════════════════════════ */
  const cacheKey = buildCacheKey(req.query);

  if (cacheKey) {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.set("X-Cache", "HIT");
      res.set("X-Cache-Key", cacheKey);

      /* Fetch fresh unread count for this user */
      const unread = await getUnreadCount(userId);

      return res.json({
        ...cached,
        meta: {
          ...cached.meta,
          unread_notifications: unread,
          authenticated       : !!userId,
        },
      });
    }
  }
  res.set("X-Cache", "MISS");

  try {
    const realLimit = Math.min(Number(limit) || 40, 80);
    const offset    = Number(page) * realLimit;
    const values    = [];
    const push      = (v) => { values.push(v); return `$${values.length}`; };

    /* ══════════════════════════════════════════════════════════
       BASE WHERE — v4
       - Include trial listings (active_limited)
       - Hide expired trials automatically (active_until guard)
    ══════════════════════════════════════════════════════════ */
    const where = [
      `p.is_active = TRUE`,
      `p.status IN ('active', 'active_limited')`,
      `p.status <> 'deleted'`,
      `(p.active_until IS NULL OR p.active_until > NOW())`,
      `(p.promotion_expires_at IS NULL OR p.promotion_expires_at > NOW())`,
    ];

    /* ── Filters ── */
    if (category_id) where.push(`p.category_id = ${push(category_id)}`);
    if (state)       where.push(`LOWER(p.location_state) = LOWER(${push(state)})`);
    if (city)        where.push(`LOWER(p.location_city)  = LOWER(${push(city)})`);
    if (max_price)   where.push(`p.price <= ${push(Number(max_price))}`);
    if (min_price)   where.push(`p.price >= ${push(Number(min_price))}`);

    /* ── GPS bounding box (uses index) ── */
    let latN = null, lngN = null;
    if (lat && lng) {
      latN = Number(lat);
      lngN = Number(lng);
      if (Number.isFinite(latN) && Number.isFinite(lngN)) {
        const latP = push(latN);
        const lngP = push(lngN);
        where.push(`p.latitude  IS NOT NULL`);
        where.push(`p.longitude IS NOT NULL`);
        where.push(`p.latitude  BETWEEN ${latP} - 0.45 AND ${latP} + 0.45`);
        where.push(`p.longitude BETWEEN ${lngP} - 0.45 AND ${lngP} + 0.45`);
      }
    }

    /* ══════════════════════════════════════════════════════════
       ORDER BY — full ranking stack
    ══════════════════════════════════════════════════════════ */
    const BASE_ORDER = `
      p.is_promoted        DESC,
      p.promotion_priority DESC,
      p.search_priority    DESC,
      p.engagement_score   DESC,
      p.created_at         DESC
    `;

    let orderBy       = BASE_ORDER;
    let sectionFilter = "";

    switch (section) {
      case "trending":
        sectionFilter = `AND (p.engagement_score > 0 OR p.clicks_count > 0)`;
        orderBy = `
          p.is_promoted        DESC,
          p.promotion_priority DESC,
          p.search_priority    DESC,
          p.engagement_score   DESC,
          p.clicks_count       DESC,
          p.created_at         DESC
        `;
        break;

      case "deals":
        sectionFilter = `AND p.price > 0 AND p.price <= 50000`;
        orderBy = `
          p.is_promoted        DESC,
          p.promotion_priority DESC,
          p.price              ASC,
          p.engagement_score   DESC
        `;
        break;

      case "latest":
        orderBy = `
          p.is_promoted        DESC,
          p.promotion_priority DESC,
          p.search_priority    DESC,
          p.created_at         DESC
        `;
        break;

      case "nearby":
        orderBy =
          latN != null && lngN != null
            ? `
                p.is_promoted        DESC,
                p.promotion_priority DESC,
                (
                  6371 * 2 * ASIN(SQRT(
                    POWER(SIN((RADIANS(p.latitude)  - RADIANS(${latN}))  / 2), 2) +
                    COS(RADIANS(${latN})) *
                    COS(RADIANS(p.latitude)) *
                    POWER(SIN((RADIANS(p.longitude) - RADIANS(${lngN})) / 2), 2)
                  ))
                ) ASC
              `
            : BASE_ORDER;
        break;
    }

    /* ── Manual sort override — always keeps promoted first ── */
    switch (sort) {
      case "price_asc":
        orderBy = `p.is_promoted DESC, p.promotion_priority DESC, p.price ASC,  p.engagement_score DESC`;
        break;
      case "price_desc":
        orderBy = `p.is_promoted DESC, p.promotion_priority DESC, p.price DESC, p.engagement_score DESC`;
        break;
      case "engagement_desc":
        orderBy = `p.is_promoted DESC, p.promotion_priority DESC, p.engagement_score DESC`;
        break;
      case "created_desc":
        orderBy = `p.is_promoted DESC, p.promotion_priority DESC, p.created_at DESC`;
        break;
    }

    /* ── Pagination ── */
    values.push(realLimit + 1);
    const limitP  = `$${values.length}`;
    values.push(offset);
    const offsetP = `$${values.length}`;

    const whereClause = `${where.join(" AND ")} ${sectionFilter}`;

    /* ── Main query ── */
    const mainSql = `
      SELECT
        p.id,        p.title,       p.description,  p.price,       p.slug,
        p.status,
        p.main_image, p.thumbnail_url, p.images,    p.video_url,
        p.attributes, p.brand,      p.model,        p.condition,   p.negotiable,
        p.views,      p.clicks_count, p.impression_count,
        p.engagement_score,  p.search_priority,
        p.promotion_priority, p.promotion_type,
        p.promotion_expires_at,
        p.is_promoted, p.is_featured, p.boost_score,
        p.quality_score,    p.conversion_rate,
        p.favorites_count,  p.share_count,
        p.average_rating,   p.reviews_count,
        p.offer_type,  p.swap_for,   p.is_p2p,
        p.location_city,    p.location_state,
        p.latitude,    p.longitude,
        p.delivery,    p.contact,    p.whatsapp,    p.phone,
        p.created_at,  p.category_id, p.subcategory_id,
        p.seller_id,   p.seller_name,
        p.stock_quantity,   p.stock_status,
        p.active_until,
        u.identity_verified      AS seller_verified,
        u.subscription_plan      AS seller_subscription_plan,
        u.subscription_status,
        u.subscription_expires_at,
        sp.rank                  AS seller_subscription_rank
      FROM  public.products p
      LEFT  JOIN public.users u
        ON  u.id = p.seller_id
      LEFT  JOIN public.subscription_plans sp
        ON  sp.slug = u.subscription_plan AND sp.is_active = TRUE
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT  ${limitP}
      OFFSET ${offsetP}
    `;

    /* ── Count (first page only — expensive on large tables) ── */
    const isFirstPage = Number(page) === 0;
    const countValues = values.slice(0, values.length - 2);
    const countSql    = `
      SELECT COUNT(*)::INT AS total
      FROM   public.products p
      LEFT   JOIN public.users u ON u.id = p.seller_id
      WHERE  ${whereClause}
    `;

    /* ══════════════════════════════════════════════════════════
       RUN QUERIES IN PARALLEL
       - main product query
       - unread notification count (0 if not authenticated)
       - total count (first page only)
    ══════════════════════════════════════════════════════════ */
    const promises = [
      pool.query(mainSql, values),
      getUnreadCount(userId),
    ];
    if (isFirstPage) promises.push(pool.query(countSql, countValues));

    const [mainResult, unreadNotifications, countResult] =
      await Promise.all(promises);

    const { rows } = mainResult;
    const total    = isFirstPage ? (countResult?.rows[0]?.total ?? 0) : -1;
    const hasMore  = rows.length > realLimit;
    const records  = hasMore ? rows.slice(0, realLimit) : rows;

    /* ── Shape ── */
    const products = records.map((p) => shapeProduct(p, latN, lngN));

    /* ── Location label ── */
    const cityFreq = {};
    for (const p of products) {
      if (p.location_city)
        cityFreq[p.location_city] = (cityFreq[p.location_city] || 0) + 1;
    }
    const topCity =
      Object.entries(cityFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const locationLabel =
      (state && city ? `${city}, ${state}` : null) ||
      (state         ? state               : null) ||
      topCity        || null;

    /* ── Featured — Premium (priority ≥ 3) + Elite (priority 4) only ── */
    const featured =
      Number(page) === 0 && !section
        ? products
            .filter((p) => p.is_promoted && p.promotion_priority >= 3)
            .slice(0, 6)
        : [];

    /* ── Stats breakdown (v4) ── */
    const activeCount      = products.filter((p) => p.status === "active").length;
    const activeTrialCount = products.filter((p) => p.status === "active_limited").length;

    /* ══════════════════════════════════════════════════════════
       BUILD CACHEABLE PAYLOAD (no user data)
    ══════════════════════════════════════════════════════════ */
    const cacheablePayload = {
      products,
      featured,
      hasMore,
      meta: {
        section          : section || "all",
        page             : Number(page),
        limit            : realLimit,
        returned         : products.length,
        total,
        has_more         : hasMore,
        location         : locationLabel,
        nearbySource     :
          latN && lngN ? "gps" : state || city ? "manual" : null,

        /* v4: trial breakdown */
        active_count      : activeCount,
        active_trial_count: activeTrialCount,

        filters: {
          category_id: category_id || null,
          max_price  : max_price   || null,
          min_price  : min_price   || null,
          sort       : sort        || null,
          state      : state       || null,
          city       : city        || null,
        },
      },
    };

    /* ── Cache the shared payload ── */
    if (cacheKey) {
      const ttl = CACHE_TTL[section] ?? CACHE_TTL.all;
      if (ttl > 0) await cacheSet(cacheKey, cacheablePayload, ttl);
    }

    /* ══════════════════════════════════════════════════════════
       RESPONSE — merge cacheable payload + per-user data
    ══════════════════════════════════════════════════════════ */
    return res.json({
      ...cacheablePayload,
      meta: {
        ...cacheablePayload.meta,
        unread_notifications: unreadNotifications,
        authenticated       : !!userId,
      },
    });

  } catch (err) {
    console.error("[homepage] ERROR:", err.message, "\n", err.stack);
    return res.status(500).json({
      error  : "Failed to load products",
      message: err.message,
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   ANALYTICS — View
══════════════════════════════════════════════════════════════ */
router.post("/products/:id/view", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.sendStatus(400);
  try {
    await pool.query(
      `UPDATE public.products
       SET views               = COALESCE(views, 0) + 1,
           impression_count    = COALESCE(impression_count, 0) + 1,
           engagement_score    = LEAST(100, COALESCE(engagement_score, 0) + 0.1),
           last_interaction_at = NOW()
       WHERE id        = $1
         AND is_active  = TRUE
         AND status    IN ('active', 'active_limited')
         AND status    <> 'deleted'`,
      [id]
    );
  } catch { /* fire and forget */ }
  res.sendStatus(204);
});

/* ══════════════════════════════════════════════════════════════
   ANALYTICS — Click
══════════════════════════════════════════════════════════════ */
router.post("/products/:id/click", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.sendStatus(400);
  try {
    await pool.query(
      `UPDATE public.products
       SET clicks_count        = COALESCE(clicks_count, 0) + 1,
           engagement_score    = LEAST(100, COALESCE(engagement_score, 0) + 0.5),
           last_interaction_at = NOW()
       WHERE id        = $1
         AND is_active  = TRUE
         AND status    IN ('active', 'active_limited')
         AND status    <> 'deleted'`,
      [id]
    );
  } catch { /* fire and forget */ }
  res.sendStatus(204);
});

/* ══════════════════════════════════════════════════════════════
   ANALYTICS — Batch
══════════════════════════════════════════════════════════════ */
router.post("/analytics/batch", async (req, res) => {
  const { events } = req.body || {};
  if (!Array.isArray(events) || events.length === 0) return res.sendStatus(400);

  const batch  = events.slice(0, 50);
  const views  = batch.filter((e) => e.type === "view").map((e) => e.id);
  const clicks = batch.filter((e) => e.type === "click").map((e) => e.id);

  try {
    const updates = [];

    if (views.length) {
      updates.push(
        pool.query(
          `UPDATE public.products
           SET views               = COALESCE(views, 0) + 1,
               impression_count    = COALESCE(impression_count, 0) + 1,
               engagement_score    = LEAST(100, COALESCE(engagement_score, 0) + 0.1),
               last_interaction_at = NOW()
           WHERE id       = ANY($1::UUID[])
             AND is_active = TRUE
             AND status   IN ('active', 'active_limited')
             AND status   <> 'deleted'`,
          [views]
        )
      );
    }

    if (clicks.length) {
      updates.push(
        pool.query(
          `UPDATE public.products
           SET clicks_count        = COALESCE(clicks_count, 0) + 1,
               engagement_score    = LEAST(100, COALESCE(engagement_score, 0) + 0.5),
               last_interaction_at = NOW()
           WHERE id       = ANY($1::UUID[])
             AND is_active = TRUE
             AND status   IN ('active', 'active_limited')
             AND status   <> 'deleted'`,
          [clicks]
        )
      );
    }

    await Promise.all(updates);
  } catch { /* fire and forget */ }

  res.sendStatus(204);
});

/* ══════════════════════════════════════════════════════════════
   CACHE INVALIDATION
   Call this after: product create, update, promote, delete,
   subscription activate, subscription expire.
══════════════════════════════════════════════════════════════ */
export async function invalidateHomepageCache() {
  try {
    await cacheDel("hp:*");
    console.log("[cache] homepage cache cleared");
  } catch (err) {
    console.warn("[cache] invalidation failed:", err.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   HEALTH
══════════════════════════════════════════════════════════════ */
router.get("/health", async (_req, res) => {
  const redis = await cacheStats();
  let dbOk = false;
  try { await pool.query("SELECT 1"); dbOk = true; } catch { /* */ }
  res.json({
    status: dbOk && redis.connected ? "healthy" : "degraded",
    db    : dbOk ? "connected" : "down",
    redis,
    ts    : new Date().toISOString(),
  });
});

export default router;