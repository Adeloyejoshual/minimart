/**
 * routes/market/getproducts.js
 *
 * GET /api/products             → Public product listing (paginated, filtered, sorted)
 * GET /api/products/categories  → Distinct categories from products table (fallback)
 * GET /api/products/:idOrSlug   → Single product detail
 *
 * Business rules:
 *  - Excludes soft-deleted products (deleted_at IS NOT NULL or status = 'deleted')
 *  - Category filtering by name OR category_id (UUID)
 *  - Variant-aware stock evaluation (base stock OR variant array stock)
 *  - sold_count is the urgency / social-proof signal
 *  - Default page size: 30 (controlled by helpers.js → paginate)
 *  - sort=diverse interleaves categories at the SQL level
 *
 * PAGINATION GUARANTEE:
 *  Every ORDER BY ends with p.id, a unique tiebreaker. Without it, products
 *  sharing the same created_at / sold_count can be ordered differently between
 *  requests, which makes LIMIT/OFFSET pages overlap (the same product shows
 *  up on page 1 and again on page 3). With p.id the order is fully
 *  deterministic, so each product appears on exactly one page.
 */

import express from "express";
import {
  pool,
  FULL_PRODUCT_SELECT,
  SORT_MAP,
  PUBLIC_CONDITIONS,
  paginate,
  paginationMeta,
  isPublicProduct,
  ok,
  fail,
} from "./helpers.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   GET /categories
   Fallback: distinct categories from the products table.
   Your primary categories come from /api/categories (market.categories table).
   This is a safety net in case the categories table is out of sync.

   ⚠️  MUST be before /:idOrSlug to avoid slug collision.
