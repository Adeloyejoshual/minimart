/**
 * services/orderService.js
 *
 * v10 — Loemart Express
 * ────────────────────────────────────────────────────────────
 * NEW in v10:
 * ✓ Sub-order tracking IDs  (ORD-1F9DFB89-A, -B, -C …)
 * ✓ order_status_history rows on every creation
 * ✓ seller_earnings rows created at order creation
 * ✓ order_dispatches row created when order ships
 * ✓ computeGroupStatus() — derives parent from sub-orders
 * ✓ recomputeGroupStatus() — called by seller PATCH route
 * ✓ All v9 features preserved
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

/**
 * Parent tracking ID:    ORD-1F9DFB89
 * Sub-order suffix:      ORD-1F9DFB89-A  (index 0 = A, 1 = B …)
 */
function generateTrackingId(uuid) {
  return `ORD-${uuid.slice(0, 8).toUpperCase()}`;
}

function generateSubTrackingId(parentTrackingId, index) {
  const suffix = String.fromCharCode(65 + index); // 0→A, 1→B …
  return `${parentTrackingId}-${suffix}`;
}

function generateDispatchCode(uuid) {
  return `LX-${uuid.slice(0, 6).toUpperCase()}`;
}

function devLog(...args) {
  if (IS_DEV) console.log(...args);
}

/* ════════════════════════════════════════════════════════════
   UUID FORMAT DETECTION
════════════════════════════════════════════════════════════ */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(str) {
  return typeof str === "string" && UUID_REGEX.test(str);
}

/* ════════════════════════════════════════════════════════════
   PARENT STATUS COMPUTATION
   ─────────────────────────────────────────────────────────
   Derives order_groups.status from all its sub-order statuses.
   Called after any sub-order status change.
════════════════════════════════════════════════════════════ */
export function computeGroupStatus(subStatuses) {
  if (!subStatuses.length) return "pending";

  const live       = subStatuses.filter((s) => s !== "cancelled");
  const allOf      = (s) => live.every((x) => x === s);
  const anyOf      = (...ss) => live.some((x) => ss.includes(x));
  const allSettled = live.every((x) => ["delivered", "cancelled"].includes(x));

  if (live.length === 0)                    return "cancelled";        // all cancelled
  if (allOf("pending"))                     return "pending";
  if (allOf("confirmed"))                   return "confirmed";
  if (allOf("delivered"))                   return "delivered";        // all done
  if (allSettled && live.some((x) => x === "delivered"))
                                            return "partially_delivered";
  if (anyOf("shipped"))                     return "partially_shipped";
  if (anyOf("processing", "confirmed"))     return "processing";
  return "pending";
}

/* ════════════════════════════════════════════════════════════
   RECOMPUTE GROUP STATUS
   ─────────────────────────────────────────────────────────
   Called by routes/seller/order.js after PATCH /status.
   Reads all sub-order statuses, computes parent, writes it.
   Runs inside the caller's transaction client.
════════════════════════════════════════════════════════════ */
export async function recomputeGroupStatus(client, orderGroupId) {
  const { rows } = await client.query(
    `SELECT status FROM public.orders WHERE order_group_id = $1`,
    [orderGroupId]
  );

  const statuses    = rows.map((r) => r.status);
  const groupStatus = computeGroupStatus(statuses);

  const setDelivered =
    groupStatus === "delivered"
      ? ", delivered_at = NOW()"
      : "";

  await client.query(
    `UPDATE public.order_groups
     SET status     = $1,
         updated_at = NOW()
         ${setDelivered}
     WHERE id = $2`,
    [groupStatus, orderGroupId]
  );

  return groupStatus;
}

/* ════════════════════════════════════════════════════════════
   PLATFORM FEE
   ─────────────────────────────────────────────────────────
   Adjust rate as needed.  5% default.
════════════════════════════════════════════════════════════ */
const PLATFORM_FEE_RATE = 0.05; // 5%

function calcPlatformFee(subtotal) {
  return Math.round(subtotal * PLATFORM_FEE_RATE * 100) / 100;
}

