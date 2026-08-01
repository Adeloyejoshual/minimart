/**
 * routes/homepage.js — v7
 *
 * ══════════════════════════════════════════════════════════════
 *  FEED ARCHITECTURE
 * ══════════════════════════════════════════════════════════════
 *
 *  The response is assembled in three layers:
 *
 *   ┌─ LAYER 1 · RANKED POOL  (cacheable, user-agnostic) ────────┐
 *   │  DB query ordered by:                                      │
 *   │   1. is_promoted DESC        — paid per-product promotion  │
 *   │   2. promotion_priority DESC — Elite 4 > Premium 3 >       │
 *   │                                Basic 2 > Starter 1         │
 *   │   3. search_priority DESC    — subscription rank           │
 *   │   4. engagement_score DESC   — organic tiebreaker          │
 *   │   5. created_at DESC         — newest tiebreaker           │
 *   └────────────────────────────────────────────────────────────┘
 *                              ↓
 *   ┌─ LAYER 2 · PERSONALISATION  (per-user, never cached) ──────┐
 *   │  Organic items re-ranked by affinity:                      │
 *   │   · category affinity  (last 30d views / favourites)       │
 *   │   · seller affinity                                        │
 *   │   · location affinity                                      │
 *   │  Promoted items keep their paid ordering.                  │
 *   └────────────────────────────────────────────────────────────┘
 *                              ↓
 *   ┌─ LAYER 3 · BLEND  (per-request, always fresh) ─────────────┐
 *   │   · promoted interleaved every Nth slot (no top-stacking)  │
 *   │   · 15 random discovery products sprinkled through         │
 *   │   · featured hero carousel pulled out separately           │
 *   └────────────────────────────────────────────────────────────┘
 *
 * ══════════════════════════════════════════════════════════════
 *  v7 CHANGES
 * ══════════════════════════════════════════════════════════════
 *  + Hybrid cache — only the ranked pool is cached. Personalisation,
 *    random injection and the promoted blend run on every request,
 *    so a cache HIT still returns a fresh, personalised feed.
 *  + Personalised recommendations from view history / favourites,
 *    with graceful schema probing (missing tables never throw twice).
 *  + Promoted products interleaved into the feed instead of stacked
 *    at the top — better UX, better CTR for advertisers.
 *  + 15 random discovery products injected on page 0.
 *  + Random pool cached separately and sampled per-request, so the
 *    "random" set differs between users without extra DB load.
 *  + Cache-Control: stale-while-revalidate for offline resilience.
 *  + Product SELECT column list extracted to a single constant.
 *
 * ══════════════════════════════════════════════════════════════
 *  CARRIED OVER
 * ══════════════════════════════════════════════════════════════
 *  v6 — count query only on page 0 + cache MISS; shared analytics
 *       helper; extracted Haversine SQL helper
 *  v5 — optional auth (softAuth); meta.unread_notifications
 *  v4 — active_limited visible; active_until expiry guard;
 *       trial listing flags
 */

import express from "express";
import { pool } from "../config/db.js";
import { cacheGet, cacheSet, cacheDel, cacheStats } from "../lib/redis.js";
import { softAuth } from "../middleware/auth.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   CACHE TTL  (seconds)
══════════════════════════════════════════════════════════════ */
const CACHE_TTL = {
  all      : 60,
  deals    : 120,
  trending : 90,
  latest   : 30,
  nearby   : 0,    // never cache GPS
};

const RANDOM_POOL_TTL = 300;  // random candidate pool
const AFFINITY_TTL    = 600;  // per-user affinity profile

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const MAX_LIMIT          = 80;
const DEFAULT_LIMIT      = 40;
const ANALYTICS_CAP      = 50;
const FEATURED_CAP       = 6;
const MIN_PROMO_PRIORITY = 3;    // threshold for the "featured" hero slot

const RANDOM_INJECT_COUNT = 15;  // discovery products per homepage load
const RANDOM_POOL_SIZE    = 90;  // candidates cached to sample from
const PROMO_MIX_INTERVAL  = 4;   // organic items between promoted slots
const RANDOM_MIN_GAP      = 3;   // minimum items between random picks

/* Personalisation weights */
const BOOST_CATEGORY = 0.45;
const BOOST_SELLER   = 0.25;
const BOOST_STATE    = 0.15;
const AFFINITY_MAX_BOOST = 0.9;  // hard ceiling so ranking never inverts

/* ══════════════════════════════════════════════════════════════
   SCHEMA SUPPORT PROBE
   Some deployments may not have a view-history table. We probe once
   and remember the result so we never spam the DB with failing SQL.
   null = unknown, true = available, false = missing
══════════════════════════════════════════════════════════════ */
const SCHEMA_SUPPORT = {
  product_views : null,
  favorites     : null,
};

