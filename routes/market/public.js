/**
 * routes/market/getproducts.js
 *
 * GET /api/products             → Public product listing
 * GET /api/products/categories  → Distinct categories (fallback)
 * GET /api/products/:idOrSlug   → Single product detail
 *
 * SEARCH (search= present):
 *   → 60 results per page (cap 200)
 *   → COUNT(*) SKIPPED — uses LIMIT+1 trick for hasMore
 *   → Default sort: relevance (ts_rank)
 *
 * BROWSE (no search):
 *   → 30 results per page
 *   → COUNT(*) included for page numbers
 *   → Default sort: newest
 *
 * PAGINATION GUARANTEE:
 *   Every ORDER BY ends with p.id for deterministic ordering.
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

const SEARCH_PAGE_SIZE = 60;
const SEARCH_MAX_LIMIT = 200;
const BROWSE_PAGE_SIZE = 30;

/* ══════════════════════════════════════════════════════════════
   GET /categories
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

    const isSearch = Boolean(search && search.trim());

    /* ── PAGINATION ──────────────────────────────────────────
       Search:  60 per page, hard cap 200, no COUNT(*)
       Browse:  30 per page, standard paginate(), COUNT(*)
    ────────────────────────────────────────────────────────── */
    let limit, offset;

    if (isSearch) {
      const requested = parseInt(req.query.limit, 10);
      limit = Number.isFinite(requested) && requested > 0
        ? Math.min(requested, SEARCH_MAX_LIMIT)
        : SEARCH_PAGE_SIZE;
      offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    } else {
      const pag = paginate(req.query);
      limit = pag.limit;
      offset = pag.offset;
    }

    // Random-order seed
    const rawSeed = String(req.query.seed || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 32);

    /* ── CONDITIONS ────────────────────────────────────────── */
    const conditions = [
      "p.deleted_at IS NULL",
      "p.status != 'deleted'",
      ...PUBLIC_CONDITIONS,
    ];

    const params = [];
    let p = 1;

    if (isSearch) {
      const cleaned = search.trim();
      conditions.push(
        `(p.search_vector @@ plainto_tsquery('english', $${p})
          OR p.name ILIKE $${p + 1}
          OR p.brand ILIKE $${p + 1}
          OR p.description ILIKE $${p + 1})`
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

    /* ── ORDER BY ──────────────────────────────────────────── */
    let order;
    let seedIdx = null;

    if (sort === "random" && rawSeed) {
      seedIdx = p++;
      order = `ROW_NUMBER() OVER (
                 PARTITION BY p.category
                 ORDER BY md5(p.id::text || $${seedIdx}::text), p.id
               ),
               md5(p.id::text || $${seedIdx}::text) ASC,
               p.id ASC`;
    } else if (sort === "diverse" || sort === "random") {
      order = `ROW_NUMBER() OVER (
                 PARTITION BY p.category
                 ORDER BY p.created_at DESC, p.id
               ),
               p.category ASC,
               p.id ASC`;
    } else if (sort === "relevance" && isSearch) {
      order = `ts_rank(p.search_vector, plainto_tsquery('english', $1)) DESC,
               p.sold_count DESC,
               p.created_at DESC,
               p.id ASC`;
    } else if (sort === "bestselling") {
      order = `p.sold_count DESC, p.created_at DESC, p.id ASC`;
    } else if (sort === "trending") {
      order = `(p.sold_count::float / GREATEST(EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400, 1)) DESC,
               p.created_at DESC,
               p.id ASC`;
    } else if (isSearch && sort === "newest") {
      // Search default: relevance first
      order = `ts_rank(p.search_vector, plainto_tsquery('english', $1)) DESC,
               p.created_at DESC,
               p.id ASC`;
    } else {
      order = `${SORT_MAP[sort] || SORT_MAP.newest}, p.id ASC`;
    }

    /* ── EXECUTE ───────────────────────────────────────────── */
    const queryParams = [...params, ...(seedIdx ? [rawSeed] : [])];
    const limitIdx = p++;
    const offsetIdx = p++;

    if (isSearch) {
      /* ── SEARCH PATH: no COUNT(*), LIMIT+1 trick ─────────
         Fetch limit + 1 rows. If we get 61 rows for limit=60,
         we know there are more. Slice off the extra row.
         This avoids the expensive full-table COUNT(*) scan.
      ──────────────────────────────────────────────────────── */
      const { rows } = await pool.query(
        `${FULL_PRODUCT_SELECT} ${where} ORDER BY ${order}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...queryParams, limit + 1, offset]
      );

      const hasMore = rows.length > limit;
      const products = hasMore ? rows.slice(0, limit) : rows;

      ok(res, {
        data: {
          products,
          sort: seedIdx ? "random" : sort,
          seed: seedIdx ? rawSeed : null,
          pagination: {
            total: null,
            page: Math.floor(offset / limit) + 1,
            limit,
            totalPages: null,
            hasMore,
          },
        },
      });
    } else {
      /* ── BROWSE PATH: COUNT(*) for page numbers ────────── */
      const [{ rows }, countRes] = await Promise.all([
        pool.query(
          `${FULL_PRODUCT_SELECT} ${where} ORDER BY ${order}
           LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
          [...queryParams, limit, offset]
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
    }
  } catch (err) {
    console.error("GET /api/products error:", err.message);
    fail(res, 500, "Failed to fetch products");
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /:idOrSlug
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
    if (isPublicProduct(product)) trackView(product.id, req).catch(() => {});

    ok(res, { data: product });
  } catch (err) {
    console.error("GET /api/products/:idOrSlug error:", err.message);
    fail(res, 500, "Failed to fetch product");
  }
});

/* ══════════════════════════════════════════════════════════════
   Track view
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
       SELECT 1 FROM market.product_views
       WHERE product_id = $1 AND ip_hash = $3
         AND created_at > now() - interval '24 hours'
     )`,
    [productId, req.user?.id ?? null, ipHash, req.query.source || "direct"]
  );

  if (result.rowCount > 0) {
    await pool.query(
      `UPDATE market.products SET view_count = view_count + 1 WHERE id = $1`,
      [productId]
    );
  }
}

export default router;