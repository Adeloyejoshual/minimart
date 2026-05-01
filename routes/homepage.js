import express from "express";
import { Pool } from "pg";
import { createClient } from "redis";
import { getLocationFromIP, getClientIP } from "./location.js";

const router = express.Router();

/* =====================================
   CONNECTIONS
===================================== */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

const redis = createClient({ url: process.env.REDIS_URL });
redis.on("error", (err) => console.error("Redis error:", err));
await redis.connect();

/* =====================================
   CONSTANTS
===================================== */
const FEED_LIMIT   = 50;  // total products per homepage response
const CACHE_TTL_S  = 60;  // nearby cache TTL in seconds

// Feed slot allocation (must sum to FEED_LIMIT)
const SLOTS = {
  nearby:   20, // 40%
  trending: 13, // 25%
  latest:   10, // 20%
  promoted:  5, // 10%
  random:    2, //  5%  (fills gaps / discovery)
};

/* =====================================
   NORMALIZE PRODUCT
===================================== */
const normalizeProduct = (p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  description: p.description,
  price: Number(p.price || 0),
  images: Array.isArray(p.images) ? p.images : [],
  views: Number(p.views || 0),
  clicks_count: Number(p.clicks_count || 0),
  is_promoted: Boolean(p.is_promoted),
  boost_score: Number(p.boost_score || 0),
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  ...(p.distance_km != null && {
    distance_km: Math.round(Number(p.distance_km) * 10) / 10,
  }),
  seller: p.seller_id
    ? {
        id: p.seller_id,
        trust_score: Number(p.trust_score || 50),
        verified: Boolean(p.verified),
      }
    : undefined,
  createdAt: p.created_at,
});

/* =====================================
   IMAGE AGGREGATION FRAGMENT
===================================== */
const imageAgg = `
  COALESCE(
    json_agg(pi.image_url ORDER BY pi.position_order)
    FILTER (WHERE pi.image_url IS NOT NULL),
    '[]'
  ) AS images
`;

/* =====================================
   BASE JOINS FRAGMENT
===================================== */
const baseJoins = `
  FROM products p
  LEFT JOIN product_images pi ON p.id = pi.product_id
  LEFT JOIN users u ON p.seller_id = u.id
`;

const baseWhere = `
  WHERE p.is_active   = true
    AND p.status      = 'active'
    AND p.fraud_score < 50
`;

const baseGroup = `
  GROUP BY
    p.id, p.slug, p.title, p.description, p.price,
    p.created_at, p.views, p.clicks_count,
    p.is_promoted, p.boost_score,
    p.location_state, p.location_city,
    p.latitude, p.longitude,
    p.seller_id, u.trust_score, u.verified
`;

const baseSelect = `
  p.id, p.slug, p.title, p.description, p.price,
  p.created_at, p.views, p.clicks_count,
  p.is_promoted, p.boost_score,
  p.location_state, p.location_city,
  p.latitude, p.longitude,
  p.seller_id, u.trust_score, u.verified,
  ${imageAgg}
`;

/* =====================================
   HAVERSINE DISTANCE EXPRESSION
   Returns distance in kilometres.
   $lat and $lng are the user's coordinates.
   p.latitude / p.longitude are the product's.
===================================== */
const haversine = (latParam, lngParam) => `
  (
    6371 * 2 * asin(sqrt(
      power(sin(radians((p.latitude  - ${latParam}) / 2)), 2) +
      cos(radians(${latParam})) *
      cos(radians(p.latitude)) *
      power(sin(radians((p.longitude - ${lngParam}) / 2)), 2)
    ))
  )
`;

