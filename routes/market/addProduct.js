/**
 * routes/market/addproduct.js
 *
 * POST /api/products
 * Create a new seller listing.
 *
 * v4.2 — Title length 255 + Optional variant names
 * ────────────────────────────────────────────────────────
 * ✓ Title max length: 255 (VARCHAR(255))
 * ✓ Variant name is optional (only SKU and price required for variants)
 * ✓ inFlight guard uses finally block (no stuck entries)
 * ✓ Resolves UUID category_id to link into the hierarchy tree
 * ✓ Safe fallback to plain text if categories table is missing
 * ✓ Number() instead of parseInt() for price parsing
 *
 * Auth: authenticateSeller — market.users JWT
 * Mounted via router.use("/", addProduct) in index.js
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
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const MAX_TITLE_LEN       = 255;
const MAX_DESC_LEN        = 2500;
const MAX_SHORT_DESC_LEN  = 300;
const MAX_BRAND_LEN       = 100;
const MAX_RETURN_LEN      = 1000;
const MAX_WARRANTY_LEN    = 500;
const MAX_CATEGORY_LEN    = 100;
const MAX_SKU_LEN         = 100;

const ALLOWED_CONDITIONS = new Set(["new", "used", "refurbished"]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUUID = (str) =>
  typeof str === "string" && UUID_REGEX.test(str);

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

function parsePrice(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : Math.floor(n);
}

/* ══════════════════════════════════════════════════════════════
   COLUMN DETECTION
══════════════════════════════════════════════════════════════ */
let PRODUCT_COLS = null;

