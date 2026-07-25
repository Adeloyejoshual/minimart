/**
 * routes/p2p.js — v2
 *
 * Changes from v1:
 *  - ACTIVE_STATUSES constant added — single source of truth
 *  - ACTIVE_WHERE helper added — mirrors homepage.js v4,
 *    productDetail.js v2, sellerprofile.js v2, search.js v2
 *  - GET /: status IN ('active','active_limited') — trial listings visible
 *  - GET /: active_until expiry guard — expired trials auto-hidden
 *  - GET /: p.status + p.active_until added to P2P_SELECT
 *  - GET /: count query updated to match same ACTIVE_WHERE
 *  - POST /: status set to 'active' for verified/subscribed,
 *            'active_limited' for unverified (mirrors addproduct.js)
 *  - POST /: active_until set based on tier (7 days for unverified)
 *  - POST /: seller tier lookup added before INSERT
 *  - GET /match: status IN ('active','active_limited') applied
 *  - GET /match: active_until expiry guard applied
 *  - shapeProduct: trial_listing, trial_expires_at,
 *    trial_days_remaining added (mirrors homepage.js v4)
 *  - All existing promotion + subscription logic unchanged
 */

import express      from "express";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   Mirrors homepage.js v4, productDetail.js v2,
   sellerprofile.js v2, search.js v2.
══════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 40;

/*
 * ACTIVE_STATUSES — both statuses that mean "publicly visible".
 *   active         → verified / subscribed seller, no expiry
 *   active_limited → unverified seller trial listing, 7-day window
 */
const ACTIVE_STATUSES = `('active', 'active_limited')`;

/*
 * ACTIVE_WHERE — paste into any WHERE clause on products.
 * The active_until guard auto-hides expired trials without
 * needing the cron job to have run.
 * Verified listings have NULL active_until → always shown.
 */
const ACTIVE_WHERE = `
  p.is_active  = TRUE
  AND p.is_deleted IS NOT TRUE
  AND p.status     IN ${ACTIVE_STATUSES}
  AND (p.active_until IS NULL OR p.active_until > NOW())
`;

/*
 * POLICY — mirrors addproduct.js exactly.
 * Used in POST / to compute active_until for new P2P listings.
 */
const POLICY = Object.freeze({
  unverified: Object.freeze({ expiryDays: 7,  status: "active_limited" }),
  verified  : Object.freeze({ expiryDays: 30, status: "active"         }),
  subscriber: Object.freeze({ expiryDays: 0,  status: "active"         }),
});

/*
 * PostGIS point builder.
 * longitude first (X), latitude second (Y) — PostGIS convention.
 */
const makePoint = (lngParam, latParam) =>
  `ST_MakePoint(${lngParam}::float, ${latParam}::float)::geography`;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const daysUntilExpiry = (date) => {
  if (!date) return null;
  return Math.max(
    0,
    Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
  );
};

const getPromotionBadge = (isPromoted, promotionType, promotionPriority) => {
  if (!isPromoted) return null;
  const type     = String(promotionType     ?? "").toLowerCase();
  const priority = Number(promotionPriority ?? 0);
  if (type === "elite"   || priority >= 4) return "featured";
  if (type === "premium" || priority >= 3) return "premium";
  return "promoted";
};

const isSubscriptionActive = (status, expiresAt) =>
  status === "active" &&
  expiresAt != null   &&
  new Date(expiresAt) > new Date();

const getSubscriptionLabel = (planSlug) => {
  const labels = {
    premium : "Premium Seller",
    pro     : "Pro Seller",
    business: "Business Seller",
    diamond : "Diamond Seller",
    elite   : "Elite Seller",
  };
  return labels[planSlug] ?? null;
};

/*
 * Resolve seller tier — same logic as addproduct.js getSellerContext().
 * Returns 'subscriber' | 'verified' | 'unverified'.
 */
