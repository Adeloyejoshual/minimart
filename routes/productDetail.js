// routes/sellerprofile.js
import express from "express";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* ═══════════════════════════════════════
   DATABASE
═══════════════════════════════════════ */
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ═══════════════════════════════════════
   HELPERS
═══════════════════════════════════════ */

/** Guard against obviously invalid IDs before hitting the DB. */
const isValidId = (id) =>
  typeof id === "string" && id.length >= 10 && id.length <= 64;

/* ═══════════════════════════════════════
   GET /api/seller/:id
   Full seller profile + total_listings
═══════════════════════════════════════ */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ message: "Invalid seller ID" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.phone_number          AS phone,
         u.whatsapp,
         u.country,
         u.state,
         u.city,
         u.profile_image         AS avatar,
         u.store_name,
         u.store_description,
         u.store_logo,
         u.created_at,
         u.updated_at,
         u.products_count        AS total_listings
       FROM public.users u
       WHERE u.id = $1`,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Seller not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("GET /seller/:id failed:", err.message);
    return res.status(500).json({ message: "Failed to fetch seller" });
  }
});

/* ═══════════════════════════════════════
   GET /api/seller/:id/stats
   avg_rating, total_sales, rating_count, total_listings
═══════════════════════════════════════ */
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ message: "Invalid seller ID" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         u.products_count                          AS total_listings,
         u.total_sales::int8                       AS total_sales,
         COALESCE(u.rating, 0.0)::numeric(3,2)    AS avg_rating,
         COUNT(r.id)::int8                         AS rating_count
       FROM public.users u
       LEFT JOIN public.products p
              ON p.seller_id = u.id
             AND p.is_active = true
             AND p.status    = 'active'
       LEFT JOIN public.reviews r ON r.product_id = p.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Seller stats not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("GET /seller/:id/stats failed:", err.message);
    return res.status(500).json({ message: "Failed to fetch seller stats" });
  }
});

/* ═══════════════════════════════════════
   GET /api/seller/:id/products
   Paginated active listings for a seller.
   Query params:
     limit  — default 12, max 24
     offset — default 0
═══════════════════════════════════════ */
router.get("/:id/products", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ message: "Invalid seller ID" });
  }

  // FIX: guard NaN; clamp between 1–24
  const limit  = Math.min(Math.max(parseInt(req.query.limit,  10) || 12, 1), 24);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  try {
    const { rows: products } = await pool.query(
      `SELECT
         p.id,
         p.title,
         p.slug,
         p.description,
         p.price,
         p.media->'images'   AS images,
         p.location_state,
         p.location_city,
         p.status,
         p.views,
         p.created_at
       FROM public.products p
       WHERE p.seller_id = $1
         AND p.is_active  = true
         AND p.status     = 'active'
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    // FIX: CockroachDB JSONB may already return a parsed array; handle both
    const normalised = products.map((p) => ({
      ...p,
      images: Array.isArray(p.images)
        ? p.images
        : p.images
          ? JSON.parse(p.images)
          : [],
    }));

    return res.json({
      products: normalised,
      meta: {
        limit,
        offset,
        returned: normalised.length,
      },
    });
  } catch (err) {
    console.error("GET /seller/:id/products failed:", err.message);
    return res.status(500).json({ message: "Failed to fetch seller products" });
  }
});

export default router;
