/**
 * PATCH /api/cart/:itemId
 * Update quantity of a cart item.
 * Body: { qty }
 */

import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

router.patch("/:itemId", async (req, res) => {
  const { qty } = req.body;
  const quantity = parseInt(qty, 10);

  if (isNaN(quantity) || quantity < 1 || quantity > 99) {
    return res.status(422).json({ success: false, message: "qty must be 1–99" });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE market.cart_items ci
       SET qty = $1, updated_at = now()
       FROM market.carts c
       WHERE ci.id      = $2
         AND ci.cart_id = c.id
         AND c.user_id  = $3`,
      [quantity, req.params.itemId, req.user.id]
    );

    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    res.json({ success: true, message: "Quantity updated", data: { qty: quantity } });
  } catch (err) {
    console.error("[PATCH /api/cart/:itemId]", err.message);
    res.status(500).json({ success: false, message: "Failed to update item" });
  }
});

export default router;