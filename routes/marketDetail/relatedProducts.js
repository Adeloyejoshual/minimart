/**
 * routes/market/getrelatedproducts.js
 *
 * GET /:slugOrId/related
 * Returns related products for ProductRails (horizontal "Related products")
 *
 * Strategy (in order):
 *  1. Same category + brand
 *  2. Same category
 *  3. Same brand
 *  4. Same seller
 *  5. Recent approved products (fallback)
 */

import express from "express";
import { pool, ok, fail } from "./helpers.js"; // adjust path if needed

const router = express.Router({ mergeParams: true });

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(s || "")
  );

async function resolveProduct(client, slugOrId) {
  if (isUuid(slugOrId)) {
    const { rows } = await client.query(
      `SELECT
         p.id, p.slug, p.name, p.brand, p.category_id,
         p.seller_id, p.user_id, p.price, p.original_price
       FROM market.products p
       WHERE p.id = $1
         AND p.deleted_at IS NULL
       LIMIT 1`,
      [slugOrId]
    );
    return rows[0] || null;
  }

  const { rows } = await client.query(
    `SELECT
       p.id, p.slug, p.name, p.brand, p.category_id,
       p.seller_id, p.user_id, p.price, p.original_price
     FROM market.products p
     WHERE p.slug = $1
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [slugOrId]
  );
  return rows[0] || null;
}

async function primaryImageMap(client, productIds) {
  if (!productIds.length) return new Map();

  const { rows } = await client.query(
    `SELECT DISTINCT ON (product_id)
       product_id,
       image_url
     FROM market.product_images
     WHERE product_id = ANY($1::uuid[])
     ORDER BY product_id,
              is_primary DESC NULLS LAST,
              sort_order ASC NULLS LAST,
              created_at ASC NULLS LAST`,
    [productIds]
  );

  const map = new Map();
  for (const r of rows) map.set(String(r.product_id), r.image_url);
  return map;
}

function mapProduct(row, imageMap) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand || null,
    price: Number(row.price ?? 0),
    original_price: Number(row.original_price ?? 0),
    image: imageMap.get(String(row.id)) || null,
    image_url: imageMap.get(String(row.id)) || null,
    seller_id: row.seller_id || row.user_id || null,
    category_id: row.category_id || null,
  };
}

/**
 * Core related query builder
 */
async function fetchRelated(client, product, limit = 12) {
  const sellerId = product.seller_id || product.user_id || null;
  const params = [product.id];
  let param = 2;

  // Build scored query: higher score = more relevant
  // score: same category+brand=4, category=2, brand=2, seller=1
  const scoreParts = [];
  const whereExtra = [];

  if (product.category_id) {
    scoreParts.push(
      `CASE WHEN p.category_id = $${param} THEN 2 ELSE 0 END`
    );
    whereExtra.push(`p.category_id = $${param}`);
    params.push(product.category_id);
    param++;
  }

  if (product.brand) {
    scoreParts.push(
      `CASE WHEN LOWER(COALESCE(p.brand,'')) = LOWER($${param}) THEN 2 ELSE 0 END`
    );
    whereExtra.push(`LOWER(COALESCE(p.brand,'')) = LOWER($${param})`);
    params.push(product.brand);
    param++;
  }

  if (sellerId) {
    scoreParts.push(
      `CASE WHEN COALESCE(p.seller_id, p.user_id) = $${param} THEN 1 ELSE 0 END`
    );
    // don't force seller-only filter; just score
    params.push(sellerId);
    param++;
  }

  const scoreExpr =
    scoreParts.length > 0 ? scoreParts.join(" + ") : "0";

  // Prefer products that match at least one signal; else fallback later
  const filterSql =
    whereExtra.length > 0
      ? `AND (${whereExtra.join(" OR ")})`
      : "";

  params.push(limit);

  const sql = `
    SELECT
      p.id,
      p.slug,
      p.name,
      p.brand,
      p.price,
      p.original_price,
      p.category_id,
      p.seller_id,
      p.user_id,
      (${scoreExpr}) AS rel_score
    FROM market.products p
    WHERE p.id <> $1
      AND p.deleted_at IS NULL
      AND p.is_active = true
      AND p.status IN ('approved', 'active')
      ${filterSql}
    ORDER BY rel_score DESC, p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST
    LIMIT $${param}
  `;

  const { rows } = await client.query(sql, params);
  return rows;
}

async function fetchFallback(client, excludeId, limit = 12) {
  const { rows } = await client.query(
    `SELECT
       p.id, p.slug, p.name, p.brand, p.price, p.original_price,
       p.category_id, p.seller_id, p.user_id
     FROM market.products p
     WHERE p.id <> $1
       AND p.deleted_at IS NULL
       AND p.is_active = true
       AND p.status IN ('approved', 'active')
     ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST
     LIMIT $2`,
    [excludeId, limit]
  );
  return rows;
}

/* ════════════════════════════════════════════════════════════
   GET /:slugOrId/related
════════════════════════════════════════════════════════════ */
router.get("/:slugOrId/related", async (req, res) => {
  const slugOrId = req.params.slugOrId || req.params.slug || req.params.id;
  const limit = Math.min(
    Math.max(parseInt(req.query.limit, 10) || 12, 1),
    24
  );

  if (!slugOrId) {
    return fail(res, 400, "Product slug or id is required");
  }

  const client = await pool.connect();
  try {
    const product = await resolveProduct(client, slugOrId);
    if (!product) {
      return fail(res, 404, "Product not found");
    }

    let rows = await fetchRelated(client, product, limit);

    // If too few, top up with fallback (excluding already picked)
    if (rows.length < Math.min(6, limit)) {
      const fallback = await fetchFallback(client, product.id, limit);
      const seen = new Set(rows.map((r) => String(r.id)));
      for (const f of fallback) {
        if (seen.has(String(f.id))) continue;
        rows.push(f);
        if (rows.length >= limit) break;
      }
    }

    const ids = rows.map((r) => r.id);
    const imageMap = await primaryImageMap(client, ids);
    const products = rows.map((r) => mapProduct(r, imageMap));

    return ok(res, {
      data: {
        product_id: product.id,
        products,
        items: products, // alias for flexible frontends
        count: products.length,
      },
    });
  } catch (err) {
    console.error("[getrelatedproducts] error:", err.message);
    console.error(err.stack?.split("\n").slice(0, 4).join("\n"));
    return fail(res, 500, `Failed to load related products: ${err.message}`);
  } finally {
    client.release();
  }
});

export default router;