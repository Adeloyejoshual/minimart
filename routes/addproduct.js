/**
 * routes/addproduct.js
 *
 * Targets CockroachDB (serverless / dedicated).
 *
 * v8 — COMPLETE REWRITE
 * ─────────────────────────────────────────────────────────────
 *  - Email is NEVER stored in products table
 *  - Email lives only in users table (registration email)
 *  - 3-TIER SYSTEM:
 *      unverified  → 3 lifetime trial listings   (7-day expiry)
 *      verified    → 500 lifetime listings       (30-day expiry)
 *      subscriber  → Unlimited                   (90-day expiry)
 *  - PROMOTION FLOW:
 *      GET  /products/promotion-plans
 *      POST /products/:id/promote        (free + paid)
 *      GET  /products/promotion/callback (Paystack redirect)
 *      POST /products/promotion/webhook  (Paystack webhook)
 *      GET  /products/:id/promotion-status
 *  - CockroachDB compatible
 */

import express     from "express";
import multer      from "multer";
import rateLimit   from "express-rate-limit";
import crypto      from "crypto";
import path        from "path";
import fs          from "fs";
import sharp       from "sharp";
import pLimit      from "p-limit";
import axios       from "axios";
import * as Sentry from "@sentry/node";
import { fileURLToPath } from "url";

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
import { analyzeImageBatch } from "../utils/watermarkDetector.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router    = express.Router();
const IS_PROD   = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   SENTRY
═══════════════════════════════════════════════════════════════ */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn             : process.env.SENTRY_DSN,
    environment     : process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.2,
  });
  console.log("[addproduct] Sentry initialised");
} else {
  console.warn("[addproduct] SENTRY_DSN not set — error tracking disabled");
}

/* ═══════════════════════════════════════════════════════════════
   DEBUG LOGGER
═══════════════════════════════════════════════════════════════ */
const logError = (area, err, extra = {}) => {
  console.error("\n╔══════════════════════════════════════════════════╗");
  console.error(`║ [addproduct] ❌ ERROR in: ${area}`);
  console.error("╠══════════════════════════════════════════════════╣");
  console.error("║ Message   :", err.message);
  console.error("║ Code      :", err.code       ?? "none");
  console.error("║ Detail    :", err.detail     ?? "none");
  console.error("║ Constraint:", err.constraint ?? "none");
  console.error("║ Hint      :", err.hint       ?? "none");
  console.error("║ Where     :", err.where      ?? "none");
  if (Object.keys(extra).length) {
    console.error("║ Extra     :", JSON.stringify(extra, null, 2));
  }
  console.error(
    "║ Stack     :",
    err.stack?.split("\n")[1]?.trim() ?? "none"
  );
  console.error("╚══════════════════════════════════════════════════╝\n");
};

/* ═══════════════════════════════════════════════════════════════
   R2 CLIENT
═══════════════════════════════════════════════════════════════ */
const r2 = new S3Client({
  region     : process.env.R2_REGION ?? "auto",
  endpoint   : process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId    : process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET     = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

const uploadToR2 = async (buffer, mimetype) => {
  const key = `products/${Date.now()}-${crypto.randomUUID()}.webp`;
  await r2.send(
    new PutObjectCommand({
      Bucket      : R2_BUCKET,
      Key         : key,
      Body        : buffer,
      ContentType : mimetype,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return { url: `${R2_PUBLIC_URL}/${key}`, key };
};

const destroyR2Assets = async (keys) => {
  if (!keys?.length) return;
  try {
    await r2.send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET,
        Delete: {
          Objects: keys.map((k) => ({ Key: k })),
          Quiet  : true,
        },
      })
    );
    console.log(
      `[addproduct] R2 cleanup: ${keys.length} image(s) deleted`
    );
  } catch (e) {
    console.error("[addproduct] R2 cleanup failed:", e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const ALLOWED_STATUSES    = new Set(["active", "draft", "pending_payment"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGES          = 6;
const MAX_JSON_BYTES      = 8_192;
const SLUG_MAX            = 60;
const PRICE_MAX           = 1_000_000_000;
const TITLE_MAX           = 120;
const DESC_MIN            = 10;
const DESC_MAX            = 2_000;
const DELETE_HOLD_DAYS    = 30;
const PAYMENT_MAX_AGE_MS  = 30 * 60 * 1_000; // 30 minutes
const PROMO_DEFAULT_DAYS  = 7;
const ACCEPTED_CURRENCY   = "NGN";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const APP_URL         = process.env.APP_URL?.replace(/\/$/, "");
const FRONTEND_URL    = process.env.FRONTEND_URL?.replace(/\/$/, "");

const ALLOWED_WA_HOSTS = new Set([
  "wa.me",
  "web.whatsapp.com",
  "api.whatsapp.com",
  "chat.whatsapp.com",
  "business.whatsapp.com",
]);

/* ═══════════════════════════════════════════════════════════════
   POLICY TABLE — 3-TIER SYSTEM
═══════════════════════════════════════════════════════════════ */
const POLICY = Object.freeze({
  unverified: Object.freeze({
    dailyLimit      :   3,
    activeLimit     :   3,
    cooldownMinutes :  10,
    expiryDays      :   7,
    freeListingDays :   7,
    canReactivate   : false,
    totalLifetimeMax:   3,
  }),
  verified: Object.freeze({
    dailyLimit      :  50,
    activeLimit     : 500,
    cooldownMinutes :   0,
    expiryDays      :  30,
    freeListingDays :  30,
    canReactivate   : true,
    totalLifetimeMax: 500,
  }),
  subscriber: Object.freeze({
    dailyLimit      : 10_000,
    activeLimit     : 1_000_000,
    cooldownMinutes :   0,
    expiryDays      :   0,
    freeListingDays :  90,
    canReactivate   : true,
    totalLifetimeMax: null,
  }),
});

/* ═══════════════════════════════════════════════════════════════
   IMAGE CONFIG
═══════════════════════════════════════════════════════════════ */
const IMAGE_CONFIG = Object.freeze({
  maxInputBytes  : 5 * 1_048_576,
  maxOutputBytes : 500_000,
  maxDimension   : 1_200,
  minDimension   : 300,
  webpQualityInit: 82,
  webpQualityMin : 55,
  webpQualityStep: 8,
  watermark: Object.freeze({
    enabled      : true,
    logoPath     : path.join(__dirname, "../assets/watermark-logo.png"),
    text         : "Loemart.com",
    opacity      : 0.40,
    padding      : 20,
    logoMaxRatio : 0.25,
    fontSizeRatio: 0.045,
    shadowOpacity: 0.60,
  }),
});

const imageLimit = pLimit(2);

/* ═══════════════════════════════════════════════════════════════
   WATERMARK LOGO
═══════════════════════════════════════════════════════════════ */
let _watermarkLogo = null;
let _logoLoadTried = false;
let _usingLogoWm   = false;

const getWatermarkLogo = async () => {
  if (_logoLoadTried) return _watermarkLogo;
  _logoLoadTried = true;
  try {
    _watermarkLogo = await fs.promises.readFile(
      IMAGE_CONFIG.watermark.logoPath
    );
    _usingLogoWm = true;
    console.log("[watermark] Logo loaded from disk");
  } catch {
    console.warn("[watermark] Logo not found — using text watermark");
    _watermarkLogo = null;
    _usingLogoWm   = false;
  }
  return _watermarkLogo;
};

const buildTextWatermarkSvg = (imgW, imgH) => {
  const wm       = IMAGE_CONFIG.watermark;
  const fontSize = Math.max(14, Math.round(imgW * wm.fontSizeRatio));
  return Buffer.from(`
    <svg width="${imgW}" height="${imgH}"
         xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%"
                width="140%" height="140%">
          <feDropShadow dx="1" dy="1" stdDeviation="2"
            flood-color="black"
            flood-opacity="${wm.shadowOpacity}" />
        </filter>
      </defs>
      <text
        x="${imgW - wm.padding}" y="${imgH - wm.padding}"
        font-family="Arial, sans-serif"
        font-size="${fontSize}px" font-weight="bold"
        fill="white" fill-opacity="${wm.opacity}"
        text-anchor="end" dominant-baseline="auto"
        filter="url(#shadow)"
      >${wm.text}</text>
    </svg>
  `);
};

const buildLogoComposite = async (logoBuffer, imgW) => {
  const wm        = IMAGE_CONFIG.watermark;
  const logoWidth = Math.round(imgW * wm.logoMaxRatio);

  const resized = await sharp(logoBuffer)
    .resize({ width: logoWidth, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .webp({ quality: 90 })
    .toBuffer();

  const { data, info } = await sharp(resized)
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * wm.opacity);
  }

  const logoWithOpacity = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).webp({ quality: 90 }).toBuffer();

  return { input: logoWithOpacity, gravity: "southeast", blend: "over" };
};

/* ═══════════════════════════════════════════════════════════════
   COMPRESS + WATERMARK
═══════════════════════════════════════════════════════════════ */
const compressImage = async (buffer, mimetype) => {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "image", step: "metadata" },
    });
    throw new Error("Invalid or corrupt image file.");
  }

  if (!meta.width || !meta.height)
    throw new Error("Image has invalid dimensions.");

  if (
    meta.width  < IMAGE_CONFIG.minDimension ||
    meta.height < IMAGE_CONFIG.minDimension
  )
    throw new Error(
      `Image too small (${meta.width}×${meta.height}px). ` +
      `Minimum is ${IMAGE_CONFIG.minDimension}×` +
      `${IMAGE_CONFIG.minDimension}px.`
    );

  let resized;
  try {
    resized = await sharp(buffer)
      .rotate()
      .resize({
        width             : IMAGE_CONFIG.maxDimension,
        height            : IMAGE_CONFIG.maxDimension,
        fit               : "inside",
        withoutEnlargement: true,
      })
      .toBuffer();
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "image", step: "resize" },
    });
    throw new Error(
      "Failed to process image. Please try a different photo."
    );
  }

  let composite = null;
  if (IMAGE_CONFIG.watermark.enabled) {
    const { width: imgW, height: imgH } =
      await sharp(resized).metadata();
    const logoBuffer = await getWatermarkLogo();
    if (logoBuffer) {
      try {
        composite = await buildLogoComposite(logoBuffer, imgW);
      } catch (logoErr) {
        Sentry.captureException(logoErr, { tags: { area: "watermark" } });
        composite = {
          input: buildTextWatermarkSvg(imgW, imgH),
          top: 0, left: 0, blend: "over",
        };
      }
    } else {
      composite = {
        input: buildTextWatermarkSvg(imgW, imgH),
        top: 0, left: 0, blend: "over",
      };
    }
  }

  let quality     = IMAGE_CONFIG.webpQualityInit;
  let finalBuffer = null;

  while (quality >= IMAGE_CONFIG.webpQualityMin) {
    try {
      const pipeline = sharp(resized);
      if (composite) pipeline.composite([composite]);
      const candidate = await pipeline.webp({ quality }).toBuffer();
      finalBuffer = candidate;
      if (candidate.length <= IMAGE_CONFIG.maxOutputBytes) break;
      if (quality <= IMAGE_CONFIG.webpQualityMin) {
        console.warn(
          `[addproduct] quality floor hit at q${quality}`
        );
        break;
      }
      quality = Math.max(
        quality - IMAGE_CONFIG.webpQualityStep,
        IMAGE_CONFIG.webpQualityMin
      );
    } catch (err) {
      Sentry.captureException(err, {
        tags: { area: "image", step: "encode" },
      });
      throw new Error(
        "Failed to encode image. Please try a different photo."
      );
    }
  }

  console.log(
    `[addproduct] compress: ` +
    `${(buffer.length / 1_024).toFixed(0)} KB → ` +
    `${(finalBuffer.length / 1_024).toFixed(0)} KB @ q${quality}`
  );

  return { buffer: finalBuffer, mimetype: "image/webp" };
};

/* ═══════════════════════════════════════════════════════════════
   REDIS  (trending — non-critical)
═══════════════════════════════════════════════════════════════ */
const TRENDING_KEY        = "trending:24h";
const TRENDING_WINDOW_SEC = 86_400;
const TRENDING_TTL_SEC    = TRENDING_WINDOW_SEC + 3_600;

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
      console.warn("[addproduct] Redis:", e.message)
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
    const now    = Math.floor(Date.now() / 1_000);
    const cutoff = now - TRENDING_WINDOW_SEC;
    const pipe   = redis.multi();
    pipe.zAdd(TRENDING_KEY, {
      score: now, value: String(productId),
    });
    pipe.zRemRangeByScore(TRENDING_KEY, "-inf", cutoff);
    pipe.expire(TRENDING_KEY, TRENDING_TTL_SEC);
    await pipe.exec();
  } catch (e) {
    console.warn("[addproduct] trackTrending:", e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   MULTER
═══════════════════════════════════════════════════════════════ */
const upload = multer({
  storage   : multer.memoryStorage(),
  limits    : {
    fileSize: IMAGE_CONFIG.maxInputBytes,
    files   : MAX_IMAGES,
  },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      const err  = new Error(
        `Invalid image type "${file.mimetype}". ` +
        `Only JPEG, PNG, WebP allowed.`
      );
      err.code   = "INVALID_MIME";
      return cb(err);
    }
    cb(null, true);
  },
});

