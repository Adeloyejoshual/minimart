/**
 * routes/marketDetail/reviews.js
 * POST /api/shop/:idOrSlug/reviews
 * GET  /api/shop/:idOrSlug/reviews
 */

import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../../config/db.js"; // or wherever your pool export is

const router = express.Router();

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Please log in to submit a review.",
      });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Session expired. Please log in again.",
    });
  }
};

async function resolveProductId(idOrSlug) {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrSlug
    );

  const q = isUuid
    ? `SELECT id FROM market.products WHERE id = $1 AND deleted_at IS NULL`
    : `SELECT id FROM market.products WHERE slug = $1 AND deleted_at IS NULL`;

  const { rows } = await pool.query(q, [idOrSlug]);
  return rows[0]?.id ?? null;
}

/* POST /:idOrSlug/reviews */
router.post("/:idOrSlug/reviews", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const { idOrSlug } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id || req.user.user_id;

    const numericRating = parseInt(rating, 10);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Invalid user token." });
    }
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5.",
      });
    }

    const productId = await resolveProductId(idOrSlug);
    if (!productId) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    await client.query("BEGIN");

    const { rows: reviewRows } = await client.query(
      `INSERT INTO market.product_reviews
         (product_id, user_id, rating, comment, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (product_id, user_id)
       DO UPDATE SET
         rating     = EXCLUDED.rating,
         comment    = EXCLUDED.comment,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [productId, userId, numericRating, comment?.trim() || null]
    );

    await client.query(
      `WITH stats AS (
         SELECT
           COALESCE(AVG(rating), 0) AS avg_rating,
           COUNT(*)::int            AS total_reviews
         FROM market.product_reviews
         WHERE product_id = $1
       )
       UPDATE market.products
       SET
         rating        = (SELECT avg_rating FROM stats),
         reviews_count = (SELECT total_reviews FROM stats)
       WHERE id = $1`,
      [productId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully!",
      data: reviewRows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[POST /api/shop/:id/reviews]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to submit review.",
    });
  } finally {
    client.release();
  }
});

/* GET /:idOrSlug/reviews (optional list) */
router.get("/:idOrSlug/reviews", async (req, res) => {
  try {
    const productId = await resolveProductId(req.params.idOrSlug);
    if (!productId) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
    const offset = parseInt(req.query.offset || "0", 10);

    const { rows } = await pool.query(
      `SELECT
         r.id, r.rating, r.comment, r.created_at,
         u.name AS user_name,
         u.profile_image AS user_avatar
       FROM market.product_reviews r
       LEFT JOIN market.users u ON u.id = r.user_id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [productId, limit, offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM market.product_reviews
       WHERE product_id = $1`,
      [productId]
    );

    return res.json({
      success: true,
      data: rows,
      total: countRes.rows[0]?.total ?? 0,
    });
  } catch (err) {
    console.error("[GET /api/shop/:id/reviews]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to load reviews.",
    });
  }
});

export default router;