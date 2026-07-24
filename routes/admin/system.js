// ════════════════════════════════════════════════════════════
// FILE: routes/admin/system.js
// Base: /api/admin/system
// ════════════════════════════════════════════════════════════

import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

/* ─── defaults ───────────────────────────────────────────── */
const DEFAULT_CONFIG = {
  maintenance   : false,
  allowPosting  : true,
  allowPayments : true,
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/system
// Fetch current system config
// ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool
      .query(`SELECT key, value FROM system_config`)
      .catch(() => ({ rows: [] }));

    const config = { ...DEFAULT_CONFIG };

    rows.forEach(({ key, value }) => {
      if (key === "maintenance")   config.maintenance   = value === "true";
      if (key === "allowPosting")  config.allowPosting  = value !== "false";
      if (key === "allowPayments") config.allowPayments = value !== "false";
    });

    res.json(config);
  } catch (err) {
    console.error("[GET /admin/system]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/system
// Update system config (super_admin only)
// ─────────────────────────────────────────────────────────────
router.post("/", requireSuperAdmin, async (req, res) => {
  const { maintenance, allowPosting, allowPayments } = req.body;

  try {
    const upsert = (key, value) =>
      pool.query(
        `INSERT INTO system_config (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE
           SET value      = EXCLUDED.value,
               updated_at = NOW()`,
        [key, String(value)],
      );

    await Promise.all([
      upsert("maintenance",   maintenance   ?? false),
      upsert("allowPosting",  allowPosting  ?? true),
      upsert("allowPayments", allowPayments ?? true),
    ]);

    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, details)
       VALUES ($1, 'system_config_update', $2)`,
      [req.admin.id, JSON.stringify({ maintenance, allowPosting, allowPayments })],
    ).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error("[POST /admin/system]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/system/logout-all
// Sign the current admin out of every device
// Available to ANY logged-in admin (not just super_admin)
// ─────────────────────────────────────────────────────────────
router.post("/logout-all", async (req, res) => {
  try {
    // Option A — delete server-side sessions if you have that table
    await pool.query(
      `DELETE FROM admin_sessions WHERE admin_id = $1`,
      [req.admin.id],
    ).catch(() => {});

    // Option B — bump token_version so all existing JWTs stop working
    await pool.query(
      `UPDATE admins
       SET token_version = COALESCE(token_version, 0) + 1,
           updated_at    = NOW()
       WHERE id = $1`,
      [req.admin.id],
    ).catch(() => {});

    // Audit log
    await pool.query(
      `INSERT INTO admin_logs
         (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'logout_all', 'admin', $2, $3)`,
      [req.admin.id, req.admin.id, `Signed out "${req.admin.name}" from all devices`],
    ).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error("[POST /admin/system/logout-all]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/system/force-logout-all
// SUPER ADMIN ONLY — force every admin AND every user to re-login
// ─────────────────────────────────────────────────────────────
router.post("/force-logout-all", requireSuperAdmin, async (req, res) => {
  try {
    // Bump token version for every admin
    await pool.query(
      `UPDATE admins
       SET token_version = COALESCE(token_version, 0) + 1,
           updated_at    = NOW()`,
    ).catch(() => {});

    // Bump token version for every user
    await pool.query(
      `UPDATE public.users
       SET token_version = COALESCE(token_version, 0) + 1,
           updated_at    = NOW()`,
    ).catch(() => {});

    // Delete session tables if they exist
    await pool.query(`DELETE FROM admin_sessions`).catch(() => {});
    await pool.query(`DELETE FROM user_sessions`).catch(() => {});

    // Audit log
    await pool.query(
      `INSERT INTO admin_logs
         (admin_id, action, target_type, details)
       VALUES ($1, 'force_logout_all', 'system', $2)`,
      [req.admin.id, `Force-logged out all users and admins`],
    ).catch(() => {});

    res.json({ success: true, message: "All sessions revoked." });
  } catch (err) {
    console.error("[POST /admin/system/force-logout-all]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/system/flush-cache
// SUPER ADMIN ONLY — placeholder for Redis / cache invalidation
// ─────────────────────────────────────────────────────────────
router.post("/flush-cache", requireSuperAdmin, async (req, res) => {
  try {
    // TODO: hook into Redis when configured
    // await redis.flushdb();

    await pool.query(
      `INSERT INTO admin_logs
         (admin_id, action, target_type, details)
       VALUES ($1, 'flush_cache', 'system', $2)`,
      [req.admin.id, "Flushed application cache"],
    ).catch(() => {});

    res.json({
      success : true,
      message : "Cache flushed (or no cache configured yet)",
    });
  } catch (err) {
    console.error("[POST /admin/system/flush-cache]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;