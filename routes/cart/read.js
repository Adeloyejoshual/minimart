/**
 * routes/cart/read.js
 *
 * GET /api/cart
 *
 * Reads user's active cart with snapshot pricing.
 *
 * Price snapshot rule:
 *   - cart_items.price is set at add-time (locked in)
 *   - Falls back to current variant/product price if snapshot missing
 *   - This means seller price changes don't affect existing carts
 */

import express                from "express";
import { authenticateBuyer }  from "../../middleware/auth.js";
import { pool, ok, fail }     from "../market/helpers.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   COLUMN DETECTION (cached after first call)
══════════════════════════════════════════════════════════════ */
let COLUMNS_CACHED = null;

async function detectCartItemsColumns() {
  if (COLUMNS_CACHED) return COLUMNS_CACHED;

  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'market'
       AND table_name = 'cart_items'`
  );

  const cols = new Set(rows.map((r) => r.column_name));

  COLUMNS_CACHED = {
    hasPrice         : cols.has("price"),
    hasOriginalPrice : cols.has("original_price"),
    hasAddedAt       : cols.has("added_at"),
    hasCreatedAt     : cols.has("created_at"),
    hasUpdatedAt     : cols.has("updated_at"),

    /* Best column to ORDER BY (added_at → created_at → id) */
    orderColumn      : cols.has("added_at")   ? "added_at"
                     : cols.has("created_at") ? "created_at"
                     : "id",

    /* Best timestamp column to SELECT AS added_at */
    timestampCol     : cols.has("added_at")   ? "added_at"
                     : cols.has("created_at") ? "created_at"
                     : null,
  };

  console.log("[cart/read] Detected cart_items columns:", COLUMNS_CACHED);
  return COLUMNS_CACHED;
}

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
       STEP 2: Detect available columns
    ═══════════════════════════════════════════ */
    const cols = await detectCartItemsColumns();

    /* ═══════════════════════════════════════════
       STEP 3: Find or create cart
    ═══════════════════════════════════════════ */
    console.log("[cart/read] STEP 3: Find active cart");
    let cartId;

    try {
      const { rows } = await pool.query(
        `SELECT id
         FROM market.carts
         WHERE user_id = $1
           AND status = 'active'
         ORDER BY id DESC
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
       STEP 4: Check if market.cart_items exists
    ═══════════════════════════════════════════ */
    console.log("[cart/read] STEP 4: Check cart_items table");
    try {
      await pool.query(`SELECT 1 FROM market.cart_items LIMIT 1`);
      console.log("[cart/read] ✓ market.cart_items exists");
    } catch (e) {
      console.error("[cart/read] ❌ market.cart_items MISSING:", e.message);
      return fail(res, 500, "Cart items table missing. Run migrations.");
    }

    /* ═══════════════════════════════════════════
       STEP 5: Fetch items (dynamic columns)
       Selects snapshot price + original_price if columns exist
    ═══════════════════════════════════════════ */
    console.log(`[cart/read] STEP 5: Fetch items (ORDER BY ${cols.orderColumn})`);
    let simpleItems;
    try {
      const selectCols = [
        "id",
        "product_id",
        "variant_id",
        "qty",
        cols.hasPrice         ? "price"          : "NULL AS price",
        cols.hasOriginalPrice ? "original_price" : "NULL AS original_price",
        cols.timestampCol     ? `${cols.timestampCol} AS added_at`
                              : "NOW() AS added_at",
      ].join(", ");

      const { rows } = await pool.query(
        `SELECT ${selectCols}
         FROM market.cart_items
         WHERE cart_id = $1
         ORDER BY ${cols.orderColumn} DESC`,
        [cartId]
      );
      simpleItems = rows;
      console.log(`[cart/read] ✓ Found ${rows.length} raw items`);
    } catch (e) {
      console.error("[cart/read] ❌ Simple items query failed:", e.message);
      console.error("[cart/read] ❌ Code:", e.code);
      return fail(res, 500, `Items query error: ${e.message}`);
    }

    /* ═══════════════════════════════════════════
       STEP 6: If no items, return empty cart
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
       STEP 7: Enrich items with product info
    ═══════════════════════════════════════════ */
    console.log("[cart/read] STEP 7: Enrich items");
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

        /* ═══════════════════════════════════════════
           PRICING — Prefer snapshot from cart_items
           Fallback chain:
             1. cart_items.price (snapshot at add-time) ← preferred
             2. variant.price (current)
             3. product.price (current)
        ═══════════════════════════════════════════ */
        const price = Number(
          item.price          ??
          variant?.price      ??
          product.price       ??
          0
        );

        const originalPrice = Number(
          item.original_price   ??
          product.original_price ??
          0
        );

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
       STEP 8: Totals
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
    console.error("[cart/read] Stack:", err.stack?.split("\n").slice(0, 5).join("\n"));
    console.error("═══════════════════════════════════════════");
    return fail(res, 500, `Cart error: ${err.message}`);
  }
});

export default router;