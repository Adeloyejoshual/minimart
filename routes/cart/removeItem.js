/**
 * DELETE /api/cart/:itemId
 * Remove a single item from cart.
 */

import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

router.delete("/:itemId", async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.id      = $1
         AND ci.cart_id = c.id
         AND c.user_id  = $2`,
      [req.params.itemId, req.user.id]
    );

    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    res.json({ success: true, message: "Item removed from cart" });
  } catch (err) {
    console.error("[DELETE /api/cart/:itemId]", err.message);
    res.status(500).json({ success: false, message: "Failed to remove item" });
  }
});

export default router;