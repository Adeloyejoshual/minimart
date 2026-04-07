import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// Configs
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
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const safeArray = (arr) => Array.isArray(arr) ? arr : [];

const normalizeDelivery = (d = {}) => ({
  available: d?.available ?? false,
  duration: {
    from: Number(d?.duration?.from ?? 0),
    to: Number(d?.duration?.to ?? 0),
  },
  fee: d?.fee ?? null,
  note: d?.note || "",
});

const safeProduct = (p) => ({
  id: p.id || "",
  title: p.title || "Untitled",
  description: p.description || "",
  price: p.price != null ? parseFloat(p.price) : 0,
  category_id: p.category_id || null,
  subcategory_id: p.subcategory_id || null,
  attributes: safeJSON(p.attributes, {}),
  delivery: normalizeDelivery(safeJSON(p.delivery)),
  contact: safeJSON(p.contact, {}),
  location_state: p.location_state || null,
  location_city: p.location_city || null,
  state: p.location_state,
  city: p.location_city,
  images: safeArray(p.images),
  status: p.status || "draft",
  is_active: p.is_active ?? false,
  promotion_id: p.promotion_id || null,
  promotion_expires_at: p.promotion_expires_at || null,
  promotion_priority: p.promotion_priority || 0,
  views: p.views || 0,
});

/* ================= FIXED: Return TREE structure (frontend expects this) ================= */
const buildCategoryTree = (categoryRows = []) => {
  const categoryMap = {};
  
  // 🚨 CRITICAL: Normalize fields_key safely
  for (const cat of categoryRows) {
    const fieldsKey = (cat.fields_key || "").trim().toLowerCase() || "default";
    const rawFields = categoryFields[fieldsKey] || categoryFields.default || [];

    const dynamicOptions = {
      fields: rawFields, // ✅ Frontend expects array here
      brands: safeArray(brands[fieldsKey]),
      models: models[fieldsKey] || {},
      colors: safeArray(colors[fieldsKey] || colors.default),
      conditions,
      usedDetails,
      ram: safeArray(ramOptions),
      storage: safeArray(storageOptions),
      sim: safeArray(sims),
      features: safeArray(featuresByCategory[fieldsKey]),
      years: safeArray(years),
      engines: safeArray(engines),
      fuel_types: safeArray(fuelTypes),
      size: safeArray(categoryFields[fieldsKey]?.size), // Dynamic
      age_range: safeArray(categoryFields[fieldsKey]?.age_range),
      states: Object.keys(locationsByState),
    };

    const category = {
      id: String(cat.id),
      name: cat.name,
      parent_id: cat.parent_id || null,
      fields_key: cat.fields_key,
      dynamicOptions, // ✅ Full options populated
      subcategories: [],
    };

    categoryMap[cat.id] = category;
  }

  // Build tree
  const tree = [];
  for (const cat of Object.values(categoryMap)) {
    if (cat.parent_id && categoryMap[cat.parent_id]) {
      categoryMap[cat.parent_id].subcategories.push(cat);
    } else {
      tree.push(cat);
    }
  }

  console.log(`✅ Built category tree: ${tree.length} roots, ${Object.keys(categoryMap).length} total`);
  return tree;
};

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
GET PRODUCTS
========================================================= */
router.get("/products", async (req, res) => {
  try {
    const { skip = 0, limit = 20, state, category_id } = req.query;
    const offset = Math.max(Math.floor(+skip || 0), 0);
    const take = Math.max(Math.floor(+limit || 20), 1);

    const whereClauses = ["p.is_active = true", "p.status = 'active'", "(p.promotion_expires_at IS NULL OR p.promotion_expires_at > NOW())"];
    const params = [];
    let paramIndex = 1;

    if (state) {
      whereClauses.push(`p.location_state = $${paramIndex}`);
      params.push(state.trim());
      paramIndex++;
    }

    if (category_id) {
      whereClauses.push(`p.category_id = $${paramIndex}::UUID`);
      params.push(category_id);
      paramIndex++;
    }

    const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const baseQuery = `
      SELECT p.*, 
        COALESCE(json_agg(pi.image_url ORDER BY pi.position) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images 
      FROM products p 
      LEFT JOIN product_images pi ON p.id = pi.product_id 
      ${whereStr}
      GROUP BY p.id 
    `;

    const [trendingRes, feedRes] = await Promise.all([
      pool.query(`${baseQuery} ORDER BY p.views DESC NULLS LAST LIMIT 6`),
      pool.query(`${baseQuery} ORDER BY (p.promotion_expires_at IS NOT NULL) DESC, p.promotion_priority DESC NULLS LAST, p.created_at DESC OFFSET $${paramIndex} LIMIT $${paramIndex + 1}`, [...params, offset, take]),
    ]);

    const trending = (trendingRes.rows || []).map(safeProduct);
    const trendingIds = new Set(trending.map((p) => p.id));
    const feedProducts = (feedRes.rows || []).map(safeProduct).filter((p) => !trendingIds.has(p.id));

    res.json({
      trending,
      products: [...trending, ...feedProducts],
      filters_applied: { state, category_id },
    });
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ trending: [], products: [], filters_applied: {} });
  }
});

