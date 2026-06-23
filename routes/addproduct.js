/**
 * routes/addproduct.js
 *
 * POST   /api/addproduct/products                    — Create product
 * POST   /api/addproduct/products/:id/activate       — Activate (free or post-payment)
 * DELETE /api/addproduct/products/:id                — Soft-delete product
 * GET    /api/addproduct/products/:id/status         — Poll product status
 * GET    /api/addproduct/seller/limits               — Posting limits for current seller
 * GET    /api/addproduct/categories                  — Category list
 * GET    /api/addproduct/categories/:id/price-guidance — Price guidance for a category
 * POST   /api/addproduct/products/check-duplicate    — Pre-submit duplicate check
 *
 * ── Loemart Product Posting Policy ───────────────────────────────────────
 *
 *  UNVERIFIED SELLERS
 *  ├─ Max   3 products / day
 *  ├─ Max  10 active listings
 *  ├─ 10-minute cooldown between submissions
 *  ├─ All products expire after 7 days  (status = 'active_limited')
 *  └─ Expired products cannot be re-activated until identity verified
 *
 *  VERIFIED SELLERS  (identity_verified = true)
 *  ├─ Max 100 products / day
 *  ├─ Max 500 active listings
 *  ├─ No cooldown
 *  └─ No expiry  (status = 'active')
 *
 *  v2 upgrades:
 *  ├─ Cloudinary orphan cleanup on DB rollback
 *  ├─ Slug UNIQUE constraint + retry on 23505
 *  ├─ Seller row lock (FOR UPDATE) to prevent race-condition limit bypass
 *  ├─ Category + subcategory relationship validation
 *  ├─ Phone / WhatsApp format validation
 *  ├─ Soft deletes (status = 'deleted', deleted_at = NOW())
 *  ├─ Image hash dedup stored in product_image_hashes table
 *  ├─ check-duplicate endpoint (title + image hashes)
 *  ├─ price-guidance endpoint (category median price)
 *  └─ seller/limits endpoint
 */

import express     from "express";
import multer      from "multer";
import streamifier from "streamifier";
import rateLimit   from "express-rate-limit";
import crypto      from "crypto";
import { v2 as cloudinary } from "cloudinary";

import { pool }         from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";
import {
  detectSpamListing,
  updateSellerTrust,
} from "../utils/listingUtils.js";
import { createNotification }       from "../services/notifications.js";
import { getCategoriesHandler }     from "../controllers/category.controller.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   POLICY TABLE  ← single source of truth
═══════════════════════════════════════════════════════════════ */
const POLICY = Object.freeze({
  unverified: {
    dailyLimit      :   3,
    activeLimit     :  10,
    cooldownMinutes :  10,
    expiryDays      :   7,
    canReactivate   : false,
  },
  verified: {
    dailyLimit      : 100,
    activeLimit     : 500,
    cooldownMinutes :   0,
    expiryDays      :   0,
    canReactivate   : true,
  },
});

const ALLOWED_STATUSES  = new Set(["active", "draft", "pending_payment"]);
const MAX_SLUG_RETRIES  = 10;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/* ═══════════════════════════════════════════════════════════════
   REDIS
═══════════════════════════════════════════════════════════════ */
let redis = null;
(async () => {
  if (!process.env.REDIS_URL) {
    console.warn("[addproduct] REDIS_URL not set — trending disabled");
    return;
  }
  try {
    const { createClient } = await import("redis");
    redis = createClient({ url: process.env.REDIS_URL });
    redis.on("error", (e) => console.warn("[addproduct] Redis error:", e.message));
    await redis.connect();
    console.log("[addproduct] Redis connected");
  } catch (e) {
    console.warn("[addproduct] Redis unavailable:", e.message);
    redis = null;
  }
})();

/* ═══════════════════════════════════════════════════════════════
   MULTER
═══════════════════════════════════════════════════════════════ */
const upload = multer({
  storage    : multer.memoryStorage(),
  limits     : { fileSize: 3 * 1_048_576, files: 6 },
  fileFilter : (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      const err  = new Error(`Invalid image type "${file.mimetype}". Only JPEG, PNG, WebP allowed.`);
      err.code   = "INVALID_MIME";
      return cb(err);
    }
    cb(null, true);
  },
});

const withImageUpload = (handler) => (req, res, next) =>
  handler(req, res, (err) => {
    if (!err) return next();
    if (["LIMIT_FILE_SIZE","LIMIT_FILE_COUNT","INVALID_MIME"].includes(err.code))
      return res.status(400).json({ success: false, message: err.message });
    return next(err);
  });

