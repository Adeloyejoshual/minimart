import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

router.get("/related/:category/:excludeId", async (req, res) => {
  try {
    const { category, excludeId } = req.params;

    const { rows } = await pool.query(
      `SELECT id, slug, name, price, original_price, brand, view_count,
              is_featured, is_trending
       FROM market.products
       WHERE category = $1
         AND id != $2
         AND status IN ('approved', 'active')
         AND is_active = true
         AND is_hidden = false
         AND is_paused = false
         AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 8`,
      [category, excludeId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[GET related]", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch related products" });
  }
});

export default router;