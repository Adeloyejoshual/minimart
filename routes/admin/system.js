import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT key, value FROM system_config`)
      .catch(() => ({ rows: [] }));

    const config = { maintenance: false, allowPosting: true, allowPayments: true };
    rows.forEach(({ key, value }) => {
      if (key === "maintenance")   config.maintenance   = value === "true";
      if (key === "allowPosting")  config.allowPosting  = value !== "false";
      if (key === "allowPayments") config.allowPayments = value !== "false";
    });
    res.json(config);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", requireSuperAdmin, async (req, res) => {
  const { maintenance, allowPosting, allowPayments } = req.body;
  try {
    const upsert = (key, value) =>
      pool.query(
        `INSERT INTO system_config (key, value, updated_at) VALUES ($1,$2,NOW())
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
        [key, String(value)]
      );
    await Promise.all([
      upsert("maintenance",   maintenance   ?? false),
      upsert("allowPosting",  allowPosting  ?? true),
      upsert("allowPayments", allowPayments ?? true),
    ]);
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, details) VALUES ($1,'system_config_update',$2)`,
      [req.admin.id, JSON.stringify({ maintenance, allowPosting, allowPayments })]
    ).catch(() => {});
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;