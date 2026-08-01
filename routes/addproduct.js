/**
 * routes/addproduct.js
 *
 * Targets CockroachDB (serverless / dedicated).
 *
 * v8.1 — Phone Number Optional Update
 * ─────────────────────────────────────────────────────────────
 *  - Phone number is now OPTIONAL
 *  - Email is NEVER stored in products table
 *  - Email lives only in users table (registration email)
 *  - 3-TIER SYSTEM:
 *      unverified  → 3 lifetime trial listings   (7-day expiry)
 *      verified    → 500 lifetime listings       (30-day expiry)
 *      subscriber  → Unlimited                   (90-day expiry)
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
}

/* ═══════════════════════════════════════════════════════════════
   DEBUG LOGGER
═══════════════════════════════════════════════════════════════ */
const logError = (area, err, extra = {}) => {
  console.error(`\n[addproduct] ❌ ERROR in: ${area}`);
  console.error("Message   :", err.message);
  if (Object.keys(extra).length) console.error("Extra     :", JSON.stringify(extra, null, 2));
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
    await r2.send(new DeleteObjectsCommand({
      Bucket: R2_BUCKET,
      Delete: { Objects: keys.map((k) => ({ Key: k })), Quiet: true }
    }));
  } catch (e) {
    console.error("[addproduct] R2 cleanup failed:", e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & POLICIES
═══════════════════════════════════════════════════════════════ */
const MAX_IMAGES          = 6;
const MAX_JSON_BYTES      = 8_192;
const SLUG_MAX            = 60;
const PRICE_MAX           = 1_000_000_000;
const TITLE_MAX           = 120;
const DESC_MIN            = 10;
const DESC_MAX            = 2_000;
const DELETE_HOLD_DAYS    = 30;
const PAYMENT_MAX_AGE_MS  = 30 * 60 * 1_000;
const PROMO_DEFAULT_DAYS  = 7;
const ACCEPTED_CURRENCY   = "NGN";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const FRONTEND_URL    = process.env.FRONTEND_URL?.replace(/\/$/, "");

const POLICY = Object.freeze({
  unverified: { dailyLimit: 3, activeLimit: 3, cooldownMinutes: 10, expiryDays: 7, freeListingDays: 7, totalLifetimeMax: 3 },
  verified:   { dailyLimit: 50, activeLimit: 500, cooldownMinutes: 0, expiryDays: 30, freeListingDays: 30, totalLifetimeMax: 500 },
  subscriber: { dailyLimit: 10000, activeLimit: 1000000, cooldownMinutes: 0, expiryDays: 0, freeListingDays: 90, totalLifetimeMax: null },
});

const IMAGE_CONFIG = Object.freeze({
  maxInputBytes: 5 * 1048576,
  maxOutputBytes: 500000,
  maxDimension: 1200,
  minDimension: 300,
  webpQualityInit: 82,
  webpQualityMin: 55,
  webpQualityStep: 8,
  watermark: {
    enabled: true,
    logoPath: path.join(__dirname, "../assets/watermark-logo.png"),
    text: "Loemart.com",
    opacity: 0.40,
    padding: 20,
    fontSizeRatio: 0.045,
    shadowOpacity: 0.60,
  }
});

const imageLimit = pLimit(2);

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

const cleanText = (v) => { const s = String(v ?? "").trim(); return s || null; };
const cleanUuid = (v) => { const s = String(v ?? "").trim(); return UUID_RE.test(s) ? s : null; };
const toFinite = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

const safeParse = (v, fallback) => { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

/**
 * UPDATED: validatePhone is now optional
 */
const validatePhone = (value, label) => {
  if (!value) return null; // Field is now optional
  const cleaned = String(value).replace(/[\s\-().]/g, "");
  if (!PHONE_RE.test(cleaned))
    return `${label} must be 7–15 digits (e.g. 08012345678).`;
  return null;
};

const sanitizeWhatsAppLink = (raw) => {
  if (!raw) return null;
  try {
    const url = new URL(String(raw).trim());
    return (url.protocol === "https:" && url.hostname.includes("wa.me")) ? url.href : null;
  } catch { return null; }
};

const getIp = (req) => req.ip ?? req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? null;

const computeActiveUntil = (tier) => {
  const policy = POLICY[tier] ?? POLICY.unverified;
  if (tier === "subscriber") return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + (policy.freeListingDays ?? 7));
  return d;
};

const daysUntilExpiry = (activeUntil) => activeUntil ? Math.ceil((new Date(activeUntil).getTime() - Date.now()) / 86400000) : null;

/* ═══════════════════════════════════════════════════════════════
   IMAGE PROCESSING
═══════════════════════════════════════════════════════════════ */
const compressImage = async (buffer) => {
  const meta = await sharp(buffer).metadata();
  if (meta.width < IMAGE_CONFIG.minDimension || meta.height < IMAGE_CONFIG.minDimension)
    throw new Error(`Image too small. Min ${IMAGE_CONFIG.minDimension}px.`);

  let pipeline = sharp(buffer)
    .rotate()
    .resize({ width: IMAGE_CONFIG.maxDimension, height: IMAGE_CONFIG.maxDimension, fit: "inside", withoutEnlargement: true });

  let quality = IMAGE_CONFIG.webpQualityInit;
  let finalBuffer = await pipeline.webp({ quality }).toBuffer();

  while (finalBuffer.length > IMAGE_CONFIG.maxOutputBytes && quality > IMAGE_CONFIG.webpQualityMin) {
    quality -= IMAGE_CONFIG.webpQualityStep;
    finalBuffer = await pipeline.webp({ quality }).toBuffer();
  }

  return { buffer: finalBuffer, mimetype: "image/webp" };
};

/* ═══════════════════════════════════════════════════════════════
   MULTER & LIMITERS
═══════════════════════════════════════════════════════════════ */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_CONFIG.maxInputBytes, files: MAX_IMAGES }
});

