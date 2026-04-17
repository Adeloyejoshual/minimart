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

/* ================= BASE QUERY ================= */
const baseQuery = `
  SELECT 
    p.id, p.slug, p.title, p.description, p.price, p.views, p.created_at,
    p.is_promoted, p.promotion_priority, p.location_state, p.location_city,
    p.status, p.is_active,
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

/* ================= MAIN SEARCH ================= */
router.get("/", async (req, res) => {
  const client = await pool.connect();
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

    const query = String(q).toLowerCase().trim();
    const currentPage = Math.max(1, parseInt(page));
    const perPage = Math.min(50, parseInt(limit));
    const offset = (currentPage - 1) * perPage;

    let whereClauses = [
      "p.is_active = true",
      "p.status = 'active'"
    ];
    const params = [];
    let paramIndex = 1;

    // 🔥 BANNER SUPPORT
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
      whereClauses.push("p.is_promoted = true");
    }
    if (category) {
      whereClauses.push(`p.category_id = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    if (state) {
      whereClauses.push(`LOWER(p.location_state) = LOWER($${paramIndex})`);
      params.push(state);
      paramIndex++;
    }

    // 🔍 FUZZY TEXT SEARCH - YOUR #1 ISSUE FIXED
    if (query) {
      whereClauses.push(`
        LOWER(p.title) LIKE $${paramIndex} OR 
        LOWER(p.description) LIKE $${paramIndex} OR 
        p.search_text LIKE $${paramIndex} OR
        LOWER(COALESCE(p.attributes->>'brand', '')) LIKE $${paramIndex}
      `);
      params.push(`%${query}%`);
      paramIndex++;
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // 📊 COUNT
    const countQuery = `SELECT COUNT(DISTINCT p.id)::int AS total ${baseQuery} ${whereSQL} GROUP BY p.id`;
    const countRes = await client.query(countQuery, params.slice(0, paramIndex - 1));
    const total = countRes.rows.length || 0;

    // 🎯 RESULTS + PROPER GROUP BY
    const orderBy = sort === "price" ? "p.price ASC" :
                   sort === "price_desc" ? "p.price DESC" :
                   sort === "views" ? "p.views DESC NULLS LAST" :
                   sort === "promoted" ? "p.promotion_priority DESC NULLS LAST, p.created_at DESC" :
                   "p.created_at DESC";

    const resultsQuery = `
      ${baseQuery}
      ${whereSQL}
      GROUP BY 
        p.id, p.slug, p.title, p.description, p.price, p.views, p.created_at,
        p.is_promoted, p.promotion_priority, p.location_state, p.location_city,
        p.status, p.is_active, p.attributes, p.category_id, c.name
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(perPage, offset);
    
    const results = await client.query(resultsQuery, params);
    
    // 🆕 SUGGESTIONS
    const suggestions = query ? await client.query(
      `SELECT DISTINCT LEFT(p.title, 50) as title 
       FROM products p 
       WHERE p.is_active = true AND p.status = 'active'
         AND LOWER(p.title) LIKE $${1}
       ORDER BY p.views DESC NULLS LAST, p.created_at DESC
       LIMIT 8`,
      [`%${query}%`]
    ) : { rows: [] };

    res.json({
      query,
      total,
      page: currentPage,
      perPage,
      totalPages: Math.ceil(total / perPage),
      products: results.rows.map(normalizeProduct),
      suggestions: suggestions.rows.map(r => r.title)
    });

  } catch (err) {
    console.error("SEARCH ERROR:", err);
    res.status(500).json({ products: [], total: 0, message: "Search failed" });
  } finally {
    client.release();
  }
});

/* ================= HOMEPAGE ================= */
router.get("/homepage", async (req, res) => {
  try {
    const [
      latest,
      cheapDeals,
      trending,
      promoted
    ] = await Promise.all([
      // Latest (24)
      pool.query(`${baseQuery} WHERE p.is_active = true AND p.status = 'active' GROUP BY p.id, p.slug, p.title, p.description, p.price, p.views, p.created_at, p.is_promoted, p.promotion_priority, p.location_state, p.location_city, p.attributes, p.category_id, c.name ORDER BY p.created_at DESC LIMIT 24`),
      
      // Cheap Deals ≤ ₦20K (50)
      pool.query(`${baseQuery} WHERE p.is_active = true AND p.status = 'active' AND p.price <= 20000 GROUP BY p.id, p.slug, p.title, p.description, p.price, p.views, p.created_at, p.is_promoted, p.promotion_priority, p.location_state, p.location_city, p.attributes, p.category_id, c.name ORDER BY p.promotion_priority DESC NULLS LAST, p.views DESC NULLS LAST LIMIT 50`),
      
      // Trending (views > 5)
      pool.query(`${baseQuery} WHERE p.is_active = true AND p.status = 'active' AND p.views > 5 GROUP BY p.id, p.slug, p.title, p.description, p.price, p.views, p.created_at, p.is_promoted, p.promotion_priority, p.location_state, p.location_city, p.attributes, p.category_id, c.name ORDER BY p.views DESC, p.created_at DESC LIMIT 20`),
      
      // Promoted
      pool.query(`${baseQuery} WHERE p.is_active = true AND p.status = 'active' AND p.is_promoted = true GROUP BY p.id, p.slug, p.title, p.description, p.price, p.views, p.created_at, p.is_promoted, p.promotion_priority, p.location_state, p.location_city, p.attributes, p.category_id, c.name ORDER BY p.promotion_priority DESC LIMIT 12`)
    ]);

    res.json({
      latest: latest.rows.map(normalizeProduct),
      cheapDeals: cheapDeals.rows.map(normalizeProduct),
      trending: trending.rows.map(normalizeProduct),
      promoted: promoted.rows.map(normalizeProduct)
    });

  } catch (err) {
    console.error("HOMEPAGE ERROR:", err);
    res.status(500).json({ latest: [], cheapDeals: [], trending: [], promoted: [] });
  }
});

export default router;