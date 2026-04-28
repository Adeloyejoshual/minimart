import fs from "fs/promises";
import { pool } from "../config/db.js";
import { uploadOne } from "./upload.utils.js";
import { generateSlugWithId } from "../utils/slug.js";
import { promotionPlans } from "../src/config/index.js";

/* ===================== SAFE JSON ===================== */
const safeJSON = (value, fallback = {}) => {
  try {
    if (value == null || value === "") return fallback;
    if (typeof value === "object") return value;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

/* ===================== DELIVERY NORMALIZER ===================== */
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

/* ===================== PRODUCT NORMALIZER ===================== */
const normalizeProduct = (p) => ({
  ...p,
  price: Number(p.price),
  images: p.images || [],
  attributes: safeJSON(p.attributes, {}),
  delivery: normalizeDelivery(safeJSON(p.delivery, {})),
  contact: safeJSON(p.contact, {}),
  location: {
    state: p.location_state || null,
    city: p.location_city || null,
  },
  promotion:
    promotionPlans.find((x) => x.id === p.promotion_id) || null,
});

/* ===================== SEARCH TEXT BUILDER ===================== */
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
  ]
    .filter(Boolean)
    .join(" ");

/* ===================== GET PRODUCT BY ID ===================== */
export const getProductById = async (id) => {
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

  return rows[0];
};

/* ===================== GET PRODUCTS ===================== */
export const getProducts = async (
  skip = 0,
  limit = 20,
  state,
  category_id
) => {
  const offset = Math.max(Number(skip) || 0, 0);
  const take = Math.min(Number(limit) || 20, 50);

  const where = ["p.is_active = true", "p.status = 'active'"];
  const params = [];
  let i = 1;

  if (state) {
    where.push(`p.location_state = $${i}`);
    params.push(state);
    i++;
  }

  if (category_id) {
    where.push(`p.category_id = $${i}::UUID`);
    params.push(category_id);
    i++;
  }

  const whereSQL = `WHERE ${where.join(" AND ")}`;

  const baseQuery = `
    SELECT p.*,
      COALESCE(
        json_agg(pi.image_url ORDER BY pi.position)
        FILTER (WHERE pi.image_url IS NOT NULL),
        '[]'
      ) AS images
    FROM products p
    LEFT JOIN product_images pi ON p.id = pi.product_id
    ${whereSQL}
    GROUP BY p.id
  `;

  const [trending, feed] = await Promise.all([
    pool.query(
      `${baseQuery}
       ORDER BY p.views DESC NULLS LAST
       LIMIT 6`
    ),

    pool.query(
      `${baseQuery}
       ORDER BY p.created_at DESC
       OFFSET $${i} LIMIT $${i + 1}`,
      [...params, offset, take]
    ),
  ]);

  const trendingData = trending.rows.map(normalizeProduct);
  const trendingIds = new Set(trendingData.map((p) => p.id));

  const feedData = feed.rows
    .map(normalizeProduct)
    .filter((p) => !trendingIds.has(p.id));

  return {
    trending: trendingData,
    products: [...trendingData, ...feedData],
  };
};

/* ===================== CREATE PRODUCT ===================== */
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
  seller_id, // ✅ FIXED (was missing before)
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ===================== PARSE SAFE INPUTS ===================== */
    const parsedAttributes = safeJSON(attributes, {});
    const parsedDelivery = normalizeDelivery(safeJSON(delivery, {}));
    const parsedContact = safeJSON(contact, {});

    const safePrice = Number(price);
    if (!safePrice || isNaN(safePrice)) {
      throw new Error("Invalid price");
    }

    const categoryRes = await client.query(
      "SELECT name FROM categories WHERE id = $1",
      [category_id]
    );

    const categoryName = categoryRes.rows[0]?.name || "";

    const searchText = buildSearchText(
      title,
      description || "",
      categoryName,
      parsedAttributes
    );

    /* ===================== INSERT PRODUCT ===================== */
    const insert = await client.query(
      `
      INSERT INTO products (
        title,
        description,
        price,
        category_id,
        subcategory_id,
        seller_id,
        attributes,
        delivery,
        contact,
        promotion_id,
        location_state,
        location_city,
        search_text,
        status,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',true)
      RETURNING id
      `,
      [
        title.trim(),
        description || "",
        safePrice,
        category_id,
        subcategory_id || null,
        seller_id, // ✅ FIXED
        parsedAttributes,
        parsedDelivery,
        parsedContact,
        promotion_id || null,
        location_state || null,
        location_city || null,
        searchText,
      ]
    );

    const productId = insert.rows[0].id;

    /* ===================== FINAL SLUG ===================== */
    const finalSlug = generateSlugWithId(title.trim(), productId);

    await client.query(
      "UPDATE products SET slug = $1 WHERE id = $2",
      [finalSlug, productId]
    );

    /* ===================== IMAGES UPLOAD ===================== */
    if (imagesFiles?.length) {
      for (let i = 0; i < imagesFiles.length; i++) {
        const file = imagesFiles[i];

        const uploaded = await uploadOne(file.path);

        await client.query(
          `INSERT INTO product_images (product_id, image_url, position)
           VALUES ($1,$2,$3)`,
          [productId, uploaded.url, i]
        );

        await fs.unlink(file.path).catch(() => {});
      }
    }

    await client.query("COMMIT");

    /* ===================== RETURN FULL PRODUCT ===================== */
    const full = await pool.query(
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

    return normalizeProduct(full.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});

    if (err.code === "23503") {
      err.code = "INVALID_FOREIGN_KEY";
    }

    if (err.code === "23502") {
      err.code = "MISSING_REQUIRED_FIELDS";
    }

    throw err;
  } finally {
    client.release();
  }
};

/* ===================== INCREMENT VIEWS ===================== */
export const incrementViews = (id) => {
  pool
    .query(
      "UPDATE products SET views = COALESCE(views,0) + 1 WHERE id = $1",
      [id]
    )
    .catch(() => {});
};