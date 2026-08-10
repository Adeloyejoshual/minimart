/**
 * routes/cart/write.js
 *
 * Mutation endpoints for cart:
 *   POST   /api/cart/items         → add item (with price snapshot)
 *   PATCH  /api/cart/items/:id     → update quantity
 *   DELETE /api/cart/items/:id     → remove single item
 *   DELETE /api/cart               → clear entire cart
 *
 * Auth: authenticateBuyer — public.users JWT (buyers only)
 *
 * Price snapshot rule:
 *   When adding to cart, we lock in the CURRENT price of the
 *   product/variant. This means:
 *   - Seller can change price later — cart still shows old price
 *   - Protects buyer from surprise price hikes at checkout
 *   - Amazon/Jumia/Shopee all do this
 */

import express                from "express";
import { authenticateBuyer }  from "../../middleware/auth.js";
import { pool, ok, fail }     from "../market/helpers.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   HELPER — Get or create active cart for buyer
══════════════════════════════════════════════════════════════ */
async function getOrCreateCart(client, userId) {
  const { rows } = await client.query(
    `SELECT id
     FROM market.carts
     WHERE user_id = $1
       AND status = 'active'
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  );

  if (rows.length > 0) return rows[0].id;

  const { rows: created } = await client.query(
    `INSERT INTO market.carts (user_id, status)
     VALUES ($1, 'active')
     RETURNING id`,
    [userId]
  );
  return created[0].id;
}

/* ══════════════════════════════════════════════════════════════
   HELPER — Validate product + stock + get current price
   Returns { product, variant, availableStock, price, originalPrice }
══════════════════════════════════════════════════════════════ */
async function validateAndGetPricing(client, productId, variantId, requestedQty) {
  /* Check product exists & is buyable */
  const { rows: prodRows } = await client.query(
    `SELECT
       p.id,
       p.name,
       p.price,
       p.original_price,
       p.stock          AS product_stock,
       p.is_active,
       p.status,
       p.deleted_at
     FROM market.products p
     WHERE p.id = $1`,
    [productId]
  );

  if (prodRows.length === 0) {
    return { error: "Product not found", status: 404 };
  }

  const product = prodRows[0];

  if (product.deleted_at) {
    return { error: "Product no longer available", status: 410 };
  }

  if (!product.is_active || !["approved", "active"].includes(product.status)) {
    return { error: "Product is not available for purchase", status: 400 };
  }

  /* Determine stock + price:
     - If variant selected → use variant stock & price
     - Otherwise → use product stock & price */
  let availableStock = Number(product.product_stock ?? 0);
  let price          = Number(product.price ?? 0);
  let variant        = null;

  if (variantId) {
    const { rows: varRows } = await client.query(
      `SELECT id, name, sku, price, stock
       FROM market.product_variants
       WHERE id = $1
         AND product_id = $2`,
      [variantId, productId]
    );

    if (varRows.length === 0) {
      return { error: "Variant not found", status: 404 };
    }

    variant        = varRows[0];
    availableStock = Number(variant.stock ?? 0);
    /* Variant price overrides product price (fallback to product price if null) */
    price          = Number(variant.price ?? product.price ?? 0);
  }

  if (price <= 0) {
    return { error: "Product price not set. Contact seller.", status: 400 };
  }

  if (availableStock === 0) {
    return { error: "This item is out of stock", status: 400 };
  }

  if (requestedQty > availableStock) {
    return {
      error : `Only ${availableStock} available in stock`,
      status: 400,
    };
  }

  return {
    product,
    variant,
    availableStock,
    price,
    originalPrice: Number(product.original_price ?? 0),
  };
}

/* ══════════════════════════════════════════════════════════════
   COLUMN DETECTION (cache which columns cart_items has)
══════════════════════════════════════════════════════════════ */
let CART_ITEMS_COLS = null;

async function detectColumns() {
  if (CART_ITEMS_COLS) return CART_ITEMS_COLS;

  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'market'
       AND table_name = 'cart_items'`
  );

  const cols = new Set(rows.map((r) => r.column_name));

  CART_ITEMS_COLS = {
    hasPrice          : cols.has("price"),
    hasOriginalPrice  : cols.has("original_price"),
    hasUpdatedAt      : cols.has("updated_at"),
    hasAddedAt        : cols.has("added_at"),
  };

  console.log("[cart/write] Detected cart_items columns:", CART_ITEMS_COLS);
  return CART_ITEMS_COLS;
}

