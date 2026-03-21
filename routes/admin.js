// src/routes/admin.js
import express from "express";
import { pool } from "../server.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ------------------ HELPERS ------------------
const generateToken = (admin) =>
  jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

// Log action
const logAction = async (adminId, action, table, targetId, details) => {
  try {
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_table, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, action, table, targetId, details]
    );
  } catch (err) {
    console.error("Log error:", err);
  }
};

// ------------------ MIDDLEWARE ------------------
export const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Only super_admin
const requireSuperAdmin = (req, res, next) => {
  if (req.admin.role !== "super_admin")
    return res.status(403).json({ error: "Forbidden" });
  next();
};

// ------------------ AUTH ------------------

// LOGIN
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

    const token = generateToken(admin);

    // 🔥 GET PERMISSIONS IMMEDIATELY
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

    res.json({
      admin,
      token,
      permissions: perms.map(p => p.name),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET CURRENT ADMIN
router.get("/me", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role FROM admins WHERE id = $1`,
      [req.admin.id]
    );

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

    res.json({
      admin,
      permissions: perms.map(p => p.name),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ------------------ DASHBOARD APIs ------------------

// STATS
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const users = await pool.query(`SELECT COUNT(*) FROM users`);
    const orders = await pool.query(`SELECT COUNT(*) FROM orders`);
    const revenue = await pool.query(`SELECT COALESCE(SUM(amount),0) FROM payments`);

    res.json({
      users: Number(users.rows[0].count),
      orders: Number(orders.rows[0].count),
      revenue: Number(revenue.rows[0].coalesce),
      dailySales: [] // can enhance later
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// USERS
router.get("/users", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`SELECT id, name, email, status FROM users`);
  res.json(rows);
});

// BAN USER
router.post("/users/:id/ban", verifyAdmin, async (req, res) => {
  const { id } = req.params;

  await pool.query(`UPDATE users SET status = 'banned' WHERE id = $1`, [id]);

  await logAction(req.admin.id, "ban", "users", id, "User banned");

  res.json({ success: true });
});

// PRODUCTS
router.get("/products/pending", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT p.id, p.name, u.name AS seller_name
    FROM products p
    JOIN users u ON p.user_id = u.id
    WHERE p.status = 'pending'
  `);

  res.json(rows);
});

// APPROVE PRODUCT
router.post("/products/:id/approve", verifyAdmin, async (req, res) => {
  const { id } = req.params;

  await pool.query(`UPDATE products SET status = 'approved' WHERE id = $1`, [id]);

  await logAction(req.admin.id, "approve", "products", id, "Product approved");

  res.json({ success: true });
});

// REJECT PRODUCT
router.post("/products/:id/reject", verifyAdmin, async (req, res) => {
  const { id } = req.params;

  await pool.query(`UPDATE products SET status = 'rejected' WHERE id = $1`, [id]);

  await logAction(req.admin.id, "reject", "products", id, "Product rejected");

  res.json({ success: true });
});

// LOGS
router.get("/logs", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT l.*, a.name AS admin_name
    FROM admin_logs l
    JOIN admins a ON l.admin_id = a.id
    ORDER BY l.created_at DESC
    LIMIT 50
  `);

  res.json(rows);
});


// ------------------ ROLES & PERMISSIONS ------------------

// Create role
router.post("/roles", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { role_name, description } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO admin_roles (role_name, description)
     VALUES ($1, $2) RETURNING *`,
    [role_name, description]
  );

  res.json(rows[0]);
});

// Create permission
router.post("/permissions", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { name, description } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO permissions (name, description)
     VALUES ($1, $2) RETURNING *`,
    [name, description]
  );

  res.json(rows[0]);
});

// Assign permission
router.post("/roles/assign-permission", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { role_id, permission_id } = req.body;

  await pool.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [role_id, permission_id]
  );

  res.json({ success: true });
});

export default router;