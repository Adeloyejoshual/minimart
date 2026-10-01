/**
 * routes/seller/order.js  v7 — Loemart Express
 *
 * Mounted at:
 *   /api/seller/orders
 *
 * Routes:
 *   GET   /api/seller/orders/stats
 *   GET   /api/seller/orders
 *   GET   /api/seller/orders/:orderId
 *   PATCH /api/seller/orders/:orderId/status
 *   POST  /api/seller/orders/:orderId/ready
 *
 * Seller status flow:
 *   pending → confirmed → processing → shipped
 *   pending → cancelled
 *   confirmed → cancelled
 *   processing → cancelled
 *
 * After "shipped":
 *   Loemart Express / admin / system controls the remaining delivery statuses.
 */

import express from "express";
import { pool } from "../../config/db.js";
import { authenticateSeller } from "../../middleware/sellerAuth.js";
import { sendShipmentNotifications } from "../../services/orderShipNotification.js";
import { syncShippedOrderToDelivery } from "../../services/deliveryIntegration.js";

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

/*
 * Set ORDER_STATUS_DEBUG=true in Render while debugging.
 *
 * This allows the API to return the exact database stage/error
 * temporarily. Set it back to false/remove it after debugging.
 */
const ORDER_STATUS_DEBUG =
  String(process.env.ORDER_STATUS_DEBUG || "").toLowerCase() === "true";

/* ══════════════════════════════════════════════════════════════
   STATUS CONSTANTS
══════════════════════════════════════════════════════════════ */

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  received: "Received",
  cancelled: "Cancelled",
  failed_delivery: "Failed Delivery",
};

const VALID_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "failed_delivery"],
  out_for_delivery: ["delivered", "failed_delivery"],
  delivered: ["received"],
  received: [],
  cancelled: [],
  failed_delivery: ["processing", "cancelled"],
};

const SELLER_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
};

const SELLER_ALLOWED_TARGETS = new Set([
  "confirmed",
  "processing",
  "shipped",
  "cancelled",
]);

const VALID_STATUS_SET = new Set(
  Object.keys(VALID_TRANSITIONS)
);

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

function allowedTransitionsForRole(
  currentStatus,
  role = "seller"
) {
  if (role === "seller") {
    return SELLER_TRANSITIONS[currentStatus] || [];
  }

  return VALID_TRANSITIONS[currentStatus] || [];
}

function isTransitionAllowed(
  fromStatus,
  toStatus,
  role = "seller"
) {
  return allowedTransitionsForRole(
    fromStatus,
    role
  ).includes(toStatus);
}

function safeInt(
  value,
  defaultVal,
  min = 1,
  max = Infinity
) {
  const n = parseInt(value, 10);

  if (Number.isNaN(n)) {
    return defaultVal;
  }

  return Math.min(
    max,
    Math.max(min, n)
  );
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, "\\$&");
}

function isBadIdError(error) {
  return error?.code === "22P02";
}

/**
 * Returns safe database debugging information.
 *
 * Full details are returned only when:
 *
 * ORDER_STATUS_DEBUG=true
 *
 * This is useful during live Render debugging without permanently
 * exposing database internals to clients.
 */
function buildDebug(stage, error) {
  if (!ORDER_STATUS_DEBUG) {
    return undefined;
  }

  return {
    stage,
    message: error?.message ?? null,
    code: error?.code ?? null,
    detail: error?.detail ?? null,
    hint: error?.hint ?? null,
    constraint: error?.constraint ?? null,
    table: error?.table ?? null,
    column: error?.column ?? null,
  };
}

/* ══════════════════════════════════════════════════════════════
   ORDER GROUP UPDATED_AT DETECTION
══════════════════════════════════════════════════════════════ */

let orderGroupsHasUpdatedAt = null;

