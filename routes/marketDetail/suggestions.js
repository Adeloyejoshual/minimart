// routes/products/suggestions.js

/**
 * GET /api/products/suggestions?exclude=id1,id2&limit=16
 * GET /api/products/trending?limit=16
 *
 * ⚠️  MUST be registered BEFORE /:slug in the router
 *     or "suggestions" and "trending" will be treated as slugs
 */

import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   SHARED — product card select (lightweight, no joins for speed)
───────────────────────────────────────────────────────────── */
const CARD_SELECT = `
  SELECT
    p.id,
    p.slug,
    p.name,
    p.price,
    p.compare_price,
    p.category,
    p.rating,
    p.review_count,
    p.view_count,
    p.created_at,
    COALESCE(p.stock, 0)                              AS stock,
    (p.created_at > now() - interval '14 days')       AS is_new,
    (
      SELECT pi.image_url
      FROM   market.product_images pi
      WHERE  pi.product_id = p.id
        AND  pi.is_primary = true
      LIMIT  1
    ) AS image
  FROM market.products p
  WHERE p.is_active  = true
    AND p.status     IN ('active', 'approved')
    AND p.is_hidden  = false
    AND p.is_paused  = false
    AND p.deleted_at IS NULL
`;

/* ─────────────────────────────────────────────────────────
   Map a DB row → clean product card object
───────────────────────────────────────────────────────── */
function toCard(row) {
  const price        = Number(row.price        ?? 0);
  const comparePrice = Number(row.compare_price ?? 0);

  return {
    id:           row.id,
    slug:         row.slug,
    name:         row.name,
    price,
    compare_price: comparePrice > price ? comparePrice : null,
    category:     row.category    ?? null,
    rating:       Number(row.rating       ?? 0),
    reviewCount:  Number(row.review_count ?? 0),
    stock:        Number(row.stock        ?? 0),
    isNew:        Boolean(row.is_new),
    image:        row.image ?? null,
    images:       row.image ? [row.image] : [],
  };
}

/* ─────────────────────────────────────────────────────────
   Validate UUID so we never pass user input raw to SQL
───────────────────────────────────────────────────────── */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeUUIDs(raw = "") {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s));
}

/* ══════════════════════════════════════════════════════════
   GET /suggestions
   Random active products, excluding cart / current product
══════════════════════════════════════════════════════════ */
router.get("/suggestions", async (req, res) => {
  try {
    const limit      = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
    const excludeIds = safeUUIDs(req.query.exclude ?? "");

    let rows;

    if (excludeIds.length > 0) {
      ({ rows } = await pool.query(
        `${CARD_SELECT}
           AND p.id != ALL($1::uuid[])
         ORDER BY random()
         LIMIT $2`,
        [excludeIds, limit]
      ));
    } else {
      ({ rows } = await pool.query(
        `${CARD_SELECT}
         ORDER BY random()
         LIMIT $1`,
        [limit]
      ));
    }

    res.json({
      success: true,
      data:    { products: rows.map(toCard) },
    });
  } catch (err) {
    console.error("[GET /api/products/suggestions]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch suggestions",
    });
  }
});

/* ══════════════════════════════════════════════════════════
   GET /trending
   Ordered by view_count → rating → newest
══════════════════════════════════════════════════════════ */
router.get("/trending", async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);

    const { rows } = await pool.query(
      `${CARD_SELECT}
       ORDER BY
         COALESCE(p.view_count, 0) DESC,
         COALESCE(p.rating,     0) DESC,
         p.created_at              DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      success: true,
      data:    { products: rows.map(toCard) },
    });
  } catch (err) {
    console.error("[GET /api/products/trending]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch trending products",
    });
  }
});

export default router;