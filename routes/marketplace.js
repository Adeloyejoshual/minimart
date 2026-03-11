// routes/marketplace.js
import express from "express";
import { pool } from "../server.js";

const router = express.Router();

// ✅ Add a new product
router.post("/products", async (req, res) => {
  const { title, description, price, category, stock, image_url } = req.body;

  if (!title || !price) {
    return res.status(400).json({ success: false, message: "Title and price are required" });
  }

  try {
    const query = `
      INSERT INTO products (title, description, price, category, stock, image_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [title, description || "", price, category || "", stock || 0, image_url || null];
    const { rows } = await pool.query(query, values);

    res.json({ success: true, product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to add product" });
  }
});

// ✅ Get all products
router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM products ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

// ✅ Get a product by ID
router.get("/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Product not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch product" });
  }
});

// ✅ Get all products added by a specific user (requires auth)
router.get("/my-products/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { rows } = await pool.query("SELECT * FROM products WHERE user_id = $1 ORDER BY id DESC", [userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch user products" });
  }
});

export default router;