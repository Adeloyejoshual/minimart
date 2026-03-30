import express from "express";
import { Pool } from "pg";

const router = express.Router();

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= NORMALIZER ================= */
const normalize = (str = "") =>
  String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

/* ================= FUZZY SIMILARITY (SQL SAFE LIGHT VERSION) ================= */
const similarity = (a = "", b = "") => {
  a = normalize(a);
  b = normalize(b);

  if (!a || !b) return 0;

  let matches = 0;
  const len = Math.max(a.length, b.length);

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) matches++;
  }

  return matches / len;
};

/* ================= INTENT DETECTOR ================= */
const detectIntent = (q = "") => {
  const query = normalize(q);

  return {
    category:
      query.includes("phone") || query.includes("iphone") || query.includes("laptop")
        ? "electronics"
        : query.includes("shoe") || query.includes("shirt")
        ? "fashion"
        : null,

    maxPrice:
      query.match(/under\s(\d+)/)?.[1] ||
      (["cheap", "budget", "affordable"].some((w) => query.includes(w))
        ? 50000
        : null),

    minPrice:
      query.match(/above\s(\d+)/)?.[1] ||
      (["premium", "expensive"].some((w) => query.includes(w))
        ? 200000
        : null),
  };
};

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

/* ================= AUTOCOMPLETE (SMARTER) ================= */
router.get("/suggest", async (req, res) => {
  try {
    const q = normalize(req.query.q || "");
    if (!q) return res.json([]);

    const { rows } = await pool.query(
      `
      SELECT title, views
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

/* ================= MAIN SEARCH (AI LEVEL) ================= */
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
    } = req.query;

    q = normalize(q);
    page = Math.max(parseInt(page) || 1, 1);
    limit = Math.min(parseInt(limit) || 20, 50);
    const offset = (page - 1) * limit;

    const intent = detectIntent(q);

    const where = [];
    const values = [];
    let i = 1;

    /* ================= BASE ================= */
    where.push("p.is_active = true");
    where.push("p.status = 'active'");

    /* ================= SMART TEXT SEARCH ================= */
    if (q) {
      where.push(`
        (
          p.search_vector @@ plainto_tsquery('english', $${i})
          OR LOWER(p.title) LIKE $${i}
          OR LOWER(p.description) LIKE $${i}
          OR LOWER(p.search_text) LIKE $${i}
          OR LOWER(p.attributes->>'brand') LIKE $${i}
          OR LOWER(c.name) LIKE $${i}
        )
      `);

      values.push(`%${q}%`);
      i++;
    }

    /* ================= FILTERS ================= */
    const finalCategory = category || intent.category;
    const finalMaxPrice = maxPrice || intent.maxPrice;
    const finalMinPrice = minPrice || intent.minPrice;

    if (brand) {
      where.push(`LOWER(p.attributes->>'brand') = $${i}`);
      values.push(normalize(brand));
      i++;
    }

    if (finalCategory) {
      where.push(`p.category_id = $${i}`);
      values.push(finalCategory);
      i++;
    }

    if (finalMinPrice) {
      where.push(`p.price >= $${i}`);
      values.push(finalMinPrice);
      i++;
    }

    if (finalMaxPrice) {
      where.push(`p.price <= $${i}`);
      values.push(finalMaxPrice);
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
      ORDER BY 
        p.views DESC NULLS LAST,
        p.created_at DESC
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

    /* ================= SUGGESTIONS (SMART) ================= */
    const suggestionsRes = await pool.query(
      `
      SELECT title, views
      FROM products
      WHERE LOWER(title) LIKE $1
      ORDER BY views DESC NULLS LAST
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
      intent,
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