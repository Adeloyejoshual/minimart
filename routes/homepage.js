// routes/homepage.js
import express from "express";
import { pool } from "../config/db.js";
import { cacheGet, cacheSet } from "../lib/redis.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   CACHE CONFIG PER SECTION
   ══════════════════════════════════════════════════════════════ */
const CACHE_TTL = {
  all      : 60,     // 1 min
  deals    : 120,    // 2 min — prices change slowly
  trending : 90,     // 1.5 min
  latest   : 30,     // 30s — new items arrive fast
  nearby   : 30,     // 30s — but GPS results never cached
};

/* ══════════════════════════════════════════════════════════════
   BUILD CACHE KEY
   Never cache GPS results (personal / location-specific)
   ══════════════════════════════════════════════════════════════ */
function buildCacheKey(params) {
  const {
    section = "all",
    page    = 0,
    limit   = 40,
    category_id,
    max_price,
    min_price,
    sort,
    state,
    city,
    lat,
    lng,
  } = params;

  /* GPS nearby = personal data → never cache */
  if (lat && lng && section === "nearby") return null;

  const parts = [
    "hp",
    section,
    `p${page}`,
    `l${limit}`,
    category_id ? `c${category_id.slice(0, 8)}` : "",
    max_price   ? `mx${max_price}`   : "",
    min_price   ? `mn${min_price}`   : "",
    sort        ? `s${sort}`         : "",
    state       ? `st${state.toLowerCase().replace(/\s/g, "_")}` : "",
    city        ? `cy${city.toLowerCase().replace(/\s/g, "_")}`  : "",
    lat         ? `la${Number(lat).toFixed(2)}`  : "",
    lng         ? `ln${Number(lng).toFixed(2)}`  : "",
  ].filter(Boolean);

  return parts.join(":");
}

