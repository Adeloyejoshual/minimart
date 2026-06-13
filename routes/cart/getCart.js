import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

export async function getOrCreateCart(userId) {
  const { rows } = await pool.query(
    "SELECT id FROM market.carts WHERE user_id = $1 LIMIT 1",
    [userId]
  );
  if (rows.length) return rows[0];

  const { rows: created } = await pool.query(
    "INSERT INTO market.carts (user_id) VALUES ($1) RETURNING id",
    [userId]
  );
  return created[0];
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await getOrCreateCart(userId);

    const { rows: items } = await pool.query(
      `SELECT
         ci.id              AS item_id,
         ci.qty,
         ci.price           AS cart_price,
         p.id               AS product_id,
         p.slug,
         p.name,
         p.price            AS current_price,
         p.compare_price,
         p.status,
         p.is_active,
         p.deleted_at,
         p.user_id          AS seller_id,
         u.name             AS seller_name,
         pv.id              AS variant_id,
         pv.sku,
         pv.name            AS variant_name,
         pv.price           AS variant_price,
         pv.compare_price   AS variant_compare_price,
         pv.stock           AS variant_stock,
         pv.attributes,
         pv.stock           AS raw_variant_stock,
         p.stock            AS raw_product_stock,
         (
           SELECT pi.image_url
           FROM   market.product_images pi
           WHERE  pi.product_id = p.id
             AND  pi.is_primary = true
           LIMIT  1
         ) AS image
       FROM  market.cart_items ci
       JOIN  market.products p        ON p.id  = ci.product_id
       LEFT  JOIN market.product_variants pv ON pv.id = ci.variant_id
       LEFT  JOIN market.users u      ON u.id  = p.user_id
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at ASC`,
      [cart.id]
    );

    let priceChanges = 0;

    const enriched = items.map((row) => {
      const livePrice = Number(row.variant_price ?? row.current_price ?? 0);
      const comparePrice = Number(row.variant_compare_price ?? row.compare_price ?? 0);
      const cartPrice = Number(row.cart_price ?? 0);

      const priceChanged = livePrice !== cartPrice;
      if (priceChanged) priceChanges++;

      const isDeleted = Boolean(row.deleted_at);
      const isInactive = !row.is_active;
      const isUnapproved = !["active", "approved"].includes(row.status);
      const unavailable = isDeleted || isInactive || isUnapproved;

      // ── Stock handling ──
      // NULL stock = seller never set stock = treat as unlimited
      // 0 stock    = seller explicitly set 0 = out of stock
      const rawStock = row.raw_variant_stock ?? row.raw_product_stock;
      const hasStockTracking = rawStock !== null && rawStock !== undefined;
      const stock = hasStockTracking ? Number(rawStock) : null;
      const outOfStock = !unavailable && hasStockTracking && stock === 0;

      // ── Qty capping ──
      // Only cap qty if stock is explicitly tracked
      // If no stock tracking → keep whatever qty user set
      let qty = row.qty;
      if (hasStockTracking && stock > 0 && qty > stock) {
        qty = stock;
      }
      if (outOfStock) {
        qty = row.qty; // keep qty so user sees what they had
      }

      return {
        id:           row.item_id,
        productId:    row.product_id,
        slug:         row.slug,
        name:         row.name,
        image:        row.image ?? null,
        images:       row.image ? [row.image] : [],
        sellerId:     row.seller_id,
        sellerName:   row.seller_name,
        variant:      row.variant_id
          ? {
              id:         row.variant_id,
              name:       row.variant_name,
              sku:        row.sku,
              attributes: row.attributes,
            }
          : null,
        qty,
        price:         livePrice,
        comparePrice:  comparePrice > livePrice ? comparePrice : null,
        originalPrice: comparePrice > livePrice ? comparePrice : null,
        cartPrice,
        priceChanged,
        stock:         hasStockTracking ? stock : null,
        outOfStock,
        unavailable,
        status:        row.status,
      };
    });

    const activeItems = enriched.filter((i) => !i.unavailable && !i.outOfStock);
    const subtotal = activeItems.reduce((s, i) => s + i.price * i.qty, 0);
    const itemCount = activeItems.reduce((s, i) => s + i.qty, 0);

    res.json({
      success: true,
      data: {
        cartId:        cart.id,
        items:         enriched,
        subtotal,
        itemCount,
        priceChanges,
        hasOutOfStock:  enriched.some((i) => i.outOfStock && !i.unavailable),
        hasUnavailable: enriched.some((i) => i.unavailable),
      },
    });
  } catch (err) {
    console.error("[GET /api/cart]", err);
    res.status(500).json({ success: false, message: "Failed to fetch cart" });
  }
});

export default router;