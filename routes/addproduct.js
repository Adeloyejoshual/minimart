// ════════════════════════════════════════════════════════════════
// FILE: routes/addproduct.js — v16
//
// Changes from v15:
//  ─ Multer input limit lowered back to 5 MB (sweet spot)
//  ─ Output after compression targets ~500 KB max
//  ─ Added progressive quality reduction to hit 500 KB target
//  ─ MIN_DIMENSION check: rejects images below 300×300
//  ─ pLimit(2) concurrency on compress+upload
//  ─ Sentry error tracking on all unexpected errors
//  ─ IMAGE_CONFIG updated to reflect new limits
// ════════════════════════════════════════════════════════════════

import express   from "express";
import multer    from "multer";
import rateLimit from "express-rate-limit";
import crypto    from "crypto";
import path      from "path";
import fs        from "fs";
import sharp     from "sharp";
import pLimit    from "p-limit";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router    = express.Router();
const IS_PROD   = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   SENTRY
═══════════════════════════════════════════════════════════════ */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn              : process.env.SENTRY_DSN,
    environment      : process.env.NODE_ENV ?? "development",
    tracesSampleRate : 0.2,
  });
  console.log("[addproduct] Sentry initialized");
} else {
  console.warn("[addproduct] SENTRY_DSN not set — error tracking disabled");
}

/* ═══════════════════════════════════════════════════════════════
   R2 CLIENT
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

const uploadToR2 = async (buffer, mimetype) => {
  const key = `products/${Date.now()}-${crypto.randomUUID()}.webp`;

  await r2.send(
    new PutObjectCommand({
      Bucket       : R2_BUCKET,
      Key          : key,
      Body         : buffer,
      ContentType  : mimetype,
      CacheControl : "public, max-age=31536000, immutable",
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
        Delete : {
          Objects : keys.map((k) => ({ Key: k })),
          Quiet   : true,
        },
      })
    );
    console.log(
      "[addproduct] ✓ R2 cleanup:",
      keys.length,
      "image(s) deleted"
    );
  } catch (e) {
    console.error("[addproduct] R2 cleanup failed:", e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const FREE_LISTING_DAYS   = 30;
const ALLOWED_STATUSES    = new Set(["active", "draft", "pending_payment"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGES          = 6;
const MAX_JSON_BYTES      = 8_192;

const ALLOWED_WA_HOSTS = [
  "wa.me",
  "web.whatsapp.com",
  "api.whatsapp.com",
  "chat.whatsapp.com",
  "business.whatsapp.com",
];

/* ═══════════════════════════════════════════════════════════════
   IMAGE CONFIG
   ─ Input : up to 5 MB per image (multer gate)
   ─ Output: targets 500 KB max after compression
   ─ Strategy: resize first → if still > 500 KB, reduce quality
               in steps until target hit or floor reached
═══════════════════════════════════════════════════════════════ */
const IMAGE_CONFIG = Object.freeze({
  maxInputBytes   : 5 * 1_048_576,    // 5 MB  — multer rejects above this
  maxOutputBytes  : 500_000,          // 500 KB — target stored size
  maxWidth        : 1_200,            // resize to max 1200px (either axis)
  webpQualityInit : 82,               // start quality
  webpQualityMin  : 55,               // never go below this
  webpQualityStep : 8,                // reduce by 8 each attempt
  minDimension    : 300,              // reject images smaller than 300×300
  watermark: Object.freeze({
    enabled       : true,
    logoPath      : path.join(__dirname, "../assets/watermark-logo.png"),
    text          : "Loemart.com",
    opacity       : 0.40,
    logoMaxRatio  : 0.25,
    fontSizeRatio : 0.045,
    shadowOpacity : 0.60,
  }),
});

/* ═══════════════════════════════════════════════════════════════
   IMAGE CONCURRENCY  — max 2 compress+upload jobs at once
   6 images × ~80 MB RAM = 480 MB without limit
   With pLimit(2) → max ~160 MB peak
═══════════════════════════════════════════════════════════════ */
const imageLimit = pLimit(2);

/* ═══════════════════════════════════════════════════════════════
   WATERMARK — load logo once at startup
═══════════════════════════════════════════════════════════════ */
let _watermarkLogo = null;
let _logoLoadTried = false;

