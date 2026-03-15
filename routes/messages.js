// routes/marketplace.js
import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// -------------------
// Configure Cloudinary
// -------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "minimart_products",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

const upload = multer({ storage });

// -------------------
// GET all products
// -------------------
router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM products ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// -------------------
// POST a product with image
// -------------------
router.post("/products", upload.single("image"), async (req, res) => {
  try {
    const { title, description, price, stock } = req.body;
    const imageUrl = req.file?.path || null;

    if (!title || !price) {
      return res.status(400).json({ message: "Title and price are required" });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice)) {
      return res.status(400).json({ message: "Price must be a valid number" });
    }

    const { rows } = await pool.query(
      `INSERT INTO products (title, description, price, stock, image)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title.trim(), description?.trim() || null, numericPrice, stock || 0, imageUrl]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

export default router;