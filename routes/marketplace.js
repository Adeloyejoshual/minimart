import express from "express";
import { Pool } from "pg";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

/* ================= CONFIG IMPORTS ================= */
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
  attributes: safeJSON(p.attributes),
  delivery: normalizeDelivery(safeJSON(p.delivery)),
  contact: safeJSON(p.contact),
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  promotion: promotionPlans.find((x) => x.id == p.promotion_id) || null,
});

/* =========================================================
CLOUDINARY SIGNATURE (SECURE DIRECT UPLOADS)
========================================================= */
router.get("/cloudinary-signature", (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    const signature = cloudinary.v2.utils.api_sign_request(
      { 
        timestamp, 
        folder: "products",
        transformation: [
          { width: 900, height: 900, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" }
        ]
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
GET PRODUCTS (Trending + Latest)
========================================================= */
router.get("/products", async (req, res) => {
  try {
    const { skip = 0, limit = 20, state, category_id } = req.query;
    const offset = Math.max(+skip || 0, 0);
    const take = Math.min(+limit || 20, 50);

    const whereClause = [
      "p.is_active = true",
      "p.status = 'active'"
    ];

    const params = [];
    let paramIndex = 1;

    if (state) {
      whereClause.push(`p.location_state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }

    if (category_id) {
      whereClause.push(`p.category_id = $${paramIndex}::UUID`);
      params.push(category_id);
      paramIndex++;
    }

    const whereStr = whereClause.length ? `WHERE ${whereClause.join(" AND ")}` : "";

    const baseQuery = `
      SELECT p.*, 
      COALESCE(json_agg(pi.image_url ORDER BY pi.position) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      ${whereStr}
      GROUP BY p.id
    `;

    const [trendingRes, productsRes] = await Promise.all([
      pool.query(`${baseQuery} ORDER BY p.views DESC NULLS LAST, p.promotion_priority DESC LIMIT 6`),
      pool.query(`${baseQuery} ORDER BY p.created_at DESC OFFSET $${paramIndex} LIMIT $${paramIndex + 1}`, [...params, offset, take])
    ]);

    const trending = trendingRes.rows.map(normalizeProduct);
    const trendingIds = new Set(trending.map((p) => p.id));
    
    const products = trendingRes.rows
      .map(normalizeProduct)
      .filter((p) => !trendingIds.has(p.id));

    res.json({ 
      trending, 
      products: [...trending, ...products],
      filters_applied: { state, category_id }
    });
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/* =========================================================
GET SINGLE PRODUCT (+ VIEW INCREMENT)
========================================================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT p.*, 
       COALESCE(json_agg(pi.image_url ORDER BY pi.position) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
       FROM products p
       LEFT JOIN product_images pi ON p.id = pi.product_id
       WHERE p.id = $1 AND p.is_active = true AND p.status = 'active'
       GROUP BY p.id`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = rows[0];
    
    // Fire-and-forget view increment
    pool.query(
      "UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1", 
      [id]
    ).catch(console.error);

    res.json(normalizeProduct(product));
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
CREATE PRODUCT (FULL SCHEMA COMPATIBLE)
========================================================= */
router.post("/products", async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    const { 
      title, 
      price, 
      category_id, 
      image_urls = [], 
      ...rest 
    } = req.body;

    // Validation
    if (!title?.trim()) return res.status(400).json({ message: "Title required" });
    if (!price || isNaN(price)) return res.status(400).json({ message: "Valid price required" });
    if (!category_id) return res.status(400).json({ message: "Category required" });
    if (!image_urls?.length) return res.status(400).json({ message: "At least one image required" });

    const attributes = safeJSON(rest.attributes);
    const delivery = normalizeDelivery(safeJSON(rest.delivery));
    const contact = safeJSON(rest.contact);

    // Delivery validation
    if (delivery.available && delivery.duration.from >= delivery.duration.to) {
      return res.status(400).json({ message: "'To' days must be greater than 'From' days" });
    }

    // Insert product (leverages schema defaults)
    const { rows: productRows } = await client.query(
      `INSERT INTO products (
        title, description, price, category_id, subcategory_id,
        attributes, delivery, contact, promotion_id,
        location_state, location_city
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title, description, price, category_id, subcategory_id,
                attributes, delivery, contact, promotion_id, 
                location_state, location_city, created_at, views, 
                is_active, status`,
      [
        title.trim(),
        rest.description?.trim() || "",
        parseFloat(price),
        category_id,
        rest.subcategory_id || null,
        attributes,
        delivery,
        contact,
        rest.promotion_id ? parseInt(rest.promotion_id) : null,
        rest.location_state?.trim() || null,
        rest.location_city?.trim() || null,
      ]
    );

    const product = productRows[0];

    // Bulk insert images
    const imagePromises = image_urls.map((img, index) =>
      client.query(
        `INSERT INTO product_images (product_id, image_url, position)
         VALUES ($1, $2, $3)`,
        [product.id, img.url, img.position ?? index]
      )
    );

    await Promise.all(imagePromises);
    await client.query("COMMIT");

    const fullProduct = await client.query(
      `SELECT p.*, 
       COALESCE(json_agg(pi.image_url ORDER BY pi.position) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
       FROM products p
       LEFT JOIN product_images pi ON p.id = pi.product_id
       WHERE p.id = $1
       GROUP BY p.id`,
      [product.id]
    );

    res.status(201).json({
      success: true,
      product: normalizeProduct(fullProduct.rows[0])
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /products error:", err);
    
    if (err.code === '23503') {
      return res.status(400).json({ message: "Invalid category or promotion" });
    }
    if (err.code === '23502') {
      return res.status(400).json({ message: "Missing required fields" });
    }
    
    res.status(500).json({ message: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* =========================================================
GET CATEGORIES (TREE STRUCTURE + DYNAMIC OPTIONS)
========================================================= */
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, parent_id, fields_key 
       FROM categories 
       WHERE active = true 
       ORDER BY name ASC`
    );

    const categoryMap = {};
    const tree = [];

    // Build category map with dynamic options
    rows.forEach((cat) => {
      const key = cat.fields_key || "default";
      const rawFields = categoryFields[key] || [];
      const filteredFields = rawFields.filter(f => !["condition", "used_detail"].includes(f));

      categoryMap[cat.id] = {
        ...cat,
        dynamicOptions: {
          fields: filteredFields,
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
          states: Object.keys(locationsByState),
        },
        subcategories: [],
      };

      if (!cat.parent_id) {
        tree.push(categoryMap[cat.id]);
      }
    });

    // Link subcategories
    rows.forEach((cat) => {
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

export default router;