const getWatermarkLogo = async () => {
  if (_logoLoadTried) return _watermarkLogo;
  _logoLoadTried = true;
  try {
    _watermarkLogo = await fs.promises.readFile(
      IMAGE_CONFIG.watermark.logoPath
    );
    console.log("[watermark] ✓ Logo loaded from disk");
  } catch {
    console.warn(
      "[watermark] Logo not found at",
      IMAGE_CONFIG.watermark.logoPath,
      "— will use text watermark"
    );
    _watermarkLogo = null;
  }
  return _watermarkLogo;
};

/* ─── SVG text watermark (fallback) ─── */
const buildTextWatermarkSvg = (imgW, imgH) => {
  const wm       = IMAGE_CONFIG.watermark;
  const fontSize = Math.max(14, Math.round(imgW * wm.fontSizeRatio));
  const textX    = imgW - wm.padding ?? 20;
  const textY    = imgH - wm.padding ?? 20;

  return Buffer.from(`
    <svg width="${imgW}" height="${imgH}"
         xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="1" dy="1"
            stdDeviation="2"
            flood-color="black"
            flood-opacity="${wm.shadowOpacity}"
          />
        </filter>
      </defs>
      <text
        x="${textX}"
        y="${textY}"
        font-family="Arial, sans-serif"
        font-size="${fontSize}px"
        font-weight="bold"
        fill="white"
        fill-opacity="${wm.opacity}"
        text-anchor="end"
        dominant-baseline="auto"
        filter="url(#shadow)"
      >${wm.text}</text>
    </svg>
  `);
};

/* ─── Logo watermark composite ─── */
const buildLogoComposite = async (logoBuffer, imgW) => {
  const wm        = IMAGE_CONFIG.watermark;
  const logoWidth = Math.round(imgW * wm.logoMaxRatio);

  const resizedLogo = await sharp(logoBuffer)
    .resize({
      width             : logoWidth,
      fit               : "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .webp({ quality: 90 })
    .toBuffer();

  /* Apply opacity per-pixel on alpha channel */
  const { data, info } = await sharp(resizedLogo)
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * wm.opacity);
  }

  const logoWithOpacity = await sharp(data, {
    raw: {
      width    : info.width,
      height   : info.height,
      channels : 4,
    },
  })
    .webp({ quality: 90 })
    .toBuffer();

  return {
    input   : logoWithOpacity,
    gravity : "southeast",
    blend   : "over",
  };
};

