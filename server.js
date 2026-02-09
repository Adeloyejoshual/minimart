// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg"; // CockroachDB driver
import mongoose from "mongoose"; // MongoDB for Marketplace

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

/* ================= MongoDB (Marketplace) ================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/* ================= CockroachDB (MiniMart) ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false }, // Required for CockroachCloud
});

pool.query("SELECT 1")
  .then(() => console.log("✅ CockroachDB connected"))
  .catch(err => console.error("❌ CockroachDB connection error:", err));

/* ================= MongoDB Marketplace Routes ================= */
// Replace with your actual Mongoose model
import Product from "./models/Product.js";

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

/* ================= CockroachDB MiniMart Routes ================= */
app.get("/api/minimart/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, title, price, created_at FROM minimart_products ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch MiniMart products" });
  }
});

app.post("/api/minimart/products", async (req, res) => {
  try {
    const { title, price } = req.body;
    const result = await pool.query(
      "INSERT INTO minimart_products (title, price, created_at) VALUES ($1, $2, NOW()) RETURNING id, title, price, created_at",
      [title, price]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Failed to add MiniMart product" });
  }
});

/* ================= Serve Frontend ================= */
import path from "path";
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

/* ================= Start Server ================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});