/* =========================================================
GET SINGLE PRODUCT
========================================================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT p.*, COALESCE(json_agg(pi.image_url ORDER BY pi.position) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images 
       FROM products p LEFT JOIN product_images pi ON p.id = pi.product_id 
       WHERE p.id = $1 AND p.is_active = true AND p.status = 'active' 
         AND (p.promotion_expires_at IS NULL OR p.promotion_expires_at > NOW())
       GROUP BY p.id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Product not found", product: null });
    }

    const product = safeProduct(result.rows[0]);
    pool.query("UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1", [id]).catch(console.error);
    res.json(product);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({ message: "Failed to fetch product", product: null });
  }
});

/* =========================================================
PAYMENT VERIFICATION
========================================================= */
router.get("/payment/verify/:reference", async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await pool.query(`SELECT status, product_id FROM payment_logs WHERE reference = $1`, [reference]);
    res.json(result.rowCount ? result.rows[0] : { status: "pending" });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ status: "error" });
  }
});

/* =========================================================
CREATE PRODUCT (FIXED: subcategory_id = null)
========================================================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { title, description, price, category_id, attributes, delivery, contact, promotion_id, location_state, location_city } = req.body;

    if (!title?.trim()) return res.status(400).json({ message: "Title required" });
    if (!price || isNaN(price) || +price <= 0) return res.status(400).json({ message: "Valid price required" });
    if (!category_id) return res.status(400).json({ message: "Category required" });
    if (!req.files?.length) return res.status(400).json({ message: "At least one image required" });

    const parsedAttributes = safeJSON(attributes);
    const parsedDelivery = normalizeDelivery(safeJSON(delivery));
    const parsedContact = safeJSON(contact);

    const { rows } = await client.query(
      `INSERT INTO products (
        title, description, price, category_id, subcategory_id,
        attributes, delivery, contact, promotion_id,
        location_state, location_city, status, whatsapp, whatsapp_link
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12, $13)
       RETURNING id, title, description, price, category_id, subcategory_id, attributes, delivery, 
                 contact, promotion_id, location_state, location_city, created_at, status, is_active`,
      [
        title.trim(), description?.trim() || "", parseFloat(price), category_id, null, // ✅ FIXED: subcategory_id = null
        parsedAttributes, parsedDelivery, parsedContact, promotion_id ? parseInt(promotion_id, 10) : null,
        location_state?.trim() || null, location_city?.trim() || null,
        parsedContact.whatsapp?.trim() || null, parsedContact.whatsapp_link?.trim() || null,
      ]
    );

    const product = rows[0];
    const images = await uploadImages(req.files);
    
    await Promise.all(images.map((img) =>
      client.query("INSERT INTO product_images (product_id, image_url, position) VALUES ($1, $2, $3)", 
        [product.id, img.url, img.position])
    ));

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      product: safeProduct({ ...product, images: images.map(img => img.url) }),
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /products error:", err);
    res.status(err.code === "23503" ? 400 : 500).json({ 
      message: err.code === "23503" ? "Invalid category" : "Failed to create product" 
    });
  } finally {
    client.release();
  }
});

/* =========================================================
ACTIVATE PRODUCT
========================================================= */
router.post("/products/:id/activate", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const { promotion_id } = req.body;
    let durationDays = 0;

    if (promotion_id) {
      const { rows } = await client.query("SELECT duration_days FROM promotion_plans WHERE id = $1", [promotion_id]);
      durationDays = rows[0]?.duration_days || 0;
    }

    const expiresAt = durationDays > 0 ? `NOW() + INTERVAL '${durationDays} days'` : "NULL";

    const { rowCount, rows } = await client.query(
      `UPDATE products SET status = 'active', is_active = true, promotion_id = $1, 
       promotion_priority = COALESCE(promotion_priority, 0) + 1, 
       promotion_expires_at = ${expiresAt}, updated_at = NOW()
       WHERE id = $2 AND status = 'draft'
       RETURNING id, title, status, is_active, promotion_id, promotion_expires_at`,
      [promotion_id || null, id]
    );

    await client.query("COMMIT");

    if (rowCount === 0) {
      return res.status(404).json({ message: "Draft not found or already published" });
    }

    res.json({ success: true, message: "Product published!", product_id: rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Activate error:", err);
    res.status(500).json({ message: "Failed to activate" });
  } finally {
    client.release();
  }
});

/* =========================================================
🚨 FIXED CATEGORIES: Return TREE (frontend compatible)
========================================================= */
router.get("/categories", async (req, res) => {
  try {
    const { rows: categoryRows } = await pool.query(
      `SELECT id, name, parent_id, fields_key FROM categories WHERE active = true ORDER BY name ASC`
    );

    const tree = buildCategoryTree(categoryRows);
    
    // ✅ Frontend gets TREE structure with full dynamicOptions
    res.json(tree);
  } catch (err) {
    console.error("GET /categories error:", err);
    res.status(500).json({ message: "Failed to fetch categories", categories: [] });
  }
});

/* =========================================================
CLOUDINARY SIGNATURE & ERROR HANDLER (unchanged)
========================================================= */
router.get("/cloudinary-signature", (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder: "products" }, process.env.CLOUDINARY_API_SECRET);
    res.json({ timestamp, signature, cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY });
  } catch (err) {
    res.status(500).json({ error: "Signature failed" });
  }
});

router.use((err, req, res, next) => {
  console.error("Marketplace error:", err);
  res.status(500).json({ error: "Internal server error", trending: [], products: [] });
});

export default router;