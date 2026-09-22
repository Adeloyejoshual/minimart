/**
 * routes/market/getproducts.js
 *
 * E-Commerce Product API (Public Storefront)
 * Engineered for high-conversion marketing, fast mobile loads, strict inventory safety,
 * and dynamic Admin Campaigns (e.g. "December Special").
 */

import express from "express";
import { createHash } from "node:crypto";
import {
  pool,
  FULL_PRODUCT_SELECT,
  SORT_MAP,
  PUBLIC_CONDITIONS,
  paginate,
  paginationMeta,
  isPublicProduct,
  ok,
  fail,
} from "./helpers.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   GET /api/products/home
   BUNDLE ENDPOINT: Fetches all marketing rails in a single call.
   Drastically reduces mobile TTI (Time to Interactive).
══════════════════════════════════════════════════════════════ */
router.get("/home", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "8", 10), 16);

    // Base query: public, approved, not deleted, in-stock items
    const baseQuery = `
      ${FULL_PRODUCT_SELECT}
      WHERE ${PUBLIC_CONDITIONS.join(" AND ")}
        AND p.stock > 0
    `;

    // Fire all 4 marketing rail queries simultaneously for ultimate speed
    const [dealsRes, hotRes, newestRes, campaignRes] = await Promise.all([
      /* 1. Deal of the Day: Highest actual discount % + high sales */
      pool.query(
        `${baseQuery}
         AND p.original_price > p.price
         ORDER BY 
           ((p.original_price - p.price)::numeric / NULLIF(p.original_price, 0)) DESC,
           p.sold_count DESC
         LIMIT $1`,
        [limit]
      ),
      /* 2. Hot Sales: Pure volume (bestselling) */
      pool.query(
        `${baseQuery}
         ORDER BY p.sold_count DESC, p.created_at DESC
         LIMIT $1`,
        [limit]
      ),
      /* 3. Just Dropped: Fresh inventory */
      pool.query(
        `${baseQuery}
         ORDER BY p.created_at DESC
         LIMIT $1`,
        [limit]
      ),
      /* 4. Active Custom Admin Campaign (e.g. "December Sale") */
      pool.query(
        `${baseQuery}
         AND p.campaign_tag IS NOT NULL
         ORDER BY p.updated_at DESC, p.sold_count DESC
         LIMIT $1`,
        [limit]
      ),
    ]);

    // Extract the dynamic campaign title if the admin has set one
    const activeCampaignTitle = campaignRes.rows[0]?.campaign_tag || null;

    ok(res, {
      data: {
        deals: dealsRes.rows,
        hot: hotRes.rows,
        newArrivals: newestRes.rows,
        campaignTitle: activeCampaignTitle,  // Sent dynamically to frontend
        campaignProducts: campaignRes.rows,
      },
    });
  } catch (err) {
    console.error("[Products] GET /home error:", err.message);
    fail(res, 500, "Failed to load storefront data");
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/products
   Public product listing with advanced filters (Catalog & Search)
══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  try {
    const {
      category,
      search,
      brand,
      tags,
      campaign,       // Custom admin campaign search (e.g. "December Deals")
      badge,          // Custom admin badge search
      featured,
      trending,
      sponsored,
      deal,           // True if looking for discounted items
      minDiscount,    // e.g. "10" for >= 10% off
      hasDelivery,
      inStock,        // Defaults to true for public views
      minPrice,
      maxPrice,
      sort = "newest",
    } = req.query;

    const { limit, offset } = paginate(req.query);

    const conditions = [...PUBLIC_CONDITIONS];
    const params = [];
    let p = 1;

    /* ── 1. Search (Full-Text) ── */
    if (search) {
      const cleaned = search.trim();
      conditions.push(
        `(p.search_vector @@ plainto_tsquery('english', $${p})
          OR p.name ILIKE $${p + 1}
          OR p.brand ILIKE $${p + 1})`
      );
      params.push(cleaned, `%${cleaned}%`);
      p += 2;
    }

    /* ── 2. Taxonomy & Campaigns ── */
    if (category) {
      conditions.push(`p.category = $${p++}`);
      params.push(category);
    }
    if (brand) {
      conditions.push(`p.brand ILIKE $${p++}`);
      params.push(`%${brand.trim()}%`);
    }
    if (tags) {
      conditions.push(`p.tags && $${p++}::text[]`);
      params.push(tags.split(","));
    }
    if (campaign) {
      conditions.push(`p.campaign_tag ILIKE $${p++}`);
      params.push(`%${campaign.trim()}%`);
    }
    if (badge) {
      conditions.push(`p.badge ILIKE $${p++}`);
      params.push(`%${badge.trim()}%`);
    }

    /* ── 3. Price & Deals ── */
    if (minPrice) {
      conditions.push(`p.price >= $${p++}`);
      params.push(parseInt(minPrice, 10));
    }
    if (maxPrice) {
      conditions.push(`p.price <= $${p++}`);
      params.push(parseInt(maxPrice, 10));
    }
    
    // Deal constraints
    if (deal === "true") {
      conditions.push(`p.original_price IS NOT NULL AND p.original_price > p.price`);
    }
    if (minDiscount) {
      const md = parseInt(minDiscount, 10);
      if (md > 0) {
        conditions.push(`
          p.original_price > 0 
          AND ROUND(((p.original_price - p.price)::numeric / p.original_price) * 100) >= $${p++}
        `);
        params.push(md);
      }
    }

    /* ── 4. Flags & Logistics ── */
    if (featured === "true") conditions.push("p.is_featured = true");
    if (trending === "true") conditions.push("p.is_trending = true");
    if (sponsored === "true") conditions.push("p.is_sponsored = true");
    if (hasDelivery === "true") conditions.push("p.has_delivery = true");

    /* ── 5. Inventory Safety ── */
    // Default to hiding out-of-stock items unless explicitly requested to see them
    if (inStock !== "false") {
      conditions.push("p.stock > 0");
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    /* ── 6. Advanced Sorting Engine ── */
    let order;
    switch (sort) {
      case "relevance":
        order = search 
          ? `ts_rank(p.search_vector, plainto_tsquery('english', $1)) DESC, p.sold_count DESC` 
          : `p.created_at DESC`;
        break;
      case "bestselling":
        order = `p.sold_count DESC, p.created_at DESC`;
        break;
      case "popular":
        order = `p.sold_count DESC, p.rating DESC NULLS LAST, p.created_at DESC`;
        break;
      case "trending":
        // Sales velocity formula: Sales / Days alive
        order = `(p.sold_count::numeric / GREATEST(EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400, 1)) DESC, p.created_at DESC`;
        break;
      case "deal":
        // Largest % discount first
        order = `
          CASE WHEN p.original_price > p.price 
            THEN ((p.original_price - p.price)::numeric / p.original_price) 
            ELSE 0 
          END DESC, 
          p.sold_count DESC`;
        break;
      case "views":
        order = `p.view_count DESC, p.created_at DESC`;
        break;
      default:
        order = SORT_MAP[sort] || SORT_MAP.newest;
    }

    /* ── 7. Execute Queries ── */
    const [{ rows }, countRes] = await Promise.all([
      pool.query(
        `${FULL_PRODUCT_SELECT}
         ${where}
         ORDER BY ${order}
         LIMIT $${p++} OFFSET $${p++}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM market.products p ${where}`, params),
    ]);

    ok(res, {
      data: {
        products: rows,
        pagination: paginationMeta(parseInt(countRes.rows[0].count, 10), limit, offset),
      },
    });
  } catch (err) {
    console.error("[Products] GET / error:", err.message);
    fail(res, 500, "Failed to fetch products");
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/products/:idOrSlug
   Product Detail Endpoint with Silent View Tracking
══════════════════════════════════════════════════════════════ */
router.get("/:idOrSlug", async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const whereClause = isUUID ? "p.id = $1" : "p.slug = $1";

    const { rows } = await pool.query(
      `${FULL_PRODUCT_SELECT}
       WHERE ${whereClause}
         AND p.deleted_at IS NULL`,
      [idOrSlug]
    );

    if (!rows.length) return fail(res, 404, "Product not found");

    const product = rows[0];

    // Visibility Check
    const isAdmin = req.user?.role === "admin";
    const isOwner = req.user?.id === product.user_id;
    const canSee  = isAdmin || isOwner || isPublicProduct(product);

    if (!canSee) return fail(res, 404, "Product not found or unavailable");

    // Fire and forget view tracking (does not block the response)
    if (isPublicProduct(product)) {
      trackView(product.id, req).catch((err) => {
        console.error(`[View Tracking Failed] Product ${product.id}:`, err.message);
      });
    }

    ok(res, { data: product });
  } catch (err) {
    console.error("[Products] GET /:idOrSlug error:", err.message);
    fail(res, 500, "Failed to fetch product details");
  }
});

/* ══════════════════════════════════════════════════════════════
   Analytics: 24h Unique IP View Tracking
══════════════════════════════════════════════════════════════ */
async function trackView(productId, req) {
  const ipRaw =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  const ipHash = createHash("sha256")
    .update(ipRaw + productId)
    .digest("hex")
    .slice(0, 16); // 16 char string is plenty for 24h deduplication

  const result = await pool.query(
    `INSERT INTO market.product_views
       (product_id, viewer_id, ip_hash, source)
     SELECT $1, $2, $3, $4
     WHERE NOT EXISTS (
       SELECT 1
       FROM market.product_views
       WHERE product_id = $1
         AND ip_hash    = $3
         AND created_at > (now() - interval '24 hours')
     )`,
    [
      productId,
      req.user?.id ?? null,
      ipHash,
      req.query.source || "direct",
    ]
  );

  // Only increment the denormalized view_count if a new unique view was inserted
  if (result.rowCount > 0) {
    await pool.query(
      `UPDATE market.products
       SET view_count = view_count + 1
       WHERE id = $1`,
      [productId]
    );
  }
}

export default router;