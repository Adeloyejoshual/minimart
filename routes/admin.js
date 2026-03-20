import express from "express";
import { pool } from "../server.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();

// ------------------ CONFIG ------------------
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ------------------ HELPERS ------------------
const generateToken = (admin) => {
  return jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: admin.role_name,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ------------------ MIDDLEWARE ------------------
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
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ------------------ AUTH ------------------

// ✅ LOGIN (with role JOIN)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.name, a.email, a.password_hash, r.role_name
       FROM public.admins a
       JOIN public.admin_roles r ON a.role_id = r.id
       WHERE a.email = $1`,
      [email]
    );

    const admin = rows[0];

    if (!admin)
      return res.status(404).json({ error: "Admin not found" });

    const match = await bcrypt.compare(password, admin.password_hash);

    if (!match)
      return res.status(401).json({ error: "Invalid credentials" });

    const token = generateToken(admin);

    res.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role_name,
      },
      token,
    });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------ ADMINS ------------------

// ✅ CREATE ADMIN (super_admin only)
router.post("/register", verifyAdmin, async (req, res) => {
  if (req.admin.role !== "super_admin")
    return res.status(403).json({ error: "Forbidden" });

  const { name, email, password, role_id } = req.body;

  if (!name || !email || !password || !role_id)
    return res.status(400).json({ error: "All fields are required" });

  try {
    const hash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO public.admins (name, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role_id, created_at`,
      [name, email, hash, role_id]
    );

    const newAdmin = rows[0];

    // ✅ Log action
    await pool.query(
      `INSERT INTO public.admin_logs (admin_id, action, target_table, target_id, details)
       VALUES ($1, 'create', 'admins', $2, $3)`,
      [req.admin.id, newAdmin.id, `Created admin ${newAdmin.name}`]
    );

    res.json({ admin: newAdmin });
  } catch (err) {
    console.error("Admin register error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET ALL ADMINS
router.get("/", verifyAdmin, async (req, res) => {
  if (req.admin.role !== "super_admin")
    return res.status(403).json({ error: "Forbidden" });

  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.name, a.email, r.role_name, a.created_at
       FROM public.admins a
       JOIN public.admin_roles r ON a.role_id = r.id
       ORDER BY a.created_at DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Get admins error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------ ROLES ------------------

// ✅ CREATE ROLE (super_admin only)
router.post("/roles", verifyAdmin, async (req, res) => {
  if (req.admin.role !== "super_admin")
    return res.status(403).json({ error: "Forbidden" });

  const { role_name, description } = req.body;

  if (!role_name)
    return res.status(400).json({ error: "Role name required" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.admin_roles (role_name, description)
       VALUES ($1, $2)
       RETURNING id, role_name, description, created_at`,
      [role_name, description || ""]
    );

    res.json({ role: rows[0] });
  } catch (err) {
    console.error("Create role error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET ALL ROLES
router.get("/roles", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, role_name, description
       FROM public.admin_roles
       ORDER BY role_name ASC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Get roles error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------ EXPORT ------------------
export default router;