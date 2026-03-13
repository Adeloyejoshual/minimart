// routes/marketplace.js
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { pool } from "../server.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "secret";

// -----------------------------
// S3 CONFIG
// -----------------------------
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// -----------------------------
// Multer S3 Upload
// -----------------------------
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: "public-read",
    key: (req, file, cb) => {
      cb(null, `products/${Date.now()}-${file.originalname}`);
    },
  }),
});

// -----------------------------
// GET all products
// -----------------------------
router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, title, description, price, image, created_at, stock, seller_id
      FROM public.products
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/marketplace/products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// -----------------------------
// ADD product (with image upload)
// -----------------------------
router.post("/products", upload.single("image"), async (req, res) => {
  try {
    // Check token
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const seller_id = decoded.id;

    const { title, description, price, stock } = req.body;

    // Basic validation
    if (!title || !price) {
      return res.status(400).json({ message: "Title and price are required" });
    }

    const image = req.file ? req.file.location : null;

    const { rows } = await pool.query(
      `
      INSERT INTO public.products
      (title, description, price, image, stock, seller_id)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [title.trim(), description?.trim() || null, parseFloat(price), image, parseInt(stock) || 0, seller_id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /api/marketplace/products error:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

export default router;