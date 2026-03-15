import express from "express";
import { Pool } from "pg";
import dotenv from "dotenv";
import xss from "xss";

dotenv.config();
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ---------------- GET PRODUCTS ---------------- */
router.get("/products", async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search ? xss(req.query.search) : null;

    const params = [];
    let where = "WHERE is_active = true";

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    params.push(limit, skip);

    const query = `
      SELECT id, title, price, image, stock, created_at
      FROM products
      ${where}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/* ---------------- PRODUCT DETAIL ---------------- */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `
      SELECT p.id, p.title, p.description, p.price, p.stock, p.image,
             p.brand, p.model, p.color, p.weight, p.warranty, p.created_at,
             p.seller_id, u.name AS seller_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE p.id = $1
      `,
      [id]
    );

    if (!rows.length) return res.status(404).json({ message: "Product not found" });

    await pool.query(`UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1`, [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* ---------------- TRENDING ---------------- */
router.get("/trending", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const { rows } = await pool.query(
      `
      SELECT id, title, price, image, views
      FROM products
      WHERE is_active = true
      ORDER BY views DESC, created_at DESC
      LIMIT $1
      `,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch trending products" });
  }
});

export default router;