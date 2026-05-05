// routes/product.js
import express from "express";
import { pool } from "./sellerprofile.js";

const router = express.Router();

/* ─── SHARED FRAGMENTS ─── */
const IMAGE_AGG = `
  COALESCE(
    json_agg(pi.image_url ORDER BY pi.position_order)
    FILTER (WHERE pi.image_url IS NOT NULL),
    '[]'
  ) AS images
`;

const PRODUCT_COLS = `
  p.id, p.slug, p.title, p.description, p.price,
  p.status, p.is_active, p.created_at, p.updated_at, p.last_interaction_at,
  p.seller_id,
  p.category_id, p.subcategory_id,
  cat.name AS category_name, sub.name AS subcategory_name,
  p.location_state, p.location_city, p.latitude, p.longitude,
  p.views, p.clicks_count, p.favorites_count, p.share_count,
  p.impression_count, p.engagement_score, p.conversion_rate, p.quality_score,
  p.is_promoted, p.promotion_type, p.promotion_priority,
  p.promotion_expires_at, p.boost_score,
  p.attributes, p.specifications, p.highlights, p.faq,
  p.delivery, p.contact, p.phone, p.whatsapp, p.whatsapp_link,
  p.main_image, p.thumbnail_url,
  p.seo_title, p.seo_description, p.seo_keywords, p.canonical_url
`;

const PRODUCT_JOINS = `
  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id
  LEFT JOIN categories cat    ON cat.id = p.category_id
  LEFT JOIN categories sub    ON sub.id = p.subcategory_id
`;

const PRODUCT_GROUP = `
  GROUP BY
    p.id, p.slug, p.title, p.description, p.price,
    p.status, p.is_active, p.created_at, p.updated_at, p.last_interaction_at,
    p.seller_id, p.category_id, p.subcategory_id, cat.name, sub.name,
    p.location_state, p.location_city, p.latitude, p.longitude,
    p.views, p.clicks_count, p.favorites_count, p.share_count,
    p.impression_count, p.engagement_score, p.conversion_rate, p.quality_score,
    p.is_promoted, p.promotion_type, p.promotion_priority,
    p.promotion_expires_at, p.boost_score,
    p.attributes, p.specifications, p.highlights, p.faq,
    p.delivery, p.contact, p.phone, p.whatsapp, p.whatsapp_link,
    p.main_image, p.thumbnail_url,
    p.seo_title, p.seo_description, p.seo_keywords, p.canonical_url
`;

/* Card-only fragment for lists (similar / by-seller) */
const CARD_AGG = `
  COUNT(pr.id)::int                 AS review_count,
  ROUND(AVG(pr.rating)::numeric, 1) AS avg_rating,
  ${IMAGE_AGG}
`;
const CARD_JOINS = `
  LEFT JOIN product_images  pi ON pi.product_id = p.id
  LEFT JOIN product_reviews pr ON pr.product_id = p.id
`;
const CARD_GROUP = `
  GROUP BY
    p.id, p.slug, p.title, p.price,
    p.location_city, p.location_state,
    p.is_promoted, p.boost_score, p.created_at
`;

const normalizeProduct = (row) => {
  if (!row) return null;
  let images = [];
  if (Array.isArray(row.images) && row.images.length) images = row.images.filter(Boolean);
  else if (row.main_image)    images = [row.main_image];
  else if (row.thumbnail_url) images = [row.thumbnail_url];

  const parse = (v) => {
    if (v == null) return v;
    if (typeof v === "string") { try { return JSON.parse(v); } catch { return v; } }
    return v;
  };

  return {
    ...row,
    images,
    attributes:      parse(row.attributes)     || {},
    specifications:  parse(row.specifications) || {},
    highlights:      parse(row.highlights)     || [],
    faq:             parse(row.faq)            || [],
    delivery:        parse(row.delivery)       || {},
    contact:         parse(row.contact)        || {},
    price:           Number(row.price          || 0),
    views:           Number(row.views          || 0),
    clicks_count:    Number(row.clicks_count   || 0),
    favorites_count: Number(row.favorites_count|| 0),
    engagement_score:Number(row.engagement_score||0),
    boost_score:     Number(row.boost_score    || 0),
    quality_score:   Number(row.quality_score  || 0),
  };
};

