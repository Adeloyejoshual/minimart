/**
 * routes/market/helpers.js
 * Shared helpers for all market routes.
 */

import { pool }                          from "../../config/db.js";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

/* ══════════════════════════════════════════════════════════════
   R2 CLIENT
══════════════════════════════════════════════════════════════ */
const r2 = new S3Client({
  region     : process.env.R2_REGION ?? "auto",
  endpoint   : process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId    : process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET = process.env.R2_BUCKET_NAME;

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
export const MAX_IMAGES    = 8;
export const DEFAULT_LIMIT = 24;
export const MAX_LIMIT     = 100;

export const SORT_MAP = {
  newest    : "p.created_at DESC",
  oldest    : "p.created_at ASC",
  price_asc : "p.price ASC",
  price_desc: "p.price DESC",
  views     : "p.view_count DESC, p.created_at DESC",
  saves     : "p.save_count DESC, p.created_at DESC",
  trending  : "p.view_count DESC, p.save_count DESC, p.created_at DESC",
};

/* ══════════════════════════════════════════════════════════════
   FULL PRODUCT SELECT
   Cockroach-safe:
   - NO GROUP BY
   - correlated subqueries for child collections
   - uses "name" column on market.users (not "full_name")
   - uses "status" column on market.users (not "is_active")
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
          'id',          pi.id,
          'url',         pi.image_url,
          'storage_key', pi.storage_key,
          'is_primary',  pi.is_primary,
          'sort_order',  pi.sort_order
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

export const GROUP_BY = "";

/* ── Public visibility conditions ── */
export const PUBLIC_CONDITIONS = [
  "p.status IN ('approved', 'active')",
  "p.is_active = true",
  "p.is_hidden = false",
  "p.is_paused = false",
  "p.deleted_at IS NULL",
];

export function isPublicProduct(product) {
  return (
    (product.status === "approved" || product.status === "active") &&
    product.is_active  === true  &&
    product.is_hidden  === false &&
    product.is_paused  === false &&
    product.deleted_at === null
  );
}

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

export function safeSort(sort) {
  return SORT_MAP[sort] || SORT_MAP.newest;
}

/* ══════════════════════════════════════════════════════════════
   STRING HELPERS
══════════════════════════════════════════════════════════════ */
export function safeStr(val, max = 500) {
  if (typeof val !== "string") return null;
  const t = val.trim();
  return t.length ? t.slice(0, max) : null;
}

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
   ─────────────────────────────────────────────────────────────
   insertList / replaceList try with "position" column first.
   If the column does not exist (42703) they retry without it.
   This makes them resilient to schema variations across envs.
══════════════════════════════════════════════════════════════ */
export async function insertList(client, table, column, productId, items) {
  if (!Array.isArray(items)) return;

  for (let i = 0; i < items.length; i++) {
    const val = safeStr(String(items[i] ?? ""));
    if (!val) continue;

    try {
      /* Try with position column first */
      await client.query(
        `INSERT INTO market.${table} (product_id, ${column}, position)
         VALUES ($1, $2, $3)`,
        [productId, val, i]
      );
    } catch (err) {
      if (err.code === "42703") {
        /* position column does not exist — insert without it */
        await client.query(
          `INSERT INTO market.${table} (product_id, ${column})
           VALUES ($1, $2)`,
          [productId, val]
        );
      } else {
        throw err;
      }
    }
  }
}

export async function replaceList(client, table, column, productId, items) {
  await client.query(
    `DELETE FROM market.${table} WHERE product_id = $1`,
    [productId]
  );
  await insertList(client, table, column, productId, items);
}

/* ══════════════════════════════════════════════════════════════
   REPLACE SPECS
   ─────────────────────────────────────────────────────────────
   Tries spec_key / spec_value columns first (your current schema).
   Falls back to label / value if those don't exist.
   Also tries with / without position column.
══════════════════════════════════════════════════════════════ */
export async function replaceSpecs(client, productId, specs) {
  await client.query(
    "DELETE FROM market.product_specifications WHERE product_id = $1",
    [productId]
  );

  if (!Array.isArray(specs) || !specs.length) return;

  for (let i = 0; i < specs.length; i++) {
    /* Support both { key, value } and { label, value } shapes */
    const k = safeStr(specs[i]?.key   ?? specs[i]?.label);
    const v = safeStr(specs[i]?.value);
    if (!k || !v) continue;

    /* Try spec_key / spec_value with position */
    try {
      await client.query(
        `INSERT INTO market.product_specifications
           (product_id, spec_key, spec_value, position)
         VALUES ($1, $2, $3, $4)`,
        [productId, k, v, i]
      );
      continue;
    } catch (err) {
      if (err.code !== "42703") throw err;
      /* column name mismatch — try alternatives below */
    }

    /* Try spec_key / spec_value without position */
    try {
      await client.query(
        `INSERT INTO market.product_specifications
           (product_id, spec_key, spec_value)
         VALUES ($1, $2, $3)`,
        [productId, k, v]
      );
      continue;
    } catch (err) {
      if (err.code !== "42703") throw err;
    }

    /* Try label / value with position */
    try {
      await client.query(
        `INSERT INTO market.product_specifications
           (product_id, label, value, position)
         VALUES ($1, $2, $3, $4)`,
        [productId, k, v, i]
      );
      continue;
    } catch (err) {
      if (err.code !== "42703") throw err;
    }

    /* Try label / value without position */
    await client.query(
      `INSERT INTO market.product_specifications
         (product_id, label, value)
       VALUES ($1, $2, $3)`,
      [productId, k, v]
    );
  }
}

/* ══════════════════════════════════════════════════════════════
   REPLACE VARIANTS
══════════════════════════════════════════════════════════════ */
export async function replaceVariants(client, productId, rawVariants) {
  await client.query(
    "DELETE FROM market.product_variants WHERE product_id = $1",
    [productId]
  );

  const variants = Array.isArray(rawVariants)
    ? rawVariants
    : parseJSON(rawVariants, []);

  if (!variants.length) return;

  const seen = new Set();

  for (const v of variants) {
    const sku  = safeStr(String(v?.sku ?? ""))?.toUpperCase();
    const name = safeStr(v?.name);

    if (!sku || !name) continue;

    if (seen.has(sku)) {
      const err = new Error(
        `Duplicate variant SKU within this product: "${sku}". Each variant must have a unique SKU.`
      );
      err.status = 422;
      throw err;
    }

    seen.add(sku);

    await client.query(
      `INSERT INTO market.product_variants
         (product_id, sku, name, price, stock, attributes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        productId,
        sku,
        name,
        Math.max(0, parseFloat(v.price)   || 0),
        Math.max(0, parseInt(v.stock, 10) || 0),
        JSON.stringify(v.attributes       || {}),
      ]
    );
  }
}

/* ══════════════════════════════════════════════════════════════
   R2 IMAGE HELPERS
══════════════════════════════════════════════════════════════ */
export async function deleteFromR2(key) {
  if (!key) return;
  try {
    await r2.send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })
    );
  } catch (err) {
    console.error("R2 delete failed for key:", key, err?.message);
  }
}

export async function deleteProductImagesFromR2(client, productId) {
  const { rows } = await client.query(
    "SELECT storage_key FROM market.product_images WHERE product_id = $1",
    [productId]
  );

  await Promise.allSettled(
    rows
      .map((r) => r.storage_key)
      .filter(Boolean)
      .map(deleteFromR2)
  );
}

/* ══════════════════════════════════════════════════════════════
   OWNERSHIP GUARD
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
  if (rows[0].user_id !== userId) return { error: 403, message: "Forbidden" };
  return { row: rows[0] };
}

export { pool };