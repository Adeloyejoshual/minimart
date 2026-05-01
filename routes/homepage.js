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
   CONSTANTS - UPGRADED SLOTS
===================================== */
const FEED_LIMIT = 50;
const CACHE_TTL_S = 60;

const SLOTS = {
  nearby: 15,
  personal: 10,
  trending: 10,
  latest: 8,
  promoted: 5,
  random: 2,
};

/* =====================================
   NORMALIZE PRODUCT - CTR ADDED
===================================== */
const normalizeProduct = (p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  description: p.description,
  price: Number(p.price || 0),
  thumbnail_url: p.thumbnail_url,
  images: Array.isArray(p.images) ? p.images : [],
  views: Number(p.views || 0),
  clicks_count: Number(p.clicks_count || 0),
  ctr: Number(p.ctr || 0),
  is_promoted: Boolean(p.is_promoted),
  boost_score: Number(p.boost_score || 0),
  location: { state: p.location_state, city: p.location_city },
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
   SELECT FRAGMENTS - HOMEPAGE VS FULL
===================================== */
const imageAgg = `
  COALESCE(json_agg(pi.image_url ORDER BY pi.position_order) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
`;

const homepageSelect = `
  p.id, p.slug, p.title, p.description, p.price, p.thumbnail_url,
  p.created_at, p.views, p.clicks_count,
  (COALESCE(p.clicks_count,0)::float / NULLIF(p.views,0)) AS ctr,
  p.is_promoted, p.boost_score,
  p.location_state, p.location_city, p.latitude, p.longitude,
  p.seller_id, u.trust_score, u.verified
`;

const fullSelect = homepageSelect.replace('p.thumbnail_url,', '') + `, ${imageAgg}`;

const baseJoins = `FROM products p LEFT JOIN product_images pi ON p.id = pi.product_id LEFT JOIN users u ON p.seller_id = u.id`;
const baseWhere = `WHERE p.is_active = true AND p.status = 'active' AND p.fraud_score < 50 AND p.seller_id IS NOT NULL`;
const baseGroup = `GROUP BY p.id, p.slug, p.title, p.description, p.price, p.thumbnail_url, p.created_at, p.views, p.clicks_count, p.ctr, p.is_promoted, p.boost_score, p.location_state, p.location_city, p.latitude, p.longitude, p.seller_id, u.trust_score, u.verified`;

/* =====================================
   HAVERSINE
===================================== */
const haversine = (latParam, lngParam) => `
  (6371 * 2 * asin(sqrt(power(sin(radians((p.latitude - ${latParam}) / 2)), 2) + cos(radians(${latParam})) * cos(radians(p.latitude)) * power(sin(radians((p.longitude - ${lngParam}) / 2)), 2))))
`;

/* =====================================
   SPAM DETECTION - FINGERPRINT UPGRADE
===================================== */
const detectSpamListing = async (sellerId, title, fingerprint) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS count FROM products WHERE seller_id = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
    [sellerId]
  );

  let score = 0;
  const recentCount = Number(rows[0].count);
  if (recentCount >= 5) score += 50;
  if (title.trim().length < 10) score += 10;
  if (/(.)\u0001{4,}/.test(title)) score += 20;
  if (/cheap cheap|buy now buy now/i.test(title)) score += 20;

  const fpKey = `spam:${fingerprint}:10m`;
  const fpCount = await redis.incr(fpKey);
  if (fpCount === 1) await redis.expire(fpKey, 600);
  if (fpCount > 3) score += 30;

  return Math.min(score, 100);
};

/* =====================================
   SELLER TRUST
===================================== */
const updateSellerTrust = async (sellerId) => {
  const [{ rows: u }, { rows: l }] = await Promise.all([
    pool.query(`SELECT verified, total_sales, total_reports FROM users WHERE id = $1`, [sellerId]),
    pool.query(
      `SELECT COUNT(*) AS total, AVG(views) AS avg_views, SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) AS recent FROM products WHERE seller_id = $1 AND fraud_score < 50`,
      [sellerId]
    ),
  ]);

  let score = 50;
  if (u[0]?.verified) score += 30;
  score += Math.min((u[0]?.total_sales || 0) * 2, 20);
  score -= (u[0]?.total_reports || 0) * 10;
  score += Math.min(Number(l[0]?.total) * 2, 20);
  score += Math.min(Number(l[0]?.avg_views || 0) / 10, 20);
  score += Number(l[0]?.recent) > 10 ? 10 : 0;
  score = Math.min(Math.max(score, 0), 100);

  await pool.query(`UPDATE users SET trust_score = $1 WHERE id = $2`, [score, sellerId]);
  return score;
};

