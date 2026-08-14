/**
 * routes/buyer/receipt.js
 *
 * POST /api/checkout/orders/:orderId/confirm-received
 *
 * Buyer confirms they received the item.
 * Can only be called when status = 'delivered'.
 * Triggers earnings clearance for seller.
 */

import express                from "express";
import { pool }               from "../../config/db.js";
import {
  markSubOrderReceived,
  recomputeGroupStatus,
} from "../../services/orderService.js";

const router = express.Router();

router.post("/:orderId/confirm-received", async (req, res) => {
  const userId    = req.user.id;
  const { orderId } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Verify this order belongs to this buyer and is in delivered state */
    const { rows: [order] } = await client.query(
      `SELECT
         o.id,
         o.status,
         o.tracking_id,
         o.order_group_id,
         og.user_id   AS buyer_id
       FROM public.orders o
       JOIN public.order_groups og ON og.id = o.order_group_id
       WHERE o.id = $1
       FOR UPDATE OF o`,
      [orderId]
    );

    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    /* Ownership check */
    if (order.buyer_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ success: false, message: "Not your order" });
    }

    /* Must be in delivered state */
    if (order.status !== "delivered") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: order.status === "received"
          ? "You have already confirmed receipt of this order"
          : `Order is "${order.status}" — can only confirm when delivered`,
        data: { currentStatus: order.status },
      });
    }

    /* Mark received */
    await markSubOrderReceived(client, orderId, order.order_group_id, "buyer");

    /* Recompute parent */
    const groupStatus = await recomputeGroupStatus(client, order.order_group_id);

    await client.query("COMMIT");

    console.log(
      `[buyer/receipt] ✅ ${order.tracking_id} confirmed by buyer=${userId}`,
      `| group=${groupStatus}`
    );

    return res.json({
      success: true,
      message: "Thank you for confirming receipt! Your order is complete.",
      data   : {
        orderId,
        trackingId : order.tracking_id,
        status     : "received",
        receivedAt : new Date().toISOString(),
        groupStatus,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[buyer/receipt] confirm-received:", err.message);
    return res.status(500).json({ success: false, message: "Failed to confirm receipt" });
  } finally {
    client.release();
  }
});

export default router;