/* ══════════════════════════════════════════════════════════════
   SHARED PRODUCT COLUMN LIST
══════════════════════════════════════════════════════════════ */
const PRODUCT_COLUMNS = `
  p.id,            p.title,         p.description,      p.price,
  p.slug,          p.status,
  p.main_image,    p.thumbnail_url, p.images,           p.video_url,
  p.attributes,    p.brand,         p.model,            p.condition,
  p.negotiable,
  p.views,         p.clicks_count,  p.impression_count,
  p.engagement_score,   p.search_priority,
  p.promotion_priority, p.promotion_type,
  p.promotion_expires_at,
  p.is_promoted,   p.is_featured,   p.boost_score,
  p.quality_score, p.conversion_rate,
  p.favorites_count,   p.share_count,
  p.average_rating,    p.reviews_count,
  p.offer_type,    p.swap_for,      p.is_p2p,
  p.location_city, p.location_state,
  p.latitude,      p.longitude,
  p.delivery,      p.contact,       p.whatsapp,         p.phone,
  p.created_at,    p.category_id,   p.subcategory_id,
  p.seller_id,     p.seller_name,
  p.stock_quantity, p.stock_status,
  p.active_until,
  u.identity_verified     AS seller_verified,
  u.subscription_plan     AS seller_subscription_plan,
  u.subscription_status,
  u.subscription_expires_at,
  sp.rank                 AS seller_subscription_rank
`;

const PRODUCT_JOINS = `
  FROM  public.products p
  LEFT  JOIN public.users u
    ON  u.id = p.seller_id
  LEFT  JOIN public.subscription_plans sp
    ON  sp.slug = u.subscription_plan AND sp.is_active = TRUE
`;

/* Base visibility predicate — reused everywhere */
const LIVE_PREDICATE = `
  p.is_active = TRUE
  AND p.status IN ('active', 'active_limited')
  AND p.status <> 'deleted'
  AND (p.active_until IS NULL OR p.active_until > NOW())
  AND (p.promotion_expires_at IS NULL OR p.promotion_expires_at > NOW())
`;

/* ══════════════════════════════════════════════════════════════
   CACHE KEYS
══════════════════════════════════════════════════════════════ */
function buildPoolCacheKey(params) {
  const {
    section = "all", page = 0, limit = DEFAULT_LIMIT,
    category_id, max_price, min_price,
    sort, state, city, lat, lng,
  } = params;

  // GPS results are personal + dynamic → never cache
  if (lat && lng) return null;

  return [
    "hp",
    section,
    `p${page}`,
    `l${limit}`,
    category_id ? `c${String(category_id).slice(0, 8)}`                  : "",
    max_price   ? `mx${max_price}`                                       : "",
    min_price   ? `mn${min_price}`                                       : "",
    sort        ? `s${sort}`                                             : "",
    state       ? `st${String(state).toLowerCase().replace(/\s/g, "_")}` : "",
    city        ? `cy${String(city).toLowerCase().replace(/\s/g, "_")}`  : "",
  ].filter(Boolean).join(":");
}

function buildRandomPoolKey(state) {
  return state
    ? `hp:randpool:st${String(state).toLowerCase().replace(/\s/g, "_")}`
    : "hp:randpool:global";
}

function buildAffinityKey(userId) {
  return `uaff:${userId}`;
}

/* ══════════════════════════════════════════════════════════════
   PROMOTION BADGE
══════════════════════════════════════════════════════════════ */
const BADGE_MAP = { elite: "featured", premium: "premium" };

function getPromotionBadge(isPromoted, promotionType) {
  if (!isPromoted) return null;
  return BADGE_MAP[String(promotionType ?? "").toLowerCase()] ?? "promoted";
}

/* ══════════════════════════════════════════════════════════════
   HAVERSINE  (JS — display distance only)
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
   INLINE SQL HAVERSINE  (ORDER BY for the nearby section)
══════════════════════════════════════════════════════════════ */
function sqlHaversine(latN, lngN) {
  return `(
    6371 * 2 * ASIN(SQRT(
      POWER(SIN((RADIANS(p.latitude)  - RADIANS(${latN}))  / 2), 2) +
      COS(RADIANS(${latN})) *
      COS(RADIANS(p.latitude)) *
      POWER(SIN((RADIANS(p.longitude) - RADIANS(${lngN})) / 2), 2)
    ))
  )`;
}

/* ══════════════════════════════════════════════════════════════
   ARRAY UTILITIES
══════════════════════════════════════════════════════════════ */
function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sampleN(arr, n) {
  if (arr.length <= n) return shuffle(arr);
  return shuffle(arr).slice(0, n);
}

