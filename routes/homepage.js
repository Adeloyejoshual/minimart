import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= NORMALIZER ================= */
const normalizeProduct = (p) => ({
  ...p,
  images: p.images || [],
  views: Number(p.views_count || p.views || 0), // Real views fallback
  clicks_count: Number(p.clicks_count || 0),
  createdAt: p.created_at,
  location_city: p.location_city,
});

/* ================= FIXED BASE QUERY ================= */
const baseQuery = `
  SELECT DISTINCT ON (p.id)
    p.id,
    p.title,
    p.description,
    p.price,
    p.created_at,
    p.views,
    p.clicks_count,
    p.location_city,
    p.is_promoted,
    p.promotion_priority,
    COALESCE(
      json_agg(pi.image_url ORDER BY pi.position LIMIT 1)
      FILTER (WHERE pi.image_url IS NOT NULL),
      '[]'
    ) AS images
  FROM products p
  LEFT JOIN product_images pi ON p.id = pi.product_id
  LEFT JOIN product_views pv ON p.id = pv.product_id 
    AND pv.created_at >= NOW() - INTERVAL '30 days'
  WHERE p.is_active = true 
    AND p.status = 'active'
  GROUP BY p.id, p.title, p.description, p.price, p.created_at, p.views, 
           p.clicks_count, p.location_city, p.is_promoted, p.promotion_priority, pi.image_url
`;

/* ================= FIXED HOMEPAGE ================= */
router.get("/homepage", async (req, res) => {
  try {
    // BACKWARD COMPATIBLE - return 'latest' like before
    const latestQuery = `
      ${baseQuery}
      ORDER BY 
        COALESCE(p.promotion_priority, 0) DESC,
        COALESCE(p.views, 0) DESC,
        p.created_at DESC
      LIMIT 50
    `;

    const result = await pool.query(latestQuery);

    return res.json({
      latest: result.rows.map(normalizeProduct), // Frontend expects this!
    });

  } catch (err) {
    console.error("HOMEPAGE ERROR:", err);
    return res.status(500).json({
      message: "Failed to load homepage",
      error: err.message,
    });
  }
});

export default router;