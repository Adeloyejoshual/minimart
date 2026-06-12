// server/jobs/dailyReconciliation.js

import { pool } from "../server.js";
import { sendNotification } from "../services/notificationService.js";

// ═════════════════════════════════════════════════════════════
// DAILY RECONCILIATION
//
// Compares internal wallet balances with ledger totals.
// Flags any mismatches for admin review.
//
// This catches bugs, race conditions, or manual DB edits
// that cause wallet and ledger to disagree.
// ═════════════════════════════════════════════════════════════

export async function dailyReconciliation() {
  try {
    // ── Compare wallet vs ledger for each vendor ──────────
    const { rows: mismatches } = await pool.query(
      `SELECT
         w.vendor_id,
         v.store_name,
         w.available_balance + w.pending_balance + w.locked_balance
           AS wallet_total,
         COALESCE((
           SELECT SUM(
             CASE WHEN direction = 'credit' THEN amount
                  ELSE -amount END
           )
           FROM market.ledger_transactions lt
           WHERE lt.vendor_id = w.vendor_id
         ), 0) AS ledger_total
       FROM   market.vendor_wallets w
       JOIN   market.vendors v ON v.id = w.vendor_id
       HAVING ABS(
         (w.available_balance + w.pending_balance + w.locked_balance)
         - COALESCE((
           SELECT SUM(
             CASE WHEN direction = 'credit' THEN amount
                  ELSE -amount END
           )
           FROM market.ledger_transactions lt
           WHERE lt.vendor_id = w.vendor_id
         ), 0)
       ) > 1   -- allow ₦1 rounding tolerance
       LIMIT 50`
    );

    // ── Check for unmatched payments ──────────────────────
    const { rows: [paymentCheck] } = await pool.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE p.status = 'successful'
             AND o.payment_status != 'confirmed'
         ) AS paid_but_unconfirmed,

         COUNT(*) FILTER (
           WHERE p.status != 'successful'
             AND o.payment_status = 'confirmed'
         ) AS confirmed_but_unpaid

       FROM   public.payments p
       JOIN   public.orders   o ON o.id = p.order_id
       WHERE  p.created_at > NOW() - INTERVAL '48 hours'`
    );

    // ── Check withdrawal wallet consistency ──────────────
    const { rows: [wdCheck] } = await pool.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE status = 'success'
             AND processed_at IS NULL
         ) AS success_no_processed_at,

         COUNT(*) FILTER (
           WHERE status = 'processing'
             AND created_at < NOW() - INTERVAL '4 hours'
         ) AS stuck_processing

       FROM market.vendor_withdrawal_requests
       WHERE created_at > NOW() - INTERVAL '72 hours'`
    );

    // ── Build report ─────────────────────────────────────
    const hasIssues =
      mismatches.length > 0 ||
      Number(paymentCheck.paid_but_unconfirmed) > 0 ||
      Number(paymentCheck.confirmed_but_unpaid) > 0 ||
      Number(wdCheck.success_no_processed_at)   > 0 ||
      Number(wdCheck.stuck_processing)           > 0;

    const report = {
      date:                  new Date().toISOString().split("T")[0],
      wallet_ledger_mismatches: mismatches.length,
      paid_but_unconfirmed:    Number(paymentCheck.paid_but_unconfirmed),
      confirmed_but_unpaid:    Number(paymentCheck.confirmed_but_unpaid),
      success_no_processed:    Number(wdCheck.success_no_processed_at),
      stuck_processing:        Number(wdCheck.stuck_processing),
      details: mismatches.map((m) => ({
        vendor_id:    m.vendor_id,
        store:        m.store_name,
        wallet:       Number(m.wallet_total),
        ledger:       Number(m.ledger_total),
        difference:   Math.abs(
          Number(m.wallet_total) - Number(m.ledger_total)
        ),
      })),
    };

    // ── Alert admin if issues found ──────────────────────
    if (hasIssues) {
      const alertParts = [];
      if (mismatches.length > 0)
        alertParts.push(`${mismatches.length} wallet/ledger mismatches`);
      if (report.paid_but_unconfirmed > 0)
        alertParts.push(`${report.paid_but_unconfirmed} paid but unconfirmed orders`);
      if (report.confirmed_but_unpaid > 0)
        alertParts.push(`${report.confirmed_but_unpaid} confirmed but unpaid orders`);
      if (report.stuck_processing > 0)
        alertParts.push(`${report.stuck_processing} stuck withdrawals`);

      await sendNotification({
        userId:   "system",
        userType: "admin",
        type:     "reconciliation_alert",
        title:    "⚠️ Daily Reconciliation — Issues Found",
        message:  `${alertParts.join(", ")}. Review immediately.`,
        metadata: report,
      });

      console.warn("[Reconciliation] ⚠️ Issues found:", report);
    } else {
      console.log("[Reconciliation] ✅ All clear — no issues");
    }

    return report;

  } catch (err) {
    console.error("[Reconciliation] Error:", err.message);
    throw err;
  }
}