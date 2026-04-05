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
import { fieldOptions } from "../src/config/fieldOptions.js";

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
      return cb(new Error("Only images allowed"));
    }
    cb(null, true);
  },
});

/* ================= HELPERS ================= */
const safeJSON = (value, fallback = {}) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeDelivery = (d = {}) => ({
  available: d?.available ?? false,
  duration: {
    from: Number(d?.duration?.from ?? 0),
    to: Number(d?.duration?.to ?? 0),
  },
  fee: d?.fee ?? null,
  type: d?.type || "optional",
  note: d?.note || "",
});

const normalizeProduct = (p) => ({
  ...p,
  images: p.images || [],
  attributes: p.attributes || {},
  delivery: normalizeDelivery(p.delivery),
  contact: p.contact || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
});

/* ================= CLOUDINARY UPLOAD ================= */
const uploadImages = async (files) => {
  if (!files?.length) return [];

  return Promise.all(
    files.map((file, index) =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "products",
            transformation: [
              { width: 900, height: 900, crop: "limit" },
              { quality: "auto" },
              { fetch_format: "auto" },
            ],
          },
          (err, result) => {
            if (err) return reject(err);
            resolve({ url: result.secure_url, position: index });
          }
        );
        stream.end(file.buffer);
      })
    )
  );
};

/* =========================================================
ACTIVATE PRODUCT (ADMIN USE ONLY)
========================================================= */
router.post("/products/:id/activate", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT * FROM products WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (!rows.length || !rows[0].is_active || rows[0].state === "active") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Cannot activate this product" });
    }

    await client.query(
      `
      UPDATE products
      SET is_active = true, state = 'active', updated_at = now()
      WHERE id = $1
      `,
      [id]
    );

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Activate product error:", err);
    res.status(500).json({ message: "Failed to activate product" });
  } finally {
    client.release();
  }
});

/* =========================================================
GET PRODUCTS
========================================================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;
    const offset = Math.max(+skip || 0, 0);
    const take = Math.min(+limit || 20, 50);

    const baseQuery = `
      SELECT p.*,
             COALESCE(
               json_agg(pi.image_url ORDER BY pi.position)
               FILTER (WHERE pi.image_url IS NOT NULL),
               '[]'
             ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true AND p.state = 'active'
      GROUP BY p.id
    `;

    const [trendingRes, productsRes] = await Promise.all([
      pool.query(`${baseQuery} ORDER BY p.views DESC NULLS LAST LIMIT 6`),
      pool.query(
        `${baseQuery}
         ORDER BY p.created_at DESC
         OFFSET $1 LIMIT $2`,
        [offset, take]
      ),
    ]);

    const trending = trendingRes.rows.map(normalizeProduct);
    const trendingIds = new Set(trending.map((p) => p.id));
    const feedProducts = productsRes.rows
      .map(normalizeProduct)
      .filter((p) => !trendingIds.has(p.id));

    res.json({
      trending,
      products: [...trending, ...feedProducts],
    });
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
      WHERE p.id = $1 AND p.is_active = true AND p.state = 'active'
      GROUP BY p.id
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    pool.query(
      "UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1",
      [id]
    ).catch((err) => console.error("View increment error:", err));

    res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
CREATE PRODUCT (SIMPLE - ACTIVE IMMEDIATELY)
========================================================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { title, description, price, category_id, subcategory_id } = req.body;

    // Validation
    if (!title?.trim() || !price || !category_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Missing required fields: title, price, category_id" });
    }

    const attributes = safeJSON(req.body.attributes);
    const delivery = normalizeDelivery(safeJSON(req.body.delivery, {}));
    const contact = safeJSON(req.body.contact);

    const { rows } = await client.query(
      `
      INSERT INTO products (
        title, description, price, category_id, subcategory_id,
        attributes, delivery, contact,
        location_state, location_city,
        is_active, state,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, 'active', now(), now())
      RETURNING *
      `,
      [
        title.trim(),
        description || "",
        parseFloat(price),
        category_id,
        subcategory_id || null,
        JSON.stringify(attributes),
        JSON.stringify(delivery),
        JSON.stringify(contact),
        req.body.location_state || null,
        req.body.location_city || null,
      ]
    );

    const product = rows[0];

    // Upload images
    const images = await uploadImages(req.files || []);

    for (const img of images) {
      await client.commit();
      await client.query(
        `INSERT INTO product_images (product_id, image_url, position)
         VALUES ($1, $2, $3)`,
        [product.id, img.url, img.position]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({ 
      product: normalizeProduct({ 
        ...product, 
        images 
      }) 
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /products error:", err);
    res.status(500).json({ message: err.message || "Failed to create product" });
  } finally {
    client.release();
  }
});

/* =========================================================
GET CATEGORIES (DYNAMIC OPTIONS)
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
          // Controls frontend rendering
          fields: categoryFields[key] || [],
          
          // Core dropdowns
          brands: brands[key] || [],
          models: models[key] || {},
          colors: colors || [],
          conditions,
          usedDetails,
          ram: ramOptions,
          storage: storageOptions,
          sims,
          features: featuresByCategory[key] || [],
          years,
          engines,
          fuel_types: fuelTypes,
          
          // Custom field options
          ...fieldOptions,
        },
        subcategories: [],
      };

      if (!cat.parent_id) {
        tree.push(map[cat.id]);
      }
    });

    // Build category tree
    rows.forEach((cat) => {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].subcategories.push(map[cat.id]);
      }
    });

    res.json(tree);
  } catch (err) {
    console.error("Categories fetch error:", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;