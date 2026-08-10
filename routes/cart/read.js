/**
 * routes/cart/read.js
 *
 * GET /api/cart
 * Fetch the current buyer's cart with all items + product details.
 *
 * Auth: authenticateBuyer — public.users JWT
 *
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     cart_id       : "uuid",
 *     items         : [ { id, product_id, name, image_url, price, ... } ],
 *     item_count    : 3,
 *     total_qty     : 5,
 *     subtotal      : 12500,
 *     total_savings : 2500
 *   }
 * }
 */

import express                from "express";
import { authenticateBuyer }  from "../../middleware/auth.js";
import { pool, ok, fail }     from "../market/helpers.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   GET /
   Fetch active cart for the logged-in buyer
══════════════════════════════════════════════════════════════ */
router.get("/", authenticateBuyer, async (req, res) => {
  const userId = req.user.id;

  try {
    /* ── Find or create the buyer's active cart ── */
    let { rows: cartRows } = await pool.query(
      `SELECT id
       FROM market.carts
       WHERE user_id = $1
         AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    let cartId;

    if (cartRows.length === 0) {
      /* No cart yet — create one on demand */
      const { rows: newCart } = await pool.query(
        `INSERT INTO market.carts (user_id, status)
         VALUES ($1, 'active')
         RETURNING id`,
        [userId]
      );
      cartId = newCart[0].id;
    } else {
      cartId = cartRows[0].id;
    }

    /* ── Fetch items + product info via JOIN ── */
    const { rows: items } = await pool.query(
      `SELECT
         ci.id,
         ci.product_id,
         ci.variant_id,
         ci.qty,
         ci.added_at,

         p.name          AS product_name,
         p.slug,
         p.price         AS current_price,
         p.original_price,
         p.stock         AS product_stock,
         p.is_active,
         p.status,
         p.has_delivery,

         pi.image_url,
         pi.storage_key,

         pv.name  AS variant_name,
         pv.sku   AS variant_sku,
         pv.price AS variant_price,
         pv.stock AS variant_stock

       FROM market.cart_items ci
       LEFT JOIN market.products p
         ON p.id = ci.product_id
       LEFT JOIN market.product_variants pv
         ON pv.id = ci.variant_id
       LEFT JOIN LATERAL (
         SELECT image_url, storage_key
         FROM market.product_images
         WHERE product_id = ci.product_id
         ORDER BY is_primary DESC, sort_order ASC
         LIMIT 1
       ) pi ON true

       WHERE ci.cart_id = $1
       ORDER BY ci.added_at DESC`,
      [cartId]
    );

    /* ── Normalize items for frontend ── */
    const normalized = items.map((row) => {
      const price          = Number(row.variant_price ?? row.current_price ?? 0);
      const originalPrice  = Number(row.original_price ?? 0);
      const stock          = row.variant_id
        ? Number(row.variant_stock ?? 0)
        : Number(row.product_stock ?? 0);

      return {
        id             : row.id,
        product_id     : row.product_id,
        variant_id     : row.variant_id,
        product_name   : row.product_name,
        name           : row.product_name,   // alias for frontend
        slug           : row.slug,
        image_url      : row.image_url,
        image          : row.image_url,      // alias
        price          : price,
        original_price : originalPrice,
        stock          : stock,
        qty            : Number(row.qty),
        variant_name   : row.variant_name,
        variant_sku    : row.variant_sku,
        has_delivery   : row.has_delivery,
        added_at       : row.added_at,

        /* Availability flags */
        is_available   : row.is_active
                       && ["approved", "active"].includes(row.status)
                       && stock > 0,
        is_out_of_stock: stock === 0,
      };
    });

    /* ── Aggregate totals ── */
    const totals = normalized.reduce(
      (acc, item) => {
        const line     = item.price * item.qty;
        const savings  = item.original_price > item.price
          ? (item.original_price - item.price) * item.qty
          : 0;

        acc.subtotal      += line;
        acc.total_savings += savings;
        acc.total_qty     += item.qty;
        return acc;
      },
      { subtotal: 0, total_savings: 0, total_qty: 0 }
    );

    return ok(res, {
      data: {
        cart_id       : cartId,
        items         : normalized,
        item_count    : normalized.length,
        total_qty     : totals.total_qty,
        subtotal      : totals.subtotal,
        total_savings : totals.total_savings,
      },
    });

  } catch (err) {
    console.error("[cart/read] error:", err.message);
    console.error("[cart/read] code:", err.code);
    console.error("[cart/read] detail:", err.detail ?? "—");
    return fail(res, 500, "Failed to fetch cart");
  }
});

export default router;