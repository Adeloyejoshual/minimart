import express from "express";
import { pool } from "../../server.js";

const router = express.Router();

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const VALID_CATEGORIES = new Set([
  "electronics", "fashion", "food", "home",
  "beauty", "sports", "books", "toys",
]);

const VALID_CONDITIONS = new Set(["new", "used", "refurbished"]);

const SORT_MAP = {
  newest:     "p.created_at DESC",
  price_asc:  "p.price ASC",
  price_desc: "p.price DESC",
  popular:    "p.view_count DESC NULLS LAST, p.created_at DESC",
};

const PAGE_SIZE_MAX = 100;
const PAGE_SIZE_DEFAULT = 20;

/* ══════════════════════════════════════════════
   HELPER — safe positive integer
══════════════════════════════════════════════ */
function posInt(val, fallback) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/* ══════════════════════════════════════════════
   GET /api/market-products
   Query params:
     page       – page number (default 1)
     limit      – items per page (default 20, max 100)
     search     – full-text / ILIKE search
     category   – one of VALID_CATEGORIES
     condition  – new | used | refurbished
     minPrice   – number
     maxPrice   – number
     sort       – newest | price_asc | price_desc | popular
══════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  try {
    const {
      page      = 1,
      limit     = PAGE_SIZE_DEFAULT,
      search    = "",
      category  = "",
      condition = "",
      minPrice  = "",
      maxPrice  = "",
      sort      = "newest",
    } = req.query;

    /* ── pagination ── */
    const take = Math.min(posInt(limit, PAGE_SIZE_DEFAULT), PAGE_SIZE_MAX);
    const skip = (posInt(page, 1) - 1) * take;

    /* ── build WHERE clauses ── */
    const conditions = [
      "p.status    = 'active'",
      "p.is_active = true",
      "p.is_hidden = false",
    ];
    const params = [];
    let idx = 1;

    /* search — match against name + description */
    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(p.name ILIKE $${idx} OR p.description ILIKE $${idx})`
      );
      idx++;
    }

    /* category */
    if (category && VALID_CATEGORIES.has(category)) {
      params.push(category);
      conditions.push(`p.category = $${idx++}`);
    }

    /* condition */
    if (condition && VALID_CONDITIONS.has(condition)) {
      params.push(condition);
      conditions.push(`p.condition = $${idx++}`);
    }

    /* price range */
    if (minPrice !== "" && !isNaN(Number(minPrice))) {
      params.push(Number(minPrice));
      conditions.push(`p.price >= $${idx++}`);
    }
    if (maxPrice !== "" && !isNaN(Number(maxPrice))) {
      params.push(Number(maxPrice));
      conditions.push(`p.price <= $${idx++}`);
    }

    const whereSQL = conditions.join(" AND ");
    const orderSQL = SORT_MAP[sort] ?? SORT_MAP.newest;

    /* ── count query (total matching rows) ── */
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) ::INT AS total
       FROM market.products p
       WHERE ${whereSQL}`,
      params
    );
    const total = countRows[0]?.total ?? 0;

    /* ── main query ── */
    const { rows: products } = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.description,
         p.category,
         p.condition,
         p.price,
         p.original_price  AS "originalPrice",
         p.negotiable,
         p.phone,
         p.status,
         p.is_featured     AS "isFeatured",
         p.is_trending     AS "isTrending",
         p.is_sponsored    AS "isSponsored",
         p.slug,
         p.view_count      AS "viewCount",
         p.created_at      AS "createdAt",
         u.id              AS "sellerId",
         u.name            AS "sellerName",
         u.phone_number    AS "sellerPhone"
       FROM market.products p
       LEFT JOIN public.users u ON u.id = p.user_id
       WHERE ${whereSQL}
       ORDER BY ${orderSQL}
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, take, skip]
    );

    /* ── bulk-fetch cover images for this page ── */
    let imageMap = {};
    if (products.length) {
      const productIds  = products.map((p) => p.id);
      const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");

      const { rows: imgRows } = await pool.query(
        `SELECT DISTINCT ON (product_id)
           product_id,
           image_url
         FROM market.product_images
         WHERE product_id IN (${placeholders})
         ORDER BY product_id, is_primary DESC, sort_order ASC`,
        productIds
      );

      imageMap = imgRows.reduce((acc, row) => {
        acc[row.product_id] = row.image_url;
        return acc;
      }, {});
    }

    /* ── shape response to match what MinimartPage expects ── */
    /*
      ProductCard reads:
        product.images[]          → array of URL strings (uses images[0] as cover)
        product.name
        product.price
        product.originalPrice
        product.condition
        product.slug ?? product.id
        product.location          (optional)
        product.seller.rating     (optional)
        product.seller.name       (optional)
    */
    const shaped = products.map((p) => ({
      id:            p.id,
      slug:          p.slug ?? null,
      name:          p.name,
      description:   p.description,
      category:      p.category,
      condition:     p.condition,
      price:         p.price,
      originalPrice: p.originalPrice ?? null,
      negotiable:    p.negotiable ?? false,
      phone:         p.phone ?? null,
      isFeatured:    p.isFeatured,
      isTrending:    p.isTrending,
      isSponsored:   p.isSponsored,
      viewCount:     p.viewCount ?? 0,
      createdAt:     p.createdAt,
      /* images array — ProductCard uses images[0] as cover */
      images: imageMap[p.id] ? [imageMap[p.id]] : [],
      /* seller object */
      seller: {
        id:     p.sellerId   ?? null,
        name:   p.sellerName ?? null,
        phone:  p.sellerPhone ?? null,
        rating: 0,            // extend later with a ratings table join
      },
    }));

    /* ── respond ── */
    return res.json({
      products: shaped,
      total,
      page:  posInt(page, 1),
      limit: take,
    });

  } catch (err) {
    console.error("[GET /api/market-products]", err.message);
    return res.status(500).json({ error: "Failed to fetch products." });
  }
});

