// routes/product.js
import express from "express";
import { pool } from "./sellerprofile.js";

const router = express.Router();

/* ─────────────────────────────────────────────
   SHARED FRAGMENTS
───────────────────────────────────────────── */

// Aggregates product_images rows into a sorted JSON array of URL strings.
// Returns [] when no images exist.
const IMAGE_AGG = `
  COALESCE(
    json_agg(pi.image_url ORDER BY pi.position_order)
    FILTER (WHERE pi.image_url IS NOT NULL),
    '[]'
  ) AS images
`;

// All product columns the frontend uses, grouped clearly.
const PRODUCT_COLS = `
  p.id,
  p.slug,
  p.title,
  p.description,
  p.price,
  p.status,
  p.is_active,
  p.created_at,
  p.updated_at,
  p.last_interaction_at,

  -- seller
  p.seller_id,

  -- category
  p.category_id,
  p.subcategory_id,
  cat.name        AS category_name,
  sub.name        AS subcategory_name,

  -- location
  p.location_state,
  p.location_city,
  p.latitude,
  p.longitude,

  -- engagement
  p.views,
  p.clicks_count,
  p.favorites_count,
  p.share_count,
  p.impression_count,
  p.engagement_score,
  p.conversion_rate,
  p.quality_score,

  -- promotion
  p.is_promoted,
  p.promotion_type,
  p.promotion_priority,
  p.promotion_expires_at,
  p.boost_score,

  -- rich content (JSONB)
  p.attributes,
  p.specifications,
  p.highlights,
  p.faq,
  p.delivery,
  p.contact,

  -- contact shortcuts
  p.phone,
  p.whatsapp,
  p.whatsapp_link,

  -- images (from schema columns, fallback only — joined images preferred)
  p.main_image,
  p.thumbnail_url,

  -- seo
  p.seo_title,
  p.seo_description,
  p.seo_keywords,
  p.canonical_url
`;

const PRODUCT_JOINS = `
  FROM products p
  LEFT JOIN product_images pi  ON pi.product_id = p.id
  LEFT JOIN categories cat     ON cat.id = p.category_id
  LEFT JOIN categories sub     ON sub.id = p.subcategory_id
`;

const PRODUCT_GROUP = `
  GROUP BY
    p.id, p.slug, p.title, p.description, p.price,
    p.status, p.is_active, p.created_at, p.updated_at,
    p.last_interaction_at, p.seller_id,
    p.category_id, p.subcategory_id,
    cat.name, sub.name,
    p.location_state, p.location_city,
    p.latitude, p.longitude,
    p.views, p.clicks_count, p.favorites_count,
    p.share_count, p.impression_count,
    p.engagement_score, p.conversion_rate,
    p.quality_score,
    p.is_promoted, p.promotion_type,
    p.promotion_priority, p.promotion_expires_at,
    p.boost_score,
    p.attributes, p.specifications,
    p.highlights, p.faq,
    p.delivery, p.contact,
    p.phone, p.whatsapp, p.whatsapp_link,
    p.main_image, p.thumbnail_url,
    p.seo_title, p.seo_description,
    p.seo_keywords, p.canonical_url
`;

/** Normalise a raw DB row for the frontend. */
const normalizeProduct = (row) => {
  if (!row) return null;

  // images: prefer joined aggregation, fall back to schema columns
  let images = [];
  if (Array.isArray(row.images) && row.images.length) {
    images = row.images.filter(Boolean);
  } else if (row.main_image) {
    images = [row.main_image];
  } else if (row.thumbnail_url) {
    images = [row.thumbnail_url];
  }

  // Parse JSONB fields that CockroachDB might return as strings
  const parse = (v) => {
    if (v == null) return v;
    if (typeof v === "string") {
      try { return JSON.parse(v); } catch { return v; }
    }
    return v;
  };

  return {
    ...row,
    images,
    attributes:     parse(row.attributes)     || {},
    specifications: parse(row.specifications) || {},
    highlights:     parse(row.highlights)     || [],
    faq:            parse(row.faq)            || [],
    delivery:       parse(row.delivery)       || {},
    contact:        parse(row.contact)        || {},
    price:          Number(row.price || 0),
    views:          Number(row.views || 0),
    clicks_count:   Number(row.clicks_count || 0),
    favorites_count:Number(row.favorites_count || 0),
    engagement_score: Number(row.engagement_score || 0),
    boost_score:    Number(row.boost_score || 0),
    quality_score:  Number(row.quality_score || 0),
  };
};

