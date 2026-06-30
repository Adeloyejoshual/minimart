// server/routes/homepage.js
import express               from "express";
import { pool }              from "../config/db.js";
import { cacheGet, cacheSet} from "../lib/redis.js";
import { reverseGeocode }    from "../lib/geocode.js";
import {
  SECTION_CONFIG,
  buildMainQuery,
  buildCountQuery,
  buildFeaturedQuery,
  buildCacheKey,
  normalizeRow,
}                            from "../lib/queryBuilder.js";
import { homepageLimiter }   from "../middleware/rateLimit.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════
   VALIDATION HELPERS
   ══════════════════════════════════════════════════════════ */
const VALID_SECTIONS = new Set([
  "all", "deals", "trending", "latest", "nearby",
]);

const VALID_SORTS = new Set([
  "price_asc", "price_desc", "engagement_desc",
  "created_desc", "discount_desc", "distance_asc",
]);

function parseCoords(lat, lng) {
  const latN = parseFloat(lat);
  const lngN = parseFloat(lng);
  if (
    isNaN(latN) || isNaN(lngN) ||
    latN < -90  || latN > 90   ||
    lngN < -180 || lngN > 180
  ) return null;
  return { lat: latN, lng: lngN };
}

function sanitize(params) {
  const {
    section     = "all",
    page        = "0",
    limit       = "40",
    category_id,
    lat, lng,
    max_price, min_price,
    sort,
    state, city,
    seller_id,
  } = params;

  return {
    section     : VALID_SECTIONS.has(section) ? section : "all",
    page        : Math.max(0, parseInt(page,  10) || 0),
    limit       : Math.min(80, Math.max(1, parseInt(limit, 10) || 40)),
    category_id : category_id || null,
    coords      : lat && lng ? parseCoords(lat, lng) : null,
    max_price   : max_price   ? Number(max_price)   : null,
    min_price   : min_price   ? Number(min_price)   : null,
    sort        : VALID_SORTS.has(sort) ? sort : null,
    state       : state  ? String(state).trim().slice(0, 100)  : null,
    city        : city   ? String(city).trim().slice(0, 100)   : null,
    seller_id   : seller_id || null,
  };
}

/* ══════════════════════════════════════════════════════════
   GET /api/homepage
   ══════════════════════════════════════════════════════════ */
router.get("/", homepageLimiter, async (req, res) => {
  const p = sanitize(req.query);
  const {
    section, page, limit,
    category_id, coords,
    max_price, min_price,
    sort, state, city, seller_id,
  } = p;

  /* ── Cache key ──────────────────────────────────────── */
  const cacheKey = buildCacheKey({
    section, page, limit,
    category_id,
    max_price, min_price,
    sort, state, city,
    lat: coords?.lat,
    lng: coords?.lng,
  });

  /* ── Try cache ──────────────────────────────────────── */
  if (cacheKey) {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.set("X-Cache", "HIT");
      return res.json(cached);
    }
  }

  res.set("X-Cache", "MISS");

  try {
    /* ── Build queries ────────────────────────────────── */
    const queryParams = {
      section, page, limit,
      category_id,
      lat: coords?.lat,
      lng: coords?.lng,
      max_price, min_price,
      sort, state, city,
      seller_id,
    };

    const { sql: mainSql, values: mainValues, realLimit } =
      buildMainQuery(queryParams);

    const { sql: countSql, values: countValues } =
      buildCountQuery(queryParams);

    /* ── Run queries in parallel ──────────────────────── */
    const [mainResult, countResult, featuredResult, geoResult] =
      await Promise.all([
        /* Main product feed */
        pool.query(mainSql, mainValues),

        /* Total count (for meta.total) */
        pool.query(countSql, countValues),

        /* Featured — only homepage page 0 */
        section === "all" && page === 0
          ? pool.query(buildFeaturedQuery())
          : Promise.resolve({ rows: [] }),

        /* Reverse geocode — only when GPS given */
        coords
          ? reverseGeocode(coords.lat, coords.lng)
          : Promise.resolve(null),
      ]);

    /* ── Detect hasMore (fetched limit+1) ─────────────── */
    const rows    = mainResult.rows;
    const hasMore = rows.length > realLimit;
    const records = hasMore ? rows.slice(0, realLimit) : rows;
    const total   = parseInt(countResult.rows[0]?.count || "0", 10);

    /* ── Normalize products ───────────────────────────── */
    const products = records.map(normalizeRow);

    /* ── Normalize featured ───────────────────────────── */
    const featured = featuredResult.rows.map(normalizeRow);

    /* ── Representative location from results ─────────── */
    const cityFreq = {};
    for (const p of products) {
      if (p.location_city) {
        cityFreq[p.location_city] =
          (cityFreq[p.location_city] || 0) + 1;
      }
    }
    const topCity =
      Object.entries(cityFreq)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    /* ── Location label ───────────────────────────────── */
    const locationLabel =
      geoResult?.label ||
      (state && city  ? `${city}, ${state}` : null) ||
      (state          ? state                : null) ||
      topCity         ||
      null;

    /* ── Build response ───────────────────────────────── */
    const payload = {
      products,
      featured,
      meta: {
        section      : section,
        page         : page,
        limit        : realLimit,
        returned     : products.length,
        total,
        has_more     : hasMore,
        /* Location */
        location     : locationLabel,
        nearbySource : coords
          ? "gps"
          : (state || city) ? "manual" : null,
        /* Filters active */
        filters: {
          category_id : category_id || null,
          max_price   : max_price   || null,
          min_price   : min_price   || null,
          sort        : sort        || null,
          state       : state       || null,
          city        : city        || null,
        },
      },
    };

    /* ── Cache response ───────────────────────────────── */
    if (cacheKey) {
      const cfg = SECTION_CONFIG[section] || SECTION_CONFIG.all;
      await cacheSet(cacheKey, payload, cfg.cacheTTL);
    }

    return res.status(200).json(payload);

  } catch (err) {
    console.error("[GET /api/homepage]", err);
    return res.status(500).json({
      error  : "Failed to load products",
      message: process.env.NODE_ENV === "development"
        ? err.message : undefined,
    });
  }
});

