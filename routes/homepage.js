// routes/homepage.js

import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= NORMALIZER (REAL VIEWS + SLUG) ================= */
const normalizeProduct = (p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  description: p.description,
  price: parseFloat(p.price),
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
  createdAt: p.created_at,
  is_active: Boolean(p.is_active),
  is_promoted: Boolean(p.is_promoted),
  promotion_end: p.promotion_end,
  promotion_priority: Number(p.promotion_priority || 0),
  status: p.status,
});

/* ================= BASE QUERY (COMPATIBLE + VIEWS + SLUG) ================= */
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
    p.status,
    p.location_state,
    p.location_city,
    p.attributes,
    p.delivery,
    p.contact,
    COALESCE(
      json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL),
      '[]'
    ) AS images
  FROM products p
  LEFT JOIN product_images pi ON p.id = pi.product_id
  WHERE COALESCE(p.is_active, false) = true
`;

/* ================= HOMEPAGE (FRONTEND READY) ================= */
router.get("/homepage", async (req, res) => {
  try {
    /* 🎯 RECOMMENDED */
    const recommendedQuery = `
      ${baseQuery}
      GROUP BY 
        p.id, p.slug, p.title, p.description, p.price, p.created_at,
        p.views, p.clicks_count,
        p.is_active, p.is_promoted, p.promotion_end, p.promotion_priority,
        p.status, p.location_state, p.location_city,
        p.attributes, p.delivery, p.contact
      ORDER BY 
        COALESCE(p.promotion_priority, 0) DESC,
        COALESCE(p.views, 0) DESC,
        p.created_at DESC
      LIMIT 24
    `;

    /* 💸 CHEAP DEALS */
    const cheapDealsQuery = `
      ${baseQuery}
      GROUP BY 
        p.id, p.slug, p.title, p.description, p.price, p.created_at,
        p.views, p.clicks_count,
        p.is_active, p.is_promoted, p.promotion_end, p.promotion_priority,
        p.status, p.location_state, p.location_city,
        p.attributes, p.delivery, p.contact
      HAVING p.price <= 20000
      ORDER BY 
        COALESCE(p.promotion_priority, 0) DESC,
        COALESCE(p.views, 0) DESC,
        p.created_at DESC
      LIMIT 24
    `;

    /* 🔥 TRENDING (High Views) */
    const trendingQuery = `
      ${baseQuery}
      GROUP BY 
        p.id, p.slug, p.title, p.description, p.price, p.created_at,
        p.views, p.clicks_count,
        p.is_active, p.is_promoted, p.promotion_end, p.promotion_priority,
        p.status, p.location_state, p.location_city,
        p.attributes, p.delivery, p.contact
      HAVING COALESCE(p.views, 0) > 5
      ORDER BY p.views DESC, p.clicks_count DESC
      LIMIT 20
    `;

    /* 🆕 LATEST */
    const latestQuery = `
      ${baseQuery}
      GROUP BY 
        p.id, p.slug, p.title, p.description, p.price, p.created_at,
        p.views, p.clicks_count,
        p.is_active, p.is_promoted, p.promotion_end, p.promotion_priority,
        p.status, p.location_state, p.location_city,
        p.attributes, p.delivery, p.contact
      ORDER BY p.created_at DESC
      LIMIT 30
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
    const userId = req.user?.id;

    // Track in product_views
    await pool.query(
      `INSERT INTO product_views (product_id, user_id) 
       VALUES ($1, $2) 
       ON CONFLICT DO NOTHING`,
      [id, userId]
    );

    // Increment products.views counter
    await pool.query(
      `UPDATE products 
       SET views = COALESCE(views, 0) + 1,
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