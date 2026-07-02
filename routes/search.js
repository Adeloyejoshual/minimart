import express from "express";
import { pool } from "../server.js";

const router = express.Router();

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
      WHERE table_name   = 'products'
        AND table_schema = 'public'
    `);
    const cols = new Set(colRows.map((r) => r.column_name));

    /* ── Step 2: Check related tables ── */
    const { rows: tableRows } = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('categories', 'sellers', 'product_images')
    `);
    const tables    = new Set(tableRows.map((r) => r.table_name));
    const hasCats   = tables.has("categories");
    const hasSellers= tables.has("sellers");
    const hasPI     = tables.has("product_images");

    const col = (name) => cols.has(name);

    /* ── Step 3: SELECT columns ── */
    const selectCols = [
      "p.id",
      "p.title",
      "p.price",
      "p.slug",
      col("description")        ? "p.description"                    : "NULL AS description",
      col("main_image")         ? "p.main_image"                     : "NULL AS main_image",
      col("thumbnail_url")      ? "p.thumbnail_url"                  : "NULL AS thumbnail_url",
      col("views")              ? "p.views"                          : "0 AS views",
      col("clicks_count")       ? "p.clicks_count"                   : "0 AS clicks_count",
      col("impression_count")   ? "p.impression_count"               : "0 AS impression_count",
      col("engagement_score")   ? "p.engagement_score"               : "0 AS engagement_score",
      col("promotion_priority") ? "p.promotion_priority"             : "0 AS promotion_priority",
      col("promotion_type")     ? "p.promotion_type"                 : "NULL AS promotion_type",
      col("is_promoted")        ? "p.is_promoted"                    : "false AS is_promoted",
      col("is_featured")        ? "p.is_featured"                    : "false AS is_featured",
      col("favorites_count")    ? "p.favorites_count"                : "0 AS favorites_count",
      col("average_rating")     ? "p.average_rating"                 : "0 AS average_rating",
      col("reviews_count")      ? "p.reviews_count"                  : "0 AS reviews_count",
      col("offer_type")         ? "p.offer_type"                     : "NULL AS offer_type",
      // ✅ Fix Bug 5 — alias as is_negotiable so frontend badge works
      col("is_negotiable")      ? "p.is_negotiable"                  :
      col("negotiable")         ? "p.negotiable AS is_negotiable"    : "false AS is_negotiable",
      col("condition")          ? "p.condition"                      : "NULL AS condition",
      col("brand")              ? "p.brand"                          : "NULL AS brand",
      col("model")              ? "p.model"                          : "NULL AS model",
      col("seller_name")        ? "p.seller_name"                    : "NULL AS seller_name",
      col("seller_id")          ? "p.seller_id"                      : "NULL AS seller_id",
      col("category_id")        ? "p.category_id"                    : "NULL AS category_id",
      col("location_city")      ? "p.location_city"                  : "NULL AS location_city",
      col("location_state")     ? "p.location_state"                 : "NULL AS location_state",
      col("attributes")         ? "p.attributes"                     : "'{}'::json AS attributes",
      col("original_price")     ? "p.original_price"                 : "NULL AS original_price",
      "p.created_at",
    ];

    if (hasCats && col("category_id")) {
      selectCols.push("c.name AS category_name");
    } else {
      selectCols.push("NULL AS category_name");
    }

    if (hasSellers && col("seller_id")) {
      selectCols.push("COALESCE(s.is_verified, false) AS seller_verified");
    } else {
      selectCols.push("false AS seller_verified");
    }

    /* Images */
    const mainImgExpr = col("main_image") ? "p.main_image" : "NULL";
    if (hasPI) {
      selectCols.push(`
        COALESCE(
          (SELECT json_agg(pi.image_url ORDER BY pi.position)
           FROM product_images pi
           WHERE pi.product_id = p.id AND pi.image_url IS NOT NULL),
          CASE WHEN ${mainImgExpr} IS NOT NULL
            THEN json_build_array(${mainImgExpr})
            ELSE '[]'::json
          END
        ) AS images
      `.trim());
    } else if (col("main_image")) {
      selectCols.push(`
        CASE WHEN p.main_image IS NOT NULL
          THEN json_build_array(p.main_image)
          ELSE '[]'::json
        END AS images
      `.trim());
    } else {
      selectCols.push("'[]'::json AS images");
    }

    /* ── Step 4: FROM + JOINs ── */
    let fromClause = "FROM public.products p";
    if (hasCats && col("category_id")) {
      fromClause += "\nLEFT JOIN public.categories c ON c.id = p.category_id";
    }
    if (hasSellers && col("seller_id")) {
      fromClause += "\nLEFT JOIN public.sellers s ON s.id = p.seller_id";
    }

    /* ── Step 5: WHERE ── */
    const values = [];
    const where  = [];
    const push   = (v) => { values.push(v); return `$${values.length}`; };

    /* Status filters */
    const statusFilters = [];
    if (col("is_active"))  statusFilters.push("p.is_active = true");
    if (col("status"))     statusFilters.push("p.status = 'active'");
    if (col("is_deleted")) statusFilters.push("p.is_deleted = false");

    // ✅ Always have at least one WHERE condition
    if (statusFilters.length > 0) {
      where.push(...statusFilters);
    } else {
      where.push("true");
    }

    /* Text search */
    if (query.length >= 1) {
      const likeVal    = push(`%${query}%`);
      const searchParts = [`LOWER(p.title) LIKE ${likeVal}`];

      if (col("description"))   searchParts.push(`LOWER(COALESCE(p.description,   '')) LIKE ${likeVal}`);
      if (col("brand"))         searchParts.push(`LOWER(COALESCE(p.brand,          '')) LIKE ${likeVal}`);
      if (col("seller_name"))   searchParts.push(`LOWER(COALESCE(p.seller_name,    '')) LIKE ${likeVal}`);
      if (col("location_city")) searchParts.push(`LOWER(COALESCE(p.location_city,  '')) LIKE ${likeVal}`);
      if (col("location_state"))searchParts.push(`LOWER(COALESCE(p.location_state, '')) LIKE ${likeVal}`);

      // ✅ All fields share the same $N — no extra pushes needed
      where.push(`(${searchParts.join(" OR ")})`);
    }

    /* Category */
    if (category?.trim()) {
      const catVal = category.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(catVal);
      if (isUuid && col("category_id")) {
        where.push(`p.category_id = ${push(catVal)}::uuid`);
      } else if (hasCats) {
        where.push(`LOWER(COALESCE(c.name, '')) = LOWER(${push(catVal)})`);
      }
    }

    /* Price */
    const priceMinN = parseFloat(price_min);
    const priceMaxN = parseFloat(price_max);
    if (!isNaN(priceMinN) && priceMinN >= 0) where.push(`p.price >= ${push(priceMinN)}`);
    if (!isNaN(priceMaxN) && priceMaxN >  0) where.push(`p.price <= ${push(priceMaxN)}`);

    /* Condition */
    if (condition?.trim() && col("condition")) {
      where.push(`LOWER(COALESCE(p.condition, '')) = LOWER(${push(condition.trim())})`);
    }

    /* ✅ Fix Bug 2 — location uses ONE push, shared across both columns */
    if (locFilter) {
      const locVal   = push(`%${locFilter}%`);  // single $N
      const locParts = [];
      if (col("location_city"))  locParts.push(`LOWER(COALESCE(p.location_city,  '')) LIKE LOWER(${locVal})`);
      if (col("location_state")) locParts.push(`LOWER(COALESCE(p.location_state, '')) LIKE LOWER(${locVal})`);
      if (locParts.length > 0)   where.push(`(${locParts.join(" OR ")})`);
    }

    /* Promoted */
    if (promoted === "true" && col("is_promoted")) {
      where.push("p.is_promoted = true");
    }

    const whereClause = `WHERE ${where.join(" AND ")}`;

    /* ── Step 6: ORDER BY ── */
    // ✅ Fix Bug 4 — build order parts as array, join cleanly
    const buildOrder = (extra = []) => {
      const parts = [];
      if (col("is_promoted") && col("promotion_priority")) {
        parts.push("p.is_promoted DESC", "p.promotion_priority DESC NULLS LAST");
      }
      parts.push(...extra);
      return parts.join(", ");
    };

    const SORT_MAP = {
      relevance : buildOrder([
        ...(col("engagement_score") ? ["p.engagement_score DESC"] : []),
        ...(col("views")            ? ["p.views DESC"]            : []),
        "p.created_at DESC",
      ]),
      newest    : buildOrder(["p.created_at DESC"]),
      price_low : buildOrder(["p.price ASC",  "p.created_at DESC"]),
      price_high: buildOrder(["p.price DESC", "p.created_at DESC"]),
      popular   : buildOrder([
        ...(col("views") ? ["p.views DESC NULLS LAST"] : []),
        "p.created_at DESC",
      ]),
    };

    const orderBy = SORT_MAP[sort] || SORT_MAP.relevance;

    /* ── Step 7: Snapshot param count before adding pagination ── */
    // ✅ Fix Bug 3 — snapshot BEFORE pushing pagination params
    const countValues = [...values];

    values.push(perPage + 1);
    const limitP  = `$${values.length}`;
    values.push(offset);
    const offsetP = `$${values.length}`;

    /* ── Step 8: SQL strings ── */
    const mainSQL = `
      SELECT ${selectCols.join(",\n       ")}
      ${fromClause}
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT  ${limitP}
      OFFSET ${offsetP}
    `;

    const countSQL = `
      SELECT COUNT(*)::int AS total
      FROM public.products p
      ${hasCats && col("category_id")
        ? "LEFT JOIN public.categories c ON c.id = p.category_id"
        : ""}
      ${whereClause}
    `;

    /* ✅ Fix Bug 1 — suggestion WHERE built safely */
    const suggestionConditions = ["LOWER(p.title) LIKE $1"];
    if (col("is_active")) suggestionConditions.push("p.is_active = true");
    if (col("status"))    suggestionConditions.push("p.status = 'active'");
    if (col("is_deleted"))suggestionConditions.push("p.is_deleted = false");

    const suggestionSQL = `
      SELECT DISTINCT LEFT(p.title, 60) AS title
      FROM public.products p
      WHERE ${suggestionConditions.join(" AND ")}
      ORDER BY 1
      LIMIT 8
    `;

    console.log("[search] mainSQL:", mainSQL);
    console.log("[search] values:", values);

    /* ── Step 9: Execute ── */
    const [mainResult, countResult, suggestionResult] = await Promise.all([
      pool.query(mainSQL, values),
      pool.query(countSQL, countValues),
      query.length >= 2
        ? pool.query(suggestionSQL, [`%${query}%`])
        : Promise.resolve({ rows: [] }),
    ]);

    /* ── Step 10: Shape response ── */
    const rows    = mainResult.rows;
    const hasMore = rows.length > perPage;
    const records = hasMore ? rows.slice(0, perPage) : rows;
    const total   = countResult.rows[0]?.total ?? 0;

    const products = records.map((p) => {
      const image = p.main_image || p.thumbnail_url || null;
      const imgs  = Array.isArray(p.images) ? p.images.filter(Boolean) : [];

      return {
        id              : p.id,
        title           : p.title,
        description     : p.description     || null,
        price           : Number(p.price    || 0),
        original_price  : p.original_price  ? Number(p.original_price) : null,
        slug            : p.slug,
        image           : image || imgs[0]  || null,
        images          : imgs.length > 0   ? imgs : image ? [image] : [],
        views           : Number(p.views            || 0),
        clicks_count    : Number(p.clicks_count     || 0),
        engagement_score: Number(p.engagement_score || 0),
        promotion_priority: Number(p.promotion_priority || 0),
        is_promoted     : !!p.is_promoted,
        is_featured     : !!p.is_featured,
        favorites_count : Number(p.favorites_count  || 0),
        average_rating  : Number(p.average_rating   || 0),
        reviews_count   : Number(p.reviews_count    || 0),
        offer_type      : p.offer_type      || null,
        is_negotiable   : !!p.is_negotiable,   // ✅ consistent key
        condition       : p.condition       || null,
        brand           : p.brand           || null,
        model           : p.model           || null,
        seller_name     : p.seller_name     || null,
        seller_id       : p.seller_id       || null,
        category_id     : p.category_id     || null,
        category_name   : p.category_name   || null,
        location_city   : p.location_city   || null,
        location_state  : p.location_state  || null,
        attributes      : p.attributes      || {},
        created_at      : p.created_at,
        location: {
          city : p.location_city  || null,
          state: p.location_state || null,
        },
        seller: {
          id      : p.seller_id   || null,
          name    : p.seller_name || null,
          verified: !!p.seller_verified,
        },
      };
    });

    return res.json({
      query,
      total,
      page      : currentPage,
      perPage,
      totalPages: Math.ceil(total / perPage),
      has_more  : hasMore,
      products,
      suggestions: suggestionResult.rows.map((r) => r.title),
    });

  } catch (err) {
    console.error("[search] ERROR:", err.message);
    console.error("[search] STACK:", err.stack);

    return res.status(500).json({
      products   : [],
      total      : 0,
      suggestions: [],
      message    : "Search failed",
      debug      : process.env.NODE_ENV !== "production"
        ? err.message
        : undefined,
    });
  }
});

export default router;