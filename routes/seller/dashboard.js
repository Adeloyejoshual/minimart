/**
 * routes/seller/dashboard.js  — v4
 * ─────────────────────────────────────────────────────────────
 * ✓ Self-contained JWT auth (same secret as sellerAuth.routes.js)
 * ✓ Vendor is OPTIONAL — dashboard works without vendor row
 * ✓ No dependency on middleware/sellerAuth.js or middleware/auth.js
 * ✓ Dual-schema support (public.orders + market.orders)
 * ✓ Column detection for products (name/title)
 * ✓ Notifications user_type column optional
 */

import express from "express";
import jwt     from "jsonwebtoken";
import { pool } from "../../config/db.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

/* ════════════════════════════════════════════════════════════
   AUTH MIDDLEWARE
   ✅ Self-contained — uses SAME JWT_SECRET as sellerAuth.routes.js
   No dependency on middleware/*.js files that may or may not exist.
════════════════════════════════════════════════════════════ */
async function authenticateSeller(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      code:    "NO_TOKEN",
      message: "Authentication required",
    });
  }

  try {
    const token   = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { rows } = await pool.query(
      `SELECT id, name, email, status
       FROM market.users
       WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        code:    "USER_NOT_FOUND",
        message: "Seller account not found",
      });
    }

    if (rows[0].status !== "active") {
      return res.status(403).json({
        success: false,
        code:    "ACCOUNT_SUSPENDED",
        message: "Your account has been suspended",
      });
    }

    req.user = {
      id:    rows[0].id,
      name:  rows[0].name,
      email: rows[0].email,
    };

    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        code:    err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
        message: "Invalid or expired token",
      });
    }
    console.error("[dashboard auth]", err.message);
    return res.status(500).json({ success: false, message: "Auth error" });
  }
}

/* ════════════════════════════════════════════════════════════
   OPTIONAL VENDOR ATTACHMENT
   ✅ FIX: Vendor is OPTIONAL — dashboard should work even when
   the seller hasn't completed store setup yet.
   Sets req.vendor to null if not found (no 403/404).
════════════════════════════════════════════════════════════ */
async function attachVendor(req, _res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT
         id,
         status,
         store_name,
         COALESCE(commission_rate, 0) AS commission_rate
       FROM market.vendors
       WHERE user_id = $1`,
      [req.user.id]
    );

    req.vendor = rows[0] ?? null;
    next();
  } catch (err) {
    console.warn("[dashboard/attachVendor]", err.message);
    req.vendor = null;
    next();
  }
}

/* ✅ Apply auth + optional vendor to ALL routes */
router.use(authenticateSeller);
router.use(attachVendor);

/* ════════════════════════════════════════════════════════════
   SCHEMA DETECTION (cached per server lifetime)
════════════════════════════════════════════════════════════ */
let SCHEMA_INFO = null;

