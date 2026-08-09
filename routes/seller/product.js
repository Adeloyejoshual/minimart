/**
 * routes/seller/product.js
 *
 * Seller-scoped product management routes.
 * All routes require authenticateSeller (market.users JWT).
 *
 * Mounted at: /api/seller  (in server.js)
 *
 * Routes:
 *   GET    /api/seller/products
 *   GET    /api/seller/products/:id
 *   PUT    /api/seller/products/:id
 *   PATCH  /api/seller/products/:id/pause
 *   PATCH  /api/seller/products/:id/images
 *   DELETE /api/seller/products/:id/images/:imgId
 *   DELETE /api/seller/products/:id
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
} from "../market/helpers.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const ALLOWED_CONDITIONS = new Set(["new", "used", "refurbished"]);
const ALLOWED_STATUSES   = new Set([
  "pending", "approved", "rejected",
  "active",  "paused",   "archived",
]);
const PAGE_SIZE_DEFAULT  = 12;
const PAGE_SIZE_MAX      = 50;

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
   OWNERSHIP GUARD
   Uses req.user.id from authenticateSeller = market.users.id ✓
   Returns 404 for both "not found" and "not owner" — never
   confirm a product exists to a user who does not own it.
══════════════════════════════════════════════════════════════ */
async function assertOwnership(req, res) {
  const { rows } = await pool.query(
    `SELECT id, name, status, is_paused, slug, user_id
     FROM market.products
     WHERE id      = $1
       AND status != 'archived'`,
    [req.params.id]
  );

  if (!rows.length) {
    fail(res, 404, "Product not found");
    return null;
  }

  const product = rows[0];

  if (product.user_id !== req.user.id) {
    fail(res, 404, "Product not found");
    return null;
  }

  return product;
}

