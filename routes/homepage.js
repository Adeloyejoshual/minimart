// routes/homepage.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/* ─── Constants ────────────────────────────────────────────── */
const PAGE_SIZE        = 40;
const CACHE_TTL_SEC    = 60;          // 1 min CDN / reverse-proxy cache
const MAX_PAGE         = 20;          // guard against deep pagination
const MAX_LAT_LNG      = 90;
const EARTH_RADIUS_KM  = 6_371;

/* ─── Helpers ──────────────────────────────────────────────── */

/** Haversine distance in km, returns null if any coord missing */
function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLon  = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

/** Most frequent value in a string array */
function mostFrequent(arr) {
  if (!arr.length) return null;
  const freq = {};
  for (const v of arr) if (v) freq[v] = (freq[v] || 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Safe positive integer parse */
function safeInt(val, fallback = 0, max = Infinity) {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), max) : fallback;
}

/** Validate UUID v4 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (s) => UUID_RE.test(s);

/* ─── Section config ───────────────────────────────────────── */
const SECTIONS = {
  trending: {
    extraWhere : `AND (p.engagement_score > 0 OR p.clicks_count > 0)`,
    orderBy    : `p.engagement_score DESC, p.clicks_count DESC, p.views DESC, p.created_at DESC`,
  },
  deals: {
    extraWhere : `AND p.attributes->>'original_price' IS NOT NULL
                  AND (p.attributes->>'original_price')::numeric > p.price`,
    orderBy    : `p.price ASC, p.engagement_score DESC, p.created_at DESC`,
  },
  new: {
    extraWhere : `AND p.created_at >= NOW() - INTERVAL '7 days'`,
    orderBy    : `p.created_at DESC`,
  },
  nearby: {
    extraWhere : `AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL`,
    orderBy    : `p.created_at DESC`,
  },
  featured: {
    extraWhere : `AND p.is_promoted = true`,
    orderBy    : `p.promotion_priority DESC, p.engagement_score DESC, p.created_at DESC`,
  },
  default: {
    extraWhere : ``,
    orderBy    : `
      p.is_promoted        DESC,
      p.promotion_priority DESC,
      p.boost_score        DESC,
      p.engagement_score   DESC,
      p.created_at         DESC
    `,
  },
};

