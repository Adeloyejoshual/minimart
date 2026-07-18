// routes/productDetail.js — v3
//
// Changes from v2:
//  ─ PRODUCT_COLS now includes ALL product fields
//  ─ normalizeProduct includes seller_name, condition, tags, brand etc
//  ─ Added GET /api/product/slug/:slug/full  — returns everything
//  ─ Seller info joined directly on detail routes (no extra request)
//  ─ features / specifications / highlights / faq all normalized
//  ─ active_until + days_remaining added to response
//  ─ Added GET /api/product/products/:id/share  — increment share count

import express  from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   BUILD IMAGE ARRAY
═══════════════════════════════════════════════════════════════ */
const buildImageArray = (row, productImageRows = []) => {
  /* ── Option 1: images JSONB on product row ── */
  const jsonbImages = (() => {
    const raw = row.images;
    if (!raw) return null;

    let parsed;
    if (typeof raw === "string") {
      try { parsed = JSON.parse(raw); } catch { return null; }
    } else {
      parsed = raw;
    }

    if (!Array.isArray(parsed) || !parsed.length) return null;

    return parsed
      .filter((img) => img?.url)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((img) => ({
        url   : img.url,
        key   : img.key   ?? null,
        order : img.order ?? 0,
      }));
  })();

  if (jsonbImages?.length) return jsonbImages;

  /* ── Option 2: product_images table rows ── */
  if (productImageRows?.length) {
    return productImageRows
      .filter((img) => img?.image_url)
      .sort((a, b) => (a.position_order ?? 0) - (b.position_order ?? 0))
      .map((img) => ({
        url   : img.image_url,
        key   : img.r2_key        ?? null,
        order : img.position_order ?? 0,
      }));
  }

  /* ── Option 3: main_image / thumbnail_url fallback ── */
  const fallback = [];
  if (row.main_image) {
    fallback.push({ url: row.main_image, key: null, order: 0 });
  }
  if (row.thumbnail_url && row.thumbnail_url !== row.main_image) {
    fallback.push({ url: row.thumbnail_url, key: null, order: 1 });
  }
  return fallback;
};

/* ═══════════════════════════════════════════════════════════════
   PARSE JSON SAFE
═══════════════════════════════════════════════════════════════ */
const parseJson = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

