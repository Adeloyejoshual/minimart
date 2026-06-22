/**
 * routes/addproduct.js
 *
 * POST   /api/addproduct/products              — Create product
 * POST   /api/addproduct/products/:id/activate — Activate product (free or post-payment)
 * DELETE /api/addproduct/products/:id          — Delete draft product
 * GET    /api/addproduct/categories            — Fetch categories
 *
 * First-product flow:
 *   • If seller has zero prior products AND is not identity-verified,
 *     the product is created with status = 'active_limited' and
 *     active_until = NOW() + 7 days.
 *   • Response includes { needs_verification: true, active_until, first_product: true }
 *     so the frontend can redirect to /verification.
 *   • When the seller completes identity verification the calling route
 *     (verification.js) invokes reactivateLimitedListings() to flip the
 *     product back to status = 'active' with active_until = NULL.
 */

import express      from "express";
import multer       from "multer";
import streamifier  from "streamifier";
import { v2 as cloudinary } from "cloudinary";
import rateLimit    from "express-rate-limit";

import { pool }         from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import {
  detectSpamListing,
  updateSellerTrust,
} from "../utils/listingUtils.js";
import { getCategoriesHandler } from "../controllers/category.controller.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const IS_PROD = process.env.NODE_ENV === "production";

/** How many days a first / unverified listing stays active */
const FIRST_PRODUCT_DAYS = 7;

/** Allowed product statuses from the frontend */
const ALLOWED_STATUSES = new Set(["active", "draft", "pending_payment"]);

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const createProductLimiter = rateLimit({
  windowMs        : 60 * 60 * 1_000, // 1 hour
  max             : IS_PROD ? 10 : 100,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) => String(req.user?.id ?? req.ip),
  handler         : (_req, res) =>
    res.status(429).json({
      success : false,
      message : "Too many products created. Please wait before trying again.",
    }),
});

const activateLimiter = rateLimit({
  windowMs        : 15 * 60 * 1_000, // 15 min
  max             : IS_PROD ? 20 : 100,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) => String(req.user?.id ?? req.ip),
  handler         : (_req, res) =>
    res.status(429).json({
      success : false,
      message : "Too many activation requests. Please wait.",
    }),
});

/* ═══════════════════════════════════════════════════════════════
   REDIS (safe — trending is non-critical)
═══════════════════════════════════════════════════════════════ */
let redis = null;

try {
  if (process.env.REDIS_URL) {
    const { createClient } = await import("redis");
    redis = createClient({ url: process.env.REDIS_URL });
    redis.on("error", (e) =>
      console.warn("[addproduct] Redis error:", e.message)
    );
    await redis.connect();
    console.log("[addproduct] Redis connected");
  } else {
    console.warn("[addproduct] REDIS_URL not set — trending disabled");
  }
} catch (e) {
  console.warn("[addproduct] Redis unavailable:", e.message);
  redis = null;
}

/* ═══════════════════════════════════════════════════════════════
   MULTER
═══════════════════════════════════════════════════════════════ */
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage    : multer.memoryStorage(),
  limits     : { fileSize: 3 * 1_048_576, files: 6 },
  fileFilter : (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      const err = new Error(
        `Invalid image type "${file.mimetype}". Only JPEG, PNG, WebP allowed.`
      );
      err.code = "INVALID_MIME";
      return cb(err);
    }
    cb(null, true);
  },
});

const withImageUpload = (handler) => (req, res, next) =>
  handler(req, res, (err) => {
    if (!err) return next();
    if (
      err.code === "LIMIT_FILE_SIZE"  ||
      err.code === "LIMIT_FILE_COUNT" ||
      err.code === "INVALID_MIME"
    ) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  });

