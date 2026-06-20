// routes/sellerprofile.js
import express  from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller/:id
═══════════════════════════════════════════════════════════════ */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // ── Seller info ──────────────────────────────────────────
    const { rows: userRows } = await pool.query(
      `SELECT
         id,
         name,
         store_name,
         store_description,
         store_logo,
         profile_image,
         verified,
         store_verified,
         rating,
         products_count,
         total_sales,
         created_at,
         last_login,
         is_online,
         trust_score
       FROM public.users
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (!userRows[0]) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const seller = {
      ...userRows[0],
      trust_score    : Number(userRows[0].trust_score    || 50),
      rating         : Number(userRows[0].rating         || 0),
      products_count : Number(userRows[0].products_count || 0),
      total_sales    : Number(userRows[0].total_sales    || 0),
    };

    // ── Seller products ───────────────────────────────────────
    const { rows: products } = await pool.query(
      `SELECT
         id,
         title,
         price,
         slug,
         main_image,
         thumbnail_url,
         views,
         created_at,
         is_promoted,
         promotion_priority,
         location_city,
         location_state,
         engagement_score,
         boost_score
       FROM public.products
       WHERE seller_id = $1
         AND is_active = true
         AND status    = 'active'
       ORDER BY promotion_priority DESC, created_at DESC
       LIMIT 50`,
      [id]
    );

    // Normalize products — build image field
    const normalizedProducts = products.map((p) => ({
      ...p,
      image  : p.main_image || p.thumbnail_url || null,
      images : p.main_image ? [p.main_image] : [],
      price  : Number(p.price || 0),
      views  : Number(p.views || 0),
    }));

    // ── Stats ─────────────────────────────────────────────────
    const { rows: statsRows } = await pool.query(
      `SELECT
         COUNT(*)::int                          AS total_products,
         COALESCE(SUM(views), 0)::int           AS total_views,
         COALESCE(SUM(clicks_count), 0)::int    AS total_clicks,
         COALESCE(AVG(conversion_rate), 0)      AS avg_conversion
       FROM public.products
       WHERE seller_id = $1
         AND is_active = true`,
      [id]
    );

    const s = statsRows[0] || {};

    return res.json({
      seller,
      products : normalizedProducts,
      stats    : {
        total_products : Number(s.total_products  || 0),
        total_views    : Number(s.total_views     || 0),
        total_clicks   : Number(s.total_clicks    || 0),
        avg_conversion : parseFloat(s.avg_conversion || 0),
      },
      hasMore : products.length === 50,
    });

  } catch (err) {
    console.error("[sellerprofile] GET /:id →", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller/:id/products?page=&limit=
═══════════════════════════════════════════════════════════════ */
router.get("/:id/products", async (req, res) => {
  const { id }   = req.params;
  const page     = Math.max(1,  parseInt(req.query.page,  10) || 1);
  const limit    = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const offset   = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT
         id,
         title,
         price,
         slug,
         main_image,
         thumbnail_url,
         views,
         created_at,
         is_promoted,
         promotion_priority,
         location_city,
         location_state,
         engagement_score,
         boost_score
       FROM public.products
       WHERE seller_id = $1
         AND is_active = true
         AND status    = 'active'
       ORDER BY promotion_priority DESC, created_at DESC
       LIMIT  $2
       OFFSET $3`,
      [id, limit, offset]
    );

    const products = rows.map((p) => ({
      ...p,
      image  : p.main_image || p.thumbnail_url || null,
      images : p.main_image ? [p.main_image] : [],
      price  : Number(p.price || 0),
      views  : Number(p.views || 0),
    }));

    return res.json({
      page,
      limit,
      products,
      hasMore : rows.length === limit,
    });

  } catch (err) {
    console.error("[sellerprofile] GET /:id/products →", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller/:id/stats
═══════════════════════════════════════════════════════════════ */
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int                         AS total_products,
         COALESCE(SUM(views), 0)::int          AS total_views,
         COALESCE(SUM(clicks_count), 0)::int   AS total_clicks,
         COALESCE(SUM(favorites_count), 0)::int AS total_favorites,
         COALESCE(SUM(share_count), 0)::int    AS total_shares
       FROM public.products
       WHERE seller_id = $1`,
      [id]
    );

    const s = rows[0] || {};
    return res.json({
      total_products : Number(s.total_products  || 0),
      total_views    : Number(s.total_views     || 0),
      total_clicks   : Number(s.total_clicks    || 0),
      total_favorites: Number(s.total_favorites || 0),
      total_shares   : Number(s.total_shares    || 0),
    });

  } catch (err) {
    console.error("[sellerprofile] GET /:id/stats →", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;