const withImageUpload = (handler) => (req, res, next) =>
  handler(req, res, (err) => {
    if (!err) return next();
    return res.status(400).json({ success: false, message: err.message });
  });

const makeLimiter = (max, win) => rateLimit({
  windowMs: win * 60000, max, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id ?? req.ip),
  handler: (req, res) => res.status(429).json({ success: false, message: "Too many requests." })
});

const createLimiter = makeLimiter(IS_PROD ? 20 : 500, 60);
const readLimiter   = makeLimiter(IS_PROD ? 120 : 1000, 5);
const editLimiter   = makeLimiter(IS_PROD ? 60 : 500, 30);

/* ═══════════════════════════════════════════════════════════════
   SELLER CONTEXT & POLICY
═══════════════════════════════════════════════════════════════ */
const getSellerContext = async (db, sellerId) => {
  const { rows: users } = await db.query(
    `SELECT identity_verified, subscription_plan, subscription_status, subscription_expires_at, email
     FROM public.users WHERE id = $1`, [sellerId]
  );
  if (!users.length) throw new Error("Seller not found.");
  const u = users[0];

  const hasSub = u.subscription_status === "active" && u.subscription_plan !== "free" && new Date(u.subscription_expires_at) > new Date();
  const tier = hasSub ? "subscriber" : (u.identity_verified ? "verified" : "unverified");

  const { rows: stats } = await db.query(
    `SELECT 
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as today_count,
      COUNT(*) FILTER (WHERE is_active = TRUE) as active_count,
      COUNT(*) as lifetime_count,
      MAX(created_at) as last_submit_at
     FROM products WHERE seller_id = $1 AND status <> 'deleted'`, [sellerId]
  );
  
  const s = stats[0];
  const policy = POLICY[tier];
  const cooldownMs = policy.cooldownMinutes * 60000;
  const secsLeft = s.last_submit_at ? Math.max(0, Math.ceil((cooldownMs - (Date.now() - new Date(s.last_submit_at).getTime())) / 1000)) : 0;

  return {
    tier, policy, todayCount: parseInt(s.today_count), activeCount: parseInt(s.active_count),
    lifetimeCount: parseInt(s.lifetime_count), cooldownSecsLeft: secsLeft, email: u.email,
    isVerified: tier !== "unverified"
  };
};

const enforcePolicyLimits = (ctx) => {
  if (ctx.policy.totalLifetimeMax && ctx.lifetimeCount >= ctx.policy.totalLifetimeMax)
    return { status: 403, message: `Limit reached (${ctx.policy.totalLifetimeMax} listings). Upgrade to continue.` };
  if (ctx.todayCount >= ctx.policy.dailyLimit)
    return { status: 429, message: "Daily limit reached." };
  if (ctx.activeCount >= ctx.policy.activeLimit)
    return { status: 429, message: "Active limit reached." };
  if (ctx.cooldownSecsLeft > 0)
    return { status: 429, message: `Wait ${Math.ceil(ctx.cooldownSecsLeft / 60)}m.` };
  return null;
};

