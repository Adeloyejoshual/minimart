// routes/dashboard.js
import express      from "express";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   IN-MEMORY CACHE  (TTL = 2 min — reduced for freshness)
═══════════════════════════════════════════════════════════════ */
const _cache    = new Map();
const CACHE_TTL = 2 * 60 * 1_000;

const cacheGet = (key) => {
  const item = _cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) { _cache.delete(key); return null; }
  return item.value;
};
const cacheSet = (key, value) =>
  _cache.set(key, { value, expires: Date.now() + CACHE_TTL });
const cacheDel = (prefix) => {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
};

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _cache.entries()) {
    if (now > v.expires) _cache.delete(k);
  }
}, 5 * 60 * 1_000);

/* ═══════════════════════════════════════════════════════════════
   TIER POLICY
   Kept in sync with routes/addproduct.js POLICY table.
   ─────────────────────────────────────────────────────────────
   Renewal rules:
     unverified → BLOCKED (trials can't be renewed)
     verified   → 30 days per renewal, max 10 renewals, ≤ 7 days left
     subscriber → 90 days per renewal, unlimited, anytime
═══════════════════════════════════════════════════════════════ */
const RENEWAL_POLICY = Object.freeze({
  unverified: Object.freeze({
    canRenew        : false,
    renewDays       : 0,
    maxRenewals     : 0,
    renewWindowDays : 0,
  }),
  verified: Object.freeze({
    canRenew        : true,
    renewDays       : 30,
    maxRenewals     : 10,
    renewWindowDays : 7,          // Only when ≤ 7 days remain
  }),
  subscriber: Object.freeze({
    canRenew        : true,
    renewDays       : 90,
    maxRenewals     : null,       // ♾ unlimited
    renewWindowDays : null,       // Renew anytime
  }),
});

const DELETE_HOLD_DAYS         = 30;
const DELETE_HOLD_DAYS_FLAGGED = 365;

/* ═══════════════════════════════════════════════════════════════
   STATUS HELPERS
   Valid statuses:
     draft | active | active_limited | paused | pending_payment | deleted
═══════════════════════════════════════════════════════════════ */
const ACTIVE_STATUSES     = `p.status IN ('active', 'active_limited')`;
const ACTIVE_STATUSES_RAW = `status IN ('active', 'active_limited')`;
const NOT_DELETED         = `p.is_deleted = false AND p.status != 'deleted'`;
const NOT_DELETED_RAW     = `is_deleted = false AND status != 'deleted'`;

/* ═══════════════════════════════════════════════════════════════
   TIER DETECTION  (shared helper)
═══════════════════════════════════════════════════════════════ */
async function getUserTier(userId) {
  const { rows } = await pool.query(
    `SELECT
       identity_verified,
       subscription_plan,
       subscription_status,
       subscription_expires_at
     FROM public.users
     WHERE id = $1`,
    [userId]
  );

  if (!rows.length) return null;

  const u = rows[0];

  const hasActiveSubscription =
    u.subscription_status === "active" &&
    u.subscription_plan   &&
    u.subscription_plan   !== "free" &&
    u.subscription_expires_at &&
    new Date(u.subscription_expires_at).getTime() > Date.now();

  const isVerified = Boolean(u.identity_verified);

  let tier;
  if      (hasActiveSubscription) tier = "subscriber";
  else if (isVerified)            tier = "verified";
  else                            tier = "unverified";

  return {
    tier,
    isVerified,
    isSubscriber : hasActiveSubscription,
    subscriptionPlan     : u.subscription_plan,
    subscriptionExpiresAt: u.subscription_expires_at,
  };
}

/* ═══════════════════════════════════════════════════════════════
   IMAGE RESOLVER
═══════════════════════════════════════════════════════════════ */
function resolveProductImage(p) {
  let image = p.main_image || p.thumbnail_url || null;

  let imagesArr = [];
  if (p.images) {
    let raw = p.images;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch { raw = []; }
    }
    if (Array.isArray(raw) && raw.length > 0) {
      imagesArr = raw
        .map((img) => {
          if (typeof img === "string") return img;
          if (img?.url)        return img.url;
          if (img?.secure_url) return img.secure_url;
          return null;
        })
        .filter(Boolean);
      if (!image && imagesArr.length > 0) image = imagesArr[0];
    }
  }

  if (imagesArr.length === 0 && image) imagesArr = [image];

  return { image, imagesArr };
}