/* ══════════════════════════════════════════════════════════════
   POST /items
   Add item to cart (or increment qty if already present)
══════════════════════════════════════════════════════════════ */
router.post("/items", authenticateBuyer, async (req, res) => {
  const userId = req.user.id;
  const { product_id, variant_id, qty } = req.body;

  console.log("[cart/write POST] user:", userId, "| product:", product_id, "| qty:", qty);

  /* ── Validate input ── */
  if (!product_id) return fail(res, 400, "product_id is required");

  const requestedQty = parseInt(qty, 10);
  if (isNaN(requestedQty) || requestedQty < 1) {
    return fail(res, 400, "qty must be a positive integer");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Detect available columns ── */
    const cols = await detectColumns();

    /* ── Get or create cart ── */
    const cartId = await getOrCreateCart(client, userId);
    console.log("[cart/write POST] Using cart:", cartId);

    /* ── Check if item already in cart ── */
    const { rows: existing } = await client.query(
      `SELECT id, qty
       FROM market.cart_items
       WHERE cart_id = $1
         AND product_id = $2
         AND ((variant_id IS NULL AND $3::uuid IS NULL) OR variant_id = $3)`,
      [cartId, product_id, variant_id ?? null]
    );

    const currentQty = existing.length > 0 ? Number(existing[0].qty) : 0;
    const newQty     = currentQty + requestedQty;

    /* ── Validate stock + get pricing ── */
    const check = await validateAndGetPricing(
      client, product_id, variant_id ?? null, newQty
    );
    if (check.error) {
      await client.query("ROLLBACK");
      console.warn("[cart/write POST] Validation failed:", check.error);
      return fail(res, check.status, check.error);
    }

    console.log("[cart/write POST] Price snapshot:", check.price, "| Stock:", check.availableStock);

    /* ── Upsert cart item ── */
    if (existing.length > 0) {
      /* Update qty AND refresh price (in case it changed since first add) */
      const updateFields = ["qty = $1"];
      const updateVals   = [newQty];
      let idx = 2;

      if (cols.hasPrice) {
        updateFields.push(`price = $${idx++}`);
        updateVals.push(check.price);
      }
      if (cols.hasOriginalPrice) {
        updateFields.push(`original_price = $${idx++}`);
        updateVals.push(check.originalPrice);
      }
      if (cols.hasUpdatedAt) {
        updateFields.push(`updated_at = now()`);
      }

      updateVals.push(existing[0].id);

      await client.query(
        `UPDATE market.cart_items
         SET ${updateFields.join(", ")}
         WHERE id = $${idx}`,
        updateVals
      );

      console.log("[cart/write POST] ✓ Updated existing item to qty:", newQty);

    } else {
      /* Insert new item — build INSERT dynamically based on columns */
      const insertCols = ["cart_id", "product_id", "variant_id", "qty"];
      const insertVals = [cartId, product_id, variant_id ?? null, requestedQty];

      if (cols.hasPrice) {
        insertCols.push("price");
        insertVals.push(check.price);
      }
      if (cols.hasOriginalPrice) {
        insertCols.push("original_price");
        insertVals.push(check.originalPrice);
      }

      const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(", ");

      await client.query(
        `INSERT INTO market.cart_items (${insertCols.join(", ")})
         VALUES (${placeholders})`,
        insertVals
      );

      console.log("[cart/write POST] ✓ Inserted new item with price:", check.price);
    }

    /* ── Touch cart updated_at ── */
    await client.query(
      `UPDATE market.carts SET updated_at = now() WHERE id = $1`,
      [cartId]
    );

    await client.query("COMMIT");

    console.log("[cart/write POST] ✅ SUCCESS");

    return ok(res, {
      message: existing.length > 0
        ? "Cart item quantity updated"
        : "Item added to cart",
      data: {
        cart_id  : cartId,
        added_qty: requestedQty,
        total_qty: newQty,
        price    : check.price,
      },
    }, existing.length > 0 ? 200 : 201);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[cart/write POST] ❌ error:", err.message);
    console.error("[cart/write POST] code:", err.code);
    console.error("[cart/write POST] detail:", err.detail ?? "—");
    console.error("[cart/write POST] stack:", err.stack?.split("\n").slice(0, 5).join("\n"));
    return fail(res, 500, `Failed to add item: ${err.message}`);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /items/:id
   Update quantity of an existing cart item
══════════════════════════════════════════════════════════════ */
router.patch("/items/:id", authenticateBuyer, async (req, res) => {
  const userId  = req.user.id;
  const itemId  = req.params.id;
  const { qty } = req.body;

  const newQty = parseInt(qty, 10);
  if (isNaN(newQty) || newQty < 1) {
    return fail(res, 400, "qty must be a positive integer");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cols = await detectColumns();

    /* ── Fetch item + verify ownership ── */
    const { rows } = await client.query(
      `SELECT ci.id, ci.cart_id, ci.product_id, ci.variant_id, c.user_id
       FROM market.cart_items ci
       JOIN market.carts c ON c.id = ci.cart_id
       WHERE ci.id = $1`,
      [itemId]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Cart item not found");
    }

    if (rows[0].user_id !== userId) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Forbidden");
    }

    /* ── Validate stock for new qty ── */
    const check = await validateAndGetPricing(
      client, rows[0].product_id, rows[0].variant_id, newQty
    );
    if (check.error) {
      await client.query("ROLLBACK");
      return fail(res, check.status, check.error);
    }

    /* ── Update qty ── */
    const updateFields = ["qty = $1"];
    if (cols.hasUpdatedAt) updateFields.push("updated_at = now()");

    await client.query(
      `UPDATE market.cart_items
       SET ${updateFields.join(", ")}
       WHERE id = $2`,
      [newQty, itemId]
    );

    if (cols.hasUpdatedAt) {
      await client.query(
        `UPDATE market.carts SET updated_at = now() WHERE id = $1`,
        [rows[0].cart_id]
      );
    }

    await client.query("COMMIT");

    return ok(res, {
      message: "Quantity updated",
      data   : { item_id: itemId, qty: newQty },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[cart/write PATCH] error:", err.message);
    console.error("[cart/write PATCH] code:", err.code);
    return fail(res, 500, "Failed to update quantity");
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   DELETE /items/:id
   Remove single item from cart
══════════════════════════════════════════════════════════════ */
router.delete("/items/:id", authenticateBuyer, async (req, res) => {
  const userId = req.user.id;
  const itemId = req.params.id;

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.id = $1
         AND ci.cart_id = c.id
         AND c.user_id = $2`,
      [itemId, userId]
    );

    if (rowCount === 0) {
      return fail(res, 404, "Cart item not found");
    }

    return ok(res, {
      message: "Item removed from cart",
      data   : { item_id: itemId },
    });

  } catch (err) {
    console.error("[cart/write DELETE item] error:", err.message);
    return fail(res, 500, "Failed to remove item");
  }
});

/* ══════════════════════════════════════════════════════════════
   DELETE /
   Clear the entire cart (all items)
══════════════════════════════════════════════════════════════ */
router.delete("/", authenticateBuyer, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.cart_id = c.id
         AND c.user_id = $1
         AND c.status = 'active'`,
      [userId]
    );

    return ok(res, {
      message: "Cart cleared",
      data   : { removed_count: rowCount },
    });

  } catch (err) {
    console.error("[cart/write DELETE all] error:", err.message);
    return fail(res, 500, "Failed to clear cart");
  }
});

export default router;