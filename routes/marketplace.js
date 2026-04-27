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

import { pool } from "../server.js";
import { authenticate } from "../middleware/auth.js";

dotenv.config();

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

// utils
const safeJSON = (value, fallback = {}) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (err) {
    console.warn("JSON parse failed:", err);
    return fallback;
  }
};

const parseDurationDays = (duration) => {
  if (!duration) return 0;
  const match = String(duration).match(/(d+)d?/);
  return match ? parseInt(match[1], 10) : 0;
};

const getPlan = (id) => {
  const plan = promotionPlans.find((p) => p.id == id);
  if (!plan) return null;
  return {
    ...plan,
    durationDays: parseDurationDays(plan.duration),
    boostScore: plan.priority ?? 0,
  };
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
  ...p,
  images: p.images || [],
  attributes: safeJSON(p.attributes) || {},
  delivery: normalizeDelivery(safeJSON(p.delivery)),
  contact: safeJSON(p.contact) || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  promotion: promotionPlans.find((x) => x.id == p.promotion_id) || null,
});

const uploadImages = async (files) => {
  if (!files?.length) return [];
  return Promise.all(
    files.map((file) =>
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
            resolve({ url: result.secure_url });
          }
        );
        stream.end(file.buffer);
      })
    )
  );
};

const generateUniqueSlug = async (client, title) => {
  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9s-]/g, "")
    .replace(/s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);

  let slug = baseSlug;
  let counter = 1;

  const { rowCount } = await client.query(
    "SELECT 1 FROM products WHERE slug = $1",
    [slug]
  );
  while (rowCount > 0) {
    slug = `${baseSlug}-${counter++}`;
    const { rowCount } = await client.query(
      "SELECT 1 FROM products WHERE slug = $1",
      [slug]
    );
    if (rowCount === 0) break;
  }

  return slug;
};

// ----------------
// Paystack / payments
// ----------------

router.get("/payment/verify/:reference", async (req, res) => {
  try {
    const { reference } = req.params;
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = response.data.data;
    if (data.status !== "success") {
      return res.status(400).json({ success: false });
    }

    res.json({
      success: true,
      amount: data.amount,
      customer: data.customer,
      reference: data.reference,
    });
  } catch (err) {
    console.error("Paystack verify failed:", err);
    res.status(500).json({ message: "Verification failed" });
  }
});

router.post("/payments/initiate", authenticate, async (req, res) => {
  try {
    const { plan_id, product_id, email } = req.body;
    const plan = getPlan(plan_id);
    if (!plan) return res.status(400).json({ message: "Invalid plan" });

    if (plan.price === 0) {
      await pool.query(
        `UPDATE products
         SET is_promoted = false,
             promotion_priority = 0,
             promotion_type = NULL,
             promotion_start = NULL,
             promotion_end = NULL
         WHERE id = $1`,
        [product_id]
      );
      return res.json({ success: true, message: "Free plan applied" });
    }

    const reference = `PSK_${Date.now()}`;
    await pool.query(
      `INSERT INTO payments (reference, plan_id, product_id, status)
       VALUES ($1, $2, $3, 'pending')`,
      [reference, plan_id, product_id]
    );

    const paystack = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      { email, amount: plan.price * 100, reference },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    res.json(paystack.data);
  } catch (err) {
    console.error("Payment init failed:", err);
    res.status(500).json({ message: "Payment init failed" });
  }
});

router.post("/webhooks/paystack", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(req.body)
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.sendStatus(401);
    }

    const event = JSON.parse(req.body);
    if (event.event !== "charge.success") return res.sendStatus(200);

    const data = event.data;
    const paymentRes = await pool.query(
      "SELECT * FROM payments WHERE reference = $1",
      [data.reference]
    );
    const payment = paymentRes.rows[0];
    if (!payment) return res.sendStatus(200);

    const plan = getPlan(payment.plan_id);
    if (!plan) return res.sendStatus(200);

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + plan.durationDays);

    await pool.query(
      `UPDATE products
       SET is_promoted = true,
           promotion_type = $1,
           promotion_priority = $2,
           promotion_start = $3,
           promotion_end = $4,
           promotion_expires_at = $4
       WHERE id = $5`,
      [plan.id, plan.boostScore, start, end, payment.product_id]
    );

    await pool.query("UPDATE payments SET status = 'success' WHERE reference = $1", [data.reference]);
    res.sendStatus(200);
  } catch (err) {
    console.error("Paystack webhook failed:", err);
    res.sendStatus(500);
  }
});