const resolveSellerTier = (u) => {
  const nowMs = Date.now();
  const hasActiveSub =
    u.subscription_status === "active"    &&
    u.subscription_plan                   &&
    u.subscription_plan !== "free"        &&
    u.subscription_expires_at             &&
    new Date(u.subscription_expires_at).getTime() > nowMs;

  if (hasActiveSub)          return "subscriber";
  if (u.identity_verified)   return "verified";
  return "unverified";
};

/* ══════════════════════════════════════════════════════════════
   SHAPE PRODUCT
   v2: added status, active_until, trial_listing,
       trial_expires_at, trial_days_remaining.
   Mirrors homepage.js v4 shapeProduct() exactly so the
   frontend receives the same trial fields from every route.
══════════════════════════════════════════════════════════════ */
const shapeProduct = (p) => {
  /* ── Images ── */
  let images = [];
  if (Array.isArray(p.images_json)) {
    images = p.images_json.filter((img) => img?.url).map((img) => img.url);
  } else if (p.main_image) {
    images = [p.main_image];
  }
  const primaryImage = images[0] ?? p.main_image ?? p.thumbnail_url ?? null;

  /* ── Promotion ── */
  const isPromoted     = !!p.is_promoted;
  const promotionBadge = getPromotionBadge(
    isPromoted, p.promotion_type, p.promotion_priority
  );
  const promotionActive =
    isPromoted &&
    p.promotion_expires_at != null &&
    new Date(p.promotion_expires_at) > new Date();

  /* ── Seller subscription ── */
  const sellerSubPlan   = p.seller_subscription_plan        ?? null;
  const sellerSubStatus = p.seller_subscription_status      ?? null;
  const sellerSubExpiry = p.seller_subscription_expires_at  ?? null;
  const sellerSubRank   = Number(p.seller_subscription_rank ?? 0);
  const sellerSubActive = isSubscriptionActive(sellerSubStatus, sellerSubExpiry);
  const sellerSubLabel  = sellerSubActive
    ? getSubscriptionLabel(sellerSubPlan) : null;

  /* ── CTR ── */
  const impressions = Number(p.impression_count || 0);
  const clicks      = Number(p.clicks_count     || 0);
  const views       = Number(p.views            || 0);
  const ctr = impressions > 0
    ? clicks / impressions
    : views > 0 ? clicks / views : 0;

  /* ── Trial fields — mirrors homepage.js v4 ── */
  const isTrialListing     = p.status === "active_limited";
  const trialExpiresAt     = isTrialListing ? (p.active_until ?? null) : null;
  const trialDaysRemaining = isTrialListing
    ? daysUntilExpiry(trialExpiresAt)
    : null;

  return {
    id              : p.id,
    title           : p.title,
    price           : Number(p.price || 0),
    slug            : p.slug,
    description     : p.description   || null,
    offer_type      : p.offer_type    || "sell",
    swap_for        : p.swap_for      || null,
    condition       : p.condition     || null,
    negotiable      : !!p.negotiable,
    category_id     : p.category_id   || null,
    created_at      : p.created_at,

    /* Status */
    status          : p.status        || null,
    active_until    : p.active_until  ?? null,

    /* Trial fields */
    trial_listing        : isTrialListing,
    trial_expires_at     : trialExpiresAt,
    trial_days_remaining : trialDaysRemaining,

    /* Images */
    image           : primaryImage,
    images,

    /* Engagement */
    views,
    clicks_count    : clicks,
    impression_count: impressions,
    engagement_score: Number(p.engagement_score || 0),
    ctr,

    /* Promotion */
    is_promoted          : isPromoted,
    promotion_priority   : Number(p.promotion_priority || 0),
    promotion_type       : p.promotion_type       || null,
    promotion_expires_at : p.promotion_expires_at || null,
    promotion_active     : promotionActive,
    promotion_badge      : promotionBadge,

    /* Subscription rank */
    search_priority : Number(p.search_priority || 0),

    /* Location */
    location_city   : p.location_city  || null,
    location_state  : p.location_state || null,
    location: {
      city : p.location_city  || null,
      state: p.location_state || null,
      label:
        [p.location_city, p.location_state].filter(Boolean).join(", ") || null,
    },
    distance_km: p.distance_km != null ? Number(p.distance_km) : null,
    latitude   : p.latitude    ?? null,
    longitude  : p.longitude   ?? null,

    /* Seller */
    seller_id  : p.seller_id   || null,
    seller_name: p.seller_name || null,
    seller: {
      id                  : p.seller_id   || null,
      name                : p.seller_name || null,
      verified            : !!p.seller_verified,
      subscription_plan   : sellerSubPlan,
      subscription_active : sellerSubActive,
      subscription_rank   : sellerSubRank,
      subscription_label  : sellerSubLabel,
      subscription_badge  : sellerSubLabel,
    },
  };
};

