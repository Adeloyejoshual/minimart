import express from "express";
import { Pool } from "pg";

const router = express.Router();

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= HELPERS ================= */
const normalizeProduct = (p) => ({
  ...p,
  images:
    p.images ||
    p.media?.images ||
    [],
  media: p.media || { images: [], videos: [] },
  attributes: p.attributes || {},
});

/* ================= GET PRODUCT BY ID ================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT p.*,
      COALESCE(
        json_agg(pi.image_url ORDER BY pi.position_order)
        FILTER (WHERE pi.image_url IS NOT NULL),
        '[]'
      ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id
      `,
      [id]
    );

    const product = rows[0];

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 🚨 BLOCK UNPAID PRODUCTS
    if (product.status !== "active" || product.is_active !== true) {
      return res.status(403).json({
        message: "This product is not available",
      });
    }

    // increase views
    await pool.query(
      "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",
      [id]
    );

    res.json(normalizeProduct(product));
  } catch (err) {
    console.error("Product fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ================= GET PRODUCT BY SLUG ================= */
router.get("/product/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const cleanSlug = slug.replace(/\.html$/, "");

    const { rows } = await pool.query(
      `
      SELECT p.*,
      COALESCE(
        json_agg(pi.image_url ORDER BY pi.position_order)
        FILTER (WHERE pi.image_url IS NOT NULL),
        '[]'
      ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.slug = $1
      GROUP BY p.id
      `,
      [cleanSlug]
    );

    const product = rows[0];

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 🚨 BLOCK UNPAID PRODUCTS
    if (product.status !== "active" || product.is_active !== true) {
      return res.status(403).json({
        message: "This product is not available",
      });
    }

    await pool.query(
      "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",
      [product.id]
    );

    res.json(normalizeProduct(product));
  } catch (err) {
    console.error("Slug fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;