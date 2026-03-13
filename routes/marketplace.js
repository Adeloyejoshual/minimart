// routes/marketplace.js
import express from "express";
import { pool } from "../server.js";
import { upload } from "../middleware/s3Upload.js"; // multer-s3

const router = express.Router();

// -------------------
// GET all products with first image
// -------------------
router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.title, p.description, p.price, p.stock, pi.image_url, p.created_at
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.position = 0
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// -------------------
// POST a new product with multiple images
// -------------------
router.post("/products", upload.array("images", 5), async (req, res) => {
  try {
    const { title, description, price, stock } = req.body;

    if (!title || !price) {
      return res.status(400).json({ message: "Title and price are required" });
    }

    const numericPrice = parseFloat(price);
    const numericStock = parseInt(stock, 10) || 0;

    // Insert product first
    const productQuery = `
      INSERT INTO products (title, description, price, stock)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const { rows: productRows } = await pool.query(productQuery, [
      title,
      description || null,
      numericPrice,
      numericStock,
    ]);

    const product = productRows[0];

    // Insert images into product_images table
    if (req.files && req.files.length > 0) {
      const insertImagesQuery = `
        INSERT INTO product_images (product_id, image_url, position)
        VALUES ($1, $2, $3)
      `;
      await Promise.all(
        req.files.map((file, index) =>
          pool.query(insertImagesQuery, [product.id, file.location, index])
        )
      );
    }

    res.status(201).json({ ...product, message: "Product and images added successfully" });
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

export default router;