/* =====================================
   HELPERS
===================================== */
const resolveLocation = async (req) => {
  const { lat, lng, city, state } = req.query;
  if (lat && lng) return { lat: parseFloat(lat), lng: parseFloat(lng), city: city || null, state: state || null };
  const ip = getClientIP(req);
  const loc = ip ? await getLocationFromIP(ip) : null;
  return loc ?? { lat: null, lng: null, city: city || null, state: state || null };
};

const dedup = (rows) => {
  const seen = new Set();
  return rows.filter((r) => !seen.has(r.id) && seen.add(r.id) && true);
};

const softShuffle = (arr, factor = 0.3) =>
  arr.map((item) => ({ item, sort: Math.random() * factor + (1 - factor) }))
    .sort((a, b) => b.sort - a.sort)
    .map(({ item }) => item);

/* =====================================
   HOMEPAGE
===================================== */
router.get("/homepage", async (req, res) => {
  try {
    const loc = await resolveLocation(req);
    const identity = req.user?.id || getClientIP(req);
    const fingerprint = `${req.headers["user-agent"]}:${identity}`;

    let interestCategories = [];
    try {
      interestCategories = await redis.zRange(`user:interest:${identity}`, 0, 2, { REV: true });
    } catch (e) {
      console.error("Personal interests fetch failed:", e);
    }

    let nearbyRows = [];
    let nearbySource = "global";

    if (loc.lat && loc.lng) {
      const radiusDeg = 0.05;
      const { rows } = await pool.query(
        `SELECT ${homepageSelect}, ${haversine("$1", "$2")} AS distance_km ${baseJoins} ${baseWhere} AND p.latitude BETWEEN $3 AND $4 AND p.longitude BETWEEN $5 AND $6 AND p.latitude IS NOT NULL ${baseGroup} ORDER BY distance_km ASC, p.boost_score DESC LIMIT $7`,
        [loc.lat, loc.lng, loc.lat - radiusDeg, loc.lat + radiusDeg, loc.lng - radiusDeg, loc.lng + radiusDeg, SLOTS.nearby]
      );
      nearbyRows = rows;
      nearbySource = "gps";
    }

    if (nearbyRows.length < 5 && loc.city) {
      const { rows } = await pool.query(
        `SELECT ${homepageSelect}, NULL AS distance_km ${baseJoins} ${baseWhere} AND p.location_city = $1 ${baseGroup} ORDER BY p.boost_score DESC, p.created_at DESC LIMIT $2`,
        [loc.city, SLOTS.nearby]
      );
      nearbyRows = rows;
      nearbySource = "city";
    }

    if (nearbyRows.length < 5 && loc.state) {
      const { rows } = await pool.query(
        `SELECT ${homepageSelect}, NULL AS distance_km ${baseJoins} ${baseWhere} AND p.location_state = $1 ${baseGroup} ORDER BY p.boost_score DESC, p.created_at DESC LIMIT $2`,
        [loc.state, SLOTS.nearby]
      );
      nearbyRows = rows;
      nearbySource = "state";
    }

    let personalRows = [];
    if (interestCategories.length > 0) {
      const { rows } = await pool.query(
        `SELECT ${homepageSelect}, NULL AS distance_km ${baseJoins} ${baseWhere} AND p.category_id = ANY($1::uuid[]) ${baseGroup} ORDER BY p.boost_score DESC, p.created_at DESC LIMIT $2`,
        [interestCategories, SLOTS.personal]
      );
      personalRows = rows;
    }

    let trendingIds = [];
    try {
      trendingIds = await redis.zUnion(["trending:1h", "trending:24h", "trending:7d"], { WEIGHTS: [3, 2, 1] });
      trendingIds = trendingIds.slice(0, SLOTS.trending);
    } catch (e) {
      trendingIds = await redis.zRange("trending", 0, SLOTS.trending - 1, { REV: true });
    }

    let trendingRows = [];
    if (trendingIds.length) {
      const { rows } = await pool.query(
        `SELECT ${homepageSelect}, NULL AS distance_km ${baseJoins} ${baseWhere} AND p.id = ANY($1::uuid[]) ${baseGroup}`,
        [trendingIds]
      );
      const rankMap = Object.fromEntries(trendingIds.map((id, i) => [id, i]));
      trendingRows = rows.sort((a, b) => rankMap[a.id] - rankMap[b.id]);
    }

    const [{ rows: latestRows }] = await Promise.all([
      pool.query(`SELECT ${homepageSelect}, NULL AS distance_km ${baseJoins} ${baseWhere} ${baseGroup} ORDER BY p.created_at DESC LIMIT $1`, [SLOTS.latest]),
    ]);

    const promotedRows = await pool.query(
      `SELECT ${homepageSelect}, NULL AS distance_km ${baseJoins} ${baseWhere} AND p.is_promoted = true ${baseGroup} ORDER BY p.boost_score DESC, p.created_at DESC LIMIT $1`,
      [SLOTS.promoted]
    ).then(r => r.rows);

    const randomRows = await pool.query(
      `SELECT ${homepageSelect}, NULL AS distance_km ${baseJoins} ${baseWhere} ${baseGroup} ORDER BY gen_random_uuid() LIMIT $1`,
      [SLOTS.random]
    ).then(r => r.rows);

    const body = softShuffle(dedup([...nearbyRows, ...personalRows, ...trendingRows, ...latestRows, ...randomRows]));
    const feed = dedup([...promotedRows, ...body]).slice(0, FEED_LIMIT);

    res.json({
      meta: {
        nearbySource,
        location: loc.city || loc.state || null,
        interests: interestCategories.length,
      },
      products: feed.map(normalizeProduct),
    });
  } catch (err) {
    console.error("HOMEPAGE ERROR:", err);
    res.status(500).json({ error: "Failed to load homepage" });
  }
});

