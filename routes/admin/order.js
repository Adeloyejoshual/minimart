import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.id, o.status, o.total, o.created_at,
             u.name AS buyer_name, u.email AS buyer_email,
             COUNT(oi.id) AS item_count
      FROM orders o
      LEFT JOIN public.users u  ON u.id        = o.buyer_id
      LEFT JOIN order_items  oi ON oi.order_id = o.id
      GROUP BY o.id, u.name, u.email
      ORDER BY o.created_at DESC LIMIT 300
    `).catch(() => ({ rows: [] }));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    await pool.query(
      `UPDATE orders SET status='cancelled', updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;