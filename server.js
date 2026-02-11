import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

// CockroachDB connection
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// Cloudinary setup
cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Test DB
(async () => {
  try {
    await pool.connect();
    console.log("✅ CockroachDB ready");
  } catch (err) {
    console.error("❌ CockroachDB error:", err);
  }
})();

// GET MiniMart products
app.get("/api/minimart/products", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, price, image_url, category, created_at
       FROM minimart_products
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// POST MiniMart product
app.post("/api/minimart/products", async (req, res) => {
  try {
    const { title, description, price, category, imageBase64 } = req.body;
    if (!title || !price) return res.status(400).json({ message: "Title and price are required" });

    let image_url = null;
    if (imageBase64) {
      const upload = await cloudinary.uploader.upload(imageBase64, { folder: "minimart" });
      image_url = upload.secure_url;
    }

    const query = `
      INSERT INTO minimart_products (title, description, price, category, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [title, description || null, price, category || null, image_url]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

// Serve frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));