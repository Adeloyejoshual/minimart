import express from "express";
import { Pool } from "pg";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

/* CONFIGS */
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
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
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
  promotion: promotionPlans.find(
    (x) => String(x.id) === String(p.promotion_id)
  ) || null,
});

/* ================= VALIDATION ================= */
const validateProduct = (body) => {
  const errors = [];

  if (!body.title || body.title.length < 10)
    errors.push("Title too short");

  if (!body.price || isNaN(Number(body.price)))
    errors.push("Invalid price");

  if (!body.category_id)
    errors.push("Category required");

  if (!body.image_urls || !body.image_urls.length)
    errors.push("At least one image required");

  if (!body.location_state || !locationsByState[body.location_state])
    errors.push("Invalid state");

  if (
    body.location_city &&
    !locationsByState[body.location_state]?.includes(body.location_city)
  )
    errors.push("Invalid city");

  return errors;
};

/* =========================================================
CLOUDINARY SIGNATURE
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
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (err) {
    console.error(err);
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

    res.json(rows.map(normalizeProduct));
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
      [req.params.id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Not found" });

    // async increment
    pool
      .query(
        "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",
        [req.params.id]
      )
      .catch((e) => console.error("View update failed", e));

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
    const errors = validateProduct(req.body);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    await client.query("BEGIN");

    const {
      title,
      description,
      price,
      category_id,
      image_urls,
      location_state,
      location_city,
    } = req.body;

    const attributes = safeJSON(req.body.attributes);
    const delivery = normalizeDelivery(safeJSON(req.body.delivery));
    const contact = safeJSON(req.body.contact);

    const numericPrice = Number(price);

    const { rows } = await client.query(
      `
      INSERT INTO products (
        title, description, price, category_id,
        attributes, delivery, contact,
        location_state, location_city,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
      RETURNING *
      `,
      [
        title,
        description || "",
        numericPrice,
        category_id,
        attributes,
        delivery,
        contact,
        location_state,
        location_city,
      ]
    );

    const product = rows[0];

    // insert images
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

    res.status(201).json(
      normalizeProduct({
        ...product,
        images: image_urls.map((i) => i.url),
      })
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Create failed" });
  } finally {
    client.release();
  }
});

/* =========================================================
GET CATEGORIES (UNCHANGED CORE)
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
      map[cat.id] = {
        ...cat,
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