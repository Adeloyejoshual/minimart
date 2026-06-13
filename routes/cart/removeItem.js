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
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    // Return updated cart count so frontend can sync
    const { rows: [cart] } = await pool.query(
      `SELECT c.id
       FROM market.carts c
       WHERE c.user_id = $1
       LIMIT 1`,
      [req.user.id]
    );

    let cartCount = 0;
    if (cart) {
      const { rows: [result] } = await pool.query(
        `SELECT COALESCE(SUM(qty), 0)::int AS count
         FROM market.cart_items
         WHERE cart_id = $1`,
        [cart.id]
      );
      cartCount = result.count;
    }

    res.json({
      success: true,
      message: "Item removed",
      data: { cartCount },
    });
  } catch (err) {
    console.error("[DELETE /api/cart/:itemId]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to remove item",
    });
  }
});

export default router;