// routes/products.js
import express        from "express";
import multer         from "multer";
import rateLimit      from "express-rate-limit";
import { v2 as cloudinary } from "cloudinary";
import { pool }       from "../config/db.js";
import authenticate   from "../middleware/auth.js";
import requireAdmin   from "../middleware/requireAdmin.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════
   CLOUDINARY
═══════════════════════════════════════════════════════════ */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

{
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  if (!cloud_name || !api_key || !api_secret)
    console.error("⚠️  CLOUDINARY NOT CONFIGURED — check environment variables");
}

/* ═══════════════════════════════════════════════════════════
   MULTER
═══════════════════════════════════════════════════════════ */
const upload = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: 10 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/"))
      return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

/* ═══════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════ */
const postLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             10,
  keyGenerator:    (req) => req.user?.id || req.ip,
  message:         { success: false, message: "Too many requests. Slow down." },
  standardHeaders: true,
  legacyHeaders:   false,
});

const readLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             120,
  keyGenerator:    (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders:   false,
});

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
export const PRODUCT_STATUS = {
  DRAFT:             "draft",
  SUBMITTED:         "submitted",
  PENDING:           "pending_review",
  CHANGES_REQUESTED: "changes_requested",
  ACTIVE:            "active",
  REJECTED:          "rejected",
  PAUSED:            "paused",
  OUT_OF_STOCK:      "out_of_stock",
  ARCHIVED:          "archived",
  BANNED:            "banned",
};

export const VALID_STATUSES = new Set(Object.values(PRODUCT_STATUS));

export const RISK_LEVEL = {
  LOW:      "low",
  MEDIUM:   "medium",
  HIGH:     "high",
  CRITICAL: "critical",
};

/* ─── Valid category UUIDs ─── */
export const VALID_CATEGORY_IDS = new Set([
  "102055d1-180a-4b8f-a39b-3b20a4838e90",
  "20371324-5130-4952-91ed-29cf67c93f72",
  "3079d791-8695-47ef-aaa1-78b9eabb32fe",
  "39dc4492-0754-4826-816b-bc32f31081d0",
  "3c93ad90-2b69-4072-b2cb-748384f44d3f",
  "46f8dcab-69d0-4fa0-aead-f9ab6c64c139",
  "4aba6a69-2b1c-4b19-9ca0-3b2630ef6fdb",
  "4bb82894-f6aa-478a-8541-da3305d5a293",
  "4d13f1aa-bd53-49a1-9e86-cf33ece1b254",
  "6609d41f-7fd5-469d-8155-9a7c0a7d05f3",
  "754e63f4-7e20-483c-a9c2-6782e615bd2d",
  "85d13ecd-a84a-4c39-8358-db890206e280",
  "8ba64fb7-33a6-415e-a895-38d778a49075",
  "947ce100-d961-4455-bfbf-c1d33537f11b",
  "b2345835-2bf3-4749-a1e9-760e8159ecc6",
  "b236303d-3ccf-4169-8321-81243d796481",
  "bba9b3e7-4118-42c4-9ea9-4aa2afd445dc",
  "c96bba5b-a9f8-43ed-8dbb-3326f34e07c0",
  "cb32087f-c235-466e-9e75-6fbee393903b",
  "cf185f2a-d291-40cc-8694-67291f1a6a26",
  "d30edb05-1f94-41e6-9400-6f8d8252a29b",
  "d6b767d7-1f3b-46cc-9e67-00b699e4ec04",
  "e6d02486-ce55-4718-a096-6af8001d4a2c",
  "e70d46b2-9450-42ee-a938-4235c319b8b3",
  "fc1acba9-a5ca-4a82-8305-81586ecb75e1",
]);

const CONDITIONS = ["new", "like_new", "good", "fair", "refurbished"];

const ORDER_MAP = {
  newest:     "p.created_at DESC",
  oldest:     "p.created_at ASC",
  price_asc:  "p.base_price ASC",
  price_desc: "p.base_price DESC",
  popular:    "p.views DESC",
  quality:    "p.quality_score DESC",
  trending:   "(p.views * 0.2 + p.likes * 0.3 + p.quality_score * 0.5) DESC",
};

/* ═══════════════════════════════════════════════════════════
   CLOUDINARY HELPERS
═══════════════════════════════════════════════════════════ */
const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:         "minimart/products",
        transformation: [
          { width: 1200, height: 1200, crop: "limit" },
          { quality: "auto:good" },
          { fetch_format: "auto" },
        ],
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });

const uploadBatch = async (files, concurrency = 3) => {
  const results = [];
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    results.push(...await Promise.all(batch.map((f) => uploadToCloudinary(f.buffer))));
  }
  return results;
};

const destroyImages = async (publicIds = []) => {
  if (!publicIds.length) return;
  await Promise.allSettled(
    publicIds.map((id) => cloudinary.uploader.destroy(id))
  );
};

/* ═══════════════════════════════════════════════════════════
   UTILITY HELPERS
═══════════════════════════════════════════════════════════ */
const safeJSON = (data, fallback = []) => {
  if (Array.isArray(data))      return data;
  if (typeof data !== "string") return fallback;
  try   { return JSON.parse(data); }
  catch { return fallback; }
};

const generateSlug = (name) => {
  const base = (name || "product")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .substring(0, 60);
  return `${base}-${Date.now().toString(36)}`;
};

const generateSearchKeywords = ({ name, description, brandName, tags, features }) => {
  const raw = [name, description, brandName, ...(tags || []), ...(features || [])]
    .filter(Boolean)
    .join(" ");

  return [...new Set(
    raw.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  )].slice(0, 50).join(" ");
};

/* ═══════════════════════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════════════════════ */
function validateProductBody({ name, categoryId, basePrice, condition }) {
  const errors  = [];
  const trimmed = (name || "").trim();

  if (!trimmed || trimmed.length < 3)
    errors.push("Product name is required (min 3 characters)");
  if (trimmed.length > 80)
    errors.push("Product name max 80 characters");
  if (!categoryId)
    errors.push("Category is required");
  else if (!VALID_CATEGORY_IDS.has(categoryId))
    errors.push("Invalid category selected");
  if (!condition || !CONDITIONS.includes(condition))
    errors.push(`Condition must be one of: ${CONDITIONS.join(", ")}`);

  const price = Number(basePrice);
  if (!basePrice || isNaN(price) || price <= 0)
    errors.push("A valid selling price is required");

  return errors;
}

