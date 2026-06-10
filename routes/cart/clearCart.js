/**
 * DELETE /api/cart
 * Clear all items from cart.
 */

import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

router.delete("/", async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.cart_id = c.id
         AND c.user_id  = $1`,
      [req.user.id]
    );

    res.json({ success: true, message: "Cart cleared" });
  } catch (err) {
    console.error("[DELETE /api/cart]", err.message);
    res.status(500).json({ success: false, message: "Failed to clear cart" });
  }
});

export default router;