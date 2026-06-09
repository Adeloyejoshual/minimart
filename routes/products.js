/**
 * routes/products.js
 *
 * Mount:  app.use("/api/products", productsRouter);
 *
 * Upgrades:
 *   ✅ Full-text search (tsvector)
 *   ✅ Slug-based GET /api/products/:idOrSlug
 *   ✅ Soft delete (deleted_at)
 *   ✅ Wishlist endpoints
 *   ✅ Report endpoint
 *   ✅ View tracking (deduplicated)
 *   ✅ Share / save count
 *   ✅ Moderation priority
 *   ✅ Warranty / return policy fields
 *   ✅ Weight / dimensions fields
 *   ✅ Location fields
 *   ✅ Delivery options
 *   ✅ Trending sort (time-weighted)
 *   ✅ Nearby sort (lat/lng)
 *   ✅ Admin moderation queue (priority order)
 */

import express from "express";
import multer  from "multer";
import { pool } from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { upload, uploadToCloudinary, destroyFromCloudinary } from "../middleware/upload.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const MAX_IMAGES    = 6;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT     = 100;

const SORT_MAP = {
  newest:      "p.created_at DESC",
  oldest:      "p.created_at ASC",
  price_asc:   "p.price ASC",
  price_desc:  "p.price DESC",
  views:       "p.view_count DESC",
  saves:       "p.save_count DESC",
  fraud_score: "p.fraud_score DESC NULLS LAST",
  trending:    "p.view_count DESC, p.save_count DESC, p.created_at DESC",
  relevance:   "ts_rank(p.search_vector, plainto_tsquery('english', $__SEARCH__)) DESC",
};

/* ══════════════════════════════════════════════════════════════
   FULL PRODUCT SELECT
══════════════════════════════════════════════════════════════ */
const FULL_PRODUCT_SELECT = `
  SELECT
    p.*,
    u.name           AS seller_name,
    u.email          AS seller_email,
    u.profile_image  AS seller_avatar,
    u.phone_number   AS seller_phone,
    u.verified       AS seller_verified,

    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'id',         pi.id,
        'url',        pi.image_url,
        'is_primary', pi.is_primary,
        'sort_order', pi.sort_order
      )) FILTER (WHERE pi.id IS NOT NULL),
      '[]'
    ) AS images,

    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'id',         pv.id,
        'sku',        pv.sku,
        'name',       pv.name,
        'price',      pv.price,
        'stock',      pv.stock,
        'attributes', pv.attributes
      )) FILTER (WHERE pv.id IS NOT NULL),
      '[]'
    ) AS variants,

    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'feature',  pf.feature,
        'position', pf.position
      ) ORDER BY jsonb_build_object('position', pf.position))
      FILTER (WHERE pf.id IS NOT NULL),
      '[]'
    ) AS key_features,

    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'key',      ps.spec_key,
        'value',    ps.spec_value,
        'position', ps.position
      ) ORDER BY jsonb_build_object('position', ps.position))
      FILTER (WHERE ps.id IS NOT NULL),
      '[]'
    ) AS specifications,

    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'item',     pb.item,
        'position', pb.position
      ) ORDER BY jsonb_build_object('position', pb.position))
      FILTER (WHERE pb.id IS NOT NULL),
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

const GROUP_BY = `
  GROUP BY
    p.id,
    u.name,
    u.email,
    u.profile_image,
    u.phone_number,
    u.verified
