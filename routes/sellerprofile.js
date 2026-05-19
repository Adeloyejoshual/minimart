import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/*
 * Required migration — run before deploying follow endpoints:
 *
 * -- Drop old id-keyed table if it exists, or add constraint:
 * ALTER TABLE seller_followers
 *   ADD CONSTRAINT seller_followers_pkey
 *   UNIQUE (seller_id, user_id);
 *
 * -- Covering index for cursor pagination (created_at only):
 * CREATE INDEX IF NOT EXISTS idx_products_seller_cursor
 *   ON products (seller_id, is_active, status, created_at DESC);
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVE = `is_active = true AND status = 'active'`;

const SELLER_PUBLIC_FIELDS = `
  id, name, store_name, store_description,
  store_logo, profile_image, banner,
  verified, store_verified,
  rating, products_count,
  city, created_at, trust_score,
  CASE WHEN last_seen > NOW() - INTERVAL '5 minutes'
    THEN true ELSE false
  END AS is_online
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLimit(raw, max = 100, def = 20) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
}

// FIX: shared stats helper — also computes total_sales so it lives in one place
async function getSellerStats(sellerId) {
  const [agg, sales] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)                              AS total_products,
         COALESCE(SUM(views),           0)    AS total_views,
         COALESCE(SUM(clicks_count),    0)    AS total_clicks,
         COALESCE(AVG(conversion_rate), 0)    AS avg_conversion
       FROM products
       WHERE seller_id = $1 AND ${ACTIVE}`,
      [sellerId]
    ),
    // FIX: total_sales unified into stats (not split across seller + stats)
    pool.query(
      `SELECT COALESCE(SUM(sales_count), 0) AS total_sales
       FROM products
       WHERE seller_id = $1 AND ${ACTIVE}`,
      [sellerId]
    ),
  ]);

  const s = agg.rows[0];
  return {
    total_products: Number(s.total_products  || 0),
    total_views:    Number(s.total_views     || 0),
    total_clicks:   Number(s.total_clicks    || 0),
    avg_conversion: Number(s.avg_conversion  || 0),
    total_sales:    Number(sales.rows[0].total_sales || 0),
  };
}

// ─── GET /api/seller/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [userResult, statsResult, followersResult, productsResult] =
      await Promise.all([
        pool.query(
          `SELECT ${SELLER_PUBLIC_FIELDS} FROM users WHERE id = $1 LIMIT 1`,
          [id]
        ),
        getSellerStats(id),
        // FIX: followers_count included in seller profile response
        pool.query(
          `SELECT COUNT(*) AS followers_count
           FROM seller_followers WHERE seller_id = $1`,
          [id]
        ),
        pool.query(
          // FIX: cursor pagination uses created_at DESC only — no promotion_priority
          // mixed ordering which breaks cursor stability
          `SELECT
             id, title, price, slug,
             main_image, thumbnail_url,
             views, created_at, is_promoted, promotion_priority
           FROM products
           WHERE seller_id = $1 AND ${ACTIVE}
           ORDER BY created_at DESC
           LIMIT 20`,
          [id]
        ),
      ]);

    if (!userResult.rows.length) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const seller   = userResult.rows[0];
    const products = productsResult.rows;

    return res.json({
      data: {
        ...seller,
        // FIX: expose followers_count as trust signal
        followers_count: Number(followersResult.rows[0].followers_count || 0),
      },
      products,
      // FIX: all numeric metrics live in stats — seller object has no stale total_sales
      stats: statsResult,
      pagination: {
        limit:      20,
        hasMore:    products.length === 20,
        nextCursor: products.length > 0
          ? products[products.length - 1].created_at
          : null,
      },
    });
  } catch (err) {
    console.error("Seller Profile Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/seller/:id/products ─────────────────────────────────────────────
// FIX: supports ?sort=views|sales|clicks|created_at (default: created_at)
// cursor pagination — stable because sort column is single + indexed
router.get("/:id/products", async (req, res) => {
  const { id }     = req.params;
  const limit      = parseLimit(req.query.limit);
  const cursor     = req.query.cursor || null;

  // FIX: functional sort filters mapped to safe column names
  const SORT_MAP = {
    views:      "views",
    sales:      "sales_count",
    clicks:     "clicks_count",
    created_at: "created_at",
  };
  const sortCol = SORT_MAP[req.query.sort] || "created_at";

  try {
    const rows = await pool.query(
      `SELECT
         id, title, price, slug,
         main_image, thumbnail_url,
         views, created_at, is_promoted, promotion_priority
       FROM products
       WHERE seller_id = $1
         AND ${ACTIVE}
         ${cursor ? `AND ${sortCol} < $3` : ""}
       ORDER BY ${sortCol} DESC
       LIMIT $2`,
      cursor ? [id, limit, cursor] : [id, limit]
    );

    const products   = rows.rows;
    const nextCursor = products.length === limit
      ? products[products.length - 1][sortCol === "sales_count" ? "created_at" : sortCol]
      : null;

    res.json({
      products,
      pagination: { limit, hasMore: nextCursor !== null, nextCursor },
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
    const [stats, extra] = await Promise.all([
      getSellerStats(id),
      pool.query(
        `SELECT
           COALESCE(SUM(favorites_count), 0) AS total_favorites,
           COALESCE(SUM(share_count),     0) AS total_shares
         FROM products WHERE seller_id = $1 AND ${ACTIVE}`,
        [id]
      ),
    ]);

    res.json({
      ...stats,
      total_favorites: Number(extra.rows[0].total_favorites || 0),
      total_shares:    Number(extra.rows[0].total_shares    || 0),
    });
  } catch (err) {
    console.error("Seller Stats Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/seller/:id/follow-status ───────────────────────────────────────
// FIX: required so frontend can sync initial follow state on load
router.get("/:id/follow-status", async (req, res) => {
  const seller_id = req.params.id;
  const user_id   = req.user?.id;

  if (!user_id) return res.json({ following: false });

  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM seller_followers
       WHERE seller_id = $1 AND user_id = $2 LIMIT 1`,
      [seller_id, user_id]
    );
    res.json({ following: rows.length > 0 });
  } catch (err) {
    console.error("Follow Status Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/seller/:id/follow ──────────────────────────────────────────────
router.post("/:id/follow", async (req, res) => {
  const seller_id = req.params.id;
  const user_id   = req.user?.id;

  if (!user_id)               return res.status(401).json({ error: "Unauthenticated" });
  if (seller_id === user_id)  return res.status(400).json({ error: "Cannot follow yourself" });

  try {
    // FIX: ON CONFLICT requires UNIQUE (seller_id, user_id) — see migration at top
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
