// ════════════════════════════════════════════════════════════════
// FILE: routes/addproduct.js — v13
//
// Changes from v12:
//  ─ Removed Cloudinary — replaced with Cloudflare R2
//  ─ Removed streamifier (no longer needed)
//  ─ uploadToCloudinary  → uploadToR2
//  ─ destroyCloudinaryAssets → destroyR2Assets
//  ─ publicId → key (R2 object key)
//  ─ product_images: cloudinary_public_id → r2_key
// ════════════════════════════════════════════════════════════════

import express   from "express";
import multer    from "multer";
import rateLimit from "express-rate-limit";
import crypto    from "crypto";
import path      from "path";

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

import { pool }         from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";
import {
  detectSpamListing,
  updateSellerTrust,
} from "../utils/listingUtils.js";
import { createNotification }   from "../services/notifications.js";
import { getCategoriesHandler } from "../controllers/category.controller.js";
import {
  generateBaseSlug,
  generateSlugWithId,
} from "../utils/slug.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   R2 CLIENT SETUP
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
// e.g. "https://images.loemart.com"

/**
 * Upload a single file buffer to R2.
 * Returns { url, key }
 */
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

  return {
    url : `${R2_PUBLIC_URL}/${key}`,
    key,
  };
};

/**
 * Delete multiple R2 objects by their keys.
 * Mirrors the old destroyCloudinaryAssets(publicIds).
 */
const destroyR2Assets = async (keys) => {
  if (!keys?.length) return;
  try {
    await r2.send(
      new DeleteObjectsCommand({
        Bucket : R2_BUCKET,
        Delete : {
          Objects : keys.map((k) => ({ Key: k })),
          Quiet   : true,
        },
      })
    );
    console.log(
      "[addproduct] ✓ orphan cleanup:",
      keys.length,
      "image(s) deleted from R2"
    );
  } catch (e) {
    console.error("[addproduct] R2 orphan cleanup failed:", e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   POLICY TABLE
═══════════════════════════════════════════════════════════════ */
const POLICY = Object.freeze({
  unverified: Object.freeze({
    dailyLimit       :   3,
    activeLimit      :   3,
    cooldownMinutes  :  10,
    expiryDays       :   7,
    canReactivate    : false,
    totalLifetimeMax :   3,
  }),
  verified: Object.freeze({
    dailyLimit       : 100,
    activeLimit      : 500,
    cooldownMinutes  :   0,
    expiryDays       :   0,
    canReactivate    : true,
    totalLifetimeMax : null,
  }),
});

const ALLOWED_STATUSES    = new Set(["active", "draft", "pending_payment"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGES          = 6;

const ALLOWED_WA_HOSTS = [
  "wa.me",
  "web.whatsapp.com",
  "api.whatsapp.com",
  "chat.whatsapp.com",
  "business.whatsapp.com",
];

const TRENDING_WINDOW_SECS = 24 * 60 * 60;
const TRENDING_TTL_SECS    = TRENDING_WINDOW_SECS + 3_600;
const TRENDING_KEY         = "trending:24h";

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
    redis.on("error", (e) =>
      console.warn("[addproduct] Redis error:", e.message)
    );
    await redis.connect();
    console.log("[addproduct] Redis connected");
  } catch (e) {
    console.warn("[addproduct] Redis unavailable:", e.message);
    redis = null;
  }
})();

const trackTrending = async (productId) => {
  if (!redis) return;
  try {
    const nowSecs  = Math.floor(Date.now() / 1_000);
    const cutoff   = nowSecs - TRENDING_WINDOW_SECS;
    const pipeline = redis.multi();
    pipeline.zAdd(TRENDING_KEY, { score: nowSecs, value: productId });
    pipeline.zRemRangeByScore(TRENDING_KEY, "-inf", cutoff);
    pipeline.expire(TRENDING_KEY, TRENDING_TTL_SECS);
    await pipeline.exec();
  } catch (e) {
    console.warn("[addproduct] trackTrending error:", e.message);
  }
};

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

const withImageUpload = (handler) => (req, res, next) =>
  handler(req, res, (err) => {
    if (!err) return next();
    if (
      ["LIMIT_FILE_SIZE", "LIMIT_FILE_COUNT", "INVALID_MIME"].includes(err.code)
    )
      return res.status(400).json({ success: false, message: err.message });
    return next(err);
  });

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60 * 1_000,
    max,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? req.ip),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, message }),
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
   PURE HELPERS
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