/* ════════════════════════════════════════════════════════════
   COLUMN DETECTION (cached per process)
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
      hasSubtotal      : cols.has("subtotal"),
      hasDeliveredAt   : cols.has("delivered_at"),
      hasUpdatedAt     : cols.has("updated_at"),
      hasIdempotencyKey: cols.has("idempotency_key"),
    };
    console.log("[orderService] order_groups cols:", ORDER_GROUP_COLS);
  } catch (err) {
    console.warn("[orderService] order_groups detection failed:", err.message);
    ORDER_GROUP_COLS = {
      hasTrackingId: true, hasSubtotal: true,
      hasDeliveredAt: true, hasUpdatedAt: true, hasIdempotencyKey: false,
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
      hasTrackingId : cols.has("tracking_id"),
      hasDeliveryFee: cols.has("delivery_fee"),
      hasDeliveredAt: cols.has("delivered_at"),
      hasUpdatedAt  : cols.has("updated_at"),
    };
    console.log("[orderService] orders cols:", ORDER_COLS);
  } catch (err) {
    console.warn("[orderService] orders detection failed:", err.message);
    ORDER_COLS = {
      hasUserId: true, hasTrackingId: true, hasDeliveryFee: true,
      hasDeliveredAt: true, hasUpdatedAt: true,
    };
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
      qtyColumn     : cols.has("quantity")     ? "quantity"   : cols.has("qty")        ? "qty"        : null,
      priceColumn   : cols.has("price")        ? "price"      : cols.has("unit_price") ? "unit_price" : null,
      nameColumn    : cols.has("name")         ? "name"       : cols.has("product_name") ? "product_name" : null,
      subtotalColumn: cols.has("subtotal")     ? "subtotal"   : cols.has("total_price") ? "total_price"  : null,
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
      qty  : ORDER_ITEM_COLS.qtyColumn,
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

  if (itemCols.hasProductId)   { columns.push("product_id");         values.push(item.productId); }
  if (itemCols.hasSellerId)    { columns.push("seller_id");          values.push(sellerId); }
  if (itemCols.hasVendorId)    { columns.push("vendor_id");          values.push(sellerId); }
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

  devLog(
    `[orderService] ✓ Stock: variant=${item.variant.id}`,
    `-${qty} remaining=${updated.stock}`
  );
}

/* ════════════════════════════════════════════════════════════
   ATOMIC COUPON REDEMPTION
════════════════════════════════════════════════════════════ */
async function redeemCouponInTransaction(
  client,
  { code, userId, orderGroupId, subtotal }
) {
  if (!code) return null;

  const upperCode = String(code).trim().toUpperCase();
  if (!upperCode) return null;

  const { rows: [coupon] } = await client.query(
    `SELECT id, is_private, created_by, is_active, type, value,
            max_discount, min_purchase, usage_limit, usage_count, expires_at
     FROM public.coupons WHERE UPPER(code) = $1 FOR UPDATE`,
    [upperCode]
  );

  if (!coupon) {
    const e = new Error(`Coupon "${upperCode}" not found`);
    e.status = 400; e.source = "coupon_redemption"; throw e;
  }
  if (!coupon.is_active) {
    const e = new Error(`Coupon "${upperCode}" is inactive`);
    e.status = 400; e.source = "coupon_redemption"; throw e;
  }
  if (coupon.is_private && coupon.created_by !== userId) {
    const e = new Error(`Coupon "${upperCode}" is not valid for your account`);
    e.status = 403; e.source = "coupon_redemption"; throw e;
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    const e = new Error(`Coupon "${upperCode}" has expired`);
    e.status = 400; e.source = "coupon_redemption"; throw e;
  }
  if (
    coupon.usage_limit !== null &&
    toNumber(coupon.usage_count) >= toNumber(coupon.usage_limit)
  ) {
    const e = new Error(`Coupon "${upperCode}" usage limit reached`);
    e.status = 400; e.source = "coupon_redemption"; throw e;
  }
  if (
    toNumber(coupon.min_purchase) > 0 &&
    subtotal < toNumber(coupon.min_purchase)
  ) {
    const e = new Error(
      `Coupon needs min ₦${toNumber(coupon.min_purchase).toLocaleString("en-NG")}`
    );
    e.status = 400; e.source = "coupon_redemption"; throw e;
  }

  const { rows: existing } = await client.query(
    `SELECT id FROM public.coupon_redemptions
     WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
    [coupon.id, userId]
  );
  if (existing.length) {
    const e = new Error(`You have already used coupon "${upperCode}"`);
    e.status = 400; e.source = "coupon_redemption"; throw e;
  }

  const actualDiscount = calculateCouponDiscount(coupon, subtotal);
  const freeShipping   = coupon.type === "free_shipping";

  await client.query(
    `INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount)
     VALUES ($1, $2, $3, $4)`,
    [coupon.id, userId, orderGroupId, actualDiscount]
  );

  const isSingleUse =
    coupon.usage_limit !== null && toNumber(coupon.usage_limit) === 1;

  await client.query(
    `UPDATE public.coupons
     SET usage_count = usage_count + 1,
         is_active = CASE
           WHEN $1 THEN false
           WHEN usage_limit IS NOT NULL
                AND usage_count + 1 >= usage_limit THEN false
           ELSE is_active
         END
     WHERE id = $2`,
    [isSingleUse, coupon.id]
  );

  console.log(
    `[orderService] ✓ Coupon "${upperCode}" redeemed | discount=₦${actualDiscount}`
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
════════════════════════════════════════════════════════════ */
async function findExistingOrder(client, userId, idempotencyKey, groupCols) {
  if (!idempotencyKey || !groupCols.hasIdempotencyKey) return null;

  const { rows: [existing] } = await client.query(
    `SELECT id, tracking_id, grand_total, delivery_fee, payment_method
     FROM public.order_groups
     WHERE user_id = $1 AND idempotency_key = $2`,
    [userId, idempotencyKey]
  );

  if (existing) console.log(`[orderService] ⚡ Idempotent replay: ${existing.id}`);
  return existing ?? null;
}

/* ════════════════════════════════════════════════════════════
   RESOLVE ORDER GROUP — UUID or tracking ID
════════════════════════════════════════════════════════════ */
export async function resolveOrderGroup(identifier, userId) {
  if (!identifier) return null;

  const column = isUUID(identifier) ? "id" : "tracking_id";

  const { rows: [row] } = await pool.query(
    `SELECT id, tracking_id
     FROM public.order_groups
     WHERE ${column} = $1 AND user_id = $2`,
    [identifier, userId]
  );

  return row ?? null;
}

/* ════════════════════════════════════════════════════════════
   CREATE ORDER GROUP  (v10 — Loemart Express)
════════════════════════════════════════════════════════════ */
export async function createOrderGroup({
  userId,
  addressId,
  items,
  subtotal,
  paymentMethod,
  couponCode    = null,
  notes         = null,
  idempotencyKey = null,
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

    /* ── 0. Idempotency ── */
    const existing = await findExistingOrder(
      client, userId, idempotencyKey, groupCols
    );
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

    /* ── 1. Peek coupon for free-shipping flag ── */
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

    /* ── 2. Delivery fee (Loemart Express) ── */
    const deliveryFee = isFreeShipping ? 0 : calculateDeliveryFee(cleanSubtotal);
    let discount      = 0;
    let grandTotal    = cleanSubtotal + deliveryFee;

    /* ── 3. Insert order_groups row ── */
    const groupInsertCols = [
      "user_id", "address_id", "total_amount",
      "delivery_fee", "discount", "grand_total",
      "payment_method", "coupon_code", "notes",
      "payment_status", "status",
    ];
    const groupInsertVals = [
      userId, addressId, cleanSubtotal,
      deliveryFee, discount, grandTotal,
      paymentMethod, couponCode, notes,
      "pending", "pending",
    ];

    /* Optional: subtotal column */
    if (groupCols.hasSubtotal) {
      groupInsertCols.push("subtotal");
      groupInsertVals.push(cleanSubtotal);
    }

    /* Optional: idempotency key */
    if (groupCols.hasIdempotencyKey && idempotencyKey) {
      groupInsertCols.push("idempotency_key");
      groupInsertVals.push(idempotencyKey);
    }

    const ph = groupInsertVals.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: [group] } = await client.query(
      `INSERT INTO public.order_groups (${groupInsertCols.join(", ")})
       VALUES (${ph})
       RETURNING id`,
      groupInsertVals
    );

    const orderGroupId   = group.id;
    const parentTracking = generateTrackingId(orderGroupId); // ORD-1F9DFB89

    /* Write tracking ID */
    if (groupCols.hasTrackingId) {
      await client.query(
        `UPDATE public.order_groups SET tracking_id = $1 WHERE id = $2`,
        [parentTracking, orderGroupId]
      ).catch((err) =>
        console.warn("[orderService] tracking_id update failed:", err.message)
      );
    }

    /* ── 4. Redeem coupon ── */
    let redemption = null;
    if (couponCode) {
      redemption = await redeemCouponInTransaction(client, {
        code: couponCode, userId, orderGroupId, subtotal: cleanSubtotal,
      });
      discount   = redemption.discount;
      grandTotal = cleanSubtotal + deliveryFee - discount;

      await client.query(
        `UPDATE public.order_groups
         SET discount = $1, grand_total = $2
         WHERE id = $3`,
        [discount, grandTotal, orderGroupId]
      );
    }

    /* ── 5. Group items by seller ── */
    const sellerMap = new Map();
    for (const item of items) {
      if (!item.sellerId) {
        const err = new Error(`Missing seller ID for "${item.name}"`);
        err.status = 400;
        throw err;
      }
      if (!sellerMap.has(item.sellerId)) {
        sellerMap.set(item.sellerId, {
          sellerName: item.sellerName ?? "Seller",
          items     : [],
        });
      }
      sellerMap.get(item.sellerId).items.push(item);
    }

    /* ── 6. Create sub-orders, items, stock, earnings, history ── */
    const createdOrders = [];
    let   sellerIndex   = 0;

    for (const [sellerId, sellerData] of sellerMap.entries()) {
      const { items: sellerItems, sellerName } = sellerData;

      /* Sub-order tracking ID: ORD-1F9DFB89-A */
      const subTrackingId = generateSubTrackingId(parentTracking, sellerIndex);
      sellerIndex++;

      const sellerSubtotal = sellerItems.reduce(
        (sum, i) => sum + toNumber(i.price) * toNumber(i.qty),
        0
      );

      /* Build INSERT dynamically (same column-detection pattern) */
      const orderCols_ = ["order_group_id", "seller_id", "subtotal", "status"];
      const orderVals_ = [orderGroupId, sellerId, sellerSubtotal, "pending"];

      if (orderCols.hasUserId) {
        orderCols_.push("user_id");
        orderVals_.push(userId);
      }
      if (orderCols.hasTrackingId) {
        orderCols_.push("tracking_id");
        orderVals_.push(subTrackingId);
      }
      if (orderCols.hasDeliveryFee) {
        /* Per-seller delivery fee is 0 — the group-level fee covers it */
        orderCols_.push("delivery_fee");
        orderVals_.push(0);
      }

      const oPh = orderVals_.map((_, i) => `$${i + 1}`).join(", ");
      const { rows: [order] } = await client.query(
        `INSERT INTO public.orders (${orderCols_.join(", ")})
         VALUES (${oPh})
         RETURNING id`,
        orderVals_
      );

      /* Stock + line items */
      for (const item of sellerItems) {
        await decrementStock(client, item);
        const ins = buildOrderItemInsert(itemCols, order.id, sellerId, item);
        await client.query(ins.sql, ins.params);
      }

      /* ── Seller earnings row ── */
      const platformFee = calcPlatformFee(sellerSubtotal);
      const netAmount   = sellerSubtotal - platformFee;

      await client.query(
        `INSERT INTO public.seller_earnings
           (seller_id, order_id, order_group_id,
            gross_amount, platform_fee, delivery_fee, net_amount, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
        [
          sellerId, order.id, orderGroupId,
          sellerSubtotal, platformFee,
          deliveryFee, // Loemart Express fee — kept by platform
          netAmount,
        ]
      ).catch((err) =>
        console.warn("[orderService] seller_earnings insert failed:", err.message)
      );

      /* ── Status history row ── */
      await client.query(
        `INSERT INTO public.order_status_history
           (order_id, order_group_id, from_status, to_status, changed_by_role, note)
         VALUES ($1,$2,NULL,'pending','system','Order created')`,
        [order.id, orderGroupId]
      ).catch((err) =>
        console.warn("[orderService] status_history insert failed:", err.message)
      );

      createdOrders.push({
        orderId    : order.id,
        trackingId : subTrackingId,
        sellerId,
        sellerName,
        subtotal   : sellerSubtotal,
        items      : sellerItems,
      });

      devLog(
        `[orderService] ✓ Sub-order ${subTrackingId}`,
        `| seller=${sellerId}`,
        `| ₦${sellerSubtotal}`,
        `| net=₦${netAmount}`
      );
    }

    /* ── 7. Bump address last_used_at ── */
    await client.query(
      `UPDATE public.user_addresses
       SET last_used_at = now()
       WHERE id = $1 AND user_id = $2`,
      [addressId, userId]
    ).catch(() => {});

    await client.query("COMMIT");

    /* ── 8. Invalidate coupon cache (best-effort) ── */
    if (redemption) {
      invalidateCouponCache(userId).catch(() => {});
    }

    console.log(
      `[orderService] ✅ ${parentTracking} | ${createdOrders.length} sellers` +
      (redemption    ? ` | coupon "${redemption.code}"` : "") +
      (isFreeShipping ? " | FREE SHIP"                  : "")
    );

    return {
      orderGroupId,
      trackingId  : parentTracking,
      orders      : createdOrders,
      subtotal    : cleanSubtotal,
      deliveryFee,
      discount,
      grandTotal,
      couponCode  : redemption?.code ?? null,
      freeShipping: isFreeShipping,
    };

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] ROLLBACK:", {
      message   : err.message,
      code      : err.code,
      status    : err.status,
      source    : err.source,
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
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.cart_id = c.id AND c.user_id = $1`,
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
        `UPDATE market.product_variants
         SET stock = stock + $1
         WHERE id = $2`,
        [toNumber(item.quantity), item.variant_id]
      );
    }

    await client.query("COMMIT");
    console.log(
      `[orderService] ✓ Stock restored: ${items.length} items on ${orderGroupId}`
    );
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

    /* History rows for each sub-order */
    const { rows: orders } = await client.query(
      `SELECT id FROM public.orders WHERE order_group_id = $1`,
      [orderGroupId]
    );
    for (const o of orders) {
      await client.query(
        `INSERT INTO public.order_status_history
           (order_id, order_group_id, from_status, to_status, changed_by_role, note)
         VALUES ($1,$2,'pending','confirmed','system','Payment confirmed')`,
        [o.id, orderGroupId]
      ).catch(() => {});
    }

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

    /* Clear earnings */
    await client.query(
      `UPDATE public.seller_earnings
       SET status = 'cleared', cleared_at = now(), updated_at = now()
       WHERE order_group_id = $1`,
      [orderGroupId]
    ).catch(() => {});

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
   GET FULL ORDER GROUP — UUID or tracking ID
   ─────────────────────────────────────────────────────────
   Returns group + nested sub-orders + items + dispatch info
════════════════════════════════════════════════════════════ */
export async function getOrderGroup(identifier, userId) {
  if (!identifier) return null;

  const column = isUUID(identifier) ? "og.id" : "og.tracking_id";

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
     WHERE ${column} = $1 AND og.user_id = $2`,
    [identifier, userId]
  );

  if (!group) return null;

  /* Sub-orders with seller name + dispatch info */
  const { rows: orders } = await pool.query(
    `SELECT
       o.*,
       u.name AS seller_name,
       d.dispatch_code,
       d.status         AS dispatch_status,
       d.agent_id,
       da.name          AS agent_name,
       da.phone         AS agent_phone,
       d.estimated_at,
       d.delivered_at   AS dispatch_delivered_at,
       d.delivery_photo_url
     FROM public.orders o
     LEFT JOIN market.users         u  ON u.id  = o.seller_id
     LEFT JOIN public.order_dispatches d  ON d.order_id = o.id
     LEFT JOIN public.delivery_agents da ON da.id = d.agent_id
     WHERE o.order_group_id = $1
     ORDER BY o.tracking_id ASC`,
    [group.id]
  );

  /* Items per sub-order */
  for (const order of orders) {
    const { rows: items } = await pool.query(
      `SELECT oi.*, p.name AS product_name
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