import express from "express";
import { pool } from "../config/db.js";     // shared pool — never create a second one
import { createClient } from "redis";
import { getLocationFromIP, getClientIP } from "./location.js";

const router = express.Router();

/* ─── Redis ──────────────────────────────────────────────────────────────────*/

const redis = createClient({ url: process.env.REDIS_URL });
redis.on("error", (err) => console.error("Redis error:", err));
redis.connect().catch(console.error);

/* ─── Constants ──────────────────────────────────────────────────────────────*/

const FEED_LIMIT  = 50;
const CACHE_TTL_S = 60;

const SLOTS = {
  nearby:   15,
  personal: 10,
  trending: 10,
  latest:    8,
  promoted:  5,
  random:    2,
};

/* ─── normalizeProduct ───────────────────────────────────────────────────────
 *
 *  FIX: homepage queries use homepageSelect which has no image aggregation,
 *  so p.images is always null from the DB.  Use thumbnail_url as the primary
 *  image source and wrap it in an array so the frontend img() helper can find
 *  it at images[0].
 */
const normalizeProduct = (p) => ({
  id:            p.id,
  slug:          p.slug,
  title:         p.title,
  description:   p.description,
  price:         Number(p.price  || 0),
  thumbnail_url: p.thumbnail_url || null,
  // Always populate images[] so Homepage img() never gets an empty array
  images: (() => {
    if (Array.isArray(p.images) && p.images.length > 0) return p.images;
    if (p.thumbnail_url) return [p.thumbnail_url];
    if (p.main_image)    return [p.main_image];
    return [];
  })(),
  views:       Number(p.views        || 0),
  clicks_count:Number(p.clicks_count || 0),
  ctr:         Number(p.ctr          || 0),
  is_promoted: Boolean(p.is_promoted),
  boost_score: Number(p.boost_score  || 0),
  location:    { state: p.location_state, city: p.location_city },
  ...(p.distance_km != null && {
    distance_km: Math.round(Number(p.distance_km) * 10) / 10,
  }),
  seller: p.seller_id
    ? {
        id:          p.seller_id,
        trust_score: Number(p.trust_score || 50),
        verified:    Boolean(p.verified),
      }
    : undefined,
  createdAt: p.created_at,
});

/* ─── SQL fragments ──────────────────────────────────────────────────────────
 *
 *  homepageSelect — lightweight, no image aggregation (faster for feed)
 *  fullSelect     — includes image aggregation (used in search)
 *
 *  FIX: baseGroup had `p.ctr` which is a computed expression alias, not a
 *  real column — CockroachDB rejects GROUP BY on aliases.  Removed it;
 *  the expression's operands (clicks_count, views) are already grouped.
 */

const homepageSelect = `
  p.id, p.slug, p.title, p.description, p.price,
  p.thumbnail_url, p.main_image,
  p.created_at, p.views, p.clicks_count,
  (COALESCE(p.clicks_count, 0)::float / NULLIF(p.views, 0)) AS ctr,
  p.is_promoted, p.boost_score,
  p.location_state, p.location_city, p.latitude, p.longitude,
  p.seller_id, u.trust_score, u.verified
`;

const imageAgg = `
  COALESCE(
    json_agg(pi.image_url ORDER BY pi.position_order)
    FILTER (WHERE pi.image_url IS NOT NULL),
    '[]'
  ) AS images
`;

// fullSelect is used in search — includes image aggregation
const fullSelect = `
  p.id, p.slug, p.title, p.description, p.price,
  p.thumbnail_url, p.main_image,
  p.created_at, p.views, p.clicks_count,
  (COALESCE(p.clicks_count, 0)::float / NULLIF(p.views, 0)) AS ctr,
  p.is_promoted, p.boost_score,
  p.location_state, p.location_city, p.latitude, p.longitude,
  p.seller_id, u.trust_score, u.verified,
  ${imageAgg}
`;

const baseJoins = `
  FROM products p
  LEFT JOIN product_images pi ON p.id = pi.product_id
  LEFT JOIN users u            ON p.seller_id = u.id
`;

const baseWhere = `
  WHERE p.is_active  = true
    AND p.status     = 'active'
    AND p.fraud_score < 50
    AND p.seller_id  IS NOT NULL
`;