/* ═══════════════════════════════════════════════════════════════
   SHAPE PRODUCT  (list view — lighter)
═══════════════════════════════════════════════════════════════ */
function shapeProduct(p) {
  const { image, imagesArr } = resolveProductImage(p);

  let displayStatus = p.status || "draft";
  if (p.status === "active_limited" && p.active_until) {
    if (new Date(p.active_until) < new Date()) displayStatus = "expired";
  }

  return {
    id:               p.id,
    title:            p.title,
    price:            Number(p.price            || 0),
    slug:             p.slug             || null,
    status:           p.status           || "draft",
    display_status:   displayStatus,
    is_active:        p.is_active        !== false,
    is_promoted:      !!p.is_promoted,
    is_featured:      !!p.is_featured,
    promotion_type:   p.promotion_type   || null,
    views:            Number(p.views            || 0),
    clicks_count:     Number(p.clicks_count     || 0),
    favorites_count:  Number(p.favorites_count  || 0),
    engagement_score: Number(p.engagement_score || 0),
    quality_score:    Number(p.quality_score    || 0),
    created_at:       p.created_at       || null,
    updated_at:       p.updated_at       || null,
    active_until:     p.active_until     || null,
    location_city:    p.location_city    || null,
    location_state:   p.location_state   || null,
    category_name:    p.category_name    || null,
    condition:        p.condition        || null,
    negotiable:       p.negotiable       ?? true,
    stock_quantity:   Number(p.stock_quantity || 1),
    stock_status:     p.stock_status     || "in_stock",
    main_image:       p.main_image       || null,
    thumbnail_url:    p.thumbnail_url    || null,
    image,
    images:           imagesArr,
    seller_name:      p.seller_name      || null,
    renewal_count:    Number(p.renewal_count || 0),
  };
}

/* ═══════════════════════════════════════════════════════════════
   SHAPE PRODUCT FULL  (edit view — all fields)
═══════════════════════════════════════════════════════════════ */
function shapeProductFull(p) {
  const base = shapeProduct(p);

  let productImages = [];
  if (p.product_images) {
    const raw = typeof p.product_images === "string"
      ? (() => { try { return JSON.parse(p.product_images); } catch { return []; } })()
      : p.product_images;
    if (Array.isArray(raw)) productImages = raw;
  }

  return {
    ...base,
    description:     p.description     || "",
    category_id:     p.category_id     || null,
    subcategory_id:  p.subcategory_id  || null,
    phone:           p.phone           || null,
    whatsapp:        p.whatsapp        || null,
    whatsapp_link:   p.whatsapp_link   || null,
    latitude:        p.latitude        || null,
    longitude:       p.longitude       || null,
    attributes:      p.attributes      || {},
    delivery:        p.delivery        || {},
    contact:         p.contact         || {},
    highlights:      p.highlights      || [],
    specifications:  p.specifications  || {},
    faq:             p.faq             || [],
    brand:           p.brand           || null,
    model:           p.model           || null,
    video_url:       p.video_url       || null,
    promotion_end:   p.promotion_end   || null,
    promotion_start: p.promotion_start || null,
    product_images:  productImages,
  };
}

/* ═══════════════════════════════════════════════════════════════
   TAB WHERE BUILDER
═══════════════════════════════════════════════════════════════ */
function buildTabWhere(tab) {
  switch (tab) {
    case "active":
      return {
        where: `AND ${ACTIVE_STATUSES} AND p.is_active = true AND ${NOT_DELETED}`,
        count: `AND ${ACTIVE_STATUSES_RAW} AND is_active = true AND ${NOT_DELETED_RAW}`,
      };
    case "active_limited":
      return {
        where: `AND p.status = 'active_limited' AND p.is_active = true AND ${NOT_DELETED}`,
        count: `AND status = 'active_limited' AND is_active = true AND ${NOT_DELETED_RAW}`,
      };
    case "draft":
      return {
        where: `AND p.status = 'draft' AND ${NOT_DELETED}`,
        count: `AND status = 'draft' AND ${NOT_DELETED_RAW}`,
      };
    case "paused":
      return {
        where: `AND p.status = 'paused' AND ${NOT_DELETED}`,
        count: `AND status = 'paused' AND ${NOT_DELETED_RAW}`,
      };
    case "pending":
    case "pending_payment":
      return {
        where: `AND p.status = 'pending_payment' AND ${NOT_DELETED}`,
        count: `AND status = 'pending_payment' AND ${NOT_DELETED_RAW}`,
      };
    default:
      return {
        where: `AND ${NOT_DELETED}`,
        count: `AND ${NOT_DELETED_RAW}`,
      };
  }
}

/* ═══════════════════════════════════════════════════════════════
   PRODUCTS SELECT COLUMNS
═══════════════════════════════════════════════════════════════ */
const PRODUCT_COLS = `
  p.id, p.title, p.price, p.slug, p.status, p.is_active,
  p.is_promoted, p.is_featured, p.promotion_type,
  p.views, p.clicks_count, p.favorites_count,
  p.engagement_score, p.quality_score,
  p.created_at, p.updated_at, p.active_until,
  p.main_image, p.thumbnail_url, p.images,
  p.location_city, p.location_state,
  p.condition, p.negotiable, p.stock_quantity, p.stock_status,
  p.seller_name, p.renewal_count,
  cat.name AS category_name
`;

const PRODUCT_COLS_FULL = `
  p.*,
  cat.name    AS category_name,
  subcat.name AS subcategory_name
`;

