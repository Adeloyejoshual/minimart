// ════════════════════════════════════════════════════════════
// FILE: routes/admin/activityLogs.js
// Base: /api/admin/activity-logs
// ════════════════════════════════════════════════════════════

import express         from "express";
import { pool }        from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

const safeInt = (v, fb = 0) => {
  const n = parseInt(v);
  return isNaN(n) ? fb : n;
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/activity-logs
// Query: ?period=today | all | month | year
//        &limit=100 &offset=0 &search=
// ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const period = (req.query.period ?? "all").trim().toLowerCase();
    const search = (req.query.search ?? "").trim();
    const limit  = Math.min(300, safeInt(req.query.limit, 100));
    const offset = Math.max(0, safeInt(req.query.offset, 0));

    /* ── 1. Date filter building ─────────────────────────────── */
    let logDateSql   = "";
    let visitDateSql = "";
    const params     = [];

    if (period === "today") {
      logDateSql   = "AND l.created_at >= CURRENT_DATE";
      visitDateSql = "WHERE started_at >= CURRENT_DATE";
    } else if (period === "month") {
      logDateSql   = "AND l.created_at >= NOW() - INTERVAL '30 days'";
      visitDateSql = "WHERE started_at >= NOW() - INTERVAL '30 days'";
    } else if (period === "year") {
      logDateSql   = "AND l.created_at >= NOW() - INTERVAL '365 days'";
      visitDateSql = "WHERE started_at >= NOW() - INTERVAL '365 days'";
    }

    /* ── 2. Search filter ───────────────────────────────────── */
    let searchSql = "";
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      searchSql = `AND (
        LOWER(CAST(l.action AS TEXT))  LIKE $${params.length} OR
        LOWER(CAST(l.details AS TEXT)) LIKE $${params.length} OR
        LOWER(CAST(a.name AS TEXT))    LIKE $${params.length}
      )`;
    }

    /* ── 3. Fetch Activity Logs ─────────────────────────────── */
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
       WHERE 1=1 ${logDateSql} ${searchSql}
       ORDER BY l.created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    /* ── 4. Total Log Count for Period ──────────────────────── */
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM admin_logs l
       LEFT JOIN admins a ON a.id = l.admin_id
       WHERE 1=1 ${logDateSql} ${searchSql}`,
      params,
    );

    /* ── 5. Analytics from `site_visits` & `admin_logs` ─────── */
    const [
      vToday,
      vMonth,
      vYear,
      vAll,
      periodMetrics
    ] = await Promise.all([
      // Visit Counts across periods
      client.query(`SELECT COUNT(*)::int AS c FROM public.site_visits WHERE started_at >= CURRENT_DATE`),
      client.query(`SELECT COUNT(*)::int AS c FROM public.site_visits WHERE started_at >= NOW() - INTERVAL '30 days'`),
      client.query(`SELECT COUNT(*)::int AS c FROM public.site_visits WHERE started_at >= NOW() - INTERVAL '365 days'`),
      client.query(`SELECT COUNT(*)::int AS c FROM public.site_visits`),

      // Clicks & Minutes used for the selected period
      client.query(`
        SELECT
          COALESCE(SUM(clicks_count), 0)::int AS total_clicks,
          COALESCE(SUM(page_views), 0)::int   AS total_page_views,
          COALESCE(
            ROUND(SUM(EXTRACT(EPOCH FROM (last_active_at - started_at))) / 60), 
            0
          )::int AS minutes_used
        FROM public.site_visits
        ${visitDateSql}
      `),
    ]);

    return res.json({
      success: true,
      period,
      total: countRows[0]?.count ?? 0,
      limit,
      offset,
      logs,
      visits: {
        today : vToday.rows[0]?.c ?? 0,
        month : vMonth.rows[0]?.c ?? 0,
        year  : vYear.rows[0]?.c  ?? 0,
        all   : vAll.rows[0]?.c   ?? 0,
      },
      metrics: {
        clicks       : periodMetrics.rows[0]?.total_clicks ?? 0,
        page_views   : periodMetrics.rows[0]?.total_page_views ?? 0,
        minutes_used : periodMetrics.rows[0]?.minutes_used ?? 0,
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