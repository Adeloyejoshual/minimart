// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pkg from "pg";
import mongoose from "mongoose";
import Product from "./models/Product.js"; // Marketplace MongoDB model

dotenv.config();
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

/* ================= Middleware ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= MongoDB (Marketplace) ================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/* ================= CockroachDB (MiniMart) ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false }, // Required for Render + CockroachDB
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

/* ================= Helper Functions ================= */
async function addMiniMartProduct(data) {
  const { title, description, price, category } = data;

  if (!title || !price) {
    throw new Error("Title and price are required");
  }

  const numericPrice = parseFloat(price);
  if (isNaN(numericPrice)) throw new Error("Price must be a number");

  const query = `
    INSERT INTO minimart_products (title, description, price, category, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING id, title, description, price, category, created_at
  `;
  const { rows } = await pool.query(query, [
    title.trim(),
    description?.trim() || null,
    numericPrice,
    category?.trim() || null,
  ]);
  return rows[0];
}

/* ================= Marketplace Routes (MongoDB) ================= */
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

/* ================= MiniMart Routes (CockroachDB) ================= */
app.get("/api/minimart/products", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, description, price, category, created_at FROM minimart_products ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch MiniMart products" });
  }
});

app.post("/api/minimart/products", async (req, res) => {
  try {
    const product = await addMiniMartProduct(req.body);
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Failed to add MiniMart product", error: err.message });
  }
});

/* ================= Serve Frontend ================= */
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