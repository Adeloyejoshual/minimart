// src/routes/productDetail.js

const express = require("express");
const { Pool } = require("pg"); // assuming you use node‑pg for CockroachDB
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: {
    rejectUnauthorized: false,
  },
});

// GET /api/product/:key
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
        p.slug = $1
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

    // Parse JSONB fields safely
    const media = typeof product.media === "string"
      ? JSON.parse(product.media)
      : product.media || { images: [], videos: [] };
    const attributes = typeof product.attributes === "string"
      ? JSON.parse(product.attributes)
      : product.attributes || {};
    const contact = typeof product.contact === "string"
      ? JSON.parse(product.contact)
      : product.contact || {};

    return res.json({
      id: product.id,
      title: product.title,
      slug: product.slug,
      price: parseFloat(product.price),
      description: product.description,
      category: { name: product.categoryName },
      subcategory_id: product.subcategory_id,
      promotion_id: product.promotion_id,
      promotion_type: product.promotion_type,
      is_promoted: product.is_promoted,
      promotion_priority: parseInt(product.promotion_priority) || 0,
      promotion_start: product.promotion_start,
      promotion_end: product.promotion_end,
      promotion_expires_at: product.promotion_expires_at,
      location_state: product.location_state,
      location_city: product.location_city,
      delivery: typeof product.delivery === "string"
        ? JSON.parse(product.delivery)
        : product.delivery || {},
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
    });
  } catch (err) {
    console.error("Error fetching product:", err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

module.exports = router;