/**
 * routes/admin/delivery.js
 *
 * Loemart Express dispatch & delivery management.
 * Mounted at: /api/admin/delivery  (in server.js)
 *
 * Uses verifyAdmin from routes/admin/middleware.js
 * — same middleware used by all other admin routes.
 *
 * Routes:
 *   GET  /api/admin/delivery/pending-dispatch
 *   GET  /api/admin/delivery/:orderId/dispatch
 *   POST /api/admin/delivery/:orderId/dispatch
 *   POST /api/admin/delivery/:orderId/delivered
 *   POST /api/admin/delivery/:orderId/failed
 */

import express         from "express";
import { pool }        from "../../config/db.js";
import { verifyAdmin } from "../admin/middleware.js";
import {
  sendOutForDeliveryNotifications,
  sendDeliveredNotifications,
  sendFailedDeliveryNotifications,
} from "../../services/orderDeliveryNotification.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   LOCAL CONSTANTS & STATUS HELPERS
══════════════════════════════════════════════════════════════ */

const STATUS_LABELS = {
  pending:          "Pending",
  confirmed:        "Confirmed",
  processing:       "Processing",
  shipped:          "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
  received:         "Received",
  cancelled:        "Cancelled",
  failed_delivery:  "Failed Delivery",
  refunded:         "Refunded",
};

const VALID_TRANSITIONS = {
  pending:          ["confirmed", "cancelled"],
  confirmed:        ["processing", "cancelled"],
  processing:       ["shipped", "cancelled"],
  shipped:          ["out_for_delivery", "delivered", "failed_delivery"],
  out_for_delivery: ["delivered", "failed_delivery"],
  delivered:        ["received"],
  received:         [],
  cancelled:        [],
  failed_delivery:  ["out_for_delivery", "processing", "cancelled"],
};

