/**
 * routes/marketDetail/relatedProducts.js
 *
 * GET /:slugOrId/related
 *
 * Mounted under:
 *   app.use("/api/shop", marketDetailRouter)
 *
 * Examples:
 *   GET /api/shop/iphone-13-128gb/related
 *   GET /api/shop/<uuid>/related?limit=12
 *
 * Response:
 * {
 *   data: {
 *     product_id: "...",
 *     products: [ { id, slug, name, brand, price, original_price, image, image_url } ],
 *     items: [ ... ],   // alias
 *     count: N
 *   }
 * }
 */

import express from "express";
import { pool, ok, fail } from "../market/helpers.js";

const router = express.Router({ mergeParams: true });

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(s || "")
  );

const clampLimit = (raw, fallback = 12, max = 24) => {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return Math.min(n, max);
};

/**
 * Resolve product by UUID id or slug.
 * Uses only common columns; optional columns are selected safely via try/fallback.
 */
async function resolveProduct(slugOrId) {
  const baseSelect = `
    p.id,
    p.slug,
    p.name,
    p.brand,
    p.price,
    p.original_price
  `;

  // Prefer extended columns when present
  const tryExtended = async () => {
    const where = isUuid(slugOrId) ? `p.id = $1` : `p.slug = $1`;
    const { rows } = await pool.query(
      `SELECT
         ${baseSelect},
         p.category_id,
         p.seller_id,
         p.user_id,
         p.is_active,
         p.status,
         p.deleted_at
       FROM market.products p
       WHERE ${where}
       LIMIT 1`,
      [slugOrId]
    );
    return rows[0] || null;
  };

  const tryMinimal = async () => {
    const where = isUuid(slugOrId) ? `p.id = $1` : `p.slug = $1`;
    const { rows } = await pool.query(
      `SELECT ${baseSelect}
       FROM market.products p
       WHERE ${where}
       LIMIT 1`,
      [slugOrId]
    );
    return rows[0] || null;
  };

  try {
    return await tryExtended();
  } catch (err) {
    // Missing optional columns → minimal select
    if (err.code === "42703") {
      return await tryMinimal();
    }
    throw err;
  }
}

async function primaryImageMap(productIds) {
  if (!productIds.length) return new Map();

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (product_id)
         product_id,
         image_url
       FROM market.product_images
       WHERE product_id = ANY($1::uuid[])
       ORDER BY
         product_id,
         is_primary DESC NULLS LAST,
         sort_order ASC NULLS LAST`,
      [productIds]
    );

    const map = new Map();
    for (const r of rows) {
      map.set(String(r.product_id), r.image_url || null);
    }
    return map;
  } catch (err) {
    // Table/columns may differ — don't fail related list
    console.warn("[relatedProducts] image map skipped:", err.message);
    return new Map();
  }
}

function mapProduct(row, imageMap) {
  const img = imageMap.get(String(row.id)) || null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand || null,
    price: Number(row.price ?? 0),
    original_price: Number(row.original_price ?? 0),
    image: img,
    image_url: img,
    seller_id: row.seller_id || row.user_id || null,
    category_id: row.category_id || null,
  };
}

/**
 * Availability filter that works even if some columns are missing.
 * Built dynamically after a lightweight column probe (cached).
 */
let PRODUCT_COLS = null;

async function getProductColumns() {
  if (PRODUCT_COLS) return PRODUCT_COLS;

  try {
    const { rows } = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'market'
         AND table_name = 'products'`
    );
    PRODUCT_COLS = new Set(rows.map((r) => r.column_name));
  } catch {
    PRODUCT_COLS = new Set([
      "id",
      "slug",
      "name",
      "brand",
      "price",
      "original_price",
      "category_id",
      "seller_id",
      "user_id",
      "is_active",
      "status",
      "deleted_at",
      "created_at",
      "updated_at",
    ]);
  }

  return PRODUCT_COLS;
}

function availabilitySql(cols, alias = "p") {
  const parts = [];
  if (cols.has("deleted_at")) parts.push(`${alias}.deleted_at IS NULL`);
  if (cols.has("is_active")) parts.push(`${alias}.is_active = true`);
  if (cols.has("status")) {
    parts.push(`${alias}.status IN ('approved', 'active')`);
  }
  return parts.length ? `AND ${parts.join(" AND ")}` : "";
}

function orderSql(cols, alias = "p") {
  if (cols.has("updated_at") && cols.has("created_at")) {
    return `${alias}.updated_at DESC NULLS LAST, ${alias}.created_at DESC NULLS LAST`;
  }
  if (cols.has("created_at")) return `${alias}.created_at DESC NULLS LAST`;
  if (cols.has("updated_at")) return `${alias}.updated_at DESC NULLS LAST`;
  return `${alias}.id DESC`;
}

/**
 * Scored related products:
 *  +2 same category
 *  +2 same brand
 *  +1 same seller
 */
