/**
 * Shared helpers for all market routes.
 * SQL queries, utilities, response formatting.
 */

import { pool } from "../../config/db.js";

/* ── Constants ── */
export const MAX_IMAGES    = 6;
export const DEFAULT_LIMIT = 24;
export const MAX_LIMIT     = 100;

export const SORT_MAP = {
  newest:     "p.created_at DESC",
  oldest:     "p.created_at ASC",
  price_asc:  "p.price ASC",
  price_desc: "p.price DESC",
  views:      "p.view_count DESC, p.created_at DESC",
  saves:      "p.save_count DESC, p.created_at DESC",
  trending:   "p.view_count DESC, p.save_count DESC, p.created_at DESC",
};

/* ══════════════════════════════════════════════════════════════
   FULL PRODUCT SELECT
   Cockroach-safe version:
   - NO GROUP BY
   - uses correlated subqueries for child collections
══════════════════════════════════════════════════════════════ */
export const FULL_PRODUCT_SELECT = `
  SELECT
    p.*,

    u.name          AS seller_name,
    u.email         AS seller_email,
    u.profile_image AS seller_avatar,
    u.phone_number  AS seller_phone,
    u.verified      AS seller_verified,

    COALESCE((
      SELECT json_agg(img.obj)
      FROM (
        SELECT json_build_object(
          'id',         pi.id,
          'url',        pi.image_url,
          'is_primary', pi.is_primary,
          'sort_order', pi.sort_order
        ) AS obj
        FROM market.product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.sort_order ASC, pi.id ASC
      ) img
    ), '[]'::json) AS images,

    COALESCE((
      SELECT json_agg(v.obj)
      FROM (
        SELECT json_build_object(
          'id',         pv.id,
          'sku',        pv.sku,
          'name',       pv.name,
          'price',      pv.price,
          'stock',      pv.stock,
          'attributes', pv.attributes
        ) AS obj
        FROM market.product_variants pv
        WHERE pv.product_id = p.id
        ORDER BY pv.created_at ASC, pv.id ASC
      ) v
    ), '[]'::json) AS variants,

    COALESCE((
      SELECT json_agg(f.obj)
      FROM (
        SELECT json_build_object(
          'feature',  pf.feature,
          'position', pf.position
        ) AS obj
        FROM market.product_features pf
        WHERE pf.product_id = p.id
        ORDER BY pf.position ASC, pf.id ASC
      ) f
    ), '[]'::json) AS key_features,

    COALESCE((
      SELECT json_agg(s.obj)
      FROM (
        SELECT json_build_object(
          'key',      ps.spec_key,
          'value',    ps.spec_value,
          'position', ps.position
        ) AS obj
        FROM market.product_specifications ps
        WHERE ps.product_id = p.id
        ORDER BY ps.position ASC, ps.id ASC
      ) s
    ), '[]'::json) AS specifications,

    COALESCE((
      SELECT json_agg(b.obj)
      FROM (
        SELECT json_build_object(
          'item',     pb.item,
          'position', pb.position
        ) AS obj
        FROM market.product_box_items pb
        WHERE pb.product_id = p.id
        ORDER BY pb.position ASC, pb.id ASC
      ) b
    ), '[]'::json) AS whats_in_box

  FROM market.products p
  LEFT JOIN market.users u
    ON u.id = p.user_id
`;

/* GROUP_BY no longer needed, keep empty string for compatibility */
export const GROUP_BY = "";

/* ── Public visibility conditions ── */
export const PUBLIC_CONDITIONS = [
  "p.status IN ('approved', 'active')",
  "p.is_active = true",
  "p.is_hidden = false",
  "p.is_paused = false",
  "p.deleted_at IS NULL",
];

/* ── Is public product ── */
export function isPublicProduct(product) {
  return (
    (product.status === "approved" || product.status === "active") &&
    product.is_active === true &&
    product.is_hidden === false &&
    product.is_paused === false &&
    product.deleted_at === null
  );
}

/* ── Pagination ── */
export function paginate(query) {
  const limit  = Math.min(parseInt(query.limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  const page   = Math.floor(offset / limit) + 1;
  return { limit, offset, page };
}

export function paginationMeta(total, limit, offset) {
  const totalPages = Math.ceil(total / limit);
  const page       = Math.floor(offset / limit) + 1;
  return { total, page, limit, offset, totalPages, hasNext: page < totalPages };
}

/* ── Sort whitelist ── */
export function safeSort(sort) {
  return SORT_MAP[sort] || SORT_MAP.newest;
}

/* ── String sanitisation ── */
export function safeStr(val, max = 500) {
  if (typeof val !== "string") return null;
  const t = val.trim();
  return t.length ? t.slice(0, max) : null;
}

/* ── JSON parsing ── */
export function parseJSON(raw, fallback = []) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : (raw ?? fallback);
  } catch {
    return fallback;
  }
}

/* ── Response helpers ── */
export const ok = (res, data = {}, status = 200) =>
  res.status(status).json({ success: true, ...data });

export const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

/* ── Child table helpers ── */
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

export async function replaceList(client, table, column, productId, items) {
  await client.query(`DELETE FROM market.${table} WHERE product_id = $1`, [productId]);
  await insertList(client, table, column, productId, items);
}

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

export async function uploadFiles(files, uploadToCloudinary) {
  return Promise.all(files.map((f) => uploadToCloudinary(f.buffer)));
}

export async function deleteOldImages(client, productId, destroyFromCloudinary) {
  const { rows } = await client.query(
    "SELECT image_url FROM market.product_images WHERE product_id = $1",
    [productId]
  );

  rows.forEach(({ image_url }) => {
    try {
      const publicId = image_url.split("/upload/")[1]?.replace(/\.[^.]+$/, "");
      if (publicId) destroyFromCloudinary(publicId).catch(() => {});
    } catch {}
  });
}

export async function assertOwner(client, productId, userId) {
  const { rows } = await client.query(
    "SELECT user_id, status FROM market.products WHERE id = $1 AND deleted_at IS NULL",
    [productId]
  );

  if (!rows.length)               return { error: 404, message: "Product not found" };
  if (rows[0].user_id !== userId) return { error: 403, message: "Forbidden" };
  return { row: rows[0] };
}

export { pool };