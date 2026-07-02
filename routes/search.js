// routes/search.js
import express            from "express";
import { pool }           from "../server.js";
import { cacheGet, cacheSet } from "../lib/redis.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   CACHE TTL
   ══════════════════════════════════════════════════════════════ */
const CACHE_TTL = {
  search     : 30,
  suggestions: 60,
  homepage   : 60,
};

/* ══════════════════════════════════════════════════════════════
   NORMALIZER
   ══════════════════════════════════════════════════════════════ */
const normalizeProduct = (p) => {
  if (!p || !p.id) return null;

  let image = p.main_image || p.thumbnail_url || null;
  const imgs = Array.isArray(p.images) ? p.images : [];
  if (!image && imgs.length > 0) {
    const first = imgs[0];
    image = typeof first === "string" ? first : first?.url || null;
  }

  const impressions = Number(p.impression_count || 0);
  const clicks      = Number(p.clicks_count     || 0);
  const vw          = Number(p.views            || 0);
  const ctr = impressions > 0
    ? clicks / impressions
    : vw > 0 ? clicks / vw : 0;

  const origPrice   = Number(p.attributes?.original_price || 0);
  const currPrice   = Number(p.price || 0);
  const discountPct = origPrice > currPrice && currPrice > 0
    ? Math.round(((origPrice - currPrice) / origPrice) * 100)
    : 0;

  return {
    id                : p.id,
    title             : p.title,
    description       : p.description       || null,
    price             : currPrice,
    slug              : p.slug,
    views             : vw,
    clicks_count      : clicks,
    impression_count  : impressions,
    engagement_score  : Number(p.engagement_score  || 0),
    promotion_priority: Number(p.promotion_priority || 0),
    promotion_type    : p.promotion_type    || null,
    is_promoted       : !!p.is_promoted,
    is_featured       : !!p.is_featured,
    favorites_count   : Number(p.favorites_count   || 0),
    average_rating    : Number(p.average_rating    || 0),
    reviews_count     : Number(p.reviews_count     || 0),
    offer_type        : p.offer_type        || null,
    negotiable        : !!p.negotiable,
    condition         : p.condition         || null,
    brand             : p.brand             || null,
    created_at        : p.created_at,
    category_id       : p.category_id       || null,
    category_name     : p.category_name     || null,
    seller_id         : p.seller_id         || null,
    seller_name       : p.seller_name       || null,
    image,
    images : imgs.length > 0 ? imgs : image ? [image] : [],
    attributes : p.attributes  || {},
    location_city  : p.location_city  || null,
    location_state : p.location_state || null,
    location: {
      city : p.location_city  || null,
      state: p.location_state || null,
      label: [p.location_city, p.location_state]
               .filter(Boolean).join(", ") || null,
    },
    seller: {
      id      : p.seller_id   || null,
      name    : p.seller_name || null,
      verified: !!p.seller_verified,
    },
    ctr,
    discount_pct  : discountPct,
    original_price: origPrice || null,
    distance_km   : p.distance_km != null ? Number(p.distance_km) : null,
  };
};

/* ══════════════════════════════════════════════════════════════
   BASE SELECT
   ══════════════════════════════════════════════════════════════ */
const BASE_SELECT = `
  SELECT
    p.id, p.slug, p.title, p.description, p.price,
    p.main_image, p.thumbnail_url,
    p.views, p.clicks_count, p.impression_count,
    p.engagement_score, p.promotion_priority, p.promotion_type,
    p.is_promoted, p.is_featured, p.favorites_count,
    p.average_rating, p.reviews_count,
    p.offer_type, p.negotiable, p.condition, p.brand,
    p.created_at, p.category_id, p.seller_id, p.seller_name,
    p.location_city, p.location_state,
    p.attributes,
    c.name AS category_name,
    COALESCE(s.is_verified, false) AS seller_verified,
    COALESCE(
      (
        SELECT json_agg(pi.image_url ORDER BY pi.position)
        FROM product_images pi
        WHERE pi.product_id = p.id
          AND pi.image_url IS NOT NULL
      ),
      CASE
        WHEN p.main_image IS NOT NULL
        THEN json_build_array(p.main_image)
        ELSE '[]'::json
      END
    ) AS images
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  LEFT JOIN public.sellers    s ON s.id = p.seller_id
`;

