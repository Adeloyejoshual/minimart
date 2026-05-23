import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, email, phone_number, city, state,
             status, balance, created_at, last_login,
             store_name, profile_picture
      FROM public.users
      ORDER BY created_at DESC LIMIT 500
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/ban", async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.users SET status='banned', updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1,'ban_user','user',$2,$3)`,
      [req.admin.id, req.params.id, `Banned user ${req.params.id}`]
    ).catch(() => {});
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/unban", async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.users SET status='active', updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;