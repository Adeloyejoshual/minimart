// server/controllers/webhookController.js

const db              = require("../db");
const { v4: uuidv4 } = require("uuid");
const walletService   = require("../services/walletService");
const ledgerService   = require("../services/ledgerService");

/**
 * POST /api/payments/flutterwave/webhook
 *
 * THIS is the only place we mark an order as paid.
 * Never trust the frontend redirect for payment confirmation.
 */
exports.handleWebhook = async (req, res) => {

  // ── 1. Verify webhook signature ────────────────────────────
  const signature = req.headers["verif-hash"];
  if (signature !== process.env.FLW_WEBHOOK_HASH) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const event = req.body;

  // ── 2. Acknowledge immediately (Flutterwave needs 200 fast) 
  res.status(200).json({ received: true });

  // ── 3. Process asynchronously ──────────────────────────────
  try {
    const eventType = event.event;
    const data      = event.data;

    // ── Prevent duplicate processing ───────────────────────
    const alreadyProcessed = await db("webhook_events")
      .where({ event_id: data.id?.toString() })
      .first();

    if (alreadyProcessed) {
      console.log(`Webhook ${data.id} already processed`);
      return;
    }

    // ── Log the webhook event ──────────────────────────────
    await db("webhook_events").insert({
      id:           uuidv4(),
      event_id:     data.id?.toString(),
      event_type:   eventType,
      payload:      JSON.stringify(event),
      processed:    false,
      created_at:   new Date(),
    });

    // ── Handle payment.completed ───────────────────────────
    if (eventType === "charge.completed" && 
        data.status === "successful") {
      await handlePaymentSuccess(data);
    }

    // ── Handle transfer events ─────────────────────────────
    if (eventType === "transfer.completed") {
      await handleTransferComplete(data);
    }

    // ── Mark event as processed ────────────────────────────
    await db("webhook_events")
      .where({ event_id: data.id?.toString() })
      .update({ 
        processed:    true, 
        processed_at: new Date() 
      });

  } catch (err) {
    console.error("Webhook processing error:", err);
    // Don't throw — we already sent 200 to Flutterwave
  }
};

// ─────────────────────────────────────────────────────────────
async function handlePaymentSuccess(data) {
  const reference = data.tx_ref;

  // Find the order
  const order = await db("orders")
    .where({ reference })
    .first();

  if (!order) {
    console.error(`No order found for reference: ${reference}`);
    return;
  }

  // Already paid — skip
  if (order.payment_status === "confirmed") {
    return;
  }

  const trx = await db.transaction();

  try {
    // ── Update order status ──────────────────────────────
    await trx("orders")
      .where({ id: order.id })
      .update({
        payment_status: "confirmed",
        order_status:   "processing",
        paid_at:        new Date(),
        updated_at:     new Date(),
      });

    // ── Update payment record ────────────────────────────
    await trx("payments")
      .where({ reference })
      .update({
        status:                "successful",
        flutterwave_tx_id:     data.id,
        flutterwave_response:  JSON.stringify(data),
        updated_at:            new Date(),
      });

    // ── Credit vendor wallets ────────────────────────────
    const orderItems = await trx("order_items")
      .where({ order_id: order.id });

    for (const item of orderItems) {
      // Add to vendor pending balance
      await walletService.creditPendingBalance({
        vendorId:  item.vendor_id,
        amount:    item.total_price,
        orderId:   order.id,
        trx,
      });

      // Create ledger entry
      await ledgerService.createEntry({
        userId:    item.vendor_id,
        vendorId:  item.vendor_id,
        orderId:   order.id,
        type:      "order_credit",
        direction: "credit",
        amount:    item.total_price,
        reference: `CREDIT_${order.reference}_${item.id}`,
        narration: `Order payment received for order ${order.id}`,
        trx,
      });
    }

    await trx.commit();
    console.log(`Order ${order.id} marked as paid ✅`);

  } catch (err) {
    await trx.rollback();
    console.error("handlePaymentSuccess error:", err);
  }
}

// ─────────────────────────────────────────────────────────────
async function handleTransferComplete(data) {
  // Handled in withdrawal flow (next phase)
  console.log("Transfer webhook received:", data.reference);
}