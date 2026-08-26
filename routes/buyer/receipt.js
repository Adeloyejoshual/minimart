/**
 * routes/buyer/receipt.js
 *
 * Buyer confirms receipt of a delivered order.
 * Mounted at: /api/checkout/orders  (alongside existing checkout routes)
 *
 * Routes:
 *   POST /api/checkout/orders/:orderId/confirm-received
 *
 * Status flow:
 *   delivered → received (buyer confirms)
 *
 * This:
 *   - Sets status = 'received' on the sub-order
 *   - Marks delivery_confirmations as confirmed
 *   - Clears seller earnings (→ 'cleared')
 *   - Recomputes parent order_groups.status
 *   - Sends notifications to seller + buyer
 */

import express from "express";
import { pool } from "../../config/db.js";
import {
  sendReceivedNotifications,
} from "../../services/orderDeliveryNotification.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   LOCAL HELPERS
   ─────────────────────────────────────────────────────────────
   These replace the missing imports from orderService.js locally
   to preserve the integrity of your original services.
══════════════════════════════════════════════════════════════ */

/**
 * Updates a specific sub-order status to 'received' and processes associated actions
 */
async function localMarkSubOrderReceived(client, orderId, confirmedBy = "buyer") {
  // Safe detection of updated_at column
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
  if (hasUpdatedAt) {
    setClauses.push("updated_at = NOW()");
  }

  await client.query(
    `UPDATE public.orders
     SET ${setClauses.join(", ")}
     WHERE id = $1`,
    [orderId, confirmedBy]
  );

  // Update delivery confirmations table if it exists
  try {
    await client.query(
      `UPDATE public.delivery_confirmations
       SET confirmed_at = NOW(),
           confirmed_by = $2
       WHERE order_id = $1`,
      [orderId, confirmedBy]
    );
  } catch (err) {
    // Fail-silent if table or columns don't exist
  }

  // Clear pending seller earnings for this sub-order
  try {
    await client.query(
      `UPDATE public.seller_earnings
       SET status = 'cleared',
           cleared_at = NOW()
       WHERE order_id = $1 AND status = 'pending'`,
      [orderId]
    );
  } catch (err) {
    // Fail-silent if table or columns don't exist
  }
}

