import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin } from "./middleware.js";

/* ── Roles (mounted at /roles) ── */
export const rolesRouter = express.Router();
rolesRouter.use(verifyAdmin);

rolesRouter.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM admin_roles`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

rolesRouter.post("/", async (req, res) => {
  const { role_name, description } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_roles (role_name, description) VALUES ($1,$2) RETURNING *`,
      [role_name, description]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

rolesRouter.get("/:id/permissions", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id=$1`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

rolesRouter.post("/assign-permission", async (req, res) => {
  const { role_id, permission_id } = req.body;
  try {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [role_id, permission_id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Permissions (mounted at /permissions) ── */
export const permissionsRouter = express.Router();
permissionsRouter.use(verifyAdmin);

permissionsRouter.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM permissions`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

permissionsRouter.post("/", async (req, res) => {
  const { name, description } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO permissions (name, description) VALUES ($1,$2) RETURNING *`,
      [name, description]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});