/* ─────────────────────────────────────────────
   GET /api/product/slug/:slug
───────────────────────────────────────────── */
router.get("/slug/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug || slug === "undefined") return res.status(400).json({ message: "Invalid slug" });

  try {
    const { rows } = await pool.query(
      `SELECT ${PRODUCT_COLS}, ${IMAGE_AGG} ${PRODUCT_JOINS}
       WHERE p.slug = $1 AND p.is_active = true AND p.status = 'active'
       ${PRODUCT_GROUP} LIMIT 1`,
      [slug]
    );
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    return res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("GET /slug/:slug →", err.message);
    return res.status(500).json({ message: "Failed to load product" });
  }
});

/* ─────────────────────────────────────────────
   GET /api/product/id/:id
───────────────────────────────────────────── */
router.get("/id/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT ${PRODUCT_COLS}, ${IMAGE_AGG} ${PRODUCT_JOINS}
       WHERE p.id = $1 AND p.is_active = true AND p.status = 'active'
       ${PRODUCT_GROUP} LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    return res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("GET /id/:id →", err.message);
    return res.status(500).json({ message: "Failed to load product" });
  }
});

/* ─────────────────────────────────────────────
   GET /api/product/similar
   Replaces the old /api/products/similar path.
   Params: category_id, exclude, limit
───────────────────────────────────────────── */
router.get("/similar", async (req, res) => {
  const { category_id, exclude, limit = 10 } = req.query;
  if (!category_id) return res.status(400).json({ message: "category_id required" });

  try {
    const params = exclude
      ? [category_id, Number(limit), exclude]
      : [category_id, Number(limit)];

    const { rows } = await pool.query(
      `SELECT
         p.id, p.slug, p.title, p.price,
         p.location_city, p.location_state,
         p.is_promoted, p.boost_score, p.created_at,
         ${CARD_AGG}
       FROM products p ${CARD_JOINS}
       WHERE p.category_id = $1
         AND p.is_active   = true
         AND p.status      = 'active'
         ${exclude ? "AND p.id != $3" : ""}
       ${CARD_GROUP}
       ORDER BY p.boost_score DESC, p.created_at DESC
       LIMIT $2`,
      params
    );
    return res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("GET /similar →", err.message);
    return res.status(500).json({ message: "Failed to load similar products" });
  }
});

/* ─────────────────────────────────────────────
   GET /api/product/by-seller
   Params: seller_id, exclude, limit
───────────────────────────────────────────── */
router.get("/by-seller", async (req, res) => {
  const { seller_id, exclude, limit = 10 } = req.query;
  if (!seller_id) return res.status(400).json({ message: "seller_id required" });

  try {
    const params = exclude
      ? [seller_id, Number(limit), exclude]
      : [seller_id, Number(limit)];

    const { rows } = await pool.query(
      `SELECT
         p.id, p.slug, p.title, p.price,
         p.location_city, p.location_state,
         p.is_promoted, p.boost_score, p.created_at,
         ${CARD_AGG}
       FROM products p ${CARD_JOINS}
       WHERE p.seller_id = $1
         AND p.is_active = true
         AND p.status    = 'active'
         ${exclude ? "AND p.id != $3" : ""}
       ${CARD_GROUP}
       ORDER BY p.boost_score DESC, p.created_at DESC
       LIMIT $2`,
      params
    );
    return res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("GET /by-seller →", err.message);
    return res.status(500).json({ message: "Failed to load seller products" });
  }
});