/**
 * Recalculates and updates the status of the parent order group based on its sub-orders
 */
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

  // Safe detection of updated_at column
  const { rows: colCheck } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'order_groups' AND column_name = 'updated_at'`
  );
  const hasUpdatedAt = colCheck.length > 0;

  const setClauses = ["status = $1"];
  if (hasUpdatedAt) {
    setClauses.push("updated_at = NOW()");
  }

  await client.query(
    `UPDATE public.order_groups SET ${setClauses.join(", ")} WHERE id = $2`,
    [newStatus, orderGroupId]
  );

  return newStatus;
}


/* ══════════════════════════════════════════════════════════════
   POST /:orderId/confirm-received
   ─────────────────────────────────────────────────────────────
   Buyer confirms they received their order.
   Can only be called when sub-order status = 'delivered'.
══════════════════════════════════════════════════════════════ */
router.post("/:orderId/confirm-received", async (req, res) => {
  const userId      = req.user?.id;
  const { orderId } = req.params;

  /* Auth check — this route requires a logged-in buyer */
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /*
     * Fetch and lock the sub-order.
     * JOIN to order_groups to verify ownership.
     */
    const { rows: [order] } = await client.query(
      `SELECT
         o.id,
         o.status,
         o.tracking_id,
         o.order_group_id,
         o.receipt_confirmed_by,
         og.user_id   AS buyer_id,
         og.tracking_id AS parent_tracking_id
       FROM public.orders o
       JOIN public.order_groups og ON og.id = o.order_group_id
       WHERE o.id = $1
       FOR UPDATE OF o`,
      [orderId]
    );

    /* ── Not found ── */
    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    /* ── Ownership check ── */
    if (order.buyer_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: "This order does not belong to you",
      });
    }

    /* ── Already received ── */
    if (order.status === "received") {
      await client.query("ROLLBACK");

      const confirmedBy = order.receipt_confirmed_by === "system"
        ? "auto-confirmed after 48 hours"
        : "confirmed by you";

      return res.status(400).json({
        success: false,
        message: `You have already confirmed receipt of this order (${confirmedBy}).`,
        data   : {
          currentStatus  : order.status,
          confirmedBy    : order.receipt_confirmed_by,
        },
      });
    }

    /* ── Must be in "delivered" state ── */
    if (order.status !== "delivered") {
      await client.query("ROLLBACK");

      const friendlyStatus = {
        pending:          "is still pending",
        confirmed:        "has been confirmed but not shipped yet",
        processing:       "is being prepared",
        shipped:          "is on its way to you",
        out_for_delivery: "is out for delivery right now",
        failed_delivery:  "had a delivery issue — we'll retry",
        cancelled:        "has been cancelled",
      }[order.status] ?? `is "${order.status}"`;

      return res.status(400).json({
        success: false,
        message: `Your order ${friendlyStatus}. You can only confirm receipt after delivery.`,
        data: {
          currentStatus: order.status,
          expectedStatus: "delivered",
        },
      });
    }

    /* ── Mark as received ── */
    await localMarkSubOrderReceived(
      client,
      orderId,
      "buyer"
    );

    /* ── Recompute parent group status ── */
    const groupStatus = await localRecomputeGroupStatus(
      client,
      order.order_group_id
    );

    await client.query("COMMIT");

    console.log(
      `[buyer/receipt] ✅ ${order.tracking_id ?? orderId}`,
      `confirmed by buyer=${userId}`,
      `| group=${groupStatus}`
    );

    /* ── Notifications (fire & forget) ── */
    sendReceivedNotifications({
      orderId,
      orderGroupId: order.order_group_id,
      confirmedBy : "buyer",
    }).catch((err) =>
      console.warn("[buyer/receipt] notification failed:", err.message)
    );

    return res.json({
      success: true,
      message: "Thank you for confirming! Your order is now complete.",
      data: {
        orderId,
        trackingId       : order.tracking_id,
        parentTrackingId : order.parent_tracking_id,
        status           : "received",
        receivedAt       : new Date().toISOString(),
        confirmedBy      : "buyer",
        groupStatus,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[buyer/receipt] confirm-received failed:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to confirm receipt. Please try again.",
    });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /:orderId/receipt-status
   ─────────────────────────────────────────────────────────────
   Check if a delivered order needs buyer confirmation.
══════════════════════════════════════════════════════════════ */
router.get("/:orderId/receipt-status", async (req, res) => {
  const userId      = req.user?.id;
  const { orderId } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const { rows: [result] } = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.tracking_id,
         o.delivered_at,
         o.received_at,
         o.receipt_confirmed_by,

         og.user_id AS buyer_id,

         dc.auto_confirm_at,
         dc.confirmed_at,
         dc.confirmed_by,
         dc.dispute_raised,
         dc.dispute_reason

       FROM public.orders o
       JOIN public.order_groups                og ON og.id     = o.order_group_id
       LEFT JOIN public.delivery_confirmations dc ON dc.order_id = o.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (result.buyer_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "This order does not belong to you",
      });
    }

    /* Calculate remaining time */
    let remainingHours = null;
    if (result.auto_confirm_at && !result.confirmed_at) {
      const remaining = new Date(result.auto_confirm_at).getTime() - Date.now();
      remainingHours  = Math.max(0, Math.round(remaining / (60 * 60 * 1000)));
    }

    return res.json({
      success: true,
      data: {
        orderId        : result.id,
        trackingId     : result.tracking_id,
        status         : result.status,
        deliveredAt    : result.delivered_at,
        receivedAt     : result.received_at,
        confirmedBy    : result.receipt_confirmed_by ?? result.confirmed_by,
        autoConfirmAt  : result.auto_confirm_at,
        remainingHours,
        needsConfirmation: result.status === "delivered" && !result.confirmed_at,
        disputeRaised  : result.dispute_raised ?? false,
        disputeReason  : result.dispute_reason,
      },
    });

  } catch (err) {
    console.error("[buyer/receipt] receipt-status failed:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch receipt status",
    });
  }
});

export default router;