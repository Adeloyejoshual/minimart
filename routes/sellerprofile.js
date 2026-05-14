import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePage(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseLimit(raw, max = 100, def = 20) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
}

// ─── GET /api/seller/:id ──────────────────────────────────────────────────────
/**
 * Public seller profile — returns seller info, first page of products, and stats.
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Seller basic info
    const userResult = await pool.query(
      `SELECT
         id, name, store_name, store_description,
         store_logo, profile_image,
         verified, store_verified,
         rating, products_count, total_sales,
         created_at, last_login, is_online, trust_score
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const seller = userResult.rows[0];

    // 2. First page of active products
    const productsResult = await pool.query(
      `SELECT
         id, title, price, slug,
         main_image, thumbnail_url,
         views, created_at,
         is_promoted, promotion_priority
       FROM products
       WHERE seller_id = $1
         AND is_active = true
         AND status = 'active'
       ORDER BY promotion_priority DESC, created_at DESC
       LIMIT 20`,
      [id]
    );

    // 3. Aggregated stats — only active products
    const statsResult = await pool.query(
      `SELECT
         COUNT(*)                              AS total_products,
         COALESCE(SUM(views),           0)    AS total_views,
         COALESCE(SUM(clicks_count),    0)    AS total_clicks,
         COALESCE(AVG(conversion_rate), 0)    AS avg_conversion
       FROM products
       WHERE seller_id = $1
         AND is_active = true`,
      [id]
    );

    const s = statsResult.rows[0];

    return res.json({
      seller,
      products: productsResult.rows,
      stats: {
        total_products:  parseInt(s.total_products,  10),
        total_views:     parseInt(s.total_views,     10),
        total_clicks:    parseInt(s.total_clicks,    10),
        avg_conversion:  parseFloat(s.avg_conversion),
      },
    });
  } catch (error) {
    console.error("Seller Profile Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// ─── GET /api/seller/:id/products ────────────────────────────────────────────
/**
 * Paginated products for a seller.
 * Returns { page, limit, total, hasMore, products }
 */
router.get("/:id/products", async (req, res) => {
  const { id } = req.params;

  // FIX: validate + sanitise pagination params before passing to SQL
  const page  = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const offset = (page - 1) * limit;

  try {
    // FIX: fetch total count so the client knows when to stop
    const [productsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT
           id, title, price, slug,
           main_image, thumbnail_url,
           views, created_at,
           is_promoted, promotion_priority
         FROM products
         WHERE seller_id = $1
           AND is_active = true
           AND status = 'active'
         ORDER BY promotion_priority DESC, created_at DESC
         LIMIT $2 OFFSET $3`,
        [id, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) AS total
         FROM products
         WHERE seller_id = $1
           AND is_active = true
           AND status = 'active'`,
        [id]
      ),
    ]);

    const total   = parseInt(countResult.rows[0].total, 10);
    const hasMore = offset + productsResult.rows.length < total;

    res.json({
      page,
      limit,
      total,
      hasMore,
      products: productsResult.rows,
    });
  } catch (error) {
    console.error("Seller Products Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// ─── GET /api/seller/:id/stats ────────────────────────────────────────────────
/**
 * Aggregated stats for a seller's active products only.
 */
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      // FIX: added is_active filter to match the other queries
      `SELECT
         COUNT(*)                                AS total_products,
         COALESCE(SUM(views),           0)       AS total_views,
         COALESCE(SUM(clicks_count),    0)       AS total_clicks,
         COALESCE(SUM(favorites_count), 0)       AS total_favorites,
         COALESCE(SUM(share_count),     0)       AS total_shares
       FROM products
       WHERE seller_id = $1
         AND is_active = true`,
      [id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Seller Stats Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


export default router;
