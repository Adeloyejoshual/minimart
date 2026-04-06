import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// Configs
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
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
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

const safeProduct = (p) => ({
  id: p.id || "",
  title: p.title || "Untitled",
  description: p.description || "",
  price: p.price != null ? parseFloat(p.price) : 0,
  category_id: p.category_id || null,
  subcategory_id: p.subcategory_id || null,
  attributes: safeJSON(p.attributes, {}),
  delivery: normalizeDelivery(safeJSON(p.delivery)),
  contact: safeJSON(p.contact, {}),
  location_state: p.location_state || null,
  location_city: p.location_city || null,
  state: p.location_state,
  city: p.location_city,
  images: safeArray(p.images),
  status: p.status || "draft",
  is_active: p.is_active ?? false,
  promotion_id: p.promotion_id || null,
  promotion_expires_at: p.promotion_expires_at || null,
  promotion_priority: p.promotion_priority || 0,
  views: p.views || 0,
});

/* ================= NEW: Flatten Categories ================= */
const flattenCategories = (categories = []) => {
  const result = [];
  const walk = (list) => {
    list.forEach((cat) => {
      result.push({
        id: String(cat.id),
        name: cat.name,
        parent_id: cat.parent_id || null,
        fields_key: cat.fields_key || null,
        dynamicOptions: cat.dynamicOptions
      });
      if (Array.isArray(cat.subcategories) && cat.subcategories.length > 0) {
        walk(cat.subcategories);
      }
    });
  };
  walk(categories);
  return result;
};

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
GET PRODUCTS (Safe arrays + filters)
========================================================= */
router.get("/products", async (req, res, next) => {
  try {
    const { skip = 0, limit = 20, state, category_id } = req.query;

    const offset = Math.max(Math.floor(+skip || 0), 0);
    const take = Math.max(Math.floor(+limit || 20), 1);

    const whereClauses = [
      "p.is_active = true",
      "p.status = 'active'",
      "(p.promotion_expires_at IS NULL OR p.promotion_expires_at > NOW())",
    ];
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
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position) FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images 
      FROM products p 
      LEFT JOIN product_images pi ON p.id = pi.product_id 
      ${whereStr}
      GROUP BY p.id 
    `;

    const [trendingRes, feedRes] = await Promise.all([
      pool.query(`${baseQuery} ORDER BY p.views DESC NULLS LAST LIMIT 6`),
      pool.query(
        `${baseQuery} ORDER BY 
          (p.promotion_expires_at IS NOT NULL) DESC,
          p.promotion_priority DESC NULLS LAST,
          p.created_at DESC 
          OFFSET $${paramIndex} LIMIT $${paramIndex + 1}`,
        [...params, offset, take]
      )
    ]);

    const trendingRows = trendingRes.rows || [];
    const feedRows = feedRes.rows || [];

    const trending = trendingRows
      .map(safeProduct);
    const trendingIds = new Set(trending.map((p) => p.id));

    const feedProducts = feedRows
      .map(safeProduct)
      .filter((p) => !trendingIds.has(p.id));

    res.json({
      trending,
      products: [...trending, ...feedProducts],
      filters_applied: { state, category_id },
    });
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({
      trending: [],
      products: [],
      filters_applied: {},
    });
  }
});

/* =========================================================
GET SINGLE PRODUCT (+ VIEW COUNT)
========================================================= */
router.get("/products/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT p.*, 
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position) FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images 
      FROM products p 
      LEFT JOIN product_images pi ON p.id = pi.product_id 
      WHERE p.id = $1 
        AND p.is_active = true 
        AND p.status = 'active'
        AND (p.promotion_expires_at IS NULL OR p.promotion_expires_at > NOW())
      GROUP BY p.id 
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Product not found",
        product: null,
      });
    }

    const productRow = result.rows[0];
    const safe = safeProduct(productRow);

    // Fire-and-forget view increment
    pool.query("UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1", [id])
      .catch((err) => console.error("View increment failed:", err));

    res.json(safe);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({
      message: "Failed to fetch product",
      product: null,
    });
  }
});

/* =========================================================
PAYMENT STATUS VERIFICATION
========================================================= */
router.get("/payment/verify/:reference", async (req, res, next) => {
  try {
    const { reference } = req.params;

    const result = await pool.query(
      `SELECT status, product_id, amount, plan_id, created_at
       FROM payment_logs 
       WHERE reference = $1`,
      [reference]
    );

    if (result.rowCount === 0) {
      return res.json({ status: "pending" });
    }

    res.json({
      status: result.rows[0].status,
      product_id: result.rows[0].product_id,
    });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ status: "error" });
  }
});

/* =========================================================
CREATE PRODUCT
========================================================= */
router.post("/products", upload.array("images", 10), async (req, res, next) => {
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
    if (!category_id)
      return res.status(400).json({ message: "Category required" });
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
        location_state, location_city, status,
        whatsapp, whatsapp_link
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12, $13)
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
        (parsedContact.whatsapp || "").trim() || null,
        (parsedContact.whatsapp_link || "").trim() || null,
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

    const normalized = { ...product, images: images.map((img) => img.url) };

    res.status(201).json({
      success: true,
      product: safeProduct(normalized),
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
ACTIVATE PRODUCT
========================================================= */
router.post("/products/:id/activate", async (req, res, next) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { promotion_id } = req.body;

    // Get promotion duration
    let durationDays = 0;

    if (promotion_id) {
      const planRes = await client.query(
        "SELECT duration_days FROM promotion_plans WHERE id = $1",
        [promotion_id]
      );
      durationDays = planRes.rows[0]?.duration_days || 0;
    }

    const expiresAt =
      durationDays > 0
        ? `NOW() + (${durationDays} || 'days')::INTERVAL`
        : "NULL";

    const result = await client.query(
      `UPDATE products 
       SET 
         status = 'active',
         is_active = true,
         promotion_id = $1,
         promotion_priority = COALESCE(promotion_priority, 0) + 1,
         promotion_expires_at = ${expiresAt},
         updated_at = NOW()
       WHERE id = $2 
         AND status = 'draft'
         AND (
           $1 IS NULL OR EXISTS (
             SELECT 1 FROM payment_logs 
             WHERE product_id = $2 AND status = 'success'
           )
         )
       RETURNING id, title, status, is_active, promotion_id, promotion_expires_at`,
      [promotion_id || null, id]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Draft product not found, already published, or payment required",
      });
    }

    await client.query("COMMIT");

    console.log(`✅ Activated: ${id} (promo: ${promotion_id || "free"}, expires: ${durationDays}d)`);

    res.json({
      success: true,
      message: "Product published successfully",
      product_id: result.rows[0].id,
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
GET CATEGORIES (FLAT VERSION)
========================================================= */
router.get("/categories", async (req, res, next) => {
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

      const dynamicOptions = {
        fields: rawFields,
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
      };

      categoryMap[cat.id] = {
        ...cat,
        dynamicOptions,
        subcategories: [],
      };

      if (!cat.parent_id) {
        tree.push(categoryMap[cat.id]);
      }
    });

    categoryRows.forEach((cat) => {
      if (cat.parent_id && categoryMap[cat.parent_id]) {
        categoryMap[cat.parent_id].subcategories.push(categoryMap[cat.id]);
      }
    });

    // ✅ FLAT CATEGORIES FOR FRONTEND
    const flat = flattenCategories(tree);
    res.json(flat);
  } catch (err) {
    console.error("GET /categories error:", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

/* =========================================================
CLOUDINARY SIGNATURE
========================================================= */
router.get("/cloudinary-signature", (req, res, next) => {
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

/* =========================================================
GLOBAL ERROR HANDLER
========================================================= */
router.use((err, req, res, next) => {
  console.error("Marketplace error:", err);
  res.status(500).json({
    error: "Internal server error",
    trending: [],
    products: [],
    filters_applied: {},
  });
});

export default router;