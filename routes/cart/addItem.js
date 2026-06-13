// cart/addItem.js
/**
 * POST /api/cart
 * Body: { productId, variantId?, qty? }
 */

import express from "express";
import { pool } from "../../config/db.js";
import { getOrCreateCart } from "./getCart.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { productId, variantId, qty = 1 } = req.body;

  if (!productId) {
    return res.status(422).json({
      success: false,
      message: "productId is required",
    });
  }

  const quantity = Math.max(1, Math.min(99, parseInt(qty, 10) || 1));

  try {
    /* Validate product */
    const { rows: [product] } = await pool.query(
      `SELECT id, price, compare_price, status, is_active, deleted_at,
              COALESCE(stock, 0) AS stock
       FROM market.products
       WHERE id = $1`,
      [productId]
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.deleted_at || !product.is_active) {
      return res.status(400).json({
        success: false,
        message: "Product is no longer available",
      });
    }

    /* Resolve price and stock */
    let livePrice = Number(product.price);
    let maxStock  = Number(product.stock) || 99;

    if (variantId) {
      const { rows: [variant] } = await pool.query(
        `SELECT id, price, stock
         FROM market.product_variants
         WHERE id = $1 AND product_id = $2`,
        [variantId, productId]
      );

      if (!variant) {
        return res.status(404).json({
          success: false,
          message: "Variant not found",
        });
      }

      livePrice = Number(variant.price ?? product.price);
      maxStock  = Number(variant.stock ?? product.stock) || 99;
    }

    if (maxStock === 0) {
      return res.status(400).json({
        success: false,
        message: "Item is out of stock",
      });
    }

    const safeQty = Math.min(quantity, maxStock);
    const cart    = await getOrCreateCart(req.user.id);

    await pool.query(
      `INSERT INTO market.cart_items
         (cart_id, product_id, variant_id, qty, price)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (cart_id, product_id, variant_id)
       DO UPDATE SET
         qty        = LEAST(market.cart_items.qty + $4, $6),
         price      = $5,
         updated_at = now()`,
      [cart.id, productId, variantId ?? null, safeQty, livePrice, maxStock]
    );

    await pool.query(
      "UPDATE market.carts SET updated_at = now() WHERE id = $1",
      [cart.id]
    );

    const { rows: [{ count }] } = await pool.query(
      "SELECT SUM(qty)::int AS count FROM market.cart_items WHERE cart_id = $1",
      [cart.id]
    );

    res.status(201).json({
      success: true,
      message: "Item added to cart",
      data:    { cartCount: count ?? 0 },
    });
  } catch (err) {
    console.error("[POST /api/cart]", err);
    res.status(500).json({ success: false, message: "Failed to add item" });
  }
});

export default router;