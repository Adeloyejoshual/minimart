import express from "express";
import { Pool } from "pg";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import fs from "fs/promises";
import dotenv from "dotenv";

import authenticate from "../middleware/auth.js";

import {
  brands,
  colors,
  categoryFields,
  conditions,
  usedDetails,
  featuresByCategory,
  models,
  ramOptions,
  sims,
  storageOptions,
  years,
  engines,
  fuelTypes,
  locationsByState,
  promotionPlans,
} from "../config/index.js";

dotenv.config();

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 6,
  },
});

const safeJSON = (value, fallback = {}) => {
  try {
    if (value == null || value === "") return fallback;
    if (typeof value === "object") return value;
    return JSON.parse(value);
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
  type: d?.type || "optional",
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
  promotion: promotionPlans.find((x) => x.id === p.promotion_id) || null,
});

const buildSearchText = (title = "", description = "", categoryName = "", attrs = {}) =>
  [
    title,
    description,
    categoryName,
    attrs?.brand,
    attrs?.model,
    attrs?.color,
    attrs?.condition,
    attrs?.used_detail,
    attrs?.ram,
    attrs?.storage,
    attrs?.sim,
    attrs?.year,
    attrs?.engine,
    attrs?.fuel_type,
    Array.isArray(attrs?.features) ? attrs.features.join(" ") : "",
    attrs?.size,
    attrs?.age_range,
    attrs?.bedrooms,
    attrs?.bathrooms,
    attrs?.experience_level,
    attrs?.skills,
  ]
    .filter(Boolean)
    .join(" ");

const uploadOne = async (filePath) => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: "products",
    resource_type: "image",
    transformation: [
      { width: 1200, height: 1200, crop: "limit" },
      { quality: "auto" },
      { fetch_format: "auto" },
    ],
  });

  await fs.unlink(filePath).catch(() => {});
  return { url: result.secure_url, public_id: result.public_id };
};

