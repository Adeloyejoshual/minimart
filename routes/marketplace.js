import express from "express";
import { parser } from "../middleware/cloudinary.js";
import { pool } from "../server.js";

const router = express.Router();

// Upload product with image
router.post("/products", parser.single("image"), async (req, res) => {
  try {
    const { title, description, price, stock } = req.body;
    const image = req.file?.path || null; // Cloudinary URL

    const query = `
      INSERT INTO products (title, description, price, stock, image)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      title,
      description || null,
      price,
      stock || 0,
      image,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Failed to add product:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

export default router;