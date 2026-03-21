// src/routes/admin.js
import express from "express";
import { pool } from "../server.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ------------------ Helpers ------------------
const generateToken = (admin) => {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ------------------ Middleware ------------------
export const verifyAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ------------------ AUTH ------------------

// Login
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

    res.json({ admin, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET CURRENT ADMIN + PERMISSIONS (🔥 IMPORTANT FIX)
router.get("/me", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role FROM admins WHERE id = $1`,
      [req.admin.id]
    );

    const admin = rows[0];

    // Get permissions
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


// ------------------ ADMINS ------------------

// Create admin
router.post("/register", verifyAdmin, async (req, res) => {
  if (req.admin.role !== "super_admin")
    return res.status(403).json({ error: "Forbidden" });

  const { name, email, password, role } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO admins (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, hash, role]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign role to admin
router.post("/assign-role", verifyAdmin, async (req, res) => {
  if (req.admin.role !== "super_admin")
    return res.status(403).json({ error: "Forbidden" });

  const { admin_id, role } = req.body;

  try {
    await pool.query(
      `UPDATE admins SET role = $1 WHERE id = $2`,
      [role, admin_id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ ROLES ------------------

// Create role
router.post("/roles", verifyAdmin, async (req, res) => {
  const { role_name, description } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_roles (role_name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [role_name, description]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get roles
router.get("/roles", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM admin_roles`);
  res.json(rows);
});

// ------------------ PERMISSIONS ------------------

// Create permission
router.post("/permissions", verifyAdmin, async (req, res) => {
  const { name, description } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO permissions (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [name, description]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get permissions
router.get("/permissions", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM permissions`);
  res.json(rows);
});

// ------------------ ROLE PERMISSIONS ------------------

// Assign permission to role
router.post("/roles/assign-permission", verifyAdmin, async (req, res) => {
  const { role_id, permission_id } = req.body;

  try {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [role_id, permission_id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get role permissions
router.get("/roles/:id/permissions", verifyAdmin, async (req, res) => {
  const { id } = req.params;

  const { rows } = await pool.query(`
    SELECT p.id, p.name
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role_id = $1
  `, [id]);

  res.json(rows);
});

export default router;