import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/products/:id
 * Fetch single product with seller + category info
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT 
        p.*,
        u.id AS seller_id,
        u.name AS seller_name,
        u.email AS seller_email,
        c.name AS category_name,
        sc.name AS subcategory_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories sc ON p.subcategory_id = sc.id
      WHERE p.id = $1
      LIMIT 1
    `;

    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = rows[0];

    // Parse JSON fields safely
    product.media =
      typeof product.media === "string"
        ? JSON.parse(product.media)
        : product.media;

    product.attributes =
      typeof product.attributes === "string"
        ? JSON.parse(product.attributes)
        : product.attributes;

    product.delivery =
      typeof product.delivery === "string"
        ? JSON.parse(product.delivery)
        : product.delivery;

    product.contact =
      typeof product.contact === "string"
        ? JSON.parse(product.contact)
        : product.contact;

    return res.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Product detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching product",
    });
  }
});

export default router;