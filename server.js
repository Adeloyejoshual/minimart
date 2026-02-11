import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

// CockroachDB
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    await pool.connect();
    console.log("✅ Connected to CockroachDB");
  } catch (err) {
    console.error("❌ DB connection error:", err);
    process.exit(1);
  }
})();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// GET all products
app.get("/api/products", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, description, price, image, created_at FROM products ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// POST new product
app.post("/api/products", async (req, res) => {
  try {
    const { name, description, price, image } = req.body;
    if (!name || !price) return res.status(400).json({ error: "Title and price required" });

    const numericPrice = parseFloat(price);
    const query =
      "INSERT INTO products (title, description, price, image) VALUES ($1, $2, $3, $4) RETURNING *";

    const { rows } = await pool.query(query, [name, description || null, numericPrice, image || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add product" });
  }
});

// Serve frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

app.listen(PORT, () => console.log(`🚀 MiniMart running on port ${PORT}`));