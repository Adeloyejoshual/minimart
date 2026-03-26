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

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ================= MULTER ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ================= HELPERS ================= */
const parseJSONSafe = (val, fallback = {}) => {
  try {
    return typeof val === "string" ? JSON.parse(val) : val || fallback;
  } catch {
    return fallback;
  }
};

const normalizeProduct = (p) => ({
  ...p,
  images: Array.isArray(p.images) ? p.images : [],
  dynamic_fields: parseJSONSafe(p.dynamic_fields, {}),
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  promotion:
    promotionPlans.find((plan) => plan.id == p.promotion_id) || null,
});

/* =========================================================
   GET PRODUCTS
========================================================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;
    skip = parseInt(skip);
    limit = Math.min(parseInt(limit), 50);

    const baseQuery = `
      SELECT p.*,
      COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
    `;

    const trendingQuery = `${baseQuery} ORDER BY p.views DESC LIMIT 6`;
    const mainQuery = `${baseQuery} ORDER BY p.created_at DESC OFFSET $1 LIMIT $2`;

    const { rows: trending } = await pool.query(trendingQuery);
    const { rows: main } = await pool.query(mainQuery, [skip, limit]);

    const trendingProducts = trending.map(normalizeProduct);
    const mainProducts = main.map(normalizeProduct);

    const trendingIds = new Set(trendingProducts.map(p => p.id));

    const products = [
      ...trendingProducts,
      ...mainProducts.filter(p => !trendingIds.has(p.id)),
    ];

    res.json({ products, trending: trendingProducts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================
   GET SINGLE PRODUCT
========================================================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT p.*,
      COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id
    `,
      [id]
    );

    if (!rows.length) return res.status(404).json({ message: "Product not found" });

    const product = normalizeProduct(rows[0]);

    pool.query("UPDATE products SET views = COALESCE(views,0)+1 WHERE id = $1", [id]).catch(console.error);

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================
   POST PRODUCT (FIXED IMAGES)
========================================================= */
router.post("/products", upload.array("images", 8), async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      title,
      description,
      price,
      category_id,
      subcategory_id,
      dynamicFields,
      promotion_id,
      location_state,
      location_city,
    } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Title, price, and category are required" });
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) return res.status(400).json({ message: "Invalid price" });

    const { rows: catRows } = await client.query(
      "SELECT fields_key FROM categories WHERE id = $1",
      [category_id]
    );

    if (!catRows.length) return res.status(400).json({ message: "Invalid category" });

    const parsedFields = parseJSONSafe(dynamicFields);
    const allowed = categoryFields[catRows[0].fields_key] || [];

    const cleanedFields = Object.fromEntries(
      Object.entries(parsedFields).filter(([k]) => allowed.includes(k))
    );

    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      INSERT INTO products
      (title, description, price, category_id, subcategory_id, dynamic_fields, promotion_id, location_state, location_city)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `,
      [
        title,
        description || null,
        priceNum,
        category_id,
        subcategory_id || null,
        JSON.stringify(cleanedFields),
        promotion_id || null,
        location_state || null,
        location_city || null,
      ]
    );

    const product = rows[0];

    /* -------- IMAGE UPLOAD -------- */
    if (req.files?.length) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        const url = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "minimart_products" },
            (err, result) => err ? reject(err) : resolve(result.secure_url)
          );
          stream.end(file.buffer);
        });

        await client.query(
          "INSERT INTO product_images (product_id, image_url, position) VALUES ($1,$2,$3)",
          [product.id, url, i]
        );
      }
    }

    await client.query("COMMIT");

    res.status(201).json({
      ...product,
      images: [],
      promotion: promotionPlans.find(p => p.id == promotion_id) || null,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

/* =========================================================
   GET CATEGORIES (DYNAMIC OPTIONS BACK ✅)
========================================================= */
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, parent_id, fields_key
      FROM categories
      ORDER BY name ASC
    `);

    const map = {};
    const result = [];

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
        ...(key === "Vehicles"
          ? { engine: engines, fuel_type: fuelTypes }
          : {}),
      };

      map[cat.id] = {
        ...cat,
        dynamicOptions,
        subcategories: [],
      };

      if (!cat.parent_id) result.push(map[cat.id]);
    });

    rows.forEach(cat => {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].subcategories.push(map[cat.id]);
      }
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

export default router;