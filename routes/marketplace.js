// routes/marketplace.js
import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

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
import { fieldOptions } from "../src/config/fieldOptions.js"; // ✅

dotenv.config();

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// ---------------- CLOUDINARY ----------------
cloudinary.config({
  cloud_name: process.env.COCKINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------------- MULTER ----------------
const upload = multer({ storage: multer.memoryStorage() });

/* =========================================================
   GET PRODUCTS
========================================================= */
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

/* =========================================================
   POST PRODUCT
========================================================= */
router.post("/products", upload.array("images"), async (req, res) => {
  try {
    const { title, description, price, category_id, subcategory_id, dynamicFields } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Title, price, and category required" });
    }

    // Fetch category
    const { rows: categoryRows } = await pool.query(
      "SELECT id, name, fields_key FROM categories WHERE id = $1",
      [category_id]
    );

    if (!categoryRows.length) {
      return res.status(400).json({ message: "Invalid category_id" });
    }
    const category = categoryRows[0];

    // Parse dynamic fields
    let parsedFields = {};
    try {
      parsedFields =
        typeof dynamicFields === "string" ? JSON.parse(dynamicFields) : dynamicFields || {};
    } catch (parseErr) {
      console.error("dynamicFields parse error:", parseErr);
      return res.status(400).json({ message: "Invalid dynamicFields format" });
    }

    // Clean dynamic fields
    const key = category.fields_key;
    const allowedKeys = categoryFields[key] || [];
    const cleanedFields = Object.fromEntries(
      Object.entries(parsedFields).filter(([k]) => allowedKeys.includes(k))
    );

    // Upload images to Cloudinary
    const uploadedImages =
      req.files?.length
        ? await Promise.all(
            req.files.map(
              (file) =>
                new Promise((resolve, reject) => {
                  const stream = cloudinary.uploader.upload_stream(
                    { folder: "minimart_products" },
                    (err, result) => {
                      err ? reject(err) : resolve(result.secure_url);
                    }
                  );
                  stream.end(file.buffer);
                })
            )
          )
        : [];

    // Insert product
    const query = `
      INSERT INTO products
      (title, description, price, category_id, image, attributes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      title,
      description || null,
      parseFloat(price),
      category_id,
      uploadedImages[0] || null,
      Object.keys(cleanedFields).length ? JSON.stringify(cleanedFields) : null,
    ]);

    const product = rows[0];
    product.category_name = category.name;

    res.status(201).json(product);
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

/* =========================================================
   GET CATEGORIES (WITH CONFIG)
========================================================= */
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, parent_id, slug, icon, image_url, filters, is_active, visible_on_home, fields_key
      FROM categories
      ORDER BY sort_order ASC, name ASC
    `);

    const categoryMap = {};
    const structured = [];

    rows.forEach((cat) => {
      const key = cat.fields_key || "";

      // Dynamic options for all categories
      const dynamicOptions = {
        fields: categoryFields[key] || [],
        brands: brands[key] || [],
        models: models[key] || {},
        colors: colors[key] || [],        // ✅ from src/config/colors.js
        conditions,
        usedDetails,
        ram: ramOptions,
        storage: storageOptions,
        sims,
        features: featuresByCategory[key] || [],
        years,

        // ◀◄ GLOBAL FIELDS FROM fieldOptions
        color: fieldOptions.color,
        screen_size: fieldOptions.screen_size,
        mileage: fieldOptions.mileage,
        transmission: fieldOptions.transmission,
        age_range: fieldOptions.age_range,
        bedrooms: fieldOptions.bedrooms,
        bathrooms: fieldOptions.bathrooms,
        furnished: fieldOptions.furnished,
        experience_level: fieldOptions.experience_level,
        skills: fieldOptions.skills,

        location: Object.keys(locationsByState), // state list
        ...(key === "Vehicles"
          ? { engine: engines, fuel_type: fuelTypes }
          : {}),
      };

      categoryMap[cat.id] = { ...cat, dynamicOptions, subcategories: [] };
      if (!cat.parent_id) {
        structured.push(categoryMap[cat.id]);
      }
    });

    // Attach subcategories
    rows.forEach((cat) => {
      if (cat.parent_id && categoryMap[cat.parent_id]) {
        categoryMap[cat.parent_id].subcategories.push(categoryMap[cat.id]);
      }
    });

    res.json(structured);
  } catch (err) {
    console.error("GET /categories error:", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;