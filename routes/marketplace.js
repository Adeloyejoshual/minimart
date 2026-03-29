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
  fileFilter: (_, file, cb) => {
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

const parseDurationDays = (duration) => {
  const match = String(duration || "").match(/(\d+)/);
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
  attributes: p.attributes || {},
  delivery: normalizeDelivery(p.delivery),
  contact: p.contact || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  promotion:
    promotionPlans.find((x) => x.id == p.promotion_id) || null,
});

/* ================= IMAGE UPLOAD ================= */
const uploadImages = async (files = []) => {
  if (!files.length) return [];

  return Promise.all(
    files.map(
      (file, index) =>
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

/* ================= PAYSTACK VERIFY ================= */
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
      reference: data.reference,
    });
  } catch {
    res.status(500).json({ message: "Verification failed" });
  }
});

/* ================= INIT PAYMENT ================= */
router.post("/payments/initiate", async (req, res) => {
  try {
    const { plan_id, product_id, email } = req.body;

    const plan = getPlan(plan_id);
    if (!plan) return res.status(400).json({ message: "Invalid plan" });

    if (plan.price === 0) {
      await pool.query(
        `UPDATE products
         SET is_promoted=false, promotion_priority=0
         WHERE id=$1`,
        [product_id]
      );

      return res.json({ success: true });
    }

    const reference = `PSK_${Date.now()}`;

    await pool.query(
      `INSERT INTO payments(reference,plan_id,product_id,status)
       VALUES($1,$2,$3,'pending')`,
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
  } catch {
    res.status(500).json({ message: "Payment init failed" });
  }
});

/* ================= PAYSTACK WEBHOOK ================= */
router.post("/webhooks/paystack", async (req, res) => {
  try {
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.sendStatus(401);
    }

    if (req.body.event !== "charge.success")
      return res.sendStatus(200);

    const data = req.body.data;

    const payment = (
      await pool.query(
        "SELECT * FROM payments WHERE reference=$1",
        [data.reference]
      )
    ).rows[0];

    if (!payment) return res.sendStatus(200);

    const plan = getPlan(payment.plan_id);
    if (!plan) return res.sendStatus(200);

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + plan.durationDays);

    await pool.query(
      `UPDATE products
       SET is_promoted=true,
           promotion_type=$1,
           promotion_priority=$2,
           promotion_start=$3,
           promotion_end=$4
       WHERE id=$5`,
      [
        plan.id,
        plan.boostScore,
        start,
        end,
        payment.product_id,
      ]
    );

    await pool.query(
      "UPDATE payments SET status='success' WHERE reference=$1",
      [data.reference]
    );

    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

/* ================= PRODUCTS ================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;

    skip = Math.max(+skip || 0, 0);
    limit = Math.min(+limit || 20, 50);

    const base = `
      SELECT p.*,
      COALESCE(json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id=pi.product_id
      WHERE p.is_active=true
      GROUP BY p.id
    `;

    const { rows } = await pool.query(
      `${base}
       ORDER BY p.is_promoted DESC,
                COALESCE(p.promotion_priority,0) DESC,
                p.created_at DESC
       OFFSET $1 LIMIT $2`,
      [skip, limit]
    );

    res.json(rows.map(normalizeProduct));
  } catch {
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/* ================= CREATE PRODUCT ================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { title, price, category_id } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const attributes = safeJSON(req.body.attributes);
    const delivery = normalizeDelivery(safeJSON(req.body.delivery));

    const { rows } = await client.query(
      `
      INSERT INTO products (
        title,description,price,category_id,
        attributes,delivery,contact,
        location_state,location_city,
        created_at,updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
      RETURNING *
      `,
      [
        title,
        req.body.description || "",
        price,
        category_id,
        attributes,
        delivery,
        safeJSON(req.body.contact),
        req.body.location_state,
        req.body.location_city,
      ]
    );

    const product = rows[0];
    const imgs = await uploadImages(req.files);

    for (const img of imgs) {
      await client.query(
        `INSERT INTO product_images(product_id,image_url,position)
         VALUES($1,$2,$3)`,
        [product.id, img.url, img.position]
      );
    }

    await client.query("COMMIT");

    res.json({ product: normalizeProduct(product) });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Create failed" });
  } finally {
    client.release();
  }
});

/* ================= CATEGORIES (FIXED) ================= */
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id,name,parent_id,fields_key
      FROM categories
      ORDER BY name ASC
    `);

    const map = {};
    const tree = [];

    rows.forEach((cat) => {
      const key = cat.fields_key || cat.name;

      map[cat.id] = {
        ...cat,
        dynamicOptions: {
          /* 🔥 CRITICAL FIX */
          fields: categoryFields[cat.name] || [],

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
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;