import express from "express";
import { Pool } from "pg";
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
const parseJSON = (val, fallback = {}) => {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};

const normalizeDelivery = (d = {}) => ({
  available: !!d.available,
  duration: {
    from: Number(d?.duration?.from || 0),
    to: Number(d?.duration?.to || 0),
  },
  fee: d?.fee ? Number(d.fee) : null,
  type: d?.type || "optional",
  note: d?.note || "",
});

const normalizeProduct = (p) => ({
  ...p,
  price: Number(p.price),
  images: p.images || [],
  attributes: p.attributes || {},
  delivery: normalizeDelivery(p.delivery),
  contact: p.contact || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  promotion:
    promotionPlans.find((x) => String(x.id) === String(p.promotion_id)) || null,
});

/* =========================================================
CLOUDINARY SIGNATURE (LOCKED)
========================================================= */
router.get("/cloudinary-signature", (req, res) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);

    const params = {
      timestamp,
      folder: "products",
    };

    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      ...params,
      signature,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    console.error("Signature error:", err);
    res.status(500).json({ message: "Signature failed" });
  }
});

/* =========================================================
GET PRODUCTS
========================================================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;
    skip = Math.max(Number(skip) || 0, 0);
    limit = Math.min(Number(limit) || 20, 50);

    const query = `
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
      ORDER BY p.created_at DESC
      OFFSET $1 LIMIT $2
    `;

    const { rows } = await pool.query(query, [skip, limit]);

    res.json({
      products: rows.map(normalizeProduct),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fetch failed" });
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
      WHERE p.id = $1
      GROUP BY p.id
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Not found" });
    }

    // async increment
    pool
      .query(
        "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",
        [id]
      )
      .catch((e) => console.error("View update error:", e));

    res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fetch failed" });
  }
});

/* =========================================================
CREATE PRODUCT
========================================================= */
router.post("/products", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      title,
      price,
      category_id,
      image_urls = [],
      ...rest
    } = req.body;

    /* ===== VALIDATION ===== */
    if (!title || title.length < 5)
      return res.status(400).json({ message: "Invalid title" });

    const numericPrice = Number(price);
    if (!numericPrice || numericPrice <= 0)
      return res.status(400).json({ message: "Invalid price" });

    if (!category_id)
      return res.status(400).json({ message: "Category required" });

    if (!Array.isArray(image_urls) || !image_urls.length)
      return res.status(400).json({ message: "Images required" });

    if (!locationsByState[rest.location_state])
      return res.status(400).json({ message: "Invalid state" });

    if (
      !locationsByState[rest.location_state]?.includes(rest.location_city)
    ) {
      return res.status(400).json({ message: "Invalid city" });
    }

    const attributes = parseJSON(rest.attributes);
    const delivery = normalizeDelivery(parseJSON(rest.delivery));
    const contact = parseJSON(rest.contact);

    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      INSERT INTO products (
        title, description, price, category_id,
        attributes, delivery, contact,
        location_state, location_city, promotion_id,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())
      RETURNING *
      `,
      [
        title,
        rest.description || "",
        numericPrice,
        category_id,
        attributes,
        delivery,
        contact,
        rest.location_state,
        rest.location_city,
        rest.promotion_id || null,
      ]
    );

    const product = rows[0];

    /* ===== IMAGES ===== */
    await Promise.all(
      image_urls.map((img, i) =>
        client.query(
          `INSERT INTO product_images (product_id, image_url, position)
           VALUES ($1,$2,$3)`,
          [product.id, img.url, img.position ?? i]
        )
      )
    );

    await client.query("COMMIT");

    res.status(201).json({
      product: normalizeProduct({
        ...product,
        images: image_urls.map((i) => i.url),
      }),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create error:", err);
    res.status(500).json({ message: "Create failed" });
  } finally {
    client.release();
  }
});

/* =========================================================
GET CATEGORIES (FIXED SQL BUG)
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
          fields: (categoryFields[key] || []).filter(
            (f) => f !== "condition" && f !== "used_detail"
          ),
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
    res.status(500).json({ message: "Categories failed" });
  }
});

export default router;