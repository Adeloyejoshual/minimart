/**
 * services/orderPaymentHandler.js
 *
 * v2 — With buyer + seller notifications
 * ────────────────────────────────────────
 * ✓ Verifies payment with Flutterwave
 * ✓ Amount tampering check
 * ✓ Idempotent (skip if already paid)
 * ✓ Marks order group as paid
 * ✓ Sends BUYER order confirmation email
 * ✓ Sends SELLER new order email (per seller)
 * ✓ Creates in-app notifications for buyer + sellers
 * ✓ All notifications are non-blocking (won't fail order)
 */

import axios from "axios";
import { pool } from "../config/db.js";
import { markOrderGroupPaid } from "./orderService.js";
import {
  sendPaymentNotification,
  sendOrderStatusEmail,
  createNotification,
} from "./notificationService.js";

/* ════════════════════════════════════════════════════════════
   LOGGER
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
   FETCH ORDER + BUYER + SELLERS FOR NOTIFICATIONS
════════════════════════════════════════════════════════════ */
async function fetchOrderContext(orderGroupId) {
  /* Fetch buyer + order group */
  const { rows: [group] } = await pool.query(
    `SELECT
       og.id,
       og.tracking_id,
       og.grand_total,
       og.delivery_fee,
       og.total_amount,
       og.payment_method,
       og.payment_status,
       og.user_id,
       u.email AS buyer_email,
       u.name  AS buyer_name
     FROM public.order_groups og
     LEFT JOIN market.users u ON u.id = og.user_id
     WHERE og.id = $1`,
    [orderGroupId]
  );

  if (!group) return null;

  /* Fetch sub-orders (one per seller) with seller info */
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
     GROUP BY o.id, o.seller_id, o.subtotal, u.email, u.name`,
    [orderGroupId]
  );

  return { group, subOrders };
}

/* ════════════════════════════════════════════════════════════
   SEND ALL POST-PAYMENT NOTIFICATIONS
   ─────────────────────────────────────────────────────
   Runs in parallel, all errors are caught individually
   so ONE failure doesn't block others.
════════════════════════════════════════════════════════════ */
async function sendPaymentNotifications({ group, subOrders, paymentRef }) {
  const jobs = [];
  const trackingId  = group.tracking_id ?? group.id.slice(0, 8).toUpperCase();
  const grandTotal  = Number(group.grand_total);

  /* ── BUYER: Email confirmation ── */
  if (group.buyer_email) {
    jobs.push(
      sendPaymentNotification({
        to:        group.buyer_email,
        name:      group.buyer_name,
        amount:    grandTotal,
        orderId:   trackingId,
        reference: paymentRef,
      }).catch((err) => {
        log("warn", "BUYER_EMAIL_FAILED", { error: err.message });
      })
    );
  }

  /* ── BUYER: In-app notification ── */
  if (group.user_id) {
    jobs.push(
      createNotification({
        userId:  group.user_id,
        type:    "order_paid",
        title:   "Payment Confirmed! 🎉",
        message: `Your payment of ₦${grandTotal.toLocaleString("en-NG")} for order ${trackingId} has been confirmed.`,
        link:    `/shop/orders/${group.id}`,
        meta:    {
          orderGroupId: group.id,
          amount:       grandTotal,
          trackingId,
        },
      }).catch((err) => {
        log("warn", "BUYER_NOTIF_FAILED", { error: err.message });
      })
    );
  }

  /* ── SELLERS: Email + in-app notification per seller ── */
  for (const sub of subOrders) {
    const sellerAmount = Number(sub.subtotal);

    /* Seller email */
    if (sub.seller_email) {
      jobs.push(
        sendOrderStatusEmail({
          to:      sub.seller_email,
          name:    sub.seller_name,
          orderId: trackingId,
          status:  "New Paid Order",
          message: `You have a new paid order with ${sub.item_count} item(s) totalling ₦${sellerAmount.toLocaleString("en-NG")}. Please prepare it for shipping.`,
        }).catch((err) => {
          log("warn", "SELLER_EMAIL_FAILED", {
            sellerId: sub.seller_id,
            error:    err.message,
          });
        })
      );
    }

    /* Seller in-app notification */
    if (sub.seller_id) {
      jobs.push(
        createNotification({
          userId:  sub.seller_id,
          type:    "new_order",
          title:   "New Order Received 📦",
          message: `New paid order ${trackingId} — ${sub.item_count} item(s) worth ₦${sellerAmount.toLocaleString("en-NG")}`,
          link:    `/seller-dashboard/orders/${sub.order_id}`,
          meta:    {
            orderId:      sub.order_id,
            orderGroupId: group.id,
            amount:       sellerAmount,
            itemCount:    sub.item_count,
            trackingId,
          },
        }).catch((err) => {
          log("warn", "SELLER_NOTIF_FAILED", {
            sellerId: sub.seller_id,
            error:    err.message,
          });
        })
      );
    }
  }

  /* Run all notifications in parallel */
  const results = await Promise.allSettled(jobs);

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed    = results.filter((r) => r.status === "rejected").length;

  log("info", "NOTIFICATIONS_SENT", {
    orderGroupId: group.id,
    trackingId,
    total:        jobs.length,
    succeeded,
    failed,
    buyer:        group.buyer_email,
    sellerCount:  subOrders.length,
  });
}

/* ════════════════════════════════════════════════════════════
   MAIN HANDLER
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
    log("info", "SKIPPED_NOT_SUCCESSFUL", { status: data?.status, txRef });
    return { handled: false };
  }

  /* ── Verify with Flutterwave API ── */
  log("info", "VERIFYING", { txId, orderGroupId });
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
    log("error", "VERIFIED_NOT_SUCCESSFUL", { verifiedStatus: v.status, txId });
    return { handled: false };
  }

  /* ── Fetch order state + amount ── */
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

  /* ── Idempotency: already paid ── */
  if (order.payment_status === "paid") {
    log("info", "ALREADY_PAID_SKIPPING", { orderGroupId, txRef });
    return { handled: true, alreadyPaid: true };
  }

  /* ── Amount tampering check (₦1 tolerance) ── */
  if (Math.abs(Number(v.amount) - Number(order.grand_total)) > 1) {
    log("error", "AMOUNT_MISMATCH", {
      orderGroupId,
      expected: order.grand_total,
      paid:     v.amount,
      txRef,
    });
    return { handled: false };
  }

  /* ── Mark as paid ── */
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
     SEND NOTIFICATIONS (non-blocking)
  ══════════════════════════════════════════════════ */
  try {
    const context = await fetchOrderContext(orderGroupId);

    if (context) {
      /* Fire and forget — notifications run in parallel */
      sendPaymentNotifications({
        group:      context.group,
        subOrders:  context.subOrders,
        paymentRef,
      }).catch((err) => {
        log("error", "NOTIFICATIONS_FAILED", {
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