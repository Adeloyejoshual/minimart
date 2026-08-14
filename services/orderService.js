/**
 * services/orderService.js
 *
 * v11 — Loemart Express (complete)
 * ────────────────────────────────────────────────────────────
 * Exports:
 *   VALID_TRANSITIONS
 *   ALL_STATUSES
 *   STATUS_LABELS
 *   isTransitionAllowed(from, to, role)
 *   allowedTransitionsForRole(from, role)
 *   computeGroupStatus(subStatuses[])
 *   recomputeGroupStatus(client, orderGroupId)
 *   markSubOrderDelivered(client, orderId, orderGroupId, adminId)
 *   markSubOrderReceived(client, orderId, orderGroupId, confirmedBy)
 *   resolveOrderGroup(identifier, userId)
 *   createOrderGroup({ ... })
 *   markOrderGroupPaid(orderGroupId, paymentRef)
 *   markOrderGroupDelivered(orderGroupId)
 *   getOrderGroup(identifier, userId)
 *   clearCart(userId)
 *   restoreStock(orderGroupId)
 */

import { pool }                 from "../config/db.js";
import { calculateDeliveryFee } from "./delivery.js";

const IS_DEV = process.env.NODE_ENV !== "production";

/* ════════════════════════════════════════════════════════════
   TRANSITION RULES & CONSTANTS
   ─────────────────────────────────────────────────────────
   Single source of truth — used by seller, admin, buyer routes.
════════════════════════════════════════════════════════════ */

/**
 * All valid status values for public.orders
 */
export const ALL_STATUSES = new Set([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "failed_delivery",
  "received",
  "cancelled",
]);

/**
 * Valid next statuses from each current status.
 * Used for UI rendering and server-side validation.
 */
export const VALID_TRANSITIONS = {
  pending:          ["confirmed",        "cancelled"],
  confirmed:        ["processing",       "cancelled"],
  processing:       ["shipped",          "cancelled"],
  shipped:          ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered",        "failed_delivery"],
  delivered:        ["received"],
  failed_delivery:  ["out_for_delivery", "cancelled"],
  received:         [],
  cancelled:        [],
};

export const STATUS_LABELS = {
  pending:          "Pending",
  confirmed:        "Confirmed",
  processing:       "Processing",
  shipped:          "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
  failed_delivery:  "Delivery Failed",
  received:         "Received",
  cancelled:        "Cancelled",
};

/**
 * Role-based transition rules.
 *
 * Roles:
 *   seller — authenticated seller
 *   admin  — Loemart admin / dispatch operator
 *   buyer  — authenticated buyer
 *   system — automated jobs (auto-confirm, payment webhook)
 */
const TRANSITION_RULES = [
  { from: "pending",          to: "confirmed",        roles: ["seller", "admin"] },
  { from: "pending",          to: "cancelled",        roles: ["seller", "admin", "buyer"] },
  { from: "confirmed",        to: "processing",       roles: ["seller", "admin"] },
  { from: "confirmed",        to: "cancelled",        roles: ["seller", "admin", "buyer"] },
  { from: "processing",       to: "shipped",          roles: ["seller", "admin"] },
  { from: "processing",       to: "cancelled",        roles: ["seller", "admin", "buyer"] },
  { from: "shipped",          to: "out_for_delivery", roles: ["admin", "system"] },
  { from: "shipped",          to: "cancelled",        roles: ["admin"] },
  { from: "out_for_delivery", to: "delivered",        roles: ["admin", "system"] },
  { from: "out_for_delivery", to: "failed_delivery",  roles: ["admin", "system"] },
  { from: "delivered",        to: "received",         roles: ["buyer", "system"] },
  { from: "failed_delivery",  to: "out_for_delivery", roles: ["admin", "system"] },
  { from: "failed_delivery",  to: "cancelled",        roles: ["admin"] },
];

/**
 * Returns true if the given role may perform this transition.
 */