router.get("/cloudinary-signature", (req, res) => {
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder: "products",
        transformation: [
          { width: 900, height: 900, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      timestamp,
      signature,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    console.error("Signature error:", err);
    res.status(500).json({ error: "Signature generation failed" });
  }
});

router.get("/products", async (req, res) => {
  try {
    const { skip = 0, limit = 20, state, category_id } = req.query;

    const offset = Math.max(+skip || 0, 0);
    const take = Math.min(+limit || 20, 50);

    const whereClauses = ["p.is_active = true", "p.status = 'active'"];
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

    const whereStr = `WHERE ${whereClauses.join(" AND ")}`;

    const baseQuery = `
      SELECT p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      ${whereStr}
      GROUP BY p.id
    `;

    const [trendingRes, feedRes] = await Promise.all([
      pool.query(
        `${baseQuery}
         ORDER BY p.views DESC NULLS LAST, p.promotion_priority DESC
         LIMIT 6`
      ),
      pool.query(
        `${baseQuery}
         ORDER BY p.created_at DESC
         OFFSET $${paramIndex} LIMIT $${paramIndex + 1}`,
        [...params, offset, take]
      ),
    ]);

    const trending = trendingRes.rows.map(normalizeProduct);
    const trendingIds = new Set(trending.map((p) => p.id));

    const feedProducts = feedRes.rows
      .map(normalizeProduct)
      .filter((p) => !trendingIds.has(p.id));

    res.json({
      trending,
      products: [...trending, ...feedProducts],
      filters_applied: { state, category_id },
    });
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `
        SELECT p.*,
          COALESCE(
            json_agg(pi.image_url ORDER BY pi.position)
            FILTER (WHERE pi.image_url IS NOT NULL),
            '[]'
          ) AS images
        FROM products p
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.id = $1 AND p.is_active = true AND p.status = 'active'
        GROUP BY p.id
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    pool
      .query("UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1", [id])
      .catch(console.error);

    res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

router.post("/products", authenticate, upload.array("images", 6), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sellerId = req.user?.id;
    if (!sellerId) {
      return res.status(401).json({ message: "Unauthorized: missing seller_id" });
    }

    const {
      title,
      price,
      category_id,
      attributes = "{}",
      delivery = "{}",
      contact = "{}",
      promotion_id,
      description,
      subcategory_id,
      location_state,
      location_city,
    } = req.body;

    if (!title?.trim()) return res.status(400).json({ message: "Title required" });
    if (!price || isNaN(price) || +price <= 0) {
      return res.status(400).json({ message: "Valid price required" });
    }
    if (!category_id) return res.status(400).json({ message: "Category required" });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "At least one image required" });
    }

    const parsedAttributes = safeJSON(attributes, {});
    const parsedDelivery = normalizeDelivery(safeJSON(delivery, {}));
    const parsedContact = safeJSON(contact, {});

    if (
      parsedDelivery.available &&
      parsedDelivery.duration.from >= parsedDelivery.duration.to
    ) {
      return res.status(400).json({
        message: "'To' days must be greater than 'From' days",
      });
    }

    const categoryRes = await client.query(
      "SELECT name FROM categories WHERE id = $1",
      [category_id]
    );
    const categoryName = categoryRes.rows[0]?.name || "";

    const searchText = buildSearchText(
      title.trim(),
      description?.trim() || "",
      categoryName,
      parsedAttributes
    );

    const productRes = await client.query(
      `
        INSERT INTO products (
          title, description, price, category_id, subcategory_id,
          seller_id, attributes, delivery, contact, promotion_id,
          location_state, location_city, search_text, status, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft', true)
        RETURNING
          id, title, description, price, category_id, subcategory_id,
          attributes, delivery, contact, promotion_id,
          location_state, location_city, created_at, views,
          is_active, status
      `,
      [
        title.trim(),
        description?.trim() || "",
        parseFloat(price),
        category_id,
        subcategory_id || null,
        sellerId,
        parsedAttributes,
        parsedDelivery,
        parsedContact,
        promotion_id ? parseInt(promotion_id, 10) : null,
        location_state?.trim() || null,
        location_city?.trim() || null,
        searchText,
      ]
    );

    const product = productRes.rows[0];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const uploaded = await uploadOne(file.path);
      await client.query(
        `
          INSERT INTO product_images (product_id, image_url, position)
          VALUES ($1, $2, $3)
        `,
        [product.id, uploaded.url, i]
      );
    }

    await client.query("COMMIT");

    const fullRows = await pool.query(
      `
        SELECT p.*,
          COALESCE(
            json_agg(pi.image_url ORDER BY pi.position)
            FILTER (WHERE pi.image_url IS NOT NULL),
            '[]'
          ) AS images
        FROM products p
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.id = $1
        GROUP BY p.id
      `,
      [product.id]
    );

    res.status(201).json({
      success: true,
      product: normalizeProduct(fullRows.rows[0]),
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /products error:", err);

    if (err.code === "23503") {
      return res.status(400).json({ message: "Invalid category or promotion" });
    }
    if (err.code === "23502") {
      return res.status(400).json({ message: "Missing required fields" });
    }

    res.status(500).json({ message: "Failed to create product" });
  } finally {
    client.release();
  }
});

router.get("/categories", async (req, res) => {
  try {
    const { rows: categoryRows } = await pool.query(`
      SELECT id, name, parent_id, fields_key
      FROM categories
      WHERE active = true
      ORDER BY name ASC
    `);

    const categoryMap = {};
    const tree = [];

    categoryRows.forEach((cat) => {
      const key = cat.fields_key || "default";
      const rawFields = categoryFields[key] || [];

      categoryMap[cat.id] = {
        ...cat,
        dynamicOptions: {
          fields: rawFields,
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
          states: Object.keys(locationsByState),
        },
        subcategories: [],
      };

      if (!cat.parent_id) tree.push(categoryMap[cat.id]);
    });

    categoryRows.forEach((cat) => {
      if (cat.parent_id && categoryMap[cat.parent_id]) {
        categoryMap[cat.parent_id].subcategories.push(categoryMap[cat.id]);
      }
    });

    res.json(tree);
  } catch (err) {
    console.error("GET /categories error:", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;