const withImageUpload = (handler) => (req, res, next) =>
  handler(req, res, (err) => {
    if (!err) return next();
    if (
      ["LIMIT_FILE_SIZE", "LIMIT_FILE_COUNT", "INVALID_MIME"]
        .includes(err.code)
    )
      return res
        .status(400)
        .json({ success: false, message: err.message });
    return next(err);
  });

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs       : windowMin * 60_000,
    max,
    standardHeaders: true,
    legacyHeaders  : false,
    keyGenerator   : (req) => String(req.user?.id ?? req.ip),
    handler        : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const createLimiter   = makeLimiter({
  windowMin: 60,
  max      : IS_PROD ? 20  : 500,
  message  : "Too many submissions. Please wait.",
});
const activateLimiter = makeLimiter({
  windowMin: 15,
  max      : IS_PROD ? 30  : 500,
  message  : "Too many activation requests.",
});
const readLimiter     = makeLimiter({
  windowMin: 5,
  max      : IS_PROD ? 120 : 1_000,
  message  : "Too many requests. Slow down.",
});
const dupLimiter      = makeLimiter({
  windowMin: 5,
  max      : IS_PROD ? 30  : 500,
  message  : "Too many duplicate checks.",
});
const editLimiter     = makeLimiter({
  windowMin: 30,
  max      : IS_PROD ? 60  : 500,
  message  : "Too many edit requests. Please wait.",
});
const promoteLimiter  = makeLimiter({
  windowMin: 10,
  max      : IS_PROD ? 15  : 200,
  message  : "Too many promotion requests.",
});

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════════════════════ */
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

const cleanText = (v) => {
  const s = String(v ?? "").trim();
  return s || null;
};
const cleanUuid = (v) => {
  const s = String(v ?? "").trim();
  return UUID_RE.test(s) ? s : null;
};
const cleanId = (v) => {
  const s = String(v ?? "").trim();
  if (!s || s === "null" || s === "undefined") return null;
  return s;
};
const toFinite = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fail = (res, status, message, extra = {}) => {
  console.log(`[addproduct] ↩ ${status}: ${message}`);
  return res.status(status).json({ success: false, message, ...extra });
};

const safeParse = (v, fallback) => {
  try { return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const safeParseGuarded = (v, fallback) => {
  if (v && String(v).length > MAX_JSON_BYTES) {
    console.warn("[addproduct] JSON field too large, ignoring");
    return fallback;
  }
  return safeParse(v, fallback);
};

const getTodayUTC    = () => new Date().toISOString().slice(0, 10);
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
    const allowed =
      ALLOWED_WA_HOSTS.has(url.hostname) ||
      [...ALLOWED_WA_HOSTS].some((h) =>
        url.hostname.endsWith(`.${h}`)
      );
    return allowed ? url.href : null;
  } catch { return null; }
};

const validateImageHashes = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (h) => typeof h === "string" && /^[a-f0-9]{64}$/i.test(h)
    )
    .slice(0, MAX_IMAGES);
};

const computeActiveUntil = (tier) => {
  const policy = POLICY[tier] ?? POLICY.unverified;
  if (tier === "subscriber" && policy.expiryDays === 0) return null;
  const days = policy.freeListingDays ?? policy.expiryDays;
  const d    = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const daysUntilExpiry = (activeUntil) => {
  if (!activeUntil) return null;
  return Math.ceil(
    (new Date(activeUntil).getTime() - Date.now()) / 86_400_000
  );
};

const makeReference = () =>
  `promo_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

const promotionExpiresAt = (durationDays) => {
  const d = new Date();
  d.setDate(d.getDate() + Number(durationDays || PROMO_DEFAULT_DAYS));
  return d;
};

/* ═══════════════════════════════════════════════════════════════
   PAYSTACK HELPERS
═══════════════════════════════════════════════════════════════ */
const paystackHeaders = () => ({
  Authorization : `Bearer ${PAYSTACK_SECRET}`,
  "Content-Type": "application/json",
});

const paystackInitialize = async ({
  email,
  amountNaira,
  reference,
  metadata,
  productId,
}) => {
  try {
    const callbackUrl =
      `${FRONTEND_URL}/payment/complete` +
      `?reference=${encodeURIComponent(reference)}` +
      `&product_id=${encodeURIComponent(productId ?? "")}` +
      `&source=promotion`;

    const { data: axiosData } = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount      : Math.round(amountNaira * 100),
        reference,
        currency    : ACCEPTED_CURRENCY,
        callback_url: callbackUrl,
        metadata,
      },
      { headers: paystackHeaders(), timeout: 15_000 }
    );

    return {
      ok              : !!axiosData?.status,
      authorizationUrl: axiosData?.data?.authorization_url ?? null,
      reference       : axiosData?.data?.reference ?? reference,
      message         : axiosData?.message ?? "Unknown error",
    };
  } catch (err) {
    console.error(
      "[addproduct] Paystack initialize error:", err.message
    );
    return {
      ok              : false,
      authorizationUrl: null,
      reference,
      message         : err.message,
    };
  }
};

const paystackVerify = async (reference) => {
  try {
    const { data: axiosData } = await axios.get(
      `https://api.paystack.co/transaction/verify/` +
      `${encodeURIComponent(reference)}`,
      { headers: paystackHeaders(), timeout: 15_000 }
    );
    return {
      ok        : !!axiosData?.status,
      status    : axiosData?.data?.status    ?? null,
      amountKobo: axiosData?.data?.amount    ?? 0,
      currency  : axiosData?.data?.currency  ?? null,
      message   : axiosData?.message         ?? "Unknown",
    };
  } catch (err) {
    console.error("[addproduct] Paystack verify error:", err.message);
    return {
      ok: false, status: null,
      amountKobo: 0, currency: null,
      message: err.message,
    };
  }
};

const verifyWebhookSignature = (rawBody, signature) => {
  if (
    typeof signature !== "string" ||
    signature.length !== 128      ||
    !/^[0-9a-f]+$/i.test(signature)
  ) return false;

  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash,      "hex"),
      Buffer.from(signature, "hex")
    );
  } catch { return false; }
};

const hashWebhookPayload = (rawBody) =>
  crypto.createHash("sha256").update(rawBody).digest("hex");

/* ═══════════════════════════════════════════════════════════════
   PROMOTION PLAN HELPERS
═══════════════════════════════════════════════════════════════ */
const loadPromotionPlan = async (planId) => {
  const { rows } = await pool.query(
    `SELECT
       id::text                                                    AS id,
       name,
       price::numeric                                              AS price,
       COALESCE(discount_percent, 0)::numeric                      AS discount_percent,
       COALESCE(duration_days, $2)::int                            AS duration_days,
       COALESCE(priority,      0)::int                             AS priority,
       description,
       ROUND(
         price::numeric * (1 - COALESCE(discount_percent,0)/100.0),
         2
       )                                                           AS effective_price
     FROM  promotion_plans
     WHERE id        = $1
       AND is_active = TRUE`,
    [planId, PROMO_DEFAULT_DAYS]
  );
  return rows[0] ?? null;
};

const isSellerVerified = async (sellerId) => {
  const { rows } = await pool.query(
    `SELECT identity_verified FROM public.users WHERE id = $1`,
    [sellerId]
  );
  return Boolean(rows[0]?.identity_verified);
};

/* ═══════════════════════════════════════════════════════════════
   ACTIVATE PRODUCT AFTER PROMOTION PAYMENT
   Works for both free and paid plans.
   Called inside an existing transaction.
═══════════════════════════════════════════════════════════════ */
const activateProductPromotion = async (client, {
  paymentId,
  productId,
  planId,
  sellerId,
  plan,
}) => {
  const verified    = await isSellerVerified(sellerId);
  const finalStatus = verified ? "active" : "active_limited";
  const expiresAt   = promotionExpiresAt(plan.duration_days);

  let activeUntil = null;
  if (!verified) {
    const d = new Date();
    d.setDate(d.getDate() + PROMO_DEFAULT_DAYS);
    activeUntil = d;
  }

  /* Mark payment success */
  await client.query(
    `UPDATE payments
     SET    status = 'success', updated_at = NOW()
     WHERE  id = $1`,
    [paymentId]
  );

  /* Activate + promote product */
  const { rowCount } = await client.query(
    `UPDATE products
     SET
       status               = $1,
       is_active            = TRUE,
       is_promoted          = TRUE,
       promotion_id         = $2,
       promotion_start      = NOW(),
       promotion_end        = $3,
       promotion_expires_at = $3,
       promotion_type       = $4,
       promotion_priority   = $5,
       boost_score          = COALESCE(boost_score, 0) + 50,
       active_until         = $6,
       updated_at           = NOW()
     WHERE id        = $7
       AND seller_id = $8`,
    [
      finalStatus,
      planId,
      expiresAt,
      plan.name,
      plan.priority,
      activeUntil,
      productId,
      sellerId,
    ]
  );

  if (!rowCount)
    throw new Error(
      "Could not activate product — ownership mismatch."
    );

  return {
    finalStatus,
    verified,
    activeUntil,
    expiresAt,
    planName: plan.name,
  };
};

/* Expire a stale pending promotion payment */
const expirePendingPromoPayment = async (paymentId, productId) => {
  await pool.query(
    `UPDATE payments
     SET    status = 'expired', updated_at = NOW()
     WHERE  id = $1`,
    [paymentId]
  );
  await pool.query(
    `UPDATE products
     SET    status = 'draft', updated_at = NOW()
     WHERE  id     = $1
       AND  status = 'pending_payment'`,
    [productId]
  );
  console.log("[addproduct] expired stale promo payment:", paymentId);
};

