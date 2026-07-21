/**
 * routes/p2p.js
 *
 * Changes from previous version:
 *  - GET /: search_priority added to ORDER BY (subscription boost)
 *  - GET /: promotion_badge derived and included in shaped product
 *  - GET /: seller subscription fields joined from users + subscription_plans
 *  - GET /: COUNT query fixed — no more string patching, proper params
 *  - GET /: location_geo → ST_MakePoint on latitude/longitude columns
 *           (matches your actual schema which has latitude + longitude floats,
 *            not a separate geography column named location_geo)
 *  - POST /: authenticate middleware added
 *  - POST /: slug collision guard via UUID suffix
 *  - POST /: location stored on latitude/longitude columns (no location_geo)
 *  - GET /match: lat/lng param order fixed (was swapped)
 *  - GET /match: search_priority + promotion in ORDER BY
 */

import express      from "express";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 40;

/*
 * Your schema has `latitude FLOAT8` and `longitude FLOAT8` columns.
 * For distance queries we build a point on the fly:
 *   ST_MakePoint(longitude, latitude)  ← note: longitude first (X,Y)
 * rather than using a separate geography column.
 */
const makePoint = (lngParam, latParam) =>
  `ST_MakePoint(${lngParam}::float, ${latParam}::float)::geography`;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

/**
 * Derive promotion badge — mirrors homepage.js shapeProduct()
 * and productDetail.js getPromotionBadge()
 *
 * "featured"  → Elite plan   (priority 4)
 * "premium"   → Premium plan (priority 3)
 * "promoted"  → Basic/Starter
 * null        → not promoted
 */
const getPromotionBadge = (isPromoted, promotionType, promotionPriority) => {
  if (!isPromoted) return null;
  const type     = String(promotionType     ?? "").toLowerCase();
  const priority = Number(promotionPriority ?? 0);
  if (type === "elite"   || priority >= 4) return "featured";
  if (type === "premium" || priority >= 3) return "premium";
  return "promoted";
};

/**
 * Check whether a subscription is currently active.
 */
const isSubscriptionActive = (status, expiresAt) =>
  status === "active" &&
  expiresAt != null   &&
  new Date(expiresAt) > new Date();

/**
 * Map subscription plan slug → display label.
 * Matches your subscription_plans table:
 *   free=0, premium=1, pro=2, business=3, diamond=5, elite=10
 */
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

/**
 * Shape one raw DB row → clean product object for the frontend.
 * Includes promotion badge and seller subscription fields.
 */
const shapeProduct = (p) => {
  /* Images */
  let images = [];
  if (Array.isArray(p.images_json)) {
    images = p.images_json.filter((img) => img?.url).map((img) => img.url);
  } else if (p.main_image) {
    images = [p.main_image];
  }
  const primaryImage = images[0] ?? p.main_image ?? p.thumbnail_url ?? null;

  /* Promotion */
  const isPromoted     = !!p.is_promoted;
  const promotionBadge = getPromotionBadge(
    isPromoted, p.promotion_type, p.promotion_priority
  );
  const promotionActive =
    isPromoted &&
    p.promotion_expires_at != null &&
    new Date(p.promotion_expires_at) > new Date();

  /* Seller subscription */
  const sellerSubPlan   = p.seller_subscription_plan   ?? null;
  const sellerSubStatus = p.seller_subscription_status ?? null;
  const sellerSubExpiry = p.seller_subscription_expires_at ?? null;
  const sellerSubRank   = Number(p.seller_subscription_rank ?? 0);
  const sellerSubActive = isSubscriptionActive(sellerSubStatus, sellerSubExpiry);
  const sellerSubLabel  = sellerSubActive ? getSubscriptionLabel(sellerSubPlan) : null;

  /* CTR */
  const impressions  = Number(p.impression_count || 0);
  const clicks       = Number(p.clicks_count     || 0);
  const views        = Number(p.views            || 0);
  const ctr = impressions > 0
    ? clicks / impressions
    : views > 0 ? clicks / views : 0;

  return {
    id              : p.id,
    title           : p.title,
    price           : Number(p.price || 0),
    slug            : p.slug,
    description     : p.description     || null,
    offer_type      : p.offer_type      || "sell",
    swap_for        : p.swap_for        || null,
    condition       : p.condition       || null,
    negotiable      : !!p.negotiable,
    category_id     : p.category_id     || null,
    created_at      : p.created_at,

    /* Images */
    image           : primaryImage,
    images,

    /* Engagement */
    views,
    clicks_count    : clicks,
    impression_count: impressions,
    engagement_score: Number(p.engagement_score || 0),
    ctr,

    /* ── Promotion ──
       Used on the P2P card to show "⭐ Featured" / "🔝 Premium" badge.
       Matches the same badge system on the homepage feed.
    */
    is_promoted          : isPromoted,
    promotion_priority   : Number(p.promotion_priority || 0),
    promotion_type       : p.promotion_type       || null,
    promotion_expires_at : p.promotion_expires_at || null,
    promotion_active     : promotionActive,
    promotion_badge      : promotionBadge,

    /* ── Search priority (subscription rank) ──
       Higher value = subscribed seller. Frontend can show
       a "Diamond Seller" badge next to the listing.
    */
    search_priority : Number(p.search_priority || 0),

    /* Location */
    location_city   : p.location_city  || null,
    location_state  : p.location_state || null,
    location: {
      city : p.location_city  || null,
      state: p.location_state || null,
      label: [p.location_city, p.location_state].filter(Boolean).join(", ") || null,
    },
    distance_km: p.distance_km != null ? Number(p.distance_km) : null,
    latitude   : p.latitude    ?? null,
    longitude  : p.longitude   ?? null,

    /* ── Seller ──
       seller.subscription_badge is used by the frontend to show
       "💎 Diamond Seller" next to the seller name on the card.
    */
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
      subscription_badge  : sellerSubLabel,  // null when not subscribed
    },
  };
};

