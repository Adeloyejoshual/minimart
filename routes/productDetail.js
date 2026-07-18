/**
 * routes/productDetail.js
 *
 * Mount in server.js as:
 *   app.use("/api/product", productDetailRouter);
 *
 * Real schema — columns confirmed:
 *   NO original_price, NO currency, NO features, NO tags, NO barcode
 *   HAS average_rating, reviews_count, rating_1-5_count (denormalized)
 *   HAS is_deleted, expires_at, active_until, seller_name (on products)
 *   HAS is_p2p, offer_type, swap_for, stock_quantity, stock_status
 */

import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const ACTIVE_STATUSES = `('active', 'active_limited')`;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const parseJson = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

const daysUntilExpiry = (date) => {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
};

const safeInt = (n, fallback = 0) => {
  const parsed = parseInt(n, 10);
  return isNaN(parsed) ? fallback : parsed;
};

const safeFloat = (n, fallback = 0) => {
  const parsed = parseFloat(n);
  return isNaN(parsed) ? fallback : parsed;
};

/* ═══════════════════════════════════════════════════════════════
   BUILD IMAGE ARRAY
   Priority:
     1. images JSONB column on products row
     2. product_images table rows
     3. main_image / thumbnail_url fallback
═══════════════════════════════════════════════════════════════ */
const buildImageArray = (row, productImageRows = []) => {
  /* Option 1 — images JSONB */
  const raw = row.images;
  if (raw) {
    const parsed = parseJson(raw, null);
    if (Array.isArray(parsed) && parsed.length) {
      const mapped = parsed
        .filter((img) => img?.url)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((img) => ({
          url  : img.url,
          key  : img.key   ?? null,
          order: img.order ?? 0,
        }));
      if (mapped.length) return mapped;
    }
  }

  /* Option 2 — product_images table */
  if (productImageRows.length) {
    return productImageRows
      .filter((img) => img?.image_url)
      .sort((a, b) => (a.position_order ?? 0) - (b.position_order ?? 0))
      .map((img) => ({
        url  : img.image_url,
        key  : img.r2_key         ?? null,
        order: img.position_order ?? 0,
      }));
  }

  /* Option 3 — fallback */
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
   NORMALIZE PRODUCT
   Maps a raw DB row → clean frontend object
   Matched exactly to your confirmed schema
═══════════════════════════════════════════════════════════════ */
const normalizeProduct = (row, productImageRows = []) => {
  if (!row) return null;

  const imageArray   = buildImageArray(row, productImageRows);
  const primaryImage = imageArray[0]?.url
    ?? row.main_image
    ?? row.thumbnail_url
    ?? null;

  /* JSONB fields */
  const attributes     = parseJson(row.attributes,     {});
  const specifications = parseJson(row.specifications, {});
  const highlights     = parseJson(row.highlights,     []);
  const faq            = parseJson(row.faq,            []);
  const delivery       = parseJson(row.delivery,       {});
  const contact        = parseJson(row.contact,        {});

  /* Normalize specifications → always array of { label, value } */
  let specsArray = [];
  if (Array.isArray(specifications)) {
    specsArray = specifications.filter(
      (s) => s && (s.label || s.key) && s.value != null
    );
  } else if (specifications && typeof specifications === "object") {
    specsArray = Object.entries(specifications)
      .filter(([, v]) => v != null && String(v).trim() !== "")
      .map(([label, value]) => ({ label, value: String(value) }));
  }

  /*
    features — no DB column, derive from:
      1. attributes.features if it's an array
      2. highlights (they are essentially features)
      3. empty array
  */
  let features = [];
  const attrFeatures = attributes?.features;
  if (Array.isArray(attrFeatures) && attrFeatures.length) {
    features = attrFeatures;
  } else if (Array.isArray(highlights) && highlights.length) {
    features = highlights;
  }

  /*
    active_until — use active_until first, fall back to expires_at
    is_trial     — status === 'active_limited'
  */
  const activeUntil    = row.active_until ?? row.expires_at ?? null;
  const daysRemaining  = daysUntilExpiry(activeUntil);

  /*
    seller_name — products table stores a snapshot (seller_name)
    users JOIN  — gives live name via seller_name_joined
    Prefer live JOIN value, fall back to snapshot
  */
  const sellerName = row.seller_name_joined ?? row.seller_name ?? null;

  return {
    /* ── Identity ── */
    id               : row.id,
    slug             : row.slug,
    title            : row.title            ?? "",
    description      : row.description      ?? null,

    /* ── Product details ── */
    condition        : row.condition        ?? null,
    brand            : row.brand            ?? null,
    model            : row.model            ?? null,
    sku              : row.sku              ?? null,
    negotiable       : !!row.negotiable,
    stock_quantity   : row.stock_quantity   != null ? safeInt(row.stock_quantity) : null,
    stock_status     : row.stock_status     ?? null,
    video_url        : row.video_url        ?? null,

    /* ── P2P / Swap ── */
    is_p2p           : !!row.is_p2p,
    offer_type       : row.offer_type       ?? null,
    swap_for         : row.swap_for         ?? null,

    /* ── Pricing ── */
    price            : safeFloat(row.price, 0),
    original_price   : null,   /* column does not exist */
    discount_percent : null,   /* column does not exist */
    currency         : "NGN",  /* column does not exist — hardcoded */

    /* ── Status ── */
    status           : row.status           ?? null,
    is_active        : !!row.is_active,
    active_until     : activeUntil,
    expires_at       : row.expires_at       ?? null,
    days_remaining   : daysRemaining,
    is_trial         : row.status === "active_limited",
    is_featured      : !!row.is_featured,
    is_first_product : !!row.is_first_product,
    is_deleted       : !!row.is_deleted,
    moderation_status: row.moderation_status ?? null,
    has_active_report: !!row.has_active_report,
    fraud_score      : safeInt(row.fraud_score, 0),
    renewal_count    : safeInt(row.renewal_count, 0),
    search_priority  : row.search_priority  ?? null,

    /* ── Images ── */
    image            : primaryImage,
    images           : imageArray,
    main_image       : row.main_image       ?? primaryImage,
    thumbnail_url    : row.thumbnail_url    ?? primaryImage,

    /* ── Category ── */
    category_id      : row.category_id      ?? null,
    subcategory_id   : row.subcategory_id   ?? null,
    category_name    : row.category_name    ?? null,
    subcategory_name : row.subcategory_name ?? null,

    /* ── Location ── */
    location_state   : row.location_state   ?? null,
    location_city    : row.location_city    ?? null,
    latitude         : row.latitude         ?? null,
    longitude        : row.longitude        ?? null,

    /* ── Seller ── */
    seller_id        : row.seller_id,
    seller_name      : sellerName,
    seller_image     : row.seller_image     ?? null,
    seller_store     : row.seller_store     ?? null,
    seller_verified  : !!row.seller_verified,
    seller_rating    : row.seller_rating    != null ? safeFloat(row.seller_rating) : null,
    seller_trust     : row.seller_trust     != null ? safeFloat(row.seller_trust)  : null,
    seller_online    : !!row.seller_online,

    /* ── Contact ── */
    phone            : row.phone            ?? null,
    whatsapp         : row.whatsapp         ?? null,
    whatsapp_link    : row.whatsapp_link    ?? null,

    /* ── Rich content ── */
    features,
    attributes,
    specifications   : specsArray,
    highlights,
    faq,
    delivery,
    contact,

    /* ── Ratings (denormalized on product row — no JOIN needed) ── */
    average_rating   : safeFloat(row.average_rating, 0),
    reviews_count    : safeInt(row.reviews_count,    0),
    rating_1_count   : safeInt(row.rating_1_count,   0),
    rating_2_count   : safeInt(row.rating_2_count,   0),
    rating_3_count   : safeInt(row.rating_3_count,   0),
    rating_4_count   : safeInt(row.rating_4_count,   0),
    rating_5_count   : safeInt(row.rating_5_count,   0),

    /* ── Engagement ── */
    views            : safeInt(row.views,            0),
    clicks_count     : safeInt(row.clicks_count,     0),
    favorites_count  : safeInt(row.favorites_count,  0),
    share_count      : safeInt(row.share_count,      0),
    impression_count : safeInt(row.impression_count, 0),
    engagement_score : safeInt(row.engagement_score, 0),
    conversion_rate  : safeFloat(row.conversion_rate,0),
    quality_score    : safeInt(row.quality_score,    0),
    boost_score      : safeInt(row.boost_score,      0),

    /* ── Promotion ── */
    is_promoted          : !!row.is_promoted,
    promotion_type       : row.promotion_type       ?? null,
    promotion_priority   : row.promotion_priority   ?? null,
    promotion_expires_at : row.promotion_expires_at ?? null,

    /* ── SEO ── */
    seo_title        : row.seo_title        ?? row.title ?? null,
    seo_description  : row.seo_description  ?? row.description?.slice(0, 160) ?? null,
    seo_keywords     : row.seo_keywords     ?? null,
    canonical_url    : row.canonical_url    ?? null,

    /* ── Timestamps ── */
    created_at          : row.created_at,
    updated_at          : row.updated_at          ?? null,
    last_interaction_at : row.last_interaction_at ?? null,
  };
};

/* ═══════════════════════════════════════════════════════════════
   FETCH PRODUCT IMAGES — fallback table
═══════════════════════════════════════════════════════════════ */
const fetchProductImages = async (productId) => {
  try {
    const { rows } = await pool.query(
      `SELECT image_url, r2_key, position_order, is_primary
       FROM   product_images
       WHERE  product_id = $1
       ORDER  BY position_order ASC, is_primary DESC`,
      [productId]
    );
    return rows;
  } catch {
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════════
   COLUMN SETS
   Matched exactly to your confirmed schema.
   Columns that don't exist use NULL AS aliases.
═══════════════════════════════════════════════════════════════ */

/* Full detail columns — for single product page */
const PRODUCT_COLS = `
  p.id,
  p.slug,
  p.title,
  p.description,
  p.price,
  p.condition,
  p.brand,
  p.model,
  p.sku,
  p.negotiable,
  p.stock_quantity,
  p.stock_status,
  p.video_url,
  p.is_p2p,
  p.offer_type,
  p.swap_for,
  p.status,
  p.is_active,
  p.active_until,
  p.expires_at,
  p.is_featured,
  p.is_first_product,
  p.is_deleted,
  p.moderation_status,
  p.has_active_report,
  p.fraud_score,
  p.renewal_count,
  p.search_priority,
  p.created_at,
  p.updated_at,
  p.last_interaction_at,
  p.seller_id,
  p.seller_name,
  p.category_id,
  p.subcategory_id,
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
  p.boost_score,
  p.is_promoted,
  p.promotion_type,
  p.promotion_priority,
  p.promotion_expires_at,
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
  p.average_rating,
  p.reviews_count,
  p.rating_1_count,
  p.rating_2_count,
  p.rating_3_count,
  p.rating_4_count,
  p.rating_5_count,

  /* ── Columns that do NOT exist — safe NULL aliases ── */
  NULL::numeric   AS original_price,
  NULL::text      AS currency,
  NULL::jsonb     AS features,
  NULL::jsonb     AS tags,
  NULL::text      AS barcode,

  /* ── Category names ── */
  cat.name        AS category_name,
  sub.name        AS subcategory_name,

  /* ── Seller from users JOIN ── */
  u.name               AS seller_name_joined,
  u.profile_image      AS seller_image,
  u.store_name         AS seller_store,
  u.identity_verified  AS seller_verified,
  u.trust_score        AS seller_trust,
  u.rating             AS seller_rating,
  u.is_online          AS seller_online
`;

/* Card columns — for list / grid views */
const CARD_COLS = `
  p.id,
  p.slug,
  p.title,
  p.price,
  p.condition,
  p.negotiable,
  p.main_image,
  p.thumbnail_url,
  p.images,
  p.location_city,
  p.location_state,
  p.is_promoted,
  p.is_featured,
  p.boost_score,
  p.engagement_score,
  p.views,
  p.favorites_count,
  p.average_rating,
  p.reviews_count,
  p.status,
  p.active_until,
  p.expires_at,
  p.seller_id,
  p.seller_name,
  p.created_at,
  NULL::numeric   AS original_price,
  NULL::text      AS currency
`;

/* ═══════════════════════════════════════════════════════════════
   SHARED WHERE CLAUSE — active, not deleted
═══════════════════════════════════════════════════════════════ */
const ACTIVE_WHERE = `
  p.is_active    = true
  AND p.is_deleted IS NOT TRUE
  AND p.status   IN ('active', 'active_limited')
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
       FROM   public.products      p
       LEFT   JOIN public.categories cat ON cat.id = p.category_id
       LEFT   JOIN public.categories sub ON sub.id = p.subcategory_id
       LEFT   JOIN public.users      u   ON u.id   = p.seller_id
       WHERE  p.slug = $1
         AND  ${ACTIVE_WHERE}
       LIMIT  1`,
      [slug]
    );

    if (!rows.length) {
      /* Debug — log exactly why nothing was returned */
      try {
        const { rows: debug } = await pool.query(
          `SELECT id, slug, status, is_active, is_deleted, moderation_status
           FROM   public.products
           WHERE  slug = $1
           LIMIT  1`,
          [slug]
        );
        if (!debug.length) {
          console.warn(`[product/slug] slug not found in DB: "${slug}"`);
        } else {
          const d = debug[0];
          console.warn(
            `[product/slug] "${slug}" exists but filtered —`,
            `status=${d.status}`,
            `is_active=${d.is_active}`,
            `is_deleted=${d.is_deleted}`,
            `moderation=${d.moderation_status}`
          );
        }
      } catch (_) {}

      return res.status(404).json({ message: "Product not found" });
    }

    const row              = rows[0];
    const productImageRows = await fetchProductImages(row.id);

    /* Increment views — fire and forget */
    pool.query(
      `UPDATE public.products
       SET    views               = COALESCE(views, 0) + 1,
              last_interaction_at = NOW()
       WHERE  id = $1`,
      [row.id]
    ).catch(() => {});

    return res.json(normalizeProduct(row, productImageRows));
  } catch (err) {
    console.error(`[product/slug] GET /slug/${slug} →`, err.message);
    console.error(err.stack);
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
       FROM   public.products      p
       LEFT   JOIN public.categories cat ON cat.id = p.category_id
       LEFT   JOIN public.categories sub ON sub.id = p.subcategory_id
       LEFT   JOIN public.users      u   ON u.id   = p.seller_id
       WHERE  p.id = $1
         AND  ${ACTIVE_WHERE}
       LIMIT  1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const row              = rows[0];
    const productImageRows = await fetchProductImages(row.id);
    return res.json(normalizeProduct(row, productImageRows));
  } catch (err) {
    console.error(`[product/id] GET /id/${id} →`, err.message);
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
    const safeLimit = Math.min(safeInt(limit, 10), 50);
    const params    = [category_id, safeLimit];
    let   excludeClause = "";

    if (exclude) {
      params.push(exclude);
      excludeClause = `AND p.id != $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT ${CARD_COLS}
       FROM   public.products p
       WHERE  p.category_id = $1
         AND  ${ACTIVE_WHERE}
         ${excludeClause}
       ORDER  BY p.is_promoted DESC,
                 p.boost_score DESC,
                 p.engagement_score DESC,
                 p.created_at DESC
       LIMIT  $2`,
      params
    );

    return res.json(rows.map((r) => normalizeProduct(r)));
  } catch (err) {
    console.error("[product/similar] →", err.message);
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
    const safeLimit = Math.min(safeInt(limit, 10), 50);
    const params    = [seller_id, safeLimit];
    let   excludeClause = "";

    if (exclude) {
      params.push(exclude);
      excludeClause = `AND p.id != $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT ${CARD_COLS}
       FROM   public.products p
       WHERE  p.seller_id = $1
         AND  ${ACTIVE_WHERE}
         ${excludeClause}
       ORDER  BY p.boost_score DESC,
                 p.created_at DESC
       LIMIT  $2`,
      params
    );

    return res.json(rows.map((r) => normalizeProduct(r)));
  } catch (err) {
    console.error("[product/by-seller] →", err.message);
    return res.status(500).json({ message: "Failed to load seller products" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/slug/:slug/reviews
   Uses denormalized counts from products row for stats
   Fetches actual review rows from product_reviews table
═══════════════════════════════════════════════════════════════ */
router.get("/slug/:slug/reviews", async (req, res) => {
  const { slug }  = req.params;
  const limit     = Math.min(safeInt(req.query.limit, 5),  50);
  const page      = Math.max(safeInt(req.query.page,  1),   1);
  const offset    = (page - 1) * limit;

  try {
    /* Get product — also grab denormalized rating counts */
    const { rows: pRows } = await pool.query(
      `SELECT
         id,
         average_rating,
         reviews_count,
         rating_1_count,
         rating_2_count,
         rating_3_count,
         rating_4_count,
         rating_5_count
       FROM public.products
       WHERE  slug      = $1
         AND  is_active = true
         AND  is_deleted IS NOT TRUE
       LIMIT  1`,
      [slug]
    );

    if (!pRows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const p = pRows[0];

    /* Build stats from denormalized columns — no extra query needed */
    const stats = {
      total    : safeInt(p.reviews_count,   0),
      average  : safeFloat(p.average_rating, 0),
      five_star: safeInt(p.rating_5_count,  0),
      four_star: safeInt(p.rating_4_count,  0),
      three_star: safeInt(p.rating_3_count, 0),
      two_star  : safeInt(p.rating_2_count, 0),
      one_star  : safeInt(p.rating_1_count, 0),
    };

    /* Fetch paginated review rows */
    let reviews = [];
    try {
      const { rows } = await pool.query(
        `SELECT
           r.id,
           r.rating,
           r.comment,
           r.created_at,
           u.name          AS author,
           u.profile_image AS author_image
         FROM   product_reviews r
         LEFT   JOIN public.users u ON u.id = r.user_id
         WHERE  r.product_id = $1
         ORDER  BY r.created_at DESC
         LIMIT  $2 OFFSET $3`,
        [p.id, limit, offset]
      );
      reviews = rows;
    } catch (e) {
      /* product_reviews table may not exist yet */
      console.warn("[product/reviews] table error:", e.message);
    }

    return res.json({ reviews, stats, page, limit });
  } catch (err) {
    console.error(`[product/reviews] GET /slug/${slug}/reviews →`, err.message);
    return res.status(500).json({ message: "Failed to load reviews" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/slug/:slug/reviews
═══════════════════════════════════════════════════════════════ */
router.post("/slug/:slug/reviews", async (req, res) => {
  const { slug }                     = req.params;
  const { user_id, rating, comment } = req.body;

  if (!user_id) {
    return res.status(401).json({ message: "Login required" });
  }
  const ratingNum = safeInt(rating, 0);
  if (ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ message: "Rating must be 1–5" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: pRows } = await client.query(
      `SELECT id FROM public.products
       WHERE  slug      = $1
         AND  is_active = true
         AND  is_deleted IS NOT TRUE
       LIMIT  1`,
      [slug]
    );
    if (!pRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Product not found" });
    }

    const productId = pRows[0].id;

    /* Check duplicate */
    const { rows: existing } = await client.query(
      `SELECT id FROM product_reviews
       WHERE  product_id = $1 AND user_id = $2
       LIMIT  1`,
      [productId, user_id]
    );
    if (existing.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "You already reviewed this product" });
    }

    /* Insert review */
    const { rows: inserted } = await client.query(
      `INSERT INTO product_reviews (product_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rating, comment, created_at`,
      [productId, user_id, ratingNum, comment?.trim() || null]
    );

    /* Update denormalized counts on products row */
    await client.query(
      `UPDATE public.products
       SET
         reviews_count    = COALESCE(reviews_count, 0) + 1,
         rating_${ratingNum}_count = COALESCE(rating_${ratingNum}_count, 0) + 1,
         average_rating   = (
           SELECT ROUND(AVG(rating)::numeric, 2)
           FROM   product_reviews
           WHERE  product_id = $1
         )
       WHERE id = $1`,
      [productId]
    );

    await client.query("COMMIT");
    return res.status(201).json(inserted[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`[product/reviews] POST /slug/${slug}/reviews →`, err.message);
    return res.status(500).json({ message: "Failed to submit review" });
  } finally {
    client.release();
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
       SET    views               = COALESCE(views, 0) + 1,
              last_interaction_at = NOW()
       WHERE  id = $1`,
      [id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error(`[product/view] POST /products/${id}/view →`, err.message);
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
       SET    clicks_count        = COALESCE(clicks_count, 0) + 1,
              last_interaction_at = NOW()
       WHERE  id = $1`,
      [id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error(`[product/click] POST /products/${id}/click →`, err.message);
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
       SET    share_count         = COALESCE(share_count, 0) + 1,
              last_interaction_at = NOW()
       WHERE  id = $1`,
      [id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error(`[product/share] POST /products/${id}/share →`, err.message);
    return res.status(500).json({ message: "Failed to track share" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/product/products/:id/favorite  (toggle)
═══════════════════════════════════════════════════════════════ */
router.post("/products/:id/favorite", async (req, res) => {
  const { id }      = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(401).json({ message: "Login required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existing } = await client.query(
      `SELECT id FROM favorites
       WHERE  product_id = $1 AND user_id = $2
       LIMIT  1`,
      [id, user_id]
    );

    if (existing.length) {
      /* Remove favorite */
      await client.query(
        `DELETE FROM favorites
         WHERE  product_id = $1 AND user_id = $2`,
        [id, user_id]
      );
      await client.query(
        `UPDATE public.products
         SET    favorites_count = GREATEST(COALESCE(favorites_count, 0) - 1, 0)
         WHERE  id = $1`,
        [id]
      );
      await client.query("COMMIT");
      return res.json({ favorited: false });
    }

    /* Add favorite */
    await client.query(
      `INSERT INTO favorites (user_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [user_id, id]
    );
    await client.query(
      `UPDATE public.products
       SET    favorites_count = COALESCE(favorites_count, 0) + 1
       WHERE  id = $1`,
      [id]
    );
    await client.query("COMMIT");
    return res.json({ favorited: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`[product/favorite] POST /products/${id}/favorite →`, err.message);
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
       WHERE  product_id = $1 AND user_id = $2
       LIMIT  1`,
      [id, user_id]
    );
    return res.json({ favorited: rows.length > 0 });
  } catch (err) {
    console.error(`[product/favorite] GET /products/${id}/favorite →`, err.message);
    return res.status(500).json({ message: "Failed to check favorite" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/users/:userId/favorites
═══════════════════════════════════════════════════════════════ */
router.get("/users/:userId/favorites", async (req, res) => {
  const { userId } = req.params;
  const limit      = Math.min(safeInt(req.query.limit, 20), 50);
  const page       = Math.max(safeInt(req.query.page,   1),  1);
  const offset     = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.slug,
         p.title,
         p.price,
         p.condition,
         p.negotiable,
         p.main_image,
         p.thumbnail_url,
         p.images,
         p.location_city,
         p.location_state,
         p.is_promoted,
         p.boost_score,
         p.average_rating,
         p.reviews_count,
         p.status,
         p.active_until,
         p.expires_at,
         p.seller_id,
         p.seller_name,
         p.created_at,
         NULL::numeric  AS original_price,
         NULL::text     AS currency,
         f.created_at   AS favorited_at
       FROM   favorites f
       JOIN   public.products p ON p.id = f.product_id
       WHERE  f.user_id   = $1
         AND  p.is_active = true
         AND  p.is_deleted IS NOT TRUE
         AND  p.status    IN ('active', 'active_limited')
       ORDER  BY f.created_at DESC
       LIMIT  $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.json(rows.map((r) => normalizeProduct(r)));
  } catch (err) {
    console.error(`[product/favorites] GET /users/${userId}/favorites →`, err.message);
    return res.status(500).json({ message: "Failed to load favorites" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/product/users/:id/public
   Seller public profile
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
         FROM   public.users
         WHERE  id     = $1
           AND  status = 'active'
         LIMIT  1`,
        [id]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS active_listings
         FROM   public.products
         WHERE  seller_id  = $1
           AND  is_active  = true
           AND  is_deleted IS NOT TRUE
           AND  status     IN ('active', 'active_limited')`,
        [id]
      ),
    ]);

    if (!userResult.rows.length) {
      return res.status(404).json({ message: "Seller not found" });
    }

    const u = userResult.rows[0];
    return res.json({
      ...u,
      trust_score    : safeFloat(u.trust_score,    50),
      rating         : safeFloat(u.rating,          0),
      products_count : safeInt(u.products_count,    0),
      total_sales    : safeInt(u.total_sales,        0),
      active_listings: listingsResult.rows[0]?.active_listings ?? 0,
    });
  } catch (err) {
    console.error(`[product/seller] GET /users/${id}/public →`, err.message);
    return res.status(500).json({ message: "Failed to load seller" });
  }
});

export default router;