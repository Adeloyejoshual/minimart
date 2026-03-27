import express from "express";
import { Pool } from "pg";

const router = express.Router();

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= HELPERS ================= */
const normalize = (str = "") =>
  String(str).toLowerCase().trim().replace(/\s+/g, " ");

/* ================= CLICK TRACK ================= */
router.post("/track-click", async (req, res) => {
  try {
    const { query, product_id, user_id } = req.body;

    await pool.query(
      `
      INSERT INTO product_search_logs (query, product_id, user_id, clicked)
      VALUES ($1, $2, $3, true)
      `,
      [query || "", product_id, user_id || null]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("TRACK CLICK ERROR:", err);
    res.json({ ok: false });
  }
});

/* ================= AUTOCOMPLETE ================= */
router.get("/suggest", async (req, res) => {
  try {
    const q = normalize(req.query.q || "");
    if (!q) return res.json([]);

    const { rows } = await pool.query(
      `
      SELECT DISTINCT title
      FROM products
      WHERE LOWER(title) LIKE $1
      ORDER BY views DESC NULLS LAST
      LIMIT 8
      `,
      [`%${q}%`]
    );

    res.json(rows.map((r) => r.title));
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

/* ================= MAIN SEARCH ================= */
router.get("/", async (req, res) => {
  try {
    let {
      q = "",
      brand,
      category,
      minPrice,
      maxPrice,
      state,
      page = 1,
      limit = 20,
      user_id,
    } = req.query;

    q = normalize(q);

    page = Math.max(parseInt(page) || 1, 1);
    limit = Math.min(parseInt(limit) || 20, 50);
    const offset = (page - 1) * limit;

    const where = [];
    const values = [];
    let i = 1;

    /* ================= BASE CONDITION ================= */
    where.push("p.is_active = true");
    where.push("p.status = 'active'");

    /* ================= CORE SEARCH (FIXED) ================= */
    if (q) {
      where.push(`
        (
          p.search_vector @@ plainto_tsquery('english', $${i})
          OR LOWER(p.title) LIKE $${i}
          OR LOWER(p.description) LIKE $${i}
          OR LOWER(p.search_text) LIKE $${i}
          OR LOWER(p.attributes->>'brand') LIKE $${i}
          OR LOWER(p.attributes->>'model') LIKE $${i}
          OR LOWER(c.name) LIKE $${i}
        )
      `);

      values.push(`%${q}%`);
      i++;
    }

    /* ================= FILTERS ================= */
    if (brand) {
      where.push(`LOWER(p.attributes->>'brand') = $${i}`);
      values.push(normalize(brand));
      i++;
    }

    if (category) {
      where.push(`p.category_id = $${i}`);
      values.push(category);
      i++;
    }

    if (minPrice) {
      where.push(`p.price >= $${i}`);
      values.push(minPrice);
      i++;
    }

    if (maxPrice) {
      where.push(`p.price <= $${i}`);
      values.push(maxPrice);
      i++;
    }

    if (state) {
      where.push(`LOWER(p.location_state) = $${i}`);
      values.push(normalize(state));
      i++;
    }

    const whereSQL = `WHERE ${where.join(" AND ")}`;

    /* ================= MAIN QUERY ================= */
    const { rows } = await pool.query(
      `
      SELECT 
        p.*,
        c.name AS category_name,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_images pi ON p.id = pi.product_id
      ${whereSQL}
      GROUP BY p.id, c.name
      ORDER BY p.views DESC NULLS LAST
      LIMIT $${i} OFFSET $${i + 1}
      `,
      [...values, limit, offset]
    );

    /* ================= COUNT ================= */
    const countRes = await pool.query(
      `
      SELECT COUNT(*) FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereSQL}
      `,
      values
    );

    /* ================= SUGGESTIONS ================= */
    const suggestionsRes = await pool.query(
      `
      SELECT DISTINCT title
      FROM products
      WHERE LOWER(title) LIKE $1
      LIMIT 10
      `,
      [`%${q}%`]
    );

    /* ================= RELATED ================= */
    const relatedRes =
      rows.length > 0
        ? await pool.query(
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
            GROUP BY p.id
            ORDER BY p.views DESC NULLS LAST
            LIMIT 8
            `,
            [rows[0].category_id]
          )
        : { rows: [] };

    /* ================= RESPONSE ================= */
    res.json({
      query: q,
      total: Number(countRes.rows[0].count),
      page,
      totalPages: Math.ceil(countRes.rows[0].count / limit),
      products: rows,
      suggestions: suggestionsRes.rows.map((r) => r.title),
      related: relatedRes.rows,
    });
  } catch (err) {
    console.error("SEARCH ERROR:", err);
    res.status(500).json({
      message: "Search failed",
      products: [],
      suggestions: [],
      related: [],
    });
  }
});

export default router;