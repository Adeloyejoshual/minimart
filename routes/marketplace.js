import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

import { categoryFields } from "../src/config/categoryFields.js";
import { promotionPlans } from "../src/config/promotions.js";

dotenv.config();

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// ---------------- CLOUDINARY ----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------------- MULTER ----------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"), false);
    }
    cb(null, true);
  },
});

/* =========================================================
   GET PRODUCTS
========================================================= */
router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*,
      COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL),'[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 50
    `);

    const products = rows.map(p => ({
      ...p,
      images: p.images || [],
      dynamic_fields: p.dynamic_fields || {},
      location: {
        state: p.location_state,
        city: p.location_city,
      },
      promotion: promotionPlans.find(x => x.id == p.promotion_id) || null,
    }));

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/* =========================================================
   POST PRODUCT (FINAL FIXED VERSION)
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

      // NEW FIELDS
      phone,
      negotiation,
      delivery
    } = req.body;

    // ---------------- VALIDATION ----------------
    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) {
      return res.status(400).json({ message: "Invalid price" });
    }

    // ---------------- CATEGORY ----------------
    const { rows: catRows } = await client.query(
      "SELECT fields_key FROM categories WHERE id=$1",
      [category_id]
    );

    if (!catRows.length) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const allowed = categoryFields[catRows[0].fields_key] || [];

    let parsed = {};
    try {
      parsed = typeof dynamicFields === "string"
        ? JSON.parse(dynamicFields)
        : dynamicFields || {};
    } catch {
      return res.status(400).json({ message: "Invalid dynamicFields" });
    }

    const cleaned = Object.fromEntries(
      Object.entries(parsed).filter(([k]) => allowed.includes(k))
    );

    // ---------------- TRANSACTION ----------------
    await client.query("BEGIN");

    // ---------------- INSERT PRODUCT ----------------
    const { rows } = await client.query(`
      INSERT INTO products (
        title,
        description,
        price,
        category_id,
        subcategory_id,
        dynamic_fields,
        promotion_id,
        location_state,
        location_city,
        created_at,
        phone,
        negotiation,
        delivery
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      title,
      description || "",
      priceNum,
      category_id,
      subcategory_id || null,
      JSON.stringify(cleaned),
      promotion_id || null,
      cleaned.location?.state || null,
      cleaned.location?.city || null,
      new Date(),
      phone || null,
      negotiation || null,
      delivery ? JSON.stringify(delivery) : null
    ]);

    const product = rows[0];

    // ---------------- IMAGE UPLOAD ----------------
    if (!req.files || req.files.length === 0) {
      throw new Error("No images uploaded");
    }

    const urls = [];

    for (const file of req.files) {
      const uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "minimart_products" },
          (err, result) => err ? reject(err) : resolve(result)
        );
        stream.end(file.buffer);
      });

      urls.push(uploaded.secure_url);
    }

    // ---------------- SAVE IMAGES ----------------
    for (let i = 0; i < urls.length; i++) {
      await client.query(
        `INSERT INTO product_images (product_id, image_url, position)
         VALUES ($1,$2,$3)`,
        [product.id, urls[i], i]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      ...product,
      images: urls
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("UPLOAD ERROR:", err.message);

    res.status(500).json({
      message: err.message || "Failed to add product"
    });

  } finally {
    client.release();
  }
});

export default router;