// routes/productDetail.js

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

// GET /api/product/slug/:slug
router.get("/slug/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const { rows } = await pool.query(
      `
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
      WHERE
        p.slug = $1
        AND COALESCE(p.is_active, false) = true
      GROUP BY p.id
      LIMIT 1;
      `,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const product = normalizeProduct(rows[0]);
    res.status(200).json(product);
  } catch (err) {
    console.error("Failed to fetch product by slug:", err);
    res.status(500).json({
      message: "Failed to fetch product",
    });
  }
});

export default router;