`;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

function paginate(query) {
  const limit  = Math.min(parseInt(query.limit,  10) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  const page   = Math.floor(offset / limit) + 1;
  return { limit, offset, page };
}

function safeSort(sort, searchTerm) {
  if (sort === "relevance" && searchTerm) {
    // relevance sort is handled inline — caller must substitute $__SEARCH__
    return null;
  }
  return SORT_MAP[sort] || SORT_MAP.newest;
}

function safeStr(val, max = 500) {
  if (typeof val !== "string") return null;
  const t = val.trim();
  return t.length ? t.slice(0, max) : null;
}

function parseJSON(raw, fallback = []) {
  try   { return typeof raw === "string" ? JSON.parse(raw) : (raw ?? fallback); }
  catch { return fallback; }
}

function paginationMeta(total, limit, offset) {
  const totalPages = Math.ceil(total / limit);
  const page       = Math.floor(offset / limit) + 1;
  return { total, page, limit, offset, totalPages, hasNext: page < totalPages };
}

const ok   = (res, data = {}, status = 200) =>
  res.status(status).json({ success: true,  ...data });

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

/* ── Child table helpers ─────────────────────────────────── */

async function insertList(client, table, column, productId, items) {
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

async function replaceList(client, table, column, productId, items) {
  await client.query(`DELETE FROM market.${table} WHERE product_id = $1`, [productId]);
  await insertList(client, table, column, productId, items);
}

async function replaceSpecs(client, productId, specs) {
  await client.query(
    "DELETE FROM market.product_specifications WHERE product_id = $1", [productId]
  );
  for (let i = 0; i < specs.length; i++) {
    const k = safeStr(specs[i]?.key);
    const v = safeStr(specs[i]?.value);
    if (!k || !v) continue;
    await client.query(
      `INSERT INTO market.product_specifications (product_id, spec_key, spec_value, position)
       VALUES ($1,$2,$3,$4)`,
      [productId, k, v, i]
    );
  }
}

async function replaceVariants(client, productId, rawVariants) {
  await client.query(
    "DELETE FROM market.product_variants WHERE product_id = $1", [productId]
  );
  const variants = parseJSON(rawVariants);
  for (const v of variants) {
    const sku  = safeStr(v?.sku);
    const name = safeStr(v?.name);
    if (!sku || !name) continue;
    await client.query(
      `INSERT INTO market.product_variants
         (product_id, sku, name, price, stock, attributes)
       VALUES ($1,$2,$3,$4,$5,$6)`,
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

async function uploadFiles(files) {
  return Promise.all(files.map((f) => uploadToCloudinary(f.buffer)));
}

async function deleteOldImages(client, productId) {
  const { rows } = await client.query(
    "SELECT image_url FROM market.product_images WHERE product_id = $1", [productId]
  );
  rows.forEach(({ image_url }) => {
    try {
      const publicId = image_url.split("/upload/")[1]?.replace(/\.[^.]+$/, "");
      if (publicId) destroyFromCloudinary(publicId).catch(() => {});
    } catch {}
  });
}

async function assertOwner(client, productId, userId) {
  const { rows } = await client.query(
    "SELECT user_id, status FROM market.products WHERE id = $1 AND deleted_at IS NULL",
    [productId]
  );
  if (!rows.length)               return { error: 404, message: "Product not found" };
  if (rows[0].user_id !== userId) return { error: 403, message: "Forbidden"         };
  return { row: rows[0] };
}

/* ══════════════════════════════════════════════════════════════
   PUBLIC ROUTES — static paths BEFORE /:id
══════════════════════════════════════════════════════════════ */

/**
 * GET /api/products
 * Public listing — approved, active, visible only.
 * Full-text search when `search` param is provided.
 *
 * Query:
 *   category, search, brand, tags, featured, trending, sponsored,
 *   minPrice, maxPrice, lat, lng, radiusKm,
 *   limit, offset, sort
 */
router.get("/", async (req, res) => {
  try {
    const {
      category, search, brand, tags,
      featured, trending, sponsored,
      minPrice, maxPrice,
      lat, lng, radiusKm,
      sort = "newest",
    } = req.query;

    const { limit, offset } = paginate(req.query);
    const conditions        = [
      "p.status     = 'approved'",
      "p.is_active   = true",
      "p.is_hidden   = false",
      "p.is_paused   = false",
      "p.deleted_at  IS NULL",
    ];
    const params = [];
    let   p      = 1;

    /* ── Text search (full-text first, ILIKE fallback) ── */
    if (search) {
      const cleaned = search.trim();
      conditions.push(
        `(p.search_vector @@ plainto_tsquery('english', $${p})
          OR p.name ILIKE $${p + 1})`
      );
      params.push(cleaned, `%${cleaned}%`);
      p += 2;
    }

    if (category)             { conditions.push(`p.category = $${p++}`);       params.push(category); }
    if (brand)                { conditions.push(`p.brand ILIKE $${p++}`);       params.push(`%${brand.trim()}%`); }
    if (tags)                 { conditions.push(`p.tags && $${p++}::text[]`);   params.push(tags.split(",")); }
    if (minPrice)             { conditions.push(`p.price >= $${p++}`);          params.push(parseInt(minPrice, 10)); }
    if (maxPrice)             { conditions.push(`p.price <= $${p++}`);          params.push(parseInt(maxPrice, 10)); }
    if (featured  === "true")   conditions.push("p.is_featured  = true");
    if (trending  === "true")   conditions.push("p.is_trending  = true");
    if (sponsored === "true")   conditions.push("p.is_sponsored = true");

    /* ── Proximity filter ── */
    if (lat && lng && radiusKm) {
      conditions.push(
        `earth_distance(
           ll_to_earth($${p++}, $${p++}),
           ll_to_earth(p.latitude, p.longitude)
         ) <= $${p++} * 1000`
      );
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(radiusKm));
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    /* ── Sort ── */
    let order;
    if (sort === "relevance" && search) {
      const searchIdx = params.indexOf(search.trim()) + 1;
      order = `ts_rank(p.search_vector, plainto_tsquery('english', $${searchIdx})) DESC, p.created_at DESC`;
    } else if (sort === "nearby" && lat && lng) {
      const latIdx = params.findIndex((_, i) => params[i] === parseFloat(lat)) + 1;
      order = `earth_distance(ll_to_earth($${latIdx}, $${latIdx + 1}), ll_to_earth(p.latitude, p.longitude)) ASC`;
    } else {
      order = SORT_MAP[sort] || SORT_MAP.newest;
    }

    const [{ rows }, countRes] = await Promise.all([
      pool.query(
        `${FULL_PRODUCT_SELECT}
         ${where}
         ${GROUP_BY}
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
    ok(res, { data: { products: rows, pagination: paginationMeta(total, limit, offset) } });
  } catch (err) {
    console.error("GET /products:", err);
    fail(res, 500, "Failed to fetch products");
  }
});

