// routes/webhooks/flutterwave.js
import express from "express";
import crypto  from "crypto";
import { pool } from "../../server.js";

const router = express.Router();

const verifySignature = (req) => {
  const hash = crypto
    .createHmac("sha256", process.env.FLW_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");
  return hash === req.headers["verif-hash"];
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/webhooks/flutterwave
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/", express.json(), async (req, res) => {
  // Always ack first — Flutterwave retries on non-200
  res.sendStatus(200);

  if (!verifySignature(req)) {
    console.warn("[webhook] ❌ invalid signature");
    return;
  }

  const event = req.body;
  console.log("[webhook] event:", event?.event, event?.data?.reference);

  // We only care about transfer (payout) events
  if (!event?.event?.startsWith("transfer.")) return;

  const {
    reference,          // our tx_ref
    id: flwTransferId,
    status,
    complete_message,
  } = event.data ?? {};

  if (!reference) return;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the withdrawal row — prevents duplicate webhook processing
    const { rows: [wd] } = await client.query(
      `SELECT * FROM market.vendor_withdrawal_requests
       WHERE tx_ref = $1
       FOR UPDATE`,
      [reference]
    );

    if (!wd) {
      console.warn("[webhook] withdrawal not found for tx_ref:", reference);
      await client.query("ROLLBACK");
      return;
    }

    // Skip if already in a terminal state (idempotency)
    if (["success", "failed", "cancelled"].includes(wd.status)) {
      console.log("[webhook] already settled, skipping:", wd.status);
      await client.query("ROLLBACK");
      return;
    }

    const upperStatus = status?.toUpperCase();

    // ── SUCCESS ───────────────────────────────────────────────────────────
    if (["SUCCESSFUL", "SUCCESS"].includes(upperStatus)) {

      await client.query(
        `UPDATE market.vendor_withdrawal_requests
         SET status          = 'success',
             flw_transfer_id = $1,
             processed_at    = NOW(),
             updated_at      = NOW()
         WHERE tx_ref = $2`,
        [flwTransferId?.toString(), reference]
      );

      // Move amount out of pending, into total_withdrawn
      await client.query(
        `UPDATE market.vendor_wallets
         SET
           pending_balance = pending_balance - $1,
           total_withdrawn = total_withdrawn + $1,
           updated_at      = NOW()
         WHERE vendor_id = $2`,
        [wd.amount, wd.vendor_id]
      );

      await client.query(
        `UPDATE market.vendor_transactions
         SET status = 'success'
         WHERE tx_ref = $1`,
        [reference]
      );

      console.log("[webhook] ✅ SUCCESS:", reference, "amount:", wd.amount);

    // ── FAILED / CANCELLED ────────────────────────────────────────────────
    } else if (["FAILED", "CANCELLED"].includes(upperStatus)) {

      await client.query(
        `UPDATE market.vendor_withdrawal_requests
         SET status          = 'failed',
             failure_reason  = $1,
             flw_transfer_id = $2,
             processed_at    = NOW(),
             updated_at      = NOW()
         WHERE tx_ref = $3`,
        [complete_message ?? "Transfer failed", flwTransferId?.toString(), reference]
      );

      // Reverse: move amount from pending back to available
      await client.query(
        `UPDATE market.vendor_wallets
         SET
           available_balance = available_balance + $1,
           pending_balance   = pending_balance   - $1,
           updated_at        = NOW()
         WHERE vendor_id = $2`,
        [wd.amount, wd.vendor_id]
      );

      await client.query(
        `UPDATE market.vendor_transactions
         SET status   = 'failed',
             narration = $1
         WHERE tx_ref = $2`,
        [`Transfer failed: ${complete_message ?? "unknown"}`, reference]
      );

      console.log("[webhook] ❌ FAILED:", reference, complete_message);
    }

    await client.query("COMMIT");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[webhook] error:", err.message);
  } finally {
    client.release();
  }
});

export default router;