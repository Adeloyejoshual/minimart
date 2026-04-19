// routes/productDetail.js

import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// 1. DEBUG: test DB is reachable
router.get("/debug-db", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, title, slug, is_active FROM products LIMIT 5");
    return res.json({ available: true, products: rows });
  } catch (err) {
    return res.json({ available: false, error: err.message });
  }
});

// 2. DEBUG: test by raw id (not slug)
router.get("/debug-id/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `
      SELECT
        id, title, slug, price, views, clicks_count, is_active, status,
        location_state, location_city
      FROM products
      WHERE id::text = $1
      `,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "No product by id" });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Your slug route (debug)
router.get("/slug/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        id, title, slug, price, views, clicks_count, is_active, status,
        location_state, location_city
      FROM products
      WHERE slug = $1
        AND COALESCE(is_active, false) = true
      LIMIT 1
      `,
      [slug]
    );

    console.log("SLUG QUERY:", { slug, row_count: rows.length });

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("ERROR fetching by slug:", err);
    return res.status(500).json({ message: "DB error", error: err.message });
  }
});

export default router;