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

const safeArray = (arr) => Array.isArray(arr) ? arr : [];

const normalizeDelivery = (d = {}) => ({
  available: d?.available ?? false,
  duration: {
    from: Number(d?.duration?.from ?? 0),
    to: Number(d?.duration?.to ?? 0),
  },
  fee: d?.fee ?? null,
  note: d?.note || "",
});

const normalizeProduct = (p) => ({
  ...p,
  images: p.images || [],
  attributes: safeJSON(p.attributes),
  delivery: normalizeDelivery(safeJSON(p.delivery)),
  contact: safeJSON(p.contact),
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
GET PRODUCTS (Trending + Feed)
========================================================= */
router.get("/products", async (req, res) => {
  try {
    const { skip = 0, limit = 20, state, category_id } = req.query;
    const offset = Math.max(+skip || 0, 0);
    const take = Math.min(+limit || 20, 50);

    const whereClauses = ["p.is_active = true", "p.status = 'active'"]; // ✅ status
    const params = [];
    let paramIndex = 1;

    if (state) {
      whereClauses.push(`p.location_state = $${paramIndex}`);
      params.push(state.trim());
      paramIndex++;
    }

    if (category_id) {
      whereClauses.push(`p.category_id = $${paramIndex}::UUID`);
      params.push(category_id);
      paramIndex++;
    }

    const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    
    const baseQuery = `
      SELECT p.*, 
      COALESCE(json_agg(pi.image_url ORDER BY pi.position) 
      FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images 
      FROM products p 
      LEFT JOIN product_images pi ON p.id = pi.product_id 
      ${whereStr}
      GROUP BY p.id 
    `;

    const [trendingRes, feedRes] = await Promise.all([
      pool.query(`${baseQuery} ORDER BY p.views DESC NULLS LAST, p.promotion_priority DESC LIMIT 6`),
      pool.query(
        `${baseQuery} ORDER BY p.promotion_priority DESC NULLS LAST, p.created_at DESC OFFSET $${paramIndex} LIMIT $${paramIndex + 1}`,
        [...params, offset, take]
      ),
    ]);

    const trending = trendingRes.rows.map(normalizeProduct);
    const trendingIds = new Set(trending.map((p) => p.id));
    const feedProducts = feedRes.rows.map(normalizeProduct).filter((p) => !trendingIds.has(p.id));

    res.json({
      trending,
      products: [...trending, ...feedProducts],
      filters_applied: { state, category_id },
    });
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/* =========================================================
GET SINGLE PRODUCT (+ VIEW COUNT)
========================================================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT p.*, 
      COALESCE(json_agg(pi.image_url ORDER BY pi.position) 
      FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images 
      FROM products p 
      LEFT JOIN product_images pi ON p.id = pi.product_id 
      WHERE p.id = $1 AND p.is_active = true AND p.status = 'active' 
      GROUP BY p.id 
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = rows[0];
    
    // Fire-and-forget view increment
    pool.query("UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1", [id])
      .catch(console.error);

    res.json(normalizeProduct(product));
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
CREATE PRODUCT (FULLY FRONTEND-COMPATIBLE)
========================================================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
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
    } = req.body;

    // Validation
    if (!title || !title.trim())
      return res.status(400).json({ message: "Title required" });
    if (!price || isNaN(price) || +price <= 0)
      return res.status(400).json({ message: "Valid price required" });
    if (!category_id) return res.status(400).json({ message: "Category required" });
    if (!req.files?.length)
      return res.status(400).json({ message: "At least one image required" });

    const parsedAttributes = safeJSON(attributes);
    const parsedDelivery = normalizeDelivery(safeJSON(delivery));
    const parsedContact = safeJSON(contact);

    const { rows: productRows } = await client.query(
      `
      INSERT INTO products (
        title, description, price, category_id, subcategory_id,
        attributes, delivery, contact, promotion_id,
        location_state, location_city, status,          -- ✅ status
        whatsapp, whatsapp_link                         -- ✅ add WhatsApp
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12, $13)  -- ✅
      RETURNING id, title, description, price, category_id, subcategory_id,
                attributes, delivery, contact, promotion_id,
                location_state, location_city, created_at, status, is_active,
                whatsapp, whatsapp_link
      `,
      [
        title.trim(),
        description?.trim() || "",
        parseFloat(price),
        category_id,
        subcategory_id || null,
        parsedAttributes,
        parsedDelivery,
        parsedContact,
        promotion_id ? parseInt(promotion_id, 10) : null,
        location_state?.trim() || null,
        location_city?.trim() || null,
        (parsedContact.whatsapp || "").trim() || null,          // ✅ WhatsApp
        (parsedContact.whatsapp_link || "").trim() || null,     // ✅ WhatsApp link
      ]
    );

    const product = productRows[0];

    // Insert images
    const images = await uploadImages(req.files);
    const imagePromises = images.map((img) =>
      client.query(
        "INSERT INTO product_images (product_id, image_url, position) VALUES ($1, $2, $3)",
        [product.id, img.url, img.position]
      )
    );

    await Promise.all(imagePromises);
    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      product: normalizeProduct({ ...product, images: images.map(img => img.url) }),
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /products error:", err);

    if (err.code === "23503") {
      return res.status(400).json({ message: "Invalid category or promotion" });
    }
    res.status(500).json({ message: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* =========================================================
ACTIVATE PRODUCT (Payment success / Free plan)
========================================================= */
router.post("/products/:id/activate", async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    const { id } = req.params;
    const { promotion_id } = req.body;

    const result = await client.query(
      `UPDATE products 
       SET status = 'active',                           -- ✅ status
           is_active = true,
           promotion_id = $1,
           promotion_priority = COALESCE(promotion_priority, 0) + 1,
           updated_at = NOW()
       WHERE id = $2 AND status = 'draft'              -- ✅ status
       RETURNING id, title, status, is_active, promotion_id`,
      [promotion_id || null, id]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ 
        message: "Draft product not found or already published" 
      });
    }

    await client.query("COMMIT");
    
    console.log(`✅ Activated product: ${id} (promo: ${promotion_id || 'none'})`);
    res.json({ 
      success: true, 
      message: "Product published successfully",
      product_id: result.rows[0].id 
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Activate error:", err);
    res.status(500).json({ message: "Failed to activate product" });
  } finally {
    client.release();
  }
});

/* =========================================================
GET CATEGORIES (FULLY FIXED - PERFECT FRONTEND CONTRACT)
========================================================= */
router.get("/categories", async (req, res) => {
  try {
    const { rows: categoryRows } = await pool.query(
      `SELECT id, name, parent_id, fields_key 
       FROM categories 
       WHERE active = true
       ORDER BY name ASC`
    );

    const categoryMap = {};
    const tree = [];

    categoryRows.forEach((cat) => {
      const key = cat.fields_key?.trim() || "default";
      const rawFields = categoryFields[key] || [];

      categoryMap[cat.id] = {
        ...cat,
        dynamicOptions: {
          fields: rawFields, // ✅ EXACT frontend match - drives UI fields
          brands: safeArray(brands[key]),
          models: models[key] || {},
          colors: safeArray(colors[key]),
          conditions,
          usedDetails,
          ram: safeArray(ramOptions),
          storage: safeArray(storageOptions),
          sim: safeArray(sims),
          features: safeArray(featuresByCategory[key]),
          years: safeArray(years),
          engines: safeArray(engines),
          fuel_types: safeArray(fuelTypes),
          states: Object.keys(locationsByState),
        },
        subcategories: [],
      };

      if (!cat.parent_id) {
        tree.push(categoryMap[cat.id]);
      }
    });

    // Build tree structure
    categoryRows.forEach((cat) => {
      if (cat.parent_id && categoryMap[cat.parent_id]) {
        categoryMap[cat.parent_id].subcategories.push(categoryMap[cat.id]);
      }
    });

    res.json(tree);
  } catch (err) {
    console.error("GET /categories error:", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

/* =========================================================
CLOUDINARY SIGNATURE (Frontend direct uploads)
========================================================= */
router.get("/cloudinary-signature", (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder: "products",
        transformation: [
          { width: 900, height: 900, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      timestamp,
      signature,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    console.error("Signature error:", err);
    res.status(500).json({ error: "Signature generation failed" });
  }
});

export default router;