/* ══════════════════════════════════════════════════════════════
   SHARED SELECT COLUMNS
   v2: added p.status and p.active_until so shapeProduct()
       can set trial_listing and trial_expires_at correctly.
══════════════════════════════════════════════════════════════ */
const P2P_SELECT = (distanceExpr = "") => `
  p.id,
  p.title,
  p.price,
  p.slug,
  p.status,
  p.active_until,
  p.description,
  p.offer_type,
  p.swap_for,
  p.condition,
  p.negotiable,
  p.main_image,
  p.thumbnail_url,
  p.images,
  p.views,
  p.clicks_count,
  p.impression_count,
  p.engagement_score,
  p.search_priority,
  p.is_promoted,
  p.promotion_type,
  p.promotion_priority,
  p.promotion_expires_at,
  p.location_city,
  p.location_state,
  p.latitude,
  p.longitude,
  p.created_at,
  p.category_id,
  p.seller_id,
  p.seller_name,

  u.identity_verified          AS seller_verified,
  u.subscription_plan          AS seller_subscription_plan,
  u.subscription_status        AS seller_subscription_status,
  u.subscription_expires_at    AS seller_subscription_expires_at,
  COALESCE(sp.rank, 0)         AS seller_subscription_rank

  ${distanceExpr ? `, ${distanceExpr}` : ""}
`;

