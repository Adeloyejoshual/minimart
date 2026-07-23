// ════════════════════════════════════════════════════════════
// FILE: routes/admin/user.js
// Base: /api/admin/users
//
// Manages regular USERS only (from public.users table).
// Admin accounts live in a separate `admins` table and are
// managed via /api/admin/admins — they are never returned here.
// ════════════════════════════════════════════════════════════

import express        from "express";
import { pool }       from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

/* ─── helpers ─────────────────────────────────────────────── */
const safeInt = (v, fb = 0) => {
  const n = parseInt(v);
  return isNaN(n) ? fb : n;
};

/* ─── safe user projection ─────────────────────────────────
   Fields returned when listing / viewing regular users.
   Never includes password_hash or any admin-only column. */
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
  created_at,
  last_login
`;

// ─────────────────────────────────────────────────────────────
// GET /api/admin/users
// List regular users with search + pagination
// Query: ?q=... &limit=100 &offset=0 &status=active
// ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const q      = (req.query.q ?? req.query.search ?? "").trim();
    const status = (req.query.status ?? "").trim();
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
          LOWER(CAST(name          AS TEXT)) LIKE $${params.length - 1}
          OR LOWER(CAST(email      AS TEXT)) LIKE $${params.length - 1}
          OR CAST(phone            AS TEXT)  LIKE $${params.length}
          OR CAST(phone_number     AS TEXT)  LIKE $${params.length}
          OR LOWER(CAST(username   AS TEXT)) LIKE $${params.length - 1}
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
// Quick counters for dashboard
// ─────────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  const client = await pool.connect();
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, active, banned, todayCount, verified] = await Promise.all([
      client.query(`SELECT COUNT(*)::int FROM public.users`),
      client.query(`SELECT COUNT(*)::int FROM public.users WHERE status = 'active'`),
      client.query(`SELECT COUNT(*)::int FROM public.users WHERE status = 'banned'`),
      client.query(`SELECT COUNT(*)::int FROM public.users WHERE created_at >= $1`, [today]),
      client.query(`SELECT COUNT(*)::int FROM public.users WHERE verified = true`),
    ]);

    res.json({
      total    : total.rows[0].count,
      active   : active.rows[0].count,
      banned   : banned.rows[0].count,
      today    : todayCount.rows[0].count,
      verified : verified.rows[0].count,
    });
  } catch (err) {
    console.error("[GET /admin/users/stats]", err.message);
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
    const targetId    = req.params.id;
    const reason      = (req.body?.reason ?? "").trim();

    /* Ensure the user exists */
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

    /* Best-effort audit log */
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