export function isTransitionAllowed(fromStatus, toStatus, role) {
  return TRANSITION_RULES.some(
    (r) => r.from === fromStatus && r.to === toStatus && r.roles.includes(role)
  );
}

/**
 * Returns all statuses a given role can transition TO from fromStatus.
 */
export function allowedTransitionsForRole(fromStatus, role) {
  return TRANSITION_RULES
    .filter((r) => r.from === fromStatus && r.roles.includes(role))
    .map((r) => r.to);
}

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

function generateSubTrackingId(parentTrackingId, index) {
  /* 0→A, 1→B … 25→Z, 26→AA … */
  let suffix = "";
  let n      = index;
  do {
    suffix = String.fromCharCode(65 + (n % 26)) + suffix;
    n      = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${parentTrackingId}-${suffix}`;
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
   PLATFORM FEE
════════════════════════════════════════════════════════════ */
const PLATFORM_FEE_RATE = 0.05; // 5%

function calcPlatformFee(subtotal) {
  return Math.round(subtotal * PLATFORM_FEE_RATE * 100) / 100;
}

/* ════════════════════════════════════════════════════════════
   GROUP STATUS COMPUTATION
   ─────────────────────────────────────────────────────────
   Derives order_groups.status from all sub-order statuses.
════════════════════════════════════════════════════════════ */
export function computeGroupStatus(subStatuses) {
  if (!subStatuses || subStatuses.length === 0) return "pending";

  const live = subStatuses.filter((s) => s !== "cancelled");

  /* All cancelled */
  if (live.length === 0) return "cancelled";

  const allOf  = (s)     => live.every((x) => x === s);
  const anyOf  = (...ss) => live.some((x) => ss.includes(x));

  /* Pure terminal states */
  if (allOf("received"))                         return "received";
  if (allOf("delivered"))                        return "delivered";

  /* Failed delivery — any sub-order failed */
  if (anyOf("failed_delivery"))                  return "failed_delivery";

  /* All in same early stage */
  if (allOf("pending"))                          return "pending";
  if (allOf("confirmed"))                        return "confirmed";
  if (allOf("processing"))                       return "processing";
  if (allOf("shipped"))                          return "shipped";
  if (allOf("out_for_delivery"))                 return "out_for_delivery";

  /* Mixed terminal: some received/delivered, rest cancelled */
  if (
    live.every((x) => ["received", "delivered", "cancelled"].includes(x)) &&
    anyOf("received", "delivered")
  )                                              return "partially_delivered";

  /* Any in transit */
  if (anyOf("out_for_delivery"))                 return "out_for_delivery";
  if (anyOf("shipped"))                          return "partially_shipped";

  /* Any processing/confirmed */
  if (anyOf("processing", "confirmed", "shipped")) return "processing";

  return "pending";
}

/* ════════════════════════════════════════════════════════════
   RECOMPUTE GROUP STATUS
   ─────────────────────────────────────────────────────────
   Reads all sub-order statuses for a group, computes the
   parent status, and writes it to order_groups.
   MUST be called inside an open transaction client.

   @returns {string} The new group status
════════════════════════════════════════════════════════════ */
export async function recomputeGroupStatus(client, orderGroupId) {
  const { rows } = await client.query(
    `SELECT status FROM public.orders WHERE order_group_id = $1`,
    [orderGroupId]
  );

  const statuses    = rows.map((r) => r.status);
  const groupStatus = computeGroupStatus(statuses);

  const extra =
    groupStatus === "received" || groupStatus === "delivered"
      ? ", delivered_at = COALESCE(delivered_at, NOW())"
      : "";

  await client.query(
    `UPDATE public.order_groups
     SET status     = $1,
         updated_at = NOW()
         ${extra}
     WHERE id = $2`,
    [groupStatus, orderGroupId]
  );

  return groupStatus;
}

/* ════════════════════════════════════════════════════════════
   STATUS HISTORY HELPER
   ─────────────────────────────────────────────────────────
   Wraps the INSERT so callers don't repeat the SQL.
   Non-fatal — logs warning on failure.
════════════════════════════════════════════════════════════ */
async function writeStatusHistory(client, {
  orderId,
  orderGroupId,
  fromStatus    = null,
  toStatus,
  changedById   = null,
  changedByRole = "system",
  note          = null,
}) {
  await client.query(
    `INSERT INTO public.order_status_history
       (order_id, order_group_id, from_status, to_status,
        changed_by_id, changed_by_role, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [orderId, orderGroupId, fromStatus, toStatus, changedById, changedByRole, note]
  ).catch((err) =>
    console.warn("[orderService] status_history insert failed:", err.message)
  );
}

/* ════════════════════════════════════════════════════════════
   MARK SUB-ORDER DELIVERED
   ─────────────────────────────────────────────────────────
   Called by admin route when Loemart Express agent confirms
   drop-off at buyer's address.
   Sets status = "delivered".
   Creates delivery_confirmations row (48h auto-confirm timer).
   MUST be called inside an open transaction client.
════════════════════════════════════════════════════════════ */
export async function markSubOrderDelivered(
  client,
  orderId,
  orderGroupId,
  adminId = null
) {
  const autoConfirmAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  /* Update sub-order */
  await client.query(
    `UPDATE public.orders
     SET status       = 'delivered',
         delivered_at = NOW(),
         updated_at   = NOW()
     WHERE id = $1`,
    [orderId]
  );

  /* Status history */
  await writeStatusHistory(client, {
    orderId,
    orderGroupId,
    fromStatus   : "out_for_delivery",
    toStatus     : "delivered",
    changedById  : adminId,
    changedByRole: "admin",
    note         : "Delivered by Loemart Express agent",
  });

  /* 48h confirmation window */
  await client.query(
    `INSERT INTO public.delivery_confirmations
       (order_id, order_group_id, delivered_at, auto_confirm_at)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (order_id) DO UPDATE
       SET delivered_at    = NOW(),
           auto_confirm_at = $3,
           confirmed_at    = NULL,
           confirmed_by    = NULL`,
    [orderId, orderGroupId, autoConfirmAt]
  ).catch((err) =>
    console.warn("[orderService] delivery_confirmations insert failed:", err.message)
  );

  return { autoConfirmAt };
}

/* ════════════════════════════════════════════════════════════
   MARK SUB-ORDER RECEIVED
   ─────────────────────────────────────────────────────────
   Called by:
     - Buyer route  (confirmedBy = 'buyer')
     - Auto-confirm job (confirmedBy = 'system')
   Clears seller earnings.
   MUST be called inside an open transaction client.
════════════════════════════════════════════════════════════ */
export async function markSubOrderReceived(
  client,
  orderId,
  orderGroupId,
  confirmedBy = "system"
) {
  /* Update sub-order */
  await client.query(
    `UPDATE public.orders
     SET status               = 'received',
         received_at          = NOW(),
         receipt_confirmed_by = $1,
         updated_at           = NOW()
     WHERE id = $2`,
    [confirmedBy, orderId]
  );

  /* Close confirmation window */
  await client.query(
    `UPDATE public.delivery_confirmations
     SET confirmed_at = NOW(),
         confirmed_by = $1
     WHERE order_id = $2 AND confirmed_at IS NULL`,
    [confirmedBy, orderId]
  ).catch(() => {});

  /* Status history */
  await writeStatusHistory(client, {
    orderId,
    orderGroupId,
    fromStatus   : "delivered",
    toStatus     : "received",
    changedByRole: confirmedBy,
    note         : confirmedBy === "buyer"
      ? "Buyer confirmed receipt"
      : "Auto-confirmed after 48-hour window",
  });

  /* Clear seller earnings — money released to seller */
  await client.query(
    `UPDATE public.seller_earnings
     SET status     = 'cleared',
         cleared_at = NOW(),
         updated_at = NOW()
     WHERE order_id = $1 AND status = 'pending'`,
    [orderId]
  ).catch((err) =>
    console.warn("[orderService] earnings clear failed:", err.message)
  );

  console.log(
    `[orderService] ✅ ${orderId} received by ${confirmedBy} — earnings cleared`
  );
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
      hasUserId          : cols.has("user_id"),
      hasTrackingId      : cols.has("tracking_id"),
      hasDeliveryFee     : cols.has("delivery_fee"),
      hasShippedAt       : cols.has("shipped_at"),
      hasDeliveredAt     : cols.has("delivered_at"),
      hasReceivedAt      : cols.has("received_at"),
      hasCancelledAt     : cols.has("cancelled_at"),
      hasPickupReadyAt   : cols.has("pickup_ready_at"),
      hasOutForDeliveryAt: cols.has("out_for_delivery_at"),
      hasUpdatedAt       : cols.has("updated_at"),
    };
    console.log("[orderService] orders cols:", ORDER_COLS);
  } catch (err) {
    console.warn("[orderService] orders detection failed:", err.message);
    ORDER_COLS = {
      hasUserId: true, hasTrackingId: true, hasDeliveryFee: true,
      hasShippedAt: true, hasDeliveredAt: true, hasReceivedAt: true,
      hasCancelledAt: true, hasPickupReadyAt: true,
      hasOutForDeliveryAt: true, hasUpdatedAt: true,
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
      qtyColumn     : cols.has("quantity")     ? "quantity"      : cols.has("qty")          ? "qty"          : null,
      priceColumn   : cols.has("price")        ? "price"         : cols.has("unit_price")   ? "unit_price"   : null,
      nameColumn    : cols.has("name")         ? "name"          : cols.has("product_name") ? "product_name" : null,
      subtotalColumn: cols.has("subtotal")     ? "subtotal"      : cols.has("total_price")  ? "total_price"  : null,
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
      qtyColumn: "quantity", priceColumn: "price",
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

  const push = (col, val) => { columns.push(col); values.push(val); };

  if (itemCols.hasProductId)   push("product_id",          item.productId);
  if (itemCols.hasSellerId)    push("seller_id",           sellerId);
  if (itemCols.hasVendorId)    push("vendor_id",           sellerId);
  if (itemCols.qtyColumn)      push(itemCols.qtyColumn,    toNumber(item.qty));
  if (itemCols.priceColumn)    push(itemCols.priceColumn,  toNumber(item.price));
  if (itemCols.nameColumn)     push(itemCols.nameColumn,   item.name);
  if (itemCols.subtotalColumn) push(itemCols.subtotalColumn, toNumber(item.price) * toNumber(item.qty));
  if (itemCols.hasVariantId)   push("variant_id",          item.variant?.id   ?? null);
  if (itemCols.hasVariantName) push("variant_name",        item.variant?.name ?? null);
  if (itemCols.hasSku)         push("sku",                 item.variant?.sku  ?? null);
  if (itemCols.hasImage)       push("image",               item.image ?? null);
  if (itemCols.hasImageUrl)    push("image_url",           item.image ?? null);

  const ph = values.map((_, i) => `$${i + 1}`).join(", ");
  return {
    sql   : `INSERT INTO public.order_items (${columns.join(", ")}) VALUES (${ph})`,
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
        : `Only ${available} unit(s) of "${item.name}" available — you requested ${qty}`
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
     FROM public.coupons
     WHERE UPPER(code) = $1
     FOR UPDATE`,
    [upperCode]
  );

  const reject = (msg, status = 400) => {
    const e = new Error(msg);
    e.status = status;
    e.source = "coupon_redemption";
    throw e;
  };

  if (!coupon)                                                    reject(`Coupon "${upperCode}" not found`);
  if (!coupon.is_active)                                          reject(`Coupon "${upperCode}" is no longer active`);
  if (coupon.is_private && coupon.created_by !== userId)          reject(`Coupon "${upperCode}" is not valid for your account`, 403);
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) reject(`Coupon "${upperCode}" has expired`);
  if (
    coupon.usage_limit !== null &&
    toNumber(coupon.usage_count) >= toNumber(coupon.usage_limit)
  )                                                               reject(`Coupon "${upperCode}" has reached its usage limit`);
  if (
    toNumber(coupon.min_purchase) > 0 &&
    subtotal < toNumber(coupon.min_purchase)
  )                                                               reject(`Minimum order of ₦${toNumber(coupon.min_purchase).toLocaleString("en-NG")} required`);

  const { rows: used } = await client.query(
    `SELECT id FROM public.coupon_redemptions
     WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
    [coupon.id, userId]
  );
  if (used.length) reject(`You have already used coupon "${upperCode}"`);

  const discount     = calculateCouponDiscount(coupon, subtotal);
  const freeShipping = coupon.type === "free_shipping";

  await client.query(
    `INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount)
     VALUES ($1, $2, $3, $4)`,
    [coupon.id, userId, orderGroupId, discount]
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
    `[orderService] ✓ Coupon "${upperCode}" redeemed | discount=₦${discount}`
  );
  return { couponId: coupon.id, code: upperCode, discount, freeShipping, type: coupon.type };
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

  if (existing) {
    console.log(`[orderService] ⚡ Idempotent replay: ${existing.tracking_id ?? existing.id}`);
  }
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
   CREATE ORDER GROUP
   ─────────────────────────────────────────────────────────
   Creates:
     1. order_groups row (parent)
     2. orders rows (one per seller = sub-orders)
     3. order_items rows (line items)
     4. seller_earnings rows (one per sub-order)
     5. order_status_history rows (one per sub-order)
   Decrements stock atomically.
════════════════════════════════════════════════════════════ */
export async function createOrderGroup({
  userId,
  addressId,
  items,
  subtotal,
  paymentMethod,
  couponCode     = null,
  notes          = null,
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

    /* ── 1. Peek coupon type for free-shipping flag ── */
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

    /* ── 2. Loemart Express delivery fee ── */
    const deliveryFee = isFreeShipping ? 0 : calculateDeliveryFee(cleanSubtotal);
    let discount      = 0;
    let grandTotal    = cleanSubtotal + deliveryFee;

    /* ── 3. Insert parent order_groups row ── */
    const gCols = [
      "user_id", "address_id", "total_amount",
      "delivery_fee", "discount", "grand_total",
      "payment_method", "coupon_code", "notes",
      "payment_status", "status",
    ];
    const gVals = [
      userId, addressId, cleanSubtotal,
      deliveryFee, discount, grandTotal,
      paymentMethod, couponCode, notes,
      "pending", "pending",
    ];

    if (groupCols.hasSubtotal) { gCols.push("subtotal"); gVals.push(cleanSubtotal); }
    if (groupCols.hasIdempotencyKey && idempotencyKey) {
      gCols.push("idempotency_key"); gVals.push(idempotencyKey);
    }

    const gPh = gVals.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: [group] } = await client.query(
      `INSERT INTO public.order_groups (${gCols.join(", ")})
       VALUES (${gPh})
       RETURNING id`,
      gVals
    );

    const orderGroupId   = group.id;
    const parentTracking = generateTrackingId(orderGroupId);

    /* Write tracking_id */
    if (groupCols.hasTrackingId) {
      await client.query(
        `UPDATE public.order_groups SET tracking_id = $1 WHERE id = $2`,
        [parentTracking, orderGroupId]
      ).catch((err) =>
        console.warn("[orderService] tracking_id write failed:", err.message)
      );
    }

    /* ── 4. Redeem coupon inside transaction ── */
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
        const err = new Error(`Missing seller ID for item "${item.name}"`);
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

    /* ── 6. Create sub-orders ── */
    const createdOrders = [];
    let   sellerIndex   = 0;

    for (const [sellerId, { sellerName, items: sellerItems }] of sellerMap) {
      const subTrackingId  = generateSubTrackingId(parentTracking, sellerIndex++);
      const sellerSubtotal = sellerItems.reduce(
        (sum, i) => sum + toNumber(i.price) * toNumber(i.qty), 0
      );

      /* Build sub-order INSERT */
      const oCols = ["order_group_id", "seller_id", "subtotal", "status"];
      const oVals = [orderGroupId, sellerId, sellerSubtotal, "pending"];

      if (orderCols.hasUserId)      { oCols.push("user_id");      oVals.push(userId); }
      if (orderCols.hasTrackingId)  { oCols.push("tracking_id");  oVals.push(subTrackingId); }
      if (orderCols.hasDeliveryFee) { oCols.push("delivery_fee"); oVals.push(0); }

      const oPh = oVals.map((_, i) => `$${i + 1}`).join(", ");
      const { rows: [order] } = await client.query(
        `INSERT INTO public.orders (${oCols.join(", ")})
         VALUES (${oPh})
         RETURNING id`,
        oVals
      );

      /* Stock decrement + line items */
      for (const item of sellerItems) {
        await decrementStock(client, item);
        const ins = buildOrderItemInsert(itemCols, order.id, sellerId, item);
        await client.query(ins.sql, ins.params);
      }

      /* seller_earnings row */
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
          deliveryFee,
          netAmount,
        ]
      ).catch((err) =>
        console.warn("[orderService] seller_earnings insert failed:", err.message)
      );

      /* Status history row */
      await writeStatusHistory(client, {
        orderId      : order.id,
        orderGroupId,
        fromStatus   : null,
        toStatus     : "pending",
        changedByRole: "system",
        note         : "Order created",
      });

      createdOrders.push({
        orderId    : order.id,
        trackingId : subTrackingId,
        sellerId,
        sellerName,
        subtotal   : sellerSubtotal,
        platformFee,
        netAmount,
        items      : sellerItems,
      });

      devLog(
        `[orderService] ✓ Sub-order ${subTrackingId}`,
        `seller=${sellerId} ₦${sellerSubtotal} net=₦${netAmount}`
      );
    }

    /* ── 7. Bump address last_used_at ── */
    await client.query(
      `UPDATE public.user_addresses
       SET last_used_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [addressId, userId]
    ).catch(() => {});

    await client.query("COMMIT");

    /* Invalidate coupon cache (best-effort, post-commit) */
    if (redemption) invalidateCouponCache(userId).catch(() => {});

    console.log(
      `[orderService] ✅ ${parentTracking}`,
      `| ${createdOrders.length} seller(s)`,
      redemption     ? `| coupon "${redemption.code}" -₦${redemption.discount}` : "",
      isFreeShipping ? "| FREE SHIPPING" : `| delivery fee ₦${deliveryFee}`
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
    devLog(`[orderService] ✓ Cart cleared for user=${userId}`);
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
      `SELECT oi.variant_id, COALESCE(oi.quantity, oi.qty, 0) AS qty
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
        [toNumber(item.qty), item.variant_id]
      );
    }

    await client.query("COMMIT");
    console.log(
      `[orderService] ✓ Stock restored: ${items.length} variant(s) for group=${orderGroupId}`
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
   ─────────────────────────────────────────────────────────
   Called by Flutterwave webhook after successful payment.
   Moves group + all sub-orders: pending → confirmed.
════════════════════════════════════════════════════════════ */
export async function markOrderGroupPaid(orderGroupId, paymentRef) {
  const [groupCols, orderCols] = await Promise.all([
    detectOrderGroupColumns(),
    detectOrderColumns(),
  ]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Parent group */
    await client.query(
      `UPDATE public.order_groups
       SET payment_status = 'paid',
           payment_ref    = $2,
           status         = 'confirmed'
           ${groupCols.hasUpdatedAt ? ", updated_at = NOW()" : ""}
       WHERE id = $1`,
      [orderGroupId, paymentRef]
    );

    /* All sub-orders */
    const { rows: orders } = await client.query(
      `UPDATE public.orders
       SET status = 'confirmed'
           ${orderCols.hasUpdatedAt ? ", updated_at = NOW()" : ""}
       WHERE order_group_id = $1
       RETURNING id`,
      [orderGroupId]
    );

    /* History rows */
    for (const o of orders) {
      await writeStatusHistory(client, {
        orderId      : o.id,
        orderGroupId,
        fromStatus   : "pending",
        toStatus     : "confirmed",
        changedByRole: "system",
        note         : `Payment confirmed — ref: ${paymentRef}`,
      });
    }

    await client.query("COMMIT");
    console.log(`[orderService] ✅ ${orderGroupId} marked paid (ref=${paymentRef})`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] markOrderGroupPaid failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   MARK ORDER GROUP DELIVERED (legacy — whole group at once)
   ─────────────────────────────────────────────────────────
   Kept for backward compatibility with older webhook code.
   Prefer markSubOrderDelivered() for per-sub-order flow.
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
    if (groupCols.hasDeliveredAt) groupSet.push("delivered_at = NOW()");
    if (groupCols.hasUpdatedAt)   groupSet.push("updated_at   = NOW()");

    await client.query(
      `UPDATE public.order_groups SET ${groupSet.join(", ")} WHERE id = $1`,
      [orderGroupId]
    );

    const orderSet = ["status = 'delivered'"];
    if (orderCols.hasDeliveredAt) orderSet.push("delivered_at = NOW()");
    if (orderCols.hasUpdatedAt)   orderSet.push("updated_at   = NOW()");

    await client.query(
      `UPDATE public.orders SET ${orderSet.join(", ")} WHERE order_group_id = $1`,
      [orderGroupId]
    );

    /* Clear earnings */
    await client.query(
      `UPDATE public.seller_earnings
       SET status = 'cleared', cleared_at = NOW(), updated_at = NOW()
       WHERE order_group_id = $1`,
      [orderGroupId]
    ).catch(() => {});

    await client.query("COMMIT");
    console.log(`[orderService] ✅ ${orderGroupId} delivered`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] markOrderGroupDelivered failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   GET FULL ORDER GROUP — UUID or tracking ID
   ─────────────────────────────────────────────────────────
   Returns group + sub-orders + items + dispatch + agent info.
   Used by buyer-facing routes.
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

  /* Sub-orders with seller + Loemart Express dispatch info */
  const { rows: orders } = await pool.query(
    `SELECT
       o.*,
       u.name                AS seller_name,
       d.dispatch_code,
       d.status              AS dispatch_status,
       d.estimated_at,
       d.out_for_delivery_at AS dispatch_out_at,
       d.delivered_at        AS dispatch_delivered_at,
       d.delivery_photo_url,
       d.failure_reason,
       da.name               AS agent_name,
       da.phone              AS agent_phone,
       dc.auto_confirm_at,
       dc.confirmed_by       AS receipt_confirmed_by
     FROM public.orders o
     LEFT JOIN market.users               u  ON u.id  = o.seller_id
     LEFT JOIN public.order_dispatches    d  ON d.order_id = o.id
     LEFT JOIN public.delivery_agents     da ON da.id = d.agent_id
     LEFT JOIN public.delivery_confirmations dc ON dc.order_id = o.id
     WHERE o.order_group_id = $1
     ORDER BY o.tracking_id ASC`,
    [group.id]
  );

  /* Items per sub-order */
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