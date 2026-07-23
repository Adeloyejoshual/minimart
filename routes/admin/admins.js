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

/* ─── allowed roles ─── */
const ALLOWED_ROLES = [
  "admin",
  "content_moderator",
  "finance_admin",
  "support_admin",
  "super_admin",
];

// ─────────────────────────────────────────────────────────────
// Helper: look up role_id from role_name
// ─────────────────────────────────────────────────────────────
async function getRoleId(roleName) {
  const { rows } = await pool.query(
    `SELECT id FROM admin_roles WHERE role_name = $1`,
    [roleName],
  );
  return rows[0]?.id ?? null;
}

// ─────────────────────────────────────────────────────────────
// LOG EVERY REQUEST
// ─────────────────────────────────────────────────────────────
router.use((req, res, next) => {
  console.log(`\n📥 [admins router] ${req.method} ${req.originalUrl}`);
  console.log(`   Headers.auth: ${req.headers.authorization ? "yes" : "NO"}`);
  console.log(`   Body:`, req.body);
  next();
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/admins
// ─────────────────────────────────────────────────────────────
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         a.id, a.name, a.email, a.role, a.status,
         a.created_at, a.last_login, a.banned_at,
         c.name AS created_by
       FROM admins a
       LEFT JOIN admins c ON c.id = a.created_by
       ORDER BY a.created_at DESC`,
    );
    console.log(`   ✅ Returning ${rows.length} admins`);
    res.json(rows);
  } catch (err) {
    console.error(`   ❌ [GET /admin/admins]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/admins/register
// ─────────────────────────────────────────────────────────────
router.post(
  "/register",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    console.log(`   👤 Requester: ${req.admin?.email} (${req.admin?.role})`);

    try {
      const { name, email, password, role } = req.body;

      // ── Validate ─────────────────────────────────────────
      if (!name?.trim() || !email?.trim() || !password) {
        return res.status(400).json({
          error: "Name, email and password are required.",
        });
      }
      if (password.length < 8) {
        console.log(`   ❌ Password too short`);
        return res.status(400).json({
          error: "Password must be at least 8 characters.",
        });
      }
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({
          error: `Invalid role "${role}". Allowed: ${ALLOWED_ROLES.join(", ")}`,
        });
      }
      if (role === "super_admin" && req.admin.role !== "super_admin") {
        return res.status(403).json({
          error: "Only a Super Admin can create another Super Admin.",
        });
      }

      // ── Look up role_id ──────────────────────────────────
      const roleId = await getRoleId(role);
      if (!roleId) {
        console.log(`   ❌ Role "${role}" not found in admin_roles table`);
        return res.status(400).json({
          error: `Role "${role}" is not configured. Please add it to admin_roles first.`,
        });
      }
      console.log(`   🔑 role_id resolved: ${roleId}`);

      // ── Duplicate check ──────────────────────────────────
      const { rows: existing } = await pool.query(
        `SELECT id FROM admins WHERE email = $1`,
        [email.toLowerCase().trim()],
      );
      if (existing.length) {
        return res.status(409).json({
          error: "An admin with this email already exists.",
        });
      }

      // ── Hash + insert (BOTH role AND role_id) ────────────
      const hash = await bcrypt.hash(password, 12);
      console.log(`   🔐 Password hashed`);

      const { rows } = await pool.query(
        `INSERT INTO admins
           (name, email, password_hash, role, role_id, status,
            created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'active', $6, NOW(), NOW())
         RETURNING id, name, email, role, status, created_at`,
        [
          name.trim(),
          email.toLowerCase().trim(),
          hash,
          role,
          roleId,
          req.admin.id,
        ],
      );

      console.log(`   ✅ Admin created: ${rows[0].id} — ${rows[0].email}`);

      // ── Log to admin_logs ────────────────────────────────
      await pool.query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'create_admin', 'admin', $2, $3)`,
        [
          req.admin.id,
          rows[0].id,
          `Created admin "${name.trim()}" with role "${role}"`,
        ],
      ).catch((e) => console.warn(`   ⚠️  Log insert failed: ${e.message}`));

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(`   ❌ [POST /admin/admins/register]`, err);
      res.status(500).json({
        error: err.message,
        code: err.code,
        detail: err.detail,
      });
    }
  },
);

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/admins/:id/role
// ─────────────────────────────────────────────────────────────
router.patch(
  "/:id/role",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    console.log(`   👤 Requester: ${req.admin?.email} (${req.admin?.role})`);
    try {
      const { role } = req.body;
      const targetId = req.params.id;

      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({
          error: `Invalid role "${role}". Allowed: ${ALLOWED_ROLES.join(", ")}`,
        });
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

      // Look up role_id
      const roleId = await getRoleId(role);
      if (!roleId) {
        return res.status(400).json({
          error: `Role "${role}" is not configured.`,
        });
      }

      const { rows } = await pool.query(
        `UPDATE admins
         SET role = $1, role_id = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, name, email, role, status`,
        [role, roleId, targetId],
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Admin not found." });
      }

      console.log(`   ✅ Role updated: ${targetId} → ${role}`);

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
      console.error(`   ❌ [PATCH /admin/admins/:id/role]`, err);
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
    console.log(`   👤 Requester: ${req.admin?.email} (${req.admin?.role})`);
    try {
      const targetId = req.params.id;

      if (targetId === String(req.admin.id)) {
        return res.status(400).json({
          error: "You cannot deactivate your own account.",
        });
      }

      const { rows: target } = await pool.query(
        `SELECT role, status FROM admins WHERE id = $1`,
        [targetId],
      );
      if (!target.length) {
        return res.status(404).json({ error: "Admin not found." });
      }

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
         SET status = 'banned', banned_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [targetId],
      );

      console.log(`   ✅ Deactivated: ${targetId}`);

      await pool.query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'ban_admin', 'admin', $2, $3)`,
        [req.admin.id, targetId, `Deactivated admin ${targetId}`],
      ).catch(() => {});

      res.json({ success: true });
    } catch (err) {
      console.error(`   ❌ [POST /admin/admins/:id/ban]`, err);
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
    console.log(`   👤 Requester: ${req.admin?.email} (${req.admin?.role})`);
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
         SET status = 'active', banned_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [targetId],
      );

      console.log(`   ✅ Reactivated: ${targetId}`);

      await pool.query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'unban_admin', 'admin', $2, $3)`,
        [req.admin.id, targetId, `Reactivated admin ${targetId}`],
      ).catch(() => {});

      res.json({ success: true });
    } catch (err) {
      console.error(`   ❌ [POST /admin/admins/:id/unban]`, err);
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;