/* ─── Route ────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  /* ── Parse & validate query params ─────────────────────── */
  const rawLat   = req.query.lat;
  const rawLng   = req.query.lng;
  const rawPage  = req.query.page;
  const catId    = req.query.category_id;
  const section  = req.query.section;
  const limit    = safeInt(req.query.limit, PAGE_SIZE, PAGE_SIZE);

  const page   = safeInt(rawPage, 0, MAX_PAGE);
  const offset = page * limit;

  // GPS coords — only use if both present and numeric
  const lat  = rawLat != null && rawLng != null ? parseFloat(rawLat) : null;
  const lng  = rawLat != null && rawLng != null ? parseFloat(rawLng) : null;
  const hasGPS =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= MAX_LAT_LNG &&
    Math.abs(lng) <= 180;

  // category_id must be a valid UUID
  const hasCat = !!catId && isUUID(catId);
  if (catId && !hasCat) {
    return res.status(400).json({ error: "Invalid category_id" });
  }

  // Section config
  const sec = SECTIONS[section] ?? SECTIONS.default;

  /* ── Build query params array ───────────────────────────── */
  // $1 = limit+1 (peek), $2 = offset
  const params  = [limit + 1, offset];

  let catWhere  = "";
  if (hasCat) {
    params.push(catId);
    catWhere = `AND p.category_id = $${params.length}::uuid`;
  }

  /* ── Main SQL ────────────────────────────────────────────── */
  // LEFT JOIN product_images for primary image (position_order = 0 OR is_primary)
  const sql = `
    SELECT
      p.id,
      p.title,
      p.price,
      p.slug,
      p.main_image,
      p.thumbnail_url,
      p.views,
      p.clicks_count,
      p.impression_count,
      p.engagement_score,
      p.boost_score,
      p.quality_score,
      p.conversion_rate,
      p.favorites_count,
      p.share_count,
      p.promotion_priority,
      p.is_promoted,
      p.promotion_type,
      p.promotion_end,
      p.location_city,
      p.location_state,
      p.latitude,
      p.longitude,
      p.created_at,
      p.category_id,
      p.subcategory_id,
      p.attributes,
      p.highlights,
      p.delivery,
      p.contact,
      p.whatsapp,
      p.whatsapp_link,
      p.phone,

      -- Primary image from product_images table
      pi.image_url        AS primary_image_url,
      pi.thumbnail_url    AS primary_thumb_url,

      -- All images for this product as JSON array
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'image_url',      img.image_url,
              'thumbnail_url',  img.thumbnail_url,
              'position_order', img.position_order,
              'is_primary',     img.is_primary
            )
            ORDER BY img.position_order ASC
          )
          FROM product_images img
          WHERE img.product_id = p.id
        ),
        '[]'::json
      )                   AS product_images,

      -- Seller info
      u.id                AS seller_id,
      u.name              AS seller_name,
      u.avatar_url        AS seller_avatar,
      u.is_verified       AS seller_verified,

      -- Category name
      c.name              AS category_name,
      c.icon              AS category_icon

    FROM products p

    -- Primary image (cheapest join — just the primary row)
    LEFT JOIN product_images pi
      ON  pi.product_id    = p.id
      AND pi.is_primary    = true

    -- Seller
    LEFT JOIN users u
      ON u.id = p.seller_id

    -- Category
    LEFT JOIN categories c
      ON c.id = p.category_id

    WHERE p.is_active = true
      AND p.status    = 'active'
      ${catWhere}
      ${sec.extraWhere}

    ORDER BY ${sec.orderBy}
    LIMIT  $1
    OFFSET $2
  `;

  /* ── Featured (sponsored) side-query ─────────────────────── */
  // Always return up to 4 promoted items regardless of category
  // so the frontend can show a "Featured" strip at the top.
  const featSql = `
    SELECT
      p.id,
      p.title,
      p.price,
      p.slug,
      p.main_image,
      p.thumbnail_url,
      p.is_promoted,
      p.promotion_type,
      p.promotion_end,
      p.promotion_priority,
      p.location_city,
      p.location_state,
      p.latitude,
      p.longitude,
      p.attributes,
      p.engagement_score,
      p.favorites_count,
      p.views,
      pi.image_url     AS primary_image_url,
      pi.thumbnail_url AS primary_thumb_url
    FROM products p
    LEFT JOIN product_images pi
      ON  pi.product_id = p.id
      AND pi.is_primary  = true
    WHERE p.is_active    = true
      AND p.status       = 'active'
      AND p.is_promoted  = true
      AND (p.promotion_end IS NULL OR p.promotion_end > NOW())
      ${catWhere}
    ORDER BY p.promotion_priority DESC, p.engagement_score DESC
    LIMIT 4
  `;

  /* ── Execute both queries in parallel ───────────────────── */
  try {
    const [mainResult, featResult] = await Promise.all([
      pool.query(sql, params),
      // Featured uses same params except limit/offset (replace $1/$2)
      hasCat
        ? pool.query(featSql, [catId])
        : pool.query(
            featSql.replace("AND p.category_id = $1::uuid", ""),
            []
          ),
    ]);

    const rawRows = mainResult.rows;
    const hasMore = rawRows.length > limit;
    const rows    = rawRows.slice(0, limit);

    /* ── Shape a product row ─────────────────────────────── */
    const shapeProduct = (p, isGPS) => {
      // Best image: product_images join → primary_image_url → main_image → thumbnail_url
      const primaryImg =
        p.primary_image_url ||
        p.main_image        ||
        p.thumbnail_url     ||
        null;

      // Parsed images array from product_images sub-select
      let imagesArr = [];
      try {
        imagesArr = Array.isArray(p.product_images) ? p.product_images : [];
      } catch { imagesArr = []; }

      // If product_images join returned rows, use them; else fall back
      const images =
        imagesArr.length > 0
          ? imagesArr.map((img) => ({
              url           : img.image_url,
              thumbnail_url : img.thumbnail_url,
              position_order: img.position_order,
              is_primary    : img.is_primary,
            }))
          : primaryImg
          ? [{ url: primaryImg, thumbnail_url: p.thumbnail_url, is_primary: true }]
          : [];

      // Distance
      const distance_km = isGPS
        ? haversineKm(lat, lng, Number(p.latitude), Number(p.longitude))
        : null;

      // CTR
      const impressions = Number(p.impression_count || 0);
      const clicks      = Number(p.clicks_count     || 0);
      const views       = Number(p.views            || 0);
      const ctr =
        impressions > 0 ? clicks / impressions :
        views       > 0 ? clicks / views       : 0;

      // Original price from attributes (for discount display)
      let originalPrice = null;
      try {
        const op = p.attributes?.original_price;
        if (op) originalPrice = Number(op);
      } catch { /* ignore */ }

      // Delivery
      let delivery = {};
      try { delivery = typeof p.delivery === "string" ? JSON.parse(p.delivery) : (p.delivery || {}); }
      catch { delivery = {}; }

      // Contact
      let contact = {};
      try { contact = typeof p.contact === "string" ? JSON.parse(p.contact) : (p.contact || {}); }
      catch { contact = {}; }

      // Attributes
      let attributes = {};
      try { attributes = typeof p.attributes === "string" ? JSON.parse(p.attributes) : (p.attributes || {}); }
      catch { attributes = {}; }

      if (originalPrice) attributes.original_price = originalPrice;

      return {
        id                : p.id,
        title             : p.title,
        price             : Number(p.price),
        slug              : p.slug,
        category_id       : p.category_id,
        category_name     : p.category_name  || null,
        category_icon     : p.category_icon  || null,
        subcategory_id    : p.subcategory_id || null,

        // Images
        image             : primaryImg,
        images,

        // Engagement
        views             : Number(p.views             || 0),
        clicks_count      : Number(p.clicks_count      || 0),
        impression_count  : Number(p.impression_count  || 0),
        engagement_score  : Number(p.engagement_score  || 0),
        boost_score       : Number(p.boost_score       || 0),
        quality_score     : Number(p.quality_score     || 0),
        favorites_count   : Number(p.favorites_count   || 0),
        share_count       : Number(p.share_count       || 0),
        conversion_rate   : Number(p.conversion_rate   || 0),
        ctr,

        // Promotion
        is_promoted       : Boolean(p.is_promoted),
        promotion_type    : p.promotion_type    || null,
        promotion_priority: Number(p.promotion_priority || 0),
        promotion_end     : p.promotion_end     || null,

        // Location — both flat fields + nested object
        location_city     : p.location_city  || null,
        location_state    : p.location_state || null,
        location: {
          city  : p.location_city  || null,
          state : p.location_state || null,
          label :
            [p.location_city, p.location_state].filter(Boolean).join(", ") || null,
        },
        latitude          : p.latitude  != null ? Number(p.latitude)  : null,
        longitude         : p.longitude != null ? Number(p.longitude) : null,
        distance_km,

        // Seller
        seller: {
          id      : p.seller_id     || null,
          name    : p.seller_name   || null,
          avatar  : p.seller_avatar || null,
          verified: Boolean(p.seller_verified),
        },

        // Contact / delivery
        whatsapp      : p.whatsapp       || contact.whatsapp || null,
        whatsapp_link : p.whatsapp_link  || null,
        phone         : p.phone          || contact.phone    || null,
        delivery,
        contact,

        // Attributes
        attributes,
        highlights : p.highlights || [],

        created_at : p.created_at,
      };
    };

    const products = rows.map((p) => shapeProduct(p, hasGPS));

    // Shape featured (simpler — no product_images sub-select)
    const featured = featResult.rows.map((p) => ({
      id             : p.id,
      title          : p.title,
      price          : Number(p.price),
      slug           : p.slug,
      image          : p.primary_image_url || p.main_image || p.thumbnail_url || null,
      images         : p.primary_image_url
                         ? [{ url: p.primary_image_url, is_primary: true }]
                         : p.main_image
                         ? [{ url: p.main_image, is_primary: true }]
                         : [],
      is_promoted    : true,
      promotion_type : p.promotion_type    || null,
      promotion_end  : p.promotion_end     || null,
      engagement_score: Number(p.engagement_score || 0),
      favorites_count : Number(p.favorites_count  || 0),
      views           : Number(p.views || 0),
      location_city  : p.location_city  || null,
      location_state : p.location_state || null,
      location: {
        city  : p.location_city  || null,
        state : p.location_state || null,
        label :
          [p.location_city, p.location_state].filter(Boolean).join(", ") || null,
      },
      attributes: (() => {
        try { return typeof p.attributes === "string" ? JSON.parse(p.attributes) : (p.attributes || {}); }
        catch { return {}; }
      })(),
      distance_km: hasGPS
        ? haversineKm(lat, lng, Number(p.latitude), Number(p.longitude))
        : null,
    }));

    /* ── Meta ────────────────────────────────────────────── */
    const cities = products.map((p) => p.location_city).filter(Boolean);
    const states = products.map((p) => p.location_state).filter(Boolean);
    const representativeCity  = mostFrequent(cities);
    const representativeState = mostFrequent(states);
    const locationLabel       =
      [representativeCity, representativeState].filter(Boolean).join(", ") || null;

    /* ── Cache headers ───────────────────────────────────── */
    // Short public cache — CDN/Nginx can cache for 1 min.
    // Vary by query so different filters get different cache keys.
    res.set({
      "Cache-Control": `public, max-age=${CACHE_TTL_SEC}, stale-while-revalidate=120`,
      "Vary"         : "Accept-Encoding",
    });

    /* ── Response ────────────────────────────────────────── */
    return res.status(200).json({
      products,
      featured,
      hasMore,
      meta: {
        page          : page,
        returned      : products.length,
        has_more      : hasMore,
        section       : section   || null,
        category_id   : catId     || null,
        location      : locationLabel,
        city          : representativeCity,
        state         : representativeState,
        nearbySource  : hasGPS ? "gps" : null,
        gps           : hasGPS ? { lat, lng } : null,
        featured_count: featured.length,
      },
    });

  } catch (err) {
    console.error("[Homepage] fetch error:", err);
    return res.status(500).json({
      error  : "Failed to load products",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

export default router;