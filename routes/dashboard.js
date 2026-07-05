// routes/dashboard.js
import express      from "express";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   IN-MEMORY CACHE  (TTL = 5 min)
═══════════════════════════════════════════════════════════════ */
const _cache    = new Map();
const CACHE_TTL = 5 * 60 * 1_000;

const cacheGet = (key) => {
  const item = _cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) { _cache.delete(key); return null; }
  return item.value;
};

const cacheSet = (key, value) =>
  _cache.set(key, { value, expires: Date.now() + CACHE_TTL });

const cacheDel = (key) => _cache.delete(key);

/* Auto-evict expired entries every 10 min */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _cache.entries()) {
    if (now > v.expires) _cache.delete(k);
  }
}, 10 * 60 * 1_000);

/* ═══════════════════════════════════════════════════════════════
   STATUS HELPERS
   Products can have:  active | active_limited | active_promoted
                       pending | pending_payment | pending_review
                       draft | paused | deleted
═══════════════════════════════════════════════════════════════ */
const ACTIVE_STATUSES  = `(p.status = 'active' OR p.status LIKE 'active_%')`;
const PENDING_STATUSES = `(p.status = 'pending' OR p.status LIKE 'pending_%')`;
const NOT_DELETED      = `COALESCE(p.is_deleted, false) = false AND p.status != 'deleted'`;

/* Same expressions without table alias — for COUNT subqueries */
const ACTIVE_STATUSES_RAW  = `(status = 'active' OR status LIKE 'active_%')`;
const PENDING_STATUSES_RAW = `(status = 'pending' OR status LIKE 'pending_%')`;
const NOT_DELETED_RAW      = `COALESCE(is_deleted, false) = false AND status != 'deleted'`;

/* ═══════════════════════════════════════════════════════════════
   IMAGE RESOLVER
   Products store images in multiple ways
═══════════════════════════════════════════════════════════════ */
function resolveProductImage(p) {
  let image = p.main_image || p.thumbnail_url || null;

  if (!image && Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    if (typeof first === "string") image = first;
    else if (first?.url) image = first.url;
  }

  let imagesArr = [];
  if (Array.isArray(p.images) && p.images.length > 0) {
    imagesArr = p.images
      .map((img) => (typeof img === "string" ? img : img?.url || null))
      .filter(Boolean);
  } else if (image) {
    imagesArr = [image];
  }

  return { image, imagesArr };
}

/* ═══════════════════════════════════════════════════════════════
   SHAPE PRODUCT ROW
   Consistent shape returned from every route
═══════════════════════════════════════════════════════════════ */
function shapeProduct(p) {
  const { image, imagesArr } = resolveProductImage(p);
  return {
    ...p,
    image,
    images:           imagesArr,
    price:            Number(p.price            || 0),
    views:            Number(p.views            || 0),
    clicks_count:     Number(p.clicks_count     || 0),
    favorites_count:  Number(p.favorites_count  || 0),
    engagement_score: Number(p.engagement_score || 0),
    quality_score:    Number(p.quality_score    || 0),
    is_active:        p.is_active !== false,
    is_promoted:      !!p.is_promoted,
  };
}

/* ═══════════════════════════════════════════════════════════════
   SELLER SCORE CALCULATOR
═══════════════════════════════════════════════════════════════ */
async function getSellerScore(userId) {
  try {
    /* Response-time score */
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

    /* Aggregate stats */
    const { rows: aRows } = await pool.query(
      `SELECT
         u.rating,
         u.total_sales,
         u.trust_score,
         u.products_count,
         u.store_verified,
         u.verified,
         COALESCE(SUM(p.views),            0)::int AS total_views,
         COALESCE(SUM(p.clicks_count),     0)::int AS total_clicks,
         COALESCE(SUM(p.favorites_count),  0)::int AS total_favorites,
         COALESCE(SUM(p.share_count),      0)::int AS total_shares,
         COALESCE(SUM(p.engagement_score), 0)::int AS total_engagement,
         COUNT(p.id)::int                          AS active_count,
         COUNT(CASE WHEN p.is_promoted THEN 1 END)::int AS promoted_count
       FROM public.users u
       LEFT JOIN public.products p
         ON  p.seller_id = u.id
         AND ${ACTIVE_STATUSES}
         AND p.is_active = true
         AND ${NOT_DELETED}
       WHERE u.id = $1
       GROUP BY
         u.id, u.rating, u.total_sales, u.trust_score,
         u.products_count, u.store_verified, u.verified`,
      [userId]
    );

    if (!aRows.length) return 0;

    const a          = aRows[0];
    const views      = Number(a.total_views      || 0);
    const clicks     = Number(a.total_clicks     || 0);
    const engagement = Number(a.total_engagement || 0);
    const products   = Number(a.active_count     || 1);
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

  } catch {
    return 0;
  }
}

