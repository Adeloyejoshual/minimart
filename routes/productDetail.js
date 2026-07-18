/**
 * routes/productDetail.js — v2
 *
 * Fixes from v1:
 *  ─ #1  : seller_name duplicate alias resolved — p.seller_name → seller_name_raw,
 *          u.name → seller_name; normalizeProduct uses fallback chain
 *  ─ #2  : exclude param validated as UUID or integer before use
 *  ─ #3  : View deduplication — per-IP+product cooldown (30 min in-memory Map)
 *  ─ #4  : Review POST validates rating as integer, comment length-capped at 2000
 *  ─ #5  : discount_percent guards against division by zero and negative discounts
 *  ─ #6  : fetchProductImages skipped when JSONB images already present
 *  ─ #7  : parseJson handles pg-parsed JSONB (already objects) and string columns
 *  ─ #8  : /favorite and /reviews POST extract user_id from verified JWT
 *  ─ #9  : CARD_COLS queries include seller JOIN for name/image/store
 *  ─ #10 : daysUntilExpiry clamps to 0 — never returns negative
 *  ─ #11 : /users/:id/public omits internal metrics, exposes only public fields
 *  ─ #12 : engagement endpoints rate-limited (10 req / IP / min)
 *  ─ #13 : all table refs use public. schema prefix consistently
 *  ─ #14 : buildImageArray contract documented; returns [] not null on no images
 */

import express    from "express";
import rateLimit  from "express-rate-limit";
import jwt        from "jsonwebtoken";

import { pool } from "../config/db.js";

const router  = express.Router();

/* ═══════════════════════════════════════════════════════════════
   AUTH HELPERS  — Fix #8
   Extract and verify JWT from Authorization header.
   Routes that need auth call requireAuth middleware.
   Routes that optionally read userId call readUserIdFromReq().
═══════════════════════════════════════════════════════════════ */
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware — rejects request if no valid JWT present.
 * Sets req.userId (string) on success.
 */
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Login required" });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId    = String(
      payload.id ?? payload.sub ?? payload.userId ?? payload.user_id
    );
    if (!req.userId || req.userId === "undefined") {
      return res.status(401).json({ message: "Invalid token payload" });
    }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Reads userId from JWT if present — does NOT reject if missing.
 * Used on routes that work for both guests and logged-in users.
 */
const readUserIdFromReq = (req) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const id      = payload.id ?? payload.sub ?? payload.userId ?? payload.user_id;
    return id ? String(id) : null;
  } catch {
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60 * 1_000,
    max,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) =>
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.ip,
    handler         : (_req, res) =>
      res.status(429).json({ message }),
  });

/**
 * Fix #12: engagement endpoints (click, share, view) rate-limited.
 * 10 requests per IP per minute prevents stat inflation from bots.
 */
const engagementLimiter = makeLimiter({
  windowMin : 1,
  max       : 10,
  message   : "Too many requests. Please slow down.",
});

const reviewLimiter = makeLimiter({
  windowMin : 60,
  max       : 5,
  message   : "Too many review submissions. Please wait before trying again.",
});

const readLimiter = makeLimiter({
  windowMin : 1,
  max       : 60,
  message   : "Too many requests.",
});

/* ═══════════════════════════════════════════════════════════════
   VIEW DEDUPLICATION  — Fix #3
   Simple in-memory Map: key = `${productId}:${ip}`
   Entry expires after VIEW_COOLDOWN_MS (30 minutes).
   This prevents a page refresh from counting as a new view.
   For multi-process deployments, replace with Redis.
═══════════════════════════════════════════════════════════════ */
const VIEW_COOLDOWN_MS  = 30 * 60 * 1_000;
const recentViews       = new Map();

const hasViewedRecently = (productId, ip) => {
  const key    = `${productId}:${ip}`;
  const entry  = recentViews.get(key);
  if (!entry) return false;
  if (Date.now() - entry > VIEW_COOLDOWN_MS) {
    recentViews.delete(key);
    return false;
  }
  return true;
};

const markViewed = (productId, ip) => {
  recentViews.set(`${productId}:${ip}`, Date.now());
};

/* Periodically purge stale entries to prevent memory growth */
setInterval(() => {
  const cutoff = Date.now() - VIEW_COOLDOWN_MS;
  for (const [key, ts] of recentViews) {
    if (ts < cutoff) recentViews.delete(key);
  }
}, VIEW_COOLDOWN_MS).unref();

