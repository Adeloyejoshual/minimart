import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import pkg from "pg";

import MarketplaceProduct from "./models/MarketplaceProduct.js";

dotenv.config();
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

/* ================= MongoDB ================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log(err));

/* ================= CockroachDB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false }
});

console.log("✅ CockroachDB ready");

/* ================= MINI MART ROUTES ================= */

app.get("/api/minimart", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM minimart_products WHERE is_active = true ORDER BY created_at DESC"
  );
  res.json(rows);
});

app.post("/api/minimart", async (req, res) => {
  const { title, description, price, image, category, stock } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO minimart_products 
     (title, description, price, image, category, stock)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [title, description, price, image, category, stock]
  );

  res.json(rows[0]);
});

/* ================= MARKETPLACE ROUTES ================= */

app.get("/api/marketplace", async (req, res) => {
  const products = await MarketplaceProduct.find({ isApproved: true })
    .sort({ createdAt: -1 });
  res.json(products);
});

app.post("/api/marketplace", async (req, res) => {
  const product = await MarketplaceProduct.create(req.body);
  res.json(product);
});

/* ================= START SERVER ================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});