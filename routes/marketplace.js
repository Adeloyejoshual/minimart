import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

/* CONFIG */
import { categoryFields } from "../src/config/categoryFields.js";
import { brands } from "../src/config/brands.js";
import { models } from "../src/config/models.js";
import { colors } from "../src/config/colors.js";
import { conditions, usedDetails } from "../src/config/conditions.js";
import { featuresByCategory } from "../src/config/featuresByCategory.js";
import { ramOptions } from "../src/config/ramOptions.js";
import { storageOptions } from "../src/config/storageOptions.js";
import { sims } from "../src/config/sims.js";
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
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
});

/* ================= HELPERS ================= */
const safeJSON = (v, fallback = {}) => {
  try {
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeProduct = (p) => ({
  ...p,
  images: p.images || [],
  attributes: p.attributes || {},
  contact: p.contact || {},
  delivery: p.delivery || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  promotion: p.is_promoted
    ? {
        id: p.promotion_id,
        expires_at: p.promotion_expires_at,
      }
    : null,
});

/* ================= IMAGE UPLOAD ================= */
const uploadImages = async (files) => {
  if (!files?.length) return [];

  return Promise.all(
    files.map((file, index) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "products",
            transformation: [
              { width: 1000, height: 1000, crop: "limit" },
              { quality: "auto" },
            ],
          },
          (err, result) => {
            if (err) return reject(err);
            resolve({ url: result.secure_url, position: index });
          }
        );
        stream.end(file.buffer);
      });
    })
  );
};

/* =========================================================
CREATE PRODUCT
========================================================= */
router.post("/products", upload.array("images", 6), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { title, price, category_id } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!req.files?.length) {
      return res.status(400).json({ message: "At least 1 image required" });
    }

    const { rows } = await client.query(
      `
      INSERT INTO products (
        title, description, price, category_id,
        attributes, delivery, contact,
        location_state, location_city,
        is_active, state,
        is_promoted,
        created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        false,'draft',
        false,
        now(),now()
      )
      RETURNING *
      `,
      [
        title.trim(),
        req.body.description || "",
        Number(price),
        category_id,
        safeJSON(req.body.attributes),
        safeJSON(req.body.delivery),
        safeJSON(req.body.contact),
        req.body.location_state,
        req.body.location_city,
      ]
    );

    const product = rows[0];

    const images = await uploadImages(req.files);

    for (const img of images) {
      await client.query(
        `INSERT INTO product_images (product_id, image_url, position)
         VALUES ($1,$2,$3)`,
        [product.id, img.url, img.position]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({ product: normalizeProduct(product) });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Create failed" });
  } finally {
    client.release();
  }
});

/* =========================================================
ACTIVATE PRODUCT (FREE PLAN)
========================================================= */
router.post("/products/:id/activate", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE products
      SET is_active = true,
          state = 'active',
          updated_at = now()
      WHERE id = $1
      `,
      [id]
    );

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ message: "Activation failed" });
  }
});

/* =========================================================
GET PRODUCTS (PROMOTION FIRST)
========================================================= */
router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*,
      COALESCE(json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      AND p.state = 'active'
      GROUP BY p.id
      ORDER BY
        p.is_promoted DESC,
        p.promotion_expires_at DESC NULLS LAST,
        p.created_at DESC
    `);

    res.json(rows.map(normalizeProduct));

  } catch (err) {
    res.status(500).json({ message: "Fetch failed" });
  }
});

/* =========================================================
GET SINGLE PRODUCT
========================================================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT p.*,
      COALESCE(json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id
      `,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json(normalizeProduct(rows[0]));

  } catch {
    res.status(500).json({ message: "Error" });
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
    `);

    const map = {};
    const tree = [];

    rows.forEach((cat) => {
      const key = cat.fields_key || "";

      map[cat.id] = {
        ...cat,
        dynamicOptions: {
          fields: categoryFields[key] || [],
          brand: brands[key] || [],
          model: models[key] || {},
          color: colors,
          condition: conditions,
          used_detail: usedDetails,
          features: featuresByCategory[key] || [],
          ram: ramOptions,
          storage: storageOptions,
          sim: sims,
          year: years,
          engine: engines,
          fuel_type: fuelTypes,
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

  } catch {
    res.status(500).json({ message: "Categories failed" });
  }
});

export default router;