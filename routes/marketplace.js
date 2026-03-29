import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import axios from "axios";
import crypto from "crypto";

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
PAYSTACK VERIFY (OPTIONAL UTILITY ENDPOINT)
========================================================= */
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
      return res.status(400).json({
        success: false,
        message: "Payment not successful",
      });
    }

    res.json({
      success: true,
      amount: data.amount,
      customer: data.customer,
      reference: data.reference,
    });
  } catch (err) {
    res.status(500).json({ message: "Verification failed" });
  }
});

/* =========================================================
INITIATE PAYMENT (NEW)
========================================================= */
router.post("/payments/initiate", async (req, res) => {
  try {
    const { plan_id, product_id, email } = req.body;

    const plan = promotionPlans.find((p) => p.id === plan_id);
    if (!plan) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    const reference = `PSK_${Date.now()}`;

    await pool.query(
      `INSERT INTO payments (reference, plan_id, product_id, status)
       VALUES ($1,$2,$3,'pending')`,
      [reference, plan_id, product_id]
    );

    const paystack = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: plan.price * 100,
        reference,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    res.json(paystack.data);
  } catch (err) {
    res.status(500).json({ message: "Payment init failed" });
  }
});

/* =========================================================
PAYSTACK WEBHOOK (SOURCE OF TRUTH)
========================================================= */
router.post("/webhooks/paystack", async (req, res) => {
  try {
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.sendStatus(401);
    }

    const event = req.body;

    if (event.event !== "charge.success") {
      return res.sendStatus(200);
    }

    const data = event.data;

    const paymentRes = await pool.query(
      "SELECT * FROM payments WHERE reference=$1",
      [data.reference]
    );

    const payment = paymentRes.rows[0];
    if (!payment) return res.sendStatus(200);

    const plan = promotionPlans.find((p) => p.id === payment.plan_id);
    if (!plan) return res.sendStatus(200);

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + plan.durationDays);

    await pool.query(
      `
      UPDATE products
      SET
        is_promoted = true,
        promotion_type = $1,
        promotion_priority = $2,
        promotion_start = $3,
        promotion_end = $4
      WHERE id = $5
      `,
      [plan.id, plan.boostScore, start, end, payment.product_id]
    );

    await pool.query(
      "UPDATE payments SET status='success' WHERE reference=$1",
      [data.reference]
    );

    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(500);
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
      COALESCE(json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
    `;

    const [trendingRes, productsRes] = await Promise.all([
      pool.query(`${baseQuery} ORDER BY p.views DESC NULLS LAST LIMIT 6`),
      pool.query(
        `${baseQuery}
         ORDER BY p.is_promoted DESC NULLS LAST,
                  p.promotion_priority DESC NULLS LAST,
                  p.created_at DESC
         OFFSET $1 LIMIT $2`,
        [skip, limit]
      ),
    ]);

    const trending = trendingRes.rows.map(normalizeProduct);
    const trendingIds = new Set(trending.map((p) => p.id));

    const products = productsRes.rows
      .map(normalizeProduct)
      .filter((p) => !trendingIds.has(p.id));

    res.json({ trending, products: [...trending, ...products] });
  } catch {
    res.status(500).json({ message: "Failed to fetch products" });
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
      COALESCE(json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    pool.query(
      "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",
      [id]
    ).catch(() => {});

    res.json(normalizeProduct(rows[0]));
  } catch {
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
CREATE PRODUCT (CLEAN - NO PAYMENT LOGIC)
========================================================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { title, price, category_id } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const attributes = safeJSON(req.body.attributes);
    const delivery = normalizeDelivery(safeJSON(req.body.delivery, {}));

    const { rows } = await client.query(
      `
      INSERT INTO products (
        title, description, price, category_id, subcategory_id,
        attributes, delivery, contact,
        promotion_id,
        promotion_start,
        promotion_end,
        is_promoted,
        promotion_type,
        promotion_priority,
        location_state, location_city,
        created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        NULL,NULL,NULL,false,NULL,0,
        $9,$10,now(),now()
      )
      RETURNING *
      `,
      [
        title,
        req.body.description || "",
        price,
        category_id,
        req.body.subcategory_id || null,
        attributes,
        delivery,
        safeJSON(req.body.contact),
        req.body.location_state,
        req.body.location_city,
      ]
    );

    const product = rows[0];

    const images = await uploadImages(req.files);

    for (const img of images) {
      await client.query(
        `INSERT INTO product_images (product_id, image_url, position)
         VALUES ($1,$2,$3)`,
        [product.id, img.url, img.position]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({ product: normalizeProduct(product) });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* =========================================================
GET CATEGORIES
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
  } catch {
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;