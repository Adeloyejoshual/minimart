/**
 * routes/seller/order.js
 *
 * Seller Order Management API
 * ─────────────────────────────────────────────────────────────
 * GET    /api/seller/orders                    — list seller's orders (with filters)
 * GET    /api/seller/orders/stats              — dashboard stats
 * GET    /api/seller/orders/:orderId           — single order detail
 * PATCH  /api/seller/orders/:orderId/status    — update order status
 * GET    /api/seller/orders/:orderId/items     — order items only
 * POST   /api/seller/orders/:orderId/notes     — add seller note
 *
 * ✓ Seller sees ONLY their own orders
 * ✓ Status transition validation (no skipping stages)
 * ✓ Buyer + seller notifications on status change
 * ✓ Full debug logging for Render tracking
 * ✓ Non-blocking notification dispatch
 * ✓ Pagination + filtering support
 */

import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   AUTH GUARD — must be a seller
════════════════════════════════════════════════════════════ */
router.use((req, res, next) => {
  if (!req.user?.id) {
    console.error("[seller/orders] ❌ req.user missing");
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      debug: { reason: "req.user is undefined — check auth middleware order" },
    });
  }

  // Optional: enforce seller role if your user table has a role column
  // if (req.user.role !== "seller") {
  //   return res.status(403).json({ success: false, message: "Seller access only" });
  // }

  next();
});

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */

/**
 * Valid status transitions for seller orders.
 * Sellers can move forward but NOT skip stages.
 * 'cancelled' is always allowed from any stage.
 */