/* ══════════════════════════════════════════════════════════════
   INTERLEAVE PROMOTED INTO ORGANIC
   Instead of stacking every paid listing at the top, promoted items
   are distributed one per `interval` organic items. This keeps the
   feed feeling editorial while still giving advertisers early slots.

   Pattern (interval = 4):
     [org, org, org, org, PROMO, org, org, org, org, PROMO, ...]
══════════════════════════════════════════════════════════════ */
function interleavePromoted(products, interval = PROMO_MIX_INTERVAL) {
  const promoted = products.filter((p) => p.is_promoted);
  const organic  = products.filter((p) => !p.is_promoted);

  if (promoted.length === 0) return organic;
  if (organic.length  === 0) return promoted;

  // Highest paid priority surfaces first among promoted
  promoted.sort(
    (a, b) =>
      b.promotion_priority - a.promotion_priority ||
      b.search_priority    - a.search_priority ||
      b.engagement_score   - a.engagement_score
  );

  const mixed = [];
  let pIdx = 0;
  let oIdx = 0;

  while (oIdx < organic.length || pIdx < promoted.length) {
    for (let i = 0; i < interval && oIdx < organic.length; i++) {
      mixed.push(organic[oIdx++]);
    }
    if (pIdx < promoted.length) {
      mixed.push({ ...promoted[pIdx++], feed_slot: "promoted" });
    }
    // Avoid an infinite loop if organic runs out mid-cycle
    if (oIdx >= organic.length && pIdx >= promoted.length) break;
  }

  return mixed;
}

/* ══════════════════════════════════════════════════════════════
   SPRINKLE RANDOM DISCOVERY PICKS
   Distributes random products evenly through the feed with a
   guaranteed minimum gap between them.
══════════════════════════════════════════════════════════════ */
function sprinkleRandom(feed, randoms, minGap = RANDOM_MIN_GAP) {
  if (!feed.length)    return randoms.map((r) => ({ ...r, is_random_pick: true, feed_slot: "discovery" }));
  if (!randoms.length) return feed;

  const gap = Math.max(minGap, Math.floor(feed.length / randoms.length));
  const out = [];
  let rIdx  = 0;

  feed.forEach((item, i) => {
    out.push(item);
    if ((i + 1) % gap === 0 && rIdx < randoms.length) {
      out.push({ ...randoms[rIdx++], is_random_pick: true, feed_slot: "discovery" });
    }
  });

  while (rIdx < randoms.length) {
    out.push({ ...randoms[rIdx++], is_random_pick: true, feed_slot: "discovery" });
  }

  return out;
}

/* ══════════════════════════════════════════════════════════════
   UNREAD NOTIFICATION COUNT  (per-user, never cached)
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
   USER AFFINITY PROFILE
   Builds a lightweight taste profile from recent behaviour.

   Source priority:
     1. public.product_views  (last 30 days)
     2. public.favorites      (all time)
     3. none → empty profile (feed falls back to pure ranking)

   Result shape:
     { categories: {id: 0..1}, sellers: {id: 0..1},
       states: {name: 0..1},  signals: <int> }
══════════════════════════════════════════════════════════════ */
async function queryAffinityRows(userId) {
  /* ── Source 1 · view history ── */
  if (SCHEMA_SUPPORT.product_views !== false) {
    try {
      const { rows } = await pool.query(
        `SELECT p.category_id,
                p.seller_id,
                p.location_state,
                COUNT(*)::INT AS weight
         FROM   public.product_views v
         JOIN   public.products p ON p.id = v.product_id
         WHERE  v.user_id    = $1
           AND  v.created_at > NOW() - INTERVAL '30 days'
         GROUP  BY 1, 2, 3
         ORDER  BY weight DESC
         LIMIT  120`,
        [userId]
      );
      SCHEMA_SUPPORT.product_views = true;
      if (rows.length) return rows;
    } catch (err) {
      if (err.code === "42P01") {
        SCHEMA_SUPPORT.product_views = false;   // relation does not exist
        console.info("[homepage] product_views table absent — skipping");
      } else {
        console.warn("[homepage] affinity(views) failed:", err.message);
      }
    }
  }

  /* ── Source 2 · favourites ── */
  if (SCHEMA_SUPPORT.favorites !== false) {
    try {
      const { rows } = await pool.query(
        `SELECT p.category_id,
                p.seller_id,
                p.location_state,
                COUNT(*)::INT * 2 AS weight
         FROM   public.favorites f
         JOIN   public.products p ON p.id = f.product_id
         WHERE  f.user_id = $1
         GROUP  BY 1, 2, 3
         ORDER  BY weight DESC
         LIMIT  120`,
        [userId]
      );
      SCHEMA_SUPPORT.favorites = true;
      if (rows.length) return rows;
    } catch (err) {
      if (err.code === "42P01") {
        SCHEMA_SUPPORT.favorites = false;
        console.info("[homepage] favorites table absent — skipping");
      } else {
        console.warn("[homepage] affinity(favorites) failed:", err.message);
      }
    }
  }

  return [];
}

