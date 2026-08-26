/**
 * routes/seller/order.js  v5 — Loemart Express
 *
 * Mounted at: /api/seller/orders  (in server.js)
 *
 * Routes:
 *   GET   /api/seller/orders/stats
 *   GET   /api/seller/orders
 *   GET   /api/seller/orders/:orderId
 *   PATCH /api/seller/orders/:orderId/status
 *   POST  /api/seller/orders/:orderId/ready
 *
 * Status flow (seller-controlled):
 *   pending → confirmed → processing → shipped
 *   any of the above → cancelled
 *
 * After "shipped":
 *   Loemart Express takes over (admin/system routes)
 *   Seller can no longer change status
 */

import express                from "express";
import { pool }               from "../../config/db.js";
import { authenticateSeller } from "../../middleware/sellerAuth.js";
import { sendShipmentNotifications } from "../../services/orderShipNotification.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   STARTUP GUARD
══════════════════════════════════════════════════════════════ */
if (!process.env.JWT_SECRET) {
  throw new Error(
    "[seller/orders] FATAL: JWT_SECRET environment variable is not set. " +
    "Server cannot start safely."
  );
}

/* ══════════════════════════════════════════════════════════════
   LOCAL HELPERS & CONSTANTS (Replacing Missing orderService Imports)
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
};

const VALID_TRANSITIONS = {
  pending:          ["confirmed", "cancelled"],
  confirmed:        ["processing", "cancelled"],
  processing:       ["shipped", "cancelled"],
  shipped:          ["delivered", "failed_delivery"],
  out_for_delivery: ["delivered", "failed_delivery"],
  delivered:        ["received"],
  received:         [],
  cancelled:        [],
  failed_delivery:  ["processing", "cancelled"],
};

/**
 * Returns transitions allowed specifically for a given role (e.g., 'seller')
 */
function allowedTransitionsForRole(currentStatus, role = "seller") {
  if (role === "seller") {
    const sellerAllowed = {
      pending:    ["confirmed", "cancelled"],
      confirmed:  ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
    };
    return sellerAllowed[currentStatus] || [];
  }
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Verification check to see if a status transition is valid
 */
function isTransitionAllowed(fromStatus, toStatus, role = "seller") {
  const allowed = allowedTransitionsForRole(fromStatus, role);
  return allowed.includes(toStatus);
}

/**
 * Recalculates parent order status based on individual sub-orders
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
   NOTIFICATION SERVICE (lazy-loaded, non-fatal)
══════════════════════════════════════════════════════════════ */
let notifier = null;

(async () => {
  try {
    notifier = await import("../../services/notificationService.js");
    console.log("[seller/orders] ✓ notificationService loaded");
  } catch (err) {
    console.warn(
      "[seller/orders] notificationService unavailable — " +
      "basic order notifications disabled:",
      err.message
    );
  }
})();

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */

/**
 * Statuses a seller is allowed to transition TO.
 * Everything after "shipped" is controlled by admin/system/buyer.
 */
const SELLER_ALLOWED_TARGETS = new Set([
  "confirmed",
  "processing",
  "shipped",
  "cancelled",
]);

const VALID_STATUS_SET = new Set(Object.keys(VALID_TRANSITIONS));

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX     = 100;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function safeInt(value, defaultVal, min = 1, max = Infinity) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return defaultVal;
  return Math.min(max, Math.max(min, n));
}

/**
 * Dispatch order status notifications to buyer.
 * Used for non-shipped transitions (confirmed, processing, cancelled).
 * "shipped" uses sendShipmentNotifications() instead.
 */
