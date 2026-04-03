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
import { fieldOptions } from "../src/config/fieldOptions.js";
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
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"));
    }
    cb(null, true);
  },
});

/* ================= HELPERS ================= */
const safeJSON = (value, fallback = {}) => {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
};

const parseDurationDays = (duration) => {
  if (!duration || duration === "Always") return null;
  const match = duration.match(/(d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

const normalizeProduct = (p) => ({
  ...p,
  images: p.images || [],
  attributes: safeJSON(p.attributes, {}),
  delivery: safeJSON(p.delivery, {}),
  contact: safeJSON(p.contact, {}),
  location: { state: p.location_state, city: p.location_city },
  promotion: p.is_promoted && p.promotion_id ? {
    id: p.promotion_id,
    priority: p.promotion_priority || 1,
    expires_at: p.promotion_expires_at,
    active: p.promotion_expires_at ? new Date(p.promotion_expires_at) > new Date() : true
  } : null,
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
            transformation: [{ width: 1000, height: 1000, crop: "limit" }, { quality: "auto" }],
          },
          (err, result) => err ? reject(err) : resolve({ url: result.secure_url, position: index })
        );
        stream.end(file.buffer);
      })
    )
  );
};

/* =========================================================
PAYMENT INITIALIZE (PRODUCTION READY)
========================================================= */
router.post("/payment/initialize", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const { email, amount, productId, planId } = req.body;
    const product_id = Number(productId);
    const plan_id = Number(planId);
    const amount_num = Number(amount);

    // Validation
    if (!email?.trim() || !email.includes("@")) return res.status(400).json({ success: false, error: "Valid email required" });
    if (!Number.isFinite(product_id)) return res.status(400).json({ success: false, error: "Valid product ID required" });
    if (!Number.isFinite(amount_num) || amount_num <= 0) return res.status(400).json({ success: false, error: "Valid amount required" });

    // Verify product exists and is draft
    const productCheck = await client.query("SELECT id, state FROM products WHERE id = $1", [product_id]);
    if (!productCheck.rows.length || productCheck.rows[0].state === 'active') {
      return res.status(400).json({ success: false, error: "Product not available for promotion" });
    }

    // Verify plan/price match
    const planCheck = plan_id ? await client.query("SELECT * FROM promotion_plans WHERE id = $1 AND price = $2", [plan_id, amount_num]) : { rows: [] };
    if (plan_id && !planCheck.rows.length) {
      return res.status(400).json({ success: false, error: "Invalid plan or price mismatch" });
    }

    // Create pending payment
    const reference = `MINIMART_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    await client.query(
      "INSERT INTO payments (reference, amount, status, product_id, plan_id, metadata) VALUES ($1,$2,'pending',$3,$4,$5)",
      [reference, amount_num, product_id, plan_id || null, JSON.stringify({ email: email.trim(), productId, planId: plan_id })]
    );

    await client.query("COMMIT");

    // Paystack initialize
    const paystackRes = await axios.post("https://api.paystack.co/transaction/initialize", {
      email: email.trim(),
      amount: Math.round(amount_num * 100),
      reference,
      metadata: { productId: product_id, planId: plan_id },
      callback_url: `${process.env.FRONTEND_URL || ''}/add-product`
    }, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });

    const data = paystackRes.data.data;
    res.json({ success: true, authorization_url: data.authorization_url, reference: data.reference || reference });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Payment init error:", err);
    res.status(500).json({ success: false, error: "Payment initialization failed" });
  } finally {
    client.release();
  }
});

/* =========================================================
PAYMENT VERIFY (FRONTEND CALLBACK)
========================================================= */
router.post("/payment/verify", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const { reference, productId } = req.body;
    if (!reference) return res.status(400).json({ success: false, error: "Reference required" });

    // Verify with Paystack
    const { data } = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });

    if (data.status !== "success") {
      return res.json({ success: false, error: "Payment not successful" });
    }

    const metadata = data.data.metadata || {};
    const verifiedProductId = Number(metadata.productId || productId);
    
    // Idempotency + validation
    const paymentCheck = await client.query("SELECT 1 FROM payments WHERE reference = $1", [reference]);
    if (paymentCheck.rows.length) {
      return res.json({ success: true, message: "Already processed" });
    }

    const productCheck = await client.query("SELECT state FROM products WHERE id = $1", [verifiedProductId]);
    if (!productCheck.rows.length || productCheck.rows[0].state === 'active') {
      return res.json({ success: true, message: "Product already active" });
    }

    // Save payment
    await client.query(
      "INSERT INTO payments (reference, amount, status, product_id) VALUES ($1, $2, 'success', $3)",
      [reference, data.data.amount / 100, verifiedProductId]
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Payment verified (webhook will activate)" });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Payment verify error:", err);
    res.status(500).json({ success: false, error: "Verification failed" });
  } finally {
    client.release();
  }
});

/* =========================================================
PAYSTACK WEBHOOK (SAFETY NET - PUBLIC)
========================================================= */
router.post("/webhooks/paystack", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const hash = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(req.body).digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).send("Unauthorized");
    }

    const event = JSON.parse(req.body.toString());
    if (event.event !== "charge.success") return res.status(200).send("OK");

    const { metadata } = event.data;
    const productId = Number(metadata?.productId);
    const planId = Number(metadata?.planId);

    if (!productId || !planId) return res.status(200).send("OK");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Idempotency check
      const productCheck = await client.query("SELECT state FROM products WHERE id = $1", [productId]);
      if (!productCheck.rows.length || productCheck.rows[0].state === 'active') {
        await client.query("COMMIT");
        return res.status(200).send("Already active");
      }

      const planRes = await client.query("SELECT duration FROM promotion_plans WHERE id = $1", [planId]);
      const plan = planRes.rows[0];
      let expiresAt = null;

      if (plan?.duration) {
        const days = parseDurationDays(plan.duration);
        if (days > 0) expiresAt = `now() + INTERVAL '${days} days'`;
      }

      await client.query(`
        UPDATE products SET
          state = 'active', is_active = true, is_promoted = true,
          promotion_id = $1, promotion_priority = 1,
          promotion_start = now(), promotion_expires_at = ${expiresAt || 'NULL'},
          updated_at = now()
        WHERE id = $2
      `, [planId, productId]);

      await client.query("COMMIT");
      console.log(`✅ Webhook: Product ${productId} promoted`);
    } finally {
      client.release();
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("Error");
  }
});

/* =========================================================
ACTIVATE PRODUCT (FREE PLANS)
========================================================= */
router.post("/products/:id/activate", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const { id } = req.params;
    const result = await client.query(`
      UPDATE products SET
        state = 'active', is_active = true,
        is_promoted = true, promotion_id = 0, promotion_priority = 1,
        updated_at = now()
      WHERE id = $1 AND state = 'draft'
      RETURNING *
    `, [id]);

    await client.query("COMMIT");
    
    if (!result.rows.length) {
      return res.status(400).json({ success: false, error: "Cannot activate" });
    }

    res.json({ success: true, product: normalizeProduct(result.rows[0]) });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Activation error:", err);
    res.status(500).json({ success: false, error: "Activation failed" });
  } finally {
    client.release();
  }
});

/* =========================================================
GET PRODUCTS (CORRECT PROMOTION ORDERING)
========================================================= */
router.get("/products", async (req, res) => {
  try {
    const { skip = 0, limit = 20 } = req.query;
    
    const baseQuery = `
      SELECT p.*, COALESCE(json_agg(pi.image_url ORDER BY pi.position), '[]') AS images
      FROM products p LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true AND p.state = 'active'
      GROUP BY p.id
    `;

    const productsRes = await pool.query(`
      ${baseQuery}
      ORDER BY 
        CASE WHEN p.is_promoted AND (p.promotion_expires_at IS NULL OR p.promotion_expires_at > now()) THEN 0 ELSE 1 END,
        p.promotion_priority DESC NULLS LAST,
        p.created_at DESC
      OFFSET $1 LIMIT $2
    `, [Number(skip), Math.min(Number(limit), 50)]);

    const trendingRes = await pool.query(`${baseQuery} ORDER BY p.views DESC NULLS LAST LIMIT 6`);

    res.json({
      trending: trendingRes.rows.map(normalizeProduct),
      products: productsRes.rows.map(normalizeProduct)
    });
  } catch (err) {
    console.error("Products error:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

/* =========================================================
GET SINGLE PRODUCT
========================================================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`
      SELECT p.*, COALESCE(json_agg(pi.image_url ORDER BY pi.position), '[]') AS images
      FROM products p LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1 AND p.is_active = true AND p.state = 'active'
      GROUP BY p.id
    `, [id]);

    if (!rows.length) return res.status(404).json({ error: "Product not found" });

    pool.query("UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1", [id]).catch(() => {});
    res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("Product error:", err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

/* =========================================================
CREATE PRODUCT
========================================================= */
router.post("/products", upload.array("images", 6), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { title, price, category_id, promotion_plan } = req.body;
    
    if (!title?.trim() || !Number(price) || !category_id || !req.files?.length) {
      return res.status(400).json({ error: "Missing required fields or images" });
    }

    const product_id = await client.query(`
      INSERT INTO products (
        title, description, price, category_id,
        attributes, delivery, contact, location_state, location_city,
        state, is_active, is_promoted, promotion_id,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',false,false,$10,now(),now())
      RETURNING id
    `, [
      title.trim(),
      req.body.description?.trim() || '',
      Number(price),
      category_id,
      safeJSON(req.body.attributes),
      safeJSON(req.body.delivery),
      safeJSON(req.body.contact),
      req.body.location_state,
      req.body.location_city,
      promotion_plan || null
    ]);

    const images = await uploadImages(req.files);
    for (const img of images) {
      await client.query(
        "INSERT INTO product_images (product_id, image_url, position) VALUES ($1,$2,$3)",
        [product_id.rows[0].id, img.url, img.position]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ success: true, product_id: product_id.rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Create error:", err);
    res.status(500).json({ error: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* =========================================================
GET CATEGORIES
========================================================= */
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, parent_id, fields_key FROM categories ORDER BY name");
    
    const map = {}, tree = [];
    rows.forEach(cat => {
      const key = cat.fields_key || "";
      map[cat.id] = {
        ...cat,
        dynamicOptions: {
          fields: categoryFields[key] || [],
          brand: brands[key] || [],
          model: models[key] || {},
          color: colors || [],
          condition: conditions,
          used_detail: usedDetails,
          ram: ramOptions,
          storage: storageOptions,
          sim: sims,
          features: featuresByCategory[key] || [],
          year: years,
          engine: engines,
          fuel_type: fuelTypes,
          ...fieldOptions
        },
        subcategories: []
      };
      if (!cat.parent_id) tree.push(map[cat.id]);
    });

    rows.forEach(cat => {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].subcategories.push(map[cat.id]);
      }
    });

    res.json(tree);
  } catch (err) {
    console.error("Categories error:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default router;