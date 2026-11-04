/**
 * routes/cart/write.js
 */

import express                from "express";
import { authenticateBuyer }  from "../../middleware/auth.js";
import { pool, ok, fail }     from "../market/helpers.js";

const router = express.Router();

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
    hasPrice         : cols.has("price"),
    hasOriginalPrice : cols.has("original_price"),
    hasUpdatedAt     : cols.has("updated_at"),
    hasAddedAt       : cols.has("added_at"),
    hasCreatedAt     : cols.has("created_at"),
  };

  return CART_ITEMS_COLS;
}

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

const pickValidPrice = (...vals) => {
  for (const v of vals) {
    if (v == null || v === "") continue;
    const n = Number(String(v).replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

async function validateAndGetPricing(client, productId, variantId, requestedQty) {
  const { rows: prodRows } = await client.query(
    `SELECT p.*
     FROM market.products p
     WHERE p.id = $1`,
    [productId]
  );

  if (prodRows.length === 0) {
    return { error: "Product not found", status: 404 };
  }

  const product = prodRows[0];

  if (product.deleted_at) {
    return { error: "This product is no longer available", status: 410 };
  }

  if (!product.is_active || !["approved", "active"].includes(product.status)) {
    return { error: "This product is not available for purchase", status: 400 };
  }

  let variant = null;
  if (variantId) {
    const { rows: varRows } = await client.query(
      `SELECT pv.*
       FROM market.product_variants pv
       WHERE pv.id = $1
         AND pv.product_id = $2`,
      [variantId, productId]
    );

    if (varRows.length === 0) {
      return { error: "Selected variant not found", status: 404 };
    }

    variant = varRows[0];
  }

  const price = pickValidPrice(
    variant?.price,
    variant?.sale_price,
    product.price,
    product.selling_price,
    product.sale_price
  );

  if (price <= 0) {
    return {
      error : "Product price is not set. Please contact the seller.",
      status: 400,
    };
  }

  // In CockroachDB, products without explicit stock default to 0.
  // If rawStock > 0, enforce that limit; otherwise allow up to 999.
  const rawStock = Number(variant ? variant.stock : product.stock);
  const availableStock =
    Number.isFinite(rawStock) && rawStock > 0 ? rawStock : 999;

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
    originalPrice: pickValidPrice(product.original_price, product.compare_price),
  };
}

router.post("/items", authenticateBuyer, async (req, res) => {
  const userId = req.user.id;
  const { product_id, variant_id, qty } = req.body;

  if (!product_id) {
    return fail(res, 400, "product_id is required");
  }

  const requestedQty = parseInt(qty, 10);
  if (isNaN(requestedQty) || requestedQty < 1) {
    return fail(res, 400, "Quantity must be a positive integer");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cols = await detectColumns();
    const cartId = await getOrCreateCart(client, userId);

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

    const check = await validateAndGetPricing(
      client, product_id, variant_id ?? null, newQty
    );
    if (check.error) {
      await client.query("ROLLBACK");
      return fail(res, check.status, check.error);
    }

    if (existing.length > 0) {
      const updateParts = ["qty = $1"];
      const updateVals  = [newQty];
      let paramIdx = 2;

      if (cols.hasPrice) {
        updateParts.push(`price = $${paramIdx++}`);
        updateVals.push(check.price);
      }
      if (cols.hasOriginalPrice) {
        updateParts.push(`original_price = $${paramIdx++}`);
        updateVals.push(check.originalPrice);
      }
      if (cols.hasUpdatedAt) {
        updateParts.push(`updated_at = now()`);
      }

      updateVals.push(existing[0].id);
      const updateSQL = `UPDATE market.cart_items
                         SET ${updateParts.join(", ")}
                         WHERE id = $${paramIdx}`;

      await client.query(updateSQL, updateVals);
    } else {
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
      const insertSQL = `INSERT INTO market.cart_items (${insertCols.join(", ")})
                         VALUES (${placeholders})`;

      await client.query(insertSQL, insertVals);
    }

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
        price    : check.price,
      },
    }, existing.length > 0 ? 200 : 201);

  } catch (err) {
    await client.query("ROLLBACK");
    return fail(res, 500, `Failed to add item: ${err.message}`);
  } finally {
    client.release();
  }
});

router.patch("/items/:id", authenticateBuyer, async (req, res) => {
  const userId  = req.user.id;
  const itemId  = req.params.id;
  const { qty } = req.body;

  const newQty = parseInt(qty, 10);
  if (isNaN(newQty) || newQty < 1) {
    return fail(res, 400, "Quantity must be a positive integer");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cols = await detectColumns();

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

    const check = await validateAndGetPricing(
      client, rows[0].product_id, rows[0].variant_id, newQty
    );
    if (check.error) {
      await client.query("ROLLBACK");
      return fail(res, check.status, check.error);
    }

    const updateParts = ["qty = $1"];
    const updateVals  = [newQty];
    let paramIdx = 2;

    if (cols.hasPrice) {
      updateParts.push(`price = $${paramIdx++}`);
      updateVals.push(check.price);
    }
    if (cols.hasOriginalPrice) {
      updateParts.push(`original_price = $${paramIdx++}`);
      updateVals.push(check.originalPrice);
    }
    if (cols.hasUpdatedAt) {
      updateParts.push(`updated_at = now()`);
    }

    updateVals.push(itemId);
    const updateSQL = `UPDATE market.cart_items
                       SET ${updateParts.join(", ")}
                       WHERE id = $${paramIdx}`;

    await client.query(updateSQL, updateVals);

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
    return fail(res, 500, `Failed to update: ${err.message}`);
  } finally {
    client.release();
  }
});

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
    return fail(res, 500, "Failed to remove item");
  }
});

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
    return fail(res, 500, "Failed to clear cart");
  }
});

export default router;
