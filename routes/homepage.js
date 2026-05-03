// routes/homepage.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/**
 * GET /api/homepage
 *
 * Query params:
 *   lat, lng         – GPS coords (optional)
 *   page             – pagination index, 0-based (default 0)
 *   category_id      – UUID from categories table (optional)
 *   section          – "trending" | "deals" | "new" (optional)
 */
router.get("/", async (req, res) => {
  const { lat, lng, page = 0, category_id, section } = req.query;

  const hasCoords   = !!(lat && lng);
  const hasCategory = !!category_id;

  try {
    const limit  = 40;
    const offset = Number(page) * limit;

    // ── Positional params ────────────────────────────────────────────
    // $1 = limit+1  (fetch one extra to detect hasMore)
    // $2 = offset
    // $3 = lng      (only when hasCoords)
    // $4 = lat      (only when hasCoords)
    // $N = category_id  (appended after GPS params when hasCategory)
    const params = [limit + 1, offset];

    if (hasCoords) {
      params.push(Number(lng), Number(lat));   // $3, $4
    }

    const catParamIdx = params.length + 1;
    if (hasCategory) {
      params.push(category_id);
    }

    // ── Distance expression ──────────────────────────────────────────
    // Schema has two geo columns: `location` (with inverted index) and `geo`.
    // We use `location` since idx_products_geo is on it.
    // ST_MakePoint(lng, lat) — longitude is X, latitude is Y.
    // ST_Distance on GEOGRAPHY returns metres → ÷ 1000 for km.
    const distanceSelect = hasCoords
      ? `, ROUND(
           (ST_Distance(
             location,
             ST_MakePoint($3::float, $4::float)::geography
           ) / 1000)::numeric, 1
         ) AS distance_km`
      : "";

    // ── Section overrides ────────────────────────────────────────────
    let extraWhere = "";
    let orderBy    = `
      p.is_promoted        DESC,
      p.promotion_priority DESC,
      p.engagement_score   DESC,
      p.created_at         DESC
    `;

    if (section === "trending") {
      extraWhere = `AND (p.engagement_score > 0 OR p.clicks_count > 0)`;
      orderBy    = `p.engagement_score DESC, p.clicks_count DESC, p.created_at DESC`;
    } else if (section === "deals") {
      extraWhere = `AND p.price <= 50000`;
      orderBy    = `p.price ASC, p.engagement_score DESC, p.created_at DESC`;
    } else if (section === "new") {
      orderBy    = `p.created_at DESC`;
    }

    // ── Category filter ──────────────────────────────────────────────
    const categoryWhere = hasCategory
      ? `AND p.category_id = $${catParamIdx}`
      : "";

    // ── Main query ───────────────────────────────────────────────────
    // LEFT JOIN users to expose seller.verified on the frontend.
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
        p.promotion_priority,
        p.is_promoted,
        p.location_city,
        p.location_state,
        p.latitude,
        p.longitude,
        p.created_at,
        p.category_id,
        -- Seller fields
        u.id            AS seller_id,
        u.is_verified   AS seller_verified,
        u.display_name  AS seller_name
        ${distanceSelect}
      FROM products p
      LEFT JOIN users u ON u.id = p.seller_id
      WHERE p.is_active = true
        AND p.status    = 'active'
        ${categoryWhere}
        ${extraWhere}
      ORDER BY ${orderBy}
      LIMIT  $1
      OFFSET $2
    `;

    const { rows } = await pool.query(sql, params);

    const hasMore = rows.length > limit;
    const records = rows.slice(0, limit);

    // ── Shape products ───────────────────────────────────────────────
    const products = records.map((p) => ({
      id:               p.id,
      title:            p.title,
      price:            p.price,
      slug:             p.slug,
      views:            p.views,
      clicks_count:     p.clicks_count,
      impression_count: p.impression_count,
      engagement_score: p.engagement_score,
      is_promoted:      p.is_promoted,
      created_at:       p.created_at,
      category_id:      p.category_id,

      // Image — frontend's getImageUrl() checks `image`, then `images[]`
      image:  p.main_image || p.thumbnail_url || null,
      images: p.main_image ? [p.main_image] : [],

      // Location object — locLabel() on the frontend reads city/state/label
      location: {
        city:  p.location_city  || null,
        state: p.location_state || null,
        label: [p.location_city, p.location_state]
          .filter(Boolean)
          .join(", ") || null,
      },

      // GPS distance — null when no coords were sent
      distance_km:
        p.distance_km != null ? Number(p.distance_km) : null,

      // CTR — used by getBadge() on the frontend
      ctr:
        p.impression_count > 0
          ? p.clicks_count / p.impression_count
          : p.views > 0
          ? p.clicks_count / p.views
          : 0,

      // Seller — used by MasonryCard's "✓ Verified" badge
      seller: {
        id:       p.seller_id       || null,
        name:     p.seller_name     || null,
        verified: p.seller_verified ?? false,
      },
    }));

    // ── Meta — representative city from returned products ─────────────
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
      meta: {
        location:     representativeCity,
        nearbySource: hasCoords ? "gps" : null,
        page:         Number(page),
        returned:     products.length,
        section:      section || null,
        category_id:  category_id || null,
      },
    });
  } catch (err) {
    console.error("Homepage fetch error:", err.message);
    return res.status(500).json({ error: "Failed to load products" });
  }
});

export default router;
