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

  images: p.images || [],

  attributes: p.attributes || {},
  delivery: p.delivery || {},
  contact: p.contact || {},

  location: {
    state: p.location_state,
    city: p.location_city,
  },

  // ✅ SELLER (SOURCE OF TRUTH)
  seller: {
    id: p.seller_id,
    name: p.seller_name,
    profile_image: p.profile_image,
    store_name: p.store_name,
    verified: p.store_verified,
    rating: Number(p.rating || 0),
  },

  views: Number(p.views || 0),
  clicks_count: Number(p.clicks_count || 0),

  is_active: p.is_active,
  is_promoted: p.is_promoted,
  promotion_end: p.promotion_end,
  promotion_priority: p.promotion_priority,

  status: p.status,

  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

/* ================= PRODUCT DETAIL ================= */
router.get("/slug/:slug", async (req, res) => {
  const { slug } = req.params;

  if (!slug || slug === "undefined") {
    return res.status(400).json({ message: "Invalid slug" });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        p.*,

        u.name AS seller_name,
        u.profile_image,
        u.store_name,
        u.store_verified,
        u.rating,

        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position ASC)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images

      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN product_images pi ON p.id = pi.product_id

      WHERE p.slug = $1

      GROUP BY p.id, u.id
      LIMIT 1;
      `,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("Product error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* ================= REVIEWS ================= */
router.get("/slug/:slug/reviews", async (req, res) => {
  const { slug } = req.params;
  const { limit = 5, offset = 0 } = req.query;

  try {
    const reviews = await pool.query(
      `
      SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        u.name AS reviewer_name,
        u.profile_image
      FROM reviews r
      JOIN users u ON r.buyer_id = u.id
      WHERE r.product_id = (
        SELECT id FROM products WHERE slug = $1
      )
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3;
      `,
      [slug, Number(limit), Number(offset)]
    );

    const stats = await pool.query(
      `
      SELECT
        COUNT(*) AS total_reviews,
        AVG(rating)::DECIMAL(3,1) AS avg_rating
      FROM reviews
      WHERE product_id = (
        SELECT id FROM products WHERE slug = $1
      );
      `,
      [slug]
    );

    res.json({
      reviews: reviews.rows,
      stats: stats.rows[0] || {},
      has_more: reviews.rows.length === Number(limit),
    });
  } catch (err) {
    console.error("Reviews error:", err);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

/* ================= SELLER STATS ================= */
router.get("/slug/:slug/seller-stats", async (req, res) => {
  const { slug } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        u.id,
        u.store_name,
        u.products_count,
        u.total_sales,
        u.rating,
        u.store_verified,
        EXTRACT(YEAR FROM age(u.created_at)) AS years_active
      FROM users u
      WHERE u.id = (
        SELECT seller_id FROM products WHERE slug = $1
      )
      LIMIT 1;
      `,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Seller not found" });
    }

    const seller = rows[0];

    // Feedback from all seller products
    const feedback = await pool.query(
      `
      SELECT
        COUNT(*) AS total_feedback,
        AVG(r.rating) AS avg_rating
      FROM reviews r
      WHERE r.product_id IN (
        SELECT id FROM products WHERE seller_id = $1
      );
      `,
      [seller.id]
    );

    res.json({
      total_listings: seller.products_count || 0,
      total_sales: seller.total_sales || 0,
      avg_rating: Number(
        feedback.rows[0]?.avg_rating || seller.rating || 0
      ).toFixed(1),
      verified: seller.store_verified,
      years_active: seller.years_active,
      store_name: seller.store_name || "Seller",
    });
  } catch (err) {
    console.error("Seller stats error:", err);
    res.status(500).json({ message: "Failed to fetch seller stats" });
  }
});

/* ================= REDIRECT ================= */
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT slug FROM products WHERE id = $1 LIMIT 1`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.redirect(301, `/api/product/slug/${rows[0].slug}`);
  } catch (err) {
    console.error("Redirect error:", err);
    res.status(500).json({ message: "Redirect failed" });
  }
});

export default router;