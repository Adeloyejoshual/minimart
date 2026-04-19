// routes/products.js

import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

const safeJSON = (value, fallback = {}) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeProduct = (p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  description: p.description,
  price: parseFloat(p.price),
  images: Array.isArray(p.images)
    ? p.images.map((img) => img.url)
    : [],
  attributes: safeJSON(p.attributes, {}),
  delivery: safeJSON(p.delivery, {}),
  contact: safeJSON(p.contact, {}),
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
  status: p.status,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

/**
 * GET /api/products
 *
 * Query params:
 *   - category_id
 *   - limit
 *   - offset
 */
router.get("/", async (req, res) => {
  const { category_id, limit = 12, offset = 0 } = req.query;

  const parsedLimit = Math.min(Math.max(Number(limit), 1), 100) || 12;
  const parsedOffset = Math.max(Number(offset), 0);

  try {
    // Build dynamic WHERE clause
    let where = "COALESCE(p.is_active, false) = true";
    const params = [];

    if (category_id) {
      params.push(category_id);
      where += ` AND p.category_id = $${params.length}`;
    }

    const sql = `
      SELECT
        p.*,
        COALESCE(
          json_agg(
            json_build_object('url', pi.image_url)
            ORDER BY pi.position
          ) FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE ${where}
      GROUP BY p.id
      ORDER BY p.created_at DESC
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
    console.error("Failed to fetch products:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

export default router;