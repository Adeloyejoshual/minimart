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
GET PRODUCT DETAIL
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

    /* ================= RELATED PRODUCTS ================= */
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
      WHERE p.category_id = $1
        AND p.id != $2
        AND p.is_active = true
      GROUP BY p.id
      ORDER BY p.views DESC NULLS LAST
      LIMIT 8
      `,
      [product.category_id, id]
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
      [product.user_id, id]
    );

    const sellerProducts = sellerProductsRes.rows.map(normalizeProduct);

    /* ================= RESPONSE ================= */
    res.json({
      product,
      related,
      sellerProducts,
    });
  } catch (err) {
    console.error("PRODUCT DETAIL ERROR:", err);
    res.status(500).json({ message: "Failed to load product" });
  }
});

export default router;