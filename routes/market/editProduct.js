/**
 * PATCH /api/products/:id
 * Update own listing — resets to pending for re-review.
 *
 * Flow:
 *  1. Validate inputs              (before any I/O)
 *  2. Ownership check              (before any I/O)
 *  3. Compress + upload new images (parallel, before DB transaction)
 *  4. DB transaction               (update product → images → children)
 *  5. Delete old R2 images         (after successful commit)
 *  6. On any failure               (rollback DB + delete new R2 uploads)
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
  assertOwner,
  replaceVariants,
  replaceList,
  replaceSpecs,
  deleteProductImagesFromR2,
  ok,
  fail,
} from "./helpers.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   SLUG GENERATOR
   Pure JS — works with CockroachDB
   Format : "product-name-{first-8-chars-of-uuid}"
   Example: "iphone-13-pro-max-80bff8ac"
══════════════════════════════════════════════════════════════ */
function generateSlug(name, id) {
  const base = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `${base}-${String(id).slice(0, 8)}`;
}

/* ══════════════════════════════════════════════════════════════
   ALLOWED VALUES
══════════════════════════════════════════════════════════════ */
const ALLOWED_CONDITIONS = new Set(["new", "used", "refurbished"]);

/* ══════════════════════════════════════════════════════════════
   PATCH /:id
══════════════════════════════════════════════════════════════ */
router.patch(
  "/:id",
  authenticate,
  upload.array("images", MAX_IMAGES),
  async (req, res) => {
    const productId = req.params.id;

    /* ────────────────────────────────────────────────────────
       STEP 1 — Validate inputs before any I/O
    ──────────────────────────────────────────────────────── */
    if (req.files?.length > MAX_IMAGES)
      return fail(res, 400, `You can upload a maximum of ${MAX_IMAGES} images`);

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
    } = req.body;

    /* ── At least one field must be provided ── */
    const hasFields = [
      name, description, short_description,
      category, basePrice, originalPrice,
      brand, tags, condition,
      variants, keyFeatures, specifications,
      whatsInBox, weight_kg, dimensions,
      delivery_options, return_policy, warranty,
    ].some((v) => v !== undefined);

    const hasImages = req.files?.length > 0;

    if (!hasFields && !hasImages)
      return fail(res, 422, "Nothing to update");

    /* ── Field validation ── */
    const cleanName     = name      ? safeStr(name, 200)     : undefined;
    const cleanCategory = category  ? safeStr(category, 100) : undefined;
    const cleanBrand    = brand     ? safeStr(brand, 100)    : undefined;

    if (name !== undefined && !cleanName)
      return fail(res, 422, "Product name cannot be empty");

    if (category !== undefined && !cleanCategory)
      return fail(res, 422, "Category cannot be empty");

    let price = undefined;
    if (basePrice !== undefined) {
      price = parseInt(basePrice, 10);
      if (isNaN(price) || price <= 0)
        return fail(res, 422, "A valid base price is required");
    }

    let parsedOriginalPrice = undefined;
    if (originalPrice !== undefined) {
      parsedOriginalPrice = originalPrice === "" || originalPrice === null
        ? null
        : parseInt(originalPrice, 10);

      if (parsedOriginalPrice !== null && isNaN(parsedOriginalPrice))
        return fail(res, 422, "Original price must be a valid number");

      if (
        parsedOriginalPrice !== null &&
        price !== undefined &&
        parsedOriginalPrice < price
      ) return fail(res, 422, "Original price must be greater than or equal to base price");
    }

    let parsedWeight = undefined;
    if (weight_kg !== undefined) {
      parsedWeight = weight_kg === "" ? null : parseFloat(weight_kg);
      if (parsedWeight !== null && isNaN(parsedWeight))
        return fail(res, 422, "Weight must be a valid number");
    }

    const cleanCondition = condition
      ? ALLOWED_CONDITIONS.has(condition) ? condition : "new"
      : undefined;

    const parsedTags     = tags             ? parseJSON(tags,             [])   : undefined;
    const parsedDims     = dimensions       ? parseJSON(dimensions,       null) : undefined;
    const parsedDelivery = delivery_options ? parseJSON(delivery_options, null) : undefined;
    const parsedVariants = variants         ? parseJSON(variants,         [])   : undefined;
    const parsedFeatures = keyFeatures      ? parseJSON(keyFeatures,      [])   : undefined;
    const parsedBox      = whatsInBox       ? parseJSON(whatsInBox,       [])   : undefined;
    const parsedSpecs    = specifications   ? parseJSON(specifications,   [])   : undefined;

    /* ────────────────────────────────────────────────────────
       STEP 2 — Ownership check (lightweight, no transaction)
    ──────────────────────────────────────────────────────── */
    {
      const quickClient = await pool.connect();
      try {
        const guard = await assertOwner(quickClient, productId, req.user.id);
        if (guard.error) return fail(res, guard.error, guard.message);
      } finally {
        quickClient.release();
      }
    }

    /* ────────────────────────────────────────────────────────
       STEP 3 — Compress + upload NEW images in parallel
       Done before DB transaction so URLs are ready.
       Old images are only deleted AFTER successful commit.
    ──────────────────────────────────────────────────────── */
    let newUploads = []; // { key, public_url }[]

    if (hasImages) {
      try {
        newUploads = await processAndUploadImages(req.files);
      } catch (uploadErr) {
        await Promise.allSettled(newUploads.map((f) => deleteFromR2(f.key)));
        console.error("Image upload error:", uploadErr);
        return fail(res, 502, "Image upload failed. Please try again.");
      }
    }

    /* ────────────────────────────────────────────────────────
       STEP 4 — DB transaction
    ──────────────────────────────────────────────────────── */

    /* Track old image keys so we can delete from R2 after commit */
    let oldImageKeys = [];

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* 4a. Re-check ownership inside transaction (prevent race) */
      const guard = await assertOwner(client, productId, req.user.id);
      if (guard.error) {
        await client.query("ROLLBACK");
        await Promise.allSettled(newUploads.map((f) => deleteFromR2(f.key)));
        return fail(res, guard.error, guard.message);
      }

      /* 4b. Generate new slug if name changed */
      const newSlug = cleanName
        ? generateSlug(cleanName, productId)
        : undefined;

      /* 4c. Update core product row */
      await client.query(
        `UPDATE market.products SET
           name              = COALESCE($2,  name),
           description       = COALESCE($3,  description),
           short_description = COALESCE($4,  short_description),
           category          = COALESCE($5,  category),
           condition         = COALESCE($6,  condition),
           price             = COALESCE($7,  price),
           original_price    = COALESCE($8,  original_price),
           brand             = COALESCE($9,  brand),
           tags              = COALESCE($10, tags),
           weight_kg         = COALESCE($11, weight_kg),
           dimensions        = COALESCE($12, dimensions),
           delivery_options  = COALESCE($13, delivery_options),
           return_policy     = COALESCE($14, return_policy),
           warranty          = COALESCE($15, warranty),
           slug              = COALESCE($16, slug),
           status            = 'pending',
           is_active         = false,
           is_paused         = false,
           reviewed_by       = NULL,
           reviewed_at       = NULL,
           rejection_reason  = NULL,
           updated_at        = NOW()
         WHERE id = $1`,
        [
          productId,
          cleanName                                           ?? null,
          safeStr(description,       2000)                   ?? null,
          safeStr(short_description,  300)                   ?? null,
          cleanCategory                                       ?? null,
          cleanCondition                                      ?? null,
          price                                               ?? null,
          parsedOriginalPrice                                 ?? null,
          cleanBrand                                          ?? null,
          parsedTags?.length ? parsedTags                    : null,
          parsedWeight                                        ?? null,
          parsedDims     ? JSON.stringify(parsedDims)        : null,
          parsedDelivery ? JSON.stringify(parsedDelivery)    : null,
          safeStr(return_policy, 1000)                       ?? null,
          safeStr(warranty,       500)                       ?? null,
          newSlug                                             ?? null,
        ]
      );

      /* 4d. Replace images if new files were uploaded */
      if (hasImages) {
        /* Grab old storage keys before deleting rows */
        const { rows: oldImages } = await client.query(
          `SELECT storage_key
           FROM market.product_images
           WHERE product_id = $1`,
          [productId]
        );
        oldImageKeys = oldImages
          .map((r) => r.storage_key)
          .filter(Boolean);

        /* Delete old image rows */
        await client.query(
          "DELETE FROM market.product_images WHERE product_id = $1",
          [productId]
        );

        /* Insert new image rows */
        for (let i = 0; i < newUploads.length; i++) {
          await client.query(
            `INSERT INTO market.product_images
               (product_id, image_url, storage_key, is_primary, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              productId,
              newUploads[i].public_url,
              newUploads[i].key,
              i === 0,
              i,
            ]
          );
        }
      }

      /* 4e. Replace child rows if provided */
      if (parsedVariants !== undefined)
        await replaceVariants(client, productId, parsedVariants);

      if (parsedFeatures !== undefined)
        await replaceList(client, "product_features",  "feature", productId, parsedFeatures);

      if (parsedBox !== undefined)
        await replaceList(client, "product_box_items", "item",    productId, parsedBox);

      if (parsedSpecs !== undefined)
        await replaceSpecs(client, productId, parsedSpecs);

      await client.query("COMMIT");

      /* ────────────────────────────────────────────────────
         STEP 5 — Delete OLD R2 images after successful commit
         Done outside transaction — DB is already safe.
      ──────────────────────────────────────────────────── */
      if (oldImageKeys.length) {
        await Promise.allSettled(oldImageKeys.map(deleteFromR2));
      }

      return ok(res, {
        message: "Listing updated and resubmitted for review.",
        data   : {
          productId,
          slug  : newSlug  ?? undefined,
          status: "pending",
        },
      });

    } catch (dbErr) {
      await client.query("ROLLBACK");

      /* Delete newly uploaded R2 images — old ones are still intact */
      await Promise.allSettled(newUploads.map((f) => deleteFromR2(f.key)));

      console.error("PATCH /products/:id DB error:", dbErr);

      if (dbErr.code === "23505")
        return fail(res, 409, "A product with this slug or SKU already exists");

      return fail(res, 500, "Failed to update listing. Please try again.");

    } finally {
      client.release();
    }
  }
);

export default router;