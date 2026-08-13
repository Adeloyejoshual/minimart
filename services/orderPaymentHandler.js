/**
 * services/orderPaymentHandler.js
 *
 * v5 — Tracking ID logging + cleaner free-shipping detection
 * ──────────────────────────────────────────────────────
 * ✓ All v4 features preserved
 * ✓ Logs tracking ID (ORD-XXXX) instead of raw UUID where possible
 * ✓ Free shipping detected from coupon type, not inferred from fee=0
 * ✓ Snapshot includes coupon type for accurate notification branching
 */

import axios from "axios";
import { pool } from "../config/db.js";
import { markOrderGroupPaid } from "./orderService.js";
import { dispatchOrderNotifications } from "./checkoutNotificationService.js";

/* ════════════════════════════════════════════════════════════
   STRUCTURED LOGGER
════════════════════════════════════════════════════════════ */
const log = (level, tag, data = {}) => {
  const line = JSON.stringify({
    ts : new Date().toISOString(),
    src: "ORDER-PAYMENT",
    tag,
    ...data,
  });
  if      (level === "error") console.error(line);
  else if (level === "warn")  console.warn(line);
  else                        console.log(line);
};

/* ════════════════════════════════════════════════════════════
   FLUTTERWAVE VERIFICATION
════════════════════════════════════════════════════════════ */
async function verifyWithFLW(txId) {
  const key = process.env.FLW_SECRET_KEY;
  if (!key) {
    log("error", "NO_FLW_KEY", { txId });
    return null;
  }

  try {
    const { data } = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${txId}/verify`,
      {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 15_000,
      }
    );
    return data;
  } catch (err) {
    log("error", "FLW_VERIFY_ERROR", {
      txId,
      status: err.response?.status,
      msg   : err.response?.data?.message ?? err.message,
    });
    return null;
  }
}

/* ════════════════════════════════════════════════════════════
   FETCH ORDER SNAPSHOT FOR NOTIFICATIONS
   ─────────────────────────────────────────────────────
   Fetches the data needed to dispatch notifications.
   The notification service handles address + delivery window.
════════════════════════════════════════════════════════════ */
async function fetchOrderSnapshot(orderGroupId) {

  /* ── 1. Order group + buyer + coupon type ── */
  const { rows: [group] } = await pool.query(
    `SELECT
       og.id,
       og.tracking_id,
       og.grand_total,
       og.delivery_fee,
       og.total_amount   AS subtotal,
       og.discount,
       og.coupon_code,
       og.payment_method,
       og.payment_status,
       og.address_id,
       og.user_id,
       u.email           AS buyer_email,
       u.name            AS buyer_name,
       c.type            AS coupon_type
     FROM public.order_groups og
     LEFT JOIN market.users u ON u.id = og.user_id
     LEFT JOIN public.coupons c ON UPPER(c.code) = UPPER(og.coupon_code)
     WHERE og.id = $1`,
    [orderGroupId]
  );

  if (!group) return null;

  /* ── 2. Sub-orders ── */
  const { rows: subOrders } = await pool.query(
    `SELECT
       o.id       AS order_id,
       o.seller_id,
       o.subtotal
     FROM public.orders o
     WHERE o.order_group_id = $1
     ORDER BY o.created_at ASC`,
    [orderGroupId]
  );

  /* ── 3. All items with product info ── */
  const { rows: allItems } = await pool.query(
    `SELECT
       oi.id,
       oi.order_id,
       oi.product_id,
       oi.seller_id,
       oi.quantity              AS qty,
       oi.price,
       oi.image,
       oi.variant_name,
       oi.sku,
       COALESCE(p.name, 'Product') AS name,
       (
         SELECT pi.image_url
         FROM market.product_images pi
         WHERE pi.product_id = oi.product_id AND pi.is_primary = true
         LIMIT 1
       ) AS product_image
     FROM public.order_items oi
     LEFT JOIN public.orders   o ON o.id = oi.order_id
     LEFT JOIN market.products p ON p.id = oi.product_id
     WHERE o.order_group_id = $1
     ORDER BY oi.id`,
    [orderGroupId]
  );

  /* ── 4. Structure for dispatchOrderNotifications() ── */
  const subOrdersWithItems = subOrders.map((sub) => ({
    orderId  : sub.order_id,
    sellerId : sub.seller_id,
    subtotal : Number(sub.subtotal),
    items    : allItems
      .filter((it) => it.order_id === sub.order_id)
      .map((it) => ({
        name   : it.name,
        qty    : it.qty,
        price  : it.price,
        image  : it.image || it.product_image || null,
        variant: it.variant_name
          ? { name: it.variant_name, sku: it.sku }
          : null,
      })),
  }));

  /*
   * Free shipping detection:
   * Instead of fragile inference (delivery_fee=0 && coupon_code exists),
   * we now JOIN the coupons table and check the actual coupon type.
   */
  const freeShipping = group.coupon_type === "free_shipping";

  const trackingId = group.tracking_id
    ?? `ORD-${group.id.slice(0, 8).toUpperCase()}`;

  return {
    user: {
      id   : group.user_id,
      email: group.buyer_email,
      name : group.buyer_name,
    },
    orderGroupId : group.id,
    trackingId,
    subtotal     : Number(group.subtotal),
    deliveryFee  : Number(group.delivery_fee),
    discount     : Number(group.discount || 0),
    couponCode   : group.coupon_code,
    grandTotal   : Number(group.grand_total),
    freeShipping,
    addressId    : group.address_id,
    orders       : subOrdersWithItems,
  };
}

/* ════════════════════════════════════════════════════════════
   MAIN HANDLER — CALLED BY WEBHOOK
   ─────────────────────────────────────────────────────
   Returns:
     { handled: true }                    → payment processed
     { handled: true, alreadyPaid: true } → idempotent success
     { handled: false }                   → not an order or failed
════════════════════════════════════════════════════════════ */
export async function handleOrderPayment(data) {
  const txId         = data?.id;
  const txRef        = data?.tx_ref;
  const orderGroupId = data?.meta?.order_group_id;

  /* ── Not an order payment ── */
  if (!orderGroupId) {
    log("info", "NOT_AN_ORDER_PAYMENT", { txRef });
    return { handled: false };
  }

  log("info", "ORDER_PAYMENT_START", {
    txId, txRef, orderGroupId,
    status: data?.status,
    amount: data?.amount,
  });

  /* ── Only process successful charges ── */
  if (data?.status?.toLowerCase() !== "successful") {
    log("info", "SKIPPED_NOT_SUCCESSFUL", { status: data?.status, txRef });
    return { handled: false };
  }

  /* ══════════════════════════════════════════════════
     STEP 1: Verify with Flutterwave API
  ══════════════════════════════════════════════════ */
  log("info", "VERIFYING_WITH_FLW", { txId, orderGroupId });
  const verifyRes = await verifyWithFLW(txId);

  if (!verifyRes || verifyRes.status !== "success") {
    log("error", "VERIFICATION_FAILED", { txId, verifyStatus: verifyRes?.status });
    return { handled: false };
  }

  const v = verifyRes.data;

  if (v.status?.toLowerCase() !== "successful") {
    log("error", "VERIFIED_NOT_SUCCESSFUL", { verifiedStatus: v.status, txId });
    return { handled: false };
  }

  /* ══════════════════════════════════════════════════
     STEP 2: Fetch current order state
  ══════════════════════════════════════════════════ */
  const { rows: [order] } = await pool.query(
    `SELECT id, tracking_id, grand_total, payment_status
     FROM public.order_groups
     WHERE id = $1`,
    [orderGroupId]
  );

  if (!order) {
    log("error", "ORDER_NOT_FOUND", { orderGroupId, txRef });
    return { handled: false };
  }

  const trackingId = order.tracking_id
    ?? `ORD-${orderGroupId.slice(0, 8).toUpperCase()}`;

  /* ══════════════════════════════════════════════════
     STEP 3: Idempotency check
  ══════════════════════════════════════════════════ */
  if (order.payment_status === "paid") {
    log("info", "ALREADY_PAID_SKIPPING", { trackingId, txRef });
    return { handled: true, alreadyPaid: true };
  }

  /* ══════════════════════════════════════════════════
     STEP 4: Amount tampering check (₦1 tolerance)
  ══════════════════════════════════════════════════ */
  if (Math.abs(Number(v.amount) - Number(order.grand_total)) > 1) {
    log("error", "AMOUNT_MISMATCH", {
      trackingId,
      expected: order.grand_total,
      paid    : v.amount,
      txRef,
    });
    return { handled: false };
  }

  /* ══════════════════════════════════════════════════
     STEP 5: Mark order as paid
  ══════════════════════════════════════════════════ */
  const paymentRef = v.tx_ref ?? txRef;

  try {
    await markOrderGroupPaid(orderGroupId, paymentRef);
    log("info", "ORDER_MARKED_PAID", {
      trackingId,
      amount  : v.amount,
      currency: v.currency,
      txId, txRef,
    });
  } catch (err) {
    log("error", "MARK_PAID_FAILED", {
      trackingId,
      error: err.message,
      code : err.code,
    });
    return { handled: false };
  }

  /* ══════════════════════════════════════════════════
     STEP 6: Dispatch notifications (fire-and-forget)
  ══════════════════════════════════════════════════ */
  try {
    const snapshot = await fetchOrderSnapshot(orderGroupId);

    if (!snapshot) {
      log("warn", "NO_SNAPSHOT_FOR_NOTIFICATIONS", { trackingId });
      return { handled: true };
    }

    dispatchOrderNotifications({
      ...snapshot,
      paymentMethod   : "ONLINE_PAYMENT",
      paymentReference: paymentRef,
    })
      .then((result) => {
        log("info", "NOTIFICATIONS_DISPATCHED", {
          trackingId,
          succeeded: result?.succeeded ?? 0,
          failed   : result?.failed ?? 0,
        });
      })
      .catch((err) => {
        log("error", "NOTIFICATIONS_DISPATCH_FAILED", {
          trackingId,
          error: err.message,
        });
      });

  } catch (err) {
    log("error", "FETCH_SNAPSHOT_FAILED", {
      trackingId,
      error: err.message,
    });
  }

  return { handled: true };
}