const EMPTY_AFFINITY = { categories: {}, sellers: {}, states: {}, signals: 0 };

async function getUserAffinity(userId) {
  if (!userId) return EMPTY_AFFINITY;

  const key = buildAffinityKey(userId);
  try {
    const cached = await cacheGet(key);
    if (cached) return cached;
  } catch (_e) { /* cache miss is fine */ }

  const rows = await queryAffinityRows(userId);
  if (!rows.length) {
    cacheSet(key, EMPTY_AFFINITY, AFFINITY_TTL).catch(() => {});
    return EMPTY_AFFINITY;
  }

  const categories = {};
  const sellers    = {};
  const states     = {};
  let   signals    = 0;

  for (const r of rows) {
    const w = Number(r.weight) || 0;
    signals += w;
    if (r.category_id)    categories[r.category_id] = (categories[r.category_id] || 0) + w;
    if (r.seller_id)      sellers[r.seller_id]      = (sellers[r.seller_id]      || 0) + w;
    if (r.location_state) {
      const s = String(r.location_state).toLowerCase();
      states[s] = (states[s] || 0) + w;
    }
  }

  // Normalise each bucket to 0..1
  const normalise = (obj) => {
    const max = Math.max(...Object.values(obj), 1);
    for (const k of Object.keys(obj)) obj[k] = obj[k] / max;
    return obj;
  };

  const profile = {
    categories : normalise(categories),
    sellers    : normalise(sellers),
    states     : normalise(states),
    signals,
  };

  cacheSet(key, profile, AFFINITY_TTL).catch(() => {});
  return profile;
}

/* ══════════════════════════════════════════════════════════════
   PERSONALISED RE-RANK
   Applies an affinity multiplier to ORGANIC items only. Promoted
   items are untouched — advertisers paid for their ordering.

   The base score is derived from the item's existing position, so a
   product never jumps more than AFFINITY_MAX_BOOST worth of ground.
══════════════════════════════════════════════════════════════ */
function personaliseOrganic(products, affinity) {
  if (!affinity || affinity.signals === 0) return products;

  const total = products.length;

  const scored = products.map((p, idx) => {
    if (p.is_promoted) return { p, score: null, idx };

    const catW = affinity.categories[p.category_id] ?? 0;
    const selW = affinity.sellers[p.seller?.id]     ?? 0;
    const stW  = p.location_state
      ? affinity.states[String(p.location_state).toLowerCase()] ?? 0
      : 0;

    const boost = Math.min(
      AFFINITY_MAX_BOOST,
      catW * BOOST_CATEGORY + selW * BOOST_SELLER + stW * BOOST_STATE
    );

    const base = total - idx;          // preserves original ranking
    return { p, score: base * (1 + boost), idx, boost };
  });

  const organic = scored
    .filter((s) => s.score !== null)
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map((s) => ({
      ...s.p,
      personalised   : s.boost > 0.01,
      affinity_boost : Math.round(s.boost * 100) / 100,
    }));

  const promoted = scored.filter((s) => s.score === null).map((s) => s.p);

  // Merge back — order within each group preserved, blend happens later
  return [...promoted, ...organic];
}

/* ══════════════════════════════════════════════════════════════
   RANDOM DISCOVERY POOL
   TABLESAMPLE is dramatically faster than ORDER BY random() on large
   tables. The pool is cached, then sampled per-request — so two users
   hitting the same cached page still see different discovery picks.
══════════════════════════════════════════════════════════════ */
async function getRandomPool(state) {
  const key = buildRandomPoolKey(state);

  try {
    const cached = await cacheGet(key);
    if (cached?.length) return cached;
  } catch (_e) { /* fall through to DB */ }

  const params = [RANDOM_POOL_SIZE];
  let stateClause = "";
  if (state) {
    params.push(state);
    stateClause = `AND LOWER(p.location_state) = LOWER($2)`;
  }

  const buildSql = (sampled) => `
    SELECT ${PRODUCT_COLUMNS}
    FROM   public.products p ${sampled ? "TABLESAMPLE SYSTEM (12)" : ""}
    LEFT   JOIN public.users u
      ON   u.id = p.seller_id
    LEFT   JOIN public.subscription_plans sp
      ON   sp.slug = u.subscription_plan AND sp.is_active = TRUE
    WHERE  ${LIVE_PREDICATE}
      ${stateClause}
    ${sampled ? "" : "ORDER BY random()"}
    LIMIT  $1
  `;

  try {
    let { rows } = await pool.query(buildSql(true), params);

    // TABLESAMPLE can miss entirely on small tables — fall back
    if (rows.length < Math.min(RANDOM_INJECT_COUNT, 10)) {
      ({ rows } = await pool.query(buildSql(false), params));
    }

    if (rows.length) {
      cacheSet(key, rows, RANDOM_POOL_TTL).catch(() => {});
    }
    return rows;
  } catch (err) {
    console.warn("[homepage] random pool fetch failed:", err.message);
    return [];
  }
}

