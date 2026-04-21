import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

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
  is_active: Boolean(p.is_active),
  is_promoted: Boolean(p.is_promoted),
  promotion_end: p.promotion_end,
  promotion_priority: Number(p.promotion_priority || 0),
  createdAt: p.created_at,
});

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
    p.is_active,
    p.is_promoted,
    p.promotion_end,
    p.promotion_priority,
    p.location_state,
    p.location_city,
    p.attributes,
    p.delivery,
    p.contact,
    COALESCE(
      json_agg(pi.image_url ORDER BY pi.position) FILTER (WHERE pi.image_url IS NOT NULL),
      '[]'::json
    ) AS images
  FROM products p
  LEFT JOIN product_images pi ON p.id = pi.product_id
  WHERE COALESCE(p.is_active, false) = true
`;

const groupedBase = `
  GROUP BY
    p.id, p.slug, p.title, p.description, p.price, p.created_at, p.views, p.clicks_count,
    p.is_active, p.is_promoted, p.promotion_end, p.promotion_priority,
    p.location_state, p.location_city, p.attributes, p.delivery, p.contact
`;

router.get("/homepage", async (req, res) => {
  try {
    const recommendedQuery = `
      ${baseQuery}
      ${groupedBase}
      ORDER BY
        COALESCE(p.promotion_priority, 0) DESC,
        COALESCE(p.views, 0) DESC,
        p.created_at DESC
      LIMIT 24
    `;

    const cheapDealsQuery = `
      ${baseQuery}
      ${groupedBase}
      HAVING p.price <= 20000
      ORDER BY
        COALESCE(p.promotion_priority, 0) DESC,
        COALESCE(p.views, 0) DESC,
        p.created_at DESC
      LIMIT 24
    `;

    const trendingQuery = `
      ${baseQuery}
      ${groupedBase}
      HAVING COALESCE(p.views, 0) > 5
      ORDER BY p.views DESC, p.clicks_count DESC
      LIMIT 20
    `;

    const latestQuery = `
      ${baseQuery}
      ${groupedBase}
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

router.post("/products/:id/view", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;

    await pool.query(
      `INSERT INTO product_views (product_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [id, userId]
    );

    await pool.query(
      `UPDATE products
       SET views = COALESCE(views, 0) + 1,
           updated_at = NOW()
       WHERE id = $1 AND COALESCE(is_active, false) = true`,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("VIEW TRACK ERROR:", err);
    res.status(500).json({ error: "Failed to track view" });
  }
});

export default router;