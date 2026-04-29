import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// 🔥 Single ultra-fast homepage query
const HOMEPAGE_QUERY = `
WITH base AS (
  SELECT
    p.id,
    p.slug,
    p.title,
    p.description,
    p.price,
    p.created_at,
    p.views,
    p.clicks_count,
    p.promotion_priority,
    p.location_state,
    p.location_city,
    p.attributes,
    p.delivery,
    p.contact,
    COALESCE(p.media->'images', '[]'::json) AS images,

    -- Smart ranking score
    (
      COALESCE(p.promotion_priority, 0) * 50 +
      COALESCE(p.views, 0) * 2 +
      COALESCE(p.clicks_count, 0) * 5 +
      CASE 
        WHEN p.created_at > NOW() - INTERVAL '7 days' THEN 100
        ELSE 0
      END
    ) AS score

  FROM products p
  WHERE p.is_active = true
    AND p.status = 'active'
  ORDER BY p.promotion_priority DESC, p.created_at DESC
  LIMIT 500
),

ranked AS (
  SELECT *,
    ROW_NUMBER() OVER (ORDER BY score DESC) AS recommended_rank,
    ROW_NUMBER() OVER (ORDER BY price ASC) AS cheap_rank,
    ROW_NUMBER() OVER (ORDER BY views DESC) AS trending_rank,
    ROW_NUMBER() OVER (ORDER BY created_at DESC) AS latest_rank
  FROM base
)

SELECT json_build_object(
  'recommended', COALESCE((
    SELECT json_agg(r) FROM ranked r WHERE recommended_rank <= 24
  ), '[]'::json),

  'cheapDeals', COALESCE((
    SELECT json_agg(r) FROM ranked r WHERE price <= 20000 AND cheap_rank <= 24
  ), '[]'::json),

  'trending', COALESCE((
    SELECT json_agg(r) FROM ranked r WHERE views > 5 AND trending_rank <= 20
  ), '[]'::json),

  'latest', COALESCE((
    SELECT json_agg(r) FROM ranked r WHERE latest_rank <= 30
  ), '[]'::json)
) AS homepage;
`;

// 📦 Normalize response (keeps frontend safe)
const normalizeProduct = (p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  description: p.description || "",
  price: Number(p.price || 0),
  images: Array.isArray(p.images) ? p.images : [],
  attributes: p.attributes || {},
  delivery: p.delivery || {},
  contact: p.contact || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  views: Number(p.views || 0),
  clicks_count: Number(p.clicks_count || 0),
  promotion_priority: Number(p.promotion_priority || 0),
  createdAt: p.created_at,
});

// 🚀 Homepage route
router.get("/homepage", async (req, res) => {
  try {
    const result = await pool.query(HOMEPAGE_QUERY);

    const data = result.rows?.[0]?.homepage || {
      recommended: [],
      cheapDeals: [],
      trending: [],
      latest: [],
    };

    // Normalize all sections
    const response = {
      recommended: (data.recommended || []).map(normalizeProduct),
      cheapDeals: (data.cheapDeals || []).map(normalizeProduct),
      trending: (data.trending || []).map(normalizeProduct),
      latest: (data.latest || []).map(normalizeProduct),
    };

    res.json(response);
  } catch (err) {
    console.error("🔥 HOMEPAGE ERROR:", err);

    res.status(500).json({
      message: "Failed to load homepage",
      error: err.message,
    });
  }
});

export default router;