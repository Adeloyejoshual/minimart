// routes/sellerprofile.js
import express from "express";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* ─────────────────────────────────────────────
   DB CONNECTION
   Reuse a single pool instance across requests.
   Import and use the shared pool from db.js in
   production; the inline pool here is fine for
   a self-contained route file.
───────────────────────────────────────────── */
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
  max: 10,              // connection-pool ceiling
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

/* ─────────────────────────────────────────────
   HELPER – safe integer coercion
───────────────────────────────────────────── */
const safeInt = (val) => {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/* ═══════════════════════════════════════════════
   GET /api/seller/:id
   Returns public seller profile data
═══════════════════════════════════════════════ */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  // Basic UUID guard – prevents obviously bad queries
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ message: "Invalid seller ID" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.phone_number      AS phone,
         u.whatsapp,
         u.country,
         u.state,
         u.city,
         u.profile_image     AS avatar,
         u.store_name,
         u.store_description,
         u.store_logo,
         u.store_verified,
         u.is_online,
         u.trust_score,
         u.products_count    AS total_listings,
         u.created_at,
         u.updated_at
       FROM public.users u
       WHERE u.id = $1
         AND u.status = 'active'`,   -- never expose banned/deleted accounts
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Seller not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("[seller/:id]", err.message);
    res.status(500).json({ message: "Failed to fetch seller" });
  }
});

/* ═══════════════════════════════════════════════
   GET /api/seller/:id/stats
   Aggregates avg rating, rating count, total_sales,
   and total_listings from the users table + reviews.
═══════════════════════════════════════════════ */
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ message: "Invalid seller ID" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         u.products_count                          AS total_listings,
         COALESCE(u.total_sales, 0)::int8          AS total_sales,
         COALESCE(u.rating,      0.0)::numeric(3,2) AS avg_rating,
         COUNT(r.id)::int8                         AS rating_count
       FROM public.users u
       LEFT JOIN public.products p
              ON p.seller_id  = u.id
             AND p.is_active  = true
             AND p.status     = 'active'
       LEFT JOIN public.reviews r ON r.product_id = p.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Seller stats not found" });
    }

    const s = rows[0];
    res.json({
      total_listings: safeInt(s.total_listings),
      total_sales:    safeInt(s.total_sales),
      avg_rating:     parseFloat(s.avg_rating) || 0,
      rating_count:   safeInt(s.rating_count),
    });
  } catch (err) {
    console.error("[seller/:id/stats]", err.message);
    res.status(500).json({ message: "Failed to fetch seller stats" });
  }
});

/* ═══════════════════════════════════════════════
   GET /api/seller/:id/products
   Query params:
     limit  – max 24, default 12
     offset – default 0
   Returns active products with a flat images array.

   FIXES vs original:
   ─ Added `slug` column (required by the frontend Link)
   ─ Added `main_image` as image fallback (products
     table has no `media` column per the schema)
   ─ Images are pulled from main_image / thumbnail_url
     and returned as a consistent array
═══════════════════════════════════════════════ */
router.get("/:id/products", async (req, res) => {
  const { id } = req.params;

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ message: "Invalid seller ID" });
  }

  const limit  = Math.min(safeInt(req.query.limit)  || 12, 24);
  const offset = safeInt(req.query.offset);

  try {
    const { rows: products } = await pool.query(
      `SELECT
         p.id,
         p.title,
         p.slug,              -- required for /product/:slug routing
         p.description,
         p.price,
         p.stock,
         p.main_image,        -- primary image source
         p.thumbnail_url,     -- secondary fallback
         p.location_state,
         p.location_city,
         p.status,
         p.views,
         p.created_at
       FROM public.products p
       WHERE p.seller_id = $1
         AND p.is_active = true
         AND p.status    = 'active'
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    /*
      Normalize images into a flat array so the frontend
      can always do `product.images[0]` without branching.
      main_image → images[0], thumbnail_url → images[1].
    */
    const normalized = products.map((p) => {
      const images = [];
      if (p.main_image)    images.push(p.main_image);
      if (p.thumbnail_url) images.push(p.thumbnail_url);

      const { main_image, thumbnail_url, ...rest } = p; // strip raw fields
      return { ...rest, images };
    });

    res.json({
      products: normalized,
      meta: { limit, offset, count: normalized.length },
    });
  } catch (err) {
    console.error("[seller/:id/products]", err.message);
    res.status(500).json({ message: "Failed to fetch seller products" });
  }
});

export default router;
