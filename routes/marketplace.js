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
import { promotionPlans } from "../src/config/promotions.js";

dotenv.config();

const router = express.Router();
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
   GET PRODUCTS WITH TRENDING & RECOMMENDATIONS
========================================================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;
    skip = parseInt(skip);
    limit = Math.min(parseInt(limit), 50);

    // 1️⃣ Trending (top 6 by views)
    const { rows: trendingRows } = await pool.query(`
      SELECT p.*, COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY p.views DESC
      LIMIT 6
    `);

    // 2️⃣ Recommendations / main products (recently added)
    const { rows: mainRows } = await pool.query(`
      SELECT p.*, COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY p.created_at DESC
      OFFSET $1
      LIMIT $2
    `, [skip, limit]);

    // Normalize data
    const normalize = (p) => ({
      ...p,
      images: Array.isArray(p.images) ? p.images : [],
      dynamic_fields: p.dynamic_fields ? JSON.parse(p.dynamic_fields) : {},
      location: { state: p.location_state, city: p.location_city },
    });

    const trendingProducts = trendingRows.map(normalize);
    const mainProducts = mainRows.map(normalize);

    // Combine products, trending first, avoid duplicates
    const trendingIds = trendingProducts.map(p => p.id);
    const products = [
      ...trendingProducts,
      ...mainProducts.filter(p => !trendingIds.includes(p.id))
    ];

    res.json({ products, trending: trendingProducts });
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/* =========================================================
   GET SINGLE PRODUCT
========================================================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`
      SELECT p.*, COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);

    if (!rows.length) return res.status(404).json({ message: "Product not found" });

    const product = rows[0];
    product.dynamic_fields = product.dynamic_fields ? JSON.parse(product.dynamic_fields) : {};
    product.location = { state: product.location_state, city: product.location_city };

    // Increment views
    await pool.query("UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1", [id]);

    res.json(product);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
   POST PRODUCT
========================================================= */
router.post("/products", upload.array("images"), async (req, res) => {
  try {
    const { title, description, price, category_id, subcategory_id, dynamicFields, promotion_id } = req.body;

    if (!title || !price || !category_id)
      return res.status(400).json({ message: "Title, price, and category are required" });

    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) return res.status(400).json({ message: "Invalid price" });

    const { rows: categoryRows } = await pool.query(
      "SELECT id, name, fields_key FROM categories WHERE id = $1",
      [category_id]
    );
    if (!categoryRows.length) return res.status(400).json({ message: "Invalid category_id" });
    const category = categoryRows[0];

    let parsedFields = {};
    try { parsedFields = typeof dynamicFields === "string" ? JSON.parse(dynamicFields) : dynamicFields || {}; } catch { return res.status(400).json({ message: "Invalid dynamicFields format" }); }

    const allowedKeys = categoryFields[category.fields_key] || [];
    const cleanedFields = Object.fromEntries(
      Object.entries(parsedFields).filter(([k]) => allowedKeys.includes(k))
    );

    // Upload images to Cloudinary
    const uploadedImages = req.files?.length
      ? await Promise.all(req.files.map(file =>
          new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "minimart_products" },
              (err, result) => err ? reject(err) : resolve(result.secure_url)
            );
            stream.end(file.buffer);
          })
        ))
      : [];

    // Insert product
    const { rows } = await pool.query(`
      INSERT INTO products
      (title, description, price, category_id, subcategory_id, dynamic_fields, promotion_id, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      title,
      description || null,
      priceNum,
      category_id,
      subcategory_id || null,
      Object.keys(cleanedFields).length ? JSON.stringify(cleanedFields) : null,
      promotion_id || null,
      new Date()
    ]);

    const product = rows[0];

    // Save images into product_images table
    if (uploadedImages.length) {
      await Promise.all(
        uploadedImages.map((url, index) =>
          pool.query(
            `INSERT INTO product_images (product_id, image_url, position) VALUES ($1,$2,$3)`,
            [product.id, url, index]
          )
        )
      );
    }

    product.category_name = category.name;
    if (promotion_id) product.promotion = promotionPlans.find(p => p.id == promotion_id) || null;

    res.status(201).json(product);
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

/* =========================================================
   GET CATEGORIES
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

    rows.forEach(cat => {
      const key = cat.fields_key || "";
      const dynamicOptions = {
        fields: categoryFields[key] || [],
        brands: brands[key] || [],
        models: models[key] || {},
        colors: colors[key] || [],
        conditions,
        usedDetails,
        ram: ramOptions,
        storage: storageOptions,
        sims,
        features: featuresByCategory[key] || [],
        years,
        location: Object.keys(locationsByState),
        ...(key === "Vehicles" ? { engine: engines, fuel_type: fuelTypes } : {})
      };
      categoryMap[cat.id] = { ...cat, dynamicOptions, subcategories: [] };
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
    console.error("GET /categories error:", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;