async function detectProductColumns() {
  if (PRODUCT_COLS) return PRODUCT_COLS;
  try {
    const { rows } = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'market'
         AND table_name   = 'products'`
    );
    const cols = new Set(rows.map((r) => r.column_name));
    PRODUCT_COLS = {
      hasCategoryId      : cols.has("category_id"),
      hasDeliveryOptions : cols.has("delivery_options"),
    };
  } catch (err) {
    PRODUCT_COLS = { hasCategoryId: false, hasDeliveryOptions: true };
  }
  return PRODUCT_COLS;
}

/* ══════════════════════════════════════════════════════════════
   RESOLVE CATEGORY
══════════════════════════════════════════════════════════════ */
async function resolveCategory(client, categoryInput, categoryIdInput) {
  const idCandidate =
    categoryIdInput ?? (isValidUUID(categoryInput) ? categoryInput : null);

  if (idCandidate && isValidUUID(idCandidate)) {
    try {
      const { rows } = await client.query(
        `SELECT id, name, slug FROM market.categories WHERE id = $1 AND is_active = true`,
        [idCandidate]
      );
      if (rows.length > 0) {
        return { categoryId: rows[0].id, categoryName: rows[0].name, categoryTableExists: true };
      }
      return { error: "Category not found. Please select a valid category." };
    } catch (err) {
      if (err.code !== "42P01") return { error: "Category lookup failed. Please try again." };
    }
  }

  const textCategory = safeStr(categoryInput, MAX_CATEGORY_LEN);
  if (!textCategory) return { error: "Category is required" };

  try {
    const { rows } = await client.query(
      `SELECT id, name FROM market.categories WHERE is_active = true AND (LOWER(name) = LOWER($1) OR LOWER(slug) = LOWER($1)) LIMIT 1`,
      [textCategory]
    );
    if (rows.length > 0) {
      return { categoryId: rows[0].id, categoryName: rows[0].name, categoryTableExists: true };
    }
    return { error: "Category not recognised. Please select from the available categories." };
  } catch (err) {
    // fall through if table doesn't exist
  }

  return { categoryId: null, categoryName: textCategory, categoryTableExists: false };
}

/* ══════════════════════════════════════════════════════════════
   HELPERS & GUARDS
══════════════════════════════════════════════════════════════ */
const inFlight = new Set();

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
    const userId = req.user.id;
    if (inFlight.has(userId)) return fail(res, 429, "Your previous submission is still processing. Please wait.");

    inFlight.add(userId);
    res.on("finish", () => inFlight.delete(userId));
    res.on("close",  () => inFlight.delete(userId));

    try {
      return await handleAddProduct(req, res, userId);
    } finally {
      inFlight.delete(userId);
    }
  }
);

/* ══════════════════════════════════════════════════════════════
   HANDLER
══════════════════════════════════════════════════════════════ */
async function handleAddProduct(req, res, userId) {
  if (!req.files?.length) return fail(res, 400, "At least one image is required");
  if (req.files.length > MAX_IMAGES) return fail(res, 400, `You can upload a maximum of ${MAX_IMAGES} images`);

  const {
    name, description, short_description, category, category_id,
    basePrice, originalPrice, brand, tags, condition, variants,
    keyFeatures, specifications, whatsInBox, weight_kg, dimensions,
    return_policy, warranty,
  } = req.body;

  const cleanName = safeStr(name, MAX_TITLE_LEN);
  if (!cleanName || cleanName.length < 3) return fail(res, 422, "Product name must be at least 3 characters");

  const price = parsePrice(basePrice);
  if (price === null || price <= 0) return fail(res, 422, "A valid base price is required");

  const parsedOriginalPrice = originalPrice != null && originalPrice !== "" ? parsePrice(originalPrice) : null;
  if (parsedOriginalPrice !== null) {
    if (isNaN(parsedOriginalPrice)) return fail(res, 422, "Original price must be a valid number");
    if (parsedOriginalPrice < price) return fail(res, 422, "Original price must be greater than or equal to base price");
  }

  const cleanCondition = ALLOWED_CONDITIONS.has(condition) ? condition : "new";
  const parsedWeight   = weight_kg ? parseFloat(weight_kg) : null;
  if (parsedWeight !== null && isNaN(parsedWeight)) return fail(res, 422, "Weight must be a valid number");

  const parsedTags     = parseJSON(tags, []);
  const parsedDims     = parseJSON(dimensions, null);
  const parsedVariants = parseJSON(variants, []);
  const parsedFeatures = parseJSON(keyFeatures, []);
  const parsedBox      = parseJSON(whatsInBox, []);
  const parsedSpecs    = parseJSON(specifications, []);

  /* ── Duplicate SKU pre-check ── */
  const validVariants = parsedVariants.filter((v) => safeStr(v?.sku, MAX_SKU_LEN));
  if (validVariants.length > 0) {
    const skuSet = new Set();
    for (const v of validVariants) {
      const sku = safeStr(v.sku, MAX_SKU_LEN).toUpperCase();
      if (skuSet.has(sku)) return fail(res, 422, `Duplicate variant SKU: "${sku}". Each variant must have a unique SKU.`);
      skuSet.add(sku);
    }
  }

  let uploaded = [];
  try {
    uploaded = await processAndUploadImages(req.files);
  } catch (uploadErr) {
    await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));
    return fail(res, 502, "Image upload failed. Please try again.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const cols = await detectProductColumns();
    const categoryResult = await resolveCategory(client, category, category_id);

    if (categoryResult.error) {
      await client.query("ROLLBACK");
      await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));
      return fail(res, 422, categoryResult.error);
    }

    const { categoryName: finalCategoryName, categoryId: finalCategoryId } = categoryResult;

    const insertCols = [
      "user_id", "name", "description", "short_description", "category", "condition", "price", "original_price",
      "brand", "tags", "weight_kg", "dimensions", "return_policy", "warranty", "status", "is_active",
    ];

    const insertVals = [
      userId, cleanName, safeStr(description, MAX_DESC_LEN), safeStr(short_description, MAX_SHORT_DESC_LEN),
      finalCategoryName, cleanCondition, price, parsedOriginalPrice, safeStr(brand, MAX_BRAND_LEN),
      parsedTags.length ? parsedTags : null, parsedWeight, parsedDims ? JSON.stringify(parsedDims) : null,
      safeStr(return_policy, MAX_RETURN_LEN), safeStr(warranty, MAX_WARRANTY_LEN), "pending", false,
    ];

    if (cols.hasCategoryId && finalCategoryId) {
      insertCols.push("category_id");
      insertVals.push(finalCategoryId);
    }
    if (cols.hasDeliveryOptions) {
      insertCols.push("delivery_options");
      insertVals.push(null);
    }

    const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(", ");

    const { rows: [{ id: productId }] } = await client.query(
      `INSERT INTO market.products (${insertCols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
      insertVals
    );

    const slug = generateSlug(cleanName, productId);
    await client.query(`UPDATE market.products SET slug = $1 WHERE id = $2`, [slug, productId]);

    for (let i = 0; i < uploaded.length; i++) {
      await client.query(
        `INSERT INTO market.product_images (product_id, image_url, storage_key, is_primary, sort_order) VALUES ($1, $2, $3, $4, $5)`,
        [productId, uploaded[i].public_url, uploaded[i].key, i === 0, i]
      );
    }

    await replaceVariants(client, productId, validVariants);
    await insertList(client, "product_features",  "feature", productId, parsedFeatures);
    await insertList(client, "product_box_items", "item",    productId, parsedBox);
    await replaceSpecs(client, productId, parsedSpecs);

    await client.query("COMMIT");

    return ok(res, {
      message : "Listing submitted for review.",
      data    : { productId, slug, status: "pending", category: finalCategoryName, category_id: finalCategoryId ?? null },
    }, 201);

  } catch (dbErr) {
    await client.query("ROLLBACK");
    await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));
    if (dbErr.status === 422) return fail(res, 422, dbErr.message);
    if (dbErr.code === "23505") return fail(res, 409, classifyDuplicateError(dbErr));
    return fail(res, 500, "Failed to create listing. Please try again.");
  } finally {
    client.release();
  }
}

export default router;