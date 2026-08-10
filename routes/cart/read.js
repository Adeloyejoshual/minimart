/**
 * routes/cart/read.js
 * WITH STEP-BY-STEP DEBUG LOGGING
 *
 * GET /api/cart
 */

import express                from "express";
import { authenticateBuyer }  from "../../middleware/auth.js";
import { pool, ok, fail }     from "../market/helpers.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   GET /
══════════════════════════════════════════════════════════════ */
router.get("/", authenticateBuyer, async (req, res) => {
  const userId = req.user.id;
  console.log("═══════════════════════════════════════════");
  console.log("[cart/read] START | user:", userId);

  try {
    /* ═══════════════════════════════════════════
       STEP 1: Check if market.carts table exists
    ═══════════════════════════════════════════ */
    console.log("[cart/read] STEP 1: Check table exists");
    try {
      await pool.query(`SELECT 1 FROM market.carts LIMIT 1`);
      console.log("[cart/read] ✓ market.carts exists");
    } catch (e) {
      console.error("[cart/read] ❌ market.carts MISSING:", e.message);
      return fail(res, 500, "Cart system not initialized. Run migrations.");
    }

    /* ═══════════════════════════════════════════
       STEP 2: Find or create cart
    ═══════════════════════════════════════════ */
    console.log("[cart/read] STEP 2: Find active cart");
    let cartId;

    try {
      const { rows } = await pool.query(
        `SELECT id
         FROM market.carts
         WHERE user_id = $1
           AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (rows.length === 0) {
        console.log("[cart/read] No cart — creating new");
        const { rows: newCart } = await pool.query(
          `INSERT INTO market.carts (user_id, status)
           VALUES ($1, 'active')
           RETURNING id`,
          [userId]
        );
        cartId = newCart[0].id;
        console.log("[cart/read] ✓ Cart created:", cartId);
      } else {
        cartId = rows[0].id;
        console.log("[cart/read] ✓ Cart found:", cartId);
      }
    } catch (e) {
      console.error("[cart/read] ❌ Cart find/create failed:", e.message);
      console.error("[cart/read] ❌ Code:", e.code);
      console.error("[cart/read] ❌ Detail:", e.detail);
      return fail(res, 500, `Cart error: ${e.message}`);
    }

    /* ═══════════════════════════════════════════
       STEP 3: Check if market.cart_items exists
    ═══════════════════════════════════════════ */
    console.log("[cart/read] STEP 3: Check cart_items table");
    try {
      await pool.query(`SELECT 1 FROM market.cart_items LIMIT 1`);
      console.log("[cart/read] ✓ market.cart_items exists");
    } catch (e) {
      console.error("[cart/read] ❌ market.cart_items MISSING:", e.message);
      return fail(res, 500, "Cart items table missing. Run migrations.");
    }

    /* ═══════════════════════════════════════════
       STEP 4: Fetch items — SIMPLE query first
    ═══════════════════════════════════════════ */
    console.log("[cart/read] STEP 4: Fetch cart items (simple)");
    let simpleItems;
    try {
      const { rows } = await pool.query(
        `SELECT id, product_id, variant_id, qty, added_at
         FROM market.cart_items
         WHERE cart_id = $1
         ORDER BY added_at DESC`,
        [cartId]
      );
      simpleItems = rows;
      console.log(`[cart/read] ✓ Found ${rows.length} raw items`);
    } catch (e) {
      console.error("[cart/read] ❌ Simple items query failed:", e.message);
      return fail(res, 500, `Items query error: ${e.message}`);
    }

    /* ═══════════════════════════════════════════
       STEP 5: If no items, return empty cart
    ═══════════════════════════════════════════ */
    if (simpleItems.length === 0) {
      console.log("[cart/read] ✓ Cart is empty — returning early");
      return ok(res, {
        data: {
          cart_id       : cartId,
          items         : [],
          item_count    : 0,
          total_qty     : 0,
          subtotal      : 0,
          total_savings : 0,
        },
      });
    }

    /* ═══════════════════════════════════════════
       STEP 6: Enrich items with product info
       (Simple loop — no LATERAL join)
    ═══════════════════════════════════════════ */
    console.log("[cart/read] STEP 6: Enrich items");
    const enriched = [];

    for (const item of simpleItems) {
      try {
        /* Product */
        const { rows: prodRows } = await pool.query(
          `SELECT
             id, name, slug, price, original_price, stock,
             is_active, status, has_delivery
           FROM market.products
           WHERE id = $1`,
          [item.product_id]
        );

        if (prodRows.length === 0) {
          console.warn(`[cart/read] ⚠ Product ${item.product_id} not found — skipping`);
          continue;
        }
        const product = prodRows[0];

        /* Primary image */
        let imageUrl = null;
        try {
          const { rows: imgRows } = await pool.query(
            `SELECT image_url
             FROM market.product_images
             WHERE product_id = $1
             ORDER BY is_primary DESC NULLS LAST, sort_order ASC NULLS LAST
             LIMIT 1`,
            [item.product_id]
          );
          imageUrl = imgRows[0]?.image_url ?? null;
        } catch (e) {
          console.warn("[cart/read] ⚠ Image fetch failed:", e.message);
        }

        /* Variant (if any) */
        let variant = null;
        if (item.variant_id) {
          try {
            const { rows: varRows } = await pool.query(
              `SELECT id, name, sku, price, stock
               FROM market.product_variants
               WHERE id = $1`,
              [item.variant_id]
            );
            variant = varRows[0] ?? null;
          } catch (e) {
            console.warn("[cart/read] ⚠ Variant fetch failed:", e.message);
          }
        }

        /* Compose */
        const price = Number(variant?.price ?? product.price ?? 0);
        const originalPrice = Number(product.original_price ?? 0);
        const stock = variant
          ? Number(variant.stock ?? 0)
          : Number(product.stock ?? 0);

        enriched.push({
          id             : item.id,
          product_id     : item.product_id,
          variant_id     : item.variant_id,
          product_name   : product.name,
          name           : product.name,
          slug           : product.slug,
          image_url      : imageUrl,
          image          : imageUrl,
          price,
          original_price : originalPrice,
          stock,
          qty            : Number(item.qty),
          variant_name   : variant?.name ?? null,
          variant_sku    : variant?.sku ?? null,
          has_delivery   : product.has_delivery,
          added_at       : item.added_at,
          is_available   : product.is_active
                         && ["approved", "active"].includes(product.status)
                         && stock > 0,
          is_out_of_stock: stock === 0,
        });
      } catch (e) {
        console.error(`[cart/read] ❌ Enrich failed for item ${item.id}:`, e.message);
      }
    }

    console.log(`[cart/read] ✓ Enriched ${enriched.length} items`);

    /* ═══════════════════════════════════════════
       STEP 7: Totals
    ═══════════════════════════════════════════ */
    const totals = enriched.reduce(
      (acc, item) => {
        const line = item.price * item.qty;
        const savings = item.original_price > item.price
          ? (item.original_price - item.price) * item.qty
          : 0;
        acc.subtotal      += line;
        acc.total_savings += savings;
        acc.total_qty     += item.qty;
        return acc;
      },
      { subtotal: 0, total_savings: 0, total_qty: 0 }
    );

    console.log("[cart/read] ✓ SUCCESS | items:", enriched.length, "| total:", totals.subtotal);
    console.log("═══════════════════════════════════════════");

    return ok(res, {
      data: {
        cart_id       : cartId,
        items         : enriched,
        item_count    : enriched.length,
        total_qty     : totals.total_qty,
        subtotal      : totals.subtotal,
        total_savings : totals.total_savings,
      },
    });

  } catch (err) {
    console.error("═══════════════════════════════════════════");
    console.error("[cart/read] ❌ UNCAUGHT ERROR");
    console.error("[cart/read] Message:", err.message);
    console.error("[cart/read] Code:", err.code);
    console.error("[cart/read] Detail:", err.detail);
    console.error("[cart/read] Stack:", err.stack);
    console.error("═══════════════════════════════════════════");
    return fail(res, 500, `Cart error: ${err.message}`);
  }
});

export default router;