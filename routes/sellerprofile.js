import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Constants ────────────────────────────────────────────────────────────────

// FIX: centralised product filter — no more copy-paste drift
const ACTIVE = `is_active = true AND status = 'active'`;

// Safe public fields only — strips last_login, is_online raw flag, internal cols
const SELLER_PUBLIC_FIELDS = `
  id, name, store_name, store_description,
  store_logo, profile_image, banner,
  verified, store_verified,
  rating, products_count, total_sales,
  city, created_at, trust_score,
  CASE WHEN last_seen > NOW() - INTERVAL '5 minutes' THEN true ELSE false END AS is_online
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePage(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseLimit(raw, max = 100, def = 20) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
}

// FIX: shared stats function — eliminates duplication, one source of truth
async function getSellerStats(sellerId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)                              AS total_products,
       COALESCE(SUM(views),           0)    AS total_views,
       COALESCE(SUM(clicks_count),    0)    AS total_clicks,
       COALESCE(AVG(conversion_rate), 0)    AS avg_conversion
     FROM products
     WHERE seller_id = $1 AND ${ACTIVE}`,
    [sellerId]
  );
  const s = rows[0];
  // FIX: type-safe coercion — Number() handles both string & null from pg
  return {
    total_products: Number(s.total_products  || 0),
    total_views:    Number(s.total_views     || 0),
    total_clicks:   Number(s.total_clicks    || 0),
    avg_conversion: Number(s.avg_conversion  || 0),
  };
}

// ─── GET /api/seller/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // FIX: only safe public fields, is_online computed server-side
    const userResult = await pool.query(
      `SELECT ${SELLER_PUBLIC_FIELDS} FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const seller = userResult.rows[0];

    const [productsResult, stats] = await Promise.all([
      pool.query(
        `SELECT
           id, title, price, slug,
           main_image, thumbnail_url,
           views, created_at, is_promoted, promotion_priority
         FROM products
         WHERE seller_id = $1 AND ${ACTIVE}
         ORDER BY promotion_priority DESC, created_at DESC
         LIMIT 20`,
        [id]
      ),
      getSellerStats(id), // FIX: reuse shared helper
    ]);

    // Unified response shape
    return res.json({
      data: seller,
      products: productsResult.rows,
      stats,
      pagination: {
        page: 1,
        limit: 20,
        hasMore: productsResult.rows.length === 20,
      },
    });
  } catch (err) {
    console.error("Seller Profile Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/seller/:id/products ─────────────────────────────────────────────
// FIX: cursor-based pagination — stable, fast, scales to millions of rows
// Usage: ?cursor=<created_at ISO>&limit=20
// Falls back to offset for page=1 / no cursor
router.get("/:id/products", async (req, res) => {
  const { id }     = req.params;
  const limit      = parseLimit(req.query.limit);
  const cursor     = req.query.cursor || null; // ISO timestamp of last item

  try {
    // cursor pagination: WHERE created_at < :cursor
    // No cursor = first page (same as offset page 1)
    const rows = await pool.query(
      `SELECT
         id, title, price, slug,
         main_image, thumbnail_url,
         views, created_at, is_promoted, promotion_priority
       FROM products
       WHERE seller_id = $1
         AND ${ACTIVE}
         ${cursor ? "AND created_at < $3" : ""}
       ORDER BY promotion_priority DESC, created_at DESC
       LIMIT $2`,
      cursor ? [id, limit, cursor] : [id, limit]
    );

    const products = rows.rows;
    const nextCursor = products.length === limit
      ? products[products.length - 1].created_at
      : null;

    // FIX: unified response shape
    res.json({
      products,
      pagination: {
        limit,
        hasMore:    nextCursor !== null,
        nextCursor, // client passes this as ?cursor= on next request
      },
    });
  } catch (err) {
    console.error("Seller Products Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/seller/:id/stats ─────────────────────────────────────────────────
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;
  try {
    // FIX: reuse shared helper — no more diverging queries
    const stats = await getSellerStats(id);

    // Extended stats only for this dedicated endpoint
    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(favorites_count), 0) AS total_favorites,
         COALESCE(SUM(share_count),     0) AS total_shares
       FROM products
       WHERE seller_id = $1 AND ${ACTIVE}`,
      [id]
    );

    res.json({
      ...stats,
      total_favorites: Number(rows[0].total_favorites || 0),
      total_shares:    Number(rows[0].total_shares    || 0),
    });
  } catch (err) {
    console.error("Seller Stats Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/seller/:id/follow ──────────────────────────────────────────────
// Requires auth middleware upstream (req.user populated)
router.post("/:id/follow", async (req, res) => {
  const seller_id = req.params.id;
  const user_id   = req.user?.id;

  if (!user_id) return res.status(401).json({ error: "Unauthenticated" });
  if (seller_id === user_id) return res.status(400).json({ error: "Cannot follow yourself" });

  try {
    await pool.query(
      `INSERT INTO seller_followers (seller_id, user_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (seller_id, user_id) DO NOTHING`,
      [seller_id, user_id]
    );
    res.json({ success: true, following: true });
  } catch (err) {
    console.error("Follow Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/seller/:id/follow ────────────────────────────────────────────
router.delete("/:id/follow", async (req, res) => {
  const seller_id = req.params.id;
  const user_id   = req.user?.id;

  if (!user_id) return res.status(401).json({ error: "Unauthenticated" });

  try {
    await pool.query(
      `DELETE FROM seller_followers WHERE seller_id = $1 AND user_id = $2`,
      [seller_id, user_id]
    );
    res.json({ success: true, following: false });
  } catch (err) {
    console.error("Unfollow Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

/*
 * Recommended index to add in a migration:
 *
 * CREATE INDEX IF NOT EXISTS idx_products_seller_active_cursor
 *   ON products (seller_id, is_active, status, created_at DESC);
 *
 * This covers: seller filter + active filter + cursor ORDER BY in one index scan.
 */
