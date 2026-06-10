/**
 * Save for later / move back to cart / get saved / remove saved
 *
 * POST   /api/cart/save/:itemId   → move cart item → saved
 * POST   /api/cart/move/:itemId   → move saved item → cart
 * GET    /api/cart/saved          → list saved items
 * DELETE /api/cart/saved/:itemId  → remove saved item
 */

import express from "express";
import { pool } from "../../config/db.js";
import { getOrCreateCart } from "./getCart.js";

const router = express.Router();

/* Move cart item → saved for later */
router.post("/save/:itemId", async (req, res) => {
  try {
    /* Get cart item */
    const { rows: [item] } = await pool.query(
      `SELECT ci.product_id, ci.variant_id, ci.price
       FROM market.cart_items ci
       JOIN market.carts c ON c.id = ci.cart_id
       WHERE ci.id = $1 AND c.user_id = $2`,
      [req.params.itemId, req.user.id]
    );

    if (!item) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    /* Save item */
    await pool.query(
      `INSERT INTO market.saved_items (user_id, product_id, variant_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id, variant_id) DO NOTHING`,
      [req.user.id, item.product_id, item.variant_id]
    );

    /* Remove from cart */
    await pool.query(
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.id = $1 AND ci.cart_id = c.id AND c.user_id = $2`,
      [req.params.itemId, req.user.id]
    );

    res.json({ success: true, message: "Saved for later" });
  } catch (err) {
    console.error("[POST /api/cart/save/:itemId]", err.message);
    res.status(500).json({ success: false, message: "Failed to save item" });
  }
});

/* Move saved item → cart */
router.post("/move/:itemId", async (req, res) => {
  try {
    /* Get saved item */
    const { rows: [saved] } = await pool.query(
      `SELECT si.product_id, si.variant_id, p.price AS product_price,
              pv.price AS variant_price
       FROM market.saved_items si
       JOIN market.products p ON p.id = si.product_id
       LEFT JOIN market.product_variants pv ON pv.id = si.variant_id
       WHERE si.id = $1 AND si.user_id = $2`,
      [req.params.itemId, req.user.id]
    );

    if (!saved) {
      return res.status(404).json({ success: false, message: "Saved item not found" });
    }

    const livePrice = Number(saved.variant_price ?? saved.product_price);
    const cart      = await getOrCreateCart(req.user.id);

    /* Add to cart */
    await pool.query(
      `INSERT INTO market.cart_items (cart_id, product_id, variant_id, qty, price)
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (cart_id, product_id, variant_id)
       DO UPDATE SET qty = LEAST(market.cart_items.qty + 1, 99), updated_at = now()`,
      [cart.id, saved.product_id, saved.variant_id, livePrice]
    );

    /* Remove from saved */
    await pool.query(
      "DELETE FROM market.saved_items WHERE id = $1 AND user_id = $2",
      [req.params.itemId, req.user.id]
    );

    res.json({ success: true, message: "Moved to cart" });
  } catch (err) {
    console.error("[POST /api/cart/move/:itemId]", err.message);
    res.status(500).json({ success: false, message: "Failed to move item" });
  }
});

/* Get saved items */
router.get("/saved", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         si.id,
         si.created_at,
         p.id    AS product_id,
         p.slug,
         p.name,
         p.price AS current_price,
         pv.id   AS variant_id,
         pv.name AS variant_name,
         pv.sku,
         pv.attributes,
         (
           SELECT pi.image_url
           FROM market.product_images pi
           WHERE pi.product_id = p.id AND pi.is_primary = true
           LIMIT 1
         ) AS image
       FROM market.saved_items si
       JOIN market.products p ON p.id = si.product_id
       LEFT JOIN market.product_variants pv ON pv.id = si.variant_id
       WHERE si.user_id = $1
       ORDER BY si.created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data:    rows.map((r) => ({
        id:        r.id,
        productId: r.product_id,
        slug:      r.slug,
        name:      r.name,
        image:     r.image,
        price:     Number(r.current_price),
        variant:   r.variant_id ? {
          id:         r.variant_id,
          name:       r.variant_name,
          sku:        r.sku,
          attributes: r.attributes,
        } : null,
        savedAt:   r.created_at,
      })),
    });
  } catch (err) {
    console.error("[GET /api/cart/saved]", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch saved items" });
  }
});

/* Remove saved item */
router.delete("/saved/:itemId", async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM market.saved_items WHERE id = $1 AND user_id = $2",
      [req.params.itemId, req.user.id]
    );

    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Saved item not found" });
    }

    res.json({ success: true, message: "Removed from saved" });
  } catch (err) {
    console.error("[DELETE /api/cart/saved/:itemId]", err.message);
    res.status(500).json({ success: false, message: "Failed to remove saved item" });
  }
});

export default router;