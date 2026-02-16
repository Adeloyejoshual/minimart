import express from "express";
import { Pool } from "pg";

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// GET all MiniMart products
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, description, price, image_url, created_at FROM minimart_products ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/minimart error:", err);
    res.status(500).json({ message: "Failed to fetch MiniMart products" });
  }
});

// POST new MiniMart product
router.post("/", async (req, res) => {
  try {
    const { title, description, price, image_url } = req.body;
    if (!title || !price) return res.status(400).json({ message: "Title and price are required" });

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice)) return res.status(400).json({ message: "Price must be a valid number" });

    const query = `
      INSERT INTO minimart_products (title, description, price, image_url)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, description, price, image_url, created_at
    `;
    const { rows } = await pool.query(query, [
      title.trim(),
      description?.trim() || null,
      numericPrice,
      image_url || null,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /api/minimart error:", err);
    res.status(500).json({ message: "Failed to add MiniMart product" });
  }
});

export default router;