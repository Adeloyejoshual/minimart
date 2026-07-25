/**
 * routes/productDetail.js — v2
 *
 * Changes from previous version:
 *  - ACTIVE_STATUSES constant wired into ACTIVE_WHERE (was unused)
 *  - ACTIVE_WHERE now also guards: active_until IS NULL OR active_until > NOW()
 *    so expired trial listings are hidden automatically (mirrors homepage.js v4)
 *  - GET /slug/:slug — added active_until expiry guard
 *  - GET /id/:id    — added active_until expiry guard
 *  - POST /products/:id/view  — status guard added (active + active_limited)
 *  - POST /products/:id/click — status guard added
 *  - POST /products/:id/share — status guard added
 *  - normalizeProduct: trial_listing + trial_days_remaining added
 *    (mirrors homepage.js v4 shapeProduct)
 *  - PRODUCT_COLS: p.status explicitly selected (was missing from card cols)
 *  - /similar and /by-seller: active_until expiry guard added to WHERE
 *  - All existing logic unchanged — only additive / guard changes
 */

import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */

/*
 * ACTIVE_STATUSES — the two statuses that mean "publicly visible".
 *   active         → verified / subscribed seller, no expiry
 *   active_limited → unverified seller trial listing, expires in 7 days
 *
 * Used in every WHERE clause that filters public-facing queries.
 */
const ACTIVE_STATUSES = `('active', 'active_limited')`;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const parseJson = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

const daysUntilExpiry = (date) => {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
};

const safeInt = (n, fallback = 0) => {
  const parsed = parseInt(n, 10);
  return isNaN(parsed) ? fallback : parsed;
};

const safeFloat = (n, fallback = 0) => {
  const parsed = parseFloat(n);
  return isNaN(parsed) ? fallback : parsed;
};

/* ═══════════════════════════════════════════════════════════════
   PROMOTION BADGE HELPER
═══════════════════════════════════════════════════════════════ */
const getPromotionBadge = (isPromoted, promotionType, promotionPriority) => {
  if (!isPromoted) return null;
  const type     = String(promotionType     ?? "").toLowerCase();
  const priority = Number(promotionPriority ?? 0);
  if (type === "elite"   || priority >= 4) return "featured";
  if (type === "premium" || priority >= 3) return "premium";
  return "promoted";
};

/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION HELPERS
═══════════════════════════════════════════════════════════════ */
const getSubscriptionLabel = (planSlug, rank) => {
  if (!planSlug || planSlug === "free") return null;
  const labels = {
    premium : "Premium Seller",
    pro     : "Pro Seller",
    business: "Business Seller",
    diamond : "Diamond Seller",
    elite   : "Elite Seller",
  };
  return labels[planSlug] ?? (rank > 0 ? "Subscribed Seller" : null);
};

const isSubscriptionActive = (status, expiresAt) =>
  status === "active" &&
  expiresAt != null   &&
  new Date(expiresAt) > new Date();

