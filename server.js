// src/server.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// Load env
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

import MarketplaceProduct from "./models/MarketplaceProduct.js";

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

// ================= Cloudinary Config =================
cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= Multer Config =================
const storage = multer.memoryStorage();
const upload = multer({ storage });

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

app.post("/api/marketplace", upload.single("image"), async (req, res) => {
  try {
    let imageUrl = null;
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload_stream(
        { folder: "marketplace" },
        (error, result) => {
          if (error) throw error;
          imageUrl = result.secure_url;
        }
      );
      uploadResult.end(req.file.buffer);
    }

    const product = await MarketplaceProduct.create({
      ...req.body,
      image: imageUrl,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("POST /api/marketplace error:", err);
    res.status(500).json({ message: "Failed to add Marketplace product" });
  }
});

// --- MiniMart ---
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

app.post("/api/minimart", upload.single("image"), async (req, res) => {
  try {
    const { title, description, price } = req.body;

    if (!title || !price)
      return res.status(400).json({ error: "Title and price are required" });

    let imageUrl = null;
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "minimart" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      imageUrl = uploadResult.secure_url;
    }

    const numericPrice = parseFloat(price);
    const query = `
      INSERT INTO minimart_products (title, description, price, image_url)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, description, price, image_url, created_at
    `;
    const { rows } = await pool.query(query, [
      title.trim(),
      description?.trim() || null,
      numericPrice,
      imageUrl,
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
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));