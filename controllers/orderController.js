// server/controllers/orderController.js
// ADD these to your existing file

import { pool }          from "../server.js";
import { releaseToAvailable } from "../services/walletService.js";
import { createEntry }   from "../services/ledgerService.js";

// ═══════════════════════════════════════════════════════════════
// GET /api/orders
// Buyer gets their own order list
// Query: ?page=1&limit=10&status=pending
// ═══════════════════════════════════════════════════════════════
export const getUserOrders = async (req, res) => {
  const userId = req.user.id;
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 10);
  const offset = (page - 1) * limit;
  const status = req.query.status || null;

  try {
    // ── Build filter ───────────────────────────────────────
    const conditions = ["o.user_id = $1"];
    const values     = [userId];
    let   idx        = 2;

    if (status) {
      conditions.push(`o.order_status = $${idx++}`);
      values.push(status);
    }

    const WHERE = `WHERE ${conditions.join(" AND ")}`;

    // ── Count ──────────────────────────────────────────────
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total FROM orders o ${WHERE}`,
      values
    );
    const total = parseInt(countRows[0].total);

    // ── Orders ─────────────────────────────────────────────
    const { rows: orders } = await pool.query(
      `SELECT
         o.id,
         o.reference,
         o.payment_method,
         o.payment_status,
         o.order_status,
         o.subtotal,
         o.delivery_fee,
         o.grand_total,
         o.created_at,
         o.paid_at,
         COUNT(oi.id) AS item_count
       FROM   orders      o
       LEFT   JOIN order_items oi ON oi.order_id = o.id
       ${WHERE}
       GROUP  BY o.id
       ORDER  BY o.created_at DESC
       LIMIT  $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext:    page * limit < total,
          hasPrev:    page > 1,
        },
      },
    });

  } catch (err) {
    console.error("getUserOrders error:", err);
    return res.status(500).json({
      success: false,
      message: "Could not fetch orders",
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// PATCH /api/orders/:orderId/cancel
// Buyer cancels their own order
// Only allowed when order_status = "pending"
// ═══════════════════════════════════════════════════════════════
export const cancelOrder = async (req, res) => {
  const { orderId } = req.params;
  const userId      = req.user.id;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Fetch order ────────────────────────────────────────
    const { rows } = await client.query(
      `SELECT * FROM orders
       WHERE  id      = $1
       AND    user_id = $2`,
      [orderId, userId]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const order = rows[0];

    // ── Only cancel if still pending ───────────────────────
    if (order.order_status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an order with status "${order.order_status}". Only pending orders can be cancelled.`,
      });
    }

    // ── Update order status ────────────────────────────────
    await client.query(
      `UPDATE orders
       SET    order_status = 'cancelled',
              updated_at   = NOW()
       WHERE  id = $1`,
      [orderId]
    );

    // ── Restore stock ──────────────────────────────────────
    const { rows: items } = await client.query(
      `SELECT product_id, quantity
       FROM   order_items
       WHERE  order_id = $1`,
      [orderId]
    );

    for (const item of items) {
      await client.query(
        `UPDATE products
         SET    stock_quantity = stock_quantity + $1,
                updated_at     = NOW()
         WHERE  id = $2`,
        [item.quantity, item.product_id]
      );
    }

    // ── Reverse vendor pending balance if already credited ─
    if (order.payment_status === "confirmed") {
      const { rows: vendorItems } = await client.query(
        `SELECT vendor_id, total_price
         FROM   order_items
         WHERE  order_id = $1`,
        [orderId]
      );

      for (const item of vendorItems) {
        await client.query(
          `UPDATE vendor_wallets
           SET    pending_balance = pending_balance - $1,
                  total_earned    = total_earned    - $1,
                  updated_at      = NOW()
           WHERE  vendor_id = $2`,
          [item.total_price, item.vendor_id]
        );

        // Ledger reversal entry
        await createEntry({
          userId:    item.vendor_id,
          vendorId:  item.vendor_id,
          orderId,
          type:      "reversal",
          direction: "debit",
          amount:    item.total_price,
          reference: `REVERSAL_${orderId}_${item.vendor_id}`,
          narration: `Order ${orderId} cancelled — balance reversed`,
          client,
        });
      }
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data:    { orderId, status: "cancelled" },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("cancelOrder error:", err);
    return res.status(500).json({
      success: false,
      message: "Could not cancel order. Please try again.",
    });
  } finally {
    client.release();
  }
};

// ═══════════════════════════════════════════════════════════════
// PATCH /api/orders/:orderId/confirm-delivery
// Buyer confirms they received the order
// Triggers: pending_balance → available_balance for each vendor
// ═══════════════════════════════════════════════════════════════
export const confirmDelivery = async (req, res) => {
  const { orderId } = req.params;
  const userId      = req.user.id;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Fetch order ────────────────────────────────────────
    const { rows } = await client.query(
      `SELECT * FROM orders
       WHERE  id      = $1
       AND    user_id = $2`,
      [orderId, userId]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const order = rows[0];

    // ── Must be shipped/out for delivery ──────────────────
    const allowedStatuses = ["shipped", "out_for_delivery"];
    if (!allowedStatuses.includes(order.order_status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot confirm delivery for an order with status "${order.order_status}"`,
      });
    }

    // ── Already delivered ──────────────────────────────────
    if (order.order_status === "delivered") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Order already marked as delivered",
      });
    }

    // ── Update order ───────────────────────────────────────
    await client.query(
      `UPDATE orders
       SET    order_status  = 'delivered',
              delivered_at  = NOW(),
              updated_at    = NOW()
       WHERE  id = $1`,
      [orderId]
    );

    // ── Release each vendor's pending → available ──────────
    const { rows: vendorItems } = await client.query(
      `SELECT vendor_id, SUM(total_price) AS vendor_total
       FROM   order_items
       WHERE  order_id = $1
       GROUP  BY vendor_id`,
      [orderId]
    );

    for (const item of vendorItems) {
      // Move balance
      await releaseToAvailable({
        vendorId: item.vendor_id,
        amount:   Number(item.vendor_total),
        client,
      });

      // Ledger entry
      await createEntry({
        userId:    item.vendor_id,
        vendorId:  item.vendor_id,
        orderId,
        type:      "order_credit",
        direction: "credit",
        amount:    Number(item.vendor_total),
        reference: `RELEASE_${orderId}_${item.vendor_id}`,
        narration: `Balance released after delivery confirmed for order ${orderId}`,
        client,
      });
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Delivery confirmed. Thank you for your order!",
      data:    { orderId, status: "delivered" },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("confirmDelivery error:", err);
    return res.status(500).json({
      success: false,
      message: "Could not confirm delivery. Please try again.",
    });
  } finally {
    client.release();
  }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/orders/admin/all
