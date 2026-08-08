/**
 * routes/seller/product.js
 *
 * Seller-scoped product management routes.
 * All routes require authentication + vendor ownership verification.
 *
 * Mounted at: /api/products  (or /api/seller — see app.js)
 *
 * Routes:
 *   GET    /api/seller/mine              — paginated product list (with search/filter)
 *   GET    /api/products/:id             — single product (full detail)
 *   POST   /api/products                 — create listing  (see addproduct.js)
 *   PUT    /api/products/:id             — full update
 *   PATCH  /api/products/:id/pause       — toggle pause / resume
 *   PATCH  /api/products/:id/images      — reorder / set primary image
 *   DELETE /api/products/:id/images/:imgId — remove one image
 *   DELETE /api/products/:id             — soft delete (archived)
 */

import express          from "express";
import { authenticate } from "../../middleware/auth.js";
import {
  upload,
  processAndUploadImages,
  deleteFromR2,
} from "../../middleware/upload.js";
import {
  pool,
  MAX_IMAGES,
  safeStr,
  parseJSON,
  replaceVariants,
  insertList,
  replaceSpecs,
  ok,
  fail,
} from "./helpers.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   SHARED CONSTANTS
══════════════════════════════════════════════════════════════ */
const ALLOWED_CONDITIONS  = new Set(["new", "used", "refurbished"]);
const ALLOWED_STATUSES    = new Set(["pending", "approved", "rejected",
                                     "active",  "paused",   "archived"]);
const PAGE_SIZE_DEFAULT   = 12;
const PAGE_SIZE_MAX       = 50;

/* ══════════════════════════════════════════════════════════════
   SLUG GENERATOR  (mirrors addproduct.js — keep in sync)
══════════════════════════════════════════════════════════════ */
function generateSlug(name, id) {
  const base = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const suffix = String(id).replace(/-/g, "").slice(0, 12);
  return `${base}-${suffix}`;
}

/* ══════════════════════════════════════════════════════════════
   DUPLICATE ERROR CLASSIFIER  (mirrors addproduct.js)
══════════════════════════════════════════════════════════════ */
function classifyDuplicateError(err) {
  const combined = [err.detail, err.constraint, err.message]
    .map((s) => String(s ?? "").toLowerCase())
    .join(" ");

  if (combined.includes("slug"))
    return "A product with this title already exists. Try a slightly different title.";
  if (combined.includes("sku"))
    return "One of your variant SKUs is already in use. Please use a unique SKU.";
  return "A duplicate value was detected. Please check your title and variant SKUs.";
}

/* ══════════════════════════════════════════════════════════════
   OWNERSHIP GUARD
   Verifies the product belongs to the authenticated user.
   Attaches `req.product` so downstream handlers skip a 2nd query.

   Returns 404 (not 403) intentionally — never confirm a product
   exists to a user who doesn't own it.
══════════════════════════════════════════════════════════════ */
async function assertOwnership(req, res) {
  const { rows } = await pool.query(
    `SELECT id, name, status, is_paused, slug, user_id
     FROM market.products
     WHERE id = $1
       AND status != 'archived'`,        // archived = soft-deleted
    [req.params.id]
  );

  if (!rows.length) {
    fail(res, 404, "Product not found");
    return null;
  }

  const product = rows[0];

  if (product.user_id !== req.user.id) {
    fail(res, 404, "Product not found");  // deliberate 404
    return null;
  }

  return product;
}

/* ══════════════════════════════════════════════════════════════
   DOUBLE-SUBMIT GUARD  (shared across create + update)
══════════════════════════════════════════════════════════════ */
const inFlight = new Set();

function acquireGuard(userId, res) {
  if (inFlight.has(userId)) return false;
  inFlight.add(userId);
  res.on("finish", () => inFlight.delete(userId));
  res.on("close",  () => inFlight.delete(userId));
  return true;
}