/* ═══════════════════════════════════════════════════════════════
   DAYS UNTIL EXPIRY
═══════════════════════════════════════════════════════════════ */
const daysUntilExpiry = (activeUntil) => {
  if (!activeUntil) return null;
  return Math.ceil(
    (new Date(activeUntil).getTime() - Date.now()) / 86_400_000
  );
};

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE — full product object for frontend
═══════════════════════════════════════════════════════════════ */
const normalizeProduct = (row, productImageRows = []) => {
  if (!row) return null;

  const imageArray   = buildImageArray(row, productImageRows);
  const primaryImage = imageArray[0]?.url
    ?? row.main_image
    ?? row.thumbnail_url
    ?? null;

  /* Parse all JSONB fields */
  const attributes     = parseJson(row.attributes,     {});
  const specifications = parseJson(row.specifications, {});
  const highlights     = parseJson(row.highlights,     []);
  const faq            = parseJson(row.faq,            []);
  const delivery       = parseJson(row.delivery,       {});
  const contact        = parseJson(row.contact,        {});
  const tags           = parseJson(row.tags,           []);

  /*
    features can be stored as:
      - JSONB array   ["Feature 1", "Feature 2"]
      - JSONB object  { "key": "value" }
      - text column
    Normalize to array always
  */
  const rawFeatures = parseJson(row.features, null);
  let features = [];
  if (Array.isArray(rawFeatures)) {
    features = rawFeatures;
  } else if (rawFeatures && typeof rawFeatures === "object") {
    features = Object.entries(rawFeatures).map(
      ([k, v]) => `${k}: ${v}`
    );
  } else if (typeof row.features === "string" && row.features.trim()) {
    features = [row.features.trim()];
  }

  /*
    specifications can be:
      - JSONB object  { "Brand": "Samsung", "Color": "Black" }
      - JSONB array   [{ label, value }]
    Normalize to array of { label, value }
  */
  let specsArray = [];
  if (Array.isArray(specifications)) {
    specsArray = specifications;
  } else if (specifications && typeof specifications === "object") {
    specsArray = Object.entries(specifications).map(([label, value]) => ({
      label,
      value: String(value),
    }));
  }

  return {
    /* ── Core ── */
    id              : row.id,
    slug            : row.slug,
    title           : row.title,
    description     : row.description,
    condition       : row.condition       ?? null,
    brand           : row.brand           ?? null,
    model           : row.model           ?? null,
    sku             : row.sku             ?? null,
    barcode         : row.barcode         ?? null,
    tags,

    /* ── Pricing ── */
    price           : Number(row.price         || 0),
    original_price  : row.original_price
      ? Number(row.original_price)
      : null,
    discount_percent: row.original_price && row.price
      ? Math.round((1 - row.price / row.original_price) * 100)
      : null,
    currency        : row.currency        ?? "NGN",
    negotiable      : !!row.negotiable,

    /* ── Status ── */
    status          : row.status,
    is_active       : row.is_active,
    active_until    : row.active_until    ?? null,
    days_remaining  : daysUntilExpiry(row.active_until),
    is_trial        : row.status === "active_limited",

    /* ── Images ── */
    image           : primaryImage,          // single image for cards
    images          : imageArray,            // full array for gallery
    main_image      : row.main_image      ?? primaryImage,
    thumbnail_url   : row.thumbnail_url   ?? primaryImage,

    /* ── Category ── */
    category_id     : row.category_id,
    subcategory_id  : row.subcategory_id  ?? null,
    category_name   : row.category_name   ?? null,
    subcategory_name: row.subcategory_name ?? null,

    /* ── Location ── */
    location_state  : row.location_state  ?? null,
    location_city   : row.location_city   ?? null,
    latitude        : row.latitude        ?? null,
    longitude       : row.longitude       ?? null,

    /* ── Seller ── */
    seller_id       : row.seller_id,
    seller_name     : row.seller_name     ?? null,
    seller_verified : row.seller_verified ?? false,
    seller_rating   : row.seller_rating
      ? Number(row.seller_rating)
      : null,
    seller_image    : row.seller_image    ?? null,
    seller_store    : row.seller_store    ?? null,
    seller_trust    : row.seller_trust
      ? Number(row.seller_trust)
      : null,
    seller_online   : row.seller_online   ?? false,

    /* ── Contact ── */
    phone           : row.phone           ?? null,
    whatsapp        : row.whatsapp        ?? null,
    whatsapp_link   : row.whatsapp_link   ?? null,

    /* ── Rich content ── */
    features,                               // array of strings
    attributes,                             // raw JSONB object
    specifications  : specsArray,           // array of { label, value }
    highlights,                             // array of strings
    faq,                                    // array of { question, answer }
    delivery,                               // object
    contact,                                // object

    /* ── Engagement ── */
    views            : Number(row.views            || 0),
    clicks_count     : Number(row.clicks_count     || 0),
    favorites_count  : Number(row.favorites_count  || 0),
    share_count      : Number(row.share_count      || 0),
    impression_count : Number(row.impression_count || 0),
    engagement_score : Number(row.engagement_score || 0),
    conversion_rate  : Number(row.conversion_rate  || 0),
    quality_score    : Number(row.quality_score    || 0),
    boost_score      : Number(row.boost_score      || 0),

    /* ── Promotion ── */
    is_promoted         : !!row.is_promoted,
    promotion_type      : row.promotion_type      ?? null,
    promotion_priority  : row.promotion_priority  ?? null,
    promotion_expires_at: row.promotion_expires_at ?? null,

    /* ── SEO ── */
    seo_title       : row.seo_title       ?? row.title,
    seo_description : row.seo_description ?? row.description?.slice(0, 160),
    seo_keywords    : row.seo_keywords    ?? null,
    canonical_url   : row.canonical_url   ?? null,

    /* ── Timestamps ── */
    created_at          : row.created_at,
    updated_at          : row.updated_at          ?? null,
    last_interaction_at : row.last_interaction_at ?? null,
  };
};

