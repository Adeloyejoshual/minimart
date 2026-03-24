// ---------------- ENV & MODULE IMPORTS ----------------
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// ---------------- CONFIG IMPORTS ----------------
import { brands } from "../src/config/brands.js";
import { colors } from "../src/config/colors.js";
import { categoryFields } from "../src/config/categoryFields.js";
import { conditions, usedDetails } from "../src/config/conditions.js";
import { featuresByCategory } from "../src/config/featuresByCategory.js";
import { models } from "../src/config/models.js";
import { ramOptions } from "../src/config/ramOptions.js";
import { sims } from "../src/config/sims.js";
import { storageOptions } from "../src/config/storageOptions.js";
import { years } from "../src/config/years.js";
import { engines } from "../src/config/engines.js";
import { fuelTypes } from "../src/config/fuelTypes.js";
import { locationsByState } from "../src/config/locationsByState.js";

// ---------------- INITIALIZATION ----------------
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage() });

// ---------------- LOGGING ----------------
const logError = (context, err) => {
  console.error(`[${new Date().toISOString()}] ERROR [${context}]:`, err);
};

// ---------------- ROUTES ----------------

// GET PRODUCTS
router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM products ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    logError("GET /products", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// POST PRODUCT
router.post("/products", upload.array("images"), async (req, res) => {
  try {
    const { title, description, price, category_id, subcategory_id, dynamicFields } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Title, price, and category required" });
    }

    // Validate category
    const { rows: categoryRows } = await pool.query(
      "SELECT name, fields FROM categories WHERE id = $1",
      [category_id]
    );

    if (!categoryRows.length) {
      return res.status(400).json({ message: "Invalid category_id" });
    }

    const category = categoryRows[0];

    // Parse dynamic fields safely
    const parsedFields =
      typeof dynamicFields === "string" ? JSON.parse(dynamicFields) : dynamicFields || {};
    const allowedKeys = JSON.parse(category.fields || "[]").map(f => f.name);
    const cleanedFields = Object.fromEntries(
      Object.entries(parsedFields).filter(([key]) => allowedKeys.includes(key))
    );

    // Upload images
    const uploadedImages = await Promise.all(
      (req.files || []).map(file =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "minimart_products" },
            (err, result) => (err ? reject(err) : resolve(result.secure_url))
          );
          stream.end(file.buffer);
        })
      )
    );

    // Insert product into DB
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
      Object.keys(cleanedFields).length ? cleanedFields : null,
    ]);

    const product = rows[0];
    product.category_name = category.name;

    res.status(201).json(product);
  } catch (err) {
    logError("POST /products", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

// GET CATEGORIES
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.parent_id, p.name AS parent_name, c.slug, c.icon, c.image_url, c.fields, c.filters, c.is_active, c.visible_on_home
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      ORDER BY c.sort_order ASC, c.name ASC
    `);

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
    logError("GET /categories", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

// ---------------- EXPORT ROUTER ----------------
export default router;