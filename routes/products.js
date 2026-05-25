/**
 * routes/products.js
 *
 * Mount:  app.use("/api/products", productsRouter);
 * Import: import productsRouter from "./routes/products.js";
 *
 * Tables (market schema):
 *   products · product_images · product_variants
 *   product_features · product_specifications · product_box_items
 *
 * NOTE: `condition` column is fixed to 'new' server-side — field removed from UI.
 */

import express from "express";
import { pool }       from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { upload, uploadToCloudinary }  from "../middleware/upload.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

/** Full product query with all related tables joined as JSON arrays */
const FULL_PRODUCT_SELECT = `
  SELECT
    p.*,
    u.username          AS seller_name,
    u.email             AS seller_email,
    u.avatar_url        AS seller_avatar,

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
      ) ORDER BY jsonb_build_object('position', pf.position)) FILTER (WHERE pf.id IS NOT NULL),
      '[]'
    ) AS key_features,

    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'key',      ps.spec_key,
        'value',    ps.spec_value,
        'position', ps.position
      ) ORDER BY jsonb_build_object('position', ps.position)) FILTER (WHERE ps.id IS NOT NULL),
      '[]'
    ) AS specifications,

    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'item',     pb.item,
        'position', pb.position
      ) ORDER BY jsonb_build_object('position', pb.position)) FILTER (WHERE pb.id IS NOT NULL),
      '[]'
    ) AS whats_in_box

  FROM market.products p
  LEFT JOIN public.users                 u  ON u.id  = p.user_id
  LEFT JOIN market.product_images        pi ON pi.product_id = p.id
  LEFT JOIN market.product_variants      pv ON pv.product_id = p.id
  LEFT JOIN market.product_features      pf ON pf.product_id = p.id
  LEFT JOIN market.product_specifications ps ON ps.product_id = p.id
  LEFT JOIN market.product_box_items     pb ON pb.product_id = p.id
`;

/** Insert child rows (features / box items) */
async function insertList(client, table, column, productId, items) {
  for (let i = 0; i < items.length; i++) {
    const val = items[i]?.trim?.() || items[i];
    if (!val) continue;
    await client.query(
      `INSERT INTO market.${table} (product_id, ${column}, position) VALUES ($1,$2,$3)`,
      [productId, val, i]
    );
  }
}

/** Delete all child rows then re-insert (used on update) */
async function replaceList(client, table, column, productId, items) {
  await client.query(`DELETE FROM market.${table} WHERE product_id = $1`, [productId]);
  await insertList(client, table, column, productId, items);
}

/** Parse a JSON body field safely */
function parseJSON(raw, fallback = []) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

/** Ownership guard — seller may only touch their own products */
async function assertOwner(client, productId, userId) {
  const { rows } = await client.query(
    "SELECT user_id, status FROM market.products WHERE id = $1",
    [productId]
  );
  if (!rows.length) return { error: 404, message: "Product not found" };
  if (rows[0].user_id !== userId) return { error: 403, message: "Forbidden" };
  return { row: rows[0] };
}

/* ══════════════════════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════════════════════ */

/**
 * GET /api/products
 * Public listing — approved & active products only.
 * Query params: category, search, featured, trending, sponsored, limit, offset, sort
 */
