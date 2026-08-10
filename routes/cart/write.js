/**
 * routes/cart/write.js
 *
 * Mutation endpoints for cart:
 *   POST   /api/cart/items         → add item (or increment if exists)
 *   PATCH  /api/cart/items/:id     → update quantity
 *   DELETE /api/cart/items/:id     → remove single item
 *   DELETE /api/cart               → clear entire cart
 *
 * Auth: authenticateBuyer — public.users JWT (buyers only)
 *
 * Stock validation:
 *   - Cannot add more than product/variant stock
 *   - Cannot update to qty > stock
 *   - Rejects if product inactive/unapproved
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
     ORDER BY created_at DESC
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
   HELPER — Validate product + stock
══════════════════════════════════════════════════════════════ */
async function validateProductStock(client, productId, variantId, requestedQty) {
  /* Check product exists & is buyable */
  const { rows: prodRows } = await client.query(
    `SELECT
       p.id,
       p.name,
       p.price,
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

  /* If variant specified, use variant stock; else product stock */
  let availableStock = Number(product.product_stock ?? 0);
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

  return { product, variant, availableStock };
}

/* ══════════════════════════════════════════════════════════════
   POST /items
   Add item to cart (or increment qty if already present)
══════════════════════════════════════════════════════════════ */
router.post("/items", authenticateBuyer, async (req, res) => {
  const userId = req.user.id;
  const { product_id, variant_id, qty } = req.body;

  /* ── Validate input ── */
  if (!product_id) return fail(res, 400, "product_id is required");

  const requestedQty = parseInt(qty, 10);
  if (isNaN(requestedQty) || requestedQty < 1) {
    return fail(res, 400, "qty must be a positive integer");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cartId = await getOrCreateCart(client, userId);

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

    /* ── Validate stock against NEW total qty ── */
    const check = await validateProductStock(
      client, product_id, variant_id ?? null, newQty
    );
    if (check.error) {
      await client.query("ROLLBACK");
      return fail(res, check.status, check.error);
    }

    /* ── Upsert cart item ── */
    if (existing.length > 0) {
      await client.query(
        `UPDATE market.cart_items
         SET qty = $1, updated_at = now()
         WHERE id = $2`,
        [newQty, existing[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO market.cart_items
           (cart_id, product_id, variant_id, qty)
         VALUES ($1, $2, $3, $4)`,
        [cartId, product_id, variant_id ?? null, requestedQty]
      );
    }

    /* ── Touch cart updated_at ── */
    await client.query(
      `UPDATE market.carts SET updated_at = now() WHERE id = $1`,
      [cartId]
    );

    await client.query("COMMIT");

    return ok(res, {
      message: existing.length > 0
        ? "Cart item quantity updated"
        : "Item added to cart",
      data: {
        cart_id  : cartId,
        added_qty: requestedQty,
        total_qty: newQty,
      },
    }, existing.length > 0 ? 200 : 201);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[cart/write POST] error:", err.message);
    console.error("[cart/write POST] code:", err.code);
    console.error("[cart/write POST] detail:", err.detail ?? "—");
    return fail(res, 500, "Failed to add item to cart");
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
    const check = await validateProductStock(
      client, rows[0].product_id, rows[0].variant_id, newQty
    );
    if (check.error) {
      await client.query("ROLLBACK");
      return fail(res, check.status, check.error);
    }

    /* ── Update qty ── */
    await client.query(
      `UPDATE market.cart_items
       SET qty = $1, updated_at = now()
       WHERE id = $2`,
      [newQty, itemId]
    );

    await client.query(
      `UPDATE market.carts SET updated_at = now() WHERE id = $1`,
      [rows[0].cart_id]
    );

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
    /* ── Verify ownership + delete in one query ── */
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
    console.error("[cart/write DELETE item] code:", err.code);
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
    console.error("[cart/write DELETE all] code:", err.code);
    return fail(res, 500, "Failed to clear cart");
  }
});

export default router;