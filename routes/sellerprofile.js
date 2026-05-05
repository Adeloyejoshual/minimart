// routes/sellerprofile.js
import express from "express";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const safeInt = (val) => {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// GET /api/marketplace/sellers/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  // ── DIAGNOSTIC: visible in Render logs ──────────────
  console.log("[seller/:id] received id →", JSON.stringify(id));
  // ────────────────────────────────────────────────────

  if (!id) return res.status(400).json({ message: "Invalid seller ID" });

  try {
    // First confirm the user table is reachable and count rows
    const { rows: debug } = await pool.query(
      `SELECT id, name, status FROM public.users WHERE id = $1`,
      [id]
    );

    console.log("[seller/:id] raw query result →", JSON.stringify(debug));

    if (!debug.length) {
      // Also log what IDs exist so we can compare
      const { rows: sample } = await pool.query(
        `SELECT id, name FROM public.users LIMIT 5`
      );
      console.log("[seller/:id] sample user IDs in DB →", JSON.stringify(sample));
      return res.status(404).json({ message: "Seller not found", received_id: id });
    }

    const { rows } = await pool.query(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.phone_number   AS phone,
        u.whatsapp,
        u.country,
        u.state,
        u.city,
        u.profile_image  AS avatar,
        u.store_name,
        u.store_description,
        u.store_logo,
        u.store_verified,
        u.is_online,
        u.trust_score,
        u.products_count AS total_listings,
        u.created_at,
        u.updated_at
      FROM public.users u
      WHERE u.id = $1`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("[seller/:id] DB error →", err.message);
    res.status(500).json({ message: "Failed to fetch seller", error: err.message });
  }
});

// GET /api/marketplace/sellers/:id/stats
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;
  console.log("[seller/:id/stats] received id →", JSON.stringify(id));

  if (!id) return res.status(400).json({ message: "Invalid seller ID" });

  try {
    const { rows } = await pool.query(
      `SELECT
        u.products_count                      AS total_listings,
        COALESCE(u.total_sales, 0)::int8      AS total_sales,
        COALESCE(u.rating, 0.0)::numeric(3,2) AS avg_rating,
        COUNT(r.id)::int8                     AS rating_count
      FROM public.users u
      LEFT JOIN public.products p
             ON p.seller_id = u.id
            AND p.is_active = true
            AND p.status = 'active'
      LEFT JOIN public.reviews r ON r.product_id = p.id
      WHERE u.id = $1
      GROUP BY u.id`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Seller stats not found", received_id: id });
    }

    const s = rows[0];
    res.json({
      total_listings: safeInt(s.total_listings),
      total_sales:    safeInt(s.total_sales),
      avg_rating:     parseFloat(s.avg_rating) || 0,
      rating_count:   safeInt(s.rating_count),
    });
  } catch (err) {
    console.error("[seller/:id/stats] DB error →", err.message);
    res.status(500).json({ message: "Failed to fetch seller stats", error: err.message });
  }
});

// GET /api/marketplace/sellers/:id/products
router.get("/:id/products", async (req, res) => {
  const { id } = req.params;
  console.log("[seller/:id/products] received id →", JSON.stringify(id));

  if (!id) return res.status(400).json({ message: "Invalid seller ID" });

  const limit  = Math.min(safeInt(req.query.limit) || 12, 24);
  const offset = safeInt(req.query.offset);

  try {
    const { rows: products } = await pool.query(
      `SELECT
        p.id,
        p.title,
        p.slug,
        p.description,
        p.price,
        p.stock,
        p.main_image,
        p.thumbnail_url,
        p.location_state,
        p.location_city,
        p.status,
        p.views,
        p.created_at
      FROM public.products p
      WHERE p.seller_id = $1
        AND p.is_active = true
        AND p.status = 'active'
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    const normalized = products.map((p) => {
      const images = [];
      if (p.main_image)    images.push(p.main_image);
      if (p.thumbnail_url) images.push(p.thumbnail_url);
      const { main_image, thumbnail_url, ...rest } = p;
      return { ...rest, images };
    });

    res.json({
      products: normalized,
      meta: { limit, offset, count: normalized.length },
    });
  } catch (err) {
    console.error("[seller/:id/products] DB error →", err.message);
    res.status(500).json({ message: "Failed to fetch seller products", error: err.message });
  }
});

export default router;
