// server/controllers/webhookController.js

import { pool }               from "../server.js";
import crypto                 from "crypto";
import {
  creditPendingBalance,
  restoreBalance,
  deductPendingAfterPayout,
}                             from "../services/walletService.js";
import { createEntry }        from "../services/ledgerService.js";
import { sendNotification }   from "../services/notificationService.js";
import {
  verifyWebhookSignature,
  normaliseTransferStatus,
}                             from "../utils/flutterwave.js";

// ═════════════════════════════════════════════════════════════
// EVENT TYPE → HANDLER MAP
// ═════════════════════════════════════════════════════════════
const EVENT_HANDLERS = {
  "charge.completed":   handleChargeCompleted,
  "charge.failed":      handleChargeFailed,
  "transfer.completed": handleTransferCompleted,
  "transfer.failed":    handleTransferFailed,
};

// Events we receive but intentionally do nothing with
const IGNORED_EVENTS = new Set([
  "charge.created",
  "transfer.created",
  "subscription.created",
  "subscription.cancelled",
]);

// ═════════════════════════════════════════════════════════════
// POST /api/payments/flutterwave/webhook
//
// RULES:
// 1. Verify signature FIRST — reject fakes immediately
// 2. Respond 200 FAST — FLW will retry if we're slow
// 3. Process AFTER responding — never block the response
// 4. Every handler is idempotent — safe to call twice
// ═════════════════════════════════════════════════════════════
export const handleWebhook = async (req, res) => {

  // ── 1. Signature verification ─────────────────────────────
  const signature = req.headers["verif-hash"];

  if (!verifyWebhookSignature(signature)) {
    console.warn("[Webhook] ❌ Invalid signature", {
      ip:        req.ip,
      signature: signature
        ? `${String(signature).slice(0, 8)}…`
        : "missing",
    });
    return res.status(401).json({ message: "Invalid signature" });
  }

  // ── 2. Parse body ─────────────────────────────────────────
  // express.raw() gives us a Buffer — parse it here
  let event;
  try {
    const raw = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);

    event = JSON.parse(raw);
  } catch (parseErr) {
    console.error("[Webhook] ❌ Body parse failed:", parseErr.message);
    return res.status(400).json({ message: "Invalid JSON body" });
  }

  const eventType = event?.event;
  const eventData = event?.data;

  if (!eventType || !eventData) {
    console.warn("[Webhook] ❌ Missing event or data field");
    return res.status(400).json({ message: "Missing event/data" });
  }

  // ── 3. Respond 200 immediately ────────────────────────────
  // FLW marks us as failed if we don't respond in ~30s
  // We respond first, process after
  res.status(200).json({ received: true });

  // ── 4. Process asynchronously ─────────────────────────────
  processEvent(eventType, eventData, event).catch((err) => {
    console.error("[Webhook] ❌ Unhandled top-level error:", {
      eventType,
      eventId: String(eventData?.id ?? "unknown"),
      error:   err.message,
      stack:   err.stack,
    });
  });
};

// ═════════════════════════════════════════════════════════════
// MAIN ASYNC PROCESSOR
// Runs after 200 is already sent to Flutterwave
// ═════════════════════════════════════════════════════════════
async function processEvent(eventType, eventData, rawEvent) {
  const eventId = String(
    eventData.id        ??
    eventData.tx_ref    ??
    eventData.reference ??
    "unknown"
  );

  console.log("[Webhook] 📩 Incoming:", {
    type:      eventType,
    eventId,
    status:    eventData.status,
    amount:    eventData.amount,
    reference: eventData.tx_ref ?? eventData.reference ?? null,
  });

  // ── Duplicate check ───────────────────────────────────────
  const isDuplicate = await checkDuplicate(eventId, eventType);
  if (isDuplicate) {
    console.log(`[Webhook] ⏭️  Duplicate skipped: ${eventId}`);
    return;
  }

  // ── Log event ─────────────────────────────────────────────
  await logEvent(eventId, eventType, rawEvent);

  // ── Find handler ──────────────────────────────────────────
  const handler = EVENT_HANDLERS[eventType];

  if (!handler) {
    if (!IGNORED_EVENTS.has(eventType)) {
      console.warn(`[Webhook] ⚠️  No handler for: "${eventType}"`);
    }
    await markProcessed(eventId, null);
    return;
  }

  // ── Run handler ───────────────────────────────────────────
  try {
    await handler(eventData);
    await markProcessed(eventId, null);
    console.log(`[Webhook] ✅ Done: ${eventType} — ${eventId}`);
  } catch (err) {
    console.error(`[Webhook] ❌ Handler error: ${eventType}`, {
      eventId,
      error:  err.message,
      detail: err.detail ?? null,
      code:   err.code   ?? null,
    });

    // Still mark processed to prevent infinite retry loop
    // Admin can manually re-trigger if needed
    await markProcessed(eventId, err.message);
  }
}