/* ─────────────────────────────────────────────
   GET /api/product/slug/:slug/reviews
───────────────────────────────────────────── */
router.get("/slug/:slug/reviews", async (req, res) => {
  const { slug }  = req.params;
  const limit     = Math.min(Number(req.query.limit) || 5, 50);
  const page      = Math.max(Number(req.query.page)  || 1, 1);
  const offset    = (page - 1) * limit;

  try {
    const { rows: pRows } = await pool.query(
      `SELECT id FROM products WHERE slug = $1 AND is_active = true LIMIT 1`,
      [slug]
    );
    if (!pRows.length) return res.status(404).json({ message: "Product not found" });

    const productId = pRows[0].id;
    let reviews = [], stats = null;

    try {
      const [rRows, sRows] = await Promise.all([
        pool.query(
          `SELECT
             r.id, r.rating, r.comment, r.created_at,
             u.name AS author, u.profile_image AS author_image
           FROM product_reviews r
           LEFT JOIN users u ON u.id = r.user_id
           WHERE r.product_id = $1
           ORDER BY r.created_at DESC
           LIMIT $2 OFFSET $3`,
          [productId, limit, offset]
        ),
        pool.query(
          `SELECT
             COUNT(*)::int                          AS total,
             ROUND(AVG(rating)::numeric, 1)         AS average,
             COUNT(*) FILTER (WHERE rating=5)::int  AS five_star,
             COUNT(*) FILTER (WHERE rating=4)::int  AS four_star,
             COUNT(*) FILTER (WHERE rating=3)::int  AS three_star,
             COUNT(*) FILTER (WHERE rating=2)::int  AS two_star,
             COUNT(*) FILTER (WHERE rating=1)::int  AS one_star
           FROM product_reviews WHERE product_id = $1`,
          [productId]
        ),
      ]);
      reviews = rRows.rows;
      stats   = sRows.rows[0] || null;
    } catch { /* table may not exist yet */ }

    return res.json({ reviews, stats, page, limit });
  } catch (err) {
    console.error("GET /slug/:slug/reviews →", err.message);
    return res.status(500).json({ message: "Failed to load reviews" });
  }
});

/* ─────────────────────────────────────────────
   POST /api/product/slug/:slug/reviews
───────────────────────────────────────────── */
router.post("/slug/:slug/reviews", async (req, res) => {
  const { slug }                     = req.params;
  const { user_id, rating, comment } = req.body;

  if (!user_id)                         return res.status(401).json({ message: "Login required" });
  if (!rating || rating < 1 || rating > 5)
    return res.status(400).json({ message: "Rating must be 1–5" });

  try {
    const { rows: pRows } = await pool.query(
      `SELECT id FROM products WHERE slug = $1 AND is_active = true LIMIT 1`,
      [slug]
    );
    if (!pRows.length) return res.status(404).json({ message: "Product not found" });

    const productId = pRows[0].id;

    const existing = await pool.query(
      `SELECT id FROM product_reviews WHERE product_id = $1 AND user_id = $2 LIMIT 1`,
      [productId, user_id]
    );
    if (existing.rows.length)
      return res.status(409).json({ message: "You already reviewed this product" });

    const { rows } = await pool.query(
      `INSERT INTO product_reviews (product_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rating, comment, created_at`,
      [productId, user_id, Number(rating), comment?.trim() || null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /slug/:slug/reviews →", err.message);
    return res.status(500).json({ message: "Failed to submit review" });
  }
});

/* ─────────────────────────────────────────────
   GET /api/product/users/:id/public
───────────────────────────────────────────── */
router.get("/users/:id/public", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, name, store_name, store_description, store_logo,
              profile_image, store_verified, verified, trust_score,
              rating, products_count, total_sales, is_online, created_at,
              EXTRACT(MONTH FROM AGE(NOW(), created_at))::int AS member_months
       FROM users WHERE id = $1 AND status = 'active' LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "Seller not found" });
    const u = rows[0];
    return res.json({
      ...u,
      trust_score:    Number(u.trust_score    || 50),
      rating:         Number(u.rating         || 0),
      products_count: Number(u.products_count || 0),
      total_sales:    Number(u.total_sales    || 0),
    });
  } catch (err) {
    console.error("GET /users/:id/public →", err.message);
    return res.status(500).json({ message: "Failed to load seller" });
  }
});

