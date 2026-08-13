/**
 * services/orderService.js
 *
 * v8 — Production hardened
 * ────────────────────────────────────────────────────────────
 * CRITICAL FIXES:
 * ✓ #1 — Discount recalculated server-side (client value ignored)
 * ✓ #2 — Free shipping enforced by coupon type, not client claim
 * ✓ #3 — Stock decremented atomically with row lock
 * ✓ #4 — Cart clearing moved out — caller decides when
 * ✓ #5 — SQL details logged only in dev
 * ✓ #6 — Idempotency support via idempotency_key
 * ✓ #10 — All errors carry .status for proper HTTP mapping
 * ✓ Coupon redemption atomic with SELECT FOR UPDATE
 * ✓ Address last_used_at bumped for cross-device UX
 * ✓ Post-commit cache invalidation (best-effort)
 * ✓ All money math uses toNumber() (NaN-safe)
 */

import { pool }                 from "../config/db.js";
import { calculateDeliveryFee } from "./delivery.js";

const IS_DEV = process.env.NODE_ENV !== "production";

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const toNumber = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

function generateTrackingId(uuid) {
  return `ORD-${uuid.slice(0, 8).toUpperCase()}`;
}

function devLog(...args) {
  if (IS_DEV) console.log(...args);
}

/* ════════════════════════════════════════════════════════════
   COLUMN DETECTION (cached)
════════════════════════════════════════════════════════════ */
let ORDER_GROUP_COLS = null;
let ORDER_COLS       = null;
let ORDER_ITEM_COLS  = null;

async function detectOrderGroupColumns() {
  if (ORDER_GROUP_COLS) return ORDER_GROUP_COLS;
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'order_groups'`
    );
    const cols = new Set(rows.map((r) => r.column_name));
    ORDER_GROUP_COLS = {
      hasTrackingId    : cols.has("tracking_id"),
      hasDeliveredAt   : cols.has("delivered_at"),
      hasUpdatedAt     : cols.has("updated_at"),
      hasIdempotencyKey: cols.has("idempotency_key"),
    };
    console.log("[orderService] order_groups cols:", ORDER_GROUP_COLS);
  } catch (err) {
    console.warn("[orderService] order_groups detection failed:", err.message);
    ORDER_GROUP_COLS = {
      hasTrackingId: true, hasDeliveredAt: true,
      hasUpdatedAt: true,  hasIdempotencyKey: false,
    };
  }
  return ORDER_GROUP_COLS;
}

async function detectOrderColumns() {
  if (ORDER_COLS) return ORDER_COLS;
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'orders'`
    );
    const cols = new Set(rows.map((r) => r.column_name));
    ORDER_COLS = {
      hasUserId:      cols.has("user_id"),
      hasDeliveredAt: cols.has("delivered_at"),
      hasUpdatedAt:   cols.has("updated_at"),
    };
    console.log("[orderService] orders cols:", ORDER_COLS);
  } catch (err) {
    console.warn("[orderService] orders detection failed:", err.message);
    ORDER_COLS = { hasUserId: true, hasDeliveredAt: true, hasUpdatedAt: true };
  }
  return ORDER_COLS;
}

