import express from "express";
import { Pool } from "pg";

const router = express.Router();

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= UTIL ================= */
const normalize = (str = "") =>
  str.toLowerCase().trim().replace(/\s+/g, " ");

const fuzzyScore = (query, text) => {
  query = normalize(query);
  text = normalize(text);

  if (!query || !text) return 0;

  let score = 0;

  if (text.includes(query)) score += 60;

  let match = 0;
  for (const c of query) {
    if (text.includes(c)) match++;
  }

  score += (match / query.length) * 40;

  return score;
};

/* ================= SEARCH ROUTE ================= */
router.get("/search", async (req, res) => {
  try {
    let { q = "", limit = 20 } = req.query;

    q = normalize(q);
    limit = Math.min(parseInt(limit) || 20, 50);

    if (!q) {
      return res.json({ products: [], trending: [] });
    }

    /* ================= FETCH PRODUCTS ================= */
    const { rows } = await pool.query(
      `
      SELECT p.*,
      COALESCE(
        json_agg(pi.image_url ORDER BY pi.position)
        FILTER (WHERE pi.image_url IS NOT NULL),
        '[]'
      ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      `
    );

    /* ================= SCORING ENGINE ================= */
    let scored = rows.map((p) => {
      const titleScore = fuzzyScore(q, p.title);
      const categoryScore = fuzzyScore(q, p.category_id || "");

      let score = titleScore + categoryScore;

      // BOOST: exact match
      if (normalize(p.title) === q) score += 100;

      // BOOST: starts with query
      if (normalize(p.title).startsWith(q)) score += 40;

      return { ...p, score };
    });

    /* ================= SORT ================= */
    scored.sort((a, b) => b.score - a.score);

    const topResults = scored.slice(0, limit);

    /* ================= RELATED EXPANSION ================= */
    const topCategory = topResults[0]?.category_id;

    let related = [];

    if (topCategory) {
      const relatedRows = await pool.query(
        `
        SELECT p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
        FROM products p
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.category_id = $1
        AND p.is_active = true
        GROUP BY p.id
        ORDER BY p.views DESC NULLS LAST
        LIMIT 8
        `,
        [topCategory]
      );

      related = relatedRows.rows.map((p) => ({
        ...p,
        isRelated: true,
      }));
    }

    /* ================= TRENDING ================= */
    const trendingRes = await pool.query(
      `
      SELECT p.*,
      COALESCE(
        json_agg(pi.image_url ORDER BY pi.position)
        FILTER (WHERE pi.image_url IS NOT NULL),
        '[]'
      ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY p.views DESC NULLS LAST
      LIMIT 6
      `
    );

    const trending = trendingRes.rows;

    /* ================= RESPONSE ================= */
    res.json({
      query: q,
      products: topResults,
      related,
      trending,
    });
  } catch (err) {
    console.error("SEARCH ERROR:", err);
    res.status(500).json({ message: "Search failed" });
  }
});

export default router;