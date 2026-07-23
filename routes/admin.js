// ════════════════════════════════════════════════════════════
// FILE: routes/admin.js
// Base: /api/admin
// ════════════════════════════════════════════════════════════

import express                              from "express";
import { pool }                             from "../config/db.js";
import bcrypt                               from "bcrypt";
import jwt                                  from "jsonwebtoken";
import { verifyAdmin, requireSuperAdmin }   from "./admin/middleware.js";

// ── Sub-routers ───────────────────────────────────────────────
import userRouter                           from "./admin/user.js";
import { publicProductRouter }              from "./admin/product.js";
import marketProductRouter                  from "./admin/marketproducts.js";
import paymentRouter                        from "./admin/payment.js";
import orderRouter                          from "./admin/order.js";
import reportRouter                         from "./admin/report.js";
import systemRouter                         from "./admin/system.js";
import { rolesRouter, permissionsRouter }   from "./admin/roles.js";
import promotionRouter                      from "./admin/promotion.js";
import verificationRouter                   from "./admin/verification.js";
import vendorVerificationRouter             from "./admin/vendorVerification.js";
import withdrawalRouter                     from "./admin/withdrawalRoutes.js";
import leaderboardRouter                    from "./admin/leaderboard.js";
import airtimeCouponAdminRouter             from "./admin/airtimeCoupons.js";
import couponRedemptionRouter               from "./admin/couponRedemption.js";
import subscriptionAdminRouter              from "./admin/subscriptionAdmin.js";
import supportAdminRouter                   from "./admin/support.js";

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

/* ─── allowed roles ──────────────────────────────────────── */
const ALLOWED_ROLES = [
  "admin",
  "content_moderator",
  "finance_admin",
  "support_admin",
  "super_admin",
];

const generateToken = (admin) =>
  jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════

