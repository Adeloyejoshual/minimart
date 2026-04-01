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
  attributes: p.attributes || {},
  delivery: p.delivery || {},
  contact: p.contact || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
});

/* ================= BASE PRODUCT SELECT ================= */
const baseProductQuery = `
  SELECT 
    p.*,
    COALESCE(
      json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL),
      '[]'
    ) AS images
  FROM products p
  LEFT JOIN product_images pi ON p.id = pi.product_id
  WHERE p.is_active = true
`;

/* ================= HOMEPAGE ================= */
router.get("/homepage", async (req, res) => {
  try {
    const promotedQuery = `
      ${baseProductQuery}
      AND p.is_promoted = true
      AND (p.promotion_end IS NULL OR p.promotion_end > NOW())
      GROUP BY p.id
      ORDER BY p.promotion_priority DESC, p.created_at DESC
      LIMIT 10
    `;

    const latestQuery = `
      ${baseProductQuery}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 20
    `;

    const discoverQuery = `
      ${baseProductQuery}
      GROUP BY p.id
      ORDER BY RANDOM()
      LIMIT 10
    `;

    const categoriesQuery = `
      SELECT id, name, parent_id
      FROM categories
      ORDER BY name ASC
    `;

    const [promoted, latest, discover, categories] = await Promise.all([
      pool.query(promotedQuery),
      pool.query(latestQuery),
      pool.query(discoverQuery),
      pool.query(categoriesQuery),
    ]);

    return res.json({
      promoted: promoted.rows.map(normalizeProduct),
      latest: latest.rows.map(normalizeProduct),
      discover: discover.rows.map(normalizeProduct),
      categories: categories.rows,
    });

  } catch (err) {
    console.error("Homepage error:", err);
    return res.status(500).json({
      message: "Failed to load homepage",
    });
  }
});

export default router;