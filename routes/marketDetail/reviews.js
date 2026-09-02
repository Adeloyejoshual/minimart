/**
 * routes/products/reviews.js
 * Handles: POST /api/shop/:idOrSlug/reviews
 */

import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../../config/db.js";

const router = express.Router();

// Auth Middleware
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Please log in to leave a review." });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
  }
};

// POST /:idOrSlug/reviews
router.post("/:idOrSlug/reviews", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const { idOrSlug } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id || req.user.user_id;

    const numericRating = parseInt(rating, 10);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
    }

    // Resolve Product UUID if slug was passed
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    let productId = null;

    if (isUuid) {
      productId = idOrSlug;
    } else {
      const pRes = await client.query(
        "SELECT id FROM market.products WHERE slug = $1 AND deleted_at IS NULL",
        [idOrSlug]
      );
      if (!pRes.rows.length) {
        return res.status(404).json({ success: false, message: "Product not found." });
      }
      productId = pRes.rows[0].id;
    }

    await client.query("BEGIN");

    // Upsert review (1 review per user per product)
    const reviewQuery = `
      INSERT INTO market.product_reviews (product_id, user_id, rating, comment, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (product_id, user_id) 
      DO UPDATE SET 
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const { rows: reviewRows } = await client.query(reviewQuery, [
      productId,
      userId,
      numericRating,
      comment ? comment.trim() : null,
    ]);

    // Recalculate average rating & total review count
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

    res.status(201).json({
      success: true,
      message: "Rating submitted successfully!",
      data: reviewRows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[POST /reviews Error]:", err.message);
    res.status(500).json({ success: false, message: "Failed to submit rating." });
  } finally {
    client.release();
  }
});

export default router;