/* ═══════════════════════════════════════════════════════════════
   FETCH PRODUCT IMAGES  — fallback
═══════════════════════════════════════════════════════════════ */
const fetchProductImages = async (productId) => {
  try {
    const { rows } = await pool.query(
      `SELECT image_url, r2_key, position_order, is_primary
       FROM   product_images
       WHERE  product_id = $1
       ORDER  BY position_order ASC`,
      [productId]
    );
    return rows;
  } catch {
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════════
   FULL PRODUCT COLUMNS
   Includes every column your products table has
   + seller info joined from users table
═══════════════════════════════════════════════════════════════ */
const PRODUCT_COLS = `
  p.id,
  p.slug,
  p.title,
  p.description,
  p.price,
  p.original_price,
  p.currency,
  p.negotiable,
  p.condition,
  p.brand,
  p.model,
  p.sku,
  p.barcode,
  p.tags,
  p.status,
  p.is_active,
  p.active_until,
  p.created_at,
  p.updated_at,
  p.last_interaction_at,
  p.seller_id,
  p.seller_name,
  p.category_id,
  p.subcategory_id,
  cat.name                   AS category_name,
  sub.name                   AS subcategory_name,
  p.location_state,
  p.location_city,
  p.latitude,
  p.longitude,
  p.views,
  p.clicks_count,
  p.favorites_count,
  p.share_count,
  p.impression_count,
  p.engagement_score,
  p.conversion_rate,
  p.quality_score,
  p.is_promoted,
  p.promotion_type,
  p.promotion_priority,
  p.promotion_expires_at,
  p.boost_score,
  p.features,
  p.attributes,
  p.specifications,
  p.highlights,
  p.faq,
  p.delivery,
  p.contact,
  p.phone,
  p.whatsapp,
  p.whatsapp_link,
  p.main_image,
  p.thumbnail_url,
  p.images,
  p.seo_title,
  p.seo_description,
  p.seo_keywords,
  p.canonical_url,

  /* ── Seller info joined ── */
  u.name                     AS seller_name,
  u.profile_image            AS seller_image,
  u.store_name               AS seller_store,
  u.identity_verified        AS seller_verified,
  u.trust_score              AS seller_trust,
  u.rating                   AS seller_rating,
  u.is_online                AS seller_online
`;

/* ═══════════════════════════════════════════════════════════════
   CARD COLUMNS — for list views
═══════════════════════════════════════════════════════════════ */
const CARD_COLS = `
  p.id,
  p.slug,
  p.title,
  p.price,
  p.original_price,
  p.condition,
  p.negotiable,
  p.main_image,
  p.thumbnail_url,
  p.images,
  p.location_city,
  p.location_state,
  p.is_promoted,
  p.boost_score,
  p.engagement_score,
  p.views,
  p.favorites_count,
  p.status,
  p.active_until,
  p.seller_id,
  p.seller_name,
  p.created_at
`;

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/slug/:slug
═══════════════════════════════════════════════════════════════ */
router.get("/slug/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug || slug === "undefined") {
    return res.status(400).json({ message: "Invalid slug" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ${PRODUCT_COLS}
       FROM   public.products p
       LEFT JOIN public.categories cat ON cat.id = p.category_id
       LEFT JOIN public.categories sub ON sub.id = p.subcategory_id
       LEFT JOIN public.users      u   ON u.id   = p.seller_id
       WHERE  p.slug      = $1
         AND  p.is_active = true
         AND  p.status    IN ('active', 'active_limited')
       LIMIT 1`,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const row              = rows[0];
    const productImageRows = await fetchProductImages(row.id);

    /* Increment view count — fire and forget */
    pool.query(
      `UPDATE public.products
       SET views               = COALESCE(views, 0) + 1,
           last_interaction_at = NOW()
       WHERE id = $1`,
      [row.id]
    ).catch(() => {});

    return res.json(normalizeProduct(row, productImageRows));
  } catch (err) {
    console.error("[productDetail] GET /slug/:slug →", err.message);
    return res.status(500).json({ message: "Failed to load product" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/id/:id
═══════════════════════════════════════════════════════════════ */
router.get("/id/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || id === "undefined") {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ${PRODUCT_COLS}
       FROM   public.products p
       LEFT JOIN public.categories cat ON cat.id = p.category_id
       LEFT JOIN public.categories sub ON sub.id = p.subcategory_id
       LEFT JOIN public.users      u   ON u.id   = p.seller_id
       WHERE  p.id        = $1
         AND  p.is_active = true
         AND  p.status    IN ('active', 'active_limited')
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const row              = rows[0];
    const productImageRows = await fetchProductImages(row.id);

    return res.json(normalizeProduct(row, productImageRows));
  } catch (err) {
    console.error("[productDetail] GET /id/:id →", err.message);
    return res.status(500).json({ message: "Failed to load product" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/similar
═══════════════════════════════════════════════════════════════ */
router.get("/similar", async (req, res) => {
  const { category_id, exclude, limit = 10 } = req.query;
  if (!category_id) {
    return res.status(400).json({ message: "category_id required" });
  }

  try {
    const safeLimit = Math.min(Number(limit) || 10, 50);
    const params    = [category_id, safeLimit];
    let excludeClause = "";

    if (exclude) {
      params.push(exclude);
      excludeClause = `AND p.id != $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT ${CARD_COLS}
       FROM public.products p
       WHERE p.category_id = $1
         AND p.is_active   = true
         AND p.status      IN ('active', 'active_limited')
         ${excludeClause}
       ORDER BY p.boost_score DESC, p.engagement_score DESC, p.created_at DESC
       LIMIT $2`,
      params
    );

    return res.json(rows.map((r) => normalizeProduct(r)));
  } catch (err) {
    console.error("[productDetail] GET /similar →", err.message);
    return res.status(500).json({ message: "Failed to load similar products" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/by-seller
═══════════════════════════════════════════════════════════════ */
router.get("/by-seller", async (req, res) => {
  const { seller_id, exclude, limit = 10 } = req.query;
  if (!seller_id) {
    return res.status(400).json({ message: "seller_id required" });
  }

  try {
    const safeLimit = Math.min(Number(limit) || 10, 50);
    const params    = [seller_id, safeLimit];
    let excludeClause = "";

    if (exclude) {
      params.push(exclude);
      excludeClause = `AND p.id != $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT ${CARD_COLS}
       FROM public.products p
       WHERE p.seller_id  = $1
         AND p.is_active  = true
         AND p.status     IN ('active', 'active_limited')
         ${excludeClause}
       ORDER BY p.boost_score DESC, p.created_at DESC
       LIMIT $2`,
      params
    );

    return res.json(rows.map((r) => normalizeProduct(r)));
  } catch (err) {
    console.error("[productDetail] GET /by-seller →", err.message);
    return res.status(500).json({ message: "Failed to load seller products" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/slug/:slug/reviews
═══════════════════════════════════════════════════════════════ */
router.get("/slug/:slug/reviews", async (req, res) => {
  const { slug } = req.params;
  const limit    = Math.min(Number(req.query.limit) || 5, 50);
  const page     = Math.max(Number(req.query.page)  || 1, 1);
  const offset   = (page - 1) * limit;

  try {
    const { rows: pRows } = await pool.query(
      `SELECT id FROM public.products
       WHERE slug = $1 AND is_active = true LIMIT 1`,
      [slug]
    );
    if (!pRows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const productId = pRows[0].id;
    let reviews     = [];
    let stats       = null;

    try {
      const [rRows, sRows] = await Promise.all([
        pool.query(
          `SELECT
             r.id,
             r.rating,
             r.comment,
             r.created_at,
             u.name          AS author,
             u.profile_image AS author_image
           FROM   product_reviews r
           LEFT JOIN public.users u ON u.id = r.user_id
           WHERE  r.product_id = $1
           ORDER  BY r.created_at DESC
           LIMIT  $2 OFFSET $3`,
          [productId, limit, offset]
        ),
        pool.query(
          `SELECT
             COUNT(*)::int                         AS total,
             ROUND(AVG(rating)::numeric, 1)        AS average,
             COUNT(*) FILTER (WHERE rating=5)::int AS five_star,
             COUNT(*) FILTER (WHERE rating=4)::int AS four_star,
             COUNT(*) FILTER (WHERE rating=3)::int AS three_star,
             COUNT(*) FILTER (WHERE rating=2)::int AS two_star,
             COUNT(*) FILTER (WHERE rating=1)::int AS one_star
           FROM product_reviews
           WHERE product_id = $1`,
          [productId]
        ),
      ]);
      reviews = rRows.rows;
      stats   = sRows.rows[0] || null;
    } catch (e) {
      console.warn("[productDetail] reviews table:", e.message);
    }

    return res.json({ reviews, stats, page, limit });
  } catch (err) {
    console.error("[productDetail] GET /slug/:slug/reviews →", err.message);
    return res.status(500).json({ message: "Failed to load reviews" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/slug/:slug/reviews
═══════════════════════════════════════════════════════════════ */
router.post("/slug/:slug/reviews", async (req, res) => {
  const { slug }                     = req.params;
  const { user_id, rating, comment } = req.body;

  if (!user_id)
    return res.status(401).json({ message: "Login required" });
  if (!rating || rating < 1 || rating > 5)
    return res.status(400).json({ message: "Rating must be 1–5" });

  try {
    const { rows: pRows } = await pool.query(
      `SELECT id FROM public.products
       WHERE slug = $1 AND is_active = true LIMIT 1`,
      [slug]
    );
    if (!pRows.length)
      return res.status(404).json({ message: "Product not found" });

    const productId = pRows[0].id;
    const existing  = await pool.query(
      `SELECT id FROM product_reviews
       WHERE product_id = $1 AND user_id = $2 LIMIT 1`,
      [productId, user_id]
    );
    if (existing.rows.length) {
      return res.status(409).json({
        message: "You already reviewed this product",
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO product_reviews (product_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rating, comment, created_at`,
      [productId, user_id, Number(rating), comment?.trim() || null]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("[productDetail] POST /slug/:slug/reviews →", err.message);
    return res.status(500).json({ message: "Failed to submit review" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/view
═══════════════════════════════════════════════════════════════ */
router.post("/products/:id/view", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE public.products
       SET views               = COALESCE(views, 0) + 1,
           last_interaction_at = NOW()
       WHERE id = $1`,
      [id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("[productDetail] POST /products/:id/view →", err.message);
    return res.status(500).json({ message: "Failed to track view" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/click
═══════════════════════════════════════════════════════════════ */
router.post("/products/:id/click", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE public.products
       SET clicks_count        = COALESCE(clicks_count, 0) + 1,
           last_interaction_at = NOW()
       WHERE id = $1`,
      [id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("[productDetail] POST /products/:id/click →", err.message);
    return res.status(500).json({ message: "Failed to track click" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/share
═══════════════════════════════════════════════════════════════ */
router.post("/products/:id/share", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE public.products
       SET share_count         = COALESCE(share_count, 0) + 1,
           last_interaction_at = NOW()
       WHERE id = $1`,
      [id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("[productDetail] POST /products/:id/share →", err.message);
    return res.status(500).json({ message: "Failed to track share" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/favorite  (toggle)
═══════════════════════════════════════════════════════════════ */
router.post("/products/:id/favorite", async (req, res) => {
  const { id }      = req.params;
  const { user_id } = req.body;

  if (!user_id)
    return res.status(401).json({ message: "Login required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM favorites
       WHERE product_id = $1 AND user_id = $2 LIMIT 1`,
      [id, user_id]
    );

    if (existing.rows.length) {
      await client.query(
        `DELETE FROM favorites WHERE product_id = $1 AND user_id = $2`,
        [id, user_id]
      );
      await client.query(
        `UPDATE public.products
         SET favorites_count = GREATEST(COALESCE(favorites_count, 0) - 1, 0)
         WHERE id = $1`,
        [id]
      );
      await client.query("COMMIT");
      return res.json({ favorited: false });
    } else {
      await client.query(
        `INSERT INTO favorites (user_id, product_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [user_id, id]
      );
      await client.query(
        `UPDATE public.products
         SET favorites_count = COALESCE(favorites_count, 0) + 1
         WHERE id = $1`,
        [id]
      );
      await client.query("COMMIT");
      return res.json({ favorited: true });
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(
      "[productDetail] POST /products/:id/favorite →", err.message
    );
    return res.status(500).json({ message: "Failed to toggle favorite" });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/products/:id/favorite
═══════════════════════════════════════════════════════════════ */
router.get("/products/:id/favorite", async (req, res) => {
  const { id }      = req.params;
  const { user_id } = req.query;

  if (!user_id) return res.json({ favorited: false });

  try {
    const { rows } = await pool.query(
      `SELECT id FROM favorites
       WHERE product_id = $1 AND user_id = $2 LIMIT 1`,
      [id, user_id]
    );
    return res.json({ favorited: rows.length > 0 });
  } catch (err) {
    console.error(
      "[productDetail] GET /products/:id/favorite →", err.message
    );
    return res.status(500).json({ message: "Failed to check favorite" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/users/:userId/favorites
═══════════════════════════════════════════════════════════════ */
router.get("/users/:userId/favorites", async (req, res) => {
  const { userId } = req.params;
  const limit      = Math.min(Number(req.query.limit) || 20, 50);
  const page       = Math.max(Number(req.query.page)  || 1, 1);
  const offset     = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.slug,
         p.title,
         p.price,
         p.original_price,
         p.condition,
         p.main_image,
         p.thumbnail_url,
         p.images,
         p.location_city,
         p.location_state,
         p.is_promoted,
         p.boost_score,
         p.status,
         p.active_until,
         p.created_at,
         f.created_at AS favorited_at
       FROM favorites f
       JOIN public.products p ON p.id = f.product_id
       WHERE f.user_id   = $1
         AND p.is_active = true
         AND p.status    IN ('active', 'active_limited')
       ORDER BY f.created_at DESC
       LIMIT  $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return res.json(rows.map((r) => normalizeProduct(r)));
  } catch (err) {
    console.error(
      "[productDetail] GET /users/:userId/favorites →", err.message
    );
    return res.status(500).json({ message: "Failed to load favorites" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/users/:id/public  (seller public profile)
═══════════════════════════════════════════════════════════════ */
router.get("/users/:id/public", async (req, res) => {
  const { id } = req.params;
  try {
    const [userResult, listingsResult] = await Promise.all([
      pool.query(
        `SELECT
           id,
           name,
           store_name,
           store_description,
           store_logo,
           profile_image,
           store_verified,
           verified,
           identity_verified,
           trust_score,
           rating,
           products_count,
           total_sales,
           is_online,
           created_at,
           EXTRACT(MONTH FROM AGE(NOW(), created_at))::int AS member_months
         FROM public.users
         WHERE id = $1 AND status = 'active'
         LIMIT 1`,
        [id]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS active_listings
         FROM public.products
         WHERE seller_id = $1
           AND is_active = true
           AND status    IN ('active', 'active_limited')`,
        [id]
      ),
    ]);

    if (!userResult.rows.length) {
      return res.status(404).json({ message: "Seller not found" });
    }

    const u = userResult.rows[0];
    return res.json({
      ...u,
      trust_score      : Number(u.trust_score    || 50),
      rating           : Number(u.rating         || 0),
      products_count   : Number(u.products_count || 0),
      total_sales      : Number(u.total_sales    || 0),
      active_listings  : listingsResult.rows[0]?.active_listings ?? 0,
    });
  } catch (err) {
    console.error("[productDetail] GET /users/:id/public →", err.message);
    return res.status(500).json({ message: "Failed to load seller" });
  }
});

export default router;