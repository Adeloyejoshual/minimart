import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= SAFE JSON ================= */
const safeParse = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

/* ================= PRODUCT NORMALIZER ================= */
const normalizeProduct = (p) => ({
  id: p.id,
  title: p.title,
  description: p.description,
  price: Number(p.price || 0),

  location: {
    state: p.location_state ?? null,
    city: p.location_city ?? null,
  },

  images: Array.isArray(p.images) ? p.images : [],

  attributes: safeParse(p.attributes, {}),
  delivery: safeParse(p.delivery, {}),
  contact: safeParse(p.contact, {}),

  is_promoted: Boolean(p.is_promoted),
  created_at: p.created_at,
});

/* ================= BASE QUERY BUILDER ================= */
const baseProductQuery = (extraWhere = "", orderBy = "") => `
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
    p.is_promoted,
    p.promotion_priority,
    p.created_at,

    COALESCE(
      json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL),
      '[]'
    ) AS images

  FROM products p
  LEFT JOIN product_images pi ON p.id = pi.product_id
  WHERE p.is_active = true
  ${extraWhere}
  GROUP BY 
    p.id,
    p.title,
    p.description,
    p.price,
    p.location_state,
    p.location_city,
    p.attributes,
    p.delivery,
    p.contact,
    p.is_promoted,
    p.promotion_priority,
    p.created_at
  ${orderBy}
`;

/* ================= HOMEPAGE ================= */
router.get("/homepage", async (req, res) => {
  try {
    const promotedQuery = baseProductQuery(
      "AND p.is_promoted = true",
      "ORDER BY p.promotion_priority DESC NULLS LAST, p.created_at DESC"
    ) + " LIMIT 10";

    const latestQuery = baseProductQuery(
      "",
      "ORDER BY p.created_at DESC"
    ) + " LIMIT 20";

    const discoverQuery = baseProductQuery(
      "",
      "ORDER BY RANDOM()"
    ) + " LIMIT 10";

    const categoriesQuery = `
      SELECT id, name, parent_id
      FROM categories
      ORDER BY name ASC
    `;

    const [promotedRes, latestRes, discoverRes, categoriesRes] =
      await Promise.all([
        pool.query(promotedQuery),
        pool.query(latestQuery),
        pool.query(discoverQuery),
        pool.query(categoriesQuery),
      ]);

    res.json({
      promoted: promotedRes.rows.map(normalizeProduct),
      latest: latestRes.rows.map(normalizeProduct),
      discover: discoverRes.rows.map(normalizeProduct),
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