/**
 * routes/market/addproduct.js
 *
 * POST /api/products
 * Create a new seller listing.
 *
 * v4 — Enhanced for Hierarchical Categories (CockroachDB)
 * ────────────────────────────────────────────────────────
 * ✓ inFlight guard uses finally block (no stuck entries)
 * ✓ Resolves UUID category_id to link into the hierarchy tree
 * ✓ Safe fallback to plain text if categories table is missing
 * ✓ Number() instead of parseInt() for price parsing
 * ✓ SKU safeStr includes max length
 * ✓ delivery_options logged if sent by client
 * ✓ PRODUCT_COLS cache detects if category_id column exists
 * ✓ Slug uniqueness relies on DB unique constraint
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
   ─────────────────────────────────────────────────────────────
   Uniqueness is enforced by the DB unique constraint on slug.
   The UUID suffix makes collisions practically impossible.
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
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const ALLOWED_CONDITIONS = new Set(["new", "used", "refurbished"]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUUID = (str) =>
  typeof str === "string" && UUID_REGEX.test(str);

/* ══════════════════════════════════════════════════════════════
   PRICE PARSER
   ─────────────────────────────────────────────────────────────
   Uses Number() instead of parseInt() to catch values like
   "123abc" which parseInt would silently accept as 123.
══════════════════════════════════════════════════════════════ */
function parsePrice(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : Math.floor(n); // floor to avoid float prices
}

/* ══════════════════════════════════════════════════════════════
   COLUMN DETECTION
   ─────────────────────────────────────────────────────────────
   Cached per server lifetime (module-level).
   Safely detects if 'category_id' exists in the database before
   we attempt to insert into it.
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

    console.log("[addproduct] Detected product columns:", PRODUCT_COLS);
  } catch (err) {
    console.warn("[addproduct] Column detection failed:", err.message);
    PRODUCT_COLS = { hasCategoryId: false, hasDeliveryOptions: true };
  }

  return PRODUCT_COLS;
}

/* ══════════════════════════════════════════════════════════════
   RESOLVE CATEGORY
   ─────────────────────────────────────────────────────────────
   Priority:
     1. category_id  (UUID)  — explicit tree reference
     2. category     (text)  — name/slug match in tree
     3. Plain text fallback  — ONLY if categories table missing

   Returns:
     { categoryId, categoryName, categoryTableExists }  on success
     { error }                                           on failure
══════════════════════════════════════════════════════════════ */
async function resolveCategory(client, categoryInput, categoryIdInput) {
  /* ── Step 1: Determine the UUID candidate ── */
  const idCandidate =
    categoryIdInput ?? (isValidUUID(categoryInput) ? categoryInput : null);

  /* ── Step 2: Try UUID lookup ── */
  if (idCandidate && isValidUUID(idCandidate)) {
    try {
      const { rows } = await client.query(
        `SELECT id, name, slug
         FROM market.categories
         WHERE id = $1 AND is_active = true`,
        [idCandidate]
      );

      if (rows.length > 0) {
        console.log(`[addproduct] ✓ Category resolved by ID: "${rows[0].name}"`);
        return {
          categoryId           : rows[0].id,
          categoryName         : rows[0].name,
          categoryTableExists  : true,
        };
      }

      /* Table exists but ID not found — hard reject */
      return { error: "Category not found. Please select a valid category." };

    } catch (err) {
      if (err.code === "42P01") {
        /* Categories table does not exist yet — fall through to text */
        console.warn("[addproduct] categories table missing, falling back to text");
      } else {
        console.error("[addproduct] Category ID lookup error:", err.message);
        return { error: "Category lookup failed. Please try again." };
      }
    }
  }

  /* ── Step 3: Try text/slug match ── */
  const textCategory = safeStr(categoryInput, 100);

  if (!textCategory) {
    return { error: "Category is required" };
  }

  try {
    const { rows } = await client.query(
      `SELECT id, name
       FROM market.categories
       WHERE is_active = true
         AND (
           LOWER(name) = LOWER($1)
           OR LOWER(slug) = LOWER($1)
         )
       LIMIT 1`,
      [textCategory]
    );

    if (rows.length > 0) {
      console.log(`[addproduct] ✓ Category matched by text: "${rows[0].name}"`);
      return {
        categoryId          : rows[0].id,
        categoryName        : rows[0].name,
        categoryTableExists : true,
      };
    }

    /* Table exists but text doesn't match any category. */
    console.warn(`[addproduct] ✗ No category match for text: "${textCategory}"`);
    return {
      error: "Category not recognised. Please select from the available categories.",
    };

  } catch (err) {
    if (err.code !== "42P01") {
      console.warn("[addproduct] Category text match failed:", err.message);
    }
    /* Table missing — fall through to plain-text legacy path */
  }

  /* ── Step 4: Plain-text fallback ── */
  console.warn(`[addproduct] ⚠ categories table absent — storing plain text: "${textCategory}"`);
  return {
    categoryId          : null,
    categoryName        : textCategory,
    categoryTableExists : false,
  };
}

/* ══════════════════════════════════════════════════════════════
   DOUBLE-SUBMIT GUARD
   ─────────────────────────────────────────────────────────────
   Belt-and-suspenders: res finish/close events + finally block.
══════════════════════════════════════════════════════════════ */
const inFlight = new Set();

