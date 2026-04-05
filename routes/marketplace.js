import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import axios from "axios";
import crypto from "crypto";

/* ================= CONFIGS ================= */
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

/* ================= DATABASE ================= */
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
      return cb(new Error("Only images allowed"), false);
    }
    cb(null, true);
  },
});

/* ================= UTILITIES ================= */
const safeJSON = (value, fallback = {}) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const parseDurationDays = (duration) => {
  const match = String(duration || "").match(/(d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

// ✅ FIXED: Proper INT8 comparison for promotion_plans.id
const getPlan = (id) => {
  const plan = promotionPlans.find((p) => Number(p.id) === Number(id));
  if (!plan) return null;

  return {
    ...plan,
    durationDays: parseDurationDays(plan.duration),
    boostScore: plan.priority ?? 0,
  };
};

const normalizeDelivery = (rawDelivery = {}) => {
  const delivery = safeJSON(rawDelivery);
  return {
    available: Boolean(delivery.available),
    duration: {
      from: Number(delivery.duration?.from ?? 0),
      to: Number(delivery.duration?.to ?? 0),
    },
    fee: delivery.fee ? Number(delivery.fee) : null,
    note: delivery.note || "",
  };
};

const normalizeProduct = (product) => ({
  id: product.id,
  title: product.title,
  description: product.description || "",
  price: Number(product.price),
  category_id: product.category_id,
  attributes: safeJSON(product.attributes, {}),
  delivery: normalizeDelivery(product.delivery),
  contact: safeJSON(product.contact, {}),
  location: {
    state: product.location_state,
    city: product.location_city,
  },
  images: safeJSON(product.images, []),
  promotion: getPlan(product.promotion_id),
  created_at: product.created_at,
  updated_at: product.updated_at,
  is_active: Boolean(product.is_active),
  status: product.status || "pending",
  views: Number(product.views || 0),
});

/* ================= IMAGE UPLOAD ================= */
const uploadImages = async (files = []) => {
  if (!files.length) return [];

  const uploadPromises = files.map((file, index) =>
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
        (error, result) => {
          if (error) return reject(error);
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
            position_order: index,
          });
        }
      );
      stream.end(file.buffer);
    })
  );

  return Promise.allSettled(uploadPromises).then((results) =>
    results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
  );
};

/* ================= PAYMENT ROUTES ================= */
router.get("/payment/verify/:reference", async (req, res) => {
  try {
    const { reference } = req.params;

    const { data } = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (data.status !== "success") {
      return res.status(400).json({ success: false, message: "Payment not successful" });
    }

    res.json({
      success: true,
      amount: data.data.amount / 100,
      reference: data.data.reference,
    });
  } catch (error) {
    console.error("Payment verification error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
});

router.post("/payment/initialize", async (req, res) => {
  try {
    const { email, amount, planId, productId } = req.body;

    if (!email || !amount || !planId || !productId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const plan = getPlan(planId);
    if (!plan) {
      return res.status(400).json({ success: false, message: "Invalid plan ID" });
    }

    const reference = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await pool.query(
      `INSERT INTO payments (reference, amount, plan_id, product_id, email, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
       ON CONFLICT (reference) DO NOTHING`,
      [reference, amount, planId, productId, email]
    );

    const { data } = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount * 100,
        reference,
        metadata: { product_id: productId, plan_id: planId },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!data.status) {
      return res.status(400).json({ success: false, message: data.message });
    }

    res.json({
      success: true,
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference: data.data.reference,
    });
  } catch (error) {
    console.error("Payment initialization error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Payment initialization failed" });
  }
});

/* ================= WEBHOOK ================= */
router.post("/webhooks/paystack", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.get("x-paystack-signature")) {
      return res.status(401).send("Unauthorized");
    }

    const event = req.body;
    if (event.event !== "charge.success") {
      return res.status(200).send("OK");
    }

    const { reference } = event.data;
    const { rows: payments } = await pool.query(
      "SELECT * FROM payments WHERE reference = $1 FOR UPDATE",
      [reference]
    );

    const payment = payments[0];
    if (!payment || payment.status !== "pending") {
      return res.status(200).send("OK");
    }

    const plan = getPlan(payment.plan_id);
    if (!plan) return res.status(200).send("OK");

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    await pool.query(
      `UPDATE products 
       SET 
         promotion_id = $1,
         promotion_start = $2,
         promotion_end = $3,
         is_promoted = true,
         promotion_priority = $4,
         promotion_type = $5,
         updated_at = NOW(),
         status = 'active'
       WHERE id = $6`,
      [plan.id, startDate, endDate, plan.boostScore || 0, plan.name, payment.product_id]
    );

    await pool.query(
      "UPDATE payments SET status = 'success', completed_at = NOW() WHERE reference = $1",
      [reference]
    );

    res.status(200).send("OK");
  } catch (error) {
    console.error("Paystack webhook error:", error);
    res.status(500).send("Internal Server Error");
  }
});