// FIX: removed p.ctr — it's a computed alias, not a column
const baseGroup = `
  GROUP BY
    p.id, p.slug, p.title, p.description, p.price,
    p.thumbnail_url, p.main_image,
    p.created_at, p.views, p.clicks_count,
    p.is_promoted, p.boost_score,
    p.location_state, p.location_city, p.latitude, p.longitude,
    p.seller_id, u.trust_score, u.verified
`;

// fullGroup includes all columns needed when imageAgg is in SELECT
const fullGroup = baseGroup;

/* ─── Haversine ──────────────────────────────────────────────────────────────*/

const haversine = (latParam, lngParam) => `
  (6371 * 2 * asin(sqrt(
    power(sin(radians((p.latitude - ${latParam}) / 2)), 2) +
    cos(radians(${latParam})) * cos(radians(p.latitude)) *
    power(sin(radians((p.longitude - ${lngParam}) / 2)), 2)
  )))
`;

/* ─── Spam detection ─────────────────────────────────────────────────────────*/

export const detectSpamListing = async (sellerId, title, fingerprint) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS count FROM products
     WHERE seller_id = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
    [sellerId]
  );

  let score = 0;
  const recentCount = Number(rows[0].count);
  if (recentCount >= 5)                    score += 50;
  if (title.trim().length < 10)            score += 10;
  if (/(.)\1{4,}/.test(title))             score += 20;
  if (/cheap cheap|buy now buy now/i.test(title)) score += 20;

  const fpKey   = `spam:${fingerprint}:10m`;
  const fpCount = await redis.incr(fpKey);
  if (fpCount === 1) await redis.expire(fpKey, 600);
  if (fpCount > 3)  score += 30;

  return Math.min(score, 100);
};

/* ─── Seller trust ───────────────────────────────────────────────────────────*/

export const updateSellerTrust = async (sellerId) => {
  const [{ rows: u }, { rows: l }] = await Promise.all([
    pool.query(
      `SELECT verified, total_sales, total_reports FROM users WHERE id = $1`,
      [sellerId]
    ),
    pool.query(
      `SELECT
         COUNT(*)         AS total,
         AVG(views)       AS avg_views,
         SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) AS recent
       FROM products
       WHERE seller_id = $1 AND fraud_score < 50`,
      [sellerId]
    ),
  ]);

  let score = 50;
  if (u[0]?.verified)                               score += 30;
  score += Math.min((u[0]?.total_sales   || 0) * 2, 20);
  score -= (u[0]?.total_reports || 0) * 10;
  score += Math.min(Number(l[0]?.total)           * 2, 20);
  score += Math.min(Number(l[0]?.avg_views || 0) / 10, 20);
  score += Number(l[0]?.recent) > 10 ? 10 : 0;
  score  = Math.min(Math.max(score, 0), 100);

  await pool.query(`UPDATE users SET trust_score = $1 WHERE id = $2`, [score, sellerId]);
  return score;
};

/* ─── Helpers ────────────────────────────────────────────────────────────────*/

const resolveLocation = async (req) => {
  const { lat, lng, city, state } = req.query;
  if (lat && lng) {
    return { lat: parseFloat(lat), lng: parseFloat(lng), city: city || null, state: state || null };
  }
  const ip  = getClientIP(req);
  const loc = ip ? await getLocationFromIP(ip) : null;
  return loc ?? { lat: null, lng: null, city: city || null, state: state || null };
};

const dedup = (rows) => {
  const seen = new Set();
  return rows.filter((r) => !seen.has(r.id) && seen.add(r.id));
};

const softShuffle = (arr, factor = 0.3) =>
  arr
    .map((item) => ({ item, sort: Math.random() * factor + (1 - factor) }))
    .sort((a, b) => b.sort - a.sort)
    .map(({ item }) => item);

/* ─── Query builder ──────────────────────────────────────────────────────────*/

const buildQuery = ({ where = "", order = "", limit, params = [] }) => ({
  text: `
    SELECT ${homepageSelect}, NULL::float AS distance_km
    ${baseJoins}
    ${baseWhere} ${where}
    ${baseGroup}
    ${order}
    LIMIT ${limit}
  `,
  values: params,
});

/* ─── GET /homepage ──────────────────────────────────────────────────────────*/

