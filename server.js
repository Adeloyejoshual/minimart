// src/server.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ================= Middleware =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= MongoDB (Marketplace) =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

import MarketplaceProduct from "./models/MarketplaceProduct.js"; // make sure this exists

// ================= CockroachDB (MiniMart) =================
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    await pool.connect();
    console.log("✅ CockroachDB ready");
  } catch (err) {
    console.error("❌ CockroachDB connection error:", err);
    process.exit(1);
  }
})();

// ================= API Routes =================

// --- Marketplace ---
// GET all products
app.get("/api/marketplace", async (req, res) => {
  try {
    const products = await MarketplaceProduct.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("GET /api/marketplace error:", err);
    res.status(500).json({ message: "Failed to fetch Marketplace products" });
  }
});

// POST new product with optional Cloudinary URL
app.post("/api/marketplace", async (req, res) => {
  try {
    const { title, price, image } = req.body;
    if (!title || !price)
      return res.status(400).json({ message: "Title and price are required" });

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice))
      return res.status(400).json({ message: "Price must be a valid number" });

    const product = await MarketplaceProduct.create({
      title: title.trim(),
      price: numericPrice,
      image: image || null,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("POST /api/marketplace error:", err);
    res.status(500).json({ message: "Failed to add Marketplace product" });
  }
});

// --- MiniMart ---
// GET all products
app.get("/api/minimart", async (req, res) => {
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
app.post("/api/minimart", async (req, res) => {
  try {
    const { title, description, price, image_url } = req.body;
    if (!title || !price)
      return res.status(400).json({ error: "Title and price are required" });

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice))
      return res.status(400).json({ error: "Price must be a valid number" });

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

// ================= Serve React Frontend =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "dist");

console.log("Serving frontend from:", frontendPath);
app.use(express.static(frontendPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ================= Start Server =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});