/* ═══════════════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════════════ */

router.get("/categories", getCategoriesHandler);

/* ── POST /products (CREATE) ── */
router.post("/products", authenticate, createLimiter, withImageUpload(upload.array("images", MAX_IMAGES)), async (req, res) => {
  const sellerId = req.user?.id;
  if (!sellerId) return fail(res, 401, "Not authenticated.");

  const { title, description, price, category_id, subcategory_id, location_state, location_city, seller_name, phone, whatsapp, status: rawStatus } = req.body;
  const files = req.files ?? [];

  // Basic Validation
  if (!title || title.length > TITLE_MAX) return fail(res, 400, "Invalid title.");
  if (!description || description.length < DESC_MIN) return fail(res, 400, "Description too short.");
  if (!price || price <= 0 || price > PRICE_MAX) return fail(res, 400, "Invalid price.");
  if (!category_id) return fail(res, 400, "Category required.");
  if (!files.length) return fail(res, 400, "Image required.");

  /**
   * Phone is now optional
   */
  if (phone) {
    const phoneErr = validatePhone(phone, "Phone number");
    if (phoneErr) return fail(res, 400, phoneErr);
  }

  try {
    const ctx = await getSellerContext(pool, sellerId);
    const policyErr = enforcePolicyLimits(ctx);
    if (policyErr && rawStatus !== "draft") return fail(res, policyErr.status, policyErr.message);

    // Image Upload
    const uploaded = await Promise.all(files.map((f, i) => imageLimit(async () => {
      const { buffer, mimetype } = await compressImage(f.buffer);
      return uploadToR2(buffer, mimetype);
    })));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const finalStatus = ctx.tier === "unverified" ? "active_limited" : "active";
      const activeUntil = computeActiveUntil(ctx.tier);
      const slug = `${generateBaseSlug(title)}-${crypto.randomBytes(3).toString("hex")}`;

      const { rows } = await client.query(
        `INSERT INTO products (
          title, description, price, seller_id, category_id, subcategory_id,
          thumbnail_url, main_image, slug, status, is_active, active_until,
          location_state, location_city, seller_name, phone, whatsapp, images
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
        [
          cleanText(title), cleanText(description), price, sellerId, cleanUuid(category_id), cleanUuid(subcategory_id),
          uploaded[0].url, slug, finalStatus, true, activeUntil,
          cleanText(location_state), cleanText(location_city), cleanText(seller_name), cleanText(phone), cleanText(whatsapp),
          JSON.stringify(uploaded)
        ]
      );

      await client.query("COMMIT");

      setImmediate(() => {
        writeAudit({ actorId: sellerId, action: "product_created", targetId: rows[0].id }).catch(() => {});
        updateSellerTrust(sellerId).catch(() => {});
      });

      return res.status(201).json({ success: true, product: rows[0], days_remaining: daysUntilExpiry(activeUntil) });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    logError("POST /products", err);
    return fail(res, 500, err.message);
  }
});

/* ── PATCH /products/:id (EDIT) ── */
router.patch("/products/:id", authenticate, editLimiter, withImageUpload(upload.array("images", MAX_IMAGES)), async (req, res) => {
  const sellerId = req.user?.id;
  const productId = req.params.id;
  const { title, description, price, category_id, phone } = req.body;

  if (phone) {
    const phoneErr = validatePhone(phone, "Phone number");
    if (phoneErr) return fail(res, 400, phoneErr);
  }

  try {
    const { rows: existing } = await pool.query("SELECT seller_id FROM products WHERE id = $1", [productId]);
    if (!existing.length || existing[0].seller_id !== sellerId) return fail(res, 403, "Unauthorized.");

    const { rows } = await pool.query(
      `UPDATE products SET 
        title = COALESCE($1, title), 
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        category_id = COALESCE($4, category_id),
        phone = $5,
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [cleanText(title), cleanText(description), price, cleanUuid(category_id), cleanText(phone), productId]
    );

    return res.json({ success: true, product: rows[0] });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/* ── DELETE /products/:id (SOFT DELETE) ── */
router.delete("/products/:id", authenticate, async (req, res) => {
  const sellerId = req.user?.id;
  try {
    const { rowCount } = await pool.query(
      "UPDATE products SET status = 'deleted', is_active = FALSE, updated_at = NOW() WHERE id = $1 AND seller_id = $2",
      [req.params.id, sellerId]
    );
    if (!rowCount) return fail(res, 404, "Not found.");
    return res.json({ success: true, message: "Deleted." });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

export default router;