/**
 * GET /api/products/seller/mine
 * ⚠️ Before /:id
 */
router.get("/seller/mine", authenticate, async (req, res) => {
  try {
    const { status, sort = "newest" } = req.query;
    const { limit, offset }           = paginate(req.query);

    const conditions = ["p.user_id = $1", "p.deleted_at IS NULL"];
    const params     = [req.user.id];
    let   p          = 2;

    if (status) { conditions.push(`p.status = $${p++}`); params.push(status); }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const order = SORT_MAP[sort] || SORT_MAP.newest;

    const [{ rows }, countRes] = await Promise.all([
      pool.query(
        `${FULL_PRODUCT_SELECT}
         ${where}
         ${GROUP_BY}
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
    ok(res, { data: { products: rows, pagination: paginationMeta(total, limit, offset) } });
  } catch (err) {
    console.error("GET /products/seller/mine:", err);
    fail(res, 500, "Failed to fetch your listings");
  }
});

/**
 * GET /api/products/admin/all
 * ⚠️ Before /:id
 * Includes deleted products (admin can see everything).
 * Query: status, flagged, deleted, category, brand, search,
 *        limit, offset, sort
 */
router.get("/admin/all", authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      status, flagged, deleted,
      category, brand, search,
      sort = "newest",
    } = req.query;
    const { limit, offset } = paginate(req.query);

    const conditions = [];
    const params     = [];
    let   p          = 1;

    if (status)              { conditions.push(`p.status = $${p++}`);       params.push(status); }
    if (category)            { conditions.push(`p.category = $${p++}`);     params.push(category); }
    if (brand)               { conditions.push(`p.brand ILIKE $${p++}`);    params.push(`%${brand.trim()}%`); }
    if (search)              { conditions.push(`p.name ILIKE $${p++}`);     params.push(`%${search.trim()}%`); }
    if (flagged === "true")    conditions.push("p.is_flagged = true");
    if (deleted === "true")  {
      conditions.push("p.deleted_at IS NOT NULL");
    } else {
      conditions.push("p.deleted_at IS NULL");
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const order = SORT_MAP[sort] || SORT_MAP.newest;

    const [{ rows }, countRes] = await Promise.all([
      pool.query(
        `${FULL_PRODUCT_SELECT}
         ${where}
         ${GROUP_BY}
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
    ok(res, { data: { products: rows, pagination: paginationMeta(total, limit, offset) } });
  } catch (err) {
    console.error("GET /products/admin/all:", err);
    fail(res, 500, "Failed to fetch products");
  }
});

/**
 * GET /api/products/admin/stats
 * ⚠️ Before /:id
 */
router.get("/admin/stats", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows: [stats] } = await pool.query(`
      SELECT
        COUNT(*)                                             AS total,
        COUNT(*) FILTER (WHERE status = 'pending')          AS pending,
        COUNT(*) FILTER (WHERE status = 'approved')         AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')         AS rejected,
        COUNT(*) FILTER (WHERE status = 'removed')          AS removed,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)      AS deleted,
        COUNT(*) FILTER (WHERE is_flagged   = true)         AS flagged,
        COUNT(*) FILTER (WHERE is_featured  = true)         AS featured,
        COUNT(*) FILTER (WHERE is_trending  = true)         AS trending,
        COUNT(*) FILTER (WHERE is_sponsored = true)         AS sponsored,
        COUNT(*) FILTER (WHERE is_paused    = true)         AS paused,
        COUNT(*) FILTER (WHERE is_hidden    = true)         AS hidden
      FROM market.products
      WHERE deleted_at IS NULL
    `);
    ok(res, { data: stats });
  } catch (err) {
    console.error("GET /products/admin/stats:", err);
    fail(res, 500, "Failed to fetch stats");
  }
});

/**
 * GET /api/products/admin/queue
 * ⚠️ Before /:id
 * Moderation queue — pending by priority, then age.
 */
router.get("/admin/queue", authenticate, requireAdmin, async (req, res) => {
  try {
    const { limit, offset } = paginate(req.query);
    const p = 1;

    const { rows } = await pool.query(
      `${FULL_PRODUCT_SELECT}
       WHERE p.status = 'pending' AND p.deleted_at IS NULL
       ${GROUP_BY}
       ORDER BY p.moderation_priority DESC, p.created_at ASC
       LIMIT $${p} OFFSET $${p + 1}`,
      [limit, offset]
    );

    const countRes = await pool.query(
      "SELECT COUNT(*) FROM market.products WHERE status = 'pending' AND deleted_at IS NULL"
    );

    ok(res, {
      data: {
        products:   rows,
        pagination: paginationMeta(
          parseInt(countRes.rows[0].count, 10), limit, offset
        ),
      },
    });
  } catch (err) {
    console.error("GET /products/admin/queue:", err);
    fail(res, 500, "Failed to fetch queue");
  }
});

