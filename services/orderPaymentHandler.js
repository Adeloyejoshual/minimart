/**
 * services/orderPaymentHandler.js
 *
 * v3 — Rich notifications with items, images, addresses
 * ──────────────────────────────────────────────────────
 * ✓ Verifies payment with Flutterwave API
 * ✓ Amount tampering protection (₦1 tolerance)
 * ✓ Idempotent (skip if already paid)
 * ✓ Marks order group as paid
 * ✓ BUYER: rich payment confirmation email with items + address
 * ✓ SELLERS: dedicated "New Order Received" email per seller
 * ✓ In-app notifications for buyer + all sellers
 * ✓ Non-blocking (email failures don't fail the order)
 * ✓ Comprehensive logging for Render debugging
 */

import axios from "axios";
import { pool } from "../config/db.js";
import { markOrderGroupPaid } from "./orderService.js";
import {
  sendPaymentNotification,
  sendNewOrderToSeller,
  createNotification,
} from "./notificationService.js";

/* ════════════════════════════════════════════════════════════
   STRUCTURED LOGGER
════════════════════════════════════════════════════════════ */
const log = (level, tag, data = {}) => {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    src: "ORDER-PAYMENT",
    tag,
    ...data,
  });
  if (level === "error")     console.error(line);
  else if (level === "warn") console.warn(line);
  else                       console.log(line);
};

/* ════════════════════════════════════════════════════════════
   VERIFY TRANSACTION WITH FLUTTERWAVE
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
      msg:    err.response?.data?.message ?? err.message,
    });
    return null;
  }
}

/* ════════════════════════════════════════════════════════════
   FETCH FULL ORDER CONTEXT
   ─────────────────────────────────────────────────────
   Returns everything needed for rich notifications:
   - Buyer info + email
   - Delivery address
   - All sub-orders per seller
   - All order items with product images
════════════════════════════════════════════════════════════ */
async function fetchOrderContext(orderGroupId) {

  /* ── 1. Fetch order group + buyer info ── */
  const { rows: [group] } = await pool.query(
    `SELECT
       og.id,
       og.tracking_id,
       og.grand_total,
       og.delivery_fee,
       og.total_amount,
       og.discount,
       og.payment_method,
       og.payment_status,
       og.notes,
       og.address_id,
       og.user_id,
       og.created_at,
       u.email AS buyer_email,
       u.name  AS buyer_name
     FROM public.order_groups og
     LEFT JOIN market.users u ON u.id = og.user_id
     WHERE og.id = $1`,
    [orderGroupId]
  );

  if (!group) return null;

  /* ── 2. Fetch delivery address ── */
  let deliveryAddress = null;
  if (group.address_id) {
    try {
      const { rows: [addr] } = await pool.query(
        `SELECT
           recipient_name,
           phone,
           address_line,
           landmark,
           city,
           state
         FROM public.user_addresses
         WHERE id = $1`,
        [group.address_id]
      );

      if (addr) {
        deliveryAddress = [
          addr.recipient_name,
          addr.address_line,
          addr.landmark ? `(${addr.landmark})` : "",
          addr.city,
          addr.state,
        ].filter(Boolean).join(", ");
      }
    } catch (err) {
      log("warn", "ADDRESS_FETCH_FAILED", {
        addressId: group.address_id,
        error:     err.message,
      });
    }
  }

  /* ── 3. Fetch sub-orders (one per seller) with counts ── */
  const { rows: subOrders } = await pool.query(
    `SELECT
       o.id       AS order_id,
       o.seller_id,
       o.subtotal,
       u.email    AS seller_email,
       u.name     AS seller_name,
       COUNT(oi.id)::int AS item_count
     FROM public.orders o
     LEFT JOIN market.users     u  ON u.id = o.seller_id
     LEFT JOIN public.order_items oi ON oi.order_id = o.id
     WHERE o.order_group_id = $1
     GROUP BY o.id, o.seller_id, o.subtotal, u.email, u.name
     ORDER BY o.created_at ASC`,
    [orderGroupId]
  );

  /* ── 4. Fetch ALL order items with product info ── */
  const { rows: allItems } = await pool.query(
    `SELECT
       oi.id,
       oi.order_id,
       oi.product_id,
       oi.seller_id,
       oi.quantity AS qty,
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
     LEFT JOIN public.orders   o  ON o.id  = oi.order_id
     LEFT JOIN market.products p  ON p.id  = oi.product_id
     WHERE o.order_group_id = $1
     ORDER BY oi.id`,
    [orderGroupId]
  );

  /* Enrich items with best available image */
  const enrichedItems = allItems.map((item) => ({
    ...item,
    image:   item.image || item.product_image || null,
    variant: item.variant_name || null,
  }));

  /* Attach items to their respective sub-orders */
  const subOrdersWithItems = subOrders.map((sub) => ({
    ...sub,
    items: enrichedItems.filter((it) => it.order_id === sub.order_id),
  }));

  return {
    group,
    subOrders: subOrdersWithItems,
    allItems:  enrichedItems,
    deliveryAddress,
  };
}