/* ═══════════════════════════════════════════════════════════════
   CLOUDINARY UPLOAD
═══════════════════════════════════════════════════════════════ */
const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder         : "minimart/products",
        transformation : [
          { width: 800, height: 800, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
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

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/* ── Slug ── */
const slugify = (text = "") =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const generateUniqueSlug = async (client, base) => {
  const { rows } = await client.query(
    "SELECT slug FROM products WHERE slug LIKE $1",
    [`${base}%`]
  );
  const existing = new Set(rows.map((r) => r.slug));
  let counter = 1;
  let slug = `${base}-${counter}`;
  while (existing.has(slug)) {
    counter++;
    slug = `${base}-${counter}`;
  }
  return slug;
};

/* ── First-product verification check ── */

/**
 * Returns whether this seller qualifies as "first-product limited".
 * Conditions:
 *   1. Seller has zero confirmed (non-deleted) products.
 *   2. Seller has NOT completed identity verification.
 *
 * @param {object} client - pg PoolClient
 * @param {string} sellerId
 * @returns {{ isFirst: boolean, needsVerification: boolean, activeUntil: Date|null }}
 */
const getFirstProductInfo = async (client, sellerId) => {
  const [countRes, userRes] = await Promise.all([
    client.query(
      `SELECT COUNT(*) AS cnt
       FROM   products
       WHERE  seller_id = $1
         AND  status   <> 'deleted'`,
      [sellerId]
    ),
    client.query(
      `SELECT email_verified, identity_verified
       FROM   users
       WHERE  id = $1`,
      [sellerId]
    ),
  ]);

  const productCount    = parseInt(countRes.rows[0].cnt, 10);
  const user            = userRes.rows[0] ?? {};
  const isFirst         = productCount === 0;
  const isVerified      = Boolean(user.identity_verified);
  const needsVerification = isFirst && !isVerified;

  const activeUntil = needsVerification
    ? new Date(Date.now() + FIRST_PRODUCT_DAYS * 24 * 60 * 60 * 1_000)
    : null;

  return { isFirst, needsVerification, activeUntil };
};

/**
 * After a seller completes identity verification, flip their
 * active_limited products to fully active.
 * Called by verification.js route after successful verify-email-otp
 * and after admin approves identity_verifications.
 *
 * @param {string} sellerId
 */
export const reactivateLimitedListings = async (sellerId) => {
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      `UPDATE products
       SET    status       = 'active',
              is_active    = TRUE,
              active_until = NULL,
              updated_at   = NOW()
       WHERE  seller_id      = $1
         AND  status         = 'active_limited'
         AND  is_first_product = TRUE
         AND  (active_until IS NULL OR active_until > NOW())
       RETURNING id`,
      [sellerId]
    );

    if (rowCount > 0) {
      console.log(
        `[addproduct] reactivated ${rowCount} limited listing(s) for seller ${sellerId}`
      );
    }
  } catch (err) {
    console.error("[addproduct] reactivateLimitedListings error:", err.message);
  } finally {
    client.release();
  }
};

/**
 * Pause listings that have passed their active_until date.
 * Called by a scheduled cron job every hour.
 */