/* ═══════════════════════════════════════════════════════════════
   BUILD IMAGE ARRAY
═══════════════════════════════════════════════════════════════ */
const buildImageArray = (row, productImageRows = []) => {
  const raw = row.images;
  if (raw) {
    const parsed = parseJson(raw, null);
    if (Array.isArray(parsed) && parsed.length) {
      const mapped = parsed
        .filter((img) => img?.url)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((img) => ({
          url  : img.url,
          key  : img.key   ?? null,
          order: img.order ?? 0,
        }));
      if (mapped.length) return mapped;
    }
  }

  if (productImageRows.length) {
    return productImageRows
      .filter((img) => img?.image_url)
      .sort((a, b) => (a.position_order ?? 0) - (b.position_order ?? 0))
      .map((img) => ({
        url  : img.image_url,
        key  : img.r2_key         ?? null,
        order: img.position_order ?? 0,
      }));
  }

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
   NORMALIZE PRODUCT
   v2 additions:
     - trial_listing         → true when status = 'active_limited'
     - trial_days_remaining  → days left before trial expires
     - trial_expires_at      → same as active_until for trial listings
   These mirror homepage.js v4 shapeProduct() so the frontend
   receives the same fields whether loading from homepage or
   directly via product detail.
═══════════════════════════════════════════════════════════════ */
const normalizeProduct = (row, productImageRows = []) => {
  if (!row) return null;

  const imageArray   = buildImageArray(row, productImageRows);
  const primaryImage = imageArray[0]?.url
    ?? row.main_image
    ?? row.thumbnail_url
    ?? null;

  const attributes     = parseJson(row.attributes,     {});
  const specifications = parseJson(row.specifications, {});
  const highlights     = parseJson(row.highlights,     []);
  const faq            = parseJson(row.faq,            []);
  const delivery       = parseJson(row.delivery,       {});
  const contact        = parseJson(row.contact,        {});

  let specsArray = [];
  if (Array.isArray(specifications)) {
    specsArray = specifications.filter(
      (s) => s && (s.label || s.key) && s.value != null
    );
  } else if (specifications && typeof specifications === "object") {
    specsArray = Object.entries(specifications)
      .filter(([, v]) => v != null && String(v).trim() !== "")
      .map(([label, value]) => ({ label, value: String(value) }));
  }

  let features = [];
  const attrFeatures = attributes?.features;
  if (Array.isArray(attrFeatures) && attrFeatures.length) {
    features = attrFeatures;
  } else if (Array.isArray(highlights) && highlights.length) {
    features = highlights;
  }

  const activeUntil   = row.active_until ?? row.expires_at ?? null;
  const daysRemaining = daysUntilExpiry(activeUntil);
  const sellerName    = row.seller_name_joined ?? row.seller_name ?? null;

  /* ── Trial listing flags (v2) — mirrors homepage.js v4 ── */
  const isTrialListing = row.status === "active_limited";
  const trialExpiresAt = isTrialListing ? activeUntil : null;
  const trialDaysRemaining = isTrialListing && trialExpiresAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(trialExpiresAt).getTime() - Date.now()) / 86_400_000
        )
      )
    : null;

  /* ── Promotion ── */
  const isPromoted        = !!row.is_promoted;
  const promotionBadge    = getPromotionBadge(
    isPromoted, row.promotion_type, row.promotion_priority
  );
  const promotionDaysLeft = daysUntilExpiry(row.promotion_expires_at);
  const promotionActive   =
    isPromoted &&
    row.promotion_expires_at != null &&
    new Date(row.promotion_expires_at) > new Date();

  /* ── Seller subscription ── */
  const sellerSubPlan    = row.seller_subscription_plan        ?? null;
  const sellerSubStatus  = row.seller_subscription_status      ?? null;
  const sellerSubExpires = row.seller_subscription_expires_at  ?? null;
  const sellerSubRank    = safeInt(row.seller_subscription_rank, 0);
  const sellerSubActive  = isSubscriptionActive(sellerSubStatus, sellerSubExpires);
  const sellerSubLabel   = getSubscriptionLabel(sellerSubPlan, sellerSubRank);

  return {
    /* ── Identity ── */
    id               : row.id,
    slug             : row.slug,
    title            : row.title       ?? "",
    description      : row.description ?? null,

    /* ── Product details ── */
    condition        : row.condition      ?? null,
    brand            : row.brand          ?? null,
    model            : row.model          ?? null,
    sku              : row.sku            ?? null,
    negotiable       : !!row.negotiable,
    stock_quantity   : row.stock_quantity != null
      ? safeInt(row.stock_quantity) : null,
    stock_status     : row.stock_status   ?? null,
    video_url        : row.video_url      ?? null,

    /* ── P2P / Swap ── */
    is_p2p           : !!row.is_p2p,
    offer_type       : row.offer_type ?? null,
    swap_for         : row.swap_for   ?? null,

    /* ── Pricing ── */
    price            : safeFloat(row.price, 0),
    original_price   : null,
    discount_percent : null,
    currency         : "NGN",

    /* ── Status ── */
    status           : row.status    ?? null,
    is_active        : !!row.is_active,
    active_until     : activeUntil,
    expires_at       : row.expires_at ?? null,
    days_remaining   : daysRemaining,

    /*
     * is_trial — true when this listing is from an unverified seller
     * and has a 7-day trial window. The frontend uses this to show
     * a "Trial listing" badge or notice on the product detail page.
     * Mirrors homepage.js v4 trial_listing field.
     */
    is_trial              : isTrialListing,
    trial_listing         : isTrialListing,        // alias for homepage compat
    trial_expires_at      : trialExpiresAt,
    trial_days_remaining  : trialDaysRemaining,

    is_featured      : !!row.is_featured,
    is_first_product : !!row.is_first_product,
    is_deleted       : !!row.is_deleted,
    moderation_status: row.moderation_status ?? null,
    has_active_report: !!row.has_active_report,
    fraud_score      : safeInt(row.fraud_score,    0),
    renewal_count    : safeInt(row.renewal_count,  0),
    search_priority  : row.search_priority         ?? null,

    /* ── Images ── */
    image            : primaryImage,
    images           : imageArray,
    main_image       : row.main_image    ?? primaryImage,
    thumbnail_url    : row.thumbnail_url ?? primaryImage,

    /* ── Category ── */
    category_id      : row.category_id      ?? null,
    subcategory_id   : row.subcategory_id   ?? null,
    category_name    : row.category_name    ?? null,
    subcategory_name : row.subcategory_name ?? null,

    /* ── Location ── */
    location_state   : row.location_state ?? null,
    location_city    : row.location_city  ?? null,
    latitude         : row.latitude       ?? null,
    longitude        : row.longitude      ?? null,

    /* ── Seller (flat — for backward compat) ── */
    seller_id        : row.seller_id,
    seller_name      : sellerName,
    seller_image     : row.seller_image  ?? null,
    seller_store     : row.seller_store  ?? null,
    seller_verified  : !!row.seller_verified,
    seller_rating    : row.seller_rating != null
      ? safeFloat(row.seller_rating) : null,
    seller_trust     : row.seller_trust  != null
      ? safeFloat(row.seller_trust)  : null,
    seller_online    : !!row.seller_online,

    /* ── Seller (structured — for product detail page) ── */
    seller: {
      id                  : row.seller_id,
      name                : sellerName,
      image               : row.seller_image  ?? null,
      store               : row.seller_store  ?? null,
      verified            : !!row.seller_verified,
      rating              : row.seller_rating != null
        ? safeFloat(row.seller_rating) : null,
      trust               : row.seller_trust  != null
        ? safeFloat(row.seller_trust)  : null,
      online              : !!row.seller_online,

      /* Subscription */
      subscription_plan      : sellerSubPlan,
      subscription_status    : sellerSubStatus,
      subscription_rank      : sellerSubRank,
      subscription_active    : sellerSubActive,
      subscription_label     : sellerSubLabel,
      subscription_expires_at: sellerSubExpires,
      subscription_badge     : sellerSubActive ? sellerSubLabel : null,
    },

    /* ── Contact ── */
    phone            : row.phone         ?? null,
    whatsapp         : row.whatsapp      ?? null,
    whatsapp_link    : row.whatsapp_link ?? null,

    /* ── Rich content ── */
    features,
    attributes,
    specifications   : specsArray,
    highlights,
    faq,
    delivery,
    contact,

    /* ── Ratings ── */
    average_rating   : safeFloat(row.average_rating, 0),
    reviews_count    : safeInt(row.reviews_count,    0),
    rating_1_count   : safeInt(row.rating_1_count,   0),
    rating_2_count   : safeInt(row.rating_2_count,   0),
    rating_3_count   : safeInt(row.rating_3_count,   0),
    rating_4_count   : safeInt(row.rating_4_count,   0),
    rating_5_count   : safeInt(row.rating_5_count,   0),

    /* ── Engagement ── */
    views            : safeInt(row.views,            0),
    clicks_count     : safeInt(row.clicks_count,     0),
    favorites_count  : safeInt(row.favorites_count,  0),
    share_count      : safeInt(row.share_count,      0),
    impression_count : safeInt(row.impression_count, 0),
    engagement_score : safeInt(row.engagement_score, 0),
    conversion_rate  : safeFloat(row.conversion_rate,0),
    quality_score    : safeInt(row.quality_score,    0),
    boost_score      : safeInt(row.boost_score,      0),

    /* ── Promotion ── */
    is_promoted          : isPromoted,
    promotion_type       : row.promotion_type       ?? null,
    promotion_priority   : row.promotion_priority   ?? null,
    promotion_expires_at : row.promotion_expires_at ?? null,
    promotion_active     : promotionActive,
    promotion_badge      : promotionBadge,
    promotion_days_left  : promotionDaysLeft,
    promotion_info       : promotionActive
      ? {
          badge      : promotionBadge,
          type       : row.promotion_type    ?? null,
          priority   : row.promotion_priority ?? null,
          days_left  : promotionDaysLeft,
          expires_at : row.promotion_expires_at,
          description:
            promotionBadge === "featured"
              ? "This listing has top placement across the marketplace."
              : promotionBadge === "premium"
              ? "This listing has premium placement in search results."
              : "This listing is promoted for higher visibility.",
        }
      : null,

    /* ── SEO ── */
    seo_title       : row.seo_title       ?? row.title            ?? null,
    seo_description : row.seo_description
      ?? row.description?.slice(0, 160)   ?? null,
    seo_keywords    : row.seo_keywords    ?? null,
    canonical_url   : row.canonical_url   ?? null,

    /* ── Timestamps ── */
    created_at          : row.created_at,
    updated_at          : row.updated_at          ?? null,
    last_interaction_at : row.last_interaction_at ?? null,
  };
};

