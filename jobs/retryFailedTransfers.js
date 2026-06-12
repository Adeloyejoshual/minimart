// server/jobs/retryFailedTransfers.js

import { pool }                   from "../server.js";
import {
  initiateTransfer,
  checkTransferStatus,
  normaliseTransferStatus,
}                                 from "../utils/flutterwave.js";
import { restoreBalance }         from "../services/walletService.js";
import { createEntry }            from "../services/ledgerService.js";
import { sendNotification }       from "../services/notificationService.js";

// ═════════════════════════════════════════════════════════════
// RETRY FAILED TRANSFERS
//
// Retries withdrawals that failed on the FLW side but are
// still within the retry window.
//
// Retry policy:
// Attempt 1: immediate      (already done at request time)
// Attempt 2: 30 min later   (this job)
// Attempt 3: 2 hours later
// Attempt 4: 12 hours later
// After 4:   permanently failed — restore balance
//
// Also checks "processing" transfers that have been stuck
// for more than STALE_MINUTES without FLW confirmation.
// ═════════════════════════════════════════════════════════════

const MAX_RETRIES    = 4;
const RETRY_DELAYS   = [
  0,                    // attempt 1 = immediate
  30 * 60,              // attempt 2 = 30 min
  2 * 60 * 60,          // attempt 3 = 2 hours
  12 * 60 * 60,         // attempt 4 = 12 hours
];

export async function retryFailedTransfers() {
  let retried    = 0;
  let abandoned  = 0;

  // ── Find retryable withdrawals ────────────────────────
  const { rows: withdrawals } = await pool.query(
    `SELECT *
     FROM   market.vendor_withdrawal_requests
     WHERE  status       = 'failed'
       AND  retry_count  < $1
       AND  (
         last_retry_at IS NULL
         OR last_retry_at < NOW() - INTERVAL '25 minutes'
       )
     ORDER  BY created_at ASC
     LIMIT  10`,
    [MAX_RETRIES]
  );

  for (const wd of withdrawals) {
    const attempt      = wd.retry_count + 1;
    const minDelay     = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
    const lastRetry    = wd.last_retry_at
      ? new Date(wd.last_retry_at).getTime() : 0;
    const elapsed      = (Date.now() - lastRetry) / 1000;

    // ── Check if enough time has passed for this attempt ─
    if (elapsed < minDelay) {
      continue;
    }

    // ── Check if we should abandon ───────────────────────
    if (attempt > MAX_RETRIES) {
      await permanentlyFail(wd);
      abandoned++;
      continue;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Lock the row
      const { rows: [locked] } = await client.query(
        `SELECT *
         FROM   market.vendor_withdrawal_requests
         WHERE  id     = $1
           AND  status = 'failed'
         FOR UPDATE`,
        [wd.id]
      );

      if (!locked) {
        await client.query("COMMIT");
        continue;
      }

      console.log(
        `[RetryJob] 🔄 Retry attempt ${attempt}/${MAX_RETRIES}: ${wd.tx_ref}`
      );

      // ── Mark as processing ─────────────────────────────
      await client.query(
        `UPDATE market.vendor_withdrawal_requests
         SET    status        = 'processing',
                retry_count   = $1,
                last_retry_at = NOW(),
                failure_reason = NULL,
                updated_at    = NOW()
         WHERE  id = $2`,
        [attempt, wd.id]
      );

      await client.query("COMMIT");

      // ── Retry the FLW transfer ─────────────────────────
      try {
        const result = await initiateTransfer({
          vendorId:      wd.vendor_id,
          amount:        parseFloat(wd.amount),
          fee:           parseFloat(wd.fee),
          netAmount:     parseFloat(wd.net_amount),
          bankName:      wd.bank_name,
          bankCode:      wd.bank_code,
          accountNumber: wd.account_number,
          accountName:   wd.account_name,
          txRef:         wd.tx_ref,
        });

        await pool.query(
          `UPDATE market.vendor_withdrawal_requests
           SET    flw_transfer_id = $1,
                  updated_at      = NOW()
           WHERE  id = $2`,
          [result.flw_transfer_id, wd.id]
        );

        console.log(
          `[RetryJob] ✅ Retry sent: ${wd.tx_ref} → FLW ${result.flw_transfer_id}`
        );

        retried++;

      } catch (flwErr) {
        // FLW failed again — mark as failed
        console.error(
          `[RetryJob] ❌ Retry failed: ${wd.tx_ref} — ${flwErr.message}`
        );

        await pool.query(
          `UPDATE market.vendor_withdrawal_requests
           SET    status         = 'failed',
                  failure_reason = $1,
                  updated_at     = NOW()
           WHERE  id = $2`,
          [flwErr.message, wd.id]
        );

        // If this was the last attempt, permanently fail
        if (attempt >= MAX_RETRIES) {
          await permanentlyFail(wd);
          abandoned++;
        }
      }

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[RetryJob] Error:", err.message);
    } finally {
      client.release();
    }
  }

  return { retried, abandoned };
}

