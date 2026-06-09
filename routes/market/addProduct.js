/**
 * POST /api/products
 * Create a new listing.
 * Multipart: images[] + JSON fields.
 */

import express from "express";
import { authenticate } from "../../middleware/auth.js";
import { upload, uploadToCloudinary } from "../../middleware/upload.js";
import {
  pool, MAX_IMAGES,
  safeStr, parseJSON,
  replaceVariants, insertList, replaceSpecs, uploadFiles,
  ok, fail,
} from "./helpers.js";

const router = express.Router();

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
        return_policy, warranty,
      } = req.body;

      /* ── Validation ── */
      const cleanName = safeStr(name, 200);
      if (!cleanName) return fail(res, 422, "Product name is required");
      if (!category)  return fail(res, 422, "Category is required");

      const price = parseInt(basePrice, 10);
      if (isNaN(price) || price <= 0)
        return fail(res, 422, "Valid base price is required");

      const parsedTags     = parseJSON(tags, []);
      const parsedDims     = parseJSON(dimensions, null);
      const parsedDelivery = parseJSON(delivery_options, null);

      /* ── Insert product ── */
      const { rows: [{ id: productId }] } = await client.query(
        `INSERT INTO market.products (
           user_id, name, description, short_description,
           category, condition,
           price, original_price,
           brand, tags, slug,
           weight_kg, dimensions, delivery_options,
           return_policy, warranty,
           status, is_active
         )
         VALUES (
           $1,$2,$3,$4,
           $5,'new',
           $6,$7,
           $8,$9,$10,
           $11,$12,$13,
           $14,$15,
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
          parsedDims     ? JSON.stringify(parsedDims)     : null,
          parsedDelivery ? JSON.stringify(parsedDelivery) : null,
          safeStr(return_policy, 1000),
          safeStr(warranty, 500),
        ]
      );

      /* ── Upload images ── */
      const uploaded = await uploadFiles(req.files, uploadToCloudinary);
      for (let i = 0; i < uploaded.length; i++) {
        await client.query(
          `INSERT INTO market.product_images
             (product_id, image_url, is_primary, sort_order)
           VALUES ($1,$2,$3,$4)`,
          [productId, uploaded[i].secure_url, i === 0, i]
        );
      }

      /* ── Child rows ── */
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

export default router;