import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Pool } from "pg";
import mongoose from "mongoose";
import Product from "./models/Product.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

/* ================= Middleware ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= CockroachDB MiniMart ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    await pool.connect();
    console.log("✅ CockroachDB connected");
  } catch (err) {
    console.error("❌ CockroachDB connection error:", err);
    process.exit(1);
  }
})();

/* ================= MongoDB Marketplace ================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

/* ================= API ROUTES ================= */

// --- MiniMart ---
app.get("/api/minimart/products", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM miniMartProduct ORDER BY createdAt DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch MiniMart products" });
  }
});

app.post("/api/minimart/products", async (req, res) => {
  try {
    const { title, description, price } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO miniMartProduct (title, description, price) VALUES ($1, $2, $3) RETURNING *",
      [title, description || null, parseFloat(price)]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to add MiniMart product" });
  }
});

// --- Marketplace ---
app.get("/api/marketplace/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch Marketplace products" });
  }
});

app.post("/api/marketplace/products", async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Failed to add Marketplace product" });
  }
});

/* ================= Serve frontend ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

/* ================= Start server ================= */
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));