// ═════════════════════════════════════════════════════════════
// PERMANENTLY FAIL — restore wallet, notify seller + admin
// ═════════════════════════════════════════════════════════════
async function permanentlyFail(wd) {
  const amount = parseFloat(wd.amount);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Update status
    await client.query(
      `UPDATE market.vendor_withdrawal_requests
       SET    status          = 'failed',
              failure_reason  = $1,
              processed_at    = NOW(),
              updated_at      = NOW()
       WHERE  id = $2
         AND  status != 'success'`,
      [
        `Permanently failed after ${MAX_RETRIES} retry attempts. ` +
        `Original error: ${wd.failure_reason ?? "Unknown"}`,
        wd.id,
      ]
    );

    // Restore wallet
    await restoreBalance({
      vendorId: wd.vendor_id,
      amount,
      client,
    });

    // Ledger reversal
    await createEntry({
      userId:       wd.vendor_id,
      vendorId:     wd.vendor_id,
      withdrawalId: wd.id,
      type:         "reversal",
      direction:    "credit",
      amount,
      reference:    `PERMANENT_FAIL_${wd.tx_ref}`,
      narration:    `Withdrawal permanently failed after ${MAX_RETRIES} attempts. ₦${amount.toLocaleString()} restored.`,
      source:       "system",
      client,
    });

    // Update transaction log
    await client.query(
      `UPDATE market.vendor_transactions
       SET    status    = 'failed',
              narration = $1
       WHERE  tx_ref   = $2`,
      [`Permanently failed after ${MAX_RETRIES} retries`, wd.tx_ref]
    );

    // Notify seller
    await sendNotification({
      userId:   wd.vendor_id,
      userType: "seller",
      type:     "payout_failed",
      title:    "❌ Payout Permanently Failed",
      message:  `Your withdrawal of ₦${amount.toLocaleString()} could not be processed after ${MAX_RETRIES} attempts. Your balance has been restored.`,
      metadata: {
        withdrawal_id: wd.id,
        amount,
        reason:        wd.failure_reason ?? "Unknown",
        tx_ref:        wd.tx_ref,
      },
      client,
    });

    // Notify admin
    await sendNotification({
      userId:   "system",
      userType: "admin",
      type:     "payout_permanently_failed",
      title:    "🚨 Payout Permanently Failed",
      message:  `Vendor ${wd.vendor_id}: ₦${amount.toLocaleString()} failed after ${MAX_RETRIES} retries. Ref: ${wd.tx_ref}`,
      metadata: {
        withdrawal_id: wd.id,
        vendor_id:     wd.vendor_id,
        amount,
        tx_ref:        wd.tx_ref,
      },
      client,
    });

    await client.query("COMMIT");

    console.log(
      `[RetryJob] 🛑 Permanently failed: ${wd.tx_ref} — balance restored`
    );

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[RetryJob] permanentlyFail error:", err.message);
  } finally {
    client.release();
  }
}