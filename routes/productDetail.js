import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= NORMALIZER ================= */
const normalizeProduct = (p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  description: p.description,
  price: Number(p.price || 0),
  images: Array.isArray(p.images) ? p.images : [],
  attributes: p.attributes || {},
  delivery: p.delivery || {},
  contact: p.contact || {},
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

/* ================= DETAIL ROUTE - SHOWS ALL (draft + active + published) ================= */
router.get("/slug/:slug", async (req, res) => {
  const { slug } = req.params;

  // Guard against undefined slugs from frontend
  if (!slug || slug === "undefined") {
    return res.status(400).json({ 
      message: "Invalid product slug provided" 
    });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        p.id, p.slug, p.title, p.description, p.price, p.created_at, p.updated_at,
        p.views, p.clicks_count, p.is_active, p.is_promoted, 
        p.promotion_end, p.promotion_priority, p.status,
        p.location_state, p.location_city,
        p.attributes, p.delivery, p.contact,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position ASC) 
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'::json
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.slug = $1
        -- ✅ SHOWS ALL: drafts, active, published - only requires slug match
      GROUP BY 
        p.id, p.slug, p.title, p.description, p.price, p.created_at, p.updated_at,
        p.views, p.clicks_count, p.is_active, p.is_promoted, 
        p.promotion_end, p.promotion_priority, p.status,
        p.location_state, p.location_city,
        p.attributes, p.delivery, p.contact
      LIMIT 1;
      `,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).json({ 
        message: "Product not found" 
      });
    }

    return res.status(200).json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("Product fetch error:", err);
    return res.status(500).json({ 
      message: "Failed to fetch product" 
    });
  }
});

/* ================= REDIRECT BY ID ================= */
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT slug FROM products WHERE id = $1 LIMIT 1",
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.redirect(301, `/api/product/slug/${rows[0].slug}`);
  } catch (err) {
    console.error("Product ID redirect error:", err);
    return res.status(500).json({ message: "Redirect failed" });
  }
});

export default router;