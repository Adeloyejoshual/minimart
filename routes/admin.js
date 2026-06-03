// routes/admin.js
import express                          from "express";
import { pool }                         from "../server.js";
import bcrypt                           from "bcrypt";
import jwt                              from "jsonwebtoken";
import { verifyAdmin, requireSuperAdmin } from "./admin/middleware.js";

// ── Sub-routers ───────────────────────────────────────────────
import userRouter                       from "./admin/user.js";
import { publicProductRouter }          from "./admin/product.js";
import marketProductRouter              from "./admin/marketproducts.js";
import paymentRouter                    from "./admin/payment.js";
import orderRouter                      from "./admin/order.js";
import reportRouter                     from "./admin/report.js";
import systemRouter                     from "./admin/system.js";
import { rolesRouter, permissionsRouter } from "./admin/roles.js";
import promotionRouter                  from "./admin/promotion.js";
import verificationRouter               from "./admin/verification.js";
import vendorVerificationRouter         from "./admin/vendorVerification.js";

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

const generateToken = (admin) =>
  jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════

// POST /api/admin/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM admins WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    const admin = rows[0];

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    if (admin.status === "banned") {
      return res.status(403).json({ error: "Account has been suspended" });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await pool.query(
      `UPDATE admins SET last_login = NOW() WHERE id = $1`,
      [admin.id]
    );

    return res.json({
      admin: {
        id:    admin.id,
        name:  admin.name,
        email: admin.email,
        role:  admin.role,
      },
      token: generateToken(admin),
    });

  } catch (err) {
    console.error("[admin login]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/me
router.get("/me", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, status, created_at
       FROM admins
       WHERE id = $1`,
      [req.admin.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const admin = rows[0];

    // Fetch permissions
    const { rows: perms } = await pool.query(
      `SELECT DISTINCT p.name
       FROM role_permissions rp
       JOIN permissions p  ON rp.permission_id = p.id
       JOIN admin_roles  ar ON rp.role_id       = ar.id
       WHERE ar.role_name = $1
       UNION
       SELECT p.name
       FROM admin_permissions ap
       JOIN permissions p ON ap.permission_id = p.id
       WHERE ap.admin_id = $2`,
      [admin.role, admin.id]
    );

    return res.json({
      admin,
      permissions: perms.map((p) => p.name),
    });

  } catch (err) {
    console.error("[admin me]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ══════════════════════════════════════════════════════════════

// GET /api/admin/stats
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const safe = (promise) =>
      promise.catch(() => ({ rows: [{ count: 0, revenue: 0 }] }));

    const [
      usersRes,
      activeUsersRes,
      bannedUsersRes,
      todayUsersRes,

      pubProductsRes,
      pubPendingRes,
      pubTodayRes,

      mktProductsRes,
      mktPendingRes,
      mktTodayRes,

      ordersRes,
      todayOrdersRes,

      revenueRes,
      todayRevenueRes,
      dailySalesRes,

      // Vendor stats
      vendorsTotalRes,
      vendorsPendingRes,
      vendorsActiveRes,
      vendorsReviewRes,
    ] = await Promise.all([
      // Users
      pool.query(`SELECT COUNT(*) FROM public.users`),
      pool.query(`SELECT COUNT(*) FROM public.users WHERE status != 'banned'`),
      pool.query(`SELECT COUNT(*) FROM public.users WHERE status = 'banned'`),
      pool.query(
        `SELECT COUNT(*) FROM public.users WHERE created_at >= $1`, [today]
      ),

      // Public products
      safe(pool.query(`SELECT COUNT(*) FROM public.products`)),
      safe(pool.query(`SELECT COUNT(*) FROM public.products WHERE status = 'pending'`)),
      safe(pool.query(
        `SELECT COUNT(*) FROM public.products WHERE created_at >= $1`, [today]
      )),

      // Market products
      safe(pool.query(`SELECT COUNT(*) FROM market.products`)),
      safe(pool.query(`SELECT COUNT(*) FROM market.products WHERE status = 'pending'`)),
      safe(pool.query(
        `SELECT COUNT(*) FROM market.products WHERE created_at >= $1`, [today]
      )),

      // Orders
      safe(pool.query(`SELECT COUNT(*) FROM orders`)),
      safe(pool.query(
        `SELECT COUNT(*) FROM orders WHERE created_at >= $1`, [today]
      )),

      // Revenue
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS revenue
         FROM payments
         WHERE status IN ('success', 'completed', 'paid')`
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS revenue
         FROM payments
         WHERE status IN ('success', 'completed', 'paid')
           AND created_at >= $1`,
        [today]
      ),
      pool.query(
        `SELECT DATE(created_at) AS date,
                COALESCE(SUM(amount), 0) AS amount
         FROM payments
         WHERE status IN ('success', 'completed', 'paid')
           AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`
      ),

      // Vendors
      safe(pool.query(`SELECT COUNT(*) FROM market.vendors`)),
      safe(pool.query(
        `SELECT COUNT(*) FROM market.vendors WHERE status = 'pending'`
      )),
      safe(pool.query(
        `SELECT COUNT(*) FROM market.vendors WHERE status = 'active'`
      )),
      safe(pool.query(
        `SELECT COUNT(*) FROM market.vendors WHERE status = 'under_review'`
      )),
    ]);

    return res.json({
      // Users
      users:       Number(usersRes.rows[0].count),
      activeUsers: Number(activeUsersRes.rows[0].count),
      bannedUsers: Number(bannedUsersRes.rows[0].count),
      todayUsers:  Number(todayUsersRes.rows[0].count),

      // Public products
      totalProducts:   Number(pubProductsRes.rows[0].count),
      pendingProducts: Number(pubPendingRes.rows[0].count),
      todayProducts:   Number(pubTodayRes.rows[0].count),

      // Market products
      marketTotalProducts:   Number(mktProductsRes.rows[0].count),
      marketPendingProducts: Number(mktPendingRes.rows[0].count),
      marketTodayProducts:   Number(mktTodayRes.rows[0].count),

      // Orders
      orders:      Number(ordersRes.rows[0].count),
      todayOrders: Number(todayOrdersRes.rows[0].count),

      // Revenue
      revenue:      Number(revenueRes.rows[0].revenue),
      todayRevenue: Number(todayRevenueRes.rows[0].revenue),
      dailySales:   dailySalesRes.rows.map((r) => ({
        date:   r.date,
        amount: Number(r.amount),
      })),

      // Vendors
      vendorsTotal:      Number(vendorsTotalRes.rows[0].count),
      vendorsPending:    Number(vendorsPendingRes.rows[0].count),
      vendorsActive:     Number(vendorsActiveRes.rows[0].count),
      vendorsUnderReview:Number(vendorsReviewRes.rows[0].count),
    });

  } catch (err) {
    console.error("[admin stats]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// ADMIN MANAGEMENT
// ══════════════════════════════════════════════════════════════

// GET /api/admin/admins
router.get("/admins", verifyAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, status, last_login, created_at
       FROM admins
       ORDER BY created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error("[admin list]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/register
router.post("/register", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({
      error: "name, email and password are required",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters",
    });
  }

  try {
    // Check duplicate email
    const { rows: existing } = await pool.query(
      `SELECT id FROM admins WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (existing.length) {
      return res.status(409).json({
        error: "An admin with this email already exists",
      });
    }

    const hash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO admins (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        hash,
        role ?? "moderator",
      ]
    );

    return res.status(201).json(rows[0]);

  } catch (err) {
    console.error("[admin register]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/admins/:id/ban
router.post(
  "/admins/:id/ban",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      // Prevent self-ban
      if (req.params.id === req.admin.id) {
        return res.status(400).json({ error: "Cannot ban yourself" });
      }

      await pool.query(
        `UPDATE admins
         SET status = 'banned', updated_at = NOW()
         WHERE id = $1`,
        [req.params.id]
      );

      return res.json({ success: true });

    } catch (err) {
      console.error("[admin ban]", err.message);
      return res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/admin/admins/:id/unban
router.post(
  "/admins/:id/unban",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      await pool.query(
        `UPDATE admins
         SET status = 'active', updated_at = NOW()
         WHERE id = $1`,
        [req.params.id]
      );

      return res.json({ success: true });

    } catch (err) {
      console.error("[admin unban]", err.message);
      return res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/admin/assign-role
router.post(
  "/assign-role",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const { admin_id, role } = req.body;

    if (!admin_id || !role) {
      return res.status(400).json({ error: "admin_id and role are required" });
    }

    try {
      await pool.query(
        `UPDATE admins SET role = $1, updated_at = NOW() WHERE id = $2`,
        [role, admin_id]
      );

      return res.json({ success: true });

    } catch (err) {
      console.error("[assign role]", err.message);
      return res.status(500).json({ error: err.message });
    }
  }
);

// PATCH /api/admin/admins/:id/password
router.patch(
  "/admins/:id/password",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters",
      });
    }

    try {
      const hash = await bcrypt.hash(password, 12);

      await pool.query(
        `UPDATE admins
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2`,
        [hash, req.params.id]
      );

      return res.json({ success: true });

    } catch (err) {
      console.error("[admin password reset]", err.message);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ══════════════════════════════════════════════════════════════
// AUDIT LOGS
// ══════════════════════════════════════════════════════════════

// GET /api/admin/logs
router.get("/logs", verifyAdmin, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
    const offset = Math.max(parseInt(req.query.offset) || 0,   0);

    // Try admin_logs first, fall back to audit_logs
    let rows;
    try {
      ({ rows } = await pool.query(
        `SELECT
           l.id, l.action, l.details, l.created_at,
           a.name AS admin_name, a.email AS admin_email
         FROM admin_logs l
         LEFT JOIN admins a ON a.id = l.admin_id
         ORDER BY l.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ));
    } catch {
      ({ rows } = await pool.query(
        `SELECT
           id, action, details, created_at,
           NULL AS admin_name, NULL AS admin_email
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ));
    }

    return res.json(rows);

  } catch (err) {
    console.error("[admin logs]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// MOUNT SUB-ROUTERS
// ══════════════════════════════════════════════════════════════
router.use("/users",           userRouter);
router.use("/products",        publicProductRouter);
router.use("/market-products", marketProductRouter);
router.use("/payments",        paymentRouter);
router.use("/orders",          orderRouter);
router.use("/reports",         reportRouter);
router.use("/system",          systemRouter);
router.use("/roles",           rolesRouter);
router.use("/permissions",     permissionsRouter);
router.use("/plans",           promotionRouter);
router.use("/verification",    verificationRouter);
router.use("/vendors",         vendorVerificationRouter);  // ← NEW

export default router;