/* ═══════════════════════════════════════════════════════════════
   FETCH PRODUCT IMAGES
═══════════════════════════════════════════════════════════════ */
const fetchProductImages = async (productId) => {
  try {
    const { rows } = await pool.query(
      `SELECT image_url, r2_key, position_order, is_primary
       FROM   product_images
       WHERE  product_id = $1
       ORDER  BY position_order ASC, is_primary DESC`,
      [productId]
    );
    return rows;
  } catch {
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════════
   COLUMN SETS
═══════════════════════════════════════════════════════════════ */
const PRODUCT_COLS = `
  p.id,
  p.slug,
  p.title,
  p.description,
  p.price,
  p.condition,
  p.brand,
  p.model,
  p.sku,
  p.negotiable,
  p.stock_quantity,
  p.stock_status,
  p.video_url,
  p.is_p2p,
  p.offer_type,
  p.swap_for,
  p.status,
  p.is_active,
  p.active_until,
  p.expires_at,
  p.is_featured,
  p.is_first_product,
  p.is_deleted,
  p.moderation_status,
  p.has_active_report,
  p.fraud_score,
  p.renewal_count,
  p.search_priority,
  p.created_at,
  p.updated_at,
  p.last_interaction_at,
  p.seller_id,
  p.seller_name,
  p.category_id,
  p.subcategory_id,
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
  p.boost_score,
  p.is_promoted,
  p.promotion_type,
  p.promotion_priority,
  p.promotion_expires_at,
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
  p.average_rating,
  p.reviews_count,
  p.rating_1_count,
  p.rating_2_count,
  p.rating_3_count,
  p.rating_4_count,
  p.rating_5_count,

  /* Columns that do NOT exist on the table — safe NULL aliases */
  NULL::numeric   AS original_price,
  NULL::text      AS currency,
  NULL::jsonb     AS features,
  NULL::jsonb     AS tags,
  NULL::text      AS barcode,

  /* Category names */
  cat.name        AS category_name,
  sub.name        AS subcategory_name,

  /* Seller from users JOIN */
  u.name                       AS seller_name_joined,
  u.profile_image              AS seller_image,
  u.store_name                 AS seller_store,
  u.identity_verified          AS seller_verified,
  u.trust_score                AS seller_trust,
  u.rating                     AS seller_rating,
  u.is_online                  AS seller_online,

  /* Seller subscription fields */
  u.subscription_plan          AS seller_subscription_plan,
  u.subscription_status        AS seller_subscription_status,
  u.subscription_expires_at    AS seller_subscription_expires_at,
  COALESCE(sp.rank, 0)         AS seller_subscription_rank
`;

/*
 * CARD_COLS — for list / grid views (/similar, /by-seller, /favorites).
 * v2: p.status explicitly included so normalizeProduct can
 *     set trial_listing correctly on card results.
 */
const CARD_COLS = `
  p.id,
  p.slug,
  p.title,
  p.price,
  p.condition,
  p.negotiable,
  p.main_image,
  p.thumbnail_url,
  p.images,
  p.location_city,
  p.location_state,
  p.is_promoted,
  p.is_featured,
  p.boost_score,
  p.search_priority,
  p.engagement_score,
  p.promotion_priority,
  p.promotion_type,
  p.promotion_expires_at,
  p.views,
  p.favorites_count,
  p.average_rating,
  p.reviews_count,
  p.status,
  p.active_until,
  p.expires_at,
  p.seller_id,
  p.seller_name,
  p.created_at,
  NULL::numeric   AS original_price,
  NULL::text      AS currency
`;

/*
 * ACTIVE_WHERE — single source of truth for "publicly visible" filter.
 *
 * v2 changes:
 *   1. Uses ACTIVE_STATUSES constant (was hard-coded in some places).
 *   2. Added active_until expiry guard:
 *        (p.active_until IS NULL OR p.active_until > NOW())
 *      This means expired trial listings (active_limited + past active_until)
 *      are automatically hidden without needing a cron job to have run.
 *      Verified/subscribed listings have NULL active_until → always shown.
 */
const ACTIVE_WHERE = `
  p.is_active     = TRUE
  AND p.is_deleted  IS NOT TRUE
  AND p.status      IN ${ACTIVE_STATUSES}
  AND (p.active_until IS NULL OR p.active_until > NOW())
`;

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/slug/:slug
═══════════════════════════════════════════════════════════════ */
router.get("/slug/:slug", async (req, res) => {
  const { slug } = req.params;

  if (!slug || slug === "undefined") {
    return res.status(400).json({ message: "Invalid slug" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ${PRODUCT_COLS}
       FROM   public.products      p
       LEFT   JOIN public.categories    cat ON cat.id  = p.category_id
       LEFT   JOIN public.categories    sub ON sub.id  = p.subcategory_id
       LEFT   JOIN public.users         u   ON u.id    = p.seller_id
       LEFT   JOIN subscription_plans   sp
               ON  sp.slug      = u.subscription_plan
               AND sp.is_active = TRUE
       WHERE  p.slug = $1
         AND  ${ACTIVE_WHERE}
       LIMIT  1`,
      [slug]
    );

    if (!rows.length) {
      /* Debug — show why it was filtered */
      try {
        const { rows: debug } = await pool.query(
          `SELECT id, slug, status, is_active, is_deleted,
                  moderation_status, active_until
           FROM   public.products WHERE slug = $1 LIMIT 1`,
          [slug]
        );
        if (!debug.length) {
          console.warn(`[product/slug] slug not found in DB: "${slug}"`);
        } else {
          const d = debug[0];
          console.warn(
            `[product/slug] "${slug}" filtered —`,
            `status=${d.status}`,
            `is_active=${d.is_active}`,
            `is_deleted=${d.is_deleted}`,
            `moderation=${d.moderation_status}`,
            `active_until=${d.active_until}`   // ← now shows expiry in debug
          );
        }
      } catch (_) {}
      return res.status(404).json({ message: "Product not found" });
    }

    const row              = rows[0];
    const productImageRows = await fetchProductImages(row.id);

    /* Async view increment — non-blocking */
    pool.query(
      `UPDATE public.products
       SET    views               = COALESCE(views, 0) + 1,
              last_interaction_at = NOW()
       WHERE  id = $1`,
      [row.id]
    ).catch(() => {});

    return res.json(normalizeProduct(row, productImageRows));
  } catch (err) {
    console.error(`[product/slug] GET /slug/${slug} →`, err.message);
    return res.status(500).json({ message: "Failed to load product" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/id/:id
═══════════════════════════════════════════════════════════════ */
router.get("/id/:id", async (req, res) => {
  const { id } = req.params;

  if (!id || id === "undefined") {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ${PRODUCT_COLS}
       FROM   public.products      p
       LEFT   JOIN public.categories    cat ON cat.id  = p.category_id
       LEFT   JOIN public.categories    sub ON sub.id  = p.subcategory_id
       LEFT   JOIN public.users         u   ON u.id    = p.seller_id
       LEFT   JOIN subscription_plans   sp
               ON  sp.slug      = u.subscription_plan
               AND sp.is_active = TRUE
       WHERE  p.id = $1
         AND  ${ACTIVE_WHERE}
       LIMIT  1`,
      [id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Product not found" });

    const row              = rows[0];
    const productImageRows = await fetchProductImages(row.id);
    return res.json(normalizeProduct(row, productImageRows));
  } catch (err) {
    console.error(`[product/id] GET /id/${id} →`, err.message);
    return res.status(500).json({ message: "Failed to load product" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/similar
═══════════════════════════════════════════════════════════════ */
router.get("/similar", async (req, res) => {
  const { category_id, exclude, limit = 10 } = req.query;

  if (!category_id) {
    return res.status(400).json({ message: "category_id required" });
  }

  try {
    const safeLimit = Math.min(safeInt(limit, 10), 50);
    const params    = [category_id, safeLimit];
    let   excludeClause = "";

    if (exclude) {
      params.push(exclude);
      excludeClause = `AND p.id != $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT ${CARD_COLS}
       FROM   public.products p
       WHERE  p.category_id = $1
         AND  ${ACTIVE_WHERE}
         ${excludeClause}
       ORDER BY
         p.is_promoted        DESC,
         p.promotion_priority DESC,
         p.search_priority    DESC,
         p.boost_score        DESC,
         p.engagement_score   DESC,
         p.created_at         DESC
       LIMIT  $2`,
      params
    );

    return res.json(rows.map((r) => normalizeProduct(r)));
  } catch (err) {
    console.error("[product/similar] →", err.message);
    return res.status(500).json({ message: "Failed to load similar products" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/by-seller
═══════════════════════════════════════════════════════════════ */
router.get("/by-seller", async (req, res) => {
  const { seller_id, exclude, limit = 10 } = req.query;

  if (!seller_id) {
    return res.status(400).json({ message: "seller_id required" });
  }

  try {
    const safeLimit = Math.min(safeInt(limit, 10), 50);
    const params    = [seller_id, safeLimit];
    let   excludeClause = "";

    if (exclude) {
      params.push(exclude);
      excludeClause = `AND p.id != $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT ${CARD_COLS}
       FROM   public.products p
       WHERE  p.seller_id = $1
         AND  ${ACTIVE_WHERE}
         ${excludeClause}
       ORDER BY
         p.is_promoted        DESC,
         p.promotion_priority DESC,
         p.boost_score        DESC,
         p.created_at         DESC
       LIMIT  $2`,
      params
    );

    return res.json(rows.map((r) => normalizeProduct(r)));
  } catch (err) {
    console.error("[product/by-seller] →", err.message);
    return res.status(500).json({ message: "Failed to load seller products" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/slug/:slug/reviews
═══════════════════════════════════════════════════════════════ */
router.get("/slug/:slug/reviews", async (req, res) => {
  const { slug } = req.params;
  const limit    = Math.min(safeInt(req.query.limit, 5),  50);
  const page     = Math.max(safeInt(req.query.page,  1),   1);
  const offset   = (page - 1) * limit;

  try {
    const { rows: pRows } = await pool.query(
      `SELECT
         id,
         average_rating,
         reviews_count,
         rating_1_count,
         rating_2_count,
         rating_3_count,
         rating_4_count,
         rating_5_count
       FROM   public.products
       WHERE  slug      = $1
         AND  is_active = TRUE
         AND  is_deleted IS NOT TRUE
       LIMIT  1`,
      [slug]
    );

    if (!pRows.length)
      return res.status(404).json({ message: "Product not found" });

    const p = pRows[0];
    const stats = {
      total     : safeInt(p.reviews_count,   0),
      average   : safeFloat(p.average_rating, 0),
      five_star : safeInt(p.rating_5_count,  0),
      four_star : safeInt(p.rating_4_count,  0),
      three_star: safeInt(p.rating_3_count,  0),
      two_star  : safeInt(p.rating_2_count,  0),
      one_star  : safeInt(p.rating_1_count,  0),
    };

    let reviews = [];
    try {
      const { rows } = await pool.query(
        `SELECT
           r.id,
           r.rating,
           r.comment,
           r.created_at,
           u.name          AS author,
           u.profile_image AS author_image
         FROM   product_reviews r
         LEFT   JOIN public.users u ON u.id = r.user_id
         WHERE  r.product_id = $1
         ORDER  BY r.created_at DESC
         LIMIT  $2 OFFSET $3`,
        [p.id, limit, offset]
      );
      reviews = rows;
    } catch (e) {
      console.warn("[product/reviews] table error:", e.message);
    }

    return res.json({ reviews, stats, page, limit });
  } catch (err) {
    console.error(`[product/reviews] GET /slug/${slug}/reviews →`, err.message);
    return res.status(500).json({ message: "Failed to load reviews" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/slug/:slug/reviews
═══════════════════════════════════════════════════════════════ */
router.post("/slug/:slug/reviews", async (req, res) => {
  const { slug }                     = req.params;
  const { user_id, rating, comment } = req.body;

  if (!user_id) return res.status(401).json({ message: "Login required" });
  const ratingNum = safeInt(rating, 0);
  if (ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ message: "Rating must be 1–5" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: pRows } = await client.query(
      `SELECT id FROM public.products
       WHERE  slug      = $1
         AND  is_active = TRUE
         AND  is_deleted IS NOT TRUE
       LIMIT  1`,
      [slug]
    );
    if (!pRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Product not found" });
    }

    const productId = pRows[0].id;

    const { rows: existing } = await client.query(
      `SELECT id FROM product_reviews
       WHERE  product_id = $1 AND user_id = $2 LIMIT 1`,
      [productId, user_id]
    );
    if (existing.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "You already reviewed this product" });
    }

    const { rows: inserted } = await client.query(
      `INSERT INTO product_reviews (product_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rating, comment, created_at`,
      [productId, user_id, ratingNum, comment?.trim() || null]
    );

    await client.query(
      `UPDATE public.products
       SET
         reviews_count             = COALESCE(reviews_count, 0) + 1,
         rating_${ratingNum}_count = COALESCE(rating_${ratingNum}_count, 0) + 1,
         average_rating            = (
           SELECT ROUND(AVG(rating)::numeric, 2)
           FROM   product_reviews
           WHERE  product_id = $1
         )
       WHERE id = $1`,
      [productId]
    );

    await client.query("COMMIT");
    return res.status(201).json(inserted[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(
      `[product/reviews] POST /slug/${slug}/reviews →`, err.message
    );
    return res.status(500).json({ message: "Failed to submit review" });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/view
   v2: status guard added — only active + active_limited products
       accumulate analytics. Mirrors homepage.js v4.
═══════════════════════════════════════════════════════════════ */
router.post("/products/:id/view", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE public.products
       SET    views               = COALESCE(views, 0) + 1,
              last_interaction_at = NOW()
       WHERE  id        = $1
         AND  is_active  = TRUE
         AND  status    IN ${ACTIVE_STATUSES}`,
      [id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("[product/view] →", err.message);
    return res.status(500).json({ message: "Failed to track view" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/click
   v2: status guard added
═══════════════════════════════════════════════════════════════ */
router.post("/products/:id/click", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE public.products
       SET    clicks_count        = COALESCE(clicks_count, 0) + 1,
              last_interaction_at = NOW()
       WHERE  id        = $1
         AND  is_active  = TRUE
         AND  status    IN ${ACTIVE_STATUSES}`,
      [id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("[product/click] →", err.message);
    return res.status(500).json({ message: "Failed to track click" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/share
   v2: status guard added
═══════════════════════════════════════════════════════════════ */
router.post("/products/:id/share", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE public.products
       SET    share_count         = COALESCE(share_count, 0) + 1,
              last_interaction_at = NOW()
       WHERE  id        = $1
         AND  is_active  = TRUE
         AND  status    IN ${ACTIVE_STATUSES}`,
      [id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("[product/share] →", err.message);
    return res.status(500).json({ message: "Failed to track share" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/favorite
═══════════════════════════════════════════════════════════════ */
router.post("/products/:id/favorite", async (req, res) => {
  const { id }      = req.params;
  const { user_id } = req.body;

  if (!user_id) return res.status(401).json({ message: "Login required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existing } = await client.query(
      `SELECT id FROM favorites
       WHERE  product_id = $1 AND user_id = $2 LIMIT 1`,
      [id, user_id]
    );

    if (existing.length) {
      await client.query(
        `DELETE FROM favorites WHERE product_id = $1 AND user_id = $2`,
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
    }

    await client.query(
      `INSERT INTO favorites (user_id, product_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
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
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[product/favorite] →", err.message);
    return res.status(500).json({ message: "Failed to toggle favorite" });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/products/:id/favorite
═══════════════════════════════════════════════════════════════ */
router.get("/products/:id/favorite", async (req, res) => {
  const { id }      = req.params;
  const { user_id } = req.query;

  if (!user_id) return res.json({ favorited: false });

  try {
    const { rows } = await pool.query(
      `SELECT id FROM favorites
       WHERE  product_id = $1 AND user_id = $2 LIMIT 1`,
      [id, user_id]
    );
    return res.json({ favorited: rows.length > 0 });
  } catch (err) {
    console.error("[product/favorite] →", err.message);
    return res.status(500).json({ message: "Failed to check favorite" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/users/:userId/favorites
═══════════════════════════════════════════════════════════════ */
router.get("/users/:userId/favorites", async (req, res) => {
  const { userId } = req.params;
  const limit      = Math.min(safeInt(req.query.limit, 20), 50);
  const page       = Math.max(safeInt(req.query.page,   1),  1);
  const offset     = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT
         p.id, p.slug, p.title, p.price, p.condition, p.negotiable,
         p.main_image, p.thumbnail_url, p.images,
         p.location_city, p.location_state,
         p.is_promoted, p.boost_score, p.search_priority,
         p.promotion_priority, p.promotion_type, p.promotion_expires_at,
         p.average_rating, p.reviews_count,
         p.status, p.active_until, p.expires_at,
         p.seller_id, p.seller_name, p.created_at,
         NULL::numeric  AS original_price,
         NULL::text     AS currency,
         f.created_at   AS favorited_at
       FROM   favorites f
       JOIN   public.products p ON p.id = f.product_id
       WHERE  f.user_id   = $1
         AND  p.is_active = TRUE
         AND  p.is_deleted IS NOT TRUE
         AND  p.status    IN ${ACTIVE_STATUSES}
         AND  (p.active_until IS NULL OR p.active_until > NOW())
       ORDER  BY f.created_at DESC
       LIMIT  $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.json(rows.map((r) => normalizeProduct(r)));
  } catch (err) {
    console.error("[product/favorites] →", err.message);
    return res.status(500).json({ message: "Failed to load favorites" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/users/:id/public
═══════════════════════════════════════════════════════════════ */
router.get("/users/:id/public", async (req, res) => {
  const { id } = req.params;

  try {
    const [userResult, listingsResult] = await Promise.all([
      pool.query(
        `SELECT
           u.id,
           u.name,
           u.store_name,
           u.store_description,
           u.store_logo,
           u.profile_image,
           u.store_verified,
           u.verified,
           u.identity_verified,
           u.trust_score,
           u.rating,
           u.products_count,
           u.total_sales,
           u.is_online,
           u.created_at,
           EXTRACT(MONTH FROM AGE(NOW(), u.created_at))::int AS member_months,
           u.subscription_plan,
           u.subscription_status,
           u.subscription_expires_at,
           COALESCE(sp.rank, 0) AS subscription_rank,
           sp.name              AS subscription_plan_name,
           sp.badge             AS subscription_badge
         FROM   public.users          u
         LEFT   JOIN subscription_plans sp
                ON  sp.slug      = u.subscription_plan
                AND sp.is_active = TRUE
         WHERE  u.id     = $1
           AND  u.status = 'active'
         LIMIT  1`,
        [id]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS active_listings
         FROM   public.products
         WHERE  seller_id   = $1
           AND  is_active   = TRUE
           AND  is_deleted  IS NOT TRUE
           AND  status      IN ${ACTIVE_STATUSES}
           AND  (active_until IS NULL OR active_until > NOW())`,
        [id]
      ),
    ]);

    if (!userResult.rows.length) {
      return res.status(404).json({ message: "Seller not found" });
    }

    const u = userResult.rows[0];

    const subActive = isSubscriptionActive(
      u.subscription_status,
      u.subscription_expires_at
    );
    const subLabel = getSubscriptionLabel(
      u.subscription_plan,
      safeInt(u.subscription_rank, 0)
    );

    return res.json({
      id                   : u.id,
      name                 : u.name,
      store_name           : u.store_name,
      store_description    : u.store_description,
      store_logo           : u.store_logo,
      profile_image        : u.profile_image,
      store_verified       : !!u.store_verified,
      verified             : !!u.verified,
      identity_verified    : !!u.identity_verified,
      trust_score          : safeFloat(u.trust_score, 50),
      rating               : safeFloat(u.rating, 0),
      products_count       : safeInt(u.products_count, 0),
      total_sales          : safeInt(u.total_sales, 0),
      is_online            : !!u.is_online,
      created_at           : u.created_at,
      member_months        : safeInt(u.member_months, 0),
      active_listings      : listingsResult.rows[0]?.active_listings ?? 0,

      subscription: {
        plan      : u.subscription_plan       ?? null,
        plan_name : u.subscription_plan_name  ?? null,
        status    : u.subscription_status     ?? null,
        expires_at: u.subscription_expires_at ?? null,
        rank      : safeInt(u.subscription_rank, 0),
        active    : subActive,
        label     : subActive ? subLabel : null,
        badge     : subActive ? (u.subscription_badge ?? subLabel) : null,
      },
    });
  } catch (err) {
    console.error(
      `[product/seller] GET /users/${id}/public →`, err.message
    );
    return res.status(500).json({ message: "Failed to load seller" });
  }
});

export default router;