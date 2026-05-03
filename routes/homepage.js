// routes/homepage.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

// GET /api/homepage
router.get("/", async (req, res) => {
  const { lat, lng, page = 0 } = req.query;
  const hasCoords = !!(lat && lng);

  try {
    const limit  = 40;
    const offset = Number(page) * limit;

    // ── Distance expression ───────────────────────────────────────────
    // Only added to the SELECT when the client sends GPS coords.
    // CockroachDB ST_Distance on a GEOGRAPHY column returns metres.
    const distanceSelect = hasCoords
      ? `, ST_Distance(
           location,
           ST_MakePoint($3::float, $4::float)::geography
         ) / 1000  AS distance_km`
      : "";

    // ── Query params ──────────────────────────────────────────────────
    // $1 = limit+1  $2 = offset
    // $3 = lng      $4 = lat   (only when hasCoords)
    const params = hasCoords
      ? [limit + 1, offset, Number(lng), Number(lat)]
      : [limit + 1, offset];

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
        created_at
        ${distanceSelect}
      FROM products
      WHERE is_active = true
        AND status    = 'active'
      ORDER BY
        is_promoted        DESC,
        promotion_priority DESC,
        engagement_score   DESC,
        created_at         DESC
      LIMIT  $1
      OFFSET $2
    `;

    const { rows } = await pool.query(sql, params);

    const hasMore = rows.length > limit;
    const records = rows.slice(0, limit);

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
      discounted:       false,
      image:            p.main_image || p.thumbnail_url || null,
      images:           p.main_image ? [p.main_image] : [],
      location: {
        city:  p.location_city  || null,
        state: p.location_state || null,
      },
      distance_km:
        p.distance_km != null
          ? Math.round(Number(p.distance_km) * 10) / 10
          : null,
      ctr:
        p.clicks_count > 0
          ? p.clicks_count / (p.impression_count || p.views || 1)
          : 0,
    }));

    const representativeCity =
      products.find((p) => p.location?.city)?.location?.city || null;

    return res.status(200).json({
      products,
      hasMore,
      meta: {
        location:    representativeCity,
        nearbySource: hasCoords ? "gps" : null,
        page:        Number(page),
        returned:    products.length,
      },
    });
  } catch (err) {
    console.error("Homepage fetch error:", err.message);
    return res.status(500).json({ error: "Failed to load products" });
  }
});

export default router;