async function detectOrderItemColumns() {
  if (ORDER_ITEM_COLS) return ORDER_ITEM_COLS;
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'order_items'`
    );
    const cols = new Set(rows.map((r) => r.column_name));

    let qtyColumn = cols.has("quantity") ? "quantity"
                  : cols.has("qty")      ? "qty" : null;

    let priceColumn = cols.has("price")      ? "price"
                    : cols.has("unit_price") ? "unit_price" : null;

    let nameColumn = cols.has("name")         ? "name"
                   : cols.has("product_name") ? "product_name"
                   : cols.has("item_name")    ? "item_name"
                   : cols.has("title")        ? "title" : null;

    let subtotalColumn = cols.has("subtotal")    ? "subtotal"
                       : cols.has("total_price") ? "total_price"
                       : cols.has("total")       ? "total" : null;

    ORDER_ITEM_COLS = {
      allColumns:     [...cols],
      qtyColumn,
      priceColumn,
      nameColumn,
      subtotalColumn,
      hasProductId:   cols.has("product_id"),
      hasSellerId:    cols.has("seller_id"),
      hasVendorId:    cols.has("vendor_id"),
      hasVariantId:   cols.has("variant_id"),
      hasVariantName: cols.has("variant_name"),
      hasSku:         cols.has("sku"),
      hasImage:       cols.has("image"),
      hasImageUrl:    cols.has("image_url"),
    };

    console.log("[orderService] order_items cols detected:", {
      qty: qtyColumn, price: priceColumn, name: nameColumn ?? "(none)",
    });

    if (!qtyColumn)   console.error("[orderService] ⚠ No qty/quantity column found!");
    if (!priceColumn) console.error("[orderService] ⚠ No price/unit_price column found!");

  } catch (err) {
    console.warn("[orderService] order_items detection failed:", err.message);
    ORDER_ITEM_COLS = {
      allColumns:     [],
      qtyColumn:      "quantity",
      priceColumn:    "price",
      nameColumn:     null,
      subtotalColumn: null,
      hasProductId:   true,
      hasSellerId:    true,
      hasVendorId:    false,
      hasVariantId:   true,
      hasVariantName: true,
      hasSku:         true,
      hasImage:       true,
      hasImageUrl:    false,
    };
  }
  return ORDER_ITEM_COLS;
}

/* ════════════════════════════════════════════════════════════
   BUILD ORDER ITEM INSERT
════════════════════════════════════════════════════════════ */
function buildOrderItemInsert(itemCols, orderId, sellerId, item) {
  const columns = ["order_id"];
  const values  = [orderId];

  if (itemCols.hasProductId)   { columns.push("product_id");   values.push(item.productId); }
  if (itemCols.hasSellerId)    { columns.push("seller_id");    values.push(sellerId); }
  if (itemCols.hasVendorId)    { columns.push("vendor_id");    values.push(sellerId); }
  if (itemCols.qtyColumn)      { columns.push(itemCols.qtyColumn);   values.push(toNumber(item.qty)); }
  if (itemCols.priceColumn)    { columns.push(itemCols.priceColumn); values.push(toNumber(item.price)); }
  if (itemCols.nameColumn)     { columns.push(itemCols.nameColumn);  values.push(item.name); }
  if (itemCols.subtotalColumn) {
    columns.push(itemCols.subtotalColumn);
    values.push(toNumber(item.price) * toNumber(item.qty));
  }
  if (itemCols.hasVariantId)   { columns.push("variant_id");   values.push(item.variant?.id   ?? null); }
  if (itemCols.hasVariantName) { columns.push("variant_name"); values.push(item.variant?.name ?? null); }
  if (itemCols.hasSku)         { columns.push("sku");          values.push(item.variant?.sku  ?? null); }
  if (itemCols.hasImage)       { columns.push("image");        values.push(item.image ?? null); }
  if (itemCols.hasImageUrl)    { columns.push("image_url");    values.push(item.image ?? null); }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

  return {
    sql:    `INSERT INTO public.order_items (${columns.join(", ")}) VALUES (${placeholders})`,
    params: values,
  };
}

/* ════════════════════════════════════════════════════════════
   COUPON DISCOUNT CALCULATION (server-side truth)
   ─────────────────────────────────────────────────────────
   MUST match logic in routes/coupons.js and routes/checkout/coupons.js
   Client-sent discount value is IGNORED — we always recalculate.
════════════════════════════════════════════════════════════ */
function calculateCouponDiscount(coupon, subtotal) {
  const value       = toNumber(coupon.value);
  const maxDiscount = coupon.max_discount ? toNumber(coupon.max_discount) : null;

  if (coupon.type === "percentage") {
    let d = (subtotal * value) / 100;
    if (maxDiscount) d = Math.min(d, maxDiscount);
    return Math.round(d);
  }

  if (coupon.type === "fixed") {
    return Math.round(Math.min(value, subtotal));
  }

  if (coupon.type === "free_shipping") {
    return 0;   /* No line-item discount; delivery fee is waived */
  }

  return 0;
}

/* ════════════════════════════════════════════════════════════
   ATOMIC STOCK DECREMENT
   ─────────────────────────────────────────────────────────
   Locks variant row and decrements stock ONLY if enough exists.
   Throws with .status = 409 if out of stock — parent
   transaction rolls back.
════════════════════════════════════════════════════════════ */
async function decrementStock(client, item) {
  /* Only tracks stock for products with variants */
  if (!item.variant?.id) return;

  const qty = toNumber(item.qty);

  const { rows: [updated] } = await client.query(
    `UPDATE market.product_variants
     SET stock = stock - $1
     WHERE id = $2
       AND stock >= $1
     RETURNING stock`,
    [qty, item.variant.id]
  );

  if (!updated) {
    /*
     * UPDATE returned zero rows → either the variant doesn't exist
     * or stock was insufficient. Fetch current stock to give a
     * useful error message.
     */
    const { rows: [current] } = await client.query(
      `SELECT stock FROM market.product_variants WHERE id = $1`,
      [item.variant.id]
    );

    const available = current ? toNumber(current.stock) : 0;
    const err = new Error(
      available === 0
        ? `"${item.name}" is out of stock`
        : `Only ${available} "${item.name}" left — you requested ${qty}`
    );
    err.status = 409;
    err.source = "stock_insufficient";
    throw err;
  }

  devLog(`[orderService] ✓ Stock decremented: variant=${item.variant.id} qty=${qty} remaining=${updated.stock}`);
}

/* ════════════════════════════════════════════════════════════
   ATOMIC COUPON REDEMPTION
   ─────────────────────────────────────────────────────────
   Locks coupon row, re-validates everything server-side,
   recalculates discount from source of truth, inserts
   redemption row, bumps usage count.
   
   Returns: { couponId, code, discount, freeShipping }
   Throws with .status on any validation failure.
════════════════════════════════════════════════════════════ */
async function redeemCouponInTransaction(client, {
  code,
  userId,
  orderGroupId,
  subtotal,
}) {
  if (!code) return null;

  const upperCode = String(code).trim().toUpperCase();
  if (!upperCode) return null;

  /* ── 1. Lock coupon row ── */
  const { rows: [coupon] } = await client.query(
    `SELECT id, is_private, created_by, is_active, type, value,
            max_discount, min_purchase, usage_limit, usage_count,
            expires_at
     FROM public.coupons
     WHERE UPPER(code) = $1
     FOR UPDATE`,
    [upperCode]
  );

  if (!coupon) {
    const err = new Error(`Coupon "${upperCode}" not found`);
    err.status = 400;
    err.source = "coupon_redemption";
    throw err;
  }

  if (!coupon.is_active) {
    const err = new Error(`Coupon "${upperCode}" is no longer active`);
    err.status = 400;
    err.source = "coupon_redemption";
    throw err;
  }

  if (coupon.is_private && coupon.created_by !== userId) {
    const err = new Error(`Coupon "${upperCode}" is not valid for your account`);
    err.status = 403;
    err.source = "coupon_redemption";
    throw err;
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    const err = new Error(`Coupon "${upperCode}" has expired`);
    err.status = 400;
    err.source = "coupon_redemption";
    throw err;
  }

  if (
    coupon.usage_limit !== null &&
    toNumber(coupon.usage_count) >= toNumber(coupon.usage_limit)
  ) {
    const err = new Error(`Coupon "${upperCode}" has reached its usage limit`);
    err.status = 400;
    err.source = "coupon_redemption";
    throw err;
  }

  if (
    toNumber(coupon.min_purchase) > 0 &&
    subtotal < toNumber(coupon.min_purchase)
  ) {
    const err = new Error(
      `Coupon "${upperCode}" requires a minimum order of ` +
      `₦${toNumber(coupon.min_purchase).toLocaleString("en-NG")}`
    );
    err.status = 400;
    err.source = "coupon_redemption";
    throw err;
  }

  /* ── 2. Check user hasn't already redeemed ── */
  const { rows: existing } = await client.query(
    `SELECT id FROM public.coupon_redemptions
     WHERE coupon_id = $1 AND user_id = $2
     LIMIT 1`,
    [coupon.id, userId]
  );

  if (existing.length) {
    const err = new Error(`You have already used coupon "${upperCode}"`);
    err.status = 400;
    err.source = "coupon_redemption";
    throw err;
  }

  /* ── 3. Recalculate discount server-side (never trust client) ── */
  const actualDiscount = calculateCouponDiscount(coupon, subtotal);
  const freeShipping   = coupon.type === "free_shipping";

  /* ── 4. Insert redemption row ── */
  await client.query(
    `INSERT INTO public.coupon_redemptions
       (coupon_id, user_id, order_id, discount)
     VALUES ($1, $2, $3, $4)`,
    [coupon.id, userId, orderGroupId, actualDiscount]
  );

  /* ── 5. Bump usage_count + auto-deactivate single-use ── */
  const isSingleUse =
    coupon.usage_limit !== null && toNumber(coupon.usage_limit) === 1;

  await client.query(
    `UPDATE public.coupons
     SET usage_count = usage_count + 1,
         is_active   = CASE
           WHEN $1 THEN false
           WHEN usage_limit IS NOT NULL
                AND usage_count + 1 >= usage_limit
           THEN false
           ELSE is_active
         END
     WHERE id = $2`,
    [isSingleUse, coupon.id]
  );

  console.log(
    `[orderService] ✓ Coupon "${upperCode}" redeemed by user=${userId} ` +
    `on order=${orderGroupId} type=${coupon.type} ` +
    `discount=₦${actualDiscount.toLocaleString("en-NG")}`
  );

  return {
    couponId    : coupon.id,
    code        : upperCode,
    discount    : actualDiscount,
    freeShipping,
    type        : coupon.type,
  };
}

/* ════════════════════════════════════════════════════════════
   IDEMPOTENCY CHECK
   ─────────────────────────────────────────────────────────
   If the same idempotency key was used before, return the
   existing order instead of creating a duplicate.
════════════════════════════════════════════════════════════ */
async function findExistingOrder(client, userId, idempotencyKey, groupCols) {
  if (!idempotencyKey || !groupCols.hasIdempotencyKey) return null;

  const { rows: [existing] } = await client.query(
    `SELECT id, tracking_id, grand_total, delivery_fee, payment_method
     FROM public.order_groups
     WHERE user_id = $1 AND idempotency_key = $2`,
    [userId, idempotencyKey]
  );

  if (existing) {
    console.log(
      `[orderService] ⚡ Idempotent replay: returning existing order ${existing.id}`
    );
  }

  return existing ?? null;
}

/* ════════════════════════════════════════════════════════════
   CREATE ORDER GROUP  (v8 — production hardened)
════════════════════════════════════════════════════════════ */
export async function createOrderGroup({
  userId,
  addressId,
  items,
  subtotal,
  paymentMethod,
  couponCode      = null,
  notes           = null,
  idempotencyKey  = null,   /* NEW — prevents duplicate orders on retry */

  /*
   * NOTE: We deliberately IGNORE any client-sent `discount` or
   * `freeShipping` values. Both are recalculated server-side
   * from the actual coupon record for security.
   */
}) {
  const cleanSubtotal = toNumber(subtotal);

  const [groupCols, orderCols, itemCols] = await Promise.all([
    detectOrderGroupColumns(),
    detectOrderColumns(),
    detectOrderItemColumns(),
  ]);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ══════════════════════════════════════════════════
       0. Idempotency check
    ══════════════════════════════════════════════════ */
    const existing = await findExistingOrder(client, userId, idempotencyKey, groupCols);
    if (existing) {
      await client.query("ROLLBACK");
      return {
        orderGroupId : existing.id,
        trackingId   : existing.tracking_id ?? generateTrackingId(existing.id),
        deliveryFee  : toNumber(existing.delivery_fee),
        grandTotal   : toNumber(existing.grand_total),
        orders       : [],   /* Caller should fetch full order if needed */
        idempotent   : true,
      };
    }

    /* ══════════════════════════════════════════════════
       1. Pre-validate coupon (peek at type for free shipping)
       ─────────────────────────────────────────────────
       We need to know if it's free_shipping BEFORE we calculate
       delivery fee. Full validation happens in step 3.
    ══════════════════════════════════════════════════ */
    let couponType = null;
    if (couponCode) {
      const { rows: [c] } = await client.query(
        `SELECT type FROM public.coupons
         WHERE UPPER(code) = UPPER($1) AND is_active = true`,
        [couponCode]
      );
      couponType = c?.type ?? null;
    }

    const isFreeShipping = couponType === "free_shipping";

    /* ══════════════════════════════════════════════════
       2. Calculate fees (server-side truth)
    ══════════════════════════════════════════════════ */
    const deliveryFee = isFreeShipping ? 0 : calculateDeliveryFee(cleanSubtotal);
    /* discount is set to 0 initially; step 3 updates it after redemption */
    let discount   = 0;
    let grandTotal = cleanSubtotal + deliveryFee;

    /* ══════════════════════════════════════════════════
       3. Insert order group (placeholder totals — updated after coupon)
    ══════════════════════════════════════════════════ */
    const groupInsertCols = [
      "user_id", "address_id", "total_amount", "delivery_fee",
      "discount", "grand_total", "payment_method", "coupon_code",
      "notes", "payment_status", "status",
    ];
    const groupInsertVals = [
      userId, addressId, cleanSubtotal, deliveryFee, discount,
      grandTotal, paymentMethod, couponCode, notes, "pending", "pending",
    ];

    if (groupCols.hasIdempotencyKey && idempotencyKey) {
      groupInsertCols.push("idempotency_key");
      groupInsertVals.push(idempotencyKey);
    }

    const placeholders = groupInsertVals.map((_, i) => `$${i + 1}`).join(", ");

    const { rows: [group] } = await client.query(
      `INSERT INTO public.order_groups (${groupInsertCols.join(", ")})
       VALUES (${placeholders})
       RETURNING id`,
      groupInsertVals
    );

    const orderGroupId = group.id;
    const trackingId   = generateTrackingId(orderGroupId);

    if (groupCols.hasTrackingId) {
      try {
        await client.query(
          `UPDATE public.order_groups SET tracking_id = $1 WHERE id = $2`,
          [trackingId, orderGroupId]
        );
      } catch (err) {
        console.warn("[orderService] tracking_id update failed:", err.message);
      }
    }

    /* ══════════════════════════════════════════════════
       4. Redeem coupon — full validation + server-calc discount
    ══════════════════════════════════════════════════ */
    let redemption = null;
    if (couponCode) {
      redemption = await redeemCouponInTransaction(client, {
        code         : couponCode,
        userId,
        orderGroupId,
        subtotal     : cleanSubtotal,
      });
      discount   = redemption.discount;
      grandTotal = cleanSubtotal + deliveryFee - discount;

      /* Update order_group with final numbers */
      await client.query(
        `UPDATE public.order_groups
         SET discount    = $1,
             grand_total = $2
         WHERE id = $3`,
        [discount, grandTotal, orderGroupId]
      );
    }

    /* ══════════════════════════════════════════════════
       5. Group items by seller
    ══════════════════════════════════════════════════ */
    const sellerMap = new Map();
    for (const item of items) {
      if (!item.sellerId) {
        const err = new Error(`Missing seller ID for product "${item.name}"`);
        err.status = 400;
        throw err;
      }
      if (!sellerMap.has(item.sellerId)) {
        sellerMap.set(item.sellerId, {
          sellerName: item.sellerName ?? "Seller",
          items:      [],
        });
      }
      sellerMap.get(item.sellerId).items.push(item);
    }

    /* ══════════════════════════════════════════════════
       6. Create orders + items + decrement stock atomically
    ══════════════════════════════════════════════════ */
    const createdOrders = [];

    for (const [sellerId, sellerData] of sellerMap.entries()) {
      const { items: sellerItems, sellerName } = sellerData;
      const sellerSubtotal = sellerItems.reduce(
        (sum, i) => sum + toNumber(i.price) * toNumber(i.qty),
        0
      );

      const orderSql = orderCols.hasUserId
        ? `INSERT INTO public.orders
            (order_group_id, user_id, seller_id, subtotal, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING id`
        : `INSERT INTO public.orders
            (order_group_id, seller_id, subtotal, status)
           VALUES ($1, $2, $3, 'pending')
           RETURNING id`;

      const orderParams = orderCols.hasUserId
        ? [orderGroupId, userId, sellerId, sellerSubtotal]
        : [orderGroupId, sellerId, sellerSubtotal];

      const { rows: [order] } = await client.query(orderSql, orderParams);
      devLog(`[orderService] ✓ Created order ${order.id} for seller ${sellerId}`);

      /* Decrement stock + insert items — both atomic */
      for (const item of sellerItems) {
        await decrementStock(client, item);

        const insert = buildOrderItemInsert(itemCols, order.id, sellerId, item);
        devLog(`[orderService] SQL: ${insert.sql}`);
        await client.query(insert.sql, insert.params);
      }

      createdOrders.push({
        orderId:  order.id,
        sellerId,
        sellerName,
        subtotal: sellerSubtotal,
        items:    sellerItems,
      });
    }

    /* ══════════════════════════════════════════════════
       7. Bump address last_used_at (cross-device UX)
    ══════════════════════════════════════════════════ */
    try {
      await client.query(
        `UPDATE public.user_addresses
         SET last_used_at = now()
         WHERE id = $1 AND user_id = $2`,
        [addressId, userId]
      );
    } catch (err) {
      console.warn("[orderService] address last_used_at skipped:", err.message);
    }

    /*
     * ══════════════════════════════════════════════════
     * 8. Cart is NOT cleared here anymore.
     *    Caller (createOrder.js) clears the cart only AFTER
     *    payment link is generated (or COD is confirmed).
     *    This prevents cart loss on payment gateway failures.
     * ══════════════════════════════════════════════════
     */

    await client.query("COMMIT");

    /* ══════════════════════════════════════════════════
       9. Post-commit: invalidate coupon cache (best-effort)
    ══════════════════════════════════════════════════ */
    if (redemption) {
      invalidateCouponCache(userId).catch((err) =>
        console.warn("[orderService] coupon cache invalidation failed:", err.message)
      );
    }

    console.log(
      `[orderService] ✅ Created order group ${orderGroupId} ` +
      `with ${createdOrders.length} sub-orders` +
      (redemption ? ` + coupon "${redemption.code}" (₦${redemption.discount})` : "") +
      (isFreeShipping ? " [FREE SHIPPING]" : "")
    );

    return {
      orderGroupId,
      trackingId,
      orders       : createdOrders,
      subtotal     : cleanSubtotal,
      deliveryFee,
      discount,
      grandTotal,
      couponCode   : redemption?.code ?? null,
      freeShipping : isFreeShipping,
    };

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] createOrderGroup rolled back:", {
      message:    err.message,
      code:       err.code,
      status:     err.status,
      source:     err.source,
      detail:     IS_DEV ? err.detail : undefined,
      constraint: IS_DEV ? err.constraint : undefined,
    });
    throw err;
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   CLEAR CART  (called by createOrder.js after payment success)
   ─────────────────────────────────────────────────────────
   Separated from createOrderGroup so orders can be created
   without immediately losing the cart — if payment fails
   the user can retry checkout.
════════════════════════════════════════════════════════════ */
export async function clearCart(userId) {
  try {
    await pool.query(
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.cart_id = c.id AND c.user_id = $1`,
      [userId]
    );
    devLog(`[orderService] cart cleared for user=${userId}`);
  } catch (err) {
    console.warn("[orderService] clearCart failed:", err.message);
    /* Non-fatal — cart will clear on next order or manual refresh */
  }
}

