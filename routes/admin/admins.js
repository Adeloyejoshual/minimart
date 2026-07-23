// ════════════════════════════════════════════════════════════
// FILE: routes/admin/admins.js
// Base: /api/admin/admins
// ════════════════════════════════════════════════════════════

import express            from "express";
import bcrypt             from "bcrypt";
import crypto             from "crypto";
import { pool }           from "../../config/db.js";
import {
  verifyAdmin,
  requireSuperAdmin,
} from "./middleware.js";

const router = express.Router();

/* ─── constants ──────────────────────────────────────────── */
const ALLOWED_ROLES = [
  "admin",
  "content_moderator",
  "finance_admin",
  "support_admin",
  "super_admin",
];

const ROLE_REGEX     = /^[a-z][a-z0-9_]{2,29}$/;
const EMAIL_REGEX    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD   = 8;
const BCRYPT_ROUNDS  = 12;

/* ─── helpers ────────────────────────────────────────────── */

async function getRoleId(roleName) {
  const { rows } = await pool.query(
    `SELECT id FROM admin_roles WHERE role_name = $1`,
    [roleName],
  );
  return rows[0]?.id ?? null;
}

async function ensureRoleExists(roleName) {
  let roleId = await getRoleId(roleName);
  if (roleId) return roleId;

  // Auto-create custom role if it matches the safe format
  if (!ROLE_REGEX.test(roleName)) return null;

  const { rows } = await pool.query(
    `INSERT INTO admin_roles (role_name, description)
     VALUES ($1, $2)
     ON CONFLICT (role_name) DO UPDATE SET role_name = EXCLUDED.role_name
     RETURNING id`,
    [roleName, `Auto-created role: ${roleName}`],
  );
  return rows[0]?.id ?? null;
}

async function logAction(adminId, action, targetId, details) {
  try {
    await pool.query(
      `INSERT INTO admin_logs
         (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, 'admin', $3, $4)`,
      [adminId, action, targetId, details],
    );
  } catch (e) {
    console.warn(`   ⚠️  Log insert failed: ${e.message}`);
  }
}

