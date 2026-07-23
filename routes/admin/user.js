// ════════════════════════════════════════════════════════════
// FILE: routes/admin/admins.js
// Base: /api/admin/admins
// ════════════════════════════════════════════════════════════

import express         from "express";
import bcrypt          from "bcrypt";
import { pool }        from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

/* ─── allowed role names (must match admin_roles.role_name) ─── */
const ALLOWED_ROLES = [
  "admin",
  "content_moderator",
  "finance_admin",
  "support_admin",
  "super_admin",
];

// ─────────────────────────────────────────────────────────────
// GET /api/admin/admins
// ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT
         a.id,
         a.name,
         a.email,
         a.status,
         a.created_at,
         a.last_login,
         a.banned_at,
         r.role_name  AS role,
         c.name       AS created_by
       FROM admins a
       LEFT JOIN admin_roles r  ON r.id = a.role_id
       LEFT JOIN admins      c  ON c.id = a.created_by
       ORDER BY a.created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error("[GET /admin/admins]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/admins/register
// Body: { name, email, password, role }
// ─────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, email, password, role } = req.body;

    // Validate fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "All fields are required." });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }

    // Only super_admin can create another super_admin
    if (role === "super_admin" && req.admin.role !== "super_admin") {
      return res.status(403).json({ error: "Only a Super Admin can create another Super Admin." });
    }

    // Check duplicate email
    const { rows: existing } = await client.query(
      `SELECT id FROM admins WHERE email = $1`,
      [email.toLowerCase().trim()],
    );
    if (existing.length) {
      return res.status(409).json({ error: "An admin with this email already exists." });
    }

    // Look up the role_id from admin_roles
    const { rows: roleRows } = await client.query(
      `SELECT id FROM admin_roles WHERE role_name = $1`,
      [role],
    );
    if (!roleRows.length) {
      return res.status(400).json({ error: `Role "${role}" not found in admin_roles table.` });
    }
    const roleId = roleRows[0].id;

    // Hash password
    const hash = await bcrypt.hash(password, 12);

    // Insert new admin
    const { rows } = await client.query(
      `INSERT INTO admins
         (name, email, password_hash, role_id, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', $5, NOW(), NOW())
       RETURNING id, name, email, status, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        hash,
        roleId,
        req.admin.id,
      ],
    );

    // Log it
    await client.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'create_admin', 'admin', $2, $3)`,
      [req.admin.id, rows[0].id, `Created admin "${name}" with role "${role}"`],
    ).catch(() => {});

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("[POST /admin/admins/register]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/admins/:id/role
// Body: { role }
// ─────────────────────────────────────────────────────────────
router.patch("/:id/role", async (req, res) => {
  const client = await pool.connect();
  try {
    const { role }  = req.body;
    const targetId  = req.params.id;

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }

    // Only super_admin can assign super_admin role
    if (role === "super_admin" && req.admin.role !== "super_admin") {
      return res.status(403).json({ error: "Only a Super Admin can assign this role." });
    }

    // Prevent editing yourself
    if (targetId === String(req.admin.id)) {
      return res.status(400).json({ error: "You cannot edit your own role." });
    }

    // Look up role_id
    const { rows: roleRows } = await client.query(
      `SELECT id FROM admin_roles WHERE role_name = $1`,
      [role],
    );
    if (!roleRows.length) {
      return res.status(400).json({ error: `Role "${role}" not found in admin_roles table.` });
    }
    const roleId = roleRows[0].id;

    // Update
    const { rows } = await client.query(
      `UPDATE admins
       SET role_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, status`,
      [roleId, targetId],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Admin not found." });
    }

    // Log it
    await client.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'edit_admin_role', 'admin', $2, $3)`,
      [req.admin.id, targetId, `Changed role to "${role}" for admin ${targetId}`],
    ).catch(() => {});

    res.json(rows[0]);
  } catch (err) {
    console.error("[PATCH /admin/admins/:id/role]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/admins/:id/ban
// ─────────────────────────────────────────────────────────────
router.post("/:id/ban", async (req, res) => {
  const client = await pool.connect();
  try {
    const targetId = req.params.id;

    // Prevent banning yourself
    if (targetId === String(req.admin.id)) {
      return res.status(400).json({ error: "You cannot deactivate your own account." });
    }

    // Prevent removing the last super_admin
    const { rows: superAdmins } = await client.query(
      `SELECT a.id
       FROM admins a
       JOIN admin_roles r ON r.id = a.role_id
       WHERE r.role_name = 'super_admin'
       AND a.status = 'active'`,
    );
    const { rows: target } = await client.query(
      `SELECT r.role_name
       FROM admins a
       JOIN admin_roles r ON r.id = a.role_id
       WHERE a.id = $1`,
      [targetId],
    );
    if (
      target[0]?.role_name === "super_admin" &&
      superAdmins.length === 1
    ) {
      return res.status(400).json({ error: "Cannot deactivate the last Super Admin." });
    }

    await client.query(
      `UPDATE admins
       SET status = 'banned', banned_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [targetId],
    );

    await client.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'ban_admin', 'admin', $2, $3)`,
      [req.admin.id, targetId, `Deactivated admin ${targetId}`],
    ).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error("[POST /admin/admins/:id/ban]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/admins/:id/unban
// ─────────────────────────────────────────────────────────────
router.post("/:id/unban", async (req, res) => {
  const client = await pool.connect();
  try {
    const targetId = req.params.id;

    await client.query(
      `UPDATE admins
       SET status = 'active', banned_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [targetId],
    );

    await client.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'unban_admin', 'admin', $2, $3)`,
      [req.admin.id, targetId, `Reactivated admin ${targetId}`],
    ).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error("[POST /admin/admins/:id/unban]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;