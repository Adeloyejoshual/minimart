/**
 * routes/admin/delivery.js
 *
 * Admin/Loemart Express dispatch controls.
 *
 * POST /api/admin/orders/:orderId/dispatch     — assign agent, mark out_for_delivery
 * POST /api/admin/orders/:orderId/delivered    — mark delivered (agent confirmed drop-off)
 * POST /api/admin/orders/:orderId/failed       — mark failed delivery attempt
 * GET  /api/admin/orders/:orderId/dispatch     — get dispatch info
 */

import express                from "express";
import { pool }               from "../../config/db.js";
import { authenticateAdmin }  from "../../middleware/adminAuth.js";
import {
  recomputeGroupStatus,
  markSubOrderDelivered,
  isTransitionAllowed,
  VALID_TRANSITIONS,
} from "../../services/orderService.js";

const router = express.Router();
router.use(authenticateAdmin);

/* ════════════════════════════════════════════════════════════
   POST /:orderId/dispatch
   ─────────────────────────────────────────────────────────
   Assigns a Loemart Express agent and marks out_for_delivery.
   Triggered when agent picks up from seller.
════════════════════════════════════════════════════════════ */
router.post("/:orderId/dispatch", async (req, res) => {
  const { orderId }    = req.params;
  const { agentId }    = req.body;
  const adminId        = req.user.id;

  if (!agentId) {
    return res.status(422).json({
      success: false,
      message: "agentId is required",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [order] } = await client.query(
      `SELECT id, status, tracking_id, order_group_id
       FROM public.orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!isTransitionAllowed(order.status, "out_for_delivery", "admin")) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot dispatch from status "${order.status}"`,
        data   : { currentStatus: order.status, required: "shipped" },
      });
    }

    /* Verify agent exists */
    const { rows: [agent] } = await client.query(
      `SELECT id, name, phone FROM public.delivery_agents
       WHERE id = $1 AND is_active = true`,
      [agentId]
    );

    if (!agent) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Delivery agent not found or inactive",
      });
    }

    /* Update sub-order status */
    await client.query(
      `UPDATE public.orders
       SET status              = 'out_for_delivery',
           out_for_delivery_at = NOW(),
           updated_at          = NOW()
       WHERE id = $1`,
      [orderId]
    );

    /* Upsert dispatch record */
    const dispatchCode = `LX-${orderId.slice(0, 6).toUpperCase()}`;
    await client.query(
      `INSERT INTO public.order_dispatches
         (order_id, order_group_id, agent_id, dispatch_code,
          status, out_for_delivery_at, pickup_confirmed_at)
       VALUES ($1,$2,$3,$4,'out_for_delivery',NOW(),NOW())
       ON CONFLICT (order_id) DO UPDATE
         SET agent_id            = $3,
             status              = 'out_for_delivery',
             out_for_delivery_at = NOW(),
             pickup_confirmed_at = NOW(),
             updated_at          = NOW()`,
      [orderId, order.order_group_id, agentId, dispatchCode]
    );

    /* Status history */
    await client.query(
      `INSERT INTO public.order_status_history
         (order_id, order_group_id, from_status, to_status,
          changed_by_id, changed_by_role, note)
       VALUES ($1,$2,$3,'out_for_delivery',$4,'admin','Assigned to Loemart Express agent')`,
      [orderId, order.order_group_id, order.status, adminId]
    ).catch(() => {});

    /* Recompute parent status */
    const groupStatus = await recomputeGroupStatus(client, order.order_group_id);

    await client.query("COMMIT");

    console.log(
      `[admin/delivery] ✅ ${order.tracking_id} dispatched`,
      `| agent=${agent.name} | group=${groupStatus}`
    );

    return res.json({
      success: true,
      message: `Order dispatched to ${agent.name}`,
      data   : {
        orderId,
        trackingId  : order.tracking_id,
        dispatchCode,
        agentName   : agent.name,
        agentPhone  : agent.phone,
        groupStatus,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/delivery] POST /dispatch:", err.message);
    return res.status(500).json({ success: false, message: "Failed to dispatch order" });
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   POST /:orderId/delivered
   ─────────────────────────────────────────────────────────
   Agent confirmed drop-off at buyer's address.
   Sets status = delivered.
   Starts 48h buyer confirmation window.
════════════════════════════════════════════════════════════ */
router.post("/:orderId/delivered", async (req, res) => {
  const { orderId }   = req.params;
  const {
    recipientName,      // who signed for it (optional)
    photoUrl,           // proof of delivery photo (optional)
    notes,
  } = req.body;
  const adminId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [order] } = await client.query(
      `SELECT id, status, tracking_id, order_group_id
       FROM public.orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!isTransitionAllowed(order.status, "delivered", "admin")) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot mark delivered from status "${order.status}"`,
        data   : { currentStatus: order.status },
      });
    }

    /* Mark delivered + create 48h confirmation window */
    const { autoConfirmAt } = await markSubOrderDelivered(
      client,
      orderId,
      order.order_group_id,
      adminId
    );

    /* Update dispatch record with proof of delivery */
    await client.query(
      `UPDATE public.order_dispatches
       SET status             = 'delivered',
           delivered_at       = NOW(),
           recipient_name     = $1,
           delivery_photo_url = $2,
           delivery_notes     = $3,
           updated_at         = NOW()
       WHERE order_id = $4`,
      [recipientName ?? null, photoUrl ?? null, notes ?? null, orderId]
    ).catch(() => {});

    /* Recompute parent */
    const groupStatus = await recomputeGroupStatus(client, order.order_group_id);

    await client.query("COMMIT");

    console.log(
      `[admin/delivery] ✅ ${order.tracking_id} delivered`,
      `| auto-confirm at ${autoConfirmAt.toISOString()}`,
      `| group=${groupStatus}`
    );

    return res.json({
      success: true,
      message: "Order marked as delivered. Buyer has 48 hours to confirm receipt.",
      data   : {
        orderId,
        trackingId   : order.tracking_id,
        deliveredAt  : new Date().toISOString(),
        autoConfirmAt: autoConfirmAt.toISOString(),
        groupStatus,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/delivery] POST /delivered:", err.message);
    return res.status(500).json({ success: false, message: "Failed to mark order as delivered" });
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   POST /:orderId/failed
   ─────────────────────────────────────────────────────────
   Agent could not deliver (buyer absent, wrong address, etc.)
   Resets to shipped so admin can re-dispatch.
════════════════════════════════════════════════════════════ */
router.post("/:orderId/failed", async (req, res) => {
  const { orderId }      = req.params;
  const { reason }       = req.body;
  const adminId          = req.user.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [order] } = await client.query(
      `SELECT id, status, tracking_id, order_group_id
       FROM public.orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!isTransitionAllowed(order.status, "failed_delivery", "admin")) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot mark failed from status "${order.status}"`,
      });
    }

    await client.query(
      `UPDATE public.orders
       SET status              = 'failed_delivery',
           failed_delivery_at  = NOW(),
           cancellation_reason = $1,
           updated_at          = NOW()
       WHERE id = $2`,
      [reason ?? "Delivery attempt failed", orderId]
    );

    await client.query(
      `UPDATE public.order_dispatches
       SET status         = 'failed',
           failed_at      = NOW(),
           failure_reason = $1,
           attempt_count  = attempt_count + 1,
           updated_at     = NOW()
       WHERE order_id = $2`,
      [reason ?? null, orderId]
    ).catch(() => {});

    await client.query(
      `INSERT INTO public.order_status_history
         (order_id, order_group_id, from_status, to_status,
          changed_by_id, changed_by_role, note)
       VALUES ($1,$2,$3,'failed_delivery',$4,'admin',$5)`,
      [orderId, order.order_group_id, order.status, adminId, reason ?? "Delivery failed"]
    ).catch(() => {});

    const groupStatus = await recomputeGroupStatus(client, order.order_group_id);

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Delivery failure recorded. Order can be re-dispatched.",
      data   : { orderId, trackingId: order.tracking_id, groupStatus },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/delivery] POST /failed:", err.message);
    return res.status(500).json({ success: false, message: "Failed to record delivery failure" });
  } finally {
    client.release();
  }
});

export default router;