/* =====================================
   SPAM LISTING DETECTION
   >= 70 = block. 30–69 = flag + allow.
===================================== */
export const detectSpamListing = async (sellerId, title) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS count
     FROM products
     WHERE seller_id = $1
       AND created_at > NOW() - INTERVAL '10 minutes'`,
    [sellerId]
  );

  let score = 0;
  const recentCount = Number(rows[0].count);

  if (recentCount >= 5)                           score += 50;
  if (title.trim().length < 10)                   score += 10;
  if (/(.)\1{4,}/.test(title))                    score += 20;
  if (/cheap cheap|buy now buy now/i.test(title)) score += 20;

  return Math.min(score, 100);
};

/* =====================================
   SELLER TRUST RECALCULATION
   Call after product create or on nightly cron.
===================================== */
export const updateSellerTrust = async (sellerId) => {
  const [{ rows: u }, { rows: l }] = await Promise.all([
    pool.query(
      `SELECT verified, total_sales, total_reports FROM users WHERE id = $1`,
      [sellerId]
    ),
    pool.query(
      `SELECT
         COUNT(*) AS total,
         AVG(views) AS avg_views,
         SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) AS recent
       FROM products
       WHERE seller_id = $1 AND fraud_score < 50`,
      [sellerId]
    ),
  ]);

  let score = 50;
  if (u[0]?.verified)                                    score += 30;
  score += Math.min((u[0]?.total_sales   || 0) * 2, 20);
  score -= (u[0]?.total_reports || 0) * 10;
  score += Math.min(Number(l[0]?.total) * 2, 20);
  score += Math.min(Number(l[0]?.avg_views || 0) / 10, 20);
  score += Number(l[0]?.recent) > 10 ? 10 : 0;
  score  = Math.min(Math.max(score, 0), 100);

  await pool.query(
    `UPDATE users SET trust_score = $1 WHERE id = $2`,
    [score, sellerId]
  );
  return score;
};

/* =====================================
   HELPER — resolve user location
   Priority: query params → IP lookup → null
===================================== */
const resolveLocation = async (req) => {
  const { lat, lng, city, state } = req.query;

  if (lat && lng) {
    return {
      lat:   parseFloat(lat),
      lng:   parseFloat(lng),
      city:  city  || null,
      state: state || null,
    };
  }

  const ip  = getClientIP(req);
  const loc = ip ? await getLocationFromIP(ip) : null;

  return loc ?? { lat: null, lng: null, city: city || null, state: state || null };
};

/* =====================================
   HELPER — deduplicate feed by id
===================================== */
const dedup = (rows) => {
  const seen = new Set();
  return rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
};

/* =====================================
   HELPER — light deterministic shuffle
   Mixes a feed without fully randomising it
   (avoids the "full random.sort" antipattern).
===================================== */
const softShuffle = (arr, factor = 0.3) =>
  arr
    .map((item) => ({ item, sort: Math.random() * factor + (1 - factor) }))
    .sort((a, b) => b.sort - a.sort)
    .map(({ item }) => item);

/* ================================================
   HOMEPAGE — smart feed mix
   Slot breakdown (see SLOTS constant at top):
     nearby   40% — hyper-relevant
     trending 25% — real-time engagement
     latest   20% — fresh listings / new seller exposure
     promoted 10% — paid boost
     random    5% — discovery / serendipity

   Fallback chain for nearby slot:
     GPS/IP → same city → same state → global
================================================ */
router.get("/homepage", async (req, res) => {
  try {
    const loc = await resolveLocation(req);

    // ── 1. NEARBY (with 3-tier fallback) ──────────────────────────
    let nearbyRows = [];
    let nearbySource = "global";

    if (loc.lat && loc.lng) {
      const radiusDeg = 0.05; // ~5 km bounding box pre-filter

      const { rows } = await pool.query(
        `
        SELECT ${baseSelect},
          ${haversine("$1", "$2")} AS distance_km
        ${baseJoins}
        ${baseWhere}
          AND p.latitude  BETWEEN $3 AND $4
          AND p.longitude BETWEEN $5 AND $6
          AND p.latitude  IS NOT NULL
        ${baseGroup}
        ORDER BY distance_km ASC, p.boost_score DESC
        LIMIT $7
        `,
        [
          loc.lat, loc.lng,
          loc.lat - radiusDeg, loc.lat + radiusDeg,
          loc.lng - radiusDeg, loc.lng + radiusDeg,
          SLOTS.nearby,
        ]
      );

      nearbyRows   = rows;
      nearbySource = "gps";
    }

    // Fallback: city
    if (nearbyRows.length < 5 && loc.city) {
      const { rows } = await pool.query(
        `
        SELECT ${baseSelect}, NULL AS distance_km
        ${baseJoins}
        ${baseWhere}
          AND p.location_city = $1
        ${baseGroup}
        ORDER BY p.boost_score DESC, p.created_at DESC
        LIMIT $2
        `,
        [loc.city, SLOTS.nearby]
      );
      nearbyRows   = rows;
      nearbySource = "city";
    }

    // Fallback: state
    if (nearbyRows.length < 5 && loc.state) {
      const { rows } = await pool.query(
        `
        SELECT ${baseSelect}, NULL AS distance_km
        ${baseJoins}
        ${baseWhere}
          AND p.location_state = $1
        ${baseGroup}
        ORDER BY p.boost_score DESC, p.created_at DESC
        LIMIT $2
        `,
        [loc.state, SLOTS.nearby]
      );
      nearbyRows   = rows;
      nearbySource = "state";
    }

    // ── 2. TRENDING (Redis → DB) ───────────────────────────────────
    let trendingRows = [];
    const trendingIds = await redis.zRange("trending", 0, SLOTS.trending - 1, {
      REV: true,
    });

    if (trendingIds.length) {
      const { rows } = await pool.query(
        `
        SELECT ${baseSelect}, NULL AS distance_km
        ${baseJoins}
        ${baseWhere}
          AND p.id = ANY($1::uuid[])
        ${baseGroup}
        `,
        [trendingIds]
      );
      const rankMap = Object.fromEntries(trendingIds.map((id, i) => [id, i]));
      trendingRows  = rows.sort((a, b) => rankMap[a.id] - rankMap[b.id]);
    }

    // ── 3. LATEST (fresh listings — new seller exposure) ──────────
    const { rows: latestRows } = await pool.query(
      `
      SELECT ${baseSelect}, NULL AS distance_km
      ${baseJoins}
      ${baseWhere}
      ${baseGroup}
      ORDER BY p.created_at DESC
      LIMIT $1
      `,
      [SLOTS.latest]
    );

    // ── 4. PROMOTED ───────────────────────────────────────────────
    const { rows: promotedRows } = await pool.query(
      `
      SELECT ${baseSelect}, NULL AS distance_km
      ${baseJoins}
      ${baseWhere}
        AND p.is_promoted = true
      ${baseGroup}
      ORDER BY p.boost_score DESC, p.created_at DESC
      LIMIT $1
      `,
      [SLOTS.promoted]
    );

    // ── 5. RANDOM DISCOVERY ───────────────────────────────────────
    const { rows: randomRows } = await pool.query(
      `
      SELECT ${baseSelect}, NULL AS distance_km
      ${baseJoins}
      ${baseWhere}
      ${baseGroup}
      ORDER BY RANDOM()
      LIMIT $1
      `,
      [SLOTS.random]
    );

    // ── 6. MIX + DEDUPLICATE + SOFT SHUFFLE ──────────────────────
    //
    //  Layout before shuffle:
    //    [promoted (pinned top)] → [nearby] → [trending + latest + random interleaved]
    //
    //  Promoted are pinned at the very top (no shuffle) — they paid for it.
    //  The rest gets a soft shuffle so the feed feels organic, not mechanical.

    const body = softShuffle(
      dedup([
        ...nearbyRows,
        ...trendingRows,
        ...latestRows,
        ...randomRows,
      ])
    );

    const feed = dedup([
      ...promotedRows,   // promoted always first
      ...body,
    ]).slice(0, FEED_LIMIT);

    res.json({
      meta: {
        nearbySource, // "gps" | "city" | "state" | "global"  — useful for frontend badge
        location: loc.city || loc.state || null,
      },
      products: feed.map(normalizeProduct),
    });
  } catch (err) {
    console.error("HOMEPAGE ERROR:", err);
    res.status(500).json({ error: "Failed to load homepage" });
  }
});

/* =====================================
   GEO SEARCH — "near me"
   No PostGIS. Uses bounding-box pre-filter
   then Haversine for accurate distance.

   Query params:
     lat, lng   — required (or resolved from IP)
     radius     — kilometres, default 5
     category   — optional category_id filter

   Results: sorted boosted-first within distance,
            then by distance ascending.
===================================== */
router.get("/search/nearby", async (req, res) => {
  try {
    const { radius = 5, category } = req.query;
    const loc = await resolveLocation(req);

    if (!loc.lat || !loc.lng) {
      return res.status(400).json({
        error: "Location required. Send ?lat=&lng= or allow IP detection.",
      });
    }

    const radiusKm  = parseFloat(radius);
    const radiusDeg = radiusKm / 111; // 1° ≈ 111 km

    // Redis cache — avoids hammering the DB for the same tile
    const cacheKey = `nearby:${loc.lat.toFixed(2)}:${loc.lng.toFixed(2)}:${radiusKm}:${category || "all"}`;
    const cached   = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const params = [
      loc.lat, loc.lng,
      loc.lat - radiusDeg, loc.lat + radiusDeg,
      loc.lng - radiusDeg, loc.lng + radiusDeg,
    ];

    const categoryClause = category
      ? `AND p.category_id = $${params.push(category)}`
      : "";

    const limitClause = `LIMIT $${params.push(50)}`;

    const { rows } = await pool.query(
      `
      SELECT ${baseSelect},
        ${haversine("$1", "$2")} AS distance_km
      ${baseJoins}
      ${baseWhere}
        AND p.latitude  BETWEEN $3 AND $4
        AND p.longitude BETWEEN $5 AND $6
        AND p.latitude  IS NOT NULL
        ${categoryClause}
      ${baseGroup}
      HAVING ${haversine("$1", "$2")} <= ${radiusKm}
      ORDER BY
        p.boost_score DESC,
        distance_km   ASC
      ${limitClause}
      `,
      params
    );

    const result = { products: rows.map(normalizeProduct) };

    // Cache for 60 seconds — geo results don't change that fast
    await redis.set(cacheKey, JSON.stringify(result), { EX: CACHE_TTL_S });

    res.json(result);
  } catch (err) {
    console.error("GEO SEARCH ERROR:", err);
    res.status(500).json({ error: "Geo search failed" });
  }
});

/* =====================================
   NEARBY — text fallback (no GPS)
===================================== */
router.get("/nearby", async (req, res) => {
  try {
    const { city, state } = req.query;

    if (!city && !state) {
      return res.status(400).json({ error: "city or state required" });
    }

    const { rows } = await pool.query(
      `
      SELECT ${baseSelect}, NULL AS distance_km
      ${baseJoins}
      ${baseWhere}
        AND (
          ($1::text IS NOT NULL AND p.location_city  = $1) OR
          ($2::text IS NOT NULL AND p.location_state = $2)
        )
      ${baseGroup}
      ORDER BY p.boost_score DESC, p.created_at DESC
      LIMIT 50
      `,
      [city || null, state || null]
    );

    res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("NEARBY ERROR:", err);
    res.status(500).json({ error: "Failed to load nearby listings" });
  }
});

/* =====================================
   TRENDING — Redis-ranked, DB-hydrated
===================================== */
router.get("/trending", async (req, res) => {
  try {
    const trendingIds = await redis.zRange("trending", 0, 49, { REV: true });

    if (!trendingIds.length) {
      const { rows } = await pool.query(
        `
        SELECT ${baseSelect}, NULL AS distance_km
        ${baseJoins}
        ${baseWhere}
        ${baseGroup}
        ORDER BY p.views DESC, p.created_at DESC
        LIMIT 50
        `
      );
      return res.json(rows.map(normalizeProduct));
    }

    const { rows } = await pool.query(
      `
      SELECT ${baseSelect}, NULL AS distance_km
      ${baseJoins}
      ${baseWhere}
        AND p.id = ANY($1::uuid[])
      ${baseGroup}
      `,
      [trendingIds]
    );

    const rankMap = Object.fromEntries(trendingIds.map((id, i) => [id, i]));
    rows.sort((a, b) => rankMap[a.id] - rankMap[b.id]);

    res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("TRENDING ERROR:", err);
    res.status(500).json({ error: "Failed to load trending" });
  }
});

/* =====================================
   DEALS — price cap + recency
===================================== */
router.get("/deals", async (req, res) => {
  try {
    const maxPrice = Number(req.query.maxPrice) || 20000;

    const { rows } = await pool.query(
      `
      SELECT ${baseSelect}, NULL AS distance_km
      ${baseJoins}
      ${baseWhere}
        AND p.price <= $1
      ${baseGroup}
      ORDER BY p.boost_score DESC, p.created_at DESC
      LIMIT 30
      `,
      [maxPrice]
    );

    res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("DEALS ERROR:", err);
    res.status(500).json({ error: "Failed to load deals" });
  }
});

/* =====================================
   SEARCH — full-text + Jiji ranking
===================================== */
router.get("/search", async (req, res) => {
  try {
    const { q, city, state, lat, lng } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: "Query too short" });
    }

    const hasGeo = lat && lng;
    const params = [q.trim(), city || null, state || null];
    if (hasGeo) params.push(parseFloat(lat), parseFloat(lng));

    const geoBoost = hasGeo
      ? `+ CASE
           WHEN ${haversine(`$4`, `$5`)} < 1  THEN 30
           WHEN ${haversine(`$4`, `$5`)} < 5  THEN 15
           ELSE 0
         END`
      : "";

    const { rows } = await pool.query(
      `
      SELECT ${baseSelect},
        NULL AS distance_km,
        ts_rank(p.search_vector, plainto_tsquery('english', $1)) AS text_rank,
        (
          ts_rank(p.search_vector, plainto_tsquery('english', $1)) * 100
          + COALESCE(p.boost_score, 0) * 50
          + GREATEST(0, 100 - EXTRACT(DAY FROM (NOW() - p.created_at)) * 5)
          + CASE
              WHEN p.location_city  = $2 THEN 20
              WHEN p.location_state = $3 THEN 10
              ELSE 0
            END
          + CASE WHEN u.verified = true THEN 10 ELSE 0 END
          ${geoBoost}
        ) AS score

      ${baseJoins}
      ${baseWhere}
        AND p.search_vector @@ plainto_tsquery('english', $1)

      GROUP BY
        p.id, p.slug, p.title, p.description, p.price,
        p.created_at, p.views, p.clicks_count,
        p.is_promoted, p.boost_score,
        p.location_state, p.location_city,
        p.latitude, p.longitude,
        p.seller_id, u.trust_score, u.verified, p.search_vector

      ORDER BY score DESC
      LIMIT 50
      `,
      params
    );

    res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("SEARCH ERROR:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

/* =====================================
   TRACK VIEW — anti-spam (1 per hour per identity)
===================================== */
router.post("/products/:id/view", async (req, res) => {
  const { id }      = req.params;
  const identity    = req.user?.id || req.ip;
  const key         = `view:${id}:${identity}`;

  try {
    const already = await redis.get(key);

    if (!already) {
      await redis.set(key, "1", { EX: 3600 });
      await redis.zIncrBy("trending", 1, id);

      pool
        .query(`UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1`, [id])
        .catch((e) => console.error("View persist failed:", e));
    }

    res.json({ success: true });
  } catch (err) {
    console.error("VIEW ERROR:", err);
    res.status(500).json({ error: "Failed to track view" });
  }
});

/* =====================================
   TRACK CLICK — anti-spam (1 per 5 min), 3x weight
===================================== */
router.post("/products/:id/click", async (req, res) => {
  const { id }   = req.params;
  const identity = req.user?.id || req.ip;
  const key      = `click:${id}:${identity}`;

  try {
    const already = await redis.get(key);

    if (!already) {
      await redis.set(key, "1", { EX: 300 });
      await redis.zIncrBy("trending", 3, id);

      pool
        .query(
          `UPDATE products SET clicks_count = COALESCE(clicks_count, 0) + 1 WHERE id = $1`,
          [id]
        )
        .catch((e) => console.error("Click persist failed:", e));
    }

    res.json({ success: true });
  } catch (err) {
    console.error("CLICK ERROR:", err);
    res.status(500).json({ error: "Failed to track click" });
  }
});

/* =====================================
   HOW TO USE IN YOUR PRODUCT CREATE ROUTE:

   import { detectSpamListing, updateSellerTrust } from "./products.router.js";

   router.post("/products", requireAuth, async (req, res) => {
     const { title, description, price, lat, lng } = req.body;
     const sellerId = req.user.id;

     const fraudScore = await detectSpamListing(sellerId, title);
     if (fraudScore >= 70) {
       return res.status(403).json({ error: "Listing flagged as spam" });
     }

     const { rows } = await pool.query(
       `INSERT INTO products
          (seller_id, title, description, price, fraud_score, latitude, longitude, ...)
        VALUES ($1, $2, $3, $4, $5, $6, $7, ...)
        RETURNING id`,
       [sellerId, title, description, price, fraudScore, lat ?? null, lng ?? null, ...]
     );

     updateSellerTrust(sellerId).catch(console.error); // fire and forget

     res.status(201).json({ id: rows[0].id });
   });

   CLIENT-SIDE — how to call routes:

   // Homepage — GPS location (best)
   GET /api/homepage?lat=6.5244&lng=3.3792

   // Homepage — city name fallback
   GET /api/homepage?city=Lagos&state=Lagos

   // Precise geo search
   GET /api/search/nearby?lat=6.5244&lng=3.3792&radius=5

   // Search with location boost
   GET /api/search?q=iphone&lat=6.5244&lng=3.3792
===================================== */

/* =====================================
   DECAY CRON — copy to /workers/decay.js
   Run as a separate process.

   import { createClient } from "redis";
   const redis = createClient({ url: process.env.REDIS_URL });
   await redis.connect();

   setInterval(async () => {
     const members = await redis.zRangeWithScores("trending", 0, -1);
     for (const { value, score } of members) {
       const next = score * 0.9;
       if (next < 0.5) {
         await redis.zRem("trending", value);
       } else {
         await redis.zAdd("trending", { score: next, value });
       }
     }
     console.log("[decay] done at", new Date().toISOString());
   }, 60 * 60 * 1000);
===================================== */

export { detectSpamListing, updateSellerTrust };
export default router;
