import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET single product
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 🔥 MAIN PRODUCT QUERY
    const result = await pool.query(
      `
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
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = result.rows[0];

    // 🔥 FETCH IMAGES FROM product_images TABLE
    const imagesResult = await pool.query(
      `
      SELECT url
      FROM product_images
      WHERE product_id = $1
      ORDER BY id ASC
      `,
      [id]
    );

    // attach images array
    product.images = imagesResult.rows.map((row) => row.url);

    // ✅ Safe JSON parsing
    const safeParse = (data, fallback) => {
      if (!data) return fallback;
      if (typeof data === "object") return data;
      try {
        return JSON.parse(data);
      } catch {
        return fallback;
      }
    };

    product.media = safeParse(product.media, { images: [], videos: [] });
    product.attributes = safeParse(product.attributes, {});
    product.delivery = safeParse(product.delivery, {});
    product.contact = safeParse(product.contact, {});

    return res.json({
      success: true,
      product,
    });
  } catch (err) {
    console.error("Product fetch error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;