/* ══════════════════════════════════════════════════════════════
   DOUBLE-SUBMIT GUARD
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
   ① GET /products  — paginated seller inventory
══════════════════════════════════════════════════════════════ */
router.get("/products", authenticateSeller, async (req, res) => {
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

    /* Build WHERE clause */
    const conditions = [
      "p.user_id = $1",
      "p.status != 'archived'",
    ];
    const values = [req.user.id];   // market.users.id ✓
    let   idx    = 2;

    if (status) {
      if (status === "paused") {
        conditions.push("p.is_paused = true");
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

    /* Count */
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) AS count FROM market.products p WHERE ${where}`,
      values
    );
    const total      = parseInt(count, 10);
    const totalPages = Math.ceil(total / limit);

    /* Data */
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

         COALESCE(
           (SELECT image_url FROM market.product_images
            WHERE product_id = p.id AND is_primary = true LIMIT 1),
           (SELECT image_url FROM market.product_images
            WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1)
         ) AS image_url,

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

         (SELECT COALESCE(json_agg(
            json_build_object(
              'id',    pv.id,
              'name',  pv.name,
              'sku',   pv.sku,
              'price', pv.price,
              'stock', pv.stock
            ) ORDER BY pv.created_at ASC
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
      pagination: { page, limit, total, totalPages },
    });

  } catch (err) {
    console.error("GET /seller/products:", err.message);
    return fail(res, 500, "Failed to load your products");
  }
});

/* ══════════════════════════════════════════════════════════════
   ② GET /products/:id  — full product detail
══════════════════════════════════════════════════════════════ */
router.get("/products/:id", authenticateSeller, async (req, res) => {
  try {
    const product = await assertOwnership(req, res);
    if (!product) return;

    const { rows: [full] } = await pool.query(
      `SELECT
         p.*,

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

         (SELECT COALESCE(json_agg(
            json_build_object(
              'id',         pv.id,
              'name',       pv.name,
              'sku',        pv.sku,
              'price',      pv.price,
              'stock',      pv.stock,
              'attributes', pv.attributes
            ) ORDER BY pv.created_at ASC
          ), '[]'::json)
          FROM market.product_variants pv
          WHERE pv.product_id = p.id
         ) AS variants,

         (SELECT COALESCE(json_agg(
            pf.feature ORDER BY pf.position ASC
          ), '[]'::json)
          FROM market.product_features pf
          WHERE pf.product_id = p.id
         ) AS key_features,

         (SELECT COALESCE(json_agg(
            json_build_object(
              'key',   ps.spec_key,
              'value', ps.spec_value
            ) ORDER BY ps.position ASC
          ), '[]'::json)
          FROM market.product_specifications ps
          WHERE ps.product_id = p.id
         ) AS specifications,

         (SELECT COALESCE(json_agg(
            pb.item ORDER BY pb.position ASC
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
    console.error("GET /seller/products/:id:", err.message);
    return fail(res, 500, "Failed to load product");
  }
});

/* ══════════════════════════════════════════════════════════════
   ③ PUT /products/:id  — full update
══════════════════════════════════════════════════════════════ */
router.put(
  "/products/:id",
  authenticateSeller,
  upload.array("images", MAX_IMAGES),
  async (req, res) => {

    if (!acquireGuard(req.user.id, res)) {
      return fail(res, 429,
        "Your previous submission is still processing. Please wait.");
    }

    const product = await assertOwnership(req, res);
    if (!product) return;

    const {
      name, description, short_description,
      category, basePrice, originalPrice,
      brand, tags, condition, variants,
      keyFeatures, specifications, whatsInBox,
      weight_kg, dimensions, delivery_options,
      return_policy, warranty,
      keep_image_ids, primary_image_id,
    } = req.body;

    /* Validate */
    const cleanName = safeStr(name, 200);
    if (!cleanName) return fail(res, 422, "Product name is required");

    const cleanCategory = safeStr(category, 100);
    if (!cleanCategory) return fail(res, 422, "Category is required");

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
    const keepIds        = parseJSON(keep_image_ids,   null);

    /* Variant SKU uniqueness */
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

    /* Images to delete */
    let imagesToDelete = [];
    if (Array.isArray(keepIds)) {
      const { rows: existing } = await pool.query(
        `SELECT id, storage_key FROM market.product_images WHERE product_id = $1`,
        [product.id]
      );
      imagesToDelete = existing.filter(
        (img) => !keepIds.includes(String(img.id))
      );
      const remainingCount =
        existing.length - imagesToDelete.length + (req.files?.length ?? 0);
      if (remainingCount > MAX_IMAGES) {
        return fail(res, 400,
          `Total images cannot exceed ${MAX_IMAGES}. ` +
          `Keeping ${existing.length - imagesToDelete.length}, ` +
          `adding ${req.files?.length ?? 0}.`
        );
      }
    }

    /* Upload new images */
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

    /* Re-moderation check */
    const { rows: [current] } = await pool.query(
      `SELECT name, description, category, status
       FROM market.products WHERE id = $1`,
      [product.id]
    );

    const coreChanged =
      current.name        !== cleanName     ||
      current.category    !== cleanCategory ||
      current.description !== safeStr(description, 2000);

    const newStatus = coreChanged ? "pending" : undefined;

    /* Transaction */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

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

      if (newStatus) {
        setClauses.push(`status = $${paramIdx}`);
        updateValues.push(newStatus);
        paramIdx++;

        setClauses.push(`slug = $${paramIdx}`);
        updateValues.push(generateSlug(cleanName, product.id));
        paramIdx++;
      }

      updateValues.push(product.id);

      await client.query(
        `UPDATE market.products SET ${setClauses.join(", ")} WHERE id = $${paramIdx}`,
        updateValues
      );

      if (imagesToDelete.length) {
        await client.query(
          `DELETE FROM market.product_images WHERE id = ANY($1::uuid[])`,
          [imagesToDelete.map((i) => i.id)]
        );
      }

      if (uploaded.length) {
        const { rows: [{ max_order }] } = await client.query(
          `SELECT COALESCE(MAX(sort_order), -1) AS max_order
           FROM market.product_images WHERE product_id = $1`,
          [product.id]
        );
        let nextOrder = parseInt(max_order, 10) + 1;

        const { rows: [{ remaining }] } = await client.query(
          `SELECT COUNT(*) AS remaining
           FROM market.product_images WHERE product_id = $1`,
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
              noneLeft && i === 0,
              nextOrder + i,
            ]
          );
        }
      }

      if (primary_image_id) {
        await client.query(
          `UPDATE market.product_images
           SET is_primary = (id = $1)
           WHERE product_id = $2`,
          [primary_image_id, product.id]
        );
      }

      await replaceVariants(client, product.id, parsedVariants);
      await insertList(client, "product_features",  "feature",
                       product.id, parsedFeatures);
      await insertList(client, "product_box_items", "item",
                       product.id, parsedBox);
      await replaceSpecs(client, product.id, parsedSpecs);

      await client.query("COMMIT");

      await Promise.allSettled(
        imagesToDelete.map((i) => deleteFromR2(i.storage_key))
      );

      return ok(res, {
        message: coreChanged
          ? "Listing updated and resubmitted for review."
          : "Listing updated successfully.",
        data: {
          productId  : product.id,
          status     : newStatus ?? current.status,
          resubmitted: !!newStatus,
        },
      });

    } catch (dbErr) {
      await client.query("ROLLBACK");
      await Promise.allSettled(uploaded.map((f) => deleteFromR2(f.key)));
      console.error("PUT /seller/products/:id DB error:", dbErr);

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
   ④ PATCH /products/:id/pause  — toggle pause / resume
══════════════════════════════════════════════════════════════ */
router.patch(
  "/products/:id/pause",
  authenticateSeller,
  async (req, res) => {
    try {
      const product = await assertOwnership(req, res);
      if (!product) return;

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
        message: nowPaused ? "Listing paused." : "Listing resumed.",
        data   : { productId: product.id, is_paused: nowPaused },
      });

    } catch (err) {
      console.error("PATCH /seller/products/:id/pause:", err.message);
      return fail(res, 500, "Failed to update listing status");
    }
  }
);

/* ══════════════════════════════════════════════════════════════
   ⑤ PATCH /products/:id/images  — reorder / set primary
══════════════════════════════════════════════════════════════ */
router.patch(
  "/products/:id/images",
  authenticateSeller,
  async (req, res) => {
    try {
      const product = await assertOwnership(req, res);
      if (!product) return;

      const { order, primary_id } = req.body;

      if (!Array.isArray(order) || !order.length) {
        return fail(res, 422,
          "`order` must be a non-empty array of image IDs");
      }

      const { rows: existing } = await pool.query(
        `SELECT id FROM market.product_images WHERE product_id = $1`,
        [product.id]
      );
      const existingSet = new Set(existing.map((r) => String(r.id)));

      for (const imgId of order) {
        if (!existingSet.has(String(imgId))) {
          return fail(res, 422,
            `Image ID "${imgId}" does not belong to this product`);
        }
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        for (let i = 0; i < order.length; i++) {
          await client.query(
            `UPDATE market.product_images
             SET sort_order = $1
             WHERE id = $2 AND product_id = $3`,
            [i, order[i], product.id]
          );
        }

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
      console.error("PATCH /seller/products/:id/images:", err.message);
      return fail(res, 500, "Failed to update image order");
    }
  }
);

/* ══════════════════════════════════════════════════════════════
   ⑥ DELETE /products/:id/images/:imgId  — remove one image
══════════════════════════════════════════════════════════════ */
router.delete(
  "/products/:id/images/:imgId",
  authenticateSeller,
  async (req, res) => {
    try {
      const product = await assertOwnership(req, res);
      if (!product) return;

      const { rows } = await pool.query(
        `SELECT id, storage_key, is_primary
         FROM market.product_images
         WHERE id = $1 AND product_id = $2`,
        [req.params.imgId, product.id]
      );

      if (!rows.length)
        return fail(res, 404, "Image not found");

      const [img] = rows;

      const { rows: [{ cnt }] } = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM market.product_images
         WHERE product_id = $1`,
        [product.id]
      );
      if (parseInt(cnt, 10) <= 1) {
        return fail(res, 409,
          "Cannot remove the only image. Upload a replacement first.");
      }

      await pool.query(
        `DELETE FROM market.product_images WHERE id = $1`,
        [img.id]
      );

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

      deleteFromR2(img.storage_key).catch((e) =>
        console.error("R2 delete failed (single image):", e)
      );

      return ok(res, { message: "Image removed" });

    } catch (err) {
      console.error("DELETE /seller/products/:id/images/:imgId:", err.message);
      return fail(res, 500, "Failed to remove image");
    }
  }
);

/* ══════════════════════════════════════════════════════════════
   ⑦ DELETE /products/:id  — soft delete (archived)
══════════════════════════════════════════════════════════════ */
router.delete(
  "/products/:id",
  authenticateSeller,
  async (req, res) => {
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
      console.error("DELETE /seller/products/:id:", err.message);
      return fail(res, 500, "Failed to delete listing");
    }
  }
);

export default router;