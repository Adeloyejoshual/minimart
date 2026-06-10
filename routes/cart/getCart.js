/**
 * GET /api/cart
 * Returns full cart with LIVE prices and stock from DB.
 * Marks items that are out of stock or price-changed.
 */

import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;

    /* Get or create cart */
    let cart = await getOrCreateCart(userId);

    /* Fetch items with live product data */
    const { rows: items } = await pool.query(
      `SELECT
         ci.id            AS item_id,
         ci.qty,
         ci.price         AS cart_price,
         p.id             AS product_id,
         p.slug,
         p.name,
         p.price          AS current_price,
         p.status,
         p.is_active,
         p.deleted_at,
         pv.id            AS variant_id,
         pv.sku,
         pv.name          AS variant_name,
         pv.price         AS variant_price,
         pv.stock,
         pv.attributes,
         u.name           AS seller_name,
         u.id             AS seller_id,
         (
           SELECT pi.image_url
           FROM market.product_images pi
           WHERE pi.product_id = p.id
             AND pi.is_primary = true
           LIMIT 1
         ) AS image
       FROM market.cart_items ci
       JOIN market.products p ON p.id = ci.product_id
       LEFT JOIN market.product_variants pv ON pv.id = ci.variant_id
       LEFT JOIN market.users u ON u.id = p.user_id
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at ASC`,
      [cart.id]
    );

    /* Enrich items with live status */
    const enriched = items.map((item) => {
      const livePrice  = Number(item.variant_price ?? item.current_price);
      const cartPrice  = Number(item.cart_price);
      const priceChanged = livePrice !== cartPrice;

      const isDeleted    = !!item.deleted_at;
      const isInactive   = !item.is_active;
      const isUnapproved = !["active", "approved"].includes(item.status);
      const outOfStock   = Number(item.stock ?? 0) === 0;

      const unavailable = isDeleted || isInactive || isUnapproved;

      return {
        id:           item.item_id,
        productId:    item.product_id,
        slug:         item.slug,
        name:         item.name,
        image:        item.image,
        sellerName:   item.seller_name,
        sellerId:     item.seller_id,
        variant: item.variant_id ? {
          id:         item.variant_id,
          name:       item.variant_name,
          sku:        item.sku,
          attributes: item.attributes,
        } : null,
        qty:          item.qty,
        price:        livePrice,          /* always use live price */
        cartPrice,                         /* original price when added */
        priceChanged,
        outOfStock,
        unavailable,
        status:       item.status,
      };
    });

    /* Compute totals */
    const activeItems   = enriched.filter((i) => !i.unavailable && !i.outOfStock);
    const subtotal      = activeItems.reduce((s, i) => s + (i.price * i.qty), 0);
    const itemCount     = activeItems.reduce((s, i) => s + i.qty, 0);
    const priceChanges  = enriched.filter((i) => i.priceChanged).length;

    res.json({
      success: true,
      data: {
        cartId:       cart.id,
        items:        enriched,
        subtotal,
        itemCount,
        priceChanges,
        hasOutOfStock:  enriched.some((i) => i.outOfStock && !i.unavailable),
        hasUnavailable: enriched.some((i) => i.unavailable),
      },
    });
  } catch (err) {
    console.error("[GET /api/cart]", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch cart" });
  }
});

/* Helper — get or create cart for user */
export async function getOrCreateCart(userId) {
  const existing = await pool.query(
    "SELECT id FROM market.carts WHERE user_id = $1",
    [userId]
  );

  if (existing.rows.length) return existing.rows[0];

  const created = await pool.query(
    "INSERT INTO market.carts (user_id) VALUES ($1) RETURNING id",
    [userId]
  );

  return created.rows[0];
}

export default router;