/* ================= ✅ NEW: ACTIVATE ENDPOINT ================= */
router.post("/products/:id/activate", async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rowCount } = await pool.query(
      `UPDATE products 
       SET status = 'active', 
           is_active = true, 
           updated_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [id]
    );
    
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: "Product not found or already active" });
    }
    
    const { rows } = await pool.query(
      `SELECT 
         p.*,
         COALESCE(
           json_agg(pi.image_url ORDER BY pi.position_order ASC) FILTER (WHERE pi.image_url IS NOT NULL), 
           '[]'::jsonb
         ) as images
       FROM products p
       LEFT JOIN product_images pi ON p.id = pi.product_id
       WHERE p.id = $1 
       GROUP BY p.id`,
      [id]
    );
    
    res.json({ 
      success: true, 
      product: normalizeProduct(rows[0]),
      message: "Product activated successfully"
    });
  } catch (error) {
    console.error("Activate product error:", error);
    res.status(500).json({ success: false, message: "Activation failed" });
  }
});

/* ================= PRODUCTS ================= */
router.get("/products", async (req, res) => {
  try {
    const { 
      skip = 0, 
      limit = 20, 
      category_id, 
      state, 
      city,
      min_price,
      max_price 
    } = req.query;

    const offset = Math.max(parseInt(skip) || 0, 0);
    const take = Math.min(parseInt(limit) || 20, 100);
    const params = [offset, take];

    let whereClause = "WHERE p.is_active = true AND p.status = 'active'";
    let paramIndex = 3;

    if (category_id) {
      whereClause += ` AND p.category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }

    if (state) {
      whereClause += ` AND p.location_state ILIKE $${paramIndex}`;
      params.push(state);
      paramIndex++;
    }

    if (city) {
      whereClause += ` AND p.location_city ILIKE $${paramIndex}`;
      params.push(city);
      paramIndex++;
    }

    if (min_price) {
      whereClause += ` AND p.price >= $${paramIndex}`;
      params.push(parseFloat(min_price));
      paramIndex++;
    }

    if (max_price) {
      whereClause += ` AND p.price <= $${paramIndex}`;
      params.push(parseFloat(max_price));
      paramIndex++;
    }

    const { rows } = await pool.query(
      `SELECT 
         p.*,
         COALESCE(
           json_agg(pi.image_url ORDER BY pi.position_order ASC) FILTER (WHERE pi.image_url IS NOT NULL), 
           '[]'::jsonb
         ) as images
       FROM products p
       LEFT JOIN product_images pi ON p.id = pi.product_id
       ${whereClause}
       GROUP BY p.id
       ORDER BY 
         p.is_promoted DESC NULLS LAST,
         p.promotion_priority DESC NULLS LAST,
         p.created_at DESC
       OFFSET $1 LIMIT $2`,
      params
    );

    const totalQuery = `SELECT COUNT(*)::int FROM products p ${whereClause}`;
    const { rows: [{ count }] } = await pool.query(totalQuery, params.slice(0, -2));

    res.json({
      products: rows.map(normalizeProduct),
      pagination: { skip: offset, limit: take, total: parseInt(count), hasMore: offset + take < parseInt(count) }
    });
  } catch (error) {
    console.error("GET /products error:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await pool.query(
      `SELECT 
         p.*,
         COALESCE(
           json_agg(pi.image_url ORDER BY pi.position_order ASC) FILTER (WHERE pi.image_url IS NOT NULL), 
           '[]'::jsonb
         ) as images
       FROM products p
       LEFT JOIN product_images pi ON p.id = pi.product_id
       WHERE p.id = $1 AND p.is_active = true AND p.status = 'active'
       GROUP BY p.id`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Increment views
    await pool.query(
      "UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1",
      [id]
    );

    res.json(normalizeProduct(rows[0]));
  } catch (error) {
    console.error("GET /products/:id error:", error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* ================= CREATE PRODUCT ================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      title,
      description,
      price,
      category_id,
      attributes,
      delivery,
      contact,
      location_state,
      location_city,
      promotion_id = null,
    } = req.body;

    // Validation
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (!price || isNaN(price) || Number(price) <= 0) {
      return res.status(400).json({ success: false, message: "Valid price required" });
    }
    if (!category_id) {
      return res.status(400).json({ success: false, message: "Category is required" });
    }

    const cleanPrice = Number(price);

    // Create product
    const { rows } = await client.query(
      `INSERT INTO products (
        title, description, price, category_id, attributes, delivery, contact,
        location_state, location_city, promotion_id, status, is_active,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', true, NOW(), NOW())
      RETURNING id, title, price, category_id`,
      [
        title.trim().substring(0, 255),
        description?.trim() || "",
        cleanPrice,
        category_id,
        attributes || "{}",
        delivery || "{}",
        contact || "{}",
        location_state,
        location_city,
        promotion_id ? Number(promotion_id) : null, // ✅ FIXED: Proper INT8 conversion
      ]
    );

    const product = rows[0];

    // Upload images with position_order
    if (req.files?.length) {
      const images = await uploadImages(req.files);
      const imagePromises = images.map((image) =>
        client.query(
          `INSERT INTO product_images (product_id, image_url, position_order)
           VALUES ($1, $2, $3)`,
          [product.id, image.url, image.position_order]
        )
      );
      await Promise.all(imagePromises);
    }

    // Handle free promotion immediately
    if (promotion_id) {
      const plan = getPlan(promotion_id);
      if (plan && Number(plan.price) === 0) {
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + plan.durationDays);

        await client.query(
          `UPDATE products 
           SET 
             promotion_id = $1,
             promotion_start = $2,
             promotion_end = $3,
             is_promoted = true,
             promotion_priority = $4,
             promotion_type = $5,
             status = 'active',
             updated_at = NOW()
           WHERE id = $6`,
          [plan.id, startDate, endDate, plan.boostScore || 0, plan.name, product.id]
        );
      }
    }

    await client.query("COMMIT");

    // Fetch complete product
    const { rows: fullProduct } = await pool.query(
      `SELECT 
         p.*,
         COALESCE(
           json_agg(pi.image_url ORDER BY pi.position_order ASC) FILTER (WHERE pi.image_url IS NOT NULL), 
           '[]'::jsonb
         ) as images
       FROM products p
       LEFT JOIN product_images pi ON p.id = pi.product_id
       WHERE p.id = $1
       GROUP BY p.id`,
      [product.id]
    );

    res.json({ 
      success: true, 
      product: normalizeProduct(fullProduct[0]),
      message: promotion_id && getPlan(promotion_id)?.price === 0 
        ? "Product created and published (free plan)" 
        : "Product created successfully. Complete payment to publish."
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("POST /products error:", error);
    
    if (error.code === '23503') {
      return res.status(400).json({ success: false, message: "Invalid category or promotion" });
    }
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: "Image position conflict" });
    }
    
    res.status(500).json({ success: false, message: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* ================= CATEGORIES ================= */
router.get("/categories", async (req, res) => {
  try {
    const { rows: allCategories } = await pool.query(
      `WITH RECURSIVE category_tree AS (
         SELECT id, name, parent_id, fields_key, 0 as level
         FROM categories 
         WHERE parent_id IS NULL
         UNION ALL
         SELECT c.id, c.name, c.parent_id, c.fields_key, ct.level + 1
         FROM categories c
         JOIN category_tree ct ON c.parent_id = ct.id
         WHERE ct.level < 3
       )
       SELECT * FROM category_tree 
       ORDER BY level, name
      `
    );

    const globalOptions = {
      brands,
      colors,
      conditions,
      usedDetails,
      ram: ramOptions,
      storage: storageOptions,
      sims,
      years,
      engines,
      fuel_types: fuelTypes,
      featuresByCategory,
    };

    const categoryMap = {};
    const rootCategories = [];

    allCategories.forEach((cat) => {
      const categoryKey = cat.fields_key?.toLowerCase() || 
                         cat.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

      categoryMap[cat.id] = {
        id: cat.id,
        name: cat.name,
        parent_id: cat.parent_id,
        dynamicOptions: {
          fields: categoryFields[categoryKey] || fieldOptions[categoryKey] || [],
          brands: brands[categoryKey] || brands.default || [],
          models: models[categoryKey] || models.default || {},
          colors: colors[categoryKey] || colors.default || [],
          conditions,
          usedDetails,
          ram: ramOptions,
          storage: storageOptions,
          sims,
          years,
          engines,
          fuel_types: fuelTypes,
          features: featuresByCategory[categoryKey] || [],
        },
        subcategories: [],
      };

      if (!cat.parent_id) {
        rootCategories.push(categoryMap[cat.id]);
      }
    });

    allCategories.forEach((cat) => {
      if (cat.parent_id && categoryMap[cat.parent_id]) {
        categoryMap[cat.parent_id].subcategories.push(categoryMap[cat.id]);
      }
    });

    res.json({
      tree: rootCategories,
      flat: Object.values(categoryMap),
      total: allCategories.length,
    });
  } catch (error) {
    console.error("GET /categories error:", error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

/* ================= PROMOTION PLANS ================= */
router.get("/promotion-plans", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM promotion_plans WHERE is_active = true ORDER BY sort_order ASC, price ASC"
    );

    res.json({
      plans: rows.map((plan) => ({
        ...plan,
        durationDays: parseDurationDays(plan.duration),
        price: Number(plan.price),
        original_price: Number(plan.original_price),
      })),
    });
  } catch (error) {
    console.error("GET /promotion-plans error:", error);
    res.status(500).json({ message: "Failed to fetch plans" });
  }
});

export default router;