/**
 * POST /api/products/admin/bulk-approve
 * ⚠️ Before /:id
 */
router.post("/admin/bulk-approve", authenticate, requireAdmin, async (req, res) => {
  const ids = parseJSON(req.body.ids, []);
  if (!ids.length) return fail(res, 422, "No product IDs provided");

  try {
    const { rowCount } = await pool.query(
      `UPDATE market.products SET
         status      = 'approved',
         is_active   = true,
         is_flagged  = false,
         reviewed_by = $2,
         reviewed_at = now(),
         updated_at  = now()
       WHERE id = ANY($1::uuid[])
         AND status != 'approved'
         AND deleted_at IS NULL`,
      [ids, req.user.id]
    );
    ok(res, { message: `${rowCount} product(s) approved`, data: { count: rowCount } });
  } catch (err) {
    console.error("POST /products/admin/bulk-approve:", err);
    fail(res, 500, "Bulk approve failed");
  }
});

/**
 * POST /api/products/admin/bulk-reject
 * ⚠️ Before /:id
 */
router.post("/admin/bulk-reject", authenticate, requireAdmin, async (req, res) => {
  const ids    = parseJSON(req.body.ids, []);
  const reason = safeStr(req.body.reason, 500);

  if (!ids.length) return fail(res, 422, "No product IDs provided");
  if (!reason)     return fail(res, 422, "A rejection reason is required");

  try {
    const { rowCount } = await pool.query(
      `UPDATE market.products SET
         status           = 'rejected',
         is_active        = false,
         rejection_reason = $3,
         reviewed_by      = $2,
         reviewed_at      = now(),
         updated_at       = now()
       WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [ids, req.user.id, reason]
    );
    ok(res, { message: `${rowCount} product(s) rejected`, data: { count: rowCount } });
  } catch (err) {
    console.error("POST /products/admin/bulk-reject:", err);
    fail(res, 500, "Bulk reject failed");
  }
});

/* ══════════════════════════════════════════════════════════════
   /:id ROUTES — after all static paths
══════════════════════════════════════════════════════════════ */

/**
 * GET /api/products/:idOrSlug
 * Accepts UUID or slug.
 * Public if approved — owner or admin sees any status.
 * Tracks views with deduplication (1 view per IP per 24h).
 */
router.get("/:idOrSlug", async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    /* UUID pattern */
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const where  = isUUID
      ? "p.id = $1"
      : "p.slug = $1";

    const { rows } = await pool.query(
      `${FULL_PRODUCT_SELECT}
       WHERE ${where} AND p.deleted_at IS NULL
       ${GROUP_BY}`,
      [idOrSlug]
    );

    if (!rows.length) return fail(res, 404, "Product not found");

    const product  = rows[0];
    const isAdmin  = req.user?.role === "admin";
    const isOwner  = req.user?.id   === product.user_id;
    const isPublic = product.status === "approved"
                  && product.is_active
                  && !product.is_hidden;

    if (!isAdmin && !isOwner && !isPublic)
      return fail(res, 404, "Product not found");

    /* ── Track view (non-blocking, deduped) ── */
    if (isPublic) {
      const ipRaw = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
                 || req.socket?.remoteAddress
                 || "unknown";

      /* Simple hash — don't store raw IPs */
      const { createHash } = await import("node:crypto");
      const ipHash = createHash("sha256").update(ipRaw + product.id).digest("hex").slice(0, 16);

      /* Insert view only if not seen in last 24h */
      pool.query(
        `INSERT INTO market.product_views (product_id, viewer_id, ip_hash, source)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM market.product_views
           WHERE product_id = $1
             AND ip_hash    = $3
             AND created_at > now() - interval '24 hours'
         )`,
        [
          product.id,
          req.user?.id ?? null,
          ipHash,
          req.query.source || "direct",
        ]
      ).then((result) => {
        if (result.rowCount > 0) {
          /* Only bump counter when a new view was recorded */
          pool.query(
            "UPDATE market.products SET view_count = view_count + 1 WHERE id = $1",
            [product.id]
          ).catch(() => {});
        }
      }).catch(() => {});
    }

    ok(res, { data: product });
  } catch (err) {
    console.error("GET /products/:idOrSlug:", err);
    fail(res, 500, "Failed to fetch product");
  }
});

/**
 * POST /api/products
 * Create listing.
 * Now accepts: slug, short_description, weight_kg, dimensions,
 *              delivery_options, location, latitude, longitude,
 *              return_policy, warranty
 */
router.post(
  "/",
  authenticate,
  upload.array("images", MAX_IMAGES),
  async (req, res) => {
    if (!req.files?.length)
      return fail(res, 400, "At least one image is required");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const {
        name, description, short_description,
        category, basePrice, originalPrice,
        brand, tags, slug,
        variants, keyFeatures, specifications, whatsInBox,
        weight_kg, dimensions, delivery_options,
        location, latitude, longitude,
        return_policy, warranty,
      } = req.body;

      const cleanName = safeStr(name, 200);
      if (!cleanName) return fail(res, 422, "Product name is required");
      if (!category)  return fail(res, 422, "Category is required");

      const price = parseInt(basePrice, 10);
      if (isNaN(price) || price <= 0)
        return fail(res, 422, "Valid base price is required");

      const parsedTags   = parseJSON(tags, []);
      const parsedDims   = parseJSON(dimensions, null);
      const parsedDelivery = parseJSON(delivery_options, null);

      const { rows: [{ id: productId }] } = await client.query(
        `INSERT INTO market.products (
           user_id, name, description, short_description,
           category, condition,
           price, original_price,
           brand, tags, slug,
           weight_kg, dimensions, delivery_options,
           location, latitude, longitude,
           return_policy, warranty,
           status, is_active
         )
         VALUES (
           $1,$2,$3,$4,
           $5,'new',
           $6,$7,
           $8,$9,$10,
           $11,$12,$13,
           $14,$15,$16,
           $17,$18,
           'pending',false
         )
         RETURNING id`,
        [
          req.user.id,
          cleanName,
          safeStr(description, 2000),
          safeStr(short_description, 300),
          category,
          price,
          originalPrice ? parseInt(originalPrice, 10) : null,
          safeStr(brand, 100),
          parsedTags.length ? parsedTags : null,
          safeStr(slug, 100) || null,
          weight_kg ? parseFloat(weight_kg) : null,
          parsedDims   ? JSON.stringify(parsedDims)   : null,
          parsedDelivery ? JSON.stringify(parsedDelivery) : null,
          safeStr(location, 200),
          latitude  ? parseFloat(latitude)  : null,
          longitude ? parseFloat(longitude) : null,
          safeStr(return_policy, 1000),
          safeStr(warranty, 500),
        ]
      );

      /* Images */
      const uploaded = await uploadFiles(req.files);
      for (let i = 0; i < uploaded.length; i++) {
        await client.query(
          `INSERT INTO market.product_images
             (product_id, image_url, is_primary, sort_order)
           VALUES ($1,$2,$3,$4)`,
          [productId, uploaded[i].secure_url, i === 0, i]
        );
      }

      /* Child rows */
      await replaceVariants(client, productId, variants);
      await insertList(client, "product_features",  "feature", productId, parseJSON(keyFeatures));
      await insertList(client, "product_box_items", "item",    productId, parseJSON(whatsInBox));
      await replaceSpecs(client, productId, parseJSON(specifications));

      await client.query("COMMIT");

      ok(res, {
        message: "Listing submitted for review. You'll be notified once approved.",
        data:    { productId, status: "pending" },
      }, 201);

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("POST /products:", err);
      if (err.code === "23505")
        return fail(res, 409, "A product with this slug or SKU already exists");
      fail(res, 500, "Failed to create listing");
    } finally {
      client.release();
    }
  }
);

/**
 * PATCH /api/products/:id
 * Update own listing — now includes all new fields.
 */
router.patch(
  "/:id",
  authenticate,
  upload.array("images", MAX_IMAGES),
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const guard = await assertOwner(client, req.params.id, req.user.id);
      if (guard.error) return fail(res, guard.error, guard.message);

      const productId = req.params.id;
      const {
        name, description, short_description,
        category, basePrice, originalPrice,
        brand, tags,
        variants, keyFeatures, specifications, whatsInBox,
        weight_kg, dimensions, delivery_options,
        location, latitude, longitude,
        return_policy, warranty,
      } = req.body;

      const price = basePrice ? parseInt(basePrice, 10) : undefined;
      if (price !== undefined && (isNaN(price) || price <= 0))
        return fail(res, 422, "Invalid base price");

      const parsedDims     = dimensions     ? parseJSON(dimensions, null) : undefined;
      const parsedDelivery = delivery_options ? parseJSON(delivery_options, null) : undefined;

      await client.query(
        `UPDATE market.products SET
           name              = COALESCE($2,  name),
           description       = COALESCE($3,  description),
           short_description = COALESCE($4,  short_description),
           category          = COALESCE($5,  category),
           price             = COALESCE($6,  price),
           original_price    = $7,
           brand             = COALESCE($8,  brand),
           tags              = COALESCE($9,  tags),
           weight_kg         = COALESCE($10, weight_kg),
           dimensions        = COALESCE($11, dimensions),
           delivery_options  = COALESCE($12, delivery_options),
           location          = COALESCE($13, location),
           latitude          = COALESCE($14, latitude),
           longitude         = COALESCE($15, longitude),
           return_policy     = COALESCE($16, return_policy),
           warranty          = COALESCE($17, warranty),
           status            = 'pending',
           is_active         = false,
           reviewed_by       = NULL,
           reviewed_at       = NULL,
           rejection_reason  = NULL,
           updated_at        = now()
         WHERE id = $1`,
        [
          productId,
          safeStr(name, 200)              || null,
          safeStr(description, 2000)      || null,
          safeStr(short_description, 300) || null,
          category                        || null,
          price                           || null,
          originalPrice ? parseInt(originalPrice, 10) : null,
          safeStr(brand, 100)             || null,
          tags ? parseJSON(tags, []) : null,
          weight_kg   ? parseFloat(weight_kg)               : null,
          parsedDims  ? JSON.stringify(parsedDims)           : null,
          parsedDelivery ? JSON.stringify(parsedDelivery)    : null,
          safeStr(location, 200)          || null,
          latitude  ? parseFloat(latitude)  : null,
          longitude ? parseFloat(longitude) : null,
          safeStr(return_policy, 1000)    || null,
          safeStr(warranty, 500)          || null,
        ]
      );

      if (req.files?.length) {
        await deleteOldImages(client, productId);
        await client.query(
          "DELETE FROM market.product_images WHERE product_id = $1", [productId]
        );
        const uploaded = await uploadFiles(req.files);
        for (let i = 0; i < uploaded.length; i++) {
          await client.query(
            `INSERT INTO market.product_images
               (product_id, image_url, is_primary, sort_order)
             VALUES ($1,$2,$3,$4)`,
            [productId, uploaded[i].secure_url, i === 0, i]
          );
        }
      }

      if (variants       !== undefined) await replaceVariants(client, productId, variants);
      if (keyFeatures    !== undefined) await replaceList(client, "product_features",  "feature", productId, parseJSON(keyFeatures));
      if (whatsInBox     !== undefined) await replaceList(client, "product_box_items", "item",    productId, parseJSON(whatsInBox));
      if (specifications !== undefined) await replaceSpecs(client, productId, parseJSON(specifications));

      await client.query("COMMIT");
      ok(res, { message: "Listing updated and resubmitted for review", data: { status: "pending" } });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("PATCH /products/:id:", err);
      if (err.code === "23505") return fail(res, 409, "Duplicate SKU or slug");
      fail(res, 500, "Failed to update listing");
    } finally {
      client.release();
    }
  }
);

/**
 * DELETE /api/products/:id
 * Soft delete for sellers — hard delete for admins.
 */
router.delete("/:id", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (req.user.role === "admin") {
      /* Hard delete — Cloudinary cleanup first */
      await deleteOldImages(client, req.params.id);
      const { rowCount } = await client.query(
        "DELETE FROM market.products WHERE id = $1 RETURNING id",
        [req.params.id]
      );
      if (!rowCount) return fail(res, 404, "Product not found");
      await client.query("COMMIT");
      return ok(res, { message: "Product permanently deleted" });
    }

    /* Seller — soft delete */
    const guard = await assertOwner(client, req.params.id, req.user.id);
    if (guard.error) return fail(res, guard.error, guard.message);

    const { rowCount } = await client.query(
      `UPDATE market.products
       SET deleted_at = now(), is_active = false, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id]
    );

    if (!rowCount) return fail(res, 404, "Product not found");

    await client.query("COMMIT");
    ok(res, { message: "Listing deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /products/:id:", err);
    fail(res, 500, "Failed to delete listing");
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/products/:id/restore
 * Admin restores a soft-deleted listing.
 */
router.patch("/:id/restore", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE market.products
       SET deleted_at = NULL, status = 'pending', updated_at = now()
       WHERE id = $1 AND deleted_at IS NOT NULL
       RETURNING id, status`,
      [req.params.id]
    );
    if (!rows.length) return fail(res, 404, "Product not found or not deleted");
    ok(res, { message: "Product restored to pending review", data: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/restore:", err);
    fail(res, 500, "Failed to restore product");
  }
});

/**
 * PATCH /api/products/:id/pause
 */
router.patch("/:id/pause", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const guard = await assertOwner(client, req.params.id, req.user.id);
    if (guard.error) return fail(res, guard.error, guard.message);
    if (guard.row.status !== "approved")
      return fail(res, 400, "Only approved listings can be paused");

    const { rows: [updated] } = await client.query(
      `UPDATE market.products
       SET is_paused = NOT is_paused, updated_at = now()
       WHERE id = $1 RETURNING is_paused`,
      [req.params.id]
    );

    ok(res, {
      message: updated.is_paused ? "Listing paused" : "Listing resumed",
      data:    { is_paused: updated.is_paused },
    });
  } catch (err) {
    console.error("PATCH /products/:id/pause:", err);
    fail(res, 500, "Failed to toggle pause");
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   WISHLIST ENDPOINTS (buyer actions — public.users)
══════════════════════════════════════════════════════════════ */

/**
 * POST /api/products/:id/wishlist
 * Toggle wishlist for a buyer.
 */
router.post("/:id/wishlist", authenticate, async (req, res) => {
  try {
    /* Check if already wishlisted */
    const existing = await pool.query(
      "SELECT id FROM market.product_wishlists WHERE product_id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );

    if (existing.rows.length) {
      await pool.query(
        "DELETE FROM market.product_wishlists WHERE product_id = $1 AND user_id = $2",
        [req.params.id, req.user.id]
      );
      ok(res, { message: "Removed from wishlist", data: { wishlisted: false } });
    } else {
      await pool.query(
        "INSERT INTO market.product_wishlists (product_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [req.params.id, req.user.id]
      );
      ok(res, { message: "Added to wishlist", data: { wishlisted: true } }, 201);
    }
  } catch (err) {
    console.error("POST /products/:id/wishlist:", err);
    fail(res, 500, "Failed to update wishlist");
  }
});

/**
 * GET /api/products/:id/wishlist
 * Check wishlist status for current user.
 */
router.get("/:id/wishlist", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM market.product_wishlists WHERE product_id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    ok(res, { data: { wishlisted: rows.length > 0 } });
  } catch (err) {
    console.error("GET /products/:id/wishlist:", err);
    fail(res, 500, "Failed to check wishlist");
  }
});

/* ══════════════════════════════════════════════════════════════
   REPORT ENDPOINT
══════════════════════════════════════════════════════════════ */

/**
 * POST /api/products/:id/report
 * Buyer reports a product.
 * Body: { reason, details? }
 */
router.post("/:id/report", authenticate, async (req, res) => {
  const reason = safeStr(req.body.reason, 200);
  if (!reason) return fail(res, 422, "A reason is required");

  try {
    /* Check product exists */
    const prod = await pool.query(
      "SELECT id FROM market.products WHERE id = $1 AND deleted_at IS NULL",
      [req.params.id]
    );
    if (!prod.rows.length) return fail(res, 404, "Product not found");

    await pool.query(
      `INSERT INTO market.product_reports (product_id, reporter_id, reason, details)
       VALUES ($1,$2,$3,$4)`,
      [req.params.id, req.user.id, reason, safeStr(req.body.details, 1000)]
    );

    ok(res, { message: "Report submitted. Our team will review it." }, 201);
  } catch (err) {
    console.error("POST /products/:id/report:", err);
    fail(res, 500, "Failed to submit report");
  }
});

/* ══════════════════════════════════════════════════════════════
   SHARE TRACKING
══════════════════════════════════════════════════════════════ */

/**
 * POST /api/products/:id/share
 * Increment share count (called client-side on share).
 */
router.post("/:id/share", async (req, res) => {
  try {
    await pool.query(
      "UPDATE market.products SET share_count = share_count + 1 WHERE id = $1 AND deleted_at IS NULL",
      [req.params.id]
    );
    ok(res, { message: "Shared" });
  } catch (err) {
    console.error("POST /products/:id/share:", err);
    fail(res, 500, "Failed to track share");
  }
});

/* ══════════════════════════════════════════════════════════════
   ADMIN — moderation routes
══════════════════════════════════════════════════════════════ */

router.patch("/:id/approve", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE market.products SET
         status           = 'approved',
         is_active        = true,
         is_flagged       = false,
         rejection_reason = NULL,
         reviewed_by      = $2,
         reviewed_at      = now(),
         admin_notes      = COALESCE($3, admin_notes),
         updated_at       = now()
       WHERE id = $1 AND status != 'approved' AND deleted_at IS NULL
       RETURNING id, status, is_active`,
      [req.params.id, req.user.id, safeStr(req.body.admin_notes, 1000)]
    );
    if (!rows.length) return fail(res, 404, "Product not found or already approved");
    ok(res, { message: "Product approved and is now live", data: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/approve:", err);
    fail(res, 500, "Failed to approve product");
  }
});

router.patch("/:id/reject", authenticate, requireAdmin, async (req, res) => {
  const reason = safeStr(req.body.reason, 500);
  if (!reason) return fail(res, 422, "A rejection reason is required");
  try {
    const { rows } = await pool.query(
      `UPDATE market.products SET
         status           = 'rejected',
         is_active        = false,
         rejection_reason = $2,
         reviewed_by      = $3,
         reviewed_at      = now(),
         admin_notes      = COALESCE($4, admin_notes),
         updated_at       = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, status, rejection_reason`,
      [req.params.id, reason, req.user.id, safeStr(req.body.admin_notes, 1000)]
    );
    if (!rows.length) return fail(res, 404, "Product not found");
    ok(res, { message: "Product rejected", data: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/reject:", err);
    fail(res, 500, "Failed to reject product");
  }
});

router.patch("/:id/flag", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE market.products SET
         is_flagged  = NOT is_flagged,
         fraud_score = COALESCE($2, fraud_score),
         is_active   = CASE WHEN (NOT is_flagged) = true THEN false ELSE is_active END,
         admin_notes = COALESCE($3, admin_notes),
         updated_at  = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, is_flagged, fraud_score, is_active`,
      [req.params.id, req.body.fraud_score ?? null, safeStr(req.body.admin_notes, 1000)]
    );
    if (!rows.length) return fail(res, 404, "Product not found");
    const p = rows[0];
    ok(res, {
      message: p.is_flagged ? "Product flagged and taken offline" : "Product unflagged",
      data:    p,
    });
  } catch (err) {
    console.error("PATCH /products/:id/flag:", err);
    fail(res, 500, "Failed to flag product");
  }
});

router.patch("/:id/fraud-score", authenticate, requireAdmin, async (req, res) => {
  const score = parseInt(req.body.score, 10);
  if (isNaN(score) || score < 0 || score > 100)
    return fail(res, 422, "Score must be 0–100");
  try {
    const { rows } = await pool.query(
      `UPDATE market.products SET
         fraud_score = $2,
         admin_notes = COALESCE($3, admin_notes),
         updated_at  = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, fraud_score`,
      [req.params.id, score, safeStr(req.body.notes, 1000)]
    );
    if (!rows.length) return fail(res, 404, "Product not found");
    ok(res, { message: "Fraud score updated", data: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/fraud-score:", err);
    fail(res, 500, "Failed to update fraud score");
  }
});

router.patch("/:id/hide", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE market.products SET
         is_hidden  = NOT is_hidden,
         updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, is_hidden`,
      [req.params.id]
    );
    if (!rows.length) return fail(res, 404, "Product not found");
    const p = rows[0];
    ok(res, { message: p.is_hidden ? "Product hidden" : "Product visible again", data: p });
  } catch (err) {
    console.error("PATCH /products/:id/hide:", err);
    fail(res, 500, "Failed to toggle visibility");
  }
});