/* ═══════════════════════════════════════════════════════════
   FRAUD / SPAM DETECTION
═══════════════════════════════════════════════════════════ */
async function runFraudEngine({ name, description, price, sellerId }) {
  let   fraudScore     = 0;
  let   duplicateScore = 0;
  let   spamScore      = 0;
  const flags          = [];
  let   autoAction     = null;

  const text = `${name || ""} ${description || ""}`.toLowerCase();

  /* 1. Load rules from DB */
  const { rows: rules } = await pool.query(
    `SELECT rule_type, pattern, action, score_delta
     FROM market.moderation_rules
     WHERE is_active = true`
  );

  for (const rule of rules) {
    let triggered = false;
    switch (rule.rule_type) {
      case "banned_word":
        triggered = text.includes(rule.pattern.toLowerCase());
        break;
      case "spam_pattern":
        if (rule.pattern === "phone_in_text")
          triggered = /(\+?234|0)[789][01]\d{8}/.test(text);
        else if (rule.pattern === "url_in_text")
          triggered = /https?:\/\/|www\./i.test(text);
        else if (rule.pattern === "all_caps")
          triggered = !!name && name === name.toUpperCase() && name.length > 6;
        break;
      case "price_check":
        if (rule.pattern === "price_too_low")
          triggered = Number(price) > 0 && Number(price) < 100;
        break;
      default:
        break;
    }

    if (triggered) {
      spamScore += Number(rule.score_delta) || 0;
      flags.push(rule.rule_name);
      if (rule.action === "auto_reject")
        autoAction = "auto_reject";
      else if (rule.action === "auto_flag" && autoAction !== "auto_reject")
        autoAction = "auto_flag";
    }
  }

  /* 2. Duplicate title */
  if (sellerId && name) {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM market.products
       WHERE seller_id  = $1
         AND LOWER(name) = LOWER($2)
         AND deleted_at IS NULL
         AND status NOT IN ('banned','deleted')`,
      [sellerId, name.trim()]
    );
    if (parseInt(rows[0].cnt, 10) > 0) {
      duplicateScore = 40;
      flags.push("Duplicate product title");
    }
  }

  /* 3. Excessive posting (10 in 1 hour) */
  if (sellerId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM market.products
       WHERE seller_id  = $1
         AND created_at > now() - INTERVAL '1 hour'
         AND deleted_at IS NULL`,
      [sellerId]
    );
    if (parseInt(rows[0].cnt, 10) >= 10) {
      spamScore += 30;
      flags.push("High post frequency");
    }
  }

  fraudScore = Math.min(100, spamScore + Math.round(duplicateScore * 0.5));

  const riskLevel =
    fraudScore >= 75 ? RISK_LEVEL.CRITICAL :
    fraudScore >= 50 ? RISK_LEVEL.HIGH     :
    fraudScore >= 25 ? RISK_LEVEL.MEDIUM   :
    RISK_LEVEL.LOW;

  return {
    fraudScore,
    duplicateScore,
    spamScore,
    riskLevel,
    flags,
    autoAction,
    blocked: fraudScore >= 90 || autoAction === "auto_reject",
  };
}

/* ═══════════════════════════════════════════════════════════
   QUALITY SCORE
═══════════════════════════════════════════════════════════ */
function calcQualityScore({
  name, description, imageCount, variantCount,
  featureCount, specCount, brandId,
  warranty, categoryAttribsFilled, tagCount,
}) {
  let score = 0;

  const words = (name || "").trim().split(/\s+/).length;
  if (words >= 3) score += 4;
  if (words >= 6) score += 4;
  if (words >= 9) score += 4;

  const chars = (description || "").trim().length;
  if (chars >= 50)  score += 5;
  if (chars >= 150) score += 7;
  if (chars >= 400) score += 8;

  score += Math.min(20, (imageCount || 0) * 4);
  score += Math.min(10, (variantCount || 0) * 5);
  score += Math.min(8,  (featureCount || 0) * 2);
  score += Math.min(8,  (specCount    || 0) * 2);
  score += Math.min(8,  (categoryAttribsFilled || 0) * 2);
  if (brandId)         score += 5;
  if (warranty?.trim()) score += 4;
  score += Math.min(5, tagCount || 0);

  return Math.min(100, Math.round(score));
}

/* ═══════════════════════════════════════════════════════════
   VENDOR HELPER
═══════════════════════════════════════════════════════════ */
async function ensureVendor(client, userId) {
  const { rows } = await client.query(
    `SELECT id, verification_status, is_active, trust_score
     FROM market.vendors
     WHERE user_id = $1`,
    [userId]
  );
  if (rows.length) return rows[0];

  /* Auto-create minimal vendor profile */
  const { rows: u } = await client.query(
    `SELECT name FROM public.users WHERE id = $1`,
    [userId]
  );
  const name = u[0]?.name || "My Store";
  const slug = generateSlug(name) + `-${userId.substring(0, 6)}`;

  const { rows: v } = await client.query(
    `INSERT INTO market.vendors
       (user_id, business_name, slug, verification_status, is_active)
     VALUES ($1,$2,$3,'pending',false)
     RETURNING id, verification_status, is_active, trust_score`,
    [userId, name, slug]
  );
  return v[0];
}