/* ════════════════════════════════════════════════════════════
   SEND ALL POST-PAYMENT NOTIFICATIONS
   ─────────────────────────────────────────────────────
   Runs in parallel via Promise.allSettled.
   Individual failures don't stop other notifications.
════════════════════════════════════════════════════════════ */
async function sendPaymentNotifications({
  group,
  subOrders,
  allItems,
  deliveryAddress,
  paymentRef,
}) {
  const jobs        = [];
  const trackingId  = group.tracking_id ?? group.id.slice(0, 8).toUpperCase();
  const grandTotal  = Number(group.grand_total);

  log("info", "DISPATCHING_NOTIFICATIONS", {
    orderGroupId: group.id,
    trackingId,
    buyer_email:  group.buyer_email,
    seller_count: subOrders.length,
    item_count:   allItems.length,
  });

  /* ══════════════════════════════════════════════════
     BUYER — Rich payment confirmation email
  ══════════════════════════════════════════════════ */
  if (group.buyer_email) {
    jobs.push(
      sendPaymentNotification({
        to:              group.buyer_email,
        name:            group.buyer_name,
        amount:          grandTotal,
        orderId:         trackingId,
        reference:       paymentRef,
        items:           allItems,
        paymentMethod:   "Online Payment (Card / Bank Transfer)",
        deliveryAddress,
        isCOD:           false,
      })
        .then(() => ({ ok: true, task: "buyer_email" }))
        .catch((err) => {
          log("warn", "BUYER_EMAIL_FAILED", {
            email: group.buyer_email,
            error: err.message,
          });
          return { ok: false, task: "buyer_email", error: err.message };
        })
    );
  } else {
    log("warn", "NO_BUYER_EMAIL", { userId: group.user_id });
  }

  /* ══════════════════════════════════════════════════
     BUYER — In-app notification
  ══════════════════════════════════════════════════ */
  if (group.user_id) {
    jobs.push(
      createNotification({
        userId:  group.user_id,
        type:    "order_paid",
        title:   "Payment Confirmed! 🎉",
        message: `Your payment of ₦${grandTotal.toLocaleString("en-NG")} for order ${trackingId} has been confirmed. Your order is being prepared.`,
        link:    `/shop/orders/${group.id}`,
        meta:    {
          orderGroupId: group.id,
          amount:       grandTotal,
          trackingId,
          itemCount:    allItems.length,
        },
      })
        .then(() => ({ ok: true, task: "buyer_notif" }))
        .catch((err) => {
          log("warn", "BUYER_NOTIF_FAILED", {
            userId: group.user_id,
            error:  err.message,
          });
          return { ok: false, task: "buyer_notif", error: err.message };
        })
    );
  }

  /* ══════════════════════════════════════════════════
     SELLERS — Rich new order email + in-app per seller
  ══════════════════════════════════════════════════ */
  for (const sub of subOrders) {
    const sellerAmount = Number(sub.subtotal);

    /* ── Seller email (rich template) ── */
    if (sub.seller_email) {
      jobs.push(
        sendNewOrderToSeller({
          to:              sub.seller_email,
          sellerName:      sub.seller_name,
          buyerName:       group.buyer_name,
          orderId:         trackingId,
          amount:          sellerAmount,
          itemCount:       sub.item_count,
          items:           sub.items,
          isCOD:           false,
          deliveryAddress,
        })
          .then(() => ({ ok: true, task: `seller_email_${sub.seller_id}` }))
          .catch((err) => {
            log("warn", "SELLER_EMAIL_FAILED", {
              sellerId: sub.seller_id,
              email:    sub.seller_email,
              error:    err.message,
            });
            return { ok: false, task: `seller_email_${sub.seller_id}`, error: err.message };
          })
      );
    } else {
      log("warn", "NO_SELLER_EMAIL", {
        sellerId: sub.seller_id,
        orderId:  sub.order_id,
      });
    }

    /* ── Seller in-app notification ── */
    if (sub.seller_id) {
      jobs.push(
        createNotification({
          userId:  sub.seller_id,
          type:    "new_order",
          title:   "New Order Received 📦",
          message: `New paid order ${trackingId} — ${sub.item_count} item(s) worth ₦${sellerAmount.toLocaleString("en-NG")}. Prepare for shipping.`,
          link:    `/seller-dashboard/orders/${sub.order_id}`,
          meta:    {
            orderId:      sub.order_id,
            orderGroupId: group.id,
            amount:       sellerAmount,
            itemCount:    sub.item_count,
            trackingId,
            paymentType:  "ONLINE",
          },
        })
          .then(() => ({ ok: true, task: `seller_notif_${sub.seller_id}` }))
          .catch((err) => {
            log("warn", "SELLER_NOTIF_FAILED", {
              sellerId: sub.seller_id,
              error:    err.message,
            });
            return { ok: false, task: `seller_notif_${sub.seller_id}`, error: err.message };
          })
      );
    }
  }

  /* ══════════════════════════════════════════════════
     Run all notifications in parallel
  ══════════════════════════════════════════════════ */
  const results = await Promise.allSettled(jobs);

  const succeeded = results.filter(
    (r) => r.status === "fulfilled" && r.value?.ok
  ).length;
  const failed = results.filter(
    (r) => r.status === "rejected" || !r.value?.ok
  ).length;

  log("info", "NOTIFICATIONS_SENT", {
    orderGroupId: group.id,
    trackingId,
    total:        jobs.length,
    succeeded,
    failed,
    buyer:        group.buyer_email,
    sellerCount:  subOrders.length,
  });

  return { total: jobs.length, succeeded, failed };
}