══════════════════════════════════════════════════════════════ */
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT p.category
       FROM market.products p
       WHERE p.deleted_at IS NULL
         AND p.status != 'deleted'
         AND p.category IS NOT NULL
         AND TRIM(p.category) != ''
         ${PUBLIC_CONDITIONS.length ? `AND ${PUBLIC_CONDITIONS.join(" AND ")}` : ""}
       ORDER BY p.category ASC`
    );

    const categories = rows
      .map((r) => (r.category || "").trim())
      .filter(Boolean);

    ok(res, { data: categories });
  } catch (err) {
    console.error("GET /api/products/categories error:", err.message);
    fail(res, 500, "Failed to fetch categories");
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /
   Public product listing
══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  try {
    // Never let a browser/CDN/proxy reuse an old shuffled page.
    res.set("Cache-Control", "no-store");
    const {
      category,
      search,
      brand,
      tags,
      featured,
      trending,
      sponsored,
      hasDelivery,
      inStock,
      minPrice,
      maxPrice,
      sort = "newest",
    } = req.query;

    const { limit, offset } = paginate(req.query);

    // Random-order seed: same seed = same order (stable pagination),
    // new seed = new random order (every page refresh).
    const rawSeed = String(req.query.seed || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 32);

    const conditions = [
      "p.deleted_at IS NULL",
      "p.status != 'deleted'",
      ...PUBLIC_CONDITIONS,
    ];

    const params = [];
    let p = 1;

    if (search) {
      const cleaned = search.trim();
      conditions.push(
        `(p.search_vector @@ plainto_tsquery('english', $${p})
          OR p.name ILIKE $${p + 1}
          OR p.brand ILIKE $${p + 1})`
      );
      params.push(cleaned, `%${cleaned}%`);
      p += 2;
    }

    if (category) {
      conditions.push(
        `(p.category ILIKE $${p} OR p.category_id::text = $${p})`
      );
      params.push(category.trim());
      p++;
    }

    if (brand) {
      conditions.push(`p.brand ILIKE $${p++}`);
      params.push(`%${brand.trim()}%`);
    }

    if (tags) {
      conditions.push(`p.tags && $${p++}::text[]`);
      params.push(tags.split(","));
    }

    if (minPrice) {
      conditions.push(`p.price >= $${p++}`);
      params.push(parseInt(minPrice, 10));
    }
    if (maxPrice) {
      conditions.push(`p.price <= $${p++}`);
      params.push(parseInt(maxPrice, 10));
    }

    if (featured === "true")    conditions.push("p.is_featured  = true");
    if (trending === "true")    conditions.push("p.is_trending  = true");
    if (sponsored === "true")   conditions.push("p.is_sponsored = true");
    if (hasDelivery === "true") conditions.push("p.has_delivery = true");

    if (inStock === "true") {
      conditions.push(
        `(
          COALESCE(p.stock, 0) > 0
          OR (
            p.variants IS NOT NULL
            AND jsonb_typeof(p.variants) = 'array'
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(p.variants) AS v
              WHERE COALESCE(
                (v->>'stock')::numeric,
                (v->>'quantity')::numeric,
                0
              ) > 0
            )
          )
        )`
      );
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    /* ── ORDER BY ──────────────────────────────────────────────
       Every branch ends with p.id so the order is total and
       stable across requests (no duplicates between pages).
    ─────────────────────────────────────────────────────────── */
    let order;
    let seedIdx = null;
    if (sort === "random" && rawSeed) {
      // Seeded random + category-interleaved.
      // md5(id || seed) gives each product a fixed pseudo-random rank for
      // this seed, so every page request sees the SAME shuffled order
      // (no duplicates) but a different seed gives a completely new order.
      // ROW_NUMBER per category keeps Fashion from dominating the feed.
      seedIdx = p++;
      order = `ROW_NUMBER() OVER (
                 PARTITION BY p.category
                 ORDER BY md5(p.id::text || $${seedIdx}::text), p.id
               ),
               md5(p.id::text || $${seedIdx}::text) ASC,
               p.id ASC`;
    } else if (sort === "diverse" || sort === "random") {
      // Category-interleaved sort.
      // ROW_NUMBER() ranks products 1,2,3... inside each category (newest first).
      // Ordering by that rank returns all rank-1 products first (one per
      // category), then all rank-2 products, and so on.
      // p.category and p.id break ties so the sequence never changes
      // between page requests.
      order = `ROW_NUMBER() OVER (
                 PARTITION BY p.category
                 ORDER BY p.created_at DESC, p.id
               ),
               p.category ASC,
               p.id ASC`;
    } else if (sort === "relevance" && search) {
      order = `ts_rank(p.search_vector, plainto_tsquery('english', $1)) DESC,
               p.created_at DESC,
               p.id ASC`;
    } else if (sort === "bestselling") {
      order = `p.sold_count DESC, p.created_at DESC, p.id ASC`;
    } else if (sort === "trending") {
      order = `(p.sold_count::float / GREATEST(EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400, 1)) DESC,
               p.created_at DESC,
               p.id ASC`;
    } else {
      order = `${SORT_MAP[sort] || SORT_MAP.newest}, p.id ASC`;
    }

    const limitIdx = p++;
    const offsetIdx = p++;

    const [{ rows }, countRes] = await Promise.all([
      pool.query(
        `${FULL_PRODUCT_SELECT}
         ${where}
         ORDER BY ${order}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, ...(seedIdx ? [rawSeed] : []), limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM market.products p ${where}`,
        params
      ),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);

    ok(res, {
      data: {
        products: rows,
        // Diagnostics: if "sort" is missing from the JSON, the old backend is still running.
        sort: seedIdx ? "random" : sort,
        seed: seedIdx ? rawSeed : null,
        pagination: {
          ...paginationMeta(total, limit, offset),
          total,
          page: Math.floor(offset / limit) + 1,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          hasMore: offset + rows.length < total,
        },
      },
    });
  } catch (err) {
    console.error("GET /api/products error:", err.message);
    fail(res, 500, "Failed to fetch products");
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /:idOrSlug
   Single product by UUID or slug
══════════════════════════════════════════════════════════════ */
router.get("/:idOrSlug", async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug
      );

    const whereClause = isUUID ? "p.id = $1" : "p.slug = $1";

    const { rows } = await pool.query(
      `${FULL_PRODUCT_SELECT}
       WHERE ${whereClause}
         AND p.deleted_at IS NULL
         AND p.status != 'deleted'`,
      [idOrSlug]
    );

    if (!rows.length) return fail(res, 404, "Product not found");

    const product = rows[0];

    const isAdmin = req.user?.role === "admin";
    const isOwner = req.user?.id === product.user_id;
    const canSee = isAdmin || isOwner || isPublicProduct(product);

    if (!canSee) return fail(res, 404, "Product not found");

    if (isPublicProduct(product)) {
      trackView(product.id, req).catch(() => {});
    }

    ok(res, { data: product });
  } catch (err) {
    console.error("GET /api/products/:idOrSlug error:", err.message);
    fail(res, 500, "Failed to fetch product");
  }
});

/* ══════════════════════════════════════════════════════════════
   Track view (deduped by IP hash for 24 h)
══════════════════════════════════════════════════════════════ */
async function trackView(productId, req) {
  const ipRaw =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  const { createHash } = await import("node:crypto");
  const ipHash = createHash("sha256")
    .update(ipRaw + productId)
    .digest("hex")
    .slice(0, 16);

  const result = await pool.query(
    `INSERT INTO market.product_views
       (product_id, viewer_id, ip_hash, source)
     SELECT $1, $2, $3, $4
     WHERE NOT EXISTS (
       SELECT 1
       FROM market.product_views
       WHERE product_id = $1
         AND ip_hash    = $3
         AND created_at > now() - interval '24 hours'
     )`,
    [
      productId,
      req.user?.id ?? null,
      ipHash,
      req.query.source || "direct",
    ]
  );

  if (result.rowCount > 0) {
    await pool.query(
      `UPDATE market.products
       SET view_count = view_count + 1
       WHERE id = $1`,
      [productId]
    );
  }
}

export default router;
