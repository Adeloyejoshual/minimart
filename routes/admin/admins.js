// ════════════════════════════════════════════════════════════
// FILE: routes/admin/admins.js
// Base: /api/admin/admins
// ════════════════════════════════════════════════════════════

import express            from "express";
import bcrypt             from "bcrypt";
import { pool }           from "../../config/db.js";
import {
  verifyAdmin,
  requireSuperAdmin,
} from "./middleware.js";

const router = express.Router();

/* ─── allowed roles ──────────────────────────────────────── */
const ALLOWED_ROLES = [
  "admin",
  "content_moderator",
  "finance_admin",
  "support_admin",
  "super_admin",
];

// ─────────────────────────────────────────────────────────────
// GET /api/admin/admins
// Any admin can view the list
// ─────────────────────────────────────────────────────────────
router.get("/", verifyAdmin, async (req, res) => {
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
    res.json(rows);
  } catch (err) {
    console.error("[GET /admin/admins]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/admins/register
// Body: { name, email, password, role }
// ─────────────────────────────────────────────────────────────
router.post(
  "/register",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      // ── Validate ─────────────────────────────────────────
      if (!name?.trim() || !email?.trim() || !password) {
        return res.status(400).json({
          error: "Name, email and password are required.",
        });
      }
      if (password.length < 8) {
        return res.status(400).json({
          error: "Password must be at least 8 characters.",
        });
      }
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: "Invalid role." });
      }

      // Only super_admin can create another super_admin
      if (role === "super_admin" && req.admin.role !== "super_admin") {
        return res.status(403).json({
          error: "Only a Super Admin can create another Super Admin.",
        });
      }

      // ── Duplicate email check ────────────────────────────
      const { rows: existing } = await pool.query(
        `SELECT id FROM admins WHERE email = $1`,
        [email.toLowerCase().trim()],
      );
      if (existing.length) {
        return res.status(409).json({
          error: "An admin with this email already exists.",
        });
      }

      // ── Hash + insert ────────────────────────────────────
      const hash = await bcrypt.hash(password, 12);

      const { rows } = await pool.query(
        `INSERT INTO admins
           (name, email, password_hash, role, status,
            created_by, created_at, updated_at)
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

      // ── Log ──────────────────────────────────────────────
      await pool.query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'create_admin', 'admin', $2, $3)`,
        [
          req.admin.id,
          rows[0].id,
          `Created admin "${name.trim()}" with role "${role}"`,
        ],
      ).catch(() => {});

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("[POST /admin/admins/register]", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/admins/:id/role
// Body: { role }
// ─────────────────────────────────────────────────────────────
router.patch(
  "/:id/role",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { role } = req.body;
      const targetId = req.params.id;

      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: "Invalid role." });
      }
      if (role === "super_admin" && req.admin.role !== "super_admin") {
        return res.status(403).json({
          error: "Only a Super Admin can assign this role.",
        });
      }
      if (targetId === String(req.admin.id)) {
        return res.status(400).json({
          error: "You cannot edit your own role.",
        });
      }

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
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'edit_admin_role', 'admin', $2, $3)`,
        [
          req.admin.id,
          targetId,
          `Changed role to "${role}" for admin ${targetId}`,
        ],
      ).catch(() => {});

      res.json(rows[0]);
    } catch (err) {
      console.error("[PATCH /admin/admins/:id/role]", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ─────────────────────────────────────────────────────────────
// POST /api/admin/admins/:id/ban
// ─────────────────────────────────────────────────────────────
router.post(
  "/:id/ban",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const targetId = req.params.id;

      if (targetId === String(req.admin.id)) {
        return res.status(400).json({
          error: "You cannot deactivate your own account.",
        });
      }

      // Fetch target admin
      const { rows: target } = await pool.query(
        `SELECT role, status FROM admins WHERE id = $1`,
        [targetId],
      );
      if (!target.length) {
        return res.status(404).json({ error: "Admin not found." });
      }

      // Prevent removing the last super_admin
      if (target[0].role === "super_admin") {
        const { rows: supers } = await pool.query(
          `SELECT id FROM admins
           WHERE role = 'super_admin' AND status = 'active'`,
        );
        if (supers.length === 1) {
          return res.status(400).json({
            error: "Cannot deactivate the last Super Admin.",
          });
        }
      }

      if (target[0].status === "banned") {
        return res.status(400).json({
          error: "Admin is already deactivated.",
        });
      }

      await pool.query(
        `UPDATE admins
         SET status = 'banned',
             banned_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [targetId],
      );

      await pool.query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'ban_admin', 'admin', $2, $3)`,
        [req.admin.id, targetId, `Deactivated admin ${targetId}`],
      ).catch(() => {});

      res.json({ success: true });
    } catch (err) {
      console.error("[POST /admin/admins/:id/ban]", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ─────────────────────────────────────────────────────────────
// POST /api/admin/admins/:id/unban
// ─────────────────────────────────────────────────────────────
router.post(
  "/:id/unban",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const targetId = req.params.id;

      const { rows: target } = await pool.query(
        `SELECT status FROM admins WHERE id = $1`,
        [targetId],
      );
      if (!target.length) {
        return res.status(404).json({ error: "Admin not found." });
      }
      if (target[0].status === "active") {
        return res.status(400).json({
          error: "Admin is already active.",
        });
      }

      await pool.query(
        `UPDATE admins
         SET status = 'active',
             banned_at = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [targetId],
      );

      await pool.query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'unban_admin', 'admin', $2, $3)`,
        [req.admin.id, targetId, `Reactivated admin ${targetId}`],
      ).catch(() => {});

      res.json({ success: true });
    } catch (err) {
      console.error("[POST /admin/admins/:id/unban]", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/admins/:id/password
// Body: { password }
// ─────────────────────────────────────────────────────────────
router.patch(
  "/:id/password",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { password } = req.body;
      const targetId = req.params.id;

      if (!password || password.length < 8) {
        return res.status(400).json({
          error: "Password must be at least 8 characters.",
        });
      }

      const hash = await bcrypt.hash(password, 12);

      const { rows } = await pool.query(
        `UPDATE admins
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id`,
        [hash, targetId],
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Admin not found." });
      }

      await pool.query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'reset_admin_password', 'admin', $2, $3)`,
        [req.admin.id, targetId, `Reset password for admin ${targetId}`],
      ).catch(() => {});

      res.json({ success: true });
    } catch (err) {
      console.error("[PATCH /admin/admins/:id/password]", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;