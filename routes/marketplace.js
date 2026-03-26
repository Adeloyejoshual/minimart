import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// CONFIGS
import { categoryFields } from "../src/config/categoryFields.js";
import { promotionPlans } from "../src/config/promotions.js";
import { locationsByState } from "../src/config/locationsByState.js";

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

/* =========================================================
   HELPERS
========================================================= */

// normalize DB product → API shape
const normalizeProduct = (p) => ({
  ...p,
  images: Array.isArray(p.images) ? p.images : [],
  dynamic_fields: p.dynamic_fields || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  promotion:
    promotionPlans.find((x) => x.id == p.promotion_id) || null,
});

// safe negotiable
const normalizeNegotiable = (val) => {
  if (val === "yes") return "yes";
  if (val === "no") return "no";
  return "unknown";
};

/* =========================================================
   GET PRODUCTS (SINGLE QUERY OPTIMIZED)
========================================================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;

    skip = Math.max(parseInt(skip) || 0, 0);
    limit = Math.min(parseInt(limit) || 20, 50);

    const { rows } = await pool.query(
      `
      SELECT 
        p.*,
        COALESCE(json_agg(pi.image_url)
          FILTER (WHERE pi.image_url IS NOT NULL), '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY p.views DESC NULLS LAST, p.created_at DESC
      OFFSET $1 LIMIT $2
    `,
      [skip, limit]
    );

    const products = rows.map(normalizeProduct);
    const trending = products.slice(0, 6);

    res.json({
      trending,
      products,
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
        COALESCE(json_agg(pi.image_url)
          FILTER (WHERE pi.image_url IS NOT NULL), '[]'
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

    // async view increment
    pool.query(
      "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",
      [id]
    ).catch(() => {});

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
   CREATE PRODUCT (FAST + SAFE)
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
      contact_phone,
      negotiable,
      location_state,
      location_city,
    } = req.body;

    /* ---------- VALIDATION ---------- */
    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const priceNum = Number(price);
    if (!priceNum || priceNum < 0) {
      return res.status(400).json({ message: "Invalid price" });
    }

    /* ---------- CATEGORY ---------- */
    const { rows: catRows } = await client.query(
      `SELECT id, fields_key FROM categories WHERE id=$1`,
      [category_id]
    );

    if (!catRows.length) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const category = catRows[0];

    /* ---------- DYNAMIC FIELDS ---------- */
    let parsedFields = {};
    try {
      parsedFields =
        typeof dynamicFields === "string"
          ? JSON.parse(dynamicFields)
          : dynamicFields || {};
    } catch {
      return res.status(400).json({ message: "Invalid dynamic fields" });
    }

    const allowed = categoryFields[category.fields_key] || {};
    const cleanedFields = {};

    Object.keys(allowed).forEach((key) => {
      if (parsedFields[key] !== undefined) {
        cleanedFields[key] = parsedFields[key];
      }
    });

    /* ---------- NEGOTIABLE ---------- */
    const negotiableValue = normalizeNegotiable(negotiable);

    await client.query("BEGIN");

    /* ---------- INSERT PRODUCT ---------- */
    const { rows } = await client.query(
      `
      INSERT INTO products (
        title, description, price,
        category_id, subcategory_id,
        dynamic_fields,
        promotion_id,
        location_state, location_city,
        contact_phone,
        negotiable,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())
      RETURNING id
      `,
      [
        title,
        description || "",
        priceNum,
        category_id,
        subcategory_id || null,
        cleanedFields,
        promotion_id || null,
        location_state || null,
        location_city || null,
        contact_phone || null,
        negotiableValue,
      ]
    );

    const productId = rows[0].id;

    /* ---------- IMAGE UPLOAD ---------- */
    if (req.files?.length) {
      const uploads = req.files.map((file, index) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "minimart_products",
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
        });
      });

      const uploaded = await Promise.all(uploads);

      const query = `
        INSERT INTO product_images (product_id, image_url, position)
        VALUES ${uploaded
          .map((_, i) => `($1,$${i * 2 + 2},$${i * 2 + 3})`)
          .join(",")}
      `;

      const values = [
        productId,
        ...uploaded.flatMap((i) => [i.url, i.position]),
      ];

      await client.query(query, values);
    }

    await client.query("COMMIT");

    res.status(201).json({
      id: productId,
      message: "Product added successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Failed to add product" });
  } finally {
    client.release();
  }
});

/* =========================================================
   GET CATEGORIES (CLEAN TREE)
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