/* ═══════════════════════════════════════════════════════════════
   HTTP RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60 * 1_000,
    max,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? req.ip),
    handler         : (_req, res) => res.status(429).json({ success: false, message }),
  });

const createProductLimiter = makeLimiter({
  windowMin : 60,
  max       : IS_PROD ? 20  : 500,
  message   : "Too many product submissions. Please wait before trying again.",
});

const activateLimiter = makeLimiter({
  windowMin : 15,
  max       : IS_PROD ? 30  : 500,
  message   : "Too many activation requests. Please wait.",
});

const readLimiter = makeLimiter({
  windowMin : 5,
  max       : IS_PROD ? 120 : 1_000,
  message   : "Too many requests. Slow down.",
});

const dupCheckLimiter = makeLimiter({
  windowMin : 5,
  max       : IS_PROD ? 30  : 500,
  message   : "Too many duplicate checks.",
});

/* ═══════════════════════════════════════════════════════════════
   CLOUDINARY — upload + orphan cleanup
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
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

/**
 * Destroy uploaded Cloudinary assets on DB rollback.
 * Failures are swallowed — orphan cleanup must not hide the real error.
 */
const destroyCloudinaryAssets = async (publicIds) => {
  if (!publicIds?.length) return;
  try {
    await cloudinary.api.delete_resources(publicIds, {
      resource_type : "image",
      invalidate    : true,
    });
    console.log("[addproduct] ✓ orphan cleanup:", publicIds.length, "image(s) deleted");
  } catch (e) {
    console.error("[addproduct] orphan cleanup failed:", e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════════════════════ */
const cleanText = (v) => { const s = String(v ?? "").trim(); return s || null; };
const cleanUuid = (v) => {
  const s = String(v ?? "").trim();
  return s && s !== "null" && s !== "undefined" ? s : null;
};
const toNumberOrNull = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const safeParse = (v, fallback) => { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const fail      = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });
const getTodayUTC = () => new Date().toISOString().slice(0, 10);
const getIp       = (req) => req.ip ?? req.socket?.remoteAddress ?? null;

/* ── Phone validation ── */
const PHONE_RE    = /^\+?[0-9]{7,15}$/;
const validatePhone = (value, label) => {
  if (!value) return `${label} is required.`;
  const cleaned = String(value).replace(/[\s\-().]/g, "");
  if (!PHONE_RE.test(cleaned))
    return `${label} must be 7–15 digits (e.g. 08012345678 or +2348012345678).`;
  return null;
};

/* ── Slug ── */
const slugify = (text = "") =>
  text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")
    .replace(/-+/g, "-").replace(/^-+|-+$/g, "");

const buildSlugCandidate = (base, attempt) =>
  attempt === 0
    ? `${base}-${Math.floor(1000 + Math.random() * 9000)}`
    : `${base}-${Date.now()}-${attempt}`;

/* ── Deep clone (structuredClone with JSON fallback) ── */
const deepClone = (obj) =>
  typeof structuredClone === "function"
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));

/* ═══════════════════════════════════════════════════════════════
   CATEGORY VALIDATION
═══════════════════════════════════════════════════════════════ */
const validateCategoryRelationship = async (client, categoryId, subcategoryId) => {
  const { rows: catRows } = await client.query(
    "SELECT id FROM categories WHERE id = $1 AND is_active = TRUE",
    [categoryId]
  );
  if (!catRows.length)
    return { valid: false, message: "Selected category does not exist or is inactive." };

  if (subcategoryId) {
    const { rows: subRows } = await client.query(
      "SELECT id FROM categories WHERE id = $1 AND parent_id = $2 AND is_active = TRUE",
      [subcategoryId, categoryId]
    );
    if (!subRows.length)
      return { valid: false, message: "Selected subcategory does not belong to the chosen category." };
  }

  return { valid: true };
};

/* ═══════════════════════════════════════════════════════════════
   POLICY ENFORCEMENT
═══════════════════════════════════════════════════════════════ */

/**
 * Fetch seller context for policy decisions.
 * Locks the user row (FOR UPDATE) to prevent race-condition limit bypasses.
 */
const getSellerContext = async (client, sellerId) => {
  const today = getTodayUTC();

  /* Lock seller row — serialises concurrent submissions */
  const { rows: userRows } = await client.query(
    "SELECT identity_verified FROM public.users WHERE id = $1 FOR UPDATE",
    [sellerId]
  );
  if (!userRows.length) throw new Error("Seller account not found.");

  const isVerified = Boolean(userRows[0].identity_verified);
  const policy     = isVerified ? POLICY.verified : POLICY.unverified;

  const [todayRes, activeRes, lastRes, totalRes] = await Promise.all([
    client.query(
      `SELECT COUNT(*) AS cnt FROM products
       WHERE  seller_id   = $1
         AND  created_at >= $2::date
         AND  created_at <  ($2::date + INTERVAL '1 day')
         AND  status     <> 'deleted'`,
      [sellerId, today]
    ),
    client.query(
      `SELECT COUNT(*) AS cnt FROM products
       WHERE  seller_id = $1 AND is_active = TRUE
         AND  status IN ('active', 'active_limited')`,
      [sellerId]
    ),
    client.query(
      `SELECT created_at FROM products
       WHERE  seller_id = $1 AND status <> 'deleted'
       ORDER  BY created_at DESC LIMIT 1`,
      [sellerId]
    ),
    client.query(
      `SELECT COUNT(*) AS cnt FROM products
       WHERE  seller_id = $1 AND status <> 'deleted'`,
      [sellerId]
    ),
  ]);

  const todayCount     = parseInt(todayRes.rows[0].cnt,  10);
  const activeCount    = parseInt(activeRes.rows[0].cnt, 10);
  const totalCount     = parseInt(totalRes.rows[0].cnt,  10);
  const isFirstProduct = totalCount === 0;
  const lastSubmitAt   = lastRes.rows[0]?.created_at ?? null;

  let cooldownSecsLeft = 0;
  if (policy.cooldownMinutes > 0 && lastSubmitAt) {
    const elapsedMs = Date.now() - new Date(lastSubmitAt).getTime();
    const limitMs   = policy.cooldownMinutes * 60 * 1_000;
    cooldownSecsLeft = Math.max(0, Math.ceil((limitMs - elapsedMs) / 1_000));
  }

  return { isVerified, policy, isFirstProduct, todayCount, activeCount, cooldownSecsLeft };
};

