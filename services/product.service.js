// src/services/product.service.js
import fs from "fs/promises";
import { v2 as cloudinary } from "cloudinary";

import { pool } from "../config/db.js";
import { brands, colors, categoryFields, conditions, usedDetails, featuresByCategory, models, ramOptions, sims, storageOptions, years, engines, fuelTypes, locationsByState, promotionPlans } from "../src/config/index.js";
import { generateBaseSlug, generateSlugWithId } from "../utils/slug.js";
import { uploadOne } from "./upload.utils.js";

// --- Internal helpers (no route logic) ---
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

// --- Core service methods ---

export const getProducts = async (skip = 0, limit = 20, state, category_id) => {
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

  return {
    trending,
    products: [...trending, ...feedProducts],
    filters_applied: { state, category_id },
  };
};

export const getProductById = async (id) => {
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

  return normalizeProduct(rows[0] || null);
};

export const createProduct = async ({
  title,
  price,
  category_id,
  attributes,
  delivery,
  contact,
  description,
  subcategory_id,
  promotion_id,
  location_state,
  location_city,
  imagesFiles,
  sellerId,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      parsedAttributes,
      parsedDelivery,
      parsedContact,
    } = (() => {
      const parsedAttributes = safeJSON(attributes, {});
      const parsedDelivery = normalizeDelivery(safeJSON(delivery, {}));
      const parsedContact = safeJSON(contact, {});

      if (
        parsedDelivery.available &&
        parsedDelivery.duration.from >= parsedDelivery.duration.to
      ) {
        throw new Error("'To' days must be greater than 'From' days");
      }

      return { parsedAttributes, parsedDelivery, parsedContact };
    })();

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

    const slug = generateSlugWithId(title.trim(), "TEMP");

    const productRes = await client.query(
      `
        INSERT INTO products (
          title, description, price, category_id, subcategory_id,
          seller_id, attributes, delivery, contact, promotion_id,
          location_state, location_city, search_text, status, is_active, slug
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft', true, $14)
        RETURNING id
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
        slug,
      ]
    );

    const productId = productRes.rows[0].id;
    const finalSlug = generateSlugWithId(title.trim(), productId);
    await client.query("UPDATE products SET slug = $1 WHERE id = $2", [
      finalSlug,
      productId,
    ]);

    if (imagesFiles && imagesFiles.length > 0) {
      for (let i = 0; i < imagesFiles.length; i++) {
        const file = imagesFiles[i];
        const uploaded = await uploadOne(file.path);
        await client.query(
          `INSERT INTO product_images (product_id, image_url, position)
           VALUES ($1, $2, $3)`,
          [productId, uploaded.url, i]
        );
      }
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
      [productId]
    );

    return normalizeProduct(fullRows.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23503") {
      err.code = "INVALID_CATEGORY_OR_PROMOTION";
    }
    if (err.code === "23502") {
      err.code = "MISSING_REQUIRED_FIELDS";
    }
    if (
      err.code === "23505" &&
      err.constraint?.includes("slug")
    ) {
      err.code = "SLUG_CONFLICT";
    }
    throw err;
  } finally {
    client.release();
  }
};

export const incrementViews = (id) => {
  pool.query("UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1", [id])
    .catch(() => {});
};