/* ═══════════════════════════════════════════════════════════
   MODERATION LOG
═══════════════════════════════════════════════════════════ */
async function logModeration(client, {
  productId, adminId, action,
  oldStatus, newStatus, reason,
  message, isSystem, metadata,
}) {
  try {
    await client.query(
      `INSERT INTO market.product_moderation_logs
         (product_id, admin_id, action, old_status, new_status,
          reason, message, is_system, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        productId,
        adminId   || null,
        action,
        oldStatus || null,
        newStatus || null,
        reason    || null,
        message   || null,
        isSystem  || false,
        metadata  ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    /* Non-fatal — never break the main flow */
    console.error("[logModeration]", err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
   BATCH INSERT HELPERS
═══════════════════════════════════════════════════════════ */
async function insertImages(client, productId, uploads) {
  if (!uploads.length) return;
  const json = JSON.stringify(
    uploads.map((u, i) => ({
      url: u.secure_url, pid: u.public_id, primary: i === 0, ord: i,
    }))
  );
  await client.query(
    `INSERT INTO market.product_images
       (product_id, image_url, public_id, is_primary, sort_order)
     SELECT $1, x.url, x.pid, x.primary, x.ord
     FROM jsonb_to_recordset($2::jsonb)
     AS x(url text, pid text, "primary" bool, ord int)`,
    [productId, json]
  );
}

async function insertVariants(client, productId, variants) {
  for (const v of variants) {
    await client.query(
      `INSERT INTO market.product_variants
         (product_id, sku, name, price, stock, attributes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (sku) DO UPDATE SET
         name       = EXCLUDED.name,
         price      = EXCLUDED.price,
         stock      = EXCLUDED.stock,
         attributes = EXCLUDED.attributes,
         updated_at = now()`,
      [
        productId,
        v.sku.trim().toUpperCase(),
        v.name.trim(),
        Number(v.price),
        Math.max(0, parseInt(v.stock, 10) || 0),
        typeof v.attributes === "object" ? v.attributes : {},
      ]
    );
  }
}

async function insertFeatures(client, productId, features) {
  if (!features.length) return;
  const json = JSON.stringify(features.map((f, i) => ({ f, i })));
  await client.query(
    `INSERT INTO market.product_features (product_id, feature, position)
     SELECT $1, x.f, x.i
     FROM jsonb_to_recordset($2::jsonb) AS x(f text, i int)`,
    [productId, json]
  );
}

async function insertSpecs(client, productId, specs) {
  if (!specs.length) return;
  const json = JSON.stringify(
    specs.map((s, i) => ({ k: s.key.trim(), v: s.value.trim(), i }))
  );
  await client.query(
    `INSERT INTO market.product_specifications
       (product_id, spec_key, spec_value, position)
     SELECT $1, x.k, x.v, x.i
     FROM jsonb_to_recordset($2::jsonb) AS x(k text, v text, i int)`,
    [productId, json]
  );
}

async function insertBoxItems(client, productId, items) {
  if (!items.length) return;
  const json = JSON.stringify(items.map((b, i) => ({ b, i })));
  await client.query(
    `INSERT INTO market.product_box_items (product_id, item, position)
     SELECT $1, x.b, x.i
     FROM jsonb_to_recordset($2::jsonb) AS x(b text, i int)`,
    [productId, json]
  );
}

/* ═══════════════════════════════════════════════════════════
   SHARED PRODUCT FETCH (by id or slug)
═══════════════════════════════════════════════════════════ */
async function fetchProduct({ field, identifier, requestingUser, res }) {
  const column = field === "slug" ? "p.slug" : "p.id";

  const { rows } = await pool.query(
    `SELECT
       p.*,
       u.name          AS seller_name,
       u.trust_score   AS seller_trust,
       v.business_name AS vendor_name,
       v.badge         AS vendor_badge,
       v.is_official_store,
       b.name          AS brand_name,
       b.is_verified   AS brand_verified
     FROM market.products p
     LEFT JOIN public.users       u ON u.id = p.seller_id
     LEFT JOIN market.vendors     v ON v.id = p.vendor_id
     LEFT JOIN market.brands      b ON b.id = p.brand_id
     WHERE ${column} = $1
       AND p.deleted_at IS NULL`,
    [identifier]
  );

  if (!rows.length)
    return res.status(404).json({ success: false, message: "Product not found" });

  const product = rows[0];
  const isOwner = requestingUser?.id === product.seller_id;
  const isAdmin = requestingUser?.role === "admin" || requestingUser?.role === "superadmin";

  /* Public users only see active products */
  if (!isOwner && !isAdmin && product.status !== PRODUCT_STATUS.ACTIVE)
    return res.status(404).json({ success: false, message: "Product not found" });

  const [images, variants, features, specs, boxItems] = await Promise.all([
    pool.query(
      `SELECT image_url, public_id, is_primary, sort_order
       FROM market.product_images
       WHERE product_id = $1
       ORDER BY sort_order ASC`,
      [product.id]
    ),
    pool.query(
      `SELECT id, sku, name, price, stock, reserved, attributes, is_active
       FROM market.product_variants
       WHERE product_id = $1
       ORDER BY created_at ASC`,
      [product.id]
    ),
    pool.query(
      `SELECT feature FROM market.product_features
       WHERE product_id = $1 ORDER BY position ASC`,
      [product.id]
    ),
    pool.query(
      `SELECT spec_key, spec_value FROM market.product_specifications
       WHERE product_id = $1 ORDER BY position ASC`,
      [product.id]
    ),
    pool.query(
      `SELECT item FROM market.product_box_items
       WHERE product_id = $1 ORDER BY position ASC`,
      [product.id]
    ),
  ]);

  /* Increment views asynchronously — never block response */
  setImmediate(() =>
    pool.query(
      `UPDATE market.products SET views = views + 1 WHERE id = $1`,
      [product.id]
    ).catch(() => {})
  );

  return res.json({
    success: true,
    product: {
      ...product,
      images:         images.rows,
      variants:       variants.rows,
      keyFeatures:    features.rows.map((r) => r.feature),
      specifications: specs.rows.map((r) => ({ key: r.spec_key, value: r.spec_value })),
      whatsInBox:     boxItems.rows.map((r) => r.item),
    },
  });
}

/* ═══════════════════════════════════════════════════════════
   ─── ROUTES ───
═══════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────
   GET /api/products
   Public feed — active, non-flagged, non-deleted only
────────────────────────────────────────────────────────── */
router.get("/", readLimiter, async (req, res) => {
  try {
    const {
      page      = 1,
      limit     = 20,
      category,
      sort      = "newest",
      search,
      minPrice,
      maxPrice,
      sellerId,
      condition,
      brand,
    } = req.query;

    const take   = Math.min(50, Math.max(1, Number(limit)));
    const offset = (Math.max(1, Number(page)) - 1) * take;

    const conditions = [
      "p.deleted_at IS NULL",
      `p.status     = '${PRODUCT_STATUS.ACTIVE}'`,
      "p.is_active  = true",
      "p.is_flagged = false",
    ];
    const params = [];
    let   idx    = 1;

    if (category && VALID_CATEGORY_IDS.has(category)) {
      conditions.push(`p.category_id = $${idx++}`);
      params.push(category);
    }
    if (condition && CONDITIONS.includes(condition)) {
      conditions.push(`p.condition = $${idx++}`);
      params.push(condition);
    }
    if (brand) {
      conditions.push(`b.slug = $${idx++}`);
      params.push(brand.toLowerCase());
    }
    if (minPrice && !isNaN(Number(minPrice))) {
      conditions.push(`p.base_price >= $${idx++}`);
      params.push(Number(minPrice));
    }
    if (maxPrice && !isNaN(Number(maxPrice))) {
      conditions.push(`p.base_price <= $${idx++}`);
      params.push(Number(maxPrice));
    }
    if (sellerId) {
      conditions.push(`p.seller_id = $${idx++}`);
      params.push(sellerId);
    }
    if (search?.trim()) {
      conditions.push(
        `(p.name ILIKE $${idx} OR p.search_keywords ILIKE $${idx} OR p.description ILIKE $${idx})`
      );
      params.push(`%${search.trim()}%`);
      idx++;
    }

    const orderClause = ORDER_MAP[sort] ?? ORDER_MAP.newest;
    const where       = conditions.join(" AND ");

    const { rows } = await pool.query(
      `WITH filtered AS (
         SELECT
           p.id,
           p.slug,
           p.name,
           p.base_price,
           p.original_price,
           p.category_id,
           p.condition,
           p.quality_score,
           p.views,
           p.likes,
           p.sold_count,
           p.is_featured,
           p.is_sponsored,
           p.created_at,
           u.name              AS seller_name,
           v.business_name     AS vendor_name,
           v.badge             AS vendor_badge,
           v.is_official_store,
           b.name              AS brand_name,
           b.is_verified       AS brand_verified,
           pi.image_url        AS cover_image,
           COUNT(*) OVER()     AS total_count
         FROM market.products p
         LEFT JOIN public.users    u  ON u.id  = p.seller_id
         LEFT JOIN market.vendors  v  ON v.id  = p.vendor_id
         LEFT JOIN market.brands   b  ON b.id  = p.brand_id
         LEFT JOIN market.product_images pi
           ON pi.product_id = p.id AND pi.is_primary = true
         WHERE ${where}
         ORDER BY
           p.is_sponsored DESC,
           p.is_featured  DESC,
           ${orderClause}
         LIMIT  $${idx} OFFSET $${idx + 1}
       )
       SELECT * FROM filtered`,
      [...params, take, offset]
    );

    const total = rows[0]?.total_count
      ? parseInt(rows[0].total_count, 10) : 0;

    return res.json({
      success:  true,
      total,
      page:     Number(page),
      limit:    take,
      products: rows.map(({ total_count, ...p }) => p),
    });

  } catch (err) {
    console.error("GET /api/products error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

/* ──────────────────────────────────────────────────────────
   GET /api/products/my/ads
   Vendor's own listings — all statuses
────────────────────────────────────────────────────────── */
router.get("/my/ads", authenticate, async (req, res) => {
  try {
    const {
      page   = 1,
      limit  = 20,
      status,
      search,
    } = req.query;

    const take   = Math.min(50, Math.max(1, Number(limit)));
    const offset = (Math.max(1, Number(page)) - 1) * take;

    const where  = ["p.seller_id = $1", "p.deleted_at IS NULL"];
    const params = [req.user.id];

    if (status && VALID_STATUSES.has(status)) {
      where.push(`p.status = $${params.length + 1}`);
      params.push(status);
    }
    if (search?.trim()) {
      where.push(`p.name ILIKE $${params.length + 1}`);
      params.push(`%${search.trim()}%`);
    }

    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.slug,
         p.name,
         p.base_price,
         p.original_price,
         p.category_id,
         p.condition,
         p.status,
         p.moderation_status,
         p.moderation_message,
         p.rejection_reason,
         p.fraud_score,
         p.quality_score,
         p.risk_level,
         p.views,
         p.sold_count,
         p.wishlist_count,
         p.resubmit_count,
         p.is_featured,
         p.is_sponsored,
         p.created_at,
         p.updated_at,
         p.expires_at,
         b.name       AS brand_name,
         pi.image_url AS cover_image,
         COUNT(pv.id)               AS variant_count,
         COALESCE(SUM(pv.stock), 0) AS total_stock,
         COUNT(*) OVER()            AS total_count
       FROM market.products p
       LEFT JOIN market.brands           b  ON b.id  = p.brand_id
       LEFT JOIN market.product_images   pi
         ON pi.product_id = p.id AND pi.is_primary = true
       LEFT JOIN market.product_variants pv
         ON pv.product_id = p.id AND pv.is_active = true
       WHERE ${where.join(" AND ")}
       GROUP BY p.id, b.name, pi.image_url
       ORDER BY p.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, take, offset]
    );

    const total = rows[0]?.total_count
      ? parseInt(rows[0].total_count, 10) : 0;

    const STATUS_META = {
      draft:             { label: "Draft",             color: "#6b7280", action: "Edit & Submit"   },
      pending_review:    { label: "Under Review",      color: "#d97706", action: "View Details"    },
      changes_requested: { label: "Changes Requested", color: "#7c3aed", action: "Edit & Resubmit" },
      active:            { label: "Live",              color: "#059669", action: "View Product"    },
      rejected:          { label: "Rejected",          color: "#dc2626", action: "Fix & Resubmit"  },
      paused:            { label: "Paused",            color: "#0891b2", action: "Resume"          },
      out_of_stock:      { label: "Out of Stock",      color: "#ea580c", action: "Update Stock"    },
      archived:          { label: "Archived",          color: "#6b7280", action: "Restore"         },
      banned:            { label: "Banned",            color: "#dc2626", action: "Contact Support" },
    };

    return res.json({
      success: true,
      total,
      page:    Number(page),
      limit:   take,
      ads: rows.map(({ total_count, ...p }) => ({
        ...p,
        status_meta:  STATUS_META[p.status] ?? { label: p.status, color: "#6b7280" },
        can_submit:   p.status === "draft",
        can_edit:     ["draft", "changes_requested", "rejected"].includes(p.status),
        can_resubmit: ["changes_requested", "rejected"].includes(p.status) && p.resubmit_count < 5,
        low_stock:    Number(p.total_stock) > 0 && Number(p.total_stock) <= 5,
        out_of_stock: Number(p.total_stock) === 0,
        health: [
          Number(p.total_stock) <= 3 && p.status === "active" && "⚠️ Low stock",
          p.quality_score < 40                                 && "📉 Low quality score",
          !p.cover_image                                       && "📷 No photo",
        ].filter(Boolean),
      })),
    });

  } catch (err) {
    console.error("GET /my/ads error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ──────────────────────────────────────────────────────────
   GET /api/products/admin/queue
   Admin moderation queue
────────────────────────────────────────────────────────── */
router.get("/admin/queue", authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      status = "pending_review",
      page   = 1,
      limit  = 20,
      sort   = "oldest",
      risk,
    } = req.query;

    const take   = Math.min(50, Math.max(1, Number(limit)));
    const offset = (Math.max(1, Number(page)) - 1) * take;

    const safeStatus = VALID_STATUSES.has(status) ? status : "pending_review";

    const where  = ["p.deleted_at IS NULL", `p.status = $1`];
    const params = [safeStatus];

    if (risk && Object.values(RISK_LEVEL).includes(risk)) {
      where.push(`p.risk_level = $${params.length + 1}`);
      params.push(risk);
    }

    const orderClause =
      sort === "oldest"     ? "p.last_submitted_at ASC  NULLS LAST" :
      sort === "fraud_high" ? "p.fraud_score DESC"                  :
      sort === "quality"    ? "p.quality_score ASC"                 :
      "p.last_submitted_at DESC";

    const { rows } = await pool.query(
      `SELECT
         p.id, p.slug, p.name, p.base_price, p.category_id,
         p.condition, p.status, p.fraud_score, p.quality_score,
         p.risk_level, p.is_flagged, p.rejection_reason,
         p.resubmit_count, p.created_at, p.last_submitted_at,
         u.name          AS seller_name,
         u.email         AS seller_email,
         v.trust_score   AS seller_trust,
         v.badge         AS seller_badge,
         v.total_sales,
         pi.image_url    AS cover_image,
         COUNT(*) OVER() AS total_count
       FROM market.products p
       LEFT JOIN public.users    u  ON u.id  = p.seller_id
       LEFT JOIN market.vendors  v  ON v.id  = p.vendor_id
       LEFT JOIN market.product_images pi
         ON pi.product_id = p.id AND pi.is_primary = true
       WHERE ${where.join(" AND ")}
       ORDER BY ${orderClause}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, take, offset]
    );

    const total = rows[0]?.total_count
      ? parseInt(rows[0].total_count, 10) : 0;

    return res.json({
      success:  true,
      total,
      page:     Number(page),
      limit:    take,
      products: rows.map(({ total_count, ...p }) => p),
    });

  } catch (err) {
    console.error("GET /admin/queue error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ──────────────────────────────────────────────────────────
   GET /api/products/slug/:slug
   Public product by slug
────────────────────────────────────────────────────────── */
router.get("/slug/:slug", readLimiter, async (req, res) => {
  try {
    await fetchProduct({
      field:          "slug",
      identifier:     req.params.slug,
      requestingUser: req.user ?? null,
      res,
    });
  } catch (err) {
    console.error("GET /slug/:slug error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch product" });
  }
});

/* ──────────────────────────────────────────────────────────
   GET /api/products/:id
   Public / owner / admin product by UUID
────────────────────────────────────────────────────────── */
router.get("/:id", readLimiter, async (req, res) => {
  try {
    await fetchProduct({
      field:          "id",
      identifier:     req.params.id,
      requestingUser: req.user ?? null,
      res,
    });
  } catch (err) {
    console.error("GET /:id error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch product" });
  }
});

/* ──────────────────────────────────────────────────────────
   POST /api/products
   Create a new product listing
────────────────────────────────────────────────────────── */
router.post(
  "/",
  postLimiter,
  authenticate,
  upload.array("images", 8),
  async (req, res) => {
    const sellerId = req.user.id;
    let   uploads  = [];
    const uploadedPublicIds = [];

    /* 1. Upload images first (outside transaction) */
    if (req.files?.length) {
      try {
        uploads = await uploadBatch(req.files, 3);
        uploadedPublicIds.push(...uploads.map((u) => u.public_id));
      } catch (err) {
        console.error("Image upload error:", err);
        return res.status(500).json({
          success: false,
          message: "Image upload failed. Please try again.",
        });
      }
    }

    /* 2. Parse body */
    const {
      name, description, categoryId, brandId, condition,
      basePrice, originalPrice, warranty, returnPolicy,
      deliveryNote, tags, keyFeatures, specifications,
      whatsInBox, variants, categoryAttributes, scheduledAt,
      saveDraft,
    } = req.body;

    const isDraft = saveDraft === "true";

    /* 3. Validate */
    if (!isDraft) {
      const errors = validateProductBody({ name, categoryId, basePrice, condition });
      if (errors.length) {
        await destroyImages(uploadedPublicIds);
        return res.status(400).json({ success: false, message: errors[0], errors });
      }
    }

    /* 4. Parse arrays */
    const parsedVariants   = safeJSON(variants).filter(
      (v) => v?.sku?.trim() && v?.name?.trim() && Number(v.price) >= 0
    );
    const parsedFeatures   = safeJSON(keyFeatures).filter(
      (f) => typeof f === "string" && f.trim()
    );
    const parsedSpecs      = safeJSON(specifications).filter(
      (s) => s?.key?.trim() && s?.value?.trim()
    );
    const parsedBoxItems   = safeJSON(whatsInBox).filter(
      (b) => typeof b === "string" && b.trim()
    );
    const parsedTags       = (typeof tags === "string" ? tags : "")
      .split(",").map((t) => t.trim()).filter(Boolean);
    const parsedCatAttribs = safeJSON(categoryAttributes, {});

    /* 5. Fraud detection (skip for drafts) */
    let fraud = {
      fraudScore: 0, duplicateScore: 0, spamScore: 0,
      riskLevel: RISK_LEVEL.LOW, flags: [], autoAction: null, blocked: false,
    };

    if (!isDraft) {
      try {
        fraud = await runFraudEngine({
          name, description, price: basePrice, sellerId,
        });
      } catch (err) {
        console.error("Fraud engine error:", err.message);
      }

      if (fraud.blocked) {
        await destroyImages(uploadedPublicIds);
        return res.status(403).json({
          success: false,
          message: "Product blocked by automated policy check.",
          flags:   fraud.flags,
        });
      }
    }

    /* 6. Brand lookup for search keywords */
    let brandName = "";
    if (brandId) {
      try {
        const { rows: br } = await pool.query(
          `SELECT name FROM market.brands WHERE id = $1`, [brandId]
        );
        brandName = br[0]?.name || "";
      } catch {}
    }

    /* 7. Quality score */
    const qualityScore = isDraft ? 0 : calcQualityScore({
      name, description,
      imageCount:           uploads.length,
      variantCount:         parsedVariants.length,
      featureCount:         parsedFeatures.length,
      specCount:            parsedSpecs.length,
      brandId,
      warranty,
      categoryAttribsFilled:
        Object.values(parsedCatAttribs).filter((v) => String(v).trim()).length,
      tagCount:             parsedTags.length,
    });

    /* 8. Search keywords */
    const searchKeywords = isDraft ? "" : generateSearchKeywords({
      name, description, brandName,
      tags:     parsedTags,
      features: parsedFeatures,
    });

    /* 9. Initial status */
    const initialStatus = isDraft
      ? PRODUCT_STATUS.DRAFT
      : PRODUCT_STATUS.PENDING;

    /* 10. DB transaction */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const vendor = await ensureVendor(client, sellerId);
      const slug   = generateSlug(name || "product");

      const { rows } = await client.query(
        `INSERT INTO market.products (
           vendor_id,    seller_id,    brand_id,      category_id,
           name,         slug,         description,   condition,
           base_price,   original_price, warranty,
           return_policy, delivery_note,
           attributes,   tags,
           fraud_score,  duplicate_score, spam_score,
           risk_level,   is_flagged,
           quality_score, search_keywords,
           status,       moderation_status,
           is_active,    scheduled_at,
           last_submitted_at
         ) VALUES (
           $1,$2,$3,$4,
           $5,$6,$7,$8,
           $9,$10,$11,
           $12,$13,
           $14,$15,
           $16,$17,$18,
           $19,$20,
           $21,$22,
           $23,$23,
           ($23 = 'active'),
           $24,
           CASE WHEN $23 != 'draft' THEN now() ELSE NULL END
         )
         RETURNING id, slug`,
        [
          vendor.id,                                     // $1
          sellerId,                                      // $2
          brandId      || null,                          // $3
          categoryId   || null,                          // $4
          (name        || "").trim(),                    // $5
          slug,                                          // $6
          description?.trim()  || null,                 // $7
          condition    || "new",                         // $8
          Number(basePrice)    || 0,                    // $9
          originalPrice ? Number(originalPrice) : null, // $10
          warranty?.trim()     || null,                 // $11
          returnPolicy?.trim() || null,                 // $12
          deliveryNote?.trim() || null,                 // $13
          JSON.stringify(parsedCatAttribs),             // $14
          parsedTags.length ? parsedTags : null,        // $15
          fraud.fraudScore,                             // $16
          fraud.duplicateScore,                         // $17
          fraud.spamScore,                              // $18
          fraud.riskLevel,                              // $19
          fraud.autoAction === "auto_flag",             // $20
          qualityScore,                                 // $21
          searchKeywords,                               // $22
          initialStatus,                                // $23
          scheduledAt ? new Date(scheduledAt) : null,   // $24
        ]
      );

      const { id: productId, slug: productSlug } = rows[0];

      await insertImages(client, productId, uploads);
      await insertVariants(client, productId, parsedVariants);
      await insertFeatures(client, productId, parsedFeatures);
      await insertSpecs(client, productId, parsedSpecs);
      await insertBoxItems(client, productId, parsedBoxItems);

      await logModeration(client, {
        productId,
        adminId:   null,
        action:    isDraft ? "saved_draft" : "submitted",
        oldStatus: "none",
        newStatus: initialStatus,
        reason:    isDraft ? "Saved as draft" : "Initial submission",
        isSystem:  true,
        metadata:  {
          fraudScore:    fraud.fraudScore,
          qualityScore,
          riskLevel:     fraud.riskLevel,
          flags:         fraud.flags,
        },
      });

      /* Update vendor product count */
      await client.query(
        `INSERT INTO market.vendor_stats (vendor_id, total_products)
         VALUES ($1, 1)
         ON CONFLICT (vendor_id) DO UPDATE SET
           total_products = vendor_stats.total_products + 1,
           updated_at     = now()`,
        [vendor.id]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success:      true,
        productId,
        slug:         productSlug,
        status:       initialStatus,
        qualityScore,
        riskLevel:    fraud.riskLevel,
        fraud: {
          score:  fraud.fraudScore,
          isSpam: fraud.autoAction === "auto_flag",
          flags:  fraud.flags,
        },
        message: isDraft
          ? "Product saved as draft."
          : "Product submitted for review. You'll be notified once approved.",
      });

    } catch (err) {
      await client.query("ROLLBACK");
      await destroyImages(uploadedPublicIds);
      console.error("POST /api/products error:", err);

      if (err.message?.includes("product_variants_sku"))
        return res.status(409).json({
          success: false,
          message: "Duplicate SKU — each variant needs a unique SKU.",
        });

      return res.status(500).json({
        success: false,
        message: "Failed to create product. Please try again.",
      });
    } finally {
      client.release();
    }
  }
);

