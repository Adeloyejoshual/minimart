import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

import {
  categoryFields,
  brands,
  models,
  colors,
  conditions,
  usedDetails,
  ramOptions,
  storageOptions,
  sims,
  featuresByCategory,
} from "../config"; // adjust path as needed

dotenv.config();

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

// ---------------- GET PRODUCTS ----------------
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

// ---------------- POST PRODUCT ----------------
router.post("/products", upload.array("images"), async (req, res) => {
  try {
    const { title, description, price, category_id, subcategory_id, dynamicFields } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Title, price, and category required" });
    }

    // Fetch category and fields_key
    const { rows: categoryRows } = await pool.query(
      "SELECT id, name, fields_key FROM categories WHERE id = $1",
      [category_id]
    );
    if (!categoryRows.length) {
      return res.status(400).json({ message: "Invalid category_id" });
    }
    const category = categoryRows[0];

    // Map fields from config using fields_key
    const key = category.fields_key; // e.g., "phones_tablets"
    const allowedKeys = categoryFields[key] || [];

    const parsedFields = typeof dynamicFields === "string" ? JSON.parse(dynamicFields) : dynamicFields || {};
    const cleanedFields = Object.fromEntries(
      Object.entries(parsedFields).filter(([k]) => allowedKeys.includes(k))
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

    // Insert into DB
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
    console.error(err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

// ---------------- GET CATEGORIES WITH CONFIG ----------------
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, parent_id, slug, icon, image_url, filters, is_active, visible_on_home, fields_key
      FROM categories
      ORDER BY sort_order ASC, name ASC
    `);

    // Build category map with subcategories
    const categoryMap = {};
    const structured = [];

    rows.forEach(cat => {
      const configKey = cat.fields_key;
      categoryMap[cat.id] = {
        ...cat,
        dynamicOptions: {
          fields: categoryFields[configKey] || [],
          brands: brands[configKey] || [],
          models: models[configKey] || {},
          colors: colors[configKey] || [],
          conditions,
          usedDetails,
          ram: ramOptions,
          storage: storageOptions,
          sims,
          features: featuresByCategory[configKey] || []
        },
        subcategories: []
      };
      if (!cat.parent_id) structured.push(categoryMap[cat.id]);
    });

    // Attach subcategories
    rows.forEach(cat => {
      if (cat.parent_id && categoryMap[cat.parent_id]) {
        categoryMap[cat.parent_id].subcategories.push(categoryMap[cat.id]);
      }
    });

    res.json(structured);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;