/* ── Date helpers ── */
const getTodayUTC = () => new Date().toISOString().slice(0, 10);

const getTomorrowUTC = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
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
    return `${label} must be 7–15 digits (e.g. 08012345678 or +2348012345678).`;
  return null;
};

const sanitizeWhatsAppLink = (raw) => {
  if (!raw) return null;
  try {
    const url = new URL(String(raw).trim());
    if (url.protocol !== "https:") return null;
    const allowed = ALLOWED_WA_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
    );
    return allowed ? url.href : null;
  } catch { return null; }
};

const validateImageHashes = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((h) => typeof h === "string" && /^[a-f0-9]{64}$/i.test(h))
    .slice(0, MAX_IMAGES);
};

/* ═══════════════════════════════════════════════════════════════
   CATEGORY VALIDATION
═══════════════════════════════════════════════════════════════ */
const validateCategoryEarly = async (categoryId, subcategoryId) => {
  const { rows: catRows } = await pool.query(
    "SELECT id FROM categories WHERE id = $1 AND is_active = TRUE",
    [categoryId]
  );
  if (!catRows.length)
    return {
      valid   : false,
      message : "Selected category does not exist or is inactive.",
    };

  if (subcategoryId) {
    const { rows: subRows } = await pool.query(
      `SELECT id FROM categories
       WHERE id = $1 AND parent_id = $2 AND is_active = TRUE`,
      [subcategoryId, categoryId]
    );
    if (!subRows.length)
      return {
        valid   : false,
        message : "Selected subcategory does not belong to the chosen category.",
      };
  }
  return { valid: true };
};

const validateCategoryRelationship = async (client, categoryId, subcategoryId) => {
  const { rows: catRows } = await client.query(
    "SELECT id FROM categories WHERE id = $1 AND is_active = TRUE",
    [categoryId]
  );
  if (!catRows.length)
    return {
      valid   : false,
      message : "Selected category does not exist or is inactive.",
    };

  if (subcategoryId) {
    const { rows: subRows } = await client.query(
      `SELECT id FROM categories
       WHERE id = $1 AND parent_id = $2 AND is_active = TRUE`,
      [subcategoryId, categoryId]
    );
    if (!subRows.length)
      return {
        valid   : false,
        message : "Selected subcategory does not belong to the chosen category.",
      };
  }
  return { valid: true };
};

