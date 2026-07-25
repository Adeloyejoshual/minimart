// routes/search.js — v2
//
// Changes from v1:
//  - ACTIVE_STATUSES constant added — single source of truth
//  - GUARD updated: status IN ('active','active_limited')
//    + active_until expiry guard (expired trials auto-hidden)
//  - shapeProduct: added status, trial_listing, trial_expires_at,
//    trial_days_remaining, active_until fields
//  - SEL: added p.status, p.active_until, p.promotion_priority,
//    p.search_priority so ranking + trial fields work correctly
//  - relevance ORDER BY: added promotion_priority + search_priority
//    so promoted and subscribed sellers rank above trial listings
//  - /related: GUARD and category resolve query both updated
//  - /related: ORDER BY promotion_priority added
//  - is_deleted guard changed from = false to IS NOT TRUE
//    (safer — handles NULL values in the column)

import express from "express";
import { pool } from "../config/db.js";
import { cacheGet, cacheSet } from "../lib/redis.js";

const router = express.Router();

const CACHE_TTL   = 60;
const MAX_LIMIT   = 40;
const MAX_RELATED = 8;

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   Mirrors homepage.js v4, productDetail.js v2, sellerprofile.js v2.
   Single source of truth for "publicly visible" status filter.
══════════════════════════════════════════════════════════════ */
const ACTIVE_STATUSES = `('active', 'active_limited')`;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const daysUntilExpiry = (date) => {
  if (!date) return null;
  return Math.max(
    0,
    Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
  );
};

/* ══════════════════════════════════════════════════════════════
   SHAPE PRODUCT
   v2: added status, active_until, trial_listing,
       trial_expires_at, trial_days_remaining fields.
   Mirrors homepage.js v4 shapeProduct() so the frontend
   receives the same fields from every route.
══════════════════════════════════════════════════════════════ */
function shapeProduct(p) {
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

  /* ── Location ── */
  const locCity  = p.location_city  || p.location?.city  || null;
  const locState = p.location_state || p.location?.state || null;

  /* ── Trial fields — mirrors homepage.js v4 ── */
  const isTrialListing     = p.status === "active_limited";
  const trialExpiresAt     = isTrialListing ? (p.active_until ?? null) : null;
  const trialDaysRemaining = isTrialListing
    ? daysUntilExpiry(trialExpiresAt)
    : null;

  return {
    id                  : p.id,
    title               : p.title,
    description         : p.description         || null,
    price               : currPrice,
    slug                : p.slug                || null,
    status              : p.status              || null,
    image,
    images              : imagesArr,
    video_url           : p.video_url           || null,
    attributes          : p.attributes          || {},
    brand               : p.brand               || null,
    model               : p.model               || null,
    condition           : p.condition           || null,
    negotiable          : !!p.negotiable,
    views               : vw,
    clicks_count        : clicks,
    impression_count    : impressions,
    engagement_score    : Number(p.engagement_score  || 0),
    search_priority     : Number(p.search_priority   || 0),
    promotion_priority  : Number(p.promotion_priority || 0),
    is_promoted         : !!p.is_promoted,
    is_featured         : !!p.is_featured,
    favorites_count     : Number(p.favorites_count   || 0),
    average_rating      : Number(p.average_rating    || 0),
    reviews_count       : Number(p.reviews_count     || 0),
    offer_type          : p.offer_type          || null,
    delivery            : p.delivery            || null,
    whatsapp            : p.whatsapp            || null,
    phone               : p.phone               || null,
    created_at          : p.created_at,
    category_id         : p.category_id         || null,
    category_name       : p.category_name       || null,
    subcategory_id      : p.subcategory_id      || null,
    seller_id           : p.seller_id           || null,
    seller_name         : p.seller_name         || null,
    stock_status        : p.stock_status        || null,
    stock_quantity      : p.stock_quantity      ?? null,
    active_until        : p.active_until        ?? null,
    ctr,
    discount_pct        : discountPct,
    location_city       : locCity,
    location_state      : locState,
    location: {
      city : locCity,
      state: locState,
      label: [locCity, locState].filter(Boolean).join(", ") || null,
    },

    /* Trial fields */
    trial_listing       : isTrialListing,
    trial_expires_at    : trialExpiresAt,
    trial_days_remaining: trialDaysRemaining,

    seller: {
      id  : p.seller_id   || null,
      name: p.seller_name || null,
    },
  };
}

/* ══════════════════════════════════════════════════════════════
   TS-QUERY BUILDER
══════════════════════════════════════════════════════════════ */
function buildTsQuery(raw) {
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return null;
  return words.map((w) => `${w}:*`).join(" & ");
}