const enforcePolicyLimits = ({ isVerified, policy, todayCount, activeCount, cooldownSecsLeft }) => {
  if (todayCount >= policy.dailyLimit) {
    return {
      status  : 429,
      message : isVerified
        ? `Daily limit reached (${policy.dailyLimit} products/day). Try tomorrow.`
        : `Unverified sellers can post ${policy.dailyLimit} products/day. Complete verification to unlock ${POLICY.verified.dailyLimit}/day.`,
      extra   : { daily_limit: policy.dailyLimit, daily_used: todayCount,
                  upgrade_message: isVerified ? null : "Complete identity verification to post 100 products/day." },
    };
  }
  if (activeCount >= policy.activeLimit) {
    return {
      status  : 429,
      message : isVerified
        ? `Active listing limit reached (${policy.activeLimit}).`
        : `Unverified sellers can have ${policy.activeLimit} active listings. Complete verification to list up to ${POLICY.verified.activeLimit}.`,
      extra   : { active_limit: policy.activeLimit, active_count: activeCount,
                  upgrade_message: isVerified ? null : "Complete identity verification to unlock 500 active listings." },
    };
  }
  if (cooldownSecsLeft > 0) {
    const mins = Math.ceil(cooldownSecsLeft / 60);
    return {
      status  : 429,
      message : `Please wait ${mins} minute${mins !== 1 ? "s" : ""} before posting again.`,
      extra   : { retry_after_seconds: cooldownSecsLeft,
                  upgrade_message: "Complete identity verification to remove posting cooldowns." },
    };
  }
  return null;
};

const computeActiveUntil = (isVerified) => {
  if (isVerified || POLICY.unverified.expiryDays === 0) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + POLICY.unverified.expiryDays);
  return d;
};

/* ═══════════════════════════════════════════════════════════════
   IMAGE HASH DEDUP HELPERS
   Stores SHA-256 hashes of uploaded images to detect duplicate
   listings and cross-listing image reuse.
═══════════════════════════════════════════════════════════════ */

/**
 * Check incoming image hashes against hashes already stored for
 * this seller's active listings.
 * Returns matching product titles if any duplicates found.
 */
const checkImageHashDuplicates = async (client, sellerId, hashes) => {
  if (!hashes?.length) return [];
  const { rows } = await client.query(
    `SELECT DISTINCT p.id, p.title
     FROM   product_image_hashes pih
     JOIN   products p ON p.id = pih.product_id
     WHERE  pih.image_hash = ANY($1::text[])
       AND  p.seller_id    = $2
       AND  p.status       NOT IN ('deleted')
     LIMIT  3`,
    [hashes, sellerId]
  );
  return rows;
};

/**
 * Store image hashes for a newly created product.
 * Fire-and-forget — failures do not affect the product creation.
 */
