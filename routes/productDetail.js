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

/* ================= DETAIL ROUTE ================= */
router.get("/slug/:slug", async (req, res) => {
  const { slug } = req.params;

  if (!slug || slug === "undefined") {
    return res.status(400).json({ message: "Invalid product slug provided" });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        p.id, p.slug, p.title, p.description, p.price, p.created_at, p.updated_at,
        p.views, p.clicks_count, p.is_active, p.is_promoted, 
        p.promotion_end, p.promotion_priority, p.status,
        p.location_state, p.location_city,
        (p.attributes)::jsonb AS attributes, 
        (p.delivery)::jsonb AS delivery, 
        (p.contact)::jsonb AS contact,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position ASC) 
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'::json
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.slug = $1
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
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("Product fetch error:", err);
    return res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* ================= REVIEWS ROUTE ================= */
router.get("/slug/:slug/reviews", async (req, res) => {
  const { slug } = req.params;
  const { limit = 10, offset = 0 } = req.query;

  try {
    const reviewsQuery = await pool.query(
      `SELECT 
        pr.id, pr.rating, pr.comment, pr.created_at,
        u.name as reviewer_name,
        u.profile_image
       FROM product_reviews pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.product_id = (
         SELECT id FROM products WHERE slug = $1
       )
       ORDER BY pr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [slug, parseInt(limit), parseInt(offset)]
    );

    const statsQuery = await pool.query(
      `SELECT 
        COUNT(*) as total_reviews,
        AVG(rating)::DECIMAL(3,1) as avg_rating,
        COUNT(*) FILTER (WHERE rating = 5) as five_star,
        COUNT(*) FILTER (WHERE rating = 1) as one_star
       FROM product_reviews pr
       WHERE pr.product_id = (
         SELECT id FROM products WHERE slug = $1
       )`,
      [slug]
    );

    res.json({
      reviews: reviewsQuery.rows,
      stats: statsQuery.rows[0],
      has_more: reviewsQuery.rows.length === parseInt(limit)
    });
  } catch (err) {
    console.error("Reviews error:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

/* ================= SELLER STATS ROUTE ================= */
router.get("/slug/:slug/seller-stats", async (req, res) => {
  const { slug } = req.params;

  try {
    const { rows: [product] } = await pool.query(
      `SELECT (contact)::jsonb->>'email' as seller_email, (contact)::jsonb->>'phone' as seller_phone 
       FROM products WHERE slug = $1`,
      [slug]
    );

    if (!product?.seller_email) {
      return res.status(404).json({ message: "No seller found" });
    }

    const sellerEmail = product.seller_email;

    const sellerQuery = await pool.query(
      `SELECT 
        store_name, 
        products_count,
        total_sales,
        rating,
        store_verified,
        EXTRACT(YEAR FROM age(created_at)) as years_active
       FROM users 
       WHERE email = $1`,
      [sellerEmail]
    );

    const feedbackQuery = await pool.query(
      `SELECT 
        COUNT(*) as total_feedback,
        AVG(rating) as avg_rating,
        ARRAY_AGG(
          json_build_object(
            'user', u.name,
            'comment', pr.comment,
            'rating', pr.rating,
            'date', age(pr.created_at)
          )
          ORDER BY pr.created_at DESC
          LIMIT 3
        ) as recent_feedback
       FROM product_reviews pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.product_id IN (
         SELECT id FROM products WHERE (contact)::jsonb->>'email' = $1
       )`,
      [sellerEmail]
    );

    const followersQuery = await pool.query(
      `SELECT COUNT(*) as followers 
       FROM seller_followers sf 
       JOIN users u ON sf.seller_id = u.id 
       WHERE u.email = $1`,
      [sellerEmail]
    );

    const seller = sellerQuery.rows[0] || {};
    const feedback = feedbackQuery.rows[0] || {};
    const followers = followersQuery.rows[0] || { followers: 0 };

    res.json({
      total_ads: seller.products_count || 0,
      years_on_platform: seller.years_active || 0,
      verified_id: seller.store_verified || false,
      total_feedback: Number(feedback.total_feedback) || 0,
      avg_rating: Number(feedback.avg_rating)?.toFixed(1) || '0.0',
      followers: Number(followers.followers) || 0,
      recent_feedback: feedback.recent_feedback || [],
      store_name: seller.store_name || 'Seller',
      response_time: '1 hour'
    });
  } catch (err) {
    console.error("Seller stats error:", err);
    res.status(500).json({ error: "Failed to fetch seller stats" });
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