async function detectSchema() {
  if (SCHEMA_INFO) return SCHEMA_INFO;

  try {
    const { rows } = await pool.query(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_name   IN ('orders', 'order_items', 'order_groups')
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

    console.log("[dashboard] Schema:", SCHEMA_INFO);
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

async function getOrderSchema() {
  const info = await detectSchema();
  if (info.hasPublicOrders && info.hasPublicOrderItems) {
    return {
      ordersTable : "public.orders",
      itemsTable  : "public.order_items",
      groupsTable : info.hasPublicOrderGroups ? "public.order_groups" : null,
      sellerCol   : "seller_id",
      totalCol    : "subtotal",
      hasGroups   : info.hasPublicOrderGroups,
    };
  }
  return {
    ordersTable : "market.orders",
    itemsTable  : "market.order_items",
    groupsTable : null,
    sellerCol   : "vendor_id",
    totalCol    : "total",
    hasGroups   : false,
  };
}

/* ════════════════════════════════════════════════════════════
   COLUMN DETECTION — products table
════════════════════════════════════════════════════════════ */
let PRODUCT_COLS = null;

async function getProductCols() {
  if (PRODUCT_COLS) return PRODUCT_COLS;
  try {
    const { rows } = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'market'
         AND table_name   = 'products'`
    );
    const cols = new Set(rows.map((r) => r.column_name));
    PRODUCT_COLS = {
      nameCol      : cols.has("name")     ? "name"    : cols.has("title") ? "title" : "name",
      priceCol     : cols.has("price")    ? "price"   : "price",
      hasImages    : cols.has("images"),
      hasUserId    : cols.has("user_id"),
      hasVendorId  : cols.has("vendor_id"),
      hasViewCount : cols.has("view_count"),
      hasIsActive  : cols.has("is_active"),
      hasStatus    : cols.has("status"),
    };
    console.log("[dashboard] product cols:", PRODUCT_COLS);
  } catch (err) {
    console.warn("[dashboard] product col detection failed:", err.message);
    PRODUCT_COLS = {
      nameCol: "name", priceCol: "price",
      hasImages: true, hasUserId: true, hasVendorId: false,
      hasViewCount: true, hasIsActive: true, hasStatus: false,
    };
  }
  return PRODUCT_COLS;
}

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const rangeFilter = (range, alias = "o") => {
  const map = {
    "7d":  `AND ${alias}.created_at > NOW() - INTERVAL '7 days'`,
    "30d": `AND ${alias}.created_at > NOW() - INTERVAL '30 days'`,
    "90d": `AND ${alias}.created_at > NOW() - INTERVAL '90 days'`,
  };
  return map[range] ?? "";
};

const prevRangeFilter = (range, alias = "o") => {
  const map = {
    "7d":  `AND ${alias}.created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'`,
    "30d": `AND ${alias}.created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days'`,
    "90d": `AND ${alias}.created_at BETWEEN NOW() - INTERVAL '180 days' AND NOW() - INTERVAL '90 days'`,
  };
  return map[range] ?? "AND FALSE";
};

const pctChange = (current, previous) => {
  const c = Number(current  ?? 0);
  const p = Number(previous ?? 0);
  if (!p) return c > 0 ? 100 : 0;
  return Math.round(((c - p) / p) * 100);
};

const n = (v, fallback = 0) => Number(v ?? fallback);

async function getNotifier() {
  try {
    return await import("../../services/notificationService.js");
  } catch (err) {
    return null;
  }
}

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/stats
   ✅ Works without vendor — returns zeros if no orders
════════════════════════════════════════════════════════════ */
router.get("/stats", async (req, res) => {
  try {
    const range      = req.query.range ?? "30d";
    const sellerId   = req.user.id;
    const currFilter = rangeFilter(range,     "o");
    const prevFilter = prevRangeFilter(range, "o");

    const schema = await getOrderSchema();
    const pCols  = await getProductCols();

    let curr = {}, prev = {}, viewData = { total_views: 0 }, ratingData = { avg_rating: 0, review_count: 0 };

    if (schema.ordersTable === "public.orders") {
      /* ── New schema ── */
      try {
        const { rows } = await pool.query(
          `SELECT
             COALESCE(SUM(o.subtotal), 0)                      AS total_revenue,
             COUNT(o.id)                                        AS total_orders,
             COUNT(DISTINCT og.user_id)                        AS total_customers,
             COUNT(o.id) FILTER (WHERE o.status = 'pending')   AS pending_orders,
             CASE WHEN COUNT(o.id) > 0
                  THEN ROUND(SUM(o.subtotal)::numeric / COUNT(o.id), 2)
                  ELSE 0
             END                                               AS avg_order_value
           FROM public.orders o
           LEFT JOIN public.order_groups og ON og.id = o.order_group_id
           WHERE o.seller_id = $1
             AND o.status   != 'cancelled'
             ${currFilter}`,
          [sellerId]
        );
        curr = rows[0] ?? {};
      } catch (e) { console.warn("[dashboard/stats] curr:", e.message); }

      try {
        const { rows } = await pool.query(
          `SELECT
             COALESCE(SUM(o.subtotal), 0) AS prev_revenue,
             COUNT(o.id)                  AS prev_orders,
             COUNT(DISTINCT og.user_id)   AS prev_customers
           FROM public.orders o
           LEFT JOIN public.order_groups og ON og.id = o.order_group_id
           WHERE o.seller_id = $1 AND o.status != 'cancelled' ${prevFilter}`,
          [sellerId]
        );
        prev = rows[0] ?? {};
      } catch (e) { console.warn("[dashboard/stats] prev:", e.message); }

      /* Views — only if columns exist */
      if (pCols.hasViewCount && pCols.hasUserId) {
        try {
          const activeClause = pCols.hasIsActive
            ? "AND is_active = true"
            : pCols.hasStatus
              ? "AND status = 'active'"
              : "";
          const { rows } = await pool.query(
            `SELECT COALESCE(SUM(view_count), 0) AS total_views
             FROM market.products
             WHERE user_id = $1 ${activeClause}`,
            [sellerId]
          );
          viewData = rows[0] ?? { total_views: 0 };
        } catch (e) { console.warn("[dashboard/stats] views:", e.message); }
      }

      /* Ratings — from market.reviews if exists */
      try {
        const { rows } = await pool.query(
          `SELECT
             COALESCE(AVG(r.rating), 0) AS avg_rating,
             COUNT(r.id)                AS review_count
           FROM market.reviews r
           JOIN market.products p ON p.id = r.product_id
           WHERE p.user_id = $1`,
          [sellerId]
        );
        ratingData = rows[0] ?? ratingData;
      } catch (e) { /* reviews table may not exist */ }

    } else {
      /* ── Legacy schema — needs vendor ── */
      if (!req.vendor) {
        return res.json({
          success: true,
          stats: {
            total_revenue: 0, total_orders: 0, total_customers: 0,
            pending_orders: 0, avg_order_value: 0, conversion_rate: 0,
            avg_rating: 0, review_count: 0,
            revenue_change: 0, orders_change: 0, customers_change: 0,
          },
        });
      }
      const vendorId = req.vendor.id;

      try {
        const { rows } = await pool.query(
          `SELECT
             COALESCE(SUM(o.total), 0)                         AS total_revenue,
             COUNT(o.id)                                        AS total_orders,
             COUNT(DISTINCT o.buyer_id)                         AS total_customers,
             COUNT(o.id) FILTER (WHERE o.status = 'pending')   AS pending_orders,
             CASE WHEN COUNT(o.id) > 0
                  THEN ROUND(SUM(o.total)::numeric / COUNT(o.id), 2)
                  ELSE 0
             END                                               AS avg_order_value
           FROM market.orders o
           WHERE o.vendor_id = $1 AND o.status != 'cancelled' ${currFilter}`,
          [vendorId]
        );
        curr = rows[0] ?? {};
      } catch (e) { console.warn("[dashboard/stats] legacy curr:", e.message); }

      try {
        const { rows } = await pool.query(
          `SELECT
             COALESCE(SUM(o.total), 0) AS prev_revenue,
             COUNT(o.id)               AS prev_orders,
             COUNT(DISTINCT o.buyer_id)AS prev_customers
           FROM market.orders o
           WHERE o.vendor_id = $1 AND o.status != 'cancelled' ${prevFilter}`,
          [vendorId]
        );
        prev = rows[0] ?? {};
      } catch (e) { console.warn("[dashboard/stats] legacy prev:", e.message); }
    }

    const totalOrders    = n(curr?.total_orders);
    const totalViews     = n(viewData?.total_views);
    const conversionRate = totalViews > 0
      ? parseFloat(((totalOrders / totalViews) * 100).toFixed(2))
      : 0;

    return res.json({
      success : true,
      stats   : {
        total_revenue    : n(curr?.total_revenue),
        total_orders     : totalOrders,
        total_customers  : n(curr?.total_customers),
        pending_orders   : n(curr?.pending_orders),
        avg_order_value  : n(curr?.avg_order_value),
        conversion_rate  : conversionRate,
        avg_rating       : parseFloat(n(ratingData?.avg_rating).toFixed(1)),
        review_count     : n(ratingData?.review_count),
        revenue_change   : pctChange(curr?.total_revenue,   prev?.prev_revenue),
        orders_change    : pctChange(curr?.total_orders,    prev?.prev_orders),
        customers_change : pctChange(curr?.total_customers, prev?.prev_customers),
      },
    });
  } catch (err) {
    console.error("[dashboard/stats]", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to load stats",
      debug   : { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/revenue-chart
════════════════════════════════════════════════════════════ */
router.get("/revenue-chart", async (req, res) => {
  try {
    const range    = req.query.range ?? "30d";
    const sellerId = req.user.id;
    const schema   = await getOrderSchema();

    const cfg = {
      "7d":  { trunc: "day",   interval: "7 days",    fmt: "Dy DD"  },
      "30d": { trunc: "day",   interval: "30 days",   fmt: "DD Mon" },
      "90d": { trunc: "week",  interval: "90 days",   fmt: "DD Mon" },
      "all": { trunc: "month", interval: "3650 days", fmt: "Mon YY" },
    }[range] ?? { trunc: "day", interval: "30 days", fmt: "DD Mon" };

    let rows = [];

    if (schema.ordersTable === "public.orders") {
      const result = await pool.query(
        `SELECT
           TO_CHAR(
             DATE_TRUNC($1, o.created_at AT TIME ZONE 'Africa/Lagos'), $2
           )                                     AS label,
           COALESCE(SUM(o.subtotal), 0)::float   AS revenue,
           COUNT(o.id)::int                      AS orders
         FROM public.orders o
         WHERE o.seller_id  = $3
           AND o.status    != 'cancelled'
           AND o.created_at > NOW() - INTERVAL '${cfg.interval}'
         GROUP BY DATE_TRUNC($1, o.created_at AT TIME ZONE 'Africa/Lagos')
         ORDER BY DATE_TRUNC($1, o.created_at AT TIME ZONE 'Africa/Lagos') ASC`,
        [cfg.trunc, cfg.fmt, sellerId]
      );
      rows = result.rows;
    } else if (req.vendor) {
      const result = await pool.query(
        `SELECT
           TO_CHAR(
             DATE_TRUNC($1, o.created_at AT TIME ZONE 'Africa/Lagos'), $2
           )                                   AS label,
           COALESCE(SUM(o.total), 0)::float    AS revenue,
           COUNT(o.id)::int                    AS orders
         FROM market.orders o
         WHERE o.vendor_id  = $3
           AND o.status    != 'cancelled'
           AND o.created_at > NOW() - INTERVAL '${cfg.interval}'
         GROUP BY DATE_TRUNC($1, o.created_at AT TIME ZONE 'Africa/Lagos')
         ORDER BY DATE_TRUNC($1, o.created_at AT TIME ZONE 'Africa/Lagos') ASC`,
        [cfg.trunc, cfg.fmt, req.vendor.id]
      );
      rows = result.rows;
    }

    return res.json({
      success : true,
      chart   : rows.map((r) => ({
        label   : r.label,
        revenue : Number(r.revenue),
        orders  : Number(r.orders),
      })),
    });
  } catch (err) {
    console.error("[dashboard/revenue-chart]", err.message);
    return res.json({ success: true, chart: [] });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/top-products
════════════════════════════════════════════════════════════ */
router.get("/top-products", async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit) || 10, 25);
    const range    = req.query.range ?? "30d";
    const sellerId = req.user.id;
    const filter   = rangeFilter(range, "o");
    const pCols    = await getProductCols();
    const schema   = await getOrderSchema();

    let rows = [];

    if (schema.ordersTable === "public.orders" && pCols.hasUserId) {
      const imgSubquery = pCols.hasImages
        ? `(SELECT image_url FROM market.product_images
            WHERE product_id = p.id AND is_primary = true LIMIT 1)`
        : "NULL";

      const result = await pool.query(
        `SELECT
           p.id,
           p.${pCols.nameCol}                              AS name,
           p.${pCols.priceCol}                             AS price,
           ${imgSubquery}                                  AS image,
           COALESCE(SUM(oi.quantity), 0)                   AS total_sold,
           COALESCE(SUM(oi.quantity * oi.price), 0)        AS revenue,
           COUNT(DISTINCT oi.order_id)                     AS order_count
         FROM market.products p
         LEFT JOIN public.order_items oi ON oi.product_id = p.id
         LEFT JOIN public.orders      o  ON o.id = oi.order_id
                                        AND o.status != 'cancelled'
                                        ${filter}
         WHERE p.user_id = $1
         GROUP  BY p.id, p.${pCols.nameCol}, p.${pCols.priceCol}
         ORDER  BY revenue DESC
         LIMIT  $2`,
        [sellerId, limit]
      );
      rows = result.rows;
    } else if (req.vendor && pCols.hasVendorId) {
      const result = await pool.query(
        `SELECT
           p.id,
           p.${pCols.nameCol}                              AS name,
           p.${pCols.priceCol}                             AS price,
           p.images->0                                     AS image,
           COALESCE(SUM(oi.quantity), 0)                   AS total_sold,
           COALESCE(SUM(oi.quantity * oi.price), 0)        AS revenue,
           COUNT(DISTINCT oi.order_id)                     AS order_count
         FROM market.products    p
         LEFT JOIN market.order_items oi ON oi.product_id = p.id
         LEFT JOIN market.orders      o  ON o.id = oi.order_id
                                        AND o.status != 'cancelled'
                                        ${filter}
         WHERE p.vendor_id = $1
         GROUP  BY p.id, p.${pCols.nameCol}, p.${pCols.priceCol}, p.images
         ORDER  BY revenue DESC
         LIMIT  $2`,
        [req.vendor.id, limit]
      );
      rows = result.rows;
    }

    return res.json({
      success  : true,
      products : rows.map((r) => ({
        id          : r.id,
        name        : r.name,
        price       : Number(r.price),
        image       : r.image ?? null,
        total_sold  : Number(r.total_sold),
        revenue     : Number(r.revenue),
        order_count : Number(r.order_count),
      })),
    });
  } catch (err) {
    console.error("[dashboard/top-products]", err.message);
    return res.json({ success: true, products: [] });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/order-breakdown
════════════════════════════════════════════════════════════ */
router.get("/order-breakdown", async (req, res) => {
  try {
    const range  = req.query.range ?? "30d";
    const filter = rangeFilter(range, "o");
    const schema = await getOrderSchema();

    const isNew = schema.ordersTable === "public.orders";
    const id    = isNew ? req.user.id : req.vendor?.id;

    if (!id) {
      return res.json({ success: true, breakdown: {} });
    }

    const { rows } = await pool.query(
      `SELECT o.status, COUNT(o.id)::int AS count
       FROM ${schema.ordersTable} o
       WHERE o.${schema.sellerCol} = $1 ${filter}
       GROUP BY o.status`,
      [id]
    );

    const breakdown = {};
    for (const r of rows) breakdown[r.status] = Number(r.count);

    return res.json({ success: true, breakdown });
  } catch (err) {
    console.error("[dashboard/order-breakdown]", err.message);
    return res.json({ success: true, breakdown: {} });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/recent-orders
════════════════════════════════════════════════════════════ */
router.get("/recent-orders", async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit) || 10, 25);
    const sellerId = req.user.id;
    const schema   = await getOrderSchema();

    let rows = [];

    if (schema.ordersTable === "public.orders") {
      const result = await pool.query(
        `SELECT
           o.id,
           o.status,
           o.subtotal                                            AS grand_total,
           o.created_at,
           COALESCE(og.tracking_id,
             CONCAT('ORD-', UPPER(LEFT(o.id::text, 8))))        AS reference,
           og.payment_method,
           og.payment_status,
           u.name                                               AS customer_name,
           (SELECT COUNT(*)::int FROM public.order_items oi
            WHERE oi.order_id = o.id)                           AS item_count
         FROM public.orders o
         LEFT JOIN public.order_groups og ON og.id = o.order_group_id
         LEFT JOIN market.users u         ON u.id  = og.user_id
         WHERE o.seller_id = $1
         ORDER BY o.created_at DESC
         LIMIT $2`,
        [sellerId, limit]
      );
      rows = result.rows;

      return res.json({
        success : true,
        orders  : rows.map((r) => ({
          id              : r.id,
          reference       : r.reference,
          order_status    : r.status,
          grand_total     : Number(r.grand_total),
          vendor_earnings : Number(r.grand_total),
          item_count      : Number(r.item_count),
          customer_name   : r.customer_name ?? "Guest",
          payment_method  : r.payment_method,
          payment_status  : r.payment_status,
          created_at      : r.created_at,
        })),
      });
    }

    if (!req.vendor) {
      return res.json({ success: true, orders: [] });
    }

    const result = await pool.query(
      `SELECT
         o.id, o.status, o.total, o.created_at,
         COALESCE(o.reference, CONCAT('ORD-', LEFT(o.id::text, 8))) AS reference,
         u.name AS customer_name,
         COALESCE(SUM(oi.quantity * oi.price), 0) AS vendor_earnings,
         COUNT(oi.id)::int AS item_count
       FROM market.orders o
       JOIN market.order_items oi ON oi.order_id = o.id
       LEFT JOIN market.users u   ON u.id = o.buyer_id
       WHERE o.vendor_id = $1
       GROUP BY o.id, o.status, o.total, o.created_at, o.reference, u.name
       ORDER BY o.created_at DESC
       LIMIT $2`,
      [req.vendor.id, limit]
    );

    return res.json({
      success : true,
      orders  : result.rows.map((r) => ({
        id              : r.id,
        reference       : r.reference,
        order_status    : r.status,
        grand_total     : Number(r.total),
        vendor_earnings : Number(r.vendor_earnings),
        item_count      : Number(r.item_count),
        customer_name   : r.customer_name ?? "Guest",
        created_at      : r.created_at,
      })),
    });
  } catch (err) {
    console.error("[dashboard/recent-orders]", err.message);
    return res.json({ success: true, orders: [] });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/orders — paginated list
════════════════════════════════════════════════════════════ */
router.get("/orders", async (req, res) => {
  try {
    const status   = req.query.status ?? "all";
    const limit    = Math.min(parseInt(req.query.limit)  || 10, 50);
    const offset   = Math.max(parseInt(req.query.offset) || 0,   0);
    const sellerId = req.user.id;
    const schema   = await getOrderSchema();

    let orders = [];
    let total  = 0;

    if (schema.ordersTable === "public.orders") {
      const params = [sellerId];
      let   where  = "WHERE o.seller_id = $1";

      if (status !== "all") {
        params.push(status);
        where += ` AND o.status = $${params.length}`;
      }

      const groupJoin = schema.hasGroups
        ? `LEFT JOIN public.order_groups og ON og.id = o.order_group_id
           LEFT JOIN market.users        u  ON u.id  = og.user_id`
        : "LEFT JOIN market.users u ON u.id = o.user_id";

      const groupCols = schema.hasGroups
        ? `og.tracking_id, og.payment_method, og.payment_status,
           og.grand_total AS group_grand_total`
        : `NULL AS tracking_id, NULL AS payment_method,
           NULL AS payment_status, o.subtotal AS group_grand_total`;

      const { rows } = await pool.query(
        `SELECT
           o.id, o.status, o.subtotal, o.created_at,
           ${groupCols},
           u.name AS buyer_name,
           (SELECT COUNT(*)::int FROM public.order_items oi
            WHERE oi.order_id = o.id) AS item_count
         FROM public.orders o
         ${groupJoin}
         ${where}
         ORDER BY o.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      orders = rows.map((r) => ({
        id             : r.id,
        tracking_id    : r.tracking_id ?? `ORD-${r.id.slice(0, 8).toUpperCase()}`,
        status         : r.status,
        subtotal       : Number(r.subtotal),
        grand_total    : Number(r.group_grand_total ?? r.subtotal),
        item_count     : Number(r.item_count),
        buyer_name     : r.buyer_name ?? "Guest",
        customer_name  : r.buyer_name ?? "Guest",
        payment_method : r.payment_method,
        payment_status : r.payment_status,
        created_at     : r.created_at,
      }));

      const { rows: [{ total: t }] } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM public.orders o ${where}`,
        params
      );
      total = Number(t);

    } else if (req.vendor) {
      const vendorId = req.vendor.id;
      const params   = [vendorId];
      let   where    = "WHERE o.vendor_id = $1";

      if (status !== "all") {
        params.push(status);
        where += ` AND o.status = $${params.length}`;
      }

      const { rows } = await pool.query(
        `SELECT
           o.id, o.status, o.total AS subtotal, o.created_at,
           COALESCE(o.reference, CONCAT('ORD-', LEFT(o.id::text, 8))) AS tracking_id,
           u.name AS buyer_name,
           (SELECT COUNT(*)::int FROM market.order_items oi
            WHERE oi.order_id = o.id) AS item_count
         FROM market.orders o
         LEFT JOIN market.users u ON u.id = o.buyer_id
         ${where}
         ORDER BY o.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      orders = rows.map((r) => ({
        id            : r.id,
        tracking_id   : r.tracking_id,
        status        : r.status,
        subtotal      : Number(r.subtotal),
        grand_total   : Number(r.subtotal),
        item_count    : Number(r.item_count),
        buyer_name    : r.buyer_name ?? "Guest",
        customer_name : r.buyer_name ?? "Guest",
        created_at    : r.created_at,
      }));

      const { rows: [{ total: t }] } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM market.orders o ${where}`,
        params
      );
      total = Number(t);
    }

    return res.json({
      success    : true,
      orders,
      total,
      pagination : { total, limit, offset, has_more: offset + limit < total },
    });

  } catch (err) {
    console.error("[dashboard/orders]", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to fetch orders",
      debug   : { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/orders/:id
════════════════════════════════════════════════════════════ */
router.get("/orders/:id", async (req, res) => {
  try {
    const orderId  = req.params.id;
    const sellerId = req.user.id;
    const schema   = await getOrderSchema();

    let order = null;
    let items = [];

    if (schema.ordersTable === "public.orders") {
      const { rows: [row] } = await pool.query(
        `SELECT
           o.id, o.status, o.subtotal, o.created_at, o.updated_at,
           og.id            AS group_id,
           og.tracking_id, og.grand_total, og.delivery_fee, og.discount,
           og.payment_method, og.payment_status, og.notes,
           og.user_id       AS buyer_id,
           u.name           AS buyer_name,
           u.email          AS buyer_email,
           a.recipient_name, a.phone, a.address_line,
           a.landmark, a.city, a.state, a.call_before_delivery
         FROM public.orders o
         LEFT JOIN public.order_groups   og ON og.id  = o.order_group_id
         LEFT JOIN market.users          u  ON u.id   = og.user_id
         LEFT JOIN public.user_addresses a  ON a.id   = og.address_id
         WHERE o.id = $1 AND o.seller_id = $2`,
        [orderId, sellerId]
      );

      if (!row) return res.status(404).json({ success: false, message: "Order not found" });

      order = {
        id               : row.id,
        tracking_id      : row.tracking_id ?? `ORD-${row.id.slice(0, 8).toUpperCase()}`,
        status           : row.status,
        subtotal         : Number(row.subtotal),
        grand_total      : Number(row.grand_total ?? row.subtotal),
        delivery_fee     : Number(row.delivery_fee ?? 0),
        discount         : Number(row.discount ?? 0),
        payment_method   : row.payment_method,
        payment_status   : row.payment_status,
        notes            : row.notes,
        buyer_name       : row.buyer_name,
        buyer_email      : row.buyer_email,
        customer_name    : row.buyer_name,
        customer_email   : row.buyer_email,
        recipient_name   : row.recipient_name,
        phone            : row.phone,
        address_line     : row.address_line,
        landmark         : row.landmark,
        city             : row.city,
        state            : row.state,
        call_before_delivery : row.call_before_delivery,
        created_at       : row.created_at,
        updated_at       : row.updated_at,
      };

      const { rows: itemRows } = await pool.query(
        `SELECT
           oi.id, oi.product_id,
           COALESCE(oi.quantity, oi.qty, 1)         AS quantity,
           COALESCE(oi.price, oi.unit_price, 0)     AS price,
           COALESCE(oi.image, oi.image_url)         AS image,
           oi.variant_id, oi.variant_name, oi.sku,
           COALESCE(p.name, 'Product')              AS product_name
         FROM public.order_items oi
         LEFT JOIN market.products p ON p.id = oi.product_id
         WHERE oi.order_id = $1
         ORDER BY oi.id`,
        [orderId]
      );

      items = itemRows.map((it) => ({
        id           : it.id,
        product_id   : it.product_id,
        name         : it.product_name,
        product_name : it.product_name,
        variant_name : it.variant_name,
        sku          : it.sku,
        quantity     : Number(it.quantity),
        price        : Number(it.price),
        image        : it.image ?? null,
        line_total   : Number(it.price) * Number(it.quantity),
      }));

    } else if (req.vendor) {
      const { rows: [row] } = await pool.query(
        `SELECT
           o.id, o.status, o.total, o.created_at, o.updated_at,
           COALESCE(o.reference, CONCAT('ORD-', LEFT(o.id::text, 8))) AS tracking_id,
           u.name AS buyer_name, u.email AS buyer_email
         FROM market.orders o
         LEFT JOIN market.users u ON u.id = o.buyer_id
         WHERE o.id = $1 AND o.vendor_id = $2`,
        [orderId, req.vendor.id]
      );

      if (!row) return res.status(404).json({ success: false, message: "Order not found" });

      const pCols = await getProductCols();

      order = {
        id             : row.id,
        tracking_id    : row.tracking_id,
        status         : row.status,
        subtotal       : Number(row.total),
        grand_total    : Number(row.total),
        buyer_name     : row.buyer_name,
        buyer_email    : row.buyer_email,
        customer_name  : row.buyer_name,
        customer_email : row.buyer_email,
        created_at     : row.created_at,
        updated_at     : row.updated_at,
      };

      const { rows: itemRows } = await pool.query(
        `SELECT
           oi.id, oi.product_id, oi.quantity, oi.price,
           p.${pCols.nameCol} AS product_name,
           p.images->0 AS image
         FROM market.order_items oi
         LEFT JOIN market.products p ON p.id = oi.product_id
         WHERE oi.order_id = $1
         ORDER BY oi.id`,
        [orderId]
      );

      items = itemRows.map((it) => ({
        id           : it.id,
        product_id   : it.product_id,
        name         : it.product_name,
        product_name : it.product_name,
        quantity     : Number(it.quantity),
        price        : Number(it.price),
        image        : it.image ?? null,
        line_total   : Number(it.price) * Number(it.quantity),
      }));
    } else {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.items = items;
    return res.json({ success: true, order, data: order });

  } catch (err) {
    console.error("[dashboard/orders/:id]", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to fetch order",
      debug   : { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/seller-dashboard/orders/:id/status
════════════════════════════════════════════════════════════ */
router.patch("/orders/:id/status", async (req, res) => {
  try {
    const { status: newStatus } = req.body;
    const sellerId              = req.user.id;
    const orderId               = req.params.id;

    const VALID_STATUSES = [
      "pending", "confirmed", "processing",
      "shipped", "delivered", "cancelled",
    ];

    if (!VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        success : false,
        message : `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        data    : { validStatuses: VALID_STATUSES },
      });
    }

    const schema = await getOrderSchema();

    let updatedOrder   = null;
    let previousStatus = null;
    let buyerInfo      = null;

    if (schema.ordersTable === "public.orders") {
      const { rows: [current] } = await pool.query(
        `SELECT id, status, order_group_id
         FROM public.orders
         WHERE id = $1 AND seller_id = $2`,
        [orderId, sellerId]
      );

      if (!current) return res.status(404).json({ success: false, message: "Order not found" });

      previousStatus = current.status;

      const { rows: [updated] } = await pool.query(
        `UPDATE public.orders
         SET status = $1, updated_at = NOW()
         WHERE id = $2 AND seller_id = $3
         RETURNING id, status, order_group_id, updated_at`,
        [newStatus, orderId, sellerId]
      );
      updatedOrder = updated;

      const { rows: [buyer] } = await pool.query(
        `SELECT og.tracking_id, og.user_id AS buyer_id,
                u.email AS buyer_email, u.name AS buyer_name
         FROM public.order_groups og
         LEFT JOIN market.users u ON u.id = og.user_id
         WHERE og.id = $1`,
        [current.order_group_id]
      );
      buyerInfo = buyer;

    } else if (req.vendor) {
      const { rows: [current] } = await pool.query(
        `SELECT id, status FROM market.orders
         WHERE id = $1 AND vendor_id = $2`,
        [orderId, req.vendor.id]
      );

      if (!current) return res.status(404).json({ success: false, message: "Order not found" });

      previousStatus = current.status;

      const { rows: [updated] } = await pool.query(
        `UPDATE market.orders
         SET status = $1, updated_at = NOW()
         WHERE id = $2 AND vendor_id = $3
         RETURNING id, status, updated_at, buyer_id`,
        [newStatus, orderId, req.vendor.id]
      );
      updatedOrder = updated;

      const { rows: [buyer] } = await pool.query(
        `SELECT id AS buyer_id, email AS buyer_email, name AS buyer_name
         FROM market.users WHERE id = $1`,
        [updated.buyer_id]
      );

      buyerInfo = {
        ...buyer,
        tracking_id: `ORD-${updated.id.slice(0, 8).toUpperCase()}`,
      };
    } else {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    /* Notify buyer (non-blocking) */
    const notifier = await getNotifier();
    if (notifier && buyerInfo?.buyer_email) {
      const trackId = buyerInfo.tracking_id
        ?? `ORD-${updatedOrder.id.slice(0, 8).toUpperCase()}`;

      const msgs = {
        confirmed  : "Your order has been confirmed by the seller.",
        processing : "Your order is being prepared for shipping.",
        shipped    : "Your order has been shipped!",
        delivered  : "Your order has been delivered. Thank you!",
        cancelled  : "Your order has been cancelled by the seller.",
      };

      const emojis = {
        confirmed: "✔️", processing: "📦",
        shipped: "🚚", delivered: "🎁", cancelled: "❌",
      };

      if (notifier.sendOrderStatusEmail) {
        notifier.sendOrderStatusEmail({
          to      : buyerInfo.buyer_email,
          name    : buyerInfo.buyer_name,
          orderId : trackId,
          status  : newStatus.charAt(0).toUpperCase() + newStatus.slice(1),
          message : msgs[newStatus],
        }).catch((err) => console.warn("[dashboard] email failed:", err.message));
      }

      if (notifier.createNotification && buyerInfo.buyer_id) {
        notifier.createNotification({
          userId  : buyerInfo.buyer_id,
          type    : `order_${newStatus}`,
          title   : `${emojis[newStatus] ?? "📋"} Order ${newStatus}`,
          message : `Order ${trackId}: ${msgs[newStatus] ?? `Status updated to ${newStatus}`}`,
          link    : `/shop/orders/${updatedOrder.order_group_id ?? updatedOrder.id}`,
          meta    : { orderId: updatedOrder.id, status: newStatus, trackingId: trackId },
        }).catch((err) => console.warn("[dashboard] notif failed:", err.message));
      }
    }

    return res.json({
      success : true,
      message : `Order status updated to "${newStatus}"`,
      data    : {
        orderId        : updatedOrder.id,
        previousStatus,
        newStatus      : updatedOrder.status,
        updatedAt      : updatedOrder.updated_at,
        allowedNext    : {
          pending    : ["confirmed", "cancelled"],
          confirmed  : ["processing", "cancelled"],
          processing : ["shipped", "cancelled"],
          shipped    : ["delivered"],
          delivered  : [],
          cancelled  : [],
        }[updatedOrder.status] ?? [],
      },
      order : updatedOrder,
    });

  } catch (err) {
    console.error("[dashboard/orders/:id/status]", err.message);
    return res.status(500).json({
      success : false,
      message : "Failed to update order status",
      debug   : { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/seller-dashboard/notifications
════════════════════════════════════════════════════════════ */
router.get("/notifications", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 15, 30);

    let notifications = [];
    try {
      const { rows } = await pool.query(
        `SELECT id, type, title, message, read, read_at, created_at
         FROM public.notifications
         WHERE user_id = $1 AND user_type = 'seller'
         ORDER BY created_at DESC
         LIMIT $2`,
        [req.user.id, limit]
      );
      notifications = rows;
    } catch (colErr) {
      if (colErr.code === "42703") {
        try {
          const { rows } = await pool.query(
            `SELECT id, type, title, message, read, read_at, created_at
             FROM public.notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [req.user.id, limit]
          );
          notifications = rows;
        } catch { notifications = []; }
      } else if (colErr.code === "42P01") {
        notifications = [];
      } else {
        throw colErr;
      }
    }

    return res.json({
      success      : true,
      notifications,
      unread_count : notifications.filter((n) => !n.read).length,
    });
  } catch (err) {
    console.error("[dashboard/notifications]", err.message);
    return res.json({
      success      : true,
      notifications: [],
      unread_count : 0,
    });
  }
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/seller-dashboard/notifications/:id/read
════════════════════════════════════════════════════════════ */
router.patch("/notifications/:id/read", async (req, res) => {
  try {
    try {
      await pool.query(
        `UPDATE public.notifications
         SET read = TRUE, read_at = NOW()
         WHERE id = $1 AND user_id = $2 AND user_type = 'seller'`,
        [req.params.id, req.user.id]
      );
    } catch (colErr) {
      if (colErr.code === "42703") {
        await pool.query(
          `UPDATE public.notifications
           SET read = TRUE, read_at = NOW()
           WHERE id = $1 AND user_id = $2`,
          [req.params.id, req.user.id]
        );
      } else throw colErr;
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("[dashboard/notifications/:id/read]", err.message);
    return res.json({ success: true }); /* Non-critical */
  }
});

export default router;