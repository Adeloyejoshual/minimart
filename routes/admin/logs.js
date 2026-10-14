// ════════════════════════════════════════════════════════════
// FILE: routes/admin/logs.js
// Base: /api/admin/logs
//
// Activity log viewer with period filtering.
// Supports: ?period=today | all | month | year
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
// GET /api/admin/logs
// Query: ?period=today|all|month|year  (default: all)
//        &limit=200 &offset=0
// ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const period = (req.query.period ?? "all").trim().toLowerCase();
    const limit  = Math.min(500, safeInt(req.query.limit, 200));
    const offset = Math.max(0, safeInt(req.query.offset, 0));

    /* ── Build date filter ─────────────────────────────── */
    let dateFilter = "";
    const dateParams = [];

    if (period === "today") {
      dateFilter = "WHERE created_at >= CURRENT_DATE";
    } else if (period === "month") {
      dateFilter = "WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'";
      // Last calendar month — or use this for "last 30 days":
      // dateFilter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
    } else if (period === "year") {
      dateFilter = "WHERE created_at >= DATE_TRUNC('year', NOW()) - INTERVAL '1 year'";
      // Last calendar year — or use this for "last 365 days":
      // dateFilter = "WHERE created_at >= NOW() - INTERVAL '1 year'";
    }
    // "all" → no filter

    /* ── Fetch logs ────────────────────────────────────── */
    const queryParams = [...dateParams, limit, offset];

    const { rows } = await client.query(
      `SELECT
         id,
         admin_id,
         admin_name,
         action,
         target_type,
         target_id,
         details,
         created_at
       FROM admin_logs
       ${dateFilter}
       ORDER BY created_at DESC
       LIMIT $${queryParams.length - 1}
       OFFSET $${queryParams.length}`,
      queryParams,
    );

    /* ── Total count for this period ───────────────────── */
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM admin_logs
       ${dateFilter}`,
      dateParams,
    );

    /* ── Quick stats for all periods (sidebar / chips) ─── */
    const [todayCount, monthCount, yearCount, allCount] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::int AS c FROM admin_logs WHERE created_at >= CURRENT_DATE`
      ),
      client.query(
        `SELECT COUNT(*)::int AS c FROM admin_logs WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'`
      ),
      client.query(
        `SELECT COUNT(*)::int AS c FROM admin_logs WHERE created_at >= DATE_TRUNC('year', NOW()) - INTERVAL '1 year'`
      ),
      client.query(
        `SELECT COUNT(*)::int AS c FROM admin_logs`
      ),
    ]);

    res.json({
      logs: rows,
      total: countRows[0].count,
      period,
      limit,
      offset,
      stats: {
        today: todayCount.rows[0].c,
        month: monthCount.rows[0].c,
        year:  yearCount.rows[0].c,
        all:   allCount.rows[0].c,
      },
    });
  } catch (err) {
    console.error("[GET /admin/logs]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;