/* ═══════════════════════════════════════════════════════════════
   WHERE EXTRA BUILDER
   Builds the extra WHERE fragment + count fragment for a given tab
═══════════════════════════════════════════════════════════════ */
function buildTabWhere(tab) {
  switch (tab) {
    case "active":
      return {
        where: `
          AND ${ACTIVE_STATUSES}
          AND p.is_active = true
          AND ${NOT_DELETED}
        `,
        count: `
          AND ${ACTIVE_STATUSES_RAW}
          AND is_active = true
          AND ${NOT_DELETED_RAW}
        `,
      };

    case "draft":
      return {
        where: `AND p.status = 'draft' AND ${NOT_DELETED}`,
        count: `AND status  = 'draft' AND ${NOT_DELETED_RAW}`,
      };

    case "paused":
      return {
        where: `
          AND p.is_active = false
          AND p.status NOT IN ('draft', 'deleted')
          AND ${NOT_DELETED}
        `,
        count: `
          AND is_active = false
          AND status NOT IN ('draft', 'deleted')
          AND ${NOT_DELETED_RAW}
        `,
      };

    case "pending":
      return {
        where: `AND ${PENDING_STATUSES} AND ${NOT_DELETED}`,
        count: `AND ${PENDING_STATUSES_RAW} AND ${NOT_DELETED_RAW}`,
      };

    default: /* all */
      return {
        where: `AND ${NOT_DELETED}`,
        count: `AND ${NOT_DELETED_RAW}`,
      };
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

    const { rows } = await pool.query(
      `SELECT
         u.rating,
         u.total_sales,
         u.trust_score,
         COALESCE(SUM(p.views),           0)::int AS total_views,
         COALESCE(SUM(p.clicks_count),    0)::int AS total_clicks,
         COALESCE(SUM(p.favorites_count), 0)::int AS total_favorites,
         COUNT(p.id)::int AS total_products,

         COUNT(CASE
           WHEN (p.status = 'active' OR p.status LIKE 'active_%')
            AND p.is_active = true
           THEN 1 END)::int AS active,

         COUNT(CASE
           WHEN p.status = 'draft'
           THEN 1 END)::int AS draft,

         COUNT(CASE
           WHEN p.is_active = false
            AND p.status NOT IN ('draft','deleted')
           THEN 1 END)::int AS paused,

         COUNT(CASE
           WHEN (p.status = 'pending' OR p.status LIKE 'pending_%')
           THEN 1 END)::int AS pending,

         COUNT(CASE
           WHEN p.is_promoted = true
           THEN 1 END)::int AS promoted

       FROM public.users u
       LEFT JOIN public.products p
         ON  p.seller_id = u.id
         AND p.status   != 'deleted'
         AND COALESCE(p.is_deleted, false) = false
       WHERE u.id = $1
       GROUP BY u.id, u.rating, u.total_sales, u.trust_score`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const r = rows[0];

    const stats = {
      total_products:  Number(r.total_products  || 0),
      active:          Number(r.active          || 0),
      draft:           Number(r.draft           || 0),
      paused:          Number(r.paused          || 0),
      pending:         Number(r.pending         || 0),
      promoted:        Number(r.promoted        || 0),
      total_views:     Number(r.total_views     || 0),
      total_clicks:    Number(r.total_clicks    || 0),
      total_favorites: Number(r.total_favorites || 0),
      total_revenue:   Number(r.total_sales     || 0),
      rating:          Number(r.rating          || 0),
      trust_score:     Number(r.trust_score     || 50),
    };

    cacheSet(cacheKey, stats);
    return res.json({ success: true, cached: false, stats });

  } catch (err) {
    console.error("[dashboard] GET /stats:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/products
═══════════════════════════════════════════════════════════════ */
router.get("/products", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit  = Math.min(Number(req.query.limit) || 50, 100);
    const page   = Math.max(Number(req.query.page)  || 1,  1);
    const offset = (page - 1) * limit;
    const tab    = req.query.tab || "all";

    console.log(`[dashboard/products] userId=${userId} tab=${tab} page=${page}`);

    const { where, count } = buildTabWhere(tab);

    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.title,
         p.price,
         p.slug,
         p.status,
         p.is_active,
         p.is_promoted,
         p.promotion_type,
         p.views,
         p.clicks_count,
         p.favorites_count,
         p.engagement_score,
         p.quality_score,
         p.created_at,
         p.updated_at,
         p.main_image,
         p.thumbnail_url,
         p.images,
         p.location_city,
         p.location_state,
         cat.name AS category_name
       FROM public.products p
       LEFT JOIN public.categories cat ON cat.id = p.category_id
       WHERE p.seller_id = $1
         ${where}
       ORDER BY p.created_at DESC
       LIMIT  $2
       OFFSET $3`,
      [userId, limit, offset]
    );

    const { rows: cRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.products
       WHERE seller_id = $1
         ${count}`,
      [userId]
    );

    const total    = cRows[0]?.total || 0;
    const products = rows.map(shapeProduct);

    console.log(`[dashboard/products] found=${products.length} total=${total}`);

    return res.json({
      success: true,
      products,
      total,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        has_more:    offset + rows.length < total,
      },
    });

  } catch (err) {
    console.error("[dashboard] GET /products:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/seller-dashboard/products/:id/toggle
   Toggle active ↔ paused
═══════════════════════════════════════════════════════════════ */
router.patch("/products/:id/toggle", authenticate, async (req, res) => {
  const { id }  = req.params;
  const userId  = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT id, is_active, status
       FROM public.products
       WHERE id = $1 AND seller_id = $2
       LIMIT 1`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const newActive = !rows[0].is_active;
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

    return res.json({ success: true, is_active: newActive, status: newStatus });

  } catch (err) {
    console.error("[dashboard] PATCH /products/:id/toggle:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/seller-dashboard/products/:id
   Soft delete
═══════════════════════════════════════════════════════════════ */
router.delete("/products/:id", authenticate, async (req, res) => {
  const { id }  = req.params;
  const userId  = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT id FROM public.products
       WHERE id = $1 AND seller_id = $2
       LIMIT 1`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    await pool.query(
      `UPDATE public.products
       SET is_active  = false,
           is_deleted = true,
           status     = 'deleted',
           updated_at = NOW()
       WHERE id = $1 AND seller_id = $2`,
      [id, userId]
    );

    cacheDel(`stats:${userId}`);
    cacheDel(`overview:${userId}`);

    return res.json({ success: true, message: "Product deleted" });

  } catch (err) {
    console.error("[dashboard] DELETE /products/:id:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/analytics
═══════════════════════════════════════════════════════════════ */
router.get("/analytics", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const days   = Math.min(Number(req.query.days) || 7, 30);

    /* Daily chart */
    let daily = [];
    try {
      const { rows } = await pool.query(
        `SELECT
           DATE(last_interaction_at AT TIME ZONE 'Africa/Lagos') AS date,
           SUM(views)::int            AS views,
           SUM(clicks_count)::int     AS clicks,
           SUM(favorites_count)::int  AS favorites,
           COUNT(*)::int              AS products_active
         FROM public.products
         WHERE seller_id            = $1
           AND last_interaction_at IS NOT NULL
           AND last_interaction_at  > NOW() - ($2 || ' days')::INTERVAL
           AND is_active            = true
           AND COALESCE(is_deleted, false) = false
         GROUP BY DATE(last_interaction_at AT TIME ZONE 'Africa/Lagos')
         ORDER BY date ASC`,
        [userId, days]
      );

      daily = rows.map((r) => ({
        date:      r.date,
        label:     new Date(r.date).toLocaleDateString("en-NG", {
          weekday: "short", day: "numeric", month: "short",
        }),
        views:     Number(r.views     || 0),
        clicks:    Number(r.clicks    || 0),
        favorites: Number(r.favorites || 0),
      }));
    } catch {}

    /* Top 5 products by views */
    const { rows: topRows } = await pool.query(
      `SELECT
         id, title, slug, price,
         main_image, thumbnail_url, images,
         views, clicks_count, favorites_count,
         engagement_score, status, is_active, is_promoted
       FROM public.products
       WHERE seller_id = $1
         AND ${ACTIVE_STATUSES_RAW}
         AND is_active = true
         AND COALESCE(is_deleted, false) = false
       ORDER BY views DESC
       LIMIT 5`,
      [userId]
    );

    const topProducts = topRows.map((p) => {
      const { image } = resolveProductImage(p);
      return {
        ...p,
        image,
        price: Number(p.price || 0),
        views: Number(p.views || 0),
        ctr:   Number(p.views || 0) > 0
          ? Number(((p.clicks_count / p.views) * 100).toFixed(1))
          : 0,
      };
    });

    const sellerScore = await getSellerScore(userId);

    return res.json({
      success:      true,
      period:       `${days} days`,
      seller_score: sellerScore,
      daily,
      top_products: topProducts,
    });

  } catch (err) {
    console.error("[dashboard] GET /analytics:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
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

    const [statsRes, recentRes] = await Promise.all([

      pool.query(
        `SELECT
           u.name, u.store_name, u.store_logo, u.profile_image,
           u.rating, u.total_sales, u.trust_score,
           u.products_count, u.store_verified, u.verified,
           u.is_online, u.email_verified, u.created_at,
           COALESCE(SUM(p.views),            0)::int AS total_views,
           COALESCE(SUM(p.clicks_count),     0)::int AS total_clicks,
           COALESCE(SUM(p.favorites_count),  0)::int AS total_favorites,
           COALESCE(SUM(p.engagement_score), 0)::int AS total_engagement,
           COUNT(p.id)::int AS total_products,

           COUNT(CASE
             WHEN (p.status = 'active' OR p.status LIKE 'active_%')
              AND p.is_active = true
             THEN 1 END)::int AS active,

           COUNT(CASE
             WHEN p.status = 'draft'
             THEN 1 END)::int AS draft,

           COUNT(CASE
             WHEN p.is_active = false
              AND p.status NOT IN ('draft','deleted')
             THEN 1 END)::int AS paused,

           COUNT(CASE
             WHEN (p.status = 'pending' OR p.status LIKE 'pending_%')
             THEN 1 END)::int AS pending,

           COUNT(CASE
             WHEN p.is_promoted = true
             THEN 1 END)::int AS promoted

         FROM public.users u
         LEFT JOIN public.products p
           ON  p.seller_id = u.id
           AND p.status   != 'deleted'
           AND COALESCE(p.is_deleted, false) = false
         WHERE u.id = $1
         GROUP BY
           u.id, u.name, u.store_name, u.store_logo, u.profile_image,
           u.rating, u.total_sales, u.trust_score, u.products_count,
           u.store_verified, u.verified, u.is_online,
           u.email_verified, u.created_at`,
        [userId]
      ),

      pool.query(
        `SELECT
           id, title, price, slug, status, is_active,
           is_promoted, views, clicks_count, favorites_count,
           created_at, main_image, thumbnail_url, images,
           location_city, location_state
         FROM public.products
         WHERE seller_id = $1
           AND status != 'deleted'
           AND COALESCE(is_deleted, false) = false
         ORDER BY created_at DESC
         LIMIT 6`,
        [userId]
      ),
    ]);

    if (!statsRes.rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const s           = statsRes.rows[0];
    const sellerScore = await getSellerScore(userId);

    const data = {
      seller_score: sellerScore,
      seller: {
        name:           s.name,
        store_name:     s.store_name,
        store_logo:     s.store_logo,
        profile_image:  s.profile_image,
        verified:       !!s.verified,
        store_verified: !!s.store_verified,
        email_verified: !!s.email_verified,
        is_online:      !!s.is_online,
        trust_score:    Number(s.trust_score || 50),
        rating:         Number(s.rating      || 0),
        member_since:   s.created_at,
      },
      stats: {
        total_products:  Number(s.total_products  || 0),
        active:          Number(s.active          || 0),
        draft:           Number(s.draft           || 0),
        paused:          Number(s.paused          || 0),
        pending:         Number(s.pending         || 0),
        promoted:        Number(s.promoted        || 0),
        total_views:     Number(s.total_views     || 0),
        total_clicks:    Number(s.total_clicks    || 0),
        total_favorites: Number(s.total_favorites || 0),
        total_revenue:   Number(s.total_sales     || 0),
        rating:          Number(s.rating          || 0),
        trust_score:     Number(s.trust_score     || 50),
      },
      recent_products: recentRes.rows.map(shapeProduct),
    };

    cacheSet(cacheKey, data);
    return res.json({ success: true, cached: false, data });

  } catch (err) {
    console.error("[dashboard] GET /overview:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;