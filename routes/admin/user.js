// ════════════════════════════════════════════════════════════
// FILE: routes/admin/user.js
// Base: /api/admin/users
//
// Manages regular USERS only (from public.users table).
// Admin accounts live in a separate `admins` table and are
// managed via /api/admin/admins — they are never returned here.
//
// Source tracking additions:
// • source column included in USER_FIELDS projection
// • GET /api/admin/users        — filterable by ?source=
// • GET /api/admin/users/stats  — includes source breakdown
// • GET /api/admin/users/source-stats — dedicated analytics
// • GET /api/admin/users/source-stats/export — CSV download
// • GET /api/admin/users/source-stats/:source — single source
// ════════════════════════════════════════════════════════════

import express         from "express";
import { pool }        from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

/* ─── helpers ─────────────────────────────────────────────── */
const safeInt = (v, fb = 0) => {
  const n = parseInt(v);
  return isNaN(n) ? fb : n;
};

const num = (v) => Number(v ?? 0);

/*
  KNOWN_SOURCES mirrors the backend ALLOWED_SOURCES list
  in auth.routes.js — keep both in sync if you add platforms.
*/
const KNOWN_SOURCES = Object.freeze([
  // Social Media
  "tiktok", "instagram", "facebook", "twitter",
  "snapchat", "pinterest", "linkedin", "reddit",
  "youtube", "threads",
  // Messaging Apps
  "whatsapp", "telegram", "discord", "signal",
  "viber", "wechat", "slack", "line", "skype", "kakao",
  // Search Engines
  "google", "bing", "yahoo", "duckduckgo",
  // Other Traffic
  "email", "sms", "blog", "podcast",
  "referral", "direct", "other",
]);

/* ─── safe user projection ─────────────────────────────────
   Fields returned when listing / viewing regular users.
   Never includes password_hash or any admin-only column.
   source is included so the admin can see where each user
   came from directly in the user list. */
const USER_FIELDS = `
  id,
  name,
  email,
  phone,
  phone_number,
  username,
  business_name,
  store_name,
  city,
  state,
  status,
  role,
  subscription_plan,
  subscription_status,
  subscription_expires_at,
  profile_image,
  verified,
  store_verified,
  trust_score,
  rating,
  source,
  created_at,
  last_login
`;

