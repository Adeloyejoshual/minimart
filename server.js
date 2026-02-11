import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import pkg from "pg";
import Product from "./models/Product.js"; // MongoDB Marketplace model

dotenv.config();
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

// --- CockroachDB (MiniMart) ---
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false } // Required for Render + CockroachDB
});

// Test CockroachDB connection
(async () => {
  try {
    await pool.connect();
    console.log("✅ CockroachDB connected");
  } catch (err) {
    console.error("❌ CockroachDB connection error:", err);
  }
})();

// --- MongoDB (Marketplace) ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Marketplace APIs (MongoDB) ---
app.get("/api/marketplace/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch Marketplace products" });
  }
});

app.post("/api/marketplace/products", async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: "Failed to add Marketplace product" });
  }
});

// --- MiniMart APIs (CockroachDB) ---
app.get("/api/minimart/products", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, description, price, created_at FROM products ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch MiniMart products" });
  }
});

app.post("/api/minimart/products", async (req, res) => {
  try {
    const { name, description, price } = req.body;

    if (!name || !price) {
      return res.status(400).json({ message: "Name and price are required" });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice)) {
      return res.status(400).json({ message: "Price must be a valid number" });
    }

    const query = `
      INSERT INTO products (title, description, price)
      VALUES ($1, $2, $3)
      RETURNING id, title, description, price, created_at
    `;
    const { rows } = await pool.query(query, [name.trim(), description?.trim() || null, numericPrice]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Failed to add MiniMart product" });
  }
});

// --- Serve Frontend ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});