// routes/products.js

import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= NORMALIZER (REAL VIEWS) ================= */
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
  views: Number(p.views || 0),
  clicks_count: Number(p.clicks_count || 0),
  createdAt: p.created_at,
});

/* ================= BASE QUERY (COMPATIBLE + VIEWS) ================= */
const baseQuery = `
  SELECT 
    p.id,
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
      json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL),
      '[]'
    ) AS images
  FROM products p
  LEFT JOIN product_images pi ON p.id = pi.product_id
  WHERE COALESCE(p.is_active, false) = true
`;

/* ================= SIMILAR PRODUCTS (BY CATEGORY) ================= */
router.get("/", async (req, res) => {
  const { category_id, limit = 12, offset = 0 } = req.query;

  const parsedLimit = Math.min(Math.max(Number(limit), 1), 100) || 12;
  const parsedOffset = Math.max(Number(offset), 0);

  try {
    let where = "TRUE";
    const params = [];

    if (category_id) {
      params.push(category_id);
      where += ` AND p.category_id = $${params.length}`;
    }

    const sql = `
      ${baseQuery}
      GROUP BY 
        p.id, p.title, p.description, p.price, p.created_at, p.views, p.clicks_count,
        p.is_active, p.is_promoted, p.promotion_end, p.promotion_priority,
        p.location_state, p.location_city, p.attributes, p.delivery, p.contact
      ORDER BY 
        COALESCE(p.promotion_priority, 0) DESC,
        COALESCE(p.views, 0) DESC,
        p.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const { rows } = await pool.query(sql, [
      ...params,
      parsedLimit,
      parsedOffset,
    ]);

    const products = rows.map(normalizeProduct);

    res.status(200).json({
      products,
      total: products.length,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  } catch (err) {
    console.error("Failed to fetch similar products:", err);
    res.status(500).json({ message: "Failed to fetch similar products" });
  }
});

export default router;