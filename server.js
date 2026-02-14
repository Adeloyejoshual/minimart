// ================= IMPORTS =================
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Load environment variables
dotenv.config();

// ================= EXPRESS =================
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= MONGODB (Marketplace) =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

import MarketplaceProduct from "./models/MarketplaceProduct.js";

// ================= COCKROACHDB (MiniMart) =================
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

// ================= CLOUDINARY =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= MULTER =================
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

// =====================================================
// ================= MARKETPLACE ROUTES =================
// =====================================================

// GET all Marketplace products
app.get("/api/marketplace", async (req, res) => {
  try {
    const products = await MarketplaceProduct.find().sort({
      createdAt: -1,
    });
    res.json(products);
  } catch (err) {
    console.error("Marketplace GET error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// POST new Marketplace product
app.post(
  "/api/marketplace",
  upload.single("image"),
  async (req, res) => {
    try {
      const {
        title,
        description,
        category,
        subcategory,
        price,
        country,
        state,
        city,
      } = req.body;

      // Validation
      if (!title || !price || !category || !state || !city) {
        return res.status(400).json({
          message:
            "Title, price, category, state and city are required",
        });
      }

      let imageUrl = null;

      // Upload image to Cloudinary
      if (req.file) {
        const result = await cloudinary.uploader.upload(
          req.file.path,
          {
            folder: "marketplace",
          }
        );

        imageUrl = result.secure_url;

        fs.unlinkSync(req.file.path); // delete temp file
      }

      const product = await MarketplaceProduct.create({
        title: title.trim(),
        description: description?.trim() || "",
        category: category.trim(),
        subcategory: subcategory?.trim() || "",
        price: parseFloat(price),
        country: country || "Nigeria",
        state: state.trim(),
        city: city.trim(),
        image: imageUrl,
      });

      res.status(201).json(product);
    } catch (err) {
      console.error("Marketplace POST error:", err);
      res.status(500).json({
        message: "Failed to add Marketplace product",
        error: err.message,
      });
    }
  }
);

// =====================================================
// ================= MINIMART ROUTES ===================
// =====================================================

// GET all MiniMart products
app.get("/api/minimart", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, price, image_url, created_at
       FROM minimart_products
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("MiniMart GET error:", err);
    res.status(500).json({ message: "Failed to fetch MiniMart products" });
  }
});

// POST new MiniMart product
app.post("/api/minimart", async (req, res) => {
  try {
    const { title, description, price, image_url } = req.body;

    if (!title || !price) {
      return res
        .status(400)
        .json({ message: "Title and price are required" });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice)) {
      return res
        .status(400)
        .json({ message: "Price must be a valid number" });
    }

    const { rows } = await pool.query(
      `INSERT INTO minimart_products
       (title, description, price, image_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, description, price, image_url, created_at`,
      [
        title.trim(),
        description?.trim() || null,
        numericPrice,
        image_url || null,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("MiniMart POST error:", err);
    res.status(500).json({ message: "Failed to add MiniMart product" });
  }
});

// =====================================================
// ================= SERVE FRONTEND ====================
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "dist");

app.use(express.static(frontendPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// =====================================================
// ================= START SERVER ======================
// =====================================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});