router.get("/homepage", async (req, res) => {
  try {
    const loc      = await resolveLocation(req);
    const identity = req.user?.id || getClientIP(req);

    /* interests */
    let interests = [];
    try {
      interests = await redis.zRange(`user:interest:${identity}`, 0, 2, { REV: true });
    } catch { /* non-fatal */ }

    /* ── nearby (GPS → city → state) ── */
    let nearby      = [];
    let nearbySource = "global";

    if (loc.lat && loc.lng) {
      const radius = 0.5; // degrees ≈ 55 km
      const { rows } = await pool.query(
        `
        SELECT ${homepageSelect},
               ${haversine("$1", "$2")} AS distance_km
        ${baseJoins}
        ${baseWhere}
          AND p.latitude  BETWEEN $3 AND $4
          AND p.longitude BETWEEN $5 AND $6
        ${baseGroup}
        ORDER BY distance_km ASC, p.boost_score DESC
        LIMIT $7
        `,
        [
          loc.lat, loc.lng,
          loc.lat - radius, loc.lat + radius,
          loc.lng - radius, loc.lng + radius,
          SLOTS.nearby,
        ]
      );
      nearby      = rows;
      nearbySource = "gps";
    }

    if (nearby.length < 5 && loc.city) {
      const q  = buildQuery({
        where:  `AND p.location_city = $1`,
        order:  `ORDER BY p.boost_score DESC, p.created_at DESC`,
        limit:  SLOTS.nearby,
        params: [loc.city],
      });
      nearby      = (await pool.query(q)).rows;
      nearbySource = "city";
    }

    if (nearby.length < 5 && loc.state) {
      const q  = buildQuery({
        where:  `AND p.location_state = $1`,
        order:  `ORDER BY p.boost_score DESC, p.created_at DESC`,
        limit:  SLOTS.nearby,
        params: [loc.state],
      });
      nearby      = (await pool.query(q)).rows;
      nearbySource = "state";
    }

    /* ── personalized ── */
    let personal = [];
    if (interests.length) {
      const q = buildQuery({
        where:  `AND p.category_id = ANY($1::uuid[])`,
        order:  `ORDER BY p.boost_score DESC, p.created_at DESC`,
        limit:  SLOTS.personal,
        params: [interests],
      });
      personal = (await pool.query(q)).rows;
    }

    /* ── trending (from Redis scores) ── */
    let trending = [];
    try {
      let ids = await redis.zUnion(
        ["trending:1h", "trending:24h", "trending:7d"],
        { WEIGHTS: [3, 2, 1] }
      );
      ids = ids.slice(0, SLOTS.trending);

      if (ids.length) {
        const { rows } = await pool.query(
          `
          SELECT ${homepageSelect}, NULL::float AS distance_km
          ${baseJoins}
          ${baseWhere}
            AND p.id = ANY($1::uuid[])
          ${baseGroup}
          `,
          [ids]
        );
        const map = Object.fromEntries(ids.map((id, i) => [id, i]));
        trending  = rows.sort((a, b) => (map[a.id] ?? 99) - (map[b.id] ?? 99));
      }
    } catch { /* non-fatal */ }

    /* ── latest + promoted + random ── */
    const [latest, promoted, random] = await Promise.all([
      pool.query(buildQuery({ order: `ORDER BY p.created_at DESC`, limit: SLOTS.latest }))
          .then((r) => r.rows),

      pool.query(buildQuery({
        where:  `AND p.is_promoted = true`,
        order:  `ORDER BY p.boost_score DESC, p.promotion_priority DESC, p.created_at DESC`,
        limit:  SLOTS.promoted,
      })).then((r) => r.rows),

      pool.query(buildQuery({ where: `AND random() < 0.02`, limit: SLOTS.random }))
          .then((r) => r.rows),
    ]);

    /* ── merge ── */
    const merged = dedup([
      ...promoted,
      ...softShuffle([
        ...nearby,
        ...personal,
        ...trending,
        ...latest,
        ...random,
      ]),
    ]).slice(0, FEED_LIMIT);

    return res.json({
      meta: {
        nearbySource,
        location:  loc.city || loc.state || null,
        interests: interests.length,
      },
      products: merged.map(normalizeProduct),
    });

  } catch (err) {
    console.error("HOMEPAGE ERROR:", err);

    /* hard fallback — never return empty */
    try {
      const { rows } = await pool.query(`
        SELECT ${homepageSelect}, NULL::float AS distance_km
        ${baseJoins}
        ${baseWhere}
        ${baseGroup}
        ORDER BY p.created_at DESC
        LIMIT 20
      `);
      return res.json({
        meta:     { nearbySource: "fallback", location: null, interests: 0 },
        products: rows.map(normalizeProduct),
      });
    } catch (fallbackErr) {
      console.error("FALLBACK ERROR:", fallbackErr);
      return res.status(500).json({ error: "Failed to load homepage" });
    }
  }
});