// POST /api/admin/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         id, name, email, password_hash, role, status
       FROM admins
       WHERE email = $1`,
      [email.toLowerCase().trim()],
    );

    const admin = rows[0];

    if (!admin) {
      return res.status(404).json({ error: "Admin not found." });
    }
    if (admin.status === "banned") {
      return res.status(403).json({ error: "Account has been deactivated." });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    await pool.query(
      `UPDATE admins SET last_login = NOW() WHERE id = $1`,
      [admin.id],
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
      [req.admin.id],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Admin not found." });
    }

    const admin = rows[0];

    // Fetch permissions if you have them
    let permissions = [];
    try {
      const { rows: perms } = await pool.query(
        `SELECT DISTINCT p.name
         FROM role_permissions rp
         JOIN permissions p   ON rp.permission_id = p.id
         JOIN admin_roles  ar ON rp.role_id        = ar.id
         WHERE ar.role_name = $1
         UNION
         SELECT p.name
         FROM admin_permissions ap
         JOIN permissions p ON ap.permission_id = p.id
         WHERE ap.admin_id = $2`,
        [admin.role, admin.id],
      );
      permissions = perms.map((p) => p.name);
    } catch {
      // permissions tables may not exist yet — ignore
    }

    return res.json({ admin, permissions });

  } catch (err) {
    console.error("[admin me]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// DASHBOARD STATS  (unchanged — keep your existing code here)
// ══════════════════════════════════════════════════════════════
// ... your existing stats route stays exactly as it is ...

// ══════════════════════════════════════════════════════════════
// ADMIN MANAGEMENT
// ══════════════════════════════════════════════════════════════

// GET /api/admin/admins
router.get("/admins", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         a.id,
         a.name,
         a.email,
         a.role,
         a.status,
         a.created_at,
         a.last_login,
         a.banned_at,
         c.name AS created_by
       FROM admins a
       LEFT JOIN admins c ON c.id = a.created_by
       ORDER BY a.created_at DESC`,
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
    return res.status(400).json({ error: "Name, email and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid role." });
  }

  // Only super_admin can create another super_admin
  if (role === "super_admin" && req.admin.role !== "super_admin") {
    return res.status(403).json({ error: "Only a Super Admin can create another Super Admin." });
  }

  try {
    const { rows: existing } = await pool.query(
      `SELECT id FROM admins WHERE email = $1`,
      [email.toLowerCase().trim()],
    );
    if (existing.length) {
      return res.status(409).json({ error: "An admin with this email already exists." });
    }

    const hash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO admins
         (name, email, password_hash, role, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', $5, NOW(), NOW())
       RETURNING id, name, email, role, status, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        hash,
        role,
        req.admin.id,
      ],
    );

    // Log it
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'create_admin', 'admin', $2, $3)`,
      [req.admin.id, rows[0].id, `Created admin "${name}" with role "${role}"`],
    ).catch(() => {});

    return res.status(201).json(rows[0]);

  } catch (err) {
    console.error("[admin register]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/admins/:id/role
router.patch("/admins/:id/role", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { role }  = req.body;
  const targetId  = req.params.id;

  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid role." });
  }
  if (role === "super_admin" && req.admin.role !== "super_admin") {
    return res.status(403).json({ error: "Only a Super Admin can assign this role." });
  }
  if (targetId === String(req.admin.id)) {
    return res.status(400).json({ error: "You cannot edit your own role." });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE admins
       SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, role, status`,
      [role, targetId],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Admin not found." });
    }

    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'edit_admin_role', 'admin', $2, $3)`,
      [req.admin.id, targetId, `Changed role to "${role}" for admin ${targetId}`],
    ).catch(() => {});

    return res.json(rows[0]);

  } catch (err) {
    console.error("[admin role update]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/admins/:id/ban
router.post("/admins/:id/ban", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const targetId = req.params.id;

  if (targetId === String(req.admin.id)) {
    return res.status(400).json({ error: "You cannot deactivate your own account." });
  }

  try {
    // Prevent removing the last super_admin
    const { rows: target } = await pool.query(
      `SELECT role FROM admins WHERE id = $1`,
      [targetId],
    );
    if (target[0]?.role === "super_admin") {
      const { rows: supers } = await pool.query(
        `SELECT id FROM admins
         WHERE role = 'super_admin' AND status = 'active'`,
      );
      if (supers.length === 1) {
        return res.status(400).json({ error: "Cannot deactivate the last Super Admin." });
      }
    }

    await pool.query(
      `UPDATE admins
       SET status = 'banned', banned_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [targetId],
    );

    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'ban_admin', 'admin', $2, $3)`,
      [req.admin.id, targetId, `Deactivated admin ${targetId}`],
    ).catch(() => {});

    return res.json({ success: true });

  } catch (err) {
    console.error("[admin ban]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/admins/:id/unban
router.post("/admins/:id/unban", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const targetId = req.params.id;

  try {
    await pool.query(
      `UPDATE admins
       SET status = 'active', banned_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [targetId],
    );

    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'unban_admin', 'admin', $2, $3)`,
      [req.admin.id, targetId, `Reactivated admin ${targetId}`],
    ).catch(() => {});

    return res.json({ success: true });

  } catch (err) {
    console.error("[admin unban]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/admins/:id/password
router.patch("/admins/:id/password", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const hash = await bcrypt.hash(password, 12);

    await pool.query(
      `UPDATE admins
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [hash, req.params.id],
    );

    return res.json({ success: true });

  } catch (err) {
    console.error("[admin password reset]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// AUDIT LOGS
// ══════════════════════════════════════════════════════════════

// GET /api/admin/logs
router.get("/logs", verifyAdmin, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
    const offset = Math.max(parseInt(req.query.offset) || 0,   0);

    let rows;
    try {
      ({ rows } = await pool.query(
        `SELECT
           l.id, l.action, l.details, l.created_at,
           a.name  AS admin_name,
           a.email AS admin_email
         FROM admin_logs l
         LEFT JOIN admins a ON a.id = l.admin_id
         ORDER BY l.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ));
    } catch {
      ({ rows } = await pool.query(
        `SELECT
           id, action, details, created_at,
           NULL AS admin_name,
           NULL AS admin_email
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
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
router.use("/users",             userRouter);
router.use("/products",          publicProductRouter);
router.use("/market-products",   marketProductRouter);
router.use("/payments",          paymentRouter);
router.use("/orders",            orderRouter);
router.use("/reports",           reportRouter);
router.use("/system",            systemRouter);
router.use("/roles",             rolesRouter);
router.use("/permissions",       permissionsRouter);
router.use("/plans",             promotionRouter);
router.use("/verification",      verificationRouter);
router.use("/vendors",           vendorVerificationRouter);
router.use("/withdrawals",       withdrawalRouter);
router.use("/leaderboard",       leaderboardRouter);
router.use("/airtime-coupons",   airtimeCouponAdminRouter);
router.use("/coupon-redemption", couponRedemptionRouter);
router.use("/subscriptions",     subscriptionAdminRouter);
router.use("/support",           supportAdminRouter);

export default router;