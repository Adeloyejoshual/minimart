import express from "express";
import { Pool } from "pg";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import fs from "fs/promises";
import dotenv from "dotenv";
import slugify from "slugify";

import authenticate from "../middleware/auth.js";
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

// ———————————————————————————————————
// Helpers
// ———————————————————————————————————

const generateBaseSlug = (text) =>
  slugify(text, { lower: true, strict: true, trim: true }).substring(0, 70);

const generateSlugWithId = (title, id) => `${generateBaseSlug(title)}-${id}`;

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
  slug: p.slug || null,
  images: p.images || [],
  attributes: safeJSON(p.attributes, {}),
  delivery: normalizeDelivery(safeJSON(p.delivery, {})),
  contact: safeJSON(p.contact, {}),
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  promotion:
    promotionPlans.find((x) => x.id === p.promotion_id) || null,
});

const buildSearchText = (
  title = "",
  description = "",
  categoryName = "",
  attrs = {}
) =>
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
    Array.isArray(attrs?.features)
      ? attrs.features.join(" ")
      : "",
    attrs?.size,
    attrs?.age_range,
    attrs?.bedrooms,
    attrs?.bathrooms,
    attrs?.experience_level,
    attrs?.skills,
  ]
    .filter(Boolean)
    .join(" ");

const buildSearchTextFromProduct = (p) => {
  const attrs = safeJSON(p.attributes, {});
  const categoryName = p.category_name || "";

  return buildSearchText(
    p.title,
    p.description,
    categoryName,
    attrs
  );
};

const buildSearchVector = (text) =>
  `to_tsvector('english', coalesce(${text}::STRING, ''))`;

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

// ———————————————————————————————————
// Routes
// ———————————————————————————————————

// Cloudinary upload signature
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
      success: true,
      data: {
        timestamp,
        signature,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
      },
    });
  } catch (err) {
    console.error("Cloudinary signature error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate upload signature",
    });
  }
});

// Public product feed
router.get("/products", async (req, res) => {
  try {
    const { skip = 0, limit = 20, state, category_id } = req.query;

    const offset = Math.max(parseInt(skip, 10) || 0, 0);
    const take = Math.min(parseInt(limit, 10) || 20, 50);

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
      success: true,
      trending,
      products: [...trending, ...feedProducts],
      filters_applied: { state, category_id },
    });
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
});

// Search (full‑text)
router.get("/search", async (req, res) => {
  try {
    const { q = "", state, category_id, skip = 0, limit = 20 } = req.query;

    if (!q.trim().length) {
      return res.status(400).json({
        success: false,
        message: "Search query required",
      });
    }

    const offset = Math.max(parseInt(skip, 10) || 0, 0);
    const take = Math.min(parseInt(limit, 10) || 20, 50);

    const whereClauses = [
      "p.is_active = true",
      "p.status = 'active'",
      "p.search_vector @@ plainto_tsquery('english', $1)",
    ];
    const params = [q.trim()];

    if (state) {
      whereClauses.push(`p.location_state = $${params.length + 1}`);
      params.push(state.trim());
    }

    if (category_id) {
      whereClauses.push(`p.category_id = $${params.length + 1}::UUID`);
      params.push(category_id);
    }

    const { rows } = await pool.query(`
      SELECT p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images,
        ts_rank_cd(p.search_vector, plainto_tsquery('english', $1)) AS rank
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY p.id, rank
      ORDER BY rank DESC, p.created_at DESC
      OFFSET $${params.length + 1} LIMIT $${params.length + 2}`,
      [...params, offset, take]
    );

    res.json({
      success: true,
      products: rows.map((p) => ({
        ...normalizeProduct(p),
        search_rank: p.rank,
      })),
      query: q.trim(),
      filters_applied: { state, category_id },
    });
  } catch (err) {
    console.error("GET /search error:", err);
    res.status(500).json({
      success: false,
      message: "Search failed",
    });
  }
});

