/**
 * routes/seller/dashboard.js
 *
 * Complete seller dashboard API.
 * Handles stats, revenue charts, order management, and notifications.
 *
 * v2 — Full order details + email notifications
 * ──────────────────────────────────────────────
 * ✓ Auto-detects public.orders vs market.orders (backward compat)
 * ✓ NEW: GET /orders/:id — full order details with items + address
 * ✓ Status update sends email + in-app notification to buyer
 * ✓ Fetches items from public.order_items with product info
 * ✓ Aggregate stats across ALL time or by range
 * ✓ Robust error handling with detailed logs
 */

import express          from "express";
import { pool }         from "../../server.js";
import { authenticate } from "../../middleware/auth.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   SCHEMA DETECTION (cached — runs once per server lifetime)
   ─────────────────────────────────────────────────────
   Some Loemart installs use market.orders, others use
   public.orders + public.orders_items. This detects which.
════════════════════════════════════════════════════════════ */
let SCHEMA_INFO = null;

async function detectSchema() {
  if (SCHEMA_INFO) return SCHEMA_INFO;

  try {
    const { rows } = await pool.query(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_name IN ('orders', 'order_items', 'order_groups')
         AND table_schema IN ('market', 'public')`
    );

    const has = (schema, table) =>
      rows.some((r) => r.table_schema === schema && r.table_name === table);

    SCHEMA_INFO = {
      hasPublicOrders:      has("public", "orders"),
      hasPublicOrderItems:  has("public", "order_items"),
      hasPublicOrderGroups: has("public", "order_groups"),
      hasMarketOrders:      has("market", "orders"),
      hasMarketOrderItems:  has("market", "order_items"),
    };

    console.log("[dashboard] Detected schema:", SCHEMA_INFO);
  } catch (err) {
    console.warn("[dashboard] Schema detection failed:", err.message);
    SCHEMA_INFO = {
      hasPublicOrders:      true,
      hasPublicOrderItems:  true,
      hasPublicOrderGroups: true,
      hasMarketOrders:      false,
      hasMarketOrderItems:  false,
    };
  }
  return SCHEMA_INFO;
}

/* ════════════════════════════════════════════════════════════
   MIDDLEWARE
════════════════════════════════════════════════════════════ */

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
    return res.status(500).json({ success: false, message: "Auth error" });
  }
};

const requireActiveVendor = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, status, store_name, products_count, commission_rate
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

const guard = [authenticate, requireSellerAccount, requireActiveVendor];

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */

const rangeFilter = (range, alias = "o") => {
  switch (range) {
    case "7d":  return `AND ${alias}.created_at > NOW() - INTERVAL '7 days'`;
    case "30d": return `AND ${alias}.created_at > NOW() - INTERVAL '30 days'`;
    case "90d": return `AND ${alias}.created_at > NOW() - INTERVAL '90 days'`;
    default:    return "";
  }
};

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
      return "AND FALSE";
  }
};

const pctChange = (current, previous) => {
  const c = Number(current  ?? 0);
  const p = Number(previous ?? 0);
  if (!p || p === 0) return c > 0 ? 100 : 0;
  return Math.round(((c - p) / p) * 100);
};

const n = (v, fallback = 0) => Number(v ?? fallback);

/* ────────────────────────────────────────────────────────────
   Get seller-specific query based on schema
   ─────────────────────────────────────────────────
   Returns { table, itemsTable, joinCols, sellerCol }
──────────────────────────────────────────────────────────── */
async function getOrderSchema() {
  const info = await detectSchema();

  /* Prefer public.orders + public.order_items (checkout flow) */
  if (info.hasPublicOrders && info.hasPublicOrderItems) {
    return {
      ordersTable:  "public.orders",
      itemsTable:   "public.order_items",
      groupsTable:  info.hasPublicOrderGroups ? "public.order_groups" : null,
      sellerCol:    "seller_id",
      totalCol:     "subtotal",
      hasGroups:    info.hasPublicOrderGroups,
    };
  }

  /* Fall back to market.orders */
  return {
    ordersTable:  "market.orders",
    itemsTable:   "market.order_items",
    groupsTable:  null,
    sellerCol:    "vendor_id",
    totalCol:     "total",
    hasGroups:    false,
  };
}

/* ────────────────────────────────────────────────────────────
   Notification service (optional — won't crash if missing)
──────────────────────────────────────────────────────────── */
async function getNotifier() {
  try {
    return await import("../../services/notificationService.js");
  } catch (err) {
    console.warn("[dashboard] notificationService not available:", err.message);
    return null;
  }
}

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/stats
════════════════════════════════════════════════════════════ */
router.get("/stats", ...guard, async (req, res) => {
  try {
    const range      = req.query.range ?? "30d";
    const vendorId   = req.vendor.id;
    const currFilter = rangeFilter(range,     "o");
    const prevFilter = prevRangeFilter(range, "o");

    /* Current period */
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

    /* Previous period */
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

    /* Views + Rating */
    const { rows: [viewData] } = await pool.query(
      `SELECT COALESCE(SUM(view_count), 0) AS total_views
       FROM market.products
       WHERE vendor_id = $1 AND status = 'active'`,
      [vendorId]
    );

    const { rows: [ratingData] } = await pool.query(
      `SELECT
         COALESCE(AVG(rating), 0) AS avg_rating,
         COUNT(*)                 AS review_count
       FROM market.products
       WHERE vendor_id = $1`,
      [vendorId]
    );

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
        revenue_change:   pctChange(curr?.total_revenue,   prev?.prev_revenue),
        orders_change:    pctChange(curr?.total_orders,    prev?.prev_orders),
        customers_change: pctChange(curr?.total_customers, prev?.prev_customers),
      },
    });
  } catch (err) {
    console.error("[dashboard/stats]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/revenue-chart
════════════════════════════════════════════════════════════ */
router.get("/revenue-chart", ...guard, async (req, res) => {
  try {
    const range    = req.query.range ?? "30d";
    const vendorId = req.vendor.id;

    const cfg = {
      "7d":  { trunc: "day",   interval: "7 days",    fmt: "Dy DD" },
      "30d": { trunc: "day",   interval: "30 days",   fmt: "DD Mon" },
      "90d": { trunc: "week",  interval: "90 days",   fmt: "DD Mon" },
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
       WHERE  o.vendor_id  = $3
         AND  o.status    != 'cancelled'
         AND  o.created_at > NOW() - INTERVAL '${cfg.interval}'
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
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/top-products
════════════════════════════════════════════════════════════ */
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
      success: true,
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
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/order-breakdown
════════════════════════════════════════════════════════════ */
router.get("/order-breakdown", ...guard, async (req, res) => {
  try {
    const range    = req.query.range ?? "30d";
    const vendorId = req.vendor.id;
    const filter   = rangeFilter(range, "o");

    const { rows } = await pool.query(
      `SELECT o.status, COUNT(o.id) AS count
       FROM market.orders o
       WHERE o.vendor_id = $1
         ${filter}
       GROUP BY o.status`,
      [vendorId]
    );

    const breakdown = {};
    for (const r of rows) breakdown[r.status] = Number(r.count);

    return res.json({ success: true, breakdown });
  } catch (err) {
    console.error("[dashboard/order-breakdown]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/recent-orders
════════════════════════════════════════════════════════════ */
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
         COALESCE(o.reference, CONCAT('ORD-', LEFT(o.id::text, 8))) AS reference,
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
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/orders — paginated list
   ─────────────────────────────────────────────────
   Now smart-detects schema (public.orders vs market.orders)
   and returns unified format for the seller Orders page.
════════════════════════════════════════════════════════════ */
router.get("/orders", ...guard, async (req, res) => {
  try {
    const status      = req.query.status ?? "all";
    const limit       = Math.min(parseInt(req.query.limit)  || 10, 50);
    const offset      = Math.max(parseInt(req.query.offset) || 0,  0);
    const vendorId    = req.vendor.id;
    const sellerUserId = req.user.id;

    const schema = await getOrderSchema();

    let orders   = [];
    let total    = 0;

    if (schema.ordersTable === "public.orders") {
      /* ─── NEW schema — public.orders (checkout flow) ─── */
      const params = [sellerUserId];
      let   where  = "WHERE o.seller_id = $1";

      if (status !== "all") {
        params.push(status);
        where += ` AND o.status = $${params.length}`;
      }

      const groupJoin = schema.hasGroups
        ? `LEFT JOIN public.order_groups og ON og.id = o.order_group_id
           LEFT JOIN market.users        u  ON u.id = og.user_id`
        : `LEFT JOIN market.users u ON u.id = o.user_id`;

      const groupCols = schema.hasGroups
        ? "og.tracking_id, og.payment_method, og.payment_status, og.grand_total"
        : "NULL AS tracking_id, NULL AS payment_method, NULL AS payment_status, o.subtotal AS grand_total";

      const { rows } = await pool.query(
        `SELECT
           o.id,
           o.status,
           o.subtotal   AS total,
           o.created_at,
           ${groupCols},
           u.name       AS customer_name,
           (SELECT COUNT(*)
            FROM public.order_items oi
            WHERE oi.order_id = o.id)  AS item_count
         FROM public.orders o
         ${groupJoin}
         ${where}
         ORDER BY o.created_at DESC
         LIMIT $${params.length + 1}
         OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      orders = rows.map((r) => ({
        id:             r.id,
        tracking_id:    r.tracking_id ?? `ORD-${r.id.slice(0, 8).toUpperCase()}`,
        status:         r.status,
        total:          Number(r.total),
        grand_total:    Number(r.grand_total ?? r.total),
        item_count:     Number(r.item_count),
        customer_name:  r.customer_name ?? "Guest",
        payment_method: r.payment_method,
        payment_status: r.payment_status,
        created_at:     r.created_at,
      }));

      /* Total count */
      const { rows: [{ total: t }] } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM public.orders o ${where}`,
        params
      );
      total = Number(t);

    } else {
      /* ─── Legacy schema — market.orders ─── */
      const params = [vendorId];
      let   where  = "WHERE o.vendor_id = $1";

      if (status !== "all") {
        params.push(status);
        where += ` AND o.status = $${params.length}`;
      }

      const { rows } = await pool.query(
        `SELECT
           o.id,
           o.status,
           o.total,
           o.created_at,
           COALESCE(o.reference, CONCAT('ORD-', LEFT(o.id::text, 8))) AS tracking_id,
           u.name AS customer_name,
           (SELECT COUNT(*)
            FROM   market.order_items oi
            WHERE  oi.order_id  = o.id
              AND  oi.vendor_id = $1)  AS item_count
         FROM market.orders o
         LEFT JOIN market.users u ON u.id = o.buyer_id
         ${where}
         ORDER BY o.created_at DESC
         LIMIT $${params.length + 1}
         OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      orders = rows.map((r) => ({
        id:             r.id,
        tracking_id:    r.tracking_id,
        status:         r.status,
        total:          Number(r.total),
        grand_total:    Number(r.total),
        item_count:     Number(r.item_count),
        customer_name:  r.customer_name ?? "Guest",
        created_at:     r.created_at,
      }));

      const { rows: [{ total: t }] } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM market.orders o ${where}`,
        params
      );
      total = Number(t);
    }

    return res.json({
      success: true,
      orders,
      total,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    });

  } catch (err) {
    console.error("[dashboard/orders]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      debug: { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/orders/:id — full order details
   ─────────────────────────────────────────────────
   Returns order with:
     - Items (with product images, variants, prices)
     - Customer info
     - Delivery address
     - Payment status
     - Notes
════════════════════════════════════════════════════════════ */
router.get("/orders/:id", ...guard, async (req, res) => {
  try {
    const orderId      = req.params.id;
    const vendorId     = req.vendor.id;
    const sellerUserId = req.user.id;

    const schema = await getOrderSchema();

    let order = null;
    let items = [];

    if (schema.ordersTable === "public.orders") {
      /* ── NEW schema — fetch full context ── */
      const { rows: [row] } = await pool.query(
        `SELECT
           o.id,
           o.status,
           o.subtotal,
           o.created_at,
           o.updated_at,

           og.id                     AS group_id,
           og.tracking_id,
           og.grand_total,
           og.delivery_fee,
           og.discount,
           og.payment_method,
           og.payment_status,
           og.notes,
           og.user_id                AS buyer_id,

           u.name                    AS customer_name,
           u.email                   AS customer_email,
           u.phone                   AS customer_phone,

           a.recipient_name,
           a.phone                   AS phone,
           a.address_line,
           a.landmark,
           a.city,
           a.state
         FROM public.orders o
         LEFT JOIN public.order_groups og ON og.id = o.order_group_id
         LEFT JOIN market.users u        ON u.id = og.user_id
         LEFT JOIN public.user_addresses a ON a.id = og.address_id
         WHERE o.id = $1
           AND o.seller_id = $2`,
        [orderId, sellerUserId]
      );

      if (!row) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      order = {
        id:               row.id,
        tracking_id:      row.tracking_id ?? `ORD-${row.id.slice(0, 8).toUpperCase()}`,
        status:           row.status,
        subtotal:         Number(row.subtotal),
        grand_total:      Number(row.grand_total ?? row.subtotal),
        delivery_fee:     Number(row.delivery_fee ?? 0),
        discount:         Number(row.discount ?? 0),
        total:            Number(row.subtotal),
        payment_method:   row.payment_method,
        payment_status:   row.payment_status,
        notes:            row.notes,
        customer_name:    row.customer_name,
        customer_email:   row.customer_email,
        customer_phone:   row.customer_phone,
        recipient_name:   row.recipient_name,
        phone:            row.phone,
        address_line:     row.address_line,
        landmark:         row.landmark,
        city:             row.city,
        state:            row.state,
        created_at:       row.created_at,
        updated_at:       row.updated_at,
      };

      /* Fetch items with product images */
      const { rows: itemRows } = await pool.query(
        `SELECT
           oi.id,
           oi.product_id,
           oi.quantity,
           oi.price,
           oi.image,
           oi.variant_id,
           oi.variant_name,
           oi.sku,
           COALESCE(p.name, 'Product') AS name,
           (
             SELECT pi.image_url
             FROM market.product_images pi
             WHERE pi.product_id = oi.product_id AND pi.is_primary = true
             LIMIT 1
           ) AS product_image
         FROM public.order_items oi
         LEFT JOIN market.products p ON p.id = oi.product_id
         WHERE oi.order_id = $1
         ORDER BY oi.id`,
        [orderId]
      );

      items = itemRows.map((it) => ({
        id:            it.id,
        product_id:    it.product_id,
        name:          it.name,
        variant_name:  it.variant_name,
        sku:           it.sku,
        quantity:      Number(it.quantity),
        price:         Number(it.price),
        image:         it.image || it.product_image || null,
      }));

    } else {
      /* ── Legacy schema — market.orders ── */
      const { rows: [row] } = await pool.query(
        `SELECT
           o.id, o.status, o.total, o.created_at, o.updated_at,
           COALESCE(o.reference, CONCAT('ORD-', LEFT(o.id::text, 8))) AS tracking_id,
           u.name AS customer_name,
           u.email AS customer_email
         FROM market.orders o
         LEFT JOIN market.users u ON u.id = o.buyer_id
         WHERE o.id = $1 AND o.vendor_id = $2`,
        [orderId, vendorId]
      );

      if (!row) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      order = {
        id:             row.id,
        tracking_id:    row.tracking_id,
        status:         row.status,
        total:          Number(row.total),
        grand_total:    Number(row.total),
        subtotal:       Number(row.total),
        customer_name:  row.customer_name,
        customer_email: row.customer_email,
        created_at:     row.created_at,
        updated_at:     row.updated_at,
      };

      const { rows: itemRows } = await pool.query(
        `SELECT
           oi.id,
           oi.product_id,
           oi.quantity,
           oi.price,
           p.title AS name,
           p.images->0 AS image
         FROM market.order_items oi
         LEFT JOIN market.products p ON p.id = oi.product_id
         WHERE oi.order_id = $1 AND oi.vendor_id = $2
         ORDER BY oi.id`,
        [orderId, vendorId]
      );

      items = itemRows.map((it) => ({
        id:         it.id,
        product_id: it.product_id,
        name:       it.name,
        quantity:   Number(it.quantity),
        price:      Number(it.price),
        image:      it.image,
      }));
    }

    order.items = items;

    return res.json({
      success: true,
      order,
    });

  } catch (err) {
    console.error("[dashboard/orders/:id]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      debug: { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/seller-dashboard/orders/:id/status
   ─────────────────────────────────────────────────
   Updates order status + sends buyer notification
════════════════════════════════════════════════════════════ */
router.patch("/orders/:id/status", ...guard, async (req, res) => {
  try {
    const { status }   = req.body;
    const vendorId     = req.vendor.id;
    const sellerUserId = req.user.id;
    const orderId      = req.params.id;

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

    const schema = await getOrderSchema();

    let updatedOrder = null;
    let buyerInfo    = null;

    if (schema.ordersTable === "public.orders") {
      /* NEW schema update */
      const { rows: [row] } = await pool.query(
        `UPDATE public.orders
         SET status = $1
         WHERE id = $2 AND seller_id = $3
         RETURNING id, status, order_group_id`,
        [status, orderId, sellerUserId]
      );

      if (!row) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      updatedOrder = row;

      /* Fetch buyer info for notification */
      const { rows: [buyer] } = await pool.query(
        `SELECT
           og.tracking_id,
           og.user_id AS buyer_id,
           u.email AS buyer_email,
           u.name AS buyer_name
         FROM public.order_groups og
         LEFT JOIN market.users u ON u.id = og.user_id
         WHERE og.id = $1`,
        [row.order_group_id]
      );

      buyerInfo = buyer;

    } else {
      /* Legacy schema update */
      const { rows: [row] } = await pool.query(
        `UPDATE market.orders
         SET status     = $1,
             updated_at = NOW()
         WHERE id        = $2
           AND vendor_id = $3
         RETURNING id, status, updated_at, buyer_id`,
        [status, orderId, vendorId]
      );

      if (!row) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      updatedOrder = row;

      const { rows: [buyer] } = await pool.query(
        `SELECT id AS buyer_id, email AS buyer_email, name AS buyer_name
         FROM market.users
         WHERE id = $1`,
        [row.buyer_id]
      );

      buyerInfo = { ...buyer, tracking_id: `ORD-${row.id.slice(0, 8).toUpperCase()}` };
    }

    /* ── Send buyer notification (non-blocking) ── */
    const notifier = await getNotifier();
    if (notifier && buyerInfo?.buyer_email) {
      const trackId = buyerInfo.tracking_id ?? `ORD-${updatedOrder.id.slice(0, 8).toUpperCase()}`;

      /* Custom messages per status */
      const messages = {
        processing:       "Your order is being prepared for shipping.",
        shipped:          "Your order has been shipped and is on its way to you.",
        out_for_delivery: "Your order is out for delivery today!",
        delivered:        "Your order has been delivered. Thank you for shopping!",
        cancelled:        "Your order has been cancelled by the seller.",
      };

      /* Send email */
      if (notifier.sendOrderStatusEmail) {
        notifier.sendOrderStatusEmail({
          to:      buyerInfo.buyer_email,
          name:    buyerInfo.buyer_name,
          orderId: trackId,
          status:  status.charAt(0).toUpperCase() + status.slice(1).replace("_", " "),
          message: messages[status],
        }).catch((err) => {
          console.warn("[dashboard] Status email failed:", err.message);
        });
      }

      /* In-app notification */
      if (notifier.createNotification && buyerInfo.buyer_id) {
        const emojis = {
          processing:       "📦",
          shipped:          "🚚",
          out_for_delivery: "🛵",
          delivered:        "🎁",
          cancelled:        "❌",
        };

        notifier.createNotification({
          userId:  buyerInfo.buyer_id,
          type:    `order_${status}`,
          title:   `${emojis[status] ?? "📋"} Order ${status.replace("_", " ")}`,
          message: `Order ${trackId}: ${messages[status] ?? `Status updated to ${status}`}`,
          link:    `/shop/orders/${updatedOrder.order_group_id ?? updatedOrder.id}`,
          meta:    { orderId: updatedOrder.id, status, trackingId: trackId },
        }).catch((err) => {
          console.warn("[dashboard] Status notif failed:", err.message);
        });
      }
    }

    return res.json({
      success: true,
      order:   updatedOrder,
    });

  } catch (err) {
    console.error("[dashboard/orders/:id/status]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
      debug: { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/notifications
   Legacy endpoint — kept for backwards compatibility
════════════════════════════════════════════════════════════ */
router.get("/notifications", ...guard, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 15, 30);

    const { rows: notifications } = await pool.query(
      `SELECT
         id, type, title, message,
         read, read_at, metadata, created_at
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
    return res.json({
      success:       true,
      notifications: [],
      unread_count:  0,
    });
  }
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/seller-dashboard/notifications/:id/read
════════════════════════════════════════════════════════════ */
router.patch(
  "/notifications/:id/read",
  authenticate,
  requireSellerAccount,
  async (req, res) => {
    try {
      await pool.query(
        `UPDATE public.notifications
         SET read = TRUE, read_at = NOW()
         WHERE id = $1 AND user_id = $2 AND user_type = 'seller'`,
        [req.params.id, req.user.id]
      );

      return res.json({ success: true });
    } catch (err) {
      console.error("[dashboard/notifications/:id/read]", err.message);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;