/* ══════════════════════════════════════════════════════════════
   SELECT COLUMNS
   v2: added p.status, p.active_until, p.promotion_priority,
       p.search_priority.

   - p.status       → trial_listing flag in shapeProduct
   - p.active_until → trial_expires_at in shapeProduct
   - p.promotion_priority + p.search_priority → ranking in ORDER BY
══════════════════════════════════════════════════════════════ */
const SEL = `
  p.id,
  p.title,
  p.description,
  p.price,
  p.slug,
  p.status,
  p.active_until,
  p.main_image,
  p.thumbnail_url,
  p.images,
  p.video_url,
  p.attributes,
  p.brand,
  p.model,
  p.condition,
  p.negotiable,
  p.views,
  p.clicks_count,
  p.impression_count,
  p.engagement_score,
  p.search_priority,
  p.promotion_priority,
  p.is_promoted,
  p.is_featured,
  p.favorites_count,
  p.average_rating,
  p.reviews_count,
  p.offer_type,
  p.delivery,
  p.whatsapp,
  p.phone,
  p.created_at,
  p.category_id,
  p.subcategory_id,
  p.seller_id,
  p.seller_name,
  p.stock_status,
  p.stock_quantity,
  p.location_city,
  p.location_state,
  p.location,
  COALESCE(c.name, '') AS category_name
`;

/*
 * GUARD — v2
 *
 * Three changes from v1:
 *   1. status = 'active' → status IN ('active', 'active_limited')
 *      Trial listings are now included in search results.
 *
 *   2. active_until expiry guard added.
 *      Expired trials (active_until < NOW()) are hidden automatically
 *      without needing a cron job to have flipped their status first.
 *      Verified listings have NULL active_until → always shown.
 *
 *   3. is_deleted = false → IS NOT TRUE
 *      Safer — handles rows where is_deleted is NULL.
 */
const GUARD = `
  p.is_active   = TRUE
  AND p.status      IN ${ACTIVE_STATUSES}
  AND p.is_deleted  IS NOT TRUE
  AND (p.active_until IS NULL OR p.active_until > NOW())
`;

const FROM = `
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
`;

