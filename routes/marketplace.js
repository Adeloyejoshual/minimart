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

// ✅ Must fix this: d+ → d+
const parseDurationDays = (duration) => {
  if (!duration) return 0;
  const match = String(duration).match(/(d+)d?/); // <-- changed here
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

// CATEGORIES
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

// ADD PRODUCT
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
        product: normalizeProduct({ ...product, images: [] }),
        success: true,
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("Failed to create product:", err);
      res.status(500).json({
        message: "Failed to create product",
        error: err.message,
      });
    } finally {
      client.release();
    }
  }
);

export default router;