async function groupsHasUpdatedAt(client) {
  if (orderGroupsHasUpdatedAt !== null) {
    return orderGroupsHasUpdatedAt;
  }

  const { rows } = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'order_groups'
       AND column_name = 'updated_at'`
  );

  orderGroupsHasUpdatedAt = rows.length > 0;

  return orderGroupsHasUpdatedAt;
}

/* ══════════════════════════════════════════════════════════════
   RECOMPUTE PARENT ORDER GROUP STATUS
══════════════════════════════════════════════════════════════ */

async function localRecomputeGroupStatus(
  client,
  orderGroupId
) {
  const { rows: orders } = await client.query(
    `SELECT status
     FROM public.orders
     WHERE order_group_id = $1`,
    [orderGroupId]
  );

  if (!orders.length) {
    return "pending";
  }

  const activeStatuses = orders
    .map((order) => order.status)
    .filter((status) => status !== "cancelled");

  let newStatus = "pending";

  if (activeStatuses.length === 0) {
    newStatus = "cancelled";
  } else if (
    activeStatuses.every(
      (status) => status === "received"
    )
  ) {
    newStatus = "received";
  } else if (
    activeStatuses.every(
      (status) =>
        status === "delivered" ||
        status === "received"
    )
  ) {
    newStatus = "delivered";
  } else if (
    activeStatuses.some((status) =>
      [
        "shipped",
        "out_for_delivery",
        "delivered",
        "received",
      ].includes(status)
    )
  ) {
    newStatus = "shipped";
  } else if (
    activeStatuses.some(
      (status) => status === "processing"
    )
  ) {
    newStatus = "processing";
  } else if (
    activeStatuses.every(
      (status) => status === "confirmed"
    )
  ) {
    newStatus = "confirmed";
  }

  const hasUpdatedAt =
    await groupsHasUpdatedAt(client);

  const updatedAtClause = hasUpdatedAt
    ? ", updated_at = NOW()"
    : "";

  await client.query(
    `UPDATE public.order_groups
     SET status = $1${updatedAtClause}
     WHERE id = $2`,
    [newStatus, orderGroupId]
  );

  return newStatus;
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION SERVICE
══════════════════════════════════════════════════════════════ */

let notifier = null;

(async () => {
  try {
    notifier = await import(
      "../../services/notificationService.js"
    );

    console.log(
      "[seller/orders] ✓ notificationService loaded"
    );
  } catch (error) {
    console.warn(
      "[seller/orders] notificationService unavailable:",
      error.message
    );
  }
})();

/* ══════════════════════════════════════════════════════════════
   BUYER STATUS NOTIFICATIONS
══════════════════════════════════════════════════════════════ */

async function dispatchStatusNotifications({
  order,
  orderGroup,
  buyer,
  newStatus,
}) {
  if (!notifier) {
    return;
  }

  const {
    sendOrderStatusEmail,
    createNotification,
  } = notifier;

  const trackingId =
    order.tracking_id ??
    orderGroup?.tracking_id ??
    order.id.slice(0, 8).toUpperCase();

  const statusLabel =
    STATUS_LABELS[newStatus] ?? newStatus;

  const statusMessages = {
    confirmed:
      `Your shipment ${trackingId} has been confirmed by the seller.`,

    processing:
      `Your shipment ${trackingId} is being prepared for Loemart Express pickup.`,

    cancelled:
      `Your shipment ${trackingId} has been cancelled.`,
  };

  const jobs = [];

  if (
    buyer?.email &&
    typeof sendOrderStatusEmail === "function"
  ) {
    jobs.push(
      sendOrderStatusEmail({
        to: buyer.email,
        name: buyer.name,
        orderId: trackingId,
        status: statusLabel,
        message: statusMessages[newStatus],
      }).catch((error) => {
        console.warn(
          "[seller/orders] buyer email failed:",
          error.message
        );
      })
    );
  }

  if (
    buyer?.id &&
    typeof createNotification === "function"
  ) {
    jobs.push(
      createNotification({
        userId: buyer.id,
        type: "order_status_update",
        title: `Shipment ${statusLabel}`,
        message:
          statusMessages[newStatus] ??
          `Your shipment ${trackingId} is ${statusLabel.toLowerCase()}`,
        link: `/shop/orders/${
          orderGroup?.tracking_id ??
          orderGroup?.id
        }`,
        meta: {
          orderGroupId: orderGroup?.id,
          orderId: order.id,
          trackingId,
          newStatus,
        },
      }).catch((error) => {
        console.warn(
          "[seller/orders] buyer notification failed:",
          error.message
        );
      })
    );
  }

  await Promise.allSettled(jobs);
}

/* ══════════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════════ */

router.use(authenticateSeller);

/* ══════════════════════════════════════════════════════════════
   GET /stats
══════════════════════════════════════════════════════════════ */

router.get("/stats", async (req, res) => {
  const sellerId = req.user.id;

  try {
    const { rows: [stats] } = await pool.query(
      `SELECT
         COUNT(*) AS total_orders,

         COUNT(*) FILTER (
           WHERE status = 'pending'
         ) AS pending,

         COUNT(*) FILTER (
           WHERE status = 'confirmed'
         ) AS confirmed,

         COUNT(*) FILTER (
           WHERE status = 'processing'
         ) AS processing,

         COUNT(*) FILTER (
           WHERE status = 'shipped'
         ) AS shipped,

         COUNT(*) FILTER (
           WHERE status = 'out_for_delivery'
         ) AS out_for_delivery,

         COUNT(*) FILTER (
           WHERE status = 'delivered'
         ) AS delivered,

         COUNT(*) FILTER (
           WHERE status = 'received'
         ) AS received,

         COUNT(*) FILTER (
           WHERE status = 'cancelled'
         ) AS cancelled,

         COUNT(*) FILTER (
           WHERE status = 'failed_delivery'
         ) AS failed_delivery,

         COALESCE(
           SUM(subtotal)
           FILTER (WHERE status <> 'cancelled'),
           0
         ) AS total_revenue,

         COALESCE(
           SUM(subtotal)
           FILTER (
             WHERE status IN ('delivered', 'received')
           ),
           0
         ) AS confirmed_revenue

       FROM public.orders
       WHERE seller_id = $1`,
      [sellerId]
    );

    let earningsData = {
      pending: 0,
      cleared: 0,
      paid: 0,
      void: 0,
    };

    try {
      const {
        rows: [earnings],
      } = await pool.query(
        `SELECT
           COALESCE(
             SUM(net_amount)
             FILTER (WHERE status = 'pending'),
             0
           ) AS pending,

           COALESCE(
             SUM(net_amount)
             FILTER (WHERE status = 'cleared'),
             0
           ) AS cleared,

           COALESCE(
             SUM(net_amount)
             FILTER (WHERE status = 'paid'),
             0
           ) AS paid,

           COALESCE(
             SUM(net_amount)
             FILTER (WHERE status = 'void'),
             0
           ) AS void

         FROM public.seller_earnings
         WHERE seller_id = $1`,
        [sellerId]
      );

      if (earnings) {
        earningsData = earnings;
      }
    } catch (error) {
      console.warn(
        "[seller/orders] earnings query failed:",
        error.message
      );
    }

    return res.json({
      success: true,
      data: {
        counts: {
          total: Number(stats.total_orders),
          pending: Number(stats.pending),
          confirmed: Number(stats.confirmed),
          processing: Number(stats.processing),
          shipped: Number(stats.shipped),
          out_for_delivery:
            Number(stats.out_for_delivery),
          delivered: Number(stats.delivered),
          received: Number(stats.received),
          cancelled: Number(stats.cancelled),
          failed_delivery:
            Number(stats.failed_delivery),
        },

        revenue: {
          total: Number(stats.total_revenue),
          confirmed:
            Number(stats.confirmed_revenue),
        },

        earnings: {
          pending: Number(earningsData.pending),
          cleared: Number(earningsData.cleared),
          paid: Number(earningsData.paid),
          void: Number(earningsData.void),
        },
      },
    });
  } catch (error) {
    console.error(
      "[seller/orders] GET /stats:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order stats",
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /
══════════════════════════════════════════════════════════════ */

router.get("/", async (req, res) => {
  const sellerId = req.user.id;

  try {
    const page = safeInt(
      req.query.page,
      1,
      1
    );

    const limit = safeInt(
      req.query.limit,
      PAGE_SIZE_DEFAULT,
      1,
      PAGE_SIZE_MAX
    );

    const offset = (page - 1) * limit;

    const rawStatus =
      typeof req.query.status === "string"
        ? req.query.status
        : null;

    const status =
      rawStatus &&
      VALID_STATUS_SET.has(rawStatus)
        ? rawStatus
        : null;

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim() || null
        : null;

    const conditions = [
      "o.seller_id = $1",
    ];

    const params = [sellerId];

    let parameterIndex = 2;

    if (status) {
      conditions.push(
        `o.status = $${parameterIndex}`
      );

      params.push(status);
      parameterIndex += 1;
    }

    if (search) {
      conditions.push(
        `(
          o.tracking_id ILIKE $${parameterIndex} ESCAPE '\\'
          OR og.tracking_id ILIKE $${parameterIndex} ESCAPE '\\'
          OR u.name ILIKE $${parameterIndex} ESCAPE '\\'
        )`
      );

      params.push(
        `%${escapeLike(search)}%`
      );

      parameterIndex += 1;
    }

    const where =
      conditions.join(" AND ");

    const {
      rows: [{ count }],
    } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM public.orders o
       LEFT JOIN public.order_groups og
         ON og.id = o.order_group_id
       LEFT JOIN market.users u
         ON u.id = og.user_id
       WHERE ${where}`,
      params
    );

    const totalItems = Number(count);

    const totalPages =
      totalItems === 0
        ? 1
        : Math.ceil(
            totalItems / limit
          );

    const { rows: orders } =
      await pool.query(
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

           og.id AS order_group_id,
           og.tracking_id AS parent_tracking_id,
           og.grand_total,
           og.payment_method,
           og.payment_status,

           a.city,
           a.state,

           u.name AS buyer_name,
           u.email AS buyer_email,

           (
             SELECT COUNT(*)::int
             FROM public.order_items oi
             WHERE oi.order_id = o.id
           ) AS item_count,

           d.dispatch_code,
           d.status AS dispatch_status

         FROM public.orders o

         LEFT JOIN public.order_groups og
           ON og.id = o.order_group_id

         LEFT JOIN public.user_addresses a
           ON a.id = og.address_id

         LEFT JOIN market.users u
           ON u.id = og.user_id

         LEFT JOIN public.order_dispatches d
           ON d.order_id = o.id

         WHERE ${where}

         ORDER BY o.created_at DESC

         LIMIT $${parameterIndex}
         OFFSET $${parameterIndex + 1}`,
        [
          ...params,
          limit,
          offset,
        ]
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
          hasNext:
            page < totalPages,
          hasPrev:
            page > 1,
        },

        filters: {
          status,
          search,
        },
      },
    });
  } catch (error) {
    console.error(
      "[seller/orders] GET /:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /:orderId
══════════════════════════════════════════════════════════════ */

router.get("/:orderId", async (req, res) => {
  const sellerId = req.user.id;
  const { orderId } = req.params;

  try {
    const {
      rows: [order],
    } = await pool.query(
      `SELECT
         o.*,

         og.id AS order_group_id,
         og.tracking_id AS parent_tracking_id,
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

         u.name AS buyer_name,
         u.email AS buyer_email,

         d.id AS dispatch_id,
         d.dispatch_code,
         d.status AS dispatch_status,
         d.pickup_scheduled_at,
         d.pickup_confirmed_at,
         d.out_for_delivery_at,
         d.estimated_at,
         d.delivered_at AS dispatch_delivered_at,
         d.delivery_photo_url,
         d.failure_reason,
         d.attempt_count,

         da.name AS agent_name,
         da.phone AS agent_phone,
         da.vehicle_type AS agent_vehicle

       FROM public.orders o

       LEFT JOIN public.order_groups og
         ON og.id = o.order_group_id

       LEFT JOIN public.user_addresses a
         ON a.id = og.address_id

       LEFT JOIN market.users u
         ON u.id = og.user_id

       LEFT JOIN public.order_dispatches d
         ON d.order_id = o.id

       LEFT JOIN public.delivery_agents da
         ON da.id = d.agent_id

       WHERE o.id = $1
         AND o.seller_id = $2`,
      [orderId, sellerId]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const { rows: items } =
      await pool.query(
        `SELECT
           oi.id,
           oi.product_id,
           oi.variant_id,
           oi.variant_name,
           oi.sku,

           COALESCE(
             oi.quantity,
             oi.qty,
             0
           ) AS quantity,

           COALESCE(
             oi.price,
             oi.unit_price,
             0
           ) AS price,

           COALESCE(
             oi.image,
             oi.image_url
           ) AS image,

           p.name AS product_name,

           (
             COALESCE(
               oi.quantity,
               oi.qty,
               0
             )
             *
             COALESCE(
               oi.price,
               oi.unit_price,
               0
             )
           ) AS line_total

         FROM public.order_items oi

         LEFT JOIN market.products p
           ON p.id = oi.product_id

         WHERE oi.order_id = $1

         ORDER BY oi.id`,
        [orderId]
      );

    let history = [];

    try {
      const { rows } =
        await pool.query(
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
    } catch (error) {
      console.warn(
        "[seller/orders] history query failed:",
        error.message
      );
    }

    let earning = null;

    try {
      const {
        rows: [earningRow],
      } = await pool.query(
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

      earning = earningRow ?? null;
    } catch (error) {
      console.warn(
        "[seller/orders] earnings query failed:",
        error.message
      );
    }

    return res.json({
      success: true,
      data: {
        ...order,
        items,
        history,
        earning,

        meta: {
          itemCount: items.length,

          allowedNext:
            allowedTransitionsForRole(
              order.status,
              "seller"
            ),
        },
      },
    });
  } catch (error) {
    if (isBadIdError(error)) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    console.error(
      "[seller/orders] GET /:orderId:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /:orderId/status
══════════════════════════════════════════════════════════════ */

router.patch(
  "/:orderId/status",
  async (req, res) => {
    const sellerId = req.user.id;
    const { orderId } = req.params;
    const { status: newStatus } =
      req.body ?? {};

    /* ── Validate request ── */

    if (!newStatus) {
      return res.status(422).json({
        success: false,
        message: "New status is required",
      });
    }

    if (
      !VALID_STATUS_SET.has(newStatus)
    ) {
      return res.status(422).json({
        success: false,
        message:
          `Invalid status: "${newStatus}"`,
        data: {
          validStatuses: [
            ...VALID_STATUS_SET,
          ],
        },
      });
    }

    if (
      !SELLER_ALLOWED_TARGETS.has(newStatus)
    ) {
      return res.status(403).json({
        success: false,
        message:
          `Sellers cannot set status to "${newStatus}". ` +
          `Statuses after "shipped" are managed by Loemart Express.`,
      });
    }

    const client =
      await pool.connect();

    let debugStage = "connect";
    let currentStatus = null;

    try {
      /* ── BEGIN ── */

      debugStage = "begin transaction";

      await client.query("BEGIN");

      /* ── Lock order ── */

      debugStage =
        "load and lock order";

      const {
        rows: [order],
      } = await client.query(
        `SELECT
           o.id,
           o.status,
           o.tracking_id,
           o.seller_id,
           o.subtotal,
           o.order_group_id,

           u.id AS buyer_id,
           u.name AS buyer_name,
           u.email AS buyer_email

         FROM public.orders o

         LEFT JOIN public.order_groups og
           ON og.id = o.order_group_id

         LEFT JOIN market.users u
           ON u.id = og.user_id

         WHERE o.id = $1
           AND o.seller_id = $2

         FOR UPDATE OF o`,
        [
          orderId,
          sellerId,
        ]
      );

      if (!order) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      currentStatus = order.status;

      /* ── Validate transition ── */

      if (
        !isTransitionAllowed(
          currentStatus,
          newStatus,
          "seller"
        )
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          success: false,

          message:
            `Cannot move from "${currentStatus}" ` +
            `to "${newStatus}"`,

          data: {
            currentStatus,
            requestedStatus: newStatus,

            allowedNext:
              allowedTransitionsForRole(
                currentStatus,
                "seller"
              ),
          },
        });
      }

      /* ── Update order ── */

      const timestampClauses = {
        shipped:
          ", shipped_at = NOW()",

        cancelled:
          ", cancelled_at = NOW()",
      };

      const extraTimestamp =
        timestampClauses[newStatus] ?? "";

      debugStage =
        "update order status";

      const {
        rows: [updated],
      } = await client.query(
        `UPDATE public.orders

         SET
           status = $1,
           updated_at = NOW()
           ${extraTimestamp}

         WHERE id = $2

         RETURNING
           id,
           status,
           tracking_id,
           subtotal,
           order_group_id,
           updated_at`,
        [
          newStatus,
          orderId,
        ]
      );

      if (!updated) {
        throw new Error(
          "Order status update returned no row"
        );
      }

      /* ── Status history ── */

      debugStage =
        "insert status history";

      /*
       * IMPORTANT:
       *
       * We deliberately DO NOT use .catch() here.
       *
       * If this INSERT fails inside a PostgreSQL transaction,
       * PostgreSQL marks the transaction as aborted.
       *
       * The error must therefore immediately reach the main
       * catch block so that we ROLLBACK and expose the actual
       * database error during debugging.
       */

      await client.query(
        `INSERT INTO public.order_status_history
         (
           order_id,
           order_group_id,
           from_status,
           to_status,
           changed_by_id,
           changed_by_role,
           note
         )

         VALUES
         (
           $1,
           $2,
           $3,
           $4,
           $5,
           'seller',
           $6
         )`,
        [
          orderId,
          order.order_group_id,
          currentStatus,
          newStatus,
          sellerId,
          `Seller moved order from ${currentStatus} to ${newStatus}`,
        ]
      );

      /* ── Seller earnings ── */

      if (
        newStatus === "cancelled"
      ) {
        debugStage =
          "void seller earnings";

        await client.query(
          `UPDATE public.seller_earnings

           SET
             status = 'void',
             updated_at = NOW()

           WHERE order_id = $1
             AND status = 'pending'`,
          [orderId]
        );
      }

      /* ── Recompute parent group ── */

      debugStage =
        "recompute order group status";

      const newGroupStatus =
        await localRecomputeGroupStatus(
          client,
          order.order_group_id
        );

      /* ── Load parent group ── */

      debugStage =
        "load order group";

      const {
        rows: [group],
      } = await client.query(
        `SELECT
           id,
           user_id,
           tracking_id

         FROM public.order_groups

         WHERE id = $1`,
        [order.order_group_id]
      );

      /* ── COMMIT ── */

      debugStage =
        "commit transaction";

      await client.query(
        "COMMIT"
      );

      /* ═══════════════════════════════════════════════════════
         EVERYTHING BELOW THIS POINT IS AFTER COMMIT
      ═══════════════════════════════════════════════════════ */

      let delivery = null;

      if (
        newStatus === "shipped"
      ) {
        try {
          const synced =
            await syncShippedOrderToDelivery(
              order.id
            );

          delivery =
            synced?.delivery ?? null;
        } catch (deliveryError) {
          console.error(
            "[seller/orders] Delivery sync deferred:",
            deliveryError.message
          );
        }
      }

      console.log(
        `[seller/orders] ✅ ${
          updated.tracking_id ?? orderId
        }: ${currentStatus} → ${newStatus} ` +
        `| group=${newGroupStatus} ` +
        `| seller=${sellerId}`
      );

      /* ── Notifications ── */

      if (
        newStatus === "shipped"
      ) {
        sendShipmentNotifications({
          orderId,
          orderGroupId:
            order.order_group_id,
          sellerId,

          shippedAt:
            updated.updated_at ??
            new Date(),
        }).catch((error) => {
          console.warn(
            "[seller/orders] shipment notification failed:",
            error.message
          );
        });
      } else {
        dispatchStatusNotifications({
          order: updated,

          orderGroup: group,

          buyer: {
            id: order.buyer_id,
            name: order.buyer_name,
            email: order.buyer_email,
          },

          newStatus,
        }).catch((error) => {
          console.warn(
            "[seller/orders] notification dispatch failed:",
            error.message
          );
        });
      }

      /* ── Success response ── */

      return res.json({
        success: true,

        message:
          `Order status updated to ` +
          `"${STATUS_LABELS[newStatus] ?? newStatus}"`,

        data: {
          orderId: updated.id,

          trackingId:
            updated.tracking_id,

          previousStatus:
            currentStatus,

          newStatus:
            updated.status,

          updatedAt:
            updated.updated_at,

          allowedNext:
            allowedTransitionsForRole(
              newStatus,
              "seller"
            ),

          groupStatus:
            newGroupStatus,

          delivery: delivery
            ? {
                trackingId:
                  delivery.delivery_tracking_id,

                status:
                  delivery.status,
              }
            : null,
        },
      });
    } catch (error) {
      /* ── ROLLBACK ── */

      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (rollbackError) {
        console.error(
          "[seller/orders] rollback failed:",
          rollbackError.message
        );
      }

      const databaseError =
        error?.message ??
        "Unknown database error";

      const debugData = {
        orderId,
        sellerId,
        currentStatus,
        requestedStatus: newStatus,
        stage: debugStage,

        message: databaseError,

        code:
          error?.code ?? null,

        detail:
          error?.detail ?? null,

        hint:
          error?.hint ?? null,

        constraint:
          error?.constraint ?? null,

        table:
          error?.table ?? null,

        column:
          error?.column ?? null,
      };

      console.error(
        "[seller/orders] PATCH /:orderId/status FAILED"
      );

      console.error(
        JSON.stringify(
          debugData,
          null,
          2
        )
      );

      /*
       * During debugging:
       *
       * ORDER_STATUS_DEBUG=true
       *
       * gives the browser the actual database error.
       *
       * Once debugging is complete, remove the environment
       * variable or set it to false.
       */

      if (
        ORDER_STATUS_DEBUG
      ) {
        return res.status(500).json({
          success: false,

          message:
            `Failed to update order status at ` +
            `stage "${debugStage}": ${databaseError}`,

          debug: {
            stage: debugStage,

            code:
              error?.code ?? null,

            detail:
              error?.detail ?? null,

            hint:
              error?.hint ?? null,

            constraint:
              error?.constraint ?? null,

            table:
              error?.table ?? null,

            column:
              error?.column ?? null,
          },
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to update order status",
      });
    } finally {
      client.release();
    }
  }
);

/* ══════════════════════════════════════════════════════════════
   POST /:orderId/ready
══════════════════════════════════════════════════════════════ */

router.post(
  "/:orderId/ready",
  async (req, res) => {
    const sellerId = req.user.id;
    const { orderId } = req.params;

    const note =
      typeof req.body?.note === "string"
        ? req.body.note
            .trim()
            .slice(0, 500) || null
        : null;

    const client =
      await pool.connect();

    let debugStage = "connect";

    try {
      /* ── BEGIN ── */

      debugStage =
        "begin transaction";

      await client.query(
        "BEGIN"
      );

      /* ── Lock order ── */

      debugStage =
        "load and lock order";

      const {
        rows: [order],
      } = await client.query(
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

         LEFT JOIN public.order_groups og
           ON og.id = o.order_group_id

         LEFT JOIN public.user_addresses a
           ON a.id = og.address_id

         WHERE o.id = $1
           AND o.seller_id = $2

         FOR UPDATE OF o`,
        [
          orderId,
          sellerId,
        ]
      );

      if (!order) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      /* ── Status validation ── */

      if (
        ![
          "confirmed",
          "processing",
        ].includes(order.status)
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          success: false,

          message:
            `Order must be "confirmed" or "processing" ` +
            `to mark as ready ` +
            `(current: "${order.status}")`,
        });
      }

      /* ── Pickup ready timestamp ── */

      debugStage =
        "set pickup_ready_at";

      await client.query(
        `UPDATE public.orders

         SET
           pickup_ready_at = NOW(),
           seller_note = $1,
           updated_at = NOW()

         WHERE id = $2`,
        [
          note,
          orderId,
        ]
      );

      /* ── Dispatch information ── */

      const dispatchCode =
        `LX-${
          orderId
            .replace(/-/g, "")
            .slice(0, 8)
            .toUpperCase()
        }`;

      const deliveryAddress = [
        order.address_line,
        order.bus_stop ||
          order.landmark,
        order.city,
        order.state,
      ]
        .filter(Boolean)
        .join(", ");

      /* ── Create/update dispatch ── */

      debugStage =
        "upsert dispatch";

      await client.query(
        `INSERT INTO public.order_dispatches
         (
           order_id,
           order_group_id,
           dispatch_code,
           status,
           delivery_address,
           pickup_scheduled_at
         )

         VALUES
         (
           $1,
           $2,
           $3,
           'pending',
           $4,
           NOW()
         )

         ON CONFLICT (order_id)
         DO UPDATE SET
           pickup_scheduled_at = NOW(),
           updated_at = NOW()`,
        [
          orderId,
          order.order_group_id,
          dispatchCode,
          deliveryAddress,
        ]
      );

      /* ── COMMIT ── */

      debugStage =
        "commit transaction";

      await client.query(
        "COMMIT"
      );

      console.log(
        `[seller/orders] ✅ ${
          order.tracking_id ?? orderId
        } ready for pickup`
      );

      return res.json({
        success: true,

        message:
          "Marked as ready. Loemart Express has been notified for pickup.",

        data: {
          orderId,

          trackingId:
            order.tracking_id,

          dispatchCode,

          readyAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (rollbackError) {
        console.error(
          "[seller/orders] rollback failed:",
          rollbackError.message
        );
      }

      if (isBadIdError(error)) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      console.error(
        "[seller/orders] POST /:orderId/ready FAILED",
        JSON.stringify(
          {
            orderId,
            sellerId,
            stage: debugStage,
            message:
              error?.message,
            code:
              error?.code ?? null,
            detail:
              error?.detail ?? null,
            hint:
              error?.hint ?? null,
            constraint:
              error?.constraint ?? null,
            table:
              error?.table ?? null,
            column:
              error?.column ?? null,
          },
          null,
          2
        )
      );

      if (
        ORDER_STATUS_DEBUG
      ) {
        return res.status(500).json({
          success: false,

          message:
            `Failed to mark order as ready at ` +
            `stage "${debugStage}": ` +
            `${error?.message ?? "Unknown database error"}`,

          debug: {
            stage: debugStage,
            code:
              error?.code ?? null,
            detail:
              error?.detail ?? null,
            hint:
              error?.hint ?? null,
            constraint:
              error?.constraint ?? null,
            table:
              error?.table ?? null,
            column:
              error?.column ?? null,
          },
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to mark order as ready",
      });
    } finally {
      client.release();
    }
  }
);

export default router;