/* ═══════════════════════════════════════════════════════════════
   COMPRESS + WATERMARK
   Flow:
     1. Validate (corrupt / dimensions too small)
     2. Resize to maxWidth
     3. Apply watermark (logo or text SVG)
     4. Encode WebP at init quality
     5. If output > 500 KB → reduce quality in steps until ≤ 500 KB
        or quality floor reached (whichever comes first)
═══════════════════════════════════════════════════════════════ */
const compressImage = async (buffer, mimetype) => {
  /* ── 1. Validate ── */
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch (err) {
    Sentry.captureException?.(err, {
      tags: { area: "image_compression", step: "metadata" },
    });
    throw new Error("Invalid or corrupt image file.");
  }

  if (!meta.width || !meta.height) {
    throw new Error("Image has invalid dimensions.");
  }

  if (
    meta.width  < IMAGE_CONFIG.minDimension ||
    meta.height < IMAGE_CONFIG.minDimension
  ) {
    throw new Error(
      `Image is too small (${meta.width}×${meta.height}px). ` +
      `Minimum accepted size is ${IMAGE_CONFIG.minDimension}×` +
      `${IMAGE_CONFIG.minDimension}px. ` +
      `Please use a clearer, higher-quality photo.`
    );
  }

  /* ── 2. Resize + strip EXIF + auto-rotate ── */
  let resizedBuffer;
  try {
    resizedBuffer = await sharp(buffer)
      .rotate()                              // fix EXIF orientation
      .resize({
        width             : IMAGE_CONFIG.maxWidth,
        height            : IMAGE_CONFIG.maxWidth,
        fit               : "inside",        // preserve aspect ratio
        withoutEnlargement: true,            // never upscale
      })
      .toBuffer();                           // raw, not yet encoded
  } catch (err) {
    Sentry.captureException?.(err, {
      tags : { area: "image_compression", step: "resize" },
      extra: { width: meta.width, height: meta.height, mimetype },
    });
    throw new Error("Failed to process image. Please try a different photo.");
  }

  /* ── 3. Build watermark composite ── */
  let composite = null;

  if (IMAGE_CONFIG.watermark.enabled) {
    const resizedMeta = await sharp(resizedBuffer).metadata();
    const imgW        = resizedMeta.width;
    const imgH        = resizedMeta.height;
    const logoBuffer  = await getWatermarkLogo();

    if (logoBuffer) {
      try {
        composite = await buildLogoComposite(logoBuffer, imgW);
      } catch (logoErr) {
        console.warn("[watermark] Logo failed, using text:", logoErr.message);
        Sentry.captureException?.(logoErr, {
          tags: { area: "watermark", step: "logo_composite" },
        });
        composite = {
          input : buildTextWatermarkSvg(imgW, imgH),
          top   : 0,
          left  : 0,
          blend : "over",
        };
      }
    } else {
      composite = {
        input : buildTextWatermarkSvg(imgW, imgH),
        top   : 0,
        left  : 0,
        blend : "over",
      };
    }
  }

  /* ── 4 + 5. Encode WebP, reduce quality until ≤ 500 KB ── */
  let quality     = IMAGE_CONFIG.webpQualityInit;
  let finalBuffer = null;

  while (quality >= IMAGE_CONFIG.webpQualityMin) {
    try {
      const pipeline = sharp(resizedBuffer);

      if (composite) {
        pipeline.composite([composite]);
      }

      const candidate = await pipeline
        .webp({ quality })
        .toBuffer();

      finalBuffer = candidate;

      if (candidate.length <= IMAGE_CONFIG.maxOutputBytes) {
        /* ✓ Under 500 KB — done */
        break;
      }

      if (quality <= IMAGE_CONFIG.webpQualityMin) {
        /* Hit the floor — accept whatever size we got */
        console.warn(
          `[addproduct] image hit quality floor at ${quality}q, ` +
          `final size: ${(candidate.length / 1_024).toFixed(0)} KB`
        );
        break;
      }

      /* Reduce and try again */
      quality -= IMAGE_CONFIG.webpQualityStep;
      quality  = Math.max(quality, IMAGE_CONFIG.webpQualityMin);

    } catch (encodeErr) {
      Sentry.captureException?.(encodeErr, {
        tags : { area: "image_compression", step: "encode_webp" },
        extra: { quality },
      });
      throw new Error("Failed to encode image. Please try a different photo.");
    }
  }

  console.log(
    `[addproduct] compress+watermark:` +
    ` ${(buffer.length / 1_024).toFixed(0)} KB input` +
    ` → ${(finalBuffer.length / 1_024).toFixed(0)} KB output` +
    ` @ quality ${quality}` +
    ` (${IMAGE_CONFIG.watermark.enabled
        ? (await getWatermarkLogo() ? "logo" : "text") + " watermark"
        : "no watermark"})`
  );

  return { buffer: finalBuffer, mimetype: "image/webp" };
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
    freeListingDays  :  30,
    canReactivate    : true,
    totalLifetimeMax : null,
  }),
});

/* ═══════════════════════════════════════════════════════════════
   REDIS  (trending only — non-critical)
═══════════════════════════════════════════════════════════════ */
const TRENDING_WINDOW_SECS = 24 * 60 * 60;
const TRENDING_TTL_SECS    = TRENDING_WINDOW_SECS + 3_600;
const TRENDING_KEY         = "trending:24h";

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
   MULTER  — 5 MB input limit
   Server compresses to ≤ 500 KB output before storing
