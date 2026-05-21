// routes/sellerprofile.js — use the shared pool from server.js
import express    from "express";
import { pool }   from "../server.js";   // ← USE THIS, not a new Pool()

const router = express.Router();

/**
 * GET /api/seller/:id
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  console.log("🏪 GET /seller/:id =", id);

  try {
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

    const seller = userRows[0];
    console.log("✅ Seller found:", seller.id, seller.name);

    const { rows: products } = await pool.query(
      `SELECT
         id,
         title,
         price,
         slug,
         images,
         main_image,
         thumbnail_url,
         views,
         created_at,
         is_promoted,
         promotion_priority
       FROM public.products
       WHERE seller_id = $1
         AND is_active  = true
         AND status     = 'active'
       ORDER BY promotion_priority DESC, created_at DESC
       LIMIT 50`,
      [id]
    );

    const { rows: statsRows } = await pool.query(
      `SELECT
         COUNT(*)                              AS total_products,
         COALESCE(SUM(views), 0)              AS total_views,
         COALESCE(SUM(clicks_count), 0)       AS total_clicks,
         COALESCE(AVG(conversion_rate), 0)    AS avg_conversion
       FROM public.products
       WHERE seller_id = $1
         AND is_active  = true`,
      [id]
    );

    const s = statsRows[0];

    return res.json({
      seller,
      products,
      stats: {
        total_products: parseInt(s.total_products,  10),
        total_views:    parseInt(s.total_views,     10),
        total_clicks:   parseInt(s.total_clicks,    10),
        avg_conversion: parseFloat(s.avg_conversion),
      },
      hasMore: products.length === 50,
    });

  } catch (err) {
    console.error("GET /seller/:id error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/seller/:id/products?page=&limit=
 */
router.get("/:id/products", async (req, res) => {
  const { id }              = req.params;
  const page                = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit               = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const offset              = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT
         id,
         title,
         price,
         slug,
         images,
         main_image,
         thumbnail_url,
         views,
         created_at,
         is_promoted,
         promotion_priority
       FROM public.products
       WHERE seller_id = $1
         AND is_active  = true
         AND status     = 'active'
       ORDER BY promotion_priority DESC, created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    return res.json({
      page,
      limit,
      products: rows,
      hasMore:  rows.length === limit,
    });

  } catch (err) {
    console.error("GET /seller/:id/products error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/seller/:id/stats
 */
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)                               AS total_products,
         COALESCE(SUM(views), 0)               AS total_views,
         COALESCE(SUM(clicks_count), 0)        AS total_clicks,
         COALESCE(SUM(favorites_count), 0)     AS total_favorites,
         COALESCE(SUM(share_count), 0)         AS total_shares
       FROM public.products
       WHERE seller_id = $1`,
      [id]
    );

    return res.json(rows[0]);
  } catch (err) {
    console.error("GET /seller/:id/stats error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;