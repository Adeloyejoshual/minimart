// routes/homepage.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const {
    lat,
    lng,
    page        = 0,
    limit       = 40,
    category_id,
    section,
    state,
    city,
  } = req.query;

  try {
    const realLimit = Math.min(Number(limit) || 40, 80);
    const offset    = Number(page) * realLimit;
    const values    = [];
    const where     = [
      `is_active = true`,
      `status = 'active'`,
    ];

    const push = (v) => { values.push(v); return `$${values.length}`; };

    /* ── Category filter ── */
    if (category_id) {
      where.push(`category_id = ${push(category_id)}::uuid`);
    }

    /* ── Location filters ── */
    if (state) {
      where.push(`LOWER(location_state) = LOWER(${push(state)})`);
    }
    if (city) {
      where.push(`LOWER(location_city) = LOWER(${push(city)})`);
    }

    /* ── Section-specific filters ── */
    let orderBy = `is_promoted DESC, engagement_score DESC, created_at DESC`;

    switch (section) {
      case "trending":
        where.push(`(engagement_score > 0 OR clicks_count > 0)`);
        orderBy = `engagement_score DESC, clicks_count DESC`;
        break;
      case "deals":
        where.push(`price > 0`);
        where.push(`price <= 50000`);
        orderBy = `price ASC`;
        break;
      case "latest":
        orderBy = `created_at DESC`;
        break;
      case "nearby":
        orderBy = `created_at DESC`;
        break;
      default:
        break;
    }

    /* ── Pagination ── */
    values.push(realLimit + 1);
    const limitP = `$${values.length}`;

    values.push(offset);
    const offsetP = `$${values.length}`;

    /* ── Query — only safe columns ── */
    const sql = `
      SELECT
        id,
        title,
        price,
        slug,
        main_image,
        thumbnail_url,
        views,
        clicks_count,
        impression_count,
        engagement_score,
        promotion_priority,
        is_promoted,
        location_city,
        location_state,
        latitude,
        longitude,
        created_at,
        category_id,
        seller_id,
        favorites_count,
        offer_type
      FROM public.products
      WHERE ${where.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT ${limitP}
      OFFSET ${offsetP}
    `;

    console.log("[homepage] SQL:", sql);
    console.log("[homepage] values:", values);

    const { rows } = await pool.query(sql, values);

    const hasMore = rows.length > realLimit;
    const records = hasMore ? rows.slice(0, realLimit) : rows;

    /* ── Shape products ── */
    const products = records.map((p) => {
      const image = p.main_image || p.thumbnail_url || null;

      let distance_km = null;
      if (lat && lng && p.latitude && p.longitude) {
        const R    = 6371;
        const dLat = ((Number(p.latitude)  - Number(lat)) * Math.PI) / 180;
        const dLon = ((Number(p.longitude) - Number(lng)) * Math.PI) / 180;
        const a    =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((Number(lat) * Math.PI) / 180) *
          Math.cos((Number(p.latitude) * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
        distance_km = Math.round(
          R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10
        ) / 10;
      }

      return {
        id                : p.id,
        title             : p.title,
        price             : p.price,
        slug              : p.slug,
        image,
        images            : image ? [image] : [],
        views             : p.views,
        clicks_count      : p.clicks_count,
        impression_count  : p.impression_count,
        engagement_score  : p.engagement_score,
        promotion_priority: p.promotion_priority,
        is_promoted       : p.is_promoted,
        favorites_count   : p.favorites_count,
        offer_type        : p.offer_type,
        created_at        : p.created_at,
        category_id       : p.category_id,
        seller_id         : p.seller_id,
        location_city     : p.location_city  || null,
        location_state    : p.location_state || null,
        location: {
          city  : p.location_city  || null,
          state : p.location_state || null,
        },
        distance_km,
      };
    });

    return res.json({
      products,
      featured : products.filter((p) => p.is_promoted).slice(0, 4),
      hasMore,
      meta: {
        page     : Number(page),
        returned : products.length,
        has_more : hasMore,
        section  : section || "all",
        location : null,
      },
    });

  } catch (err) {
    /* ── LOG THE FULL ERROR ── */
    console.error("[homepage] FULL ERROR:", err);
    console.error("[homepage] message:", err.message);
    console.error("[homepage] stack:", err.stack);

    return res.status(500).json({
      error   : "Failed to load products",
      message : err.message,
      /* Show column name in dev */
      hint    : err.message.includes("column")
        ? "A column in the query does not exist in your database"
        : undefined,
    });
  }
});

/* ── Analytics (view/click) ── */
router.post("/products/:id/view", async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.products
       SET views = COALESCE(views, 0) + 1
       WHERE id = $1::uuid`,
      [req.params.id]
    );
  } catch {}
  res.sendStatus(204);
});

router.post("/products/:id/click", async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.products
       SET clicks_count = COALESCE(clicks_count, 0) + 1
       WHERE id = $1::uuid`,
      [req.params.id]
    );
  } catch {}
  res.sendStatus(204);
});

export default router;