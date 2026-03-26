// routes/marketplace.js
import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// CONFIG IMPORTS
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

// CLOUDINARY
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MULTER
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"), false);
    }
    cb(null, true);
  },
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
      SELECT 
        p.*,
        COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
    `;

    const trending = await pool.query(`
      ${baseQuery}
      ORDER BY p.views DESC
      LIMIT 6
    `);

    const main = await pool.query(`
      ${baseQuery}
      ORDER BY p.created_at DESC
      OFFSET $1 LIMIT $2
    `, [skip, limit]);

    const normalize = (p) => ({
      ...p,
      images: Array.isArray(p.images) ? p.images : [],
      dynamic_fields: p.dynamic_fields || {},
      delivery: p.delivery || {},
      location: {
        state: p.location_state,
        city: p.location_city,
      },
      promotion: promotionPlans.find(x => x.id == p.promotion_id) || null,
    });

    const trendingProducts = trending.rows.map(normalize);
    const mainProducts = main.rows.map(normalize);

    const trendingIds = trendingProducts.map(p => p.id);

    res.json({
      trending: trendingProducts,
      products: [
        ...trendingProducts,
        ...mainProducts.filter(p => !trendingIds.includes(p.id)),
      ],
    });

  } catch (err) {
    console.error(err);
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
      SELECT 
        p.*,
        COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);

    if (!rows.length) return res.status(404).json({ message: "Not found" });

    const product = rows[0];

    product.dynamic_fields = product.dynamic_fields || {};
    product.delivery = product.delivery || {};
    product.location = {
      state: product.location_state,
      city: product.location_city,
    };
    product.promotion = promotionPlans.find(x => x.id == product.promotion_id) || null;

    pool.query(
      "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",
      [id]
    ).catch(console.error);

    res.json(product);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
   POST PRODUCT (FULL UPGRADE)
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

      // NEW FIELDS
      phone,
      negotiation,
      delivery,
      location_state,
      location_city,
    } = req.body;

    // ---------------- VALIDATION ----------------
    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) {
      return res.status(400).json({ message: "Invalid price" });
    }

    // ---------------- CATEGORY ----------------
    const { rows: catRows } = await client.query(
      "SELECT id, name, fields_key FROM categories WHERE id=$1",
      [category_id]
    );

    if (!catRows.length) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const category = catRows[0];

    // ---------------- DYNAMIC ----------------
    let parsedFields = {};
    try {
      parsedFields =
        typeof dynamicFields === "string"
          ? JSON.parse(dynamicFields)
          : dynamicFields || {};
    } catch {
      return res.status(400).json({ message: "Invalid dynamic fields" });
    }

    const allowedKeys = categoryFields[category.fields_key] || [];
    const cleanedFields = Object.fromEntries(
      Object.entries(parsedFields).filter(([k]) => allowedKeys.includes(k))
    );

    // ---------------- DELIVERY ----------------
    let parsedDelivery = {};
    try {
      parsedDelivery =
        typeof delivery === "string"
          ? JSON.parse(delivery)
          : delivery || {};
    } catch {
      parsedDelivery = {};
    }

    // ---------------- START TRANSACTION ----------------
    await client.query("BEGIN");

    // INSERT PRODUCT
    const { rows } = await client.query(`
      INSERT INTO products (
        title,
        description,
        price,
        category_id,
        subcategory_id,
        dynamic_fields,
        promotion_id,
        location_state,
        location_city,
        phone,
        negotiation,
        delivery,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      title,
      description || "",
      priceNum,
      category_id,
      subcategory_id || null,
      cleanedFields,
      promotion_id || null,
      location_state || null,
      location_city || null,
      phone,
      negotiation || "not_sure",
      parsedDelivery,
      new Date(),
    ]);

    const product = rows[0];

    // ---------------- IMAGES ----------------
    if (req.files?.length) {
      const uploaded = await Promise.all(
        req.files.map(file =>
          new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "minimart_products" },
              (err, result) => {
                if (err) reject(err);
                else resolve(result.secure_url);
              }
            );
            stream.end(file.buffer);
          })
        )
      );

      await Promise.all(
        uploaded.map((url, index) =>
          client.query(
            `INSERT INTO product_images (product_id, image_url, position)
             VALUES ($1,$2,$3)`,
            [product.id, url, index]
          )
        )
      );
    }

    await client.query("COMMIT");

    product.promotion = promotionPlans.find(x => x.id == promotion_id) || null;

    res.status(201).json(product);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Failed to add product" });
  } finally {
    client.release();
  }
});

/* =========================================================
   GET CATEGORIES
========================================================= */
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, parent_id, fields_key
      FROM categories
      ORDER BY name ASC
    `);

    const map = {};
    const tree = [];

    rows.forEach(cat => {
      const key = cat.fields_key || "";

      map[cat.id] = {
        ...cat,
        dynamicOptions: {
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
        },
        subcategories: [],
      };

      if (!cat.parent_id) tree.push(map[cat.id]);
    });

    rows.forEach(cat => {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].subcategories.push(map[cat.id]);
      }
    });

    res.json(tree);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;