/* ═══════════════════════════════════════════════════════════════
   SELLER CONTEXT
═══════════════════════════════════════════════════════════════ */
const fetchSellerStats = (client, sellerId) => {
  const today    = getTodayUTC();
  const tomorrow = getTomorrowUTC();

  return client.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE created_at >= $2::timestamptz
           AND created_at <  $3::timestamptz
           AND status     <> 'deleted'
       )::int                                                  AS today_count,

       COUNT(*) FILTER (
         WHERE is_active = TRUE
           AND status IN ('active', 'active_limited')
       )::int                                                  AS active_count,

       COUNT(*)::int                                           AS lifetime_count,

       MAX(created_at) FILTER (WHERE status <> 'deleted')      AS last_submit_at

     FROM products
     WHERE seller_id = $1`,
    [sellerId, today, tomorrow]
  );
};

const buildContext = (isVerified, stats) => {
  const policy        = isVerified ? POLICY.verified : POLICY.unverified;
  const todayCount    = stats.today_count;
  const activeCount   = stats.active_count;
  const lifetimeCount = stats.lifetime_count;
  const lastSubmitAt  = stats.last_submit_at;

  const trialExhausted =
    !isVerified &&
    policy.totalLifetimeMax !== null &&
    lifetimeCount >= policy.totalLifetimeMax;

  const trialRemaining =
    isVerified || policy.totalLifetimeMax === null
      ? null
      : Math.max(0, policy.totalLifetimeMax - lifetimeCount);

  let cooldownSecsLeft = 0;
  if (policy.cooldownMinutes > 0 && lastSubmitAt) {
    const elapsedMs  = Date.now() - new Date(lastSubmitAt).getTime();
    const limitMs    = policy.cooldownMinutes * 60 * 1_000;
    cooldownSecsLeft = Math.max(0, Math.ceil((limitMs - elapsedMs) / 1_000));
  }

  return {
    isVerified,
    policy,
    isFirstProduct : lifetimeCount === 0,
    todayCount,
    activeCount,
    lifetimeCount,
    trialExhausted,
    trialRemaining,
    cooldownSecsLeft,
  };
};

const getSellerContext = async (client, sellerId) => {
  const { rows: userRows } = await client.query(
    "SELECT identity_verified FROM public.users WHERE id = $1 FOR UPDATE",
    [sellerId]
  );
  if (!userRows.length) throw new Error("Seller account not found.");
  const isVerified      = Boolean(userRows[0].identity_verified);
  const { rows: stats } = await fetchSellerStats(client, sellerId);
  return buildContext(isVerified, stats[0]);
};

const getSellerContextReadOnly = async (client, sellerId) => {
  const { rows: userRows } = await client.query(
    "SELECT identity_verified FROM public.users WHERE id = $1",
    [sellerId]
  );
  if (!userRows.length) throw new Error("Seller account not found.");
  const isVerified      = Boolean(userRows[0].identity_verified);
  const { rows: stats } = await fetchSellerStats(client, sellerId);
  return buildContext(isVerified, stats[0]);
};

const getSellerContextPreUpload = async (sellerId) => {
  const { rows: userRows } = await pool.query(
    "SELECT identity_verified FROM public.users WHERE id = $1",
    [sellerId]
  );
  if (!userRows.length) throw new Error("Seller account not found.");
  const isVerified      = Boolean(userRows[0].identity_verified);
  const client          = { query: (...a) => pool.query(...a) };
  const { rows: stats } = await fetchSellerStats(client, sellerId);
  return buildContext(isVerified, stats[0]);
};

/* ═══════════════════════════════════════════════════════════════
   POLICY ENFORCEMENT
═══════════════════════════════════════════════════════════════ */
const enforcePolicyLimits = ({
  isVerified,
  policy,
  todayCount,
  activeCount,
  cooldownSecsLeft,
  trialExhausted,
  lifetimeCount,
  trialRemaining,
}) => {
  if (trialExhausted) {
    return {
      status  : 403,
      message :
        "You have used all 3 free trial listings. " +
        "Verify your identity to continue posting on Loemart.",
      extra: {
        trial_exhausted  : true,
        lifetime_used    : lifetimeCount,
        lifetime_max     : POLICY.unverified.totalLifetimeMax,
        upgrade_required : true,
        upgrade_message  :
          "Complete identity verification with a valid NIN, Passport, " +
          "or Driver's License to unlock unlimited posting.",
      },
    };
  }

  if (todayCount >= policy.dailyLimit) {
    const trialMsg = trialRemaining !== null
      ? ` You have ${trialRemaining} free trial listing(s) remaining in total.`
      : "";
    return {
      status  : 429,
      message : isVerified
        ? `Daily limit reached (${policy.dailyLimit} products/day). Try tomorrow.`
        : `You can post ${policy.dailyLimit} listings per day.${trialMsg}`,
      extra: {
        daily_limit     : policy.dailyLimit,
        daily_used      : todayCount,
        trial_remaining : trialRemaining,
        upgrade_message : isVerified
          ? null
          : "Verify your identity to post 100 products/day.",
      },
    };
  }

  if (activeCount >= policy.activeLimit) {
    return {
      status  : 429,
      message : isVerified
        ? `Active listing limit reached (${policy.activeLimit}).`
        : `You can have ${policy.activeLimit} active trial listings at once. ` +
          `Verify your identity to list up to ${POLICY.verified.activeLimit}.`,
      extra: {
        active_limit    : policy.activeLimit,
        active_count    : activeCount,
        upgrade_message : isVerified
          ? null
          : "Verify your identity to unlock 500 active listings.",
      },
    };
  }

  if (cooldownSecsLeft > 0) {
    const mins = Math.ceil(cooldownSecsLeft / 60);
    return {
      status  : 429,
      message : `Please wait ${mins} minute${mins !== 1 ? "s" : ""} before posting again.`,
      extra   : {
        retry_after_seconds : cooldownSecsLeft,
        upgrade_message     : "Verify your identity to remove posting cooldowns.",
      },
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
   IMAGE HASH DEDUP
═══════════════════════════════════════════════════════════════ */
const checkImageHashDuplicates = async (client, sellerId, hashes) => {
  if (!hashes?.length) return [];
  const { rows } = await client.query(
    `SELECT DISTINCT p.id, p.title
     FROM   product_image_hashes pih
     JOIN   products p ON p.id = pih.product_id
     WHERE  pih.image_hash = ANY($1::text[])
       AND  p.seller_id    = $2
       AND  p.status      <> 'deleted'
     LIMIT  3`,
    [hashes, sellerId]
  );
  return rows;
};

const storeImageHashes = async (productId, hashes) => {
  if (!hashes?.length) return;
  try {
    await pool.query(
      `INSERT INTO product_image_hashes (product_id, image_hash)
       SELECT $1, unnest($2::text[])
       ON CONFLICT DO NOTHING`,
      [productId, hashes]
    );
  } catch (err) {
    console.error("[addproduct] storeImageHashes error:", err.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   TRIAL INFO BUILDER
═══════════════════════════════════════════════════════════════ */
const buildTrialInfo = (ctx) => {
  if (ctx.isVerified) return null;
  const newRemaining = Math.max(0, (ctx.trialRemaining ?? 0) - 1);
  return {
    trial_remaining : newRemaining,
    lifetime_used   : ctx.lifetimeCount + 1,
    lifetime_max    : POLICY.unverified.totalLifetimeMax,
    trial_exhausted : newRemaining === 0,
  };
};

/* ═══════════════════════════════════════════════════════════════
   EXPORTED CRON UTILITIES
═══════════════════════════════════════════════════════════════ */
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
      console.log(
        `[addproduct] reactivated ${rowCount} listing(s) for seller ${sellerId}`
      );
      createNotification({
        userId  : sellerId,
        type    : "listings_reactivated",
        title   : "Listings Made Permanent",
        message :
          `${rowCount} listing${rowCount !== 1 ? "s" : ""} ` +
          "have been upgraded to permanent status now that your identity is verified.",
      }).catch(() => {});
      if (redis) {
        for (const r of rows) trackTrending(r.id).catch(() => {});
      }
    }
    return rowCount;
  } catch (err) {
    console.error("[addproduct] reactivateLimitedListings error:", err.message);
    return 0;
  } finally {
    client.release();
  }
};

export const pauseExpiredListings = async () => {
  const client = await pool.connect();
  try {
    const { rows, rowCount } = await client.query(
      `UPDATE products
       SET    status     = 'paused',
              is_active  = FALSE,
              updated_at = NOW()
       WHERE  status       = 'active_limited'
         AND  active_until IS NOT NULL
         AND  active_until < NOW()
         AND  seller_id IN (
           SELECT id FROM public.users WHERE identity_verified = FALSE
         )
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
            "Verify your identity to restore them permanently.",
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
      console.log(
        `[addproduct] cleanup: reverted ${rowCount} stuck listing(s)`
      );
      const productIds = rows.map((r) => r.id);
      if (productIds.length > 0) {
        await client.query(
          `UPDATE payments
           SET    status     = 'expired',
                  updated_at = NOW()
           WHERE  product_id = ANY($1::uuid[])
             AND  status     = 'pending'`,
          [productIds]
        );
      }
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
    console.error(
      "[addproduct] cleanupStuckPendingPayments error:",
      err.message
    );
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
═══════════════════════════════════════════════════════════════ */
router.get(
  "/categories/:id/price-guidance",
  readLimiter,
  async (req, res) => {
    const categoryId = req.params.id;
    if (!categoryId) return fail(res, 400, "Category ID required.");
    try {
      const { rows } = await pool.query(
        `SELECT
           COUNT(*)                                             AS total_listings,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)  AS median_price,
           MIN(price)                                           AS min_price,
           MAX(price)                                           AS max_price,
           AVG(price)                                           AS avg_price
         FROM products
         WHERE category_id = $1
           AND is_active   = TRUE
           AND status      IN ('active', 'active_limited')
           AND price       > 0`,
        [categoryId]
      );
      const stats = rows[0];
      if (!stats || parseInt(stats.total_listings, 10) < 3) {
        return res.json({
          success  : true,
          guidance : null,
          message  : "Not enough listings to show guidance.",
        });
      }
      return res.json({
        success  : true,
        guidance : {
          median_price   : Math.round(Number(stats.median_price)),
          min_price      : Math.round(Number(stats.min_price)),
          max_price      : Math.round(Number(stats.max_price)),
          avg_price      : Math.round(Number(stats.avg_price)),
          total_listings : parseInt(stats.total_listings, 10),
          currency       : "NGN",
          tip            :
            `Most sellers price between ₦${Math.round(Number(stats.min_price)).toLocaleString("en-NG")} and ` +
            `₦${Math.round(Number(stats.max_price)).toLocaleString("en-NG")}.`,
        },
      });
    } catch (err) {
      console.error("[addproduct] price-guidance error:", err.message);
      return fail(res, 500, "Server error.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /seller/limits
═══════════════════════════════════════════════════════════════ */
router.get(
  "/seller/limits",
  authenticate,
  readLimiter,
  async (req, res) => {
    const sellerId = req.user?.id;
    if (!sellerId) return fail(res, 401, "Not authenticated.");

    const client = await pool.connect();
    try {
      const ctx = await getSellerContextReadOnly(client, sellerId);
      return res.json({
        success          : true,
        seller_verified  : ctx.isVerified,
        daily_limit      : ctx.policy.dailyLimit,
        daily_used       : ctx.todayCount,
        daily_remaining  : Math.max(0, ctx.policy.dailyLimit - ctx.todayCount),
        active_limit     : ctx.policy.activeLimit,
        active_count     : ctx.activeCount,
        active_remaining : Math.max(0, ctx.policy.activeLimit - ctx.activeCount),
        cooldown_seconds : ctx.cooldownSecsLeft,
        expiry_days      : ctx.policy.expiryDays || null,
        can_reactivate   : ctx.policy.canReactivate,
        trial_exhausted  : ctx.trialExhausted,
        trial_remaining  : ctx.trialRemaining,
        lifetime_used    : ctx.lifetimeCount,
        lifetime_max     : ctx.isVerified
          ? null
          : POLICY.unverified.totalLifetimeMax,
      });
    } catch (err) {
      console.error("[addproduct] LIMITS ERROR:", err.message);
      return fail(res, 500, "Server error.");
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /products/check-duplicate
═══════════════════════════════════════════════════════════════ */
router.post(
  "/products/check-duplicate",
  authenticate,
  dupCheckLimiter,
  async (req, res) => {
    const sellerId     = req.user?.id;
    const { title }    = req.body;
    const image_hashes = validateImageHashes(req.body.image_hashes);
    if (!sellerId || !title) return res.json({ isDuplicate: false });

    const client = await pool.connect();
    try {
      const { rows: titleMatches } = await client.query(
        `SELECT id FROM products
         WHERE  seller_id  = $1
           AND  status     NOT IN ('deleted', 'draft')
           AND  created_at > NOW() - INTERVAL '7 days'
           AND  LOWER(TRIM(title)) = LOWER(TRIM($2))`,
        [sellerId, title]
      );
      if (titleMatches.length > 0) {
        return res.json({
          isDuplicate : true,
          message     :
            "You already have an active listing with this title. " +
            "Check your listings before reposting.",
        });
      }
      if (image_hashes.length > 0) {
        const hashMatches = await checkImageHashDuplicates(
          client,
          sellerId,
          image_hashes
        );
        if (hashMatches.length > 0) {
          return res.json({
            isDuplicate : true,
            message     :
              `One or more photos are already used in "${hashMatches[0].title}". ` +
              "Take new photos or check your existing listings.",
          });
        }
      }
      return res.json({ isDuplicate: false });
    } catch (err) {
      console.error("[check-duplicate]", err.message);
      return res.json({ isDuplicate: false });
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /products/:id/status
═══════════════════════════════════════════════════════════════ */
router.get(
  "/products/:id/status",
  authenticate,
  readLimiter,
  async (req, res) => {
    const sellerId  = req.user?.id;
    const productId = req.params.id;
    if (!sellerId) return fail(res, 401, "Not authenticated.");
    try {
      const { rows } = await pool.query(
        `SELECT p.id, p.status, p.is_active, p.active_until,
                p.is_first_product,
                u.identity_verified AS seller_verified
         FROM   products p
         JOIN   public.users u ON u.id = p.seller_id
         WHERE  p.id        = $1
           AND  p.seller_id = $2
           AND  p.status   <> 'deleted'`,
        [productId, sellerId]
      );
      if (!rows.length) return fail(res, 404, "Product not found.");
      const p           = rows[0];
      const isLimited   = p.status === "active_limited";
      const isExpired   =
        isLimited && p.active_until && new Date(p.active_until) < new Date();
      const daysRemaining =
        isLimited && p.active_until
          ? Math.max(
              0,
              Math.ceil(
                (new Date(p.active_until).getTime() - Date.now()) / 86_400_000
              )
            )
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
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /products — Create product
═══════════════════════════════════════════════════════════════ */
router.post(
  "/products",
  authenticate,
  createProductLimiter,
  withImageUpload(upload.array("images", MAX_IMAGES)),
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
    const idempotencyKey = cleanText(req.body.idempotency_key);
    const imageHashes    = validateImageHashes(
      safeParse(req.body.image_hashes, [])
    );
    const attributes  = safeParse(req.body.attributes, {});
    const delivery    = safeParse(req.body.delivery, {});
    const contact     = safeParse(req.body.contact, {});
    const whatsappLink = sanitizeWhatsAppLink(
      cleanText(req.body.whatsapp_link)
    );

    /* ── Basic validation ── */
    if (!title)             return fail(res, 400, "Title required.");
    if (title.length > 120) return fail(res, 400, "Title must be at most 120 characters.");
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
        const { rows: existing } = await pool.query(
          "SELECT * FROM products WHERE id = $1",
          [dup[0].id]
        );
        return res.status(200).json({ success: true, product: existing[0] });
      }
    }

    /* ── Spam check ── */
    const spamResult = await detectSpamListing({
      seller_id: sellerId, title, description, price,
    }).catch(() => ({ score: 0, isSpam: false, reasons: [] }));

    if (spamResult.isSpam || spamResult.score >= 70) {
      console.warn("[addproduct] spam detected  seller:", sellerId);
      return fail(res, 403, "Listing flagged as spam.", {
        reasons: spamResult.reasons ?? [],
      });
    }

    /* ── PHASE 1: Pre-upload policy check ── */
    if (requestedStatus === "active") {
      try {
        const preCtx   = await getSellerContextPreUpload(sellerId);
        const earlyErr = enforcePolicyLimits({ ...preCtx, activeCount: 0 });
        if (earlyErr) {
          console.log("[addproduct] pre-upload block:", earlyErr.message);
          return fail(res, earlyErr.status, earlyErr.message, earlyErr.extra);
        }
      } catch (preErr) {
        console.warn(
          "[addproduct] pre-upload check failed (non-fatal):",
          preErr.message
        );
      }
    }

    /* ── Early category validation ── */
    const earlyCategory = await validateCategoryEarly(
      categoryId,
      subcategoryId
    );
    if (!earlyCategory.valid) return fail(res, 400, earlyCategory.message);

    /* ── Upload images to R2 ── */
    console.log("[addproduct] uploading", files.length, "image(s) to R2...");
    let uploaded;
    try {
      uploaded = await Promise.all(
        files.map((file, i) =>
          uploadToR2(file.buffer, file.originalname, file.mimetype).then(
            (r) => ({
              url   : r.url,
              key   : r.key,   // ← R2 object key (replaces publicId)
              order : i,
            })
          )
        )
      );
    } catch (uploadErr) {
      console.error("[addproduct] R2 upload failed:", uploadErr.message);
      return fail(res, 500, "Image upload failed. Please try again.");
    }

    const thumbnail = uploaded[0]?.url ?? null;
    const r2Keys    = uploaded.map((u) => u.key);

    /* ── PHASE 2: Locked TX ── */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const ctx = await getSellerContext(client, sellerId);

      console.log("[addproduct] seller context:", {
        isVerified     : ctx.isVerified,
        todayCount     : ctx.todayCount,
        activeCount    : ctx.activeCount,
        lifetimeCount  : ctx.lifetimeCount,
        trialExhausted : ctx.trialExhausted,
        trialRemaining : ctx.trialRemaining,
      });

      const catCheck = await validateCategoryRelationship(
        client,
        categoryId,
        subcategoryId
      );
      if (!catCheck.valid) {
        await client.query("ROLLBACK");
        await destroyR2Assets(r2Keys);
        return fail(res, 400, catCheck.message);
      }

      if (requestedStatus === "active") {
        const policyErr = enforcePolicyLimits(ctx);
        if (policyErr) {
          await client.query("ROLLBACK");
          await destroyR2Assets(r2Keys);
          return fail(res, policyErr.status, policyErr.message, policyErr.extra);
        }
      }

      let finalStatus = requestedStatus;
      let finalActive = requestedStatus === "active";
      let activeUntil = null;

      if (requestedStatus === "active" && !ctx.isVerified) {
        finalStatus = "active_limited";
        finalActive = true;
        activeUntil = computeActiveUntil(false);
      }

      /* ── Slug generation ── */
      const baseSlug  = generateBaseSlug(title).slice(0, 60);
      const shortId   = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      const firstSlug = generateSlugWithId(title, shortId);

      let product;

      const insertProduct = async (slug) => {
        const { rows } = await client.query(
          `INSERT INTO products (
             title,            description,      price,
             seller_id,        category_id,      subcategory_id,
             thumbnail_url,    main_image,       slug,
             status,           is_active,        active_until,
             is_first_product, idempotency_key,
             location_state,   location_city,
             latitude,         longitude,
             seller_name,      phone,            whatsapp,
             whatsapp_link,    attributes,       delivery,
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
            title, description, price,
            sellerId, categoryId, subcategoryId ?? null,
            thumbnail, thumbnail, slug,
            finalStatus, finalActive, activeUntil ?? null,
            ctx.isFirstProduct, idempotencyKey ?? null,
            locationState, locationCity,
            latitude ?? null, longitude ?? null,
            sellerName, phone,
            whatsapp ?? null, whatsappLink,
            JSON.stringify(attributes),
            JSON.stringify(delivery),
            JSON.stringify(contact),
          ]
        );
        return rows[0];
      };

      try {
        product = await insertProduct(firstSlug);
      } catch (firstErr) {
        if (
          firstErr.code === "23505" &&
          firstErr.constraint?.includes("slug")
        ) {
          console.warn(
            "[addproduct] slug collision, falling back to timestamp"
          );
          product = await insertProduct(`${baseSlug}-${Date.now()}`);
        } else {
          throw firstErr;
        }
      }

      if (!product) {
        await client.query("ROLLBACK");
        await destroyR2Assets(r2Keys);
        return fail(
          res,
          500,
          "Failed to create product record. Please try again."
        );
      }

      /* ── Insert product_images — r2_key replaces cloudinary_public_id ── */
      await Promise.all(
        uploaded.map((img) =>
          client.query(
            `INSERT INTO product_images
               (product_id, image_url, r2_key, position_order, is_primary)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [product.id, img.url, img.key, img.order, img.order === 0]
          )
        )
      );

      await client.query("COMMIT");
      console.log(
        "[addproduct] ✓ created  id:",
        product.id,
        " status:",
        finalStatus
      );

      /* ── Post-commit ── */
      if (imageHashes.length > 0)
        storeImageHashes(product.id, imageHashes).catch(() => {});

      writeAudit({
        actorId    : sellerId,
        action     : "product_created",
        targetType : "product",
        targetId   : product.id,
        metadata   : {
          title,
          status         : finalStatus,
          active_until   : activeUntil,
          is_verified    : ctx.isVerified,
          lifetime_count : ctx.lifetimeCount + 1,
          trial_remaining : ctx.trialRemaining !== null
            ? Math.max(0, ctx.trialRemaining - 1)
            : null,
        },
        ipAddress : ip,
      }).catch(() => {});

      updateSellerTrust(sellerId).catch((e) =>
        console.warn("[addproduct] updateSellerTrust:", e.message)
      );
      trackTrending(product.id).catch(() => {});

      const needsVerification = finalStatus === "active_limited";
      const trialInfo         = buildTrialInfo(ctx);

      if (needsVerification) {
        const remaining = trialInfo?.trial_remaining ?? 0;
        createNotification({
          userId  : sellerId,
          type    : "listing_limited",
          title   : remaining === 0
            ? "Last Free Trial Listing Posted"
            : "Listing Posted — Trial Listing",
          message : remaining === 0
            ? `"${title}" is your last free trial listing. ` +
              "Verify your identity now to keep posting on Loemart."
            : `"${title}" is live for ${POLICY.unverified.expiryDays} days. ` +
              `You have ${remaining} free trial listing(s) remaining. ` +
              "Verify your identity for unlimited posting.",
        }).catch(() => {});
      }

      return res.status(201).json({
        success            : true,
        product,
        first_product      : ctx.isFirstProduct,
        needs_verification : needsVerification,
        active_until       : activeUntil ?? null,
        days_remaining     : needsVerification
          ? POLICY.unverified.expiryDays
          : null,
        seller_verified    : ctx.isVerified,
        trial              : trialInfo,
        limits             : {
          daily_limit  : ctx.policy.dailyLimit,
          daily_used   : ctx.todayCount + 1,
          daily_left   : Math.max(
            0,
            ctx.policy.dailyLimit - ctx.todayCount - 1
          ),
          active_limit : ctx.policy.activeLimit,
          active_count : ctx.activeCount + 1,
        },
        ...(needsVerification && {
          verification_message: trialInfo?.trial_exhausted
            ? "You have used all your free trial listings. " +
              "Verify your identity to continue posting on Loemart."
            : `Your listing is live for ${POLICY.unverified.expiryDays} days. ` +
              `You have ${trialInfo?.trial_remaining ?? 0} free trial listing(s) remaining. ` +
              "Verify your identity for unlimited posting.",
        }),
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      await destroyR2Assets(r2Keys);
      console.error("[addproduct] CREATE ERROR:", err.message, "\n", err.stack);
      if (err.code === "LIMIT_FILE_SIZE")
        return fail(res, 400, "Image too large — maximum 3 MB per image.");
      if (err.code === "23505")
        return fail(res, 409, "This product was already submitted recently.");
      return fail(
        res,
        500,
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
═══════════════════════════════════════════════════════════════ */
router.post(
  "/products/:id/activate",
  authenticate,
  activateLimiter,
  async (req, res) => {
    const sellerId  = req.user?.id;
    const productId = req.params.id;
    const ip        = getIp(req);

    console.log(
      "\n[addproduct] ▶ ACTIVATE  product:",
      productId,
      " seller:",
      sellerId
    );

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

      if (!productRows.length) {
        await client.query("ROLLBACK");
        return fail(res, 404, "Product not found.");
      }

      const product = productRows[0];

      if (product.seller_id !== sellerId) {
        await client.query("ROLLBACK");
        return fail(res, 403, "Not authorised.");
      }

      if (product.status === "active") {
        await client.query("ROLLBACK");
        return res.json({ success: true, message: "Already active." });
      }

      const { rows: userRows } = await client.query(
        "SELECT identity_verified FROM public.users WHERE id = $1 FOR UPDATE",
        [sellerId]
      );
      const isVerified = Boolean(userRows[0]?.identity_verified);

      if (
        product.status === "paused" &&
        !isVerified &&
        !POLICY.unverified.canReactivate
      ) {
        await client.query("ROLLBACK");
        return fail(
          res,
          403,
          "Expired listings cannot be reactivated for unverified sellers. " +
          "Complete identity verification to restore this listing.",
          { upgrade_required: true }
        );
      }

      const ctx       = await getSellerContext(client, sellerId);
      const policyErr = enforcePolicyLimits({ ...ctx, cooldownSecsLeft: 0 });
      if (policyErr) {
        await client.query("ROLLBACK");
        return fail(res, policyErr.status, policyErr.message, policyErr.extra);
      }

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

      trackTrending(productId).catch(() => {});

      const needsVerification = finalStatus === "active_limited";
      const daysRemaining     =
        needsVerification && activeUntil
          ? Math.max(
              0,
              Math.ceil(
                (new Date(activeUntil).getTime() - Date.now()) / 86_400_000
              )
            )
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
          verification_message:
            `Your listing is live for ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}. ` +
            "Complete identity verification to make it permanent.",
        }),
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[addproduct] ACTIVATE ERROR:", err.message);
      return fail(
        res,
        500,
        IS_PROD ? "Activation failed. Please try again." : err.message
      );
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   DELETE /products/:id — SOFT DELETE
═══════════════════════════════════════════════════════════════ */
router.delete("/products/:id", authenticate, async (req, res) => {
  const sellerId  = req.user?.id;
  const productId = req.params.id;
  const ip        = getIp(req);

  console.log(
    "[addproduct] ▶ SOFT DELETE  product:",
    productId,
    " seller:",
    sellerId
  );
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
      return fail(
        res,
        404,
        "Product not found, not owned by you, or cannot be deleted " +
        "in its current state. Fully active (verified) listings " +
        "cannot be deleted — pause them first."
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
    return fail(
      res,
      500,
      IS_PROD ? "Delete failed. Please try again." : err.message
    );
  }
});

export default router;