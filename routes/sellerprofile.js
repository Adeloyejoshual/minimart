// routes/sellerprofile.js
import express from "express";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* ================= DATABASE ================= */
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ======================
   GET SELLER INFO + TOTAL_LISTINGS
   ====================== */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone_number AS phone,
        u.whatsapp AS whatsapp,
        u.country,
        u.state,
        u.city,
        u.profile_image AS avatar,
        u.store_name,
        u.store_description,
        u.store_logo,
        u.created_at,
        u.updated_at,
        u.products_count AS total_listings
      FROM public.users u
      WHERE u.id = $1
    `;

    const { rows } = await pool.query(query, [id]);
    const seller = rows[0];

    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    res.json(seller);
  } catch (err) {
    console.error("Failed to fetch seller:", err.message);
    res.status(500).json({ message: "Failed to fetch seller" });
  }
});

/* ======================
   GET SELLER STATS (avg rating, total_sales, rating count)
   ====================== */
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;

  try {
    const statsQuery = `
      SELECT
        u.products_count AS total_listings,
        u.total_sales::int8 AS total_sales,
        COALESCE(u.rating, 0.0)::numeric(3,2) AS avg_rating,
        COUNT(r.id) AS rating_count
      FROM public.users u
      LEFT JOIN public.products p ON p.seller_id = u.id AND p.is_active = true AND p.status = 'active'
      LEFT JOIN public.reviews r ON r.product_id = p.id
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const { rows } = await pool.query(statsQuery, [id]);
    const stats = rows[0];

    if (!stats) {
      return res.status(404).json({ message: "Seller stats not found" });
    }

    res.json(stats);
  } catch (err) {
    console.error("Failed to fetch seller stats:", err.message);
    res.status(500).json({ message: "Failed to fetch seller stats" });
  }
});

/* ======================
   GET ALL PRODUCTS BY SELLER (active, with pagination)
   ====================== */
router.get("/:id/products", async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 12, 24);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const query = `
      SELECT
        p.id,
        p.title,
        p.description,
        p.price,
        p.stock,
        p.media->'images' AS images,
        p.location_state,
        p.location_city,
        p.status,
        p.created_at
      FROM public.products p
      WHERE p.seller_id = $1 AND p.is_active = true AND p.status = 'active'
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const { rows: products } = await pool.query(query, [id, limit, offset]);

    // Transform to flat array of images expected by ProductDetail.jsx
    const productsWithFlatImages = products.map((p) => ({
      ...p,
      images: p.images ? JSON.parse(p.images) : [],
    }));

    res.json({
      products: productsWithFlatImages,
      meta: {
        limit,
        offset,
        total: productsWithFlatImages.length,
      },
    });
  } catch (err) {
    console.error("Failed to fetch seller products:", err.message);
    res.status(500).json({ message: "Failed to fetch seller products" });
  }
});

export default router;