/* ═══════════════════════════════════════════════════════════════
   INPUT VALIDATION HELPERS  — Fix #2
═══════════════════════════════════════════════════════════════ */
const UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT_RE     = /^\d+$/;

/**
 * Returns the value if it is a valid UUID or positive integer string,
 * otherwise returns null. Used to sanitize `exclude` query param
 * before it is used as a SQL parameter.
 */
const sanitizeId = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  if (UUID_RE.test(s) || INT_RE.test(s)) return s;
  return null;
};

/* ═══════════════════════════════════════════════════════════════
   PARSE JSON SAFE  — Fix #7
   Handles three cases:
     1. PostgreSQL JSONB columns — already parsed to JS objects/arrays
        by the pg driver. Return as-is.
     2. TEXT columns storing JSON strings — parse with try/catch.
     3. null / undefined — return fallback.
═══════════════════════════════════════════════════════════════ */
const parseJson = (v, fallback) => {
  // Case 3: null or undefined
  if (v === null || v === undefined) return fallback;

  // Case 1: already parsed by pg (JSONB column)
  if (typeof v !== "string") return v ?? fallback;

  // Case 2: string — attempt parse
  try {
    const parsed = JSON.parse(v);
    // JSON null ("null" string) → return fallback
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

/* ═══════════════════════════════════════════════════════════════
   DAYS UNTIL EXPIRY  — Fix #10
   Never returns negative — expired listings return 0.
═══════════════════════════════════════════════════════════════ */
const daysUntilExpiry = (activeUntil) => {
  if (!activeUntil) return null;
  return Math.max(
    0,
    Math.ceil(
      (new Date(activeUntil).getTime() - Date.now()) / 86_400_000
    )
  );
};

/* ═══════════════════════════════════════════════════════════════
   DISCOUNT PERCENT  — Fix #5
   Guards against:
     - Division by zero (original_price = 0)
     - Negative discounts (price > original_price)
     - NaN from non-numeric values
═══════════════════════════════════════════════════════════════ */
const calcDiscountPercent = (price, originalPrice) => {
  const p  = Number(price);
  const op = Number(originalPrice);
  if (!op || op <= 0 || p >= op || !Number.isFinite(p) || !Number.isFinite(op)) {
    return null;
  }
  return Math.round((1 - p / op) * 100);
};

/* ═══════════════════════════════════════════════════════════════
   BUILD IMAGE ARRAY
   Contract:
     - Always returns an array (never null)
     - Each item: { url: string, key: string|null, order: number }
     - Priority: JSONB images column → product_images table → fallback URLs
═══════════════════════════════════════════════════════════════ */
const buildImageArray = (row, productImageRows = []) => {
  /* ── Option 1: images JSONB on product row ── */
  const raw    = row.images;
  const parsed = parseJson(raw, null);

  if (Array.isArray(parsed) && parsed.length > 0) {
    const jsonbImages = parsed
      .filter((img) => img?.url)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((img) => ({
        url   : img.url,
        key   : img.key   ?? null,
        order : img.order ?? 0,
      }));
    if (jsonbImages.length) return jsonbImages;
  }

  /* ── Option 2: product_images table rows ── */
  if (productImageRows?.length) {
    return productImageRows
      .filter((img) => img?.image_url)
      .sort((a, b) => (a.position_order ?? 0) - (b.position_order ?? 0))
      .map((img) => ({
        url   : img.image_url,
        key   : img.r2_key         ?? null,
        order : img.position_order  ?? 0,
      }));
  }

  /* ── Option 3: main_image / thumbnail_url fallback ── */
  const fallback = [];
  if (row.main_image) {
    fallback.push({ url: row.main_image, key: null, order: 0 });
  }
  if (row.thumbnail_url && row.thumbnail_url !== row.main_image) {
    fallback.push({ url: row.thumbnail_url, key: null, order: 1 });
  }
  return fallback;
};

/* ═══════════════════════════════════════════════════════════════
   FETCH PRODUCT IMAGES  — Fix #6
   Only called when the JSONB images column is empty/missing.
═══════════════════════════════════════════════════════════════ */

/**
 * Returns true if the row's JSONB images column already has usable URLs.
 * Used to skip the product_images table query when not needed.
 */
const rowHasJsonbImages = (row) => {
  const parsed = parseJson(row.images, null);
  return Array.isArray(parsed) && parsed.some((img) => img?.url);
};

const fetchProductImages = async (productId) => {
  try {
    const { rows } = await pool.query(
      `SELECT image_url, r2_key, position_order, is_primary
       FROM   public.product_images
       WHERE  product_id = $1
       ORDER  BY position_order ASC`,
      [productId]
    );
    return rows;
  } catch {
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE — full product object sent to frontend
═══════════════════════════════════════════════════════════════ */
const normalizeProduct = (row, productImageRows = []) => {
  if (!row) return null;

  const imageArray   = buildImageArray(row, productImageRows);
  const primaryImage = imageArray[0]?.url
    ?? row.main_image
    ?? row.thumbnail_url
    ?? null;

  /* Parse all JSONB / text-JSON fields */
  const attributes     = parseJson(row.attributes,     {});
  const specifications = parseJson(row.specifications, {});
  const highlights     = parseJson(row.highlights,     []);
  const faq            = parseJson(row.faq,            []);
  const delivery       = parseJson(row.delivery,       {});
  const contact        = parseJson(row.contact,        {});
  const tags           = parseJson(row.tags,           []);

  /* features — normalize to string[] regardless of storage format */
  const rawFeatures = parseJson(row.features, null);
  let features = [];
  if (Array.isArray(rawFeatures)) {
    features = rawFeatures;
  } else if (rawFeatures && typeof rawFeatures === "object") {
    features = Object.entries(rawFeatures).map(([k, v]) => `${k}: ${v}`);
  } else if (typeof row.features === "string" && row.features.trim()) {
    features = [row.features.trim()];
  }

  /* specifications — normalize to { label, value }[] */
  let specsArray = [];
  if (Array.isArray(specifications)) {
    specsArray = specifications;
  } else if (specifications && typeof specifications === "object") {
    specsArray = Object.entries(specifications).map(([label, value]) => ({
      label,
      value : String(value),
    }));
  }

  return {
    /* ── Core ── */
    id               : row.id,
    slug             : row.slug,
    title            : row.title,
    description      : row.description,
    condition        : row.condition        ?? null,
    brand            : row.brand            ?? null,
    model            : row.model            ?? null,
    sku              : row.sku              ?? null,
    barcode          : row.barcode          ?? null,
    tags,

    /* ── Pricing ── */
    price            : Number(row.price          || 0),
    original_price   : row.original_price
      ? Number(row.original_price)
      : null,
    // Fix #5: safe discount calculation
    discount_percent : calcDiscountPercent(row.price, row.original_price),
    currency         : row.currency         ?? "NGN",
    negotiable       : !!row.negotiable,

    /* ── Status ── */
    status           : row.status,
    is_active        : row.is_active,
    active_until     : row.active_until     ?? null,
    // Fix #10: clamped to 0, never negative
    days_remaining   : daysUntilExpiry(row.active_until),
    is_trial         : row.status === "active_limited",

    /* ── Images ── */
    image            : primaryImage,
    images           : imageArray,
    main_image       : row.main_image       ?? primaryImage,
    thumbnail_url    : row.thumbnail_url    ?? primaryImage,

    /* ── Category ── */
    category_id      : row.category_id,
    subcategory_id   : row.subcategory_id   ?? null,
    category_name    : row.category_name    ?? null,
    subcategory_name : row.subcategory_name ?? null,

    /* ── Location ── */
    location_state   : row.location_state   ?? null,
    location_city    : row.location_city    ?? null,
    latitude         : row.latitude         ?? null,
    longitude        : row.longitude        ?? null,

    /* ── Seller ──
       Fix #1: seller_name_raw is p.seller_name (the denormalized text column).
               seller_name is u.name from the JOIN.
               Frontend receives seller_name = joined name ?? raw fallback.        */
    seller_id        : row.seller_id,
    seller_name      : row.seller_name      ?? row.seller_name_raw ?? null,
    seller_verified  : row.seller_verified  ?? false,
    seller_rating    : row.seller_rating
      ? Number(row.seller_rating)
      : null,
    seller_image     : row.seller_image     ?? null,
    seller_store     : row.seller_store     ?? null,
    seller_trust     : row.seller_trust
      ? Number(row.seller_trust)
      : null,
    seller_online    : row.seller_online    ?? false,

    /* ── Contact ── */
    phone            : row.phone            ?? null,
    whatsapp         : row.whatsapp         ?? null,
    whatsapp_link    : row.whatsapp_link    ?? null,

    /* ── Rich content ── */
    features,
    attributes,
    specifications   : specsArray,
    highlights,
    faq,
    delivery,
    contact,

    /* ── Engagement ── */
    views            : Number(row.views             || 0),
    clicks_count     : Number(row.clicks_count      || 0),
    favorites_count  : Number(row.favorites_count   || 0),
    share_count      : Number(row.share_count       || 0),
    impression_count : Number(row.impression_count  || 0),
    engagement_score : Number(row.engagement_score  || 0),
    conversion_rate  : Number(row.conversion_rate   || 0),
    quality_score    : Number(row.quality_score     || 0),
    boost_score      : Number(row.boost_score       || 0),

    /* ── Promotion ── */
    is_promoted          : !!row.is_promoted,
    promotion_type       : row.promotion_type       ?? null,
    promotion_priority   : row.promotion_priority   ?? null,
    promotion_expires_at : row.promotion_expires_at ?? null,

    /* ── SEO ── */
    seo_title        : row.seo_title        ?? row.title,
    seo_description  : row.seo_description  ?? row.description?.slice(0, 160),
    seo_keywords     : row.seo_keywords     ?? null,
    canonical_url    : row.canonical_url    ?? null,

    /* ── Timestamps ── */
    created_at           : row.created_at,
    updated_at           : row.updated_at           ?? null,
    last_interaction_at  : row.last_interaction_at  ?? null,
  };
};

/* ═══════════════════════════════════════════════════════════════
   FULL PRODUCT COLUMNS
   Fix #1: p.seller_name aliased as seller_name_raw to avoid
           collision with u.name AS seller_name from the JOIN.
   Fix #13: all tables use public. schema prefix.
═══════════════════════════════════════════════════════════════ */
const PRODUCT_COLS = `
  p.id,
  p.slug,
  p.title,
  p.description,
  p.price,
  p.original_price,
  p.currency,
  p.negotiable,
  p.condition,
  p.brand,
  p.model,
  p.sku,
  p.barcode,
  p.tags,
  p.status,
  p.is_active,
  p.active_until,
  p.created_at,
  p.updated_at,
  p.last_interaction_at,
  p.seller_id,

  /* Fix #1: alias the denormalized text column so it does not clash
             with u.name AS seller_name from the JOIN below */
  p.seller_name          AS seller_name_raw,

  p.category_id,
  p.subcategory_id,
  cat.name               AS category_name,
  sub.name               AS subcategory_name,
  p.location_state,
  p.location_city,
  p.latitude,
  p.longitude,
  p.views,
  p.clicks_count,
  p.favorites_count,
  p.share_count,
  p.impression_count,
  p.engagement_score,
  p.conversion_rate,
  p.quality_score,
  p.is_promoted,
  p.promotion_type,
  p.promotion_priority,
  p.promotion_expires_at,
  p.boost_score,
  p.features,
  p.attributes,
  p.specifications,
  p.highlights,
  p.faq,
  p.delivery,
  p.contact,
  p.phone,
  p.whatsapp,
  p.whatsapp_link,
  p.main_image,
  p.thumbnail_url,
  p.images,
  p.seo_title,
  p.seo_description,
  p.seo_keywords,
  p.canonical_url,

  /* ── Seller info joined from users ── */
  u.name                 AS seller_name,
  u.profile_image        AS seller_image,
  u.store_name           AS seller_store,
  u.identity_verified    AS seller_verified,
  u.trust_score          AS seller_trust,
  u.rating               AS seller_rating,
  u.is_online            AS seller_online
`;

/* ═══════════════════════════════════════════════════════════════
   CARD COLUMNS
   Fix #9: includes seller JOIN columns so normalizeProduct()
           can populate seller_name / seller_image / seller_store
           on list-view cards (SimilarProducts, MoreFromSeller).
═══════════════════════════════════════════════════════════════ */
const CARD_COLS = `
  p.id,
  p.slug,
  p.title,
  p.price,
  p.original_price,
  p.condition,
  p.negotiable,
  p.main_image,
  p.thumbnail_url,
  p.images,
  p.location_city,
  p.location_state,
  p.is_promoted,
  p.boost_score,
  p.engagement_score,
  p.views,
  p.favorites_count,
  p.status,
  p.active_until,
  p.seller_id,
  p.seller_name          AS seller_name_raw,
  p.created_at,

  /* Fix #9: seller join columns for card display */
  u.name                 AS seller_name,
  u.profile_image        AS seller_image,
  u.store_name           AS seller_store
`;

/* ═══════════════════════════════════════════════════════════════
   CARD JOIN CLAUSE
   Fix #9: reusable LEFT JOIN for card queries.
═══════════════════════════════════════════════════════════════ */
const CARD_JOIN = `
  LEFT JOIN public.users u ON u.id = p.seller_id
`;

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/slug/:slug
   Fix #3: view deduplication per IP (30-min cooldown)
   Fix #6: fetchProductImages skipped if JSONB images present
═══════════════════════════════════════════════════════════════ */
router.get("/slug/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug || slug === "undefined") {
    return res.status(400).json({ message: "Invalid slug" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ${PRODUCT_COLS}
       FROM   public.products p
       LEFT JOIN public.categories cat ON cat.id = p.category_id
       LEFT JOIN public.categories sub ON sub.id = p.subcategory_id
       LEFT JOIN public.users      u   ON u.id   = p.seller_id
       WHERE  p.slug      = $1
         AND  p.is_active = TRUE
         AND  p.status    IN ('active', 'active_limited')
       LIMIT 1`,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const row = rows[0];

    /* Fix #6: only hit product_images table if JSONB column is empty */
    const productImageRows = rowHasJsonbImages(row)
      ? []
      : await fetchProductImages(row.id);

    /* Fix #3: increment view only once per IP per 30 minutes */
    const ip = (
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.ip
    );

    if (!hasViewedRecently(row.id, ip)) {
      markViewed(row.id, ip);
      pool.query(
        `UPDATE public.products
         SET views               = COALESCE(views, 0) + 1,
             last_interaction_at = NOW()
         WHERE id = $1`,
        [row.id]
      ).catch(() => {});
    }

    return res.json(normalizeProduct(row, productImageRows));
  } catch (err) {
    console.error("[productDetail] GET /slug/:slug →", err.message);
    return res.status(500).json({ message: "Failed to load product" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/id/:id
   Fix #6: fetchProductImages skipped if JSONB images present
═══════════════════════════════════════════════════════════════ */
router.get("/id/:id", async (req, res) => {
  const id = sanitizeId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ${PRODUCT_COLS}
       FROM   public.products p
       LEFT JOIN public.categories cat ON cat.id = p.category_id
       LEFT JOIN public.categories sub ON sub.id = p.subcategory_id
       LEFT JOIN public.users      u   ON u.id   = p.seller_id
       WHERE  p.id        = $1
         AND  p.is_active = TRUE
         AND  p.status    IN ('active', 'active_limited')
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const row              = rows[0];
    const productImageRows = rowHasJsonbImages(row)
      ? []
      : await fetchProductImages(row.id);

    return res.json(normalizeProduct(row, productImageRows));
  } catch (err) {
    console.error("[productDetail] GET /id/:id →", err.message);
    return res.status(500).json({ message: "Failed to load product" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/similar
   Fix #2 : exclude param validated before use
   Fix #9 : seller JOIN included via CARD_COLS + CARD_JOIN
   Fix #13: public. schema prefix
═══════════════════════════════════════════════════════════════ */
router.get("/similar", async (req, res) => {
  const { category_id, limit = 10 } = req.query;

  // Fix #2: validate exclude before use as SQL param
  const exclude = sanitizeId(req.query.exclude);

  if (!category_id) {
    return res.status(400).json({ message: "category_id required" });
  }

  try {
    const safeLimit = Math.min(Number(limit) || 10, 50);
    const params    = [category_id, safeLimit];
    let excludeClause = "";

    if (exclude) {
      params.push(exclude);
      excludeClause = `AND p.id != $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT ${CARD_COLS}
       FROM   public.products p
       ${CARD_JOIN}
       WHERE  p.category_id = $1
         AND  p.is_active   = TRUE
         AND  p.status      IN ('active', 'active_limited')
         ${excludeClause}
       ORDER  BY p.boost_score DESC, p.engagement_score DESC, p.created_at DESC
       LIMIT  $2`,
      params
    );

    return res.json(rows.map((r) => normalizeProduct(r)));
  } catch (err) {
    console.error("[productDetail] GET /similar →", err.message);
    return res.status(500).json({ message: "Failed to load similar products" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/by-seller
   Fix #2 : exclude param validated
   Fix #9 : seller JOIN via CARD_COLS + CARD_JOIN
   Fix #13: public. schema prefix
═══════════════════════════════════════════════════════════════ */
router.get("/by-seller", async (req, res) => {
  const { seller_id, limit = 10 } = req.query;

  // Fix #2: validate exclude
  const exclude = sanitizeId(req.query.exclude);

  if (!seller_id) {
    return res.status(400).json({ message: "seller_id required" });
  }

  try {
    const safeLimit = Math.min(Number(limit) || 10, 50);
    const params    = [seller_id, safeLimit];
    let excludeClause = "";

    if (exclude) {
      params.push(exclude);
      excludeClause = `AND p.id != $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT ${CARD_COLS}
       FROM   public.products p
       ${CARD_JOIN}
       WHERE  p.seller_id  = $1
         AND  p.is_active  = TRUE
         AND  p.status     IN ('active', 'active_limited')
         ${excludeClause}
       ORDER  BY p.boost_score DESC, p.created_at DESC
       LIMIT  $2`,
      params
    );

    return res.json(rows.map((r) => normalizeProduct(r)));
  } catch (err) {
    console.error("[productDetail] GET /by-seller →", err.message);
    return res.status(500).json({ message: "Failed to load seller products" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/slug/:slug/reviews
   Fix #13: public. schema prefix on product_reviews
═══════════════════════════════════════════════════════════════ */
router.get("/slug/:slug/reviews", async (req, res) => {
  const { slug } = req.params;
  const limit    = Math.min(Number(req.query.limit) || 5, 50);
  const page     = Math.max(Number(req.query.page)  || 1, 1);
  const offset   = (page - 1) * limit;

  try {
    const { rows: pRows } = await pool.query(
      `SELECT id FROM public.products
       WHERE  slug      = $1
         AND  is_active = TRUE
       LIMIT  1`,
      [slug]
    );

    if (!pRows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const productId = pRows[0].id;
    let reviews     = [];
    let stats       = null;

    try {
      const [rRows, sRows] = await Promise.all([
        pool.query(
          `SELECT
             r.id,
             r.rating,
             r.comment,
             r.created_at,
             u.name          AS author,
             u.profile_image AS author_image
           FROM   public.product_reviews r
           LEFT JOIN public.users u ON u.id = r.user_id
           WHERE  r.product_id = $1
           ORDER  BY r.created_at DESC
           LIMIT  $2 OFFSET $3`,
          [productId, limit, offset]
        ),
        pool.query(
          `SELECT
             COUNT(*)::int                                  AS total,
             ROUND(AVG(rating)::numeric, 1)                 AS average,
             COUNT(*) FILTER (WHERE rating = 5)::int        AS five_star,
             COUNT(*) FILTER (WHERE rating = 4)::int        AS four_star,
             COUNT(*) FILTER (WHERE rating = 3)::int        AS three_star,
             COUNT(*) FILTER (WHERE rating = 2)::int        AS two_star,
             COUNT(*) FILTER (WHERE rating = 1)::int        AS one_star
           FROM   public.product_reviews
           WHERE  product_id = $1`,
          [productId]
        ),
      ]);

      reviews = rRows.rows;
      stats   = sRows.rows[0] ?? null;
    } catch (e) {
      /* product_reviews table may not exist yet — degrade gracefully */
      console.warn("[productDetail] reviews table query:", e.message);
    }

    return res.json({ reviews, stats, page, limit });
  } catch (err) {
    console.error("[productDetail] GET /slug/:slug/reviews →", err.message);
    return res.status(500).json({ message: "Failed to load reviews" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/slug/:slug/reviews
   Fix #4 : rating validated as integer; comment capped at 2000 chars
   Fix #8 : user_id from verified JWT, NOT from request body
   Fix #13: public. schema prefix
═══════════════════════════════════════════════════════════════ */
router.post(
  "/slug/:slug/reviews",
  reviewLimiter,
  requireAuth,           // Fix #8: must have valid JWT
  async (req, res) => {
    const { slug }   = req.params;
    const user_id    = req.userId;              // Fix #8: from JWT, not body
    const { rating, comment } = req.body;

    /* Fix #4: validate rating as a strict integer 1–5 */
    const ratingInt = parseInt(rating, 10);
    if (!ratingInt || ratingInt < 1 || ratingInt > 5 || String(ratingInt) !== String(Number(rating))) {
      return res.status(400).json({ message: "Rating must be a whole number between 1 and 5" });
    }

    /* Fix #4: cap comment length */
    const cleanComment = comment
      ? String(comment).trim().slice(0, 2000) || null
      : null;

    try {
      const { rows: pRows } = await pool.query(
        `SELECT id FROM public.products
         WHERE  slug      = $1
           AND  is_active = TRUE
         LIMIT  1`,
        [slug]
      );

      if (!pRows.length) {
        return res.status(404).json({ message: "Product not found" });
      }

      const productId = pRows[0].id;

      const existing = await pool.query(
        `SELECT id FROM public.product_reviews
         WHERE  product_id = $1
           AND  user_id    = $2
         LIMIT  1`,
        [productId, user_id]
      );

      if (existing.rows.length) {
        return res.status(409).json({
          message: "You have already reviewed this product",
        });
      }

      const { rows } = await pool.query(
        `INSERT INTO public.product_reviews
           (product_id, user_id, rating, comment)
         VALUES ($1, $2, $3, $4)
         RETURNING id, rating, comment, created_at`,
        [productId, user_id, ratingInt, cleanComment]
      );

      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error("[productDetail] POST /slug/:slug/reviews →", err.message);
      return res.status(500).json({ message: "Failed to submit review" });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/view
   Fix #3 : deduplication handled at GET /slug/:slug — this
            endpoint kept for explicit frontend calls but also
            applies the same IP cooldown guard.
   Fix #12: rate-limited
═══════════════════════════════════════════════════════════════ */
router.post(
  "/products/:id/view",
  engagementLimiter,
  async (req, res) => {
    const id = sanitizeId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid product ID" });

    const ip = (
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.ip
    );

    /* Fix #3: same cooldown guard as the slug route */
    if (hasViewedRecently(id, ip)) {
      return res.json({ success: true, counted: false });
    }

    try {
      markViewed(id, ip);
      await pool.query(
        `UPDATE public.products
         SET views               = COALESCE(views, 0) + 1,
             last_interaction_at = NOW()
         WHERE id = $1`,
        [id]
      );
      return res.json({ success: true, counted: true });
    } catch (err) {
      console.error("[productDetail] POST /products/:id/view →", err.message);
      return res.status(500).json({ message: "Failed to track view" });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/click
   Fix #12: rate-limited
=══════════════════════════════════════════════════════════════ */
router.post(
  "/products/:id/click",
  engagementLimiter,
  async (req, res) => {
    const id = sanitizeId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid product ID" });

    try {
      await pool.query(
        `UPDATE public.products
         SET clicks_count        = COALESCE(clicks_count, 0) + 1,
             last_interaction_at = NOW()
         WHERE id = $1`,
        [id]
      );
      return res.json({ success: true });
    } catch (err) {
      console.error("[productDetail] POST /products/:id/click →", err.message);
      return res.status(500).json({ message: "Failed to track click" });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/share
   Fix #12: rate-limited
═══════════════════════════════════════════════════════════════ */
router.post(
  "/products/:id/share",
  engagementLimiter,
  async (req, res) => {
    const id = sanitizeId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid product ID" });

    try {
      await pool.query(
        `UPDATE public.products
         SET share_count         = COALESCE(share_count, 0) + 1,
             last_interaction_at = NOW()
         WHERE id = $1`,
        [id]
      );
      return res.json({ success: true });
    } catch (err) {
      console.error("[productDetail] POST /products/:id/share →", err.message);
      return res.status(500).json({ message: "Failed to track share" });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/favorite  (toggle)
   Fix #8 : user_id extracted from verified JWT — not request body
   Fix #13: public. schema prefix
═══════════════════════════════════════════════════════════════ */
router.post(
  "/products/:id/favorite",
  requireAuth,           // Fix #8
  async (req, res) => {
    const id      = sanitizeId(req.params.id);
    const user_id = req.userId;                // Fix #8: from JWT

    if (!id) return res.status(400).json({ message: "Invalid product ID" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT id FROM public.favorites
         WHERE  product_id = $1
           AND  user_id    = $2
         LIMIT  1`,
        [id, user_id]
      );

      if (existing.rows.length) {
        /* Un-favourite */
        await client.query(
          `DELETE FROM public.favorites
           WHERE  product_id = $1
             AND  user_id    = $2`,
          [id, user_id]
        );
        await client.query(
          `UPDATE public.products
           SET favorites_count = GREATEST(COALESCE(favorites_count, 0) - 1, 0)
           WHERE id = $1`,
          [id]
        );
        await client.query("COMMIT");
        return res.json({ favorited: false });
      } else {
        /* Favourite */
        await client.query(
          `INSERT INTO public.favorites (user_id, product_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [user_id, id]
        );
        await client.query(
          `UPDATE public.products
           SET favorites_count = COALESCE(favorites_count, 0) + 1
           WHERE id = $1`,
          [id]
        );
        await client.query("COMMIT");
        return res.json({ favorited: true });
      }
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(
        "[productDetail] POST /products/:id/favorite →", err.message
      );
      return res.status(500).json({ message: "Failed to toggle favourite" });
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/products/:id/favorite
   Fix #8 : reads userId from JWT if present (guest-safe)
   Fix #13: public. schema prefix
═══════════════════════════════════════════════════════════════ */
router.get(
  "/products/:id/favorite",
  async (req, res) => {
    const id      = sanitizeId(req.params.id);
    // Fix #8: read from JWT if provided, don't trust query param
    const user_id = readUserIdFromReq(req);

    if (!id)      return res.status(400).json({ message: "Invalid product ID" });
    if (!user_id) return res.json({ favorited: false });

    try {
      const { rows } = await pool.query(
        `SELECT id FROM public.favorites
         WHERE  product_id = $1
           AND  user_id    = $2
         LIMIT  1`,
        [id, user_id]
      );
      return res.json({ favorited: rows.length > 0 });
    } catch (err) {
      console.error(
        "[productDetail] GET /products/:id/favorite →", err.message
      );
      return res.status(500).json({ message: "Failed to check favourite" });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/users/:userId/favorites
   Fix #13: public. schema prefix
═══════════════════════════════════════════════════════════════ */
router.get(
  "/users/:userId/favorites",
  readLimiter,
  requireAuth,
  async (req, res) => {
    /* Only allow a user to see their own favourites */
    const userId = req.userId;
    if (req.params.userId !== userId) {
      return res.status(403).json({ message: "Not authorised" });
    }

    const limit  = Math.min(Number(req.query.limit) || 20, 50);
    const page   = Math.max(Number(req.query.page)  || 1, 1);
    const offset = (page - 1) * limit;

    try {
      const { rows } = await pool.query(
        `SELECT
           p.id,
           p.slug,
           p.title,
           p.price,
           p.original_price,
           p.condition,
           p.main_image,
           p.thumbnail_url,
           p.images,
           p.location_city,
           p.location_state,
           p.is_promoted,
           p.boost_score,
           p.status,
           p.active_until,
           p.created_at,
           p.seller_id,
           p.seller_name        AS seller_name_raw,
           f.created_at         AS favorited_at,
           u.name               AS seller_name,
           u.profile_image      AS seller_image,
           u.store_name         AS seller_store
         FROM   public.favorites f
         JOIN   public.products  p ON p.id = f.product_id
         LEFT JOIN public.users  u ON u.id = p.seller_id
         WHERE  f.user_id    = $1
           AND  p.is_active  = TRUE
           AND  p.status     IN ('active', 'active_limited')
         ORDER  BY f.created_at DESC
         LIMIT  $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return res.json(rows.map((r) => normalizeProduct(r)));
    } catch (err) {
      console.error(
        "[productDetail] GET /users/:userId/favorites →", err.message
      );
      return res.status(500).json({ message: "Failed to load favourites" });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/users/:id/public  (seller public profile)
   Fix #11: omits internal metrics (total_sales, products_count)
            exposes only publicly appropriate fields
═══════════════════════════════════════════════════════════════ */
router.get(
  "/users/:id/public",
  readLimiter,
  async (req, res) => {
    const id = sanitizeId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid seller ID" });

    try {
      const [userResult, listingsResult] = await Promise.all([
        pool.query(
          `SELECT
             id,
             name,
             store_name,
             store_description,
             store_logo,
             profile_image,
             identity_verified,
             trust_score,
             rating,
             is_online,
             created_at,
             EXTRACT(MONTH FROM AGE(NOW(), created_at))::int AS member_months
           FROM   public.users
           WHERE  id     = $1
             AND  status = 'active'
           LIMIT  1`,
          [id]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS active_listings
           FROM   public.products
           WHERE  seller_id  = $1
             AND  is_active  = TRUE
             AND  status     IN ('active', 'active_limited')`,
          [id]
        ),
      ]);

      if (!userResult.rows.length) {
        return res.status(404).json({ message: "Seller not found" });
      }

      const u = userResult.rows[0];

      /* Fix #11: return only public-safe fields.
         Omits: total_sales, products_count (internal business metrics).
         Combines identity_verified + store_verified into single is_verified. */
      return res.json({
        id               : u.id,
        name             : u.name,
        store_name       : u.store_name,
        store_description: u.store_description,
        store_logo       : u.store_logo,
        profile_image    : u.profile_image,
        is_verified      : Boolean(u.identity_verified),
        trust_score      : Number(u.trust_score  || 50),
        rating           : Number(u.rating        || 0),
        is_online        : u.is_online,
        member_months    : u.member_months ?? 0,
        active_listings  : listingsResult.rows[0]?.active_listings ?? 0,
      });
    } catch (err) {
      console.error("[productDetail] GET /users/:id/public →", err.message);
      return res.status(500).json({ message: "Failed to load seller" });
    }
  }
);

export default router;