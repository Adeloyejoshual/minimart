/**
 * jobs/autoConfirmDeliveries.js
 *
 * Background job to automatically confirm delivery for orders
 * that have been in "delivered" status for 48+ hours without
 * buyer confirmation or dispute.
 *
 * Flow:
 *   - Finds all delivered orders where auto_confirm_at <= NOW()
 *   - Sets sub-order status = 'received'
 *   - Marks receipt_confirmed_by = 'system'
 *   - Updates delivery_confirmations & seller_earnings
 *   - Recomputes parent order group status
 *   - Sends notification to buyer and seller
 */

import { pool } from "../config/db.js";
import {
  sendReceivedNotifications,
} from "../services/orderDeliveryNotification.js";

/* ══════════════════════════════════════════════════════════════
   LOCAL HELPERS (Replacing orderService imports)
══════════════════════════════════════════════════════════════ */

async function localMarkSubOrderReceived(client, orderId, confirmedBy = "system") {
  // Check if updated_at exists on orders
  const { rows: colCheck } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'updated_at'`
  );
  const hasUpdatedAt = colCheck.length > 0;

  const setClauses = [
    "status = 'received'",
    "received_at = NOW()",
    "receipt_confirmed_by = $2"
  ];
  if (hasUpdatedAt) setClauses.push("updated_at = NOW()");

  await client.query(
    `UPDATE public.orders
     SET ${setClauses.join(", ")}
     WHERE id = $1`,
    [orderId, confirmedBy]
  );

  // Update delivery_confirmations table
  try {
    await client.query(
      `UPDATE public.delivery_confirmations
       SET confirmed_at = NOW(),
           confirmed_by = $2,
           updated_at   = NOW()
       WHERE order_id = $1`,
      [orderId, confirmedBy]
    );
  } catch (err) {
    // Fail-silent if table does not exist
  }

  // Clear seller earnings
  try {
    await client.query(
      `UPDATE public.seller_earnings
       SET status     = 'cleared',
           cleared_at = NOW(),
           updated_at = NOW()
       WHERE order_id = $1 AND status = 'pending'`,
      [orderId]
    );
  } catch (err) {
    // Fail-silent if table does not exist
  }
}

async function localRecomputeGroupStatus(client, orderGroupId) {
  const { rows: orders } = await client.query(
    `SELECT status FROM public.orders WHERE order_group_id = $1`,
    [orderGroupId]
  );

  if (!orders.length) return "pending";

  const statuses = orders.map((o) => o.status);
  const activeStatuses = statuses.filter((s) => s !== "cancelled");

  let newStatus = "pending";

  if (activeStatuses.length === 0) {
    newStatus = "cancelled";
  } else if (activeStatuses.every((s) => s === "received")) {
    newStatus = "received";
  } else if (activeStatuses.every((s) => s === "delivered" || s === "received")) {
    newStatus = "delivered";
  } else if (activeStatuses.some((s) => ["shipped", "out_for_delivery", "delivered", "received"].includes(s))) {
    newStatus = "shipped";
  } else if (activeStatuses.some((s) => s === "processing")) {
    newStatus = "processing";
  } else if (activeStatuses.every((s) => s === "confirmed")) {
    newStatus = "confirmed";
  }

  const { rows: colCheck } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'order_groups' AND column_name = 'updated_at'`
  );
  const hasUpdatedAt = colCheck.length > 0;

  const setClauses = ["status = $1"];
  if (hasUpdatedAt) setClauses.push("updated_at = NOW()");

  await client.query(
    `UPDATE public.order_groups SET ${setClauses.join(", ")} WHERE id = $2`,
    [newStatus, orderGroupId]
  );

  return newStatus;
}

/* ══════════════════════════════════════════════════════════════
   JOB RUNNER
══════════════════════════════════════════════════════════════ */
export async function runAutoConfirmDeliveries() {
  console.log("[jobs/autoConfirm] 🔍 Checking for orders to auto-confirm...");

  let pendingOrders = [];
  try {
    // Look for orders needing auto-confirmation (either via delivery_confirmations or 48h delivered fallback)
    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.order_group_id,
         o.tracking_id
       FROM public.orders o
       LEFT JOIN public.delivery_confirmations dc ON dc.order_id = o.id
       WHERE o.status = 'delivered'
         AND (
           (dc.auto_confirm_at IS NOT NULL AND dc.auto_confirm_at <= NOW() AND dc.confirmed_at IS NULL AND COALESCE(dc.dispute_raised, false) = false)
           OR
           (dc.order_id IS NULL AND o.delivered_at <= NOW() - INTERVAL '48 hours')
         )
       LIMIT 100`
    );
    pendingOrders = rows;
  } catch (err) {
    console.error("[jobs/autoConfirm] query failed:", err.message);
    return;
  }

  if (pendingOrders.length === 0) {
    console.log("[jobs/autoConfirm] ✓ No orders pending auto-confirmation.");
    return;
  }

  console.log(`[jobs/autoConfirm] ⏳ Auto-confirming ${pendingOrders.length} orders...`);

  for (const order of pendingOrders) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await localMarkSubOrderReceived(client, order.id, "system");
      const groupStatus = await localRecomputeGroupStatus(client, order.order_group_id);

      await client.query("COMMIT");

      console.log(
        `[jobs/autoConfirm] ✅ Auto-confirmed order ${order.tracking_id ?? order.id}`,
        `| group=${groupStatus}`
      );

      // Send notifications (fire & forget)
      sendReceivedNotifications({
        orderId     : order.id,
        orderGroupId: order.order_group_id,
        confirmedBy : "system",
      }).catch((err) =>
        console.warn(`[jobs/autoConfirm] notification failed for ${order.id}:`, err.message)
      );

    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[jobs/autoConfirm] failed to auto-confirm order ${order.id}:`, err.message);
    } finally {
      client.release();
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   INTERVAL INITIALIZER (Runs hourly)
══════════════════════════════════════════════════════════════ */
export function startAutoConfirmJob(intervalMinutes = 60) {
  console.log(`[jobs/autoConfirm] 🕒 Job initialized (runs every ${intervalMinutes} mins)`);

  // Run on startup
  setTimeout(() => {
    runAutoConfirmDeliveries().catch((err) =>
      console.error("[jobs/autoConfirm] startup run error:", err.message)
    );
  }, 10000);

  // Periodic interval
  setInterval(() => {
    runAutoConfirmDeliveries().catch((err) =>
      console.error("[jobs/autoConfirm] interval run error:", err.message)
    );
  }, intervalMinutes * 60 * 1000);
}

export default {
  runAutoConfirmDeliveries,
  startAutoConfirmJob,
};