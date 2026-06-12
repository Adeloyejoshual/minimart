// routes/seller/dashboard.js

import express          from "express";
import { pool }         from "../../server.js";
import { authenticate } from "../../middleware/auth.js";

const router = express.Router();

// ═════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═════════════════════════════════════════════════════════════

// ── Seller account guard ─────────────────────────────────────
const requireSellerAccount = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, status
       FROM   market.users
       WHERE  id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(403).json({
        success: false,
        code:    "NOT_SELLER_ACCOUNT",
        message: "This route requires a seller account.",
      });
    }

    if (rows[0].status !== "active") {
      return res.status(403).json({
        success: false,
        code:    "ACCOUNT_SUSPENDED",
        message: "Your seller account has been suspended",
      });
    }

    req.sellerUser = rows[0];
    next();

  } catch (err) {
    console.error("[requireSellerAccount]", err.message);
    return res.status(500).json({
      success: false,
      message: "Auth error",
    });
  }
};

// ── Active vendor guard ──────────────────────────────────────
const requireActiveVendor = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         id, status, store_name,
         products_count, commission_rate
       FROM market.vendors
       WHERE user_id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        code:    "NO_VENDOR",
        message: "No vendor account found",
      });
    }

    if (!["active", "approved"].includes(rows[0].status)) {
      return res.status(403).json({
        success: false,
        code:    "VENDOR_NOT_ACTIVE",
        message: `Vendor not active. Current: "${rows[0].status}"`,
      });
    }

    req.vendor = rows[0];
    next();

  } catch (err) {
    console.error("[requireActiveVendor]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ── Combined guard ────────────────────────────────────────────
const guard = [authenticate, requireSellerAccount, requireActiveVendor];

// ═════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════

// Build date WHERE clause from range string
const rangeFilter = (range, alias = "o") => {
  switch (range) {
    case "7d":  return `AND ${alias}.created_at > NOW() - INTERVAL '7 days'`;
    case "30d": return `AND ${alias}.created_at > NOW() - INTERVAL '30 days'`;
    case "90d": return `AND ${alias}.created_at > NOW() - INTERVAL '90 days'`;
    default:    return ""; // "all" — no filter
  }
};

// Build previous-period filter (for % change calculation)
const prevRangeFilter = (range, alias = "o") => {
  switch (range) {
    case "7d":
      return `AND ${alias}.created_at BETWEEN
        NOW() - INTERVAL '14 days'
        AND NOW() - INTERVAL '7 days'`;
    case "30d":
      return `AND ${alias}.created_at BETWEEN
        NOW() - INTERVAL '60 days'
        AND NOW() - INTERVAL '30 days'`;
    case "90d":
      return `AND ${alias}.created_at BETWEEN
        NOW() - INTERVAL '180 days'
        AND NOW() - INTERVAL '90 days'`;
    default:
      return "AND FALSE"; // no previous period for "all"
  }
};

// Percentage change between two numbers
const pctChange = (current, previous) => {
  const c = Number(current  ?? 0);
  const p = Number(previous ?? 0);
  if (!p || p === 0) return c > 0 ? 100 : 0;
  return Math.round(((c - p) / p) * 100);
};

// Safe number conversion
const n = (v, fallback = 0) => Number(v ?? fallback);

// ═════════════════════════════════════════════════════════════
// GET /api/seller-dashboard/stats
// ═════════════════════════════════════════════════════════════
router.get("/stats", ...guard, async (req, res) => {
  try {
    const range      = req.query.range ?? "30d";
    const vendorId   = req.vendor.id;
    const currFilter = rangeFilter(range,     "o");
    const prevFilter = prevRangeFilter(range, "o");

    // ── Current period ────────────────────────────────────
    const { rows: [curr] } = await pool.query(
      `SELECT
         COALESCE(SUM(o.total), 0)                    AS total_revenue,
         COUNT(o.id)                                  AS total_orders,
         COUNT(DISTINCT o.buyer_id)                   AS total_customers,
         COUNT(o.id) FILTER (WHERE o.status = 'pending') AS pending_orders,
         CASE WHEN COUNT(o.id) > 0
              THEN ROUND(SUM(o.total) / COUNT(o.id), 2)
              ELSE 0
         END                                          AS avg_order_value
       FROM market.orders o
       WHERE o.vendor_id = $1
         AND o.status   != 'cancelled'
         ${currFilter}`,
      [vendorId]
    );

    // ── Previous period ───────────────────────────────────
    const { rows: [prev] } = await pool.query(
      `SELECT
         COALESCE(SUM(o.total), 0)    AS prev_revenue,
         COUNT(o.id)                  AS prev_orders,
         COUNT(DISTINCT o.buyer_id)   AS prev_customers
       FROM market.orders o
       WHERE o.vendor_id = $1
         AND o.status   != 'cancelled'
         ${prevFilter}`,
      [vendorId]
    );

    // ── Product view count (for conversion rate) ──────────
    const { rows: [viewData] } = await pool.query(
      `SELECT COALESCE(SUM(view_count), 0) AS total_views
       FROM market.products
       WHERE vendor_id = $1
         AND status    = 'active'`,
      [vendorId]
    );

    // ── Rating data ───────────────────────────────────────
    const { rows: [ratingData] } = await pool.query(
      `SELECT
         COALESCE(AVG(rating), 0) AS avg_rating,
         COUNT(*)                 AS review_count
       FROM market.products
       WHERE vendor_id = $1`,
      [vendorId]
    );

    // ── Totals ────────────────────────────────────────────
    const totalOrders    = n(curr?.total_orders);
    const totalRevenue   = n(curr?.total_revenue);
    const totalViews     = n(viewData?.total_views);
    const conversionRate = totalViews > 0
      ? parseFloat(((totalOrders / totalViews) * 100).toFixed(2))
      : 0;

    return res.json({
      success: true,
      stats: {
        total_revenue:    totalRevenue,
        total_orders:     totalOrders,
        total_customers:  n(curr?.total_customers),
        pending_orders:   n(curr?.pending_orders),
        avg_order_value:  n(curr?.avg_order_value),
        total_products:   n(req.vendor.products_count),
        conversion_rate:  conversionRate,
        avg_rating:       parseFloat(n(ratingData?.avg_rating).toFixed(1)),
        review_count:     n(ratingData?.review_count),

        // % changes vs previous period
        revenue_change:   pctChange(curr?.total_revenue, prev?.prev_revenue),
        orders_change:    pctChange(curr?.total_orders,  prev?.prev_orders),
        customers_change: pctChange(curr?.total_customers, prev?.prev_customers),
      },
    });

  } catch (err) {
    console.error("[dashboard/stats]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/seller-dashboard/revenue-chart
// ═════════════════════════════════════════════════════════════
router.get("/revenue-chart", ...guard, async (req, res) => {
  try {
    const range    = req.query.range ?? "30d";
    const vendorId = req.vendor.id;

    // ── Choose grouping by range ──────────────────────────
    const cfg = {
      "7d":  { trunc: "day",   interval: "7 days",   fmt: "Dy DD" },
      "30d": { trunc: "day",   interval: "30 days",  fmt: "DD Mon" },
      "90d": { trunc: "week",  interval: "90 days",  fmt: "DD Mon" },
      "all": { trunc: "month", interval: "3650 days", fmt: "Mon YY" },
    }[range] ?? { trunc: "day", interval: "30 days", fmt: "DD Mon" };

    const { rows } = await pool.query(
      `SELECT
         TO_CHAR(
           DATE_TRUNC($1, o.created_at AT TIME ZONE 'Africa/Lagos'),
           $2
         )                                             AS label,
         COALESCE(SUM(o.total), 0)::float              AS revenue,
         COUNT(o.id)::int                              AS orders
       FROM   market.orders o
       WHERE  o.vendor_id   = $3
         AND  o.status     != 'cancelled'
         AND  o.created_at  > NOW() - INTERVAL '${cfg.interval}'
       GROUP  BY DATE_TRUNC($1, o.created_at AT TIME ZONE 'Africa/Lagos')
       ORDER  BY DATE_TRUNC($1, o.created_at AT TIME ZONE 'Africa/Lagos') ASC`,
      [cfg.trunc, cfg.fmt, vendorId]
    );

    return res.json({
      success: true,
      chart:   rows.map((r) => ({
        label:   r.label,
        revenue: Number(r.revenue),
        orders:  Number(r.orders),
      })),
    });

  } catch (err) {
    console.error("[dashboard/revenue-chart]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/seller-dashboard/top-products
// ═════════════════════════════════════════════════════════════
router.get("/top-products", ...guard, async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit) || 10, 25);
    const range    = req.query.range ?? "30d";
    const vendorId = req.vendor.id;
    const filter   = rangeFilter(range, "o");

    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.title                                      AS name,
         p.price,
         p.images->0                                  AS image,
         COALESCE(SUM(oi.quantity), 0)                AS total_sold,
         COALESCE(SUM(oi.quantity * oi.price), 0)     AS revenue,
         COALESCE(AVG(oi.price), 0)                   AS avg_price,
         COUNT(DISTINCT oi.order_id)                  AS order_count
       FROM   market.products    p
       LEFT   JOIN market.order_items oi ON oi.product_id = p.id
       LEFT   JOIN market.orders      o  ON o.id  = oi.order_id
                                        AND o.status != 'cancelled'
                                        ${filter}
       WHERE  p.vendor_id = $1
       GROUP  BY p.id, p.title, p.price, p.images
       ORDER  BY revenue DESC
       LIMIT  $2`,
      [vendorId, limit]
    );

    return res.json({
      success:  true,
      products: rows.map((r) => ({
        id:          r.id,
        name:        r.name,
        price:       Number(r.price),
        image:       r.image ?? null,
        total_sold:  Number(r.total_sold),
        revenue:     Number(r.revenue),
        avg_price:   Number(r.avg_price),
        order_count: Number(r.order_count),
      })),
    });

  } catch (err) {
    console.error("[dashboard/top-products]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/seller-dashboard/order-breakdown
// Count of orders by status for the vendor
// ═════════════════════════════════════════════════════════════
router.get("/order-breakdown", ...guard, async (req, res) => {
  try {
    const range    = req.query.range ?? "30d";
    const vendorId = req.vendor.id;
    const filter   = rangeFilter(range, "o");

    const { rows } = await pool.query(
      `SELECT
         o.status,
         COUNT(o.id) AS count
       FROM   market.orders o
       WHERE  o.vendor_id = $1
         ${filter}
       GROUP  BY o.status`,
      [vendorId]
    );

    // Build a flat map { pending: 5, delivered: 12, ... }
    const breakdown = {};
    for (const r of rows) {
      breakdown[r.status] = Number(r.count);
    }

    return res.json({
      success:   true,
      breakdown,
    });

  } catch (err) {
    console.error("[dashboard/order-breakdown]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/seller-dashboard/recent-orders
// Last N orders for this vendor with earnings breakdown
// ═════════════════════════════════════════════════════════════
router.get("/recent-orders", ...guard, async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit) || 10, 25);
    const vendorId = req.vendor.id;

    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.status                                      AS order_status,
         o.total                                       AS grand_total,
         o.created_at,
         -- Reference: use order id prefix if no reference column
         COALESCE(o.reference, CONCAT('ORD-', LEFT(o.id::text, 8)))
                                                       AS reference,
         -- Sum only this vendor's items
         COALESCE(SUM(oi.quantity * oi.price), 0)      AS vendor_earnings,
         COUNT(oi.id)                                  AS item_count
       FROM   market.orders      o
       JOIN   market.order_items oi ON oi.order_id  = o.id
                                   AND oi.vendor_id = $1
       GROUP  BY o.id, o.status, o.total, o.created_at, o.reference
       ORDER  BY o.created_at DESC
       LIMIT  $2`,
      [vendorId, limit]
    );

    return res.json({
      success: true,
      orders:  rows.map((r) => ({
        id:              r.id,
        reference:       r.reference,
        order_status:    r.order_status,
        grand_total:     Number(r.grand_total),
        vendor_earnings: Number(r.vendor_earnings),
        item_count:      Number(r.item_count),
        created_at:      r.created_at,
      })),
    });

  } catch (err) {
    console.error("[dashboard/recent-orders]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/seller-dashboard/orders
// Paginated order list for the seller's own orders page
// ═════════════════════════════════════════════════════════════
router.get("/orders", ...guard, async (req, res) => {
  try {
    const status   = req.query.status ?? "all";
    const limit    = Math.min(parseInt(req.query.limit)  || 10, 50);
    const offset   = Math.max(parseInt(req.query.offset) || 0,  0);
    const vendorId = req.vendor.id;

    const params = [vendorId];
    let   where  = "WHERE o.vendor_id = $1";

    if (status !== "all") {
      params.push(status);
      where += ` AND o.status = $${params.length}`;
    }

    const { rows: orders } = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.total,
         o.created_at,
         COALESCE(o.reference,
           CONCAT('ORD-', LEFT(o.id::text, 8))
         )                                    AS reference,
         u.name                               AS customer_name,
         (SELECT COUNT(*)
          FROM   market.order_items oi
          WHERE  oi.order_id  = o.id
            AND  oi.vendor_id = $1)           AS item_count
       FROM   market.orders o
       LEFT   JOIN market.users u ON u.id = o.buyer_id
       ${where}
       ORDER  BY o.created_at DESC
       LIMIT  $${params.length + 1}
       OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    // Total count for pagination
    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(DISTINCT o.id) AS total
       FROM   market.orders o
       ${where}`,
      params
    );

    return res.json({
      success: true,
      orders,
      pagination: {
        total:  Number(total),
        limit,
        offset,
        has_more: offset + limit < Number(total),
      },
    });

  } catch (err) {
    console.error("[dashboard/orders]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ═════════════════════════════════════════════════════════════
// PATCH /api/seller-dashboard/orders/:id/status
// ═════════════════════════════════════════════════════════════
router.patch("/orders/:id/status", ...guard, async (req, res) => {
  try {
    const { status } = req.body;
    const vendorId   = req.vendor.id;

    const VALID_STATUSES = [
      "pending", "processing",
      "shipped", "out_for_delivery",
      "delivered", "cancelled",
    ];

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const { rows: [order] } = await pool.query(
      `UPDATE market.orders
       SET    status     = $1,
              updated_at = NOW()
       WHERE  id         = $2
         AND  vendor_id  = $3
       RETURNING id, status, updated_at`,
      [status, req.params.id, vendorId]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({
      success: true,
      order,
    });

  } catch (err) {
    console.error("[dashboard/orders/:id/status]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/seller-dashboard/notifications
// Legacy endpoint — kept for backwards compatibility
// New code should use /api/seller/notifications instead
// ═════════════════════════════════════════════════════════════
router.get("/notifications", ...guard, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 15, 30);

    const { rows: notifications } = await pool.query(
      `SELECT
         id,
         type,
         title,
         message,
         read,
         read_at,
         metadata,
         created_at
       FROM   public.notifications
       WHERE  user_id   = $1
         AND  user_type = 'seller'
       ORDER  BY created_at DESC
       LIMIT  $2`,
      [req.user.id, limit]
    );

    const unread = notifications.filter((n) => !n.read).length;

    return res.json({
      success:       true,
      notifications,
      unread_count:  unread,
    });

  } catch (err) {
    console.error("[dashboard/notifications]", err.message);
    // Non-critical — return empty list rather than failing
    return res.json({
      success:       true,
      notifications: [],
      unread_count:  0,
    });
  }
});

// ═════════════════════════════════════════════════════════════
// PATCH /api/seller-dashboard/notifications/:id/read
// Legacy endpoint — kept for backwards compatibility
// ═════════════════════════════════════════════════════════════
router.patch(
  "/notifications/:id/read",
  authenticate,
  requireSellerAccount,
  async (req, res) => {
    try {
      await pool.query(
        `UPDATE public.notifications
         SET    read    = TRUE,
                read_at = NOW()
         WHERE  id        = $1
           AND  user_id   = $2
           AND  user_type = 'seller'`,
        [req.params.id, req.user.id]
      );

      return res.json({ success: true });

    } catch (err) {
      console.error("[dashboard/notifications/:id/read]", err.message);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

export default router;