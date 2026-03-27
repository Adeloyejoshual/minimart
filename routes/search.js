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
  str.toLowerCase().trim().replace(/\s+/g, " ");

const tokenize = (q) => normalize(q).split(" ").filter(Boolean);

/* ================= CLICK TRACKING ================= */
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
    console.error(err);
    res.json({ ok: false });
  }
});

/* ================= AUTOCOMPLETE ================= */
router.get("/suggest", async (req, res) => {
  try {
    let { q = "" } = req.query;
    q = normalize(q);

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
  } catch {
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

    page = Math.max(+page || 1, 1);
    limit = Math.min(+limit || 20, 50);
    const offset = (page - 1) * limit;

    let filters = ["p.is_active = true"];
    let values = [];
    let i = 1;

    /* ================= TOKEN SEARCH ================= */
    if (tokens.length) {
      filters.push(
        `(${tokens
          .map(
            () => `
          LOWER(p.title) LIKE $${i} OR
          LOWER(p.description) LIKE $${i} OR
          LOWER(p.attributes->>'brand') LIKE $${i} OR
          LOWER(p.attributes->>'model') LIKE $${i} OR
          LOWER(c.name) LIKE $${i}
        `
          )
          .join(" OR ")})`
      );

      tokens.forEach((t) => {
        values.push(`%${t}%`);
        i++;
      });
    }

    /* ================= FILTERS ================= */
    if (brand) {
      filters.push(`LOWER(p.attributes->>'brand') = $${i}`);
      values.push(brand.toLowerCase());
      i++;
    }

    if (category) {
      filters.push(`p.category_id = $${i}`);
      values.push(category);
      i++;
    }

    if (minPrice) {
      filters.push(`p.price >= $${i}`);
      values.push(minPrice);
      i++;
    }

    if (maxPrice) {
      filters.push(`p.price <= $${i}`);
      values.push(maxPrice);
      i++;
    }

    if (state) {
      filters.push(`LOWER(p.location_state) = $${i}`);
      values.push(state.toLowerCase());
      i++;
    }

    const where = `WHERE ${filters.join(" AND ")}`;

    /* ================= CLICK BOOST (AI LEARNING) ================= */
    const boostRes = await pool.query(`
      SELECT product_id, COUNT(*) as clicks
      FROM product_search_logs
      GROUP BY product_id
    `);

    const boostMap = new Map(
      boostRes.rows.map((r) => [r.product_id, Number(r.clicks)])
    );

    /* ================= USER BOOST ================= */
    let userMap = new Map();

    if (user_id) {
      const userBoost = await pool.query(
        `
        SELECT product_id, COUNT(*) as freq
        FROM product_search_logs
        WHERE user_id = $1
        GROUP BY product_id
        `,
        [user_id]
      );

      userMap = new Map(
        userBoost.rows.map((r) => [r.product_id, Number(r.freq)])
      );
    }

    /* ================= QUERY PRODUCTS ================= */
    const { rows } = await pool.query(
      `
      SELECT p.*, c.name AS category_name,
      COALESCE(
        json_agg(pi.image_url ORDER BY pi.position)
        FILTER (WHERE pi.image_url IS NOT NULL),
        '[]'
      ) AS images
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_images pi ON p.id = pi.product_id
      ${where}
      GROUP BY p.id, c.name
      `,
      values
    );

    /* ================= SCORING ENGINE ================= */
    const scored = rows.map((p) => {
      const title = (p.title || "").toLowerCase();
      const brandVal = (p.attributes?.brand || "").toLowerCase();
      const model = (p.attributes?.model || "").toLowerCase();

      let score = 0;

      // keyword match
      if (title.includes(q)) score += 100;
      if (brandVal.includes(q)) score += 60;
      if (model.includes(q)) score += 50;

      // token match
      tokens.forEach((t) => {
        if (title.includes(t)) score += 20;
        if (brandVal.includes(t)) score += 15;
        if (model.includes(t)) score += 15;
      });

      // popularity
      score += (p.views || 0) * 0.3;

      // global clicks (AI learning)
      score += (boostMap.get(p.id) || 0) * 25;

      // user personalization
      score += (userMap.get(p.id) || 0) * 10;

      return { ...p, score };
    });

    /* ================= SORT ================= */
    const sorted = scored.sort((a, b) => b.score - a.score);

    const paginated = sorted.slice(offset, offset + limit);

    /* ================= COUNT ================= */
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM products p ${where}`,
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
    res.status(500).json({ message: "Search failed" });
  }
});

export default router;