/* ═══════════════════════════════════════════════════════════════
   SELLER SCORE
═══════════════════════════════════════════════════════════════ */
async function getSellerScore(userId) {
  try {
    const { rows: rRows } = await pool.query(
      `SELECT
         COALESCE(
           AVG(EXTRACT(EPOCH FROM (last_interaction_at - created_at)) / 3600),
           24
         ) AS avg_hours
       FROM public.products
       WHERE seller_id            = $1
         AND last_interaction_at IS NOT NULL
         AND is_active            = true
         AND ${NOT_DELETED_RAW}`,
      [userId]
    );

    const hrs = parseFloat(rRows[0]?.avg_hours) || 24;
    const responseScore =
      hrs <=  1 ? 100 :
      hrs <=  6 ?  80 :
      hrs <= 24 ?  60 :
      hrs <= 48 ?  40 : 20;

    const { rows: aRows } = await pool.query(
      `SELECT
         u.rating,
         COALESCE(SUM(p.views),            0)::int AS total_views,
         COALESCE(SUM(p.clicks_count),     0)::int AS total_clicks,
         COALESCE(SUM(p.engagement_score), 0)::int AS total_engagement,
         COUNT(p.id)::int                          AS active_count
       FROM public.users u
       LEFT JOIN public.products p
         ON  p.seller_id = u.id
         AND ${ACTIVE_STATUSES}
         AND p.is_active = true
         AND ${NOT_DELETED}
       WHERE u.id = $1
       GROUP BY u.id, u.rating`,
      [userId]
    );

    if (!aRows.length) return 0;

    const a          = aRows[0];
    const views      = Number(a.total_views      || 0);
    const clicks     = Number(a.total_clicks     || 0);
    const engagement = Number(a.total_engagement || 0);
    const products   = Math.max(Number(a.active_count || 1), 1);
    const rating     = Number(a.rating           || 0);

    const ctr         = views > 0 ? (clicks / views) * 100 : 0;
    const ctrScore    = Math.min(100, ctr * 5);
    const engScore    = Math.min(100, engagement / products);
    const ratingScore = (rating / 5) * 100;

    return Math.min(100, Math.max(0, Math.round(
      ctrScore      * 0.40 +
      engScore      * 0.25 +
      ratingScore   * 0.20 +
      responseScore * 0.15
    )));
  } catch (err) {
    console.error("[getSellerScore] error:", err.message);
    return 0;
  }
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/stats
═══════════════════════════════════════════════════════════════ */
router.get("/stats", authenticate, async (req, res) => {
  try {
    const userId   = req.user.id;
    const cacheKey = `stats:${userId}`;

    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ success: true, cached: true, stats: cached });

    console.log(`[dashboard/stats] userId=${userId}`);

    const { rows } = await pool.query(
      `SELECT
         u.rating, u.total_sales, u.trust_score,
         COALESCE(SUM(p.views),           0)::int AS total_views,
         COALESCE(SUM(p.clicks_count),    0)::int AS total_clicks,
         COALESCE(SUM(p.favorites_count), 0)::int AS total_favorites,
         COUNT(p.id)::int                         AS total_products,

         COUNT(CASE WHEN p.status = 'active'          AND p.is_active = true THEN 1 END)::int AS active,
         COUNT(CASE WHEN p.status = 'active_limited'  AND p.is_active = true THEN 1 END)::int AS active_limited,
         COUNT(CASE WHEN p.status = 'draft'                                  THEN 1 END)::int AS draft,
         COUNT(CASE WHEN p.status = 'paused'                                 THEN 1 END)::int AS paused,
         COUNT(CASE WHEN p.status = 'pending_payment'                        THEN 1 END)::int AS pending_payment,
         COUNT(CASE WHEN p.is_promoted = true                                THEN 1 END)::int AS promoted,
         COUNT(CASE WHEN p.is_featured = true                                THEN 1 END)::int AS featured

       FROM public.users u
       LEFT JOIN public.products p
         ON  p.seller_id  = u.id
         AND p.is_deleted  = false
         AND p.status     != 'deleted'
       WHERE u.id = $1
       GROUP BY u.id, u.rating, u.total_sales, u.trust_score`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const r           = rows[0];
    const activeTotal = Number(r.active || 0) + Number(r.active_limited || 0);

    const stats = {
      total_products:  Number(r.total_products   || 0),
      active:          activeTotal,
      active_full:     Number(r.active           || 0),
      active_limited:  Number(r.active_limited   || 0),
      draft:           Number(r.draft            || 0),
      paused:          Number(r.paused           || 0),
      pending_payment: Number(r.pending_payment  || 0),
      promoted:        Number(r.promoted         || 0),
      featured:        Number(r.featured         || 0),
      total_views:     Number(r.total_views      || 0),
      total_clicks:    Number(r.total_clicks     || 0),
      total_favorites: Number(r.total_favorites  || 0),
      total_revenue:   Number(r.total_sales      || 0),
      rating:          Number(r.rating           || 0),
      trust_score:     Number(r.trust_score      || 50),
    };

    console.log(`[dashboard/stats] total=${stats.total_products} active=${stats.active}`);

    cacheSet(cacheKey, stats);
    return res.json({ success: true, cached: false, stats });

  } catch (err) {
    console.error("[dashboard/stats] ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error", detail: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/products
   Supports: tab, limit, cursor (infinite scroll), search
═══════════════════════════════════════════════════════════════ */
router.get("/products", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit  = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;
    const tab    = req.query.tab    || "all";
    const search = (req.query.search || "").trim();

    console.log(`[dashboard/products] userId=${userId} tab=${tab} cursor=${cursor} search=${search}`);

    const { where, count } = buildTabWhere(tab);

    const searchWhere = search
      ? `AND LOWER(p.title) LIKE '%' || LOWER($4) || '%'`
      : "";

    const cursorWhere = cursor
      ? `AND p.created_at < $${search ? 5 : 4}::timestamptz`
      : "";

    const params = [userId, limit + 1];
    if (search) params.push(search);
    if (cursor) params.push(cursor);

    const sql = `
      SELECT ${PRODUCT_COLS}
      FROM public.products p
      LEFT JOIN public.categories cat ON cat.id = p.category_id
      WHERE p.seller_id = $1
        ${where}
        ${searchWhere}
        ${cursorWhere}
      ORDER BY p.created_at DESC
      LIMIT $2
    `;

    const { rows } = await pool.query(sql, params);

    const hasMore  = rows.length > limit;
    const sliced   = hasMore ? rows.slice(0, limit) : rows;
    const products = sliced.map(shapeProduct);

    const nextCursor = hasMore && sliced.length > 0
      ? sliced[sliced.length - 1].created_at
      : null;

    let total = null;
    if (!cursor) {
      const countParams = search ? [userId, search] : [userId];
      const searchCountWhere = search
        ? `AND LOWER(title) LIKE '%' || LOWER($2) || '%'`
        : "";

      const { rows: cRows } = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM public.products
         WHERE seller_id = $1
           ${count}
           ${searchCountWhere}`,
        countParams
      );
      total = cRows[0]?.total || 0;
    }

    console.log(`[dashboard/products] found=${products.length} hasMore=${hasMore}`);

    return res.json({
      success:     true,
      products,
      total,
      has_more:    hasMore,
      next_cursor: nextCursor,
    });

  } catch (err) {
    console.error("[dashboard/products] ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error", detail: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/products/deleted
   List soft-deleted products still within hold window
   MUST be declared BEFORE /products/:id so Express routes match it.
═══════════════════════════════════════════════════════════════ */
router.get("/products/deleted", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT
         p.id, p.title, p.price, p.slug,
         p.status, p.main_image, p.thumbnail_url, p.images,
         p.deletion_requested_at, p.permanent_delete_at,
         p.deletion_reason,
         cat.name AS category_name
       FROM public.products p
       LEFT JOIN public.categories cat ON cat.id = p.category_id
       WHERE p.seller_id           = $1
         AND p.status              = 'deleted'
         AND p.permanent_delete_at > NOW()
       ORDER BY p.deletion_requested_at DESC
       LIMIT 50`,
      [userId]
    );

    const products = rows.map((p) => {
      const { image } = resolveProductImage(p);
      const daysLeft  = p.permanent_delete_at
        ? Math.ceil((new Date(p.permanent_delete_at) - new Date()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        id:                    p.id,
        title:                 p.title,
        price:                 Number(p.price || 0),
        slug:                  p.slug,
        image,
        category_name:         p.category_name,
        deletion_requested_at: p.deletion_requested_at,
        permanent_delete_at:   p.permanent_delete_at,
        days_left:             Math.max(0, daysLeft),
        can_restore:           daysLeft > 0,
      };
    });

    return res.json({ success: true, products, total: products.length });

  } catch (err) {
    console.error("[dashboard/deleted] ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error", detail: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/products/:id
   Full product data for editing
═══════════════════════════════════════════════════════════════ */
router.get("/products/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    console.log(`[dashboard/product] id=${id} userId=${userId}`);

    const { rows } = await pool.query(
      `SELECT
         ${PRODUCT_COLS_FULL}
       FROM public.products p
       LEFT JOIN public.categories cat    ON cat.id    = p.category_id
       LEFT JOIN public.categories subcat ON subcat.id = p.subcategory_id
       WHERE p.id        = $1
         AND p.seller_id = $2
         AND p.is_deleted = false
         AND p.status    != 'deleted'
       LIMIT 1`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found or not owned by you",
      });
    }

    const { rows: imgRows } = await pool.query(
      `SELECT
         id, image_url, r2_key, position_order, is_primary
       FROM public.product_images
       WHERE product_id = $1
       ORDER BY position_order ASC`,
      [id]
    );

    const product = shapeProductFull({
      ...rows[0],
      product_images: imgRows,
    });

    console.log(`[dashboard/product] found: "${product.title}"`);

    return res.json({ success: true, product });

  } catch (err) {
    console.error("[dashboard/product] ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      detail:  err.message,
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/seller-dashboard/products/:id/toggle
═══════════════════════════════════════════════════════════════ */
router.patch("/products/:id/toggle", authenticate, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    console.log(`[dashboard/toggle] productId=${id} userId=${userId}`);

    const { rows } = await pool.query(
      `SELECT id, is_active, status
       FROM public.products
       WHERE id = $1 AND seller_id = $2 AND is_deleted = false
       LIMIT 1`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const current   = rows[0];
    const newActive = !current.is_active;
    const newStatus = newActive ? "active" : "paused";

    await pool.query(
      `UPDATE public.products
       SET is_active  = $1,
           status     = $2,
           updated_at = NOW()
       WHERE id = $3 AND seller_id = $4`,
      [newActive, newStatus, id, userId]
    );

    cacheDel(`stats:${userId}`);
    cacheDel(`overview:${userId}`);

    console.log(`[dashboard/toggle] id=${id} active=${newActive} status=${newStatus}`);

    return res.json({ success: true, is_active: newActive, status: newStatus });

  } catch (err) {
    console.error("[dashboard/toggle] ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error", detail: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/seller-dashboard/products/:id/renew
   ─────────────────────────────────────────────────────────────
   Free renewal — extends active_until based on tier policy.

   TIER RULES:
     • unverified → ❌ BLOCKED (trial users cannot renew)
     • verified   → ✅ 30 days, max 10 renewals, ≤ 7 days left only
     • subscriber → ✅ 90 days, unlimited, anytime

   Rationale: If unverified users could renew, they would bypass
   the 3-listing lifetime cap entirely (3 listings × ∞ renewals
   = free unlimited posting). Renewals are a verified-tier perk.
═══════════════════════════════════════════════════════════════ */
router.post("/products/:id/renew", authenticate, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    console.log(`[dashboard/renew] productId=${id} userId=${userId}`);

    /* ── Step 1: Determine user tier ── */
    const tierInfo = await getUserTier(userId);
    if (!tierInfo) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const { tier, isSubscriber } = tierInfo;
    const policy = RENEWAL_POLICY[tier] ?? RENEWAL_POLICY.unverified;

    /* ── Step 2: Block unverified users ── */
    if (!policy.canRenew) {
      console.log(`[dashboard/renew] BLOCKED — tier=${tier} cannot renew`);
      return res.status(403).json({
        success         : false,
        message         : "Trial listings cannot be renewed. Verify your identity to unlock renewals.",
        tier,
        upgrade_required: true,
        upgrade_to      : "verified",
        upgrade_url     : "/verification",
        reason          : "unverified_no_renewal",
      });
    }

    /* ── Step 3: Fetch product ── */
    const { rows } = await pool.query(
      `SELECT
         id, title, status, is_active, active_until,
         is_promoted, COALESCE(renewal_count, 0) AS renewal_count
       FROM public.products
       WHERE id = $1 AND seller_id = $2 AND is_deleted = false
       LIMIT 1`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    const product = rows[0];

    /* ── Step 4: Status guards ── */
    if (["deleted", "pending_payment"].includes(product.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot renew a listing with status "${product.status}"`,
      });
    }

    /* Trial listings should be activated, not renewed */
    if (product.status === "active_limited") {
      return res.status(400).json({
        success        : false,
        message        : "Trial listings must be activated instead of renewed. Tap 'Activate' to make it permanent.",
        should_activate: true,
      });
    }

    /* ── Step 5: Max renewals check ── */
    if (
      policy.maxRenewals !== null &&
      product.renewal_count >= policy.maxRenewals
    ) {
      const canUpgrade = tier === "verified";
      return res.status(400).json({
        success        : false,
        message        : `Maximum renewals reached (${policy.maxRenewals}). ${
          canUpgrade
            ? "Subscribe to Pro for unlimited renewals, or create a new listing."
            : "Please create a new listing."
        }`,
        renewal_count  : product.renewal_count,
        max_renewals   : policy.maxRenewals,
        ...(canUpgrade && {
          upgrade_to : "subscriber",
          upgrade_url: "/seller/subscription/plans",
        }),
      });
    }

    /* ── Step 6: Time window check (skip for subscribers) ── */
    const now      = new Date();
    const expiry   = product.active_until ? new Date(product.active_until) : null;
    const daysLeft = expiry
      ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
      : null;

    if (
      policy.renewWindowDays !== null &&
      daysLeft !== null &&
      daysLeft > policy.renewWindowDays
    ) {
      return res.status(400).json({
        success  : false,
        message  : `Your listing still has ${daysLeft} days left. Renewal available when ${policy.renewWindowDays} days or less remain.`,
        days_left: daysLeft,
        tier,
        ...(tier === "verified" && {
          upgrade_hint: "Subscribe to Pro to renew anytime — no waiting window.",
          upgrade_to  : "subscriber",
          upgrade_url : "/seller/subscription/plans",
        }),
      });
    }

    /* ── Step 7: Compute new expiry ── */
    const base      = expiry && expiry > now ? expiry : now;
    const newExpiry = new Date(base);
    newExpiry.setDate(newExpiry.getDate() + policy.renewDays);

    const newStatus   = product.is_promoted ? product.status : "active";
    const newIsActive = true;

    /* ── Step 8: Update ── */
    await pool.query(
      `UPDATE public.products
       SET active_until  = $1,
           status        = $2,
           is_active     = $3,
           renewal_count = COALESCE(renewal_count, 0) + 1,
           updated_at    = NOW()
       WHERE id = $4 AND seller_id = $5`,
      [newExpiry, newStatus, newIsActive, id, userId]
    );

    cacheDel(`stats:${userId}`);
    cacheDel(`overview:${userId}`);

    /* ── Step 9: Notification (tier-aware) ── */
    const newRenewalCount = product.renewal_count + 1;
    const renewalsLeft = policy.maxRenewals === null
      ? null
      : Math.max(0, policy.maxRenewals - newRenewalCount);

    try {
      const notifTitle = isSubscriber
        ? "Listing Renewed 🚀"
        : "Listing Renewed ✓";

      let notifMessage = `"${product.title}" renewed for ${policy.renewDays} more days.`;
      if (renewalsLeft !== null && renewalsLeft <= 2 && renewalsLeft > 0) {
        notifMessage += ` (${renewalsLeft} renewal${renewalsLeft === 1 ? "" : "s"} left)`;
      } else if (renewalsLeft === 0) {
        notifMessage += " (last renewal — subscribe for unlimited)";
      }

      await pool.query(
        `INSERT INTO public.notifications
           (user_id, type, title, message, metadata)
         VALUES ($1, 'listing_renewed', $2, $3, $4)`,
        [
          userId,
          notifTitle,
          notifMessage,
          JSON.stringify({
            product_id      : id,
            tier,
            renewal_count   : newRenewalCount,
            days_added      : policy.renewDays,
            new_active_until: newExpiry.toISOString(),
          }),
        ]
      );
    } catch { /* non-critical */ }

    console.log(
      `[dashboard/renew] ✓ id=${id}  tier=${tier}  ` +
      `days=${policy.renewDays}  renewals=${newRenewalCount}  ` +
      `until=${newExpiry.toISOString()}`
    );

    /* ── Step 10: Response ── */
    return res.json({
      success       : true,
      message       : `Listing renewed for ${policy.renewDays} days`,
      active_until  : newExpiry.toISOString(),
      days_added    : policy.renewDays,
      status        : newStatus,
      tier,
      is_subscriber : isSubscriber,
      renewal_count : newRenewalCount,
      max_renewals  : policy.maxRenewals,
      renewals_left : renewalsLeft,
      ...(tier === "verified" && renewalsLeft === 0 && {
        limit_reached_notice: "This was your last renewal for this listing. Subscribe to Pro for unlimited renewals.",
        upgrade_to          : "subscriber",
        upgrade_url         : "/seller/subscription/plans",
      }),
    });

  } catch (err) {
    console.error("[dashboard/renew] ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      detail : err.message,
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/products/:id/renew-info
   ─────────────────────────────────────────────────────────────
   Returns tier-aware renewal eligibility WITHOUT actually
   renewing. Frontend uses this to show/hide the renew button
   and display "Renews in X days" or "Renew Now" text.
═══════════════════════════════════════════════════════════════ */
router.get("/products/:id/renew-info", authenticate, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const tierInfo = await getUserTier(userId);
    if (!tierInfo) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { tier, isSubscriber } = tierInfo;
    const policy = RENEWAL_POLICY[tier] ?? RENEWAL_POLICY.unverified;

    const { rows } = await pool.query(
      `SELECT id, title, status, active_until,
              COALESCE(renewal_count, 0) AS renewal_count
       FROM public.products
       WHERE id = $1 AND seller_id = $2 AND is_deleted = false
       LIMIT 1`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    const product = rows[0];
    const now      = new Date();
    const expiry   = product.active_until ? new Date(product.active_until) : null;
    const daysLeft = expiry
      ? Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)))
      : null;

    const canRenew = policy.canRenew &&
      !["deleted", "pending_payment", "active_limited"].includes(product.status) &&
      (policy.maxRenewals === null || product.renewal_count < policy.maxRenewals) &&
      (policy.renewWindowDays === null || daysLeft === null || daysLeft <= policy.renewWindowDays);

    const renewalsLeft = policy.maxRenewals === null
      ? null
      : Math.max(0, policy.maxRenewals - product.renewal_count);

    let blockReason = null;
    if (!policy.canRenew) {
      blockReason = "unverified_no_renewal";
    } else if (product.status === "active_limited") {
      blockReason = "trial_should_activate";
    } else if (product.status === "deleted" || product.status === "pending_payment") {
      blockReason = "invalid_status";
    } else if (policy.maxRenewals !== null && product.renewal_count >= policy.maxRenewals) {
      blockReason = "max_renewals_reached";
    } else if (policy.renewWindowDays !== null && daysLeft > policy.renewWindowDays) {
      blockReason = "too_early";
    }

    return res.json({
      success            : true,
      can_renew          : canRenew,
      block_reason       : blockReason,
      tier,
      is_subscriber      : isSubscriber,
      days_left          : daysLeft,
      renewal_count      : product.renewal_count,
      max_renewals       : policy.maxRenewals,
      renewals_left      : renewalsLeft,
      renew_days         : policy.renewDays,
      renew_window_days  : policy.renewWindowDays,
      ...(tier === "unverified" && {
        upgrade_to  : "verified",
        upgrade_url : "/verification",
      }),
      ...(tier === "verified" && (renewalsLeft === 0 || (daysLeft !== null && daysLeft > policy.renewWindowDays)) && {
        upgrade_to  : "subscriber",
        upgrade_url : "/seller/subscription/plans",
      }),
    });

  } catch (err) {
    console.error("[dashboard/renew-info] ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      detail : err.message,
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/seller-dashboard/products/:id
   Soft delete — stays in DB 30 days for scam investigation
═══════════════════════════════════════════════════════════════ */
router.delete("/products/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    console.log(`[dashboard/delete] productId=${id} userId=${userId}`);

    const { rows: check } = await pool.query(
      `SELECT id, title, status, is_deleted
       FROM public.products
       WHERE id = $1 AND seller_id = $2
       LIMIT 1`,
      [id, userId]
    );

    if (!check.length) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (check[0].is_deleted) {
      return res.status(400).json({ success: false, message: "Already deleted" });
    }

    if (check[0].status === "active") {
      return res.status(409).json({
        success: false,
        message: "Active listings must be paused before deleting.",
      });
    }

    /* Check for active reports — extend hold period */
    let holdDays = DELETE_HOLD_DAYS;
    try {
      const { rows: reportRows } = await pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM public.product_reports
         WHERE product_id = $1 AND status = 'pending'`,
        [id]
      );
      if (reportRows[0]?.cnt > 0) holdDays = DELETE_HOLD_DAYS_FLAGGED;
    } catch { /* reports table might not exist yet */ }

    await pool.query(
      `UPDATE public.products
       SET
         is_active             = false,
         status                = 'deleted',
         deletion_requested_at = NOW(),
         deletion_reason       = 'user_deleted',
         permanent_delete_at   = NOW() + ($1 || ' days')::INTERVAL,
         deleted_at            = NOW(),
         updated_at            = NOW()
       WHERE id = $2 AND seller_id = $3 AND is_deleted = false`,
      [holdDays, id, userId]
    );

    cacheDel(`stats:${userId}`);
    cacheDel(`overview:${userId}`);

    console.log(`[dashboard/delete] id=${id} soft-deleted — hold ${holdDays} days`);

    return res.json({
      success:   true,
      message:   "Listing deleted",
      hold_days: holdDays,
    });

  } catch (err) {
    console.error("[dashboard/delete] ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error", detail: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/seller-dashboard/products/:id/restore
═══════════════════════════════════════════════════════════════ */
router.post("/products/:id/restore", authenticate, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    console.log(`[dashboard/restore] productId=${id} userId=${userId}`);

    const { rows } = await pool.query(
      `SELECT id, title, status, permanent_delete_at
       FROM public.products
       WHERE id = $1 AND seller_id = $2
       LIMIT 1`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const product = rows[0];

    if (product.status !== "deleted") {
      return res.status(400).json({ success: false, message: "Product is not deleted" });
    }

    if (product.permanent_delete_at && new Date(product.permanent_delete_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Recovery window expired. Product cannot be restored.",
      });
    }

    await pool.query(
      `UPDATE public.products
       SET
         is_active             = false,
         status                = 'draft',
         is_deleted            = false,
         deletion_requested_at = NULL,
         deletion_reason       = NULL,
         permanent_delete_at   = NULL,
         deleted_at            = NULL,
         updated_at            = NOW()
       WHERE id = $1 AND seller_id = $2`,
      [id, userId]
    );

    cacheDel(`stats:${userId}`);
    cacheDel(`overview:${userId}`);

    console.log(`[dashboard/restore] id=${id} restored to draft`);

    return res.json({ success: true, message: "Product restored to drafts", status: "draft" });

  } catch (err) {
    console.error("[dashboard/restore] ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error", detail: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/analytics
═══════════════════════════════════════════════════════════════ */
router.get("/analytics", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const days   = Math.min(Number(req.query.days) || 7, 30);

    console.log(`[dashboard/analytics] userId=${userId} days=${days}`);

    let daily = [];
    try {
      const { rows: dRows } = await pool.query(
        `SELECT
           DATE(created_at AT TIME ZONE 'Africa/Lagos') AS date,
           SUM(views)::int           AS views,
           SUM(clicks_count)::int    AS clicks,
           SUM(favorites_count)::int AS favorites,
           COUNT(*)::int             AS product_count
         FROM public.products
         WHERE seller_id  = $1
           AND created_at > NOW() - ($2 || ' days')::INTERVAL
           AND is_deleted  = false
           AND status     != 'deleted'
         GROUP BY DATE(created_at AT TIME ZONE 'Africa/Lagos')
         ORDER BY date ASC`,
        [userId, days]
      );
      daily = dRows.map((r) => ({
        date:      r.date,
        label:     new Date(r.date).toLocaleDateString("en-NG", {
          weekday: "short", day: "numeric", month: "short",
        }),
        views:     Number(r.views     || 0),
        clicks:    Number(r.clicks    || 0),
        favorites: Number(r.favorites || 0),
      }));
    } catch (chartErr) {
      console.error("[dashboard/analytics] chart error:", chartErr.message);
    }

    let topProducts = [];
    try {
      const { rows: tRows } = await pool.query(
        `SELECT
           p.id, p.title, p.slug, p.price,
           p.main_image, p.thumbnail_url, p.images,
           p.views, p.clicks_count, p.favorites_count,
           p.status, p.is_active, p.is_promoted, p.active_until,
           cat.name AS category_name
         FROM public.products p
         LEFT JOIN public.categories cat ON cat.id = p.category_id
         WHERE p.seller_id  = $1
           AND p.is_deleted  = false
           AND p.status     != 'deleted'
         ORDER BY p.views DESC
         LIMIT 5`,
        [userId]
      );
      topProducts = tRows.map((p) => {
        const { image } = resolveProductImage(p);
        return {
          id:              p.id,
          title:           p.title,
          slug:            p.slug,
          price:           Number(p.price           || 0),
          image,
          views:           Number(p.views           || 0),
          clicks_count:    Number(p.clicks_count    || 0),
          favorites_count: Number(p.favorites_count || 0),
          status:          p.status,
          is_active:       p.is_active,
          is_promoted:     !!p.is_promoted,
          active_until:    p.active_until || null,
          category_name:   p.category_name || null,
          ctr: Number(p.views || 0) > 0
            ? Number(((Number(p.clicks_count || 0) / Number(p.views)) * 100).toFixed(1))
            : 0,
        };
      });
    } catch (topErr) {
      console.error("[dashboard/analytics] top products error:", topErr.message);
    }

    const sellerScore = await getSellerScore(userId);

    console.log(`[dashboard/analytics] daily=${daily.length} top=${topProducts.length} score=${sellerScore}`);

    return res.json({
      success:      true,
      period:       `${days} days`,
      seller_score: sellerScore,
      daily,
      top_products: topProducts,
    });

  } catch (err) {
    console.error("[dashboard/analytics] ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error", detail: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/overview
═══════════════════════════════════════════════════════════════ */
router.get("/overview", authenticate, async (req, res) => {
  try {
    const userId   = req.user.id;
    const cacheKey = `overview:${userId}`;

    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ success: true, cached: true, data: cached });

    console.log(`[dashboard/overview] userId=${userId}`);

    const [statsRes, recentRes, tierInfo] = await Promise.all([
      pool.query(
        `SELECT
           u.name, u.store_name, u.store_logo, u.profile_image,
           u.rating, u.total_sales, u.trust_score,
           u.products_count, u.store_verified, u.verified,
           u.is_online, u.created_at,
           u.identity_verified, u.subscription_plan,
           u.subscription_status, u.subscription_expires_at,
           COALESCE(SUM(p.views),            0)::int AS total_views,
           COALESCE(SUM(p.clicks_count),     0)::int AS total_clicks,
           COALESCE(SUM(p.favorites_count),  0)::int AS total_favorites,
           COUNT(p.id)::int                          AS total_products,

           COUNT(CASE WHEN p.status = 'active'          AND p.is_active = true THEN 1 END)::int AS active,
           COUNT(CASE WHEN p.status = 'active_limited'  AND p.is_active = true THEN 1 END)::int AS active_limited,
           COUNT(CASE WHEN p.status = 'draft'                                  THEN 1 END)::int AS draft,
           COUNT(CASE WHEN p.status = 'paused'                                 THEN 1 END)::int AS paused,
           COUNT(CASE WHEN p.status = 'pending_payment'                        THEN 1 END)::int AS pending_payment,
           COUNT(CASE WHEN p.is_promoted = true                                THEN 1 END)::int AS promoted

         FROM public.users u
         LEFT JOIN public.products p
           ON  p.seller_id  = u.id
           AND p.is_deleted  = false
           AND p.status     != 'deleted'
         WHERE u.id = $1
         GROUP BY
           u.id, u.name, u.store_name, u.store_logo, u.profile_image,
           u.rating, u.total_sales, u.trust_score, u.products_count,
           u.store_verified, u.verified, u.is_online, u.created_at,
           u.identity_verified, u.subscription_plan,
           u.subscription_status, u.subscription_expires_at`,
        [userId]
      ),
      pool.query(
        `SELECT ${PRODUCT_COLS}
         FROM public.products p
         LEFT JOIN public.categories cat ON cat.id = p.category_id
         WHERE p.seller_id  = $1
           AND p.is_deleted  = false
           AND p.status     != 'deleted'
         ORDER BY p.created_at DESC
         LIMIT 6`,
        [userId]
      ),
      getUserTier(userId),
    ]);

    if (!statsRes.rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const s           = statsRes.rows[0];
    const sellerScore = await getSellerScore(userId);
    const activeTotal = Number(s.active || 0) + Number(s.active_limited || 0);

    const data = {
      seller_score: sellerScore,
      tier        : tierInfo?.tier ?? "unverified",
      is_subscriber: tierInfo?.isSubscriber ?? false,
      seller: {
        name:           s.name,
        store_name:     s.store_name     || null,
        store_logo:     s.store_logo     || null,
        profile_image:  s.profile_image  || null,
        verified:       !!s.verified,
        store_verified: !!s.store_verified,
        is_online:      !!s.is_online,
        trust_score:    Number(s.trust_score || 50),
        rating:         Number(s.rating      || 0),
        member_since:   s.created_at,
      },
      stats: {
        total_products:  Number(s.total_products   || 0),
        active:          activeTotal,
        active_full:     Number(s.active           || 0),
        active_limited:  Number(s.active_limited   || 0),
        draft:           Number(s.draft            || 0),
        paused:          Number(s.paused           || 0),
        pending_payment: Number(s.pending_payment  || 0),
        promoted:        Number(s.promoted         || 0),
        total_views:     Number(s.total_views      || 0),
        total_clicks:    Number(s.total_clicks     || 0),
        total_favorites: Number(s.total_favorites  || 0),
        total_revenue:   Number(s.total_sales      || 0),
        rating:          Number(s.rating           || 0),
        trust_score:     Number(s.trust_score      || 50),
      },
      recent_products: recentRes.rows.map(shapeProduct),
    };

    console.log(`[dashboard/overview] seller=${s.name} products=${data.stats.total_products} score=${sellerScore} tier=${data.tier}`);

    cacheSet(cacheKey, data);
    return res.json({ success: true, cached: false, data });

  } catch (err) {
    console.error("[dashboard/overview] ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error", detail: err.message });
  }
});

export default router;