// routes/search.js
import express from "express";
import { pool } from "../config/db.js";
import { cacheGet, cacheSet } from "../lib/redis.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════ */
const CACHE_TTL   = 60;
const MAX_LIMIT   = 40;
const MAX_RELATED = 8;

/* ══════════════════════════════════════════════════════════════
   SHAPE PRODUCT
   ══════════════════════════════════════════════════════════════ */
function shapeProduct(p) {
  let image = p.main_image || p.thumbnail_url || null;

  if (!image && Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    if (typeof first === "string") image = first;
    else if (first?.url)           image = first.url;
  }

  let imagesArr = [];
  if (Array.isArray(p.images) && p.images.length > 0) {
    imagesArr = p.images
      .map((img) => (typeof img === "string" ? img : img?.url || null))
      .filter(Boolean);
  } else if (image) {
    imagesArr = [image];
  }

  const impressions = Number(p.impression_count || 0);
  const clicks      = Number(p.clicks_count     || 0);
  const vw          = Number(p.views            || 0);
  const ctr = impressions > 0
    ? clicks / impressions
    : vw > 0 ? clicks / vw : 0;

  const origPrice = Number(p.attributes?.original_price || 0);
  const currPrice = Number(p.price || 0);
  const discountPct =
    origPrice > currPrice && currPrice > 0
      ? Math.round(((origPrice - currPrice) / origPrice) * 100)
      : 0;

  return {
    id               : p.id,
    title            : p.title,
    description      : p.description,
    price            : currPrice,
    slug             : p.slug,
    image,
    images           : imagesArr,
    video_url        : p.video_url    || null,
    attributes       : p.attributes  || {},
    brand            : p.brand       || null,
    model            : p.model       || null,
    condition        : p.condition   || null,
    negotiable       : p.negotiable  || false,
    views            : vw,
    clicks_count     : clicks,
    impression_count : impressions,
    engagement_score : Number(p.engagement_score  || 0),
    is_promoted      : !!p.is_promoted,
    is_featured      : !!p.is_featured,
    favorites_count  : Number(p.favorites_count   || 0),
    average_rating   : Number(p.average_rating    || 0),
    reviews_count    : Number(p.reviews_count     || 0),
    offer_type       : p.offer_type  || null,
    delivery         : p.delivery    || null,
    whatsapp         : p.whatsapp    || null,
    phone            : p.phone       || null,
    created_at       : p.created_at,
    category_id      : p.category_id    || null,
    category_name    : p.category_name  || null,
    subcategory_id   : p.subcategory_id || null,
    seller_id        : p.seller_id   || null,
    seller_name      : p.seller_name || null,
    stock_status     : p.stock_status || null,
    ctr,
    discount_pct     : discountPct,
    location_city    : p.location_city  || null,
    location_state   : p.location_state || null,
    location: {
      city  : p.location_city  || null,
      state : p.location_state || null,
      label : [p.location_city, p.location_state]
                .filter(Boolean).join(", ") || null,
    },
    seller: {
      id   : p.seller_id   || null,
      name : p.seller_name || null,
    },
  };
}

/* ══════════════════════════════════════════════════════════════
   SAFE TS-QUERY BUILDER
   Converts "iphone 14 pro" → "iphone:* & 14:* & pro:*"
   Strips characters that break to_tsquery
   ══════════════════════════════════════════════════════════════ */