const BASE_WHERE = `p.is_active = true AND p.status = 'active' AND p.is_deleted = false`;

/* ══════════════════════════════════════════════════════════════
   ✅ PROMOTED FIRST — prepended to every ORDER BY
   ══════════════════════════════════════════════════════════════ */
const PROMOTED_FIRST = `p.is_promoted DESC, p.promotion_priority DESC NULLS LAST`;

/* ══════════════════════════════════════════════════════════════
   SORT MAP  — every option leads with promoted
   ══════════════════════════════════════════════════════════════ */
const SORT_MAP = {
  relevance  : `${PROMOTED_FIRST}, p.engagement_score DESC, p.views DESC, p.created_at DESC`,
  newest     : `${PROMOTED_FIRST}, p.created_at DESC`,
  price_low  : `${PROMOTED_FIRST}, p.price ASC, p.created_at DESC`,
  price_high : `${PROMOTED_FIRST}, p.price DESC, p.created_at DESC`,
  popular    : `${PROMOTED_FIRST}, p.views DESC NULLS LAST, p.engagement_score DESC`,
  promoted   : `${PROMOTED_FIRST}, p.engagement_score DESC, p.created_at DESC`,
  /* legacy */
  price      : `${PROMOTED_FIRST}, p.price ASC`,
  price_desc : `${PROMOTED_FIRST}, p.price DESC`,
  views      : `${PROMOTED_FIRST}, p.views DESC NULLS LAST`,
  engagement : `${PROMOTED_FIRST}, p.engagement_score DESC`,
};

/* ══════════════════════════════════════════════════════════════
   CACHE KEY
   ══════════════════════════════════════════════════════════════ */
function searchCacheKey(p) {
  return [
    "srch",
    p.q        ? `q${p.q.slice(0, 40).replace(/\s+/g, "_")}`  : "",
    p.category ? `cat${p.category.slice(0, 12)}`              : "",
    p.price_min? `mn${p.price_min}`                           : "",
    p.price_max? `mx${p.price_max}`                           : "",
    p.condition? `cnd${p.condition}`                          : "",
    p.location ? `loc${p.location.slice(0, 20)}`              : "",
    p.sort     ? `s${p.sort}`                                 : "",
    `p${p.page}`,
    `l${p.limit}`,
  ].filter(Boolean).join(":");
}