const VALID_TRANSITIONS = {
  pending:    ["confirmed", "cancelled"],
  confirmed:  ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped:    ["delivered"],
  delivered:  [],            // terminal — no further changes
  cancelled:  [],            // terminal — no further changes
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
   HELPER — safely load notification service
════════════════════════════════════════════════════════════ */
async function getNotifier() {
  try {
    return await import("../../services/notificationService.js");
  } catch (err) {
    console.warn("[seller/orders] notificationService unavailable:", err.message);
    return null;
  }
}

/* ════════════════════════════════════════════════════════════
   HELPER — dispatch status-change notifications (non-blocking)
════════════════════════════════════════════════════════════ */
async function dispatchStatusNotifications({
  order,
  orderGroup,
  newStatus,
  sellerId,
  sellerName,
}) {
  const notifier = await getNotifier();
  if (!notifier) {
    console.warn("[seller/orders] Skipping notifications — service unavailable");
    return;
  }

  const {
    sendOrderStatusEmail,
    createNotification,
  } = notifier;

  const jobs       = [];
  const trackId    = orderGroup.tracking_id
    ?? orderGroup.id.slice(0, 8).toUpperCase();
  const statusLabel = STATUS_LABELS[newStatus] ?? newStatus;

  /* ── Fetch buyer info ── */
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

  /* ── BUYER email ── */
  if (buyer?.email && sendOrderStatusEmail) {
    const statusMessages = {
      confirmed:  `Great news! Your order ${trackId} has been confirmed and is being prepared.`,
      processing: `Your order ${trackId} is now being processed and packed.`,
      shipped:    `Your order ${trackId} has been shipped! It's on its way to you.`,
      delivered:  `Your order ${trackId} has been delivered. Enjoy your purchase!`,
      cancelled:  `Your order ${trackId} has been cancelled. Contact support if you have questions.`,
    };

    jobs.push(
      sendOrderStatusEmail({
        to:      buyer.email,
        name:    buyer.name,
        orderId: trackId,
        status:  statusLabel,
        message: statusMessages[newStatus] ?? `Your order status changed to ${statusLabel}.`,
      }).catch((err) =>
        console.warn("[seller/orders] buyer status email failed:", err.message)
      )
    );
  }

  /* ── BUYER in-app notification ── */
  if (buyer && createNotification) {
    const notifMessages = {
      confirmed:  `Your order ${trackId} is confirmed ✅`,
      processing: `Your order ${trackId} is being packed 📦`,
      shipped:    `Your order ${trackId} is on the way 🚚`,
      delivered:  `Your order ${trackId} has been delivered 🎉`,
      cancelled:  `Your order ${trackId} was cancelled ❌`,
    };

    jobs.push(
      createNotification({
        userId:  buyer.id,
        type:    "order_status_update",
        title:   `Order ${statusLabel}`,
        message: notifMessages[newStatus] ?? `Order ${trackId} updated to ${statusLabel}`,
        link:    `/shop/orders/${orderGroup.id}`,
        meta: {
          orderGroupId: orderGroup.id,
          orderId:      order.id,
          trackingId:   trackId,
          newStatus,
        },
      }).catch((err) =>
        console.warn("[seller/orders] buyer notif failed:", err.message)
      )
    );
  }

  /* ── SELLER in-app confirmation ── */
  if (createNotification) {
    jobs.push(
      createNotification({
        userId:  sellerId,
        type:    "order_updated",
        title:   `Order ${statusLabel}`,
        message: `You updated order ${trackId} to ${statusLabel}`,
        link:    `/seller-dashboard/orders/${order.id}`,
        meta: {
          orderGroupId: orderGroup.id,
          orderId:      order.id,
          trackingId:   trackId,
          newStatus,
        },
      }).catch((err) =>
        console.warn("[seller/orders] seller notif failed:", err.message)
      )
    );
  }

  const results   = await Promise.allSettled(jobs);
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed    = results.filter((r) => r.status === "rejected").length;

  console.log(
    `[seller/orders] ✅ Status notifications — ${succeeded} ok, ${failed} failed`
  );
}

/* ════════════════════════════════════════════════════════════
   GET /api/seller/orders/stats
   Must be declared BEFORE /:orderId to avoid route conflict
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
         )                                                AS confirmed_revenue,
         COUNT(*) FILTER (
           WHERE created_at >= NOW() - INTERVAL '7 days'
         )                                                AS orders_this_week,
         COUNT(*) FILTER (
           WHERE created_at >= NOW() - INTERVAL '30 days'
         )                                                AS orders_this_month
       FROM public.orders
       WHERE seller_id = $1`,
      [sellerId]
    );

    /* Recent activity — last 5 orders */
    const { rows: recent } = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.subtotal,
         o.created_at,
         og.tracking_id,
         og.payment_method,
         og.payment_status,
         a.city,
         a.state
       FROM public.orders o
       JOIN public.order_groups og ON og.id = o.order_group_id
       LEFT JOIN public.user_addresses a ON a.id = og.address_id
       WHERE o.seller_id = $1
       ORDER BY o.created_at DESC
       LIMIT 5`,
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
        activity: {
          thisWeek:  Number(stats.orders_this_week),
          thisMonth: Number(stats.orders_this_month),
        },
        recentOrders: recent,
      },
    });
  } catch (err) {
    console.error("[GET /api/seller/orders/stats]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
      debug: { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller/orders
   Query params:
     status   — filter by status (pending|confirmed|processing|shipped|delivered|cancelled)
     page     — page number (default: 1)
     limit    — items per page (default: 20, max: 100)
     search   — search by tracking_id
     from     — date range start (ISO string)
     to       — date range end   (ISO string)
     sort     — created_at|subtotal (default: created_at)
     dir      — asc|desc (default: desc)
════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  const sellerId = req.user.id;

  try {
    /* ── Parse + sanitize query params ── */
    const status = req.query.status ?? null;
    const search = req.query.search?.trim() ?? null;
    const from   = req.query.from   ?? null;
    const to     = req.query.to     ?? null;

    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const allowedSort = ["created_at", "subtotal"];
    const sort = allowedSort.includes(req.query.sort) ? req.query.sort : "created_at";
    const dir  = req.query.dir === "asc" ? "ASC" : "DESC";

    /* ── Build dynamic WHERE clauses ── */
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

    if (from) {
      conditions.push(`o.created_at >= $${pIdx++}`);
      params.push(new Date(from));
    }

    if (to) {
      conditions.push(`o.created_at <= $${pIdx++}`);
      params.push(new Date(to));
    }

    const whereClause = conditions.join(" AND ");

    /* ── Count query for pagination ── */
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM public.orders o
       JOIN public.order_groups og ON og.id = o.order_group_id
       WHERE ${whereClause}`,
      params
    );

    const totalItems = Number(count);
    const totalPages = Math.ceil(totalItems / limit);

    /* ── Main query ── */
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
         og.delivery_fee,
         og.discount,

         a.recipient_name,
         a.phone,
         a.city,
         a.state,
         a.address_line,

         u.name             AS buyer_name,
         u.email            AS buyer_email,

         (
           SELECT COUNT(*)::int
           FROM public.order_items oi
           WHERE oi.order_id = o.id
         )                  AS item_count,

         (
           SELECT json_agg(
             json_build_object(
               'id',           oi.id,
               'product_id',   oi.product_id,
               'product_name', COALESCE(p.name, ''),
               'quantity',     COALESCE(oi.quantity, oi.qty, 0),
               'price',        COALESCE(oi.price, oi.unit_price, 0),
               'variant_name', oi.variant_name,
               'sku',          oi.sku,
               'image',        COALESCE(oi.image, oi.image_url)
             )
           )
           FROM public.order_items oi
           LEFT JOIN market.products p ON p.id = oi.product_id
           WHERE oi.order_id = o.id
         )                  AS items

       FROM public.orders o
       JOIN public.order_groups og ON og.id = o.order_group_id
       LEFT JOIN public.user_addresses a ON a.id = og.address_id
       LEFT JOIN market.users u ON u.id = og.user_id
       WHERE ${whereClause}
       ORDER BY o.${sort} ${dir}
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset]
    );

    console.log(
      `[seller/orders] Seller ${sellerId} fetched ${orders.length} orders` +
      (status ? ` (status: ${status})` : "")
    );

    res.json({
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
        filters: { status, search, from, to, sort, dir },
      },
    });
  } catch (err) {
    console.error("[GET /api/seller/orders]", err.message, err.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      debug: { message: err.message, code: err.code },
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
    /* ── Fetch order (verify seller ownership) ── */
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
         og.created_at      AS group_created_at,

         a.recipient_name,
         a.phone,
         a.address_line,
         a.landmark,
         a.additional_directions,
         a.call_before_delivery,
         a.city,
         a.state,

         u.name             AS buyer_name,
         u.email            AS buyer_email
       FROM public.orders o
       JOIN public.order_groups og ON og.id = o.order_group_id
       LEFT JOIN public.user_addresses a ON a.id = og.address_id
       LEFT JOIN market.users u ON u.id = og.user_id
       WHERE o.id = $1 AND o.seller_id = $2`,
      [orderId, sellerId]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        debug: { orderId, sellerId },
      });
    }

    /* ── Fetch order items with product details ── */
    const { rows: items } = await pool.query(
      `SELECT
         oi.id,
         oi.product_id,
         oi.variant_id,
         oi.variant_name,
         oi.sku,
         COALESCE(oi.quantity, oi.qty, 0)           AS quantity,
         COALESCE(oi.price, oi.unit_price, 0)       AS price,
         COALESCE(oi.image, oi.image_url)           AS image,
         p.name                                     AS product_name,
         p.category,
         p.status                                   AS product_status,
         (
           COALESCE(oi.quantity, oi.qty, 0) *
           COALESCE(oi.price, oi.unit_price, 0)
         )                                          AS line_total
       FROM public.order_items oi
       LEFT JOIN market.products p ON p.id = oi.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.id ASC`,
      [orderId]
    );

    /* ── Build allowed next statuses ── */
    const allowedNext = VALID_TRANSITIONS[order.status] ?? [];

    res.json({
      success: true,
      data: {
        ...order,
        items,
        meta: {
          itemCount:    items.length,
          allowedNext,
          canUpdate:    allowedNext.length > 0,
        },
      },
    });
  } catch (err) {
    console.error("[GET /api/seller/orders/:orderId]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      debug: { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/seller/orders/:orderId/status
   Body: { status: string, note?: string }
════════════════════════════════════════════════════════════ */
router.patch("/:orderId/status", async (req, res) => {
  const sellerId        = req.user.id;
  const { orderId }     = req.params;
  const { status: newStatus, note } = req.body;

  /* ── Basic validation ── */
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
      data: { validStatuses: Object.keys(VALID_TRANSITIONS) },
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Fetch current order (lock row) ── */
    const { rows: [order] } = await client.query(
      `SELECT
         o.id,
         o.status,
         o.seller_id,
         o.subtotal,
         o.order_group_id
       FROM public.orders o
       WHERE o.id = $1 AND o.seller_id = $2
       FOR UPDATE`,
      [orderId, sellerId]
    );

    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Order not found",
        debug: { orderId, sellerId },
      });
    }

    /* ── Validate transition ── */
    const currentStatus = order.status;
    const allowed       = VALID_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(newStatus)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot move order from "${currentStatus}" to "${newStatus}"`,
        data: {
          currentStatus,
          requestedStatus: newStatus,
          allowedNext:     allowed,
        },
      });
    }

    /* ── Update order status ── */
    const { rows: [updated] } = await client.query(
      `UPDATE public.orders
       SET
         status     = $1,
         updated_at = NOW()
       WHERE id = $2
       RETURNING id, status, subtotal, order_group_id, updated_at`,
      [newStatus, orderId]
    );

    /* ── If delivered: update order_group too ── */
    let orderGroup = null;
    if (newStatus === "delivered") {
      /* Check if ALL sub-orders are now delivered */
      const { rows: [{ all_delivered }] } = await client.query(
        `SELECT BOOL_AND(status = 'delivered') AS all_delivered
         FROM public.orders
         WHERE order_group_id = $1`,
        [order.order_group_id]
      );

      if (all_delivered) {
        await client.query(
          `UPDATE public.order_groups
           SET
             status       = 'delivered',
             delivered_at = NOW(),
             updated_at   = NOW()
           WHERE id = $1`,
          [order.order_group_id]
        );
        console.log(
          `[seller/orders] ✅ All sub-orders delivered — group ${order.order_group_id} marked delivered`
        );
      }
    }

    /* ── If cancelled: check if ALL sub-orders cancelled ── */
    if (newStatus === "cancelled") {
      const { rows: [{ all_cancelled }] } = await client.query(
        `SELECT BOOL_AND(status = 'cancelled') AS all_cancelled
         FROM public.orders
         WHERE order_group_id = $1`,
        [order.order_group_id]
      );

      if (all_cancelled) {
        await client.query(
          `UPDATE public.order_groups
           SET status = 'cancelled', updated_at = NOW()
           WHERE id = $1`,
          [order.order_group_id]
        );
      }
    }

    /* ── Fetch order group for notifications ── */
    const { rows: [group] } = await client.query(
      `SELECT id, user_id, tracking_id
       FROM public.order_groups
       WHERE id = $1`,
      [order.order_group_id]
    );
    orderGroup = group;

    /* ── Optional seller note ── */
    if (note?.trim()) {
      try {
        await client.query(
          `INSERT INTO public.order_notes
             (order_id, user_id, role, note)
           VALUES ($1, $2, 'seller', $3)`,
          [orderId, sellerId, note.trim()]
        );
      } catch (noteErr) {
        /* order_notes table might not exist — that's OK */
        console.warn(
          "[seller/orders] Could not save note (table may not exist):",
          noteErr.message
        );
      }
    }

    await client.query("COMMIT");

    console.log(
      `[seller/orders] ✅ Order ${orderId} updated: ${currentStatus} → ${newStatus} by seller ${sellerId}`
    );

    /* ── Fire notifications async (non-blocking) ── */
    dispatchStatusNotifications({
      order:      updated,
      orderGroup,
      newStatus,
      sellerId,
      sellerName: req.user.name ?? "Seller",
    }).catch((err) =>
      console.warn("[seller/orders] Status notification dispatch failed:", err.message)
    );

    return res.json({
      success: true,
      message: `Order status updated to "${STATUS_LABELS[newStatus]}"`,
      data: {
        orderId:       updated.id,
        previousStatus: currentStatus,
        newStatus:     updated.status,
        updatedAt:     updated.updated_at,
        allowedNext:   VALID_TRANSITIONS[newStatus] ?? [],
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("═══════════════════════════════════════");
    console.error("[PATCH /api/seller/orders/:orderId/status] FAILED");
    console.error("Order ID:   ", orderId);
    console.error("Seller ID:  ", sellerId);
    console.error("New Status: ", newStatus);
    console.error("Message:    ", err.message);
    console.error("Code:       ", err.code);
    console.error("Detail:     ", err.detail);
    console.error("═══════════════════════════════════════");

    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
      debug: {
        message:    err.message,
        code:       err.code,
        detail:     err.detail,
        constraint: err.constraint,
      },
    });
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller/orders/:orderId/items
   Lightweight — returns items only (for modals / quick views)
════════════════════════════════════════════════════════════ */
router.get("/:orderId/items", async (req, res) => {
  const sellerId    = req.user.id;
  const { orderId } = req.params;

  try {
    /* Verify seller owns this order */
    const { rows: [order] } = await pool.query(
      `SELECT id FROM public.orders
       WHERE id = $1 AND seller_id = $2`,
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
         COALESCE(oi.quantity, oi.qty, 0)       AS quantity,
         COALESCE(oi.price, oi.unit_price, 0)   AS price,
         COALESCE(oi.image, oi.image_url)       AS image,
         p.name                                 AS product_name,
         p.category,
         (
           COALESCE(oi.quantity, oi.qty, 0) *
           COALESCE(oi.price, oi.unit_price, 0)
         )                                      AS line_total
       FROM public.order_items oi
       LEFT JOIN market.products p ON p.id = oi.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [orderId]
    );

    res.json({ success: true, data: { orderId, items } });

  } catch (err) {
    console.error("[GET /api/seller/orders/:orderId/items]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order items",
      debug: { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/seller/orders/:orderId/notes
   Body: { note: string }
   Adds a seller-visible note to the order
════════════════════════════════════════════════════════════ */
router.post("/:orderId/notes", async (req, res) => {
  const sellerId    = req.user.id;
  const { orderId } = req.params;
  const { note }    = req.body;

  if (!note?.trim()) {
    return res.status(422).json({
      success: false,
      message: "Note content is required",
    });
  }

  if (note.trim().length > 1000) {
    return res.status(422).json({
      success: false,
      message: "Note cannot exceed 1000 characters",
    });
  }

  try {
    /* Verify seller owns this order */
    const { rows: [order] } = await pool.query(
      `SELECT id FROM public.orders
       WHERE id = $1 AND seller_id = $2`,
      [orderId, sellerId]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const { rows: [savedNote] } = await pool.query(
      `INSERT INTO public.order_notes
         (order_id, user_id, role, note)
       VALUES ($1, $2, 'seller', $3)
       RETURNING id, note, created_at`,
      [orderId, sellerId, note.trim()]
    );

    res.status(201).json({
      success: true,
      message: "Note added",
      data:    savedNote,
    });

  } catch (err) {
    /* order_notes might not exist */
    if (err.code === "42P01") {
      return res.status(501).json({
        success: false,
        message: "Notes feature is not yet set up (table missing)",
        debug: { hint: "Create public.order_notes table to enable this feature" },
      });
    }

    console.error("[POST /api/seller/orders/:orderId/notes]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to save note",
      debug: { message: err.message, code: err.code },
    });
  }
});

export default router;