/* ══════════════════════════════════════════════════════════════
   GET /api/search
══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  const {
    q           = "",
    page        = 0,
    limit       = 20,
    sort        = "relevance",
    category_id,
    min_price,
    max_price,
    condition,
    state,
    city,
  } = req.query;

  const clean = q.trim();
  if (!clean || clean.length < 2) {
    return res.status(400).json({ error: "Query too short (min 2 chars)" });
  }

  /* ── Cache key ── */
  const cacheKey = [
    "search",
    encodeURIComponent(clean.toLowerCase().slice(0, 40)),
    `p${page}`,
    `l${limit}`,
    sort,
    category_id ? `c${category_id.slice(0, 8)}`                       : "",
    min_price   ? `mn${min_price}`                                      : "",
    max_price   ? `mx${max_price}`                                      : "",
    condition   ? `cd${condition}`                                      : "",
    state       ? `st${state.toLowerCase().replace(/\s/g, "_")}`       : "",
    city        ? `cy${city.toLowerCase().replace(/\s/g, "_")}`        : "",
  ].filter(Boolean).join(":");

  const cached = await cacheGet(cacheKey);
  if (cached) { res.set("X-Cache", "HIT"); return res.json(cached); }
  res.set("X-Cache", "MISS");

  try {
    const realLimit = Math.min(Number(limit) || 20, MAX_LIMIT);
    const offset    = Number(page) * realLimit;

    const values = [];
    const push   = (v) => { values.push(v); return `$${values.length}`; };

    /* $1 = ilike pattern */
    const ilikePat = push(`%${clean}%`);
    /* $2 = tsquery (optional) */
    const tsQuery  = buildTsQuery(clean);
    const tsParam  = tsQuery ? push(tsQuery) : null;

    /* ── WHERE ── */
    const where = [GUARD];

    const tsClause = tsParam
      ? `OR p.search_vector @@ to_tsquery('english', ${tsParam})`
      : "";

    where.push(`(
        p.title       ILIKE ${ilikePat}
     OR p.brand       ILIKE ${ilikePat}
     OR p.model       ILIKE ${ilikePat}
     OR p.description ILIKE ${ilikePat}
     OR c.name        ILIKE ${ilikePat}
     ${tsClause}
    )`);

    if (category_id) where.push(`p.category_id = ${push(category_id)}::uuid`);
    if (condition)   where.push(`LOWER(p.condition)      = LOWER(${push(condition)})`);
    if (state)       where.push(`LOWER(p.location_state) = LOWER(${push(state)})`);
    if (city)        where.push(`LOWER(p.location_city)  = LOWER(${push(city)})`);
    if (min_price)   where.push(`p.price >= ${push(Number(min_price))}`);
    if (max_price)   where.push(`p.price <= ${push(Number(max_price))}`);

    const whereClause = where.join(" AND ");

    /* ══════════════════════════════════════════════════════════
       ORDER BY — v2

       All sort modes now put promoted + subscribed sellers first.

       For relevance:
         promotion_priority (0-4) and search_priority (0-10)
         are added into the score so a subscribed/promoted
         seller always outranks an unverified trial listing
         at the same text relevance level.

       Trial listings (active_limited) have:
         promotion_priority = 0  (no paid promotion)
         search_priority    = 0  (no subscription boost)
       So they appear below verified / subscribed sellers
       automatically — no extra penalty needed.
    ══════════════════════════════════════════════════════════ */
    let orderBy;

    if (sort === "price_asc") {
      orderBy = `
        p.is_promoted        DESC,
        p.promotion_priority DESC,
        p.price              ASC,
        p.engagement_score   DESC
      `;

    } else if (sort === "price_desc") {
      orderBy = `
        p.is_promoted        DESC,
        p.promotion_priority DESC,
        p.price              DESC,
        p.engagement_score   DESC
      `;

    } else if (sort === "newest") {
      orderBy = `
        p.is_promoted        DESC,
        p.promotion_priority DESC,
        p.created_at         DESC
      `;

    } else if (sort === "rating") {
      orderBy = `
        p.is_promoted        DESC,
        p.promotion_priority DESC,
        p.average_rating     DESC,
        p.reviews_count      DESC
      `;

    } else {
      /*
       * relevance — weighted score:
       *
       *   ts_rank       → full-text match quality  (float4 → cast float8)
       *   titleBoost    → exact title match bonus   (0 or 1 → float8)
       *   promoBoost    → promotion_priority / 40   (0–0.1  → float8)
       *   subBoost      → search_priority / 100     (0–0.1  → float8)
       *   engBoost      → engagement_score / 100    (0–1    → float8)
       *
       * Everything cast to float8 to avoid type mismatch between
       * float4 (ts_rank), numeric (engagement_score) and int (CASE).
       *
       * promoBoost and subBoost are small enough that text relevance
       * still wins for the right result — they only act as tiebreakers
       * between equally-relevant results.
       */
      const titleBoost = `
        CAST(
          CASE WHEN LOWER(p.title) LIKE ${ilikePat} THEN 1 ELSE 0 END
        AS float8)
      `;

      const promoBoost = `
        CAST(COALESCE(p.promotion_priority, 0) AS float8) / 40.0::float8
      `;

      const subBoost = `
        CAST(COALESCE(p.search_priority, 0) AS float8) / 100.0::float8
      `;

      const engBoost = `
        CAST(COALESCE(p.engagement_score, 0) AS float8) * 0.01::float8
      `;

      const rankExpr = tsParam
        ? `CAST(
             ts_rank(p.search_vector, to_tsquery('english', ${tsParam}))
           AS float8)`
        : `0.0::float8`;

      orderBy = `
        (
          ${rankExpr}
          + ${titleBoost}
          + ${promoBoost}
          + ${subBoost}
          + ${engBoost}
        ) DESC,
        p.is_promoted  DESC,
        p.created_at   DESC
      `;
    }

    /* ── Pagination params ── */
    const limitParam  = push(realLimit + 1);
    const offsetParam = push(offset);
    const countValues = values.slice(0, values.length - 2);

    /* ── Queries ── */
    const mainSql = `
      SELECT ${SEL}
      ${FROM}
      WHERE  ${whereClause}
      ORDER BY ${orderBy}
      LIMIT  ${limitParam}
      OFFSET ${offsetParam}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      ${FROM}
      WHERE ${whereClause}
    `;

    const [mainRes, countRes] = await Promise.all([
      pool.query(mainSql, values),
      pool.query(countSql, countValues),
    ]);

    const { rows } = mainRes;
    const total    = countRes.rows[0]?.total || 0;
    const hasMore  = rows.length > realLimit;
    const records  = hasMore ? rows.slice(0, realLimit) : rows;
    const products = records.map(shapeProduct);

    /* ── Aggregations ── */
    const aggSql = `
      SELECT
        MIN(p.price)::int AS min_price,
        MAX(p.price)::int AS max_price,

        COALESCE(
          json_agg(DISTINCT p.condition)
            FILTER (WHERE p.condition IS NOT NULL AND p.condition <> ''),
          '[]'
        ) AS conditions,

        COALESCE(
          json_agg(DISTINCT p.location_state)
            FILTER (WHERE p.location_state IS NOT NULL AND p.location_state <> ''),
          '[]'
        ) AS states,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id',   p.category_id::text,
              'name', COALESCE(c.name, '')
            )
          ) FILTER (WHERE p.category_id IS NOT NULL),
          '[]'
        ) AS categories
      ${FROM}
      WHERE ${whereClause}
    `;

    const aggRes = await pool.query(aggSql, countValues);
    const agg    = aggRes.rows[0] ?? {};

    const seenCats  = new Set();
    const cleanCats = (Array.isArray(agg.categories) ? agg.categories : [])
      .filter((c) => c?.id && c?.name)
      .filter((c) => {
        if (seenCats.has(c.id)) return false;
        seenCats.add(c.id);
        return true;
      });

    const payload = {
      products,
      hasMore,
      meta: {
        query    : clean,
        page     : Number(page),
        limit    : realLimit,
        returned : products.length,
        total,
        has_more : hasMore,
        sort,
        filters  : { category_id, min_price, max_price, condition, state, city },
      },
      aggregations: {
        price     : { min: agg.min_price || 0, max: agg.max_price || 0 },
        conditions: Array.isArray(agg.conditions) ? agg.conditions.filter(Boolean) : [],
        states    : Array.isArray(agg.states)     ? agg.states.filter(Boolean)     : [],
        categories: cleanCats,
      },
    };

    await cacheSet(cacheKey, payload, CACHE_TTL);
    return res.json(payload);

  } catch (err) {
    console.error("[search] ERROR:", err.message);
    console.error(err.stack);
    return res.status(500).json({ error: "Search failed", message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/search/related
══════════════════════════════════════════════════════════════ */
router.get("/related", async (req, res) => {
  const { slug, id, category_id, limit = MAX_RELATED } = req.query;

  if (!slug && !id && !category_id) {
    return res.status(400).json({ error: "slug, id or category_id required" });
  }

  const cacheKey = `related:${slug || id || ""}:${category_id || ""}:l${limit}`;
  const cached   = await cacheGet(cacheKey);
  if (cached) { res.set("X-Cache", "HIT"); return res.json(cached); }

  try {
    const values = [];
    const push   = (v) => { values.push(v); return `$${values.length}`; };

    const where = [GUARD];
    if (slug) where.push(`p.slug != ${push(slug)}`);
    if (id)   where.push(`p.id   != ${push(id)}::uuid`);

    /* ── Resolve category ──
       v2: category resolve query also uses GUARD (active + active_limited)
       so it can find the category of a trial listing too.
    ── */
    let catId = category_id || null;
    if (!catId && (slug || id)) {
      const col  = slug ? "slug" : "id";
      const cast = slug ? ""     : "::uuid";
      const r    = await pool.query(
        `SELECT category_id
         FROM   public.products
         WHERE  ${col} = $1${cast}
           AND  is_active  = TRUE
           AND  is_deleted IS NOT TRUE
           AND  status     IN ${ACTIVE_STATUSES}
         LIMIT  1`,
        [slug || id]
      );
      catId = r.rows[0]?.category_id ?? null;
    }
    if (catId) where.push(`p.category_id = ${push(catId)}::uuid`);

    const realLimit  = Math.min(Number(limit), MAX_RELATED);
    const limitParam = push(realLimit);

    const sql = `
      SELECT ${SEL}
      ${FROM}
      WHERE ${where.join(" AND ")}
      ORDER BY
        p.is_promoted        DESC,
        p.promotion_priority DESC,
        p.search_priority    DESC,
        CAST(COALESCE(p.engagement_score, 0) AS float8) DESC,
        p.created_at         DESC
      LIMIT ${limitParam}
    `;

    const { rows } = await pool.query(sql, values);
    const related  = rows.map(shapeProduct);

    const payload = { related, total: related.length };
    await cacheSet(cacheKey, payload, 90);
    return res.json(payload);

  } catch (err) {
    console.error("[search/related] ERROR:", err.message);
    console.error(err.stack);
    return res.status(500).json({
      error  : "Related fetch failed",
      message: err.message,
    });
  }
});

export default router;