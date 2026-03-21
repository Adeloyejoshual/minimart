import express from "express";
import { pool } from "../server.js"; // your PostgreSQL pool
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ================== HELPERS ==================
const generateToken = (admin) =>
  jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

// Log admin action (optional)
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

// ================== MIDDLEWARE ==================

// Verify JWT
export const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ================== AUTH ==================

// Admin Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query(`SELECT * FROM admins WHERE email = $1`, [email]);
    const admin = rows[0];
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = generateToken(admin);
    const { password_hash, ...safeAdmin } = admin;

    await logAction(admin.id, "login", "admins", admin.id, "Admin logged in");

    res.json({ admin: safeAdmin, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current admin
router.get("/me", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role FROM admins WHERE id = $1`,
      [req.admin.id]
    );
    res.json({ admin: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== DASHBOARD ==================

// Get stats
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const usersRes = await pool.query(`SELECT COUNT(*) FROM users`);
    const ordersRes = await pool.query(`SELECT COUNT(*) FROM orders`);
    const revenueRes = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM payments`
    );

    res.json({
      users: Number(usersRes.rows[0].count),
      orders: Number(ordersRes.rows[0].count),
      revenue: Number(revenueRes.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users
router.get("/users", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, status FROM users ORDER BY id DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ban a user
router.post("/users/:id/ban", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE users SET status = 'banned' WHERE id = $1`, [id]);
    await logAction(req.admin.id, "ban", "users", id, "User banned");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;