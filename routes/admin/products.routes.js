import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();

router.get("/", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.title AS name, p.price, p.status,
             p.is_active, p.is_promoted, p.thumbnail_url,
             p.location_city, p.location_state, p.created_at,
             u.name AS seller_name, c.name AS category_name
      FROM public.products p
      LEFT JOIN public.users      u ON u.id = p.seller_id
      LEFT JOIN public.categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC
      LIMIT 500
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/pending", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.title AS name, p.price, p.status,
             p.is_active, p.is_promoted, p.thumbnail_url,
             p.location_city, p.location_state, p.created_at,
             u.name AS seller_name, c.name AS category_name
      FROM public.products p
      LEFT JOIN public.users      u ON u.id = p.seller_id
      LEFT JOIN public.categories c ON c.id = p.category_id
      WHERE p.status = 'pending'
      ORDER BY p.created_at ASC
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/:id/approve", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.products
       SET status = 'active', is_active = true, updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await pool
      .query(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'approve_product', 'product', $2, $3)`,
        [req.admin.id, req.params.id, `Approved public product ${req.params.id}`]
      )
      .catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/:id/reject", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.products
       SET status = 'rejected', is_active = false, updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await pool
      .query(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'reject_product', 'product', $2, $3)`,
        [req.admin.id, req.params.id, `Rejected public product ${req.params.id}`]
      )
      .catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;