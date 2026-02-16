// src/server.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";

// Load environment variables
dotenv.config();

// ================= Express =================
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= MongoDB =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

import MarketplaceProduct from "./models/MarketplaceProduct.js";

// ================= CockroachDB =================
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

// ================= Cloudinary =================
// Optional: keep for future use if needed
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= API ROUTES =================

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

// GET single product by ID
app.get("/api/marketplace/:id", async (req, res) => {
  try {
    const product = await MarketplaceProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error("GET /api/marketplace/:id error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// POST new product (JSON only, frontend uploads image to Cloudinary)
app.post("/api/marketplace", async (req, res) => {
  try {
    const { title, description, price, image, country, state, city } = req.body;
    if (!title || !price) {
      return res.status(400).json({ message: "Title and price are required" });
    }

    const product = await MarketplaceProduct.create({
      title: title.trim(),
      description: description?.trim() || "",
      price: parseFloat(price),
      image: image || null, // Cloudinary URL from frontend
      country: country || "Nigeria",
      state: state || "",
      city: city || "",
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("POST /api/marketplace error:", err);
    res.status(500).json({ message: "Failed to add Marketplace product" });
  }
});

// DELETE a Marketplace product (optional: admin only)
app.delete("/api/marketplace/:id", async (req, res) => {
  try {
    const product = await MarketplaceProduct.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("DELETE /api/marketplace/:id error:", err);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

// --- MiniMart ---
// GET all MiniMart products
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

app.use(express.static(frontendPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ================= Start Server =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});