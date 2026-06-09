/**
 * Product interactions
 * POST /:id/wishlist   — toggle wishlist
 * GET  /:id/wishlist   — check wishlist status
 * POST /:id/report     — report product
 * POST /:id/share      — track share
 */

import express from "express";
import { authenticate } from "../../middleware/auth.js";
import { pool, safeStr, ok, fail } from "./helpers.js";

const router = express.Router();

/**
 * POST /:id/wishlist
 * Toggle — add or remove from wishlist.
 */
router.post("/:id/wishlist", authenticate, async (req, res) => {
  try {
    const existing = await pool.query(
      "SELECT id FROM market.product_wishlists WHERE product_id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );

    if (existing.rows.length) {
      await pool.query(
        "DELETE FROM market.product_wishlists WHERE product_id = $1 AND user_id = $2",
        [req.params.id, req.user.id]
      );
      ok(res, { message: "Removed from wishlist", data: { wishlisted: false } });
    } else {
      await pool.query(
        `INSERT INTO market.product_wishlists (product_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.params.id, req.user.id]
      );
      ok(res, { message: "Added to wishlist", data: { wishlisted: true } }, 201);
    }
  } catch (err) {
    console.error("POST /products/:id/wishlist:", err);
    fail(res, 500, "Failed to update wishlist");
  }
});

/**
 * GET /:id/wishlist
 * Check if current user has wishlisted this product.
 */
router.get("/:id/wishlist", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM market.product_wishlists WHERE product_id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    ok(res, { data: { wishlisted: rows.length > 0 } });
  } catch (err) {
    console.error("GET /products/:id/wishlist:", err);
    fail(res, 500, "Failed to check wishlist");
  }
});

/**
 * POST /:id/report
 * Submit a report against a product.
 * Body: { reason, details? }
 */
router.post("/:id/report", authenticate, async (req, res) => {
  const reason = safeStr(req.body.reason, 200);
  if (!reason) return fail(res, 422, "A reason is required");

  try {
    /* Verify product exists */
    const prod = await pool.query(
      "SELECT id FROM market.products WHERE id = $1 AND deleted_at IS NULL",
      [req.params.id]
    );
    if (!prod.rows.length) return fail(res, 404, "Product not found");

    /* Prevent duplicate reports */
    const existing = await pool.query(
      `SELECT id FROM market.product_reports
       WHERE product_id = $1
         AND reporter_id = $2
         AND status = 'pending'`,
      [req.params.id, req.user.id]
    );

    if (existing.rows.length) {
      return fail(res, 409, "You already have a pending report for this product");
    }

    await pool.query(
      `INSERT INTO market.product_reports
         (product_id, reporter_id, reason, details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.params.id,
        req.user.id,
        reason,
        safeStr(req.body.details, 1000),
      ]
    );

    ok(res, { message: "Report submitted. Our team will review it." }, 201);
  } catch (err) {
    console.error("POST /products/:id/report:", err);
    fail(res, 500, "Failed to submit report");
  }
});

/**
 * POST /:id/share
 * Increment share count (called by client on share action).
 */
router.post("/:id/share", async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE market.products
       SET share_count = share_count + 1
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );

    if (!rowCount) return fail(res, 404, "Product not found");

    ok(res, { message: "Share tracked" });
  } catch (err) {
    console.error("POST /products/:id/share:", err);
    fail(res, 500, "Failed to track share");
  }
});

export default router;