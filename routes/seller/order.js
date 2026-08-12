/**
 * routes/seller/order.js
 *
 * v2 — Added JWT authentication middleware
 * ─────────────────────────────────────────────────────────────
 * ✓ Auth middleware validates sellerToken JWT (market.users)
 * ✓ Uses same JWT_SECRET as sellerAuth.routes.js
 * ✓ Populates req.user before route handlers
 */

import express from "express";
import jwt     from "jsonwebtoken";
import { pool } from "../../config/db.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

/* ════════════════════════════════════════════════════════════
   AUTH MIDDLEWARE — validates sellerToken JWT
   ✅ Same secret as sellerAuth.routes.js /login
════════════════════════════════════════════════════════════ */
async function authenticateSeller(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      code:    "NO_TOKEN",
    });
  }

  try {
    const token   = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    /* Verify user still exists + is active */
    const { rows } = await pool.query(
      `SELECT id, name, email, status
       FROM market.users
       WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
        code:    "USER_NOT_FOUND",
      });
    }

    if (rows[0].status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account has been suspended",
        code:    "ACCOUNT_SUSPENDED",
      });
    }

    /* ✅ Populate req.user for route handlers */
    req.user = {
      id    : rows[0].id,
      name  : rows[0].name,
      email : rows[0].email,
    };

    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
        code:    err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      });
    }

    console.error("[seller/orders auth]", err.message);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
}

/* ✅ Apply auth to ALL routes in this router */
router.use(authenticateSeller);

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const VALID_TRANSITIONS = {
  pending:    ["confirmed", "cancelled"],
  confirmed:  ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped:    ["delivered"],
  delivered:  [],
  cancelled:  [],
};

const STATUS_LABELS = {
  pending:    "Pending",
  confirmed:  "Confirmed",
  processing: "Processing",
  shipped:    "Shipped",
  delivered:  "Delivered",
  cancelled:  "Cancelled",
};

/* ════════════════════════════════════════════════════════════
   HELPER — notification service (optional)
════════════════════════════════════════════════════════════ */
async function getNotifier() {
  try {
    return await import("../../services/notificationService.js");
  } catch (err) {
    console.warn("[seller/orders] notificationService unavailable:", err.message);
    return null;
  }
}

async function dispatchStatusNotifications({
  order, orderGroup, newStatus, sellerId, sellerName,
}) {
  const notifier = await getNotifier();
  if (!notifier) return;

  const { sendOrderStatusEmail, createNotification } = notifier;
  const jobs        = [];
  const trackId     = orderGroup.tracking_id ?? orderGroup.id.slice(0, 8).toUpperCase();
  const statusLabel = STATUS_LABELS[newStatus] ?? newStatus;

  let buyer = null;
  try {
    const { rows: [row] } = await pool.query(
      `SELECT id, email, name FROM market.users WHERE id = $1`,
      [orderGroup.user_id]
    );
    buyer = row;
  } catch (err) {
    console.warn("[seller/orders] Could not fetch buyer:", err.message);
  }

  if (buyer?.email && sendOrderStatusEmail) {
    const messages = {
      confirmed:  `Your order ${trackId} has been confirmed.`,
      processing: `Your order ${trackId} is being processed.`,
      shipped:    `Your order ${trackId} has been shipped!`,
      delivered:  `Your order ${trackId} has been delivered.`,
      cancelled:  `Your order ${trackId} has been cancelled.`,
    };
    jobs.push(
      sendOrderStatusEmail({
        to:      buyer.email,
        name:    buyer.name,
        orderId: trackId,
        status:  statusLabel,
        message: messages[newStatus],
      }).catch((err) => console.warn("[seller/orders] buyer email failed:", err.message))
    );
  }

  if (buyer && createNotification) {
    jobs.push(
      createNotification({
        userId:  buyer.id,
        type:    "order_status_update",
        title:   `Order ${statusLabel}`,
        message: `Your order ${trackId} is ${statusLabel.toLowerCase()}`,
        link:    `/shop/orders/${orderGroup.id}`,
        meta:    { orderGroupId: orderGroup.id, orderId: order.id, trackingId: trackId, newStatus },
      }).catch((err) => console.warn("[seller/orders] buyer notif failed:", err.message))
    );
  }

  await Promise.allSettled(jobs);
}

/* ════════════════════════════════════════════════════════════
   GET /api/seller/orders/stats
════════════════════════════════════════════════════════════ */
router.get("/stats", async (req, res) => {
  const sellerId = req.user.id;

  try {
    const { rows: [stats] } = await pool.query(
      `SELECT
         COUNT(*)                                          AS total_orders,
         COUNT(*) FILTER (WHERE status = 'pending')       AS pending,
         COUNT(*) FILTER (WHERE status = 'confirmed')     AS confirmed,
         COUNT(*) FILTER (WHERE status = 'processing')    AS processing,
         COUNT(*) FILTER (WHERE status = 'shipped')       AS shipped,
         COUNT(*) FILTER (WHERE status = 'delivered')     AS delivered,
         COUNT(*) FILTER (WHERE status = 'cancelled')     AS cancelled,
         COALESCE(SUM(subtotal), 0)                       AS total_revenue,
         COALESCE(
           SUM(subtotal) FILTER (WHERE status = 'delivered'), 0
         )                                                AS confirmed_revenue
       FROM public.orders
       WHERE seller_id = $1`,
      [sellerId]
    );

    res.json({
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
    console.error("[GET /api/seller/orders/stats]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
      debug:   { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller/orders
════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  const sellerId = req.user.id;

  try {
    const status = req.query.status ?? null;
    const search = req.query.search?.trim() ?? null;
    const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const conditions = ["o.seller_id = $1"];
    const params     = [sellerId];
    let   pIdx       = 2;

    if (status && Object.keys(VALID_TRANSITIONS).includes(status)) {
      conditions.push(`o.status = $${pIdx++}`);
      params.push(status);
    }

    if (search) {
      conditions.push(`og.tracking_id ILIKE $${pIdx++}`);
      params.push(`%${search}%`);
    }

    const whereClause = conditions.join(" AND ");

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM public.orders o
       LEFT JOIN public.order_groups og ON og.id = o.order_group_id
       WHERE ${whereClause}`,
      params
    );

    const totalItems = Number(count);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    const { rows: orders } = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.subtotal,
         o.created_at,
         o.updated_at,

         og.id              AS order_group_id,
         og.tracking_id,
         og.grand_total,
         og.payment_method,
         og.payment_status,

         a.city,
         a.state,

         u.name             AS buyer_name,
         u.email            AS buyer_email,

         (SELECT COUNT(*)::int
          FROM public.order_items oi
          WHERE oi.order_id = o.id) AS item_count

       FROM public.orders o
       LEFT JOIN public.order_groups   og ON og.id = o.order_group_id
       LEFT JOIN public.user_addresses a  ON a.id  = og.address_id
       LEFT JOIN market.users          u  ON u.id  = og.user_id
       WHERE ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page, limit, totalItems, totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        filters: { status, search },
      },
    });
  } catch (err) {
    console.error("[GET /api/seller/orders]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      debug:   { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller/orders/:orderId
════════════════════════════════════════════════════════════ */
router.get("/:orderId", async (req, res) => {
  const sellerId = req.user.id;
  const { orderId } = req.params;

  try {
    const { rows: [order] } = await pool.query(
      `SELECT
         o.*,
         og.id              AS order_group_id,
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

         u.name             AS buyer_name,
         u.email            AS buyer_email
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
         COALESCE(oi.quantity, oi.qty, 0)          AS quantity,
         COALESCE(oi.price, oi.unit_price, 0)      AS price,
         COALESCE(oi.image, oi.image_url)          AS image,
         p.name                                    AS product_name,
         (COALESCE(oi.quantity, oi.qty, 0) *
          COALESCE(oi.price, oi.unit_price, 0))    AS line_total
       FROM public.order_items oi
       LEFT JOIN market.products p ON p.id = oi.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [orderId]
    );

    res.json({
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
    console.error("[GET /api/seller/orders/:orderId]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      debug:   { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/seller/orders/:orderId/status
════════════════════════════════════════════════════════════ */
router.patch("/:orderId/status", async (req, res) => {
  const sellerId        = req.user.id;
  const { orderId }     = req.params;
  const { status: newStatus } = req.body;

  if (!newStatus) {
    return res.status(422).json({
      success: false,
      message: "New status is required",
    });
  }

  if (!Object.keys(VALID_TRANSITIONS).includes(newStatus)) {
    return res.status(422).json({
      success: false,
      message: `Invalid status: "${newStatus}"`,
      data:    { validStatuses: Object.keys(VALID_TRANSITIONS) },
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [order] } = await client.query(
      `SELECT id, status, seller_id, subtotal, order_group_id
       FROM public.orders
       WHERE id = $1 AND seller_id = $2
       FOR UPDATE`,
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
        data:    {
          currentStatus,
          requestedStatus: newStatus,
          allowedNext:     allowed,
        },
      });
    }

    const { rows: [updated] } = await client.query(
      `UPDATE public.orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, status, subtotal, order_group_id, updated_at`,
      [newStatus, orderId]
    );

    /* If delivered and all sub-orders delivered → update group */
    if (newStatus === "delivered") {
      const { rows: [{ all_delivered }] } = await client.query(
        `SELECT BOOL_AND(status = 'delivered') AS all_delivered
         FROM public.orders WHERE order_group_id = $1`,
        [order.order_group_id]
      );

      if (all_delivered) {
        await client.query(
          `UPDATE public.order_groups
           SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [order.order_group_id]
        );
      }
    }

    const { rows: [group] } = await client.query(
      `SELECT id, user_id, tracking_id
       FROM public.order_groups WHERE id = $1`,
      [order.order_group_id]
    );

    await client.query("COMMIT");

    console.log(
      `[seller/orders] ✅ ${orderId}: ${currentStatus} → ${newStatus}`
    );

    /* Fire notifications async */
    dispatchStatusNotifications({
      order:      updated,
      orderGroup: group,
      newStatus,
      sellerId,
      sellerName: req.user.name ?? "Seller",
    }).catch((err) =>
      console.warn("[seller/orders] Notification dispatch failed:", err.message)
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
    console.error("[PATCH /api/seller/orders/:orderId/status]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
      debug:   { message: err.message, code: err.code },
    });
  } finally {
    client.release();
  }
});

export default router;