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
      SELECT * FROM products
      WHERE is_active = true
      ORDER BY views DESC
      LIMIT 6
    `);

    // 2️⃣ Recommendations / main products (recently added)
    const { rows: mainRows } = await pool.query(`
      SELECT * FROM products
      WHERE is_active = true
      ORDER BY created_at DESC
      OFFSET $1
      LIMIT $2
    `, [skip, limit]);

    // 3️⃣ Normalize product data
    const normalize = (p) => {
      let dynamic = {}, images = [];
      try { dynamic = p.dynamic_fields ? JSON.parse(p.dynamic_fields) : {}; } catch {}
      try { images = p.images ? JSON.parse(p.images) : []; } catch {}
      return {
        ...p,
        dynamic_fields: dynamic,
        images,
        location: { state: p.location_state, city: p.location_city },
      };
    };

    const trendingProducts = trendingRows.map(normalize);
    const mainProducts = mainRows.map(normalize);

    // 4️⃣ Combine products, trending first, avoid duplicates
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
   (needed for ProductDetail page)
========================================================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
    if (!rows.length) return res.status(404).json({ message: "Product not found" });

    let product = rows[0];
    try { product.images = product.images ? JSON.parse(product.images) : []; } catch {}
    try { product.dynamic_fields = product.dynamic_fields ? JSON.parse(product.dynamic_fields) : {}; } catch {}

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

    // Upload images
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

    const query = `
      INSERT INTO products
      (title, description, price, category_id, subcategory_id, images, dynamic_fields, promotion_id, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      title,
      description || null,
      priceNum,
      category_id,
      subcategory_id || null,
      uploadedImages.length ? JSON.stringify(uploadedImages) : null,
      Object.keys(cleanedFields).length ? JSON.stringify(cleanedFields) : null,
      promotion_id || null
    ]);

    const product = rows[0];
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