// ----------------
// Products list (just for homepage / feed)
// ----------------

router.get("/products", async (req, res) => {
  try {
    const { skip = 0, limit = 20 } = req.query;
    const offset = Math.max(+skip || 0, 0);
    const take = Math.min(+limit || 20, 50);

    const baseQuery = `
      SELECT
        p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position) FILTER (WHERE pi.image_url IS NOT NULL),
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
        `${baseQuery}
         ORDER BY p.is_promoted DESC, COALESCE(p.promotion_priority, 0) DESC, p.created_at DESC
         OFFSET $1 LIMIT $2`,
        [offset, take]
      ),
    ]);

    const trending = trendingRes.rows.map(normalizeProduct);
    const trendingIds = new Set(trending.map((p) => p.id));
    const products = productsRes.rows
      .map(normalizeProduct)
      .filter((p) => !trendingIds.has(p.id));

    res.json({ trending, products: [...trending, ...products] });
  } catch (err) {
    console.error("Failed to fetch products:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// ----------------
// CATEGORIES (for AddProduct.jsx dropdown)
// ----------------

router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, parent_id, fields_key
       FROM categories
       ORDER BY name ASC`
    );

    const map = {};
    const tree = [];

    rows.forEach((cat) => {
      const key = cat.fields_key || "";
      map[cat.id] = {
        ...cat,
        dynamicOptions: {
          fields: categoryFields[key] || [],
          brands: brands[key] || [],
          models: models[key] || {},
          colors: colors[key] || [],
          conditions,
          usedDetails,
          ram: ramOptions,
          storage: storageOptions,
          sim: sims,
          features: featuresByCategory[key] || [],
          years,
          engines,
          fuel_types: fuelTypes,
          location: Object.keys(locationsByState),
          size: fieldOptions.size,
          age_range: fieldOptions.age_range,
          bedrooms: fieldOptions.bedrooms,
          bathrooms: fieldOptions.bathrooms,
          experience_level: fieldOptions.experience_level,
          skills: fieldOptions.skills,
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
    console.error("Failed to fetch categories:", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

// ----------------
// ADD PRODUCT (core for AddProduct.jsx)
// ----------------

router.post(
  "/products",
  authenticate,
  upload.array("images", 10),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { title, price, category_id } = req.body;
      if (!title || !price || !category_id) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const attributes = safeJSON(req.body.attributes);
      const delivery = normalizeDelivery(safeJSON(req.body.delivery, {}));
      const contact = safeJSON(req.body.contact);

      const sellerId = req.user?.id;
      if (!sellerId) {
        return res.status(401).json({ message: "Unauthorized: missing seller_id" });
      }

      const { rows } = await client.query(
        `INSERT INTO products (
          title,
          description,
          price,
          category_id,
          subcategory_id,
          attributes,
          delivery,
          contact,
          location_state,
          location_city,
          seller_id,
          created_at,
          updated_at,
          status,
          is_active
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10,
          $11,
          NOW(), NOW(),
          'active',
          true
        )
        RETURNING *`,
        [
          title,
          req.body.description || "",
          price,
          category_id,
          req.body.subcategory_id || null,
          JSON.stringify(attributes),
          JSON.stringify(delivery),
          JSON.stringify(contact),
          req.body.location_state,
          req.body.location_city,
          sellerId,
        ]
      );

      const product = rows[0];
      const slug = await generateUniqueSlug(client, title);
      await client.query("UPDATE products SET slug = $1 WHERE id = $2", [slug, product.id]);

      const cloudImages = await uploadImages(req.files);
      for (let i = 0; i < cloudImages.length; i++) {
        const { url } = cloudImages[i];
        await client.query(
          `INSERT INTO product_images (product_id, image_url, position_order)
           VALUES ($1, $2, $3)`,
          [product.id, url, i]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ product: normalizeProduct({ ...product, slug }) });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Failed to create product:", err);
      res.status(500).json({ message: "Failed to create product" });
    } finally {
      client.release();
    }
  }
);

export default router;