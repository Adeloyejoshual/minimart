// routes/marketplace.js
import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../server.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "secret";

// -----------------------------
// GET all products
// -----------------------------
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


// -----------------------------
// ADD product
// -----------------------------
router.post("/products", async (req, res) => {
  try {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const seller_id = decoded.id;

    const { title, description, price, image, stock } = req.body;

    const { rows } = await pool.query(
      `
      INSERT INTO public.products
      (title, description, price, image, stock, seller_id)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [title, description, price, image, stock, seller_id]
    );

    res.json(rows[0]);

  } catch (err) {
    console.error("POST /api/marketplace/products error:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

export default router;