/* Log payment event — fire and forget */
const logPaymentEvent = async (paymentId, event, source, payload = {}) => {
  try {
    await pool.query(
      `INSERT INTO payment_events
         (payment_id, event, source, payload)
       VALUES ($1, $2, $3, $4)`,
      [paymentId, event, source, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error("[addproduct] logPaymentEvent:", err.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   CATEGORY VALIDATION
═══════════════════════════════════════════════════════════════ */
const validateCategory = async (db, categoryId, subcategoryId) => {
  try {
    const { rows: cat } = await db.query(
      `SELECT id FROM categories
       WHERE id = $1 AND is_active = TRUE`,
      [categoryId]
    );
    if (!cat.length)
      return {
        valid  : false,
        message: "Selected category does not exist or is inactive.",
      };

    if (subcategoryId) {
      const { rows: sub } = await db.query(
        `SELECT id FROM categories
         WHERE id = $1 AND parent_id = $2 AND is_active = TRUE`,
        [subcategoryId, categoryId]
      );
      if (!sub.length)
        return {
          valid  : false,
          message: "Subcategory does not belong to the chosen category.",
        };
    }
    return { valid: true };
  } catch (err) {
    logError("validateCategory", err, { categoryId, subcategoryId });
    return {
      valid  : false,
      message: `Category validation error: ${err.message}`,
    };
  }
};

/* ═══════════════════════════════════════════════════════════════
   SELLER STATS
═══════════════════════════════════════════════════════════════ */
const fetchSellerStats = (db, sellerId) => {
  const today    = getTodayUTC();
  const tomorrow = getTomorrowUTC();

  return db.query(
    `SELECT
       SUM(CASE
         WHEN created_at >= $2::timestamptz
          AND created_at <  $3::timestamptz
          AND status     <> 'deleted'
         THEN 1 ELSE 0
       END)::INT       AS today_count,

       SUM(CASE
         WHEN is_active = TRUE
          AND status IN ('active','active_limited')
         THEN 1 ELSE 0
       END)::INT       AS active_count,

       COUNT(*)::INT   AS lifetime_count,

       MAX(CASE
         WHEN status <> 'deleted' THEN created_at
         ELSE NULL
       END)            AS last_submit_at

     FROM products
     WHERE seller_id = $1`,
    [sellerId, today, tomorrow]
  );
};

/* ═══════════════════════════════════════════════════════════════
   BUILD CONTEXT
═══════════════════════════════════════════════════════════════ */
const buildContext = (tier, stats, extras = {}) => {
  const policy        = POLICY[tier] ?? POLICY.unverified;
  const todayCount    = Number(stats.today_count)    ?? 0;
  const activeCount   = Number(stats.active_count)   ?? 0;
  const lifetimeCount = Number(stats.lifetime_count) ?? 0;
  const lastSubmitAt  = stats.last_submit_at;

  const lifetimeExhausted =
    policy.totalLifetimeMax !== null &&
    lifetimeCount >= policy.totalLifetimeMax;

  const lifetimeRemaining =
    policy.totalLifetimeMax === null
      ? null
      : Math.max(0, policy.totalLifetimeMax - lifetimeCount);

  let cooldownSecsLeft = 0;
  if (policy.cooldownMinutes > 0 && lastSubmitAt) {
    const elapsedMs  = Date.now() - new Date(lastSubmitAt).getTime();
    const limitMs    = policy.cooldownMinutes * 60_000;
    cooldownSecsLeft = Math.max(
      0, Math.ceil((limitMs - elapsedMs) / 1_000)
    );
  }

  return {
    tier,
    isVerified           : tier === "verified" || tier === "subscriber",
    isSubscriber         : tier === "subscriber",
    policy,
    isFirstProduct       : lifetimeCount === 0,
    todayCount,
    activeCount,
    lifetimeCount,
    lifetimeExhausted,
    lifetimeRemaining,
    trialExhausted       : tier === "unverified" && lifetimeExhausted,
    trialRemaining       : tier === "unverified" ? lifetimeRemaining : null,
    cooldownSecsLeft,
    subscriptionPlan     : extras.subscriptionPlan      ?? null,
    subscriptionExpiresAt: extras.subscriptionExpiresAt ?? null,
    email                : extras.email ?? null,
  };
};

/* ═══════════════════════════════════════════════════════════════
   SELLER CONTEXT
   ✅ Fetches email from users table — NEVER from req.body
      Email NOT written to products table
═══════════════════════════════════════════════════════════════ */
const getSellerContext = async (db, sellerId, lock = false) => {
  const lockSql = lock ? "FOR UPDATE" : "";

  console.log(
    `[addproduct] getSellerContext — seller: ${sellerId} lock: ${lock}`
  );

  const { rows: users } = await db.query(
    `SELECT
       identity_verified,
       subscription_plan,
       subscription_status,
       subscription_expires_at,
       email
     FROM public.users
     WHERE id = $1
     ${lockSql}`,
    [sellerId]
  );

  if (!users.length) {
    throw new Error(`Seller account not found (id: ${sellerId}).`);
  }

  const u = users[0];

  if (!u.email) {
    throw new Error(
      `Account email missing for seller ${sellerId}. ` +
      `Please contact support.`
    );
  }

  const nowMs = Date.now();

  const hasActiveSubscription =
    u.subscription_status === "active"     &&
    u.subscription_plan                    &&
    u.subscription_plan !== "free"         &&
    u.subscription_expires_at              &&
    new Date(u.subscription_expires_at).getTime() > nowMs;

  const isVerified = Boolean(u.identity_verified);

  let tier;
  if      (hasActiveSubscription) tier = "subscriber";
  else if (isVerified)            tier = "verified";
  else                            tier = "unverified";

  console.log(`[addproduct] seller tier: ${tier}`);

  const { rows: stats } = await fetchSellerStats(db, sellerId);

  return buildContext(tier, stats[0], {
    subscriptionPlan     : u.subscription_plan,
    subscriptionExpiresAt: u.subscription_expires_at,
    email                : u.email,
  });
};

/* ═══════════════════════════════════════════════════════════════
   POLICY ENFORCEMENT
═══════════════════════════════════════════════════════════════ */
const enforcePolicyLimits = (ctx) => {
  const {
    tier, policy, todayCount, activeCount,
    cooldownSecsLeft, lifetimeExhausted,
    lifetimeCount, lifetimeRemaining,
  } = ctx;

  if (lifetimeExhausted) {
    if (tier === "unverified") return {
      status: 403,
      message:
        "You have used all 3 free trial listings. " +
        "Verify your identity to keep posting.",
      extra: {
        trial_exhausted   : true,
        lifetime_exhausted: true,
        lifetime_used     : lifetimeCount,
        lifetime_max      : POLICY.unverified.totalLifetimeMax,
        upgrade_required  : true,
        upgrade_to        : "verified",
        upgrade_url       : "/verification",
      },
    };
    if (tier === "verified") return {
      status: 403,
      message:
        "You have reached your 500-listing limit. " +
        "Subscribe for unlimited listings.",
      extra: {
        lifetime_exhausted: true,
        lifetime_used     : lifetimeCount,
        lifetime_max      : POLICY.verified.totalLifetimeMax,
        upgrade_required  : true,
        upgrade_to        : "subscriber",
        upgrade_url       : "/subscribe",
      },
    };
  }

  if (todayCount >= policy.dailyLimit) {
    const suffix =
      tier === "subscriber"
        ? "Try tomorrow."
        : tier === "verified"
        ? "Try tomorrow or subscribe for higher limits."
        : "Verify your identity to increase limits.";
    return {
      status: 429,
      message:
        `Daily posting limit reached (${policy.dailyLimit}/day). ${suffix}`,
      extra: {
        daily_limit       : policy.dailyLimit,
        daily_used        : todayCount,
        lifetime_remaining: lifetimeRemaining,
        ...(tier === "verified" && {
          upgrade_to : "subscriber",
          upgrade_url: "/subscribe",
        }),
        ...(tier === "unverified" && {
          upgrade_to : "verified",
          upgrade_url: "/verification",
        }),
      },
    };
  }

  if (activeCount >= policy.activeLimit) {
    return {
      status: 429,
      message:
        tier === "unverified"
          ? `You can have ${policy.activeLimit} active trial listings at a time.`
          : `Active listing limit reached (${policy.activeLimit}). ` +
            `Delete or pause some listings.`,
      extra: {
        active_limit: policy.activeLimit,
        active_count: activeCount,
      },
    };
  }

  if (cooldownSecsLeft > 0) {
    const mins = Math.ceil(cooldownSecsLeft / 60);
    return {
      status: 429,
      message:
        `Please wait ${mins} minute${mins !== 1 ? "s" : ""} ` +
        `before posting again.`,
      extra: { retry_after_seconds: cooldownSecsLeft },
    };
  }

  return null;
};

/* ═══════════════════════════════════════════════════════════════
   IMAGE HASH DEDUP
═══════════════════════════════════════════════════════════════ */
const checkImageHashDuplicates = async (db, sellerId, hashes) => {
  if (!hashes?.length) return [];
  const { rows } = await db.query(
    `SELECT DISTINCT p.id, p.title
     FROM   product_image_hashes pih
     JOIN   products p ON p.id = pih.product_id
     WHERE  pih.image_hash = ANY($1::STRING[])
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
    await Promise.all(
      hashes.map((hash) =>
        pool.query(
          `INSERT INTO product_image_hashes (product_id, image_hash)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [productId, hash]
        )
      )
    );
  } catch (err) {
    console.error("[addproduct] storeImageHashes:", err.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   TRIAL INFO
═══════════════════════════════════════════════════════════════ */
const buildTrialInfo = (ctx) => {
  if (ctx.tier === "subscriber") return null;
  const newRemaining = Math.max(0, (ctx.lifetimeRemaining ?? 0) - 1);
  return {
    tier              : ctx.tier,
    lifetime_used     : ctx.lifetimeCount + 1,
    lifetime_max      : ctx.policy.totalLifetimeMax,
    lifetime_remaining: newRemaining,
    lifetime_exhausted: newRemaining === 0,
    trial_remaining   : ctx.tier === "unverified" ? newRemaining : null,
    trial_exhausted   : ctx.tier === "unverified" && newRemaining === 0,
  };
};

/* ═══════════════════════════════════════════════════════════════
   INSERT PRODUCT
   ✅ NO email column — email lives in users table only
═══════════════════════════════════════════════════════════════ */
const runProductInsert = async (client, p) => {
  const { rows } = await client.query(
    `INSERT INTO products (
       title,            description,     price,
       seller_id,        category_id,     subcategory_id,
       thumbnail_url,    main_image,      slug,
       status,           is_active,       active_until,
       is_first_product, idempotency_key,
       location_state,   location_city,
       latitude,         longitude,
       seller_name,      phone,
       whatsapp,         whatsapp_link,
       attributes,       delivery,        contact
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,
       $7,$8,$9,$10,$11,$12,
       $13,$14,$15,$16,$17,$18,
       $19,$20,$21,$22,$23,$24,$25
     )
     RETURNING *`,
    [
      p.title,          p.description,    p.price,
      p.sellerId,       p.categoryId,     p.subcategoryId  ?? null,
      p.thumbnail,      p.thumbnail,      p.slug,
      p.finalStatus,    p.finalActive,    p.activeUntil    ?? null,
      p.isFirstProduct, p.idempotencyKey  ?? null,
      p.locationState,  p.locationCity,
      p.latitude        ?? null,          p.longitude      ?? null,
      p.sellerName,     p.phone,
      p.whatsapp        ?? null,          p.whatsappLink   ?? null,
      JSON.stringify(p.attributes),
      JSON.stringify(p.delivery),
      JSON.stringify(p.contact),
    ]
  );
  console.log(`[addproduct] ✅ inserted product id: ${rows[0]?.id}`);
  return rows[0];
};

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════════════════════════ */
const notifyListing = (
  sellerId, title, tier, finalStatus, activeUntil, trialInfo
) => {
  const needsVerification = finalStatus === "active_limited";
  const days              = daysUntilExpiry(activeUntil);

  if (needsVerification && tier === "unverified") {
    const remaining = trialInfo?.trial_remaining ?? 0;
    createNotification({
      userId : sellerId,
      type   : "listing_limited",
      title  : remaining === 0
        ? "Last Free Trial Listing Posted"
        : "Trial Listing Posted",
      message: remaining === 0
        ? `"${title}" is your last free trial listing. ` +
          `Verify your identity to keep posting.`
        : `"${title}" is live for ` +
          `${POLICY.unverified.expiryDays} days. ` +
          `${remaining} trial listing(s) remaining.`,
    }).catch(() => {});
    return;
  }

  if (tier === "verified" && trialInfo?.lifetime_remaining === 0) {
    createNotification({
      userId : sellerId,
      type   : "lifetime_limit_reached",
      title  : "You've Reached 500 Listings 🚀",
      message: "Subscribe for unlimited listings.",
    }).catch(() => {});
    return;
  }

  if (finalStatus === "active") {
    const durationText =
      tier === "subscriber" && !activeUntil
        ? "permanently"
        : `for ${days} days`;
    createNotification({
      userId : sellerId,
      type   : "listing_posted",
      title  : "Listing Posted ✓",
      message: `"${title}" is now live ${durationText}.`,
    }).catch(() => {});
  }
};

/* ═══════════════════════════════════════════════════════════════
   CRON UTILITIES  (exported for scheduler)
═══════════════════════════════════════════════════════════════ */
export const reactivateLimitedListings = async (sellerId) => {
  const client = await pool.connect();
  try {
    const { rows: userRows } = await client.query(
      `SELECT identity_verified, subscription_plan,
              subscription_status, subscription_expires_at
       FROM public.users WHERE id = $1`,
      [sellerId]
    );
    if (!userRows.length) return 0;

    const u = userRows[0];
    const hasActiveSub =
      u.subscription_status === "active" &&
      u.subscription_plan                &&
      u.subscription_plan !== "free"     &&
      u.subscription_expires_at          &&
      new Date(u.subscription_expires_at).getTime() > Date.now();

    const tier =
      hasActiveSub          ? "subscriber"
      : u.identity_verified ? "verified"
      :                       "unverified";

    const days =
      POLICY[tier].freeListingDays ?? POLICY[tier].expiryDays;

    const { rows, rowCount } = await client.query(
      `UPDATE products
       SET    status       = 'active',
              is_active    = TRUE,
              active_until = NOW() + make_interval(days => $2::INT),
              updated_at   = NOW()
       WHERE  seller_id    = $1
         AND  status       = 'active_limited'
         AND  (active_until IS NULL OR active_until > NOW())
       RETURNING id, title`,
      [sellerId, days]
    );

    if (rowCount > 0) {
      console.log(
        `[addproduct] reactivated ${rowCount} listing(s) ` +
        `for seller ${sellerId}`
      );
      createNotification({
        userId : sellerId,
        type   : "listings_reactivated",
        title  : "Listings Made Permanent 🎉",
        message:
          `${rowCount} listing${rowCount !== 1 ? "s" : ""} ` +
          `upgraded for ${days} days.`,
      }).catch(() => {});
      if (redis)
        rows.forEach((r) => trackTrending(r.id).catch(() => {}));
    }

    return rowCount;
  } catch (err) {
    logError("reactivateLimitedListings", err, { sellerId });
    Sentry.captureException(err, {
      tags: { area: "cron_reactivate" },
    });
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
           SELECT id FROM public.users
           WHERE  identity_verified = FALSE
         )
       RETURNING id, seller_id, title`
    );

    if (rowCount > 0) {
      console.log(
        `[addproduct] paused ${rowCount} expired trial listing(s)`
      );
      const bySeller = rows.reduce((acc, r) => {
        (acc[String(r.seller_id)] ??= []).push(r.title);
        return acc;
      }, {});
      for (const [sid, titles] of Object.entries(bySeller)) {
        createNotification({
          userId : sid,
          type   : "listings_paused",
          title  : "Listings Paused — Verification Required",
          message:
            `${titles.length} listing` +
            `${titles.length !== 1 ? "s" : ""} paused. ` +
            `Verify to restore.`,
        }).catch(() => {});
      }
    }

    return rows;
  } catch (err) {
    logError("pauseExpiredListings", err);
    Sentry.captureException(err, { tags: { area: "cron_pause" } });
    return [];
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   ─────────────────────────────────────────────────────────────
   ROUTES
   ─────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════ */

/* ── GET /categories ── */
router.get("/categories", getCategoriesHandler);

/* ── GET /categories/:id/price-guidance ── */
router.get(
  "/categories/:id/price-guidance",
  readLimiter,
  async (req, res) => {
    const { id } = req.params;
    if (!id) return fail(res, 400, "Category ID required.");

    try {
      const { rows: aggRows } = await pool.query(
        `SELECT
           COUNT(*)::INT AS total,
           MIN(price)    AS min,
           MAX(price)    AS max,
           AVG(price)    AS avg
         FROM products
         WHERE category_id = $1
           AND is_active   = TRUE
           AND status      IN ('active','active_limited')
           AND price       > 0`,
        [id]
      );

      const agg   = aggRows[0];
      const total = Number(agg?.total ?? 0);

      if (total < 3)
        return res.json({
          success : true,
          guidance: null,
          message : "Not enough listings for price guidance.",
        });

      const { rows: medRows } = await pool.query(
        `SELECT price FROM products
         WHERE  category_id = $1
           AND  is_active   = TRUE
           AND  status      IN ('active','active_limited')
           AND  price       > 0
         ORDER  BY price
         LIMIT  1
         OFFSET $2`,
        [id, Math.floor(total / 2)]
      );

      const medianPrice =
        Number(medRows[0]?.price ?? agg.avg);

      return res.json({
        success : true,
        guidance: {
          median_price  : Math.round(medianPrice),
          min_price     : Math.round(Number(agg.min)),
          max_price     : Math.round(Number(agg.max)),
          avg_price     : Math.round(Number(agg.avg)),
          total_listings: total,
          currency      : "NGN",
          tip           :
            `Most sellers price between ` +
            `₦${Math.round(Number(agg.min))
                .toLocaleString("en-NG")} and ` +
            `₦${Math.round(Number(agg.max))
                .toLocaleString("en-NG")}.`,
        },
      });
    } catch (err) {
      logError("price-guidance", err, { categoryId: id });
      return fail(res, 500, `Price guidance error: ${err.message}`);
    }
  }
);

/* ── GET /seller/limits ── */
router.get(
  "/seller/limits",
  authenticate,
  readLimiter,
  async (req, res) => {
    const sellerId = req.user?.id;
    if (!sellerId) return fail(res, 401, "Not authenticated.");

    const client = await pool.connect();
    try {
      const ctx = await getSellerContext(client, sellerId);

      return res.json({
        success             : true,
        tier                : ctx.tier,
        seller_verified     : ctx.isVerified,
        is_subscriber       : ctx.isSubscriber,
        subscription_plan   : ctx.subscriptionPlan,
        subscription_expires: ctx.subscriptionExpiresAt,
        daily_limit         : ctx.policy.dailyLimit,
        daily_used          : ctx.todayCount,
        daily_remaining     : Math.max(
          0, ctx.policy.dailyLimit - ctx.todayCount
        ),
        active_limit        : ctx.policy.activeLimit,
        active_count        : ctx.activeCount,
        active_remaining    : Math.max(
          0, ctx.policy.activeLimit - ctx.activeCount
        ),
        cooldown_seconds    : ctx.cooldownSecsLeft,
        expiry_days         : ctx.policy.freeListingDays ??
                              ctx.policy.expiryDays,
        can_reactivate      : ctx.policy.canReactivate,
        lifetime_used       : ctx.lifetimeCount,
        lifetime_max        : ctx.policy.totalLifetimeMax,
        lifetime_remaining  : ctx.lifetimeRemaining,
        lifetime_exhausted  : ctx.lifetimeExhausted,
        trial_exhausted     : ctx.trialExhausted,
        trial_remaining     : ctx.trialRemaining,
        can_upgrade         : ctx.tier !== "subscriber",
        upgrade_to          : ctx.tier === "unverified" ? "verified"
                            : ctx.tier === "verified"   ? "subscriber"
                            : null,
        upgrade_url         : ctx.tier === "unverified" ? "/verification"
                            : ctx.tier === "verified"   ? "/subscribe"
                            : null,
      });
    } catch (err) {
      logError("GET /seller/limits", err, { sellerId });
      return fail(res, 500, `Limits error: ${err.message}`);
    } finally {
      client.release();
    }
  }
);

/* ── POST /products/check-duplicate ── */
router.post(
  "/products/check-duplicate",
  authenticate,
  dupLimiter,
  async (req, res) => {
    const sellerId    = req.user?.id;
    const { title }   = req.body;
    const imageHashes = validateImageHashes(req.body.image_hashes);

    if (!sellerId || !title)
      return res.json({ isDuplicate: false });

    const client = await pool.connect();
    try {
      const { rows: titleMatch } = await client.query(
        `SELECT id FROM products
         WHERE  seller_id   = $1
           AND  status      NOT IN ('deleted','draft')
           AND  created_at  > NOW() - INTERVAL '7 days'
           AND  LOWER(TRIM(title)) = LOWER(TRIM($2))
         LIMIT 1`,
        [sellerId, title]
      );

      if (titleMatch.length)
        return res.json({
          isDuplicate: true,
          message    : "You already have a listing with this title.",
        });

      if (imageHashes.length) {
        const hashMatch = await checkImageHashDuplicates(
          client, sellerId, imageHashes
        );
        if (hashMatch.length)
          return res.json({
            isDuplicate: true,
            message    :
              `Photos already used in "${hashMatch[0].title}".`,
          });
      }

      return res.json({ isDuplicate: false });
    } catch (err) {
      logError("check-duplicate", err, { sellerId });
      return res.json({ isDuplicate: false });
    } finally {
      client.release();
    }
  }
);

/* ── GET /products/:id/status ── */
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
                p.is_promoted, p.promotion_end,
                p.promotion_type,
                u.identity_verified AS seller_verified
         FROM   products p
         JOIN   public.users u ON u.id = p.seller_id
         WHERE  p.id        = $1
           AND  p.seller_id = $2
           AND  p.status   <> 'deleted'`,
        [productId, sellerId]
      );

      if (!rows.length) return fail(res, 404, "Product not found.");

      const p       = rows[0];
      const expired =
        p.active_until &&
        new Date(p.active_until) < new Date();

      const promotionActive =
        p.is_promoted &&
        p.promotion_end &&
        new Date(p.promotion_end) > new Date();

      return res.json({
        success            : true,
        status             : p.status,
        is_active          : p.is_active,
        active_until       : p.active_until,
        is_first_product   : p.is_first_product,
        seller_verified    : p.seller_verified,
        needs_verification : p.status === "active_limited" && !expired,
        is_expired         : !!expired,
        days_remaining     : daysUntilExpiry(p.active_until),
        is_promoted        : !!p.is_promoted,
        promotion_active   : !!promotionActive,
        promotion_end      : p.promotion_end ?? null,
        promotion_type     : p.promotion_type ?? null,
      });
    } catch (err) {
      logError("GET /products/:id/status", err, {
        productId, sellerId,
      });
      return fail(res, 500, `Status error: ${err.message}`);
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /products  — Create listing
   ✅ No email in products table
═══════════════════════════════════════════════════════════════ */
router.post(
  "/products",
  authenticate,
  createLimiter,
  withImageUpload(upload.array("images", MAX_IMAGES)),
  async (req, res) => {
    const sellerId = req.user?.id;
    const ip       = getIp(req);

    console.log("\n[addproduct] ▶ CREATE  seller:", sellerId);
    if (!sellerId) return fail(res, 401, "Not authenticated.");

    /* ── Parse body ── */
    const title          = cleanText(req.body.title);
    const description    = cleanText(req.body.description);
    const price          = Number(req.body.price);
    const categoryId     = cleanUuid(req.body.category_id);
    const subcategoryId  = cleanUuid(req.body.subcategory_id);
    const locationState  = cleanText(req.body.location_state);
    const locationCity   = cleanText(req.body.location_city);
    const latitude       = toFinite(req.body.latitude);
    const longitude      = toFinite(req.body.longitude);
    const sellerName     = cleanText(req.body.seller_name);
    const phone          = cleanText(req.body.phone);
    const whatsapp       = cleanText(req.body.whatsapp);
    const idempotencyKey = cleanText(req.body.idempotency_key);
    const whatsappLink   = sanitizeWhatsAppLink(
      cleanText(req.body.whatsapp_link)
    );
    const imageHashes    = validateImageHashes(
      safeParse(req.body.image_hashes, [])
    );
    const attributes     = safeParseGuarded(req.body.attributes, {});
    const delivery       = safeParseGuarded(req.body.delivery,   {});
    const contact        = safeParseGuarded(req.body.contact,    {});
    const files          = req.files ?? [];

    const rawStatus       = cleanText(req.body.status) ?? "draft";
    const requestedStatus =
      ALLOWED_STATUSES.has(rawStatus) ? rawStatus : "draft";

    /* ── Validate ── */
    if (!title)
      return fail(res, 400, "Title is required.");
    if (title.length > TITLE_MAX)
      return fail(res, 400,
        `Title must be ≤ ${TITLE_MAX} characters.`);
    if (!description || description.length < DESC_MIN)
      return fail(res, 400,
        `Description must be at least ${DESC_MIN} characters.`);
    if (description.length > DESC_MAX)
      return fail(res, 400,
        `Description must be ≤ ${DESC_MAX} characters.`);
    if (!price || price <= 0 || !Number.isFinite(price))
      return fail(res, 400,
        `Enter a valid price. Received: "${req.body.price}"`);
    if (price > PRICE_MAX)
      return fail(res, 400, "Price exceeds maximum.");
    if (!categoryId)
      return fail(res, 400,
        `Category is required. Received: "${req.body.category_id}"`);
    if (!locationState || !locationCity)
      return fail(res, 400,
        `State and city required. Got: ` +
        `state="${locationState}" city="${locationCity}"`);

    const phoneErr = validatePhone(phone, "Phone number");
    if (phoneErr) return fail(res, 400, phoneErr);

    if (whatsapp) {
      const waErr = validatePhone(whatsapp, "WhatsApp number");
      if (waErr) return fail(res, 400, waErr);
    }

    if (!files.length)
      return fail(res, 400, "At least one image is required.");

    /* ── Idempotency ── */
    if (idempotencyKey) {
      try {
        const { rows: dup } = await pool.query(
          `SELECT id FROM products
           WHERE  seller_id       = $1
             AND  idempotency_key = $2
             AND  status         <> 'deleted'
           LIMIT  1`,
          [sellerId, idempotencyKey]
        );
        if (dup.length) {
          console.log(
            "[addproduct] idempotent hit →", dup[0].id
          );
          const { rows: existing } = await pool.query(
            "SELECT * FROM products WHERE id = $1",
            [dup[0].id]
          );
          return res
            .status(200)
            .json({ success: true, product: existing[0] });
        }
      } catch (idempErr) {
        console.warn(
          "[addproduct] idempotency check failed:",
          idempErr.message
        );
      }
    }

    /* ── Spam check ── */
    const spam = await detectSpamListing({
      seller_id: sellerId, title, description, price,
    }).catch(() => ({ score: 0, isSpam: false, reasons: [] }));

    if (spam.isSpam || spam.score >= 70) {
      console.warn("[addproduct] spam detected:", sellerId);
      return fail(res, 403, "Listing flagged as spam.", {
        reasons: spam.reasons ?? [],
      });
    }

    /* ── Phase 1: Pre-upload policy check ── */
    if (requestedStatus === "active") {
      try {
        const preCtx = await getSellerContext(pool, sellerId);
        const preErr = enforcePolicyLimits(preCtx);
        if (preErr) {
          console.log(
            "[addproduct] pre-upload policy block:", preErr.message
          );
          return fail(
            res, preErr.status, preErr.message, preErr.extra ?? {}
          );
        }
      } catch (preErr) {
        logError("pre-upload policy check", preErr, { sellerId });
      }
    }

    /* ── Early category validation ── */
    const catEarly = await validateCategory(
      pool, categoryId, subcategoryId
    );
    if (!catEarly.valid)
      return fail(res, 400, catEarly.message);

    /* ── Watermark analysis ── */
    let wmAnalysis = null;
    try {
      wmAnalysis = await analyzeImageBatch(
        files.map((f) => f.buffer)
      );
      console.log(
        "[addproduct] watermark scan:",
        `${wmAnalysis.summary.clean} clean,`,
        `${wmAnalysis.summary.blocked} blocked`
      );

      if (wmAnalysis.overallVerdict === "block") {
        const first = wmAnalysis.results.find(
          (r) => r.verdict === "block"
        );
        console.warn("[addproduct] watermark block:", sellerId);
        return fail(
          res, 400,
          first?.message ?? "One or more images were rejected.",
          {
            blocked_images: wmAnalysis.blockedImages,
            reason        : first?.reason ?? "watermark_policy",
          }
        );
      }
    } catch (wmErr) {
      console.warn(
        "[addproduct] watermark analysis error:", wmErr.message
      );
      Sentry.captureException(wmErr, {
        tags: { area: "watermark", seller_id: sellerId },
      });
      wmAnalysis = null;
    }

    /* ── Compress + Upload images ── */
    console.log(
      `[addproduct] processing ${files.length} image(s)...`
    );
    let uploaded;
    try {
      uploaded = await Promise.all(
        files.map((file, i) =>
          imageLimit(async () => {
            const { buffer, mimetype } = await compressImage(
              file.buffer, file.mimetype
            );
            const { url, key } = await uploadToR2(
              buffer, mimetype
            );
            console.log(
              `[addproduct] image ${i + 1}/${files.length} → ${key}`
            );
            return { url, key, order: i };
          })
        )
      );
    } catch (uploadErr) {
      logError("compress/upload", uploadErr, { sellerId });
      const isUserError =
        uploadErr.message.includes("too small") ||
        uploadErr.message.includes("Invalid")   ||
        uploadErr.message.includes("corrupt");
      if (!isUserError)
        Sentry.captureException(uploadErr, {
          tags: { area: "image_upload", seller_id: sellerId },
        });
      return fail(
        res,
        isUserError ? 400 : 500,
        isUserError
          ? uploadErr.message
          : `Image upload failed: ${uploadErr.message}`
      );
    }

    const thumbnail = uploaded[0]?.url ?? null;
    const r2Keys    = uploaded.map((u) => u.key);

    /* ── Phase 2: Transaction ── */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      console.log("[addproduct] transaction started");

      const ctx = await getSellerContext(client, sellerId, true);

      const catCheck = await validateCategory(
        client, categoryId, subcategoryId
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
          return fail(
            res,
            policyErr.status,
            policyErr.message,
            policyErr.extra ?? {}
          );
        }
      }

      /* Final status + expiry */
      let finalStatus = requestedStatus;
      let finalActive = requestedStatus === "active";
      let activeUntil = null;

      if (requestedStatus === "active") {
        finalStatus =
          ctx.tier === "unverified" ? "active_limited" : "active";
        finalActive = true;
        activeUntil = computeActiveUntil(ctx.tier);
      }

      console.log(
        "[addproduct] final status:", finalStatus,
        "expires:", activeUntil
      );

      /* Slug */
      const baseSlug  = generateBaseSlug(title).slice(0, SLUG_MAX);
      const shortId   = crypto
        .randomUUID()
        .replace(/-/g, "")
        .slice(0, 8);
      const firstSlug = generateSlugWithId(title, shortId);

      const insertParams = {
        title, description, price,
        sellerId, categoryId, subcategoryId,
        thumbnail, finalStatus, finalActive, activeUntil,
        isFirstProduct: ctx.isFirstProduct,
        idempotencyKey,
        locationState, locationCity, latitude, longitude,
        sellerName, phone, whatsapp, whatsappLink,
        attributes, delivery, contact,
      };

      let product;

      /* First insert attempt */
      try {
        product = await runProductInsert(client, {
          ...insertParams, slug: firstSlug,
        });
      } catch (firstErr) {
        logError("runProductInsert (first)", firstErr, {
          sellerId, slug: firstSlug,
        });

        const isSlugCollision =
          firstErr.code === "23505" &&
          (firstErr.constraint?.includes("slug") ||
           firstErr.detail?.includes("slug"));

        const isIdempotencyCollision =
          firstErr.code === "23505" &&
          (firstErr.constraint?.includes("idempotency") ||
           firstErr.detail?.includes("idempotency"));

        if (isIdempotencyCollision) {
          await client.query("ROLLBACK");
          const { rows: existing } = await pool.query(
            `SELECT * FROM products
             WHERE seller_id       = $1
               AND idempotency_key = $2
               AND status         <> 'deleted'
             LIMIT 1`,
            [sellerId, idempotencyKey]
          );
          if (existing.length)
            return res
              .status(200)
              .json({ success: true, product: existing[0] });
          return fail(res, 409, "Duplicate submission detected.");
        }

        if (isSlugCollision) {
          console.warn("[addproduct] slug collision — retrying");
          await client.query("ROLLBACK");
          await client.query("BEGIN");

          const ctx2      = await getSellerContext(
            client, sellerId, true
          );
          const retrySlug =
            `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;

          try {
            product = await runProductInsert(client, {
              ...insertParams,
              slug          : retrySlug,
              isFirstProduct: ctx2.isFirstProduct,
            });
          } catch (retryErr) {
            logError("runProductInsert (retry)", retryErr, {
              sellerId, retrySlug,
            });
            await client.query("ROLLBACK");
            await destroyR2Assets(r2Keys);
            Sentry.captureException(retryErr, {
              tags: {
                area     : "product_insert_retry",
                seller_id: sellerId,
              },
            });
            return fail(
              res, 500,
              `Product insert retry failed: ${retryErr.message}`,
              {
                debug: {
                  code      : retryErr.code       ?? null,
                  detail    : retryErr.detail     ?? null,
                  constraint: retryErr.constraint ?? null,
                },
              }
            );
          }
        } else {
          await client.query("ROLLBACK");
          await destroyR2Assets(r2Keys);
          throw firstErr;
        }
      }

      if (!product) {
        await client.query("ROLLBACK");
        await destroyR2Assets(r2Keys);
        return fail(res, 500, "Product insert returned no rows.");
      }

      console.log(
        "[addproduct] product row created → id:", product.id
      );

      /* Insert product_images */
      try {
        await Promise.all(
          uploaded.map((img) =>
            client.query(
              `INSERT INTO product_images
                 (product_id, image_url, r2_key,
                  position_order, is_primary)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT DO NOTHING`,
              [
                product.id, img.url, img.key,
                img.order, img.order === 0,
              ]
            )
          )
        );
        console.log(
          `[addproduct] ${uploaded.length} image row(s) inserted`
        );
      } catch (imgInsertErr) {
        logError("product_images insert", imgInsertErr, {
          productId: product.id,
        });
        /* Non-fatal */
      }

      /* Update images JSONB */
      const imagesJson = JSON.stringify(
        uploaded.map((img) => ({
          url: img.url, key: img.key, order: img.order,
        }))
      );
      await client.query(
        "UPDATE products SET images = $1 WHERE id = $2",
        [imagesJson, product.id]
      );
      product.images = JSON.parse(imagesJson);

      await client.query("COMMIT");
      console.log("[addproduct] ✅ transaction committed");

      /* Post-commit side effects */
      const trialInfo = buildTrialInfo(ctx);

      setImmediate(() => {
        if (imageHashes.length)
          storeImageHashes(product.id, imageHashes).catch(() => {});

        writeAudit({
          actorId   : sellerId,
          action    : "product_created",
          targetType: "product",
          targetId  : product.id,
          metadata  : {
            title,
            status        : finalStatus,
            tier          : ctx.tier,
            email         : ctx.email,
            active_until  : activeUntil,
            is_verified   : ctx.isVerified,
            is_subscriber : ctx.isSubscriber,
            lifetime_count: ctx.lifetimeCount + 1,
          },
          ipAddress: ip,
        }).catch(() => {});

        updateSellerTrust(sellerId).catch((e) =>
          console.warn("[addproduct] updateSellerTrust:", e.message)
        );

        trackTrending(product.id).catch(() => {});

        notifyListing(
          sellerId, title, ctx.tier,
          finalStatus, activeUntil, trialInfo
        );
      });

      /* Response */
      const expiryDays        = daysUntilExpiry(activeUntil);
      const needsVerification = finalStatus === "active_limited";
      const hasWmWarnings     =
        wmAnalysis?.overallVerdict === "warn" &&
        wmAnalysis.warnings?.length > 0;

      return res.status(201).json({
        success            : true,
        product,
        tier               : ctx.tier,
        first_product      : ctx.isFirstProduct,
        needs_verification : needsVerification,
        active_until       : activeUntil ?? null,
        days_remaining     : expiryDays,
        seller_verified    : ctx.isVerified,
        is_subscriber      : ctx.isSubscriber,
        trial              : trialInfo,
        limits: {
          daily_limit       : ctx.policy.dailyLimit,
          daily_used        : ctx.todayCount + 1,
          daily_left        : Math.max(
            0, ctx.policy.dailyLimit - ctx.todayCount - 1
          ),
          active_limit      : ctx.policy.activeLimit,
          active_count      : ctx.activeCount + 1,
          lifetime_used     : ctx.lifetimeCount + 1,
          lifetime_max      : ctx.policy.totalLifetimeMax,
          lifetime_remaining: trialInfo?.lifetime_remaining ?? null,
        },
        ...(activeUntil && {
          expiry_message: needsVerification
            ? `Your listing is live for ${expiryDays} days (trial). ` +
              `Verify to post permanently.`
            : `Your listing is live for ${expiryDays} days.`,
        }),
        ...(!activeUntil && ctx.isSubscriber && {
          expiry_message: "Your listing is live permanently.",
        }),
        ...(needsVerification && {
          verification_message: trialInfo?.trial_exhausted
            ? "You have used all free trial listings. " +
              "Verify to keep posting."
            : `${trialInfo?.trial_remaining ?? 0} free trial ` +
              `listing(s) remaining.`,
        }),
        ...(ctx.tier === "verified" &&
          trialInfo?.lifetime_remaining === 0 && {
            upgrade_message:
              "You've reached your 500-listing limit. " +
              "Subscribe for unlimited listings.",
            upgrade_to : "subscriber",
            upgrade_url: "/subscribe",
          }),
        ...(hasWmWarnings && {
          watermark_warnings: wmAnalysis.warnings,
          watermark_notice  :
            "One or more photos may contain a third-party watermark.",
        }),
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      await destroyR2Assets(r2Keys);

      logError("POST /products", err, {
        sellerId, title, categoryId, fileCount: files.length,
      });

      Sentry.captureException(err, {
        tags : { area: "product_create", seller_id: sellerId },
        extra: { title, categoryId, fileCount: files.length },
      });

      return fail(
        res, 500,
        err.message || "Unknown error occurred",
        {
          debug: {
            code      : err.code       ?? null,
            detail    : err.detail     ?? null,
            constraint: err.constraint ?? null,
            hint      : err.hint       ?? null,
          },
        }
      );
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   PATCH /products/:id  — Edit listing
═══════════════════════════════════════════════════════════════ */
router.patch(
  "/products/:id",
  authenticate,
  editLimiter,
  withImageUpload(upload.array("images", MAX_IMAGES)),
  async (req, res) => {
    const sellerId  = req.user?.id;
    const productId = req.params.id;
    const ip        = getIp(req);

    console.log(
      "\n[addproduct] ▶ EDIT  product:", productId,
      " seller:", sellerId
    );
    if (!sellerId)  return fail(res, 401, "Not authenticated.");
    if (!productId) return fail(res, 400, "Product ID required.");

    const title         = cleanText(req.body.title);
    const description   = cleanText(req.body.description);
    const price         = Number(req.body.price);
    const categoryId    = cleanUuid(req.body.category_id);
    const subcategoryId = cleanUuid(req.body.subcategory_id);
    const locationState = cleanText(req.body.location_state);
    const locationCity  = cleanText(req.body.location_city);
    const latitude      = toFinite(req.body.latitude);
    const longitude     = toFinite(req.body.longitude);
    const sellerName    = cleanText(req.body.seller_name);
    const phone         = cleanText(req.body.phone);
    const whatsapp      = cleanText(req.body.whatsapp);
    const whatsappLink  = sanitizeWhatsAppLink(
      cleanText(req.body.whatsapp_link)
    );
    const attributes    = safeParseGuarded(req.body.attributes, {});
    const delivery      = safeParseGuarded(req.body.delivery,   {});
    const contact       = safeParseGuarded(req.body.contact,    {});
    const keepImageIds  = safeParse(req.body.keep_image_ids,    []);
    const removeKeys    = safeParse(req.body.remove_image_keys, []);
    const newFiles      = req.files ?? [];

    if (!title)
      return fail(res, 400, "Title is required.");
    if (title.length > TITLE_MAX)
      return fail(res, 400,
        `Title must be ≤ ${TITLE_MAX} characters.`);
    if (!description || description.length < DESC_MIN)
      return fail(res, 400,
        `Description must be at least ${DESC_MIN} characters.`);
    if (description.length > DESC_MAX)
      return fail(res, 400,
        `Description must be ≤ ${DESC_MAX} characters.`);
    if (!price || price <= 0 || !Number.isFinite(price))
      return fail(res, 400, "Enter a valid price.");
    if (price > PRICE_MAX)
      return fail(res, 400, "Price exceeds maximum.");
    if (!categoryId)
      return fail(res, 400, "Category is required.");
    if (!locationState || !locationCity)
      return fail(res, 400, "State and city are required.");

    const phoneErr = validatePhone(phone, "Phone number");
    if (phoneErr) return fail(res, 400, phoneErr);

    if (whatsapp) {
      const waErr = validatePhone(whatsapp, "WhatsApp number");
      if (waErr) return fail(res, 400, waErr);
    }

    const catEarly = await validateCategory(
      pool, categoryId, subcategoryId
    );
    if (!catEarly.valid) return fail(res, 400, catEarly.message);

    let newUploaded = [];
    const newR2Keys = [];

    if (newFiles.length) {
      try {
        newUploaded = await Promise.all(
          newFiles.map((file, i) =>
            imageLimit(async () => {
              const { buffer, mimetype } = await compressImage(
                file.buffer, file.mimetype
              );
              const { url, key } = await uploadToR2(
                buffer, mimetype
              );
              newR2Keys.push(key);
              return { url, key, order: i };
            })
          )
        );
      } catch (uploadErr) {
        logError("edit upload", uploadErr, { sellerId, productId });
        const isUserError =
          uploadErr.message.includes("too small") ||
          uploadErr.message.includes("Invalid")   ||
          uploadErr.message.includes("corrupt");
        return fail(
          res,
          isUserError ? 400 : 500,
          isUserError
            ? uploadErr.message
            : `Image upload failed: ${uploadErr.message}`
        );
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: existing } = await client.query(
        `SELECT id, seller_id, status FROM products
         WHERE  id = $1 AND status <> 'deleted'
         FOR UPDATE`,
        [productId]
      );

      if (!existing.length) {
        await client.query("ROLLBACK");
        await destroyR2Assets(newR2Keys);
        return fail(res, 404, "Product not found.");
      }
      if (existing[0].seller_id !== sellerId) {
        await client.query("ROLLBACK");
        await destroyR2Assets(newR2Keys);
        return fail(res, 403,
          "Not authorised to edit this listing.");
      }

      const catCheck = await validateCategory(
        client, categoryId, subcategoryId
      );
      if (!catCheck.valid) {
        await client.query("ROLLBACK");
        await destroyR2Assets(newR2Keys);
        return fail(res, 400, catCheck.message);
      }

      const newSlug = generateSlugWithId(
        title,
        crypto.randomUUID().replace(/-/g, "").slice(0, 8)
      );

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
           slug           = $17,
           updated_at     = NOW()
         WHERE id = $18
         RETURNING *`,
        [
          title, description, price,
          categoryId, subcategoryId ?? null,
          locationState, locationCity,
          latitude ?? null, longitude ?? null,
          sellerName, phone,
          whatsapp ?? null, whatsappLink ?? null,
          JSON.stringify(attributes),
          JSON.stringify(delivery),
          JSON.stringify(contact),
          newSlug,
          productId,
        ]
      );

      const product = updated[0];

      /* Remove images not in keep list */
      try {
        if (
          Array.isArray(keepImageIds) &&
          keepImageIds.length > 0
        ) {
          await client.query(
            `DELETE FROM product_images
             WHERE product_id = $1
               AND id        <> ALL($2::UUID[])`,
            [productId, keepImageIds]
          );
        } else if (newFiles.length > 0) {
          await client.query(
            "DELETE FROM product_images WHERE product_id = $1",
            [productId]
          );
        }
      } catch (delImgErr) {
        console.warn(
          "[addproduct] product_images delete failed:",
          delImgErr.message
        );
      }

      /* Insert new images */
      const existingCount = Array.isArray(keepImageIds)
        ? keepImageIds.length
        : 0;

      if (newUploaded.length) {
        try {
          await Promise.all(
            newUploaded.map((img, i) =>
              client.query(
                `INSERT INTO product_images
                   (product_id, image_url, r2_key,
                    position_order, is_primary)
                 VALUES ($1,$2,$3,$4,$5)
                 ON CONFLICT DO NOTHING`,
                [
                  productId, img.url, img.key,
                  existingCount + i,
                  existingCount + i === 0,
                ]
              )
            )
          );
        } catch (insImgErr) {
          console.warn(
            "[addproduct] product_images insert failed:",
            insImgErr.message
          );
        }
      }

      /* Rebuild images JSONB */
      let allImages = [];
      try {
        const { rows: imgRows } = await client.query(
          `SELECT image_url AS url, r2_key AS key,
                  position_order AS "order"
           FROM   product_images
           WHERE  product_id = $1
           ORDER  BY position_order`,
          [productId]
        );
        allImages = imgRows;
      } catch (fetchImgErr) {
        console.warn(
          "[addproduct] product_images fetch failed:",
          fetchImgErr.message
        );
      }

      const newThumb =
        allImages[0]?.url ?? product.thumbnail_url;
      await client.query(
        `UPDATE products
         SET images        = $1,
             thumbnail_url = $2,
             main_image    = $2
         WHERE id = $3`,
        [JSON.stringify(allImages), newThumb, productId]
      );
      product.images = allImages;

      await client.query("COMMIT");
      console.log(`[addproduct] ✓ edited  id:${productId}`);

      if (Array.isArray(removeKeys) && removeKeys.length)
        destroyR2Assets(removeKeys).catch(() => {});

      setImmediate(() => {
        writeAudit({
          actorId   : sellerId,
          action    : "product_edited",
          targetType: "product",
          targetId  : productId,
          metadata  : { title, categoryId },
          ipAddress : ip,
        }).catch(() => {});
      });

      return res.json({ success: true, product });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      await destroyR2Assets(newR2Keys);
      logError("PATCH /products/:id", err, { sellerId, productId });
      Sentry.captureException(err, {
        tags: { area: "product_edit", seller_id: sellerId },
      });
      return fail(
        res, 500,
        `Update failed: ${err.message}`,
        {
          debug: {
            code      : err.code       ?? null,
            detail    : err.detail     ?? null,
            constraint: err.constraint ?? null,
          },
        }
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
      "\n[addproduct] ▶ ACTIVATE  product:", productId,
      " seller:", sellerId
    );
    if (!sellerId)  return fail(res, 401, "Not authenticated.");
    if (!productId) return fail(res, 400, "Product ID required.");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: productRows } = await client.query(
        `SELECT id, seller_id, status, is_first_product,
                active_until
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
        return res.json({
          success            : true,
          message            : "Already active.",
          product,
          needs_verification : false,
          active_until       : product.active_until,
          days_remaining     : daysUntilExpiry(product.active_until),
          seller_verified    : true,
        });
      }

      const ctx = await getSellerContext(client, sellerId, true);

      if (
        product.status === "paused" &&
        !ctx.policy.canReactivate
      ) {
        await client.query("ROLLBACK");
        return fail(
          res, 403,
          "Expired listings cannot be reactivated until you " +
          "verify your identity.",
          {
            upgrade_required: true,
            upgrade_to      : "verified",
            upgrade_url     : "/verification",
          }
        );
      }

      const policyErr = enforcePolicyLimits({
        ...ctx, cooldownSecsLeft: 0,
      });
      if (policyErr) {
        await client.query("ROLLBACK");
        return fail(
          res,
          policyErr.status,
          policyErr.message,
          policyErr.extra ?? {}
        );
      }

      const finalStatus =
        ctx.tier === "unverified" ? "active_limited" : "active";
      const activeUntil = computeActiveUntil(ctx.tier);

      const { rows: updatedRows } = await client.query(
        `UPDATE products
         SET    status       = $1,
                is_active    = TRUE,
                active_until = $2,
                updated_at   = NOW()
         WHERE  id = $3
         RETURNING *`,
        [finalStatus, activeUntil, productId]
      );

      await client.query("COMMIT");

      const expiryDays        = daysUntilExpiry(activeUntil);
      const needsVerification = finalStatus === "active_limited";

      setImmediate(() => {
        writeAudit({
          actorId   : sellerId,
          action    : "product_activated",
          targetType: "product",
          targetId  : productId,
          metadata  : {
            status      : finalStatus,
            active_until: activeUntil,
            tier        : ctx.tier,
            email       : ctx.email,
          },
          ipAddress: ip,
        }).catch(() => {});
        trackTrending(productId).catch(() => {});
      });

      console.log(
        `[addproduct] ✓ activated  status:${finalStatus}` +
        `  tier:${ctx.tier}`
      );

      return res.json({
        success            : true,
        product            : updatedRows[0],
        tier               : ctx.tier,
        needs_verification : needsVerification,
        active_until       : activeUntil,
        days_remaining     : expiryDays,
        seller_verified    : ctx.isVerified,
        is_subscriber      : ctx.isSubscriber,
        expiry_message     :
          !activeUntil && ctx.isSubscriber
            ? "Your listing is live permanently."
            : needsVerification
            ? `Your listing is live for ${expiryDays} days (trial). ` +
              `Verify to post permanently.`
            : `Your listing is live for ${expiryDays} days.`,
        ...(needsVerification && {
          verification_message:
            "Verify your identity to make this listing permanent.",
        }),
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      logError("POST /products/:id/activate", err, {
        sellerId, productId,
      });
      Sentry.captureException(err, {
        tags: { area: "product_activate", seller_id: sellerId },
      });
      return fail(
        res, 500,
        `Activation failed: ${err.message}`,
        {
          debug: {
            code  : err.code   ?? null,
            detail: err.detail ?? null,
          },
        }
      );
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   DELETE /products/:id  — Soft delete
═══════════════════════════════════════════════════════════════ */
router.delete("/products/:id", authenticate, async (req, res) => {
  const sellerId  = req.user?.id;
  const productId = req.params.id;
  const ip        = getIp(req);

  console.log(
    "\n[addproduct] ▶ SOFT DELETE  product:", productId,
    " seller:", sellerId
  );
  if (!sellerId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows: check } = await pool.query(
      `SELECT id, status, is_deleted
       FROM   products
       WHERE  id        = $1
         AND  seller_id = $2
       LIMIT  1`,
      [productId, sellerId]
    );

    if (!check.length)
      return fail(res, 404,
        "Product not found or not owned by you.");
    if (check[0].is_deleted || check[0].status === "deleted")
      return fail(res, 400, "Product already deleted.");
    if (check[0].status === "active")
      return fail(res, 409,
        "Active listings must be paused before deleting.");

    const { rows } = await pool.query(
      `UPDATE products
       SET
         is_active             = FALSE,
         is_deleted            = TRUE,
         status                = 'deleted',
         deletion_requested_at = NOW(),
         deletion_reason       = 'user_deleted',
         permanent_delete_at   =
           NOW() + make_interval(days => $1::INT),
         deleted_at            = NOW(),
         updated_at            = NOW()
       WHERE id        = $2
         AND seller_id = $3
         AND (is_deleted = FALSE OR is_deleted IS NULL)
       RETURNING id, title`,
      [DELETE_HOLD_DAYS, productId, sellerId]
    );

    if (!rows.length)
      return fail(res, 404,
        "Product not found or already deleted.");

    setImmediate(() => {
      writeAudit({
        actorId   : sellerId,
        action    : "product_soft_deleted",
        targetType: "product",
        targetId  : productId,
        metadata  : {
          title    : rows[0].title,
          hold_days: DELETE_HOLD_DAYS,
        },
        ipAddress: ip,
      }).catch(() => {});
    });

    console.log(`[addproduct] ✓ soft-deleted  id:${productId}`);

    return res.json({
      success            : true,
      message            : "Listing deleted",
      hold_days          : DELETE_HOLD_DAYS,
      permanent_delete_at: new Date(
        Date.now() + DELETE_HOLD_DAYS * 86_400_000
      ).toISOString(),
    });

  } catch (err) {
    logError("DELETE /products/:id", err, { sellerId, productId });
    Sentry.captureException(err, {
      tags: { area: "product_delete", seller_id: sellerId },
    });
    return fail(
      res, 500,
      `Delete failed: ${err.message}`,
      {
        debug: {
          code  : err.code   ?? null,
          detail: err.detail ?? null,
        },
      }
    );
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /products/promotion-plans
   Public — lists all active promotion plans
═══════════════════════════════════════════════════════════════ */
router.get(
  "/products/promotion-plans",
  readLimiter,
  async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT
           id::text                                                AS id,
           name,
           price::numeric                                          AS price,
           COALESCE(discount_percent, 0)::numeric                  AS discount_percent,
           duration,
           COALESCE(duration_days, $1)::int                        AS duration_days,
           COALESCE(priority, 0)::int                              AS priority,
           COALESCE(features, '[]'::jsonb)                         AS features,
           description,
           ROUND(
             price::numeric *
             (1 - COALESCE(discount_percent, 0) / 100.0),
             2
           )                                                       AS effective_price
         FROM  promotion_plans
         WHERE is_active = TRUE
         ORDER BY sort_order ASC NULLS LAST, price ASC`,
        [PROMO_DEFAULT_DAYS]
      );

      return res.json({ success: true, plans: rows });
    } catch (err) {
      logError("GET /products/promotion-plans", err);
      return fail(res, 500, "Failed to load promotion plans.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /products/:id/promote
   ✅ Free plans  → activate directly, no Paystack
   ✅ Paid plans  → Paystack checkout
   ✅ Email always from users table
═══════════════════════════════════════════════════════════════ */
router.post(
  "/products/:id/promote",
  authenticate,
  promoteLimiter,
  async (req, res) => {
    const sellerId  = req.user?.id;
    const productId = req.params.id;
    const planId    = cleanId(req.body.plan_id);

    console.log(
      "\n[addproduct] ▶ PROMOTE  product:", productId,
      " seller:", sellerId,
      " plan:", planId
    );

    if (!sellerId)  return fail(res, 401, "Not authenticated.");
    if (!productId) return fail(res, 400, "Product ID required.");
    if (!planId)    return fail(res, 400, "Plan ID required.");

    /* ── Load plan ── */
    let plan;
    try {
      plan = await loadPromotionPlan(planId);
      if (!plan)
        return fail(res, 400,
          `Promotion plan not found (id: ${planId}).`);
    } catch (err) {
      logError("loadPromotionPlan", err, { planId });
      return fail(res, 500, "Failed to load plan details.");
    }

    const finalAmount = Number(plan.effective_price ?? 0);
    const isFree      = finalAmount === 0;

    console.log(
      "[addproduct] plan:", plan.name,
      "| amount:", finalAmount,
      "| isFree:", isFree
    );

    /* ── Verify product ownership ── */
    let product;
    try {
      const { rows } = await pool.query(
        `SELECT id, status, is_promoted, promotion_end
         FROM   products
         WHERE  id        = $1
           AND  seller_id = $2
           AND  status   <> 'deleted'`,
        [productId, sellerId]
      );
      if (!rows.length)
        return fail(res, 404,
          "Product not found or not owned by you.");
      product = rows[0];
    } catch (err) {
      logError("product ownership check", err, {
        sellerId, productId,
      });
      return fail(res, 500, "Failed to verify product.");
    }

    /* ── Check already actively promoted ── */
    const promotionStillActive =
      product.is_promoted &&
      product.promotion_end &&
      new Date(product.promotion_end) > new Date();

    if (promotionStillActive) {
      const daysLeft = Math.ceil(
        (new Date(product.promotion_end).getTime() - Date.now()) /
        86_400_000
      );
      return fail(
        res, 409,
        `This listing is already promoted for ` +
        `${daysLeft} more day(s).`,
        {
          is_promoted   : true,
          promoted_until: product.promotion_end,
          days_remaining: daysLeft,
        }
      );
    }

    /* ══════════════════════════════════════════════════════════
       FREE PLAN — activate directly
    ══════════════════════════════════════════════════════════ */
    if (isFree) {
      console.log("[addproduct] free plan — activating directly");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        /* Insert payment row as already succeeded */
        const { rows: payRows } = await client.query(
          `INSERT INTO payments
             (seller_id, product_id, plan_id,
              amount, reference,
              status, type, method, metadata)
           VALUES
             ($1, $2, $3,
              0, $4,
              'success', 'promotion', 'free', $5)
           RETURNING id`,
          [
            sellerId,
            productId,
            plan.id,
            `free_${Date.now()}_` +
            `${crypto.randomBytes(4).toString("hex")}`,
            JSON.stringify({
              plan_name: plan.name,
              is_free  : true,
              currency : ACCEPTED_CURRENCY,
            }),
          ]
        );

        const paymentId = payRows[0].id;

        /* Activate + promote */
        const result = await activateProductPromotion(client, {
          paymentId,
          productId,
          planId  : plan.id,
          sellerId,
          plan,
        });

        await client.query("COMMIT");

        console.log(
          "[addproduct] ✓ free promotion activated",
          "status:", result.finalStatus
        );

        logPaymentEvent(
          paymentId, "promotion.free_activated", "api",
          { plan: plan.name, status: result.finalStatus }
        );

        setImmediate(() => {
          createNotification({
            userId : sellerId,
            type   : "promotion_active",
            title  : "Promotion Active 🚀",
            message:
              `Your listing is now promoted with the ` +
              `"${plan.name}" plan.`,
          }).catch(() => {});

          writeAudit({
            actorId   : sellerId,
            action    : "promotion_free_activated",
            targetType: "payment",
            targetId  : String(paymentId),
            metadata  : {
              plan     : plan.name,
              productId,
              isFree   : true,
            },
          }).catch(() => {});
        });

        const days = daysUntilExpiry(
          result.activeUntil ?? result.expiresAt
        );

        return res.json({
          success            : true,
          is_free            : true,
          is_promoted        : true,
          product_id         : productId,
          plan_name          : plan.name,
          status             : result.finalStatus,
          needs_verification : !result.verified,
          active_until       : result.activeUntil  ?? null,
          promoted_until     : result.expiresAt    ?? null,
          days_remaining     : days,
          ...(!result.verified && {
            verification_message:
              `Your listing is live for ${days ?? 7} day(s). ` +
              "Verify your identity to make it permanent.",
          }),
        });

      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        logError("free promotion activate", err, {
          sellerId, productId,
        });
        Sentry.captureException(err, {
          tags: { area: "promotion_free", seller_id: sellerId },
        });
        return fail(
          res, 500,
          IS_PROD
            ? "Failed to activate free promotion. Please try again."
            : err.message
        );
      } finally {
        client.release();
      }
    }

    /* ══════════════════════════════════════════════════════════
       PAID PLAN — go through Paystack
    ══════════════════════════════════════════════════════════ */

    /* Fetch seller email from users table */
    let email;
    try {
      const { rows } = await pool.query(
        `SELECT email FROM public.users WHERE id = $1 LIMIT 1`,
        [sellerId]
      );
      if (!rows.length || !rows[0].email)
        return fail(res, 400,
          "Account email not found. Please contact support.");
      email = rows[0].email;
    } catch (err) {
      logError("email fetch", err, { sellerId });
      return fail(res, 500, "Failed to fetch account details.");
    }

    /* ── Reuse or expire existing pending payment ── */
    const { rows: pendingRows } = await pool.query(
      `SELECT id, reference, created_at
       FROM   payments
       WHERE  product_id = $1
         AND  seller_id  = $2
         AND  status     = 'pending'
       ORDER  BY created_at DESC
       LIMIT  1`,
      [productId, sellerId]
    );

    if (pendingRows.length) {
      const ep    = pendingRows[0];
      const ageMs =
        Date.now() - new Date(ep.created_at).getTime();

      console.log(
        "[addproduct] found pending payment:", ep.id,
        "| age:", Math.round(ageMs / 1_000) + "s"
      );

      if (ageMs > PAYMENT_MAX_AGE_MS) {
        console.log(
          "[addproduct] pending payment expired — clearing"
        );
        await expirePendingPromoPayment(ep.id, productId);

      } else {
        /* Re-initialize with Paystack for a fresh URL */
        console.log(
          "[addproduct] re-initializing with Paystack…"
        );
        const newRef = makeReference();
        const reinit = await paystackInitialize({
          email,
          amountNaira: finalAmount,
          reference  : newRef,
          productId,
          metadata   : {
            paymentId : String(ep.id),
            productId,
            sellerId,
            planId    : String(plan.id),
            planAmount: finalAmount,
            currency  : ACCEPTED_CURRENCY,
          },
        });

        if (reinit.ok && reinit.authorizationUrl) {
          await pool.query(
            `UPDATE payments
             SET    reference  = $1,
                    updated_at = NOW()
             WHERE  id = $2`,
            [reinit.reference, ep.id]
          );
          console.log(
            "[addproduct] ✓ re-initialized"
          );
          return res.json({
            success          : true,
            is_free          : false,
            reference        : reinit.reference,
            authorization_url: reinit.authorizationUrl,
          });
        }

        console.warn(
          "[addproduct] Paystack re-init failed:",
          reinit.message
        );
        await expirePendingPromoPayment(ep.id, productId);
      }
    }

    /* ── Create new payment ── */
    console.log("[addproduct] creating new payment…");

    const reference = makeReference();
    const client    = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE products
         SET    status     = 'pending_payment',
                updated_at = NOW()
         WHERE  id = $1`,
        [productId]
      );

      const { rows: payRows } = await client.query(
        `INSERT INTO payments
           (seller_id, product_id, plan_id,
            amount, email, reference,
            status, type, method, metadata)
         VALUES
           ($1,$2,$3,
            $4,$5,$6,
            'pending','promotion','paystack',$7)
         RETURNING id, reference`,
        [
          sellerId,
          productId,
          plan.id,
          finalAmount,
          email,
          reference,
          JSON.stringify({
            plan_name       : plan.name,
            original_price  : plan.price,
            discount_percent: plan.discount_percent,
            effective_price : finalAmount,
            currency        : ACCEPTED_CURRENCY,
          }),
        ]
      );

      const paymentId      = payRows[0].id;
      const savedReference = payRows[0].reference;

      console.log("[addproduct] payment row:", paymentId);

      await client.query("COMMIT");

      /* Call Paystack */
      const init = await paystackInitialize({
        email,
        amountNaira: finalAmount,
        reference  : savedReference,
        productId,
        metadata   : {
          paymentId : String(paymentId),
          productId,
          sellerId,
          planId    : String(plan.id),
          planAmount: finalAmount,
          currency  : ACCEPTED_CURRENCY,
        },
      });

      console.log(
        "[addproduct] Paystack init:",
        init.ok, "|", init.message
      );

      if (!init.ok || !init.authorizationUrl) {
        await pool.query(
          `UPDATE products
           SET status='draft', updated_at=NOW()
           WHERE id=$1`,
          [productId]
        );
        await pool.query(
          `UPDATE payments
           SET status='failed', updated_at=NOW()
           WHERE id=$1`,
          [paymentId]
        );
        logPaymentEvent(
          paymentId, "payment.initiate_failed", "api",
          { message: init.message }
        );
        return fail(
          res, 502,
          init.message || "Payment gateway error. Please try again."
        );
      }

      logPaymentEvent(
        paymentId, "payment.initiated", "api",
        { plan: plan.name, amount: finalAmount }
      );

      writeAudit({
        actorId   : sellerId,
        action    : "promotion_initiated",
        targetType: "payment",
        targetId  : String(paymentId),
        metadata  : {
          plan     : plan.name,
          amount   : finalAmount,
          reference: savedReference,
          email,
        },
        ipAddress: getIp(req),
      }).catch(() => {});

      console.log(
        "[addproduct] ✓ initiated — returning authorization_url"
      );

      return res.json({
        success          : true,
        is_free          : false,
        reference        : savedReference,
        authorization_url: init.authorizationUrl,
        plan_name        : plan.name,
        amount_naira     : finalAmount,
        duration_days    : plan.duration_days,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      logError("paid promotion initiate", err, {
        sellerId, productId,
      });
      Sentry.captureException(err, {
        tags: { area: "promotion_paid", seller_id: sellerId },
      });
      return fail(
        res, 500,
        IS_PROD
          ? "Payment initialization failed. Please try again."
          : err.message
      );
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /products/promotion/callback
   Paystack redirects here after payment.
   Auto-verifies + activates → redirects to frontend.
═══════════════════════════════════════════════════════════════ */
router.get(
  "/products/promotion/callback",
  async (req, res) => {
    const reference = cleanId(req.query.reference);
    const source    = String(req.query.source ?? "promotion");

    console.log(
      "\n[addproduct] ▶ PROMO CALLBACK  ref:", reference,
      "source:", source
    );

    const redirectFail = (msg) =>
      res.redirect(
        `${FRONTEND_URL}/payment/complete` +
        `?status=error` +
        `&message=${encodeURIComponent(msg)}` +
        `&reference=${encodeURIComponent(reference ?? "")}`
      );

    if (!reference) return redirectFail("Missing payment reference.");

    /* ── Verify with Paystack ── */
    const ps = await paystackVerify(reference);

    if (!ps.ok)
      return redirectFail("Could not reach payment provider.");

    if (ps.currency && ps.currency !== ACCEPTED_CURRENCY)
      return redirectFail(
        `Invalid currency: ${ps.currency}.`
      );

    if (ps.status === "pending") {
      return res.redirect(
        `${FRONTEND_URL}/payment/complete` +
        `?status=pending` +
        `&reference=${encodeURIComponent(reference)}`
      );
    }

    /* ── Find payment row ── */
    const { rows: payRows } = await pool.query(
      `SELECT id, seller_id, product_id,
              plan_id::text AS plan_id,
              amount, status
       FROM   payments
       WHERE  reference = $1
       LIMIT  1`,
      [reference]
    );

    if (!payRows.length)
      return redirectFail("Payment record not found.");

    const payment   = payRows[0];
    const productId = payment.product_id;
    const sellerId  = payment.seller_id;
    const planId    = payment.plan_id;

    /* ── Already confirmed ── */
    if (payment.status === "success") {
      return res.redirect(
        `${FRONTEND_URL}/payment/complete` +
        `?status=success` +
        `&reference=${encodeURIComponent(reference)}` +
        `&product_id=${encodeURIComponent(productId)}` +
        `&already_confirmed=true`
      );
    }

    /* ── Payment succeeded at Paystack ── */
    if (ps.status === "success") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        /* Re-lock — guard against race with webhook */
        const { rows: locked } = await client.query(
          `SELECT id, status FROM payments
           WHERE  id = $1 FOR UPDATE`,
          [payment.id]
        );

        if (locked[0]?.status === "success") {
          await client.query("ROLLBACK");
          return res.redirect(
            `${FRONTEND_URL}/payment/complete` +
            `?status=success` +
            `&reference=${encodeURIComponent(reference)}` +
            `&product_id=${encodeURIComponent(productId)}` +
            `&already_confirmed=true`
          );
        }

        /* Amount check */
        const expectedKobo =
          Math.round(Number(payment.amount) * 100);
        if (ps.amountKobo && ps.amountKobo < expectedKobo) {
          await client.query("ROLLBACK");
          logPaymentEvent(
            payment.id, "payment.amount_mismatch", "callback",
            { expected: expectedKobo, received: ps.amountKobo }
          );
          return redirectFail(
            "Payment amount mismatch. Contact support."
          );
        }

        /* Load plan */
        const plan = await loadPromotionPlan(planId);
        if (!plan) {
          await client.query("ROLLBACK");
          return redirectFail("Promotion plan no longer available.");
        }

        /* Activate */
        const result = await activateProductPromotion(client, {
          paymentId : payment.id,
          productId,
          planId,
          sellerId,
          plan,
        });

        await client.query("COMMIT");

        logPaymentEvent(
          payment.id, "charge.success", "callback",
          {
            status           : result.finalStatus,
            needsVerification: !result.verified,
          }
        );

        setImmediate(() => {
          createNotification({
            userId : sellerId,
            type   : "promotion_active",
            title  : "Promotion Active 🚀",
            message: result.verified
              ? `Your listing is now promoted with the ` +
                `"${plan.name}" plan.`
              : "Your listing is promoted for 7 days. " +
                "Verify your identity to extend it.",
          }).catch(() => {});

          writeAudit({
            actorId   : sellerId,
            action    : "promotion_activated_via_callback",
            targetType: "payment",
            targetId  : String(payment.id),
            metadata  : { reference, source, status: "success" },
          }).catch(() => {});
        });

        return res.redirect(
          `${FRONTEND_URL}/payment/complete` +
          `?status=success` +
          `&reference=${encodeURIComponent(reference)}` +
          `&product_id=${encodeURIComponent(productId)}` +
          `&plan=${encodeURIComponent(plan.id)}` +
          `&plan_name=${encodeURIComponent(plan.name)}` +
          `&promoted_until=${encodeURIComponent(
            result.expiresAt?.toISOString() ?? ""
          )}` +
          `&needs_verification=${!result.verified}`
        );

      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        logError("promotion callback", err, { reference });
        Sentry.captureException(err, {
          tags: { area: "promotion_callback", reference },
        });
        logPaymentEvent(
          payment.id, "payment.callback_error", "callback",
          { error: err.message }
        );
        return redirectFail(
          "Activation failed. Please contact support."
        );
      } finally {
        client.release();
      }
    }

    /* ── Failed / abandoned ── */
    const newStatus =
      ps.status === "abandoned" ? "cancelled" : "failed";

    await pool.query(
      `UPDATE payments
       SET status=$1, updated_at=NOW()
       WHERE id=$2`,
      [newStatus, payment.id]
    );
    await pool.query(
      `UPDATE products
       SET status='draft', is_active=FALSE, updated_at=NOW()
       WHERE id=$1`,
      [productId]
    );

    logPaymentEvent(
      payment.id, `payment.${newStatus}`, "callback",
      { paystackStatus: ps.status }
    );

    return res.redirect(
      `${FRONTEND_URL}/payment/complete` +
      `?status=${newStatus}` +
      `&reference=${encodeURIComponent(reference)}` +
      `&product_id=${encodeURIComponent(productId)}` +
      `&message=${encodeURIComponent(
        ps.status === "abandoned"
          ? "Payment was cancelled."
          : "Payment failed."
      )}`
    );
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /products/promotion/webhook
   Paystack server-to-server webhook.
   Must be mounted BEFORE express.json() in server.js.
═══════════════════════════════════════════════════════════════ */
router.post(
  "/products/promotion/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["x-paystack-signature"];
    const rawBody   = req.body;

    console.log("\n[addproduct] ▶ PROMO WEBHOOK received");

    /* Signature check */
    if (
      !signature ||
      !verifyWebhookSignature(rawBody, signature)
    ) {
      console.warn("[addproduct] ❌ invalid webhook signature");
      return res.status(401).send("Unauthorized");
    }

    /* Parse event */
    let event;
    try {
      event = JSON.parse(rawBody.toString("utf-8"));
    } catch {
      return res.status(400).send("Invalid JSON");
    }

    if (event.event !== "charge.success")
      return res.status(200).send("OK");

    /* Dedup by payload hash */
    const payloadHash = hashWebhookPayload(rawBody);
    try {
      const { rows: dupRows } = await pool.query(
        `SELECT id FROM payment_webhook_events
         WHERE payload_hash = $1 LIMIT 1`,
        [payloadHash]
      );
      if (dupRows.length) {
        console.log(
          "[addproduct] duplicate webhook:",
          payloadHash.slice(0, 16)
        );
        return res.status(200).send("OK");
      }
      await pool.query(
        `INSERT INTO payment_webhook_events
           (payload_hash, event_type, received_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (payload_hash) DO NOTHING`,
        [payloadHash, event.event]
      );
    } catch (err) {
      console.error(
        "[addproduct] webhook dedup error:", err.message
      );
    }

    /* Acknowledge immediately */
    res.status(200).send("OK");

    /* Process async */
    const txnData  = event.data ?? {};
    const metadata = txnData.metadata ?? {};

    const paystackRef        = txnData.reference;
    const paystackAmountKobo = txnData.amount;
    const paystackCurrency   = txnData.currency;

    /* Currency check */
    if (
      paystackCurrency &&
      paystackCurrency !== ACCEPTED_CURRENCY
    ) {
      console.error(
        "[addproduct] webhook wrong currency:", paystackCurrency
      );
      return;
    }

    const paymentId  = cleanId(metadata.paymentId);
    const productId  = cleanId(metadata.productId);
    const sellerId   = cleanId(metadata.sellerId);
    const planId     = cleanId(metadata.planId);
    const planAmount = Number(metadata.planAmount ?? 0);

    if (!paymentId || !productId || !sellerId || !planId) {
      console.warn(
        "[addproduct] webhook missing metadata:", metadata
      );
      return;
    }

    /* Amount check */
    const expectedKobo = Math.round(planAmount * 100);
    if (planAmount > 0 && paystackAmountKobo < expectedKobo) {
      console.error(
        "[addproduct] webhook amount mismatch",
        "expected:", expectedKobo,
        "received:", paystackAmountKobo
      );
      logPaymentEvent(
        paymentId, "payment.amount_mismatch", "webhook",
        { expected: expectedKobo, received: paystackAmountKobo }
      );
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* Lock payment row */
      const { rows: paymentRows } = await client.query(
        `SELECT id, reference, product_id,
                plan_id::text AS plan_id,
                seller_id, amount, status
         FROM   payments
         WHERE  id = $1
         FOR UPDATE`,
        [paymentId]
      );

      if (!paymentRows.length) {
        console.warn(
          "[addproduct] webhook payment not found:", paymentId
        );
        await client.query("ROLLBACK");
        return;
      }

      const payment = paymentRows[0];

      /* Idempotency */
      if (payment.status === "success") {
        await client.query("ROLLBACK");
        return;
      }

      /* Ownership validation */
      if (
        payment.product_id !== productId  ||
        payment.seller_id  !== sellerId   ||
        String(payment.plan_id) !== String(planId)
      ) {
        console.error(
          "[addproduct] webhook metadata mismatch", {
            db      : {
              product_id: payment.product_id,
              seller_id : payment.seller_id,
            },
            received: { productId, sellerId, planId },
          }
        );
        logPaymentEvent(
          paymentId, "payment.metadata_mismatch", "webhook",
          {
            db      : {
              product_id: payment.product_id,
              seller_id : payment.seller_id,
            },
            received: { productId, sellerId, planId },
          }
        );
        await client.query("ROLLBACK");
        return;
      }

      /* Reference validation */
      if (paystackRef && payment.reference !== paystackRef) {
        console.error(
          "[addproduct] webhook reference mismatch", {
            db     : payment.reference,
            paystack: paystackRef,
          }
        );
        await client.query("ROLLBACK");
        return;
      }

      /* Load plan */
      const plan = await loadPromotionPlan(planId);
      if (!plan) {
        console.error(
          "[addproduct] webhook plan not found:", planId
        );
        await client.query("ROLLBACK");
        return;
      }

      /* Activate */
      const result = await activateProductPromotion(client, {
        paymentId,
        productId,
        planId,
        sellerId,
        plan,
      });

      await client.query("COMMIT");

      console.log(
        `[addproduct] ✓ webhook promotion applied`,
        ` product:${productId}`,
        ` plan:${plan.name}`,
        ` status:${result.finalStatus}`
      );

      logPaymentEvent(
        paymentId, "charge.success", "webhook",
        {
          plan             : plan.name,
          status           : result.finalStatus,
          needsVerification: !result.verified,
        }
      );

      setImmediate(() => {
        createNotification({
          userId : sellerId,
          type   : "promotion_active",
          title  : "Payment Confirmed — Promotion Active 🚀",
          message: result.verified
            ? `Your listing is now promoted with the ` +
              `"${plan.name}" plan.`
            : "Your listing is promoted for 7 days. " +
              "Verify your identity to make it permanent.",
        }).catch(() => {});

        writeAudit({
          actorId   : sellerId,
          action    : "promotion_webhook_success",
          targetType: "payment",
          targetId  : String(paymentId),
          metadata  : {
            productId,
            planId,
            status: result.finalStatus,
          },
        }).catch(() => {});
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      logError("promotion webhook", err, { paymentId, productId });
      Sentry.captureException(err, {
        tags: { area: "promotion_webhook", payment_id: paymentId },
      });
      logPaymentEvent(
        paymentId, "payment.webhook_error", "webhook",
        { error: err.message }
      );
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /products/:id/promotion-status
   Returns current promotion status for a product.
═══════════════════════════════════════════════════════════════ */
router.get(
  "/products/:id/promotion-status",
  authenticate,
  readLimiter,
  async (req, res) => {
    const sellerId  = req.user?.id;
    const productId = req.params.id;

    if (!sellerId)  return fail(res, 401, "Not authenticated.");
    if (!productId) return fail(res, 400, "Product ID required.");

    try {
      const { rows } = await pool.query(
        `SELECT
           p.id,
           p.is_promoted,
           p.promotion_end,
           p.promotion_type,
           p.promotion_start,
           p.promotion_id,
           p.promotion_priority,
           p.boost_score
         FROM   products p
         WHERE  p.id        = $1
           AND  p.seller_id = $2
           AND  p.status   <> 'deleted'
         LIMIT  1`,
        [productId, sellerId]
      );

      if (!rows.length)
        return fail(res, 404, "Product not found.");

      const row = rows[0];
      const isActivePromotion =
        row.is_promoted &&
        row.promotion_end &&
        new Date(row.promotion_end) > new Date();

      return res.json({
        success        : true,
        product_id     : productId,
        is_promoted    : !!row.is_promoted,
        is_active      : !!isActivePromotion,
        promotion_start: row.promotion_start ?? null,
        promoted_until : row.promotion_end   ?? null,
        days_remaining : daysUntilExpiry(row.promotion_end),
        plan_name      : row.promotion_type  ?? null,
        boost_score    : row.boost_score     ?? 0,
      });

    } catch (err) {
      logError("GET /products/:id/promotion-status", err, {
        sellerId, productId,
      });
      return fail(
        res, 500,
        `Status check failed: ${err.message}`
      );
    }
  }
);

export default router;