/* ══════════════════════════════════════════════════════════════
   SHAPE ONE PRODUCT ROW
══════════════════════════════════════════════════════════════ */
function shapeProduct(p, latN, lngN) {
  /* ── Primary image ── */
  let image = p.main_image || p.thumbnail_url || null;
  if (!image && Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    image = typeof first === "string" ? first : first?.url ?? null;
  }

  /* ── Images array ── */
  let imagesArr = [];
  if (Array.isArray(p.images) && p.images.length > 0) {
    imagesArr = p.images
      .map((img) => (typeof img === "string" ? img : img?.url ?? null))
      .filter(Boolean);
  } else if (image) {
    imagesArr = [image];
  }

  /* ── Distance ── */
  const distance_km =
    latN != null && lngN != null &&
    p.latitude != null && p.longitude != null
      ? haversineKm(latN, lngN, Number(p.latitude), Number(p.longitude))
      : null;

  /* ── CTR ── */
  const impressions = Number(p.impression_count || 0);
  const clicks      = Number(p.clicks_count     || 0);
  const vw          = Number(p.views            || 0);
  const ctr =
    impressions > 0 ? clicks / impressions :
    vw          > 0 ? clicks / vw          : 0;

  /* ── Discount ── */
  const origPrice = Number(p.attributes?.original_price || 0);
  const currPrice = Number(p.price || 0);
  const discount_pct =
    origPrice > currPrice && currPrice > 0
      ? Math.round(((origPrice - currPrice) / origPrice) * 100)
      : 0;

  /* ── Trial listing flags ── */
  const trial_listing    = p.status === "active_limited";
  const trial_expires_at = trial_listing ? (p.active_until || null) : null;
  const trial_days_remaining =
    trial_listing && trial_expires_at
      ? Math.max(
          0,
          Math.ceil(
            (new Date(trial_expires_at).getTime() - Date.now()) / 86_400_000
          )
        )
      : null;

  const locationLabel =
    [p.location_city, p.location_state].filter(Boolean).join(", ") || null;

  return {
    id                   : p.id,
    title                : p.title,
    description          : p.description,
    price                : currPrice,
    slug                 : p.slug,
    status               : p.status,
    image,
    images               : imagesArr,
    video_url            : p.video_url            || null,
    attributes           : p.attributes           || {},
    brand                : p.brand                || null,
    model                : p.model                || null,
    condition            : p.condition            || null,
    negotiable           : !!p.negotiable,
    views                : vw,
    clicks_count         : clicks,
    impression_count     : impressions,
    engagement_score     : Number(p.engagement_score    || 0),
    search_priority      : Number(p.search_priority     || 0),
    promotion_priority   : Number(p.promotion_priority  || 0),
    promotion_type       : p.promotion_type             || null,
    promotion_expires_at : p.promotion_expires_at       || null,
    promotion_badge      : getPromotionBadge(p.is_promoted, p.promotion_type),
    is_promoted          : !!p.is_promoted,
    is_featured          : !!p.is_featured,
    boost_score          : Number(p.boost_score         || 0),
    quality_score        : Number(p.quality_score       || 0),
    conversion_rate      : Number(p.conversion_rate     || 0),
    favorites_count      : Number(p.favorites_count     || 0),
    share_count          : Number(p.share_count         || 0),
    average_rating       : Number(p.average_rating      || 0),
    reviews_count        : Number(p.reviews_count       || 0),
    offer_type           : p.offer_type  || null,
    swap_for             : p.swap_for    || null,
    is_p2p               : !!p.is_p2p,
    delivery             : p.delivery   || null,
    contact              : p.contact    || null,
    whatsapp             : p.whatsapp   || null,
    phone                : p.phone      || null,
    created_at           : p.created_at,
    category_id          : p.category_id          || null,
    subcategory_id       : p.subcategory_id       || null,
    stock_quantity       : p.stock_quantity        ?? null,
    stock_status         : p.stock_status          || null,
    active_until         : p.active_until          || null,
    ctr,
    discount_pct,
    distance_km,
    location_city        : p.location_city         || null,
    location_state       : p.location_state        || null,
    location: {
      city  : p.location_city  || null,
      state : p.location_state || null,
      label : locationLabel,
    },
    trial_listing,
    trial_expires_at,
    trial_days_remaining,

    /* Feed metadata — overwritten downstream by the blender */
    feed_slot      : p.is_promoted ? "promoted" : "organic",
    is_random_pick : false,
    personalised   : false,
    affinity_boost : 0,

    seller: {
      id               : p.seller_id                       || null,
      name             : p.seller_name                     || null,
      verified         : !!p.seller_verified,
      subscriptionPlan : p.seller_subscription_plan        || null,
      subscriptionRank : Number(p.seller_subscription_rank || 0),
    },
  };
}

