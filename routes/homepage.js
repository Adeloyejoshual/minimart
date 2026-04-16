import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= NORMALIZER (ENHANCED) ================= */
const normalizeProduct = (p) => ({
  ...p,
  images: p.images || [],
  attributes: p.attributes || {},
  delivery: p.delivery || {},
  contact: p.contact || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  // Frontend-ready fields
  views: Number(p.views_count || p.views || 0),
  clicks: Number(p.clicks_count || 0),
  createdAt: p.created_at,
});

/* ================= BASE QUERY (REAL VIEWS) ================= */
const baseQuery = `
  SELECT 
    p.id,
    p.title,
    p.description,
    p.price,
    p.created_at,
    p.updated_at,
    p.is_active,
    p.is_promoted,
    p.promotion_end,
    p.promotion_priority,
    p.location_state,
    p.location_city,
    p.attributes,
    p.delivery,
    p.contact,
    p.views,
    p.clicks_count,
    p.engagement_score,
    COALESCE(
      json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL),
      '[]'
    ) AS images,
    COUNT(DISTINCT pv.id) AS views_count_7d -- REAL 7-day views
  FROM products p
  LEFT JOIN product_images pi ON p.id = pi.product_id
  LEFT JOIN product_views pv ON p.id = pv.product_id 
    AND pv.created_at >= NOW() - INTERVAL '7 days'
  WHERE COALESCE(p.is_active, false) = true
    AND p.status = 'active'
`;

/* ================= HOMEPAGE (OPTIMIZED) ================= */
router.get("/homepage", async (req, res) => {
  try {
    const limit = 50; // More products for "show all"

    /* 🔥 RECOMMENDED (Engagement + Promo + Recency) */
    const recommendedQuery = `
      ${baseQuery}
      GROUP BY 
        p.id, p.title, p.description, p.price, p.created_at, p.updated_at,
        p.is_active, p.is_promoted, p.promotion_end, p.promotion_priority,
        p.location_state, p.location_city, p.attributes, p.delivery, 
        p.contact, p.views, p.clicks_count, p.engagement_score
      ORDER BY 
        COALESCE(p.engagement_score, 0) DESC,
        COALESCE(p.promotion_priority, 0) DESC,
        p.created_at DESC,
        COALESCE(views_count_7d, 0) DESC
      LIMIT ${limit}
    `;

    /* 💸 CHEAP DEALS */
    const cheapDealsQuery = `
      ${baseQuery}
      GROUP BY 
        p.id, p.title, p.description, p.price, p.created_at, p.updated_at,
        p.is_active, p.is_promoted, p.promotion_end, p.promotion_priority,
        p.location_state, p.location_city, p.attributes, p.delivery, 
        p.contact, p.views, p.clicks_count, p.engagement_score
      HAVING p.price <= 20000
      ORDER BY 
        COALESCE(p.engagement_score, 0) DESC,
        COALESCE(p.promotion_priority, 0) DESC,
        p.created_at DESC
      LIMIT ${limit}
    `;

    /* 🔥 TRENDING (Real Views) */
    const trendingQuery = `
      ${baseQuery}
      GROUP BY 
        p.id, p.title, p.description, p.price, p.created_at, p.updated_at,
        p.is_active, p.is_promoted, p.promotion_end, p.promotion_priority,
        p.location_state, p.location_city, p.attributes, p.delivery, 
        p.contact, p.views, p.clicks_count, p.engagement_score
      HAVING COALESCE(views_count_7d, 0) > 5
      ORDER BY views_count_7d DESC, p.views DESC
      LIMIT ${limit}
    `;

    /* 🆕 LATEST */
    const latestQuery = `
      ${baseQuery}
      GROUP BY 
        p.id, p.title, p.description, p.price, p.created_at, p.updated_at,
        p.is_active, p.is_promoted, p.promotion_end, p.promotion_priority,
        p.location_state, p.location_city, p.attributes, p.delivery, 
        p.contact, p.views, p.clicks_count, p.engagement_score
      ORDER BY p.created_at DESC
      LIMIT ${limit}
    `;

    const [recommended, cheapDeals, trending, latest] = await Promise.all([
      pool.query(recommendedQuery),
      pool.query(cheapDealsQuery),
      pool.query(trendingQuery),
      pool.query(latestQuery),
    ]);

    return res.json({
      recommended: recommended.rows.map(normalizeProduct),
      cheapDeals: cheapDeals.rows.map(normalizeProduct),
      trending: trending.rows.map(normalizeProduct),
      latest: latest.rows.map(normalizeProduct),
    });

  } catch (err) {
    console.error("HOMEPAGE ERROR:", err);
    return res.status(500).json({
      message: "Failed to load homepage",
      error: err.message,
    });
  }
});

/* ================= VIEW TRACKING ================= */
router.post("/products/:id/view", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // From auth middleware

    await pool.query(
      `INSERT INTO product_views (product_id, user_id) 
       VALUES ($1, $2) 
       ON CONFLICT DO NOTHING`,
      [id, userId]
    );

    // Update products.views counter
    await pool.query(
      `UPDATE products 
       SET views = views + 1,
           engagement_score = engagement_score + 1,
           updated_at = NOW()
       WHERE id = $1 AND is_active = true`,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("VIEW TRACK ERROR:", err);
    res.status(500).json({ error: "Failed to track view" });
  }
});

export default router;