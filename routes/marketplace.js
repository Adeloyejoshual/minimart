// routes/marketplace.js
import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// ---------------- DATABASE ----------------
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// ---------------- CLOUDINARY ----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------------- MULTER ----------------
const upload = multer({ storage: multer.memoryStorage() });

/* =========================================================
   GET PRODUCTS (WITH FILTERS)
========================================================= */
router.get("/products", async (req, res) => {
  try {
    const {
      category_id,
      subcategory_id,
      min_price,
      max_price,
      search,
      limit = 20,
      offset = 0,
      ...dynamicFilters // catch dynamic fields like color, transmission
    } = req.query;

    let query = `SELECT * FROM products WHERE 1=1`;
    const values = [];
    let i = 1;

    // -------- BASIC FILTERS --------
    if (category_id) {
      query += ` AND category_id = $${i++}`;
      values.push(category_id);
    }

    if (subcategory_id) {
      query += ` AND subcategory_id = $${i++}`;
      values.push(subcategory_id);
    }

    if (min_price) {
      query += ` AND price >= $${i++}`;
      values.push(min_price);
    }

    if (max_price) {
      query += ` AND price <= $${i++}`;
      values.push(max_price);
    }

    if (search) {
      query += ` AND (title ILIKE $${i} OR description ILIKE $${i})`;
      values.push(`%${search}%`);
      i++;
    }

    // -------- DYNAMIC FIELD FILTERS --------
    Object.entries(dynamicFilters).forEach(([key, value]) => {
      query += ` AND dynamic_fields->>$${i++} = $${i++}`;
      values.push(key, value);
    });

    // -------- SORT + PAGINATION --------
    query += ` ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`;
    values.push(parseInt(limit), parseInt(offset));

    const { rows } = await pool.query(query, values);

    // -------- CLEAN RESPONSE --------
    const products = rows.map(p => ({
      ...p,
      images: p.images ? JSON.parse(p.images) : [],
      dynamic_fields:
        typeof p.dynamic_fields === "string"
          ? JSON.parse(p.dynamic_fields)
          : p.dynamic_fields || {},
    }));

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/* =========================================================
   POST PRODUCT
========================================================= */
router.post("/products", upload.array("images"), async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category_id,
      subcategory_id,
      dynamicFields,
    } = req.body;

    // -------- VALIDATION --------
    if (!title || !price || !category_id) {
      return res
        .status(400)
        .json({ message: "Title, price, and category are required" });
    }

    // -------- CATEGORY CHECK --------
    const { rows: categoryRows } = await pool.query(
      "SELECT name, fields FROM categories WHERE id = $1",
      [category_id]
    );

    if (!categoryRows.length) {
      return res.status(400).json({ message: "Invalid category_id" });
    }

    const category = categoryRows[0];

    // -------- PARSE & CLEAN DYNAMIC FIELDS --------
    let parsedFields = {};
    try {
      parsedFields =
        typeof dynamicFields === "string"
          ? JSON.parse(dynamicFields)
          : dynamicFields || {};
    } catch {
      parsedFields = {};
    }

    const allowedKeys = JSON.parse(category.fields || "[]").map(f => f.name);

    const cleanedFields = Object.fromEntries(
      Object.entries(parsedFields).filter(([key]) =>
        allowedKeys.includes(key)
      )
    );

    // -------- IMAGE UPLOAD --------
    const uploadedImages = await Promise.all(
      (req.files || []).map(file =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "minimart_products" },
            (err, result) =>
              err ? reject(err) : resolve(result.secure_url)
          );
          stream.end(file.buffer);
        })
      )
    );

    // -------- INSERT --------
    const query = `
      INSERT INTO products
      (title, description, price, category_id, subcategory_id, images, dynamic_fields, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7, now())
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      title,
      description || null,
      parseFloat(price),
      category_id,
      subcategory_id || null,
      uploadedImages.length ? JSON.stringify(uploadedImages) : null,
      Object.keys(cleanedFields).length
        ? JSON.stringify(cleanedFields)
        : null,
    ]);

    const product = {
      ...rows[0],
      images: uploadedImages,
      dynamic_fields: cleanedFields,
      category_name: category.name,
    };

    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

/* =========================================================
   GET CATEGORIES (STRUCTURED)
========================================================= */
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        c.id, c.name, c.parent_id, 
        p.name AS parent_name,
        c.slug, c.icon, c.image_url, 
        c.fields, c.filters, 
        c.is_active, c.visible_on_home
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      WHERE c.is_active = true
      ORDER BY c.sort_order ASC, c.name ASC
    `);

    const map = {};
    const structured = [];

    // parents
    rows.forEach(cat => {
      if (!cat.parent_id) {
        map[cat.id] = {
          ...cat,
          fields: cat.fields ? JSON.parse(cat.fields) : [],
          filters: cat.filters ? JSON.parse(cat.filters) : [],
          subcategories: [],
        };
        structured.push(map[cat.id]);
      }
    });

    // children
    rows.forEach(cat => {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].subcategories.push({
          ...cat,
          fields: cat.fields ? JSON.parse(cat.fields) : [],
          filters: cat.filters ? JSON.parse(cat.filters) : [],
        });
      }
    });

    res.json(structured);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;