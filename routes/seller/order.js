/**
 * routes/seller/order.js
 *
 * Seller-scoped order management routes.
 * Mounted at: /api/seller/orders  (in server.js)
 *
 * Routes:
 *   GET   /api/seller/orders/stats
 *   GET   /api/seller/orders
 *   GET   /api/seller/orders/:orderId
 *   PATCH /api/seller/orders/:orderId/status
 *
 * v3 — Hardened
 * ──────────────────────────────────────────────────────────────
 * ✓ Removed duplicated authenticateSeller — imported from middleware
 * ✓ JWT_SECRET missing → hard crash at startup (fail-fast)
 * ✓ debug fields removed from error responses (no internal leakage)
 * ✓ notificationService resolved once at module load
 * ✓ VALID_TRANSITIONS keys in a Set for O(1) lookup
 * ✓ Buyer data fetched inside PATCH transaction (no extra round-trip)
 * ✓ safeInt() used consistently for pagination
 * ✓ Stats revenue excludes cancelled orders
 * ✓ totalPages always explicit (no || 1 mask)
 */

import express                from "express";
import { pool }               from "../../config/db.js";
import { authenticateSeller } from "../../middleware/sellerAuth.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   STARTUP GUARD
   Crash immediately at boot if JWT_SECRET is missing.
   A silent fallback to "supersecretkey" in production is a
   critical security vulnerability.
══════════════════════════════════════════════════════════════ */
if (!process.env.JWT_SECRET) {
  throw new Error(
    "[seller/orders] FATAL: JWT_SECRET environment variable is not set. " +
    "Server cannot start safely."
  );
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION SERVICE
   Resolved once at module load — not on every request.
   If unavailable (e.g. during tests), notifier stays null
   and all notification calls are safely skipped.
══════════════════════════════════════════════════════════════ */
let notifier = null;

(async () => {
  try {
    notifier = await import("../../services/notificationService.js");
    console.log("[seller/orders] ✓ notificationService loaded");
  } catch (err) {
    console.warn(
      "[seller/orders] notificationService unavailable — " +
      "order notifications disabled:",
      err.message
    );
  }
})();

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const VALID_TRANSITIONS = {
  pending:    ["confirmed", "cancelled"],
  confirmed:  ["processing", "cancelled"],
  processing: ["shipped",   "cancelled"],
  shipped:    ["delivered"],
  delivered:  [],
  cancelled:  [],
};

/*
 * Set for O(1) membership checks on incoming status values.
 * Array.includes() on Object.keys() is O(n) — fine at 6 items
 * but semantically wrong; a Set communicates intent clearly.
 */
const VALID_STATUS_SET = new Set(Object.keys(VALID_TRANSITIONS));

const STATUS_LABELS = {
  pending:    "Pending",
  confirmed:  "Confirmed",
  processing: "Processing",
  shipped:    "Shipped",
  delivered:  "Delivered",
  cancelled:  "Cancelled",
};

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX     = 100;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

/**
 * Safe integer parser for query params.
 * Returns defaultVal if value is missing, non-numeric, or NaN.
 */
function safeInt(value, defaultVal, min = 1, max = Infinity) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return defaultVal;
  return Math.min(max, Math.max(min, n));
}

/**
 * Dispatch order status notifications to buyer.
 * All notification calls are fire-and-forget (non-fatal).
 *
 * buyer is passed in directly — no extra DB round-trip.
 */
