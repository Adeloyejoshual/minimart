// routes/productDetail.js

import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= NORMALIZER (match homepage) ================= */
const normalizeProduct = (p) => ({
  ...p,
  id: p.id,
  title: p.title,
  description: p.description,
  price: parseFloat(p.price),
  createdAt: p.created_at,
  updatedAt: p.updated_at,
  views: Number(p.views || 0),
  clicks_count: Number(p.clicks_count || 0),
  is_active: Boolean(p.is_active),
  is_promoted: Boolean(p.is_promoted),
  promotion_end: p.promotion_end,
  promotion_priority: Number(p.promotion_priority || 0),
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  media: typeof p.media === "string"
    ? JSON.parse(p.media)
    : p.media || { images: [], videos: [] },
  attributes: typeof p.attributes === "string"
    ? JSON.parse(p.attributes)
    : p.attributes || {},
  delivery: typeof p.delivery === "string"
    ? JSON.parse(p.delivery)
    : p.delivery || {},
  contact: typeof p.contact === "string"
    ? JSON.parse(p.contact)
    : p.contact || {},
  whatsapp: p.whatsapp,
  whatsapp_link: p.whatsapp_link,
  phone: p.phone,
  slug: p.slug,
  status: p.status,
  engagement_score: Number(p.engagement_score || 0),
  user_id: p.user_id,
  seller_id: p.seller_id,
  category_id: p.category_id,
  subcategory_id: p.subcategory_id,
  promotion_id: p.promotion_id,
  promotion_type: p.promotion_type,
});

/* ================= DETAIL BY ID (NO STATUS, allow draft) ================= */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        p.*,
        c.name AS "categoryName",
        u.email AS "sellerEmail"
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.id::text = $1
        AND COALESCE(p.is_active, false) = true
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Product not found",
        id: id,
      });
    }

    const p = rows[0];
    const product = normalizeProduct(p);

    // enrich with category if you want
    product.category = { name: p.categoryName || null };

    return res.json(product);
  } catch (err) {
    console.error("PRODUCT DETAIL ERROR:", err);
    return res.status(500).json({
      message: "Failed to load product detail",
    });
  }
});

export default router;