/* ════════════════════════════════════════════════════════════
   RESTORE STOCK  (called when payment fails after order created)
   ─────────────────────────────────────────────────────────
   If Flutterwave payment fails and the order is abandoned,
   restore the stock we decremented.
════════════════════════════════════════════════════════════ */
export async function restoreStock(orderGroupId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: items } = await client.query(
      `SELECT oi.variant_id, oi.quantity
       FROM public.orders o
       JOIN public.order_items oi ON oi.order_id = o.id
       WHERE o.order_group_id = $1 AND oi.variant_id IS NOT NULL`,
      [orderGroupId]
    );

    for (const item of items) {
      await client.query(
        `UPDATE market.product_variants
         SET stock = stock + $1
         WHERE id = $2`,
        [toNumber(item.quantity), item.variant_id]
      );
    }

    await client.query("COMMIT");
    console.log(`[orderService] ✓ Restored stock for ${items.length} items on ${orderGroupId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] restoreStock failed:", err.message);
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   HELPER — invalidate coupon cache (best-effort)
════════════════════════════════════════════════════════════ */
async function invalidateCouponCache(userId) {
  try {
    const mod = await import("../routes/coupons.js");
    if (typeof mod.invalidateUserCache === "function") {
      await mod.invalidateUserCache(userId);
    }
  } catch (err) {
    devLog("[orderService] coupon cache invalidation skipped:", err.message);
  }
}

/* ════════════════════════════════════════════════════════════
   MARK ORDER GROUP PAID
════════════════════════════════════════════════════════════ */
export async function markOrderGroupPaid(orderGroupId, paymentRef) {
  const [groupCols, orderCols] = await Promise.all([
    detectOrderGroupColumns(),
    detectOrderColumns(),
  ]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE public.order_groups
       SET payment_status = 'paid',
           payment_ref    = $2,
           status         = 'confirmed'
           ${groupCols.hasUpdatedAt ? ", updated_at = now()" : ""}
       WHERE id = $1`,
      [orderGroupId, paymentRef]
    );

    await client.query(
      `UPDATE public.orders
       SET status = 'confirmed'
           ${orderCols.hasUpdatedAt ? ", updated_at = now()" : ""}
       WHERE order_group_id = $1`,
      [orderGroupId]
    );

    await client.query("COMMIT");
    console.log(`[orderService] ✅ Order ${orderGroupId} marked paid`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] markOrderGroupPaid failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   MARK ORDER GROUP DELIVERED