async function dispatchStatusNotifications({
  order,
  orderGroup,
  buyer,
  newStatus,
}) {
  if (!notifier) return;

  const { sendOrderStatusEmail, createNotification } = notifier;

  const trackId = orderGroup.tracking_id
    ?? orderGroup.id.slice(0, 8).toUpperCase();

  const statusLabel = STATUS_LABELS[newStatus] ?? newStatus;

  const statusMessages = {
    confirmed:  `Your order ${trackId} has been confirmed.`,
    processing: `Your order ${trackId} is being processed.`,
    shipped:    `Your order ${trackId} has been shipped!`,
    delivered:  `Your order ${trackId} has been delivered.`,
    cancelled:  `Your order ${trackId} has been cancelled.`,
  };

  const jobs = [];

  if (buyer?.email && sendOrderStatusEmail) {
    jobs.push(
      sendOrderStatusEmail({
        to:      buyer.email,
        name:    buyer.name,
        orderId: trackId,
        status:  statusLabel,
        message: statusMessages[newStatus],
      }).catch((err) =>
        console.warn("[seller/orders] Buyer email failed:", err.message)
      )
    );
  }

  if (buyer?.id && createNotification) {
    jobs.push(
      createNotification({
        userId:  buyer.id,
        type:    "order_status_update",
        title:   `Order ${statusLabel}`,
        message: `Your order ${trackId} is ${statusLabel.toLowerCase()}`,
        link:    `/shop/orders/${orderGroup.id}`,
        meta: {
          orderGroupId: orderGroup.id,
          orderId:      order.id,
          trackingId:   trackId,
          newStatus,
        },
      }).catch((err) =>
        console.warn("[seller/orders] Buyer notification failed:", err.message)
      )
    );
  }

  await Promise.allSettled(jobs);
}

