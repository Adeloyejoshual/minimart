import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import axios from "axios";
import crypto from "crypto";

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
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"));
    }
    cb(null, true);
  },
});

/* ================= HELPERS ================= */
const safeJSON = (val, fallback = {}) => {
  try {
    return val ? JSON.parse(val) : fallback;
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
  note: d?.note || "",
});

const normalizeProduct = (p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  description: p.description,
  price: Number(p.price || 0),
  images: p.images || [],
  attributes: safeJSON(p.attributes),
  delivery: normalizeDelivery(safeJSON(p.delivery)),
  contact: safeJSON(p.contact),
  seller_id: p.seller_id,
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  views: Number(p.views || 0),
  is_active: p.is_active,
  is_promoted: p.is_promoted,
  promotion_id: p.promotion_id,
  created_at: p.created_at,
});

/* ================= SLUG ================= */
const slugExists = async (client, slug) => {
  const { rowCount } = await client.query(
    "SELECT 1 FROM products WHERE slug=$1",
    [slug]
  );
  return rowCount > 0;
};

const generateSlug = async (client, title) => {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  let slug = base;
  let i = 1;

  while (await slugExists(client, slug)) {
    slug = `${base}-${i++}`;
  }

  return slug;
};

/* ================= PRODUCT DETAIL ================= */
router.get("/slug/:slug", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        p.*,
        COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.slug = $1
      GROUP BY p.id
      LIMIT 1
      `,
      [req.params.slug]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* ================= CREATE PRODUCT (FIXED WITH SELLER_ID) ================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sellerId = req.user?.id; // 🔥 MUST come from auth middleware

    if (!sellerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { title, price, category_id } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const attributes = safeJSON(req.body.attributes);
    const delivery = normalizeDelivery(safeJSON(req.body.delivery));

    const { rows } = await client.query(
      `
      INSERT INTO products (
        title, description, price, category_id,
        subcategory_id, attributes, delivery, contact,
        location_state, location_city,
        seller_id,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
      RETURNING *
      `,
      [
        title,
        req.body.description || "",
        price,
        category_id,
        req.body.subcategory_id || null,
        JSON.stringify(attributes),
        JSON.stringify(delivery),
        JSON.stringify(safeJSON(req.body.contact)),
        req.body.location_state,
        req.body.location_city,
        sellerId,
      ]
    );

    const product = rows[0];

    const slug = await generateSlug(client, title);
    await client.query("UPDATE products SET slug=$1 WHERE id=$2", [
      slug,
      product.id,
    ]);

    await client.query("COMMIT");

    res.status(201).json({
      product: normalizeProduct({ ...product, slug }),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* ================= PRODUCTS LIST ================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;
    skip = Number(skip);
    limit = Math.min(Number(limit), 50);

    const { rows } = await pool.query(
      `
      SELECT p.*, 
      COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY p.created_at DESC
      OFFSET $1 LIMIT $2
      `,
      [skip, limit]
    );

    res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

export default router;