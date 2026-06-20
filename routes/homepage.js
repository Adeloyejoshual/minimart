// routes/homepage.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { lat, lng, page = 0, category_id, section } = req.query;
  const hasCategory = !!category_id;

  try {
    const limit  = 40;
    const offset = Number(page) * limit;

    // ── Build params ──────────────────────────────────────
    const params = [limit + 1, offset];

    const catParamIdx = params.length + 1;
    if (hasCategory) params.push(category_id);

    // ── Section filters ───────────────────────────────────
    let extraWhere = "";
    let orderBy    = `
      is_promoted        DESC,
      promotion_priority DESC,
      engagement_score   DESC,
      created_at         DESC
    `;

    switch (section) {
      case "trending":
        extraWhere = `AND (engagement_score > 0 OR clicks_count > 0)`;
        orderBy    = `engagement_score DESC, clicks_count DESC, created_at DESC`;
        break;
      case "deals":
        extraWhere = `AND price <= 50000`;
        orderBy    = `price ASC, engagement_score DESC, created_at DESC`;
        break;
      case "new":
        orderBy = `created_at DESC`;
        break;
      case "nearby":
        orderBy = `created_at DESC`;
        break;
    }

    const categoryWhere = hasCategory
      ? `AND category_id = $${catParamIdx}::uuid`
      : "";

    // ── Main query — NO PostGIS ───────────────────────────
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

    // ── Shape products ─────────────────────────────────────
    const products = records.map((p) => {
      // ── Calculate distance manually if GPS provided ──
      let distance_km = null;
      if (lat && lng && p.latitude && p.longitude) {
        const R    = 6_371;
        const dLat = ((Number(p.latitude)  - Number(lat)) * Math.PI) / 180;
        const dLon = ((Number(p.longitude) - Number(lng)) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((Number(lat) * Math.PI) / 180) *
          Math.cos((Number(p.latitude) * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
        distance_km = Math.round(
          R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 10
        ) / 10;
      }

      return {
        id               : p.id,
        title            : p.title,
        price            : p.price,
        slug             : p.slug,
        views            : p.views,
        clicks_count     : p.clicks_count,
        impression_count : p.impression_count,
        engagement_score : p.engagement_score,
        promotion_priority: p.promotion_priority,
        is_promoted      : p.is_promoted,
        created_at       : p.created_at,
        category_id      : p.category_id,
        image            : p.main_image || p.thumbnail_url || null,
        images           : p.main_image ? [p.main_image] : [],
        location: {
          city  : p.location_city  || null,
          state : p.location_state || null,
          label :
            [p.location_city, p.location_state]
              .filter(Boolean).join(", ") || null,
        },
        distance_km,
        ctr:
          p.impression_count > 0
            ? Number(p.clicks_count) / Number(p.impression_count)
            : p.views > 0
            ? Number(p.clicks_count) / Number(p.views)
            : 0,
      };
    });

    // ── Representative city from results ──────────────────
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
        location     : representativeCity,
        nearbySource : lat && lng ? "gps" : null,
        page         : Number(page),
        returned     : products.length,
        section      : section || null,
        category_id  : category_id || null,
      },
    });

  } catch (err) {
    console.error("Homepage fetch error:", err.message);
    return res.status(500).json({
      error   : "Failed to load products",
      details : err.message,
    });
  }
});

export default router;