/* ══════════════════════════════════════════════════════════════
   ① GET /api/seller/mine
   Paginated list of the authenticated seller's products.
   Query params:
     page   — 1-based (default 1)
     limit  — rows per page (default 12, max 50)
     status — filter by status value  (optional)
     search — partial name / category match (optional)
══════════════════════════════════════════════════════════════ */
router.get("/api/seller/mine", authenticate, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  ?? 1,  10));
    const limit = Math.min(
      PAGE_SIZE_MAX,
      Math.max(1, parseInt(req.query.limit ?? PAGE_SIZE_DEFAULT, 10))
    );
    const offset = (page - 1) * limit;
    const search = safeStr(req.query.search, 200);
    const status = ALLOWED_STATUSES.has(req.query.status)
      ? req.query.status
      : null;

    /* ── Build WHERE clause dynamically ── */
    const conditions = [
      "p.user_id = $1",
      "p.status  != 'archived'",          // never show soft-deleted
    ];
    const values = [req.user.id];
    let   idx    = 2;

    if (status) {
      /*
       * "paused" is a virtual status stored as is_paused = true,
       * not a status column value — handle both cases transparently.
       */
      if (status === "paused") {
        conditions.push(`p.is_paused = true`);
      } else {
        conditions.push(`p.status = $${idx}`);
        values.push(status);
        idx++;
      }
    }

    if (search) {
      conditions.push(
        `(p.name ILIKE $${idx} OR p.category ILIKE $${idx})`
      );
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(" AND ");

    /* ── Count query (same filters, no limit) ── */
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM market.products p
       WHERE ${where}`,
      values
    );
    const total      = parseInt(count, 10);
    const totalPages = Math.ceil(total / limit);

    /* ── Data query ── */
    const { rows: products } = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.category,
         p.price,
         p.original_price,
         p.brand,
         p.condition,
         p.status,
         p.is_paused,
         p.is_active,
         p.slug,
         p.tags,
         p.created_at,
         p.updated_at,

         /* Cover image — primary first, then earliest */
         COALESCE(
           (SELECT image_url
            FROM market.product_images
            WHERE product_id = p.id
              AND is_primary  = true
            LIMIT 1),
           (SELECT image_url
            FROM market.product_images
            WHERE product_id = p.id
            ORDER BY sort_order ASC
            LIMIT 1)
         ) AS image_url,

         /* All images as JSON array */
         (SELECT COALESCE(json_agg(
            json_build_object(
              'id',          pi.id,
              'url',         pi.image_url,
              'storage_key', pi.storage_key,
              'is_primary',  pi.is_primary,
              'sort_order',  pi.sort_order
            ) ORDER BY pi.sort_order ASC
          ), '[]'::json)
          FROM market.product_images pi
          WHERE pi.product_id = p.id
         ) AS images,

         /* Variants as JSON array */
         (SELECT COALESCE(json_agg(
            json_build_object(
              'id',    pv.id,
              'name',  pv.name,
              'sku',   pv.sku,
              'price', pv.price,
              'stock', pv.stock
            ) ORDER BY pv.sort_order ASC
          ), '[]'::json)
          FROM market.product_variants pv
          WHERE pv.product_id = p.id
         ) AS variants

       FROM market.products p
       WHERE ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    return ok(res, {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });

  } catch (err) {
    console.error("GET /seller/mine:", err);
    return fail(res, 500, "Failed to load your products");
  }
});

/* ══════════════════════════════════════════════════════════════
   ② GET /api/products/:id
   Full product detail — seller view.
   Includes images, variants, features, specs, box items.
══════════════════════════════════════════════════════════════ */
router.get("/api/products/:id", authenticate, async (req, res) => {
  try {
    const product = await assertOwnership(req, res);
    if (!product) return;

    /* Fetch full product with all children */
    const { rows: [full] } = await pool.query(
      `SELECT
         p.*,

         /* Images */
         (SELECT COALESCE(json_agg(
            json_build_object(
              'id',          pi.id,
              'url',         pi.image_url,
              'storage_key', pi.storage_key,
              'is_primary',  pi.is_primary,
              'sort_order',  pi.sort_order
            ) ORDER BY pi.sort_order ASC
          ), '[]'::json)
          FROM market.product_images pi
          WHERE pi.product_id = p.id
         ) AS images,

         /* Variants */
         (SELECT COALESCE(json_agg(
            json_build_object(
              'id',         pv.id,
              'name',       pv.name,
              'sku',        pv.sku,
              'price',      pv.price,
              'stock',      pv.stock,
              'attributes', pv.attributes,
              'sort_order', pv.sort_order
            ) ORDER BY pv.sort_order ASC
          ), '[]'::json)
          FROM market.product_variants pv
          WHERE pv.product_id = p.id
         ) AS variants,

         /* Features */
         (SELECT COALESCE(json_agg(
            pf.feature ORDER BY pf.id ASC
          ), '[]'::json)
          FROM market.product_features pf
          WHERE pf.product_id = p.id
         ) AS key_features,

         /* Specifications */
         (SELECT COALESCE(json_agg(
            json_build_object(
              'label', ps.label,
              'value', ps.value
            ) ORDER BY ps.sort_order ASC
          ), '[]'::json)
          FROM market.product_specs ps
          WHERE ps.product_id = p.id
         ) AS specifications,

         /* Box items */
         (SELECT COALESCE(json_agg(
            pb.item ORDER BY pb.id ASC
          ), '[]'::json)
          FROM market.product_box_items pb
          WHERE pb.product_id = p.id
         ) AS whats_in_box

       FROM market.products p
       WHERE p.id = $1`,
      [product.id]
    );

    return ok(res, { product: full });

  } catch (err) {
    console.error("GET /products/:id:", err);
    return fail(res, 500, "Failed to load product");
  }
});

/* ══════════════════════════════════════════════════════════════
   ③ PUT /api/products/:id
   Full update of an existing listing.

   Rules:
   - Only the owning seller can update.
   - Approved products that have had orders may not change price
     by more than 20% (soft guard — warn, not block — remove if
     your business rules differ).
   - New images are appended (up to MAX_IMAGES total).
   - Variants / specs / features are fully replaced (upsert).
   - Status resets to 'pending' when core fields change so the
     listing goes back through moderation.
══════════════════════════════════════════════════════════════ */
router.put(
  "/api/products/:id",
  authenticate,
  upload.array("images", MAX_IMAGES),
  async (req, res) => {

    /* ── Double-submit guard ── */
    if (!acquireGuard(req.user.id, res)) {
      return fail(res, 429,
        "Your previous submission is still processing. Please wait.");
    }

    /* ── Ownership ── */
    const product = await assertOwnership(req, res);
    if (!product) return;

    /* ── Validate inputs ── */
    const {
      name,
      description,
      short_description,
      category,
      basePrice,
      originalPrice,
      brand,
      tags,
      condition,
      variants,
      keyFeatures,
      specifications,
      whatsInBox,
      weight_kg,
      dimensions,
      delivery_options,
      return_policy,
      warranty,
      /* Image management */
      keep_image_ids,    // JSON array of existing image IDs to retain
      primary_image_id,  // ID of image to mark as primary
    } = req.body;

    const cleanName = safeStr(name, 200);
    if (!cleanName)
      return fail(res, 422, "Product name is required");

    const cleanCategory = safeStr(category, 100);
    if (!cleanCategory)
      return fail(res, 422, "Category is required");

    const price = parseInt(basePrice, 10);
    if (isNaN(price) || price <= 0)
      return fail(res, 422, "A valid base price is required");

    const parsedOriginalPrice = originalPrice
      ? parseInt(originalPrice, 10) : null;

    if (parsedOriginalPrice !== null) {
      if (isNaN(parsedOriginalPrice))
        return fail(res, 422, "Original price must be a valid number");
      if (parsedOriginalPrice < price)
        return fail(res, 422,
          "Original price must be greater than or equal to base price");
    }

    const cleanCondition = ALLOWED_CONDITIONS.has(condition)
      ? condition : "new";

    const parsedWeight = weight_kg ? parseFloat(weight_kg) : null;
    if (parsedWeight !== null && isNaN(parsedWeight))
      return fail(res, 422, "Weight must be a valid number");

    const parsedTags     = parseJSON(tags,             []);
    const parsedDims     = parseJSON(dimensions,       null);
    const parsedDelivery = parseJSON(delivery_options, null);
    const parsedVariants = parseJSON(variants,         []);
    const parsedFeatures = parseJSON(keyFeatures,      []);
    const parsedBox      = parseJSON(whatsInBox,       []);
    const parsedSpecs    = parseJSON(specifications,   []);
    const keepIds        = parseJSON(keep_image_ids,   null);  // null = keep all

    /* ── Validate variant SKUs unique within submission ── */
    if (parsedVariants.length > 0) {
      const skuSet = new Set();
      for (const v of parsedVariants) {
        const sku = safeStr(String(v?.sku ?? ""))?.toUpperCase();
        if (!sku) continue;
        if (skuSet.has(sku)) {
          return fail(res, 422,
            `Duplicate variant SKU in your submission: "${sku}".`);
        }
        skuSet.add(sku);
      }
    }

    /* ────────────────────────────────────────────────────────
       Determine which existing images to DROP.
       keepIds = null → keep all (no removal intent from client).
       keepIds = []   → remove all existing (replace entirely).
       keepIds = [x]  → keep only image with id = x.
    ──────────────────────────────────────────────────────── */
    let imagesToDelete = [];

    if (Array.isArray(keepIds)) {
      const { rows: existing } = await pool.query(
        `SELECT id, storage_key
         FROM market.product_images
         WHERE product_id = $1`,
        [product.id]
      );

      imagesToDelete = existing.filter(
        (img) => !keepIds.includes(String(img.id))
      );

      /* Enforce total image cap */
      const remainingCount = existing.length
        - imagesToDelete.length
        + (req.files?.length ?? 0);

      if (remainingCount > MAX_IMAGES) {
        return fail(res, 400,
          `Total images cannot exceed ${MAX_IMAGES}. ` +
          `You currently have ${existing.length - imagesToDelete.length} ` +
          `and are adding ${req.files?.length ?? 0}.`
        );
      }
    }

    /* ── Upload new images if provided ── */
    let uploaded = [];
    if (req.files?.length) {
      try {
        uploaded = await processAndUploadImages(req.files);
      } catch (uploadErr) {
        await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));
        console.error("Image upload error (update):", uploadErr);
        return fail(res, 502, "Image upload failed. Please try again.");
      }
    }

    /* ────────────────────────────────────────────────────────
       Decide whether core changes warrant re-moderation.
       Re-submit to pending if: name, description, or category changed.
    ──────────────────────────────────────────────────────── */
    const { rows: [current] } = await pool.query(
      `SELECT name, description, category, price
       FROM market.products WHERE id = $1`,
      [product.id]
    );

    const coreChanged =
      current.name        !== cleanName     ||
      current.category    !== cleanCategory ||
      current.description !== safeStr(description, 2000);

    const newStatus = coreChanged ? "pending" : undefined;

    /* ────────────────────────────────────────────────────────
       DB transaction
    ──────────────────────────────────────────────────────── */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* Build SET clause dynamically to avoid overwriting unchanged fields */
      const setClauses = [
        "name              = $1",
        "description       = $2",
        "short_description = $3",
        "category          = $4",
        "condition         = $5",
        "price             = $6",
        "original_price    = $7",
        "brand             = $8",
        "tags              = $9",
        "weight_kg         = $10",
        "dimensions        = $11",
        "delivery_options  = $12",
        "return_policy     = $13",
        "warranty          = $14",
        "updated_at        = NOW()",
      ];

      const updateValues = [
        cleanName,
        safeStr(description,       2000),
        safeStr(short_description,  300),
        cleanCategory,
        cleanCondition,
        price,
        parsedOriginalPrice,
        safeStr(brand, 100),
        parsedTags.length ? parsedTags : null,
        parsedWeight,
        parsedDims     ? JSON.stringify(parsedDims)     : null,
        parsedDelivery ? JSON.stringify(parsedDelivery) : null,
        safeStr(return_policy, 1000),
        safeStr(warranty,       500),
      ];

      let paramIdx = updateValues.length + 1;

      /* Conditionally reset status for re-moderation */
      if (newStatus) {
        setClauses.push(`status = $${paramIdx}`);
        updateValues.push(newStatus);
        paramIdx++;

        /* Also regenerate slug if name changed */
        const newSlug = generateSlug(cleanName, product.id);
        setClauses.push(`slug = $${paramIdx}`);
        updateValues.push(newSlug);
        paramIdx++;
      }

      updateValues.push(product.id);  // final param for WHERE

      await client.query(
        `UPDATE market.products
         SET ${setClauses.join(", ")}
         WHERE id = $${paramIdx}`,
        updateValues
      );

      /* ── Remove dropped images from DB ── */
      if (imagesToDelete.length) {
        await client.query(
          `DELETE FROM market.product_images
           WHERE id = ANY($1::uuid[])`,
          [imagesToDelete.map((i) => i.id)]
        );
      }

      /* ── Insert new images ── */
      if (uploaded.length) {
        /* Find current max sort_order so new images append correctly */
        const { rows: [{ max_order }] } = await client.query(
          `SELECT COALESCE(MAX(sort_order), -1) AS max_order
           FROM market.product_images
           WHERE product_id = $1`,
          [product.id]
        );
        let nextOrder = parseInt(max_order, 10) + 1;

        /* If no images remain after deletions, first new image is primary */
        const { rows: [{ remaining }] } = await client.query(
          `SELECT COUNT(*) AS remaining
           FROM market.product_images
           WHERE product_id = $1`,
          [product.id]
        );
        const noneLeft = parseInt(remaining, 10) === 0;

        for (let i = 0; i < uploaded.length; i++) {
          await client.query(
            `INSERT INTO market.product_images
               (product_id, image_url, storage_key, is_primary, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              product.id,
              uploaded[i].public_url,
              uploaded[i].key,
              noneLeft && i === 0,   // only primary if no others exist
              nextOrder + i,
            ]
          );
        }
      }

      /* ── Set primary image if specified ── */
      if (primary_image_id) {
        /* Clear all primaries for this product, then set the chosen one */
        await client.query(
          `UPDATE market.product_images
           SET is_primary = (id = $1)
           WHERE product_id = $2`,
          [primary_image_id, product.id]
        );
      }

      /* ── Replace children ── */
      await replaceVariants(client, product.id, parsedVariants);
      await insertList(client, "product_features",  "feature",
                       product.id, parsedFeatures);
      await insertList(client, "product_box_items", "item",
                       product.id, parsedBox);
      await replaceSpecs(client, product.id, parsedSpecs);

      await client.query("COMMIT");

      /* ── Delete R2 objects for removed images (after commit) ── */
      await Promise.allSettled(
        imagesToDelete.map((i) => deleteFromR2(i.storage_key))
      );

      return ok(res, {
        message: coreChanged
          ? "Listing updated and resubmitted for review."
          : "Listing updated successfully.",
        data: {
          productId : product.id,
          status    : newStatus ?? current.status,
          resubmitted: !!newStatus,
        },
      });

    } catch (dbErr) {
      await client.query("ROLLBACK");
      /* Delete any newly uploaded R2 images on failure */
      await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));
      console.error("PUT /products/:id DB error:", dbErr);

      if (dbErr.status === 422) return fail(res, 422, dbErr.message);
      if (dbErr.code === "23505")
        return fail(res, 409, classifyDuplicateError(dbErr));

      return fail(res, 500, "Failed to update listing. Please try again.");

    } finally {
      client.release();
    }
  }
);

