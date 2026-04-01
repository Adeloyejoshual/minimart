import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= HELPERS ================= */
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

/* ================= HOMEPAGE ================= */
router.get("/homepage", async (req, res) => {
  try {
    /* 🔥 PROMOTED PRODUCTS */
    const promotedQuery = `
      SELECT p.*,
      COALESCE(json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id=pi.product_id
      WHERE p.is_active=true
      AND p.is_promoted=true
      AND (p.promotion_end IS NULL OR p.promotion_end > now())
      GROUP BY p.id
      ORDER BY p.promotion_priority DESC
      LIMIT 10
    `;

    /* 🆕 LATEST PRODUCTS */
    const latestQuery = `
      SELECT p.*,
      COALESCE(json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id=pi.product_id
      WHERE p.is_active=true
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 20
    `;

    /* ⭐ RANDOM / DISCOVER */
    const randomQuery = `
      SELECT p.*,
      COALESCE(json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id=pi.product_id
      WHERE p.is_active=true
      GROUP BY p.id
      ORDER BY RANDOM()
      LIMIT 10
    `;

    /* 📂 CATEGORIES */
    const categoriesQuery = `
      SELECT id, name, parent_id
      FROM categories
      ORDER BY name ASC
    `;

    const [promoted, latest, random, categories] = await Promise.all([
      pool.query(promotedQuery),
      pool.query(latestQuery),
      pool.query(randomQuery),
      pool.query(categoriesQuery),
    ]);

    res.json({
      promoted: promoted.rows.map(normalizeProduct),
      latest: latest.rows.map(normalizeProduct),
      discover: random.rows.map(normalizeProduct),
      categories: categories.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load homepage" });
  }
});

export default router;