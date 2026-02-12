// src/server.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";

// Load env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ================= Middleware =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= MongoDB (Marketplace) =================
// Make sure you have your MONGO_URI in Render env vars
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Example Marketplace model
import MarketplaceProduct from "./models/MarketplaceProduct.js"; // make sure this exists

// ================= CockroachDB (MiniMart) =================
// Make sure COCKROACH_URI is set in Render env vars
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false }, // required for Render
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
app.get("/api/marketplace", async (req, res) => {
  try {
    const products = await MarketplaceProduct.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch Marketplace products" });
  }
});

app.post("/api/marketplace", async (req, res) => {
  try {
    const product = await MarketplaceProduct.create(req.body);
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: "Failed to add Marketplace product" });
  }
});

// --- MiniMart ---
app.get("/api/minimart", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, description, price, created_at FROM minimart_products ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/minimart error:", err);
    res.status(500).json({ message: "Failed to fetch MiniMart products" });
  }
});

app.post("/api/minimart", async (req, res) => {
  try {
    const { title, description, price } = req.body;

    if (!title || !price)
      return res.status(400).json({ error: "Title and price are required" });

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice))
      return res.status(400).json({ error: "Price must be a valid number" });

    const query = `
      INSERT INTO minimart_products (title, description, price)
      VALUES ($1, $2, $3)
      RETURNING id, title, description, price, created_at
    `;
    const { rows } = await pool.query(query, [
      title.trim(),
      description?.trim() || null,
      numericPrice,
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