/**
 * routes/products.js
 *
 * Mount:  app.use("/api/products", productsRouter);
 *
 * Schemas:
 *   market.products · market.product_images · market.product_variants
 *   market.product_features · market.product_specifications · market.product_box_items
 *   market.users  ← sellers
 *   public.users  ← buyers (not used here)
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
  fraud_score: "p.fraud_score DESC NULLS LAST",
  views:       "p.view_count DESC",
};

/* ══════════════════════════════════════════════════════════════
   FULL PRODUCT SELECT
   — market.users for seller info (name / profile_image)
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

/* GROUP BY must match every non-aggregated SELECT column from market.users */
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

/** Pagination — clamped and coerced */
function paginate(query) {
  const limit  = Math.min(parseInt(query.limit,  10) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  const page   = Math.floor(offset / limit) + 1;
  return { limit, offset, page };
}

/** Safe sort — whitelist only */
function safeSort(sort) {
  return SORT_MAP[sort] || SORT_MAP.newest;
}

/** Safe string — trim + max length */
function safeStr(val, max = 500) {
  if (typeof val !== "string") return null;
  const t = val.trim();
  return t.length ? t.slice(0, max) : null;
}

/** Parse JSON body field safely */
function parseJSON(raw, fallback = []) {
  try   { return typeof raw === "string" ? JSON.parse(raw) : (raw ?? fallback); }
  catch { return fallback; }
}

/** Pagination meta object */
function paginationMeta(total, limit, offset) {
  const totalPages = Math.ceil(total / limit);
  const page       = Math.floor(offset / limit) + 1;
  return { total, page, limit, offset, totalPages, hasNext: page < totalPages };
}

/** Standard success response */
const ok   = (res, data = {}, status = 200) =>
  res.status(status).json({ success: true,  ...data });

/** Standard error response */
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
  await client.query(
    `DELETE FROM market.${table} WHERE product_id = $1`,
    [productId]
  );
  await insertList(client, table, column, productId, items);
}