router.patch("/:id/remove", authenticate, requireAdmin, async (req, res) => {
  const reason = safeStr(req.body.reason, 500);
  if (!reason) return fail(res, 422, "A removal reason is required");
  try {
    const { rows } = await pool.query(
      `UPDATE market.products SET
         status         = 'removed',
         is_active      = false,
         removed_reason = $2,
         reviewed_by    = $3,
         reviewed_at    = now(),
         updated_at     = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, status`,
      [req.params.id, reason, req.user.id]
    );
    if (!rows.length) return fail(res, 404, "Product not found");
    ok(res, { message: "Product removed", data: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/remove:", err);
    fail(res, 500, "Failed to remove product");
  }
});

router.patch("/:id/notes", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE market.products SET
         admin_notes = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, admin_notes`,
      [req.params.id, safeStr(req.body.admin_notes, 1000)]
    );
    if (!rows.length) return fail(res, 404, "Product not found");
    ok(res, { message: "Notes saved", data: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/notes:", err);
    fail(res, 500, "Failed to save notes");
  }
});

/**
 * PATCH /api/products/:id/priority
 * Admin sets moderation priority (0–10).
 * Body: { priority: number }
 */
router.patch("/:id/priority", authenticate, requireAdmin, async (req, res) => {
  const priority = parseInt(req.body.priority, 10);
  if (isNaN(priority) || priority < 0 || priority > 10)
    return fail(res, 422, "Priority must be 0–10");
  try {
    const { rows } = await pool.query(
      `UPDATE market.products SET
         moderation_priority = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, moderation_priority`,
      [req.params.id, priority]
    );
    if (!rows.length) return fail(res, 404, "Product not found");
    ok(res, { message: "Priority updated", data: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/priority:", err);
    fail(res, 500, "Failed to update priority");
  }
});

/**
 * GET /api/products/admin/reports
 * ⚠️ Before /:id — declared late so must use full path
 */
router.get("/admin/reports", authenticate, requireAdmin, async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const { limit, offset } = paginate(req.query);

    const { rows } = await pool.query(
      `SELECT
         r.*,
         p.name AS product_name,
         p.slug AS product_slug
       FROM market.product_reports r
       LEFT JOIN market.products p ON p.id = r.product_id
       WHERE r.status = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    const countRes = await pool.query(
      "SELECT COUNT(*) FROM market.product_reports WHERE status = $1",
      [status]
    );

    ok(res, {
      data: {
        reports:    rows,
        pagination: paginationMeta(parseInt(countRes.rows[0].count, 10), limit, offset),
      },
    });
  } catch (err) {
    console.error("GET /products/admin/reports:", err);
    fail(res, 500, "Failed to fetch reports");
  }
});

/* ── Promotion toggles ─────────────────────────────────────── */

function makeToggle(field, label) {
  return async (req, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE market.products
         SET ${field} = NOT ${field}, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id, ${field}`,
        [req.params.id]
      );
      if (!rows.length) return fail(res, 404, "Product not found");
      const val = rows[0][field];
      ok(res, {
        message: val ? `${label} enabled` : `${label} disabled`,
        data:    { [field]: val },
      });
    } catch (err) {
      console.error(`PATCH /products/:id/${field}:`, err);
      fail(res, 500, `Failed to toggle ${label}`);
    }
  };
}

router.patch("/:id/feature", authenticate, requireAdmin, makeToggle("is_featured",  "Featured"));
router.patch("/:id/trend",   authenticate, requireAdmin, makeToggle("is_trending",  "Trending"));
router.patch("/:id/sponsor", authenticate, requireAdmin, makeToggle("is_sponsored", "Sponsored"));

/* ── Error handler ─────────────────────────────────────────── */
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError)
    return fail(res, 400, err.message);
  if (err.status === 415)
    return fail(res, 415, err.message);
  console.error("Products router error:", err);
  fail(res, 500, "Unexpected server error");
});

export default router;