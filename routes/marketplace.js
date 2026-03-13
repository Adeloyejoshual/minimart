import express from "express";
import { pool } from "../server.js";
import { upload } from "../middleware/s3Upload.js"; // multer-s3 upload

const router = express.Router();

// Single + multiple file upload
const multiUpload = upload.array("images", 5); // max 5 images

router.post("/products", multiUpload, async (req, res) => {
  try {
    const { title, description, price, stock } = req.body;
    if (!title || !price) return res.status(400).json({ message: "Title and price required" });

    const numericPrice = parseFloat(price);
    const numericStock = parseInt(stock, 10) || 0;

    // Insert product first
    const productQuery = `
      INSERT INTO products (title, description, price, stock)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    const { rows } = await pool.query(productQuery, [title, description || null, numericPrice, numericStock]);
    const productId = rows[0].id;

    // Insert uploaded images
    if (req.files && req.files.length > 0) {
      const imagePromises = req.files.map((file, index) =>
        pool.query(
          `INSERT INTO product_images (product_id, image_url, position)
           VALUES ($1, $2, $3)`,
          [productId, file.location, index]
        )
      );
      await Promise.all(imagePromises);
    }

    res.status(201).json({ message: "Product and images added successfully", productId });
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

export default router;