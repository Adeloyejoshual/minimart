// routes/search.js
import express from "express";
import { pool } from "../config/db.js";
import { cacheGet, cacheSet } from "../lib/redis.js";

const router = express.Router();

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
    image = typeof first === "string" ? first : (first?.url || null);
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
  const ctr = impressions > 0 ? clicks / impressions : vw > 0 ? clicks / vw : 0;

  const origPrice = Number(p.attributes?.original_price || 0);
  const currPrice = Number(p.price || 0);
  const discountPct =
    origPrice > currPrice && currPrice > 0
      ? Math.round(((origPrice - currPrice) / origPrice) * 100)
      : 0;

  const locCity  = p.location_city  || (p.location && p.location.city)  || null;
  const locState = p.location_state || (p.location && p.location.state) || null;

  return {
    id               : p.id,
    title            : p.title,
    description      : p.description      || null,
    price            : currPrice,
    slug             : p.slug             || null,
    image,
    images           : imagesArr,
    video_url        : p.video_url        || null,
    attributes       : p.attributes      || {},
    brand            : p.brand            || null,
    model            : p.model            || null,
    condition        : p.condition        || null,
    negotiable       : p.negotiable       || false,
    views            : vw,
    clicks_count     : clicks,
    impression_count : impressions,
    engagement_score : Number(p.engagement_score  || 0),
    is_promoted      : !!p.is_promoted,
    is_featured      : !!p.is_featured,
    favorites_count  : Number(p.favorites_count   || 0),
    average_rating   : Number(p.average_rating    || 0),
    reviews_count    : Number(p.reviews_count     || 0),
    offer_type       : p.offer_type       || null,
    delivery         : p.delivery         || null,
    whatsapp         : p.whatsapp         || null,
    phone            : p.phone            || null,
    created_at       : p.created_at,
    category_id      : p.category_id      || null,
    category_name    : p.category_name    || null,
    subcategory_id   : p.subcategory_id   || null,
    seller_id        : p.seller_id        || null,
    seller_name      : p.seller_name      || null,
    stock_status     : p.stock_status     || null,
    stock_quantity   : p.stock_quantity   ?? null,
    ctr,
    discount_pct     : discountPct,
    location_city    : locCity,
    location_state   : locState,
    location: {
      city  : locCity,
      state : locState,
      label : [locCity, locState].filter(Boolean).join(", ") || null,
    },
    seller: {
      id   : p.seller_id   || null,
      name : p.seller_name || null,
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
   SELECT COLUMNS — only real columns + joined cat name
   ══════════════════════════════════════════════════════════════ */
const SEL = `
  p.id,
  p.title,
  p.description,
  p.price,
  p.slug,
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

const GUARD = `
  p.is_active  = true
  AND p.status     = 'active'
  AND p.is_deleted = false
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

  /* ── cache key ── */
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
    if (condition)   where.push(`LOWER(p.condition) = LOWER(${push(condition)})`);
    if (state)       where.push(`LOWER(p.location_state) = LOWER(${push(state)})`);
    if (city)        where.push(`LOWER(p.location_city)  = LOWER(${push(city)})`);
    if (min_price)   where.push(`p.price >= ${push(Number(min_price))}`);
    if (max_price)   where.push(`p.price <= ${push(Number(max_price))}`);

    const whereClause = where.join(" AND ");

    /* ══════════════════════════════════════════════
       ORDER BY
       Key fix: cast EVERYTHING to float8 before adding
       so no type mismatch between float4/float8/numeric
    ══════════════════════════════════════════════ */
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
      /* ── relevance ──
         Cast every operand to float8 (double precision) explicitly.
         ts_rank returns float4, engagement_score is numeric/decimal,
         the CASE returns integer — all need the same type.
      */
      const titleBoost = `
        CAST(
          CASE WHEN LOWER(p.title) LIKE ${ilikePat} THEN 1 ELSE 0 END
        AS float8)
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
        (${rankExpr} + ${titleBoost} + ${engBoost}) DESC,
        p.is_promoted DESC,
        p.created_at  DESC
      `;
    }

    /* ── pagination ── */
    const limitParam  = push(realLimit + 1);
    const offsetParam = push(offset);
    const countValues = values.slice(0, values.length - 2);

    /* ── queries ── */
    const mainSql = `
      SELECT ${SEL}
      ${FROM}
      WHERE ${whereClause}
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

    /* ── aggregations ── */
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
    const agg    = aggRes.rows[0] || {};

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

    /* resolve category */
    let catId = category_id || null;
    if (!catId && (slug || id)) {
      const col  = slug ? "slug" : "id";
      const cast = slug ? "" : "::uuid";
      const r    = await pool.query(
        `SELECT category_id FROM public.products
         WHERE ${col} = $1${cast}
           AND is_active = true AND is_deleted = false
         LIMIT 1`,
        [slug || id]
      );
      catId = r.rows[0]?.category_id || null;
    }
    if (catId) where.push(`p.category_id = ${push(catId)}::uuid`);

    const realLimit  = Math.min(Number(limit), MAX_RELATED);
    const limitParam = push(realLimit);

    const sql = `
      SELECT ${SEL}
      ${FROM}
      WHERE ${where.join(" AND ")}
      ORDER BY
        p.is_promoted DESC,
        CAST(COALESCE(p.engagement_score, 0) AS float8) DESC,
        p.created_at DESC
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
    return res.status(500).json({ error: "Related fetch failed", message: err.message });
  }
});

export default router;