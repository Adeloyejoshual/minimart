/**
 * routes/market/addproduct.js
 * POST /api/products
 * Create a new seller listing with category_id association.
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

const ALLOWED_CONDITIONS = new Set(["new", "used", "refurbished"]);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (str) => typeof str === "string" && UUID_REGEX.test(str);

function parsePrice(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : Math.floor(n);
}

let PRODUCT_COLS = null;

async function detectProductColumns() {
  if (PRODUCT_COLS) return PRODUCT_COLS;
  try {
    const { rows } = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'market' AND table_name = 'products'`
    );
    const cols = new Set(rows.map((r) => r.column_name));
    PRODUCT_COLS = {
      hasCategoryId      : cols.has("category_id"),
      hasDeliveryOptions : cols.has("delivery_options"),
    };
  } catch (err) {
    PRODUCT_COLS = { hasCategoryId: true, hasDeliveryOptions: false };
  }
  return PRODUCT_COLS;
}

async function resolveCategory(client, categoryInput, categoryIdInput) {
  const idCandidate = categoryIdInput ?? (isValidUUID(categoryInput) ? categoryInput : null);

  if (idCandidate && isValidUUID(idCandidate)) {
    try {
      const { rows } = await client.query(
        `SELECT id, name, slug FROM market.categories WHERE id = $1 AND is_active = true`,
        [idCandidate]
      );
      if (rows.length > 0) {
        return { categoryId: rows[0].id, categoryName: rows[0].name };
      }
      return { error: "Category not found. Please select a valid category." };
    } catch (err) {
      if (err.code === "42P01") {
        console.warn("[addproduct] categories table missing");
      } else {
        return { error: "Category lookup failed." };
      }
    }
  }

  const textCategory = safeStr(categoryInput, 100);
  if (!textCategory) return { error: "Category is required" };

  try {
    const { rows } = await client.query(
      `SELECT id, name FROM market.categories
       WHERE is_active = true AND (LOWER(name) = LOWER($1) OR LOWER(slug) = LOWER($1))
       LIMIT 1`,
      [textCategory]
    );

    if (rows.length > 0) {
      return { categoryId: rows[0].id, categoryName: rows[0].name };
    }
    return { error: "Category not recognised. Please select from available categories." };
  } catch (err) {
    /* Table missing — plain text fallback */
  }

  return { categoryId: null, categoryName: textCategory };
}

const inFlight = new Set();

function classifyDuplicateError(err) {
  const combined = [err.detail, err.constraint, err.message].map((s) => String(s ?? "").toLowerCase()).join(" ");
  if (combined.includes("slug")) return "A product with this title already exists.";
  if (combined.includes("sku")) return "One of your variant SKUs is already in use.";
  return "A duplicate value was detected.";
}

router.post("/", authenticateSeller, upload.array("images", MAX_IMAGES), async (req, res) => {
  const userId = req.user.id;
  if (inFlight.has(userId)) return fail(res, 429, "Your previous submission is still processing.");

  inFlight.add(userId);
  res.on("finish", () => inFlight.delete(userId));
  res.on("close",  () => inFlight.delete(userId));

  try {
    return await handleAddProduct(req, res, userId);
  } finally {
    inFlight.delete(userId);
  }
});

async function handleAddProduct(req, res, userId) {
  if (!req.files?.length) return fail(res, 400, "At least one image is required");
  if (req.files.length > MAX_IMAGES) return fail(res, 400, `Maximum of ${MAX_IMAGES} images allowed`);

  const {
    name, description, short_description, category, category_id,
    basePrice, originalPrice, brand, tags, condition, variants,
    keyFeatures, specifications, whatsInBox, weight_kg, dimensions,
    return_policy, warranty,
  } = req.body;

  const cleanName = safeStr(name, 200);
  if (!cleanName) return fail(res, 422, "Product name is required");

  const price = parsePrice(basePrice);
  if (price === null || price <= 0) return fail(res, 422, "A valid base price is required");

  const parsedOriginalPrice = originalPrice != null && originalPrice !== "" ? parsePrice(originalPrice) : null;
  if (parsedOriginalPrice !== null && parsedOriginalPrice < price) {
    return fail(res, 422, "Original price must be greater than or equal to base price");
  }

  const cleanCondition = ALLOWED_CONDITIONS.has(condition) ? condition : "new";
  const parsedWeight    = weight_kg ? parseFloat(weight_kg) : null;

  const parsedTags     = parseJSON(tags, []);
  const parsedDims     = parseJSON(dimensions, null);
  const parsedVariants = parseJSON(variants, []);
  const parsedFeatures = parseJSON(keyFeatures, []);
  const parsedBox      = parseJSON(whatsInBox, []);
  const parsedSpecs    = parseJSON(specifications, []);

  let uploaded = [];
  try {
    uploaded = await processAndUploadImages(req.files);
  } catch (uploadErr) {
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
      "user_id", "name", "description", "short_description", "category",
      "condition", "price", "original_price", "brand", "tags", "weight_kg",
      "dimensions", "return_policy", "warranty", "status", "is_active",
    ];

    const insertVals = [
      userId, cleanName, safeStr(description, 2000), safeStr(short_description, 300),
      finalCategoryName, cleanCondition, price, parsedOriginalPrice, safeStr(brand, 100),
      parsedTags.length ? parsedTags : null, parsedWeight,
      parsedDims ? JSON.stringify(parsedDims) : null,
      safeStr(return_policy, 1000), safeStr(warranty, 500), "pending", false,
    ];

    if (cols.hasCategoryId && finalCategoryId) {
      insertCols.push("category_id");
      insertVals.push(finalCategoryId);
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
        `INSERT INTO market.product_images (product_id, image_url, storage_key, is_primary, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [productId, uploaded[i].public_url, uploaded[i].key, i === 0, i]
      );
    }

    await replaceVariants(client, productId, parsedVariants);
    await insertList(client, "product_features", "feature", productId, parsedFeatures);
    await insertList(client, "product_box_items", "item", productId, parsedBox);
    await replaceSpecs(client, productId, parsedSpecs);

    await client.query("COMMIT");

    return ok(res, {
      message: "Listing submitted for review.",
      data: { productId, slug, status: "pending", category: finalCategoryName, category_id: finalCategoryId ?? null },
    }, 201);

  } catch (dbErr) {
    await client.query("ROLLBACK");
    await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));
    if (dbErr.code === "23505") return fail(res, 409, classifyDuplicateError(dbErr));
    return fail(res, 500, "Failed to create listing.");
  } finally {
    client.release();
  }
}

export default router;