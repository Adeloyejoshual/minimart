/**
 * routes/market/helpers.js
 * Shared helpers for all market routes.
 *
 * Business rules:
 *  - Stock = sum of variant quantities (auto-computed on write)
 *  - sold_count = auto-incremented on order completion
 *  - is_featured / is_trending = admin-controlled
 *  - has_delivery = delivery-agent controlled
 *  - seller_verified / location = from users JOIN
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

/* ══════════════════════════════════════════════════════════════
   SORT MAP
   - Kept legacy sorts (views, saves) for back-compat
   - Added bestselling + trending using sold_count
══════════════════════════════════════════════════════════════ */
export const SORT_MAP = {
  newest      : "p.created_at DESC",
  oldest      : "p.created_at ASC",
  price_asc   : "p.price ASC, p.created_at DESC",
  price_desc  : "p.price DESC, p.created_at DESC",

  /* NEW — real social proof */
  bestselling : "p.sold_count DESC, p.created_at DESC",

  /* NEW — sales velocity (sold per day since posted) */
  trending    : `
    (p.sold_count::float / GREATEST(
      EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400, 1
    )) DESC,
    p.created_at DESC
  `,

  /* Legacy — kept for back-compat, but prefer bestselling */
  views       : "p.view_count DESC, p.created_at DESC",
  saves       : "p.save_count DESC, p.created_at DESC",
};

/* ══════════════════════════════════════════════════════════════
   FULL PRODUCT SELECT
   Cockroach-safe:
   - NO GROUP BY
   - correlated subqueries for child collections
   - uses "name" column on market.users (not "full_name")
   - uses "verified" column on market.users
   - includes seller_verified, location from JOIN
══════════════════════════════════════════════════════════════ */
export const FULL_PRODUCT_SELECT = `
  SELECT
    p.*,

    /* ─── Seller info (from users JOIN) ─── */
    u.name          AS seller_name,
    u.email         AS seller_email,
    u.profile_image AS seller_avatar,
    u.phone_number  AS seller_phone,
    u.verified      AS seller_verified,
    u.location      AS seller_location,

    /* ─── Images ─── */
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

    /* ─── Variants (with quantity for stock computation) ─── */
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

    /* ─── Key features ─── */
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

    /* ─── Specifications ─── */
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

    /* ─── What's in box ─── */
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
   VARIANT STOCK SUMMER
   ─────────────────────────────────────────────────────────────
   Computes total stock from an array of variants.
   Used by addproduct + editproduct to keep products.stock
   in sync with sum of variant quantities.
══════════════════════════════════════════════════════════════ */
export function sumVariantStock(variants) {
  if (!Array.isArray(variants)) return 0;

  return variants.reduce((total, v) => {
    const qty = parseInt(v?.stock ?? v?.quantity ?? 0, 10);
    return total + (isNaN(qty) || qty < 0 ? 0 : qty);
  }, 0);
}

/* ══════════════════════════════════════════════════════════════
   VALIDATE VARIANTS
   ─────────────────────────────────────────────────────────────
   Returns { error } if invalid, { totalStock } if valid.
══════════════════════════════════════════════════════════════ */
export function validateVariants(variants) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return { error: "At least one variant with quantity is required" };
  }

  const skuSet = new Set();
  let totalStock = 0;

  for (const [idx, v] of variants.entries()) {
    /* Name required */
    const name = safeStr(v?.name);
    if (!name) {
      return { error: `Variant #${idx + 1}: name is required` };
    }

    /* Quantity check */
    const qty = parseInt(v?.stock ?? v?.quantity ?? 0, 10);
    if (isNaN(qty) || qty < 0) {
      return {
        error: `Variant "${name}": quantity must be a valid number (0 or more)`
      };
    }
    totalStock += qty;

    /* SKU duplicate check */
    const sku = safeStr(String(v?.sku ?? ""))?.toUpperCase();
    if (sku) {
      if (skuSet.has(sku)) {
        return {
          error: `Duplicate SKU "${sku}". Each variant must have a unique SKU.`
        };
      }
      skuSet.add(sku);
    }
  }

  if (totalStock === 0) {
    return {
      error: "Total stock cannot be zero. At least one variant must have quantity > 0."
    };
  }

  return { totalStock };
}

