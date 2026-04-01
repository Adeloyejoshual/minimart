import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= SAFE PRODUCT NORMALIZER ================= */
const normalizeProduct = (p) => ({
  id: p.id,
  title: p.title,
  description: p.description,
  price: Number(p.price || 0),

  location: {
    state: p.location_state || null,
    city: p.location_city || null,
  },

  images: Array.isArray(p.images) ? p.images : [],
  attributes: typeof p.attributes === "string" ? JSON.parse(p.attributes || "{}") : (p.attributes || {}),
  delivery: typeof p.delivery === "string" ? JSON.parse(p.delivery || "{}") : (p.delivery || {}),
  contact: typeof p.contact === "string" ? JSON.parse(p.contact || "{}") : (p.contact || {}),

  is_promoted: p.is_promoted,
  created_at: p.created_at,
});

/* ================= REUSABLE PRODUCT QUERY ================= */
const productQuery = `
  SELECT 
    p.id,
    p.title,
    p.description,
    p.price,
    p.location_state,
    p.location_city,
    p.attributes,
    p.delivery,
    p.contact,
    p.is_promoted,
    p.created_at,
    COALESCE(
      json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL),
      '[]'
    ) AS images
  FROM products p
  LEFT JOIN product_images pi ON p.id = pi.product_id
  WHERE p.is_active = true
  GROUP BY p.id
`;

/* ================= HOMEPAGE ================= */
router.get("/homepage", async (req, res) => {
  try {
    const promotedQuery = `
      ${productQuery}
      AND p.is_promoted = true
      ORDER BY p.promotion_priority DESC NULLS LAST
      LIMIT 10
    `;

    const latestQuery = `
      ${productQuery}
      ORDER BY p.created_at DESC
      LIMIT 20
    `;

    const discoverQuery = `
      ${productQuery}
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

    res.json({
      promoted: promoted.rows.map(normalizeProduct),
      latest: latest.rows.map(normalizeProduct),
      discover: discover.rows.map(normalizeProduct),
      categories: categories.rows,
    });
  } catch (err) {
    console.error("HOMEPAGE ERROR:", err);
    res.status(500).json({
      message: "Failed to load homepage",
    });
  }
});

export default router;