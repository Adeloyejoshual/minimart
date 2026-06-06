// routes/webhooks/flutterwaveTransfer.js
import express  from "express";
import { pool } from "../../server.js";

const router = express.Router();

const FLW_HASH = process.env.FLW_WEBHOOK_SECRET_HASH;

// ── Signature verification ────────────────────────────────────
const isValidSignature = (req) => {
  const hash = req.headers["verif-hash"];
  if (!hash) return false;
  return hash === FLW_HASH;
};

// ── Map FLW status → our status ───────────────────────────────
const mapStatus = (flwStatus) => {
  switch (flwStatus?.toUpperCase()) {
    case "SUCCESSFUL": return "success";
    case "FAILED":     return "failed";
    default:           return null;   // PENDING / NEW → ignore
  }
};

// ════════════════════════════════════════════════════════════
// POST /api/webhooks/flutterwave/transfer
// ════════════════════════════════════════════════════════════
router.post("/transfer", async (req, res) => {
  // Always ACK immediately — FLW retries if we don't respond fast
  res.status(200).json({ status: "received" });

  try {
    // ── Auth ──────────────────────────────────────────────
    if (!isValidSignature(req)) {
      console.warn("[FLW webhook] ⚠ Invalid signature — ignored");
      return;
    }

    const payload   = req.body;
    const eventType = payload.event;
    const data      = payload.data ?? payload.transfer ?? {};

    console.log(
      `[FLW webhook] event=${eventType} ref=${data.reference} status=${data.status}`
    );

    // Only handle completed transfers
    if (eventType !== "transfer.completed") return;

    const flwReference = data.reference;
    const flwId        = String(data.id ?? "");
    const flwStatus    = data.status;
    const flwMessage   = data.complete_message ?? "";

    const newStatus = mapStatus(flwStatus);
    if (!newStatus) {
      console.log(`[FLW webhook] Status "${flwStatus}" → nothing to do`);
      return;
    }

    if (!flwReference && !flwId) {
      console.error("[FLW webhook] No reference or ID in payload");
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // ── Idempotent update ─────────────────────────────
      // Only update if still 'processing' to prevent double-refund
      const { rows: [wd] } = await client.query(
        `UPDATE market.vendor_withdrawal_requests
         SET
           status          = $1,
           flw_transfer_id = COALESCE(flw_transfer_id, $2),
           failure_reason  = CASE WHEN $1 = 'failed' THEN $3 ELSE NULL END,
           processed_at    = NOW(),
           updated_at      = NOW()
         WHERE
           (tx_ref = $4 OR flw_transfer_id = $2)
           AND status = 'processing'
         RETURNING *`,
        [newStatus, flwId, flwMessage, flwReference]
      );

      // Already finalized or not found — skip safely
      if (!wd) {
        await client.query("ROLLBACK");
        console.log(
          `[FLW webhook] No processing row found for ref=${flwReference} flw_id=${flwId} — already finalized or not found`
        );
        return;
      }

      // ── Update vendor transaction ─────────────────────
      await client.query(
        `UPDATE market.vendor_transactions
         SET status = $1, updated_at = NOW()
         WHERE tx_ref = $2
           AND status  = 'processing'`,
        [newStatus, wd.tx_ref]
      );

      // ── If FAILED → full refund ───────────────────────
      if (newStatus === "failed") {
        const refundAmount = Number(wd.amount); // refund gross amount

        await client.query(
          `UPDATE market.vendor_wallets
           SET
             available_balance = available_balance + $1,
             total_withdrawn   = total_withdrawn   - $1,
             updated_at        = NOW()
           WHERE vendor_id = $2`,
          [refundAmount, wd.vendor_id]
        );

        await client.query(
          `INSERT INTO market.vendor_transactions
             (vendor_id, type, amount, fee, net_amount,
              currency, status, narration, tx_ref)
           VALUES ($1,'credit',$2,0,$2,'NGN','success',$3,$4)`,
          [
            wd.vendor_id,
            refundAmount,
            `Refund: withdrawal ${wd.tx_ref} failed — ${flwMessage || "Transfer unsuccessful"}`,
            `REF-${wd.tx_ref}`,
          ]
        );

        console.log(
          `[FLW webhook] ↩️  Refunded ₦${refundAmount} → vendor ${wd.vendor_id} (ref=${wd.tx_ref})`
        );
      } else {
        console.log(
          `[FLW webhook] ✅ ₦${wd.net_amount} paid → ${wd.bank_name} (ref=${wd.tx_ref})`
        );
      }

      await client.query("COMMIT");
    } catch (dbErr) {
      await client.query("ROLLBACK");
      console.error("[FLW webhook] DB error:", dbErr.message);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[FLW webhook] Unhandled error:", err.message);
  }
});

export default router;