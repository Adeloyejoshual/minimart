/**
 * services/orderPaymentHandler.js
 *
 * Shared handler for Flutterwave charge.completed events
 * that belong to a checkout ORDER (has meta.order_group_id).
 *
 * Called by:
 *   - routes/webhooks/flutterwave.js       (primary webhook)
 *   - routes/checkout/webhook.js           (secondary/backup webhook)
 *
 * Responsibilities:
 *   ✓ Verify transaction with Flutterwave API
 *   ✓ Amount tampering check
 *   ✓ Idempotency (skip if already paid)
 *   ✓ Mark order group as paid via orderService
 */

import axios from "axios";
import { pool } from "../config/db.js";
import { markOrderGroupPaid } from "./orderService.js";

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
   MAIN HANDLER
   ─────────────────────────────────────────────────────
   Returns:
     { handled: true }   → order payment processed
     { handled: false }  → not an order payment (silently skip)
     { handled: true, alreadyPaid: true }  → idempotent success
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
    log("error", "VERIFIED_NOT_SUCCESSFUL", {
      verifiedStatus: v.status,
      txId,
    });
    return { handled: false };
  }

  /* ── Fetch order to check state + amount ── */
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

  /* ── Amount tampering check (allow ₦1 tolerance for rounding) ── */
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
  try {
    await markOrderGroupPaid(orderGroupId, v.tx_ref ?? txRef);

    log("info", "ORDER_MARKED_PAID", {
      orderGroupId,
      amount:   v.amount,
      currency: v.currency,
      txId,
      txRef,
    });

    /* TODO: Notify sellers, send buyer confirmation email */

    return { handled: true };

  } catch (err) {
    log("error", "MARK_PAID_FAILED", {
      orderGroupId,
      error: err.message,
      code:  err.code,
    });
    return { handled: false };
  }
}