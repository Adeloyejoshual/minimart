// routes/homepage.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

// GET /api/homepage
// Query params:
//   lat, lng         – GPS coords (optional)
//   page             – pagination offset (default 0)
//   category_id      – UUID from categories table (optional)
//   section          – "trending" | "deals" | "new" (optional, for dedicated pages)
router.get("/", async (req, res) => {
  const { lat, lng, page = 0, category_id, section } = req.query;
  const hasCoords   = !!(lat && lng);
  const hasCategory = !!category_id;

  try {
    const limit  = 40;
    const offset = Number(page) * limit;

    // ── Distance expression ─────────────────────────────────────────
    // ST_Distance on a GEOGRAPHY column returns metres → divide by 1000.
    const distanceSelect = hasCoords
      ? `, ROUND(
           (ST_Distance(
             location_geo,
             ST_MakePoint($3::float, $4::float)::geography
           ) / 1000)::numeric, 1
         ) AS distance_km`
      : "";

    // ── Build param array dynamically ───────────────────────────────
    // Positional params:
    //   $1 = limit+1   $2 = offset
    //   $3 = lng       $4 = lat       (only if hasCoords)
    //   $? = category_id              (only if hasCategory, appended after GPS)
    const params = [limit + 1, offset];

    if (hasCoords) {
      params.push(Number(lng), Number(lat));   // $3, $4
    }

    const catParamIdx = params.length + 1;     // next available slot
    if (hasCategory) {
      params.push(category_id);
    }

    // ── Section-specific ORDER / filter overrides ───────────────────
    // "trending" → sort by engagement/ctr
    // "deals"    → price cap + sort by price ASC
    // "new"      → sort by created_at DESC (already default-ish)
    let extraWhere = "";
    let orderBy    = `
      is_promoted        DESC,
      promotion_priority DESC,
      engagement_score   DESC,
      created_at         DESC
    `;

    if (section === "trending") {
      // High engagement or high CTR products
      extraWhere = `AND (engagement_score > 0 OR clicks_count > 0)`;
      orderBy    = `engagement_score DESC, clicks_count DESC, created_at DESC`;
    } else if (section === "deals") {
      extraWhere = `AND price <= 50000`;
      orderBy    = `price ASC, engagement_score DESC, created_at DESC`;
    } else if (section === "new") {
      orderBy    = `created_at DESC`;
    }

    // ── Category filter ─────────────────────────────────────────────
    const categoryWhere = hasCategory
      ? `AND category_id = $${catParamIdx}`
      : "";

    // ── Main query ──────────────────────────────────────────────────
    const sql = `
      SELECT
        id,
        title,
        price,
        slug,
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
        category_id
        ${distanceSelect}
      FROM products
      WHERE is_active = true
        AND status    = 'active'
        ${categoryWhere}
        ${extraWhere}
      ORDER BY ${orderBy}
      LIMIT  $1
      OFFSET $2
    `;

    const { rows } = await pool.query(sql, params);

    const hasMore = rows.length > limit;
    const records = rows.slice(0, limit);

    // ── Shape products ──────────────────────────────────────────────
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
      image:            p.main_image || p.thumbnail_url || null,
      images:           p.main_image ? [p.main_image] : [],
      location: {
        city:  p.location_city  || null,
        state: p.location_state || null,
        // Combined label for display: "Lagos, Lagos State"
        label: [p.location_city, p.location_state]
          .filter(Boolean)
          .join(", ") || null,
      },
      distance_km:
        p.distance_km != null
          ? Number(p.distance_km)
          : null,
      ctr:
        p.impression_count > 0
          ? p.clicks_count / p.impression_count
          : p.views > 0
          ? p.clicks_count / p.views
          : 0,
    }));

    // ── Meta ────────────────────────────────────────────────────────
    // Pick the most common city from returned products for location label
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
        location:    representativeCity,
        nearbySource: hasCoords ? "gps" : null,
        page:        Number(page),
        returned:    products.length,
        section:     section || null,
        category_id: category_id || null,
      },
    });
  } catch (err) {
    console.error("Homepage fetch error:", err.message);
    return res.status(500).json({ error: "Failed to load products" });
  }
});

export default router;