async function dispatchStatusNotifications({
  order,
  orderGroup,
  buyer,
  newStatus,
}) {
  if (!notifier) return;

  const { sendOrderStatusEmail, createNotification } = notifier;

  const trackId = order.tracking_id
    ?? orderGroup.tracking_id
    ?? order.id.slice(0, 8).toUpperCase();

  const statusLabel = STATUS_LABELS[newStatus] ?? newStatus;

  const statusMessages = {
    confirmed:  `Your shipment ${trackId} has been confirmed by the seller.`,
    processing: `Your shipment ${trackId} is being prepared for Loemart Express pickup.`,
    cancelled:  `Your shipment ${trackId} has been cancelled.`,
  };

  const jobs = [];

  if (buyer?.email && sendOrderStatusEmail) {
    jobs.push(
      sendOrderStatusEmail({
        to     : buyer.email,
        name   : buyer.name,
        orderId: trackId,
        status : statusLabel,
        message: statusMessages[newStatus],
      }).catch((err) =>
        console.warn("[seller/orders] buyer email failed:", err.message)
      )
    );
  }

  if (buyer?.id && createNotification) {
    jobs.push(
      createNotification({
        userId : buyer.id,
        type   : "order_status_update",
        title  : `Shipment ${statusLabel}`,
        message: statusMessages[newStatus]
          ?? `Your shipment ${trackId} is ${statusLabel.toLowerCase()}`,
        link   : `/shop/orders/${orderGroup.tracking_id ?? orderGroup.id}`,
        meta   : {
          orderGroupId: orderGroup.id,
          orderId     : order.id,
          trackingId  : trackId,
          newStatus,
        },
      }).catch((err) =>
        console.warn("[seller/orders] buyer notification failed:", err.message)
      )
    );
  }

  await Promise.allSettled(jobs);
}

/* ══════════════════════════════════════════════════════════════
   AUTH — all routes require authenticated seller
══════════════════════════════════════════════════════════════ */
router.use(authenticateSeller);

