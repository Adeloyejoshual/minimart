/**
 * POST /api/products
 * Create a new listing.
 * Multipart: images[] + JSON fields.
 *
 * • Images are compressed to WebP ≤ 1200px @ quality 75
 * • Uploaded to Cloudflare R2
 * • Orphaned R2 files are deleted on DB failure
 * • All validation happens BEFORE the DB transaction
 */

import express            from "express";
import { authenticate }   from "../../middleware/auth.js";
import { upload, uploadToR2, deleteFromR2 } from "../../middleware/upload.js";
import {
  pool, MAX_IMAGES,
  safeStr, parseJSON,
  replaceVariants, insertList, replaceSpecs,
  ok, fail,
} from "./helpers.js";

const router = express.Router();

/* ── Slug generator (pure JS — works with CockroachDB) ──────────
   Format : "product-name-here-{first-8-chars-of-uuid}"
   Example: "iphone-13-pro-max-80bff8ac"
─────────────────────────────────────────────────────────────── */
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
   POST /
══════════════════════════════════════════════════════════════ */
router.post(
  "/",
  authenticate,
  upload.array("images", MAX_IMAGES),
  async (req, res) => {

    /* ── 1. Validate files ── */
    if (!req.files?.length)
      return fail(res, 400, "At least one image is required");

    /* ── 2. Parse & validate body BEFORE touching the DB ── */
    const {
      name, description, short_description,
      category, basePrice, originalPrice,
      brand, tags, condition,
      variants, keyFeatures, specifications, whatsInBox,
      weight_kg, dimensions, delivery_options,
      return_policy, warranty,
    } = req.body;

    const cleanName = safeStr(name, 200);
    if (!cleanName)
      return fail(res, 422, "Product name is required");

    if (!category)
      return fail(res, 422, "Category is required");

    const price = parseInt(basePrice, 10);
    if (isNaN(price) || price <= 0)
      return fail(res, 422, "Valid base price is required");

    const allowedConditions = ["new", "used", "refurbished"];
    const cleanCondition    = allowedConditions.includes(condition)
      ? condition
      : "new";

    const parsedTags     = parseJSON(tags,             []);
    const parsedDims     = parseJSON(dimensions,       null);
    const parsedDelivery = parseJSON(delivery_options, null);
    const parsedVariants = parseJSON(variants);
    const parsedFeatures = parseJSON(keyFeatures);
    const parsedBox      = parseJSON(whatsInBox);
    const parsedSpecs    = parseJSON(specifications);

    /* ── 3. Upload images to R2 BEFORE transaction ──────────────
       Track uploaded keys so we can delete them on failure.
    ─────────────────────────────────────────────────────────── */
    const uploaded = []; // { key, public_url }[]

    try {
      const results = await Promise.allSettled(
        req.files.map((f) => uploadToR2(f))
      );

      for (const result of results) {
        if (result.status === "rejected") {
          throw new Error(`Image upload failed: ${result.reason?.message}`);
        }
        uploaded.push(result.value);
      }
    } catch (uploadErr) {
      // Clean up any images that did succeed before the failure
      await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));
      console.error("R2 upload error:", uploadErr);
      return fail(res, 502, "Image upload failed. Please try again.");
    }

    /* ── 4. DB transaction ── */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* 4a. Insert product to get real UUID */
      const { rows: [{ id: productId }] } = await client.query(
        `INSERT INTO market.products (
           user_id, name, description, short_description,
           category, condition,
           price, original_price,
           brand, tags,
           weight_kg, dimensions, delivery_options,
           return_policy, warranty,
           status, is_active
         )
         VALUES (
           $1,$2,$3,$4,
           $5,$6,
           $7,$8,
           $9,$10,
           $11,$12,$13,
           $14,$15,
           'pending', false
         )
         RETURNING id`,
        [
          req.user.id,
          cleanName,
          safeStr(description,       2000),
          safeStr(short_description,  300),
          category,
          cleanCondition,
          price,
          originalPrice ? parseInt(originalPrice, 10) : null,
          safeStr(brand, 100),
          parsedTags.length ? parsedTags : null,
          weight_kg      ? parseFloat(weight_kg)          : null,
          parsedDims     ? JSON.stringify(parsedDims)     : null,
          parsedDelivery ? JSON.stringify(parsedDelivery) : null,
          safeStr(return_policy, 1000),
          safeStr(warranty,       500),
        ]
      );

      /* 4b. Generate slug from real UUID */
      const slug = generateSlug(cleanName, productId);
      await client.query(
        "UPDATE market.products SET slug = $1 WHERE id = $2",
        [slug, productId]
      );

      /* 4c. Save image rows */
      for (let i = 0; i < uploaded.length; i++) {
        await client.query(
          `INSERT INTO market.product_images
             (product_id, image_url, storage_key, is_primary, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [productId, uploaded[i].public_url, uploaded[i].key, i === 0, i]
        );
      }

      /* 4d. Child rows */
      await replaceVariants(client, productId, parsedVariants);
      await insertList(client, "product_features",  "feature", productId, parsedFeatures);
      await insertList(client, "product_box_items", "item",    productId, parsedBox);
      await replaceSpecs(client, productId, parsedSpecs);

      await client.query("COMMIT");

      return ok(res, {
        message: "Listing submitted for review. You'll be notified once approved.",
        data   : { productId, slug, status: "pending" },
      }, 201);

    } catch (dbErr) {
      await client.query("ROLLBACK");

      /* Delete R2 images so nothing is orphaned */
      await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));

      console.error("POST /products DB error:", dbErr);

      if (dbErr.code === "23505")
        return fail(res, 409, "A product with this slug or SKU already exists");

      return fail(res, 500, "Failed to create listing. Please try again.");

    } finally {
      client.release();
    }
  }
);

export default router;