════════════════════════════════════════════════════════════ */
export async function markOrderGroupDelivered(orderGroupId) {
  const [groupCols, orderCols] = await Promise.all([
    detectOrderGroupColumns(),
    detectOrderColumns(),
  ]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const groupSet = ["status = 'delivered'"];
    if (groupCols.hasDeliveredAt) groupSet.push("delivered_at = now()");
    if (groupCols.hasUpdatedAt)   groupSet.push("updated_at   = now()");

    await client.query(
      `UPDATE public.order_groups SET ${groupSet.join(", ")} WHERE id = $1`,
      [orderGroupId]
    );

    const orderSet = ["status = 'delivered'"];
    if (orderCols.hasDeliveredAt) orderSet.push("delivered_at = now()");
    if (orderCols.hasUpdatedAt)   orderSet.push("updated_at   = now()");

    await client.query(
      `UPDATE public.orders SET ${orderSet.join(", ")} WHERE order_group_id = $1`,
      [orderGroupId]
    );

    await client.query("COMMIT");
    console.log(`[orderService] ✅ Order ${orderGroupId} marked delivered`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] markOrderGroupDelivered failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   GET FULL ORDER GROUP
════════════════════════════════════════════════════════════ */
export async function getOrderGroup(orderGroupId, userId) {
  const { rows: [group] } = await pool.query(
    `SELECT
       og.*,
       a.recipient_name,
       a.phone,
       a.address_line,
       a.landmark,
       a.additional_directions,
       a.call_before_delivery,
       a.city,
       a.state
     FROM public.order_groups og
     LEFT JOIN public.user_addresses a ON a.id = og.address_id
     WHERE og.id = $1 AND og.user_id = $2`,
    [orderGroupId, userId]
  );

  if (!group) return null;

  const { rows: orders } = await pool.query(
    `SELECT o.*, u.name AS seller_name
     FROM public.orders o
     LEFT JOIN market.users u ON u.id = o.seller_id
     WHERE o.order_group_id = $1
     ORDER BY o.created_at ASC`,
    [orderGroupId]
  );

  for (const order of orders) {
    const { rows: items } = await pool.query(
      `SELECT
         oi.*,
         p.name AS product_name
       FROM public.order_items oi
       LEFT JOIN market.products p ON p.id = oi.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [order.id]
    );
    order.items = items;
  }

  return { ...group, orders };
}