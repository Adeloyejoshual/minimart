import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pkg from "pg"; // CockroachDB

dotenv.config();
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

// --- CockroachDB connection ---
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false }, // Required for Render
});

// Test DB connection
(async () => {
  try {
    await pool.connect();
    console.log("✅ CockroachDB ready");
  } catch (err) {
    console.error("❌ CockroachDB connection error:", err);
    process.exit(1);
  }
})();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API Routes ---
// Get all MiniMart products
app.get("/api/minimart/products", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, price, category, type, brand, condition, location, created_at
       FROM products
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/minimart/products error:", err);
    res.status(500).json({ error: "Failed to fetch MiniMart products" });
  }
});

// Add new MiniMart product
app.post("/api/minimart/products", async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      type,
      brand,
      condition,
      location,
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: "Title and price are required" });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice)) {
      return res.status(400).json({ error: "Price must be a number" });
    }

    const { rows } = await pool.query(
      `INSERT INTO products
       (title, description, price, category, type, brand, condition, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, title, description, price, category, type, brand, condition, location, created_at`,
      [title.trim(), description?.trim() || null, numericPrice, category || null, type || null, brand || null, condition || null, location || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /api/minimart/products error:", err);
    res.status(500).json({ error: "Failed to add product" });
  }
});

// --- Serve frontend ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 MiniMart running on port ${PORT}`);
});