/* ══════════════════════════════════════════════════════════════
   AUTH — applied to all routes in this router
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
         COUNT(*)                                              AS total_orders,
         COUNT(*) FILTER (WHERE status = 'pending')           AS pending,
         COUNT(*) FILTER (WHERE status = 'confirmed')         AS confirmed,
         COUNT(*) FILTER (WHERE status = 'processing')        AS processing,
         COUNT(*) FILTER (WHERE status = 'shipped')           AS shipped,
         COUNT(*) FILTER (WHERE status = 'delivered')         AS delivered,
         COUNT(*) FILTER (WHERE status = 'cancelled')         AS cancelled,

         /*
          * Total revenue: all non-cancelled orders (includes in-progress).
          * Confirmed revenue: delivered orders only.
          */
         COALESCE(
           SUM(subtotal) FILTER (WHERE status != 'cancelled'), 0
         )                                                    AS total_revenue,
         COALESCE(
           SUM(subtotal) FILTER (WHERE status = 'delivered'), 0
         )                                                    AS confirmed_revenue

       FROM public.orders
       WHERE seller_id = $1`,
      [sellerId]
    );

    return res.json({
      success: true,
      data: {
        counts: {
          total:      Number(stats.total_orders),
          pending:    Number(stats.pending),
          confirmed:  Number(stats.confirmed),
          processing: Number(stats.processing),
          shipped:    Number(stats.shipped),
          delivered:  Number(stats.delivered),
          cancelled:  Number(stats.cancelled),
        },
        revenue: {
          total:     Number(stats.total_revenue),
          confirmed: Number(stats.confirmed_revenue),
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
══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  const sellerId = req.user.id;

  try {
    const page   = safeInt(req.query.page,  1,                  1);
    const limit  = safeInt(req.query.limit, PAGE_SIZE_DEFAULT,  1, PAGE_SIZE_MAX);
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
      conditions.push(`og.tracking_id ILIKE $${pIdx++}`);
      params.push(`%${search}%`);
    }

    const where = conditions.join(" AND ");

    /* Count */
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM public.orders o
       LEFT JOIN public.order_groups og ON og.id = o.order_group_id
       WHERE ${where}`,
      params
    );

    const totalItems = Number(count);
    const totalPages = totalItems === 0
      ? 1
      : Math.ceil(totalItems / limit);

    /* Page data */
    const { rows: orders } = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.subtotal,
         o.created_at,
         o.updated_at,

         og.id             AS order_group_id,
         og.tracking_id,
         og.grand_total,
         og.payment_method,
         og.payment_status,

         a.city,
         a.state,

         u.name            AS buyer_name,
         u.email           AS buyer_email,

         (SELECT COUNT(*)::int
          FROM public.order_items oi
          WHERE oi.order_id = o.id)  AS item_count

       FROM public.orders o
       LEFT JOIN public.order_groups   og ON og.id = o.order_group_id
       LEFT JOIN public.user_addresses a  ON a.id  = og.address_id
       LEFT JOIN market.users          u  ON u.id  = og.user_id
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
══════════════════════════════════════════════════════════════ */
router.get("/:orderId", async (req, res) => {
  const sellerId        = req.user.id;
  const { orderId }     = req.params;

  try {
    const { rows: [order] } = await pool.query(
      `SELECT
         o.*,

         og.id             AS order_group_id,
         og.tracking_id,
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
         a.landmark,
         a.city,
         a.state,

         u.name            AS buyer_name,
         u.email           AS buyer_email

       FROM public.orders o
       LEFT JOIN public.order_groups   og ON og.id = o.order_group_id
       LEFT JOIN public.user_addresses a  ON a.id  = og.address_id
       LEFT JOIN market.users          u  ON u.id  = og.user_id
       WHERE o.id = $1 AND o.seller_id = $2`,
      [orderId, sellerId]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const { rows: items } = await pool.query(
      `SELECT
         oi.id,
         oi.product_id,
         oi.variant_id,
         oi.variant_name,
         oi.sku,
         COALESCE(oi.quantity, oi.qty,        0) AS quantity,
         COALESCE(oi.price,    oi.unit_price,  0) AS price,
         COALESCE(oi.image,    oi.image_url     ) AS image,
         p.name                                   AS product_name,
         (COALESCE(oi.quantity, oi.qty,       0) *
          COALESCE(oi.price,    oi.unit_price, 0)) AS line_total
       FROM public.order_items oi
       LEFT JOIN market.products p ON p.id = oi.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [orderId]
    );

    return res.json({
      success: true,
      data: {
        ...order,
        items,
        meta: {
          itemCount:   items.length,
          allowedNext: VALID_TRANSITIONS[order.status] ?? [],
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
══════════════════════════════════════════════════════════════ */
router.patch("/:orderId/status", async (req, res) => {
  const sellerId            = req.user.id;
  const { orderId }         = req.params;
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
      data:    { validStatuses: [...VALID_STATUS_SET] },
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /*
     * Lock the order row for the duration of the transaction
     * to prevent concurrent status updates racing each other.
     *
     * Also fetch buyer info here to avoid a second round-trip
     * after commit for notifications.
     */
    const { rows: [order] } = await client.query(
      `SELECT
         o.id,
         o.status,
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
    const allowed       = VALID_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(newStatus)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot move from "${currentStatus}" to "${newStatus}"`,
        data: {
          currentStatus,
          requestedStatus: newStatus,
          allowedNext:     allowed,
        },
      });
    }

    /* ── Apply status update ── */
    const { rows: [updated] } = await client.query(
      `UPDATE public.orders
       SET status     = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, status, subtotal, order_group_id, updated_at`,
      [newStatus, orderId]
    );

    /*
     * If all sub-orders in the group are now delivered,
     * mark the parent order_group as delivered too.
     */
    if (newStatus === "delivered") {
      const { rows: [{ all_delivered }] } = await client.query(
        `SELECT BOOL_AND(status = 'delivered') AS all_delivered
         FROM public.orders
         WHERE order_group_id = $1`,
        [order.order_group_id]
      );

      if (all_delivered) {
        await client.query(
          `UPDATE public.order_groups
           SET status       = 'delivered',
               delivered_at = NOW(),
               updated_at   = NOW()
           WHERE id = $1`,
          [order.order_group_id]
        );
      }
    }

    /* Fetch order group for notification metadata */
    const { rows: [group] } = await client.query(
      `SELECT id, user_id, tracking_id
       FROM public.order_groups
       WHERE id = $1`,
      [order.order_group_id]
    );

    await client.query("COMMIT");

    console.log(
      `[seller/orders] ✅ ${orderId}: ${currentStatus} → ${newStatus} ` +
      `| seller=${sellerId}`
    );

    /*
     * Notifications are fire-and-forget — never block the response.
     * Buyer data is already available from the query above.
     */
    dispatchStatusNotifications({
      order:      updated,
      orderGroup: group,
      buyer: {
        id:    order.buyer_id,
        name:  order.buyer_name,
        email: order.buyer_email,
      },
      newStatus,
    }).catch((err) =>
      console.warn(
        "[seller/orders] Notification dispatch failed:", err.message
      )
    );

    return res.json({
      success: true,
      message: `Order status updated to "${STATUS_LABELS[newStatus]}"`,
      data: {
        orderId:        updated.id,
        previousStatus: currentStatus,
        newStatus:      updated.status,
        updatedAt:      updated.updated_at,
        allowedNext:    VALID_TRANSITIONS[newStatus] ?? [],
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

export default router;