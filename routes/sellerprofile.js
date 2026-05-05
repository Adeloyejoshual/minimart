import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/seller/:id
 * Public seller profile
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Get seller basic info
    const userQuery = `
      SELECT 
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
      FROM users
      WHERE id = $1
      LIMIT 1
    `;

    const userResult = await pool.query(userQuery, [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const seller = userResult.rows[0];

    // 2. Get seller products
    const productsQuery = `
      SELECT 
        id,
        title,
        price,
        slug,
        main_image,
        thumbnail_url,
        views,
        created_at,
        is_promoted,
        promotion_priority
      FROM products
      WHERE seller_id = $1
        AND is_active = true
        AND status = 'active'
      ORDER BY 
        promotion_priority DESC,
        created_at DESC
      LIMIT 50
    `;

    const productsResult = await pool.query(productsQuery, [id]);

    // 3. Get aggregated stats
    const statsQuery = `
      SELECT 
        COUNT(*) AS total_products,
        COALESCE(SUM(views), 0) AS total_views,
        COALESCE(SUM(clicks_count), 0) AS total_clicks,
        COALESCE(AVG(conversion_rate), 0) AS avg_conversion
      FROM products
      WHERE seller_id = $1
        AND is_active = true
    `;

    const statsResult = await pool.query(statsQuery, [id]);

    const stats = statsResult.rows[0];

    return res.json({
      seller,
      products: productsResult.rows,
      stats: {
        total_products: parseInt(stats.total_products, 10),
        total_views: parseInt(stats.total_views, 10),
        total_clicks: parseInt(stats.total_clicks, 10),
        avg_conversion: parseFloat(stats.avg_conversion),
      },
    });

  } catch (error) {
    console.error("Seller Profile Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


/**
 * GET /api/seller/:id/products (pagination support)
 */
router.get("/:id/products", async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const offset = (page - 1) * limit;

  try {
    const query = `
      SELECT 
        id,
        title,
        price,
        slug,
        main_image,
        thumbnail_url,
        views,
        created_at,
        is_promoted,
        promotion_priority
      FROM products
      WHERE seller_id = $1
        AND is_active = true
        AND status = 'active'
      ORDER BY 
        promotion_priority DESC,
        created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [id, limit, offset]);

    res.json({
      page: Number(page),
      limit: Number(limit),
      products: result.rows,
    });

  } catch (error) {
    console.error("Seller Products Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


/**
 * GET /api/seller/:id/stats (optional separate endpoint)
 */
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;

  try {
    const statsQuery = `
      SELECT 
        COUNT(*) AS total_products,
        COALESCE(SUM(views), 0) AS total_views,
        COALESCE(SUM(clicks_count), 0) AS total_clicks,
        COALESCE(SUM(favorites_count), 0) AS total_favorites,
        COALESCE(SUM(share_count), 0) AS total_shares
      FROM products
      WHERE seller_id = $1
    `;

    const result = await pool.query(statsQuery, [id]);

    res.json(result.rows[0]);

  } catch (error) {
    console.error("Seller Stats Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


export default router;