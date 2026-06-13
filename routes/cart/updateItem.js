import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

router.patch("/:itemId", async (req, res) => {
  const { qty } = req.body;
  const quantity = parseInt(qty, 10);

  if (!Number.isFinite(quantity) || quantity < 1) {
    return res.status(422).json({
      success: false,
      message: "qty must be a positive integer",
    });
  }

  try {
    const { rows: [item] } = await pool.query(
      `SELECT
         ci.id,
         ci.qty,
         pv.stock AS variant_stock,
         p.stock  AS product_stock
       FROM  market.cart_items ci
       JOIN  market.carts c              ON c.id  = ci.cart_id
       JOIN  market.products p           ON p.id  = ci.product_id
       LEFT  JOIN market.product_variants pv ON pv.id = ci.variant_id
       WHERE ci.id      = $1
         AND c.user_id  = $2`,
      [req.params.itemId, req.user.id]
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    // NULL stock = no tracking = allow up to 99
    const rawStock = item.variant_stock ?? item.product_stock;
    const hasStockTracking = rawStock !== null && rawStock !== undefined;
    const maxQty = hasStockTracking ? Number(rawStock) : 99;
    const safeQty = Math.max(1, Math.min(quantity, maxQty || 99));

    const { rows: [updated] } = await pool.query(
      `UPDATE market.cart_items ci
         SET qty        = $1,
             updated_at = now()
         FROM market.carts c
         WHERE ci.id      = $2
           AND ci.cart_id = c.id
           AND c.user_id  = $3
         RETURNING ci.qty`,
      [safeQty, req.params.itemId, req.user.id]
    );

    res.json({
      success: true,
      message: "Quantity updated",
      data: {
        qty:    updated.qty,
        capped: safeQty < quantity,
        maxQty: maxQty || 99,
      },
    });
  } catch (err) {
    console.error("[PATCH /api/cart/:itemId]", err);
    res.status(500).json({ success: false, message: "Failed to update item" });
  }
});

export default router;