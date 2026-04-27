// routes/marketplace.js
import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// Config / utils
import { pool } from "../config/db.js";
import { generateUniqueSlug } from "../utils/slug.js";

// Config options
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

// ----------------
// Products list (homepage / feed)
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
         ORDER BY
           p.is_promoted DESC,
           COALESCE(p.promotion_priority, 0) DESC,
           p.created_at DESC
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
    res.status(500).json({
      message: "Failed to fetch products",
      error: err.message,
    });
  }
});

// ----------------
// CATEGORIES (for AddProduct.jsx dropdown)
// ----------------

router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, name, parent_id, fields_key
      FROM categories
      ORDER BY name ASC
      `
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
    res.status(500).json({
      message: "Failed to fetch categories",
      error: err.message,
    });
  }
});

// ----------------
// ADD PRODUCT (core for AddProduct.jsx + seller_id)
// ----------------

router.post(
  "/products",
  authenticate,
  upload.array("images", 10),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const {
        title,
        description,
        price,
        category_id,
        subcategory_id,
        attributes: attributesStr,
        delivery: deliveryStr,
        contact: contactStr,
        location_state,
        location_city,
      } = req.body;

      const attributes = safeJSON(attributesStr);
      const delivery = normalizeDelivery(safeJSON(deliveryStr));
      const contact = safeJSON(contactStr);

      // Validation (so you see real errors instead of only "Failed to create product")
      if (!title?.trim()) {
        return res.status(400).json({ message: "Title is required" });
      }
      if (!price || Number(price) <= 0) {
        return res.status(400).json({ message: "Valid price required" });
      }
      if (!category_id) {
        return res.status(400).json({ message: "Category is required" });
      }
      if (!location_state || !location_city) {
        return res.status(400).json({
          message: "State and city are required",
        });
      }
      if (!contact?.phone?.trim() || !contact?.email?.trim() || !contact?.whatsapp?.trim()) {
        return res.status(400).json({
          message: "Phone, email and WhatsApp are required",
        });
      }

      const sellerId = req.user?.id;
      if (!sellerId) {
        return res.status(401).json({
          message: "Unauthorized: missing seller_id",
        });
      }

      // SEO search text
      const locationCity = location_city || "";
      const searchText = `
        ${title} ${description || ""}
        ${(attributes?.brand || "")} ${(attributes?.model || "")}
        ${locationCity}
      `
        .trim()
        .toLowerCase();

      const slug = await generateUniqueSlug(title);

      const result = await client.query(
        `
        INSERT INTO products (
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
          slug,
          search_text,
          created_at,
          updated_at,
          status,
          is_active
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10,
          $11, $12, $13,
          NOW(), NOW(),
          'active',
          true
        )
        RETURNING *
        `,
        [
          title,
          description || "",
          price,
          category_id,
          subcategory_id || null,
          JSON.stringify(attributes),
          JSON.stringify(delivery),
          JSON.stringify(contact),
          location_state,
          locationCity,
          sellerId,
          slug,
          searchText,
        ]
      );

      const product = result.rows[0];

      // Upload images
      const cloudImages = await uploadImages(req.files || []);
      for (let i = 0; i < cloudImages.length; i++) {
        const { url } = cloudImages[i];
        await client.query(
          `
          INSERT INTO product_images (product_id, image_url, position_order)
          VALUES ($1, $2, $3)
          `,
          [product.id, url, i]
        );
      }

      await client.query("COMMIT");

      res.status(201).json({
        product: normalizeProduct(product),
        success: true,
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("Failed to create product:", err);
      res.status(500).json({
        message: "Failed to create product",
        error: err.message,
        stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
      });
    } finally {
      client.release();
    }
  }
});

// ----------------
// OPTIONAL: Product details by id
// ----------------

router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position) FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1 AND p.is_active = true
      GROUP BY p.id
    `;

    const { rows } = await pool.query(query, [id]);
    if (!rows[0]) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("Failed to fetch product:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// ----------------
// OPTIONAL: User’s own products (list for dashboard)
// ----------------

router.get("/me/products", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position) FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.seller_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC
      `,
      [req.user.id]
    );

    res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("Failed to fetch user products:", err);
    res.status(500).json({ message: "Failed to fetch user products" });
  }
});

export default router;