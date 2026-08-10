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
 *
 * Column detection:
 *   Auto-detects which columns exist on market.cart_items
 *   (price, original_price, updated_at, added_at) so the
 *   INSERT/UPDATE only writes to columns that actually exist.
 */

import express                from "express";
import { authenticateBuyer }  from "../../middleware/auth.js";
import { pool, ok, fail }     from "../market/helpers.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   COLUMN DETECTION (cached — runs once per server lifetime)
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
    hasPrice         : cols.has("price"),
    hasOriginalPrice : cols.has("original_price"),
    hasUpdatedAt     : cols.has("updated_at"),
    hasAddedAt       : cols.has("added_at"),
    hasCreatedAt     : cols.has("created_at"),
  };

  console.log("[cart/write] Detected cart_items columns:", CART_ITEMS_COLS);
  return CART_ITEMS_COLS;
}

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
   HELPER — Validate product + stock + return pricing snapshot
   Returns:
     { product, variant, availableStock, price, originalPrice }
     OR
     { error, status }
══════════════════════════════════════════════════════════════ */
async function validateAndGetPricing(client, productId, variantId, requestedQty) {
  /* ── Fetch product ── */
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
    return { error: "This product is no longer available", status: 410 };
  }

  if (!product.is_active || !["approved", "active"].includes(product.status)) {
    return { error: "This product is not available for purchase", status: 400 };
  }

  /* ── Determine stock + price:
     - If variant selected → use variant stock & price
     - Otherwise → use product stock & price ── */
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
      return { error: "Selected variant not found", status: 404 };
    }

    variant        = varRows[0];
    availableStock = Number(variant.stock ?? 0);
    price          = Number(variant.price ?? product.price ?? 0);
  }

  /* ── Sanity checks ── */
  if (price <= 0) {
    return {
      error : "Product price is not set. Please contact the seller.",
      status: 400,
    };
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
   POST /items
   Add item to cart (or increment qty if already present)
══════════════════════════════════════════════════════════════ */
router.post("/items", authenticateBuyer, async (req, res) => {
  const userId = req.user.id;
  const { product_id, variant_id, qty } = req.body;

  console.log("═══════════════════════════════════════════");
  console.log("[cart/write POST] START");
  console.log("[cart/write POST] user:", userId);
  console.log("[cart/write POST] product:", product_id);
  console.log("[cart/write POST] variant:", variant_id ?? "none");
  console.log("[cart/write POST] qty:", qty);

  /* ── Validate input ── */
  if (!product_id) {
    console.warn("[cart/write POST] ❌ Missing product_id");
    return fail(res, 400, "product_id is required");
  }

  const requestedQty = parseInt(qty, 10);
  if (isNaN(requestedQty) || requestedQty < 1) {
    console.warn("[cart/write POST] ❌ Invalid qty:", qty);
    return fail(res, 400, "Quantity must be a positive integer");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Detect columns ── */
    const cols = await detectColumns();

    /* ── Get or create cart ── */
    console.log("[cart/write POST] STEP 1: Get/create cart");
    const cartId = await getOrCreateCart(client, userId);
    console.log("[cart/write POST] ✓ Using cart:", cartId);

    /* ── Check if item already in cart ── */
    console.log("[cart/write POST] STEP 2: Check for existing item");
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

    console.log("[cart/write POST] Current qty:", currentQty, "→ New qty:", newQty);

    /* ── Validate stock + get pricing snapshot ── */
    console.log("[cart/write POST] STEP 3: Validate stock + get price");
    const check = await validateAndGetPricing(
      client, product_id, variant_id ?? null, newQty
    );
    if (check.error) {
      await client.query("ROLLBACK");
      console.warn("[cart/write POST] ❌ Validation failed:", check.error);
      return fail(res, check.status, check.error);
    }

    console.log("[cart/write POST] ✓ Price:", check.price, "| Stock:", check.availableStock);

    /* ══════════════════════════════════════════════════
       STEP 4: Upsert cart item
    ══════════════════════════════════════════════════ */
    if (existing.length > 0) {
      /* ── UPDATE existing item ── */
      console.log("[cart/write POST] STEP 4: Updating existing item:", existing[0].id);

      const updateParts = ["qty = $1"];
      const updateVals  = [newQty];
      let paramIdx = 2;

      /* Refresh price snapshot (in case seller changed price since first add) */
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

      /* ID goes LAST — placeholder = next paramIdx */
      updateVals.push(existing[0].id);
      const updateSQL = `UPDATE market.cart_items
                         SET ${updateParts.join(", ")}
                         WHERE id = $${paramIdx}`;

      console.log("[cart/write POST] UPDATE SQL:", updateSQL);
      await client.query(updateSQL, updateVals);
      console.log("[cart/write POST] ✓ Updated to qty:", newQty);

    } else {
      /* ── INSERT new item ── */
      console.log("[cart/write POST] STEP 4: Inserting new item");

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

      console.log("[cart/write POST] INSERT SQL:", insertSQL);
      await client.query(insertSQL, insertVals);
      console.log("[cart/write POST] ✓ Inserted with price:", check.price);
    }

    /* ── Touch cart updated_at ── */
    await client.query(
      `UPDATE market.carts SET updated_at = now() WHERE id = $1`,
      [cartId]
    );

    await client.query("COMMIT");

    console.log("[cart/write POST] ✅ SUCCESS");
    console.log("═══════════════════════════════════════════");

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
    console.error("═══════════════════════════════════════════");
    console.error("[cart/write POST] ❌ ERROR");
    console.error("[cart/write POST] Message:", err.message);
    console.error("[cart/write POST] Code:", err.code);
    console.error("[cart/write POST] Detail:", err.detail ?? "—");
    console.error("[cart/write POST] Stack:", err.stack?.split("\n").slice(0, 5).join("\n"));
    console.error("═══════════════════════════════════════════");
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

  console.log("═══════════════════════════════════════════");
  console.log("[cart/write PATCH] START");
  console.log("[cart/write PATCH] user:", userId);
  console.log("[cart/write PATCH] item:", itemId);
  console.log("[cart/write PATCH] requested qty:", qty);

  /* ── Validate input ── */
  const newQty = parseInt(qty, 10);
  if (isNaN(newQty) || newQty < 1) {
    console.warn("[cart/write PATCH] ❌ Invalid qty");
    return fail(res, 400, "Quantity must be a positive integer");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Detect columns ── */
    const cols = await detectColumns();

    /* ── Fetch item + verify ownership ── */
    console.log("[cart/write PATCH] STEP 1: Fetch item + verify owner");
    const { rows } = await client.query(
      `SELECT ci.id, ci.cart_id, ci.product_id, ci.variant_id, c.user_id
       FROM market.cart_items ci
       JOIN market.carts c ON c.id = ci.cart_id
       WHERE ci.id = $1`,
      [itemId]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      console.warn("[cart/write PATCH] ❌ Item not found");
      return fail(res, 404, "Cart item not found");
    }

    if (rows[0].user_id !== userId) {
      await client.query("ROLLBACK");
      console.warn("[cart/write PATCH] ❌ Ownership mismatch");
      return fail(res, 403, "Forbidden");
    }

    console.log("[cart/write PATCH] ✓ Item owned by user");
    console.log("[cart/write PATCH] Product:", rows[0].product_id);

    /* ── Validate stock ── */
    console.log("[cart/write PATCH] STEP 2: Validate stock for qty:", newQty);
    const check = await validateAndGetPricing(
      client, rows[0].product_id, rows[0].variant_id, newQty
    );
    if (check.error) {
      await client.query("ROLLBACK");
      console.warn("[cart/write PATCH] ❌ Stock validation:", check.error);
      return fail(res, check.status, check.error);
    }

    console.log("[cart/write PATCH] ✓ Stock OK | available:", check.availableStock);

    /* ── Build UPDATE dynamically ── */
    console.log("[cart/write PATCH] STEP 3: Update qty");
    const updateParts = ["qty = $1"];
    const updateVals  = [newQty];
    let paramIdx = 2;

    /* Refresh price snapshot */
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

    /* ID goes LAST */
    updateVals.push(itemId);
    const updateSQL = `UPDATE market.cart_items
                       SET ${updateParts.join(", ")}
                       WHERE id = $${paramIdx}`;

    console.log("[cart/write PATCH] SQL:", updateSQL);
    console.log("[cart/write PATCH] VALS:", updateVals);

    await client.query(updateSQL, updateVals);

    /* Touch cart */
    if (cols.hasUpdatedAt) {
      await client.query(
        `UPDATE market.carts SET updated_at = now() WHERE id = $1`,
        [rows[0].cart_id]
      );
    }

    await client.query("COMMIT");

    console.log("[cart/write PATCH] ✅ SUCCESS");
    console.log("═══════════════════════════════════════════");

    return ok(res, {
      message: "Quantity updated",
      data   : { item_id: itemId, qty: newQty },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("═══════════════════════════════════════════");
    console.error("[cart/write PATCH] ❌ ERROR");
    console.error("[cart/write PATCH] Message:", err.message);
    console.error("[cart/write PATCH] Code:", err.code);
    console.error("[cart/write PATCH] Detail:", err.detail ?? "—");
    console.error("[cart/write PATCH] Stack:", err.stack?.split("\n").slice(0, 5).join("\n"));
    console.error("═══════════════════════════════════════════");
    return fail(res, 500, `Failed to update: ${err.message}`);
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

  console.log("[cart/write DELETE item] user:", userId, "| item:", itemId);

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
      console.warn("[cart/write DELETE item] ❌ Item not found or not owned");
      return fail(res, 404, "Cart item not found");
    }

    console.log("[cart/write DELETE item] ✅ Removed");

    return ok(res, {
      message: "Item removed from cart",
      data   : { item_id: itemId },
    });

  } catch (err) {
    console.error("[cart/write DELETE item] ❌ error:", err.message);
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

  console.log("[cart/write DELETE all] user:", userId);

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.cart_id = c.id
         AND c.user_id = $1
         AND c.status = 'active'`,
      [userId]
    );

    console.log("[cart/write DELETE all] ✅ Removed", rowCount, "items");

    return ok(res, {
      message: "Cart cleared",
      data   : { removed_count: rowCount },
    });

  } catch (err) {
    console.error("[cart/write DELETE all] ❌ error:", err.message);
    console.error("[cart/write DELETE all] code:", err.code);
    return fail(res, 500, "Failed to clear cart");
  }
});

export default router;