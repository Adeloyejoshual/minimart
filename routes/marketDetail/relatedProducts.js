/**
 * routes/marketDetail/reviews.js
 * POST /api/shop/:idOrSlug/reviews
 */

import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../../config/db.js";

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Session expired or invalid token. Please log in again.",
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

router.post("/:idOrSlug/reviews", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const { idOrSlug } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id || req.user.user_id || req.user.userId;

    const numericRating = parseInt(rating, 10);
    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID not found in token." });
    }
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5.",
      });
    }

    const productId = await resolveProductId(idOrSlug);
    if (!productId) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    await client.query("BEGIN");

    // 1. Auto-ensure table exists (CockroachDB safe)
    await client.query(`
      CREATE TABLE IF NOT EXISTS market.product_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL,
        user_id UUID NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT market_product_reviews_unique UNIQUE (product_id, user_id)
      );
    `);

    // 2. Ensure rating stats columns exist on market.products
    await client.query(`
      ALTER TABLE market.products
        ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS reviews_count INT DEFAULT 0;
    `);

    // 3. Upsert review
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

    // 4. Recalculate average rating & reviews count
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
    console.error("[POST /api/shop/:id/reviews Error]:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to submit review.",
      code: err.code,
      detail: err.detail || err.hint,
    });
  } finally {
    client.release();
  }
});

export default router;