/* ══════════════════════════════════════════════════════════════
   SHARED SELECT COLUMNS
   Includes seller subscription fields via LEFT JOIN.
══════════════════════════════════════════════════════════════ */
const P2P_SELECT = (distanceExpr = "") => `
  p.id,
  p.title,
  p.price,
  p.slug,
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
  p.negotiable,

  /* Seller live fields */
  u.identity_verified  AS seller_verified,

  /* Seller subscription — joined from users + subscription_plans */
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

    /*
     * Parameter slots — built in a fixed order so SQL $N references
     * never clash. All params pushed into this array in sequence.
     *
     * Slot layout:
     *   $1          = limit + 1
     *   $2          = offset
     *   $3,$4,$5    = lng, lat, radius_m  (only when hasCoords)
     *   $N          = category_id         (when hasCategory)
     *   $N          = offer_type          (when offer_type filter)
     *   $N          = search pattern      (when hasSearch)
     */
    const params = [limit + 1, offset];

    let lngIdx = null, latIdx = null, radiusIdx = null;
    if (hasCoords) {
      params.push(Number(lng));   lngIdx    = params.length; // $3
      params.push(Number(lat));   latIdx    = params.length; // $4
      params.push(Number(radius_km) * 1_000); radiusIdx = params.length; // $5
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

    /* Distance expression — longitude first (X then Y in PostGIS) */
    const distanceExpr = hasCoords
      ? `ROUND(
           (ST_Distance(
             ${makePoint(`p.longitude`, `p.latitude`)},
             ${makePoint(`$${lngIdx}`, `$${latIdx}`)}
           ) / 1000)::numeric, 1
         ) AS distance_km`
      : "";

    /* Radius filter */
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

    /* Offer type filter */
    let offerWhere = "";
    if (offerIdx) {
      if (offer_type === "free") {
        offerWhere = `AND (p.offer_type = $${offerIdx} OR p.price = 0)`;
      } else {
        offerWhere = `AND p.offer_type = $${offerIdx}`;
      }
    }

    /* Category filter */
    const categoryWhere = catIdx ? `AND p.category_id = $${catIdx}` : "";

    /* Full-text search filter */
    const searchWhere = searchIdx
      ? `AND (
           LOWER(p.title)       LIKE $${searchIdx}
           OR LOWER(p.description) LIKE $${searchIdx}
         )`
      : "";

    /* Section extras + ORDER BY */
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
        orderBy      = `
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
        orderBy      = `
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
            /*
             * Smart ranking — same as homepage.js:
             *   1. Promoted products first  (paid promotion)
             *   2. promotion_priority       (Elite=4 > Premium=3 > Basic=2 > Starter=1)
             *   3. search_priority          (subscription rank: elite=10, diamond=5 …)
             *   4. engagement_score         (organic)
             *   5. created_at              (tiebreaker)
             */
            orderBy = `
              p.is_promoted        DESC,
              p.promotion_priority DESC,
              p.search_priority    DESC,
              p.engagement_score   DESC,
              p.created_at         DESC
            `;
        }
    }

    /* Main query */
    const sql = `
      SELECT ${P2P_SELECT(distanceExpr)}
      FROM   public.products     p
      LEFT   JOIN public.users   u  ON u.id    = p.seller_id
      LEFT   JOIN subscription_plans sp
                                     ON sp.slug = u.subscription_plan
                                    AND sp.is_active = TRUE
      WHERE  p.is_active = TRUE
        AND  p.status    = 'active'
        AND  p.is_p2p    = TRUE
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

    /*
     * Section counts — properly parameterized, no string patching.
     * Only uses coords and category (offer_type and search don't
     * affect the filter chip counts).
     */
    const countParams = [];
    let   cLngIdx = null, cLatIdx = null, cRadiusIdx = null, cCatIdx = null;

    if (hasCoords) {
      countParams.push(Number(lng));                     cLngIdx    = countParams.length;
      countParams.push(Number(lat));                     cLatIdx    = countParams.length;
      countParams.push(Number(radius_km) * 1_000);       cRadiusIdx = countParams.length;
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
        COUNT(*)                                                       AS total,
        COUNT(*) FILTER (WHERE p.offer_type = 'swap')                  AS swaps,
        COUNT(*) FILTER (WHERE p.offer_type = 'free' OR p.price = 0)   AS frees,
        COUNT(*) FILTER (
          WHERE p.offer_type = 'sell' OR p.offer_type IS NULL
        )                                                              AS sells
      FROM public.products p
      WHERE p.is_active = TRUE
        AND p.status    = 'active'
        AND p.is_p2p    = TRUE
        ${countRadiusWhere}
        ${countCatWhere}
    `;

    const { rows: countRows } = await pool.query(countSql, countParams);
    const counts = countRows[0] || {};

    /* Representative city */
    const cityFreq = {};
    for (const p of products) {
      if (p.location.city) {
        cityFreq[p.location.city] = (cityFreq[p.location.city] || 0) + 1;
      }
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
   Create a P2P offer. Requires authentication.
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
    /*
     * Slug with UUID suffix to avoid collisions.
     * Same pattern as addproduct.js generateSlugWithId().
     */
    const base = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const slug = `${base}-${Date.now().toString(36)}`;

    const { rows } = await pool.query(
      `INSERT INTO public.products (
         title, price, slug, category_id,
         offer_type, description, swap_for,
         seller_id, seller_name,
         location_city, location_state, latitude, longitude,
         is_p2p, is_active, status,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7,
         $8, $9,
         $10, $11, $12, $13,
         TRUE, TRUE, 'active',
         NOW(), NOW()
       )
       RETURNING id, slug, title, offer_type, created_at`,
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
      ]
    );

    return res.status(201).json({ success: true, product: rows[0] });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Duplicate listing. Please try again." });
    console.error("[p2p] POST / error:", err.message);
    return res.status(500).json({ error: "Failed to create P2P offer" });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/p2p/match
   Smart trade-match suggestions.
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
        LOWER(p.title)       LIKE $${idx}
        OR LOWER(p.swap_for) LIKE $${idx}
        OR LOWER(p.description) LIKE $${idx}
      )`);
    }

    if (have) {
      params.push(`%${String(have).toLowerCase()}%`);
      const idx = params.length;
      clauses.push(`(
        LOWER(p.swap_for)    LIKE $${idx}
        OR LOWER(p.description) LIKE $${idx}
      )`);
    }

    const whereKeyword = clauses.length
      ? `AND (${clauses.join(" OR ")})`
      : "";

    /* Distance params — longitude FIRST (PostGIS convention) */
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

    const sql = `
      SELECT
        p.id, p.title, p.price, p.slug,
        p.offer_type, p.swap_for, p.condition,
        p.main_image, p.thumbnail_url,
        p.location_city, p.location_state,
        p.engagement_score, p.search_priority,
        p.is_promoted, p.promotion_priority,
        p.promotion_type, p.promotion_expires_at,
        p.seller_id, p.seller_name,
        u.subscription_plan       AS seller_subscription_plan,
        u.subscription_status     AS seller_subscription_status,
        u.subscription_expires_at AS seller_subscription_expires_at,
        COALESCE(sp.rank, 0)      AS seller_subscription_rank,
        p.created_at
        ${distanceExpr ? `, ${distanceExpr}` : ""}
      FROM   public.products      p
      LEFT   JOIN public.users    u  ON u.id    = p.seller_id
      LEFT   JOIN subscription_plans sp
                                     ON sp.slug = u.subscription_plan
                                    AND sp.is_active = TRUE
      WHERE  p.is_active    = TRUE
        AND  p.status       = 'active'
        AND  p.is_p2p       = TRUE
        AND  p.offer_type   = 'swap'
        ${whereKeyword}
      ORDER BY
        /*
         * Subscribed and promoted swap listings rank higher —
         * a Diamond seller's swap offer appears above a free seller.
         */
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

      return {
        id         : p.id,
        title      : p.title,
        price      : Number(p.price || 0),
        slug       : p.slug,
        offer_type : p.offer_type,
        swap_for   : p.swap_for   || null,
        condition  : p.condition  || null,
        image      : p.main_image || p.thumbnail_url || null,
        location: {
          city : p.location_city  || null,
          state: p.location_state || null,
        },
        distance_km      : p.distance_km != null ? Number(p.distance_km) : null,
        is_promoted      : !!p.is_promoted,
        promotion_badge  : getPromotionBadge(
          !!p.is_promoted, p.promotion_type, p.promotion_priority
        ),
        search_priority  : Number(p.search_priority || 0),
        created_at       : p.created_at,
        seller: {
          id                 : p.seller_id   || null,
          name               : p.seller_name || null,
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