═══════════════════════════════════════════════════════════════ */
const upload = multer({
  storage    : multer.memoryStorage(),
  limits     : {
    fileSize : IMAGE_CONFIG.maxInputBytes,   // 5 MB
    files    : MAX_IMAGES,
  },
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
      ["LIMIT_FILE_SIZE", "LIMIT_FILE_COUNT", "INVALID_MIME"].includes(
        err.code
      )
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

const safeParseGuarded = (v, fallback) => {
  if (v && String(v).length > MAX_JSON_BYTES) {
    console.warn("[addproduct] JSON field too large, using fallback");
    return fallback;
  }
  return safeParse(v, fallback);
};

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

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
      (host) =>
        url.hostname === host || url.hostname.endsWith(`.${host}`)
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
   ACTIVE UNTIL
═══════════════════════════════════════════════════════════════ */
const computeActiveUntil = (isVerified) => {
  const days = isVerified
    ? FREE_LISTING_DAYS
    : POLICY.unverified.expiryDays;

  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const daysUntilExpiry = (activeUntil) => {
  if (!activeUntil) return null;
  return Math.ceil(
    (new Date(activeUntil).getTime() - Date.now()) / 86_400_000
  );
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
       )::int                                                   AS today_count,

       COUNT(*) FILTER (
         WHERE is_active = TRUE
           AND status IN ('active', 'active_limited')
       )::int                                                   AS active_count,

       COUNT(*)::int                                            AS lifetime_count,

       MAX(created_at) FILTER (WHERE status <> 'deleted')       AS last_submit_at

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
    "SELECT identity_verified FROM public.users WHERE id = $1 FOR NO KEY UPDATE",
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
  const { rows: stats } = await fetchSellerStats(pool, sellerId);
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
        upgrade_message     :
          "Verify your identity to remove posting cooldowns.",
      },
    };
  }

  return null;
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
              active_until = NOW() + ($2 || ' days')::INTERVAL,
              updated_at   = NOW()
       WHERE  seller_id    = $1
         AND  status       = 'active_limited'
         AND  (active_until IS NULL OR active_until > NOW())
       RETURNING id, title`,
      [sellerId, FREE_LISTING_DAYS]
    );

    if (rowCount > 0) {
      console.log(
        `[addproduct] reactivated ${rowCount} listing(s) for seller ${sellerId}`
      );
      createNotification({
        userId  : sellerId,
        type    : "listings_reactivated",
        title   : "Listings Made Permanent 🎉",
        message :
          `${rowCount} listing${rowCount !== 1 ? "s" : ""} ` +
          `have been upgraded to full active status. ` +
          `Each listing is now live for ${FREE_LISTING_DAYS} days and renewable.`,
      }).catch(() => {});

      if (redis) {
        for (const r of rows) trackTrending(r.id).catch(() => {});
      }
    }

    return rowCount;
  } catch (err) {
    console.error("[addproduct] reactivateLimitedListings error:", err.message);
    Sentry.captureException?.(err, { tags: { area: "cron_reactivate" } });
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
      console.log(`[addproduct] paused ${rowCount} expired trial listing(s)`);

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
    Sentry.captureException?.(err, { tags: { area: "cron_pause_expired" } });
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
           COUNT(*)                                              AS total_listings,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)   AS median_price,
           MIN(price)                                            AS min_price,
           MAX(price)                                            AS max_price,
           AVG(price)                                            AS avg_price
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
          message  : "Not enough listings to show price guidance.",
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
            `Most sellers price between ` +
            `₦${Math.round(Number(stats.min_price)).toLocaleString("en-NG")} and ` +
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
        success           : true,
        seller_verified   : ctx.isVerified,
        daily_limit       : ctx.policy.dailyLimit,
        daily_used        : ctx.todayCount,
        daily_remaining   : Math.max(0, ctx.policy.dailyLimit - ctx.todayCount),
        active_limit      : ctx.policy.activeLimit,
        active_count      : ctx.activeCount,
        active_remaining  : Math.max(0, ctx.policy.activeLimit - ctx.activeCount),
        cooldown_seconds  : ctx.cooldownSecsLeft,
        expiry_days       : ctx.isVerified
          ? FREE_LISTING_DAYS
          : ctx.policy.expiryDays,
        can_reactivate    : ctx.policy.canReactivate,
        trial_exhausted   : ctx.trialExhausted,
        trial_remaining   : ctx.trialRemaining,
        lifetime_used     : ctx.lifetimeCount,
        lifetime_max      : ctx.isVerified
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
        `SELECT
           p.id, p.status, p.is_active, p.active_until,
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

      const p         = rows[0];
      const isLimited = p.status === "active_limited";
      const isExpired =
        p.active_until && new Date(p.active_until) < new Date();
      const days      = daysUntilExpiry(p.active_until);

      return res.json({
        success            : true,
        status             : p.status,
        is_active          : p.is_active,
        active_until       : p.active_until,
        is_first_product   : p.is_first_product,
        seller_verified    : p.seller_verified,
        needs_verification : isLimited && !isExpired,
        is_expired         : !!isExpired,
        days_remaining     : days,
      });
    } catch (err) {
      console.error("[addproduct] STATUS ERROR:", err.message);
      return fail(res, 500, "Server error.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /products  — Create product
═══════════════════════════════════════════════════════════════ */
router.post(
  "/products",
  authenticate,
  createProductLimiter,
  withImageUpload(upload.array("images", MAX_IMAGES)),
  async (req, res) => {
    const sellerId = req.user?.id;
    const ip       = getIp(req);

    console.log("\n[addproduct] ▶ CREATE  seller:", sellerId);
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
    const attributes  = safeParseGuarded(req.body.attributes, {});
    const delivery    = safeParseGuarded(req.body.delivery,   {});
    const contact     = safeParseGuarded(req.body.contact,    {});
    const whatsappLink = sanitizeWhatsAppLink(
      cleanText(req.body.whatsapp_link)
    );

    /* ── Validation ── */
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
      console.warn("[addproduct] spam detected seller:", sellerId);
      return fail(res, 403, "Listing flagged as spam.", {
        reasons: spamResult.reasons ?? [],
      });
    }

    /* ── PHASE 1: Pre-upload policy check ── */
    if (requestedStatus === "active") {
      try {
        const preCtx   = await getSellerContextPreUpload(sellerId);
        const earlyErr = enforcePolicyLimits(preCtx);
        if (earlyErr) {
          console.log("[addproduct] pre-upload block:", earlyErr.message);
          return fail(res, earlyErr.status, earlyErr.message, earlyErr.extra);
        }
      } catch (preErr) {
        console.warn(
          "[addproduct] pre-upload check failed (non-fatal):", preErr.message
        );
      }
    }

    /* ── Early category validation ── */
    const earlyCategory = await validateCategoryEarly(categoryId, subcategoryId);
    if (!earlyCategory.valid) return fail(res, 400, earlyCategory.message);

    /* ══════════════════════════════════════════════════════════
       COMPRESS + WATERMARK + UPLOAD
       - Max 2 images processed concurrently (pLimit)
       - Each image: resize → watermark → quality loop → R2
       - Input:  up to 5 MB per image (multer)
       - Output: targets ≤ 500 KB per image stored in R2
    ══════════════════════════════════════════════════════════ */
    console.log(
      "[addproduct] processing", files.length, "image(s) — max 2 concurrent"
    );

    let uploaded;
    try {
      uploaded = await Promise.all(
        files.map((file, i) =>
          imageLimit(async () => {
            const { buffer, mimetype } = await compressImage(
              file.buffer,
              file.mimetype
            );
            const { url, key } = await uploadToR2(buffer, mimetype);
            console.log(
              `[addproduct] image ${i + 1}/${files.length} uploaded` +
              ` — ${(buffer.length / 1_024).toFixed(0)} KB → ${key}`
            );
            return { url, key, order: i };
          })
        )
      );
    } catch (uploadErr) {
      console.error("[addproduct] compress/upload failed:", uploadErr.message);

      const isUserError =
        uploadErr.message.includes("too small") ||
        uploadErr.message.includes("Invalid") ||
        uploadErr.message.includes("corrupt");

      if (!isUserError) {
        Sentry.captureException?.(uploadErr, {
          tags  : { area: "image_upload", seller_id: sellerId },
          extra : { fileCount: files.length },
        });
      }

      return fail(
        res,
        isUserError ? 400 : 500,
        isUserError
          ? uploadErr.message
          : "Image upload failed. Please try again."
      );
    }

    const thumbnail = uploaded[0]?.url ?? null;
    const r2Keys    = uploaded.map((u) => u.key);

    /* ── PHASE 2: Locked transaction ── */
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
          return fail(res, policyErr.status, policyErr.message, policyErr.extra);
        }
      }

      /* ── Determine final status + expiry ── */
      let finalStatus = requestedStatus;
      let finalActive = requestedStatus === "active";
      let activeUntil = null;

      if (requestedStatus === "active") {
        if (!ctx.isVerified) {
          finalStatus = "active_limited";
          finalActive = true;
          activeUntil = computeActiveUntil(false);
        } else {
          finalStatus = "active";
          finalActive = true;
          activeUntil = computeActiveUntil(true);
        }
      }

      /* ── Slug — SAVEPOINT retry on collision ── */
      const shortId   = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      const baseSlug  = generateBaseSlug(title).slice(0, 60);
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

      await client.query("SAVEPOINT before_insert");
      try {
        product = await insertProduct(firstSlug);
      } catch (firstErr) {
        await client.query("ROLLBACK TO SAVEPOINT before_insert");
        if (
          firstErr.code === "23505" &&
          firstErr.constraint?.includes("slug")
        ) {
          console.warn("[addproduct] slug collision — retrying with UUID fallback");
          product = await insertProduct(
            `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`
          );
        } else {
          throw firstErr;
        }
      }
      await client.query("RELEASE SAVEPOINT before_insert");

      if (!product) {
        await client.query("ROLLBACK");
        await destroyR2Assets(r2Keys);
        return fail(res, 500, "Failed to create product record. Please try again.");
      }

      /* ── Insert product_images ── */
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

      /* ── Update images JSONB ── */
      const imagesJson = JSON.stringify(
        uploaded.map((img) => ({
          url   : img.url,
          key   : img.key,
          order : img.order,
        }))
      );
      await client.query(
        `UPDATE products SET images = $1 WHERE id = $2`,
        [imagesJson, product.id]
      );
      product.images = JSON.parse(imagesJson);

      await client.query("COMMIT");
      console.log(
        "[addproduct] ✓ created  id:", product.id,
        " status:", finalStatus,
        " expires:", activeUntil?.toISOString() ?? "never"
      );

      /* ── Post-commit side effects ── */
      setImmediate(() => {
        if (imageHashes.length > 0)
          storeImageHashes(product.id, imageHashes).catch(() => {});

        writeAudit({
          actorId    : sellerId,
          action     : "product_created",
          targetType : "product",
          targetId   : product.id,
          metadata   : {
            title,
            status          : finalStatus,
            active_until    : activeUntil,
            is_verified     : ctx.isVerified,
            lifetime_count  : ctx.lifetimeCount + 1,
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

        /* Notifications */
        const needsVerification = finalStatus === "active_limited";
        const isFreeListing     = finalStatus === "active" && activeUntil !== null;
        const trialInfo         = buildTrialInfo(ctx);
        const expiryDays        = daysUntilExpiry(activeUntil);

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

        } else if (isFreeListing) {
          createNotification({
            userId  : sellerId,
            type    : "listing_posted",
            title   : "Listing Posted ✓",
            message :
              `"${title}" is now live for ${FREE_LISTING_DAYS} days. ` +
              "You'll be notified 3 days before it expires so you can renew for free.",
          }).catch(() => {});
        }
      });

      /* ── Response ── */
      const needsVerification = finalStatus === "active_limited";
      const trialInfo         = buildTrialInfo(ctx);
      const expiryDays        = daysUntilExpiry(activeUntil);

      return res.status(201).json({
        success            : true,
        product,
        first_product      : ctx.isFirstProduct,
        needs_verification : needsVerification,
        active_until       : activeUntil ?? null,
        days_remaining     : expiryDays,
        seller_verified    : ctx.isVerified,
        trial              : trialInfo,
        limits             : {
          daily_limit  : ctx.policy.dailyLimit,
          daily_used   : ctx.todayCount + 1,
          daily_left   : Math.max(0, ctx.policy.dailyLimit - ctx.todayCount - 1),
          active_limit : ctx.policy.activeLimit,
          active_count : ctx.activeCount + 1,
        },
        ...(activeUntil && {
          expiry_message: needsVerification
            ? `Your listing is live for ${expiryDays} days (trial). ` +
              "Verify your identity to post permanently."
            : `Your listing is live for ${expiryDays} days. ` +
              "You can renew it for free before it expires.",
        }),
        ...(needsVerification && {
          verification_message: trialInfo?.trial_exhausted
            ? "You have used all your free trial listings. " +
              "Verify your identity to continue posting on Loemart."
            : `Your listing is live for ${expiryDays} days. ` +
              `You have ${trialInfo?.trial_remaining ?? 0} free trial listing(s) remaining. ` +
              "Verify your identity for unlimited posting.",
        }),
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      await destroyR2Assets(r2Keys);
      console.error("[addproduct] CREATE ERROR:", err.message, "\n", err.stack);

      if (!["LIMIT_FILE_SIZE", "23505", "INVALID_MIME"].includes(err.code)) {
        Sentry.captureException?.(err, {
          tags  : { area: "product_create", seller_id: sellerId },
          extra : { title, categoryId, fileCount: files.length },
        });
      }

      if (err.code === "LIMIT_FILE_SIZE")
        return fail(res, 400, "Image too large — maximum 5 MB per image.");
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
      "\n[addproduct] ▶ ACTIVATE  product:", productId,
      " seller:", sellerId
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
        "SELECT identity_verified FROM public.users WHERE id = $1 FOR NO KEY UPDATE",
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
      } else {
        finalStatus = "active";
        activeUntil = computeActiveUntil(true);
      }

      const { rows: updated } = await client.query(
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
          actorId    : sellerId,
          action     : "product_activated",
          targetType : "product",
          targetId   : productId,
          metadata   : { status: finalStatus, active_until: activeUntil },
          ipAddress  : ip,
        }).catch(() => {});

        trackTrending(productId).catch(() => {});
      });

      console.log(
        "[addproduct] ✓ activated  status:", finalStatus,
        " expires:", activeUntil?.toISOString()
      );

      return res.json({
        success            : true,
        product            : updated[0],
        needs_verification : needsVerification,
        active_until       : activeUntil,
        days_remaining     : expiryDays,
        seller_verified    : isVerified,
        expiry_message     : needsVerification
          ? `Your listing is live for ${expiryDays} days (trial). ` +
            "Verify your identity to post permanently."
          : `Your listing is live for ${expiryDays} days. ` +
            "You can renew it for free before it expires.",
        ...(needsVerification && {
          verification_message:
            `Your listing is live for ${expiryDays} day${expiryDays !== 1 ? "s" : ""}. ` +
            "Complete identity verification to make it permanent.",
        }),
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[addproduct] ACTIVATE ERROR:", err.message);
      Sentry.captureException?.(err, {
        tags: { area: "product_activate", seller_id: sellerId },
      });
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
   DELETE /products/:id  — Soft delete
═══════════════════════════════════════════════════════════════ */
router.delete(
  "/products/:id",
  authenticate,
  async (req, res) => {
    const sellerId  = req.user?.id;
    const productId = req.params.id;
    const ip        = getIp(req);
    const HOLD_DAYS = 30;

    console.log(
      "\n[addproduct] ▶ SOFT DELETE  product:", productId,
      " seller:", sellerId
    );
    if (!sellerId) return fail(res, 401, "Not authenticated.");

    try {
      const { rows: check } = await pool.query(
        `SELECT id, status, is_deleted
         FROM public.products
         WHERE id = $1 AND seller_id = $2
         LIMIT 1`,
        [productId, sellerId]
      );

      if (!check.length)
        return fail(res, 404, "Product not found or not owned by you.");

      if (check[0].is_deleted)
        return fail(res, 400, "Product already deleted.");

      if (check[0].status === "active") {
        return fail(
          res,
          409,
          "Active listings must be paused before deleting. " +
          "Tap the pause button first, then delete."
        );
      }

      const { rows } = await pool.query(
        `UPDATE products
         SET
           is_active             = false,
           status                = 'deleted',
           deletion_requested_at = NOW(),
           deletion_reason       = 'user_deleted',
           permanent_delete_at   = NOW() + ($1 || ' days')::INTERVAL,
           deleted_at            = NOW(),
           updated_at            = NOW()
         WHERE id        = $2
           AND seller_id = $3
           AND is_deleted = false
         RETURNING id, title`,
        [HOLD_DAYS, productId, sellerId]
      );

      if (!rows.length)
        return fail(res, 404, "Product not found or already deleted.");

      setImmediate(() => {
        writeAudit({
          actorId    : sellerId,
          action     : "product_soft_deleted",
          targetType : "product",
          targetId   : productId,
          metadata   : {
            title       : rows[0].title,
            hold_days   : HOLD_DAYS,
            recoverable : true,
          },
          ipAddress : ip,
        }).catch(() => {});
      });

      console.log(
        "[addproduct] ✓ soft-deleted  id:", productId,
        " — permanent deletion in", HOLD_DAYS, "days"
      );

      return res.json({
        success             : true,
        message             : "Listing deleted",
        hold_days           : HOLD_DAYS,
        permanent_delete_at : new Date(
          Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1_000
        ).toISOString(),
      });

    } catch (err) {
      console.error("[addproduct] DELETE ERROR:", err.message);
      Sentry.captureException?.(err, {
        tags: { area: "product_delete", seller_id: sellerId },
      });
      return fail(
        res,
        500,
        IS_PROD ? "Delete failed. Please try again." : err.message
      );
    }
  }
);

export default router;