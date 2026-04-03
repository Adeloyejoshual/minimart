import express from "express";
import { Pool } from "pg";
import multer from "multer";
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
  type: d?.type || "none",
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
  attributes: safeJSON(p.attributes, {}),
  delivery: normalizeDelivery(safeJSON(p.delivery, {})),
  contact: safeJSON(p.contact, {}),
  location: {
    state: p.location_state,
    city: p.location_city,
  },
});

/* ================= IMAGE UPLOAD ================= */
const uploadImages = async (files = []) => {
  if (!files.length) return [];

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
    let { skip = 0, limit = 20 } = req.query;

    skip = Math.max(+skip || 0, 0);
    limit = Math.min(+limit || 20, 50);

    const baseQuery = `
      SELECT p.*,
      COALESCE(
        json_agg(pi.image_url ORDER BY pi.position),
        '[]'
      ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true AND p.state = 'active'
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

    res.json({ 
      trending, 
      products: [...trending, ...products],
      total: productsRes.rowCount + trending.length 
    });
  } catch (err) {
    console.error(err);
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
      COALESCE(
        json_agg(pi.image_url ORDER BY pi.position),
        '[]'
      ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1 AND p.is_active = true AND p.state = 'active'
      GROUP BY p.id
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Increment views
    pool.query(
      "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",
      [id]
    ).catch(console.error);

    res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
CREATE PRODUCT
========================================================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { 
      title, 
      price, 
      category_id, 
      description, 
      subcategory_id,
      location_state, 
      location_city 
    } = req.body;

    // ✅ VALIDATION
    if (!title?.trim() || !price || !category_id || !location_state?.trim() || !location_city?.trim()) {
      return res.status(400).json({ 
        message: "Missing required: title, price, category_id, location_state, location_city" 
      });
    }

    if (Number(price) <= 0) {
      return res.status(400).json({ message: "Price must be greater than 0" });
    }

    // ✅ CATEGORY EXISTS CHECK
    const catCheck = await client.query(
      "SELECT id FROM categories WHERE id = $1", 
      [category_id]
    );
    if (!catCheck.rows.length) {
      return res.status(400).json({ message: "Invalid category_id" });
    }

    const attributes = safeJSON(req.body.attributes, {});
    const delivery = normalizeDelivery(safeJSON(req.body.delivery, {}));
    const contact = safeJSON(req.body.contact, {});

    const { rows } = await client.query(
      `INSERT INTO products (
        title, description, price, category_id, subcategory_id,
        attributes, delivery, contact,
        location_state, location_city, state,
        created_at, updated_at, is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',now(),now(),true)
      RETURNING *`,
      [
        title.trim(),
        description?.trim() || "",
        Number(price),
        category_id,
        subcategory_id || null,
        JSON.stringify(attributes),
        JSON.stringify(delivery),
        JSON.stringify(contact),
        location_state.trim(),
        location_city.trim(),
      ]
    );

    const product = rows[0];
    const images = await uploadImages(req.files || []);

    // Insert images with position
    for (const [index, img] of images.entries()) {
      await client.query(
        `INSERT INTO product_images (product_id, image_url, position)
         VALUES ($1,$2,$3)`,
        [product.id, img.url, index]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      product: normalizeProduct({ 
        ...product, 
        images 
      }),
    });

  } catch (err) {
    console.error(err);
    await client.query("ROLLBACK");
    res.status(500).json({ 
      message: err.message || "Failed to create product" 
    });
  } finally {
    client.release();
  }
});

/* =========================================================
GET CATEGORIES (PERFECTLY FIXED)
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

    // Build category map with dynamic options
    for (const cat of rows) {
      const key = cat.fields_key || "default";

      map[cat.id] = {
        id: cat.id,
        name: cat.name,
        parent_id: cat.parent_id || null,
        dynamicOptions: {
          brands: brands[key] || brands.default || [],
          models: models[key] || models.default || {},
          colors: colors[key] || colors.default || [],
          conditions: conditions || [],
          usedDetails: usedDetails || [],
          ram: ramOptions || [],
          storage: storageOptions || [],
          sims: sims || [],
          features: featuresByCategory[key] || [],
          years: years || [],
          engines: engines[key] || engines.default || [],
          fuel_types: fuelTypes[key] || fuelTypes.default || [], // ✅ FIXED naming
          fields: categoryFields[key] || [], // ✅ Frontend expects this
        },
        subcategories: [],
      };
    }

    // Build tree structure (adjacency model)
    for (const cat of rows) {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].subcategories.push(map[cat.id]);
      } else {
        tree.push(map[cat.id]);
      }
    }

    res.json(tree);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

/* =========================================================
FREE PLAN ACTIVATION
========================================================= */
router.post("/payments/free-plan/:productId", async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { productId } = req.params;
    
    await client.query("BEGIN");
    
    await client.query(
      `UPDATE products 
       SET state = 'active', 
           is_active = true, 
           is_promoted = false,
           promotion_priority = 0,
           promotion_expires_at = NULL,
           updated_at = now()
       WHERE id = $1 AND state = 'draft'`,
      [productId]
    );
    
    const { rows } = await client.query(
      `SELECT p.*, 
       COALESCE(json_agg(pi.image_url ORDER BY pi.position), '[]') AS images
       FROM products p
       LEFT JOIN product_images pi ON p.id = pi.product_id
       WHERE p.id = $1
       GROUP BY p.id`,
      [productId]
    );
    
    await client.query("COMMIT");
    
    res.json({ 
      success: true, 
      product: normalizeProduct(rows[0]) 
    });
    
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ 
      success: false, 
      error: "Failed to activate free plan" 
    });
  } finally {
    client.release();
  }
});

export default router;