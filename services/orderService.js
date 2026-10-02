/**
 * services/orderService.js
 *
 * v10 — Delivery integration + hardened lookups
 * ────────────────────────────────────────────────────────────
 * NEW:
 * ✓ getOrderGroup() reads delivery.deliveries (external_order_id)
 * ✓ Latest delivery per order via LATERAL (no duplicate rows)
 * ✓ Items loaded in one batched query (no N+1)
 * ✓ parseIdentifier(): trims/normalizes, rejects malformed IDs
 * ✓ Legacy rows with NULL tracking_id still resolve
 * ✓ tracking_id inserted with the group (no failing UPDATE inside
 *   the transaction, which would abort it in Postgres)
 * ✓ markOrderGroupPaid is idempotent
 * ✓ All v9 features preserved
 */

import { randomUUID }           from "node:crypto";
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
   IDENTIFIER PARSING
   ─────────────────────────────────────────────────────────
   UUID           → match on id
   ORD-XXXXXXXX   → match on tracking_id (case-insensitive)
   anything else  → null (no DB hit)
════════════════════════════════════════════════════════════ */
const UUID_REGEX     = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRACKING_REGEX = /^ORD-[0-9A-F]{8}$/;

function isUUID(str) {
  return typeof str === "string" && UUID_REGEX.test(str);
}

function parseIdentifier(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;

  if (isUUID(value)) return { kind: "uuid", value: value.toLowerCase() };

  const upper = value.toUpperCase();
  if (TRACKING_REGEX.test(upper)) return { kind: "tracking", value: upper };

  return null;
}

/**
 * Builds the WHERE fragment for an order_groups alias.
 * Tracking lookups also match legacy rows whose tracking_id is NULL
 * by recomputing ORD-<first 8 of uuid>.
 */
