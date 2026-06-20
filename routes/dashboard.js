// routes/dashboard.js
import express from "express";
import { pool } from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes
const cache        = new Map();        // simple in-memory cache

/* ═══════════════════════════════════════════════════════════════
   CACHE HELPERS
═══════════════════════════════════════════════════════════════ */
const cacheGet = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) { cache.delete(key); return null; }
  return item.value;
};

const cacheSet = (key, value, ttl = CACHE_TTL_MS) => {
  cache.set(key, { value, expires: Date.now() + ttl });
};

// Auto-evict stale cache every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of cache.entries()) {
    if (now > item.expires) cache.delete(key);
  }
}, 10 * 60 * 1_000);

/* ═══════════════════════════════════════════════════════════════
   CALCULATE SELLER SCORE
   Uses real DB metrics to produce a 0-100 performance score
═══════════════════════════════════════════════════════════════ */
async function calculateSellerScore(userId) {
  try {
    /* ── 1. Response time from product interactions ── */
    const { rows: respRows } = await pool.query(
      `SELECT
         COALESCE(
           AVG(
             EXTRACT(EPOCH FROM (last_interaction_at - created_at)) / 3600
           ), 24
         ) AS avg_response_hours
       FROM public.products
       WHERE seller_id         = $1
         AND last_interaction_at IS NOT NULL
         AND is_active         = true`,
      [userId]
    );

    const responseHours = parseFloat(respRows[0]?.avg_response_hours) || 24;

    let responseScore = 20;
    if (responseHours <= 1)  responseScore = 100;
    else if (responseHours <= 6)  responseScore = 80;
    else if (responseHours <= 24) responseScore = 60;
    else if (responseHours <= 48) responseScore = 40;

    /* ── 2. Product stats + user info ── */
    const { rows: statsRows } = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.store_name,
         u.store_logo,
         u.profile_image,
         u.store_description,
         u.store_verified,
         u.verified,
         u.rating,
         u.products_count,
         u.total_sales,
         u.trust_score,
         u.is_online,
         u.email_verified,
         u.created_at,
         COALESCE(SUM(p.views),           0) AS total_views,
         COALESCE(SUM(p.clicks_count),    0) AS total_clicks,
         COALESCE(SUM(p.favorites_count), 0) AS total_favorites,
         COALESCE(SUM(p.share_count),     0) AS total_shares,
         COALESCE(SUM(p.engagement_score),0) AS total_engagement,
         COUNT(p.id)                         AS active_product_count,
         COUNT(CASE WHEN p.is_promoted THEN 1 END) AS promoted_count
       FROM public.users u
       LEFT JOIN public.products p
         ON p.seller_id = u.id
         AND p.is_active = true
         AND p.status   = 'active'
       WHERE u.id = $1
       GROUP BY
         u.id, u.name, u.store_name, u.store_logo, u.profile_image,
         u.store_description, u.store_verified, u.verified, u.rating,
         u.products_count, u.total_sales, u.trust_score, u.is_online,
         u.email_verified, u.created_at`,
      [userId]
    );

    if (!statsRows.length) {
      return { error: "No seller data found", sellerScore: 0 };
    }

    const s          = statsRows[0];
    const views      = Number(s.total_views      || 0);
    const clicks     = Number(s.total_clicks     || 0);
    const favorites  = Number(s.total_favorites  || 0);
    const shares     = Number(s.total_shares     || 0);
    const engagement = Number(s.total_engagement || 0);
    const products   = Number(s.active_product_count || 0);
    const rating     = Number(s.rating           || 0);

    const ctr            = views > 0 ? (clicks / views) * 100 : 0;
    const ctrScore       = Math.min(100, ctr * 5);
    const engagementScore= Math.min(100, products > 0 ? engagement / products : 0);
    const ratingScore    = (rating / 5) * 100;

    const sellerScore = Math.round(
      ctrScore       * 0.40 +
      engagementScore* 0.25 +
      ratingScore    * 0.20 +
      responseScore  * 0.15
    );

    /* ── 3. All products breakdown (all statuses) ── */
    const { rows: allProds } = await pool.query(
      `SELECT
         COUNT(*)                                                 AS total,
         COUNT(CASE WHEN status = 'active'  AND is_active THEN 1 END) AS active,
         COUNT(CASE WHEN status = 'draft'               THEN 1 END) AS draft,
         COUNT(CASE WHEN NOT is_active AND status != 'draft' THEN 1 END) AS paused,
         COUNT(CASE WHEN is_promoted                    THEN 1 END) AS promoted
       FROM public.products
       WHERE seller_id = $1`,
      [userId]
    );

    const prodBreakdown = allProds[0] || {};

    /* ── 4. Daily sales (last 7 days) ── */
    let dailySales = [];
    try {
      const { rows: salesRows } = await pool.query(
        `SELECT
           DATE(created_at AT TIME ZONE 'Africa/Lagos') AS date,
           COUNT(*)                                     AS orders,
           COALESCE(SUM(grand_total), 0)                AS amount
         FROM market.order_groups
         WHERE seller_id  = $1
           AND created_at > NOW() - INTERVAL '7 days'
           AND payment_status = 'paid'
         GROUP BY DATE(created_at AT TIME ZONE 'Africa/Lagos')
         ORDER BY date ASC`,
        [userId]
      );
      dailySales = salesRows.map((r) => ({
        date   : r.date,
        orders : Number(r.orders),
        amount : Number(r.amount),
        label  : new Date(r.date).toLocaleDateString("en-NG", { weekday: "short" }),
      }));
    } catch {
      // order_groups may not exist yet — return empty
      dailySales = [];
    }

    /* ── 5. Recent products (top 6 by views) ── */
    const { rows: recentProds } = await pool.query(
      `SELECT
         id,
         title,
         price,
         slug,
         status,
         is_active,
         is_promoted,
         views,
         clicks_count,
         favorites_count,
         engagement_score,
         created_at,
         main_image,
         thumbnail_url,
         location_city,
         location_state
       FROM public.products
       WHERE seller_id = $1
         AND is_active = true
       ORDER BY views DESC, created_at DESC
       LIMIT 6`,
      [userId]
    );

    /* ── 6. Top performing product ── */
    const topProduct = recentProds.reduce((best, p) => {
      const score = Number(p.views || 0) + Number(p.clicks_count || 0) * 2;
      return score > (best._score || 0) ? { ...p, _score: score } : best;
    }, {});

    /* ── Build response ── */
    return {
      sellerScore : Math.min(100, Math.max(0, sellerScore)),

      seller: {
        id               : s.id,
        name             : s.name,
        store_name       : s.store_name,
        store_logo       : s.store_logo,
        profile_image    : s.profile_image,
        store_description: s.store_description,
        verified         : !!s.verified,
        store_verified   : !!s.store_verified,
        email_verified   : !!s.email_verified,
        is_online        : !!s.is_online,
        trust_score      : Number(s.trust_score || 50),
        rating           : Number(s.rating      || 0),
        member_since     : s.created_at,
      },

      listings: {
        total    : Number(prodBreakdown.total    || 0),
        active   : Number(prodBreakdown.active   || 0),
        draft    : Number(prodBreakdown.draft    || 0),
        paused   : Number(prodBreakdown.paused   || 0),
        promoted : Number(prodBreakdown.promoted || 0),
      },

      analytics: {
        views     : views,
        clicks    : clicks,
        favorites : favorites,
        shares    : shares,
        ctr       : Number(ctr.toFixed(2)),
      },

      engagement: {
        total      : engagement,
        avgPerProduct: products > 0
          ? Number((engagement / products).toFixed(1))
          : 0,
        score      : Number(engagementScore.toFixed(1)),
      },

      trust: {
        rating     : Number(s.rating      || 0),
        verified   : !!s.store_verified,
        trust_score: Number(s.trust_score || 50),
      },

      business: {
        total_sales   : Number(s.total_sales    || 0),
        products_count: Number(s.products_count || 0),
        daily_sales   : dailySales,
      },

      performance: {
        response_hours : Number(responseHours.toFixed(1)),
        response_score : responseScore,
        ctr_score      : Number(ctrScore.toFixed(1)),
        engagement_score: Number(engagementScore.toFixed(1)),
        rating_score   : Number(ratingScore.toFixed(1)),
      },

      recentProducts : recentProds.map((p) => ({
        ...p,
        image : p.main_image || p.thumbnail_url || null,
        price : Number(p.price || 0),
        views : Number(p.views || 0),
      })),

      topProduct : topProduct.id ? {
        id    : topProduct.id,
        title : topProduct.title,
        slug  : topProduct.slug,
        views : Number(topProduct.views || 0),
        image : topProduct.main_image || topProduct.thumbnail_url || null,
      } : null,
    };

  } catch (err) {
    console.error("[dashboard] calculateSellerScore:", err.message);
    return { error: "Calculation failed", sellerScore: 0 };
  }
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/dashboard/overview
   Full seller analytics — cached 5 min
═══════════════════════════════════════════════════════════════ */
router.get("/overview", authenticate, async (req, res) => {
  try {
    const userId   = req.user.id;
    const cacheKey = `dashboard:${userId}`;

    // ── Serve from cache if fresh ──
    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.json({
        success     : true,
        cached      : true,
        timestamp   : cached.timestamp,
        data        : cached.data,
        cache_hint  : "Refreshes every 5 minutes",
      });
    }

    // ── Calculate fresh ──
    const result = await calculateSellerScore(userId);

    if (result.error) {
      return res.status(404).json({
        success : false,
        message : result.error,
      });
    }

    const payload = {
      timestamp : new Date().toISOString(),
      data      : result,
    };

    cacheSet(cacheKey, payload);

    return res.json({
      success    : true,
      cached     : false,
      ...payload,
      cache_hint : "Refreshes every 5 minutes",
    });

  } catch (err) {
    console.error("[dashboard] GET /overview:", err.message);
    return res.status(500).json({
      success : false,
      message : "Server error",
      ...(process.env.NODE_ENV === "development" && { error: err.message }),
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/dashboard/stats
   Quick stats only — lighter endpoint for SellerDashboard page
═══════════════════════════════════════════════════════════════ */
router.get("/stats", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(p.views),           0) AS total_views,
         COALESCE(SUM(p.clicks_count),    0) AS total_clicks,
         COALESCE(SUM(p.favorites_count), 0) AS total_favorites,
         COALESCE(SUM(p.engagement_score),0) AS total_engagement,
         COUNT(p.id)                         AS total_products,
         COUNT(CASE WHEN p.status = 'active' AND p.is_active THEN 1 END) AS active_products,
         u.rating,
         u.total_sales,
         u.trust_score
       FROM public.users u
       LEFT JOIN public.products p
         ON p.seller_id = u.id AND p.is_active = true
       WHERE u.id = $1
       GROUP BY u.id, u.rating, u.total_sales, u.trust_score`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const r = rows[0];

    return res.json({
      success : true,
      stats   : {
        total_products  : Number(r.total_products  || 0),
        active_products : Number(r.active_products || 0),
        total_views     : Number(r.total_views     || 0),
        total_clicks    : Number(r.total_clicks    || 0),
        total_favorites : Number(r.total_favorites || 0),
        total_revenue   : Number(r.total_sales     || 0),
        rating          : Number(r.rating          || 0),
        trust_score     : Number(r.trust_score     || 50),
      },
    });

  } catch (err) {
    console.error("[dashboard] GET /stats:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/dashboard/products
   Seller's own products with full stats
═══════════════════════════════════════════════════════════════ */
router.get("/products", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit  = Math.min(Number(req.query.limit) || 50, 100);
    const page   = Math.max(Number(req.query.page)  || 1, 1);
    const offset = (page - 1) * limit;
    const status = req.query.status || null;

    const params  = [userId, limit, offset];
    let   whereExtra = "";

    if (status && status !== "all") {
      params.push(status);
      whereExtra = `AND p.status = $${params.length}`;
    }

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
         p.promotion_priority,
         p.views,
         p.clicks_count,
         p.favorites_count,
         p.share_count,
         p.engagement_score,
         p.conversion_rate,
         p.quality_score,
         p.created_at,
         p.updated_at,
         p.last_interaction_at,
         p.main_image,
         p.thumbnail_url,
         p.location_city,
         p.location_state,
         p.category_id,
         cat.name AS category_name
       FROM public.products p
       LEFT JOIN public.categories cat ON cat.id = p.category_id
       WHERE p.seller_id = $1
         ${whereExtra}
       ORDER BY p.created_at DESC
       LIMIT  $2
       OFFSET $3`,
      params
    );

    /* Count for pagination */
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total
       FROM public.products
       WHERE seller_id = $1 ${status && status !== "all" ? "AND status = $2" : ""}`,
      status && status !== "all" ? [userId, status] : [userId]
    );

    const total = Number(countRows[0]?.total || 0);

    const products = rows.map((p) => ({
      ...p,
      image            : p.main_image || p.thumbnail_url || null,
      price            : Number(p.price             || 0),
      views            : Number(p.views             || 0),
      clicks_count     : Number(p.clicks_count      || 0),
      favorites_count  : Number(p.favorites_count   || 0),
      engagement_score : Number(p.engagement_score  || 0),
    }));

    return res.json({
      success    : true,
      products,
      pagination : {
        total,
        page,
        limit,
        total_pages : Math.ceil(total / limit),
        has_more    : offset + rows.length < total,
      },
    });

  } catch (err) {
    console.error("[dashboard] GET /products:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/dashboard/products/:id/toggle
   Toggle product active/paused
═══════════════════════════════════════════════════════════════ */
router.patch("/products/:id/toggle", authenticate, async (req, res) => {
  const { id } = req.params;
  const userId  = req.user.id;

  try {
    // Verify ownership
    const { rows: own } = await pool.query(
      `SELECT id, is_active, status FROM public.products
       WHERE id = $1 AND seller_id = $2 LIMIT 1`,
      [id, userId]
    );

    if (!own.length) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const product    = own[0];
    const newActive  = !product.is_active;
    const newStatus  = newActive ? "active" : "paused";

    await pool.query(
      `UPDATE public.products
       SET is_active          = $1,
           status             = $2,
           last_interaction_at = NOW(),
           updated_at          = NOW()
       WHERE id = $3 AND seller_id = $4`,
      [newActive, newStatus, id, userId]
    );

    // Invalidate cache
    cache.delete(`dashboard:${userId}`);

    return res.json({
      success   : true,
      is_active : newActive,
      status    : newStatus,
    });

  } catch (err) {
    console.error("[dashboard] PATCH /products/:id/toggle:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/dashboard/products/:id
   Soft delete (set is_active = false, status = 'deleted')
═══════════════════════════════════════════════════════════════ */
router.delete("/products/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const userId  = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT id FROM public.products
       WHERE id = $1 AND seller_id = $2 LIMIT 1`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    await pool.query(
      `UPDATE public.products
       SET is_active  = false,
           status     = 'deleted',
           updated_at = NOW()
       WHERE id = $1 AND seller_id = $2`,
      [id, userId]
    );

    // Invalidate cache
    cache.delete(`dashboard:${userId}`);

    return res.json({ success: true, message: "Product deleted" });

  } catch (err) {
    console.error("[dashboard] DELETE /products/:id:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/dashboard/analytics
   Detailed analytics — views/clicks per day (last 30 days)
═══════════════════════════════════════════════════════════════ */
router.get("/analytics", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const days   = Math.min(Number(req.query.days) || 30, 90);

    /* Product analytics grouped by day */
    let daily = [];
    try {
      const { rows } = await pool.query(
        `SELECT
           DATE(last_interaction_at AT TIME ZONE 'Africa/Lagos') AS date,
           SUM(views)                                            AS views,
           SUM(clicks_count)                                     AS clicks,
           SUM(favorites_count)                                  AS favorites,
           COUNT(*)                                              AS products_updated
         FROM public.products
         WHERE seller_id           = $1
           AND last_interaction_at > NOW() - ($2 || ' days')::INTERVAL
         GROUP BY DATE(last_interaction_at AT TIME ZONE 'Africa/Lagos')
         ORDER BY date ASC`,
        [userId, days]
      );
      daily = rows.map((r) => ({
        date     : r.date,
        label    : new Date(r.date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric" }),
        views    : Number(r.views    || 0),
        clicks   : Number(r.clicks   || 0),
        favorites: Number(r.favorites|| 0),
      }));
    } catch {}

    /* Top 5 products by views */
    const { rows: topProds } = await pool.query(
      `SELECT
         id, title, slug, price,
         main_image, thumbnail_url,
         views, clicks_count, favorites_count,
         engagement_score, status, is_active
       FROM public.products
       WHERE seller_id = $1 AND is_active = true
       ORDER BY views DESC
       LIMIT 5`,
      [userId]
    );

    return res.json({
      success : true,
      period  : `${days} days`,
      daily,
      topProducts : topProds.map((p) => ({
        ...p,
        image : p.main_image || p.thumbnail_url || null,
        price : Number(p.price || 0),
        views : Number(p.views || 0),
      })),
    });

  } catch (err) {
    console.error("[dashboard] GET /analytics:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/dashboard/score
   Just the seller score — lightweight
═══════════════════════════════════════════════════════════════ */
router.get("/score", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await calculateSellerScore(userId);

    if (result.error) {
      return res.status(404).json({ success: false, message: result.error });
    }

    return res.json({
      success      : true,
      seller_score : result.sellerScore,
      performance  : result.performance,
      trust        : result.trust,
    });

  } catch (err) {
    console.error("[dashboard] GET /score:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/dashboard/cache/clear
   Clear dashboard cache for current user
═══════════════════════════════════════════════════════════════ */
router.post("/cache/clear", authenticate, (req, res) => {
  const userId   = req.user.id;
  const cacheKey = `dashboard:${userId}`;
  cache.delete(cacheKey);
  return res.json({ success: true, message: "Cache cleared" });
});

export default router;