// Product detail by SEO slug
router.get("/product/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const parts = slug.split("-");
    const id = parts[parts.length - 1];

    if (!id) {
      return res.status(404).json({
        success: false,
        message: "Invalid slug format",
      });
    }

    const { rows } = await pool.query(
      `SELECT p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
       FROM products p
       LEFT JOIN product_images pi ON p.id = pi.product_id
       WHERE p.id = $1 AND p.is_active = true AND p.status = 'active'
       GROUP BY p.id`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = rows[0];
    const canonicalSlug =
      product.slug || generateSlugWithId(product.title || "", product.id);

    if (product.slug !== slug) {
      if (!product.slug) {
        await pool.query(
          `UPDATE products
           SET slug = $1,
               search_text = $2,
               search_vector = to_tsvector('english', $2)
           WHERE id = $3`,
          [canonicalSlug, buildSearchTextFromProduct(product), id]
        );
      }
      return res.redirect(301, `/product/${canonicalSlug}`);
    }

    pool
      .query(
        "UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1",
        [id]
      )
      .catch(console.error);

    res.json({
      success: true,
      product: normalizeProduct({ ...product, slug: canonicalSlug }),
    });
  } catch (err) {
    console.error("GET /product/:slug error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
});

// Direct product by ID (admin / internal)
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
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    pool
      .query(
        "UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1",
        [id]
      )
      .catch(console.error);

    res.json({
      success: true,
      product: normalizeProduct(rows[0]),
    });
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
});

// Create product
router.post("/products", authenticate, upload.array("images", 6), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sellerId = req.user?.id;
    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: missing seller_id",
      });
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
      whatsapp,
      whatsapp_link,
      phone,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title required",
      });
    }
    if (!price || isNaN(price) || +price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid price required",
      });
    }
    if (!category_id) {
      return res.status(400).json({
        success: false,
        message: "Category required",
      });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image required",
      });
    }

    const parsedAttributes = safeJSON(attributes, {});
    const parsedDelivery = normalizeDelivery(safeJSON(delivery, {}));
    const parsedContact = safeJSON(contact, {});

    if (
      parsedDelivery.available &&
      parsedDelivery.duration.from >= parsedDelivery.duration.to
    ) {
      return res.status(400).json({
        success: false,
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
    const searchVector = buildSearchVector(
      `'${searchText.replace(/'/g, "''")}'`
    );

    const productRes = await client.query(
      `
        INSERT INTO products (
          title, description, price, category_id, subcategory_id,
          seller_id, attributes, delivery, contact,
          promotion_id, location_state, location_city,
          search_text, search_vector,
          status, is_active, slug,
          whatsapp, whatsapp_link, phone
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14,
          'draft', true, NULL,
          $15, $16, $17
        )
        RETURNING
          id, title, description, price, category_id, subcategory_id,
          attributes, delivery, contact, promotion_id,
          location_state, location_city, created_at, views,
          is_active, status, slug, search_text
      `,
      [
        title.trim(),
        description?.trim() || "",
        parseFloat(price),
        category_id,
        subcategory_id || null,
        sellerId,
        JSON.stringify(parsedAttributes),
        JSON.stringify(parsedDelivery),
        JSON.stringify(parsedContact),
        promotion_id ? parseInt(promotion_id, 10) : null,
        location_state?.trim() || null,
        location_city?.trim() || null,
        searchText,
        JSON.stringify(searchVector),
        whatsapp?.trim() || null,
        whatsapp_link?.trim() || null,
        phone?.trim() || null,
      ]
    );

    const product = productRes.rows[0];
    const finalSlug = generateSlugWithId(title.trim(), product.id);

        await client.query(
      `UPDATE products
       SET slug = $1,
           search_vector = to_tsvector('english', $2)
       WHERE id = $3`,
      [finalSlug, buildSearchTextFromProduct(product), product.id]
    );

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
      return res.status(400).json({
        success: false,
        message: "Invalid category or promotion",
      });
    }
    if (err.code === "23502") {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }
    if (err.code === "23505" && err.constraint?.includes("slug")) {
      return res.status(409).json({
        success: false,
        message: "Slug conflict - try a different title",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  } finally {
    client.release();
  }
});