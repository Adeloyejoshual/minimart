import express from "express";
import { pool } from "../../server.js";
import bcrypt from "bcrypt";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";

const router = express.Router();

/* Get all users */
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, email, phone_number, city, state,
             status, balance, created_at, last_login,
             store_name, profile_picture
      FROM public.users
      ORDER BY created_at DESC
      LIMIT 500
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* Ban user */
router.post("/:id/ban", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.users SET status = 'banned', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    await pool
      .query(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'ban_user', 'user', $2, $3)`,
        [req.admin.id, req.params.id, `Banned user ${req.params.id}`]
      )
      .catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* Unban user */
router.post("/:id/unban", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.users SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ────────────────────────────────
   ADMIN USER MANAGEMENT
──────────────────────────────── */
router.get("/admins", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, status, created_at
       FROM admins ORDER BY created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/admins/register", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "name, email, password required" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO admins (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, hash, role || "moderator"]
    );
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/admins/:id/ban", verifyAdmin, requireSuperAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE admins SET status = 'banned', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/admins/assign-role", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { admin_id, role } = req.body;
  try {
    await pool.query(`UPDATE admins SET role = $1 WHERE id = $2`, [role, admin_id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;