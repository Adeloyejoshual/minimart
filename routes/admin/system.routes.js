import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";
import { cleanBigInt, safeInt } from "./helpers.js";

const router = express.Router();

/* Activity logs */
router.get("/logs", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool
      .query(
        `SELECT l.id, l.action, l.details, l.created_at, a.name AS admin_name
         FROM admin_logs l
         LEFT JOIN admins a ON a.id = l.admin_id
         ORDER BY l.created_at DESC
         LIMIT 200`
      )
      .catch(() =>
        pool.query(`
          SELECT id, action, details, created_at, NULL AS admin_name
          FROM audit_logs
          ORDER BY created_at DESC
          LIMIT 200
        `)
      );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* System config */
router.get("/config", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool
      .query(`SELECT key, value FROM system_config`)
      .catch(() => ({ rows: [] }));

    const config = {
      maintenance: false,
      allowPosting: true,
      allowPayments: true,
    };
    rows.forEach(({ key, value }) => {
      if (key === "maintenance") config.maintenance = value === "true";
      if (key === "allowPosting") config.allowPosting = value !== "false";
      if (key === "allowPayments") config.allowPayments = value !== "false";
    });

    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/config", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { maintenance, allowPosting, allowPayments } = req.body;
  try {
    const upsert = (key, value) =>
      pool.query(
        `INSERT INTO system_config (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, String(value)]
      );

    await Promise.all([
      upsert("maintenance", maintenance ?? false),
      upsert("allowPosting", allowPosting ?? true),
      upsert("allowPayments", allowPayments ?? true),
    ]);

    await pool
      .query(
        `INSERT INTO admin_logs (admin_id, action, details)
         VALUES ($1, 'system_config_update', $2)`,
        [
          req.admin.id,
          JSON.stringify({ maintenance, allowPosting, allowPayments }),
        ]
      )
      .catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* Promotion plans */
router.get("/plans", verifyAdmin, async (req, res) => {
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
      features: (() => {
        if (Array.isArray(p.features)) return p.features;
        if (typeof p.features === "string") {
          try { return JSON.parse(p.features); }
          catch { return []; }
        }
        return [];
      })(),
    }));

    return res.json({ success: true, plans });
  } catch (err) {
    console.error("[ADMIN] Plans error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.put("/plans/:id", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const planId = cleanBigInt(req.params.id);
  if (!planId) return res.status(400).json({ error: "Invalid plan ID" });

  const {
    name, price, discount_percent, duration_days,
    duration, priority, sort_order, is_active, features,
  } = req.body;

  try {
    const safeFeatures = Array.isArray(features) ? features : [];
    await pool.query(
      `UPDATE promotion_plans
       SET name             = $1,
           price            = $2,
           discount_percent = $3,
           duration_days    = $4,
           duration         = $5,
           priority         = $6,
           sort_order       = $7,
           is_active        = $8,
           features         = $9::JSONB,
           updated_at       = NOW()
       WHERE id = $10`,
      [
        name, Number(price), Number(discount_percent ?? 0),
        Number(duration_days ?? 30), duration ?? "",
        Number(priority ?? 0), Number(sort_order ?? 0),
        !!is_active, JSON.stringify(safeFeatures), planId,
      ]
    );

    await pool
      .query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'update_plan', 'promotion_plan', $2, $3)`,
        [req.admin.id, planId, `Updated plan "${name}"`]
      )
      .catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/plans/:id/toggle", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const planId = cleanBigInt(req.params.id);
  if (!planId) return res.status(400).json({ error: "Invalid plan ID" });

  try {
    const { rows } = await pool.query(
      `UPDATE promotion_plans
       SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1
       RETURNING id::text, name, is_active`,
      [planId]
    );
    if (!rows.length)
      return res.status(404).json({ error: "Plan not found" });

    return res.json({ success: true, plan: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;