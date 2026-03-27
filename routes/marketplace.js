import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

/* ================= CONFIG ================= */
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
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"), false);
    }
    cb(null, true);
  },
});

/* ================= HELPERS ================= */
const safeParse = (val, fallback = null) => {
  try {
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
};

const getImages = (row) => {
  if (row?.media?.images?.length) return row.media.images;
  return [];
};

const normalizeProduct = (p) => ({
  ...p,
  images: getImages(p),
  attributes: p.attributes || {},
  delivery: p.delivery || {},
  contact: p.contact || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  promotion:
    promotionPlans.find((x) => x.id == p.promotion_id) || null,
});

/* =========================================================
GET PRODUCTS (TRENDING + PAGINATION)
========================================================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;

    skip = Math.max(parseInt(skip) || 0, 0);
    limit = Math.min(parseInt(limit) || 20, 50);

    const baseQuery = `
      SELECT *
      FROM products
      WHERE is_active = true
    `;

    const trendingRes = await pool.query(`
      ${baseQuery}
      ORDER BY (
        COALESCE(views,0) +
        COALESCE(wishlist_count,0) * 3 +
        COALESCE(offer_count,0) * 2
      ) DESC
      LIMIT 6
    `);

    const productsRes = await pool.query(
      `
      ${baseQuery}
      ORDER BY created_at DESC
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
      `SELECT * FROM products WHERE id=$1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    pool.query(
      "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",
      [id]
    ).catch(() => {});

    res.json(normalizeProduct(rows[0]));

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
CREATE PRODUCT (FIXED MEDIA SYSTEM)
========================================================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const title = req.body.title;
    const price = Number(req.body.price);
    const category_id = req.body.category_id;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    /* upload images */
    const imageUrls = [];

    if (req.files?.length) {
      const uploads = await Promise.all(
        req.files.map(
          (file) =>
            new Promise((resolve, reject) => {
              const stream = cloudinary.uploader.upload_stream(
                { folder: "products" },
                (err, result) => {
                  if (err) return reject(err);
                  resolve(result.secure_url);
                }
              );
              stream.end(file.buffer);
            })
        )
      );

      imageUrls.push(...uploads);
    }

    const media = {
      images: imageUrls,
      videos: [],
    };

    const attributes = {
      brand: req.body.brand || null,
      model: req.body.model || null,
      color: req.body.color || null,
      condition: req.body.condition || null,
      year: req.body.year || null,
      ram: req.body.ram || null,
      storage: req.body.storage || null,
      features: req.body.features || null,
    };

    const delivery = safeParse(req.body.delivery, {
      type: "none",
      price: null,
      negotiable: false,
    });

    const contact = safeParse(req.body.contact, {});

    const { rows } = await client.query(
      `
      INSERT INTO products (
        title,
        description,
        price,
        category_id,
        subcategory_id,
        attributes,
        delivery,
        contact,
        media,
        promotion_id,
        location_state,
        location_city,
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
        req.body.subcategory_id || null,
        attributes,
        delivery,
        contact,
        media,
        req.body.promotion_id || null,
        req.body.location_state || null,
        req.body.location_city || null,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json(normalizeProduct(rows[0]));

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* =========================================================
DELETE PRODUCT
========================================================= */
router.delete("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM products WHERE id=$1", [id]);

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
});

/* =========================================================
CATEGORIES
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

    for (const cat of rows) {
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
    }

    for (const cat of rows) {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].subcategories.push(map[cat.id]);
      }
    }

    res.json(tree);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;