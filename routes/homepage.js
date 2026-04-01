import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= SAFE PARSER ================= */
const safeParse = (val, fallback = {}) => {
  if (!val) return fallback;
  if (typeof val !== "string") return val;

  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};

/* ================= NORMALIZER ================= */
const normalizeProduct = (p) => {
  const media = safeParse(p.media, { images: [], videos: [] });

  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: Number(p.price || 0),

    location: {
      state: p.location_state || null,
      city: p.location_city || null,
    },

    images: Array.isArray(media.images) ? media.images : [],
    videos: Array.isArray(media.videos) ? media.videos : [],

    attributes: safeParse(p.attributes, {}),
    delivery: safeParse(p.delivery, {}),
    contact: safeParse(p.contact, {}),

    is_promoted: Boolean(p.is_promoted),
    promotion_priority: Number(p.promotion_priority || 0),

    created_at: p.created_at,

    // important for frontend logic
    status: p.status,
    is_active: p.is_active,
  };
};

/* ================= BASE QUERY ================= */
const buildQuery = (where = "", order = "") => `
  SELECT
    p.id,
    p.title,
    p.description,
    p.price,
    p.location_state,
    p.location_city,
    p.attributes,
    p.delivery,
    p.contact,
    p.media,
    p.is_promoted,
    p.promotion_priority,
    p.created_at,
    p.status,
    p.is_active
  FROM products p
  WHERE p.is_active = true
    AND p.status = 'approved'
  ${where}
  ${order}
`;

/* ================= HOMEPAGE ================= */
router.get("/homepage", async (req, res) => {
  try {
    const promotedQuery = buildQuery(
      "AND p.is_promoted = true",
      "ORDER BY p.promotion_priority DESC NULLS LAST, p.created_at DESC LIMIT 10"
    );

    const latestQuery = buildQuery(
      "",
      "ORDER BY p.created_at DESC LIMIT 20"
    );

    const cheapQuery = buildQuery(
      "AND COALESCE(p.price, 0)::numeric < 50000",
      "ORDER BY p.created_at DESC LIMIT 10"
    );

    const categoriesQuery = `
      SELECT id, name, parent_id
      FROM categories
      ORDER BY name ASC
    `;

    const [promotedRes, latestRes, cheapRes, categoriesRes] =
      await Promise.all([
        pool.query(promotedQuery),
        pool.query(latestQuery),
        pool.query(cheapQuery),
        pool.query(categoriesQuery),
      ]);

    res.json({
      promoted: promotedRes.rows.map(normalizeProduct),
      latest: latestRes.rows.map(normalizeProduct),
      cheapDeals: cheapRes.rows.map(normalizeProduct),
      categories: categoriesRes.rows,
    });
  } catch (err) {
    console.error("HOMEPAGE ERROR:", err);

    res.status(500).json({
      message: "Failed to load homepage",
    });
  }
});

export default router;