/**
 * PATCH /api/products/:id
 * Update own listing — resets to pending for re-review.
 */

import express from "express";
import { authenticate } from "../../middleware/auth.js";
import { upload, uploadToCloudinary, destroyFromCloudinary } from "../../middleware/upload.js";
import {
  pool, MAX_IMAGES,
  safeStr, parseJSON,
  assertOwner,
  replaceVariants, replaceList, replaceSpecs,
  uploadFiles, deleteOldImages,
  ok, fail,
} from "./helpers.js";

const router = express.Router();

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
        return_policy, warranty,
      } = req.body;

      const price = basePrice ? parseInt(basePrice, 10) : undefined;
      if (price !== undefined && (isNaN(price) || price <= 0))
        return fail(res, 422, "Invalid base price");

      const parsedDims     = dimensions      ? parseJSON(dimensions, null)      : undefined;
      const parsedDelivery = delivery_options ? parseJSON(delivery_options, null) : undefined;

      /* ── Update core row ── */
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
           return_policy     = COALESCE($13, return_policy),
           warranty          = COALESCE($14, warranty),
           status            = 'pending',
           is_active         = false,
           reviewed_by       = NULL,
           reviewed_at       = NULL,
           rejection_reason  = NULL
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
          tags ? parseJSON(tags, [])      : null,
          weight_kg      ? parseFloat(weight_kg)            : null,
          parsedDims     ? JSON.stringify(parsedDims)        : null,
          parsedDelivery ? JSON.stringify(parsedDelivery)    : null,
          safeStr(return_policy, 1000)    || null,
          safeStr(warranty, 500)          || null,
        ]
      );

      /* ── Replace images if new files ── */
      if (req.files?.length) {
        await deleteOldImages(client, productId, destroyFromCloudinary);
        await client.query(
          "DELETE FROM market.product_images WHERE product_id = $1",
          [productId]
        );
        const uploaded = await uploadFiles(req.files, uploadToCloudinary);
        for (let i = 0; i < uploaded.length; i++) {
          await client.query(
            `INSERT INTO market.product_images
               (product_id, image_url, is_primary, sort_order)
             VALUES ($1,$2,$3,$4)`,
            [productId, uploaded[i].secure_url, i === 0, i]
          );
        }
      }

      /* ── Optional child replacements ── */
      if (variants       !== undefined) await replaceVariants(client, productId, variants);
      if (keyFeatures    !== undefined) await replaceList(client, "product_features",  "feature", productId, parseJSON(keyFeatures));
      if (whatsInBox     !== undefined) await replaceList(client, "product_box_items", "item",    productId, parseJSON(whatsInBox));
      if (specifications !== undefined) await replaceSpecs(client, productId, parseJSON(specifications));

      await client.query("COMMIT");

      ok(res, {
        message: "Listing updated and resubmitted for review",
        data:    { status: "pending" },
      });

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

export default router;