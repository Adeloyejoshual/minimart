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
  attributes: p.attributes || {},
  delivery: normalizeDelivery(p.delivery),
  contact: p.contact || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  promotion: promotionPlans.find((x) => x.id == p.promotion_id) || null,
});

/* =========================================================
CLOUDINARY SIGNATURE (✅ NEW - SECURE DIRECT UPLOADS)
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
GET PRODUCTS
========================================================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;
    skip = Math.max(+skip || 0, 0);
    limit = Math.min(+limit || 20, 50);

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

    const [trendingRes, productsRes] = await Promise.all([
      pool.query(`${baseQuery} ORDER BY p.views DESC NULLS LAST LIMIT 6`),
      pool.query(
        `${baseQuery} ORDER BY p.created_at DESC OFFSET $1 LIMIT $2`,
        [skip, limit]
      ),
    ]);

    const trending = trendingRes.rows.map(normalizeProduct);
    const trendingIds = new Set(trending.map((p) => p.id));

    const products = productsRes.rows
      .map(normalizeProduct)
      .filter((p) => !trendingIds.has(p.id));

    res.json({ trending, products: [...trending, ...products] });
  } catch (err) {
    console.error(err);
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

    if (!rows.length)
      return res.status(404).json({ message: "Product not found" });

    // Fire-and-forget view increment
    pool.query("UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1", [id])
      .catch(() => {});

    res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
CREATE PRODUCT (✅ UPDATED - DIRECT IMAGE URLS)
========================================================= */
router.post("/products", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { 
      title, 
      price, 
      category_id, 
      image_urls = [],  // ✅ [{url: "...", position: 0}, ...]
      ...rest 
    } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!image_urls.length) {
      return res.status(400).json({ message: "At least one image required" });
    }

    const attributes = safeJSON(rest.attributes);
    const rawDelivery = safeJSON(rest.delivery, {});
    const delivery = normalizeDelivery(rawDelivery);

    // Delivery validation
    if (delivery.available) {
      if (delivery.duration.from < 0) {
        return res.status(400).json({ message: "Invalid delivery 'from'" });
      }
      if (delivery.duration.to <= delivery.duration.from) {
        return res.status(400).json({ message: "'To' must be greater than 'From'" });
      }
    }

    const { rows } = await client.query(
      `
      INSERT INTO products (
        title, description, price, category_id, subcategory_id,
        attributes, delivery, contact, promotion_id,
        location_state, location_city, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())
      RETURNING *
      `,
      [
        title,
        rest.description || "",
        price,
        category_id,
        rest.subcategory_id || null,
        attributes,
        delivery,
        safeJSON(rest.contact),
        rest.promotion_id || null,
        rest.location_state,
        rest.location_city,
      ]
    );

    const product = rows[0];

    // Bulk insert pre-uploaded images
    const imageInserts = image_urls.map((img, i) =>
      client.query(
        `INSERT INTO product_images (product_id, image_url, position)
         VALUES ($1, $2, $3)`,
        [product.id, img.url, img.position ?? i]
      )
    );
    await Promise.all(imageInserts);

    await client.query("COMMIT");

    res.status(201).json({
      product: normalizeProduct({ ...product, images: image_urls.map(i => i.url) }),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create product error:", err);
    res.status(500).json({ message: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* =========================================================
GET CATEGORIES (✅ FIXED TREE STRUCTURE)
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
      const rawFields = categoryFields[key] || [];
      const filteredFields = rawFields.filter(
        (f) => f !== "condition" && f !== "used_detail"
      );

      map[cat.id] = {
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
    console.error("Categories error:", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;