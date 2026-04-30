import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// Normalize DB → frontend
const normalizeProduct = (p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  description: p.description,
  price: Number(p.price || 0),
  images: Array.isArray(p.images) ? p.images : [],
  attributes: p.attributes || {},
  delivery: p.delivery || {},
  contact: p.contact || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  views: Number(p.views || 0),
  clicks_count: Number(p.clicks_count || 0),
  is_promoted: Boolean(p.is_promoted),
  promotion_priority: Number(p.promotion_priority || 0),
  createdAt: p.created_at,
});

// Base query (NO joins, uses JSON directly)
const baseQuery = `
  SELECT
    p.id,
    p.slug,
    p.title,
    p.description,
    p.price,
    p.created_at,
    p.views,
    p.clicks_count,
    p.is_promoted,
    p.promotion_priority,
    p.location_state,
    p.location_city,
    p.attributes,
    p.delivery,
    p.contact,
    p.media->'images' AS images
  FROM products p
  WHERE p.is_active = true
  AND p.status = 'active'
`;

router.get("/homepage", async (req, res) => {
  try {
    // 🔥 Recommended (fast index usage)
    const recommendedQuery = `
      ${baseQuery}
      ORDER BY
        p.promotion_priority DESC,
        p.created_at DESC
      LIMIT 24
    `;

    // 💸 Cheap deals
    const cheapDealsQuery = `
      ${baseQuery}
      AND p.price <= 20000
      ORDER BY
        p.promotion_priority DESC,
        p.created_at DESC
      LIMIT 24
    `;

    // 🔥 Trending
    const trendingQuery = `
      ${baseQuery}
      AND p.views > 10
      ORDER BY
        p.views DESC,
        p.clicks_count DESC
      LIMIT 20
    `;

    // 🆕 Latest
    const latestQuery = `
      ${baseQuery}
      ORDER BY p.created_at DESC
      LIMIT 30
    `;

    const [recommended, cheapDeals, trending, latest] = await Promise.all([
      pool.query(recommendedQuery),
      pool.query(cheapDealsQuery),
      pool.query(trendingQuery),
      pool.query(latestQuery),
    ]);

    res.json({
      recommended: recommended.rows.map(normalizeProduct),
      cheapDeals: cheapDeals.rows.map(normalizeProduct),
      trending: trending.rows.map(normalizeProduct),
      latest: latest.rows.map(normalizeProduct),
    });

  } catch (err) {
    console.error("HOMEPAGE ERROR:", err);
    res.status(500).json({
      message: "Failed to load homepage",
      error: err.message,
    });
  }
});

export default router;