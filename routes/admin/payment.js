import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.amount, p.status, p.type, p.method,
             p.reference, p.created_at, p.updated_at,
             u.name AS user, u.email AS user_email
      FROM payments p
      LEFT JOIN public.users u ON u.id = p.seller_id
      ORDER BY p.created_at DESC LIMIT 500
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/refund", requireSuperAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE payments SET status='refunded', updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1,'refund_payment','payment',$2,$3)`,
      [req.admin.id, req.params.id, `Refunded payment ${req.params.id}`]
    ).catch(() => {});
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;