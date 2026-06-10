import express from "express";
import { pool } from "../../config/db.js";
import { authenticate } from "../../middleware/auth.js";

const router = express.Router();

router.get("/:id/wishlist", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM market.product_wishlists WHERE product_id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );

    res.json({
      success: true,
      data: { wishlisted: rows.length > 0 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to check wishlist" });
  }
});

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
      return res.json({ success: true, data: { wishlisted: false } });
    }

    await pool.query(
      "INSERT INTO market.product_wishlists (product_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [req.params.id, req.user.id]
    );

    res.json({ success: true, data: { wishlisted: true } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update wishlist" });
  }
});

export default router;