// routes/marketplace.js
import express from "express";
import { pool } from "../server.js";

const router = express.Router();

// GET all products
router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, title, description, price, image, created_at, stock, seller_id
      FROM public.products
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/marketplace/products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

export default router;