async function replaceSpecs(client, productId, specs) {
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

async function replaceVariants(client, productId, rawVariants) {
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

async function uploadFiles(files) {
  return Promise.all(files.map((f) => uploadToCloudinary(f.buffer)));
}

async function deleteOldImages(client, productId) {
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

/** Ownership guard — seller may only touch their own products */
async function assertOwner(client, productId, userId) {
  const { rows } = await client.query(
    "SELECT user_id, status FROM market.products WHERE id = $1",
    [productId]
  );
  if (!rows.length)               return { error: 404, message: "Product not found" };
  if (rows[0].user_id !== userId) return { error: 403, message: "Forbidden"         };
  return { row: rows[0] };
}

/* ══════════════════════════════════════════════════════════════
   PUBLIC ROUTES
   ⚠️  Static paths BEFORE /:id
══════════════════════════════════════════════════════════════ */

/**
 * GET /api/products
 * Public — approved, active, visible listings only.
 * Query: category, search, brand, tags, featured, trending,
 *        sponsored, limit, offset, sort
 */
router.get("/", async (req, res) => {
  try {
    const {
      category, search, brand, tags,
      featured, trending, sponsored,
      sort = "newest",
    } = req.query;

    const { limit, offset } = paginate(req.query);

    const conditions = [
      "p.status    = 'approved'",
      "p.is_active  = true",
      "p.is_hidden  = false",
      "p.is_paused  = false",
    ];
    const params = [];
    let   p      = 1;

    if (category)             { conditions.push(`p.category = $${p++}`);         params.push(category); }
    if (brand)                { conditions.push(`p.brand ILIKE $${p++}`);         params.push(`%${brand.trim()}%`); }
    if (search)               { conditions.push(`p.name ILIKE $${p++}`);          params.push(`%${search.trim()}%`); }
    if (tags)                 { conditions.push(`p.tags && $${p++}::text[]`);     params.push(tags.split(",")); }
    if (featured  === "true")   conditions.push("p.is_featured  = true");
    if (trending  === "true")   conditions.push("p.is_trending  = true");
    if (sponsored === "true")   conditions.push("p.is_sponsored = true");

    const where = `WHERE ${conditions.join(" AND ")}`;
    const order = safeSort(sort);

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
 * ⚠️  Before /:id
 * Seller's own listings — all statuses.
 * Query: status, limit, offset, sort
 */
router.get("/seller/mine", authenticate, async (req, res) => {
  try {
    const { status, sort = "newest" } = req.query;
    const { limit, offset }           = paginate(req.query);

    const conditions = ["p.user_id = $1"];
    const params     = [req.user.id];
    let   p          = 2;

    if (status) { conditions.push(`p.status = $${p++}`); params.push(status); }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const order = safeSort(sort);

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
 * ⚠️  Before /:id
 * Admin view — all products, all statuses.
 * Query: status, flagged, category, brand, search, limit, offset, sort
 */
router.get("/admin/all", authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, flagged, category, brand, search, sort = "newest" } = req.query;
    const { limit, offset } = paginate(req.query);

    const conditions = [];
    const params     = [];
    let   p          = 1;

    if (status)              { conditions.push(`p.status = $${p++}`);       params.push(status); }
    if (category)            { conditions.push(`p.category = $${p++}`);     params.push(category); }
    if (brand)               { conditions.push(`p.brand ILIKE $${p++}`);    params.push(`%${brand.trim()}%`); }
    if (search)              { conditions.push(`p.name ILIKE $${p++}`);     params.push(`%${search.trim()}%`); }
    if (flagged === "true")    conditions.push("p.is_flagged = true");

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const order = safeSort(sort);

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
 * ⚠️  Before /:id
 * Counts by status for admin dashboard.
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
        COUNT(*) FILTER (WHERE is_flagged   = true)         AS flagged,
        COUNT(*) FILTER (WHERE is_featured  = true)         AS featured,
        COUNT(*) FILTER (WHERE is_trending  = true)         AS trending,
        COUNT(*) FILTER (WHERE is_sponsored = true)         AS sponsored,
        COUNT(*) FILTER (WHERE is_paused    = true)         AS paused,
        COUNT(*) FILTER (WHERE is_hidden    = true)         AS hidden
      FROM market.products
    `);
    ok(res, { data: stats });
  } catch (err) {
    console.error("GET /products/admin/stats:", err);
    fail(res, 500, "Failed to fetch stats");
  }
});

/**
 * POST /api/products/admin/bulk-approve
 * ⚠️  Before /:id
 * Body: { ids: string[] }
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
       WHERE id = ANY($1::uuid[]) AND status != 'approved'`,
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
 * ⚠️  Before /:id
 * Body: { ids: string[], reason: string }
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
       WHERE id = ANY($1::uuid[])`,
      [ids, req.user.id, reason]
    );
    ok(res, { message: `${rowCount} product(s) rejected`, data: { count: rowCount } });
  } catch (err) {
    console.error("POST /products/admin/bulk-reject:", err);
    fail(res, 500, "Bulk reject failed");
  }
});

/* ══════════════════════════════════════════════════════════════
   /:id ROUTES — must come AFTER all static paths
══════════════════════════════════════════════════════════════ */

/**
 * GET /api/products/:id
 * Public if approved — owner or admin sees any status.
 * Increments view_count async.
 */
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${FULL_PRODUCT_SELECT}
       WHERE p.id = $1
       ${GROUP_BY}`,
      [req.params.id]
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

    /* Increment view count — non-blocking */
    if (isPublic) {
      pool.query(
        "UPDATE market.products SET view_count = view_count + 1 WHERE id = $1",
        [product.id]
      ).catch(() => {});
    }

    ok(res, { data: product });
  } catch (err) {
    console.error("GET /products/:id:", err);
    fail(res, 500, "Failed to fetch product");
  }
});

/**
 * POST /api/products
 * Create listing — status = 'pending', is_active = false.
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
        name, description, category,
        basePrice, originalPrice,
        brand, tags,
        variants, keyFeatures, specifications, whatsInBox,
      } = req.body;

      const cleanName = safeStr(name, 200);
      if (!cleanName)  return fail(res, 422, "Product name is required");
      if (!category)   return fail(res, 422, "Category is required");

      const price = parseInt(basePrice, 10);
      if (isNaN(price) || price <= 0)
        return fail(res, 422, "Valid base price is required");

      const parsedTags = parseJSON(tags, []);

      /* — Insert product — */
      const { rows: [{ id: productId }] } = await client.query(
        `INSERT INTO market.products
           (user_id, name, description, category, condition,
            price, original_price, brand, tags,
            status, is_active)
         VALUES ($1,$2,$3,$4,'new',$5,$6,$7,$8,'pending',false)
         RETURNING id`,
        [
          req.user.id,
          cleanName,
          safeStr(description, 2000),
          category,
          price,
          originalPrice ? parseInt(originalPrice, 10) : null,
          safeStr(brand, 100),
          parsedTags.length ? parsedTags : null,
        ]
      );

      /* — Upload images in parallel — */
      const uploaded = await uploadFiles(req.files);
      for (let i = 0; i < uploaded.length; i++) {
        await client.query(
          `INSERT INTO market.product_images
             (product_id, image_url, is_primary, sort_order)
           VALUES ($1,$2,$3,$4)`,
          [productId, uploaded[i].secure_url, i === 0, i]
        );
      }

      /* — Child rows — */
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
        return fail(res, 409, "Duplicate SKU — each variant needs a unique SKU");
      fail(res, 500, "Failed to create listing");
    } finally {
      client.release();
    }
  }
);

/**
 * PATCH /api/products/:id
 * Update own listing — resets to pending.
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
        name, description, category,
        basePrice, originalPrice,
        brand, tags,
        variants, keyFeatures, specifications, whatsInBox,
      } = req.body;

      const price = basePrice ? parseInt(basePrice, 10) : undefined;
      if (price !== undefined && (isNaN(price) || price <= 0))
        return fail(res, 422, "Invalid base price");

      await client.query(
        `UPDATE market.products SET
           name             = COALESCE($2,  name),
           description      = COALESCE($3,  description),
           category         = COALESCE($4,  category),
           price            = COALESCE($5,  price),
           original_price   = $6,
           brand            = COALESCE($7,  brand),
           tags             = COALESCE($8,  tags),
           status           = 'pending',
           is_active        = false,
           reviewed_by      = NULL,
           reviewed_at      = NULL,
           rejection_reason = NULL,
           updated_at       = now()
         WHERE id = $1`,
        [
          productId,
          safeStr(name, 200)         || null,
          safeStr(description, 2000) || null,
          category                   || null,
          price                      || null,
          originalPrice ? parseInt(originalPrice, 10) : null,
          safeStr(brand, 100)        || null,
          tags ? parseJSON(tags, []) : null,
        ]
      );

      if (req.files?.length) {
        await deleteOldImages(client, productId);
        await client.query(
          "DELETE FROM market.product_images WHERE product_id = $1",
          [productId]
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

      if (variants      !== undefined) await replaceVariants(client, productId, variants);
      if (keyFeatures   !== undefined) await replaceList(client, "product_features",  "feature", productId, parseJSON(keyFeatures));
      if (whatsInBox    !== undefined) await replaceList(client, "product_box_items", "item",    productId, parseJSON(whatsInBox));
      if (specifications !== undefined) await replaceSpecs(client, productId, parseJSON(specifications));

      await client.query("COMMIT");
      ok(res, { message: "Listing updated and resubmitted for review", data: { status: "pending" } });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("PATCH /products/:id:", err);
      if (err.code === "23505") return fail(res, 409, "Duplicate SKU");
      fail(res, 500, "Failed to update listing");
    } finally {
      client.release();
    }
  }
);

/**
 * DELETE /api/products/:id
 * Seller deletes own — admin deletes any.
 */
router.delete("/:id", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (req.user.role !== "admin") {
      const guard = await assertOwner(client, req.params.id, req.user.id);
      if (guard.error) return fail(res, guard.error, guard.message);
    }

    await deleteOldImages(client, req.params.id);

    const { rowCount } = await client.query(
      "DELETE FROM market.products WHERE id = $1 RETURNING id",
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
 * PATCH /api/products/:id/pause
 * Seller toggles pause on approved listing.
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
       WHERE id = $1
       RETURNING is_paused`,
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
   ADMIN — moderation routes
══════════════════════════════════════════════════════════════ */

/** PATCH /api/products/:id/approve */
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
       WHERE id = $1 AND status != 'approved'
       RETURNING id, status, is_active`,
      [req.params.id, req.user.id, safeStr(req.body.admin_notes, 1000)]
    );

    if (!rows.length)
      return fail(res, 404, "Product not found or already approved");

    ok(res, { message: "Product approved and is now live", data: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/approve:", err);
    fail(res, 500, "Failed to approve product");
  }
});

/** PATCH /api/products/:id/reject */
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
       WHERE id = $1
       RETURNING id, status, rejection_reason`,
      [req.params.id, reason, req.user.id, safeStr(req.body.admin_notes, 1000)]
    );

    if (!rows.length) return fail(res, 404, "Product not found");

    // TODO: notify seller
    ok(res, { message: "Product rejected", data: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/reject:", err);
    fail(res, 500, "Failed to reject product");
  }
});

/** PATCH /api/products/:id/flag */
router.patch("/:id/flag", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE market.products SET
         is_flagged  = NOT is_flagged,
         fraud_score = COALESCE($2, fraud_score),
         is_active   = CASE WHEN (NOT is_flagged) = true THEN false ELSE is_active END,
         admin_notes = COALESCE($3, admin_notes),
         updated_at  = now()
       WHERE id = $1
       RETURNING id, is_flagged, fraud_score, is_active`,
      [req.params.id, req.body.fraud_score ?? null, safeStr(req.body.admin_notes, 1000)]
    );

    if (!rows.length) return fail(res, 404, "Product not found");

    const p = rows[0];
    ok(res, {
      message: p.is_flagged
        ? "Product flagged and taken offline"
        : "Product unflagged",
      data: p,
    });
  } catch (err) {
    console.error("PATCH /products/:id/flag:", err);
    fail(res, 500, "Failed to flag product");
  }
});

/** PATCH /api/products/:id/fraud-score */
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
       WHERE id = $1
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

/** PATCH /api/products/:id/hide */
router.patch("/:id/hide", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE market.products SET
         is_hidden  = NOT is_hidden,
         updated_at = now()
       WHERE id = $1
       RETURNING id, is_hidden`,
      [req.params.id]
    );
    if (!rows.length) return fail(res, 404, "Product not found");

    const p = rows[0];
    ok(res, {
      message: p.is_hidden ? "Product hidden" : "Product visible again",
      data:    p,
    });
  } catch (err) {
    console.error("PATCH /products/:id/hide:", err);
    fail(res, 500, "Failed to toggle visibility");
  }
});

/** PATCH /api/products/:id/remove */
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
       WHERE id = $1
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

/** PATCH /api/products/:id/notes */
router.patch("/:id/notes", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE market.products SET
         admin_notes = $2,
         updated_at  = now()
       WHERE id = $1
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

/* ── Promotion toggles ─────────────────────────────────────── */

function makeToggle(field, label) {
  return async (req, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE market.products
         SET ${field} = NOT ${field}, updated_at = now()
         WHERE id = $1
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