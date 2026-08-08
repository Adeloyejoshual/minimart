/**
 * POST /api/products
 * Create a new listing.
 * Multipart: images[] + JSON fields.
 *
 * Flow:
 *  1. Validate inputs          (before any I/O)
 *  2. Compress + upload images (parallel, before DB)
 *  3. DB transaction           (insert product → slug → images → children)
 *  4. On any failure           (rollback DB + delete R2 images)
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
   SLUG GENERATOR
   Pure JS — works with CockroachDB (no DB function needed)
   Format : "product-name-{first-8-chars-of-uuid}"
   Example: "iphone-13-pro-max-80bff8ac"
══════════════════════════════════════════════════════════════ */
function generateSlug(name, id) {
  const base = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")   // strip special chars
    .replace(/\s+/g, "-")           // spaces → hyphens
    .replace(/-+/g, "-")            // collapse multiple hyphens
    .replace(/^-|-$/g, "")          // trim leading/trailing hyphens
    .slice(0, 60);                   // max 60 chars

  return `${base}-${String(id).slice(0, 8)}`;
}

/* ══════════════════════════════════════════════════════════════
   ALLOWED VALUES
══════════════════════════════════════════════════════════════ */
const ALLOWED_CONDITIONS = new Set(["new", "used", "refurbished"]);

/* ══════════════════════════════════════════════════════════════
   POST /
══════════════════════════════════════════════════════════════ */
router.post(
  "/",
  authenticate,
  upload.array("images", MAX_IMAGES),
  async (req, res) => {

    /* ────────────────────────────────────────────────────────
       STEP 1 — Validate everything before touching I/O
    ──────────────────────────────────────────────────────── */
    if (!req.files?.length)
      return fail(res, 400, "At least one image is required");

    if (req.files.length > MAX_IMAGES)
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

    /* ── Required fields ── */
    const cleanName = safeStr(name, 200);
    if (!cleanName)
      return fail(res, 422, "Product name is required");

    const cleanCategory = safeStr(category, 100);
    if (!cleanCategory)
      return fail(res, 422, "Category is required");

    const price = parseInt(basePrice, 10);
    if (isNaN(price) || price <= 0)
      return fail(res, 422, "A valid base price is required");

    /* ── Optional fields ── */
    const parsedOriginalPrice = originalPrice
      ? parseInt(originalPrice, 10)
      : null;

    if (parsedOriginalPrice !== null && isNaN(parsedOriginalPrice))
      return fail(res, 422, "Original price must be a valid number");

    if (parsedOriginalPrice !== null && parsedOriginalPrice < price)
      return fail(res, 422, "Original price must be greater than or equal to base price");

    const cleanCondition = ALLOWED_CONDITIONS.has(condition)
      ? condition
      : "new";

    const parsedWeight = weight_kg ? parseFloat(weight_kg) : null;
    if (parsedWeight !== null && isNaN(parsedWeight))
      return fail(res, 422, "Weight must be a valid number");

    /* ── JSON fields ── */
    const parsedTags      = parseJSON(tags,             []);
    const parsedDims      = parseJSON(dimensions,       null);
    const parsedDelivery  = parseJSON(delivery_options, null);
    const parsedVariants  = parseJSON(variants,         []);
    const parsedFeatures  = parseJSON(keyFeatures,      []);
    const parsedBox       = parseJSON(whatsInBox,       []);
    const parsedSpecs     = parseJSON(specifications,   []);

    /* ────────────────────────────────────────────────────────
       STEP 2 — Compress + upload images to R2 in parallel
       Done BEFORE the DB transaction so we have URLs ready.
       On any upload failure → delete partial uploads + bail.
    ──────────────────────────────────────────────────────── */
    let uploaded = []; // { key, public_url }[]

    try {
      uploaded = await processAndUploadImages(req.files);
    } catch (uploadErr) {
      await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));
      console.error("Image upload error:", uploadErr);
      return fail(res, 502, "Image upload failed. Please try again.");
    }

    /* ────────────────────────────────────────────────────────
       STEP 3 — DB transaction
    ──────────────────────────────────────────────────────── */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* 3a. Insert product row to get real UUID */
      const { rows: [{ id: productId }] } = await client.query(
        `INSERT INTO market.products (
           user_id,
           name,
           description,
           short_description,
           category,
           condition,
           price,
           original_price,
           brand,
           tags,
           weight_kg,
           dimensions,
           delivery_options,
           return_policy,
           warranty,
           status,
           is_active
         )
         VALUES (
           $1, $2, $3, $4,
           $5, $6,
           $7, $8,
           $9, $10,
           $11, $12, $13,
           $14, $15,
           'pending', false
         )
         RETURNING id`,
        [
          req.user.id,
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
          parsedDims    ? JSON.stringify(parsedDims)    : null,
          parsedDelivery? JSON.stringify(parsedDelivery): null,
          safeStr(return_policy, 1000),
          safeStr(warranty,       500),
        ]
      );

      /* 3b. Generate slug from real UUID and update */
      const slug = generateSlug(cleanName, productId);

      await client.query(
        `UPDATE market.products
         SET slug = $1
         WHERE id = $2`,
        [slug, productId]
      );

      /* 3c. Insert image rows */
      for (let i = 0; i < uploaded.length; i++) {
        await client.query(
          `INSERT INTO market.product_images
             (product_id, image_url, storage_key, is_primary, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            productId,
            uploaded[i].public_url,
            uploaded[i].key,
            i === 0,   // first image is primary
            i,
          ]
        );
      }

      /* 3d. Child rows — variants, features, specs, box items */
      await replaceVariants(client, productId, parsedVariants);
      await insertList(client, "product_features",  "feature", productId, parsedFeatures);
      await insertList(client, "product_box_items", "item",    productId, parsedBox);
      await replaceSpecs(client, productId, parsedSpecs);

      await client.query("COMMIT");

      return ok(
        res,
        {
          message: "Listing submitted for review. You will be notified once approved.",
          data   : { productId, slug, status: "pending" },
        },
        201
      );

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