// ═════════════════════════════════════════════════════════════
// DUPLICATE CHECK
// ═════════════════════════════════════════════════════════════
async function checkDuplicate(eventId, eventType) {
  try {
    const { rows } = await pool.query(
      `SELECT id, processed
       FROM   public.webhook_events
       WHERE  event_id = $1`,
      [eventId]
    );

    if (!rows.length) return false; // new event

    if (rows[0].processed) {
      return true; // already fully processed
    }

    // Received before but not processed (previous crash?)
    // Allow retry
    console.log(
      `[Webhook] 🔄 Re-attempting unprocessed event: ${eventId}`
    );
    return false;

  } catch (err) {
    console.error("[Webhook] Duplicate check error:", err.message);
    return false; // on DB error, allow processing
  }
}

// ═════════════════════════════════════════════════════════════
// LOG EVENT
// ═════════════════════════════════════════════════════════════
async function logEvent(eventId, eventType, rawEvent) {
  try {
    await pool.query(
      `INSERT INTO public.webhook_events
         (event_id, event_type, payload, processed, created_at)
       VALUES ($1, $2, $3, FALSE, NOW())
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, eventType, JSON.stringify(rawEvent)]
    );
  } catch (err) {
    console.error("[Webhook] Log error:", err.message);
  }
}

// ═════════════════════════════════════════════════════════════
// MARK PROCESSED
// ═════════════════════════════════════════════════════════════
async function markProcessed(eventId, errorMessage) {
  try {
    await pool.query(
      `UPDATE public.webhook_events
       SET    processed     = TRUE,
              processed_at  = NOW(),
              error_message = $1
       WHERE  event_id = $2`,
      [errorMessage ?? null, eventId]
    );
  } catch (err) {
    console.error("[Webhook] Mark processed error:", err.message);
  }
}

// ═════════════════════════════════════════════════════════════
// HANDLER 1: CHARGE COMPLETED
// Customer paid for an order successfully
//
// Flow:
// Verify amount → update payment → update order →
// credit each vendor pending balance → ledger entries →
// schedule balance release → notify all parties
// ═════════════════════════════════════════════════════════════
async function handleChargeCompleted(data) {
  const reference    = data.tx_ref;
  const flwTxId      = String(data.id);
  const paidAmount   = Number(data.amount);
  const flwStatus    = data.status?.toLowerCase();

  // Only process successful charges
  if (flwStatus !== "successful") {
    console.log(
      `[Webhook:charge] Non-successful status "${flwStatus}" — ignoring`
    );
    return;
  }

  if (!reference) {
    throw new Error("charge.completed missing tx_ref");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Find + lock the order ────────────────────────────
    const { rows: [order] } = await client.query(
      `SELECT *
       FROM   public.orders
       WHERE  reference = $1
       FOR UPDATE`,
      [reference]
    );

    if (!order) {
      throw new Error(
        `No order for reference: ${reference}`
      );
    }

    // ── Already confirmed — safe to skip ─────────────────
    if (order.payment_status === "confirmed") {
      console.log(
        `[Webhook:charge] Order ${order.id} already confirmed — skipping`
      );
      await client.query("COMMIT");
      return;
    }

    // ── Amount validation ────────────────────────────────
    const expectedAmount = Number(order.grand_total);
    if (paidAmount < expectedAmount) {
      throw new Error(
        `Amount mismatch: paid ₦${paidAmount} ` +
        `but order total is ₦${expectedAmount}`
      );
    }

    // ── Update payment record ────────────────────────────
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
        data.payment_type ?? null,
        reference,
      ]
    );

    // ── Update order ─────────────────────────────────────
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
         SUM(oi.vendor_earnings)      AS vendor_total,
         COUNT(oi.id)                 AS item_count
       FROM   public.order_items oi
       WHERE  oi.order_id = $1
       GROUP  BY oi.vendor_id`,
      [order.id]
    );

    // ── Process each vendor ──────────────────────────────
    for (const group of vendorGroups) {
      const vendorAmount = Number(group.vendor_total);
      const commission   = Number(group.total_commission);

      // Credit vendor pending balance
      await creditPendingBalance({
        vendorId: group.vendor_id,
        amount:   vendorAmount,
        client,
      });

      // Ledger: credit vendor earnings
      await createEntry({
        userId:    group.vendor_id,
        vendorId:  group.vendor_id,
        orderId:   order.id,
        type:      "order_credit",
        direction: "credit",
        amount:    vendorAmount,
        reference: `CREDIT_${reference}_${group.vendor_id}`,
        narration: `Order ${order.id} payment received`,
        source:    "webhook",
        client,
      });

      // Ledger: deduct platform commission
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

      // Schedule balance release (pending → available after delivery)
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
        title:    "🎉 New Order!",
        message:  `You have a new order worth ₦${vendorAmount.toLocaleString()}. Prepare for shipment.`,
        metadata: {
          order_id: order.id,
          amount:   vendorAmount,
        },
        client,
      });
    }

    // ── Notify buyer ─────────────────────────────────────
    await sendNotification({
      userId:   order.user_id,
      userType: "buyer",
      type:     "payment_confirmed",
      title:    "✅ Payment Confirmed",
      message:  `Your payment of ₦${paidAmount.toLocaleString()} for order ${order.reference} is confirmed.`,
      metadata: {
        order_id:  order.id,
        reference: order.reference,
        amount:    paidAmount,
      },
      client,
    });

    await client.query("COMMIT");

    console.log("[Webhook:charge] ✅ Order paid:", {
      orderId: order.id,
      amount:  paidAmount,
      vendors: vendorGroups.length,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ═════════════════════════════════════════════════════════════
// HANDLER 2: CHARGE FAILED
// Customer payment failed
//
// Flow:
// Update payment failed → update order → restore stock →
// notify buyer
// ═════════════════════════════════════════════════════════════
async function handleChargeFailed(data) {
  const reference = data.tx_ref;
  const flwTxId   = String(data.id);

  if (!reference) {
    throw new Error("charge.failed missing tx_ref");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Find + lock order ────────────────────────────────
    const { rows: [order] } = await client.query(
      `SELECT *
       FROM   public.orders
       WHERE  reference = $1
       FOR UPDATE`,
      [reference]
    );

    if (!order) {
      console.warn(
        `[Webhook:charge.failed] No order for ref: ${reference}`
      );
      await client.query("COMMIT");
      return;
    }

    // ── Never downgrade a confirmed payment ───────────────
    if (order.payment_status === "confirmed") {
      console.log(
        `[Webhook:charge.failed] Order ${order.id} ` +
        `already confirmed — ignoring failure event`
      );
      await client.query("COMMIT");
      return;
    }

    // ── Update payment record ────────────────────────────
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

    // ── Update order ─────────────────────────────────────
    await client.query(
      `UPDATE public.orders
       SET    payment_status = 'failed',
              updated_at     = NOW()
       WHERE  id             = $1
         AND  payment_status != 'confirmed'`,
      [order.id]
    );

    // ── Restore stock quantities ─────────────────────────
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

    // ── Notify buyer ─────────────────────────────────────
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
// HANDLER 3: TRANSFER COMPLETED
// Flutterwave successfully sent payout to seller's bank
//
// Flow:
// Find withdrawal → update status → finalise wallet
// (pending → withdrawn) → ledger entries → notify seller
// ═════════════════════════════════════════════════════════════
async function handleTransferCompleted(data) {
  const flwTransferId = String(data.id);
  const flwStatus     = normaliseTransferStatus(data.status);
  const reference     = data.reference;

  // If FLW says completed but status is not success → route to failed
  if (flwStatus !== "success") {
    console.log(
      `[Webhook:transfer] Completed event but status is` +
      ` "${data.status}" — routing to failed handler`
    );
    return handleTransferFailed(data);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Find + lock withdrawal ───────────────────────────
    const { rows: [withdrawal] } = await client.query(
      `SELECT *
       FROM   market.vendor_withdrawal_requests
       WHERE  flw_transfer_id = $1
          OR  tx_ref          = $2
       LIMIT  1
       FOR UPDATE`,
      [flwTransferId, reference]
    );

    if (!withdrawal) {
      throw new Error(
        `No withdrawal for transfer: ${flwTransferId} / ${reference}`
      );
    }

    // ── Already finalised — idempotent ───────────────────
    if (["success", "paid"].includes(withdrawal.status)) {
      console.log(
        `[Webhook:transfer] Withdrawal ${withdrawal.id} ` +
        `already finalised — skipping`
      );
      await client.query("COMMIT");
      return;
    }

    const amount    = parseFloat(withdrawal.amount);
    const netAmount = parseFloat(withdrawal.net_amount);
    const fee       = parseFloat(withdrawal.fee);

    // ── Update withdrawal status ─────────────────────────
    await client.query(
      `UPDATE market.vendor_withdrawal_requests
       SET    status          = 'success',
              flw_transfer_id = $1,
              flw_response    = $2,
              processed_at    = NOW(),
              last_checked_at = NOW(),
              updated_at      = NOW()
       WHERE  id = $3`,
      [flwTransferId, JSON.stringify(data), withdrawal.id]
    );

    // ── Finalise wallet ──────────────────────────────────
    // pending_balance ↓ + total_withdrawn ↑
    await deductPendingAfterPayout({
      vendorId: withdrawal.vendor_id,
      amount,
      client,
    });

    // ── Update vendor transaction log ────────────────────
    await client.query(
      `UPDATE market.vendor_transactions
       SET    status    = 'success',
              narration = 'Withdrawal completed successfully'
       WHERE  tx_ref   = $1`,
      [withdrawal.tx_ref]
    );

    // ── Ledger: payout debit ─────────────────────────────
    await createEntry({
      userId:       withdrawal.vendor_id,
      vendorId:     withdrawal.vendor_id,
      withdrawalId: withdrawal.id,
      type:         "payout",
      direction:    "debit",
      amount:       netAmount,
      reference:    `PAYOUT_${withdrawal.tx_ref}`,
      narration:    `₦${netAmount.toLocaleString()} sent to ` +
                    `${withdrawal.bank_name} ` +
                    `****${withdrawal.account_number.slice(-4)}`,
      source:       "webhook",
      client,
    });

    // ── Ledger: fee debit (if charged) ───────────────────
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

    // ── Notify seller ────────────────────────────────────
    await sendNotification({
      userId:   withdrawal.vendor_id,
      userType: "seller",
      type:     "payout_sent",
      title:    "💸 Payout Sent!",
      message:  `₦${netAmount.toLocaleString()} has been sent to ` +
                `your ${withdrawal.bank_name} account ` +
                `****${withdrawal.account_number.slice(-4)}.`,
      metadata: {
        withdrawal_id: withdrawal.id,
        amount:        netAmount,
        bank:          withdrawal.bank_name,
        tx_ref:        withdrawal.tx_ref,
      },
      client,
    });

    await client.query("COMMIT");

    console.log("[Webhook:transfer] ✅ Payout complete:", {
      withdrawalId: withdrawal.id,
      vendorId:     withdrawal.vendor_id,
      amount:       netAmount,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ═════════════════════════════════════════════════════════════
// HANDLER 4: TRANSFER FAILED
// Payout to seller's bank failed
//
// Flow:
// Update withdrawal failed → restore wallet balance →
// ledger reversal → notify seller + admin
// ═════════════════════════════════════════════════════════════
async function handleTransferFailed(data) {
  const flwTransferId = String(data.id);
  const reference     = data.reference;
  const failReason    =
    data.complete_message ??
    data.processor_response ??
    data.status ??
    "Unknown reason";

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Find + lock withdrawal ───────────────────────────
    const { rows: [withdrawal] } = await client.query(
      `SELECT *
       FROM   market.vendor_withdrawal_requests
       WHERE  flw_transfer_id = $1
          OR  tx_ref          = $2
       LIMIT  1
       FOR UPDATE`,
      [flwTransferId, reference]
    );

    if (!withdrawal) {
      throw new Error(
        `No withdrawal for failed transfer: ${flwTransferId}`
      );
    }

    // ── Never downgrade a successful withdrawal ───────────
    if (["success", "paid"].includes(withdrawal.status)) {
      console.warn(
        `[Webhook:transfer.failed] Withdrawal ${withdrawal.id} ` +
        `already "${withdrawal.status}" — ignoring failure`
      );
      await client.query("COMMIT");
      return;
    }

    // ── Already failed — idempotent ──────────────────────
    if (["failed", "cancelled"].includes(withdrawal.status)) {
      console.log(
        `[Webhook:transfer.failed] Already failed: ${withdrawal.id}`
      );
      await client.query("COMMIT");
      return;
    }

    const amount = parseFloat(withdrawal.amount);

    // ── Update withdrawal status ─────────────────────────
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
      [failReason, flwTransferId, JSON.stringify(data), withdrawal.id]
    );

    // ── Restore vendor wallet balance ─────────────────────
    // pending_balance ↓ + available_balance ↑
    await restoreBalance({
      vendorId: withdrawal.vendor_id,
      amount,
      client,
    });

    // ── Update vendor transaction log ────────────────────
    await client.query(
      `UPDATE market.vendor_transactions
       SET    status    = 'failed',
              narration = $1
       WHERE  tx_ref   = $2`,
      [`Transfer failed: ${failReason}`, withdrawal.tx_ref]
    );

    // ── Ledger: reversal (credit back) ───────────────────
    await createEntry({
      userId:       withdrawal.vendor_id,
      vendorId:     withdrawal.vendor_id,
      withdrawalId: withdrawal.id,
      type:         "reversal",
      direction:    "credit",
      amount,
      reference:    `REVERSAL_${withdrawal.tx_ref}`,
      narration:    `Withdrawal failed — ₦${amount.toLocaleString()} ` +
                    `restored. Reason: ${failReason}`,
      source:       "webhook",
      client,
    });

    // ── Notify seller ────────────────────────────────────
    await sendNotification({
      userId:   withdrawal.vendor_id,
      userType: "seller",
      type:     "payout_failed",
      title:    "❌ Payout Failed",
      message:  `Your withdrawal of ₦${amount.toLocaleString()} to ` +
                `${withdrawal.bank_name} failed. ` +
                `Your balance has been restored. ` +
                `Reason: ${failReason}`,
      metadata: {
        withdrawal_id: withdrawal.id,
        amount,
        reason:        failReason,
        tx_ref:        withdrawal.tx_ref,
      },
      client,
    });

    // ── Notify all admins ────────────────────────────────
    await sendNotification({
      userId:   "system",
      userType: "admin",
      type:     "payout_failed_alert",
      title:    "⚠️ Vendor Payout Failed",
      message:  `Payout of ₦${amount.toLocaleString()} ` +
                `to vendor ${withdrawal.vendor_id} failed. ` +
                `Ref: ${withdrawal.tx_ref}. Reason: ${failReason}`,
      metadata: {
        withdrawal_id: withdrawal.id,
        vendor_id:     withdrawal.vendor_id,
        amount,
        reason:        failReason,
        tx_ref:        withdrawal.tx_ref,
      },
      client,
    });

    await client.query("COMMIT");

    console.log("[Webhook:transfer.failed] ❌ Payout failed:", {
      withdrawalId: withdrawal.id,
      vendorId:     withdrawal.vendor_id,
      amount,
      reason:       failReason,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}