/* =====================================
   CLICK TRACKING
===================================== */
router.post("/products/:id/click", async (req, res) => {
  const { id } = req.params;
  const identity = req.user?.id || getClientIP(req);
  const fingerprint = `${req.headers["user-agent"]}:${identity}`;
  const key = `click:${id}:${fingerprint}`;

  try {
    const already = await redis.get(key);
    if (already) return res.json({ success: true });

    await redis.set(key, "1", { EX: 300 });

    await Promise.all([
      redis.zIncrBy("trending:1h", 3, id),
      redis.zIncrBy("trending:24h", 3, id),
      redis.zIncrBy("trending:7d", 3, id),
    ]);

    const { rows } = await pool.query(`SELECT category_id FROM products WHERE id = $1`, [id]);
    if (rows[0]?.category_id) {
      await redis.zIncrBy(`user:interest:${identity}`, 3, rows[0].category_id);
    }

    pool.query(`UPDATE products SET clicks_count = COALESCE(clicks_count, 0) + 1 WHERE id = $1`, [id])
      .catch(e => console.error("Click persist failed:", e));

    res.json({ success: true });
  } catch (err) {
    console.error("CLICK ERROR:", err);
    res.status(500).json({ error: "Failed to track click" });
  }
});

/* =====================================
   VIEW TRACKING
===================================== */
router.post("/products/:id/view", async (req, res) => {
  const { id } = req.params;
  const identity = req.user?.id || getClientIP(req);
  const fingerprint = `${req.headers["user-agent"]}:${identity}`;
  const key = `view:${id}:${fingerprint}`;

  try {
    const already = await redis.get(key);
    if (!already) {
      await redis.set(key, "1", { EX: 3600 });
      await Promise.all([
        redis.zIncrBy("trending:1h", 1, id),
        redis.zIncrBy("trending:24h", 1, id),
        redis.zIncrBy("trending:7d", 1, id),
      ]);
      pool.query(`UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1`, [id])
        .catch(e => console.error("View persist failed:", e));
    }
    res.json({ success: true });
  } catch (err) {
    console.error("VIEW ERROR:", err);
    res.status(500).json({ error: "Failed to track view" });
  }
});

/* =====================================
   SEARCH
===================================== */
router.get("/search", async (req, res) => {
  try {
    const { q, city, state, lat, lng } = req.query;
    if (!q || q.trim().length < 2) return res.status(400).json({ error: "Query too short" });

    const params = [q.trim(), city || null, state || null];
    const hasGeo = lat && lng;
    if (hasGeo) params.push(parseFloat(lat), parseFloat(lng));

    const geoBoost = hasGeo
      ? `+ CASE WHEN ${haversine(`$${params.length - 1}`, `$${params.length}`)} < 1 THEN 30 WHEN ${haversine(`$${params.length - 1}`, `$${params.length}`)} < 5 THEN 15 ELSE 0 END`
      : "";

    const { rows } = await pool.query(
      `SELECT ${fullSelect}, NULL AS distance_km,
        (
          ts_rank(p.search_vector, plainto_tsquery('english', $1)) * 100 +
          COALESCE(p.boost_score, 0) * 50 +
          EXP(-EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400) * 100 +
          (COALESCE(p.clicks_count,0)::float / NULLIF(p.views,0)) * 50 +
          CASE WHEN p.location_city = $2 THEN 30 WHEN p.location_state = $3 THEN 15 ELSE 0 END +
          CASE WHEN u.verified THEN 10 ELSE 0 END
          ${geoBoost}
        ) AS score
       ${baseJoins} ${baseWhere} AND p.search_vector @@ plainto_tsquery('english', $1)
       GROUP BY p.id, p.slug, p.title, p.description, p.price, p.created_at, p.views, p.clicks_count, p.is_promoted, p.boost_score, p.location_state, p.location_city, p.latitude, p.longitude, p.seller_id, u.trust_score, u.verified, p.search_vector
       ORDER BY score DESC LIMIT 50`,
      params
    );

    res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("SEARCH ERROR:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

export { detectSpamListing, updateSellerTrust };
export default router;