/* ══════════════════════════════════════════════════════════════
   GET /stats
   ─────────────────────────────────────────────────────────────
   Returns order counts by status + revenue + earnings summary.
══════════════════════════════════════════════════════════════ */
router.get("/stats", async (req, res) => {
  const sellerId = req.user.id;

  try {
    /* Order counts + revenue */
    const { rows: [stats] } = await pool.query(
      `SELECT
         COUNT(*)                                              AS total_orders,
         COUNT(*) FILTER (WHERE status = 'pending')           AS pending,
         COUNT(*) FILTER (WHERE status = 'confirmed')         AS confirmed,
         COUNT(*) FILTER (WHERE status = 'processing')        AS processing,
         COUNT(*) FILTER (WHERE status = 'shipped')           AS shipped,
         COUNT(*) FILTER (WHERE status = 'out_for_delivery')  AS out_for_delivery,
         COUNT(*) FILTER (WHERE status = 'delivered')         AS delivered,
         COUNT(*) FILTER (WHERE status = 'received')          AS received,
         COUNT(*) FILTER (WHERE status = 'cancelled')         AS cancelled,

         COALESCE(
           SUM(subtotal) FILTER (WHERE status NOT IN ('cancelled')), 0
         ) AS total_revenue,
         COALESCE(
           SUM(subtotal) FILTER (WHERE status IN ('delivered', 'received')), 0
         ) AS confirmed_revenue

       FROM public.orders
       WHERE seller_id = $1`,
      [sellerId]
    );

    /* Earnings breakdown */
    let earningsData = { pending: 0, cleared: 0, paid: 0, void: 0 };
    try {
      const { rows: [earnings] } = await pool.query(
        `SELECT
           COALESCE(SUM(net_amount) FILTER (WHERE status = 'pending'), 0) AS pending,
           COALESCE(SUM(net_amount) FILTER (WHERE status = 'cleared'), 0) AS cleared,
           COALESCE(SUM(net_amount) FILTER (WHERE status = 'paid'),    0) AS paid,
           COALESCE(SUM(net_amount) FILTER (WHERE status = 'void'),    0) AS void
         FROM public.seller_earnings
         WHERE seller_id = $1`,
        [sellerId]
      );
      if (earnings) earningsData = earnings;
    } catch (err) {
      console.warn("[seller/orders] earnings query failed:", err.message);
    }

    return res.json({
      success: true,
      data: {
        counts: {
          total:            Number(stats.total_orders),
          pending:          Number(stats.pending),
          confirmed:        Number(stats.confirmed),
          processing:       Number(stats.processing),
          shipped:          Number(stats.shipped),
          out_for_delivery: Number(stats.out_for_delivery),
          delivered:        Number(stats.delivered),
          received:         Number(stats.received),
          cancelled:        Number(stats.cancelled),
        },
        revenue: {
          total    : Number(stats.total_revenue),
          confirmed: Number(stats.confirmed_revenue),
        },
        earnings: {
          pending: Number(earningsData.pending),
          cleared: Number(earningsData.cleared),
          paid   : Number(earningsData.paid),
          void   : Number(earningsData.void),
        },
      },
    });

  } catch (err) {
    console.error("[seller/orders] GET /stats:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order stats",
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /
   ─────────────────────────────────────────────────────────────
   Paginated order list, scoped to seller.
══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  const sellerId = req.user.id;

  try {
    const page   = safeInt(req.query.page,  1,               1);
    const limit  = safeInt(req.query.limit, PAGE_SIZE_DEFAULT, 1, PAGE_SIZE_MAX);
    const offset = (page - 1) * limit;

    const rawStatus = req.query.status ?? null;
    const status    = rawStatus && VALID_STATUS_SET.has(rawStatus)
      ? rawStatus
      : null;

    const search = req.query.search?.trim() || null;

    /* Dynamic WHERE */
    const conditions = ["o.seller_id = $1"];
    const params     = [sellerId];
    let   pIdx       = 2;

    if (status) {
      conditions.push(`o.status = $${pIdx++}`);
      params.push(status);
    }

    if (search) {
      conditions.push(`(
        o.tracking_id   ILIKE $${pIdx}
        OR og.tracking_id ILIKE $${pIdx}
        OR u.name         ILIKE $${pIdx}
      )`);
      params.push(`%${search}%`);
      pIdx++;
    }

    const where = conditions.join(" AND ");

    /* Count */
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM public.orders o
       LEFT JOIN public.order_groups og ON og.id = o.order_group_id
       LEFT JOIN market.users         u  ON u.id  = og.user_id
       WHERE ${where}`,
      params
    );

    const totalItems = Number(count);
    const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / limit);

    /* Page data */
    const { rows: orders } = await pool.query(
      `SELECT
         o.id,
         o.tracking_id,
         o.status,
         o.subtotal,
         o.created_at,
         o.updated_at,
         o.shipped_at,
         o.delivered_at,
         o.pickup_ready_at,

         og.id             AS order_group_id,
         og.tracking_id    AS parent_tracking_id,
         og.grand_total,
         og.payment_method,
         og.payment_status,

         a.city,
         a.state,

         u.name            AS buyer_name,
         u.email           AS buyer_email,

         (SELECT COUNT(*)::int
          FROM public.order_items oi
          WHERE oi.order_id = o.id) AS item_count,

         d.dispatch_code,
         d.status           AS dispatch_status

       FROM public.orders o
       LEFT JOIN public.order_groups     og ON og.id    = o.order_group_id
       LEFT JOIN public.user_addresses   a  ON a.id     = og.address_id
       LEFT JOIN market.users            u  ON u.id     = og.user_id
       LEFT JOIN public.order_dispatches d  ON d.order_id = o.id
       WHERE ${where}
       ORDER BY o.created_at DESC
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset]
    );

    return res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        filters: { status, search },
      },
    });

  } catch (err) {
    console.error("[seller/orders] GET /:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /:orderId
   ─────────────────────────────────────────────────────────────
   Full order detail with items, dispatch, history, earnings.
══════════════════════════════════════════════════════════════ */
router.get("/:orderId", async (req, res) => {
  const sellerId    = req.user.id;
  const { orderId } = req.params;

  try {
    const { rows: [order] } = await pool.query(
      `SELECT
         o.*,

         og.id              AS order_group_id,
         og.tracking_id     AS parent_tracking_id,
         og.grand_total,
         og.payment_method,
         og.payment_status,
         og.delivery_fee,
         og.discount,
         og.coupon_code,
         og.notes,
         og.user_id,

         a.recipient_name,
         a.phone,
         a.address_line,
         a.bus_stop,
         a.landmark,
         a.city,
         a.state,

         u.name             AS buyer_name,
         u.email            AS buyer_email,

         /* Loemart Express dispatch */
         d.id               AS dispatch_id,
         d.dispatch_code,
         d.status           AS dispatch_status,
         d.pickup_scheduled_at,
         d.pickup_confirmed_at,
         d.out_for_delivery_at,
         d.estimated_at,
         d.delivered_at     AS dispatch_delivered_at,
         d.delivery_photo_url,
         d.failure_reason,
         d.attempt_count,

         da.name            AS agent_name,
         da.phone           AS agent_phone,
         da.vehicle_type    AS agent_vehicle

       FROM public.orders o
       LEFT JOIN public.order_groups     og ON og.id    = o.order_group_id
       LEFT JOIN public.user_addresses   a  ON a.id     = og.address_id
       LEFT JOIN market.users            u  ON u.id     = og.user_id
       LEFT JOIN public.order_dispatches d  ON d.order_id = o.id
       LEFT JOIN public.delivery_agents  da ON da.id    = d.agent_id
       WHERE o.id = $1 AND o.seller_id = $2`,
      [orderId, sellerId]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    /* Line items */
    const { rows: items } = await pool.query(
      `SELECT
         oi.id,
         oi.product_id,
         oi.variant_id,
         oi.variant_name,
         oi.sku,
         COALESCE(oi.quantity, oi.qty,       0)  AS quantity,
         COALESCE(oi.price,    oi.unit_price, 0)  AS price,
         COALESCE(oi.image,    oi.image_url    )  AS image,
         p.name                                   AS product_name,
         (COALESCE(oi.quantity, oi.qty,       0) *
          COALESCE(oi.price,    oi.unit_price, 0)) AS line_total
       FROM public.order_items oi
       LEFT JOIN market.products p ON p.id = oi.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [orderId]
    );

    /* Status history */
    let history = [];
    try {
      const { rows } = await pool.query(
        `SELECT
           from_status,
           to_status,
           changed_by_role,
           note,
           created_at
         FROM public.order_status_history
         WHERE order_id = $1
         ORDER BY created_at ASC`,
        [orderId]
      );
      history = rows;
    } catch (err) {
      console.warn("[seller/orders] history query failed:", err.message);
    }

    /* Seller earnings for this sub-order */
    let earning = null;
    try {
      const { rows: [e] } = await pool.query(
        `SELECT
           gross_amount,
           platform_fee,
           delivery_fee,
           net_amount,
           status,
           cleared_at,
           paid_at
         FROM public.seller_earnings
         WHERE order_id = $1`,
        [orderId]
      );
      earning = e ?? null;
    } catch (err) {
      console.warn("[seller/orders] earnings query failed:", err.message);
    }

    /* Allowed next statuses for THIS seller */
    const sellerAllowed = allowedTransitionsForRole(order.status, "seller");

    return res.json({
      success: true,
      data: {
        ...order,
        items,
        history,
        earning,
        meta: {
          itemCount  : items.length,
          allowedNext: sellerAllowed,
        },
      },
    });

  } catch (err) {
    console.error("[seller/orders] GET /:orderId:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /:orderId/status
   ─────────────────────────────────────────────────────────────
   Seller updates sub-order status.
══════════════════════════════════════════════════════════════ */
router.patch("/:orderId/status", async (req, res) => {
  const sellerId              = req.user.id;
  const { orderId }           = req.params;
  const { status: newStatus } = req.body;

  /* ── Input validation ── */
  if (!newStatus) {
    return res.status(422).json({
      success: false,
      message: "New status is required",
    });
  }

  if (!VALID_STATUS_SET.has(newStatus)) {
    return res.status(422).json({
      success: false,
      message: `Invalid status: "${newStatus}"`,
      data   : { validStatuses: [...VALID_STATUS_SET] },
    });
  }

  /* Seller role guard — block transitions sellers cannot make */
  if (!SELLER_ALLOWED_TARGETS.has(newStatus)) {
    return res.status(403).json({
      success: false,
      message:
        `Sellers cannot set status to "${newStatus}". ` +
        `Statuses after "shipped" are managed by Loemart Express.`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /*
     * Lock the sub-order row for the duration of the transaction.
     */
    const { rows: [order] } = await client.query(
      `SELECT
         o.id,
         o.status,
         o.tracking_id,
         o.seller_id,
         o.subtotal,
         o.order_group_id,
         u.id    AS buyer_id,
         u.name  AS buyer_name,
         u.email AS buyer_email
       FROM public.orders o
       LEFT JOIN public.order_groups og ON og.id = o.order_group_id
       LEFT JOIN market.users        u  ON u.id  = og.user_id
       WHERE o.id = $1 AND o.seller_id = $2
       FOR UPDATE OF o`,
      [orderId, sellerId]
    );

    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const currentStatus = order.status;

    /* Transition guard (role-based) */
    if (!isTransitionAllowed(currentStatus, newStatus, "seller")) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot move from "${currentStatus}" to "${newStatus}"`,
        data: {
          currentStatus,
          requestedStatus: newStatus,
          allowedNext    : allowedTransitionsForRole(currentStatus, "seller"),
        },
      });
    }

    /* ── Apply status update ── */
    const timestampClauses = {
      shipped  : ", shipped_at   = NOW()",
      cancelled: ", cancelled_at = NOW()",
    };
    const extraTimestamp = timestampClauses[newStatus] ?? "";

    const { rows: [updated] } = await client.query(
      `UPDATE public.orders
       SET status     = $1,
           updated_at = NOW()
           ${extraTimestamp}
       WHERE id = $2
       RETURNING id, status, tracking_id, subtotal, order_group_id, updated_at`,
      [newStatus, orderId]
    );

    /* ── Status history ── */
    await client.query(
      `INSERT INTO public.order_status_history
         (order_id, order_group_id, from_status, to_status,
          changed_by_id, changed_by_role, note)
       VALUES ($1, $2, $3, $4, $5, 'seller', $6)`,
      [
        orderId,
        order.order_group_id,
        currentStatus,
        newStatus,
        sellerId,
        `Seller moved order from ${currentStatus} to ${newStatus}`,
      ]
    ).catch((err) =>
      console.warn("[seller/orders] history insert failed:", err.message)
    );

    /* ── Update seller earnings based on new status ── */
    if (newStatus === "cancelled") {
      /* Void seller earnings on cancellation */
      await client.query(
        `UPDATE public.seller_earnings
         SET status     = 'void',
             updated_at = NOW()
         WHERE order_id = $1`,
        [orderId]
      ).catch((err) =>
        console.warn("[seller/orders] earnings void failed:", err.message)
      );
    }

    /* ── Recompute parent order_groups.status ── */
    const newGroupStatus = await localRecomputeGroupStatus(
      client,
      order.order_group_id
    );

    /* ── Fetch group row for notifications ── */
    const { rows: [group] } = await client.query(
      `SELECT id, user_id, tracking_id
       FROM public.order_groups
       WHERE id = $1`,
      [order.order_group_id]
    );

    await client.query("COMMIT");

    console.log(
      `[seller/orders] ✅ ${updated.tracking_id ?? orderId}:`,
      `${currentStatus} → ${newStatus}`,
      `| group=${newGroupStatus}`,
      `| seller=${sellerId}`
    );

    /* ── Notifications (fire & forget) ── */

    if (newStatus === "shipped") {
      sendShipmentNotifications({
        orderId,
        orderGroupId: order.order_group_id,
        sellerId,
        shippedAt   : updated.updated_at ?? new Date(),
      }).catch((err) =>
        console.warn("[seller/orders] shipment notification failed:", err.message)
      );
    } else {
      dispatchStatusNotifications({
        order     : updated,
        orderGroup: group,
        buyer     : {
          id   : order.buyer_id,
          name : order.buyer_name,
          email: order.buyer_email,
        },
        newStatus,
      }).catch((err) =>
        console.warn("[seller/orders] notification dispatch failed:", err.message)
      );
    }

    return res.json({
      success: true,
      message: `Order status updated to "${STATUS_LABELS[newStatus] ?? newStatus}"`,
      data: {
        orderId        : updated.id,
        trackingId     : updated.tracking_id,
        previousStatus : currentStatus,
        newStatus      : updated.status,
        updatedAt      : updated.updated_at,
        allowedNext    : allowedTransitionsForRole(newStatus, "seller"),
        groupStatus    : newGroupStatus,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[seller/orders] PATCH /:orderId/status:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /:orderId/ready
   ─────────────────────────────────────────────────────────────
   Seller marks items as ready for pickup.
══════════════════════════════════════════════════════════════ */
router.post("/:orderId/ready", async (req, res) => {
  const sellerId    = req.user.id;
  const { orderId } = req.params;
  const { note }    = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [order] } = await client.query(
      `SELECT
         o.id,
         o.status,
         o.tracking_id,
         o.order_group_id,
         a.address_line,
         a.bus_stop,
         a.landmark,
         a.city,
         a.state
       FROM public.orders o
       LEFT JOIN public.order_groups   og ON og.id = o.order_group_id
       LEFT JOIN public.user_addresses a  ON a.id  = og.address_id
       WHERE o.id = $1 AND o.seller_id = $2
       FOR UPDATE OF o`,
      [orderId, sellerId]
    );

    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!["confirmed", "processing"].includes(order.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message:
          `Order must be "confirmed" or "processing" to mark as ready ` +
          `(current: "${order.status}")`,
      });
    }

    /* Set pickup_ready_at timestamp */
    await client.query(
      `UPDATE public.orders
       SET pickup_ready_at = NOW(),
           seller_note     = $1,
           updated_at      = NOW()
       WHERE id = $2`,
      [note ?? null, orderId]
    );

    /* Create dispatch row if it doesn't exist */
    const dispatchCode = `LX-${orderId.slice(0, 6).toUpperCase()}`;
    const deliveryAddr = [
      order.address_line,
      order.bus_stop || order.landmark,
      order.city,
      order.state,
    ].filter(Boolean).join(", ");

    await client.query(
      `INSERT INTO public.order_dispatches
         (order_id, order_group_id, dispatch_code, status,
          delivery_address, pickup_scheduled_at)
       VALUES ($1, $2, $3, 'pending', $4, NOW())
       ON CONFLICT (order_id) DO UPDATE
         SET pickup_scheduled_at = NOW(),
             updated_at          = NOW()`,
      [orderId, order.order_group_id, dispatchCode, deliveryAddr]
    ).catch((err) =>
      console.warn("[seller/orders] dispatch upsert failed:", err.message)
    );

    await client.query("COMMIT");

    console.log(
      `[seller/orders] ✅ ${order.tracking_id ?? orderId} ready for pickup`
    );

    return res.json({
      success: true,
      message: "Marked as ready. Loemart Express has been notified for pickup.",
      data: {
        orderId,
        trackingId  : order.tracking_id,
        dispatchCode,
        readyAt     : new Date().toISOString(),
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[seller/orders] POST /:orderId/ready:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to mark order as ready",
    });
  } finally {
    client.release();
  }
});

export default router;