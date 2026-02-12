import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

/* ================= Middleware ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= MongoDB (Marketplace) ================= */
import MarketplaceProduct from "./models/MarketplaceProduct.js"; // Mongoose model

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/* ================= CockroachDB (MiniMart) ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    await pool.connect();
    console.log("✅ CockroachDB ready");
  } catch (err) {
    console.error("❌ CockroachDB error:", err);
  }
})();

/* ================= API Routes ================= */

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
    res.status(201).json(product);
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
    res.status(500).json({ message: "Failed to fetch MiniMart products" });
  }
});

app.post("/api/minimart", async (req, res) => {
  try {
    const { title, description, price } = req.body;
    const numericPrice = parseFloat(price);

    if (!title || isNaN(numericPrice)) {
      return res.status(400).json({ message: "Title and valid price required" });
    }

    const query = `
      INSERT INTO minimart_products (title, description, price)
      VALUES ($1, $2, $3)
      RETURNING id, title, description, price, created_at
    `;
    const { rows } = await pool.query(query, [title, description || null, numericPrice]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("MiniMart add error:", err);
    res.status(500).json({ message: "Failed to add MiniMart product" });
  }
});

/* ================= Serve React Frontend ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

/* ================= Start Server ================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});