function isTransitionAllowed(fromStatus, toStatus, role = "admin") {
  if (role === "admin") {
    const adminTransitions = {
      shipped:          ["out_for_delivery"],
      out_for_delivery: ["delivered", "failed_delivery"],
      failed_delivery:  ["out_for_delivery", "cancelled"],
    };
    return (adminTransitions[fromStatus] || []).includes(toStatus);
  }
  return (VALID_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

/**
 * Marks sub-order as delivered and sets up 48-hour auto-confirm timer
 */
async function markSubOrderDelivered(client, orderId, orderGroupId, adminId) {
  const autoConfirmAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  await client.query(
    `UPDATE public.orders
     SET status       = 'delivered',
         delivered_at = NOW(),
         updated_at   = NOW()
     WHERE id = $1`,
    [orderId]
  );

  try {
    await client.query(
      `INSERT INTO public.delivery_confirmations
         (order_id, auto_confirm_at, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (order_id) DO UPDATE
         SET auto_confirm_at = $2,
             updated_at      = NOW()`,
      [orderId, autoConfirmAt]
    );
  } catch (err) {
    console.warn("[admin/delivery] delivery_confirmations insert/update omitted:", err.message);
  }

  await writeHistory(client, {
    orderId,
    orderGroupId,
    fromStatus: "out_for_delivery",
    toStatus  : "delivered",
    adminId,
    note      : "Delivered by agent. 48-hour auto-confirmation window started.",
  });

  return { autoConfirmAt };
}

/**
 * Recomputes the group status from all suborders in this group
 */
async function recomputeGroupStatus(client, orderGroupId) {
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
   AUTH — all routes require admin
══════════════════════════════════════════════════════════════ */
router.use(verifyAdmin);

/* ══════════════════════════════════════════════════════════════
   HELPER — status history insert
══════════════════════════════════════════════════════════════ */
async function writeHistory(
  client,
  { orderId, orderGroupId, fromStatus, toStatus, adminId, note }
) {
  await client.query(
    `INSERT INTO public.order_status_history
       (order_id, order_group_id, from_status, to_status,
        changed_by_id, changed_by_role, note)
     VALUES ($1, $2, $3, $4, $5, 'admin', $6)`,
    [orderId, orderGroupId, fromStatus, toStatus, adminId, note]
  ).catch((err) =>
    console.warn("[admin/delivery] history insert failed:", err.message)
  );
}

/* ══════════════════════════════════════════════════════════════
   GET /pending-dispatch
   ─────────────────────────────────────────────────────────────
   All sub-orders with status = 'shipped' needing agent assignment.
══════════════════════════════════════════════════════════════ */
router.get("/pending-dispatch", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.tracking_id,
         o.status,
         o.subtotal,
         o.shipped_at,
         o.pickup_ready_at,
         o.seller_note,

         og.tracking_id      AS parent_tracking_id,
         og.grand_total,

         s.name              AS seller_name,
         s.email             AS seller_email,

         u.name              AS buyer_name,

         a.recipient_name,
         a.address_line,
         a.bus_stop,
         a.landmark,
         a.city,
         a.state,
         a.phone             AS buyer_phone,

         d.dispatch_code,
         d.status            AS dispatch_status,
         d.agent_id,
         da.name             AS agent_name,

         (SELECT COUNT(*)::int
          FROM public.order_items oi
          WHERE oi.order_id = o.id) AS item_count

       FROM public.orders o
       LEFT JOIN public.order_groups     og ON og.id    = o.order_group_id
       LEFT JOIN market.users            s  ON s.id     = o.seller_id
       LEFT JOIN market.users            u  ON u.id     = og.user_id
       LEFT JOIN public.user_addresses   a  ON a.id     = og.address_id
       LEFT JOIN public.order_dispatches d  ON d.order_id = o.id
       LEFT JOIN public.delivery_agents  da ON da.id    = d.agent_id
       WHERE o.status = 'shipped'
       ORDER BY o.shipped_at ASC NULLS LAST`
    );

    return res.json({
      success: true,
      data   : { orders: rows, total: rows.length },
    });

  } catch (err) {
    console.error("[admin/delivery] GET /pending-dispatch:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending dispatches",
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /:orderId/dispatch
   ─────────────────────────────────────────────────────────────
   Dispatch info for a specific sub-order.
══════════════════════════════════════════════════════════════ */
router.get("/:orderId/dispatch", async (req, res) => {
  const { orderId } = req.params;

  try {
    const { rows: [dispatch] } = await pool.query(
      `SELECT
         d.*,
         da.name          AS agent_name,
         da.phone         AS agent_phone,
         da.vehicle_type  AS agent_vehicle,
         da.zone          AS agent_zone,

         o.tracking_id,
         o.status         AS order_status,
         o.subtotal,
         o.seller_note,
         o.pickup_ready_at,
         o.shipped_at,

         og.tracking_id   AS parent_tracking_id,

         s.name           AS seller_name,

         u.name           AS buyer_name,

         a.recipient_name,
         a.address_line,
         a.bus_stop,
         a.landmark,
         a.city,
         a.state,
         a.phone          AS buyer_phone

       FROM public.order_dispatches d
       LEFT JOIN public.delivery_agents  da ON da.id    = d.agent_id
       LEFT JOIN public.orders           o  ON o.id     = d.order_id
       LEFT JOIN public.order_groups     og ON og.id    = d.order_group_id
       LEFT JOIN market.users            s  ON s.id     = o.seller_id
       LEFT JOIN market.users            u  ON u.id     = og.user_id
       LEFT JOIN public.user_addresses   a  ON a.id     = og.address_id
       WHERE d.order_id = $1`,
      [orderId]
    );

    if (!dispatch) {
      return res.status(404).json({
        success: false,
        message: "No dispatch record found for this order",
      });
    }

    return res.json({ success: true, data: dispatch });

  } catch (err) {
    console.error("[admin/delivery] GET /:orderId/dispatch:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dispatch info",
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /:orderId/dispatch
   ─────────────────────────────────────────────────────────────
   Assign agent → mark out_for_delivery.
══════════════════════════════════════════════════════════════ */
router.post("/:orderId/dispatch", async (req, res) => {
  const { orderId }                     = req.params;
  const { agentId, estimatedAt, notes } = req.body;
  const adminId                         = req.admin.id;

  if (!agentId) {
    return res.status(422).json({
      success: false,
      message: "agentId is required",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Lock sub-order */
    const { rows: [order] } = await client.query(
      `SELECT id, status, tracking_id, order_group_id, seller_id
       FROM public.orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    /* Transition guard */
    if (!isTransitionAllowed(order.status, "out_for_delivery", "admin")) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot dispatch from status "${order.status}". ` +
                 `Order must be "shipped" or "failed_delivery".`,
        data   : { currentStatus: order.status },
      });
    }

    /* Verify agent */
    const { rows: [agent] } = await client.query(
      `SELECT id, name, phone, vehicle_type, zone
       FROM public.delivery_agents
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

    /* Update sub-order */
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
          status, out_for_delivery_at, pickup_confirmed_at,
          estimated_at, delivery_notes)
       VALUES ($1, $2, $3, $4, 'out_for_delivery', NOW(), NOW(), $5, $6)
       ON CONFLICT (order_id) DO UPDATE
         SET agent_id            = $3,
             status              = 'out_for_delivery',
             out_for_delivery_at = NOW(),
             pickup_confirmed_at = NOW(),
             estimated_at        = $5,
             delivery_notes      = $6,
             attempt_count       = public.order_dispatches.attempt_count + 1,
             failed_at           = NULL,
             failure_reason      = NULL,
             updated_at          = NOW()`,
      [
        orderId,
        order.order_group_id,
        agentId,
        dispatchCode,
        estimatedAt ?? null,
        notes       ?? null,
      ]
    );

    /* History */
    await writeHistory(client, {
      orderId,
      orderGroupId: order.order_group_id,
      fromStatus  : order.status,
      toStatus    : "out_for_delivery",
      adminId,
      note        : `Assigned to agent ${agent.name} (${agent.vehicle_type ?? "motorcycle"}). Code: ${dispatchCode}`,
    });

    /* Recompute parent */
    const groupStatus = await recomputeGroupStatus(client, order.order_group_id);

    await client.query("COMMIT");

    console.log(
      `[admin/delivery] ✅ ${order.tracking_id} dispatched`,
      `| agent=${agent.name} (${agent.phone})`,
      `| code=${dispatchCode}`,
      `| group=${groupStatus}`
    );

    /* Notifications (fire & forget) */
    sendOutForDeliveryNotifications({
      orderId,
      orderGroupId: order.order_group_id,
    }).catch((err) =>
      console.warn("[admin/delivery] OFD notification failed:", err.message)
    );

    return res.json({
      success: true,
      message: `Order dispatched to ${agent.name}`,
      data: {
        orderId,
        trackingId  : order.tracking_id,
        dispatchCode,
        agent: {
          id     : agent.id,
          name   : agent.name,
          phone  : agent.phone,
          vehicle: agent.vehicle_type,
          zone   : agent.zone,
        },
        estimatedAt : estimatedAt ?? null,
        groupStatus,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/delivery] POST /dispatch:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to dispatch order",
    });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /:orderId/delivered
   ─────────────────────────────────────────────────────────────
   Agent confirmed drop-off at buyer's address.
══════════════════════════════════════════════════════════════ */
router.post("/:orderId/delivered", async (req, res) => {
  const { orderId }                       = req.params;
  const { recipientName, photoUrl, notes } = req.body;
  const adminId                           = req.admin.id;

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
        message: `Cannot mark delivered from status "${order.status}". ` +
                 `Order must be "out_for_delivery".`,
        data   : { currentStatus: order.status },
      });
    }

    /* Mark delivered + create 48h auto-confirm window */
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
    ).catch((err) =>
      console.warn("[admin/delivery] dispatch delivered update failed:", err.message)
    );

    /* Recompute parent */
    const groupStatus = await recomputeGroupStatus(client, order.order_group_id);

    await client.query("COMMIT");

    console.log(
      `[admin/delivery] ✅ ${order.tracking_id} delivered`,
      `| auto-confirm at ${autoConfirmAt.toISOString()}`,
      `| group=${groupStatus}`
    );

    /* Notifications (fire & forget) */
    sendDeliveredNotifications({
      orderId,
      orderGroupId: order.order_group_id,
    }).catch((err) =>
      console.warn("[admin/delivery] delivered notification failed:", err.message)
    );

    return res.json({
      success: true,
      message: "Order marked as delivered. Buyer has 48 hours to confirm receipt.",
      data: {
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
    return res.status(500).json({
      success: false,
      message: "Failed to mark order as delivered",
    });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /:orderId/failed
   ─────────────────────────────────────────────────────────────
   Agent could not complete delivery.
══════════════════════════════════════════════════════════════ */
router.post("/:orderId/failed", async (req, res) => {
  const { orderId } = req.params;
  const { reason }  = req.body;
  const adminId     = req.admin.id;

  if (!reason?.trim()) {
    return res.status(422).json({
      success: false,
      message: "Failure reason is required",
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

    if (!isTransitionAllowed(order.status, "failed_delivery", "admin")) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot mark failed from status "${order.status}". ` +
                 `Order must be "out_for_delivery".`,
        data   : { currentStatus: order.status },
      });
    }

    /* Update sub-order */
    await client.query(
      `UPDATE public.orders
       SET status              = 'failed_delivery',
           failed_delivery_at  = NOW(),
           cancellation_reason = $1,
           updated_at          = NOW()
       WHERE id = $2`,
      [reason, orderId]
    );

    /* Update dispatch record */
    await client.query(
      `UPDATE public.order_dispatches
       SET status         = 'failed',
           failed_at      = NOW(),
           failure_reason = $1,
           attempt_count  = attempt_count + 1,
           updated_at     = NOW()
       WHERE order_id = $2`,
      [reason, orderId]
    ).catch((err) =>
      console.warn("[admin/delivery] dispatch failed update:", err.message)
    );

    /* History */
    await writeHistory(client, {
      orderId,
      orderGroupId: order.order_group_id,
      fromStatus  : order.status,
      toStatus    : "failed_delivery",
      adminId,
      note        : `Delivery failed: ${reason}`,
    });

    /* Recompute parent */
    const groupStatus = await recomputeGroupStatus(client, order.order_group_id);

    await client.query("COMMIT");

    console.log(
      `[admin/delivery] ✅ ${order.tracking_id} delivery failed`,
      `| reason="${reason}"`,
      `| group=${groupStatus}`
    );

    /* Notification (fire & forget) */
    sendFailedDeliveryNotifications({
      orderId,
      orderGroupId: order.order_group_id,
      reason,
    }).catch((err) =>
      console.warn("[admin/delivery] failed notification:", err.message)
    );

    return res.json({
      success: true,
      message: "Delivery failure recorded. Order can be re-dispatched.",
      data: {
        orderId,
        trackingId : order.tracking_id,
        reason,
        groupStatus,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/delivery] POST /failed:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to record delivery failure",
    });
  } finally {
    client.release();
  }
});

export default router;