import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= NORMALIZER ================= */
const normalizeProduct = (p) => ({
  ...p,
  images: p.images || [],
  views: Number(p.views || 0),
  price: Number(p.price || 0),
});

/* ================= HELPERS ================= */
const normalizeQuery = (str = "") =>
  String(str).toLowerCase().trim().replace(/s+/g, " ");

/* ================= BASE QUERY ================= */
const baseQuery = `
  SELECT 
    p.id, p.slug, p.title, p.description, p.price, p.views, p.created_at,
    p.is_promoted, p.promotion_priority, p.location_state, p.location_city,
    p.attributes, p.category_id,
    c.name AS category_name,
    COALESCE(
      json_agg(pi.image_url ORDER BY pi.position)
      FILTER (WHERE pi.image_url IS NOT NULL),
      '[]'
    ) AS images
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN product_images pi ON p.id = pi.product_id
`;

/* ================= MAIN SEARCH (SUPPORTS BANNER CLICKS) ================= */
router.get("/", async (req, res) => {
  try {
    const {
      q = "",
      price_max,
      price_min,
      promoted,
      sort = "relevance",
      category,
      state,
      page = 1,
      limit = 24
    } = req.query;

    const query = normalizeQuery(q);
    page = Math.max(1, parseInt(page));
    const perPage = Math.min(50, parseInt(limit));

    let whereClauses = [
      "COALESCE(p.is_active, false) = true"
    ];
    const params = [];
    let paramIndex = 1;

    /* 🔥 BANNER CLICK SUPPORT */
    if (price_max) {
      whereClauses.push(`p.price <= $${paramIndex}`);
      params.push(Number(price_max));
      paramIndex++;
    }

    if (price_min) {
      whereClauses.push(`p.price >= $${paramIndex}`);
      params.push(Number(price_min));
      paramIndex++;
    }

    if (promoted === "true") {
      whereClauses.push(`p.is_promoted = true`);
    }

    if (category) {
      whereClauses.push(`p.category_id = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (state) {
      whereClauses.push(`LOWER(p.location_state) = $${paramIndex}`);
      params.push(normalizeQuery(state));
      paramIndex++;
    }

    /* 🔍 TEXT SEARCH */
    if (query) {
      whereClauses.push(`
        LOWER(p.title) LIKE $${paramIndex} OR 
        LOWER(p.description) LIKE $${paramIndex} OR 
        LOWER(p.attributes->>'brand') LIKE $${paramIndex}
      `);
      params.push(`%${query}%`);
      paramIndex++;
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    /* 📊 COUNT TOTAL */
    const countRes = await pool.query(
      `SELECT COUNT(DISTINCT p.id) as total ${baseQuery} ${whereSQL} GROUP BY p.id`,
      params
    );
    const total = countRes.rows.length || 0;

    /* 🎯 MAIN RESULTS */
    let orderBy = "p.created_at DESC";
    
    if (sort === "price") orderBy = "p.price ASC";
    else if (sort === "price_desc") orderBy = "p.price DESC";
    else if (sort === "views") orderBy = "p.views DESC NULLS LAST";
    else if (sort === "promoted") orderBy = "p.promotion_priority DESC NULLS LAST, p.created_at DESC";

    const offset = (page - 1) * perPage;

    const results = await pool.query(
      `
      ${baseQuery}
      ${whereSQL}
      GROUP BY p.id, p.slug, p.title, p.description, p.price, p.views, p.created_at,
               p.is_promoted, p.promotion_priority, p.location_state, p.location_city,
               p.attributes, p.category_id, c.name
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, perPage, offset]
    );

    /* 🆕 SUGGESTIONS */
    const suggestions = query ? await pool.query(
      `SELECT DISTINCT title FROM products 
       WHERE COALESCE(is_active, false) = true 
         AND LOWER(title) LIKE $${1} 
       ORDER BY views DESC NULLS LAST 
       LIMIT 8`,
      [`%${query}%`]
    ) : { rows: [] };

    res.json({
      query,
      filters: {
        price_max: price_max ? Number(price_max) : null,
        price_min: price_min ? Number(price_min) : null,
        promoted: promoted === "true",
        category,
        state
      },
      total,
      page,
      totalPages: Math.ceil(total / perPage),
      perPage,
      products: results.rows.map(normalizeProduct),
      suggestions: suggestions.rows.map(r => r.title),
      facets: {
        categories: [], // Add later
        priceRange: [0, 500000]
      }
    });

  } catch (err) {
    console.error("SEARCH ERROR:", err);
    res.status(500).json({
      message: "Search failed",
      products: [],
      suggestions: [],
      total: 0
    });
  }
});

/* ================= HOMEPAGE INTEGRATION ================= */
router.get("/homepage", async (req, res) => {
  try {
    const [
      recommendedRes,
      cheapDealsRes,
      trendingRes,
      latestRes
    ] = await Promise.all([
      // Recommended (Promo + Views + Recent)
      pool.query(`
        ${baseQuery}
        WHERE COALESCE(p.is_active, false) = true
        GROUP BY p.id, p.slug, p.title, p.description, p.price, p.views, p.created_at,
                 p.is_promoted, p.promotion_priority, p.location_state, p.location_city,
                 p.attributes, p.category_id, c.name
        ORDER BY 
          COALESCE(p.promotion_priority, 0) DESC,
          COALESCE(p.views, 0) DESC,
          p.created_at DESC
        LIMIT 24
      `),
      
      // Cheap Deals (≤ ₦20K)
      pool.query(`
        ${baseQuery}
        WHERE COALESCE(p.is_active, false) = true AND p.price <= 20000
        GROUP BY p.id, p.slug, p.title, p.description, p.price, p.views, p.created_at,
                 p.is_promoted, p.promotion_priority, p.location_state, p.location_city,
                 p.attributes, p.category_id, c.name
        ORDER BY 
          COALESCE(p.promotion_priority, 0) DESC,
          COALESCE(p.views, 0) DESC
        LIMIT 50
      `),
      
      // Trending (High Views)
      pool.query(`
        ${baseQuery}
        WHERE COALESCE(p.is_active, false) = true AND COALESCE(p.views, 0) > 5
        GROUP BY p.id, p.slug, p.title, p.description, p.price, p.views, p.created_at,
                 p.is_promoted, p.promotion_priority, p.location_state, p.location_city,
                 p.attributes, p.category_id, c.name
        ORDER BY p.views DESC, p.created_at DESC
        LIMIT 20
      `),
      
      // Latest
      pool.query(`
        ${baseQuery}
        WHERE COALESCE(p.is_active, false) = true
        GROUP BY p.id, p.slug, p.title, p.description, p.price, p.views, p.created_at,
                 p.is_promoted, p.promotion_priority, p.location_state, p.location_city,
                 p.attributes, p.category_id, c.name
        ORDER BY p.created_at DESC
        LIMIT 30
      `)
    ]);

    res.json({
      recommended: recommendedRes.rows.map(normalizeProduct),
      cheapDeals: cheapDealsRes.rows.map(normalizeProduct),
      trending: trendingRes.rows.map(normalizeProduct),
      latest: latestRes.rows.map(normalizeProduct)
    });

  } catch (err) {
    console.error("HOMEPAGE ERROR:", err);
    res.status(500).json({ message: "Failed to load homepage" });
  }
});

export default router;