/* ─────────────────────────────────────────────
   POST /api/products/:id/view
───────────────────────────────────────────── */
router.post("/products/:id/view", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE products
       SET views = COALESCE(views, 0) + 1, last_interaction_at = NOW()
       WHERE id = $1`,
      [id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("POST /products/:id/view →", err.message);
    return res.status(500).json({ message: "Failed to track view" });
  }
});

/* ─────────────────────────────────────────────
   POST /api/products/:id/click
───────────────────────────────────────────── */
router.post("/products/:id/click", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE products
       SET clicks_count = COALESCE(clicks_count, 0) + 1, last_interaction_at = NOW()
       WHERE id = $1`,
      [id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("POST /products/:id/click →", err.message);
    return res.status(500).json({ message: "Failed to track click" });
  }
});

/* ─────────────────────────────────────────────
   GET /api/products/:id/favorite
───────────────────────────────────────────── */
router.get("/products/:id/favorite", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;
  if (!user_id) return res.json({ favorited: false });
  try {
    const { rows } = await pool.query(
      `SELECT id FROM favorites WHERE product_id = $1 AND user_id = $2 LIMIT 1`,
      [id, user_id]
    );
    return res.json({ favorited: rows.length > 0 });
  } catch (err) {
    console.error("GET /products/:id/favorite →", err.message);
    return res.status(500).json({ message: "Failed to check favorite" });
  }
});

/* ─────────────────────────────────────────────
   POST /api/products/:id/favorite  (toggle)
───────────────────────────────────────────── */
router.post("/products/:id/favorite", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  if (!user_id) return res.status(401).json({ message: "Login required" });

  try {
    const existing = await pool.query(
      `SELECT id FROM favorites WHERE product_id = $1 AND user_id = $2 LIMIT 1`,
      [id, user_id]
    );
    if (existing.rows.length) {
      await pool.query(`DELETE FROM favorites WHERE product_id = $1 AND user_id = $2`, [id, user_id]);
      await pool.query(
        `UPDATE products SET favorites_count = GREATEST(COALESCE(favorites_count,0)-1, 0) WHERE id = $1`,
        [id]
      );
      return res.json({ favorited: false });
    } else {
      await pool.query(`INSERT INTO favorites (user_id, product_id) VALUES ($1, $2)`, [user_id, id]);
      await pool.query(
        `UPDATE products SET favorites_count = COALESCE(favorites_count,0)+1 WHERE id = $1`,
        [id]
      );
      return res.json({ favorited: true });
    }
  } catch (err) {
    console.error("POST /products/:id/favorite →", err.message);
    return res.status(500).json({ message: "Failed to toggle favorite" });
  }
});

/* ─────────────────────────────────────────────
   GET /api/product/users/:userId/favorites
───────────────────────────────────────────── */
router.get("/users/:userId/favorites", async (req, res) => {
  const { userId } = req.params;
  const limit  = Math.min(Number(req.query.limit) || 20, 50);
  const page   = Math.max(Number(req.query.page)  || 1, 1);
  const offset = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT
         p.id, p.slug, p.title, p.price,
         p.location_city, p.location_state,
         p.is_promoted, p.boost_score, p.created_at,
         f.created_at AS favorited_at,
         ${IMAGE_AGG}
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       LEFT JOIN product_images pi ON pi.product_id = p.id
       WHERE f.user_id = $1 AND p.is_active = true AND p.status = 'active'
       GROUP BY
         p.id, p.slug, p.title, p.price,
         p.location_city, p.location_state,
         p.is_promoted, p.boost_score, p.created_at, f.created_at
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return res.json(rows.map(normalizeProduct));
  } catch (err) {
    console.error("GET /users/:userId/favorites →", err.message);
    return res.status(500).json({ message: "Failed to load favorites" });
  }
});

export default router;