/* ══════════════════════════════════════════════
   GET /api/market-products/:slug
   Single public product detail page
   Accepts a UUID id  OR  a human-readable slug
══════════════════════════════════════════════ */
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    /* try UUID first, then slug column */
    const isUUID = /^[0-9a-f-]{36}$/i.test(slug);
    const { rows } = await pool.query(
      `SELECT
         p.*,
         u.id           AS "sellerId",
         u.name         AS "sellerName",
         u.phone_number AS "sellerPhone"
       FROM market.products p
       LEFT JOIN public.users u ON u.id = p.user_id
       WHERE p.status = 'active'
         AND p.is_active = true
         AND p.is_hidden = false
         AND (${isUUID ? "p.id = $1" : "p.slug = $1"})`,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Product not found." });
    }

    const p = rows[0];

    /* bump view count — fire and forget */
    pool
      .query(
        `UPDATE market.products
         SET view_count = COALESCE(view_count, 0) + 1
         WHERE id = $1`,
        [p.id]
      )
      .catch(() => {});

    /* fetch related tables in parallel */
    const [images, variants, features, specs, boxItems] = await Promise.all([
      pool.query(
        `SELECT image_url, public_id, is_primary, sort_order
         FROM market.product_images
         WHERE product_id = $1
         ORDER BY is_primary DESC, sort_order ASC`,
        [p.id]
      ),
      pool.query(
        `SELECT id, sku, name, price, stock, attributes
         FROM market.product_variants
         WHERE product_id = $1
         ORDER BY created_at`,
        [p.id]
      ),
      pool.query(
        `SELECT feature
         FROM market.product_features
         WHERE product_id = $1
         ORDER BY sort_order`,
        [p.id]
      ),
      pool.query(
        `SELECT spec_key, spec_value
         FROM market.product_specifications
         WHERE product_id = $1
         ORDER BY sort_order`,
        [p.id]
      ),
      pool.query(
        `SELECT item
         FROM market.product_box_items
         WHERE product_id = $1
         ORDER BY sort_order`,
        [p.id]
      ),
    ]);

    return res.json({
      success: true,
      product: {
        id:            p.id,
        slug:          p.slug ?? null,
        name:          p.name,
        description:   p.description,
        category:      p.category,
        condition:     p.condition,
        price:         p.price,
        originalPrice: p.original_price ?? null,
        negotiable:    p.negotiable ?? false,
        phone:         p.phone ?? null,
        isFeatured:    p.is_featured,
        isTrending:    p.is_trending,
        isSponsored:   p.is_sponsored,
        viewCount:     p.view_count ?? 0,
        createdAt:     p.created_at,
        /* images — array of URL strings, sorted primary first */
        images: images.rows.map((r) => r.image_url),
        seller: {
          id:     p.sellerId    ?? null,
          name:   p.sellerName  ?? null,
          phone:  p.sellerPhone ?? null,
          rating: 0,
        },
        variants:       variants.rows,
        keyFeatures:    features.rows.map((r) => r.feature),
        specifications: specs.rows.map((r) => ({
          key:   r.spec_key,
          value: r.spec_value,
        })),
        whatsInBox: boxItems.rows.map((r) => r.item),
      },
    });

  } catch (err) {
    console.error("[GET /api/market-products/:slug]", err.message);
    return res.status(500).json({ error: "Failed to fetch product." });
  }
});

export default router;