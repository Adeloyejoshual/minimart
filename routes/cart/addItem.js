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

  const safeVariantId = variantId ?? null;
  const quantity = Math.max(1, Math.min(99, parseInt(qty, 10) || 1));

  try {
    const { rows: [product] } = await pool.query(
      `SELECT id, price, compare_price, status, is_active, deleted_at, stock
       FROM market.products
       WHERE id = $1`,
      [productId]
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (product.deleted_at || !product.is_active) {
      return res.status(400).json({ success: false, message: "Product is no longer available" });
    }

    let livePrice = Number(product.price);
    let rawStock = product.stock;

    if (safeVariantId) {
      const { rows: [variant] } = await pool.query(
        `SELECT id, price, stock
         FROM market.product_variants
         WHERE id = $1 AND product_id = $2`,
        [safeVariantId, productId]
      );

      if (!variant) {
        return res.status(404).json({ success: false, message: "Variant not found" });
      }

      livePrice = Number(variant.price ?? product.price);
      rawStock = variant.stock ?? product.stock;
    }

    // NULL stock = no tracking = unlimited
    const hasStockTracking = rawStock !== null && rawStock !== undefined;
    const maxStock = hasStockTracking ? Number(rawStock) : 99;

    if (hasStockTracking && maxStock === 0) {
      return res.status(400).json({ success: false, message: "Item is out of stock" });
    }

    const safeQty = Math.min(quantity, maxStock || 99);
    const cart = await getOrCreateCart(req.user.id);

    // Check if item already exists
    const { rows: [existing] } = await pool.query(
      `SELECT id, qty
       FROM market.cart_items
       WHERE cart_id    = $1
         AND product_id = $2
         AND (
           (variant_id IS NULL AND $3::uuid IS NULL)
           OR (variant_id = $3)
         )
       LIMIT 1`,
      [cart.id, productId, safeVariantId]
    );

    if (existing) {
      const newQty = Math.min(existing.qty + safeQty, maxStock || 99);
      await pool.query(
        `UPDATE market.cart_items
         SET qty = $1, price = $2, updated_at = now()
         WHERE id = $3`,
        [newQty, livePrice, existing.id]
      );
    } else {
      await pool.query(
        `INSERT INTO market.cart_items (cart_id, product_id, variant_id, qty, price)
         VALUES ($1, $2, $3, $4, $5)`,
        [cart.id, productId, safeVariantId, safeQty, livePrice]
      );
    }

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
      message: existing ? "Cart updated" : "Item added to cart",
      data: { cartCount: count ?? 0 },
    });
  } catch (err) {
    console.error("[POST /api/cart]", err);
    res.status(500).json({ success: false, message: "Failed to add item" });
  }
});

export default router;