function humanize(slug) {
  return slug
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function isValidRole(role) {
  return ALLOWED_ROLES.includes(role) || ROLE_REGEX.test(role);
}

/* ─── request logger ─────────────────────────────────────── */
router.use((req, res, next) => {
  console.log(`\n📥 [admins] ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.body || {}).length) {
    const safe = { ...req.body };
    if (safe.password) safe.password = "***";
    console.log(`   Body:`, safe);
  }
  next();
});

// ═════════════════════════════════════════════════════════════
// GET /api/admin/admins
// List all admins with filters and pagination
// ═════════════════════════════════════════════════════════════
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const {
      search = "",
      role   = "",
      status = "",
      limit  = 100,
      offset = 0,
      sortBy = "created_at",
      sortDir = "desc",
    } = req.query;

    const safeSortBy = [
      "name", "email", "role", "status",
      "created_at", "last_login",
    ].includes(sortBy) ? sortBy : "created_at";

    const safeSortDir = sortDir === "asc" ? "ASC" : "DESC";

    const params = [];
    const where  = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(LOWER(a.name) LIKE $${params.length} OR LOWER(a.email) LIKE $${params.length})`);
    }
    if (role) {
      params.push(role);
      where.push(`a.role = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`a.status = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    params.push(Math.min(500, parseInt(limit) || 100));
    params.push(Math.max(0, parseInt(offset) || 0));

    const { rows } = await pool.query(
      `SELECT
         a.id, a.name, a.email, a.role, a.status,
         a.created_at, a.last_login, a.banned_at,
         c.name AS created_by
       FROM admins a
       LEFT JOIN admins c ON c.id = a.created_by
       ${whereSql}
       ORDER BY a.${safeSortBy} ${safeSortDir} NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM admins a ${whereSql}`,
      params.slice(0, params.length - 2),
    );

    console.log(`   ✅ Returning ${rows.length} of ${totalRows[0].count} admins`);

    res.json({
      admins    : rows,
      total     : totalRows[0].count,
      limit     : parseInt(limit) || 100,
      offset    : parseInt(offset) || 0,
    });
  } catch (err) {
    console.error(`   ❌ [GET /admin/admins]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/admin/admins/stats
// Dashboard statistics
// ═════════════════════════════════════════════════════════════
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, active, banned, todayCount, byRole] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int FROM admins`),
      pool.query(`SELECT COUNT(*)::int FROM admins WHERE status = 'active'`),
      pool.query(`SELECT COUNT(*)::int FROM admins WHERE status = 'banned'`),
      pool.query(`SELECT COUNT(*)::int FROM admins WHERE created_at >= $1`, [today]),
      pool.query(`SELECT role, COUNT(*)::int FROM admins GROUP BY role`),
    ]);

    res.json({
      total       : total.rows[0].count,
      active      : active.rows[0].count,
      banned      : banned.rows[0].count,
      today       : todayCount.rows[0].count,
      byRole      : byRole.rows.reduce((acc, r) => {
        acc[r.role] = r.count;
        return acc;
      }, {}),
    });
  } catch (err) {
    console.error(`   ❌ [GET /admin/admins/stats]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/admin/admins/roles
// List available roles (built-in + from DB)
// ═════════════════════════════════════════════════════════════
router.get("/roles", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, role_name, description
       FROM admin_roles
       ORDER BY role_name ASC`,
    );

    const rolesInUse = await pool.query(
      `SELECT role, COUNT(*)::int AS count
       FROM admins
       GROUP BY role`,
    );

    const usageMap = rolesInUse.rows.reduce((acc, r) => {
      acc[r.role] = r.count;
      return acc;
    }, {});

    res.json(rows.map((r) => ({
      ...r,
      label     : humanize(r.role_name),
      in_use    : usageMap[r.role_name] || 0,
      built_in  : ALLOWED_ROLES.includes(r.role_name),
    })));
  } catch (err) {
    console.error(`   ❌ [GET /admin/admins/roles]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// POST /api/admin/admins/roles
// Create a new custom role (super_admin only)
// Body: { role_name, description }
// ═════════════════════════════════════════════════════════════
router.post("/roles", verifyAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const { role_name, description = "" } = req.body;

    if (!role_name?.trim()) {
      return res.status(400).json({ error: "role_name is required." });
    }

    const clean = role_name.trim().toLowerCase();

    if (!ROLE_REGEX.test(clean)) {
      return res.status(400).json({
        error: "Invalid role name. Use lowercase letters, numbers and underscores (3-30 chars).",
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO admin_roles (role_name, description)
       VALUES ($1, $2)
       ON CONFLICT (role_name) DO NOTHING
       RETURNING id, role_name, description`,
      [clean, description],
    );

    if (!rows.length) {
      return res.status(409).json({ error: "Role already exists." });
    }

    await logAction(
      req.admin.id,
      "create_role",
      rows[0].id,
      `Created custom role "${clean}"`,
    );

    console.log(`   ✅ Role created: ${clean}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(`   ❌ [POST /admin/admins/roles]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// DELETE /api/admin/admins/roles/:name
// Delete a custom role (super_admin only, cannot delete built-in or in-use)
// ═════════════════════════════════════════════════════════════
router.delete("/roles/:name", verifyAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const roleName = req.params.name;

    if (ALLOWED_ROLES.includes(roleName)) {
      return res.status(400).json({
        error: `Cannot delete built-in role "${roleName}".`,
      });
    }

    const { rows: inUse } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM admins WHERE role = $1`,
      [roleName],
    );

    if (inUse[0].count > 0) {
      return res.status(400).json({
        error: `Cannot delete role — ${inUse[0].count} admin(s) still have it.`,
      });
    }

    const { rowCount } = await pool.query(
      `DELETE FROM admin_roles WHERE role_name = $1`,
      [roleName],
    );

    if (!rowCount) {
      return res.status(404).json({ error: "Role not found." });
    }

    await logAction(
      req.admin.id,
      "delete_role",
      null,
      `Deleted custom role "${roleName}"`,
    );

    console.log(`   ✅ Role deleted: ${roleName}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`   ❌ [DELETE /admin/admins/roles/:name]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// POST /api/admin/admins/register
// Create a new admin (super_admin only)
// ═════════════════════════════════════════════════════════════
router.post(
  "/register",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    console.log(`   👤 Requester: ${req.admin.email} (${req.admin.role})`);

    try {
      const { name, email, password, role } = req.body;

      // ── Validate ─────────────────────────────────────────
      if (!name?.trim() || !email?.trim() || !password) {
        return res.status(400).json({
          error: "Name, email and password are required.",
        });
      }
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: "Invalid email format." });
      }
      if (password.length < MIN_PASSWORD) {
        return res.status(400).json({
          error: `Password must be at least ${MIN_PASSWORD} characters.`,
        });
      }
      if (!isValidRole(role)) {
        return res.status(400).json({
          error: `Invalid role "${role}".`,
        });
      }
      if (role === "super_admin" && req.admin.role !== "super_admin") {
        return res.status(403).json({
          error: "Only a Super Admin can create another Super Admin.",
        });
      }

      // ── Resolve role_id (auto-create if custom) ──────────
      const roleId = await ensureRoleExists(role);
      if (!roleId) {
        return res.status(400).json({
          error: `Could not resolve or create role "${role}".`,
        });
      }
      console.log(`   🔑 role_id resolved: ${roleId}`);

      // ── Check duplicate email ────────────────────────────
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
      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

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

      await logAction(
        req.admin.id,
        "create_admin",
        rows[0].id,
        `Created admin "${name.trim()}" with role "${role}"`,
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(`   ❌ [POST /admin/admins/register]`, err);
      res.status(500).json({
        error  : err.message,
        code   : err.code,
        detail : err.detail,
      });
    }
  },
);

// ═════════════════════════════════════════════════════════════
// PATCH /api/admin/admins/:id
// Update admin details (name, email)
// ═════════════════════════════════════════════════════════════
router.patch("/:id", verifyAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const targetId = req.params.id;
    const { name, email } = req.body;

    const updates = [];
    const params  = [];

    if (name?.trim()) {
      params.push(name.trim());
      updates.push(`name = $${params.length}`);
    }
    if (email?.trim()) {
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: "Invalid email format." });
      }
      params.push(email.toLowerCase().trim());
      updates.push(`email = $${params.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    updates.push(`updated_at = NOW()`);
    params.push(targetId);

    const { rows } = await pool.query(
      `UPDATE admins SET ${updates.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, name, email, role, status`,
      params,
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Admin not found." });
    }

    await logAction(
      req.admin.id,
      "update_admin",
      targetId,
      `Updated details for admin ${targetId}`,
    );

    console.log(`   ✅ Admin updated: ${targetId}`);
    res.json(rows[0]);
  } catch (err) {
    console.error(`   ❌ [PATCH /admin/admins/:id]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// PATCH /api/admin/admins/:id/role
// Change admin role (super_admin only)
// ═════════════════════════════════════════════════════════════
router.patch(
  "/:id/role",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { role } = req.body;
      const targetId = req.params.id;

      if (!isValidRole(role)) {
        return res.status(400).json({ error: `Invalid role "${role}".` });
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

      // Prevent demoting last super_admin
      const { rows: target } = await pool.query(
        `SELECT role FROM admins WHERE id = $1`,
        [targetId],
      );
      if (!target.length) {
        return res.status(404).json({ error: "Admin not found." });
      }
      if (target[0].role === "super_admin" && role !== "super_admin") {
        const { rows: supers } = await pool.query(
          `SELECT COUNT(*)::int AS count FROM admins
           WHERE role = 'super_admin' AND status = 'active'`,
        );
        if (supers[0].count === 1) {
          return res.status(400).json({
            error: "Cannot demote the last active Super Admin.",
          });
        }
      }

      const roleId = await ensureRoleExists(role);
      if (!roleId) {
        return res.status(400).json({ error: `Could not resolve role "${role}".` });
      }

      const { rows } = await pool.query(
        `UPDATE admins
         SET role = $1, role_id = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, name, email, role, status`,
        [role, roleId, targetId],
      );

      await logAction(
        req.admin.id,
        "edit_admin_role",
        targetId,
        `Changed role from "${target[0].role}" to "${role}"`,
      );

      console.log(`   ✅ Role updated: ${targetId} → ${role}`);
      res.json(rows[0]);
    } catch (err) {
      console.error(`   ❌ [PATCH /admin/admins/:id/role]`, err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════
// POST /api/admin/admins/:id/ban
// Deactivate admin
// ═════════════════════════════════════════════════════════════
router.post(
  "/:id/ban",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const targetId = req.params.id;
      const { reason = "" } = req.body;

      if (targetId === String(req.admin.id)) {
        return res.status(400).json({
          error: "You cannot deactivate your own account.",
        });
      }

      const { rows: target } = await pool.query(
        `SELECT role, status, name FROM admins WHERE id = $1`,
        [targetId],
      );
      if (!target.length) {
        return res.status(404).json({ error: "Admin not found." });
      }
      if (target[0].status === "banned") {
        return res.status(400).json({ error: "Already deactivated." });
      }

      if (target[0].role === "super_admin") {
        const { rows: supers } = await pool.query(
          `SELECT COUNT(*)::int AS count FROM admins
           WHERE role = 'super_admin' AND status = 'active'`,
        );
        if (supers[0].count === 1) {
          return res.status(400).json({
            error: "Cannot deactivate the last Super Admin.",
          });
        }
      }

      await pool.query(
        `UPDATE admins
         SET status = 'banned',
             banned_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [targetId],
      );

      await logAction(
        req.admin.id,
        "ban_admin",
        targetId,
        `Deactivated "${target[0].name}"${reason ? ` — Reason: ${reason}` : ""}`,
      );

      console.log(`   ✅ Deactivated: ${targetId}`);
      res.json({ success: true });
    } catch (err) {
      console.error(`   ❌ [POST /admin/admins/:id/ban]`, err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════
// POST /api/admin/admins/:id/unban
// Reactivate admin
// ═════════════════════════════════════════════════════════════
router.post(
  "/:id/unban",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const targetId = req.params.id;

      const { rows: target } = await pool.query(
        `SELECT status, name FROM admins WHERE id = $1`,
        [targetId],
      );
      if (!target.length) {
        return res.status(404).json({ error: "Admin not found." });
      }
      if (target[0].status === "active") {
        return res.status(400).json({ error: "Already active." });
      }

      await pool.query(
        `UPDATE admins
         SET status = 'active',
             banned_at = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [targetId],
      );

      await logAction(
        req.admin.id,
        "unban_admin",
        targetId,
        `Reactivated "${target[0].name}"`,
      );

      console.log(`   ✅ Reactivated: ${targetId}`);
      res.json({ success: true });
    } catch (err) {
      console.error(`   ❌ [POST /admin/admins/:id/unban]`, err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════
// PATCH /api/admin/admins/:id/password
// Reset an admin's password (super_admin only)
// ═════════════════════════════════════════════════════════════
router.patch(
  "/:id/password",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { password } = req.body;
      const targetId     = req.params.id;

      if (!password || password.length < MIN_PASSWORD) {
        return res.status(400).json({
          error: `Password must be at least ${MIN_PASSWORD} characters.`,
        });
      }

      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const { rows } = await pool.query(
        `UPDATE admins
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, name`,
        [hash, targetId],
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Admin not found." });
      }

      await logAction(
        req.admin.id,
        "reset_password",
        targetId,
        `Reset password for "${rows[0].name}"`,
      );

      console.log(`   ✅ Password reset: ${targetId}`);
      res.json({ success: true });
    } catch (err) {
      console.error(`   ❌ [PATCH /admin/admins/:id/password]`, err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════
// POST /api/admin/admins/:id/reset-password
// Generate a temporary random password (super_admin only)
// Returns the plain password ONCE
// ═════════════════════════════════════════════════════════════
router.post(
  "/:id/reset-password",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const targetId = req.params.id;

      // Generate secure random password
      const tempPassword = crypto.randomBytes(9).toString("base64")
        .replace(/[+/=]/g, "").slice(0, 12) + "!A9";

      const hash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

      const { rows } = await pool.query(
        `UPDATE admins
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, email`,
        [hash, targetId],
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Admin not found." });
      }

      await logAction(
        req.admin.id,
        "generate_temp_password",
        targetId,
        `Generated temporary password for "${rows[0].name}"`,
      );

      console.log(`   ✅ Temp password generated for: ${targetId}`);

      res.json({
        success       : true,
        admin         : rows[0],
        temp_password : tempPassword,
        note          : "Share this password securely with the admin. It cannot be retrieved again.",
      });
    } catch (err) {
      console.error(`   ❌ [POST /admin/admins/:id/reset-password]`, err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════
// GET /api/admin/admins/:id/activity
// Recent activity for a specific admin
// ═════════════════════════════════════════════════════════════
router.get("/:id/activity", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, action, target_type, target_id, details, created_at
       FROM admin_logs
       WHERE admin_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    console.error(`   ❌ [GET /admin/admins/:id/activity]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// DELETE /api/admin/admins/:id
// Permanently delete an admin (super_admin only, must be banned first)
// ═════════════════════════════════════════════════════════════
router.delete("/:id", verifyAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const targetId = req.params.id;

    if (targetId === String(req.admin.id)) {
      return res.status(400).json({
        error: "You cannot delete your own account.",
      });
    }

    const { rows: target } = await pool.query(
      `SELECT role, status, name FROM admins WHERE id = $1`,
      [targetId],
    );
    if (!target.length) {
      return res.status(404).json({ error: "Admin not found." });
    }

    // Safety: must be deactivated first
    if (target[0].status !== "banned") {
      return res.status(400).json({
        error: "Admin must be deactivated before permanent deletion.",
      });
    }

    if (target[0].role === "super_admin") {
      const { rows: supers } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM admins WHERE role = 'super_admin'`,
      );
      if (supers[0].count === 1) {
        return res.status(400).json({
          error: "Cannot delete the last Super Admin account.",
        });
      }
    }

    await pool.query(`DELETE FROM admins WHERE id = $1`, [targetId]);

    await logAction(
      req.admin.id,
      "delete_admin",
      targetId,
      `Permanently deleted "${target[0].name}"`,
    );

    console.log(`   ✅ Deleted: ${targetId}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`   ❌ [DELETE /admin/admins/:id]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;