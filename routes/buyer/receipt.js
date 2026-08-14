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
 *
 * The auto-confirm job (jobs/autoConfirmDeliveries.js) calls the
 * same markSubOrderReceived() function with confirmedBy='system'
 * for orders where the buyer hasn't confirmed within 48h.
 */

import express from "express";
import { pool } from "../../config/db.js";
import {
  recomputeGroupStatus,
  markSubOrderReceived,
} from "../../services/orderService.js";
import {
  sendReceivedNotifications,
} from "../../services/orderDeliveryNotification.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   POST /:orderId/confirm-received
   ─────────────────────────────────────────────────────────────
   Buyer confirms they received their order.
   Can only be called when sub-order status = 'delivered'.

   No request body required.

   Response includes the new group status so the frontend
   can update the parent order display.
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
        data   : {
          currentStatus: order.status,
          expectedStatus: "delivered",
        },
      });
    }

    /* ── Mark as received ── */
    await markSubOrderReceived(
      client,
      orderId,
      order.order_group_id,
      "buyer"
    );

    /* ── Recompute parent group status ── */
    const groupStatus = await recomputeGroupStatus(
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
   Returns the auto-confirm deadline.
   Used by the frontend to show the "Confirm Received" button
   with a countdown.
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