// src/routes/admin.js
import express from "express";
import { pool } from "../server.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ------------------ Generate Token ------------------
const generateToken = (admin) => {
  return jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ------------------ Middleware ------------------
export const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ------------------ LOGIN ------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, role FROM public.admins WHERE email = $1`,
      [email]
    );

    const admin = rows[0];

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(admin);

    res.json({
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });

  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------ GET CURRENT ADMIN ------------------
router.get("/me", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, created_at
       FROM public.admins
       WHERE id = $1`,
      [req.admin.id]
    );

    res.json(rows[0]);

  } catch (err) {
    console.error("Admin /me error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------ REGISTER ADMIN ------------------
router.post("/register", verifyAdmin, async (req, res) => {
  if (req.admin.role !== "super_admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO public.admins (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, hash, role]
    );

    const newAdmin = rows[0];

    // Log action
    await pool.query(
      `INSERT INTO public.admin_logs (admin_id, action, target_table, target_id, details)
       VALUES ($1, 'create', 'admins', $2, $3)`,
      [
        req.admin.id,
        newAdmin.id,
        `Created admin ${newAdmin.email}`,
      ]
    );

    res.json(newAdmin);

  } catch (err) {
    console.error("Admin register error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------ GET ALL ADMINS ------------------
router.get("/", verifyAdmin, async (req, res) => {
  if (req.admin.role !== "super_admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, created_at
       FROM public.admins
       ORDER BY created_at DESC`
    );

    res.json(rows);

  } catch (err) {
    console.error("Fetch admins error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;