router.get("/", async (req, res) => {
  try {
    const {
      category, search,
      featured, trending, sponsored,
      limit   = 24,
      offset  = 0,
      sort    = "newest",       // newest | price_asc | price_desc
    } = req.query;

    const conditions = ["p.status = 'approved'", "p.is_active = true", "p.is_hidden = false", "p.is_paused = false"];
    const params     = [];
    let   p          = 1;

    if (category)  { conditions.push(`p.category = $${p++}`);                     params.push(category); }
    if (search)    { conditions.push(`p.name ILIKE $${p++}`);                      params.push(`%${search.trim()}%`); }
    if (featured === "true")  conditions.push("p.is_featured = true");
    if (trending  === "true") conditions.push("p.is_trending = true");
    if (sponsored === "true") conditions.push("p.is_sponsored = true");

    const orderMap = {
      newest:     "p.created_at DESC",
      price_asc:  "p.price ASC",
      price_desc: "p.price DESC",
    };
    const order = orderMap[sort] || orderMap.newest;

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `${FULL_PRODUCT_SELECT}
       ${where}
       GROUP BY p.id, u.username, u.email, u.avatar_url
       ORDER BY ${order}
       LIMIT $${p++} OFFSET $${p++}`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM market.products p ${where}`,
      params
    );

    res.json({ total: parseInt(countRes.rows[0].count, 10), products: rows });
  } catch (err) {
    console.error("GET /products:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/**
 * GET /api/products/:id
 * Single product — public if approved; owner or admin can see any status.
 */
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${FULL_PRODUCT_SELECT}
       WHERE p.id = $1
       GROUP BY p.id, u.username, u.email, u.avatar_url`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ message: "Product not found" });

    const product = rows[0];

    // Non-owners/non-admins can only see approved active listings
    const token   = req.headers.authorization?.split(" ")[1];
    const isAdmin = req.user?.role === "admin"; // populated by optional auth
    const isOwner = req.user?.id === product.user_id;

    if (!isAdmin && !isOwner && (product.status !== "approved" || !product.is_active))
      return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (err) {
    console.error("GET /products/:id:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* ══════════════════════════════════════════════════════════════
   SELLER ROUTES  (authenticated)
══════════════════════════════════════════════════════════════ */

/**
 * POST /api/products
 * Create a new listing — submitted as 'pending', not yet active.
 * Multipart form: images[] + JSON fields.
 */
router.post("/", authenticate, upload.array("images", 5), async (req, res) => {
  if (!req.files?.length)
    return res.status(400).json({ message: "At least one image is required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      name, description, category,
      basePrice, originalPrice,
      variants, keyFeatures, specifications, whatsInBox,
    } = req.body;

    /* — Validate core fields — */
    if (!name?.trim())  return res.status(400).json({ message: "Product name is required" });
    if (!category)      return res.status(400).json({ message: "Category is required" });

    const price = parseInt(basePrice, 10);
    if (isNaN(price) || price <= 0)
      return res.status(400).json({ message: "Valid base price is required" });

    /* — Insert product (condition hardcoded to 'new') — */
    const { rows: [{ id: productId }] } = await client.query(
      `INSERT INTO market.products
         (user_id, name, description, category, condition, price, original_price, status, is_active)
       VALUES ($1,$2,$3,$4,'new',$5,$6,'pending',false)
       RETURNING id`,
      [
        req.user.id,
        name.trim(),
        description?.trim() || null,
        category,
        price,
        originalPrice ? parseInt(originalPrice, 10) : null,
      ]
    );

    /* — Upload images to Cloudinary (parallel) — */
    const uploaded = await Promise.all(
      req.files.map((f) => uploadToCloudinary(f.buffer))
    );
    for (let i = 0; i < uploaded.length; i++) {
      await client.query(
        `INSERT INTO market.product_images (product_id, image_url, is_primary, sort_order)
         VALUES ($1,$2,$3,$4)`,
        [productId, uploaded[i].secure_url, i === 0, i]
      );
    }

    /* — Insert variants — */
    const parsedVariants = parseJSON(variants);
    for (const v of parsedVariants) {
      if (!v.sku?.trim() || !v.name?.trim()) continue;
      await client.query(
        `INSERT INTO market.product_variants (product_id, sku, name, price, stock, attributes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          productId,
          v.sku.trim().toUpperCase(),
          v.name.trim(),
          parseFloat(v.price) || 0,
          Math.max(0, parseInt(v.stock, 10) || 0),
          JSON.stringify(v.attributes || {}),
        ]
      );
    }

    /* — Insert child lists — */
    await insertList(client, "product_features",      "feature",  productId, parseJSON(keyFeatures));
    await insertList(client, "product_box_items",     "item",     productId, parseJSON(whatsInBox));

    const specs = parseJSON(specifications);
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      if (!s.key?.trim() || !s.value?.trim()) continue;
      await client.query(
        `INSERT INTO market.product_specifications (product_id, spec_key, spec_value, position)
         VALUES ($1,$2,$3,$4)`,
        [productId, s.key.trim(), s.value.trim(), i]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message:   "Listing submitted for review. You'll be notified once approved.",
      productId,
      status:    "pending",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /products:", err);

    if (err.code === "23505")
      return res.status(409).json({ message: "Duplicate SKU — each variant needs a unique SKU" });

    res.status(500).json({ message: "Failed to create listing" });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/products/:id
 * Update own listing — only allowed while status is 'pending' or 'rejected'.
 * Editing an approved listing resets it to 'pending' for re-review.
 */
router.patch("/:id", authenticate, upload.array("images", 5), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const guard = await assertOwner(client, req.params.id, req.user.id);
    if (guard.error) return res.status(guard.error).json({ message: guard.message });

    const productId = req.params.id;

    const {
      name, description, category,
      basePrice, originalPrice,
      variants, keyFeatures, specifications, whatsInBox,
    } = req.body;

    const price = basePrice ? parseInt(basePrice, 10) : undefined;
    if (price !== undefined && (isNaN(price) || price <= 0))
      return res.status(400).json({ message: "Invalid base price" });

    /* — Update core product row; editing resets to pending — */
    await client.query(
      `UPDATE market.products SET
         name            = COALESCE($2, name),
         description     = COALESCE($3, description),
         category        = COALESCE($4, category),
         price           = COALESCE($5, price),
         original_price  = $6,
         status          = 'pending',
         is_active       = false,
         reviewed_by     = NULL,
         reviewed_at     = NULL,
         rejection_reason = NULL,
         updated_at      = now()
       WHERE id = $1`,
      [
        productId,
        name?.trim()       || null,
        description?.trim() || null,
        category            || null,
        price               || null,
        originalPrice ? parseInt(originalPrice, 10) : null,
      ]
    );

    /* — Replace images if new files uploaded — */
    if (req.files?.length) {
      // Delete old Cloudinary images
      const { rows: oldImgs } = await client.query(
        "SELECT image_url FROM market.product_images WHERE product_id = $1",
        [productId]
      );
      // Fire-and-forget Cloudinary deletes (non-critical)
      oldImgs.forEach(({ image_url }) => {
        const publicId = image_url.split("/").slice(-2).join("/").split(".")[0];
        // cloudinary.uploader.destroy(publicId).catch(() => {});
      });

      await client.query("DELETE FROM market.product_images WHERE product_id = $1", [productId]);

      const uploaded = await Promise.all(req.files.map((f) => uploadToCloudinary(f.buffer)));
      for (let i = 0; i < uploaded.length; i++) {
        await client.query(
          `INSERT INTO market.product_images (product_id, image_url, is_primary, sort_order)
           VALUES ($1,$2,$3,$4)`,
          [productId, uploaded[i].secure_url, i === 0, i]
        );
      }
    }

    /* — Replace variants — */
    if (variants) {
      await client.query("DELETE FROM market.product_variants WHERE product_id = $1", [productId]);
      for (const v of parseJSON(variants)) {
        if (!v.sku?.trim() || !v.name?.trim()) continue;
        await client.query(
          `INSERT INTO market.product_variants (product_id, sku, name, price, stock, attributes)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            productId,
            v.sku.trim().toUpperCase(),
            v.name.trim(),
            parseFloat(v.price) || 0,
            Math.max(0, parseInt(v.stock, 10) || 0),
            JSON.stringify(v.attributes || {}),
          ]
        );
      }
    }

    /* — Replace child lists — */
    if (keyFeatures)    await replaceList(client, "product_features",  "feature", productId, parseJSON(keyFeatures));
    if (whatsInBox)     await replaceList(client, "product_box_items", "item",    productId, parseJSON(whatsInBox));

    if (specifications) {
      await client.query("DELETE FROM market.product_specifications WHERE product_id = $1", [productId]);
      const specs = parseJSON(specifications);
      for (let i = 0; i < specs.length; i++) {
        const s = specs[i];
        if (!s.key?.trim() || !s.value?.trim()) continue;
        await client.query(
          `INSERT INTO market.product_specifications (product_id, spec_key, spec_value, position)
           VALUES ($1,$2,$3,$4)`,
          [productId, s.key.trim(), s.value.trim(), i]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Listing updated and resubmitted for review", status: "pending" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /products/:id:", err);
    if (err.code === "23505")
      return res.status(409).json({ message: "Duplicate SKU" });
    res.status(500).json({ message: "Failed to update listing" });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/products/:id
 * Seller deletes own listing — or admin deletes any.
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";

    if (isAdmin) {
      const { rowCount } = await pool.query(
        "DELETE FROM market.products WHERE id = $1 RETURNING id",
        [req.params.id]
      );
      if (!rowCount) return res.status(404).json({ message: "Product not found" });
    } else {
      const client = await pool.connect();
      try {
        const guard = await assertOwner(client, req.params.id, req.user.id);
        if (guard.error) return res.status(guard.error).json({ message: guard.message });
        await client.query("DELETE FROM market.products WHERE id = $1", [req.params.id]);
      } finally { client.release(); }
    }

    res.json({ message: "Listing deleted" });
  } catch (err) {
    console.error("DELETE /products/:id:", err);
    res.status(500).json({ message: "Failed to delete listing" });
  }
});

/**
 * PATCH /api/products/:id/pause
 * Seller toggles pause on their own approved listing.
 */
router.patch("/:id/pause", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const guard = await assertOwner(client, req.params.id, req.user.id);
    if (guard.error) return res.status(guard.error).json({ message: guard.message });
    if (guard.row.status !== "approved")
      return res.status(400).json({ message: "Only approved listings can be paused" });

    const { rows: [updated] } = await client.query(
      `UPDATE market.products
       SET is_paused = NOT is_paused, updated_at = now()
       WHERE id = $1
       RETURNING is_paused`,
      [req.params.id]
    );
    res.json({ is_paused: updated.is_paused, message: updated.is_paused ? "Listing paused" : "Listing resumed" });
  } catch (err) {
    console.error("PATCH /products/:id/pause:", err);
    res.status(500).json({ message: "Failed to toggle pause" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/products/seller/mine
 * Seller's own listings — all statuses.
 */
router.get("/seller/mine", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${FULL_PRODUCT_SELECT}
       WHERE p.user_id = $1
       GROUP BY p.id, u.username, u.email, u.avatar_url
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /products/seller/mine:", err);
    res.status(500).json({ message: "Failed to fetch your listings" });
  }
});

/* ══════════════════════════════════════════════════════════════
   ADMIN ROUTES  (authenticate + requireAdmin)
══════════════════════════════════════════════════════════════ */

/**
 * GET /api/products/admin/all
 * All products with optional status filter, pagination, and search.
 * Query: status, flagged, category, search, limit, offset, sort
 */
router.get("/admin/all", authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      status, flagged, category, search,
      limit  = 50, offset = 0,
      sort   = "newest",
    } = req.query;

    const conditions = [];
    const params     = [];
    let   p          = 1;

    if (status)            { conditions.push(`p.status = $${p++}`);       params.push(status); }
    if (flagged === "true")  conditions.push("p.is_flagged = true");
    if (category)          { conditions.push(`p.category = $${p++}`);     params.push(category); }
    if (search)            { conditions.push(`p.name ILIKE $${p++}`);     params.push(`%${search.trim()}%`); }

    const orderMap = {
      newest:      "p.created_at DESC",
      oldest:      "p.created_at ASC",
      price_asc:   "p.price ASC",
      price_desc:  "p.price DESC",
      fraud_score: "p.fraud_score DESC",
    };
    const order = orderMap[sort] || orderMap.newest;
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `${FULL_PRODUCT_SELECT}
       ${where}
       GROUP BY p.id, u.username, u.email, u.avatar_url
       ORDER BY ${order}
       LIMIT $${p++} OFFSET $${p++}`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM market.products p ${where}`,
      params
    );

    res.json({ total: parseInt(countRes.rows[0].count, 10), products: rows });
  } catch (err) {
    console.error("GET /products/admin/all:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/**
 * GET /api/products/admin/stats
 * Counts by status + flagged for the admin dashboard.
 */
router.get("/admin/stats", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE status = 'pending')       AS pending,
        COUNT(*) FILTER (WHERE status = 'approved')      AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')      AS rejected,
        COUNT(*) FILTER (WHERE is_flagged = true)        AS flagged,
        COUNT(*) FILTER (WHERE is_featured = true)       AS featured,
        COUNT(*) FILTER (WHERE is_trending = true)       AS trending,
        COUNT(*) FILTER (WHERE is_sponsored = true)      AS sponsored,
        COUNT(*) FILTER (WHERE is_paused = true)         AS paused,
        COUNT(*) FILTER (WHERE is_hidden = true)         AS hidden
      FROM market.products
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error("GET /products/admin/stats:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

/**
 * PATCH /api/products/:id/approve
 * Approve a pending listing — makes it live.
 */
router.patch("/:id/approve", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE market.products
       SET
         status          = 'approved',
         is_active       = true,
         is_flagged      = false,
         rejection_reason = NULL,
         reviewed_by     = $2,
         reviewed_at     = now(),
         admin_notes     = COALESCE($3, admin_notes),
         updated_at      = now()
       WHERE id = $1 AND status != 'approved'
       RETURNING id, status, is_active`,
      [req.params.id, req.user.id, req.body.admin_notes || null]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Product not found or already approved" });

    res.json({ message: "Product approved and is now live", product: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/approve:", err);
    res.status(500).json({ message: "Failed to approve product" });
  }
});

/**
 * PATCH /api/products/:id/reject
 * Reject a listing with a reason — seller will be notified.
 * Body: { reason: string, admin_notes?: string }
 */
router.patch("/:id/reject", authenticate, requireAdmin, async (req, res) => {
  const { reason, admin_notes } = req.body;

  if (!reason?.trim())
    return res.status(400).json({ message: "A rejection reason is required" });

  try {
    const { rows } = await pool.query(
      `UPDATE market.products
       SET
         status           = 'rejected',
         is_active        = false,
         rejection_reason = $2,
         reviewed_by      = $3,
         reviewed_at      = now(),
         admin_notes      = COALESCE($4, admin_notes),
         updated_at       = now()
       WHERE id = $1
       RETURNING id, status, rejection_reason`,
      [req.params.id, reason.trim(), req.user.id, admin_notes || null]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Product not found" });

    // TODO: fire notification to seller (email / in-app)

    res.json({ message: "Product rejected", product: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/reject:", err);
    res.status(500).json({ message: "Failed to reject product" });
  }
});

/**
 * PATCH /api/products/:id/flag
 * Flag (or unflag) a product for fraud review.
 * Body: { fraud_score?: number, admin_notes?: string }
 */
router.patch("/:id/flag", authenticate, requireAdmin, async (req, res) => {
  const { fraud_score, admin_notes } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE market.products
       SET
         is_flagged  = NOT is_flagged,
         fraud_score = COALESCE($2, fraud_score),
         is_active   = CASE WHEN NOT is_flagged = true THEN false ELSE is_active END,
         admin_notes = COALESCE($3, admin_notes),
         updated_at  = now()
       WHERE id = $1
       RETURNING id, is_flagged, fraud_score, is_active`,
      [req.params.id, fraud_score ?? null, admin_notes || null]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Product not found" });

    const p = rows[0];
    res.json({
      message: p.is_flagged ? "Product flagged and taken offline" : "Product unflagged",
      product: p,
    });
  } catch (err) {
    console.error("PATCH /products/:id/flag:", err);
    res.status(500).json({ message: "Failed to flag product" });
  }
});

/**
 * PATCH /api/products/:id/hide
 * Admin hides a product from public listing without rejecting it.
 */
router.patch("/:id/hide", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE market.products
       SET is_hidden = NOT is_hidden, updated_at = now()
       WHERE id = $1
       RETURNING id, is_hidden`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    const p = rows[0];
    res.json({ message: p.is_hidden ? "Product hidden" : "Product visible", product: p });
  } catch (err) {
    console.error("PATCH /products/:id/hide:", err);
    res.status(500).json({ message: "Failed to toggle visibility" });
  }
});

/**
 * PATCH /api/products/:id/remove
 * Admin permanently removes a listing and records a reason.
 * Body: { reason: string }
 */
router.patch("/:id/remove", authenticate, requireAdmin, async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim())
    return res.status(400).json({ message: "A removal reason is required" });

  try {
    const { rows } = await pool.query(
      `UPDATE market.products
       SET
         status         = 'removed',
         is_active      = false,
         removed_reason = $2,
         reviewed_by    = $3,
         reviewed_at    = now(),
         updated_at     = now()
       WHERE id = $1
       RETURNING id, status`,
      [req.params.id, reason.trim(), req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product removed", product: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/remove:", err);
    res.status(500).json({ message: "Failed to remove product" });
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
      if (!rows.length) return res.status(404).json({ message: "Product not found" });
      const val = rows[0][field];
      res.json({ message: val ? `${label} enabled` : `${label} disabled`, [field]: val });
    } catch (err) {
      console.error(`PATCH /products/:id/${field}:`, err);
      res.status(500).json({ message: `Failed to toggle ${label}` });
    }
  };
}

/** PATCH /api/products/:id/feature   — Toggle featured badge */
router.patch("/:id/feature",  authenticate, requireAdmin, makeToggle("is_featured",  "Featured"));

/** PATCH /api/products/:id/trend     — Toggle trending badge */
router.patch("/:id/trend",    authenticate, requireAdmin, makeToggle("is_trending",  "Trending"));

/** PATCH /api/products/:id/sponsor   — Toggle sponsored badge */
router.patch("/:id/sponsor",  authenticate, requireAdmin, makeToggle("is_sponsored", "Sponsored"));

/**
 * PATCH /api/products/:id/notes
 * Admin saves internal notes without changing status.
 * Body: { admin_notes: string }
 */
router.patch("/:id/notes", authenticate, requireAdmin, async (req, res) => {
  const { admin_notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE market.products
       SET admin_notes = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, admin_notes`,
      [req.params.id, admin_notes || null]
    );
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Notes saved", product: rows[0] });
  } catch (err) {
    console.error("PATCH /products/:id/notes:", err);
    res.status(500).json({ message: "Failed to save notes" });
  }
});

/* ── Multer error handler ───────────────────────────────────── */
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError || err.status === 415)
    return res.status(400).json({ message: err.message });
  console.error("Products router error:", err);
  res.status(500).json({ message: "Unexpected server error" });
});

export default router;
