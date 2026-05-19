// routes/p2p.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/**
 * GET /api/p2p
 *
 * Query params:
 *   lat, lng         – GPS coords                          (optional)
 *   page             – pagination offset                   (default 0)
 *   category_id      – UUID from categories                (optional)
 *   offer_type       – "sell" | "swap" | "free"            (optional, default all)
 *   sort             – "smart" | "newest" | "price_asc" | "price_desc" (default smart)
 *   section          – "nearby" | "trending" | "free" | "swap"         (optional)
 *   q                – full-text search query              (optional)
 *   radius_km        – filter by distance from coords      (optional, default 50)
 */
router.get("/", async (req, res) => {
  const {
    lat,
    lng,
    page        = 0,
    category_id,
    offer_type,
    sort        = "smart",
    section,
    q,
    radius_km   = 50,
  } = req.query;

  const hasCoords   = !!(lat && lng);
  const hasCategory = !!category_id;
  const hasSearch   = !!(q && q.trim().length > 0);

  try {
    const limit  = 40;
    const offset = Number(page) * limit;

    // ── Build param array ──────────────────────────────────────────
    // Slot layout:
    //   $1  = limit + 1
    //   $2  = offset
    //   $3  = lng          (only when hasCoords)
    //   $4  = lat          (only when hasCoords)
    //   $5  = radius_m     (only when hasCoords)
    //   $?  = category_id  (appended after GPS params when present)
    //   $?  = offer_type   (appended last when present)
    //   $?  = search query (appended last when present)
    const params = [limit + 1, offset];

    if (hasCoords) {
      params.push(Number(lng), Number(lat), Number(radius_km) * 1000);
    }

    const catParamIdx = params.length + 1;
    if (hasCategory) params.push(category_id);

    const offerParamIdx = params.length + 1;
    if (offer_type && offer_type !== "all") params.push(offer_type);

    const searchParamIdx = params.length + 1;
    if (hasSearch) params.push(`%${q.trim().toLowerCase()}%`);

    // ── Distance expression ────────────────────────────────────────
    const distanceSelect = hasCoords
      ? `, ROUND(
           (ST_Distance(
             location_geo,
             ST_MakePoint($3::float, $4::float)::geography
           ) / 1000)::numeric, 1
         ) AS distance_km`
      : "";

    // ── Radius filter (only when coords provided) ──────────────────
    const radiusWhere = hasCoords
      ? `AND (
           location_geo IS NULL
           OR ST_DWithin(
                location_geo,
                ST_MakePoint($3::float, $4::float)::geography,
                $5
              )
         )`
      : "";

    // ── Offer type filter ──────────────────────────────────────────
    // offer_type column: 'sell' | 'swap' | 'free'
    // Fallback: price = 0 → treat as free; no offer_type col → treat as sell
    let offerWhere = "";
    if (offer_type && offer_type !== "all") {
      if (offer_type === "free") {
        offerWhere = `AND (offer_type = $${offerParamIdx} OR price = 0)`;
      } else {
        offerWhere = `AND offer_type = $${offerParamIdx}`;
      }
    }

    // ── Category filter ────────────────────────────────────────────
    const categoryWhere = hasCategory
      ? `AND category_id = $${catParamIdx}`
      : "";

    // ── Full-text search filter ────────────────────────────────────
    const searchWhere = hasSearch
      ? `AND (
           LOWER(title)       LIKE $${searchParamIdx}
           OR LOWER(description) LIKE $${searchParamIdx}
         )`
      : "";

    // ── Section-specific extras ────────────────────────────────────
    let sectionWhere = "";
    let orderBy      = "";

    switch (section) {
      case "nearby":
        sectionWhere = hasCoords ? "" : "AND (latitude IS NOT NULL OR location_city IS NOT NULL)";
        orderBy = hasCoords
          ? `distance_km ASC NULLS LAST, created_at DESC`
          : `created_at DESC`;
        break;

      case "trending":
        sectionWhere = `AND (engagement_score > 0 OR clicks_count > 0)`;
        orderBy      = `engagement_score DESC, clicks_count DESC, created_at DESC`;
        break;

      case "free":
        sectionWhere = `AND (offer_type = 'free' OR price = 0)`;
        orderBy      = `created_at DESC`;
        break;

      case "swap":
        sectionWhere = `AND offer_type = 'swap'`;
        orderBy      = `engagement_score DESC, created_at DESC`;
        break;

      default:
        // Honour the sort param when no section override
        switch (sort) {
          case "newest":
            orderBy = `created_at DESC`;
            break;
          case "price_asc":
            orderBy = `price ASC NULLS LAST, created_at DESC`;
            break;
          case "price_desc":
            orderBy = `price DESC NULLS LAST, created_at DESC`;
            break;
          case "smart":
          default:
            orderBy = `
              is_promoted        DESC,
              promotion_priority DESC,
              engagement_score   DESC,
              created_at         DESC
            `;
        }
    }

    // ── Main query ─────────────────────────────────────────────────
    const sql = `
      SELECT
        id,
        title,
        price,
        slug,
        description,
        offer_type,
        swap_for,
        main_image,
        thumbnail_url,
        views,
        clicks_count,
        impression_count,
        engagement_score,
        promotion_priority,
        is_promoted,
        location_city,
        location_state,
        latitude,
        longitude,
        created_at,
        category_id,
        seller_id,
        seller_name
        ${distanceSelect}
      FROM products
      WHERE is_active = true
        AND status    = 'active'
        AND is_p2p    = true
        ${radiusWhere}
        ${categoryWhere}
        ${offerWhere}
        ${sectionWhere}
        ${searchWhere}
      ORDER BY ${orderBy}
      LIMIT  $1
      OFFSET $2
    `;

    const { rows } = await pool.query(sql, params);

    const hasMore = rows.length > limit;
    const records = rows.slice(0, limit);

    // ── Shape products ─────────────────────────────────────────────
    const products = records.map((p) => ({
      id:               p.id,
      title:            p.title,
      price:            p.price,
      slug:             p.slug,
      description:      p.description    || null,
      offer_type:       p.offer_type     || "sell",
      swap_for:         p.swap_for       || null,
      views:            p.views,
      clicks_count:     p.clicks_count,
      impression_count: p.impression_count,
      engagement_score: p.engagement_score,
      is_promoted:      p.is_promoted,
      promotion_priority: p.promotion_priority,
      created_at:       p.created_at,
      category_id:      p.category_id,
      seller_id:        p.seller_id      || null,
      seller_name:      p.seller_name    || null,
      image:            p.main_image || p.thumbnail_url || null,
      images:           p.main_image ? [p.main_image] : [],
      location: {
        city:  p.location_city  || null,
        state: p.location_state || null,
        label:
          [p.location_city, p.location_state].filter(Boolean).join(", ") ||
          null,
      },
      distance_km:
        p.distance_km != null ? Number(p.distance_km) : null,
      ctr:
        p.impression_count > 0
          ? p.clicks_count / p.impression_count
          : p.views > 0
          ? p.clicks_count / p.views
          : 0,
    }));

    // ── Section counts (for filter chips on the frontend) ──────────
    const countSql = `
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE offer_type = 'swap')          AS swaps,
        COUNT(*) FILTER (WHERE offer_type = 'free' OR price = 0) AS frees,
        COUNT(*) FILTER (WHERE offer_type = 'sell' OR offer_type IS NULL) AS sells
      FROM products
      WHERE is_active = true
        AND status    = 'active'
        AND is_p2p    = true
        ${hasCoords ? radiusWhere : ""}
        ${categoryWhere}
    `;

    // Reuse only the params that countSql references (coords + category)
    const countParams = hasCoords
      ? [Number(lng), Number(lat), Number(radius_km) * 1000]
      : [];

    // Re-index category param for the count query
    const countCatIdx = countParams.length + 1;
    const countParamsFull = hasCategory
      ? [...countParams, category_id]
      : countParams;

    // Patch the WHERE to use the correct param index in countSql
    const countSqlFinal = hasCategory
      ? countSql.replace(categoryWhere, `AND category_id = $${countCatIdx}`)
      : countSql;

    const { rows: countRows } = await pool.query(countSqlFinal, countParamsFull);
    const counts = countRows[0] || {};

    // ── Derive representative city label ───────────────────────────
    const cityFreq = {};
    for (const p of products) {
      if (p.location.city) {
        cityFreq[p.location.city] = (cityFreq[p.location.city] || 0) + 1;
      }
    }
    const representativeCity =
      Object.entries(cityFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return res.status(200).json({
      products,
      hasMore,
      counts: {
        all:  Number(counts.total  || 0),
        sell: Number(counts.sells  || 0),
        swap: Number(counts.swaps  || 0),
        free: Number(counts.frees  || 0),
      },
      meta: {
        location:     representativeCity,
        nearbySource: hasCoords ? "gps" : null,
        page:         Number(page),
        returned:     products.length,
        section:      section || null,
        offer_type:   offer_type || "all",
        sort,
        category_id:  category_id || null,
        radius_km:    hasCoords ? Number(radius_km) : null,
      },
    });
  } catch (err) {
    console.error("P2P fetch error:", err.message);
    return res.status(500).json({ error: "Failed to load P2P offers" });
  }
});

/**
 * POST /api/p2p
 * Create a new P2P offer.
 * Body: { title, price, category_id, offer_type, description, swap_for, seller_id }
 */
router.post("/", async (req, res) => {
  const {
    title,
    price       = 0,
    category_id,
    offer_type  = "sell",
    description = "",
    swap_for    = null,
    seller_id,
    seller_name,
    location_city,
    location_state,
    lat,
    lng,
  } = req.body;

  if (!title?.trim())   return res.status(400).json({ error: "title is required" });
  if (!category_id)     return res.status(400).json({ error: "category_id is required" });
  if (!["sell", "swap", "free"].includes(offer_type)) {
    return res.status(400).json({ error: "offer_type must be sell | swap | free" });
  }

  try {
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    const geoExpr = lat && lng
      ? `ST_MakePoint($12::float, $11::float)::geography`
      : "NULL";

    const sql = `
      INSERT INTO products (
        title, price, slug, category_id,
        offer_type, description, swap_for,
        seller_id, seller_name,
        location_city, location_state, latitude, longitude,
        location_geo,
        is_p2p, is_active, status,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9,
        $10, $11, $12, $13,
        ${geoExpr},
        true, true, 'active',
        NOW(), NOW()
      )
      RETURNING id, slug, title, offer_type, created_at
    `;

    const params = [
      title.trim(),
      Number(price) || 0,
      slug,
      category_id,
      offer_type,
      description || "",
      swap_for    || null,
      seller_id   || null,
      seller_name || null,
      location_city  || null,
      location_state || null,
      lat ? Number(lat) : null,
      lng ? Number(lng) : null,
    ];

    const { rows } = await pool.query(sql, params);
    return res.status(201).json({ success: true, product: rows[0] });
  } catch (err) {
    console.error("P2P create error:", err.message);
    return res.status(500).json({ error: "Failed to create P2P offer" });
  }
});

/**
 * GET /api/p2p/match
 * Smart trade-match suggestions.
 *
 * Query params:
 *   have        – what the user has to offer (category_id or keyword)
 *   want        – what the user wants in return (category_id or keyword)
 *   lat, lng    – GPS coords for proximity boost
 *   limit       – max results (default 10)
 */
router.get("/match", async (req, res) => {
  const { have, want, lat, lng, limit = 10 } = req.query;

  if (!have && !want) {
    return res.status(400).json({ error: "Provide at least one of: have, want" });
  }

  const hasCoords = !!(lat && lng);

  try {
    const params  = [];
    const clauses = [];

    // Keyword match on title / description / swap_for
    if (want) {
      params.push(`%${want.toLowerCase()}%`);
      const idx = params.length;
      clauses.push(`(
        LOWER(title)       LIKE $${idx}
        OR LOWER(swap_for) LIKE $${idx}
        OR LOWER(description) LIKE $${idx}
      )`);
    }

    if (have) {
      params.push(`%${have.toLowerCase()}%`);
      const idx = params.length;
      clauses.push(`(
        LOWER(swap_for) LIKE $${idx}
        OR LOWER(description) LIKE $${idx}
      )`);
    }

    const whereKeyword = clauses.length
      ? `AND (${clauses.join(" OR ")})`
      : "";

    const distanceSelect = hasCoords
      ? `, ROUND((ST_Distance(location_geo, ST_MakePoint($${params.length + 2}::float, $${params.length + 1}::float)::geography) / 1000)::numeric, 1) AS distance_km`
      : "";

    if (hasCoords) {
      params.push(Number(lat), Number(lng));
    }

    params.push(Number(limit));
    const limitIdx = params.length;

    const sql = `
      SELECT
        id, title, price, slug, offer_type, swap_for,
        main_image, thumbnail_url,
        location_city, location_state,
        engagement_score, is_promoted,
        created_at
        ${distanceSelect}
      FROM products
      WHERE is_active = true
        AND status    = 'active'
        AND is_p2p    = true
        AND offer_type = 'swap'
        ${whereKeyword}
      ORDER BY
        ${hasCoords ? "distance_km ASC NULLS LAST," : ""}
        engagement_score DESC,
        created_at DESC
      LIMIT $${limitIdx}
    `;

    const { rows } = await pool.query(sql, params);

    const matches = rows.map((p) => ({
      id:          p.id,
      title:       p.title,
      price:       p.price,
      slug:        p.slug,
      offer_type:  p.offer_type,
      swap_for:    p.swap_for,
      image:       p.main_image || p.thumbnail_url || null,
      location: {
        city:  p.location_city  || null,
        state: p.location_state || null,
      },
      distance_km: p.distance_km != null ? Number(p.distance_km) : null,
      created_at:  p.created_at,
    }));

    return res.status(200).json({ matches, returned: matches.length });
  } catch (err) {
    console.error("P2P match error:", err.message);
    return res.status(500).json({ error: "Failed to fetch trade matches" });
  }
});

export default router;