/* ══════════════════════════════════════════════════════════════
   GET /api/homepage
   ══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
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

  /* ── Try cache first ── */
  const cacheKey = buildCacheKey(req.query);

  if (cacheKey) {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.set("X-Cache", "HIT");
      res.set("X-Cache-Key", cacheKey);
      return res.json(cached);
    }
  }

  res.set("X-Cache", "MISS");

  try {
    const realLimit = Math.min(Number(limit) || 40, 80);
    const offset    = Number(page) * realLimit;
    const values    = [];
    const where     = [
      `p.is_active  = true`,
      `p.status     = 'active'`,
      `p.is_deleted = false`,
    ];

    const push = (v) => { values.push(v); return `$${values.length}`; };

    /* ── Filters ── */
    if (category_id) {
      where.push(`p.category_id = ${push(category_id)}::uuid`);
    }
    if (state) {
      where.push(`LOWER(p.location_state) = LOWER(${push(state)})`);
    }
    if (city) {
      where.push(`LOWER(p.location_city) = LOWER(${push(city)})`);
    }
    if (max_price) {
      where.push(`p.price <= ${push(Number(max_price))}`);
    }
    if (min_price) {
      where.push(`p.price >= ${push(Number(min_price))}`);
    }

    /* ── Section ── */
    let orderBy = `
      p.is_promoted DESC, p.promotion_priority DESC,
      p.engagement_score DESC, p.created_at DESC
    `;

    switch (section) {
      case "trending":
        where.push(`(p.engagement_score > 0 OR p.clicks_count > 0)`);
        orderBy = `p.engagement_score DESC, p.clicks_count DESC, p.created_at DESC`;
        break;
      case "deals":
        where.push(`p.price > 0`);
        where.push(`p.price <= 50000`);
        orderBy = `p.price ASC, p.engagement_score DESC`;
        break;
      case "latest":
        orderBy = `p.created_at DESC`;
        break;
      case "nearby":
        orderBy = `p.created_at DESC`;
        break;
    }

    /* ── Sort override ── */
    switch (sort) {
      case "price_asc":       orderBy = `p.price ASC`;             break;
      case "price_desc":      orderBy = `p.price DESC`;            break;
      case "engagement_desc": orderBy = `p.engagement_score DESC`; break;
      case "created_desc":    orderBy = `p.created_at DESC`;       break;
    }

    /* ── Pagination ── */
    values.push(realLimit + 1);
    const limitP = `$${values.length}`;
    values.push(offset);
    const offsetP = `$${values.length}`;

    /* ── WHERE clause for count (same filters, no limit/offset) ── */
    const whereClause = where.join(" AND ");
    const countValues  = values.slice(0, values.length - 2);

    /* ── Run main + count in parallel ── */
    const mainSql = `
      SELECT
        p.id, p.title, p.description, p.price, p.slug,
        p.main_image, p.thumbnail_url, p.images, p.video_url,
        p.attributes, p.brand, p.model, p.condition, p.negotiable,
        p.views, p.clicks_count, p.impression_count,
        p.engagement_score, p.promotion_priority,
        p.promotion_type, p.promotion_expires_at,
        p.is_promoted, p.is_featured, p.boost_score,
        p.quality_score, p.conversion_rate,
        p.favorites_count, p.share_count,
        p.average_rating, p.reviews_count,
        p.offer_type, p.swap_for, p.is_p2p,
        p.location_city, p.location_state,
        p.latitude, p.longitude,
        p.delivery, p.contact, p.whatsapp, p.phone,
        p.created_at, p.category_id, p.subcategory_id,
        p.seller_id, p.seller_name,
        p.stock_quantity, p.stock_status, p.active_until
      FROM public.products p
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limitP}
      OFFSET ${offsetP}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM public.products p
      WHERE ${whereClause}
    `;

    const [mainResult, countResult] = await Promise.all([
      pool.query(mainSql, values),
      pool.query(countSql, countValues),
    ]);

    const { rows }  = mainResult;
    const total     = countResult.rows[0]?.total || 0;
    const hasMore   = rows.length > realLimit;
    const records   = hasMore ? rows.slice(0, realLimit) : rows;

    /* ── Shape products ── */
    const products = records.map((p) => {
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

      let distance_km = null;
      if (lat && lng && p.latitude && p.longitude) {
        const R    = 6371;
        const dLat = ((Number(p.latitude)  - Number(lat)) * Math.PI) / 180;
        const dLon = ((Number(p.longitude) - Number(lng)) * Math.PI) / 180;
        const a    =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((Number(lat) * Math.PI) / 180) *
          Math.cos((Number(p.latitude) * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
        distance_km = Math.round(
          R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10
        ) / 10;
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
        id                : p.id,
        title             : p.title,
        description       : p.description,
        price             : currPrice,
        slug              : p.slug,
        image,
        images            : imagesArr,
        video_url         : p.video_url    || null,
        attributes        : p.attributes   || {},
        brand             : p.brand        || null,
        model             : p.model        || null,
        condition         : p.condition    || null,
        negotiable        : p.negotiable   || false,
        views             : vw,
        clicks_count      : clicks,
        impression_count  : impressions,
        engagement_score  : Number(p.engagement_score  || 0),
        promotion_priority: Number(p.promotion_priority || 0),
        promotion_type    : p.promotion_type || null,
        is_promoted       : !!p.is_promoted,
        is_featured       : !!p.is_featured,
        boost_score       : Number(p.boost_score    || 0),
        quality_score     : Number(p.quality_score  || 0),
        conversion_rate   : Number(p.conversion_rate || 0),
        favorites_count   : Number(p.favorites_count || 0),
        share_count       : Number(p.share_count    || 0),
        average_rating    : Number(p.average_rating  || 0),
        reviews_count     : Number(p.reviews_count   || 0),
        offer_type        : p.offer_type   || null,
        swap_for          : p.swap_for     || null,
        is_p2p            : !!p.is_p2p,
        delivery          : p.delivery     || null,
        contact           : p.contact      || null,
        whatsapp          : p.whatsapp     || null,
        phone             : p.phone        || null,
        created_at        : p.created_at,
        category_id       : p.category_id  || null,
        subcategory_id    : p.subcategory_id || null,
        seller_id         : p.seller_id    || null,
        seller_name       : p.seller_name  || null,
        stock_quantity    : p.stock_quantity ?? null,
        stock_status      : p.stock_status || null,
        active_until      : p.active_until || null,
        ctr,
        discount_pct      : discountPct,
        distance_km,
        location_city     : p.location_city  || null,
        location_state    : p.location_state || null,
        location: {
          city  : p.location_city  || null,
          state : p.location_state || null,
          label : [p.location_city, p.location_state]
                    .filter(Boolean).join(", ") || null,
        },
        seller: {
          id       : p.seller_id   || null,
          name     : p.seller_name || null,
          verified : false,
        },
      };
    });

    /* ── Top city ── */
    const cityFreq = {};
    for (const p of products) {
      if (p.location_city)
        cityFreq[p.location_city] = (cityFreq[p.location_city] || 0) + 1;
    }
    const topCity =
      Object.entries(cityFreq)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const locationLabel =
      (state && city ? `${city}, ${state}` : null) ||
      (state         ? state               : null) ||
      topCity        || null;

    /* ── Featured ── */
    let featured = [];
    if (Number(page) === 0 && !section) {
      featured = products.filter((p) => p.is_promoted).slice(0, 6);
    }

    /* ── Build response ── */
    const payload = {
      products,
      featured,
      hasMore,
      meta: {
        section      : section || "all",
        page         : Number(page),
        limit        : realLimit,
        returned     : products.length,
        total,
        has_more     : hasMore,
        location     : locationLabel,
        nearbySource : (lat && lng) ? "gps" : (state || city) ? "manual" : null,
        filters: {
          category_id,
          max_price,
          min_price,
          sort,
          state,
          city,
        },
      },
    };

    /* ── Store in Redis ── */
    if (cacheKey) {
      const ttl = CACHE_TTL[section] || CACHE_TTL.all;
      await cacheSet(cacheKey, payload, ttl);
    }

    return res.json(payload);

  } catch (err) {
    console.error("[homepage] ERROR:", err.message);
    return res.status(500).json({
      error   : "Failed to load products",
      message : err.message,
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
       SET views              = COALESCE(views, 0) + 1,
           impression_count   = COALESCE(impression_count, 0) + 1,
           engagement_score   = LEAST(100, COALESCE(engagement_score, 0) + 0.1),
           last_interaction_at = NOW()
       WHERE id = $1::uuid
         AND is_active  = true
         AND is_deleted = false`,
      [id]
    );
  } catch {}
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
       SET clicks_count      = COALESCE(clicks_count, 0) + 1,
           engagement_score  = LEAST(100, COALESCE(engagement_score, 0) + 0.5),
           last_interaction_at = NOW()
       WHERE id = $1::uuid
         AND is_active  = true
         AND is_deleted = false`,
      [id]
    );
  } catch {}
  res.sendStatus(204);
});

/* ══════════════════════════════════════════════════════════════
   ANALYTICS — Batch
   ══════════════════════════════════════════════════════════════ */
router.post("/analytics/batch", async (req, res) => {
  const { events } = req.body || {};
  if (!Array.isArray(events) || events.length === 0) {
    return res.sendStatus(400);
  }

  const batch  = events.slice(0, 50);
  const views  = batch.filter((e) => e.type === "view").map((e) => e.id);
  const clicks = batch.filter((e) => e.type === "click").map((e) => e.id);

  try {
    const updates = [];

    if (views.length > 0) {
      updates.push(
        pool.query(
          `UPDATE public.products
           SET views            = COALESCE(views, 0) + 1,
               impression_count = COALESCE(impression_count, 0) + 1,
               engagement_score = LEAST(100, COALESCE(engagement_score, 0) + 0.1),
               last_interaction_at = NOW()
           WHERE id = ANY($1::uuid[])
             AND is_active  = true
             AND is_deleted = false`,
          [views]
        )
      );
    }

    if (clicks.length > 0) {
      updates.push(
        pool.query(
          `UPDATE public.products
           SET clicks_count    = COALESCE(clicks_count, 0) + 1,
               engagement_score = LEAST(100, COALESCE(engagement_score, 0) + 0.5),
               last_interaction_at = NOW()
           WHERE id = ANY($1::uuid[])
             AND is_active  = true
             AND is_deleted = false`,
          [clicks]
        )
      );
    }

    await Promise.all(updates);
  } catch {}

  res.sendStatus(204);
});

/* ══════════════════════════════════════════════════════════════
   CACHE INVALIDATION — call after product create/update/delete
   ══════════════════════════════════════════════════════════════ */
import { cacheDel } from "../lib/redis.js";

export async function invalidateHomepageCache() {
  await cacheDel("hp:*");
  console.log("[cache] homepage cache cleared");
}

/* ══════════════════════════════════════════════════════════════
   HEALTH CHECK
   ══════════════════════════════════════════════════════════════ */
import { cacheStats } from "../lib/redis.js";

router.get("/health", async (_req, res) => {
  const redis = await cacheStats();

  let dbOk = false;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch {}

  res.json({
    status : dbOk && redis.connected ? "healthy" : "degraded",
    db     : dbOk ? "connected" : "down",
    redis,
    ts     : new Date().toISOString(),
  });
});

export default router;