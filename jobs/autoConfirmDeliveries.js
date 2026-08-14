/**
 * jobs/autoConfirmDeliveries.js
 *
 * Automatically confirms receipt for orders where:
 *   - Status is "delivered"
 *   - The 48-hour buyer confirmation window has passed
 *   - No dispute has been raised
 *   - Buyer hasn't already confirmed
 *
 * How to run:
 *   Option A — node-cron (in-process):
 *     import cron from "node-cron";
 *     import { autoConfirmDeliveries } from "./jobs/autoConfirmDeliveries.js";
 *     cron.schedule("0 * * * *", autoConfirmDeliveries); // every hour
 *
 *   Option B — standalone script:
 *     node jobs/autoConfirmDeliveries.js
 *
 *   Option C — pg_cron (database-level):
 *     SELECT cron.schedule('auto-confirm', '0 * * * *',
 *       $$SELECT net_http_post(...) $$);
 *
 * Each confirmation:
 *   1. Sets orders.status = 'received'
 *   2. Writes order_status_history
 *   3. Closes delivery_confirmations record
 *   4. Clears seller_earnings (→ 'cleared')
 *   5. Recomputes parent order_groups.status
 *   6. Sends notifications to seller
 */

import { pool } from "../config/db.js";
import {
  markSubOrderReceived,
  recomputeGroupStatus,
} from "../services/orderService.js";
import {
  sendReceivedNotifications,
} from "../services/orderDeliveryNotification.js";

/**
 * Process all overdue delivery confirmations.
 * Safe to call repeatedly — idempotent.
 * Each order is processed in its own transaction.
 */
export async function autoConfirmDeliveries() {
  const startTime = Date.now();

  /* Find all deliveries past their auto-confirm window */
  let pending;
  try {
    const { rows } = await pool.query(
      `SELECT
         dc.order_id,
         dc.order_group_id,
         dc.auto_confirm_at,
         o.status,
         o.tracking_id
       FROM public.delivery_confirmations dc
       JOIN public.orders o ON o.id = dc.order_id
       WHERE dc.confirmed_at IS NULL
         AND dc.auto_confirm_at <= NOW()
         AND dc.dispute_raised  = false
         AND o.status = 'delivered'
       ORDER BY dc.auto_confirm_at ASC`
    );
    pending = rows;
  } catch (err) {
    console.error("[autoConfirm] Failed to query pending confirmations:", err.message);
    return { processed: 0, failed: 0, errors: [err.message] };
  }

  if (!pending.length) {
    console.log("[autoConfirm] No pending auto-confirmations");
    return { processed: 0, failed: 0, errors: [] };
  }

  console.log(`[autoConfirm] Processing ${pending.length} auto-confirmation(s)…`);

  let processed = 0;
  let failed    = 0;
  const errors  = [];

  for (const row of pending) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /*
       * Re-check status inside transaction to prevent race conditions.
       * Another process might have confirmed it between our SELECT and now.
       */
      const { rows: [current] } = await client.query(
        `SELECT status
         FROM public.orders
         WHERE id = $1
         FOR UPDATE`,
        [row.order_id]
      );

      if (current?.status !== "delivered") {
        /* Already moved past delivered — skip */
        await client.query("ROLLBACK");
        console.log(
          `[autoConfirm] Skipping ${row.tracking_id ?? row.order_id}`,
          `— status is "${current?.status}" (not delivered)`
        );
        continue;
      }

      /* Mark received */
      await markSubOrderReceived(
        client,
        row.order_id,
        row.order_group_id,
        "system"
      );

      /* Recompute parent */
      const groupStatus = await recomputeGroupStatus(
        client,
        row.order_group_id
      );

      await client.query("COMMIT");

      processed++;

      console.log(
        `[autoConfirm] ✅ ${row.tracking_id ?? row.order_id}`,
        `auto-confirmed | group=${groupStatus}`
      );

      /* Notification (fire & forget) */
      sendReceivedNotifications({
        orderId     : row.order_id,
        orderGroupId: row.order_group_id,
        confirmedBy : "system",
      }).catch((err) =>
        console.warn(
          `[autoConfirm] notification failed for ${row.order_id}:`,
          err.message
        )
      );

    } catch (err) {
      await client.query("ROLLBACK");
      failed++;
      errors.push(`${row.order_id}: ${err.message}`);
      console.error(
        `[autoConfirm] ❌ Failed ${row.tracking_id ?? row.order_id}:`,
        err.message
      );
    } finally {
      client.release();
    }
  }

  const elapsed = Date.now() - startTime;

  console.log(
    `[autoConfirm] ✅ Done in ${elapsed}ms`,
    `| processed=${processed}`,
    `| failed=${failed}`,
    `| total=${pending.length}`
  );

  return { processed, failed, errors };
}

/*
 * If running as a standalone script:
 *   node jobs/autoConfirmDeliveries.js
 */
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("autoConfirmDeliveries.js") ||
   process.argv[1].endsWith("autoConfirmDeliveries"));

if (isMainModule) {
  console.log("[autoConfirm] Running as standalone job…");
  autoConfirmDeliveries()
    .then((result) => {
      console.log("[autoConfirm] Result:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[autoConfirm] Fatal error:", err);
      process.exit(1);
    });
}