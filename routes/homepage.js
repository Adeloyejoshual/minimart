import express from "express";
import { Pool } from "pg";
import { createClient } from "redis";

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
  // Only present on geo routes
  ...(p.distance_m != null && {
    distance_m: Math.round(Number(p.distance_m)),
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
   SPAM LISTING DETECTION
   Returns fraud score 0–100.
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

  const recentCount = Number(rows[0].count);
  let score = 0;

  if (recentCount >= 5)                          score += 50; // burst posting
  if (title.trim().length < 10)                  score += 10; // too short
  if (/(.)\1{4,}/.test(title))                   score += 20; // "aaaaaaa"
  if (/cheap cheap|buy now buy now/i.test(title)) score += 20;

  return Math.min(score, 100);
};

/* =====================================
   SELLER TRUST RECALCULATION
   Call after product create or on nightly cron.
===================================== */
export const updateSellerTrust = async (sellerId) => {
  // Get seller account signals
  const { rows: userRows } = await pool.query(
    `SELECT verified, total_sales, total_reports FROM users WHERE id = $1`,
    [sellerId]
  );
  const user = userRows[0];

  // Get listing quality signals
  const { rows: listingRows } = await pool.query(
    `SELECT
       COUNT(*)          AS total,
       AVG(views)        AS avg_views,
       SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) AS recent
     FROM products
     WHERE seller_id  = $1
       AND fraud_score < 50`,
    [sellerId]
  );
  const l = listingRows[0];

  let score = 50;

  // Account signals
  if (user?.verified)                                  score += 30;
  score += Math.min((user?.total_sales || 0) * 2, 20);
  score -= (user?.total_reports || 0) * 10;

  // Listing quality signals
  score += Math.min(Number(l.total) * 2, 20);
  score += Math.min(Number(l.avg_views || 0) / 10, 20);
  score += Number(l.recent) > 10 ? 10 : 0;

  score = Math.min(Math.max(score, 0), 100); // clamp 0–100

  await pool.query(
    `UPDATE users SET trust_score = $1 WHERE id = $2`,
    [score, sellerId]
  );

  return score;
};

/* =====================================
   HOMEPAGE
   Ranking formula (pure SQL, one query):
     boost_score * 50           — paid promotion
     recency (decay 5/day)      — freshness
     location match             — city=20, state=10
     engagement                 — views*0.5 + clicks*2
     seller trust               — verified=20, trust*0.2
     fraud filter               — fraud_score >= 50 hidden

   Optional geo boost when ?lat= &lng= are passed:
     < 1km  → +50
     < 5km  → +20
     else   → +0
===================================== */
router.get("/homepage", async (req, res) => {
  try {
    const { city, state, lat, lng } = req.query;
    const hasGeo = lat && lng;

    const { rows } = await pool.query(
      `
      SELECT
        p.id, p.slug, p.title, p.description, p.price,
        p.created_at, p.views, p.clicks_count,
        p.is_promoted, p.boost_score,
        p.location_state, p.location_city,
        p.seller_id, u.trust_score, u.verified,
        ${imageAgg},

        ${
          hasGeo
            ? `ST_Distance(p.geo, ST_SetSRID(ST_MakePoint($3, $4), 4326)) AS distance_m,`
            : "NULL AS distance_m,"
        }

        (
          COALESCE(p.boost_score, 0) * 50

          + GREATEST(0, 100 - EXTRACT(DAY FROM (NOW() - p.created_at)) * 5)

          + CASE
              WHEN p.location_city  = $1 THEN 20
              WHEN p.location_state = $2 THEN 10
              ELSE 0
            END

          + (COALESCE(p.views, 0) * 0.5 + COALESCE(p.clicks_count, 0) * 2)

          + CASE WHEN u.verified = true THEN 20 ELSE 0 END
          + COALESCE(u.trust_score, 50) * 0.2

          ${
            hasGeo
              ? `+ CASE
                   WHEN ST_Distance(p.geo, ST_SetSRID(ST_MakePoint($3, $4), 4326)) < 1000  THEN 50
                   WHEN ST_Distance(p.geo, ST_SetSRID(ST_MakePoint($3, $4), 4326)) < 5000  THEN 20
                   ELSE 0
                 END`
              : ""
          }
        ) AS score

      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      LEFT JOIN users u ON p.seller_id = u.id

      WHERE p.is_active   = true
        AND p.status      = 'active'
        AND p.fraud_score < 50

      GROUP BY
        p.id, p.slug, p.title, p.description, p.price,
        p.created_at, p.views, p.clicks_count,
        p.is_promoted, p.boost_score,
        p.location_state, p.location_city,
        p.seller_id, u.trust_score, u.verified

      ORDER BY score DESC
      LIMIT 50
      `,
      hasGeo
        ? [city || null, state || null, parseFloat(lng), parseFloat(lat)]
        : [city || null, state || null]
    );

    res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("HOMEPAGE ERROR:", err);
    res.status(500).json({ error: "Failed to load homepage" });
  }
});

/* =====================================
   GEO SEARCH — "near me" (PostGIS)
   Required params: ?lat= &lng=
   Optional:        &radius=5000  (metres, default 5km)
                    &category=    (filter by category)

   Distance is returned on each result so the
   client can show "2.3 km away".
===================================== */
router.get("/search/nearby", async (req, res) => {
  try {
    const { lat, lng, radius = 5000, category } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const params = [
      parseFloat(lng),
      parseFloat(lat),
      parseFloat(radius),
    ];

    const categoryClause = category
      ? `AND p.category_id = $${params.push(category)}`
      : "";

    const { rows } = await pool.query(
      `
      SELECT
        p.id, p.slug, p.title, p.price,
        p.created_at, p.location_state, p.location_city,
        p.boost_score, p.seller_id,
        u.trust_score, u.verified,
        ${imageAgg},

        -- Return metres so client can display "1.2 km away"
        ST_Distance(
          p.geo,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)
        ) AS distance_m

      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      LEFT JOIN users u ON p.seller_id = u.id

      WHERE ST_DWithin(
              p.geo,
              ST_SetSRID(ST_MakePoint($1, $2), 4326),
              $3
            )
        AND p.is_active   = true
        AND p.status      = 'active'
        AND p.fraud_score < 50
        AND p.geo IS NOT NULL
        ${categoryClause}

      GROUP BY
        p.id, p.slug, p.title, p.price,
        p.created_at, p.location_state, p.location_city,
        p.boost_score, p.seller_id, u.trust_score, u.verified

      -- Boosted first within same distance bucket, then by proximity
      ORDER BY
        COALESCE(p.boost_score, 0) DESC,
        distance_m ASC

      LIMIT 50
      `,
      params
    );

    res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("GEO SEARCH ERROR:", err);
    res.status(500).json({ error: "Geo search failed" });
  }
});

/* =====================================
   NEARBY — city/state text fallback
   Used when client has no GPS coordinates.
===================================== */
router.get("/nearby", async (req, res) => {
  try {
    const { city, state } = req.query;

    if (!city && !state) {
      return res.status(400).json({ error: "city or state required" });
    }

    const { rows } = await pool.query(
      `
      SELECT
        p.id, p.slug, p.title, p.price, p.created_at,
        p.location_state, p.location_city, p.boost_score,
        p.seller_id, u.trust_score, u.verified,
        ${imageAgg}

      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      LEFT JOIN users u ON p.seller_id = u.id

      WHERE p.is_active   = true
        AND p.status      = 'active'
        AND p.fraud_score < 50
        AND (
          ($1::text IS NOT NULL AND p.location_city  = $1) OR
          ($2::text IS NOT NULL AND p.location_state = $2)
        )

      GROUP BY
        p.id, p.slug, p.title, p.price, p.created_at,
        p.location_state, p.location_city, p.boost_score,
        p.seller_id, u.trust_score, u.verified

      ORDER BY COALESCE(p.boost_score, 0) DESC, p.created_at DESC
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
    if (hasGeo) params.push(parseFloat(lng), parseFloat(lat));

    const { rows } = await pool.query(
      `
      SELECT
        p.id, p.slug, p.title, p.price, p.created_at,
        p.location_state, p.location_city, p.boost_score,
        p.seller_id, u.trust_score, u.verified,
        ${imageAgg},

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
          ${
            hasGeo
              ? `+ CASE
                   WHEN ST_Distance(p.geo, ST_SetSRID(ST_MakePoint($4, $5), 4326)) < 1000 THEN 30
                   WHEN ST_Distance(p.geo, ST_SetSRID(ST_MakePoint($4, $5), 4326)) < 5000 THEN 15
                   ELSE 0
                 END`
              : ""
          }
        ) AS score

      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      LEFT JOIN users u ON p.seller_id = u.id

      WHERE p.search_vector @@ plainto_tsquery('english', $1)
        AND p.is_active   = true
        AND p.status      = 'active'
        AND p.fraud_score < 50

      GROUP BY
        p.id, p.slug, p.title, p.price, p.created_at,
        p.location_state, p.location_city, p.boost_score,
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
   TRENDING — Redis-ranked, DB-hydrated
===================================== */
router.get("/trending", async (req, res) => {
  try {
    const trendingIds = await redis.zRange("trending", 0, 49, { REV: true });

    if (!trendingIds.length) {
      const { rows } = await pool.query(
        `
        SELECT p.id, p.slug, p.title, p.price, p.created_at,
               p.location_state, p.location_city, ${imageAgg}
        FROM products p
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.is_active = true AND p.status = 'active'
          AND p.fraud_score < 50
        GROUP BY p.id, p.slug, p.title, p.price, p.created_at,
                 p.location_state, p.location_city
        ORDER BY p.views DESC, p.created_at DESC
        LIMIT 50
        `
      );
      return res.json(rows.map(normalizeProduct));
    }

    const { rows } = await pool.query(
      `
      SELECT p.id, p.slug, p.title, p.price, p.created_at,
             p.location_state, p.location_city, ${imageAgg}
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = ANY($1::uuid[])
        AND p.is_active = true AND p.status = 'active'
        AND p.fraud_score < 50
      GROUP BY p.id, p.slug, p.title, p.price, p.created_at,
               p.location_state, p.location_city
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
      SELECT p.id, p.slug, p.title, p.price, p.created_at,
             p.location_state, p.location_city, p.boost_score,
             ${imageAgg}
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true AND p.status = 'active'
        AND p.price    <= $1
        AND p.fraud_score < 50
      GROUP BY p.id, p.slug, p.title, p.price, p.created_at,
               p.location_state, p.location_city, p.boost_score
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
   TRACK VIEW — anti-spam (1 per hour per identity)
===================================== */
router.post("/products/:id/view", async (req, res) => {
  const { id } = req.params;
  const identity = req.user?.id || req.ip;
  const key = `view:${id}:${identity}`;

  try {
    const already = await redis.get(key);

    if (!already) {
      await redis.set(key, "1", { EX: 3600 }); // 1 hour window
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
  const { id } = req.params;
  const identity = req.user?.id || req.ip;
  const key = `click:${id}:${identity}`;

  try {
    const already = await redis.get(key);

    if (!already) {
      await redis.set(key, "1", { EX: 300 }); // 5 min window
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
          (seller_id, title, description, price, fraud_score, geo, ...)
        VALUES
          ($1, $2, $3, $4, $5,
           ST_SetSRID(ST_MakePoint($6, $7), 4326),
           ...)
        RETURNING id`,
       [sellerId, title, description, price, fraudScore, lng, lat, ...]
     );

     updateSellerTrust(sellerId).catch(console.error); // fire and forget

     res.status(201).json({ id: rows[0].id });
   });

   CLIENT-SIDE — how to call geo routes:

   // Homepage with location
   GET /api/homepage?city=Lagos&state=Lagos&lat=6.5244&lng=3.3792

   // Precise nearby (GPS)
   GET /api/search/nearby?lat=6.5244&lng=3.3792&radius=3000

   // Search with location boost
   GET /api/search?q=iphone&lat=6.5244&lng=3.3792&city=Lagos
===================================== */

/* =====================================
   DECAY CRON — copy to /workers/decay.js

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
