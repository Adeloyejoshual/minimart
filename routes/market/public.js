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
   GET /
   Public product listing
══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  try {
    const {
      category,
      search,
      brand,
      tags,
      featured,
      trending,
      sponsored,
      minPrice,
      maxPrice,
      sort = "newest",
    } = req.query;

    const { limit, offset } = paginate(req.query);

    const conditions = [...PUBLIC_CONDITIONS];
    const params = [];
    let p = 1;

    /* Search */
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
      conditions.push(`p.category = $${p++}`);
      params.push(category);
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

    if (featured === "true")  conditions.push("p.is_featured = true");
    if (trending === "true")  conditions.push("p.is_trending = true");
    if (sponsored === "true") conditions.push("p.is_sponsored = true");

    const where = `WHERE ${conditions.join(" AND ")}`;

    let order;
    if (sort === "relevance" && search) {
      order = `ts_rank(p.search_vector, plainto_tsquery('english', $1)) DESC, p.created_at DESC`;
    } else {
      order = SORT_MAP[sort] || SORT_MAP.newest;
    }

    const [{ rows }, countRes] = await Promise.all([
      pool.query(
        `${FULL_PRODUCT_SELECT}
         ${where}
         ORDER BY ${order}
         LIMIT $${p++} OFFSET $${p++}`,
        [...params, limit, offset]
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
        pagination: paginationMeta(total, limit, offset),
      },
    });
  } catch (err) {
    console.error("GET /api/products error:", err.message);
    console.error("GET /api/products code:", err.code);
    console.error("GET /api/products detail:", err.detail ?? "—");
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
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const whereClause = isUUID ? "p.id = $1" : "p.slug = $1";

    const { rows } = await pool.query(
      `${FULL_PRODUCT_SELECT}
       WHERE ${whereClause}
         AND p.deleted_at IS NULL`,
      [idOrSlug]
    );

    if (!rows.length) return fail(res, 404, "Product not found");

    const product = rows[0];

    const isAdmin = req.user?.role === "admin";
    const isOwner = req.user?.id   === product.user_id;
    const canSee  = isAdmin || isOwner || isPublicProduct(product);

    if (!canSee) return fail(res, 404, "Product not found");

    if (isPublicProduct(product)) {
      trackView(product.id, req).catch(() => {});
    }

    ok(res, { data: product });
  } catch (err) {
    console.error("GET /api/products/:idOrSlug error:", err.message);
    console.error("GET /api/products/:idOrSlug code:", err.code);
    console.error("GET /api/products/:idOrSlug detail:", err.detail ?? "—");
    fail(res, 500, "Failed to fetch product");
  }
});

/* ══════════════════════════════════════════════════════════════
   Track view (deduped by IP for 24h)
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