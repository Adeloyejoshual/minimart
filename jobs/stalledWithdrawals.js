// server/jobs/stalledWithdrawals.js

import { pool }                    from "../server.js";
import {
  checkTransferStatus,
  normaliseTransferStatus,
}                                  from "../utils/flutterwave.js";
import {
  deductPendingAfterPayout,
  restoreBalance,
}                                  from "../services/walletService.js";
import { createEntry }             from "../services/ledgerService.js";
import { sendNotification }        from "../services/notificationService.js";

// ═════════════════════════════════════════════════════════════
// STALLED WITHDRAWALS
//
// Checks withdrawals that are "processing" but haven't
// received a FLW webhook callback within STALE_MINUTES.
//
// Polls FLW transfer status API and resolves them.
// ═════════════════════════════════════════════════════════════

const STALE_MINUTES = parseInt(
  process.env.STALLED_WITHDRAWAL_MINUTES ?? "30"
);

const CHECK_THROTTLE_MS = 2 * 60 * 1000; // min 2 min between checks

export async function stalledWithdrawals() {
  const { rows: withdrawals } = await pool.query(
    `SELECT *
     FROM   market.vendor_withdrawal_requests
     WHERE  status            = 'processing'
       AND  flw_transfer_id  IS NOT NULL
       AND  created_at       < NOW() - INTERVAL '${STALE_MINUTES} minutes'
       AND  (
         last_checked_at IS NULL
         OR last_checked_at < NOW() - INTERVAL '2 minutes'
       )
     ORDER  BY created_at ASC
     LIMIT  20`
  );

  if (!withdrawals.length) {
    return { checked: 0, resolved: 0 };
  }

  let checked  = 0;
  let resolved = 0;

  for (const wd of withdrawals) {
    try {
      const flwData = await checkTransferStatus(wd.flw_transfer_id);
      const status  = normaliseTransferStatus(flwData.status);

      checked++;

      // ── Update last_checked_at regardless ──────────────
      await pool.query(
        `UPDATE market.vendor_withdrawal_requests
         SET    last_checked_at = NOW()
         WHERE  id = $1`,
        [wd.id]
      );

      if (status === "success") {
        await resolveAsSuccess(wd, flwData);
        resolved++;
      } else if (status === "failed") {
        await resolveAsFailed(wd, flwData);
        resolved++;
      }
      // else still processing — wait for next check

    } catch (err) {
      console.error(
        `[StalledJob] Error checking ${wd.tx_ref}:`, err.message
      );
    }
  }

  return { checked, resolved };
}

// ── Resolve successful ───────────────────────────────────────
async function resolveAsSuccess(wd, flwData) {
  const amount    = parseFloat(wd.amount);
  const netAmount = parseFloat(wd.net_amount);
  const fee       = parseFloat(wd.fee);
  const client    = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE market.vendor_withdrawal_requests
       SET    status          = 'success',
              flw_response    = $1,
              processed_at    = NOW(),
              last_checked_at = NOW(),
              updated_at      = NOW()
       WHERE  id     = $2
         AND  status = 'processing'`,
      [JSON.stringify(flwData.raw), wd.id]
    );

    await deductPendingAfterPayout({
      vendorId: wd.vendor_id,
      amount,
      client,
    });

    await client.query(
      `UPDATE market.vendor_transactions
       SET    status = 'success', narration = 'Completed (resolved by stalled job)'
       WHERE  tx_ref = $1`,
      [wd.tx_ref]
    );

    await createEntry({
      userId:       wd.vendor_id,
      vendorId:     wd.vendor_id,
      withdrawalId: wd.id,
      type:         "payout",
      direction:    "debit",
      amount:       netAmount,
      reference:    `PAYOUT_${wd.tx_ref}`,
      narration:    `Payout of ₦${netAmount.toLocaleString()} confirmed (stalled job)`,
      source:       "system",
      client,
    });

    if (fee > 0) {
      await createEntry({
        userId:       wd.vendor_id,
        vendorId:     wd.vendor_id,
        withdrawalId: wd.id,
        type:         "fee",
        direction:    "debit",
        amount:       fee,
        reference:    `FEE_${wd.tx_ref}`,
        narration:    `Withdrawal fee`,
        source:       "system",
        client,
      });
    }

    await sendNotification({
      userId:   wd.vendor_id,
      userType: "seller",
      type:     "payout_sent",
      title:    "💸 Payout Confirmed",
      message:  `₦${netAmount.toLocaleString()} sent to ${wd.bank_name} ****${wd.account_number.slice(-4)}.`,
      metadata: {
        withdrawal_id: wd.id,
        amount:        netAmount,
        bank:          wd.bank_name,
        tx_ref:        wd.tx_ref,
      },
      client,
    });

    await client.query("COMMIT");
    console.log(`[StalledJob] ✅ Resolved SUCCESS: ${wd.tx_ref}`);

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ── Resolve failed ───────────────────────────────────────────
async function resolveAsFailed(wd, flwData) {
  const amount    = parseFloat(wd.amount);
  const reason    = flwData.message ?? "Transfer failed (detected by stalled job)";
  const client    = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE market.vendor_withdrawal_requests
       SET    status          = 'failed',
              failure_reason  = $1,
              flw_response    = $2,
              processed_at    = NOW(),
              last_checked_at = NOW(),
              updated_at      = NOW()
       WHERE  id     = $3
         AND  status = 'processing'`,
      [reason, JSON.stringify(flwData.raw), wd.id]
    );

    await restoreBalance({
      vendorId: wd.vendor_id,
      amount,
      client,
    });

    await client.query(
      `UPDATE market.vendor_transactions
       SET    status = 'failed', narration = $1
       WHERE  tx_ref = $2`,
      [`Failed: ${reason}`, wd.tx_ref]
    );

    await createEntry({
      userId:       wd.vendor_id,
      vendorId:     wd.vendor_id,
      withdrawalId: wd.id,
      type:         "reversal",
      direction:    "credit",
      amount,
      reference:    `STALL_REVERSAL_${wd.tx_ref}`,
      narration:    `Withdrawal failed (stalled) — ₦${amount.toLocaleString()} restored`,
      source:       "system",
      client,
    });

    await sendNotification({
      userId:   wd.vendor_id,
      userType: "seller",
      type:     "payout_failed",
      title:    "❌ Payout Failed",
      message:  `Withdrawal of ₦${amount.toLocaleString()} to ${wd.bank_name} failed. Balance restored.`,
      metadata: {
        withdrawal_id: wd.id,
        amount,
        reason,
        tx_ref: wd.tx_ref,
      },
      client,
    });

    await sendNotification({
      userId:   "system",
      userType: "admin",
      type:     "payout_failed_alert",
      title:    "⚠️ Stalled Payout Failed",
      message:  `Vendor ${wd.vendor_id}: ₦${amount.toLocaleString()} stalled and failed. Ref: ${wd.tx_ref}`,
      metadata: { withdrawal_id: wd.id, vendor_id: wd.vendor_id, amount },
      client,
    });

    await client.query("COMMIT");
    console.log(`[StalledJob] ❌ Resolved FAILED: ${wd.tx_ref}`);

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}