/* ─────────────────────────────────────────────
   GET /api/product/slug/:slug
   Full product detail — all fields, joined images,
   category names, seller_id.
───────────────────────────────────────────── */
router.get("/slug/:slug", async (req, res) => {
  const { slug } = req.params;

  if (!slug || slug === "undefined") {
    return res.status(400).json({ message: "Invalid slug" });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        ${PRODUCT_COLS},
        ${IMAGE_AGG}
      ${PRODUCT_JOINS}
      WHERE p.slug      = $1
        AND p.is_active = true
        AND p.status    = 'active'
      ${PRODUCT_GROUP}
      LIMIT 1
      `,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Async: increment views + update last_interaction without blocking response
    pool.query(
      `UPDATE products
       SET views              = COALESCE(views, 0) + 1,
           last_interaction_at = NOW()
       WHERE id = $1`,
      [rows[0].id]
    ).catch((e) => console.error("View increment failed:", e.message));

    return res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("GET /api/product/slug/:slug →", err.message);
    return res.status(500).json({ message: "Failed to load product" });
  }
});

/* ─────────────────────────────────────────────
   GET /api/product/id/:id
   Same as slug route — used when only id is available.
───────────────────────────────────────────── */
router.get("/id/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        ${PRODUCT_COLS},
        ${IMAGE_AGG}
      ${PRODUCT_JOINS}
      WHERE p.id        = $1
        AND p.is_active = true
        AND p.status    = 'active'
      ${PRODUCT_GROUP}
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("GET /api/product/id/:id →", err.message);
    return res.status(500).json({ message: "Failed to load product" });
  }
});

/* ─────────────────────────────────────────────
   GET /api/products/similar
   Products in same category, excluding current.
   Query params: category_id, exclude (product id), limit
───────────────────────────────────────────── */
router.get("/similar", async (req, res) => {
  const { category_id, exclude, limit = 10 } = req.query;

  if (!category_id) {
    return res.status(400).json({ message: "category_id required" });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        p.id, p.slug, p.title, p.price,
        p.location_city, p.location_state,
        p.is_promoted, p.boost_score,
        p.created_at,
        ${IMAGE_AGG}
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id
      WHERE p.category_id = $1
        AND p.is_active   = true
        AND p.status      = 'active'
        ${exclude ? "AND p.id != $3" : ""}
      GROUP BY
        p.id, p.slug, p.title, p.price,
        p.location_city, p.location_state,
        p.is_promoted, p.boost_score, p.created_at
      ORDER BY p.boost_score DESC, p.created_at DESC
      LIMIT $2
      `,
      exclude
        ? [category_id, Number(limit), exclude]
        : [category_id, Number(limit)]
    );

    return res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("GET /api/products/similar →", err.message);
    return res.status(500).json({ message: "Failed to load similar products" });
  }
});

/* ─────────────────────────────────────────────
   GET /api/product/slug/:slug/reviews
   Returns reviews + aggregate stats for a product.
   Requires a `reviews` table — stub returns empty
   shape if the table doesn't exist yet.
───────────────────────────────────────────── */
router.get("/slug/:slug/reviews", async (req, res) => {
  const { slug }    = req.params;
  const limit       = Math.min(Number(req.query.limit) || 5, 50);

  try {
    // Resolve product id from slug first
    const { rows: productRows } = await pool.query(
      `SELECT id FROM products WHERE slug = $1 AND is_active = true LIMIT 1`,
      [slug]
    );

    if (!productRows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const productId = productRows[0].id;

    // Try to fetch reviews — gracefully return empty if table absent
    let reviews = [];
    let stats   = null;

    try {
      const [reviewRows, statsRows] = await Promise.all([
        pool.query(
          `SELECT
             r.id,
             r.rating,
             r.comment,
             r.created_at,
             u.name   AS author,
             u.profile_image AS author_image
           FROM reviews r
           LEFT JOIN users u ON u.id = r.user_id
           WHERE r.product_id = $1
           ORDER BY r.created_at DESC
           LIMIT $2`,
          [productId, limit]
        ),
        pool.query(
          `SELECT
             COUNT(*)::int          AS total,
             ROUND(AVG(rating), 1)  AS average
           FROM reviews
           WHERE product_id = $1`,
          [productId]
        ),
      ]);

      reviews = reviewRows.rows;
      stats   = statsRows.rows[0] || null;
    } catch {
      // reviews table not yet created — return empty gracefully
    }

    return res.json({ reviews, stats });
  } catch (err) {
    console.error("GET /api/product/slug/:slug/reviews →", err.message);
    return res.status(500).json({ message: "Failed to load reviews" });
  }
});

/* ─────────────────────────────────────────────
   GET /api/users/:id/public
   Public seller profile — no sensitive fields.
───────────────────────────────────────────── */
router.get("/users/:id/public", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT
         id,
         name,
         store_name,
         store_description,
         store_logo,
         profile_image,
         store_verified,
         verified,
         trust_score,
         rating,
         products_count,
         total_sales,
         is_online,
         created_at,
         -- derive member duration in months
         EXTRACT(MONTH FROM AGE(NOW(), created_at))::int AS member_months
       FROM users
       WHERE id = $1
         AND status = 'active'
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Seller not found" });
    }

    const u = rows[0];
    return res.json({
      ...u,
      trust_score:    Number(u.trust_score || 50),
      rating:         Number(u.rating || 0),
      products_count: Number(u.products_count || 0),
      total_sales:    Number(u.total_sales || 0),
    });
  } catch (err) {
    console.error("GET /api/users/:id/public →", err.message);
    return res.status(500).json({ message: "Failed to load seller" });
  }
});

/* ─────────────────────────────────────────────
   POST /api/products/:id/click
   Increments click count + trending signal.
   (View tracking is in products.router.js —
    this endpoint handles click from product detail.)
───────────────────────────────────────────── */
router.post("/products/:id/click", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE products
       SET clicks_count      = COALESCE(clicks_count, 0) + 1,
           last_interaction_at = NOW()
       WHERE id = $1`,
      [id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("POST /api/products/:id/click →", err.message);
    return res.status(500).json({ message: "Failed to track click" });
  }
});

export default router;