// Admin views all orders across the platform
// Query: ?page=1&limit=20&status=pending&vendorId=xxx
// ═══════════════════════════════════════════════════════════════
export const getAllOrdersAdmin = async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page)  || 1);
  const limit    = Math.min(100, parseInt(req.query.limit) || 20);
  const offset   = (page - 1) * limit;
  const { status, vendorId, from, to } = req.query;

  // ── Dynamic filters ────────────────────────────────────────
  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (status) {
    conditions.push(`o.order_status = $${idx++}`);
    values.push(status);
  }
  if (vendorId) {
    conditions.push(`oi.vendor_id = $${idx++}`);
    values.push(vendorId);
  }
  if (from) {
    conditions.push(`o.created_at >= $${idx++}`);
    values.push(new Date(from));
  }
  if (to) {
    conditions.push(`o.created_at <= $${idx++}`);
    values.push(new Date(to));
  }

  const WHERE = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(DISTINCT o.id) AS total
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${WHERE}`,
      values
    );
    const total = parseInt(countRows[0].total);

    const { rows } = await pool.query(
      `SELECT DISTINCT
         o.id,
         o.reference,
         o.payment_method,
         o.payment_status,
         o.order_status,
         o.grand_total,
         o.created_at,
         o.paid_at,
         u.name   AS buyer_name,
         u.email  AS buyer_email
       FROM   orders      o
       LEFT   JOIN public.users  u  ON u.id  = o.user_id
       LEFT   JOIN order_items   oi ON oi.order_id = o.id
       ${WHERE}
       ORDER  BY o.created_at DESC
       LIMIT  $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        orders: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext:    page * limit < total,
          hasPrev:    page > 1,
        },
      },
    });

  } catch (err) {
    console.error("getAllOrdersAdmin error:", err);
    return res.status(500).json({
      success: false,
      message: "Could not fetch orders",
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// PATCH /api/orders/admin/:orderId/status
// Admin manually updates order status
// Body: { status, note }
// ═══════════════════════════════════════════════════════════════
export const updateOrderStatusAdmin = async (req, res) => {
  const { orderId }    = req.params;
  const { status, note } = req.body;
  const adminId        = req.user.id;

  const validStatuses = [
    "pending",
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "refunded",
  ];

  // ── Validate status ────────────────────────────────────────
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Fetch order ────────────────────────────────────────
    const { rows } = await client.query(
      `SELECT * FROM orders WHERE id = $1`,
      [orderId]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const order = rows[0];

    // ── Update order status ────────────────────────────────
    await client.query(
      `UPDATE orders
       SET    order_status  = $1,
              admin_note    = $2,
              updated_by    = $3,
              updated_at    = NOW()
       WHERE  id = $4`,
      [status, note || null, adminId, orderId]
    );

    // ── If admin marks as delivered → release vendor funds ─
    if (
      status === "delivered" &&
      order.order_status !== "delivered" &&
      order.payment_status === "confirmed"
    ) {
      const { rows: vendorItems } = await client.query(
        `SELECT vendor_id, SUM(total_price) AS vendor_total
         FROM   order_items
         WHERE  order_id = $1
         GROUP  BY vendor_id`,
        [orderId]
      );

      for (const item of vendorItems) {
        await releaseToAvailable({
          vendorId: item.vendor_id,
          amount:   Number(item.vendor_total),
          client,
        });

        await createEntry({
          userId:    item.vendor_id,
          vendorId:  item.vendor_id,
          orderId,
          type:      "order_credit",
          direction: "credit",
          amount:    Number(item.vendor_total),
          reference: `ADMIN_RELEASE_${orderId}_${item.vendor_id}`,
          narration: `Balance released by admin for order ${orderId}`,
          performedBy: adminId,
          client,
        });
      }
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `Order status updated to "${status}"`,
      data:    { orderId, status },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updateOrderStatusAdmin error:", err);
    return res.status(500).json({
      success: false,
      message: "Could not update order status",
    });
  } finally {
    client.release();
  }
};