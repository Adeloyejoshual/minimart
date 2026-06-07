// routes/seller/dashboard.js
import express          from "express";
import { pool }         from "../../server.js";
import { authenticate } from "../../middleware/auth.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// SELLER ACCOUNT GUARD
// Confirms token belongs to market.users ONLY
// ─────────────────────────────────────────────────────────────
const requireSellerAccount = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, status
       FROM market.users
       WHERE id = $1`,
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
    return res.status(500).json({ success: false, message: "Auth error" });
  }
};

// ─────────────────────────────────────────────────────────────
// ACTIVE VENDOR GUARD
// Confirms active vendor exists for this seller
// ─────────────────────────────────────────────────────────────
const requireActiveVendor = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, status, store_name, products_count
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
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Combined guard ────────────────────────────────────────────
const guard = [authenticate, requireSellerAccount, requireActiveVendor];

// ════════════════════════════════════════════════════════════
// GET /api/seller-dashboard/stats
// ════════════════════════════════════════════════════════════
router.get("/stats", ...guard, async (req, res) => {
  try {
    const range = req.query.range ?? "30d";

    const sinceMap = {
      "7d":  `NOW() - INTERVAL '7 days'`,
      "30d": `NOW() - INTERVAL '30 days'`,
      "90d": `NOW() - INTERVAL '90 days'`,
      "all": `'1970-01-01'::timestamp`,
    };

    const prevMap = {
      "7d":  `NOW() - INTERVAL '14 days'`,
      "30d": `NOW() - INTERVAL '60 days'`,
      "90d": `NOW() - INTERVAL '180 days'`,
      "all": `'1970-01-01'::timestamp`,
    };

    const since = sinceMap[range] ?? sinceMap["30d"];
    const prev  = prevMap[range]  ?? prevMap["30d"];

    // ── Current period ────────────────────────────────────
    const { rows: [current] } = await pool.query(
      `SELECT
         COALESCE(SUM(o.total), 0)             AS total_revenue,
         COUNT(o.id)                           AS total_orders,
         COUNT(DISTINCT o.buyer_id)            AS total_customers,
         COUNT(CASE WHEN o.status = 'pending'
               THEN 1 END)                     AS pending_orders,
         CASE WHEN COUNT(o.id) > 0
              THEN ROUND(SUM(o.total) / COUNT(o.id), 2)
              ELSE 0 END                       AS avg_order_value
       FROM market.orders o
       WHERE o.vendor_id  = $1
         AND o.created_at >= ${since}
         AND o.status    != 'cancelled'`,
      [req.vendor.id]
    ).catch(() => ({ rows: [{}] }));

    // ── Previous period for % change ─────────────────────
    const { rows: [previous] } = await pool.query(
      `SELECT
         COALESCE(SUM(o.total), 0) AS prev_revenue,
         COUNT(o.id)               AS prev_orders
       FROM market.orders o
       WHERE o.vendor_id  = $1
         AND o.created_at >= ${prev}
         AND o.created_at <  ${since}
         AND o.status    != 'cancelled'`,
      [req.vendor.id]
    ).catch(() => ({ rows: [{}] }));

    // ── % change ──────────────────────────────────────────
    const curRevenue  = Number(current?.total_revenue ?? 0);
    const curOrders   = Number(current?.total_orders  ?? 0);
    const prevRevenue = Number(previous?.prev_revenue ?? 0);
    const prevOrders  = Number(previous?.prev_orders  ?? 0);

    const revenueChange = prevRevenue > 0
      ? Math.round(((curRevenue - prevRevenue) / prevRevenue) * 100)
      : 0;

    const ordersChange = prevOrders > 0
      ? Math.round(((curOrders - prevOrders) / prevOrders) * 100)
      : 0;

    return res.json({
      success: true,
      stats: {
        total_revenue:   curRevenue,
        total_orders:    Number(current?.total_orders    ?? 0),
        total_customers: Number(current?.total_customers ?? 0),
        pending_orders:  Number(current?.pending_orders  ?? 0),
        avg_order_value: Number(current?.avg_order_value ?? 0),
        total_products:  req.vendor.products_count ?? 0,
        revenue_change:  revenueChange,
        orders_change:   ordersChange,
      },
    });

  } catch (err) {
    console.error("[dashboard stats]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-dashboard/orders
// ════════════════════════════════════════════════════════════
router.get("/orders", ...guard, async (req, res) => {
  try {
    const status = req.query.status ?? "all";
    const limit  = Math.min(parseInt(req.query.limit)  || 10, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0,  0);

    const params = [req.vendor.id];
    let where    = "WHERE o.vendor_id = $1";

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
         u.name AS customer_name,
         (SELECT COUNT(*)
          FROM market.order_items oi
          WHERE oi.order_id = o.id) AS item_count
       FROM market.orders o
       LEFT JOIN market.users u ON u.id = o.buyer_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length + 1}
       OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ).catch(() => ({ rows: [] }));

    return res.json({ success: true, orders });

  } catch (err) {
    console.error("[dashboard orders]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// PATCH /api/seller-dashboard/orders/:id/status
// ════════════════════════════════════════════════════════════
router.patch("/orders/:id/status", ...guard, async (req, res) => {
  try {
    const { status } = req.body;

    const VALID = [
      "pending", "processing",
      "shipped", "delivered", "cancelled",
    ];

    if (!VALID.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be: ${VALID.join(", ")}`,
      });
    }

    const { rows: [order] } = await pool.query(
      `UPDATE market.orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND vendor_id = $3
       RETURNING id, status`,
      [status, req.params.id, req.vendor.id]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({ success: true, order });

  } catch (err) {
    console.error("[order status]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-dashboard/top-products
// ════════════════════════════════════════════════════════════
router.get("/top-products", ...guard, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);

    const { rows: products } = await pool.query(
      `SELECT
         p.id,
         p.title        AS name,
         p.price,
         p.images->0    AS image,
         COALESCE(SUM(oi.quantity), 0)             AS total_sold,
         COALESCE(SUM(oi.quantity * oi.price), 0)  AS revenue
       FROM market.products p
       LEFT JOIN market.order_items oi ON oi.product_id = p.id
       WHERE p.vendor_id = $1
       GROUP BY p.id
       ORDER BY revenue DESC
       LIMIT $2`,
      [req.vendor.id, limit]
    ).catch(() => ({ rows: [] }));

    return res.json({ success: true, products });

  } catch (err) {
    console.error("[top products]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-dashboard/revenue-chart
// ════════════════════════════════════════════════════════════
router.get("/revenue-chart", ...guard, async (req, res) => {
  try {
    const range = req.query.range ?? "30d";

    const config = {
      "7d":  { trunc: "day",   interval: "7 days",   fmt: "Dy"      },
      "30d": { trunc: "day",   interval: "30 days",  fmt: "DD Mon"  },
      "90d": { trunc: "week",  interval: "90 days",  fmt: "DD Mon"  },
      "all": { trunc: "month", interval: "365 days", fmt: "Mon YY"  },
    };

    const c = config[range] ?? config["30d"];

    const { rows: chart } = await pool.query(
      `SELECT
         TO_CHAR(DATE_TRUNC($1, o.created_at), $2)  AS label,
         COALESCE(SUM(o.total), 0)::float            AS revenue
       FROM market.orders o
       WHERE o.vendor_id  = $3
         AND o.created_at >= NOW() - INTERVAL '${c.interval}'
         AND o.status    != 'cancelled'
       GROUP BY DATE_TRUNC($1, o.created_at)
       ORDER BY DATE_TRUNC($1, o.created_at) ASC`,
      [c.trunc, c.fmt, req.vendor.id]
    ).catch(() => ({ rows: [] }));

    return res.json({ success: true, chart });

  } catch (err) {
    console.error("[revenue chart]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-dashboard/notifications
// ════════════════════════════════════════════════════════════
router.get("/notifications", ...guard, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 8, 30);

    const { rows: notifications } = await pool.query(
      `SELECT id, message, read, created_at
       FROM market.notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    ).catch(() => ({ rows: [] }));

    return res.json({ success: true, notifications });

  } catch (err) {
    console.error("[notifications]", err.message);
    // Return empty array — don't fail dashboard for missing notifications
    return res.json({ success: true, notifications: [] });
  }
});

// ════════════════════════════════════════════════════════════
// PATCH /api/seller-dashboard/notifications/:id/read
// ════════════════════════════════════════════════════════════
router.patch(
  "/notifications/:id/read",
  authenticate,
  requireSellerAccount,
  async (req, res) => {
    try {
      await pool.query(
        `UPDATE market.notifications
         SET read = TRUE
         WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      ).catch(() => {});

      return res.json({ success: true });

    } catch (err) {
      console.error("[mark notif read]", err.message);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;