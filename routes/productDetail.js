import express from "express";
import { Pool } from "pg";

const router = express.Router();

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= NORMALIZER ================= */
const normalizeProduct = (p) => ({
  ...p,
  images: p.images || [],
  attributes: p.attributes || {},
  delivery: p.delivery || {},
  contact: p.contact || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
});

/* =========================================================
GET PRODUCT DETAIL (ULTRA VERSION)
GET /api/product/:id
========================================================= */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    /* ================= PRODUCT ================= */
    const productRes = await pool.query(
      `
      SELECT 
        p.*,
        c.name AS category_name,

        u.id AS seller_id,
        u.name AS seller_name,
        u.avatar AS seller_avatar,

        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images

      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN product_images pi ON p.id = pi.product_id

      WHERE p.id = $1 AND p.is_active = true
      GROUP BY p.id, c.name, u.id
      `,
      [id]
    );

    if (!productRes.rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = normalizeProduct(productRes.rows[0]);

    /* ================= INCREMENT VIEWS ================= */
    pool.query(
      `UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1`,
      [id]
    ).catch(() => {});

    /* ================= RATING SUMMARY ================= */
    const ratingRes = await pool.query(
      `
      SELECT 
        ROUND(AVG(rating),1) as avg,
        COUNT(*) as total
      FROM product_reviews
      WHERE product_id = $1
      `,
      [id]
    );

    const rating = {
      avg: Number(ratingRes.rows[0]?.avg || 0),
      total: Number(ratingRes.rows[0]?.total || 0),
    };

    /* ================= SELLER STATS ================= */
    const sellerStatsRes = await pool.query(
      `
      SELECT 
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT f.user_id) as followers
      FROM users u
      LEFT JOIN products p ON p.user_id = u.id
      LEFT JOIN seller_followers f ON f.seller_id = u.id
      WHERE u.id = $1
      `,
      [product.seller_id]
    );

    const sellerStats = {
      total_products: Number(
        sellerStatsRes.rows[0]?.total_products || 0
      ),
      followers: Number(
        sellerStatsRes.rows[0]?.followers || 0
      ),
    };

    /* ================= SMART RELATED ================= */
    const brand = product.attributes?.brand || null;
    const model = product.attributes?.model || null;

    const relatedRes = await pool.query(
      `
      SELECT 
        p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
        AND p.id != $1
        AND (
          p.category_id = $2
          OR LOWER(p.attributes->>'brand') = LOWER($3)
          OR LOWER(p.attributes->>'model') = LOWER($4)
        )
      GROUP BY p.id
      ORDER BY 
        p.views DESC NULLS LAST,
        p.created_at DESC
      LIMIT 8
      `,
      [id, product.category_id, brand, model]
    );

    const related = relatedRes.rows.map(normalizeProduct);

    /* ================= SAME SELLER ================= */
    const sellerProductsRes = await pool.query(
      `
      SELECT 
        p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.user_id = $1
        AND p.id != $2
        AND p.is_active = true
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 6
      `,
      [product.seller_id, id]
    );

    const sellerProducts = sellerProductsRes.rows.map(normalizeProduct);

    /* ================= RESPONSE ================= */
    res.json({
      product,

      rating, // ⭐ avg + total
      seller: {
        id: product.seller_id,
        name: product.seller_name,
        avatar: product.seller_avatar,
        ...sellerStats,
      },

      related,
      sellerProducts,
    });
  } catch (err) {
    console.error("PRODUCT DETAIL ERROR:", err);
    res.status(500).json({ message: "Failed to load product" });
  }
});

export default router;