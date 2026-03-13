// routes/marketplace.js
import express from "express";
import { pool } from "../server.js";

const router = express.Router();

// GET all products
router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, description, price, stock, created_at FROM products ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// POST a new product (no image)
router.post("/products", async (req, res) => {
  try {
    const { title, description, price, stock } = req.body;

    if (!title || !price) {
      return res.status(400).json({ message: "Title and price are required" });
    }

    const numericPrice = parseFloat(price);
    const numericStock = parseInt(stock, 10) || 0;

    const query = `
      INSERT INTO products (title, description, price, stock)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const { rows } = await pool.query(query, [
      title,
      description || null,
      numericPrice,
      numericStock,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

export default router;