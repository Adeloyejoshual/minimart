// routes/homepage.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/**
 * GET /api/homepage
 * Query params:
 *   lat, lng        – GPS coords           (optional)
 *   page            – pagination offset     (default 0)
 *   category_id     – UUID                  (optional)
 *   section         – trending|deals|new|nearby
 */
router.get("/", async (req, res) => {
  const {
    lat,
    lng,
    page        = 0,
    category_id,
    section,
  } = req.query;

  const hasCoords   = !!(lat && lng);
  const hasCategory = !!category_id;

  try {
    const limit  = 40;
    const offset = Number(page) * limit;

    /* ── Build params ──────────────────────────────────────
       $1 = limit+1
       $2 = offset
       $3 = category_id (if provided)
    ─────────────────────────────────────────────────────── */
    const params = [limit + 1, offset];

    let categoryWhere = "";
    if (hasCategory) {
      params.push(category_id);
      categoryWhere = `AND category_id = $${params.length}::uuid`;
    }

    /* ── Section-specific WHERE + ORDER ─────────────────── */
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
      default:
        break;
    }

    /* ── Main query ──────────────────────────────────────── */
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
        category_id,
        seller_id,
        status,
        is_active,
        conversion_rate,
        favorites_count,
        share_count,
        offer_type
      FROM public.products
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

    /* ── Shape each product ──────────────────────────────── */
    const products = records.map((p) => {

      /* Distance calculation in JS — no PostGIS needed */
      let distance_km = null;
      if (
        hasCoords &&
        p.latitude  != null &&
        p.longitude != null
      ) {
        const R    = 6_371;
        const dLat = ((Number(p.latitude)  - Number(lat)) * Math.PI) / 180;
        const dLon = ((Number(p.longitude) - Number(lng)) * Math.PI) / 180;
        const a    =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((Number(lat) * Math.PI) / 180) *
          Math.cos((Number(p.latitude) * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
        distance_km =
          Math.round(
            R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 10
          ) / 10;
      }

      /* Normalise image */
      const image = p.main_image || p.thumbnail_url || null;

      /* Normalise CTR */
      const ctr =
        Number(p.impression_count) > 0
          ? Number(p.clicks_count) / Number(p.impression_count)
          : Number(p.views) > 0
          ? Number(p.clicks_count) / Number(p.views)
          : 0;

      return {
        id                : p.id,
        title             : p.title,
        price             : p.price,
        slug              : p.slug,
        views             : p.views,
        clicks_count      : p.clicks_count,
        impression_count  : p.impression_count,
        engagement_score  : p.engagement_score,
        promotion_priority: p.promotion_priority,
        is_promoted       : p.is_promoted,
        created_at        : p.created_at,
        category_id       : p.category_id,
        seller_id         : p.seller_id,
        conversion_rate   : p.conversion_rate,
        favorites_count   : p.favorites_count,
        offer_type        : p.offer_type,

        /* Image — single field + array for compatibility */
        image,
        images : image ? [image] : [],

        /* Location — flat + nested for compatibility */
        location_city  : p.location_city  || null,
        location_state : p.location_state || null,
        location: {
          city  : p.location_city  || null,
          state : p.location_state || null,
          label :
            [p.location_city, p.location_state]
              .filter(Boolean).join(", ") || null,
        },

        distance_km,
        ctr,
      };
    });

    /* ── Representative city from results ────────────────── */
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

    return res.status(200).json({
      products,
      hasMore,
      meta: {
        location     : topCity,
        nearbySource : hasCoords ? "gps" : null,
        page         : Number(page),
        returned     : products.length,
        section      : section || null,
        category_id  : category_id || null,
      },
    });

  } catch (err) {
    console.error("[homepage] error:", err.message);
    return res.status(500).json({
      error   : "Failed to load products",
      details : err.message,
    });
  }
});

export default router;