/* ══════════════════════════════════════════════════════════════
   ④ PATCH /api/products/:id/pause
   Toggle pause ↔ resume on an approved product.

   Rules:
   - Only approved products can be paused.
   - Rejected / pending / archived products cannot be paused
     (they are already not visible to buyers).
   - Toggling does NOT trigger re-moderation.
══════════════════════════════════════════════════════════════ */
router.patch("/api/products/:id/pause", authenticate, async (req, res) => {
  try {
    const product = await assertOwnership(req, res);
    if (!product) return;

    /* Only approved listings can be paused */
    if (product.status !== "approved") {
      return fail(res, 409,
        `Only approved listings can be paused or resumed. ` +
        `This listing is currently "${product.status}".`
      );
    }

    const nowPaused = !product.is_paused;

    await pool.query(
      `UPDATE market.products
       SET is_paused  = $1,
           is_active  = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [nowPaused, !nowPaused, product.id]
    );

    return ok(res, {
      message  : nowPaused ? "Listing paused."   : "Listing resumed.",
      data     : { productId: product.id, is_paused: nowPaused },
    });

  } catch (err) {
    console.error("PATCH /products/:id/pause:", err);
    return fail(res, 500, "Failed to update listing status");
  }
});

/* ══════════════════════════════════════════════════════════════
   ⑤ PATCH /api/products/:id/images
   Reorder images and/or change which image is primary.

   Body (JSON):
   {
     order: ["uuid1", "uuid2", ...],   // full ordered list of image IDs
     primary_id: "uuid"                // optional — image to mark primary
   }
══════════════════════════════════════════════════════════════ */
router.patch("/api/products/:id/images", authenticate, async (req, res) => {
  try {
    const product = await assertOwnership(req, res);
    if (!product) return;

    const { order, primary_id } = req.body;

    if (!Array.isArray(order) || !order.length) {
      return fail(res, 422, "`order` must be a non-empty array of image IDs");
    }

    /* Confirm all supplied IDs belong to this product */
    const { rows: existing } = await pool.query(
      `SELECT id FROM market.product_images WHERE product_id = $1`,
      [product.id]
    );
    const existingSet = new Set(existing.map((r) => String(r.id)));

    for (const imgId of order) {
      if (!existingSet.has(String(imgId))) {
        return fail(res, 422, `Image ID "${imgId}" does not belong to this product`);
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* Update sort_order for each image */
      for (let i = 0; i < order.length; i++) {
        await client.query(
          `UPDATE market.product_images
           SET sort_order = $1
           WHERE id = $2 AND product_id = $3`,
          [i, order[i], product.id]
        );
      }

      /* Update primary if specified */
      if (primary_id) {
        if (!existingSet.has(String(primary_id))) {
          await client.query("ROLLBACK");
          return fail(res, 422,
            `primary_id "${primary_id}" does not belong to this product`);
        }
        await client.query(
          `UPDATE market.product_images
           SET is_primary = (id = $1)
           WHERE product_id = $2`,
          [primary_id, product.id]
        );
      }

      await client.query("COMMIT");
      return ok(res, { message: "Image order updated" });

    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error("PATCH /products/:id/images:", err);
    return fail(res, 500, "Failed to update image order");
  }
});

/* ══════════════════════════════════════════════════════════════
   ⑥ DELETE /api/products/:id/images/:imgId
   Remove a single image from a product.

   Rules:
   - Product must have > 1 image (cannot remove the last one).
   - Deletes from DB and R2.
   - If deleted image was primary, promotes the next image.
══════════════════════════════════════════════════════════════ */
router.delete(
  "/api/products/:id/images/:imgId",
  authenticate,
  async (req, res) => {
    try {
      const product = await assertOwnership(req, res);
      if (!product) return;

      /* Fetch the target image */
      const { rows } = await pool.query(
        `SELECT id, storage_key, is_primary
         FROM market.product_images
         WHERE id = $1 AND product_id = $2`,
        [req.params.imgId, product.id]
      );

      if (!rows.length)
        return fail(res, 404, "Image not found");

      const [img] = rows;

      /* Enforce minimum 1 image */
      const { rows: [{ cnt }] } = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM market.product_images
         WHERE product_id = $1`,
        [product.id]
      );
      if (parseInt(cnt, 10) <= 1)
        return fail(res, 409,
          "Cannot remove the only image. Upload a replacement first.");

      /* Delete from DB */
      await pool.query(
        `DELETE FROM market.product_images WHERE id = $1`,
        [img.id]
      );

      /* Promote next image to primary if needed */
      if (img.is_primary) {
        await pool.query(
          `UPDATE market.product_images
           SET is_primary = true
           WHERE product_id = $1
           ORDER BY sort_order ASC
           LIMIT 1`,
          [product.id]
        );
      }

      /* Delete from R2 (best-effort — don't block response) */
      deleteFromR2(img.storage_key).catch((e) =>
        console.error("R2 delete failed (image remove):", e)
      );

      return ok(res, { message: "Image removed" });

    } catch (err) {
      console.error("DELETE /products/:id/images/:imgId:", err);
      return fail(res, 500, "Failed to remove image");
    }
  }
);

/* ══════════════════════════════════════════════════════════════
   ⑦ DELETE /api/products/:id
   Soft delete — sets status = 'archived', is_active = false.
   Does NOT destroy DB rows or R2 images so admins can recover.

   Hard delete (destroying R2 + rows) should be an admin-only
   scheduled job, not a seller-facing operation.
══════════════════════════════════════════════════════════════ */
router.delete("/api/products/:id", authenticate, async (req, res) => {
  try {
    const product = await assertOwnership(req, res);
    if (!product) return;

    await pool.query(
      `UPDATE market.products
       SET status     = 'archived',
           is_active  = false,
           is_paused  = false,
           updated_at = NOW()
       WHERE id = $1`,
      [product.id]
    );

    return ok(res, {
      message: "Listing removed from your store.",
      data   : { productId: product.id },
    });

  } catch (err) {
    console.error("DELETE /products/:id:", err);
    return fail(res, 500, "Failed to delete listing");
  }
});

export default router;