function buildTsQuery(raw) {
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")   // remove punctuation
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return null;
  return words.map((w) => `${w}:*`).join(" & ");
}

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
    category_id ? `c${category_id.slice(0, 8)}` : "",
    min_price   ? `mn${min_price}`   : "",
    max_price   ? `mx${max_price}`   : "",
    condition   ? `cd${condition}`   : "",
    state ? `st${state.toLowerCase().replace(/\s/g, "_")}` : "",
    city  ? `cy${city.toLowerCase().replace(/\s/g, "_")}`  : "",
  ].filter(Boolean).join(":");

  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.set("X-Cache", "HIT");
    return res.json(cached);
  }
  res.set("X-Cache", "MISS");

  try {
    const realLimit = Math.min(Number(limit) || 20, MAX_LIMIT);
    const offset    = Number(page) * realLimit;

    /* ── Parameter array ── */
    const values = [];
    const push   = (v) => { values.push(v); return `$${values.length}`; };

    /* ── $1 = ILIKE pattern  $2 = tsquery string ── */
    const ilikePat = push(`%${clean}%`);          // $1
    const tsQuery  = buildTsQuery(clean);
    const tsParam  = tsQuery ? push(tsQuery) : null; // $2  (may be null)

    /* ── Base active guard ── */
    const where = [
      `p.is_active  = true`,
      `p.status     = 'active'`,
      `p.is_deleted = false`,
    ];

    /* ── Full-text / ILIKE search clause ── */
    const tsClause = tsParam
      ? `OR  to_tsvector('english',
               COALESCE(p.title,'')       || ' ' ||
               COALESCE(p.brand,'')       || ' ' ||
               COALESCE(p.model,'')       || ' ' ||
               COALESCE(p.description,'')
             ) @@ to_tsquery('english', ${tsParam})`
      : "";

    where.push(`(
        p.title         ILIKE ${ilikePat}
     OR p.brand         ILIKE ${ilikePat}
     OR p.model         ILIKE ${ilikePat}
     OR p.description   ILIKE ${ilikePat}
     OR p.category_name ILIKE ${ilikePat}
     ${tsClause}
    )`);

    /* ── Optional filters ── */
    if (category_id) {
      where.push(`p.category_id = ${push(category_id)}::uuid`);
    }
    if (condition) {
      where.push(`LOWER(p.condition) = LOWER(${push(condition)})`);
    }
    if (state) {
      where.push(`LOWER(p.location_state) = LOWER(${push(state)})`);
    }
    if (city) {
      where.push(`LOWER(p.location_city) = LOWER(${push(city)})`);
    }
    if (min_price) {
      where.push(`p.price >= ${push(Number(min_price))}`);
    }
    if (max_price) {
      where.push(`p.price <= ${push(Number(max_price))}`);
    }

    const whereClause = where.join(" AND ");

    /* ── ORDER BY ── */
    /*
       For relevance we inline the ts_rank using the SAME param indices
       ($1 for ilike, $2 for tsquery) — they are already in values[].
       We must NOT push new values for the ORDER BY expression.
    */
    let orderBy;
    if (sort === "price_asc") {
      orderBy = `p.price ASC, p.engagement_score DESC`;
    } else if (sort === "price_desc") {
      orderBy = `p.price DESC, p.engagement_score DESC`;
    } else if (sort === "newest") {
      orderBy = `p.created_at DESC`;
    } else if (sort === "rating") {
      orderBy = `p.average_rating DESC, p.reviews_count DESC`;
    } else {
      /* relevance — reuse $1 and $2 already in the param list */
      const titleBoost = `CASE WHEN LOWER(p.title) LIKE ${ilikePat} THEN 0.5 ELSE 0 END`;
      const rankExpr   = tsParam
        ? `ts_rank(
             to_tsvector('english',
               COALESCE(p.title,'') || ' ' ||
               COALESCE(p.brand,'') || ' ' ||
               COALESCE(p.model,'')
             ),
             to_tsquery('english', ${tsParam})
           )`
        : "0";

      orderBy = `
        (${rankExpr} + ${titleBoost} + (p.engagement_score * 0.01)) DESC,
        p.is_promoted DESC,
        p.created_at  DESC
      `;
    }

    /* ── Pagination params ── */
    const limitParam  = push(realLimit + 1);
    const offsetParam = push(offset);

    /* Count uses same values minus last two (limit/offset) */
    const countValues = values.slice(0, values.length - 2);

    /* ── Queries ── */
    /*
       NOTE: We use p.category_name directly (denormalised column from
       homepage.js schema). If you have a categories JOIN instead,
       swap the SELECT col and add the JOIN back.
    */
    const mainSql = `
      SELECT
        p.id, p.title, p.description, p.price, p.slug,
        p.main_image, p.thumbnail_url, p.images, p.video_url,
        p.attributes, p.brand, p.model, p.condition, p.negotiable,
        p.views, p.clicks_count, p.impression_count,
        p.engagement_score, p.is_promoted, p.is_featured,
        p.favorites_count, p.average_rating, p.reviews_count,
        p.offer_type, p.delivery, p.whatsapp, p.phone,
        p.created_at, p.category_id, p.subcategory_id,
        p.seller_id, p.seller_name,
        p.stock_status, p.location_city, p.location_state,
        p.category_name
      FROM public.products p
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT  ${limitParam}
      OFFSET ${offsetParam}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM public.products p
      WHERE ${whereClause}
    `;

    /* ── Run in parallel ── */
    const [mainRes, countRes] = await Promise.all([
      pool.query(mainSql, values),
      pool.query(countSql, countValues),
    ]);

    const { rows } = mainRes;
    const total    = countRes.rows[0]?.total || 0;
    const hasMore  = rows.length > realLimit;
    const records  = hasMore ? rows.slice(0, realLimit) : rows;
    const products = records.map(shapeProduct);

    /* ── Aggregations (reuse same WHERE, no pagination) ── */
    const aggSql = `
      SELECT
        MIN(p.price)::int  AS min_price,
        MAX(p.price)::int  AS max_price,

        /* distinct non-null conditions as JSON array */
        COALESCE(
          json_agg(DISTINCT p.condition)
            FILTER (WHERE p.condition IS NOT NULL),
          '[]'
        ) AS conditions,

        /* distinct non-null states */
        COALESCE(
          json_agg(DISTINCT p.location_state)
            FILTER (WHERE p.location_state IS NOT NULL),
          '[]'
        ) AS states,

        /* distinct categories as {id, name} objects */
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id',   p.category_id::text,
              'name', p.category_name
            )
          ) FILTER (WHERE p.category_id IS NOT NULL),
          '[]'
        ) AS categories
      FROM public.products p
      WHERE ${whereClause}
    `;

    const aggRes = await pool.query(aggSql, countValues);
    const agg    = aggRes.rows[0] || {};

    /* Deduplicate categories (json_agg DISTINCT on jsonb sometimes
       returns dupes when the object keys differ in ordering) */
    const seenCats = new Set();
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
        price      : { min: agg.min_price || 0, max: agg.max_price || 0 },
        conditions : Array.isArray(agg.conditions) ? agg.conditions.filter(Boolean) : [],
        states     : Array.isArray(agg.states)     ? agg.states.filter(Boolean)     : [],
        categories : cleanCats,
      },
    };

    await cacheSet(cacheKey, payload, CACHE_TTL);
    return res.json(payload);

  } catch (err) {
    console.error("[search] ERROR:", err.message, err.stack);
    return res.status(500).json({
      error   : "Search failed",
      message : err.message,
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/search/related
   ══════════════════════════════════════════════════════════════ */
router.get("/related", async (req, res) => {
  const {
    slug,
    id,
    category_id,
    limit = MAX_RELATED,
  } = req.query;

  if (!slug && !id && !category_id) {
    return res.status(400).json({ error: "slug, id or category_id required" });
  }

  const cacheKey = `related:${slug || id || ""}:${category_id || ""}:l${limit}`;
  const cached   = await cacheGet(cacheKey);
  if (cached) {
    res.set("X-Cache", "HIT");
    return res.json(cached);
  }

  try {
    const values = [];
    const push   = (v) => { values.push(v); return `$${values.length}`; };

    const where = [
      `p.is_active  = true`,
      `p.status     = 'active'`,
      `p.is_deleted = false`,
    ];

    /* Exclude current product */
    if (slug) where.push(`p.slug != ${push(slug)}`);
    if (id)   where.push(`p.id   != ${push(id)}::uuid`);

    /* Resolve category if not supplied */
    let catId = category_id || null;
    if (!catId && (slug || id)) {
      const col  = slug ? "slug" : "id";
      const cast = slug ? "" : "::uuid";
      const r    = await pool.query(
        `SELECT category_id
         FROM public.products
         WHERE ${col} = $1${cast}
           AND is_active  = true
           AND is_deleted = false
         LIMIT 1`,
        [slug || id]
      );
      catId = r.rows[0]?.category_id || null;
    }

    if (catId) {
      where.push(`p.category_id = ${push(catId)}::uuid`);
    }

    const realLimit = Math.min(Number(limit), MAX_RELATED);
    values.push(realLimit);
    const limitParam = `$${values.length}`;

    const sql = `
      SELECT
        p.id, p.title, p.price, p.slug,
        p.main_image, p.thumbnail_url, p.images,
        p.brand, p.condition, p.is_promoted,
        p.engagement_score, p.created_at,
        p.location_city, p.location_state,
        p.category_id, p.category_name,
        p.seller_id, p.seller_name,
        p.attributes, p.views, p.clicks_count,
        p.impression_count, p.favorites_count,
        p.average_rating, p.reviews_count,
        p.offer_type, p.delivery, p.whatsapp,
        p.phone, p.stock_status, p.subcategory_id,
        p.is_featured, p.negotiable,
        p.video_url, p.model
      FROM public.products p
      WHERE ${where.join(" AND ")}
      ORDER BY p.is_promoted DESC, p.engagement_score DESC, p.created_at DESC
      LIMIT ${limitParam}
    `;

    const { rows } = await pool.query(sql, values);
    const related  = rows.map(shapeProduct);

    const payload = { related, total: related.length };
    await cacheSet(cacheKey, payload, 90);
    return res.json(payload);

  } catch (err) {
    console.error("[search/related] ERROR:", err.message, err.stack);
    return res.status(500).json({ error: "Related fetch failed", message: err.message });
  }
});

export default router;