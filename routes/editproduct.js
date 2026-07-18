// ════════════════════════════════════════════════════════════════
// FILE: routes/editproduct.js — v1
// Route: PATCH /api/addproduct/products/:id
// ════════════════════════════════════════════════════════════════

import express from "express";
import multer  from "multer";
import path    from "path";
import crypto  from "crypto";

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

import { pool }         from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   R2
═══════════════════════════════════════════════════════════════ */
const r2 = new S3Client({
  region   : process.env.R2_REGION ?? "auto",
  endpoint : process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId     : process.env.R2_ACCESS_KEY_ID,
    secretAccessKey : process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET     = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

const uploadToR2 = async (buffer, originalName, mimetype) => {
  const ext = path.extname(originalName || "file.jpg") || ".jpg";
  const key = `products/${Date.now()}-${crypto.randomUUID()}${ext}`;
  await r2.send(
    new PutObjectCommand({
      Bucket      : R2_BUCKET,
      Key         : key,
      Body        : buffer,
      ContentType : mimetype,
    })
  );
  return { url: `${R2_PUBLIC_URL}/${key}`, key };
};

const destroyR2Assets = async (keys) => {
  if (!keys?.length) return;
  try {
    await r2.send(
      new DeleteObjectsCommand({
        Bucket : R2_BUCKET,
        Delete : { Objects: keys.map((k) => ({ Key: k })), Quiet: true },
      })
    );
    console.log("[editproduct] ✓ R2 cleaned:", keys.length, "key(s)");
  } catch (e) {
    console.error("[editproduct] R2 cleanup failed:", e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const MAX_IMAGES          = 6;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const ALLOWED_WA_HOSTS = [
  "wa.me",
  "web.whatsapp.com",
  "api.whatsapp.com",
  "chat.whatsapp.com",
  "business.whatsapp.com",
];

/* ═══════════════════════════════════════════════════════════════
   MULTER
═══════════════════════════════════════════════════════════════ */
const upload = multer({
  storage    : multer.memoryStorage(),
  limits     : { fileSize: 3 * 1_048_576, files: MAX_IMAGES },
  fileFilter : (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      const err  = new Error(
        `Invalid image type "${file.mimetype}". Only JPEG, PNG, WebP allowed.`
      );
      err.code = "INVALID_MIME";
      return cb(err);
    }
    cb(null, true);
  },
});

const withUpload = (handler) => (req, res, next) =>
  handler(req, res, (err) => {
    if (!err) return next();
    if (["LIMIT_FILE_SIZE", "LIMIT_FILE_COUNT", "INVALID_MIME"].includes(err.code))
      return res.status(400).json({ success: false, message: err.message });
    return next(err);
  });

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const cleanText = (v) => {
  const s = String(v ?? "").trim();
  return s || null;
};

const cleanUuid = (v) => {
  const s = String(v ?? "").trim();
  return s && s !== "null" && s !== "undefined" ? s : null;
};

const toNumberOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const safeParse = (v, fallback) => {
  try { return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};

const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  req.socket?.remoteAddress ??
  null;

const PHONE_RE = /^\+?[0-9]{7,15}$/;

const validatePhone = (value, label) => {
  if (!value) return `${label} is required.`;
  const cleaned = String(value).replace(/[\s\-().]/g, "");
  if (!PHONE_RE.test(cleaned))
    return `${label} must be 7–15 digits (e.g. 08012345678).`;
  return null;
};

const sanitizeWhatsAppLink = (raw) => {
  if (!raw) return null;
  try {
    const url = new URL(String(raw).trim());
    if (url.protocol !== "https:") return null;
    const ok = ALLOWED_WA_HOSTS.some(
      (h) => url.hostname === h || url.hostname.endsWith(`.${h}`)
    );
    return ok ? url.href : null;
  } catch { return null; }
};

/* ═══════════════════════════════════════════════════════════════
   CATEGORY VALIDATION
═══════════════════════════════════════════════════════════════ */
const validateCategory = async (client, categoryId, subcategoryId) => {
  const { rows: cat } = await client.query(
    "SELECT id FROM categories WHERE id = $1 AND is_active = TRUE",
    [categoryId]
  );
  if (!cat.length)
    return { valid: false, message: "Category does not exist or is inactive." };

  if (subcategoryId) {
    const { rows: sub } = await client.query(
      `SELECT id FROM categories
       WHERE id = $1 AND parent_id = $2 AND is_active = TRUE`,
      [subcategoryId, categoryId]
    );
    if (!sub.length)
      return {
        valid   : false,
        message : "Subcategory does not belong to the chosen category.",
      };
  }
  return { valid: true };
};

/* ═══════════════════════════════════════════════════════════════
   PATCH /products/:id
═══════════════════════════════════════════════════════════════ */
router.patch(
  "/products/:id",
  authenticate,
  withUpload(upload.array("images", MAX_IMAGES)),
  async (req, res) => {
    const sellerId  = req.user?.id;
    const productId = req.params.id;
    const ip        = getIp(req);

    console.log("\n[editproduct] ▶ PATCH  product:", productId, " seller:", sellerId);
    if (!sellerId)  return fail(res, 401, "Not authenticated.");
    if (!productId) return fail(res, 400, "Product ID required.");

    /* ── Parse ── */
    const title         = cleanText(req.body.title);
    const description   = cleanText(req.body.description);
    const price         = Number(req.body.price);
    const categoryId    = cleanUuid(req.body.category_id);
    const subcategoryId = cleanUuid(req.body.subcategory_id);
    const locationState = cleanText(req.body.location_state);
    const locationCity  = cleanText(req.body.location_city);
    const latitude      = toNumberOrNull(req.body.latitude);
    const longitude     = toNumberOrNull(req.body.longitude);
    const sellerName    = cleanText(req.body.seller_name);
    const phone         = cleanText(req.body.phone);
    const whatsapp      = cleanText(req.body.whatsapp);
    const attributes    = safeParse(req.body.attributes, {});
    const delivery      = safeParse(req.body.delivery, {});
    const contact       = safeParse(req.body.contact, {});
    const whatsappLink  = sanitizeWhatsAppLink(cleanText(req.body.whatsapp_link));
    const keepImageIds  = safeParse(req.body.keep_image_ids,    []);
    const removeKeys    = safeParse(req.body.remove_image_keys, []);
    const newFiles      = req.files ?? [];

    /* ── Validate ── */
    if (!title)
      return fail(res, 400, "Title required.");
    if (title.length > 120)
      return fail(res, 400, "Title must be at most 120 characters.");
    if (!description || description.length < 10)
      return fail(res, 400, "Description must be at least 10 characters.");
    if (description.length > 2000)
      return fail(res, 400, "Description must be at most 2000 characters.");
    if (!price || price <= 0 || !Number.isFinite(price))
      return fail(res, 400, "Invalid price.");
    if (price > 1_000_000_000)
      return fail(res, 400, "Price exceeds maximum allowed value.");
    if (!categoryId)
      return fail(res, 400, "Category required.");
    if (!locationState || !locationCity)
      return fail(res, 400, "State and city are required.");

    const phoneErr = validatePhone(phone, "Phone number");
    if (phoneErr) return fail(res, 400, phoneErr);

    if (whatsapp) {
      const waErr = validatePhone(whatsapp, "WhatsApp number");
      if (waErr) return fail(res, 400, waErr);
    }

    const client     = await pool.connect();
    let uploadedKeys = [];

    try {
      await client.query("BEGIN");

      /* ── Ownership + status check ── */
      const { rows: productRows } = await client.query(
        `SELECT
           id, seller_id, status,
           thumbnail_url, main_image
         FROM products
         WHERE id     = $1
           AND status <> 'deleted'
         FOR UPDATE`,
        [productId]
      );

      if (!productRows.length) {
        await client.query("ROLLBACK");
        return fail(res, 404, "Product not found.");
      }

      const product = productRows[0];

      if (product.seller_id !== sellerId) {
        await client.query("ROLLBACK");
        return fail(res, 403, "You are not authorised to edit this listing.");
      }

      if (product.status === "pending_payment") {
        await client.query("ROLLBACK");
        return fail(res, 409, "Complete payment before editing this listing.");
      }

      /* ── Category validation ── */
      const catCheck = await validateCategory(client, categoryId, subcategoryId);
      if (!catCheck.valid) {
        await client.query("ROLLBACK");
        return fail(res, 400, catCheck.message);
      }

      /* ── Existing images ── */
      const { rows: existingImages } = await client.query(
        `SELECT id, r2_key, image_url, position_order, is_primary
         FROM   product_images
         WHERE  product_id = $1
         ORDER  BY position_order ASC`,
        [productId]
      );

      const keepIds      = new Set(keepImageIds.map(String));
      const keptImages   = existingImages.filter((img) => keepIds.has(String(img.id)));
      const deletedImages = existingImages.filter((img) => !keepIds.has(String(img.id)));

      /* Merge explicit remove keys */
      const extraKeys        = removeKeys.filter(
        (k) => !deletedImages.some((img) => img.r2_key === k)
      );
      const allKeysToDelete  = [
        ...deletedImages.map((img) => img.r2_key).filter(Boolean),
        ...extraKeys,
      ];

      /* ── Upload new images ── */
      if (newFiles.length > 0) {
        const totalAfter = keptImages.length + newFiles.length;
        if (totalAfter > MAX_IMAGES) {
          await client.query("ROLLBACK");
          return fail(
            res,
            400,
            `Too many images. Max ${MAX_IMAGES} ` +
            `(${keptImages.length} kept + ${newFiles.length} new = ${totalAfter}).`
          );
        }

        console.log("[editproduct] uploading", newFiles.length, "image(s)…");
        try {
          const results = await Promise.all(
            newFiles.map((f) =>
              uploadToR2(f.buffer, f.originalname, f.mimetype)
            )
          );
          uploadedKeys = results.map((r) => r.key);

          /* Insert into product_images */
          const startOrder = keptImages.length > 0
            ? Math.max(...keptImages.map((img) => img.position_order)) + 1
            : 0;

          for (let i = 0; i < results.length; i++) {
            await client.query(
              `INSERT INTO product_images
                 (product_id, image_url, r2_key, position_order, is_primary)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                productId,
                results[i].url,
                results[i].key,
                startOrder + i,
                keptImages.length === 0 && i === 0,
              ]
            );
          }
        } catch (uploadErr) {
          await client.query("ROLLBACK");
          console.error("[editproduct] upload error:", uploadErr.message);
          return fail(res, 500, "Image upload failed. Please try again.");
        }
      }

      /* ── Remove deleted images ── */
      if (deletedImages.length > 0) {
        await client.query(
          `DELETE FROM product_images
           WHERE product_id = $1
             AND id         = ANY($2::uuid[])`,
          [productId, deletedImages.map((img) => img.id)]
        );
      }

      /* ── Guard: at least 1 image ── */
      const { rows: countRows } = await client.query(
        "SELECT COUNT(*)::int AS n FROM product_images WHERE product_id = $1",
        [productId]
      );
      if (countRows[0].n === 0) {
        await client.query("ROLLBACK");
        if (uploadedKeys.length) await destroyR2Assets(uploadedKeys);
        return fail(res, 400, "At least one image is required.");
      }

      /* ── Reorder: contiguous 0-based, primary = position 0 ── */
      const { rows: allImages } = await client.query(
        `SELECT id FROM product_images
         WHERE  product_id = $1
         ORDER  BY is_primary DESC, position_order ASC`,
        [productId]
      );

      for (let i = 0; i < allImages.length; i++) {
        await client.query(
          `UPDATE product_images
           SET position_order = $1, is_primary = $2
           WHERE id = $3`,
          [i, i === 0, allImages[i].id]
        );
      }

      /* ── New thumbnail ── */
      const { rows: primaryRows } = await client.query(
        `SELECT image_url FROM product_images
         WHERE  product_id = $1
         ORDER  BY is_primary DESC, position_order ASC
         LIMIT  1`,
        [productId]
      );
      const newThumbnail = primaryRows[0]?.image_url ?? product.thumbnail_url;

      /* ── Final images JSONB ── */
      const { rows: finalImages } = await client.query(
        `SELECT image_url AS url, r2_key AS key, position_order AS "order"
         FROM   product_images
         WHERE  product_id = $1
         ORDER  BY position_order ASC`,
        [productId]
      );

      /* ── Update product ── */
      const { rows: updated } = await client.query(
        `UPDATE products SET
           title          = $1,
           description    = $2,
           price          = $3,
           category_id    = $4,
           subcategory_id = $5,
           location_state = $6,
           location_city  = $7,
           latitude       = $8,
           longitude      = $9,
           seller_name    = $10,
           phone          = $11,
           whatsapp       = $12,
           whatsapp_link  = $13,
           attributes     = $14,
           delivery       = $15,
           contact        = $16,
           thumbnail_url  = $17,
           main_image     = $17,
           images         = $18,
           updated_at     = NOW()
         WHERE id        = $19
           AND seller_id = $20
         RETURNING *`,
        [
          title,
          description,
          price,
          categoryId,
          subcategoryId ?? null,
          locationState,
          locationCity,
          latitude      ?? null,
          longitude     ?? null,
          sellerName,
          phone,
          whatsapp      ?? null,
          whatsappLink,
          JSON.stringify(attributes),
          JSON.stringify(delivery),
          JSON.stringify(contact),
          newThumbnail,
          JSON.stringify(finalImages),
          productId,
          sellerId,
        ]
      );

      if (!updated.length) {
        await client.query("ROLLBACK");
        if (uploadedKeys.length) await destroyR2Assets(uploadedKeys);
        return fail(res, 500, "Update failed. Please try again.");
      }

      await client.query("COMMIT");

      /* ── Post-commit: delete old R2 keys ── */
      if (allKeysToDelete.length > 0) {
        destroyR2Assets(allKeysToDelete).catch(() => {});
      }

      writeAudit({
        actorId    : sellerId,
        action     : "product_updated",
        targetType : "product",
        targetId   : productId,
        metadata   : {
          title,
          new_images     : newFiles.length,
          removed_images : deletedImages.length,
        },
        ipAddress : ip,
      }).catch(() => {});

      console.log(
        "[editproduct] ✓ updated  id:", productId,
        " +images:", newFiles.length,
        " -images:", deletedImages.length
      );

      const result  = updated[0];
      result.images = finalImages;

      return res.json({
        success : true,
        message : "Listing updated successfully.",
        product : result,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      if (uploadedKeys.length) await destroyR2Assets(uploadedKeys);
      console.error("[editproduct] ERROR:", err.message, "\n", err.stack);
      return fail(
        res,
        500,
        IS_PROD ? "Update failed. Please try again." : err.message
      );
    } finally {
      client.release();
    }
  }
);

export default router;