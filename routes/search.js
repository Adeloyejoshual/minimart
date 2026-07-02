// routes/search.js
import express from "express";
import { pool } from "../server.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   SAFE SEARCH — only uses columns that exist
   ══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  const {
    q         = "",
    category,
    price_min,
    price_max,
    condition,
    location,
    state,
    sort      = "relevance",
    page      = "1",
    limit     = "24",
    promoted,
  } = req.query;

  const query       = String(q || "").trim().toLowerCase().slice(0, 200);
  const locFilter   = String(location || state || "").trim().slice(0, 100);
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage     = Math.min(80, Math.max(1, parseInt(limit, 10) || 24));
  const offset      = (currentPage - 1) * perPage;

  try {
    /* ── Step 1: Discover columns ── */
    const { rows: colRows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products'
        AND table_schema = 'public'
    `);
    const cols = new Set(colRows.map((r) => r.column_name));

    /* ── Step 2: Check if related tables exist ── */
    const { rows: tableRows } = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('categories', 'sellers', 'product_images')
    `);
    const tables = new Set(tableRows.map((r) => r.table_name));

    const hasCats   = tables.has("categories");
    const hasSellers= tables.has("sellers");
    const hasPI     = tables.has("product_images");

    /* Helper — safe column reference */
    const col = (name) => cols.has(name);

    /* ── Step 3: Build SELECT ── */
    const selectCols = [
      "p.id",
      "p.title",
      "p.price",
      "p.slug",
      col("description")        ? "p.description"        : "NULL AS description",
      col("main_image")         ? "p.main_image"         : "NULL AS main_image",
      col("thumbnail_url")      ? "p.thumbnail_url"      : "NULL AS thumbnail_url",
      col("views")              ? "p.views"               : "0 AS views",
      col("clicks_count")       ? "p.clicks_count"        : "0 AS clicks_count",
      col("impression_count")   ? "p.impression_count"    : "0 AS impression_count",
      col("engagement_score")   ? "p.engagement_score"    : "0 AS engagement_score",
      col("promotion_priority") ? "p.promotion_priority"  : "0 AS promotion_priority",
      col("promotion_type")     ? "p.promotion_type"      : "NULL AS promotion_type",
      col("is_promoted")        ? "p.is_promoted"         : "false AS is_promoted",
      col("is_featured")        ? "p.is_featured"         : "false AS is_featured",
      col("favorites_count")    ? "p.favorites_count"     : "0 AS favorites_count",
      col("average_rating")     ? "p.average_rating"      : "0 AS average_rating",
      col("reviews_count")      ? "p.reviews_count"       : "0 AS reviews_count",
      col("offer_type")         ? "p.offer_type"          : "NULL AS offer_type",
      col("negotiable")         ? "p.negotiable"          : "false AS negotiable",
      col("condition")          ? "p.condition"           : "NULL AS condition",
      col("brand")              ? "p.brand"               : "NULL AS brand",
      col("model")              ? "p.model"               : "NULL AS model",
      col("seller_name")        ? "p.seller_name"         : "NULL AS seller_name",
      col("seller_id")          ? "p.seller_id"           : "NULL AS seller_id",
      col("category_id")        ? "p.category_id"         : "NULL AS category_id",
      col("location_city")      ? "p.location_city"       : "NULL AS location_city",
      col("location_state")     ? "p.location_state"      : "NULL AS location_state",
      col("attributes")         ? "p.attributes"          : "'{}'::json AS attributes",
      "p.created_at",
    ];

    /* Category name from JOIN */
    if (hasCats && col("category_id")) {
      selectCols.push("c.name AS category_name");
    } else {
      selectCols.push("NULL AS category_name");
    }

    /* Seller verified from JOIN */
    if (hasSellers && col("seller_id")) {
      selectCols.push("COALESCE(s.is_verified, false) AS seller_verified");
    } else {
      selectCols.push("false AS seller_verified");
    }

    /* Images from product_images or main_image */
    if (hasPI) {
      selectCols.push(`COALESCE(
        (SELECT json_agg(pi.image_url ORDER BY pi.position)
         FROM product_images pi
         WHERE pi.product_id = p.id AND pi.image_url IS NOT NULL),
        CASE WHEN ${col("main_image") ? "p.main_image" : "NULL"} IS NOT NULL
          THEN json_build_array(${col("main_image") ? "p.main_image" : "NULL"})
          ELSE '[]'::json
        END
      ) AS images`);
    } else if (col("main_image")) {
      selectCols.push(`CASE
        WHEN p.main_image IS NOT NULL THEN json_build_array(p.main_image)
        ELSE '[]'::json
      END AS images`);
    } else {
      selectCols.push("'[]'::json AS images");
    }

    /* ── Step 4: Build FROM + JOINs ── */
    let fromClause = "FROM public.products p";
    if (hasCats && col("category_id")) {
      fromClause += "\nLEFT JOIN public.categories c ON c.id = p.category_id";
    }
    if (hasSellers && col("seller_id")) {
      fromClause += "\nLEFT JOIN public.sellers s ON s.id = p.seller_id";
    }

    /* ── Step 5: Build WHERE ── */
    const values = [];
    const where  = [];
    const push   = (v) => { values.push(v); return `$${values.length}`; };

    /* Status filters — only if columns exist */
    if (col("is_active")) where.push("p.is_active = true");
    if (col("status"))    where.push("p.status = 'active'");
    if (col("is_deleted"))where.push("p.is_deleted = false");

    /* If no status columns, fallback */
    if (where.length === 0) where.push("true");

    /* Text search */
    if (query.length >= 1) {
      const searchFields = ["LOWER(p.title)"];

      if (col("description"))  searchFields.push("LOWER(COALESCE(p.description, ''))");
      if (col("brand"))        searchFields.push("LOWER(COALESCE(p.brand, ''))");
      if (col("seller_name"))  searchFields.push("LOWER(COALESCE(p.seller_name, ''))");
      if (col("location_city"))searchFields.push("LOWER(COALESCE(p.location_city, ''))");
      if (col("location_state"))searchFields.push("LOWER(COALESCE(p.location_state, ''))");

      const likeVal = push(`%${query}%`);
      const orClauses = searchFields.map((f) => `${f} LIKE ${likeVal}`);

      /* Each field needs its own param to avoid "bind message" errors */
      /* Since they all use the same value, reuse the same $N */
      where.push(`(${orClauses.join(" OR ")})`);
    }

    /* Category filter */
    if (category && category.trim()) {
      const catVal = category.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(catVal);

      if (isUuid && col("category_id")) {
        where.push(`p.category_id = ${push(catVal)}::uuid`);
      } else if (hasCats) {
        where.push(`LOWER(COALESCE(c.name, '')) = LOWER(${push(catVal)})`);
      }
    }

    /* Price range */
    const priceMinN = parseFloat(price_min);
    const priceMaxN = parseFloat(price_max);
    if (!isNaN(priceMinN) && priceMinN >= 0) {
      where.push(`p.price >= ${push(priceMinN)}`);
    }
    if (!isNaN(priceMaxN) && priceMaxN > 0) {
      where.push(`p.price <= ${push(priceMaxN)}`);
    }

    /* Condition */
    if (condition && condition.trim() && col("condition")) {
      where.push(`LOWER(COALESCE(p.condition, '')) = LOWER(${push(condition.trim())})`);
    }

    /* Location */
    if (locFilter) {
      const locParts = [];
      if (col("location_city"))  locParts.push(`LOWER(COALESCE(p.location_city, ''))  LIKE LOWER(${push(`%${locFilter}%`)})`);
      if (col("location_state")) locParts.push(`LOWER(COALESCE(p.location_state, '')) LIKE LOWER(${push(`%${locFilter}%`)})`);
      if (locParts.length > 0)   where.push(`(${locParts.join(" OR ")})`);
    }

    /* Promoted only */
    if (promoted === "true" && col("is_promoted")) {
      where.push("p.is_promoted = true");
    }

    const whereClause = `WHERE ${where.join(" AND ")}`;

    /* ── Step 6: ORDER BY ── */
    const promoted_first = col("is_promoted") && col("promotion_priority")
      ? "p.is_promoted DESC, p.promotion_priority DESC NULLS LAST,"
      : "";

    const SORT_MAP = {
      relevance  : `${promoted_first} ${col("engagement_score") ? "p.engagement_score DESC," : ""} ${col("views") ? "p.views DESC," : ""} p.created_at DESC`,
      newest     : `${promoted_first} p.created_at DESC`,
      price_low  : `${promoted_first} p.price ASC, p.created_at DESC`,
      price_high : `${promoted_first} p.price DESC, p.created_at DESC`,
      popular    : `${promoted_first} ${col("views") ? "p.views DESC NULLS LAST," : ""} p.created_at DESC`,
    };

    let orderBy = SORT_MAP[sort] || SORT_MAP.relevance;

    /* Clean up trailing commas */
    orderBy = orderBy.replace(/,\s*$/, "").replace(/,\s*,/g, ",");

    /* ── Step 7: Pagination ── */
    values.push(perPage + 1);
    const limitP  = `$${values.length}`;
    values.push(offset);
    const offsetP = `$${values.length}`;

    const countValues = values.slice(0, values.length - 2);

    /* ── Step 8: Execute in parallel ── */
    const mainSQL = `
      SELECT ${selectCols.join(",\n       ")}
      ${fromClause}
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limitP} OFFSET ${offsetP}
    `;

    const countSQL = `
      SELECT COUNT(*)::int AS total
      FROM public.products p
      ${hasCats && col("category_id") ? "LEFT JOIN public.categories c ON c.id = p.category_id" : ""}
      ${whereClause}
    `;

    console.log("[search] SQL:", mainSQL);
    console.log("[search] values:", values);

    const [mainResult, countResult, suggestionResult] = await Promise.all([
      pool.query(mainSQL, values),
      pool.query(countSQL, countValues),
      query.length >= 2
        ? pool.query(
            `SELECT DISTINCT LEFT(p.title, 60) AS title
             FROM public.products p
             WHERE ${col("is_active") ? "p.is_active = true AND" : ""} 
                   ${col("status") ? "p.status = 'active' AND" : ""}
                   LOWER(p.title) LIKE $1
             ORDER BY 1
             LIMIT 8`,
            [`%${query}%`]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    /* ── Step 9: Shape response ── */
    const rows    = mainResult.rows;
    const hasMore = rows.length > perPage;
    const records = hasMore ? rows.slice(0, perPage) : rows;
    const total   = countResult.rows[0]?.total ?? 0;

    const products = records.map((p) => {
      const image = p.main_image || p.thumbnail_url || null;
      const imgs  = Array.isArray(p.images) ? p.images : [];

      return {
        id                : p.id,
        title             : p.title,
        description       : p.description || null,
        price             : Number(p.price || 0),
        slug              : p.slug,
        image             : image || (imgs[0] || null),
        images            : imgs.length > 0 ? imgs : image ? [image] : [],
        views             : Number(p.views || 0),
        clicks_count      : Number(p.clicks_count || 0),
        engagement_score  : Number(p.engagement_score || 0),
        promotion_priority: Number(p.promotion_priority || 0),
        is_promoted       : !!p.is_promoted,
        is_featured       : !!p.is_featured,
        favorites_count   : Number(p.favorites_count || 0),
        average_rating    : Number(p.average_rating || 0),
        reviews_count     : Number(p.reviews_count || 0),
        offer_type        : p.offer_type || null,
        negotiable        : !!p.negotiable,
        condition         : p.condition || null,
        brand             : p.brand || null,
        seller_name       : p.seller_name || null,
        seller_id         : p.seller_id || null,
        category_id       : p.category_id || null,
        category_name     : p.category_name || null,
        location_city     : p.location_city || null,
        location_state    : p.location_state || null,
        attributes        : p.attributes || {},
        created_at        : p.created_at,
        location: {
          city : p.location_city || null,
          state: p.location_state || null,
        },
        seller: {
          id      : p.seller_id || null,
          name    : p.seller_name || null,
          verified: !!p.seller_verified,
        },
      };
    });

    return res.json({
      query,
      total,
      page       : currentPage,
      perPage,
      totalPages : Math.ceil(total / perPage),
      has_more   : hasMore,
      products,
      suggestions: suggestionResult.rows.map((r) => r.title),
    });

  } catch (err) {
    console.error("[search] FULL ERROR:", err.message);
    console.error("[search] STACK:", err.stack);

    return res.status(500).json({
      products   : [],
      total      : 0,
      suggestions: [],
      message    : "Search failed",
      debug      : process.env.NODE_ENV !== "production" ? err.message : undefined,
    });
  }
});

export default router;