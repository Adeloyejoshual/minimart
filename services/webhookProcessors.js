// server/services/webhookProcessors.js

import {
  creditPendingBalance,
  releaseToAvailable,
  restoreBalance,
  deductPendingAfterPayout,
} from "./walletService.js";
import { createEntry }     from "./ledgerService.js";
import { sendNotification } from "./notificationService.js";

// ═════════════════════════════════════════════════════════════
// 1. CHARGE COMPLETED — Customer paid for an order
//
// Flow:
// FLW confirms payment → verify amount/ref → update order →
// credit each vendor's pending balance → create ledger entries
// ═════════════════════════════════════════════════════════════
export async function processChargeCompleted(data, pool) {
  const reference     = data.tx_ref;
  const flwTxId       = String(data.id);
  const paidAmount    = Number(data.amount);
  const paidCurrency  = data.currency ?? "NGN";
  const paymentStatus = data.status?.toLowerCase();

  // ── Only process successful charges ───────────────────
  if (paymentStatus !== "successful") {
    console.log(
      `[Webhook:charge] Ignoring non-successful charge: ${paymentStatus}`
    );
    return;
  }

  if (!reference) {
    throw new Error("charge.completed missing tx_ref");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Find the order ──────────────────────────────────
    const { rows: [order] } = await client.query(
      `SELECT *
       FROM   public.orders
       WHERE  reference = $1
       FOR UPDATE`,
      [reference]
    );

    if (!order) {
      throw new Error(`No order found for reference: ${reference}`);
    }

    // ── Already confirmed — idempotent ─────────────────
    if (order.payment_status === "confirmed") {
      console.log(
        `[Webhook:charge] Order ${order.id} already confirmed — skipping`
      );
      await client.query("COMMIT");
      return;
    }

    // ── Verify amount matches ───────────────────────────
    const expectedAmount = Number(order.grand_total);
    if (paidAmount < expectedAmount) {
      throw new Error(
        `Amount mismatch: paid ₦${paidAmount} but order is ₦${expectedAmount}`
      );
    }

    // ── Update payment record ───────────────────────────
    await client.query(
      `UPDATE public.payments
       SET    status               = 'successful',
              flutterwave_tx_id    = $1,
              flutterwave_response = $2,
              channel              = $3,
              updated_at           = NOW()
       WHERE  reference = $4
         AND  status   != 'successful'`,
      [
        flwTxId,
        JSON.stringify(data),
        data.payment_type ?? data.auth_model ?? null,
        reference,
      ]
    );

    // ── Update order status ─────────────────────────────
    await client.query(
      `UPDATE public.orders
       SET    payment_status = 'confirmed',
              order_status   = 'processing',
              paid_at        = NOW(),
              updated_at     = NOW()
       WHERE  id = $1`,
      [order.id]
    );

    // ── Fetch order items grouped by vendor ──────────────
    const { rows: vendorGroups } = await client.query(
      `SELECT
         oi.vendor_id,
         SUM(oi.total_price)          AS gross_amount,
         SUM(oi.commission_amount)    AS total_commission,
         SUM(oi.vendor_earnings)      AS vendor_total
       FROM   public.order_items oi
       WHERE  oi.order_id = $1
       GROUP  BY oi.vendor_id`,
      [order.id]
    );

    // ── Credit each vendor's pending balance ────────────
    for (const group of vendorGroups) {
      const vendorAmount = Number(group.vendor_total);
      const commission   = Number(group.total_commission);

      // Credit pending balance
      await creditPendingBalance({
        vendorId: group.vendor_id,
        amount:   vendorAmount,
        client,
      });

      // Ledger: vendor credit
      await createEntry({
        userId:    group.vendor_id,
        vendorId:  group.vendor_id,
        orderId:   order.id,
        type:      "order_credit",
        direction: "credit",
        amount:    vendorAmount,
        reference: `CREDIT_${reference}_${group.vendor_id}`,
        narration: `Order ${order.id} — payment received (net of commission)`,
        source:    "webhook",
        client,
      });

      // Ledger: commission deducted
      if (commission > 0) {
        await createEntry({
          userId:    group.vendor_id,
          vendorId:  group.vendor_id,
          orderId:   order.id,
          type:      "commission",
          direction: "debit",
          amount:    commission,
          reference: `COMMISSION_${reference}_${group.vendor_id}`,
          narration: `Platform commission on order ${order.id}`,
          source:    "webhook",
          client,
        });
      }

      // Schedule balance release
      await client.query(
        `INSERT INTO public.order_balance_releases
           (order_id, vendor_id, amount, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', NOW(), NOW())
         ON CONFLICT (order_id) DO NOTHING`,
        [order.id, group.vendor_id, vendorAmount]
      );

      // Notify vendor
      await sendNotification({
        userId:   group.vendor_id,
        userType: "seller",
        type:     "order_received",
        title:    "🎉 New Order Received!",
        message:  `You received an order worth ₦${vendorAmount.toLocaleString()}. Prepare for shipment.`,
        metadata: {
          order_id: order.id,
          amount:   vendorAmount,
        },
        client,
      });
    }

    // ── Notify buyer ────────────────────────────────────
    await sendNotification({
      userId:   order.user_id,
      userType: "buyer",
      type:     "payment_confirmed",
      title:    "✅ Payment Confirmed",
      message:  `Your payment of ₦${paidAmount.toLocaleString()} for order ${order.reference} has been confirmed.`,
      metadata: {
        order_id:  order.id,
        reference: order.reference,
        amount:    paidAmount,
      },
      client,
    });

    await client.query("COMMIT");

    console.log("[Webhook:charge] ✅ Order paid:", {
      orderId:   order.id,
      amount:    paidAmount,
      vendors:   vendorGroups.length,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ═════════════════════════════════════════════════════════════
// 2. CHARGE FAILED — Customer payment failed
//
// Flow:
// FLW reports failure → update payment → update order →
// notify buyer
// ═════════════════════════════════════════════════════════════
export async function processChargeFailed(data, pool) {
  const reference = data.tx_ref;
  const flwTxId   = String(data.id);

  if (!reference) {
    throw new Error("charge.failed missing tx_ref");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Find order ──────────────────────────────────────
    const { rows: [order] } = await client.query(
      `SELECT *
       FROM   public.orders
       WHERE  reference = $1
       FOR UPDATE`,
      [reference]
    );

    if (!order) {
      console.warn(
        `[Webhook:charge.failed] No order for reference: ${reference}`
      );
      await client.query("COMMIT");
      return;
    }

    // ── Already confirmed — don't downgrade ─────────────
    if (order.payment_status === "confirmed") {
      console.log(
        `[Webhook:charge.failed] Order ${order.id} already paid — ignoring failure`
      );
      await client.query("COMMIT");
      return;
    }

    // ── Update payment ──────────────────────────────────
    await client.query(
      `UPDATE public.payments
       SET    status               = 'failed',
              flutterwave_tx_id    = $1,
              flutterwave_response = $2,
              updated_at           = NOW()
       WHERE  reference = $3
         AND  status   != 'successful'`,
      [flwTxId, JSON.stringify(data), reference]
    );

    // ── Update order ────────────────────────────────────
    await client.query(
      `UPDATE public.orders
       SET    payment_status = 'failed',
              updated_at     = NOW()
       WHERE  id             = $1
         AND  payment_status != 'confirmed'`,
      [order.id]
    );

    // ── Restore stock ───────────────────────────────────
    const { rows: items } = await client.query(
      `SELECT product_id, quantity
       FROM   public.order_items
       WHERE  order_id = $1`,
      [order.id]
    );

    for (const item of items) {
      await client.query(
        `UPDATE market.products
         SET    stock_quantity = stock_quantity + $1,
                updated_at    = NOW()
         WHERE  id = $2`,
        [item.quantity, item.product_id]
      );
    }

    // ── Notify buyer ────────────────────────────────────
    await sendNotification({
      userId:   order.user_id,
      userType: "buyer",
      type:     "payment_failed",
      title:    "❌ Payment Failed",
      message:  `Your payment for order ${order.reference} failed. You can retry from your orders page.`,
      metadata: {
        order_id:  order.id,
        reference: order.reference,
      },
      client,
    });

    await client.query("COMMIT");

    console.log("[Webhook:charge.failed] Order payment failed:", {
      orderId: order.id,
      reason:  data.processor_response ?? data.status,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ═════════════════════════════════════════════════════════════
// 3. TRANSFER COMPLETED — Payout sent to seller's bank
//
// Flow:
// FLW confirms transfer → update withdrawal status →
// finalise wallet (pending → withdrawn) → ledger entry →
// notify seller
// ═════════════════════════════════════════════════════════════
export async function processTransferCompleted(data, pool) {
  const flwTransferId = String(data.id);
  const flwStatus     = data.status?.toUpperCase();
  const reference     = data.reference;

  // ── Only process successful transfers ─────────────────
  if (!["SUCCESSFUL", "SUCCESS"].includes(flwStatus)) {
    console.log(
      `[Webhook:transfer] Non-success status: ${flwStatus} — routing to failed handler`
    );
    return processTransferFailed(data, pool);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Find withdrawal by FLW transfer ID or tx_ref ────
    const { rows: [withdrawal] } = await client.query(
      `SELECT *
       FROM   market.vendor_withdrawal_requests
       WHERE  (flw_transfer_id = $1 OR tx_ref = $2)
       FOR UPDATE`,
      [flwTransferId, reference]
    );

    if (!withdrawal) {
      throw new Error(
        `No withdrawal found for transfer: ${flwTransferId} / ref: ${reference}`
      );
    }

    // ── Already finalised — idempotent ──────────────────
    if (["success", "paid"].includes(withdrawal.status)) {
      console.log(
        `[Webhook:transfer] Withdrawal ${withdrawal.id} already paid — skipping`
      );
      await client.query("COMMIT");
      return;
    }

    const withdrawalAmount = parseFloat(withdrawal.amount);
    const netAmount        = parseFloat(withdrawal.net_amount);
    const fee              = parseFloat(withdrawal.fee);

    // ── Update withdrawal ───────────────────────────────
    await client.query(
      `UPDATE market.vendor_withdrawal_requests
       SET    status           = 'success',
              flw_transfer_id  = $1,
              flw_response     = $2,
              processed_at     = NOW(),
              last_checked_at  = NOW(),
              updated_at       = NOW()
       WHERE  id = $3`,
      [flwTransferId, JSON.stringify(data), withdrawal.id]
    );

    // ── Finalise wallet ─────────────────────────────────
    // Move from pending → total_withdrawn
    await deductPendingAfterPayout({
      vendorId: withdrawal.vendor_id,
      amount:   withdrawalAmount,
      client,
    });

    // ── Update vendor transaction log ────────────────────
    await client.query(
      `UPDATE market.vendor_transactions
       SET    status    = 'success',
              narration = 'Withdrawal completed successfully'
       WHERE  tx_ref = $1`,
      [withdrawal.tx_ref]
    );

    // ── Ledger: payout entry ────────────────────────────
    await createEntry({
      userId:       withdrawal.vendor_id,
      vendorId:     withdrawal.vendor_id,
      withdrawalId: withdrawal.id,
      type:         "payout",
      direction:    "debit",
      amount:       netAmount,
      reference:    `PAYOUT_${withdrawal.tx_ref}`,
      narration:    `Withdrawal of ₦${netAmount.toLocaleString()} sent to ${withdrawal.bank_name} ****${withdrawal.account_number.slice(-4)}`,
      source:       "webhook",
      client,
    });

    // ── Ledger: fee entry (if charged) ──────────────────
    if (fee > 0) {
      await createEntry({
        userId:       withdrawal.vendor_id,
        vendorId:     withdrawal.vendor_id,
        withdrawalId: withdrawal.id,
        type:         "fee",
        direction:    "debit",
        amount:       fee,
        reference:    `FEE_${withdrawal.tx_ref}`,
        narration:    `Withdrawal fee — ₦${fee.toLocaleString()}`,
        source:       "webhook",
        client,
      });
    }

    // ── Notify seller ───────────────────────────────────
    await sendNotification({
      userId:   withdrawal.vendor_id,
      userType: "seller",
      type:     "payout_sent",
      title:    "💸 Payout Sent!",
      message:  `₦${netAmount.toLocaleString()} has been sent to your ${withdrawal.bank_name} account ending ****${withdrawal.account_number.slice(-4)}.`,
      metadata: {
        withdrawal_id: withdrawal.id,
        amount:        netAmount,
        bank:          withdrawal.bank_name,
        tx_ref:        withdrawal.tx_ref,
      },
      client,
    });

    await client.query("COMMIT");

    console.log("[Webhook:transfer] ✅ Payout completed:", {
      withdrawalId:  withdrawal.id,
      vendorId:      withdrawal.vendor_id,
      amount:        netAmount,
      bank:          withdrawal.bank_name,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ═════════════════════════════════════════════════════════════
// 4. TRANSFER FAILED — Payout to seller failed
//
// Flow:
// FLW reports failure → update withdrawal → restore wallet →
// ledger reversal → notify seller + admin
// ═════════════════════════════════════════════════════════════
export async function processTransferFailed(data, pool) {
  const flwTransferId = String(data.id);
  const reference     = data.reference;
  const failReason    = data.complete_message ?? data.status ?? "Unknown error";

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Find withdrawal ─────────────────────────────────
    const { rows: [withdrawal] } = await client.query(
      `SELECT *
       FROM   market.vendor_withdrawal_requests
       WHERE  (flw_transfer_id = $1 OR tx_ref = $2)
       FOR UPDATE`,
      [flwTransferId, reference]
    );

    if (!withdrawal) {
      throw new Error(
        `No withdrawal found for failed transfer: ${flwTransferId}`
      );
    }

    // ── Already handled — idempotent ────────────────────
    if (["failed", "cancelled"].includes(withdrawal.status)) {
      console.log(
        `[Webhook:transfer.failed] Already failed: ${withdrawal.id}`
      );
      await client.query("COMMIT");
      return;
    }

    // ── If already succeeded, don't override ────────────
    if (["success", "paid"].includes(withdrawal.status)) {
      console.warn(
        `[Webhook:transfer.failed] Withdrawal ${withdrawal.id} ` +
        `is already "${withdrawal.status}" — ignoring failure`
      );
      await client.query("COMMIT");
      return;
    }

    const withdrawalAmount = parseFloat(withdrawal.amount);

    // ── Update withdrawal status ────────────────────────
    await client.query(
      `UPDATE market.vendor_withdrawal_requests
       SET    status          = 'failed',
              failure_reason  = $1,
              flw_transfer_id = $2,
              flw_response    = $3,
              processed_at    = NOW(),
              last_checked_at = NOW(),
              updated_at      = NOW()
       WHERE  id = $4`,
      [
        failReason,
        flwTransferId,
        JSON.stringify(data),
        withdrawal.id,
      ]
    );

    // ── Restore wallet balance ──────────────────────────
    await restoreBalance({
      vendorId: withdrawal.vendor_id,
      amount:   withdrawalAmount,
      client,
    });

    // ── Update transaction log ──────────────────────────
    await client.query(
      `UPDATE market.vendor_transactions
       SET    status    = 'failed',
              narration = $1
       WHERE  tx_ref = $2`,
      [`Transfer failed: ${failReason}`, withdrawal.tx_ref]
    );

    // ── Ledger: reversal entry ──────────────────────────
    await createEntry({
      userId:       withdrawal.vendor_id,
      vendorId:     withdrawal.vendor_id,
      withdrawalId: withdrawal.id,
      type:         "reversal",
      direction:    "credit",
      amount:       withdrawalAmount,
      reference:    `REVERSAL_${withdrawal.tx_ref}`,
      narration:    `Withdrawal failed — ₦${withdrawalAmount.toLocaleString()} restored. Reason: ${failReason}`,
      source:       "webhook",
      client,
    });

    // ── Notify seller ───────────────────────────────────
    await sendNotification({
      userId:   withdrawal.vendor_id,
      userType: "seller",
      type:     "payout_failed",
      title:    "❌ Payout Failed",
      message:  `Your withdrawal of ₦${withdrawalAmount.toLocaleString()} to ${withdrawal.bank_name} failed. Balance has been restored. Reason: ${failReason}`,
      metadata: {
        withdrawal_id: withdrawal.id,
        amount:        withdrawalAmount,
        reason:        failReason,
        tx_ref:        withdrawal.tx_ref,
      },
      client,
    });

    // ── Notify admin ────────────────────────────────────
    await sendNotification({
      userId:   "system",
      userType: "admin",
      type:     "payout_failed_alert",
      title:    "⚠️ Vendor Payout Failed",
      message:  `Payout of ₦${withdrawalAmount.toLocaleString()} to vendor ${withdrawal.vendor_id} failed. Ref: ${withdrawal.tx_ref}. Reason: ${failReason}`,
      metadata: {
        withdrawal_id: withdrawal.id,
        vendor_id:     withdrawal.vendor_id,
        amount:        withdrawalAmount,
        reason:        failReason,
      },
      client,
    });

    await client.query("COMMIT");

    console.log("[Webhook:transfer.failed] ❌ Payout failed:", {
      withdrawalId: withdrawal.id,
      vendorId:     withdrawal.vendor_id,
      amount:       withdrawalAmount,
      reason:       failReason,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}