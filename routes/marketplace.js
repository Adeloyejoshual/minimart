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
  promotion: promotionPlans.find((x) => x.id === Number(p.promotion_id)) || null,
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
ACTIVATE PRODUCT (FREE PLAN / ADMIN / SELF-ACTIVATE)
========================================================= */
router.post("/products/:id/activate", async (req, res) => {
  const { id } = req.params;
  const { plan_id = 0 } = req.body; // Default free plan

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify product exists and is eligible for activation
    const { rows } = await client.query(
      "SELECT * FROM products WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Product not found" });
    }

    const product = rows[0];
    if (product.is_active || product.state === "active") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Product already active" });
    }

    // Get promotion plan details
    const plan = promotionPlans.find((p) => p.id === Number(plan_id)) || promotionPlans[0];
    const expiresAt = calculateExpiry(plan.durationDays);

    // Create payment record (even for free)
    const reference = `FREE_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await client.query(
      `INSERT INTO payments (
        reference, amount, method, status, product_id, plan_id, type, 
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`,
      [reference, 0, "free", "success", id, plan.id, "promotion"]
    );

    // Activate product with promotion
    await client.query(
      `UPDATE products SET
        state = 'active',
        is_active = true,
        is_promoted = $2 > 0,
        promotion_id = $2,
        promotion_priority = COALESCE(
          (SELECT priority FROM promotion_plans WHERE id = $2), 
          1
        ),
        promotion_start = now(),
        promotion_expires_at = $3,
        updated_at = now()
       WHERE id = $1`,
      [id, plan.id, expiresAt]
    );

    await client.query("COMMIT");

    res.json({ 
      success: true, 
      message: `Product activated with ${plan.name} plan`,
      reference,
      plan 
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Activate product error:", err);
    res.status(500).json({ message: "Failed to activate product" });
  } finally {
    client.release();
  }
});

/* =========================================================
GET PRODUCTS (FEED + TRENDING)
========================================================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20, category, state, promoted } = req.query;

    const offset = Math.max(+skip || 0, 0);
    const take = Math.min(+limit || 20, 50);

    let whereClause = "WHERE p.is_active = true AND p.state = 'active'";
    const params = [];

    if (category) {
      whereClause += " AND (p.category_id = $1 OR p.subcategory_id = $1)";
      params.push(category);
    }
    if (state) {
      whereClause += " AND p.location_state = $"+(params.length+1);
      params.push(state);
    }
    if (promoted === "true") {
      whereClause += " AND p.is_promoted = true";
    }

    const baseQuery = `
      SELECT p.*,
             COALESCE(
               json_agg(pi.image_url ORDER BY pi.position_order) FILTER (WHERE pi.image_url IS NOT NULL),
               '[]'::json
             ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      ${whereClause}
      GROUP BY p.id
    `;

    const [trendingRes, productsRes] = await Promise.all([
      pool.query(`${baseQuery} ORDER BY p.views DESC NULLS LAST LIMIT 6`),
      pool.query(
        `${baseQuery}
         ORDER BY
           p.is_promoted DESC NULLS LAST,
           p.promotion_priority DESC NULLS LAST,
           p.promotion_expires_at ASC NULLS LAST,
           p.created_at DESC
         OFFSET $${params.length + 1} LIMIT $${params.length + 2}`,
        [...params, offset, take]
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
      total: feedProducts.length + trending.length,
    });
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/* =========================================================
GET SINGLE PRODUCT (+ increment views)
========================================================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT p.*,
             COALESCE(
               json_agg(pi.image_url ORDER BY pi.position_order) FILTER (WHERE pi.image_url IS NOT NULL),
               '[]'::json
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

    const product = normalizeProduct(rows[0]);

    // Increment views (fire-and-forget)
    pool.query(
      "UPDATE products SET views = COALESCE(views, 0) + 1, updated_at = now() WHERE id = $1",
      [id]
    ).catch((err) => console.error("View increment error:", err));

    res.json(product);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
CREATE PRODUCT (DRAFT → READY FOR ACTIVATION)
========================================================= */
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
      attributes,
      delivery,
      contact,
      location_state,
      location_city,
      user_id,
      promotion_id = 0 // Free by default
    } = req.body;

    if (!title?.trim() || !price || !category_id) {
      return res.status(400).json({ message: "Title, price, and category required" });
    }

    const parsedAttributes = safeJSON(attributes);
    const parsedDelivery = normalizeDelivery(safeJSON(delivery));
    const parsedContact = safeJSON(contact);

    // Create draft product
    const { rows } = await client.query(
      `
      INSERT INTO products (
        title, description, price, category_id, subcategory_id,
        attributes, delivery, contact, user_id,
        location_state, location_city,
        state, is_active,
        promotion_id, is_promoted, promotion_priority,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 
              'draft', false, $12, false, 1, now(), now())
      RETURNING *
      `,
      [
        title.trim(),
        description,
        parseFloat(price),
        category_id,
        subcategory_id || null,
        parsedAttributes,
        parsedDelivery,
        parsedContact,
        user_id || null,
        location_state || null,
        location_city || null,
        Number(promotion_id),
      ]
    );

    const product = rows[0];

    // Upload and save images
    if (req.files?.length) {
      const images = await uploadImages(req.files);
      for (const [index, img] of images.entries()) {
        await client.query(
          `INSERT INTO product_images (product_id, image_url, position_order, "position")
           VALUES ($1, $2, $3, $3)`,
          [product.id, img.url, index]
        );
      }
    }

    await client.query("COMMIT");

    res.status(201).json({ 
      success: true,
      product: normalizeProduct(product),
      nextStep: "Activate with POST /products/:id/activate?plan_id=X"
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /products error:", err);
    res.status(500).json({ message: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* =========================================================
GET PROMOTION PLANS (for frontend selection)
========================================================= */
router.get("/promotion-plans", (req, res) => {
  res.json({
    success: true,
    plans: promotionPlans.filter(p => p.is_active),
    freePlan: promotionPlans.find(p => p.price === 0),
  });
});

/* =========================================================
GET CATEGORIES (with dynamic field options)
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
      const key = cat.fields_key || "general";

      map[cat.id] = {
        ...cat,
        dynamicOptions: {
          fields: categoryFields[key] || [],
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
          location: Object.keys(locationsByState),
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

/* =========================================================
HEALTH CHECK
========================================================= */
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const calculateExpiry = (days = 30) => {
  if (!days || days <= 0) return null;
  return `now() + INTERVAL '${days} days'`;
};

export default router;