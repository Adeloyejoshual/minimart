import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* =====================================
   NORMALIZE PRODUCT
===================================== */
const normalizeProduct = (p) => {
  let images = [];

  if (Array.isArray(p.images)) {
    images = p.images.map((img) => img);
  }

  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    price: Number(p.price || 0),

    images, // ✅ ["url1", "url2"]

    views: Number(p.views || 0),
    clicks_count: Number(p.clicks_count || 0),
    is_promoted: Boolean(p.is_promoted),
    promotion_priority: Number(p.promotion_priority || 0),

    location: {
      state: p.location_state,
      city: p.location_city,
    },

    createdAt: p.created_at,
  };
};

/* =====================================
   BASE QUERY (NO media JSON)
===================================== */
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

    COALESCE(
      json_agg(pi.image_url ORDER BY pi.position_order)
      FILTER (WHERE pi.image_url IS NOT NULL),
      '[]'
    ) AS images

  FROM products p
  LEFT JOIN product_images pi
    ON p.id = pi.product_id

  WHERE p.is_active = true
  AND p.status = 'active'
`;

/* =====================================
   GROUP BY (required for json_agg)
===================================== */
const groupBy = `
  GROUP BY
    p.id, p.slug, p.title, p.description, p.price,
    p.created_at, p.views, p.clicks_count,
    p.is_promoted, p.promotion_priority,
    p.location_state, p.location_city
`;

/* =====================================
   HOMEPAGE ROUTE
===================================== */
router.get("/homepage", async (req, res) => {
  try {
    const recommendedQuery = `
      ${baseQuery}
      ${groupBy}
      ORDER BY p.promotion_priority DESC, p.created_at DESC
      LIMIT 24
    `;

    const cheapDealsQuery = `
      ${baseQuery}
      AND p.price <= 20000
      ${groupBy}
      ORDER BY p.created_at DESC
      LIMIT 24
    `;

    const trendingQuery = `
      ${baseQuery}
      AND p.views > 10
      ${groupBy}
      ORDER BY p.views DESC
      LIMIT 20
    `;

    const latestQuery = `
      ${baseQuery}
      ${groupBy}
      ORDER BY p.created_at DESC
      LIMIT 30
    `;

    const [recommended, cheapDeals, trending, latest] =
      await Promise.all([
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

/* =====================================
   TRACK VIEW ROUTE
===================================== */
router.post("/products/:id/view", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE products
       SET views = COALESCE(views, 0) + 1
       WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to track view" });
  }
});

export default router;