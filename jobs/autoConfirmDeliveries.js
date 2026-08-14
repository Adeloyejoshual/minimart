/**
 * jobs/autoConfirmDeliveries.js
 *
 * Runs every hour via cron / pg_cron / BullMQ.
 * Auto-confirms orders where buyer has not responded
 * within 48 hours of delivery.
 */

import { pool }               from "../config/db.js";
import {
  markSubOrderReceived,
  recomputeGroupStatus,
} from "../services/orderService.js";

export async function autoConfirmDeliveries() {
  /* Find all deliveries past their auto-confirm window */
  const { rows: pending } = await pool.query(
    `SELECT dc.order_id, dc.order_group_id
     FROM public.delivery_confirmations dc
     WHERE dc.confirmed_at IS NULL
       AND dc.auto_confirm_at <= NOW()
       AND dc.dispute_raised  = false`
  );

  if (!pending.length) return;

  console.log(`[autoConfirm] Processing ${pending.length} auto-confirmations`);

  for (const row of pending) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* Verify still in delivered state (not disputed/cancelled since) */
      const { rows: [order] } = await client.query(
        `SELECT status FROM public.orders WHERE id = $1`,
        [row.order_id]
      );

      if (order?.status !== "delivered") {
        await client.query("ROLLBACK");
        continue;
      }

      await markSubOrderReceived(
        client,
        row.order_id,
        row.order_group_id,
        "system"
      );

      await recomputeGroupStatus(client, row.order_group_id);

      await client.query("COMMIT");

      console.log(
        `[autoConfirm] ✅ ${row.order_id} auto-confirmed`
      );

    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[autoConfirm] Failed ${row.order_id}:`, err.message);
    } finally {
      client.release();
    }
  }
}

/* Register with node-cron if running standalone */
// import cron from "node-cron";
// cron.schedule("0 * * * *", autoConfirmDeliveries); // every hour