import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

const cleanBigInt = (v) => { const s = String(v ?? "").trim(); return /^\d+$/.test(s) ? s : null; };

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id::text, name, price, discount_percent,
             duration, duration_days, priority, sort_order,
             features, is_active,
             (price * (1 - discount_percent / 100.0)) AS effective_price,
             created_at, updated_at
      FROM promotion_plans
      ORDER BY sort_order ASC, price ASC
    `);
    const plans = rows.map((p) => ({
      ...p,
      features: Array.isArray(p.features) ? p.features
        : typeof p.features === "string" ? (() => { try { return JSON.parse(p.features); } catch { return []; } })()
        : [],
    }));
    res.json({ success: true, plans });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", requireSuperAdmin, async (req, res) => {
  const planId = cleanBigInt(req.params.id);
  if (!planId) return res.status(400).json({ error: "Invalid plan ID" });

  const { name, price, discount_percent, duration_days, duration, priority, sort_order, is_active, features } = req.body;
  try {
    await pool.query(
      `UPDATE promotion_plans
       SET name=$1, price=$2, discount_percent=$3, duration_days=$4, duration=$5,
           priority=$6, sort_order=$7, is_active=$8, features=$9::JSONB, updated_at=NOW()
       WHERE id=$10`,
      [name, Number(price), Number(discount_percent ?? 0), Number(duration_days ?? 30),
       duration ?? "", Number(priority ?? 0), Number(sort_order ?? 0),
       !!is_active, JSON.stringify(Array.isArray(features) ? features : []), planId]
    );
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1,'update_plan','promotion_plan',$2,$3)`,
      [req.admin.id, planId, `Updated plan "${name}"`]
    ).catch(() => {});
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/toggle", requireSuperAdmin, async (req, res) => {
  const planId = cleanBigInt(req.params.id);
  if (!planId) return res.status(400).json({ error: "Invalid plan ID" });
  try {
    const { rows } = await pool.query(
      `UPDATE promotion_plans SET is_active=NOT is_active, updated_at=NOW()
       WHERE id=$1 RETURNING id::text, name, is_active`,
      [planId]
    );
    if (!rows.length) return res.status(404).json({ error: "Plan not found" });
    res.json({ success: true, plan: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;