/* ══════════════════════════════════════════════════════════════
   SYNC PRODUCT STOCK FROM VARIANTS
   ─────────────────────────────────────────────────────────────
   Recomputes products.stock from actual variant rows in DB.
   Call after any variant insert/update/delete.
══════════════════════════════════════════════════════════════ */
export async function syncProductStock(client, productId) {
  await client.query(
    `UPDATE market.products
     SET stock = COALESCE(
       (SELECT SUM(stock) FROM market.product_variants WHERE product_id = $1),
       0
     )
     WHERE id = $1`,
    [productId]
  );
}

/* ══════════════════════════════════════════════════════════════
   CHILD TABLE HELPERS
   ─────────────────────────────────────────────────────────────
   insertList / replaceList try with "position" column first.
   If the column does not exist (42703) they retry without it.
══════════════════════════════════════════════════════════════ */
export async function insertList(client, table, column, productId, items) {
  if (!Array.isArray(items)) return;

  for (let i = 0; i < items.length; i++) {
    const val = safeStr(String(items[i] ?? ""));
    if (!val) continue;

    try {
      await client.query(
        `INSERT INTO market.${table} (product_id, ${column}, position)
         VALUES ($1, $2, $3)`,
        [productId, val, i]
      );
    } catch (err) {
      if (err.code === "42703") {
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
══════════════════════════════════════════════════════════════ */
export async function replaceSpecs(client, productId, specs) {
  await client.query(
    "DELETE FROM market.product_specifications WHERE product_id = $1",
    [productId]
  );

  if (!Array.isArray(specs) || !specs.length) return;

  for (let i = 0; i < specs.length; i++) {
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
   ─────────────────────────────────────────────────────────────
   - SKU is now OPTIONAL (only name + stock required)
   - Auto-syncs products.stock after replace
══════════════════════════════════════════════════════════════ */
export async function replaceVariants(client, productId, rawVariants) {
  await client.query(
    "DELETE FROM market.product_variants WHERE product_id = $1",
    [productId]
  );

  const variants = Array.isArray(rawVariants)
    ? rawVariants
    : parseJSON(rawVariants, []);

  if (!variants.length) {
    /* Sync stock to 0 if no variants */
    await syncProductStock(client, productId);
    return;
  }

  const seen = new Set();

  for (const v of variants) {
    const sku  = safeStr(String(v?.sku ?? ""))?.toUpperCase();
    const name = safeStr(v?.name);

    /* Name is required, SKU is optional */
    if (!name) continue;

    /* Only check duplicate if SKU is provided */
    if (sku) {
      if (seen.has(sku)) {
        const err = new Error(
          `Duplicate variant SKU within this product: "${sku}". Each variant must have a unique SKU.`
        );
        err.status = 422;
        throw err;
      }
      seen.add(sku);
    }

    const stock = Math.max(0, parseInt(v?.stock ?? v?.quantity, 10) || 0);

    await client.query(
      `INSERT INTO market.product_variants
         (product_id, sku, name, price, stock, attributes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        productId,
        sku,
        name,
        Math.max(0, parseFloat(v.price) || 0),
        stock,
        JSON.stringify(v.attributes || {}),
      ]
    );
  }

  /* Sync total stock from variants */
  await syncProductStock(client, productId);
}

/* ══════════════════════════════════════════════════════════════
   INCREMENT SOLD COUNT
   ─────────────────────────────────────────────────────────────
   Call from order-completion webhook to update social proof.
   Also decrements stock on both product + specific variant.
══════════════════════════════════════════════════════════════ */
export async function incrementSoldCount(client, productId, variantId, quantity = 1) {
  /* Increment product-level sold_count */
  await client.query(
    `UPDATE market.products
     SET sold_count = COALESCE(sold_count, 0) + $2
     WHERE id = $1`,
    [productId, quantity]
  );

  /* Decrement variant stock if variant specified */
  if (variantId) {
    await client.query(
      `UPDATE market.product_variants
       SET stock = GREATEST(stock - $2, 0)
       WHERE id = $1`,
      [variantId, quantity]
    );

    /* Re-sync product-level stock from all variants */
    await syncProductStock(client, productId);
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