async function fetchRelated(product, limit) {
  const cols = await getProductColumns();
  const avail = availabilitySql(cols, "p");
  const order = orderSql(cols, "p");

  const selectCols = [
    "p.id",
    "p.slug",
    "p.name",
    "p.brand",
    "p.price",
    "p.original_price",
  ];
  if (cols.has("category_id")) selectCols.push("p.category_id");
  if (cols.has("seller_id")) selectCols.push("p.seller_id");
  if (cols.has("user_id")) selectCols.push("p.user_id");

  const params = [product.id];
  let i = 2;

  const scoreParts = ["0"];
  const matchParts = [];

  if (cols.has("category_id") && product.category_id) {
    scoreParts.push(`CASE WHEN p.category_id = $${i} THEN 2 ELSE 0 END`);
    matchParts.push(`p.category_id = $${i}`);
    params.push(product.category_id);
    i++;
  }

  if (cols.has("brand") && product.brand) {
    scoreParts.push(
      `CASE WHEN LOWER(COALESCE(p.brand, '')) = LOWER($${i}) THEN 2 ELSE 0 END`
    );
    matchParts.push(`LOWER(COALESCE(p.brand, '')) = LOWER($${i})`);
    params.push(product.brand);
    i++;
  }

  const sellerId = product.seller_id || product.user_id || null;
  if (sellerId && (cols.has("seller_id") || cols.has("user_id"))) {
    if (cols.has("seller_id") && cols.has("user_id")) {
      scoreParts.push(
        `CASE WHEN COALESCE(p.seller_id, p.user_id) = $${i} THEN 1 ELSE 0 END`
      );
    } else if (cols.has("seller_id")) {
      scoreParts.push(`CASE WHEN p.seller_id = $${i} THEN 1 ELSE 0 END`);
    } else {
      scoreParts.push(`CASE WHEN p.user_id = $${i} THEN 1 ELSE 0 END`);
    }
    params.push(sellerId);
    i++;
  }

  const scoreExpr = scoreParts.join(" + ");
  const matchSql =
    matchParts.length > 0 ? `AND (${matchParts.join(" OR ")})` : "";

  params.push(limit);
  const limitIdx = i;

  const sql = `
    SELECT
      ${selectCols.join(", ")},
      (${scoreExpr}) AS rel_score
    FROM market.products p
    WHERE p.id <> $1
      ${avail}
      ${matchSql}
    ORDER BY rel_score DESC, ${order}
    LIMIT $${limitIdx}
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

async function fetchFallback(excludeId, limit, excludeIds = []) {
  const cols = await getProductColumns();
  const avail = availabilitySql(cols, "p");
  const order = orderSql(cols, "p");

  const selectCols = [
    "p.id",
    "p.slug",
    "p.name",
    "p.brand",
    "p.price",
    "p.original_price",
  ];
  if (cols.has("category_id")) selectCols.push("p.category_id");
  if (cols.has("seller_id")) selectCols.push("p.seller_id");
  if (cols.has("user_id")) selectCols.push("p.user_id");

  const params = [excludeId];
  let extraExclude = "";
  if (excludeIds.length) {
    params.push(excludeIds);
    extraExclude = `AND NOT (p.id = ANY($${params.length}::uuid[]))`;
  }
  params.push(limit);

  const { rows } = await pool.query(
    `SELECT ${selectCols.join(", ")}
     FROM market.products p
     WHERE p.id <> $1
       ${avail}
       ${extraExclude}
     ORDER BY ${order}
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

/* ════════════════════════════════════════════════════════════
   GET /:slugOrId/related
════════════════════════════════════════════════════════════ */

router.get("/:slugOrId/related", async (req, res) => {
  const slugOrId =
    req.params.slugOrId || req.params.slug || req.params.id || null;
  const limit = clampLimit(req.query.limit, 12, 24);

  console.log("[relatedProducts] GET related for:", slugOrId, "limit:", limit);

  if (!slugOrId) {
    return fail(res, 400, "Product slug or id is required");
  }

  try {
    const product = await resolveProduct(slugOrId);
    if (!product) {
      return fail(res, 404, "Product not found");
    }

    if (product.deleted_at) {
      return fail(res, 404, "Product not found");
    }

    let rows = [];
    try {
      rows = await fetchRelated(product, limit);
    } catch (err) {
      console.warn("[relatedProducts] scored query failed:", err.message);
      rows = [];
    }

    // Top up if few results
    if (rows.length < Math.min(6, limit)) {
      try {
        const have = rows.map((r) => r.id);
        const more = await fetchFallback(product.id, limit, have);
        const seen = new Set(have.map(String));
        for (const r of more) {
          if (seen.has(String(r.id))) continue;
          rows.push(r);
          seen.add(String(r.id));
          if (rows.length >= limit) break;
        }
      } catch (err) {
        console.warn("[relatedProducts] fallback failed:", err.message);
      }
    }

    const ids = rows.map((r) => r.id);
    const imageMap = await primaryImageMap(ids);
    const products = rows.map((r) => mapProduct(r, imageMap));

    console.log(
      "[relatedProducts] ✓",
      products.length,
      "items for",
      product.slug || product.id
    );

    return ok(res, {
      data: {
        product_id: product.id,
        products,
        items: products,
        count: products.length,
      },
    });
  } catch (err) {
    console.error("[relatedProducts] ❌", err.message);
    console.error(err.stack?.split("\n").slice(0, 5).join("\n"));
    return fail(res, 500, `Failed to load related products: ${err.message}`);
  }
});

export default router;