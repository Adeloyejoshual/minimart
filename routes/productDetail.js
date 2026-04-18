// routes/productDetail.js

import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: {
    rejectUnauthorized: false,
  },
});

// GET /api/product/:key   where :key = id (UUID)
router.get("/:key", async (req, res) => {
  const { key } = req.params;

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
      WHERE
        p.id::text = $1
        AND p.is_active = true
        AND p.status = 'active'
      `,
      [key]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const product = rows[0];

    const media =
      typeof product.media === "string"
        ? JSON.parse(product.media)
        : product.media || { images: [], videos: [] };
    const attributes =
      typeof product.attributes === "string"
        ? JSON.parse(product.attributes)
        : product.attributes || {};
    const contact =
      typeof product.contact === "string"
        ? JSON.parse(product.contact)
        : product.contact || {};
    const delivery =
      typeof product.delivery === "string"
        ? JSON.parse(product.delivery)
        : product.delivery || {};

    return res.json({
      id: product.id,
      title: product.title,
      slug: product.slug,
      price: parseFloat(product.price),
      description: product.description,
      category: { name: product.categoryName },
      subcategory_id: product.subcategory_id,
      seller_id: product.seller_id,
      user_id: product.user_id,
      category_id: product.category_id,
      promotion_id: product.promotion_id,
      promotion_type: product.promotion_type,
      is_promoted: product.is_promoted,
      promotion_priority: parseInt(product.promotion_priority) || 0,
      promotion_start: product.promotion_start,
      promotion_end: product.promotion_end,
      promotion_expires_at: product.promotion_expires_at,
      location_state: product.location_state,
      location_city: product.location_city,
      delivery,
      contact,
      media,
      whatsapp: product.whatsapp,
      whatsapp_link: product.whatsapp_link,
      phone: product.phone,
      status: product.status,
      is_active: product.is_active,
      engagement_score: parseInt(product.engagement_score) || 0,
      clicks_count: parseInt(product.clicks_count) || 0,
      created_at: product.created_at,
      updated_at: product.updated_at,
      views: parseInt(product.views) || 0,
    });
  } catch (err) {
    console.error("Error fetching product:", err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

export default router;