/* ════════════════════════════════════════════════════════════
   MAIN HANDLER — CALLED BY WEBHOOK
   ─────────────────────────────────────────────────────
   Returns:
     { handled: true }                    → order payment processed
     { handled: true, alreadyPaid: true } → idempotent success
     { handled: false }                   → not an order payment or failed
════════════════════════════════════════════════════════════ */
export async function handleOrderPayment(data) {
  const txId         = data?.id;
  const txRef        = data?.tx_ref;
  const orderGroupId = data?.meta?.order_group_id;

  /* ── Not an order payment — bail silently ── */
  if (!orderGroupId) {
    log("info", "NOT_AN_ORDER_PAYMENT", { txRef });
    return { handled: false };
  }

  log("info", "ORDER_PAYMENT_START", {
    txId,
    txRef,
    orderGroupId,
    status: data?.status,
    amount: data?.amount,
  });

  /* ── Only process successful charges ── */
  if (data?.status?.toLowerCase() !== "successful") {
    log("info", "SKIPPED_NOT_SUCCESSFUL", {
      status: data?.status,
      txRef,
    });
    return { handled: false };
  }

  /* ══════════════════════════════════════════════════
     STEP 1: Verify with Flutterwave API
     (Prevents webhook spoofing)
  ══════════════════════════════════════════════════ */
  log("info", "VERIFYING_WITH_FLW", { txId, orderGroupId });
  const verifyRes = await verifyWithFLW(txId);

  if (!verifyRes || verifyRes.status !== "success") {
    log("error", "VERIFICATION_FAILED", {
      txId,
      verifyStatus: verifyRes?.status,
    });
    return { handled: false };
  }

  const v = verifyRes.data;

  if (v.status?.toLowerCase() !== "successful") {
    log("error", "VERIFIED_NOT_SUCCESSFUL", {
      verifiedStatus: v.status,
      txId,
    });
    return { handled: false };
  }

  /* ══════════════════════════════════════════════════
     STEP 2: Fetch current order state
  ══════════════════════════════════════════════════ */
  const { rows: [order] } = await pool.query(
    `SELECT id, grand_total, payment_status
     FROM public.order_groups
     WHERE id = $1`,
    [orderGroupId]
  );

  if (!order) {
    log("error", "ORDER_NOT_FOUND", { orderGroupId, txRef });
    return { handled: false };
  }

  /* ══════════════════════════════════════════════════
     STEP 3: Idempotency check
  ══════════════════════════════════════════════════ */
  if (order.payment_status === "paid") {
    log("info", "ALREADY_PAID_SKIPPING", { orderGroupId, txRef });
    return { handled: true, alreadyPaid: true };
  }

  /* ══════════════════════════════════════════════════
     STEP 4: Amount tampering check (₦1 tolerance)
  ══════════════════════════════════════════════════ */
  if (Math.abs(Number(v.amount) - Number(order.grand_total)) > 1) {
    log("error", "AMOUNT_MISMATCH", {
      orderGroupId,
      expected: order.grand_total,
      paid:     v.amount,
      txRef,
    });
    return { handled: false };
  }

  /* ══════════════════════════════════════════════════
     STEP 5: Mark as paid
  ══════════════════════════════════════════════════ */
  const paymentRef = v.tx_ref ?? txRef;

  try {
    await markOrderGroupPaid(orderGroupId, paymentRef);

    log("info", "ORDER_MARKED_PAID", {
      orderGroupId,
      amount:   v.amount,
      currency: v.currency,
      txId,
      txRef,
    });

  } catch (err) {
    log("error", "MARK_PAID_FAILED", {
      orderGroupId,
      error: err.message,
      code:  err.code,
    });
    return { handled: false };
  }

  /* ══════════════════════════════════════════════════
     STEP 6: Send notifications (non-blocking)
     Fire-and-forget — response returns before emails complete
  ══════════════════════════════════════════════════ */
  try {
    const context = await fetchOrderContext(orderGroupId);

    if (context) {
      /* Run notifications in background — don't await */
      sendPaymentNotifications({
        group:           context.group,
        subOrders:       context.subOrders,
        allItems:        context.allItems,
        deliveryAddress: context.deliveryAddress,
        paymentRef,
      }).catch((err) => {
        log("error", "NOTIFICATIONS_DISPATCH_FAILED", {
          orderGroupId,
          error: err.message,
        });
      });
    } else {
      log("warn", "NO_CONTEXT_FOR_NOTIFICATIONS", { orderGroupId });
    }
  } catch (err) {
    log("error", "FETCH_CONTEXT_FAILED", {
      orderGroupId,
      error: err.message,
    });
  }

  return { handled: true };
}