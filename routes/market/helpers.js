/**
 * routes/market/helpers.js
 *
 * Shared helpers for all market routes.
 * — SQL queries, utilities, response formatting.
 *
 * Fixes:
 *   ✅ market.users column names corrected (profile_image exists)
 *   ✅ product_features uses position not sort_order
 *   ✅ product_specifications uses position not sort_order
 *   ✅ product_box_items uses position not sort_order
 *   ✅ status filter accepts both 'active' and 'approved'
 *   ✅ pool exported cleanly from config/db.js
 */

import { pool } from "../../config/db.js";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
export const MAX_IMAGES    = 6;
export const DEFAULT_LIMIT = 24;
export const MAX_LIMIT     = 100;

export const SORT_MAP = {
  newest:   "p.created_at DESC",
  oldest:   "p.created_at ASC",
  price_asc:  "p.price ASC",
  price_desc: "p.price DESC",
  views:    "p.view_count DESC, p.created_at DESC",
  saves:    "p.save_count DESC, p.created_at DESC",
  trending: "p.view_count DESC, p.save_count DESC, p.created_at DESC",
};

/* ══════════════════════════════════════════════════════════════
   FULL PRODUCT SELECT
   Joins market.users (sellers) — NOT public.users (buyers).
   Handles both status = 'active' and status = 'approved'.
══════════════════════════════════════════════════════════════ */
export const FULL_PRODUCT_SELECT = `
  SELECT
    p.*,
    u.name            AS seller_name,
    u.email           AS seller_email,
    u.profile_image   AS seller_avatar,
    u.phone_number    AS seller_phone,
    u.verified        AS seller_verified,

    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object(
          'id',         pi.id,
          'url',        pi.image_url,
          'is_primary', pi.is_primary,
          'sort_order', pi.sort_order
        )
      ) FILTER (WHERE pi.id IS NOT NULL),
      '[]'
    ) AS images,

    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object(
          'id',         pv.id,
          'sku',        pv.sku,
          'name',       pv.name,
          'price',      pv.price,
          'stock',      pv.stock,
          'attributes', pv.attributes
        )
      ) FILTER (WHERE pv.id IS NOT NULL),
      '[]'
    ) AS variants,

    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object(
          'feature',  pf.feature,
          'position', pf.position
        )
        ORDER BY jsonb_build_object('position', pf.position)
      ) FILTER (WHERE pf.id IS NOT NULL),
      '[]'
    ) AS key_features,

    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object(
          'key',      ps.spec_key,
          'value',    ps.spec_value,
          'position', ps.position
        )
        ORDER BY jsonb_build_object('position', ps.position)
      ) FILTER (WHERE ps.id IS NOT NULL),
      '[]'
    ) AS specifications,

    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object(
          'item',     pb.item,
          'position', pb.position
        )
        ORDER BY jsonb_build_object('position', pb.position)
      ) FILTER (WHERE pb.id IS NOT NULL),
      '[]'
    ) AS whats_in_box

  FROM market.products p
  LEFT JOIN market.users                  u  ON u.id          = p.user_id
  LEFT JOIN market.product_images         pi ON pi.product_id = p.id
  LEFT JOIN market.product_variants       pv ON pv.product_id = p.id
  LEFT JOIN market.product_features       pf ON pf.product_id = p.id
  LEFT JOIN market.product_specifications ps ON ps.product_id = p.id
  LEFT JOIN market.product_box_items      pb ON pb.product_id = p.id
`;

/*
 * GROUP BY must list every non-aggregated column from the SELECT.
 * All p.* columns are covered by p.id (primary key).
 * User columns must be listed explicitly.
 */
export const GROUP_BY = `
  GROUP BY
    p.id,
    u.name,
    u.email,
    u.profile_image,
    u.phone_number,
    u.verified
`;

/*
 * Public visibility filter — reusable array of SQL conditions.
 * Accepts both status values used across the app.
 */
export const PUBLIC_CONDITIONS = [
  "p.status    IN ('approved', 'active')",
  "p.is_active  = true",
  "p.is_hidden  = false",
  "p.is_paused  = false",
  "p.deleted_at IS NULL",
];

/* ══════════════════════════════════════════════════════════════
   PAGINATION
══════════════════════════════════════════════════════════════ */
export function paginate(query) {
  const limit  = Math.min(parseInt(query.limit,  10) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  const page   = Math.floor(offset / limit) + 1;
  return { limit, offset, page };
}

export function paginationMeta(total, limit, offset) {
  const totalPages = Math.ceil(total / limit);
  const page       = Math.floor(offset / limit) + 1;
  return { total, page, limit, offset, totalPages, hasNext: page < totalPages };
}

/* ══════════════════════════════════════════════════════════════
   SAFE SORT
══════════════════════════════════════════════════════════════ */
export function safeSort(sort) {
  return SORT_MAP[sort] || SORT_MAP.newest;
}

/* ══════════════════════════════════════════════════════════════
   STRING SANITISATION
══════════════════════════════════════════════════════════════ */
export function safeStr(val, max = 500) {
  if (typeof val !== "string") return null;
  const t = val.trim();
  return t.length ? t.slice(0, max) : null;
}

/* ══════════════════════════════════════════════════════════════
   JSON PARSING
══════════════════════════════════════════════════════════════ */
export function parseJSON(raw, fallback = []) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : (raw ?? fallback);
  } catch {
    return fallback;
  }
}

