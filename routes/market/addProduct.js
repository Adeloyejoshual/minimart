/**
 * routes/market/addproduct.js
 *
 * POST /api/products
 * Create a new seller listing.
 *
 * Auth: authenticateSeller — market.users JWT
 *       req.user.id === market.users.id === market.products.user_id ✓
 *
 * Mounted via router.use("/", addProduct) in index.js
 * Final URL: POST /api/products
 */

import express                from "express";
import { authenticateSeller } from "../../middleware/sellerAuth.js";
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
   ALLOWED VALUES
══════════════════════════════════════════════════════════════ */
const ALLOWED_CONDITIONS = new Set(["new", "used", "refurbished"]);

/* ══════════════════════════════════════════════════════════════
   DOUBLE-SUBMIT GUARD
══════════════════════════════════════════════════════════════ */
const inFlight = new Set();

/* ══════════════════════════════════════════════════════════════
   ERROR CLASSIFIER
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
   POST /
══════════════════════════════════════════════════════════════ */
router.post(
  "/",
  authenticateSeller,
  upload.array("images", MAX_IMAGES),
  async (req, res) => {

    /* ── Double-submit guard ── */
    const userId = req.user.id;   // market.users.id ✓

    if (inFlight.has(userId)) {
      return fail(res, 429,
        "Your previous submission is still processing. Please wait.");
    }

    inFlight.add(userId);
    res.on("finish", () => inFlight.delete(userId));
    res.on("close",  () => inFlight.delete(userId));

    /* ── Images ── */
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

    /* ── Required ── */
    const cleanName = safeStr(name, 200);
    if (!cleanName)
      return fail(res, 422, "Product name is required");

    const cleanCategory = safeStr(category, 100);
    if (!cleanCategory)
      return fail(res, 422, "Category is required");

    const price = parseInt(basePrice, 10);
    if (isNaN(price) || price <= 0)
      return fail(res, 422, "A valid base price is required");

    /* ── Optional numeric ── */
    const parsedOriginalPrice = originalPrice
      ? parseInt(originalPrice, 10) : null;

    if (parsedOriginalPrice !== null && isNaN(parsedOriginalPrice))
      return fail(res, 422, "Original price must be a valid number");

    if (parsedOriginalPrice !== null && parsedOriginalPrice < price)
      return fail(res, 422,
        "Original price must be greater than or equal to base price");

    const cleanCondition = ALLOWED_CONDITIONS.has(condition)
      ? condition : "new";

    const parsedWeight = weight_kg ? parseFloat(weight_kg) : null;
    if (parsedWeight !== null && isNaN(parsedWeight))
      return fail(res, 422, "Weight must be a valid number");

    /* ── JSON fields ── */
    const parsedTags     = parseJSON(tags,             []);
    const parsedDims     = parseJSON(dimensions,       null);
    const parsedDelivery = parseJSON(delivery_options, null);
    const parsedVariants = parseJSON(variants,         []);
    const parsedFeatures = parseJSON(keyFeatures,      []);
    const parsedBox      = parseJSON(whatsInBox,       []);
    const parsedSpecs    = parseJSON(specifications,   []);

    /* ── Duplicate SKU check (client-side — server-side in replaceVariants) ── */
    if (parsedVariants.length > 0) {
      const skuSet = new Set();
      for (const v of parsedVariants) {
        const sku = safeStr(String(v?.sku ?? ""))?.toUpperCase();
        if (!sku) continue;
        if (skuSet.has(sku)) {
          return fail(res, 422,
            `Duplicate variant SKU: "${sku}". Each variant must have a unique SKU.`);
        }
        skuSet.add(sku);
      }
    }

    /* ── Upload images to R2 ── */
    let uploaded = [];
    try {
      uploaded = await processAndUploadImages(req.files);
    } catch (uploadErr) {
      await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));
      console.error("[addproduct] Upload error:", uploadErr);
      return fail(res, 502, "Image upload failed. Please try again.");
    }

    /* ── DB transaction ── */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* Insert product row */
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
           $1,  $2,  $3,  $4,
           $5,  $6,
           $7,  $8,
           $9,  $10,
           $11, $12, $13,
           $14, $15,
           'pending', false
         )
         RETURNING id`,
        [
          userId,
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
        ]
      );

      /* Generate + set slug */
      const slug = generateSlug(cleanName, productId);
      await client.query(
        `UPDATE market.products SET slug = $1 WHERE id = $2`,
        [slug, productId]
      );

      /* Insert images */
      for (let i = 0; i < uploaded.length; i++) {
        await client.query(
          `INSERT INTO market.product_images
             (product_id, image_url, storage_key, is_primary, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [productId, uploaded[i].public_url, uploaded[i].key, i === 0, i]
        );
      }

      /* Insert child rows */
      await replaceVariants(client, productId, parsedVariants);
      await insertList(client, "product_features",  "feature",
                       productId, parsedFeatures);
      await insertList(client, "product_box_items", "item",
                       productId, parsedBox);
      await replaceSpecs(client, productId, parsedSpecs);

      await client.query("COMMIT");

      console.log(`[addproduct] ✅ created | id=${productId} | user=${userId}`);

      return ok(res, {
        message : "Listing submitted for review. You will be notified once approved.",
        data    : { productId, slug, status: "pending" },
      }, 201);

    } catch (dbErr) {
      await client.query("ROLLBACK");
      await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));
      console.error("[addproduct] DB error:", {
        message : dbErr.message,
        code    : dbErr.code,
        detail  : dbErr.detail,
        status  : dbErr.status,
      });

      if (dbErr.status === 422) return fail(res, 422, dbErr.message);
      if (dbErr.code === "23505")
        return fail(res, 409, classifyDuplicateError(dbErr));

      return fail(res, 500, "Failed to create listing. Please try again.");

    } finally {
      client.release();
    }
  }
);

export default router;