/* ══════════════════════════════════════════════════════════
   POST /api/products/:id/view
   POST /api/products/:id/click
   ══════════════════════════════════════════════════════════ */
import { analyticsLimiter } from "../middleware/rateLimit.js";

router.post(
  "/products/:id/view",
  analyticsLimiter,
  async (req, res) => {
    const { id } = req.params;
    if (!id) return res.sendStatus(400);

    try {
      await pool.query(
        `UPDATE public.products
         SET views            = COALESCE(views, 0) + 1,
             impression_count = COALESCE(impression_count, 0) + 1,
             engagement_score = LEAST(100,
               COALESCE(engagement_score, 0) + 0.1
             )
         WHERE id = $1::uuid
           AND is_active = true`,
        [id]
      );
      return res.sendStatus(204);
    } catch {
      return res.sendStatus(204); // silent — analytics shouldn't block UX
    }
  }
);

router.post(
  "/products/:id/click",
  analyticsLimiter,
  async (req, res) => {
    const { id } = req.params;
    if (!id) return res.sendStatus(400);

    try {
      await pool.query(
        `UPDATE public.products
         SET clicks_count    = COALESCE(clicks_count, 0) + 1,
             engagement_score = LEAST(100,
               COALESCE(engagement_score, 0) + 0.5
             )
         WHERE id = $1::uuid
           AND is_active = true`,
        [id]
      );
      return res.sendStatus(204);
    } catch {
      return res.sendStatus(204);
    }
  }
);

/* ══════════════════════════════════════════════════════════
   POST /api/analytics/batch
   Receives batched click/view events from frontend queue
   ══════════════════════════════════════════════════════════ */
router.post(
  "/analytics/batch",
  analyticsLimiter,
  async (req, res) => {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.sendStatus(400);
    }

    /* Cap batch size */
    const batch = events.slice(0, 50);

    try {
      /* Group by type */
      const views  = batch.filter((e) => e.type === "view")
                          .map((e) => e.id);
      const clicks = batch.filter((e) => e.type === "click")
                          .map((e) => e.id);

      const updates = [];

      if (views.length > 0) {
        updates.push(
          pool.query(
            `UPDATE public.products
             SET views            = COALESCE(views, 0) + 1,
                 impression_count = COALESCE(impression_count, 0) + 1,
                 engagement_score = LEAST(100,
                   COALESCE(engagement_score, 0) + 0.1
                 )
             WHERE id = ANY($1::uuid[])
               AND is_active = true`,
            [views]
          )
        );
      }

      if (clicks.length > 0) {
        updates.push(
          pool.query(
            `UPDATE public.products
             SET clicks_count    = COALESCE(clicks_count, 0) + 1,
                 engagement_score = LEAST(100,
                   COALESCE(engagement_score, 0) + 0.5
                 )
             WHERE id = ANY($1::uuid[])
               AND is_active = true`,
            [clicks]
          )
        );
      }

      await Promise.all(updates);
      return res.sendStatus(204);
    } catch {
      return res.sendStatus(204);
    }
  }
);

export default router;