/* ══════════════════════════════════════════════════════════════
   RESPONSE HELPERS
══════════════════════════════════════════════════════════════ */
export const ok = (res, data = {}, status = 200) =>
  res.status(status).json({ success: true, ...data });

export const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

/* ══════════════════════════════════════════════════════════════
   CHILD TABLE HELPERS
══════════════════════════════════════════════════════════════ */

/**
 * Insert a list of simple string values into a child table.
 * e.g. product_features (feature), product_box_items (item)
 */
export async function insertList(client, table, column, productId, items) {
  for (let i = 0; i < items.length; i++) {
    const val = safeStr(String(items[i] ?? ""));
    if (!val) continue;
    await client.query(
      `INSERT INTO market.${table} (product_id, ${column}, position)
       VALUES ($1, $2, $3)`,
      [productId, val, i]
    );
  }
}

/**
 * Delete then re-insert a child list.
 */
export async function replaceList(client, table, column, productId, items) {
  await client.query(
    `DELETE FROM market.${table} WHERE product_id = $1`,
    [productId]
  );
  await insertList(client, table, column, productId, items);
}

/**
 * Replace specifications (key/value pairs).
 */
export async function replaceSpecs(client, productId, specs) {
  await client.query(
    "DELETE FROM market.product_specifications WHERE product_id = $1",
    [productId]
  );

  for (let i = 0; i < specs.length; i++) {
    const k = safeStr(specs[i]?.key);
    const v = safeStr(specs[i]?.value);
    if (!k || !v) continue;

    await client.query(
      `INSERT INTO market.product_specifications
         (product_id, spec_key, spec_value, position)
       VALUES ($1, $2, $3, $4)`,
      [productId, k, v, i]
    );
  }
}

/**
 * Replace all variants for a product.
 */
export async function replaceVariants(client, productId, rawVariants) {
  await client.query(
    "DELETE FROM market.product_variants WHERE product_id = $1",
    [productId]
  );

  const variants = parseJSON(rawVariants);

  for (const v of variants) {
    const sku  = safeStr(v?.sku);
    const name = safeStr(v?.name);
    if (!sku || !name) continue;

    await client.query(
      `INSERT INTO market.product_variants
         (product_id, sku, name, price, stock, attributes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        productId,
        sku.toUpperCase(),
        name,
        Math.max(0, parseFloat(v.price)   || 0),
        Math.max(0, parseInt(v.stock, 10) || 0),
        JSON.stringify(v.attributes || {}),
      ]
    );
  }
}

/* ══════════════════════════════════════════════════════════════
   CLOUDINARY HELPERS
══════════════════════════════════════════════════════════════ */

/**
 * Upload multiple files to Cloudinary in parallel.
 */
export async function uploadFiles(files, uploadToCloudinary) {
  return Promise.all(files.map((f) => uploadToCloudinary(f.buffer)));
}

/**
 * Delete old Cloudinary images before replacing them.
 * Fire-and-forget — non-critical.
 */
export async function deleteOldImages(client, productId, destroyFromCloudinary) {
  try {
    const { rows } = await client.query(
      "SELECT image_url FROM market.product_images WHERE product_id = $1",
      [productId]
    );

    rows.forEach(({ image_url }) => {
      try {
        const publicId = image_url
          .split("/upload/")[1]
          ?.replace(/\.[^.]+$/, "");

        if (publicId) {
          destroyFromCloudinary(publicId).catch(() => {});
        }
      } catch {}
    });
  } catch {}
}

/* ══════════════════════════════════════════════════════════════
   OWNERSHIP GUARD
   Seller may only modify their own products.
══════════════════════════════════════════════════════════════ */
export async function assertOwner(client, productId, userId) {
  const { rows } = await client.query(
    `SELECT user_id, status
     FROM market.products
     WHERE id = $1
       AND deleted_at IS NULL`,
    [productId]
  );

  if (!rows.length)               return { error: 404, message: "Product not found" };
  if (rows[0].user_id !== userId) return { error: 403, message: "Forbidden"         };

  return { row: rows[0] };
}

/* ══════════════════════════════════════════════════════════════
   IS PUBLIC HELPER
   Checks whether a product row is publicly visible.
   Handles both 'active' and 'approved' statuses.
══════════════════════════════════════════════════════════════ */
export function isPublicProduct(product) {
  return (
    (product.status === "approved" || product.status === "active") &&
    product.is_active  === true &&
    product.is_hidden  === false &&
    product.is_paused  === false &&
    product.deleted_at === null
  );
}

/* ══════════════════════════════════════════════════════════════
   POOL — re-exported for convenience
   Routes can import pool directly from helpers.js
   instead of importing from config/db.js separately.
══════════════════════════════════════════════════════════════ */
export { pool };