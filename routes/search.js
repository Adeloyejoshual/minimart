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

const tokenize = (q) =>
  normalize(q).split(" ").filter((t) => t.length > 0);

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
    let q = normalize(req.query.q || "");

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
    const tokens = tokenize(q);

    page = Math.max(parseInt(page) || 1, 1);
    limit = Math.min(parseInt(limit) || 20, 50);
    const offset = (page - 1) * limit;

    /* ================= DYNAMIC FILTERS ================= */
    const where = [];
    const values = [];
    let i = 1;

    where.push("p.is_active = true");

    /* ================= TOKEN SEARCH (FIXED) ================= */
    if (tokens.length) {
      const tokenBlocks = [];

      for (const t of tokens) {
        const param = `$${i}`;
        values.push(`%${t}%`);
        i++;

        tokenBlocks.push(`
          LOWER(p.title) LIKE ${param}
          OR LOWER(p.description) LIKE ${param}
          OR LOWER(p.attributes->>'brand') LIKE ${param}
          OR LOWER(p.attributes->>'model') LIKE ${param}
          OR LOWER(c.name) LIKE ${param}
        `);
      }

      where.push(`(${tokenBlocks.join(" OR ")})`);
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

    /* ================= BOOST DATA ================= */
    const boostRes = await pool.query(`
      SELECT product_id, COUNT(*)::int AS clicks
      FROM product_search_logs
      GROUP BY product_id
    `);

    const boostMap = new Map(
      boostRes.rows.map((r) => [r.product_id, r.clicks])
    );

    let userMap = new Map();

    if (user_id) {
      const userBoost = await pool.query(
        `
        SELECT product_id, COUNT(*)::int AS freq
        FROM product_search_logs
        WHERE user_id = $1
        GROUP BY product_id
        `,
        [user_id]
      );

      userMap = new Map(
        userBoost.rows.map((r) => [r.product_id, r.freq])
      );
    }

    /* ================= QUERY PRODUCTS ================= */
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
      `,
      values
    );

    /* ================= SCORING ENGINE ================= */
    const scored = rows.map((p) => {
      const title = normalize(p.title);
      const brandVal = normalize(p.attributes?.brand);
      const model = normalize(p.attributes?.model);

      let score = 0;

      /* keyword match */
      if (q && title.includes(q)) score += 120;
      if (q && brandVal.includes(q)) score += 80;
      if (q && model.includes(q)) score += 70;

      /* token match */
      for (const t of tokens) {
        if (title.includes(t)) score += 20;
        if (brandVal.includes(t)) score += 15;
        if (model.includes(t)) score += 15;
      }

      /* popularity */
      score += (p.views || 0) * 0.3;

      /* global clicks */
      score += (boostMap.get(p.id) || 0) * 25;

      /* user personalization */
      score += (userMap.get(p.id) || 0) * 10;

      return { ...p, score };
    });

    const sorted = scored.sort((a, b) => b.score - a.score);

    const paginated = sorted.slice(offset, offset + limit);

    /* ================= COUNT ================= */
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM products p ${whereSQL}`,
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
      paginated.length > 0
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
          ORDER BY p.views DESC
          LIMIT 8
          `,
            [paginated[0].category_id]
          )
        : { rows: [] };

    /* ================= RESPONSE ================= */
    res.json({
      query: q,
      total: Number(countRes.rows[0].count),
      page,
      totalPages: Math.ceil(countRes.rows[0].count / limit),
      products: paginated,
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