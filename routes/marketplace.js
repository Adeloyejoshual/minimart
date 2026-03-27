import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

/* ================= UI CONFIGS (UNCHANGED) ================= */
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

/* ================= NORMALIZER (ENHANCED) ================= */
const normalizeProduct = (p) => ({
  ...p,
  images: Array.isArray(p.images) ? p.images : [],
  attributes: p.attributes || {},
  delivery: p.delivery || {},
  contact: p.contact || {},
  negotiable: p.negotiable ?? true,

  location: {
    state: p.location_state,
    city: p.location_city,
  },

  category_features: p.category_id
    ? featuresByCategory[p.category_id] || []
    : [],

  promotion:
    promotionPlans.find((x) => x.id == p.promotion_id) || null,
});

/* ================= PRODUCT LIST ================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;

    skip = Math.max(parseInt(skip) || 0, 0);
    limit = Math.min(parseInt(limit) || 20, 50);

    const baseQuery = `
      SELECT p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
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

/* ================= SINGLE PRODUCT ================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT p.*,
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

    const product = normalizeProduct(rows[0]);

    pool.query(
      "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",
      [id]
    ).catch(() => {});

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* ================= CREATE PRODUCT (ENHANCED) ================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      title,
      price,
      category_id,
      description = "",
      subcategory_id,
      promotion_id,
      location_state,
      location_city,
    } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

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

    const delivery = req.body.delivery
      ? JSON.parse(req.body.delivery)
      : {
          available: true,
          cost: 0,
        };

    const contact = req.body.contact
      ? JSON.parse(req.body.contact)
      : {};

    const negotiable = req.body.negotiable === "false" ? false : true;

    const { rows } = await client.query(
      `
      INSERT INTO products (
        title, description, price,
        category_id, subcategory_id,
        attributes, delivery, contact,
        promotion_id,
        location_state, location_city,
        negotiable,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())
      RETURNING *
      `,
      [
        title,
        description,
        price,
        category_id,
        subcategory_id || null,
        attributes,
        delivery,
        contact,
        promotion_id || null,
        location_state || null,
        location_city || null,
        negotiable,
      ]
    );

    const product = rows[0];

    /* images unchanged */
    if (req.files?.length) {
      const uploads = await Promise.all(
        req.files.map(
          (file, index) =>
            new Promise((resolve, reject) => {
              const stream = cloudinary.uploader.upload_stream(
                { folder: "products" },
                (err, result) => {
                  if (err) return reject(err);
                  resolve({ url: result.secure_url, position: index });
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
    res.status(500).json({ message: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* ================= WISHLIST (NEW) ================= */
router.post("/products/:id/wishlist", async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    await pool.query(
      `
      INSERT INTO wishlist (user_id, product_id)
      VALUES ($1,$2)
      ON CONFLICT DO NOTHING
      `,
      [userId, id]
    );

    res.json({ message: "Saved to wishlist" });
  } catch (err) {
    res.status(500).json({ message: "Wishlist failed" });
  }
});

/* ================= OFFERS / NEGOTIATION (NEW) ================= */
router.post("/products/:id/offers", async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    await pool.query(
      `
      INSERT INTO offers (product_id, user_id, price, status)
      VALUES ($1,$2,$3,'pending')
      `,
      [id, req.user?.id, price]
    );

    res.json({ message: "Offer submitted" });
  } catch (err) {
    res.status(500).json({ message: "Offer failed" });
  }
});

/* ================= SIMILAR PRODUCTS (NEW) ================= */
router.get("/products/:id/similar", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT * FROM products
      WHERE category_id = (
        SELECT category_id FROM products WHERE id=$1
      )
      AND id != $1
      LIMIT 8
      `,
      [id]
    );

    res.json(rows.map(normalizeProduct));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch similar products" });
  }
});

/* ================= DELETE / UPDATE / CATEGORIES ================= */
/* (UNCHANGED LOGIC - only fix SQL formatting) */

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
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;