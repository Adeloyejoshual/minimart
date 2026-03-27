import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

/* ================= UI CONFIG ================= */
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

/* ================= SAFE PARSE ================= */
const safeParse = (val, fallback = null) => {
  try {
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
};

/* ================= NORMALIZER ================= */
const normalizeProduct = (p) => ({
  ...p,
  images: Array.isArray(p.images) ? p.images : [],
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

    /* ================= TRENDING ================= */
    const trendingRes = await pool.query(`
      SELECT
        p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY (
        COALESCE(p.views,0) +
        COALESCE(p.wishlist_count,0) * 3 +
        COALESCE(p.offer_count,0) * 2
      ) DESC
      LIMIT 6
    `);

    /* ================= PRODUCTS ================= */
    const productsRes = await pool.query(
      `
      SELECT
        p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY p.created_at DESC
      OFFSET $1 LIMIT $2
      `,
      [skip, limit]
    );

    /* ================= TOTAL ================= */
    const totalRes = await pool.query(
      `SELECT COUNT(*) FROM products WHERE is_active = true`
    );

    const total = parseInt(totalRes.rows[0].count);
    const nextSkip = skip + limit;

    res.json({
      trending: trendingRes.rows.map(normalizeProduct),
      products: productsRes.rows.map(normalizeProduct),
      hasMore: nextSkip < total,
      nextSkip,
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/* =========================================================
SEARCH ENGINE (GOOGLE-LIKE)
========================================================= */
router.get("/search", async (req, res) => {
  try {
    let { q = "", skip = 0, limit = 20 } = req.query;

    skip = Math.max(parseInt(skip) || 0, 0);
    limit = Math.min(parseInt(limit) || 20, 50);

    const text = q.trim();

    const { rows } = await pool.query(
      `
      SELECT
        p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images,

        (
          COALESCE(p.views,0) +
          COALESCE(p.wishlist_count,0) * 3 +
          COALESCE(p.offer_count,0) * 2 +
          CASE
            WHEN p.title ILIKE $1 THEN 30 ELSE 0
          END
        ) AS score

      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
        AND (
          $2 = '' OR
          p.title ILIKE $2 OR
          p.description ILIKE $2
        )

      GROUP BY p.id
      ORDER BY score DESC, p.created_at DESC
      OFFSET $3 LIMIT $4
      `,
      [text, `%${text}%`, skip, limit]
    );

    res.json({
      query: text,
      results: rows.map(normalizeProduct),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Search failed" });
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
          json_agg(pi.image_url ORDER BY pi.position)
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

    pool
      .query(`UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1`, [
        id,
      ])
      .catch(() => {});

    res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
CREATE PRODUCT
========================================================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { title, price, category_id } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const attributes = {
      brand: req.body.brand || null,
      model: req.body.model || null,
      color: req.body.color || null,
      condition: req.body.condition || null,
      used_detail: req.body.used_detail || null,
      ram: req.body.ram || null,
      storage: req.body.storage || null,
      sim: req.body.sim || null,
      year: req.body.year || null,
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
        promotion_id,
        location_state,
        location_city,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())
      RETURNING *
      `,
      [
        title,
        req.body.description || "",
        Number(price),
        category_id,
        req.body.subcategory_id || null,
        attributes,
        delivery,
        contact,
        req.body.promotion_id || null,
        req.body.location_state || null,
        req.body.location_city || null,
      ]
    );

    const product = rows[0];

    /* ================= IMAGES ================= */
    if (req.files?.length) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        const upload = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "products" },
            (err, result) => {
              if (err) return reject(err);
              resolve(result.secure_url);
            }
          );
          stream.end(file.buffer);
        });

        await client.query(
          `INSERT INTO product_images (product_id, image_url, position)
           VALUES ($1,$2,$3)`,
          [product.id, upload, i]
        );
      }
    }

    await client.query("COMMIT");

    res.status(201).json(normalizeProduct(product));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Create failed" });
  } finally {
    client.release();
  }
});

/* =========================================================
CATEGORIES (UNCHANGED BUT SAFE)
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
      map[cat.id] = { ...cat, subcategories: [] };
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
    res.status(500).json({ message: "Categories failed" });
  }
});

export default router;