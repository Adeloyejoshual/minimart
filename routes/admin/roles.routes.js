import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();

router.post("/", verifyAdmin, async (req, res) => {
  const { role_name, description } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_roles (role_name, description) VALUES ($1, $2) RETURNING *`,
      [role_name, description]
    );
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM admin_roles`);
  return res.json(rows);
});

router.post("/permissions", verifyAdmin, async (req, res) => {
  const { name, description } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO permissions (name, description) VALUES ($1, $2) RETURNING *`,
      [name, description]
    );
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/permissions", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM permissions`);
  return res.json(rows);
});

router.post("/assign-permission", verifyAdmin, async (req, res) => {
  const { role_id, permission_id } = req.body;
  try {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [role_id, permission_id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/:id/permissions", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.name
     FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = $1`,
    [req.params.id]
  );
  return res.json(rows);
});

export default router;