// ─────────────────────────────────────────────────────────────
// GET /api/admin/users
// List regular users with search + pagination
// Query: ?q=... &limit=100 &offset=0 &status=active &source=tiktok
// ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const q      = (req.query.q ?? req.query.search ?? "").trim();
    const status = (req.query.status ?? "").trim();
    const source = (req.query.source ?? "").trim().toLowerCase();
    const limit  = Math.min(200, safeInt(req.query.limit,  100));
    const offset = Math.max(0,   safeInt(req.query.offset, 0));

    const params = [];
    const where  = [];

    /* ── Search filter ─────────────────────────────────── */
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      params.push(`%${q}%`);
      where.push(`
        (
          LOWER(CAST(name             AS TEXT)) LIKE $${params.length - 1}
          OR LOWER(CAST(email         AS TEXT)) LIKE $${params.length - 1}
          OR CAST(phone               AS TEXT)  LIKE $${params.length}
          OR CAST(phone_number        AS TEXT)  LIKE $${params.length}
          OR LOWER(CAST(username      AS TEXT)) LIKE $${params.length - 1}
          OR LOWER(CAST(business_name AS TEXT)) LIKE $${params.length - 1}
          OR LOWER(CAST(store_name    AS TEXT)) LIKE $${params.length - 1}
        )
      `);
    }

    /* ── Status filter ─────────────────────────────────── */
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    /* ── Source filter ─────────────────────────────────── */
    if (source) {
      params.push(source);
      where.push(`source = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    params.push(limit);
    params.push(offset);

    /* ── Fetch rows ────────────────────────────────────── */
    const { rows } = await client.query(
      `SELECT ${USER_FIELDS}
       FROM public.users
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    /* ── Total count for pagination ────────────────────── */
    const { rows: totalRows } = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM public.users
       ${whereSql}`,
      params.slice(0, params.length - 2),
    );

    res.json({
      users  : rows,
      total  : totalRows[0].count,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[GET /admin/users]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/users/stats
// Quick counters for dashboard — now includes source summary
// ─────────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  const client = await pool.connect();
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      total,
      active,
      banned,
      todayCount,
      verified,
      sourceBreakdown,
      sourceToday,
      sourceTopOne,
    ] = await Promise.all([
      client.query(`SELECT COUNT(*)::int FROM public.users`),
      client.query(`SELECT COUNT(*)::int FROM public.users WHERE status = 'active'`),
      client.query(`SELECT COUNT(*)::int FROM public.users WHERE status = 'banned'`),
      client.query(
        `SELECT COUNT(*)::int FROM public.users WHERE created_at >= $1`,
        [today]
      ),
      client.query(`SELECT COUNT(*)::int FROM public.users WHERE verified = true`),

      /* All-time source breakdown */
      client.query(
        `SELECT
           source,
           COUNT(*)::int                                        AS total,
           ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)  AS percentage
         FROM public.users
         GROUP BY source
         ORDER BY total DESC`
      ),

      /* Today's signups by source */
      client.query(
        `SELECT source, COUNT(*)::int AS total
         FROM public.users
         WHERE created_at >= $1
         GROUP BY source
         ORDER BY total DESC`,
        [today]
      ),

      /* Top source overall */
      client.query(
        `SELECT source, COUNT(*)::int AS total
         FROM public.users
         GROUP BY source
         ORDER BY total DESC
         LIMIT 1`
      ),
    ]);

    res.json({
      total    : total.rows[0].count,
      active   : active.rows[0].count,
      banned   : banned.rows[0].count,
      today    : todayCount.rows[0].count,
      verified : verified.rows[0].count,

      /*
        source_summary gives the dashboard a quick snapshot
        without needing a separate API call.
      */
      source_summary: {
        breakdown  : sourceBreakdown.rows.map((r) => ({
          source     : r.source,
          total      : num(r.total),
          percentage : num(r.percentage),
        })),
        today      : sourceToday.rows.map((r) => ({
          source : r.source,
          total  : num(r.total),
        })),
        top_source : sourceTopOne.rows[0]?.source ?? "direct",
      },
    });
  } catch (err) {
    console.error("[GET /admin/users/stats]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/users/source-stats
// Full dedicated source analytics endpoint
//
// Query params:
//   ?period=today | week | month | all  (default: all)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD      (custom range)
// ─────────────────────────────────────────────────────────────
router.get("/source-stats", async (req, res) => {
  const client = await pool.connect();
  try {
    const { period = "all", from, to } = req.query;

    /* ── Build date filter ─────────────────────────────── */
    let dateFilter  = "";
    const dateParams = [];

    if (from && to) {
      dateFilter = `AND created_at BETWEEN $1 AND $2`;
      dateParams.push(from, to);
    } else if (period === "today") {
      dateFilter = `AND created_at >= CURRENT_DATE`;
    } else if (period === "week") {
      dateFilter = `AND created_at >= NOW() - INTERVAL '7 days'`;
    } else if (period === "month") {
      dateFilter = `AND created_at >= DATE_TRUNC('month', NOW())`;
    }

    const [
      allTimeRes,
      todayRes,
      weekRes,
      monthRes,
      topRes,
      dailyTrendRes,
      filteredRes,
      weeklyTrendRes,
    ] = await Promise.all([

      /* 1. All-time breakdown */
      client.query(
        `SELECT
           source,
           COUNT(*)::int                                         AS total,
           ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)   AS percentage,
           MIN(created_at)                                        AS first_signup,
           MAX(created_at)                                        AS last_signup
         FROM public.users
         GROUP BY source
         ORDER BY total DESC`
      ),

      /* 2. Today */
      client.query(
        `SELECT source, COUNT(*)::int AS total
         FROM public.users
         WHERE created_at >= CURRENT_DATE
         GROUP BY source
         ORDER BY total DESC`
      ),

      /* 3. Last 7 days */
      client.query(
        `SELECT source, COUNT(*)::int AS total
         FROM public.users
         WHERE created_at >= NOW() - INTERVAL '7 days'
         GROUP BY source
         ORDER BY total DESC`
      ),

      /* 4. This calendar month */
      client.query(
        `SELECT source, COUNT(*)::int AS total
         FROM public.users
         WHERE created_at >= DATE_TRUNC('month', NOW())
         GROUP BY source
         ORDER BY total DESC`
      ),

      /* 5. Single top performer */
      client.query(
        `SELECT source, COUNT(*)::int AS total
         FROM public.users
         GROUP BY source
         ORDER BY total DESC
         LIMIT 1`
      ),

      /* 6. Daily trend — last 30 days, per source */
      client.query(
        `SELECT
           DATE(created_at) AS day,
           source,
           COUNT(*)::int    AS total
         FROM public.users
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at), source
         ORDER BY day ASC, total DESC`
      ),

      /* 7. Filtered result — respects ?period or ?from+?to */
      dateParams.length > 0
        ? client.query(
            `SELECT
               source,
               COUNT(*)::int                                        AS total,
               ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)  AS percentage
             FROM public.users
             WHERE 1=1 ${dateFilter}
             GROUP BY source
             ORDER BY total DESC`,
            dateParams
          )
        : client.query(
            `SELECT
               source,
               COUNT(*)::int                                        AS total,
               ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)  AS percentage
             FROM public.users
             WHERE 1=1 ${dateFilter}
             GROUP BY source
             ORDER BY total DESC`
          ),

      /* 8. Weekly trend — last 12 weeks, per source */
      client.query(
        `SELECT
           DATE_TRUNC('week', created_at) AS week_start,
           source,
           COUNT(*)::int                  AS total
         FROM public.users
         WHERE created_at >= NOW() - INTERVAL '12 weeks'
         GROUP BY DATE_TRUNC('week', created_at), source
         ORDER BY week_start ASC, total DESC`
      ),
    ]);

    /* ── Sources with zero signups ──────────────────────── */
    const activeSources = new Set(allTimeRes.rows.map((r) => r.source));
    const zeroSources   = KNOWN_SOURCES.filter((s) => !activeSources.has(s));

    return res.json({
      success      : true,
      period       : from && to ? `${from} → ${to}` : period,

      all_time     : allTimeRes.rows.map((r) => ({
        source       : r.source,
        total        : num(r.total),
        percentage   : num(r.percentage),
        first_signup : r.first_signup,
        last_signup  : r.last_signup,
      })),

      today        : todayRes.rows.map((r) => ({
        source : r.source,
        total  : num(r.total),
      })),

      this_week    : weekRes.rows.map((r) => ({
        source : r.source,
        total  : num(r.total),
      })),

      this_month   : monthRes.rows.map((r) => ({
        source : r.source,
        total  : num(r.total),
      })),

      top_source   : topRes.rows[0]
        ? { source: topRes.rows[0].source, total: num(topRes.rows[0].total) }
        : null,

      daily_trend  : dailyTrendRes.rows.map((r) => ({
        day    : r.day,
        source : r.source,
        total  : num(r.total),
      })),

      weekly_trend : weeklyTrendRes.rows.map((r) => ({
        week_start : r.week_start,
        source     : r.source,
        total      : num(r.total),
      })),

      filtered     : filteredRes.rows.map((r) => ({
        source     : r.source,
        total      : num(r.total),
        percentage : num(r.percentage),
      })),

      zero_sources : zeroSources,
      known_sources: [...KNOWN_SOURCES],
    });

  } catch (err) {
    console.error("[GET /admin/users/source-stats]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/users/source-stats/export
// Download source analytics as CSV
//
// Query params — same as /source-stats:
//   ?period=today | week | month | all
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────
router.get("/source-stats/export", async (req, res) => {
  const client = await pool.connect();
  try {
    const { period = "all", from, to } = req.query;

    let dateFilter   = "";
    const dateParams = [];

    if (from && to) {
      dateFilter = `AND created_at BETWEEN $1 AND $2`;
      dateParams.push(from, to);
    } else if (period === "today") {
      dateFilter = `AND created_at >= CURRENT_DATE`;
    } else if (period === "week") {
      dateFilter = `AND created_at >= NOW() - INTERVAL '7 days'`;
    } else if (period === "month") {
      dateFilter = `AND created_at >= DATE_TRUNC('month', NOW())`;
    }

    const { rows } = dateParams.length > 0
      ? await client.query(
          `SELECT
             source,
             COUNT(*)::int                                        AS total,
             ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)  AS percentage,
             MIN(created_at)                                       AS first_signup,
             MAX(created_at)                                       AS last_signup
           FROM public.users
           WHERE 1=1 ${dateFilter}
           GROUP BY source
           ORDER BY total DESC`,
          dateParams
        )
      : await client.query(
          `SELECT
             source,
             COUNT(*)::int                                        AS total,
             ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)  AS percentage,
             MIN(created_at)                                       AS first_signup,
             MAX(created_at)                                       AS last_signup
           FROM public.users
           WHERE 1=1 ${dateFilter}
           GROUP BY source
           ORDER BY total DESC`
        );

    /* ── Build CSV ──────────────────────────────────────── */
    const header = "Source,Total Users,Percentage,First Signup,Last Signup\n";
    const csvRows = rows.map((r) =>
      [
        r.source,
        num(r.total),
        `${num(r.percentage)}%`,
        r.first_signup
          ? new Date(r.first_signup).toISOString().split("T")[0]
          : "",
        r.last_signup
          ? new Date(r.last_signup).toISOString().split("T")[0]
          : "",
      ].join(",")
    );

    const csv      = header + csvRows.join("\n");
    const filename = `source-stats-${period}-${Date.now()}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);

  } catch (err) {
    console.error("[GET /admin/users/source-stats/export]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/users/source-stats/:source
// Deep dive into a single traffic source
//
// Returns:
//   • total users from this source
//   • daily signups over last 30 days
//   • verified vs unverified split
//   • banned vs active split
//   • last 10 users from this source
// ─────────────────────────────────────────────────────────────
router.get("/source-stats/:source", async (req, res) => {
  const client = await pool.connect();
  try {
    const source = req.params.source.trim().toLowerCase();

    if (!KNOWN_SOURCES.includes(source)) {
      return res.status(400).json({
        error: `Unknown source "${source}". ` +
               `Valid sources: ${KNOWN_SOURCES.join(", ")}`,
      });
    }

    const [
      summaryRes,
      dailyRes,
      verifiedRes,
      statusRes,
      recentRes,
    ] = await Promise.all([

      /* 1. Summary totals */
      client.query(
        `SELECT
           COUNT(*)::int                                          AS total,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int
                                                                  AS today,
           COUNT(*) FILTER (
             WHERE created_at >= NOW() - INTERVAL '7 days'
           )::int                                                  AS this_week,
           COUNT(*) FILTER (
             WHERE created_at >= DATE_TRUNC('month', NOW())
           )::int                                                  AS this_month
         FROM public.users
         WHERE source = $1`,
        [source]
      ),

      /* 2. Daily signups — last 30 days */
      client.query(
        `SELECT
           DATE(created_at) AS day,
           COUNT(*)::int    AS total
         FROM public.users
         WHERE source = $1
           AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY day ASC`,
        [source]
      ),

      /* 3. Verified split */
      client.query(
        `SELECT
           verified,
           COUNT(*)::int AS total
         FROM public.users
         WHERE source = $1
         GROUP BY verified`,
        [source]
      ),

      /* 4. Status split */
      client.query(
        `SELECT
           status,
           COUNT(*)::int AS total
         FROM public.users
         WHERE source = $1
         GROUP BY status
         ORDER BY total DESC`,
        [source]
      ),

      /* 5. Last 10 users from this source */
      client.query(
        `SELECT
           id, name, email, status, verified,
           created_at, last_login
         FROM public.users
         WHERE source = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [source]
      ),
    ]);

    const summary = summaryRes.rows[0];

    /* Shape verified split into { verified: N, unverified: N } */
    const verifiedMap = { verified: 0, unverified: 0 };
    verifiedRes.rows.forEach((r) => {
      if (r.verified) verifiedMap.verified   = num(r.total);
      else            verifiedMap.unverified = num(r.total);
    });

    return res.json({
      success  : true,
      source,
      summary  : {
        total      : num(summary.total),
        today      : num(summary.today),
        this_week  : num(summary.this_week),
        this_month : num(summary.this_month),
      },
      daily_signups : dailyRes.rows.map((r) => ({
        day   : r.day,
        total : num(r.total),
      })),
      verified_split : verifiedMap,
      status_split   : statusRes.rows.map((r) => ({
        status : r.status,
        total  : num(r.total),
      })),
      recent_users   : recentRes.rows,
    });

  } catch (err) {
    console.error("[GET /admin/users/source-stats/:source]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/users/:id
// Full details for one user
// ─────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT
         id, name, email, phone, phone_number,
         username, business_name, store_name, store_slug,
         city, state, country, status, role,
         subscription_plan, subscription_status,
         subscription_expires_at, billing_cycle, auto_renew,
         profile_image, verified, store_verified,
         trust_score, rating, total_sales, products_count,
         followers_count, following_count,
         source,
         created_at, last_login, last_seen
       FROM public.users
       WHERE id = $1`,
      [req.params.id],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("[GET /admin/users/:id]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/users/:id/ban
// Suspend a user account
// Body: { reason? }
// ─────────────────────────────────────────────────────────────
router.post("/:id/ban", async (req, res) => {
  const client = await pool.connect();
  try {
    const targetId = req.params.id;
    const reason   = (req.body?.reason ?? "").trim();

    const { rows: existing } = await client.query(
      `SELECT id, status, name FROM public.users WHERE id = $1`,
      [targetId],
    );

    if (!existing.length) {
      return res.status(404).json({ error: "User not found." });
    }

    if (existing[0].status === "banned") {
      return res.status(400).json({ error: "User is already banned." });
    }

    await client.query(
      `UPDATE public.users
       SET status     = 'banned',
           banned_at  = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [targetId],
    );

    await client.query(
      `INSERT INTO admin_logs
         (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'ban_user', 'user', $2, $3)`,
      [
        req.admin.id,
        targetId,
        `Banned "${existing[0].name}"${reason ? ` — Reason: ${reason}` : ""}`,
      ],
    ).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error("[POST /admin/users/:id/ban]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/users/:id/unban
// Restore a suspended user
// ─────────────────────────────────────────────────────────────
router.post("/:id/unban", async (req, res) => {
  const client = await pool.connect();
  try {
    const targetId = req.params.id;

    const { rows: existing } = await client.query(
      `SELECT id, status, name FROM public.users WHERE id = $1`,
      [targetId],
    );

    if (!existing.length) {
      return res.status(404).json({ error: "User not found." });
    }

    if (existing[0].status === "active") {
      return res.status(400).json({ error: "User is already active." });
    }

    await client.query(
      `UPDATE public.users
       SET status     = 'active',
           banned_at  = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [targetId],
    );

    await client.query(
      `INSERT INTO admin_logs
         (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'unban_user', 'user', $2, $3)`,
      [req.admin.id, targetId, `Unbanned "${existing[0].name}"`],
    ).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error("[POST /admin/users/:id/unban]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;