/* ══════════════════════════════════════════════════════════════
   ANALYTICS UPDATE HELPER
   Shared by view, click and batch endpoints.
══════════════════════════════════════════════════════════════ */
async function recordAnalytics(ids, action) {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [ids].filter(Boolean);
  if (!list.length) return;

  const viewCols = `
    views               = COALESCE(views, 0) + 1,
    impression_count    = COALESCE(impression_count, 0) + 1,
    engagement_score    = LEAST(100, COALESCE(engagement_score, 0) + 0.1),
    last_interaction_at = NOW()
  `;
  const clickCols = `
    clicks_count        = COALESCE(clicks_count, 0) + 1,
    engagement_score    = LEAST(100, COALESCE(engagement_score, 0) + 0.5),
    last_interaction_at = NOW()
  `;

  await pool.query(
    `UPDATE public.products
     SET    ${action === "view" ? viewCols : clickCols}
     WHERE  id = ANY($1::UUID[])
       AND  is_active = TRUE
       AND  status IN ('active', 'active_limited')
       AND  status <> 'deleted'`,
    [list]
  );
}

/* ══════════════════════════════════════════════════════════════
   GET /api/homepage
   Optional auth via softAuth — never blocks anonymous requests
══════════════════════════════════════════════════════════════ */
router.get("/", softAuth, async (req, res) => {
  const {
    page        = 0,
    limit       = DEFAULT_LIMIT,
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

  const userId      = req.user?.id ?? null;
  const realLimit   = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);
  const pageNum     = Math.max(0, Number(page) || 0);
  const offset      = pageNum * realLimit;
  const isFirstPage = pageNum === 0;
  const isMainFeed  = isFirstPage && !section;   // where blending happens

  /* Offline resilience — lets browsers & SWs serve stale while revalidating */
  res.set("Cache-Control", "public, max-age=20, stale-while-revalidate=600");

  let latN = null;
  let lngN = null;
  if (lat && lng) {
    const a = Number(lat);
    const b = Number(lng);
    if (Number.isFinite(a) && Number.isFinite(b)) { latN = a; lngN = b; }
  }

  try {
    /* ══════════════════════════════════════════════════════════
       LAYER 1 — RANKED POOL  (cached, user-agnostic)
    ══════════════════════════════════════════════════════════ */
    const poolKey = buildPoolCacheKey(req.query);
    let   poolData = null;

    if (poolKey) {
      try {
        poolData = await cacheGet(poolKey);
      } catch (_e) { poolData = null; }
    }

    if (poolData) {
      res.set("X-Cache", "HIT");
      res.set("X-Cache-Key", poolKey);
    } else {
      res.set("X-Cache", "MISS");

      /* ── Query builder ── */
      const values = [];
      const push   = (v) => { values.push(v); return `$${values.length}`; };

      const where = [
        `p.is_active = TRUE`,
        `p.status IN ('active', 'active_limited')`,
        `p.status <> 'deleted'`,
        `(p.active_until IS NULL OR p.active_until > NOW())`,
        `(p.promotion_expires_at IS NULL OR p.promotion_expires_at > NOW())`,
      ];

      if (category_id) where.push(`p.category_id = ${push(category_id)}`);
      if (state)       where.push(`LOWER(p.location_state) = LOWER(${push(state)})`);
      if (city)        where.push(`LOWER(p.location_city)  = LOWER(${push(city)})`);
      if (max_price)   where.push(`p.price <= ${push(Number(max_price))}`);
      if (min_price)   where.push(`p.price >= ${push(Number(min_price))}`);

      /* ── GPS bounding box (index-friendly pre-filter) ── */
      if (latN != null && lngN != null) {
        const latP = push(latN);
        const lngP = push(lngN);
        where.push(`p.latitude  IS NOT NULL`);
        where.push(`p.longitude IS NOT NULL`);
        where.push(`p.latitude  BETWEEN ${latP} - 0.45 AND ${latP} + 0.45`);
        where.push(`p.longitude BETWEEN ${lngP} - 0.45 AND ${lngP} + 0.45`);
      }

      /* ── ORDER BY ── */
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
                  ${sqlHaversine(latN, lngN)} ASC
                `
              : BASE_ORDER;
          break;

        default:
          break;
      }

      /* ── Manual sort override — promoted always stays prioritised ── */
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
        default:
          break;
      }

      const whereClause = `${where.join(" AND ")} ${sectionFilter}`;

      /* ── Pagination params (pushed last so count can slice them off) ── */
      const limitP  = push(realLimit + 1);   // +1 to detect hasMore
      const offsetP = push(offset);

      const mainSql = `
        SELECT ${PRODUCT_COLUMNS}
        ${PRODUCT_JOINS}
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        LIMIT  ${limitP}
        OFFSET ${offsetP}
      `;

      /* ── Count only on page 0 + cache MISS ── */
      const countSql = isFirstPage
        ? `SELECT COUNT(*)::INT AS total
           FROM   public.products p
           LEFT   JOIN public.users u ON u.id = p.seller_id
           WHERE  ${whereClause}`
        : null;

      const countValues = isFirstPage ? values.slice(0, values.length - 2) : [];

      const [mainResult, countResult] = await Promise.all([
        pool.query(mainSql, values),
        countSql ? pool.query(countSql, countValues) : Promise.resolve(null),
      ]);

      const rows    = mainResult.rows;
      const hasMore = rows.length > realLimit;
      const records = hasMore ? rows.slice(0, realLimit) : rows;

      poolData = {
        rows    : records,
        total   : isFirstPage ? (countResult?.rows[0]?.total ?? 0) : -1,
        hasMore,
      };

      /* Cache the RANKED POOL only — never the personalised blend */
      if (poolKey) {
        const ttl = CACHE_TTL[section] ?? CACHE_TTL.all;
        if (ttl > 0) {
          cacheSet(poolKey, poolData, ttl).catch((e) =>
            console.warn("[homepage] cache write failed:", e.message)
          );
        }
      }
    }

    const { rows: pooledRows, total, hasMore } = poolData;

    /* ══════════════════════════════════════════════════════════
       Fetch per-request extras in parallel
    ══════════════════════════════════════════════════════════ */
    const [unreadNotifications, affinity, randomPool] = await Promise.all([
      getUnreadCount(userId),
      userId ? getUserAffinity(userId) : Promise.resolve(EMPTY_AFFINITY),
      isMainFeed ? getRandomPool(state) : Promise.resolve([]),
    ]);

    /* ── Shape ── */
    let products = pooledRows.map((p) => shapeProduct(p, latN, lngN));

    /* ══════════════════════════════════════════════════════════
       LAYER 2 — PERSONALISATION  (organic items only)
    ══════════════════════════════════════════════════════════ */
    const personalisedApplied = !!userId && affinity.signals > 0;
    if (personalisedApplied) {
      products = personaliseOrganic(products, affinity);
    }

    /* ══════════════════════════════════════════════════════════
       LAYER 3 — BLEND
    ══════════════════════════════════════════════════════════ */

    /* Featured hero — picked BEFORE blending so the best paid slots
       still get the carousel, and are excluded from the feed below. */
    const featured = isMainFeed
      ? products
          .filter((p) => p.is_promoted && p.promotion_priority >= MIN_PROMO_PRIORITY)
          .slice(0, FEATURED_CAP)
      : [];

    const featuredIds = new Set(featured.map((f) => f.id));

    let randomInjected = 0;

    if (isMainFeed) {
      /* 3a — drop featured items from the feed to avoid duplication */
      const feedPool = products.filter((p) => !featuredIds.has(p.id));

      /* 3b — interleave promoted through organic */
      let blended = interleavePromoted(feedPool, PROMO_MIX_INTERVAL);

      /* 3c — sample random discovery picks, excluding anything on screen */
      const seen = new Set([...blended.map((p) => p.id), ...featuredIds]);
      const candidates = randomPool.filter((r) => !seen.has(r.id));
      const randoms = sampleN(candidates, RANDOM_INJECT_COUNT)
        .map((r) => shapeProduct(r, latN, lngN));

      randomInjected = randoms.length;

      /* 3d — sprinkle them through the feed */
      blended = sprinkleRandom(blended, randoms, RANDOM_MIN_GAP);

      products = blended;
    }

    /* ── Location label ── */
    const cityFreq = {};
    for (const p of products) {
      if (p.location_city)
        cityFreq[p.location_city] = (cityFreq[p.location_city] || 0) + 1;
    }
    const topCity =
      Object.entries(cityFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const locationLabel =
      (state && city ? `${city}, ${state}` : null) ||
      state || topCity || null;

    /* ── Trial breakdown ── */
    const active_count       = products.filter((p) => p.status === "active").length;
    const active_trial_count = products.filter((p) => p.status === "active_limited").length;

    /* ── Response ── */
    return res.json({
      products,
      featured,
      recommended : isMainFeed ? products : [],
      hasMore,
      meta: {
        section              : section || "all",
        page                 : pageNum,
        limit                : realLimit,
        returned             : products.length,
        total,
        has_more             : hasMore,
        location             : locationLabel,
        nearbySource         : latN && lngN ? "gps" : state || city ? "manual" : null,
        active_count,
        active_trial_count,
        random_injected      : randomInjected,
        promoted_mixed       : products.filter((p) => p.is_promoted).length,
        promo_mix_interval   : isMainFeed ? PROMO_MIX_INTERVAL : null,
        personalised         : personalisedApplied,
        affinity_signals     : affinity.signals,
        unread_notifications : unreadNotifications,
        authenticated        : !!userId,
        filters: {
          category_id : category_id || null,
          max_price   : max_price   || null,
          min_price   : min_price   || null,
          sort        : sort        || null,
          state       : state       || null,
          city        : city        || null,
        },
      },
    });

  } catch (err) {
    console.error("[homepage] ERROR:", err.message, "\n", err.stack);
    return res.status(500).json({
      error   : "Failed to load products",
      message : err.message,
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   ANALYTICS — Single view
══════════════════════════════════════════════════════════════ */
router.post("/products/:id/view", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.sendStatus(400);
  try {
    await recordAnalytics([id], "view");
  } catch (_e) { /* fire and forget */ }
  res.sendStatus(204);
});

/* ══════════════════════════════════════════════════════════════
   ANALYTICS — Single click
══════════════════════════════════════════════════════════════ */
router.post("/products/:id/click", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.sendStatus(400);
  try {
    await recordAnalytics([id], "click");
  } catch (_e) { /* fire and forget */ }
  res.sendStatus(204);
});

/* ══════════════════════════════════════════════════════════════
   ANALYTICS — Batch
══════════════════════════════════════════════════════════════ */
router.post("/analytics/batch", async (req, res) => {
  const { events } = req.body || {};
  if (!Array.isArray(events) || events.length === 0) return res.sendStatus(400);

  const batch  = events.slice(0, ANALYTICS_CAP);
  const views  = batch.filter((e) => e.type === "view").map((e) => e.id).filter(Boolean);
  const clicks = batch.filter((e) => e.type === "click").map((e) => e.id).filter(Boolean);

  try {
    await Promise.all([
      views.length  ? recordAnalytics(views,  "view")  : Promise.resolve(),
      clicks.length ? recordAnalytics(clicks, "click") : Promise.resolve(),
    ]);
  } catch (_e) { /* fire and forget */ }

  res.sendStatus(204);
});

/* ══════════════════════════════════════════════════════════════
   CACHE INVALIDATION
   Call after: product create/update/promote/delete,
   subscription activate/expire.
══════════════════════════════════════════════════════════════ */
export async function invalidateHomepageCache() {
  try {
    await cacheDel("hp:*");   // ranked pools + random pools
    console.log("[cache] homepage cache cleared");
  } catch (err) {
    console.warn("[cache] invalidation failed:", err.message);
  }
}

/**
 * Affinity profiles live under a separate prefix so ordinary product
 * churn does not wipe every user's taste profile.
 */
export async function invalidateUserAffinity(userId) {
  try {
    await cacheDel(userId ? `uaff:${userId}` : "uaff:*");
  } catch (err) {
    console.warn("[cache] affinity invalidation failed:", err.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   HEALTH
══════════════════════════════════════════════════════════════ */
router.get("/health", async (_req, res) => {
  const redis = await cacheStats();
  let dbOk = false;
  try { await pool.query("SELECT 1"); dbOk = true; } catch (_e) { /* */ }
  res.json({
    status : dbOk && redis.connected ? "healthy" : "degraded",
    db     : dbOk ? "connected" : "down",
    redis,
    schema : {
      product_views : SCHEMA_SUPPORT.product_views,
      favorites     : SCHEMA_SUPPORT.favorites,
    },
    ts : new Date().toISOString(),
  });
});

export default router;