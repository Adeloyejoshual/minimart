// routes/marketplace.js
import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer setup to store file in memory
const upload = multer({ storage: multer.memoryStorage() });

// -------------------
// GET products (with optional search & pagination, increment views)
// -------------------
router.get("/products", async (req, res) => {
  try {
    const { skip = 0, limit = 20, search } = req.query;

    const params = [];
    let whereClause = "";
    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE title ILIKE $${params.length}`;
    }

    params.push(skip);
    params.push(limit);

    // Fetch products
    const query = `
      SELECT id, title, description, price, stock, image
      FROM products
      ${whereClause}
      ORDER BY created_at DESC
      OFFSET $${params.length - 1}
      LIMIT $${params.length}
    `;
    const { rows } = await pool.query(query, params);

    // Increment views for fetched products
    for (const product of rows) {
      await pool.query(
        "UPDATE products SET views = COALESCE(views,0)+1 WHERE id = $1",
        [product.id]
      );
    }

    res.json(rows);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// -------------------
// POST a new product
// -------------------
router.post("/products", upload.single("image"), async (req, res) => {
  try {
    const { title, description, price, stock } = req.body;
    if (!title || !price) {
      return res.status(400).json({ message: "Title and price are required" });
    }

    let imageUrl = null;
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "minimart_products" },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(req.file.buffer);
      });
      imageUrl = result.secure_url;
    }

    const query = `
      INSERT INTO products (title, description, price, stock, image, views)
      VALUES ($1, $2, $3, $4, $5, 0)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      title,
      description || null,
      parseFloat(price),
      parseInt(stock) || 0,
      imageUrl,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

// -------------------
// PUT / UPDATE a product
// -------------------
router.put("/products/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, stock } = req.body;

    const { rows: existing } = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
    if (!existing.length) return res.status(404).json({ message: "Product not found" });

    let imageUrl = existing[0].image;

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "minimart_products" },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(req.file.buffer);
      });
      imageUrl = result.secure_url;
    }

    const query = `
      UPDATE products
      SET title = $1,
          description = $2,
          price = $3,
          stock = $4,
          image = $5,
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      title || existing[0].title,
      description || existing[0].description,
      price ? parseFloat(price) : existing[0].price,
      stock ? parseInt(stock) : existing[0].stock,
      imageUrl,
      id,
    ]);

    res.json(rows[0]);
  } catch (err) {
    console.error("PUT /products/:id error:", err);
    res.status(500).json({ message: "Failed to update product" });
  }
});

// -------------------
// DELETE a product
// -------------------
router.delete("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query("DELETE FROM products WHERE id = $1 RETURNING *", [id]);

    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted successfully", product: rows[0] });
  } catch (err) {
    console.error("DELETE /products/:id error:", err);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

// -------------------
// GET trending products (top 6 by views)
// -------------------
router.get("/trending", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const { rows } = await pool.query(
      `SELECT id, title, description, price, stock, image
       FROM products
       ORDER BY COALESCE(views, 0) DESC, created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json(rows);
  } catch (err) {
    console.error("GET /trending error:", err);
    res.status(500).json({ message: "Failed to fetch trending products" });
  }
});

export default router;