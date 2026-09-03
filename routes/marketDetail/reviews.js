/**
 * routes/marketDetail/reviews.js
 * GET /api/shop/:idOrSlug/reviews
 * POST /api/shop/:idOrSlug/reviews
 */

import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../../config/db.js";

const router = express.Router();

let tableInitialized = false;

async function ensureReviewsTable() {
  if (tableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS market.product_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL,
        user_id TEXT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT market_product_reviews_unique UNIQUE (product_id, user_id)
      );
    `);
    tableInitialized = true;
  } catch (err) {
    console.warn("[reviews schema init warning]:", err.message);
  }
}

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Please log in to submit a review." });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key");
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
  }
};

async function resolveProductId(idOrSlug) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const q = isUuid
    ? `SELECT id FROM market.products WHERE id = $1 AND deleted_at IS NULL`
    : `SELECT id FROM market.products WHERE slug = $1 AND deleted_at IS NULL`;

  const { rows } = await pool.query(q, [idOrSlug]);
  return rows[0]?.id ?? null;
}

/* ── 1. GET /api/shop/:idOrSlug/reviews ── */
router.get("/:idOrSlug/reviews", async (req, res) => {
  await ensureReviewsTable();
  try {
    const { idOrSlug } = req.params;
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
    const offset = parseInt(req.query.offset || "0", 10);

    const productId = await resolveProductId(idOrSlug);
    if (!productId) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // Join with public.users or market.users to get reviewer name & avatar
    const { rows } = await pool.query(
      `SELECT
         r.id, 
         r.rating, 
         r.comment, 
         r.created_at,
         COALESCE(u.name, 'Verified Buyer') AS user_name,
         u.profile_image AS user_avatar
       FROM market.product_reviews r
       LEFT JOIN public.users u ON u.id::text = r.user_id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [productId, limit, offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM market.product_reviews WHERE product_id = $1`,
      [productId]
    );

    return res.json({
      success: true,
      data: rows,
      total: countRes.rows[0]?.total ?? 0,
    });
  } catch (err) {
    console.error("[GET /api/shop/:id/reviews Error]:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load reviews." });
  }
});

/* ── 2. POST /api/shop/:idOrSlug/reviews ── */
router.post("/:idOrSlug/reviews", authenticate, async (req, res) => {
  await ensureReviewsTable();
  const client = await pool.connect();
  try {
    const { idOrSlug } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user?.id || req.user?.user_id || req.user?.userId || req.user?.sub;

    const numericRating = parseInt(rating, 10);
    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID not found in token." });
    }
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
    }

    const productId = await resolveProductId(idOrSlug);
    if (!productId) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    await client.query("BEGIN");

    const upsertQuery = `
      INSERT INTO market.product_reviews (product_id, user_id, rating, comment, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (product_id, user_id)
      DO UPDATE SET
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const { rows: reviewRows } = await client.query(upsertQuery, [
      productId,
      String(userId),
      numericRating,
      comment ? comment.trim() : null,
    ]);

    const updateStatsQuery = `
      WITH stats AS (
        SELECT
          COALESCE(AVG(rating), 0) AS avg_rating,
          COUNT(*)::int AS total_reviews
        FROM market.product_reviews
        WHERE product_id = $1
      )
      UPDATE market.products
      SET
        rating = (SELECT avg_rating FROM stats),
        reviews_count = (SELECT total_reviews FROM stats)
      WHERE id = $1;
    `;

    await client.query(updateStatsQuery, [productId]);
    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully!",
      data: reviewRows[0],
    });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error("[POST /api/shop/:id/reviews Error]:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to submit review.",
    });
  } finally {
    client.release();
  }
});

export default router;