/* ──────────────────────────────────────────────────────────
   POST /api/products/:id/submit
   Submit a draft or resubmit a rejected product
────────────────────────────────────────────────────────── */
router.post("/:id/submit", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, name, status, seller_id, resubmit_count
       FROM market.products
       WHERE id = $1 AND seller_id = $2 AND deleted_at IS NULL`,
      [req.params.id, req.user.id]
    );

    if (!rows.length)
      return res.status(404).json({ success: false, message: "Product not found" });

    const product     = rows[0];
    const SUBMITTABLE = ["draft", "rejected", "changes_requested"];

    if (!SUBMITTABLE.includes(product.status))
      return res.status(400).json({
        success: false,
        message: `Cannot submit — current status is "${product.status}"`,
      });

    if (product.resubmit_count >= 5)
      return res.status(400).json({
        success: false,
        message: "Maximum resubmissions (5) reached. Please contact support.",
      });

    await client.query("BEGIN");

    const isResubmit = product.status !== "draft";

    await client.query(
      `UPDATE market.products SET
         status             = $1,
         moderation_status  = $1,
         rejection_reason   = NULL,
         moderation_message = NULL,
         last_submitted_at  = now(),
         resubmit_count     = CASE WHEN $2 THEN resubmit_count + 1 ELSE resubmit_count END,
         updated_at         = now()
       WHERE id = $3`,
      [PRODUCT_STATUS.PENDING, isResubmit, product.id]
    );

    await logModeration(client, {
      productId: product.id,
      adminId:   null,
      action:    isResubmit ? "resubmitted" : "submitted",
      oldStatus: product.status,
      newStatus: PRODUCT_STATUS.PENDING,
      reason:    isResubmit ? "Seller resubmission" : "Initial submission",
      isSystem:  true,
    });

    await client.query("COMMIT");

    return res.json({
      success: true,
      status:  PRODUCT_STATUS.PENDING,
      message: "Product submitted for review.",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /:id/submit error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

/* ──────────────────────────────────────────────────────────
   POST /api/products/:id/moderate
   Admin moderation actions
────────────────────────────────────────────────────────── */
router.post("/:id/moderate", authenticate, requireAdmin, async (req, res) => {
  const { action, reason, message, notes } = req.body;
  const adminId = req.user.id;

  const VALID_ACTIONS = [
    "approve", "reject", "request_changes",
    "flag", "unflag", "hide", "restore",
    "feature", "unfeature", "sponsor",
    "pause", "delete", "ban",
    "ban_seller", "warn_seller",
  ];

  if (!VALID_ACTIONS.includes(action))
    return res.status(400).json({
      success: false,
      message: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}`,
    });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, status, seller_id, vendor_id, name
       FROM market.products
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const product   = rows[0];
    const oldStatus = product.status;
    let   newStatus = oldStatus;

    /* ── Build update based on action ── */
    const updates = {
      reviewed_by: adminId,
      reviewed_at: "now()",
      updated_at:  "now()",
    };

    switch (action) {
      case "approve":
        newStatus              = PRODUCT_STATUS.ACTIVE;
        updates.status         = newStatus;
        updates.moderation_status = newStatus;
        updates.is_active      = true;
        updates.is_flagged     = false;
        updates.rejection_reason = null;
        updates.moderation_message = null;
        break;

      case "reject":
        if (!reason && !message)
          return res.status(400).json({ success: false, message: "Rejection reason is required" });
        newStatus                  = PRODUCT_STATUS.REJECTED;
        updates.status             = newStatus;
        updates.moderation_status  = newStatus;
        updates.is_active          = false;
        updates.rejection_reason   = reason || null;
        updates.moderation_message = message || null;
        break;

      case "request_changes":
        if (!message)
          return res.status(400).json({ success: false, message: "Change request message is required" });
        newStatus                  = PRODUCT_STATUS.CHANGES_REQUESTED;
        updates.status             = newStatus;
        updates.moderation_status  = newStatus;
        updates.is_active          = false;
        updates.moderation_message = message;
        break;

      case "flag":
        newStatus          = PRODUCT_STATUS.PAUSED;
        updates.status     = newStatus;
        updates.is_active  = false;
        updates.is_flagged = true;
        break;

      case "unflag":
        newStatus          = PRODUCT_STATUS.ACTIVE;
        updates.status     = newStatus;
        updates.is_active  = true;
        updates.is_flagged = false;
        break;

      case "hide":
        updates.is_hidden = true;
        updates.is_active = false;
        break;

      case "restore":
        newStatus         = PRODUCT_STATUS.ACTIVE;
        updates.status    = newStatus;
        updates.is_active = true;
        updates.is_hidden = false;
        updates.is_flagged = false;
        break;

      case "feature":
        updates.is_featured = true;
        break;

      case "unfeature":
        updates.is_featured = false;
        break;

      case "sponsor":
        updates.is_sponsored     = true;
        updates.boost_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        break;

      case "pause":
        newStatus         = PRODUCT_STATUS.PAUSED;
        updates.status    = newStatus;
        updates.is_active = false;
        break;

      case "delete":
        newStatus          = PRODUCT_STATUS.ARCHIVED;
        updates.status     = newStatus;
        updates.is_active  = false;
        updates.deleted_at = "now()";
        break;

      case "ban":
        newStatus          = PRODUCT_STATUS.BANNED;
        updates.status     = newStatus;
        updates.is_active  = false;
        updates.deleted_at = "now()";
        break;

      case "ban_seller": {
        await client.query(
          `UPDATE public.users SET is_banned = true, updated_at = now() WHERE id = $1`,
          [product.seller_id]
        );
        await client.query(
          `UPDATE market.products
           SET status = 'banned', is_active = false,
               deleted_at = now(), updated_at = now()
           WHERE seller_id = $1 AND deleted_at IS NULL`,
          [product.seller_id]
        );
        await logModeration(client, {
          productId: product.id, adminId,
          action:    "ban_seller",
          oldStatus, newStatus: "banned",
          reason:    reason || "Admin ban",
          isSystem:  false,
          metadata:  { notes },
        });
        await client.query("COMMIT");
        return res.json({ success: true, message: "Seller banned and all listings removed." });
      }

      case "warn_seller":
        /* Log the warning — notification system picks this up */
        await logModeration(client, {
          productId: product.id, adminId,
          action:    "warn_seller",
          oldStatus, newStatus: oldStatus,
          reason:    reason || "Admin warning",
          isSystem:  false,
          metadata:  { message, notes },
        });
        await client.query("COMMIT");
        return res.json({ success: true, message: "Warning logged for seller." });

      default:
        break;
    }

    /* Build SET clause dynamically */
    const setClauses = [];
    const setParams  = [];
    let   pIdx       = 1;

    const LITERAL_FIELDS = new Set(["reviewed_at", "updated_at", "deleted_at", "boost_expires_at"]);

    for (const [key, val] of Object.entries(updates)) {
      if (val === "now()") {
        setClauses.push(`${key} = now()`);
      } else if (val instanceof Date) {
        setClauses.push(`${key} = $${pIdx++}`);
        setParams.push(val);
      } else if (val === null) {
        setClauses.push(`${key} = NULL`);
      } else if (typeof val === "boolean") {
        setClauses.push(`${key} = $${pIdx++}`);
        setParams.push(val);
      } else if (typeof val === "string") {
        setClauses.push(`${key} = $${pIdx++}`);
        setParams.push(val);
      }
    }

    if (setClauses.length) {
      await client.query(
        `UPDATE market.products
         SET ${setClauses.join(", ")}
         WHERE id = $${pIdx}`,
        [...setParams, product.id]
      );
    }

    await logModeration(client, {
      productId: product.id,
      adminId,
      action,
      oldStatus,
      newStatus,
      reason:   reason || null,
      message:  message || null,
      isSystem: false,
      metadata: { notes },
    });

    await client.query("COMMIT");

    /* Async trust score recalculation */
    if (["approve", "reject", "ban"].includes(action)) {
      setImmediate(async () => {
        try {
          await pool.query(
            `UPDATE market.vendors SET updated_at = now() WHERE id = $1`,
            [product.vendor_id]
          );
        } catch {}
      });
    }

    return res.json({
      success:    true,
      message:    `Product ${action} successful`,
      product_id: product.id,
      old_status: oldStatus,
      new_status: newStatus,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /:id/moderate error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

/* ──────────────────────────────────────────────────────────
   POST /api/products/:id/report
   User reports a listing
────────────────────────────────────────────────────────── */
router.post("/:id/report", authenticate, async (req, res) => {
  const VALID_REASONS = [
    "scam", "fake_images", "prohibited",
    "misleading", "duplicate", "counterfeit", "other",
  ];

  const { reason, description } = req.body;

  if (!reason || !VALID_REASONS.includes(reason))
    return res.status(400).json({
      success: false,
      message: `Reason must be one of: ${VALID_REASONS.join(", ")}`,
    });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO market.product_reports
         (product_id, reported_by, reason, description)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (product_id, reported_by) DO UPDATE SET
         reason      = EXCLUDED.reason,
         description = EXCLUDED.description,
         status      = 'open'`,
      [req.params.id, req.user.id, reason, description?.trim() || null]
    );

    /* Auto-flag at 3+ open reports */
    const { rows } = await client.query(
      `SELECT COUNT(*) AS cnt FROM market.product_reports
       WHERE product_id = $1 AND status = 'open'`,
      [req.params.id]
    );

    if (parseInt(rows[0].cnt, 10) >= 3) {
      await client.query(
        `UPDATE market.products
         SET status     = 'paused',
             is_active  = false,
             is_flagged = true,
             updated_at = now()
         WHERE id = $1 AND status = 'active'`,
        [req.params.id]
      );
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Report submitted. Thank you for keeping Minimart safe.",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /:id/report error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

/* ──────────────────────────────────────────────────────────
   PATCH /api/products/:id/status
   Seller updates their own product status
────────────────────────────────────────────────────────── */
router.patch("/:id/status", authenticate, async (req, res) => {
  const { status } = req.body;
  const SELLER_ALLOWED = ["paused", "archived", "draft"];

  if (!SELLER_ALLOWED.includes(status))
    return res.status(400).json({
      success: false,
      message: `Allowed values: ${SELLER_ALLOWED.join(", ")}`,
    });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE market.products SET
         status     = $1,
         is_active  = (CASE WHEN $1 = 'active' THEN true ELSE false END),
         updated_at = now()
       WHERE id        = $2
         AND seller_id = $3
         AND deleted_at IS NULL
       RETURNING id, status`,
      [status, req.params.id, req.user.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    await logModeration(client, {
      productId: req.params.id,
      adminId:   null,
      action:    `seller_${status}`,
      newStatus: status,
      isSystem:  true,
    });

    await client.query("COMMIT");

    return res.json({ success: true, product: rows[0] });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /:id/status error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

/* ──────────────────────────────────────────────────────────
   PATCH /api/products/:id/stock
   Seller updates variant stock
────────────────────────────────────────────────────────── */
router.patch("/:id/stock", authenticate, async (req, res) => {
  const { variantId, stock } = req.body;

  if (variantId === undefined || stock === undefined)
    return res.status(400).json({ success: false, message: "variantId and stock are required" });

  const newStock = parseInt(stock, 10);
  if (isNaN(newStock) || newStock < 0)
    return res.status(400).json({ success: false, message: "Stock must be a non-negative integer" });

  try {
    /* Verify ownership */
    const { rows: ownership } = await pool.query(
      `SELECT p.id FROM market.products p
       JOIN market.product_variants pv ON pv.product_id = p.id
       WHERE p.id        = $1
         AND p.seller_id = $2
         AND pv.id       = $3
         AND p.deleted_at IS NULL`,
      [req.params.id, req.user.id, variantId]
    );

    if (!ownership.length)
      return res.status(404).json({ success: false, message: "Variant not found" });

    await pool.query(
      `UPDATE market.product_variants
       SET stock = $1, updated_at = now()
       WHERE id = $2`,
      [newStock, variantId]
    );

    /* Auto status update based on total stock */
    const { rows: stockRows } = await pool.query(
      `SELECT COALESCE(SUM(stock), 0) AS total
       FROM market.product_variants
       WHERE product_id = $1 AND is_active = true`,
      [req.params.id]
    );

    const total = parseInt(stockRows[0].total, 10);

    if (total === 0) {
      await pool.query(
        `UPDATE market.products
         SET status = 'out_of_stock', is_active = false, updated_at = now()
         WHERE id = $1 AND status = 'active'`,
        [req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE market.products
         SET status = 'active', is_active = true, updated_at = now()
         WHERE id = $1 AND status = 'out_of_stock'`,
        [req.params.id]
      );
    }

    return res.json({
      success:     true,
      message:     "Stock updated.",
      total_stock: total,
    });

  } catch (err) {
    console.error("PATCH /:id/stock error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ──────────────────────────────────────────────────────────
   DELETE /api/products/:id
   Seller soft deletes their product
────────────────────────────────────────────────────────── */
router.delete("/:id", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE market.products SET
         deleted_at = now(),
         status     = 'archived',
         is_active  = false,
         updated_at = now()
       WHERE id        = $1
         AND seller_id = $2
         AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    await logModeration(client, {
      productId: req.params.id,
      adminId:   null,
      action:    "seller_deleted",
      newStatus: "archived",
      isSystem:  true,
    });

    /* Update vendor product count */
    await client.query(
      `UPDATE market.vendor_stats
       SET total_products = GREATEST(0, total_products - 1),
           updated_at     = now()
       WHERE vendor_id = (
         SELECT vendor_id FROM market.products WHERE id = $1
       )`,
      [req.params.id]
    );

    await client.query("COMMIT");

    return res.json({ success: true, message: "Product removed." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /:id error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════
   MULTER ERROR BOUNDARY
═══════════════════════════════════════════════════════════ */
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE")
      return res.status(413).json({ success: false, message: "Each image must be under 10 MB" });
    if (err.code === "LIMIT_FILE_COUNT")
      return res.status(400).json({ success: false, message: "Max 8 images allowed" });
  }
  if (err?.message === "Only image files are allowed")
    return res.status(400).json({ success: false, message: err.message });

  console.error("[products router]", err.message);
  return res.status(500).json({ success: false, message: "Server error" });
});

export default router;