/* ══════════════════════════════════════════════════════════════
   DUPLICATE ERROR CLASSIFIER
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

    const userId = req.user.id; // market.users.id ✓

    /* ── Double-submit guard ── */
    if (inFlight.has(userId)) {
      return fail(res, 429, "Your previous submission is still processing. Please wait.");
    }

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

  /* ── Image presence check ── */
  if (!req.files?.length)
    return fail(res, 400, "At least one image is required");

  if (req.files.length > MAX_IMAGES)
    return fail(res, 400, `You can upload a maximum of ${MAX_IMAGES} images`);

  /* ── Destructure body ── */
  const {
    name,
    description,
    short_description,
    category,           // Legacy: text name OR UUID
    category_id,        // Preferred: explicit UUID from category tree
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
    delivery_options,   // Received but NOT stored
    return_policy,
    warranty,
  } = req.body;

  /* ── Warn if client sends delivery_options ── */
  if (delivery_options !== undefined) {
    console.warn(`[addproduct] delivery_options submitted by user=${userId} — ignored; handled by agent`);
  }

  /* ── Required: name ── */
  const cleanName = safeStr(name, 200);
  if (!cleanName) return fail(res, 422, "Product name is required");

  /* ── Required: base price ── */
  const price = parsePrice(basePrice);
  if (price === null || price <= 0) return fail(res, 422, "A valid base price is required");

  /* ── Optional: original price ── */
  const parsedOriginalPrice = originalPrice != null && originalPrice !== "" ? parsePrice(originalPrice) : null;

  if (parsedOriginalPrice !== null) {
    if (parsedOriginalPrice === null || isNaN(parsedOriginalPrice))
      return fail(res, 422, "Original price must be a valid number");

    if (parsedOriginalPrice < price)
      return fail(res, 422, "Original price must be greater than or equal to base price");
  }

  /* ── Condition & Weight ── */
  const cleanCondition = ALLOWED_CONDITIONS.has(condition) ? condition : "new";
  const parsedWeight   = weight_kg ? parseFloat(weight_kg) : null;

  if (parsedWeight !== null && isNaN(parsedWeight))
    return fail(res, 422, "Weight must be a valid number");

  /* ── JSON fields ── */
  const parsedTags     = parseJSON(tags,           []);
  const parsedDims     = parseJSON(dimensions,     null);
  const parsedVariants = parseJSON(variants,       []);
  const parsedFeatures = parseJSON(keyFeatures,    []);
  const parsedBox      = parseJSON(whatsInBox,     []);
  const parsedSpecs    = parseJSON(specifications, []);

  /* ── Duplicate SKU pre-check ── */
  if (parsedVariants.length > 0) {
    const skuSet = new Set();
    for (const v of parsedVariants) {
      const sku = safeStr(String(v?.sku ?? ""), 100)?.toUpperCase();
      if (!sku) continue;
      if (skuSet.has(sku)) {
        return fail(res, 422, `Duplicate variant SKU: "${sku}". Each variant must have a unique SKU.`);
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

    /* Detect available columns */
    const cols = await detectProductColumns();

    /* Resolve + validate category */
    const categoryResult = await resolveCategory(client, category, category_id);

    if (categoryResult.error) {
      await client.query("ROLLBACK");
      await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));
      return fail(res, 422, categoryResult.error);
    }

    const { categoryName: finalCategoryName, categoryId: finalCategoryId } = categoryResult;

    /* ── Build dynamic INSERT ── */
    const insertCols = [
      "user_id", "name", "description", "short_description",
      "category", "condition", "price", "original_price",
      "brand", "tags", "weight_kg", "dimensions",
      "return_policy", "warranty", "status", "is_active",
    ];

    const insertVals = [
      userId,
      cleanName,
      safeStr(description,       2000),
      safeStr(short_description,  300),
      finalCategoryName,
      cleanCondition,
      price,
      parsedOriginalPrice,
      safeStr(brand, 100),
      parsedTags.length ? parsedTags : null,
      parsedWeight,
      parsedDims ? JSON.stringify(parsedDims) : null,
      safeStr(return_policy, 1000),
      safeStr(warranty,       500),
      "pending",
      false,
    ];

    /* Add category_id if column exists and we resolved to a tree entry */
    if (cols.hasCategoryId && finalCategoryId) {
      insertCols.push("category_id");
      insertVals.push(finalCategoryId);
    }

    /* Backward compatibility for delivery_options column */
    if (cols.hasDeliveryOptions) {
      insertCols.push("delivery_options");
      insertVals.push(null);
    }

    const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(", ");

    const {
      rows: [{ id: productId }],
    } = await client.query(
      `INSERT INTO market.products (${insertCols.join(", ")})
       VALUES (${placeholders})
       RETURNING id`,
      insertVals
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
    await insertList(client, "product_features",  "feature", productId, parsedFeatures);
    await insertList(client, "product_box_items", "item",    productId, parsedBox);
    await replaceSpecs(client, productId, parsedSpecs);

    await client.query("COMMIT");

    console.log(
      `[addproduct] ✅ created | id=${productId} | user=${userId} | ` +
      `category="${finalCategoryName}"` +
      (finalCategoryId ? ` (id=${finalCategoryId})` : " (text-only)")
    );

    return ok(
      res,
      {
        message : "Listing submitted for review. You will be notified once approved.",
        data    : {
          productId,
          slug,
          status      : "pending",
          category    : finalCategoryName,
          category_id : finalCategoryId ?? null,
        },
      },
      201
    );

  } catch (dbErr) {
    await client.query("ROLLBACK");
    await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));

    console.error("[addproduct] DB error:", {
      message : dbErr.message,
      code    : dbErr.code,
      detail  : dbErr.detail,
    });

    if (dbErr.status === 422) return fail(res, 422, dbErr.message);
    if (dbErr.code === "23505")
      return fail(res, 409, classifyDuplicateError(dbErr));

    return fail(res, 500, "Failed to create listing. Please try again.");

  } finally {
    client.release();
  }
}

export default router;