const storeImageHashes = async (productId, hashes) => {
  if (!hashes?.length) return;
  try {
    const values = hashes
      .map((_, i) => `($1, $${i + 2})`)
      .join(", ");
    await pool.query(
      `INSERT INTO product_image_hashes (product_id, image_hash)
       VALUES ${values}
       ON CONFLICT DO NOTHING`,
      [productId, ...hashes]
    );
  } catch (err) {
    console.error("[addproduct] storeImageHashes error:", err.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   EXPORTED UTILITIES
═══════════════════════════════════════════════════════════════ */

/** Promote active_limited listings to permanent after verification */
export const reactivateLimitedListings = async (sellerId) => {
  const client = await pool.connect();
  try {
    const { rows, rowCount } = await client.query(
      `UPDATE products
       SET    status       = 'active',
              is_active    = TRUE,
              active_until = NULL,
              updated_at   = NOW()
       WHERE  seller_id    = $1
         AND  status       = 'active_limited'
         AND  (active_until IS NULL OR active_until > NOW())
       RETURNING id, title`,
      [sellerId]
    );

    if (rowCount > 0) {
      console.log(`[addproduct] reactivated ${rowCount} listing(s) for seller ${sellerId}`);
      createNotification({
        userId  : sellerId,
        type    : "listings_reactivated",
        title   : "Listings Made Permanent",
        message :
          `${rowCount} listing${rowCount !== 1 ? "s" : ""} ` +
          "have been upgraded to permanent status now that your identity is verified.",
      }).catch(() => {});
      if (redis) rows.forEach((r) => redis.zIncrBy("trending:24h", 5, r.id).catch(() => {}));
    }

    return rowCount;
  } catch (err) {
    console.error("[addproduct] reactivateLimitedListings error:", err.message);
    return 0;
  } finally {
    client.release();
  }
};

/** Cron: pause listings whose active_until has passed */
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
         AND  seller_id IN (SELECT id FROM public.users WHERE identity_verified = FALSE)
       RETURNING id, seller_id, title`,
      []
    );

    if (rowCount > 0) {
      console.log(`[addproduct] paused ${rowCount} listing(s)`);
      const bySeller = rows.reduce((acc, r) => {
        const key = String(r.seller_id);
        (acc[key] ??= []).push(r.title);
        return acc;
      }, {});

      for (const [sellerId, titles] of Object.entries(bySeller)) {
        createNotification({
          userId  : sellerId,
          type    : "listings_paused",
          title   : "Listings Paused — Verification Required",
          message :
            `${titles.length} listing${titles.length !== 1 ? "s" : ""} ` +
            "paused because your 7-day trial has ended. " +
            "Complete identity verification to restore them permanently.",
        }).catch(() => {});
      }
    }

    return rows;
  } catch (err) {
    console.error("[addproduct] pauseExpiredListings error:", err.message);
    return [];
  } finally {
    client.release();
  }
};

/** Cron: cleanup stuck pending_payment products */
export const cleanupStuckPendingPayments = async () => {
  const client = await pool.connect();
  try {
    const { rows, rowCount } = await client.query(
      `UPDATE products
       SET    status     = 'draft',
              updated_at = NOW()
       WHERE  status     = 'pending_payment'
         AND  updated_at < NOW() - INTERVAL '30 minutes'
       RETURNING id, seller_id, title`,
      []
    );

    if (rowCount > 0) {
      console.log(`[addproduct] cleanup: reverted ${rowCount} stuck listing(s)`);

      await client.query(
        `UPDATE payments
         SET    status     = 'expired',
                updated_at = NOW()
         WHERE  product_id = ANY($1::uuid[])
           AND  status     = 'pending'`,
        [rows.map((r) => r.id)]
      );

      const bySeller = rows.reduce((acc, r) => {
        const key = String(r.seller_id);
        (acc[key] ??= []).push(r.title);
        return acc;
      }, {});

      for (const [sellerId, titles] of Object.entries(bySeller)) {
        createNotification({
          userId  : sellerId,
          type    : "payment_expired",
          title   : "Payment Session Expired",
          message :
            `${titles.length} listing${titles.length !== 1 ? "s" : ""} ` +
            "returned to draft because the payment session expired. " +
            "Please try posting again.",
        }).catch(() => {});
      }
    }

    return rows;
  } catch (err) {
    console.error("[addproduct] cleanupStuckPendingPayments error:", err.message);
    return [];
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /categories
═══════════════════════════════════════════════════════════════ */
router.get("/categories", getCategoriesHandler);

/* ═══════════════════════════════════════════════════════════════
   GET /categories/:id/price-guidance
   Returns median and range of prices for active listings in
   this category to help sellers price competitively.
═══════════════════════════════════════════════════════════════ */
router.get("/categories/:id/price-guidance", readLimiter, async (req, res) => {
  const categoryId = req.params.id;
  if (!categoryId) return fail(res, 400, "Category ID required.");

  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)                                        AS total_listings,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median_price,
         MIN(price)                                      AS min_price,
         MAX(price)                                      AS max_price,
         AVG(price)                                      AS avg_price
       FROM products
       WHERE  category_id = $1
         AND  is_active   = TRUE
         AND  status      IN ('active', 'active_limited')
         AND  price       > 0`,
      [categoryId]
    );

    const stats = rows[0];
    if (!stats || parseInt(stats.total_listings, 10) < 3) {
      return res.json({ success: true, guidance: null, message: "Not enough listings to show guidance." });
    }

    return res.json({
      success  : true,
      guidance : {
        median_price    : Math.round(Number(stats.median_price)),
        min_price       : Math.round(Number(stats.min_price)),
        max_price       : Math.round(Number(stats.max_price)),
        avg_price       : Math.round(Number(stats.avg_price)),
        total_listings  : parseInt(stats.total_listings, 10),
        currency        : "NGN",
        tip             : `Most sellers price between ₦${Math.round(Number(stats.min_price)).toLocaleString("en-NG")} and ₦${Math.round(Number(stats.max_price)).toLocaleString("en-NG")}.`,
      },
    });
  } catch (err) {
    console.error("[addproduct] price-guidance error:", err.message);
    return fail(res, 500, "Server error.");
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /seller/limits
═══════════════════════════════════════════════════════════════ */
router.get("/seller/limits", authenticate, readLimiter, async (req, res) => {
  const sellerId = req.user?.id;
  if (!sellerId) return fail(res, 401, "Not authenticated.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ctx = await getSellerContext(client, sellerId);
    await client.query("ROLLBACK");

    return res.json({
      success          : true,
      seller_verified  : ctx.isVerified,
      daily_limit      : ctx.policy.dailyLimit,
      daily_used       : ctx.todayCount,
      daily_remaining  : Math.max(0, ctx.policy.dailyLimit  - ctx.todayCount),
      active_limit     : ctx.policy.activeLimit,
      active_count     : ctx.activeCount,
      active_remaining : Math.max(0, ctx.policy.activeLimit - ctx.activeCount),
      cooldown_seconds : ctx.cooldownSecsLeft,
      expiry_days      : ctx.policy.expiryDays || null,
      can_reactivate   : ctx.policy.canReactivate,
      upgrade_message  : ctx.isVerified ? null
        : `Complete identity verification to unlock ${POLICY.verified.dailyLimit} products/day, ` +
          `${POLICY.verified.activeLimit} active listings, and permanent listings.`,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[addproduct] LIMITS ERROR:", err.message);
    return fail(res, 500, "Server error.");
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /products/check-duplicate
   Pre-submit check — returns warning if title or images match
   an existing active listing by this seller.
   Non-blocking: never prevents posting, only warns.
═══════════════════════════════════════════════════════════════ */
router.post("/products/check-duplicate", authenticate, dupCheckLimiter, async (req, res) => {
  const sellerId    = req.user?.id;
  const { title, price, category_id, image_hashes = [] } = req.body;

  if (!sellerId || !title) return res.json({ isDuplicate: false });

  const client = await pool.connect();
  try {
    /* Check 1: same title posted recently */
    const { rows: titleMatches } = await client.query(
      `SELECT id, title, price
       FROM   products
       WHERE  seller_id   = $1
         AND  status      NOT IN ('deleted', 'draft')
         AND  created_at  > NOW() - INTERVAL '7 days'
         AND  LOWER(TRIM(title)) = LOWER(TRIM($2))`,
      [sellerId, title]
    );

    if (titleMatches.length > 0) {
      return res.json({
        isDuplicate : true,
        message     : "You already have an active listing with this title. Check your listings before reposting.",
      });
    }

    /* Check 2: image hash collision */
    if (Array.isArray(image_hashes) && image_hashes.length > 0) {
      const hashMatches = await checkImageHashDuplicates(client, sellerId, image_hashes);
      if (hashMatches.length > 0) {
        return res.json({
          isDuplicate : true,
          message     : `One or more photos are already used in "${hashMatches[0].title}". Take new photos or check your existing listings.`,
        });
      }
    }

    return res.json({ isDuplicate: false });

  } catch (err) {
    console.error("[check-duplicate]", err.message);
    return res.json({ isDuplicate: false }); /* never block on error */
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /products/:id/status
═══════════════════════════════════════════════════════════════ */
router.get("/products/:id/status", authenticate, readLimiter, async (req, res) => {
  const sellerId  = req.user?.id;
  const productId = req.params.id;
  if (!sellerId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.status, p.is_active, p.active_until, p.is_first_product,
              u.identity_verified AS seller_verified
       FROM   products p
       JOIN   public.users u ON u.id = p.seller_id
       WHERE  p.id        = $1
         AND  p.seller_id = $2
         AND  p.status   <> 'deleted'`,
      [productId, sellerId]
    );

    if (!rows.length) return fail(res, 404, "Product not found.");

    const p             = rows[0];
    const isLimited     = p.status === "active_limited";
    const isExpired     = isLimited && p.active_until && new Date(p.active_until) < new Date();
    const daysRemaining = isLimited && p.active_until
      ? Math.max(0, Math.ceil((new Date(p.active_until).getTime() - Date.now()) / 86_400_000))
      : null;

    return res.json({
      success            : true,
      status             : p.status,
      is_active          : p.is_active,
      active_until       : p.active_until,
      is_first_product   : p.is_first_product,
      seller_verified    : p.seller_verified,
      needs_verification : isLimited && !isExpired,
      is_expired         : isExpired,
      days_remaining     : daysRemaining,
    });
  } catch (err) {
    console.error("[addproduct] STATUS ERROR:", err.message);
    return fail(res, 500, "Server error.");
  }
});

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
    const ip       = getIp(req);

    console.log("\n[addproduct] ▶ CREATE PRODUCT  seller:", sellerId);
    if (!sellerId) return fail(res, 401, "Not authenticated.");

    /* ── Parse fields ── */
    const title          = cleanText(req.body.title);
    const description    = cleanText(req.body.description);
    const price          = Number(req.body.price);
    const categoryId     = cleanUuid(req.body.category_id);
    const subcategoryId  = cleanUuid(req.body.subcategory_id);
    const locationState  = cleanText(req.body.location_state);
    const locationCity   = cleanText(req.body.location_city);
    const latitude       = toNumberOrNull(req.body.latitude);
    const longitude      = toNumberOrNull(req.body.longitude);
    const sellerName     = cleanText(req.body.seller_name);
    const phone          = cleanText(req.body.phone);
    const whatsapp       = cleanText(req.body.whatsapp);
    const whatsappLink   = cleanText(req.body.whatsapp_link);
    const idempotencyKey = cleanText(req.body.idempotency_key);
    const imageHashes    = safeParse(req.body.image_hashes, []);
    const attributes     = safeParse(req.body.attributes, {});
    const delivery       = safeParse(req.body.delivery,   {});
    const contact        = safeParse(req.body.contact,    {});

    /* ── Basic validation ── */
    if (!title)                                    return fail(res, 400, "Title required.");
    if (title.length > 120)                        return fail(res, 400, "Title must be at most 120 characters.");
    if (!description || description.length < 10)   return fail(res, 400, "Description must be at least 10 characters.");
    if (description.length > 2000)                 return fail(res, 400, "Description must be at most 2000 characters.");
    if (!price || price <= 0 || !Number.isFinite(price)) return fail(res, 400, "Invalid price.");
    if (price > 1_000_000_000)                     return fail(res, 400, "Price exceeds maximum allowed value.");
    if (!categoryId)                               return fail(res, 400, "Category required.");
    if (!locationState || !locationCity)           return fail(res, 400, "State and city are required.");

    /* ── Phone validation ── */
    const phoneErr = validatePhone(phone, "Phone number");
    if (phoneErr) return fail(res, 400, phoneErr);
    if (whatsapp) {
      const waErr = validatePhone(whatsapp, "WhatsApp number");
      if (waErr) return fail(res, 400, waErr);
    }

    const files = req.files ?? [];
    if (!files.length) return fail(res, 400, "At least one image is required.");

    const rawStatus       = cleanText(req.body.status) ?? "draft";
    const requestedStatus = ALLOWED_STATUSES.has(rawStatus) ? rawStatus : "draft";

    /* ── Idempotency guard ── */
    if (idempotencyKey) {
      const { rows: dup } = await pool.query(
        `SELECT id FROM products
         WHERE  seller_id       = $1
           AND  idempotency_key = $2
           AND  status         <> 'deleted'
         LIMIT  1`,
        [sellerId, idempotencyKey]
      );
      if (dup.length) {
        console.log("[addproduct] idempotent hit — returning existing product");
        const { rows: existing } = await pool.query("SELECT * FROM products WHERE id = $1", [dup[0].id]);
        return res.status(200).json({ success: true, product: existing[0] });
      }
    }

    /* ── Spam check ── */
    const spamResult = await detectSpamListing({ seller_id: sellerId, title, description, price })
      .catch(() => ({ score: 0, isSpam: false, reasons: [] }));
    if (spamResult.isSpam || spamResult.score >= 70) {
      console.warn("[addproduct] spam detected  seller:", sellerId);
      return fail(res, 403, "Listing flagged as spam.", { reasons: spamResult.reasons ?? [] });
    }

    /* ── Upload images BEFORE transaction (fail-fast) ── */
    console.log("[addproduct] uploading", files.length, "image(s)...");
    let uploaded;
    try {
      uploaded = await Promise.all(
        files.map((file, i) =>
          uploadToCloudinary(file.buffer).then((r) => ({ url: r.url, publicId: r.publicId, order: i }))
        )
      );
    } catch (uploadErr) {
      console.error("[addproduct] image upload failed:", uploadErr.message);
      return fail(res, 500, "Image upload failed. Please try again.");
    }

    const thumbnail = uploaded[0]?.url ?? null;
    const publicIds = uploaded.map((u) => u.publicId);

    /* ── Open transaction ── */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* ── Lock seller row + get context ── */
      const ctx = await getSellerContext(client, sellerId);
      console.log("[addproduct] seller context:", {
        isVerified: ctx.isVerified, todayCount: ctx.todayCount,
        activeCount: ctx.activeCount, cooldownSecsLeft: ctx.cooldownSecsLeft,
      });

      /* ── Validate category ── */
      const catCheck = await validateCategoryRelationship(client, categoryId, subcategoryId);
      if (!catCheck.valid) {
        await client.query("ROLLBACK");
        await destroyCloudinaryAssets(publicIds);
        return fail(res, 400, catCheck.message);
      }

      /* ── Enforce policy (active listings only) ── */
      if (requestedStatus === "active") {
        const policyErr = enforcePolicyLimits(ctx);
        if (policyErr) {
          await client.query("ROLLBACK");
          await destroyCloudinaryAssets(publicIds);
          return fail(res, policyErr.status, policyErr.message, policyErr.extra);
        }
      }

      /* ── Determine final status ── */
      let finalStatus = requestedStatus;
      let finalActive = requestedStatus === "active";
      let activeUntil = null;

      if (requestedStatus === "active" && !ctx.isVerified) {
        finalStatus = "active_limited";
        finalActive = true;
        activeUntil = computeActiveUntil(false);
      }

      /* ── Insert product with slug retry loop ── */
      let product     = null;
      const baseSlug  = slugify(title).slice(0, 60);
      let slugAttempt = 0;

      while (slugAttempt < MAX_SLUG_RETRIES) {
        const slug = buildSlugCandidate(baseSlug, slugAttempt);
        try {
          const { rows: productRows } = await client.query(
            `INSERT INTO products (
               title,             description,       price,
               seller_id,         category_id,       subcategory_id,
               thumbnail_url,     main_image,        slug,
               status,            is_active,         active_until,
               is_first_product,  idempotency_key,
               location_state,    location_city,
               latitude,          longitude,
               seller_name,       phone,             whatsapp,
               whatsapp_link,     attributes,        delivery,
               contact
             )
             VALUES (
               $1,  $2,  $3,  $4,  $5,  $6,
               $7,  $8,  $9,  $10, $11, $12,
               $13, $14, $15, $16, $17, $18,
               $19, $20, $21, $22, $23, $24, $25
             )
             RETURNING *`,
            [
              title,                        description,              price,
              sellerId,                     categoryId,               subcategoryId ?? null,
              thumbnail,                    thumbnail,                slug,
              finalStatus,                  finalActive,              activeUntil ?? null,
              ctx.isFirstProduct,           idempotencyKey ?? null,
              locationState,                locationCity,
              latitude ?? null,             longitude ?? null,
              sellerName,                   phone,                    whatsapp ?? null,
              whatsappLink,                 JSON.stringify(attributes),
              JSON.stringify(delivery),     JSON.stringify(contact),
            ]
          );
          product = productRows[0];
          break;
        } catch (insertErr) {
          if (insertErr.code === "23505" && insertErr.constraint?.includes("slug")) {
            slugAttempt++;
            continue;
          }
          throw insertErr;
        }
      }

      if (!product) {
        await client.query("ROLLBACK");
        await destroyCloudinaryAssets(publicIds);
        return fail(res, 500, "Failed to generate a unique product slug. Please try again.");
      }

      /* ── Insert product images ── */
      await Promise.all(
        uploaded.map((img) =>
          client.query(
            `INSERT INTO product_images
               (product_id, image_url, cloudinary_public_id, position_order, is_primary)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [product.id, img.url, img.publicId, img.order, img.order === 0]
          )
        )
      );

      await client.query("COMMIT");
      console.log("[addproduct] ✓ created  id:", product.id, " status:", finalStatus);

      /* ── Store image hashes (fire-and-forget) ── */
      if (Array.isArray(imageHashes) && imageHashes.length > 0) {
        storeImageHashes(product.id, imageHashes).catch(() => {});
      }

      /* ── Audit ── */
      writeAudit({
        actorId    : sellerId,
        action     : "product_created",
        targetType : "product",
        targetId   : product.id,
        metadata   : { title, status: finalStatus, active_until: activeUntil, is_verified: ctx.isVerified },
        ipAddress  : ip,
      }).catch(() => {});

      /* ── Background effects ── */
      updateSellerTrust(sellerId).catch((e) => console.warn("[addproduct] updateSellerTrust:", e.message));
      redis?.zIncrBy("trending:24h", 5, product.id).catch(() => {});

      /* ── Notify seller if listing is limited ── */
      const needsVerification = finalStatus === "active_limited";
      if (needsVerification && ctx.isFirstProduct) {
        createNotification({
          userId  : sellerId,
          type    : "listing_limited",
          title   : "Listing Posted — Verification Needed",
          message :
            `Your listing "${title}" is live for ${POLICY.unverified.expiryDays} days. ` +
            `Complete identity verification to make it permanent and unlock ${POLICY.verified.dailyLimit} products/day.`,
        }).catch(() => {});
      }

      return res.status(201).json({
        success            : true,
        product,
        first_product      : ctx.isFirstProduct,
        needs_verification : needsVerification,
        active_until       : activeUntil ?? null,
        days_remaining     : needsVerification ? POLICY.unverified.expiryDays : null,
        seller_verified    : ctx.isVerified,
        limits             : {
          daily_limit  : ctx.policy.dailyLimit,
          daily_used   : ctx.todayCount + 1,
          daily_left   : Math.max(0, ctx.policy.dailyLimit - ctx.todayCount - 1),
          active_limit : ctx.policy.activeLimit,
          active_count : ctx.activeCount + 1,
        },
        ...(needsVerification && {
          verification_message :
            `Your listing is live for ${POLICY.unverified.expiryDays} days. ` +
            `Complete identity verification to make it permanent and unlock ` +
            `${POLICY.verified.dailyLimit} products/day with ${POLICY.verified.activeLimit} active listings.`,
        }),
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      /* Orphan cleanup — destroy uploaded images on any DB failure */
      await destroyCloudinaryAssets(publicIds);
      console.error("[addproduct] CREATE ERROR:", err.message, "\n", err.stack);

      if (err.code === "LIMIT_FILE_SIZE") return fail(res, 400, "Image too large — maximum 3 MB per image.");
      if (err.code === "23505")           return fail(res, 409, "This product was already submitted recently.");

      return fail(res, 500, IS_PROD ? "Failed to create product. Please try again." : err.message);
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /products/:id/activate
═══════════════════════════════════════════════════════════════ */
router.post("/products/:id/activate", authenticate, activateLimiter, async (req, res) => {
  const sellerId  = req.user?.id;
  const productId = req.params.id;
  const ip        = getIp(req);

  console.log("\n[addproduct] ▶ ACTIVATE  product:", productId, " seller:", sellerId);
  if (!sellerId)  return fail(res, 401, "Not authenticated.");
  if (!productId) return fail(res, 400, "Product ID required.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: productRows } = await client.query(
      `SELECT id, seller_id, status, is_first_product, active_until
       FROM   products
       WHERE  id     = $1
         AND  status <> 'deleted'
       FOR UPDATE`,
      [productId]
    );

    if (!productRows.length) { await client.query("ROLLBACK"); return fail(res, 404, "Product not found."); }

    const product = productRows[0];
    if (product.seller_id !== sellerId) { await client.query("ROLLBACK"); return fail(res, 403, "Not authorised."); }
    if (product.status === "active")    { await client.query("ROLLBACK"); return res.json({ success: true, message: "Already active." }); }

    /* Lock user row + get verification status */
    const { rows: userRows } = await client.query(
      "SELECT identity_verified FROM public.users WHERE id = $1 FOR UPDATE",
      [sellerId]
    );
    const isVerified = Boolean(userRows[0]?.identity_verified);

    /* Paused / expired reactivation guard */
    if (product.status === "paused" && !isVerified && !POLICY.unverified.canReactivate) {
      await client.query("ROLLBACK");
      return fail(res, 403,
        "Expired listings cannot be reactivated for unverified sellers. " +
        "Complete identity verification to restore this listing.",
        { upgrade_required: true }
      );
    }

    /* Check active listing limit */
    const ctx       = await getSellerContext(client, sellerId);
    const policyErr = enforcePolicyLimits({ ...ctx, cooldownSecsLeft: 0 });
    if (policyErr) { await client.query("ROLLBACK"); return fail(res, policyErr.status, policyErr.message, policyErr.extra); }

    let finalStatus = "active";
    let activeUntil = null;
    if (!isVerified) {
      finalStatus = "active_limited";
      activeUntil = computeActiveUntil(false);
    }

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

    writeAudit({
      actorId    : sellerId,
      action     : "product_activated",
      targetType : "product",
      targetId   : productId,
      metadata   : { status: finalStatus, active_until: activeUntil },
      ipAddress  : ip,
    }).catch(() => {});

    redis?.zIncrBy("trending:24h", 10, productId).catch(() => {});

    const needsVerification = finalStatus === "active_limited";
    const daysRemaining     = needsVerification && activeUntil
      ? Math.max(0, Math.ceil((new Date(activeUntil).getTime() - Date.now()) / 86_400_000))
      : null;

    console.log("[addproduct] ✓ activated  status:", finalStatus);

    return res.json({
      success            : true,
      product            : updated[0],
      needs_verification : needsVerification,
      active_until       : activeUntil ?? null,
      days_remaining     : daysRemaining,
      seller_verified    : isVerified,
      ...(needsVerification && {
        verification_message :
          `Your listing is live for ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}. ` +
          "Complete identity verification to make it permanent.",
      }),
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[addproduct] ACTIVATE ERROR:", err.message);
    return fail(res, 500, IS_PROD ? "Activation failed. Please try again." : err.message);
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   DELETE /products/:id — SOFT DELETE
═══════════════════════════════════════════════════════════════ */
router.delete("/products/:id", authenticate, async (req, res) => {
  const sellerId  = req.user?.id;
  const productId = req.params.id;
  const ip        = getIp(req);

  console.log("[addproduct] ▶ SOFT DELETE  product:", productId, " seller:", sellerId);
  if (!sellerId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows } = await pool.query(
      `UPDATE products
       SET    status     = 'deleted',
              is_active  = FALSE,
              deleted_at = NOW(),
              updated_at = NOW()
       WHERE  id         = $1
         AND  seller_id  = $2
         AND  status    IN ('draft', 'paused', 'pending_payment', 'active_limited')
       RETURNING id, title`,
      [productId, sellerId]
    );

    if (!rows.length) {
      return fail(res, 404,
        "Product not found, not owned by you, or cannot be deleted in its current state. " +
        "Active listings cannot be deleted — pause them first."
      );
    }

    writeAudit({
      actorId    : sellerId,
      action     : "product_soft_deleted",
      targetType : "product",
      targetId   : productId,
      metadata   : { title: rows[0].title },
      ipAddress  : ip,
    }).catch(() => {});

    console.log("[addproduct] ✓ soft-deleted  id:", productId);
    return res.json({ success: true });

  } catch (err) {
    console.error("[addproduct] DELETE ERROR:", err.message);
    return fail(res, 500, IS_PROD ? "Delete failed. Please try again." : err.message);
  }
});

export default router;