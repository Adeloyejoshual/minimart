// routes/marketplace.js
import express from "express";
import { pool } from "../server.js";
import { upload } from "../middleware/s3Upload.js"; // multer-s3

const router = express.Router();

// -------------------
// GET all products with images
// -------------------
router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.title, p.description, p.price, p.stock, 
             pi.image_url
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id
      ORDER BY p.created_at DESC, pi.position ASC;
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// -------------------
// POST new product with multiple images
// -------------------
router.post(
  "/products",
  upload.array("images", 5), // max 5 images per product
  async (req, res) => {
    try {
      const { title, description, price, stock } = req.body;

      if (!title || !price) {
        return res
          .status(400)
          .json({ message: "Title and price are required" });
      }

      const numericPrice = parseFloat(price);
      const numericStock = parseInt(stock, 10) || 0;

      // 1️⃣ Insert product first
      const productQuery = `
        INSERT INTO products (title, description, price, stock)
        VALUES ($1, $2, $3, $4)
        RETURNING id, title, description, price, stock;
      `;
      const { rows } = await pool.query(productQuery, [
        title,
        description || null,
        numericPrice,
        numericStock,
      ]);

      const product = rows[0];

      // 2️⃣ Insert each uploaded image into product_images table
      if (req.files && req.files.length > 0) {
        const insertImagePromises = req.files.map((file, index) => {
          return pool.query(
            `
            INSERT INTO product_images (product_id, image_url, position)
            VALUES ($1, $2, $3)
            RETURNING id, image_url;
          `,
            [product.id, file.location, index]
          );
        });

        const images = await Promise.all(insertImagePromises);
        product.images = images.map((img) => img.rows[0]);
      } else {
        product.images = [];
      }

      res.status(201).json({ success: true, product });
    } catch (err) {
      console.error("POST /products error:", err);
      res.status(500).json({ message: "Failed to add product" });
    }
  }
);

export default router;