import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// CONFIGS (UI ONLY)
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
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"), false);
    }
    cb(null, true);
  },
});

/* ================= HELPERS ================= */

const normalizeProduct = (p) => ({
  ...p,
  images: Array.isArray(p.images) ? p.images : [],
  attributes: p.attributes || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  promotion:
    promotionPlans.find((x) => x.id == p.promotion_id) || null,
});

/* =========================================================
   GET PRODUCTS
========================================================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;

    skip = Math.max(parseInt(skip) || 0, 0);
    limit = Math.min(parseInt(limit) || 20, 50);

    const baseQuery = `
      SELECT 
        p.*,
        COALESCE(
          json_agg(pi.image_url)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
    `;

    const trendingRes = await pool.query(`
      ${baseQuery}
      ORDER BY p.views DESC NULLS LAST
      LIMIT 6
    `);

    const productsRes = await pool.query(
      `
      ${baseQuery}
      ORDER BY p.created_at DESC
      OFFSET $1 LIMIT $2
      `,
      [skip, limit]
    );

    const trending = trendingRes.rows.map(normalizeProduct);
    const products = productsRes.rows.map(normalizeProduct);

    const trendingIds = new Set(trending.map((p) => p.id));

    res.json({
      trending,
      products: [
        ...trending,
        ...products.filter((p) => !trendingIds.has(p.id)),
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

    const { rows } = await pool.query(
      `
      SELECT 
        p.*,
        COALESCE(
          json_agg(pi.image_url)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = normalizeProduct(rows[0]);

    pool
      .query(
        "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",
        [id]
      )
      .catch(() => {});

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
   CREATE PRODUCT (STRICT + CLEAN)
========================================================= */
router.post("/products", upload.array("images", 8), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ================= REQUIRED FIELDS ================= */
    const title = req.body.title;
    const price = Number(req.body.price);
    const category_id = req.body.category_id;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ message: "Invalid price" });
    }

    /* ================= CATEGORY CHECK ================= */
    const { rows: catRows } = await client.query(
      `SELECT id, fields_key FROM categories WHERE id=$1`,
      [category_id]
    );

    if (!catRows.length) {
      return res.status(400).json({ message: "Invalid category" });
    }

    /* ================= FIXED ATTRIBUTES ================= */
    const attributes = {
      brand: req.body.brand || null,
      model: req.body.model || null,
      color: req.body.color || null,
      condition: req.body.condition || null,
      used_detail: req.body.used_detail || null,
      engine: req.body.engine || null,
      year: req.body.year || null,
      fuel_type: req.body.fuel_type || null,
      features: req.body.features || null,
      ram: req.body.ram || null,
      storage: req.body.storage || null,
      sim: req.body.sim || null,
    };

    /* ================= EXTRA FIELDS ================= */
    const contact_phone = req.body.contact_phone || null;
    const video_link = req.body.video_link || null;
    const negotiable = req.body.negotiable || "Not sure";

    const location_state = req.body.location_state || null;
    const location_city = req.body.location_city || null;

    const promotion_id = req.body.promotion_id || null;
    const subcategory_id = req.body.subcategory_id || null;

    /* ================= INSERT PRODUCT ================= */
    const { rows } = await client.query(
      `
      INSERT INTO products (
        title,
        description,
        price,
        category_id,
        subcategory_id,
        attributes,
        promotion_id,
        location_state,
        location_city,
        contact_phone,
        video_link,
        negotiable,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())
      RETURNING *
      `,
      [
        title,
        req.body.description || "",
        price,
        category_id,
        subcategory_id,
        attributes,
        promotion_id,
        location_state,
        location_city,
        contact_phone,
        video_link,
        negotiable,
      ]
    );

    const product = rows[0];

    /* ================= IMAGE UPLOAD ================= */
    if (req.files?.length) {
      const uploads = await Promise.all(
        req.files.map(
          (file, index) =>
            new Promise((resolve, reject) => {
              const stream = cloudinary.uploader.upload_stream(
                {
                  folder: "products",
                  transformation: [
                    { width: 800, height: 800, crop: "limit" },
                    { quality: "auto" },
                    { fetch_format: "auto" },
                  ],
                },
                (err, result) => {
                  if (err) return reject(err);
                  resolve({
                    url: result.secure_url,
                    position: index,
                  });
                }
              );
              stream.end(file.buffer);
            })
        )
      );

      for (const img of uploads) {
        await client.query(
          `INSERT INTO product_images (product_id, image_url, position)
           VALUES ($1,$2,$3)`,
          [product.id, img.url, img.position]
        );
      }
    }

    await client.query("COMMIT");

    res.status(201).json(normalizeProduct(product));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* =========================================================
   GET CATEGORIES (FULL UI OPTIONS)
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

    rows.forEach((cat) => {
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
          engines,
          fuel_types: fuelTypes,
          location: Object.keys(locationsByState),
        },
        subcategories: [],
      };

      if (!cat.parent_id) tree.push(map[cat.id]);
    });

    rows.forEach((cat) => {
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