/* ─── POST /products/:id/click ───────────────────────────────────────────────*/

router.post("/products/:id/click", async (req, res) => {
  const { id }       = req.params;
  const identity     = req.user?.id || getClientIP(req);
  const fingerprint  = `${req.headers["user-agent"]}:${identity}`;
  const key          = `click:${id}:${fingerprint}`;

  try {
    const already = await redis.get(key);
    if (already) return res.json({ success: true });

    await redis.set(key, "1", { EX: 300 });

    await Promise.all([
      redis.zIncrBy("trending:1h",  3, id),
      redis.zIncrBy("trending:24h", 3, id),
      redis.zIncrBy("trending:7d",  3, id),
    ]);

    const { rows } = await pool.query(
      `SELECT category_id FROM products WHERE id = $1`,
      [id]
    );
    if (rows[0]?.category_id) {
      await redis.zIncrBy(`user:interest:${identity}`, 3, rows[0].category_id);
    }

    pool.query(
      `UPDATE products SET clicks_count = COALESCE(clicks_count, 0) + 1 WHERE id = $1`,
      [id]
    ).catch((e) => console.error("Click persist failed:", e));

    return res.json({ success: true });
  } catch (err) {
    console.error("CLICK ERROR:", err);
    return res.status(500).json({ error: "Failed to track click" });
  }
});

/* ─── POST /products/:id/view ────────────────────────────────────────────────*/

router.post("/products/:id/view", async (req, res) => {
  const { id }      = req.params;
  const identity    = req.user?.id || getClientIP(req);
  const fingerprint = `${req.headers["user-agent"]}:${identity}`;
  const key         = `view:${id}:${fingerprint}`;

  try {
    const already = await redis.get(key);
    if (!already) {
      await redis.set(key, "1", { EX: 3600 });
      await Promise.all([
        redis.zIncrBy("trending:1h",  1, id),
        redis.zIncrBy("trending:24h", 1, id),
        redis.zIncrBy("trending:7d",  1, id),
      ]);
      pool.query(
        `UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1`,
        [id]
      ).catch((e) => console.error("View persist failed:", e));
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("VIEW ERROR:", err);
    return res.status(500).json({ error: "Failed to track view" });
  }
});

/* ─── GET /search ────────────────────────────────────────────────────────────*/

router.get("/search", async (req, res) => {
  try {
    const { q, city, state, lat, lng } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: "Query too short" });
    }

    const params  = [q.trim(), city || null, state || null];
    const hasGeo  = lat && lng;
    if (hasGeo) {
      params.push(parseFloat(lat), parseFloat(lng));
    }

    const p4 = hasGeo ? params.length - 1 : null;
    const p5 = hasGeo ? params.length     : null;
    const geoBoost = hasGeo
      ? `+ CASE
           WHEN ${haversine(`$${p4}`, `$${p5}`)} < 1 THEN 30
           WHEN ${haversine(`$${p4}`, `$${p5}`)} < 5 THEN 15
           ELSE 0
         END`
      : "";

    const { rows } = await pool.query(
      `SELECT ${fullSelect}, NULL::float AS distance_km,
        (
          ts_rank(p.search_vector, plainto_tsquery('english', $1)) * 100
          + COALESCE(p.boost_score, 0) * 50
          + EXP(-EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400) * 100
          + (COALESCE(p.clicks_count, 0)::float / NULLIF(p.views, 0)) * 50
          + CASE WHEN p.location_city  = $2 THEN 30
                 WHEN p.location_state = $3 THEN 15
                 ELSE 0 END
          + CASE WHEN u.verified THEN 10 ELSE 0 END
          ${geoBoost}
        ) AS score
       ${baseJoins}
       ${baseWhere}
         AND p.search_vector @@ plainto_tsquery('english', $1)
       ${fullGroup}
       ORDER BY score DESC
       LIMIT 50`,
      params
    );

    return res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("SEARCH ERROR:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

export default router;
