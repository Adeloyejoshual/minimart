// routes/productDetail.js
import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// Helper function to normalize product data
const normalizeProduct = (p) => {
  const attributes = p.attributes || {};
  return {
    ...p,
    images: p.images || [],
    attributes,
    location: {
      state: p.location_state,
      city: p.location_city,
    },
    contact: p.contact || {},
    delivery: {
      available: p.delivery?.available ?? false,
      duration: {
        from: Number(p.delivery?.duration?.from ?? 0),
        to: Number(p.delivery?.duration?.to ?? 0),
      },
      fee: p.delivery?.fee ?? null,
      note: p.delivery?.note || "",
    },
  };
};

// GET /product/:id → by UUID
router.get("/product/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
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

    if (!result.rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = normalizeProduct(result.rows[0]);

    // Increment views
    await pool.query(
      "UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1",
      [id]
    );

    res.json({ product });
  } catch (err) {
    console.error("Failed to fetch product by ID:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// GET /product/:slug → by slug
router.get("/product/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const cleanSlug = slug.replace(/.html$/, "");

    const result = await pool.query(
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

    if (!result.rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = normalizeProduct(result.rows[0]);

    // Increment views
    await pool.query(
      "UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1",
      [product.id]
    );

    res.json({ product });
  } catch (err) {
    console.error("Failed to fetch product by slug:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

export default router;