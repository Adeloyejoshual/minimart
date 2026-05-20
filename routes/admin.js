// src/routes/admin.js
import express from "express";
import { pool } from "../server.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const generateToken = (admin) =>
  jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

const cleanBigInt = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s : null;
};

const safeInt = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

export const verifyAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin     = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

const requireSuperAdmin = (req, res, next) => {
  if (req.admin?.role !== "super_admin")
    return res.status(403).json({ error: "Forbidden — super_admin only" });
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

// POST /admin/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM admins WHERE email = $1`,
      [email]
    );
    const admin = rows[0];
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    return res.json({ admin, token: generateToken(admin) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /admin/me
router.get("/me", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role FROM admins WHERE id = $1`,
      [req.admin.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Admin not found" });
    const admin = rows[0];

    const { rows: perms } = await pool.query(`
      SELECT DISTINCT p.name
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      JOIN admin_roles ar ON rp.role_id = ar.id
      WHERE ar.role_name = $1
      UNION
      SELECT p.name
      FROM admin_permissions ap
      JOIN permissions p ON ap.permission_id = p.id
      WHERE ap.admin_id = $2
    `, [admin.role, admin.id]);

    return res.json({ admin, permissions: perms.map(p => p.name) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS  — /admin/stats
// ─────────────────────────────────────────────────────────────────────────────

router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      usersRes,
      activeUsersRes,
      bannedUsersRes,
      todayUsersRes,
      productsRes,
      pendingRes,
      todayProductsRes,
      ordersRes,
      todayOrdersRes,
      revenueRes,
      todayRevenueRes,
      dailySalesRes,
    ] = await Promise.all([
      // total users
      pool.query(`SELECT COUNT(*) FROM users`),
      // active users
      pool.query(`SELECT COUNT(*) FROM users WHERE status != 'banned'`),
      // banned users
      pool.query(`SELECT COUNT(*) FROM users WHERE status = 'banned'`),
      // users joined today
      pool.query(`SELECT COUNT(*) FROM users WHERE created_at >= $1`, [today]),
      // total products
      pool.query(`SELECT COUNT(*) FROM products`),
      // pending products
      pool.query(`SELECT COUNT(*) FROM products WHERE status = 'pending'`),
      // products added today
      pool.query(`SELECT COUNT(*) FROM products WHERE created_at >= $1`, [today]),
      // total orders
      pool.query(`SELECT COUNT(*) FROM orders`).catch(() => ({ rows: [{ count: 0 }] })),
      // orders today
      pool.query(`SELECT COUNT(*) FROM orders WHERE created_at >= $1`, [today]).catch(() => ({ rows: [{ count: 0 }] })),
      // total revenue (successful payments)
      pool.query(`SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE status IN ('success','completed','paid')`),
      // revenue today
      pool.query(`SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE status IN ('success','completed','paid') AND created_at >= $1`, [today]),
      // daily sales last 30 days
      pool.query(`
        SELECT DATE(created_at) AS date,
               COALESCE(SUM(amount), 0) AS amount
        FROM payments
        WHERE status IN ('success','completed','paid')
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `),
    ]);

    return res.json({
      users:           Number(usersRes.rows[0].count),
      activeUsers:     Number(activeUsersRes.rows[0].count),
      bannedUsers:     Number(bannedUsersRes.rows[0].count),
      todayUsers:      Number(todayUsersRes.rows[0].count),
      totalProducts:   Number(productsRes.rows[0].count),
      pendingProducts: Number(pendingRes.rows[0].count),
      todayProducts:   Number(todayProductsRes.rows[0].count),
      orders:          Number(ordersRes.rows[0].count),
      todayOrders:     Number(todayOrdersRes.rows[0].count),
      revenue:         Number(revenueRes.rows[0].revenue),
      todayRevenue:    Number(todayRevenueRes.rows[0].revenue),
      dailySales:      dailySalesRes.rows.map(r => ({
        date:   r.date,
        amount: Number(r.amount),
      })),
    });
  } catch (err) {
    console.error("[ADMIN] Stats error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS  — /admin/users
// ─────────────────────────────────────────────────────────────────────────────

router.get("/users", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id, name, email, phone_number, city, state,
        status, balance, created_at, last_login,
        store_name, profile_picture
      FROM users
      ORDER BY created_at DESC
      LIMIT 500
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/users/:id/ban
router.post("/users/:id/ban", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET status = 'banned', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    // Log it
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'ban_user', 'user', $2, $3)`,
      [req.admin.id, req.params.id, `Banned user ${req.params.id}`]
    ).catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/users/:id/unban
router.post("/users/:id/unban", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMINS  — /admin/admins
// ─────────────────────────────────────────────────────────────────────────────

router.get("/admins", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, status, created_at FROM admins ORDER BY created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/register
router.post("/register", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "name, email, password required" });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO admins (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, hash, role || "moderator"]
    );
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/admins/:id/ban
router.post("/admins/:id/ban", verifyAdmin, requireSuperAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE admins SET status = 'banned', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/assign-role
router.post("/assign-role", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { admin_id, role } = req.body;
  try {
    await pool.query(
      `UPDATE admins SET role = $1 WHERE id = $2`,
      [role, admin_id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS  — /admin/products
// ─────────────────────────────────────────────────────────────────────────────

router.get("/products", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id, p.title AS name, p.price, p.status,
        p.is_active, p.is_promoted, p.thumbnail_url,
        p.location_city, p.location_state, p.created_at,
        u.name        AS seller_name,
        c.name        AS category_name
      FROM products p
      LEFT JOIN users      u ON u.id = p.seller_id
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC
      LIMIT 500
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /admin/products/pending
router.get("/products/pending", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id, p.title AS name, p.price, p.status,
        p.is_active, p.is_promoted, p.thumbnail_url,
        p.location_city, p.location_state, p.created_at,
        u.name        AS seller_name,
        c.name        AS category_name
      FROM products p
      LEFT JOIN users      u ON u.id = p.seller_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'pending'
      ORDER BY p.created_at ASC
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/products/:id/approve
router.post("/products/:id/approve", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE products
       SET status = 'active', is_active = true, updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'approve_product', 'product', $2, $3)`,
      [req.admin.id, req.params.id, `Approved product ${req.params.id}`]
    ).catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/products/:id/reject
router.post("/products/:id/reject", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE products
       SET status = 'rejected', is_active = false, updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'reject_product', 'product', $2, $3)`,
      [req.admin.id, req.params.id, `Rejected product ${req.params.id}`]
    ).catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS  — /admin/payments
// ─────────────────────────────────────────────────────────────────────────────

router.get("/payments", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id, p.amount, p.status, p.type, p.method,
        p.reference, p.created_at, p.updated_at,
        u.name  AS user,
        u.email AS user_email
      FROM payments p
      LEFT JOIN users u ON u.id = p.seller_id
      ORDER BY p.created_at DESC
      LIMIT 500
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/payments/:id/refund
router.post("/payments/:id/refund", verifyAdmin, requireSuperAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE payments
       SET status = 'refunded', updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'refund_payment', 'payment', $2, $3)`,
      [req.admin.id, req.params.id, `Refunded payment ${req.params.id}`]
    ).catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS  — /admin/orders
// ─────────────────────────────────────────────────────────────────────────────

router.get("/orders", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        o.id, o.status, o.total, o.created_at,
        u.name AS buyer_name,
        u.email AS buyer_email,
        COUNT(oi.id) AS item_count
      FROM orders o
      LEFT JOIN users      u  ON u.id  = o.buyer_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id, u.name, u.email
      ORDER BY o.created_at DESC
      LIMIT 300
    `).catch(() => ({ rows: [] }));
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/orders/:id/cancel
router.post("/orders/:id/cancel", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY LOGS  — /admin/logs
// ─────────────────────────────────────────────────────────────────────────────

router.get("/logs", verifyAdmin, async (req, res) => {
  try {
    // Try admin_logs table first, fall back to audit_logs
    const { rows } = await pool.query(`
      SELECT
        l.id,
        l.action,
        l.details,
        l.created_at,
        a.name AS admin_name
      FROM admin_logs l
      LEFT JOIN admins a ON a.id = l.admin_id
      ORDER BY l.created_at DESC
      LIMIT 200
    `).catch(() => pool.query(`
      SELECT id, action, details, created_at, NULL AS admin_name
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 200
    `));
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM CONFIG  — /admin/system
// ─────────────────────────────────────────────────────────────────────────────

router.get("/system", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM system_config`
    ).catch(() => ({ rows: [] }));

    // Build a clean object from key/value rows
    const config = {
      maintenance:   false,
      allowPosting:  true,
      allowPayments: true,
    };

    rows.forEach(({ key, value }) => {
      if (key === "maintenance")    config.maintenance   = value === "true";
      if (key === "allowPosting")   config.allowPosting  = value !== "false";
      if (key === "allowPayments")  config.allowPayments = value !== "false";
    });

    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/system
router.post("/system", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { maintenance, allowPosting, allowPayments } = req.body;

  try {
    const upsert = async (key, value) => {
      await pool.query(`
        INSERT INTO system_config (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [key, String(value)]);
    };

    await Promise.all([
      upsert("maintenance",   maintenance   ?? false),
      upsert("allowPosting",  allowPosting  ?? true),
      upsert("allowPayments", allowPayments ?? true),
    ]);

    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, details)
       VALUES ($1, 'system_config_update', $2)`,
      [req.admin.id, JSON.stringify({ maintenance, allowPosting, allowPayments })]
    ).catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROMOTION PLANS  — /admin/plans (proxies to promotion_plans table)
// ─────────────────────────────────────────────────────────────────────────────
// Note: GET /plans is already handled by payment.js (/api/payment/plans).
// The SuperAdmin dashboard calls PUT /api/payment/plans/:id directly.
// These routes are provided here as admin-only aliases if needed.

// GET /admin/plans
router.get("/plans", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id::text,
        name,
        price,
        discount_percent,
        duration,
        duration_days,
        priority,
        sort_order,
        features,
        is_active,
        (price * (1 - discount_percent / 100.0)) AS effective_price,
        created_at,
        updated_at
      FROM promotion_plans
      ORDER BY sort_order ASC, price ASC
    `);

    // Safely parse JSONB features that CockroachDB may return as a string
    const plans = rows.map(p => ({
      ...p,
      features: (() => {
        if (Array.isArray(p.features)) return p.features;
        if (typeof p.features === "string") {
          try { return JSON.parse(p.features); } catch { return []; }
        }
        return [];
      })(),
    }));

    return res.json({ success: true, plans });
  } catch (err) {
    console.error("[ADMIN] Plans error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /admin/plans/:id
router.put("/plans/:id", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const planId = cleanBigInt(req.params.id);
  if (!planId)
    return res.status(400).json({ error: "Invalid plan ID" });

  const {
    name,
    price,
    discount_percent,
    duration_days,
    duration,
    priority,
    sort_order,
    is_active,
    features,
  } = req.body;

  try {
    const safeFeatures = Array.isArray(features) ? features : [];

    await pool.query(`
      UPDATE promotion_plans
      SET name             = $1,
          price            = $2,
          discount_percent = $3,
          duration_days    = $4,
          duration         = $5,
          priority         = $6,
          sort_order       = $7,
          is_active        = $8,
          features         = $9::JSONB,
          updated_at       = NOW()
      WHERE id = $10
    `, [
      name,
      Number(price),
      Number(discount_percent ?? 0),
      Number(duration_days ?? 30),
      duration ?? "",
      Number(priority ?? 0),
      Number(sort_order ?? 0),
      !!is_active,
      JSON.stringify(safeFeatures),
      planId,
    ]);

    // Log the change
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'update_plan', 'promotion_plan', $2, $3)`,
      [
        req.admin.id,
        planId,
        `Updated plan "${name}" — price: ${price}, discount: ${discount_percent}%`,
      ]
    ).catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    console.error("[ADMIN] Plan update error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/plans/:id/toggle  — quick enable/disable
router.post("/plans/:id/toggle", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const planId = cleanBigInt(req.params.id);
  if (!planId)
    return res.status(400).json({ error: "Invalid plan ID" });

  try {
    const { rows } = await pool.query(
      `UPDATE promotion_plans
       SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1
       RETURNING id::text, name, is_active`,
      [planId]
    );
    if (!rows.length)
      return res.status(404).json({ error: "Plan not found" });

    return res.json({ success: true, plan: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROLES & PERMISSIONS  (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/roles", verifyAdmin, async (req, res) => {
  const { role_name, description } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_roles (role_name, description) VALUES ($1, $2) RETURNING *`,
      [role_name, description]
    );
    return res.json(rows[0]);
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

router.get("/roles", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM admin_roles`);
  return res.json(rows);
});

router.post("/permissions", verifyAdmin, async (req, res) => {
  const { name, description } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO permissions (name, description) VALUES ($1, $2) RETURNING *`,
      [name, description]
    );
    return res.json(rows[0]);
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

router.get("/permissions", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM permissions`);
  return res.json(rows);
});

router.post("/roles/assign-permission", verifyAdmin, async (req, res) => {
  const { role_id, permission_id } = req.body;
  try {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [role_id, permission_id]
    );
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

router.get("/roles/:id/permissions", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT p.id, p.name
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role_id = $1
  `, [req.params.id]);
  return res.json(rows);
});

export default router;