/* ══════════════════════════════════════════════════════════════
   GET /api/search  — main search
   ══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  const {
    q         = "",
    category,
    price_min,
    price_max,
    condition,
    location,
    state,
    sort      = "relevance",
    page      = "1",
    limit     = "24",
    promoted,
  } = req.query;

  const query      = String(q).trim().toLowerCase();
  const locFilter  = location || state || "";
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage     = Math.min(80, Math.max(1, parseInt(limit, 10) || 24));
  const offset      = (currentPage - 1) * perPage;
  const orderBy     = SORT_MAP[sort] || SORT_MAP.relevance;

  const cacheKey = searchCacheKey({
    q: query, category, price_min, price_max,
    condition, location: locFilter, sort, page, limit,
  });

  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.set("X-Cache", "HIT");
    return res.json(cached);
  }
  res.set("X-Cache", "MISS");

  try {
    const values = [];
    const where  = [BASE_WHERE];
    const push   = (v) => { values.push(v); return `$${values.length}`; };

    /* ── Text search with relevance score ── */
    let searchScore = "0";

    if (query) {
      const likeVal = push(`%${query}%`);
      const prefVal = push(`${query}%`);

      where.push(`(
        LOWER(p.title)                             LIKE ${likeVal}
        OR LOWER(COALESCE(p.description, ''))      LIKE ${likeVal}
        OR LOWER(COALESCE(p.brand, ''))            LIKE ${likeVal}
        OR LOWER(COALESCE(p.seller_name, ''))      LIKE ${likeVal}
        OR LOWER(COALESCE(p.location_city, ''))    LIKE ${likeVal}
        OR LOWER(COALESCE(p.location_state, ''))   LIKE ${likeVal}
      )`);

      searchScore = `(
        CASE WHEN LOWER(p.title)               LIKE ${prefVal} THEN 40 ELSE 0 END +
        CASE WHEN LOWER(p.title)               LIKE ${likeVal} THEN 20 ELSE 0 END +
        CASE WHEN LOWER(COALESCE(p.brand,''))  LIKE ${prefVal} THEN 10 ELSE 0 END +
        CASE WHEN LOWER(COALESCE(p.description,'')) LIKE ${likeVal} THEN 5 ELSE 0 END
      )`;
    }

    /* ── Filters ── */
    if (category) {
      where.push(`(p.category_id = ${push(category)}::uuid OR LOWER(c.name) = LOWER(${push(category)}))`);
    }
    if (price_min) where.push(`p.price >= ${push(Number(price_min))}`);
    if (price_max) where.push(`p.price <= ${push(Number(price_max))}`);
    if (condition) {
      where.push(`LOWER(COALESCE(p.condition,'')) = LOWER(${push(condition)})`);
    }
    if (locFilter) {
      where.push(`(
        LOWER(COALESCE(p.location_city, ''))  LIKE LOWER(${push(`%${locFilter}%`)})
        OR LOWER(COALESCE(p.location_state,'')) LIKE LOWER(${push(`%${locFilter}%`)})
      )`);
    }
    if (promoted === "true") where.push(`p.is_promoted = true`);

    const whereClause = `WHERE ${where.join(" AND ")}`;

    /* ── ✅ Final ORDER: promoted first, then relevance score, then base ── */
    let finalOrder = orderBy;
    if (query && sort === "relevance") {
      finalOrder = `${PROMOTED_FIRST}, (${searchScore}) DESC, p.engagement_score DESC, p.created_at DESC`;
    }

    /* ── Pagination ── */
    values.push(perPage + 1);
    const limitP  = `$${values.length}`;
    values.push(offset);
    const offsetP = `$${values.length}`;
    const countValues = values.slice(0, values.length - 2);

    /* ── Parallel queries ── */
    const [resultRows, countRow, suggestionRows] = await Promise.all([
      pool.query(
        `${BASE_SELECT} ${whereClause}
         ORDER BY ${finalOrder}
         LIMIT ${limitP} OFFSET ${offsetP}`,
        values
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM public.products p
         LEFT JOIN public.categories c ON c.id = p.category_id
         ${whereClause}`,
        countValues
      ),
      query
        ? pool.query(
            `SELECT DISTINCT LEFT(p.title, 60) AS title, p.views
             FROM public.products p
             WHERE p.is_active = true AND p.status = 'active'
               AND p.is_deleted = false
               AND LOWER(p.title) LIKE $1
             ORDER BY p.views DESC NULLS LAST
             LIMIT 8`,
            [`%${query}%`]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const rows    = resultRows.rows;
    const hasMore = rows.length > perPage;
    const records = hasMore ? rows.slice(0, perPage) : rows;
    const total   = countRow.rows[0]?.total ?? 0;

    const payload = {
      query,
      total,
      page        : currentPage,
      perPage,
      totalPages  : Math.ceil(total / perPage),
      has_more    : hasMore,
      products    : records.map(normalizeProduct).filter(Boolean),
      suggestions : suggestionRows.rows.map((r) => r.title),
      filters: {
        category  : category  || null,
        price_min : price_min || null,
        price_max : price_max || null,
        condition : condition || null,
        location  : locFilter || null,
        sort,
      },
    };

    await cacheSet(cacheKey, payload, CACHE_TTL.search);
    return res.json(payload);

  } catch (err) {
    console.error("[search] ERROR:", err.message);
    return res.status(500).json({
      products   : [],
      total      : 0,
      suggestions: [],
      message    : "Search failed",
      error      : process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/search/suggestions
   ══════════════════════════════════════════════════════════════ */
router.get("/suggestions", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (q.length < 2) return res.json({ suggestions: [] });

  const cacheKey = `sug:${q.slice(0, 30)}`;
  const cached   = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT
         LEFT(p.title, 60)  AS suggestion,
         c.name             AS category_name
       FROM public.products p
       LEFT JOIN public.categories c ON c.id = p.category_id
       WHERE p.is_active = true AND p.status = 'active' AND p.is_deleted = false
         AND LOWER(p.title) LIKE $1
       ORDER BY p.views DESC NULLS LAST, p.engagement_score DESC
       LIMIT 10`,
      [`%${q}%`]
    );

    const payload = {
      suggestions: rows.map((r) => ({
        text    : r.suggestion,
        category: r.category_name || null,
      })),
    };

    await cacheSet(cacheKey, payload, CACHE_TTL.suggestions);
    return res.json(payload);
  } catch (err) {
    console.error("[search/suggestions] ERROR:", err.message);
    return res.json({ suggestions: [] });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/search/homepage
   ══════════════════════════════════════════════════════════════ */
router.get("/homepage", async (req, res) => {
  const { lat, lng, page = "0", limit = "40" } = req.query;

  const hasCoords = !!(lat && lng);
  const realLimit = Math.min(80, parseInt(limit, 10) || 40);
  const offset    = parseInt(page, 10) * realLimit;

  const cacheKey = `srch:hp:p${page}:l${limit}${hasCoords ? ":gps" : ""}`;
  const cached   = await cacheGet(cacheKey);
  if (cached) {
    res.set("X-Cache", "HIT");
    return res.json(cached);
  }
  res.set("X-Cache", "MISS");

  try {
    const distanceSQL = hasCoords
      ? `ROUND((6371 * acos(LEAST(1.0,
           cos(radians(${parseFloat(lat)}))
           * cos(radians(COALESCE(p.latitude, 0)))
           * cos(radians(COALESCE(p.longitude, 0)) - radians(${parseFloat(lng)}))
           + sin(radians(${parseFloat(lat)}))
           * sin(radians(COALESCE(p.latitude, 0)))
         )))::numeric, 1) AS distance_km`
      : `NULL::numeric AS distance_km`;

    const [mainResult, countResult, featuredResult] = await Promise.all([

      /* ✅ Promoted first */
      pool.query(
        `${BASE_SELECT}, ${distanceSQL}
         WHERE ${BASE_WHERE}
         ORDER BY
           p.is_promoted        DESC,
           p.promotion_priority DESC NULLS LAST,
           p.engagement_score   DESC,
           p.created_at         DESC
         LIMIT $1 OFFSET $2`,
        [realLimit + 1, offset]
      ),

      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM public.products p
         WHERE ${BASE_WHERE}`
      ),

      pool.query(
        `${BASE_SELECT}
         WHERE ${BASE_WHERE}
           AND p.is_promoted = true
           AND (p.promotion_expires_at IS NULL OR p.promotion_expires_at > NOW())
         ORDER BY p.promotion_priority DESC, p.engagement_score DESC
         LIMIT 6`
      ),
    ]);

    const rows    = mainResult.rows;
    const hasMore = rows.length > realLimit;
    const records = hasMore ? rows.slice(0, realLimit) : rows;
    const total   = countResult.rows[0]?.total ?? 0;

    const products = records.map(normalizeProduct).filter(Boolean);
    const featured = featuredResult.rows.map(normalizeProduct).filter(Boolean);

    const cityFreq = {};
    for (const p of products) {
      if (p.location_city)
        cityFreq[p.location_city] = (cityFreq[p.location_city] || 0) + 1;
    }
    const topCity = Object.entries(cityFreq)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const payload = {
      products,
      featured,
      hasMore,
      meta: {
        page         : parseInt(page, 10),
        limit        : realLimit,
        returned     : products.length,
        total,
        has_more     : hasMore,
        location     : topCity,
        nearbySource : hasCoords ? "gps" : null,
        section      : "all",
      },
    };

    await cacheSet(cacheKey, payload, CACHE_TTL.homepage);
    return res.json(payload);

  } catch (err) {
    console.error("[search/homepage] ERROR:", err.message);
    return res.status(500).json({
      products: [], featured: [], hasMore: false,
      meta: { total: 0, returned: 0 },
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/search/trending
   ══════════════════════════════════════════════════════════════ */
router.get("/trending", async (req, res) => {
  const { limit = "20" } = req.query;
  const realLimit = Math.min(50, parseInt(limit, 10) || 20);
  const cacheKey  = `srch:trend:l${realLimit}`;

  const cached = await cacheGet(cacheKey);
  if (cached) { res.set("X-Cache", "HIT"); return res.json(cached); }

  try {
    const { rows } = await pool.query(
      `${BASE_SELECT}
       WHERE ${BASE_WHERE}
         AND (p.engagement_score > 0 OR p.views > 5)
       ORDER BY
         p.is_promoted        DESC,
         p.promotion_priority DESC NULLS LAST,
         p.engagement_score   DESC,
         p.views              DESC,
         p.created_at         DESC
       LIMIT $1`,
      [realLimit]
    );

    const payload = { products: rows.map(normalizeProduct).filter(Boolean) };
    await cacheSet(cacheKey, payload, 90);
    res.set("X-Cache", "MISS");
    return res.json(payload);
  } catch (err) {
    console.error("[search/trending]", err.message);
    return res.status(500).json({ products: [] });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/search/deals
   ══════════════════════════════════════════════════════════════ */
router.get("/deals", async (req, res) => {
  const { limit = "40", page = "0" } = req.query;
  const realLimit = Math.min(80, parseInt(limit, 10) || 40);
  const offset    = parseInt(page, 10) * realLimit;
  const cacheKey  = `srch:deals:p${page}:l${realLimit}`;

  const cached = await cacheGet(cacheKey);
  if (cached) { res.set("X-Cache", "HIT"); return res.json(cached); }

  try {
    const { rows } = await pool.query(
      `${BASE_SELECT}
       WHERE ${BASE_WHERE}
         AND p.price > 0
         AND p.price <= 50000
       ORDER BY
         p.is_promoted        DESC,
         p.promotion_priority DESC NULLS LAST,
         p.price              ASC,
         p.engagement_score   DESC
       LIMIT $1 OFFSET $2`,
      [realLimit + 1, offset]
    );

    const hasMore = rows.length > realLimit;
    const records = hasMore ? rows.slice(0, realLimit) : rows;

    const payload = {
      products: records.map(normalizeProduct).filter(Boolean),
      hasMore,
      meta: { page: parseInt(page, 10), returned: records.length },
    };

    await cacheSet(cacheKey, payload, 120);
    res.set("X-Cache", "MISS");
    return res.json(payload);
  } catch (err) {
    console.error("[search/deals]", err.message);
    return res.status(500).json({ products: [], hasMore: false });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/search/nearby
   ══════════════════════════════════════════════════════════════ */
router.get("/nearby", async (req, res) => {
  const {
    lat, lng,
    state, city,
    limit = "40",
    page  = "0",
  } = req.query;

  const realLimit  = Math.min(80, parseInt(limit, 10) || 40);
  const offset     = parseInt(page, 10) * realLimit;
  const hasCoords  = !!(lat && lng);

  const cacheKey = (state || city) && !hasCoords
    ? `srch:nearby:${state || ""}:${city || ""}:p${page}:l${realLimit}`
    : null; // never cache GPS results

  if (cacheKey) {
    const cached = await cacheGet(cacheKey);
    if (cached) { res.set("X-Cache", "HIT"); return res.json(cached); }
  }

  try {
    const values = [realLimit + 1, offset];
    const where  = [BASE_WHERE];

    if (city) {
      values.push(city);
      where.push(`LOWER(p.location_city) = LOWER($${values.length})`);
    } else if (state) {
      values.push(state);
      where.push(`LOWER(p.location_state) = LOWER($${values.length})`);
    }

    const whereClause = `WHERE ${where.join(" AND ")}`;

    let distanceSQL = `NULL::numeric AS distance_km`;
    let orderBy     = `${PROMOTED_FIRST}, p.created_at DESC`;

    if (hasCoords) {
      const latN = parseFloat(lat);
      const lngN = parseFloat(lng);

      distanceSQL = `ROUND((6371 * acos(LEAST(1.0,
        cos(radians(${latN}))
        * cos(radians(COALESCE(p.latitude, 0)))
        * cos(radians(COALESCE(p.longitude, 0)) - radians(${lngN}))
        + sin(radians(${latN}))
        * sin(radians(COALESCE(p.latitude, 0)))
      )))::numeric, 1) AS distance_km`;

      /* ✅ Promoted first, then nearest */
      orderBy = `${PROMOTED_FIRST}, distance_km ASC NULLS LAST, p.created_at DESC`;
    }

    const { rows } = await pool.query(
      `${BASE_SELECT}, ${distanceSQL}
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      values
    );

    const hasMore = rows.length > realLimit;
    const records = hasMore ? rows.slice(0, realLimit) : rows;

    const payload = {
      products: records.map(normalizeProduct).filter(Boolean),
      hasMore,
      meta: {
        page         : parseInt(page, 10),
        returned     : records.length,
        nearbySource : hasCoords ? "gps" : "manual",
        location     : city || state || null,
      },
    };

    if (cacheKey) await cacheSet(cacheKey, payload, 30);
    res.set("X-Cache", "MISS");
    return res.json(payload);

  } catch (err) {
    console.error("[search/nearby]", err.message);
    return res.status(500).json({ products: [], hasMore: false });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/search/latest
   ══════════════════════════════════════════════════════════════ */
router.get("/latest", async (req, res) => {
  const { limit = "40", page = "0", category } = req.query;
  const realLimit = Math.min(80, parseInt(limit, 10) || 40);
  const offset    = parseInt(page, 10) * realLimit;
  const cacheKey  = `srch:latest:${category || "all"}:p${page}:l${realLimit}`;

  const cached = await cacheGet(cacheKey);
  if (cached) { res.set("X-Cache", "HIT"); return res.json(cached); }

  try {
    const values = [realLimit + 1, offset];
    const where  = [BASE_WHERE];

    if (category) {
      values.push(category);
      where.push(`(p.category_id = $${values.length}::uuid OR LOWER(c.name) = LOWER($${values.length}))`);
    }

    const whereClause = `WHERE ${where.join(" AND ")}`;

    const { rows } = await pool.query(
      `${BASE_SELECT}
       ${whereClause}
       ORDER BY
         p.is_promoted        DESC,
         p.promotion_priority DESC NULLS LAST,
         p.created_at         DESC
       LIMIT $1 OFFSET $2`,
      values
    );

    const hasMore = rows.length > realLimit;
    const records = hasMore ? rows.slice(0, realLimit) : rows;

    const payload = {
      products: records.map(normalizeProduct).filter(Boolean),
      hasMore,
      meta: { page: parseInt(page, 10), returned: records.length },
    };

    await cacheSet(cacheKey, payload, 30);
    res.set("X-Cache", "MISS");
    return res.json(payload);
  } catch (err) {
    console.error("[search/latest]", err.message);
    return res.status(500).json({ products: [], hasMore: false });
  }
});

export default router;