function identifierClause(parsed, alias, paramIndex) {
  if (parsed.kind === "uuid") {
    return `${alias}.id = $${paramIndex}`;
  }
  return `(${alias}.tracking_id = $${paramIndex}
           OR (${alias}.tracking_id IS NULL
               AND 'ORD-' || UPPER(LEFT(${alias}.id::text, 8)) = $${paramIndex}))`;
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
      hasUserId     : cols.has("user_id"),
      hasDeliveredAt: cols.has("delivered_at"),
      hasUpdatedAt  : cols.has("updated_at"),
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

    ORDER_ITEM_COLS = {
      allColumns    : [...cols],
      qtyColumn     : cols.has("quantity") ? "quantity" : cols.has("qty") ? "qty" : null,
      priceColumn   : cols.has("price") ? "price" : cols.has("unit_price") ? "unit_price" : null,
      nameColumn    : cols.has("name") ? "name" : cols.has("product_name") ? "product_name" : null,
      subtotalColumn: cols.has("subtotal") ? "subtotal" : cols.has("total_price") ? "total_price" : null,
      hasProductId  : cols.has("product_id"),
      hasSellerId   : cols.has("seller_id"),
      hasVendorId   : cols.has("vendor_id"),
      hasVariantId  : cols.has("variant_id"),
      hasVariantName: cols.has("variant_name"),
      hasSku        : cols.has("sku"),
      hasImage      : cols.has("image"),
      hasImageUrl   : cols.has("image_url"),
    };

    console.log("[orderService] order_items:", {
      qty: ORDER_ITEM_COLS.qtyColumn,
      price: ORDER_ITEM_COLS.priceColumn,
    });
  } catch (err) {
    console.warn("[orderService] order_items detection failed:", err.message);
    ORDER_ITEM_COLS = {
      allColumns: [], qtyColumn: "quantity", priceColumn: "price",
      nameColumn: null, subtotalColumn: null,
      hasProductId: true, hasSellerId: true, hasVendorId: false,
      hasVariantId: true, hasVariantName: true, hasSku: true,
      hasImage: true, hasImageUrl: false,
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
  if (itemCols.hasVariantId)   { columns.push("variant_id");   values.push(item.variant?.id ?? null); }
  if (itemCols.hasVariantName) { columns.push("variant_name"); values.push(item.variant?.name ?? null); }
  if (itemCols.hasSku)         { columns.push("sku");          values.push(item.variant?.sku ?? null); }
  if (itemCols.hasImage)       { columns.push("image");        values.push(item.image ?? null); }
  if (itemCols.hasImageUrl)    { columns.push("image_url");    values.push(item.image ?? null); }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  return {
    sql   : `INSERT INTO public.order_items (${columns.join(", ")}) VALUES (${placeholders})`,
    params: values,
  };
}

/* ════════════════════════════════════════════════════════════
   COUPON DISCOUNT CALCULATION
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
  return 0;
}

/* ════════════════════════════════════════════════════════════
   ATOMIC STOCK DECREMENT
════════════════════════════════════════════════════════════ */
async function decrementStock(client, item) {
  if (!item.variant?.id) return;

  const qty = toNumber(item.qty);
  const { rows: [updated] } = await client.query(
    `UPDATE market.product_variants
     SET stock = stock - $1
     WHERE id = $2 AND stock >= $1
     RETURNING stock`,
    [qty, item.variant.id]
  );

  if (!updated) {
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

  devLog(`[orderService] ✓ Stock: variant=${item.variant.id} -${qty} remaining=${updated.stock}`);
}

/* ════════════════════════════════════════════════════════════
   ATOMIC COUPON REDEMPTION
════════════════════════════════════════════════════════════ */
function couponError(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  e.source = "coupon_redemption";
  return e;
}

async function redeemCouponInTransaction(client, { code, userId, orderGroupId, subtotal }) {
  if (!code) return null;

  const upperCode = String(code).trim().toUpperCase();
  if (!upperCode) return null;

  const { rows: [coupon] } = await client.query(
    `SELECT id, is_private, created_by, is_active, type, value,
            max_discount, min_purchase, usage_limit, usage_count, expires_at
     FROM public.coupons WHERE UPPER(code) = $1 FOR UPDATE`,
    [upperCode]
  );

  if (!coupon)           throw couponError(`Coupon "${upperCode}" not found`);
  if (!coupon.is_active) throw couponError(`Coupon "${upperCode}" is inactive`);
  if (coupon.is_private && coupon.created_by !== userId) {
    throw couponError(`Coupon "${upperCode}" not valid for you`, 403);
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    throw couponError(`Coupon "${upperCode}" has expired`);
  }
  if (coupon.usage_limit !== null && toNumber(coupon.usage_count) >= toNumber(coupon.usage_limit)) {
    throw couponError(`Coupon "${upperCode}" usage limit reached`);
  }
  if (toNumber(coupon.min_purchase) > 0 && subtotal < toNumber(coupon.min_purchase)) {
    throw couponError(`Coupon needs min ₦${toNumber(coupon.min_purchase).toLocaleString("en-NG")}`);
  }

  const { rows: existing } = await client.query(
    `SELECT id FROM public.coupon_redemptions WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
    [coupon.id, userId]
  );
  if (existing.length) throw couponError(`Already used coupon "${upperCode}"`);

  const actualDiscount = calculateCouponDiscount(coupon, subtotal);
  const freeShipping   = coupon.type === "free_shipping";

  await client.query(
    `INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount) VALUES ($1, $2, $3, $4)`,
    [coupon.id, userId, orderGroupId, actualDiscount]
  );

  const isSingleUse = coupon.usage_limit !== null && toNumber(coupon.usage_limit) === 1;
  await client.query(
    `UPDATE public.coupons
     SET usage_count = usage_count + 1,
         is_active = CASE
           WHEN $1 THEN false
           WHEN usage_limit IS NOT NULL AND usage_count + 1 >= usage_limit THEN false
           ELSE is_active
         END
     WHERE id = $2`,
    [isSingleUse, coupon.id]
  );

  console.log(`[orderService] ✓ Coupon "${upperCode}" redeemed | discount=₦${actualDiscount}`);
  return { couponId: coupon.id, code: upperCode, discount: actualDiscount, freeShipping, type: coupon.type };
}

/* ════════════════════════════════════════════════════════════
   IDEMPOTENCY CHECK
════════════════════════════════════════════════════════════ */
async function findExistingOrder(client, userId, idempotencyKey, groupCols) {
  if (!idempotencyKey || !groupCols.hasIdempotencyKey) return null;

  const { rows: [existing] } = await client.query(
    `SELECT id, tracking_id, grand_total, delivery_fee, payment_method
     FROM public.order_groups WHERE user_id = $1 AND idempotency_key = $2`,
    [userId, idempotencyKey]
  );

  if (existing) console.log(`[orderService] ⚡ Idempotent replay: ${existing.id}`);
  return existing ?? null;
}

/* ════════════════════════════════════════════════════════════
   RESOLVE ORDER GROUP — accepts UUID or tracking ID
   Returns { id, tracking_id } or null.
════════════════════════════════════════════════════════════ */
export async function resolveOrderGroup(identifier, userId) {
  const parsed = parseIdentifier(identifier);
  if (!parsed || !userId) return null;

  const { rows: [row] } = await pool.query(
    `SELECT og.id, og.tracking_id
     FROM public.order_groups og
     WHERE ${identifierClause(parsed, "og", 1)}
       AND og.user_id = $2
     LIMIT 1`,
    [parsed.value, userId]
  );

  if (!row) return null;
  return { id: row.id, tracking_id: row.tracking_id ?? generateTrackingId(row.id) };
}

/* ════════════════════════════════════════════════════════════
   CREATE ORDER GROUP
════════════════════════════════════════════════════════════ */
export async function createOrderGroup({
  userId, addressId, items, subtotal, paymentMethod,
  couponCode = null, notes = null, idempotencyKey = null,
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

    /* 0. Idempotency */
    const existing = await findExistingOrder(client, userId, idempotencyKey, groupCols);
    if (existing) {
      await client.query("ROLLBACK");
      return {
        orderGroupId: existing.id,
        trackingId  : existing.tracking_id ?? generateTrackingId(existing.id),
        deliveryFee : toNumber(existing.delivery_fee),
        grandTotal  : toNumber(existing.grand_total),
        orders      : [],
        idempotent  : true,
      };
    }

    /* 1. Peek coupon type */
    let couponType = null;
    if (couponCode) {
      const { rows: [c] } = await client.query(
        `SELECT type FROM public.coupons WHERE UPPER(code) = UPPER($1) AND is_active = true`,
        [couponCode]
      );
      couponType = c?.type ?? null;
    }
    const isFreeShipping = couponType === "free_shipping";

    /* 2. Calculate fees */
    const deliveryFee = isFreeShipping ? 0 : calculateDeliveryFee(cleanSubtotal);
    let discount   = 0;
    let grandTotal = cleanSubtotal + deliveryFee;

    /* 3. Insert order group
          id + tracking_id are generated up front so no follow-up
          UPDATE is needed (a failed statement would abort the
          whole transaction in Postgres). */
    const orderGroupId = randomUUID();
    const trackingId   = generateTrackingId(orderGroupId);

    const groupInsertCols = [
      "id", "user_id", "address_id", "total_amount", "delivery_fee",
      "discount", "grand_total", "payment_method", "coupon_code",
      "notes", "payment_status", "status",
    ];
    const groupInsertVals = [
      orderGroupId, userId, addressId, cleanSubtotal, deliveryFee, discount,
      grandTotal, paymentMethod, couponCode, notes, "pending", "pending",
    ];

    if (groupCols.hasTrackingId) {
      groupInsertCols.push("tracking_id");
      groupInsertVals.push(trackingId);
    }
    if (groupCols.hasIdempotencyKey && idempotencyKey) {
      groupInsertCols.push("idempotency_key");
      groupInsertVals.push(idempotencyKey);
    }

    const placeholders = groupInsertVals.map((_, i) => `$${i + 1}`).join(", ");
    await client.query(
      `INSERT INTO public.order_groups (${groupInsertCols.join(", ")}) VALUES (${placeholders})`,
      groupInsertVals
    );

    /* 4. Redeem coupon */
    let redemption = null;
    if (couponCode) {
      redemption = await redeemCouponInTransaction(client, {
        code: couponCode, userId, orderGroupId, subtotal: cleanSubtotal,
      });
      discount   = redemption.discount;
      grandTotal = cleanSubtotal + deliveryFee - discount;

      await client.query(
        `UPDATE public.order_groups SET discount = $1, grand_total = $2 WHERE id = $3`,
        [discount, grandTotal, orderGroupId]
      );
    }

    /* 5. Group by seller */
    const sellerMap = new Map();
    for (const item of items) {
      if (!item.sellerId) {
        const err = new Error(`Missing seller ID for "${item.name}"`);
        err.status = 400;
        throw err;
      }
      if (!sellerMap.has(item.sellerId)) {
        sellerMap.set(item.sellerId, { sellerName: item.sellerName ?? "Seller", items: [] });
      }
      sellerMap.get(item.sellerId).items.push(item);
    }

    /* 6. Create orders + items + decrement stock */
    const createdOrders = [];

    for (const [sellerId, sellerData] of sellerMap.entries()) {
      const { items: sellerItems, sellerName } = sellerData;
      const sellerSubtotal = sellerItems.reduce(
        (sum, i) => sum + toNumber(i.price) * toNumber(i.qty), 0
      );

      const orderSql = orderCols.hasUserId
        ? `INSERT INTO public.orders (order_group_id, user_id, seller_id, subtotal, status) VALUES ($1,$2,$3,$4,'pending') RETURNING id`
        : `INSERT INTO public.orders (order_group_id, seller_id, subtotal, status) VALUES ($1,$2,$3,'pending') RETURNING id`;

      const orderParams = orderCols.hasUserId
        ? [orderGroupId, userId, sellerId, sellerSubtotal]
        : [orderGroupId, sellerId, sellerSubtotal];

      const { rows: [order] } = await client.query(orderSql, orderParams);

      for (const item of sellerItems) {
        await decrementStock(client, item);
        const insert = buildOrderItemInsert(itemCols, order.id, sellerId, item);
        await client.query(insert.sql, insert.params);
      }

      createdOrders.push({
        orderId: order.id, sellerId, sellerName,
        subtotal: sellerSubtotal, items: sellerItems,
      });
    }

    /* 7. Bump address last_used_at (SAVEPOINT so a failure can't abort the txn) */
    try {
      await client.query("SAVEPOINT bump_address");
      await client.query(
        `UPDATE public.user_addresses SET last_used_at = now() WHERE id = $1 AND user_id = $2`,
        [addressId, userId]
      );
      await client.query("RELEASE SAVEPOINT bump_address");
    } catch {
      await client.query("ROLLBACK TO SAVEPOINT bump_address").catch(() => {});
    }

    await client.query("COMMIT");

    /* 8. Invalidate coupon cache */
    if (redemption) {
      invalidateCouponCache(userId).catch(() => {});
    }

    console.log(
      `[orderService] ✅ ${trackingId} created | ${createdOrders.length} sellers` +
      (redemption ? ` | coupon "${redemption.code}"` : "") +
      (isFreeShipping ? " | FREE SHIP" : "")
    );

    return {
      orderGroupId, trackingId,
      orders: createdOrders,
      subtotal: cleanSubtotal, deliveryFee, discount, grandTotal,
      couponCode: redemption?.code ?? null,
      freeShipping: isFreeShipping,
    };

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] ROLLBACK:", {
      message: err.message, code: err.code, status: err.status, source: err.source,
      ...(IS_DEV && { detail: err.detail, constraint: err.constraint }),
    });
    throw err;
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   CLEAR CART
════════════════════════════════════════════════════════════ */
export async function clearCart(userId) {
  try {
    await pool.query(
      `DELETE FROM market.cart_items ci USING market.carts c WHERE ci.cart_id = c.id AND c.user_id = $1`,
      [userId]
    );
  } catch (err) {
    console.warn("[orderService] clearCart failed:", err.message);
  }
}

/* ════════════════════════════════════════════════════════════
   RESTORE STOCK
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
        `UPDATE market.product_variants SET stock = stock + $1 WHERE id = $2`,
        [toNumber(item.quantity), item.variant_id]
      );
    }
    await client.query("COMMIT");
    console.log(`[orderService] ✓ Stock restored: ${items.length} items on ${orderGroupId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] restoreStock failed:", err.message);
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   COUPON CACHE INVALIDATION
════════════════════════════════════════════════════════════ */
async function invalidateCouponCache(userId) {
  try {
    const mod = await import("../routes/coupons.js");
    if (typeof mod.invalidateUserCache === "function") {
      await mod.invalidateUserCache(userId);
    }
  } catch { /* non-fatal */ }
}

/* ════════════════════════════════════════════════════════════
   MARK ORDER GROUP PAID (idempotent)
════════════════════════════════════════════════════════════ */
export async function markOrderGroupPaid(orderGroupId, paymentRef) {
  const [groupCols, orderCols] = await Promise.all([
    detectOrderGroupColumns(), detectOrderColumns(),
  ]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE public.order_groups
       SET payment_status = 'paid', payment_ref = $2, status = 'confirmed'
       ${groupCols.hasUpdatedAt ? ", updated_at = now()" : ""}
       WHERE id = $1 AND payment_status IS DISTINCT FROM 'paid'`,
      [orderGroupId, paymentRef]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      console.log(`[orderService] ⚡ ${orderGroupId} already paid — skipped`);
      return;
    }

    await client.query(
      `UPDATE public.orders SET status = 'confirmed'
       ${orderCols.hasUpdatedAt ? ", updated_at = now()" : ""}
       WHERE order_group_id = $1`,
      [orderGroupId]
    );

    await client.query("COMMIT");
    console.log(`[orderService] ✅ ${orderGroupId} marked paid`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] markPaid failed:", err.message);
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
    detectOrderGroupColumns(), detectOrderColumns(),
  ]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const groupSet = ["status = 'delivered'"];
    if (groupCols.hasDeliveredAt) groupSet.push("delivered_at = now()");
    if (groupCols.hasUpdatedAt)   groupSet.push("updated_at = now()");
    await client.query(
      `UPDATE public.order_groups SET ${groupSet.join(", ")} WHERE id = $1`,
      [orderGroupId]
    );

    const orderSet = ["status = 'delivered'"];
    if (orderCols.hasDeliveredAt) orderSet.push("delivered_at = now()");
    if (orderCols.hasUpdatedAt)   orderSet.push("updated_at = now()");
    await client.query(
      `UPDATE public.orders SET ${orderSet.join(", ")} WHERE order_group_id = $1`,
      [orderGroupId]
    );

    await client.query("COMMIT");
    console.log(`[orderService] ✅ ${orderGroupId} delivered`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] markDelivered failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   GET FULL ORDER GROUP — accepts UUID or tracking ID
   ─────────────────────────────────────────────────────────
   3 queries total. Delivery data comes from
   delivery.deliveries.external_order_id (= public.orders.id),
   latest record per order.
════════════════════════════════════════════════════════════ */
export async function getOrderGroup(identifier, userId) {
  const parsed = parseIdentifier(identifier);
  if (!parsed || !userId) return null;

  /* 1. Group + address */
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
     WHERE ${identifierClause(parsed, "og", 1)}
       AND og.user_id = $2
     LIMIT 1`,
    [parsed.value, userId]
  );

  if (!group) return null;

  group.tracking_id = group.tracking_id ?? generateTrackingId(group.id);

  /* 2. Seller orders + latest delivery each */
  const { rows: orders } = await pool.query(
    `SELECT
       o.*,
       u.name AS seller_name,
       d.delivery_tracking_id,
       d.status               AS delivery_status,
       d.estimated_delivery_at,
       d.delivered_at         AS delivery_delivered_at,
       d.source_type          AS delivery_source_type
     FROM public.orders o
     LEFT JOIN market.users u ON u.id = o.seller_id
     LEFT JOIN LATERAL (
       SELECT dd.delivery_tracking_id, dd.status, dd.estimated_delivery_at,
              dd.delivered_at, dd.source_type
       FROM delivery.deliveries dd
       WHERE dd.external_order_id::text = o.id::text
       ORDER BY dd.created_at DESC
       LIMIT 1
     ) d ON true
     WHERE o.order_group_id = $1
     ORDER BY o.created_at ASC`,
    [group.id]
  );

  /* 3. All items in one query, bucketed by order */
  const itemsByOrder = new Map(orders.map((o) => [o.id, []]));

  if (orders.length) {
    const { rows: items } = await pool.query(
      `SELECT oi.*, p.name AS product_name
       FROM public.order_items oi
       LEFT JOIN market.products p ON p.id = oi.product_id
       WHERE oi.order_id = ANY($1::uuid[])
       ORDER BY oi.id`,
      [orders.map((o) => o.id)]
    );
    for (const item of items) itemsByOrder.get(item.order_id)?.push(item);
  }

  for (const order of orders) order.items = itemsByOrder.get(order.id) ?? [];

  return { ...group, orders };
}
