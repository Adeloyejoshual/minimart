// ════════════════════════════════════════════════════════════
// FILE: routes/admin/activityLogs.js
// Base: /api/admin/activity-logs
// ════════════════════════════════════════════════════════════

import express         from "express";
import { pool }        from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

/* ─── Helper for safe integer parsing ─────────────────────── */
const safeInt = (v, fb = 0) => {
  const n = parseInt(v);
  return isNaN(n) ? fb : n;
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/activity-logs
// Query params:
//   ?period=today | all | month | year (default: all)
//   ?limit=100 &offset=0 &search=
// ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const period = (req.query.period ?? "all").trim().toLowerCase();
    const search = (req.query.search ?? "").trim();
    const limit  = Math.min(300, safeInt(req.query.limit, 100));
    const offset = Math.max(0, safeInt(req.query.offset, 0));

    const conditions = [];
    const params     = [];

    /* ── 1. Date filter ───────────────────────────────────── */
    if (period === "today") {
      conditions.push(`l.created_at >= CURRENT_DATE`);
    } else if (period === "month") {
      conditions.push(`l.created_at >= NOW() - INTERVAL '30 days'`);
    } else if (period === "year") {
      conditions.push(`l.created_at >= NOW() - INTERVAL '365 days'`);
    }
    // "all" has no date constraint

    /* ── 2. Search filter ─────────────────────────────────── */
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`(
        LOWER(CAST(l.action AS TEXT))  LIKE $${params.length} OR
        LOWER(CAST(l.details AS TEXT)) LIKE $${params.length} OR
        LOWER(CAST(a.name AS TEXT))    LIKE $${params.length}
      )`);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    /* ── 3. Fetch logs page ───────────────────────────────── */
    const listParams = [...params, limit, offset];
    const { rows: logs } = await client.query(
      `SELECT
         l.id,
         l.action,
         l.target_type,
         l.target_id,
         l.details,
         l.created_at,
         COALESCE(a.name, 'System') AS admin_name,
         a.email                   AS admin_email
       FROM admin_logs l
       LEFT JOIN admins a ON a.id = l.admin_id
       ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    /* ── 4. Total count for selected period ──────────────── */
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM admin_logs l
       LEFT JOIN admins a ON a.id = l.admin_id
       ${whereSql}`,
      params,
    );

    /* ── 5. Counters for all periods ─────────────────────── */
    const [todayCount, monthCount, yearCount, allCount] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS c FROM admin_logs WHERE created_at >= CURRENT_DATE`),
      client.query(`SELECT COUNT(*)::int AS c FROM admin_logs WHERE created_at >= NOW() - INTERVAL '30 days'`),
      client.query(`SELECT COUNT(*)::int AS c FROM admin_logs WHERE created_at >= NOW() - INTERVAL '365 days'`),
      client.query(`SELECT COUNT(*)::int AS c FROM admin_logs`),
    ]);

    return res.json({
      success : true,
      period,
      total   : countRows[0]?.count ?? 0,
      limit,
      offset,
      logs,
      stats: {
        today : todayCount.rows[0]?.c ?? 0,
        month : monthCount.rows[0]?.c ?? 0,
        year  : yearCount.rows[0]?.c  ?? 0,
        all   : allCount.rows[0]?.c   ?? 0,
      },
    });

  } catch (err) {
    console.error("[GET /api/admin/activity-logs]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;