export const pauseExpiredListings = async () => {
  const client = await pool.connect();
  try {
    const { rows, rowCount } = await client.query(
      `UPDATE products
       SET    status     = 'paused',
              is_active  = FALSE,
              updated_at = NOW()
       WHERE  status      = 'active_limited'
         AND  active_until < NOW()
         AND  seller_id IN (
           SELECT id FROM users WHERE identity_verified = FALSE
         )
       RETURNING id, seller_id, title`,
      []
    );

    if (rowCount > 0) {
      console.log(
        `[addproduct] pauseExpiredListings: paused ${rowCount} listing(s)`,
        rows.map((r) => ({ id: r.id, title: r.title }))
      );
    }

    return rows;
  } catch (err) {
    console.error("[addproduct] pauseExpiredListings error:", err.message);
    return [];
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════════════ */

/* ── GET /categories ── */
router.get("/categories", getCategoriesHandler);

/* ═══════════════════════════════════════════════════════════════
   POST /products — Create product
═══════════════════════════════════════════════════════════════ */
router.post(
  "/products",
  authenticate,
  createProductLimiter,
  withImageUpload(upload.array("images", 6)),
  async (req, res) => {
    const sellerId = req.user?.id;
    const ip       = req.ip ?? req.socket?.remoteAddress ?? null;

    console.log("\n[addproduct] ▶ CREATE PRODUCT  seller:", sellerId);

    if (!sellerId) return fail(res, 401, "Not authenticated.");

    /* ── Parse & validate fields ── */
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
    const whatsappLink  = cleanText(req.body.whatsapp_link);
    const idempotencyKey = cleanText(req.body.idempotency_key);
    const attributes    = safeParse(req.body.attributes, {});
    const delivery      = safeParse(req.body.delivery,   {});
    const contact       = safeParse(req.body.contact,    {});

    /* ── Basic validation ── */
    if (!title)
      return fail(res, 400, "Title required.");
    if (title.length > 120)
      return fail(res, 400, "Title must be at most 120 characters.");
    if (!price || price <= 0 || !Number.isFinite(price))
      return fail(res, 400, "Invalid price.");
    if (price > 1_000_000_000)
      return fail(res, 400, "Price exceeds maximum allowed value.");
    if (!categoryId)
      return fail(res, 400, "Category required.");
    if (!locationState || !locationCity)
      return fail(res, 400, "Location (state and city) required.");

    const files = req.files ?? [];
    if (!files.length)
      return fail(res, 400, "At least one image is required.");

    /* ── Resolve requested status ── */
    const rawStatus = cleanText(req.body.status) ?? "draft";
    const requestedStatus = ALLOWED_STATUSES.has(rawStatus) ? rawStatus : "draft";

    /* ── Idempotency check ── */
    if (idempotencyKey) {
      const { rows: existing } = await pool.query(
        `SELECT id FROM products
         WHERE  seller_id        = $1
           AND  idempotency_key  = $2
         LIMIT  1`,
        [sellerId, idempotencyKey]
      );
      if (existing.length) {
        console.log("[addproduct] idempotent duplicate — returning existing product");
        const { rows: prod } = await pool.query(
          "SELECT * FROM products WHERE id = $1",
          [existing[0].id]
        );
        return res.status(200).json({ success: true, product: prod[0] });
      }
    }

    const client = await pool.connect();

    try {
      /* ── Spam check ── */
      const spamResult = await detectSpamListing({
        seller_id   : sellerId,
        title,
        description,
        price,
      }).catch(() => ({ score: 0, isSpam: false, reasons: [] }));

      if (spamResult.isSpam || spamResult.score >= 70) {
        console.warn("[addproduct] spam detected for seller:", sellerId);
        return fail(res, 403, "Listing flagged as spam.", {
          reasons: spamResult.reasons ?? [],
        });
      }

      /* ── Upload images BEFORE touching DB ── */
      console.log("[addproduct] uploading", files.length, "image(s)...");
      let uploaded;
      try {
        uploaded = await Promise.all(
          files.map((file, i) =>
            uploadToCloudinary(file.buffer).then((r) => ({
              url   : r.secure_url,
              order : i,
            }))
          )
        );
      } catch (uploadErr) {
        console.error("[addproduct] image upload failed:", uploadErr.message);
        return fail(res, 500, "Image upload failed. Please try again.");
      }

      const thumbnail = uploaded[0]?.url ?? null;

      /* ── Transaction ── */
      await client.query("BEGIN");

      /* ── First-product check (inside transaction) ── */
      const { isFirst, needsVerification, activeUntil } =
        await getFirstProductInfo(client, sellerId);

      console.log("[addproduct] firstProduct:", {
        isFirst,
        needsVerification,
        activeUntil,
      });

      /* ── Determine final status ── */
      let finalStatus  = requestedStatus;
      let finalActive  = requestedStatus === "active";

      if (requestedStatus === "active" && needsVerification) {
        // First product, not verified → limited
        finalStatus = "active_limited";
        finalActive = true; // still live, just time-limited
      }

      /* ── Unique slug ── */
      const baseSlug = slugify(title).slice(0, 60);
      const slug     = await generateUniqueSlug(client, baseSlug);

      /* ── Insert product ── */
      const { rows: productRows } = await client.query(
        `INSERT INTO products (
           title,           description,     price,
           seller_id,       category_id,     subcategory_id,
           thumbnail_url,   main_image,      slug,
           status,          is_active,       active_until,
           is_first_product, idempotency_key,
           location_state,  location_city,
           latitude,        longitude,
           seller_name,     phone,           whatsapp,
           whatsapp_link,   attributes,      delivery,
           contact
         )
         VALUES (
           $1,  $2,  $3,
           $4,  $5,  $6,
           $7,  $8,  $9,
           $10, $11, $12,
           $13, $14,
           $15, $16,
           $17, $18,
           $19, $20, $21,
           $22, $23, $24,
           $25
         )
         RETURNING *`,
        [
          title,           description,     price,
          sellerId,        categoryId,      subcategoryId ?? null,
          thumbnail,       thumbnail,       slug,
          finalStatus,     finalActive,     activeUntil ?? null,
          isFirst,         idempotencyKey ?? null,
          locationState,   locationCity,
          latitude ?? null, longitude ?? null,
          sellerName,      phone,           whatsapp,
          whatsappLink,    JSON.stringify(attributes),
          JSON.stringify(delivery), JSON.stringify(contact),
        ]
      );

      const product = productRows[0];

      /* ── Insert product images (inside transaction) ── */
      await Promise.all(
        uploaded.map((img) =>
          client.query(
            `INSERT INTO product_images
               (product_id, image_url, position_order, is_primary)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [product.id, img.url, img.order, img.order === 0]
          )
        )
      );

      await client.query("COMMIT");
      console.log(
        "[addproduct] ✓ product created  id:", product.id,
        " status:", finalStatus
      );

      /* ── Background effects ── */
      updateSellerTrust(sellerId).catch((e) =>
        console.warn("[addproduct] updateSellerTrust:", e.message)
      );
      if (redis) {
        redis.zIncrBy("trending:24h", 5, product.id).catch((e) =>
          console.warn("[addproduct] redis trending:", e.message)
        );
      }

      /* ── Response ── */
      return res.status(201).json({
        success            : true,
        product,
        first_product      : isFirst,
        needs_verification : needsVerification,
        active_until       : activeUntil ?? null,
        ...(needsVerification && {
          verification_message :
            `Your listing is live for ${FIRST_PRODUCT_DAYS} days. ` +
            `Complete identity verification to make it permanent.`,
        }),
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[addproduct] CREATE ERROR:", err.message, err.stack);

      if (err.code === "LIMIT_FILE_SIZE") {
        return fail(res, 400, "Image too large — maximum 3 MB per image.");
      }
      if (err.code === "23505") {
        return fail(res, 409, "A product with this title was recently submitted.");
      }

      return fail(
        res, 500,
        IS_PROD
          ? "Failed to create product. Please try again."
          : err.message
      );
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /products/:id/activate
   Called after successful Paystack payment verification.
   Also called for free plans to make a draft live.
═══════════════════════════════════════════════════════════════ */
router.post(
  "/products/:id/activate",
  authenticate,
  activateLimiter,
  async (req, res) => {
    const sellerId  = req.user?.id;
    const productId = req.params.id;

    console.log("[addproduct] ▶ ACTIVATE  product:", productId, " seller:", sellerId);

    if (!sellerId) return fail(res, 401, "Not authenticated.");
    if (!productId) return fail(res, 400, "Product ID required.");

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      /* ── Fetch product ── */
      const { rows: productRows } = await client.query(
        `SELECT id, seller_id, status, is_first_product
         FROM   products WHERE id = $1 FOR UPDATE`,
        [productId]
      );

      if (!productRows.length) {
        await client.query("ROLLBACK");
        return fail(res, 404, "Product not found.");
      }

      const product = productRows[0];

      if (product.seller_id !== sellerId) {
        await client.query("ROLLBACK");
        return fail(res, 403, "Not authorised to activate this product.");
      }

      if (product.status === "active") {
        await client.query("ROLLBACK");
        return res.json({ success: true, message: "Already active." });
      }

      /* ── Check if this seller needs limited activation ── */
      const { rows: userRows } = await client.query(
        `SELECT email_verified, identity_verified FROM users WHERE id = $1`,
        [sellerId]
      );

      const user       = userRows[0] ?? {};
      const isVerified = Boolean(user.identity_verified);

      /* Apply limited status only if this was the first product
         and seller still hasn't verified */
      const isFirstProduct    = Boolean(product.is_first_product);
      const needsVerification = isFirstProduct && !isVerified;

      let finalStatus = "active";
      let activeUntil = null;

      if (needsVerification) {
        finalStatus = "active_limited";
        activeUntil = new Date(
          Date.now() + FIRST_PRODUCT_DAYS * 24 * 60 * 60 * 1_000
        );
      }

      /* ── Activate ── */
      const { rows: updated } = await client.query(
        `UPDATE products
         SET    status       = $1,
                is_active    = TRUE,
                active_until = $2,
                updated_at   = NOW()
         WHERE  id = $3
         RETURNING *`,
        [finalStatus, activeUntil ?? null, productId]
      );

      await client.query("COMMIT");

      /* ── Trending boost ── */
      if (redis) {
        redis.zIncrBy("trending:24h", 10, productId).catch((e) =>
          console.warn("[addproduct] redis trending:", e.message)
        );
      }

      console.log(
        "[addproduct] ✓ activated  product:", productId,
        " status:", finalStatus
      );

      return res.json({
        success            : true,
        product            : updated[0],
        needs_verification : needsVerification,
        active_until       : activeUntil ?? null,
        ...(needsVerification && {
          verification_message :
            `Your listing is live for ${FIRST_PRODUCT_DAYS} days. ` +
            `Complete identity verification to make it permanent.`,
        }),
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[addproduct] ACTIVATE ERROR:", err.message);
      return fail(
        res, 500,
        IS_PROD ? "Activation failed. Please try again." : err.message
      );
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   DELETE /products/:id — Delete draft or paused product
═══════════════════════════════════════════════════════════════ */
router.delete("/products/:id", authenticate, async (req, res) => {
  const sellerId  = req.user?.id;
  const productId = req.params.id;

  console.log("[addproduct] ▶ DELETE  product:", productId, " seller:", sellerId);

  if (!sellerId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows } = await pool.query(
      `DELETE FROM products
       WHERE  id        = $1
         AND  seller_id = $2
         AND  status    IN ('draft', 'paused', 'pending_payment')
       RETURNING id`,
      [productId, sellerId]
    );

    if (!rows.length) {
      return fail(
        res, 404,
        "Product not found, not owned by you, or cannot be deleted in its current state."
      );
    }

    console.log("[addproduct] ✓ deleted product:", productId);
    return res.json({ success: true });

  } catch (err) {
    console.error("[addproduct] DELETE ERROR:", err.message);
    return fail(
      res, 500,
      IS_PROD ? "Delete failed. Please try again." : err.message
    );
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /products/:id/status — Check product status (used by
   frontend polling after payment redirect)
═══════════════════════════════════════════════════════════════ */
router.get("/products/:id/status", authenticate, async (req, res) => {
  const sellerId  = req.user?.id;
  const productId = req.params.id;

  if (!sellerId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows } = await pool.query(
      `SELECT id, status, is_active, active_until, is_first_product,
              needs_verification
       FROM   products
       WHERE  id        = $1
         AND  seller_id = $2`,
      [productId, sellerId]
    );

    if (!rows.length) return fail(res, 404, "Product not found.");

    const product           = rows[0];
    const isLimited         = product.status === "active_limited";
    const daysRemaining     = isLimited && product.active_until
      ? Math.max(
          0,
          Math.ceil(
            (new Date(product.active_until) - Date.now()) / 86_400_000
          )
        )
      : null;

    return res.json({
      success            : true,
      status             : product.status,
      is_active          : product.is_active,
      active_until       : product.active_until,
      is_first_product   : product.is_first_product,
      needs_verification : isLimited,
      days_remaining     : daysRemaining,
    });

  } catch (err) {
    console.error("[addproduct] STATUS ERROR:", err.message);
    return fail(res, 500, "Server error.");
  }
});

export default router;