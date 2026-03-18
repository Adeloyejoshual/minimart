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

// Multer setup to store files in memory
const upload = multer({ storage: multer.memoryStorage() });

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
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// -------------------
// POST a new product (improved with category validation)
// -------------------
router.post("/products", upload.array("images"), async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      stock,
      category_id,
      subcategory_id,
      dynamicFields,
      isPromoted,
    } = req.body;

    // 1️⃣ Validate required fields
    if (!title || !price || !category_id) {
      return res
        .status(400)
        .json({ message: "Title, price, and category are required" });
    }

    // 2️⃣ Check if category_id exists
    const { rows: categoryRows } = await pool.query(
      "SELECT name FROM categories WHERE id = $1",
      [category_id]
    );
    if (categoryRows.length === 0) {
      return res.status(400).json({ message: "Invalid category_id" });
    }
    const category_name = categoryRows[0].name;

    // 3️⃣ Parse dynamicFields if sent as string
    const parsedFields =
      typeof dynamicFields === "string"
        ? JSON.parse(dynamicFields)
        : dynamicFields || {};

    // 4️⃣ Upload multiple images to Cloudinary
    const uploadedImages = [];
    if (req.files && req.files.length) {
      for (const file of req.files) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "minimart_products" },
            (err, result) => (err ? reject(err) : resolve(result))
          );
          stream.end(file.buffer);
        });
        uploadedImages.push(result.secure_url);
      }
    }

    // 5️⃣ Insert product into DB
    const query = `
      INSERT INTO products (
        title, description, price, stock, category_id, subcategory_id,
        images, dynamic_fields, is_promoted, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      title,
      description || null,
      parseFloat(price),
      parseInt(stock) || 0,
      category_id,
      subcategory_id || null,
      uploadedImages.length ? JSON.stringify(uploadedImages) : null,
      Object.keys(parsedFields).length ? parsedFields : null,
      isPromoted === "true" || isPromoted === true,
    ]);

    // 6️⃣ Attach category name to response
    const product = rows[0];
    product.category_name = category_name;

    res.status(201).json(product);
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

// -------------------
// GET all categories (nested structure)
// -------------------
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.parent_id,
        p.name AS parent_name,
        c.slug,
        c.icon,
        c.image_url,
        c.fields,
        c.filters,
        c.is_active,
        c.visible_on_home
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      ORDER BY c.sort_order ASC, c.name ASC
    `);

    // Nest subcategories under their parent
    const categoryMap = {};
    const structured = [];

    rows.forEach(cat => {
      if (!cat.parent_id) {
        categoryMap[cat.id] = { ...cat, subcategories: [] };
        structured.push(categoryMap[cat.id]);
      }
    });

    rows.forEach(cat => {
      if (cat.parent_id && categoryMap[cat.parent_id]) {
        categoryMap[cat.parent_id].subcategories.push(cat);
      }
    });

    res.json(structured);
  } catch (err) {
    console.error("GET /categories error:", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;