/* ══════════════════════════════════════════════════════════════
   GET /api/p2p
══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  const {
    lat,
    lng,
    page        = 0,
    category_id,
    offer_type,
    sort        = "smart",
    section,
    q,
    radius_km   = 50,
  } = req.query;

  const hasCoords   = !!(lat && lng);
  const hasCategory = !!category_id;
  const hasSearch   = !!(q && String(q).trim().length > 0);

  try {
    const limit  = PAGE_SIZE;
    const offset = Number(page) * limit;

    const params = [limit + 1, offset];

    let lngIdx = null, latIdx = null, radiusIdx = null;
    if (hasCoords) {
      params.push(Number(lng));                   lngIdx    = params.length; // $3
      params.push(Number(lat));                   latIdx    = params.length; // $4
      params.push(Number(radius_km) * 1_000);     radiusIdx = params.length; // $5
    }

    let catIdx = null;
    if (hasCategory) {
      params.push(category_id);
      catIdx = params.length;
    }

    let offerIdx = null;
    if (offer_type && offer_type !== "all") {
      params.push(offer_type);
      offerIdx = params.length;
    }

    let searchIdx = null;
    if (hasSearch) {
      params.push(`%${String(q).trim().toLowerCase()}%`);
      searchIdx = params.length;
    }

    /* Distance expression */
    const distanceExpr = hasCoords
      ? `ROUND(
           (ST_Distance(
             ${makePoint(`p.longitude`, `p.latitude`)},
             ${makePoint(`$${lngIdx}`, `$${latIdx}`)}
           ) / 1000)::numeric, 1
         ) AS distance_km`
      : "";

    /* WHERE fragments */
    const radiusWhere = hasCoords
      ? `AND (
           p.latitude  IS NULL
           OR p.longitude IS NULL
           OR ST_DWithin(
                ${makePoint(`p.longitude`, `p.latitude`)},
                ${makePoint(`$${lngIdx}`, `$${latIdx}`)},
                $${radiusIdx}
              )
         )`
      : "";

    let offerWhere = "";
    if (offerIdx) {
      offerWhere = offer_type === "free"
        ? `AND (p.offer_type = $${offerIdx} OR p.price = 0)`
        : `AND p.offer_type = $${offerIdx}`;
    }

    const categoryWhere = catIdx    ? `AND p.category_id = $${catIdx}`         : "";
    const searchWhere   = searchIdx
      ? `AND (
           LOWER(p.title)       LIKE $${searchIdx}
           OR LOWER(p.description) LIKE $${searchIdx}
         )`
      : "";

    /* Section + ORDER BY */
    let sectionWhere = "";
    let orderBy      = "";

    switch (section) {
      case "nearby":
        orderBy = hasCoords
          ? `distance_km ASC NULLS LAST, p.created_at DESC`
          : `p.created_at DESC`;
        break;

      case "trending":
        sectionWhere = `AND (p.engagement_score > 0 OR p.clicks_count > 0)`;
        orderBy = `
          p.is_promoted        DESC,
          p.promotion_priority DESC,
          p.search_priority    DESC,
          p.engagement_score   DESC,
          p.clicks_count       DESC,
          p.created_at         DESC
        `;
        break;

      case "free":
        sectionWhere = `AND (p.offer_type = 'free' OR p.price = 0)`;
        orderBy      = `p.created_at DESC`;
        break;

      case "swap":
        sectionWhere = `AND p.offer_type = 'swap'`;
        orderBy = `
          p.is_promoted        DESC,
          p.promotion_priority DESC,
          p.search_priority    DESC,
          p.engagement_score   DESC,
          p.created_at         DESC
        `;
        break;

      default:
        switch (sort) {
          case "newest":
            orderBy = `p.created_at DESC`;
            break;
          case "price_asc":
            orderBy = `p.price ASC NULLS LAST, p.created_at DESC`;
            break;
          case "price_desc":
            orderBy = `p.price DESC NULLS LAST, p.created_at DESC`;
            break;
          case "smart":
          default:
            orderBy = `
              p.is_promoted        DESC,
              p.promotion_priority DESC,
              p.search_priority    DESC,
              p.engagement_score   DESC,
              p.created_at         DESC
            `;
        }
    }

    /* ── Main query ──
       v2: WHERE uses ACTIVE_WHERE (active + active_limited)
           plus the p.is_p2p = TRUE guard.
    ── */
    const sql = `
      SELECT ${P2P_SELECT(distanceExpr)}
      FROM   public.products     p
      LEFT   JOIN public.users   u  ON u.id    = p.seller_id
      LEFT   JOIN subscription_plans sp
                                     ON sp.slug = u.subscription_plan
                                    AND sp.is_active = TRUE
      WHERE  ${ACTIVE_WHERE}
        AND  p.is_p2p = TRUE
        ${radiusWhere}
        ${categoryWhere}
        ${offerWhere}
        ${sectionWhere}
        ${searchWhere}
      ORDER BY ${orderBy}
      LIMIT  $1
      OFFSET $2
    `;

    const { rows } = await pool.query(sql, params);
    const hasMore  = rows.length > limit;
    const records  = rows.slice(0, limit);
    const products = records.map(shapeProduct);

    /* ── Section counts ──
       v2: count query uses same ACTIVE_WHERE so trial listings
           are included in the chip counts too.
    ── */
    const countParams = [];
    let cLngIdx = null, cLatIdx = null, cRadiusIdx = null, cCatIdx = null;

    if (hasCoords) {
      countParams.push(Number(lng));               cLngIdx    = countParams.length;
      countParams.push(Number(lat));               cLatIdx    = countParams.length;
      countParams.push(Number(radius_km) * 1_000); cRadiusIdx = countParams.length;
    }
    if (hasCategory) {
      countParams.push(category_id);
      cCatIdx = countParams.length;
    }

    const countRadiusWhere = hasCoords
      ? `AND (
           p.latitude  IS NULL
           OR p.longitude IS NULL
           OR ST_DWithin(
                ${makePoint(`p.longitude`, `p.latitude`)},
                ${makePoint(`$${cLngIdx}`, `$${cLatIdx}`)},
                $${cRadiusIdx}
              )
         )`
      : "";

    const countCatWhere = cCatIdx ? `AND p.category_id = $${cCatIdx}` : "";

    const countSql = `
      SELECT
        COUNT(*)::int                                                  AS total,
        COUNT(*) FILTER (WHERE p.offer_type = 'swap')::int             AS swaps,
        COUNT(*) FILTER (WHERE p.offer_type = 'free' OR p.price = 0)::int AS frees,
        COUNT(*) FILTER (
          WHERE p.offer_type = 'sell' OR p.offer_type IS NULL
        )::int                                                         AS sells
      FROM public.products p
      WHERE ${ACTIVE_WHERE}
        AND p.is_p2p = TRUE
        ${countRadiusWhere}
        ${countCatWhere}
    `;

    const { rows: countRows } = await pool.query(countSql, countParams);
    const counts = countRows[0] ?? {};

    /* Representative city */
    const cityFreq = {};
    for (const p of products) {
      if (p.location.city)
        cityFreq[p.location.city] = (cityFreq[p.location.city] || 0) + 1;
    }
    const representativeCity =
      Object.entries(cityFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return res.json({
      products,
      hasMore,
      counts: {
        all : Number(counts.total || 0),
        sell: Number(counts.sells || 0),
        swap: Number(counts.swaps || 0),
        free: Number(counts.frees || 0),
      },
      meta: {
        location    : representativeCity,
        nearbySource: hasCoords ? "gps" : null,
        page        : Number(page),
        returned    : products.length,
        section     : section    || null,
        offer_type  : offer_type || "all",
        sort,
        category_id : category_id || null,
        radius_km   : hasCoords ? Number(radius_km) : null,
      },
    });
  } catch (err) {
    console.error("[p2p] GET / error:", err.message, "\n", err.stack);
    return res.status(500).json({ error: "Failed to load P2P offers" });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/p2p
   v2: resolves seller tier before INSERT so trial listings
       get status='active_limited' and a 7-day active_until,
       matching addproduct.js behaviour exactly.
══════════════════════════════════════════════════════════════ */
router.post("/", authenticate, async (req, res) => {
  const sellerId = req.user?.id;
  if (!sellerId) return res.status(401).json({ error: "Not authenticated." });

  const {
    title,
    price       = 0,
    category_id,
    offer_type  = "sell",
    description = "",
    swap_for    = null,
    seller_name,
    location_city,
    location_state,
    lat,
    lng,
  } = req.body;

  if (!title?.trim())
    return res.status(400).json({ error: "title is required" });
  if (!category_id)
    return res.status(400).json({ error: "category_id is required" });
  if (!["sell", "swap", "free"].includes(offer_type))
    return res.status(400).json({ error: "offer_type must be sell | swap | free" });

  try {
    /* ── Resolve seller tier ──
       Mirrors addproduct.js getSellerContext() so unverified
       P2P sellers get the same 7-day trial treatment.
    ── */
    const { rows: userRows } = await pool.query(
      `SELECT
         identity_verified,
         subscription_plan,
         subscription_status,
         subscription_expires_at
       FROM public.users
       WHERE id = $1
       LIMIT 1`,
      [sellerId]
    );

    if (!userRows.length) {
      return res.status(404).json({ error: "Seller account not found." });
    }

    const tier   = resolveSellerTier(userRows[0]);
    const policy = POLICY[tier];

    /*
     * active_until:
     *   subscriber → NULL (never expires)
     *   verified   → NOW() + 30 days
     *   unverified → NOW() + 7 days (trial)
     */
    const activeUntil = policy.expiryDays === 0
      ? null
      : new Date(Date.now() + policy.expiryDays * 86_400_000);

    /* Slug with timestamp suffix to avoid collisions */
    const base = title.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60);
    const slug = `${base}-${Date.now().toString(36)}`;

    const { rows } = await pool.query(
      `INSERT INTO public.products (
         title, price, slug, category_id,
         offer_type, description, swap_for,
         seller_id, seller_name,
         location_city, location_state, latitude, longitude,
         is_p2p, is_active, status, active_until,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7,
         $8, $9,
         $10, $11, $12, $13,
         TRUE, TRUE, $14, $15,
         NOW(), NOW()
       )
       RETURNING
         id, slug, title, offer_type, status,
         active_until, created_at`,
      [
        title.trim(),
        Number(price) || 0,
        slug,
        category_id,
        offer_type,
        description || "",
        swap_for    || null,
        sellerId,
        seller_name || null,
        location_city  || null,
        location_state || null,
        lat ? Number(lat) : null,
        lng ? Number(lng) : null,
        policy.status,    // $14 — 'active' or 'active_limited'
        activeUntil,      // $15 — null or 7/30-day date
      ]
    );

    const created = rows[0];

    return res.status(201).json({
      success    : true,
      product    : created,
      tier,
      /*
       * trial fields in POST response — frontend can show
       * "Your listing is live for 7 days (trial)" immediately
       * after posting, same as addproduct.js response.
       */
      trial_listing       : policy.status === "active_limited",
      trial_expires_at    : activeUntil,
      trial_days_remaining: activeUntil ? policy.expiryDays : null,
      needs_verification  : policy.status === "active_limited",
      ...(policy.status === "active_limited" && {
        verification_message:
          "Verify your identity to make this listing permanent.",
      }),
    });

  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Duplicate listing. Please try again." });
    console.error("[p2p] POST / error:", err.message);
    return res.status(500).json({ error: "Failed to create P2P offer" });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/p2p/match
   v2: status IN ('active','active_limited') applied.
       active_until expiry guard applied.
       Trial swap listings now appear in match results.
══════════════════════════════════════════════════════════════ */
router.get("/match", async (req, res) => {
  const { have, want, lat, lng, limit = 10 } = req.query;

  if (!have && !want) {
    return res.status(400).json({ error: "Provide at least one of: have, want" });
  }

  const hasCoords = !!(lat && lng);

  try {
    const params  = [];
    const clauses = [];

    if (want) {
      params.push(`%${String(want).toLowerCase()}%`);
      const idx = params.length;
      clauses.push(`(
        LOWER(p.title)          LIKE $${idx}
        OR LOWER(p.swap_for)    LIKE $${idx}
        OR LOWER(p.description) LIKE $${idx}
      )`);
    }

    if (have) {
      params.push(`%${String(have).toLowerCase()}%`);
      const idx = params.length;
      clauses.push(`(
        LOWER(p.swap_for)       LIKE $${idx}
        OR LOWER(p.description) LIKE $${idx}
      )`);
    }

    const whereKeyword = clauses.length
      ? `AND (${clauses.join(" OR ")})`
      : "";

    let lngIdx = null, latIdx = null;
    if (hasCoords) {
      params.push(Number(lng)); lngIdx = params.length;
      params.push(Number(lat)); latIdx = params.length;
    }

    const distanceExpr = hasCoords
      ? `ROUND(
           (ST_Distance(
             ${makePoint(`p.longitude`, `p.latitude`)},
             ${makePoint(`$${lngIdx}`, `$${latIdx}`)}
           ) / 1000)::numeric, 1
         ) AS distance_km`
      : "";

    const safeLimit = Math.min(Number(limit) || 10, 50);
    params.push(safeLimit);
    const limitIdx = params.length;

    /*
     * v2 WHERE:
     *   - status IN ('active', 'active_limited') — trial swap listings included
     *   - active_until guard — expired trials hidden automatically
     *   - is_deleted IS NOT TRUE — NULL-safe (mirrors other routes)
     */
    const sql = `
      SELECT
        p.id, p.title, p.price, p.slug,
        p.status, p.active_until,
        p.offer_type, p.swap_for, p.condition,
        p.main_image, p.thumbnail_url,
        p.location_city, p.location_state,
        p.engagement_score, p.search_priority,
        p.is_promoted, p.promotion_priority,
        p.promotion_type, p.promotion_expires_at,
        p.seller_id, p.seller_name,
        u.identity_verified          AS seller_verified,
        u.subscription_plan          AS seller_subscription_plan,
        u.subscription_status        AS seller_subscription_status,
        u.subscription_expires_at    AS seller_subscription_expires_at,
        COALESCE(sp.rank, 0)         AS seller_subscription_rank,
        p.created_at
        ${distanceExpr ? `, ${distanceExpr}` : ""}
      FROM   public.products      p
      LEFT   JOIN public.users    u  ON u.id    = p.seller_id
      LEFT   JOIN subscription_plans sp
                                     ON sp.slug = u.subscription_plan
                                    AND sp.is_active = TRUE
      WHERE  p.is_active   = TRUE
        AND  p.is_deleted  IS NOT TRUE
        AND  p.status      IN ${ACTIVE_STATUSES}
        AND  (p.active_until IS NULL OR p.active_until > NOW())
        AND  p.is_p2p      = TRUE
        AND  p.offer_type  = 'swap'
        ${whereKeyword}
      ORDER BY
        p.is_promoted        DESC,
        p.promotion_priority DESC,
        p.search_priority    DESC,
        ${hasCoords ? "distance_km ASC NULLS LAST," : ""}
        p.engagement_score   DESC,
        p.created_at         DESC
      LIMIT $${limitIdx}
    `;

    const { rows } = await pool.query(sql, params);

    const matches = rows.map((p) => {
      const subActive = isSubscriptionActive(
        p.seller_subscription_status,
        p.seller_subscription_expires_at
      );
      const subLabel = subActive
        ? getSubscriptionLabel(p.seller_subscription_plan)
        : null;

      const isTrialListing = p.status === "active_limited";

      return {
        id         : p.id,
        title      : p.title,
        price      : Number(p.price || 0),
        slug       : p.slug,
        offer_type : p.offer_type,
        swap_for   : p.swap_for   || null,
        condition  : p.condition  || null,
        image      : p.main_image || p.thumbnail_url || null,
        status     : p.status,
        active_until: p.active_until ?? null,

        /* Trial fields */
        trial_listing       : isTrialListing,
        trial_expires_at    : isTrialListing ? (p.active_until ?? null) : null,
        trial_days_remaining: isTrialListing
          ? daysUntilExpiry(p.active_until) : null,

        location: {
          city : p.location_city  || null,
          state: p.location_state || null,
        },
        distance_km    : p.distance_km != null ? Number(p.distance_km) : null,
        is_promoted    : !!p.is_promoted,
        promotion_badge: getPromotionBadge(
          !!p.is_promoted, p.promotion_type, p.promotion_priority
        ),
        search_priority: Number(p.search_priority || 0),
        created_at     : p.created_at,
        seller: {
          id                 : p.seller_id   || null,
          name               : p.seller_name || null,
          verified           : !!p.seller_verified,
          subscription_active: subActive,
          subscription_badge : subLabel,
        },
      };
    });

    return res.json({ matches, returned: matches.length });
  } catch (err) {
    console.error("[p2p] GET /match error:", err.message, "\n", err.stack);
    return res.status(500).json({ error: "Failed to fetch trade matches" });
  }
});

export default router;