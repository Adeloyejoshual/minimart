// ════════════════════════════════════════════════════════════
// FILE: routes/admin/subscriptionAdmin.js
// Base: /api/admin/subscriptions
// ════════════════════════════════════════════════════════════

import express from "express";
import { pool } from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════ */
const safeInt = (v, fb = 0) => { const n = parseInt(v);  return isNaN(n) ? fb : n; };
const safeNum = (v, fb = 0) => { const n = Number(v);    return isNaN(n) ? fb : n; };

// ─── Write audit entry — never throws ────────────────────────────────────────
const logAction = async (client, adminId, adminName, action, targetUserId, detail = null) => {
  try {
    await client.query(
      `INSERT INTO subscription_audit_logs
         (admin_id, admin_name, action, target_user_id, detail, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW())`,
      [adminId, adminName, action, targetUserId, detail]
    );
  } catch { /* never block the main action */ }
};

// ─── Update search_priority on public.products ────────────────────────────────
// Detects the seller/owner column automatically so it works regardless of schema.
// Never throws — subscription activates even if this step fails.
const updateSearchPriority = async (client, userId, priority) => {
  try {
    // Find the column that links a product to its seller
    const { rows: ownerCols } = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'products'
         AND column_name  IN (
           'user_id','seller_id','owner_id',
           'created_by','posted_by','vendor_id'
         )
       LIMIT 1`
    );

    if (!ownerCols.length) {
      console.warn("[updateSearchPriority] no owner column found on public.products — skipped.");
      return;
    }

    const ownerCol = ownerCols[0].column_name;

    // Check search_priority column exists
    const { rows: spCols } = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'products'
         AND column_name  = 'search_priority'`
    );

    if (!spCols.length) {
      console.warn("[updateSearchPriority] search_priority column not found — skipped.");
      return;
    }

    await client.query(
      `UPDATE public.products
       SET search_priority = $1,
           updated_at      = NOW()
       WHERE ${ownerCol} = $2`,
      [priority, userId]
    );
  } catch (err) {
    console.warn("[updateSearchPriority] skipped:", err.message);
  }
};

// ─── Apply a plan change inside an already-open transaction ──────────────────
const applyPlanChange = async (client, userId, planSlug, billingCycle = null) => {
  const { rows: planRows } = await client.query(
    `SELECT id, slug, name, rank, monthly_price, yearly_price
     FROM subscription_plans WHERE slug = $1`,
    [planSlug]
  );
  if (!planRows.length) throw new Error(`Plan "${planSlug}" not found.`);
  const plan = planRows[0];

  // ── Revert to free ─────────────────────────────────────────────────────────
  if (planSlug === "free") {
    await client.query(
      `UPDATE subscriptions SET status = 'superseded', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    await client.query(
      `UPDATE users
       SET subscription_plan       = 'free',
           subscription_status     = 'inactive',
           billing_cycle           = NULL,
           subscription_started_at = NULL,
           subscription_expires_at = NULL,
           auto_renew              = TRUE,
           updated_at              = NOW()
       WHERE id = $1`,
      [userId]
    );
    await updateSearchPriority(client, userId, 0);
    return { plan };
  }

  // ── Supersede existing active subscription ─────────────────────────────────
  await client.query(
    `UPDATE subscriptions SET status = 'superseded', updated_at = NOW()
     WHERE user_id = $1 AND status = 'active'`,
    [userId]
  );

  // Inherit previous billing cycle if not specified
  const { rows: prevRows } = await client.query(
    `SELECT billing_cycle, expires_at FROM subscriptions
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  const cycle = billingCycle ?? prevRows[0]?.billing_cycle ?? "monthly";

  // Keep existing expiry if still in the future, otherwise compute fresh
  const expiresAt =
    prevRows[0]?.expires_at && new Date(prevRows[0].expires_at) > new Date()
      ? prevRows[0].expires_at
      : (() => {
          const d = new Date();
          cycle === "yearly"
            ? d.setFullYear(d.getFullYear() + 1)
            : d.setMonth(d.getMonth() + 1);
          return d;
        })();

  const { rows: subRows } = await client.query(
    `INSERT INTO subscriptions
       (user_id, plan_id, plan_slug, billing_cycle, amount, currency,
        payment_reference, status, auto_renew, started_at, expires_at,
        metadata, created_at, updated_at)
     VALUES ($1,$2,$3,$4,0,'NGN',$5,'active',TRUE,NOW(),$6,
             '{"source":"admin_change"}'::jsonb,NOW(),NOW())
     RETURNING id, expires_at`,
    [userId, plan.id, plan.slug, cycle, `ADMIN_GRANT_${Date.now()}`, expiresAt]
  );

  await client.query(
    `UPDATE users
     SET subscription_plan       = $1,
         subscription_status     = 'active',
         billing_cycle           = $2,
         subscription_started_at = NOW(),
         subscription_expires_at = $3,
         auto_renew              = TRUE,
         updated_at              = NOW()
     WHERE id = $4`,
    [plan.slug, cycle, expiresAt, userId]
  );

  await updateSearchPriority(client, userId, plan.rank);

  return { plan, subscriptionId: subRows[0].id, expiresAt: subRows[0].expires_at };
};


/* ═══════════════════════════════════════════════════════════════════════════
   NAMED ROUTES  (must all come before /:userId param routes)
═══════════════════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const page   = Math.max(1, safeInt(req.query.page,  1));
    const limit  = Math.min(100, safeInt(req.query.limit, 20));
    const offset = (page - 1) * limit;

    const { plan, status, cycle, auto_renew, date_from, date_to, q } = req.query;

    const conditions = [];
    const values     = [];
    let   idx        = 1;

    if (plan       && plan       !== "all") { conditions.push(`s.plan_slug = $${idx++}`);    values.push(plan);                  }
    if (status     && status     !== "all") { conditions.push(`s.status = $${idx++}`);        values.push(status);                }
    if (cycle      && cycle      !== "all") { conditions.push(`s.billing_cycle = $${idx++}`); values.push(cycle);                 }
    if (auto_renew && auto_renew !== "all") { conditions.push(`s.auto_renew = $${idx++}`);    values.push(auto_renew === "true"); }
    if (date_from)                          { conditions.push(`s.started_at >= $${idx++}`);   values.push(date_from);             }
    if (date_to)                            { conditions.push(`s.started_at <= $${idx++}`);   values.push(date_to);               }

    if (q?.trim()) {
      conditions.push(`(
        LOWER(CAST(u.name             AS TEXT)) LIKE $${idx}
        OR LOWER(CAST(u.email         AS TEXT)) LIKE $${idx}
        OR CAST(u.phone               AS TEXT)  LIKE $${idx}
        OR CAST(u.phone_number        AS TEXT)  LIKE $${idx}
        OR LOWER(CAST(u.username      AS TEXT)) LIKE $${idx}
        OR LOWER(CAST(u.business_name AS TEXT)) LIKE $${idx}
        OR CAST(s.id                  AS TEXT)  LIKE $${idx}
        OR CAST(s.payment_reference   AS TEXT)  LIKE $${idx}
      )`);
      values.push(`%${q.trim().toLowerCase()}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows: subscriptions } = await client.query(
      `SELECT
         s.id,
         s.user_id,
         s.plan_slug,
         s.billing_cycle,
         s.amount,
         s.currency,
         s.payment_reference,
         s.status,
         s.auto_renew,
         s.started_at,
         s.expires_at,
         s.created_at,
         u.name                                AS user_name,
         u.email                               AS user_email,
         COALESCE(u.phone, u.phone_number, '') AS user_phone,
         u.business_name,
         u.store_verified,
         sp.name                               AS plan_name,
         sp.badge                              AS plan_badge
       FROM subscriptions s
       LEFT JOIN users              u  ON u.id    = s.user_id
       LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) AS total
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       ${where}`,
      values
    );

    const total = safeInt(countRows[0].total);

    res.json({
      subscriptions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[GET /subscriptions]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get("/stats", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const safe = (p) => p.catch(() => ({ rows: [{}] }));

    const [countsRes, mrrRes, planRes, revenueRes] = await Promise.all([
      safe(client.query(
        `SELECT
           COUNT(*)                                                  AS total,
           COUNT(*) FILTER (WHERE status = 'active')                AS active,
           COUNT(*) FILTER (WHERE status = 'expired')               AS expired,
           COUNT(*) FILTER (WHERE status = 'cancelled')             AS cancelled,
           COUNT(*) FILTER (WHERE status = 'suspended')             AS suspended,
           COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)  AS today
         FROM subscriptions`
      )),
      safe(client.query(
        `SELECT COALESCE(SUM(
           CASE billing_cycle WHEN 'yearly' THEN amount / 12 ELSE amount END
         ), 0) AS mrr FROM subscriptions WHERE status = 'active'`
      )),
      safe(client.query(
        `SELECT plan_slug, COUNT(*) AS count
         FROM subscriptions WHERE status = 'active'
         GROUP BY plan_slug`
      )),
      safe(client.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (
             WHERE DATE(paid_at) = CURRENT_DATE), 0) AS today,
           COALESCE(SUM(amount) FILTER (
             WHERE DATE_TRUNC('month', paid_at) = DATE_TRUNC('month', NOW())), 0) AS this_month
         FROM payment_transactions WHERE status = 'success'`
      )),
    ]);

    const c      = countsRes.rows[0] ?? {};
    const mrr    = safeNum(mrrRes.rows[0]?.mrr);
    const active = safeInt(c.active);
    const byPlan = planRes.rows.reduce((acc, r) => {
      acc[r.plan_slug] = safeInt(r.count);
      return acc;
    }, {});

    res.json({
      total            : safeInt(c.total),
      active,
      expired          : safeInt(c.expired),
      cancelled        : safeInt(c.cancelled),
      suspended        : safeInt(c.suspended),
      today            : safeInt(c.today),
      mrr,
      arr              : mrr * 12,
      arpu             : active > 0 ? Math.round(mrr / active) : 0,
      byPlan,
      revenueToday     : safeNum(revenueRes.rows[0]?.today),
      revenueThisMonth : safeNum(revenueRes.rows[0]?.this_month),
    });
  } catch (err) {
    console.error("[GET /subscriptions/stats]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/revenue
// ─────────────────────────────────────────────────────────────────────────────
router.get("/revenue", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const safe = (p) => p.catch(() => ({ rows: [] }));

    const [dailyRes, weeklyRes, monthlyRes] = await Promise.all([
      safe(client.query(
        `SELECT TO_CHAR(DATE(paid_at), 'MM-DD') AS label,
                COALESCE(SUM(amount)/100, 0)     AS amount
         FROM payment_transactions
         WHERE status = 'success'
           AND paid_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(paid_at)
         ORDER BY DATE(paid_at)`
      )),
      safe(client.query(
        `SELECT TO_CHAR(DATE_TRUNC('week', paid_at), 'MM-DD') AS label,
                COALESCE(SUM(amount)/100, 0)                  AS amount
         FROM payment_transactions
         WHERE status = 'success'
           AND paid_at >= NOW() - INTERVAL '12 weeks'
         GROUP BY DATE_TRUNC('week', paid_at)
         ORDER BY DATE_TRUNC('week', paid_at)`
      )),
      safe(client.query(
        `SELECT TO_CHAR(DATE_TRUNC('month', paid_at), 'Mon YY') AS label,
                COALESCE(SUM(amount)/100, 0)                    AS amount
         FROM payment_transactions
         WHERE status = 'success'
           AND paid_at >= NOW() - INTERVAL '12 months'
         GROUP BY DATE_TRUNC('month', paid_at)
         ORDER BY DATE_TRUNC('month', paid_at)`
      )),
    ]);

    res.json({
      daily   : dailyRes.rows.map((r)   => ({ label: r.label, amount: safeNum(r.amount) })),
      weekly  : weeklyRes.rows.map((r)  => ({ label: r.label, amount: safeNum(r.amount) })),
      monthly : monthlyRes.rows.map((r) => ({ label: r.label, amount: safeNum(r.amount) })),
    });
  } catch (err) {
    console.error("[GET /subscriptions/revenue]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/expiring
// ─────────────────────────────────────────────────────────────────────────────
router.get("/expiring", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT
         s.id, s.user_id, s.plan_slug, s.billing_cycle,
         s.expires_at, s.auto_renew, s.status,
         u.name  AS user_name,
         u.email AS user_email
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.status = 'active'
         AND s.expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
       ORDER BY s.expires_at ASC`
    );
    res.json({ subscriptions: rows });
  } catch (err) {
    console.error("[GET /subscriptions/expiring]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/churn
// ─────────────────────────────────────────────────────────────────────────────
router.get("/churn", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE status = 'cancelled'
             AND DATE(updated_at) = CURRENT_DATE)              AS cancelled_today,
         COUNT(*) FILTER (
           WHERE status = 'cancelled'
             AND updated_at >= NOW() - INTERVAL '7 days')      AS cancelled_week,
         COUNT(*) FILTER (WHERE status = 'expired')            AS expired,
         COUNT(*) FILTER (
           WHERE status = 'active'
             AND metadata::text ILIKE '%reactivate%')          AS reactivated,
         COUNT(*) FILTER (
           WHERE status = 'active'
             AND renewal_type = 'auto')                        AS renewed
       FROM subscriptions`
    );
    const r = rows[0] ?? {};
    res.json({
      cancelledToday : safeInt(r.cancelled_today),
      cancelledWeek  : safeInt(r.cancelled_week),
      expired        : safeInt(r.expired),
      reactivated    : safeInt(r.reactivated),
      renewed        : safeInt(r.renewed),
    });
  } catch (err) {
    console.error("[GET /subscriptions/churn]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/forecast
// ─────────────────────────────────────────────────────────────────────────────
router.get("/forecast", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days')  AS next_7_count,
         COUNT(*) FILTER (
           WHERE expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days') AS next_30_count,
         COALESCE(SUM(amount) FILTER (
           WHERE expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'),  0) AS revenue_7,
         COALESCE(SUM(amount) FILTER (
           WHERE expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'), 0) AS revenue_30
       FROM subscriptions
       WHERE status = 'active' AND auto_renew = TRUE`
    );
    const r = rows[0] ?? {};
    res.json({
      next7Days  : safeInt(r.next_7_count),
      next30Days : safeInt(r.next_30_count),
      revenue7   : safeNum(r.revenue_7),
      revenue30  : safeNum(r.revenue_30),
    });
  } catch (err) {
    console.error("[GET /subscriptions/forecast]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/top-subscribers
// ─────────────────────────────────────────────────────────────────────────────
router.get("/top-subscribers", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT
         s.user_id,
         u.name      AS user_name,
         u.email     AS user_email,
         s.plan_slug,
         SUM(s.amount) AS total_spend
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.status != 'failed'
       GROUP BY s.user_id, u.name, u.email, s.plan_slug
       ORDER BY total_spend DESC
       LIMIT 10`
    );
    res.json({
      subscribers: rows.map((r) => ({ ...r, total_spend: safeNum(r.total_spend) })),
    });
  } catch (err) {
    console.error("[GET /subscriptions/top-subscribers]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/audit-log
// ─────────────────────────────────────────────────────────────────────────────
router.get("/audit-log", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const limit = Math.min(200, safeInt(req.query.limit, 100));
    const { rows } = await client.query(
      `SELECT
         al.id,
         al.admin_id,
         al.admin_name,
         al.action,
         al.target_user_id,
         al.detail,
         al.created_at,
         u.name  AS target_user,
         u.email AS target_email
       FROM subscription_audit_logs al
       LEFT JOIN users u ON u.id = al.target_user_id
       ORDER BY al.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ logs: rows });
  } catch (err) {
    console.error("[GET /subscriptions/audit-log]", err.message);
    res.json({ logs: [] }); // never fail — table may not exist yet
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/export
// ─────────────────────────────────────────────────────────────────────────────
router.get("/export", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { format = "csv", plan, status, q, ids } = req.query;

    const conditions = [];
    const values     = [];
    let   idx        = 1;

    if (plan   && plan   !== "all") { conditions.push(`s.plan_slug = $${idx++}`); values.push(plan);   }
    if (status && status !== "all") { conditions.push(`s.status = $${idx++}`);    values.push(status); }
    if (q?.trim()) {
      conditions.push(
        `(LOWER(CAST(u.name AS TEXT)) LIKE $${idx} OR LOWER(CAST(u.email AS TEXT)) LIKE $${idx})`
      );
      values.push(`%${q.trim().toLowerCase()}%`);
      idx++;
    }
    if (ids) {
      const idArray = ids.split(",").filter(Boolean);
      if (idArray.length) {
        conditions.push(`s.id = ANY($${idx++}::uuid[])`);
        values.push(idArray);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await client.query(
      `SELECT
         s.id,
         u.name,
         u.email,
         COALESCE(u.phone, u.phone_number, '') AS phone,
         s.plan_slug,
         s.billing_cycle,
         s.amount / 100 AS amount_naira,
         s.status,
         s.auto_renew,
         s.started_at,
         s.expires_at,
         s.payment_reference,
         s.created_at
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT 5000`,
      values
    );

    if (format === "csv") {
      const header = [
        "ID","Name","Email","Phone","Plan","Cycle",
        "Amount (₦)","Status","Auto Renew","Started","Expires","Reference","Created",
      ].join(",");

      const body = rows.map((r) => [
        r.id,
        `"${(r.name  ?? "").replace(/"/g, '""')}"`,
        `"${(r.email ?? "").replace(/"/g, '""')}"`,
        r.phone          ?? "",
        r.plan_slug      ?? "",
        r.billing_cycle  ?? "",
        r.amount_naira   ?? 0,
        r.status         ?? "",
        r.auto_renew     ? "Yes" : "No",
        r.started_at     ? new Date(r.started_at).toISOString().slice(0, 10) : "",
        r.expires_at     ? new Date(r.expires_at).toISOString().slice(0, 10) : "",
        r.payment_reference ?? "",
        r.created_at     ? new Date(r.created_at).toISOString().slice(0, 10) : "",
      ].join(",")).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="subscriptions_${Date.now()}.csv"`
      );
      return res.send(`${header}\n${body}`);
    }

    res.json({ rows, format });
  } catch (err) {
    console.error("[GET /subscriptions/export]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/search-users
// Dedicated user search for AssignPlanModal — MUST be before /:userId routes
// ─────────────────────────────────────────────────────────────────────────────
router.get("/search-users", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const q     = (req.query.q ?? "").trim();
    const limit = Math.min(20, safeInt(req.query.limit, 12));

    if (!q) {
      return res.status(400).json({ message: "q is required.", users: [] });
    }

    const lower  = q.toLowerCase();
    const search = `%${lower}%`;
    const raw    = `%${q}%`;

    // CockroachDB STRING type: use LOWER(CAST(col AS TEXT)) LIKE
    // Search both phone and phone_number separately (avoid COALESCE type issues)
    const { rows } = await client.query(
      `SELECT
         id,
         name,
         email,
         phone,
         phone_number,
         username,
         business_name,
         store_name,
         profile_image,
         status,
         subscription_plan,
         subscription_status,
         subscription_expires_at,
         verified,
         store_verified,
         role
       FROM public.users
       WHERE (
         LOWER(CAST(name             AS TEXT)) LIKE $1
         OR LOWER(CAST(email         AS TEXT)) LIKE $1
         OR CAST(phone               AS TEXT)  LIKE $2
         OR CAST(phone_number        AS TEXT)  LIKE $2
         OR LOWER(CAST(username      AS TEXT)) LIKE $1
         OR LOWER(CAST(business_name AS TEXT)) LIKE $1
         OR LOWER(CAST(store_name    AS TEXT)) LIKE $1
         OR CAST(id AS TEXT)                   LIKE $2
       )
       ORDER BY
         CASE WHEN LOWER(CAST(email AS TEXT)) = $3 THEN 0 ELSE 1 END,
         CASE WHEN LOWER(CAST(name  AS TEXT)) = $3 THEN 0 ELSE 1 END,
         name ASC
       LIMIT $4`,
      [search, raw, lower, limit]
    );

    // Normalise both phone columns into one field
    const users = rows.map((u) => ({
      ...u,
      phone: u.phone || u.phone_number || null,
    }));

    console.log(`[search-users] q="${q}" found=${users.length}`);

    res.json({ users, total: users.length });
  } catch (err) {
    console.error("[GET /subscriptions/search-users]", err.message, err.stack);
    res.status(500).json({ message: err.message, users: [] });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/verify-payment
// MUST be before /:userId routes
// ─────────────────────────────────────────────────────────────────────────────
router.post("/verify-payment", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ message: "reference is required." });

    const axios    = (await import("axios")).default;
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers : { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout : 12000,
      }
    );

    const body = response.data;

    if (!body.status || body.data?.status !== "success") {
      return res.status(400).json({
        message : "Payment not verified.",
        gateway : body.data?.gateway_response ?? "Unknown",
      });
    }

    await client.query(
      `UPDATE payment_transactions
       SET status = 'success', paid_at = NOW(), updated_at = NOW()
       WHERE reference = $1 AND status != 'success'`,
      [reference]
    ).catch(() => {});

    res.json({ message: "Payment verified successfully.", verified: true, data: body.data });
  } catch (err) {
    console.error("[POST /subscriptions/verify-payment]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/bulk/:action
// MUST be before /:userId routes
// ─────────────────────────────────────────────────────────────────────────────
router.post("/bulk/:action", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { ids }    = req.body;
    const { action } = req.params;
    const adminName  = req.admin?.name ?? "Admin";

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "ids array is required." });
    }
    if (!["cancel", "extend", "notify"].includes(action)) {
      return res.status(400).json({ message: `Unknown action "${action}".` });
    }

    await client.query("BEGIN");

    if (action === "cancel") {
      await client.query(
        `UPDATE subscriptions
         SET status = 'cancelled', auto_renew = FALSE, updated_at = NOW()
         WHERE id = ANY($1::uuid[]) AND status = 'active'`,
        [ids]
      );
    }

    if (action === "extend") {
      await client.query(
        `UPDATE subscriptions
         SET expires_at = expires_at + INTERVAL '30 days', updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [ids]
      );
    }

    await logAction(
      client, req.admin.id, adminName,
      `Bulk ${action} on ${ids.length} subscription(s)`, null,
      `IDs: ${ids.slice(0, 5).join(", ")}${ids.length > 5 ? "…" : ""}`
    );

    await client.query("COMMIT");

    res.json({ message: `Bulk ${action} applied to ${ids.length} subscription(s).` });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`[POST /subscriptions/bulk/${req.params.action}]`, err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


/* ═══════════════════════════════════════════════════════════════════════════
   :userId PARAM ROUTES — must all come AFTER the named routes above
═══════════════════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/:userId/payments
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:userId/payments", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT
         pt.id,
         pt.reference,
         pt.provider,
         pt.amount,
         pt.amount / 100 AS amount_naira,
         pt.currency,
         pt.status,
         pt.type,
         pt.paid_at,
         pt.created_at,
         s.plan_slug,
         sp.name AS plan_name
       FROM payment_transactions pt
       LEFT JOIN subscriptions s       ON s.id    = pt.subscription_id
       LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
       WHERE pt.user_id = $1
       ORDER BY pt.created_at DESC
       LIMIT 100`,
      [req.params.userId]
    );
    res.json({ transactions: rows });
  } catch (err) {
    console.error("[GET /:userId/payments]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/:userId/features
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:userId/features", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: userRows } = await client.query(
      `SELECT subscription_plan FROM users WHERE id = $1`,
      [req.params.userId]
    );
    if (!userRows.length) return res.status(404).json({ message: "User not found." });

    const planSlug = userRows[0].subscription_plan ?? "free";

    const { rows: featureRows } = await client.query(
      `SELECT sf.feature_key, sf.feature_value
       FROM subscription_features sf
       INNER JOIN subscription_plans sp ON sp.id = sf.plan_id
       WHERE sp.slug = $1`,
      [planSlug]
    );

    const features = featureRows.reduce((acc, r) => {
      acc[r.feature_key] = r.feature_value;
      return acc;
    }, {});

    const { rows: overrideRows } = await client.query(
      `SELECT feature_key, feature_value
       FROM subscription_feature_overrides
       WHERE user_id = $1`,
      [req.params.userId]
    ).catch(() => ({ rows: [] }));

    const overrides = overrideRows.reduce((acc, r) => {
      acc[r.feature_key] = r.feature_value;
      return acc;
    }, {});

    res.json({ plan: planSlug, features, overrides });
  } catch (err) {
    console.error("[GET /:userId/features]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/:userId/timeline
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:userId/timeline", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT action AS event, detail AS description, admin_name, created_at
       FROM subscription_audit_logs
       WHERE target_user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [req.params.userId]
    );
    res.json({ timeline: rows });
  } catch {
    res.json({ timeline: [] });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/:userId/notes
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:userId/notes", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, content, admin_name, created_at
       FROM subscription_notes
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.params.userId]
    );
    res.json({ notes: rows });
  } catch {
    res.json({ notes: [] });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions/:userId/fraud
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:userId/fraud", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId  = req.params.userId;
    const signals = [];

    const { rows: failedRows } = await client.query(
      `SELECT COUNT(*) AS count
       FROM payment_transactions
       WHERE user_id = $1 AND status = 'failed'`,
      [userId]
    );
    if (safeInt(failedRows[0]?.count) >= 3) {
      signals.push({
        type        : "Multiple Failed Payments",
        description : `${failedRows[0].count} failed payment attempts detected.`,
        detected_at : new Date().toISOString(),
      });
    }

    const { rows: changeRows } = await client.query(
      `SELECT COUNT(*) AS count
       FROM subscriptions
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    if (safeInt(changeRows[0]?.count) >= 5) {
      signals.push({
        type        : "Excessive Plan Changes",
        description : `${changeRows[0].count} subscription changes in the last 24 hours.`,
        detected_at : new Date().toISOString(),
      });
    }

    res.json({ signals });
  } catch (err) {
    console.error("[GET /:userId/fraud]", err.message);
    res.json({ signals: [] });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/:userId/notes
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:userId/notes", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "content is required." });

    const adminName = req.admin?.name ?? "Admin";

    await client.query(
      `INSERT INTO subscription_notes
         (user_id, content, admin_id, admin_name, created_at)
       VALUES ($1,$2,$3,$4,NOW())`,
      [req.params.userId, content.trim(), req.admin.id, adminName]
    );

    res.json({ message: "Note added." });
  } catch (err) {
    console.error("[POST /:userId/notes]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/:userId/change-plan
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:userId/change-plan", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { plan, billingCycle } = req.body;
    if (!plan) return res.status(400).json({ message: "plan is required." });

    const userId    = req.params.userId;
    const adminName = req.admin?.name ?? "Admin";

    await client.query("BEGIN");
    const result = await applyPlanChange(client, userId, plan, billingCycle ?? null);
    await logAction(
      client, req.admin.id, adminName,
      `Changed plan to ${plan}`, userId,
      "Admin change — no charge."
    );
    await client.query("COMMIT");

    res.json({ message: `Plan changed to ${plan}.`, result });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /:userId/change-plan]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/:userId/grant
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:userId/grant", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { plan, duration, reason, billingCycle } = req.body;
    const userId    = req.params.userId;
    const adminName = req.admin?.name ?? "Admin";

    if (!plan)     return res.status(400).json({ message: "plan is required."     });
    if (!duration) return res.status(400).json({ message: "duration is required." });

    const { rows: planRows } = await client.query(
      `SELECT id, slug, name, rank FROM subscription_plans WHERE slug = $1`,
      [plan]
    );
    if (!planRows.length) return res.status(404).json({ message: "Plan not found." });

    const p         = planRows[0];
    const cycle     = billingCycle ?? "monthly";
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + safeInt(duration, 30));

    await client.query("BEGIN");

    await client.query(
      `UPDATE subscriptions SET status = 'superseded', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    await client.query(
      `INSERT INTO subscriptions
         (user_id, plan_id, plan_slug, billing_cycle, amount, currency,
          payment_reference, status, auto_renew, started_at, expires_at,
          metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$4,0,'NGN',$5,'active',FALSE,NOW(),$6,$7::jsonb,NOW(),NOW())`,
      [
        userId, p.id, p.slug, cycle,
        `ADMIN_GRANT_${Date.now()}`,
        expiresAt,
        JSON.stringify({ source: "admin_grant", reason: reason ?? "", admin: adminName }),
      ]
    );

    await client.query(
      `UPDATE users
       SET subscription_plan       = $1,
           subscription_status     = 'active',
           billing_cycle           = $2,
           subscription_started_at = NOW(),
           subscription_expires_at = $3,
           auto_renew              = FALSE,
           updated_at              = NOW()
       WHERE id = $4`,
      [p.slug, cycle, expiresAt, userId]
    );

    await updateSearchPriority(client, userId, p.rank);

    await logAction(
      client, req.admin.id, adminName,
      `Granted ${p.name} for ${duration} days`, userId,
      reason ?? "Admin grant — no charge."
    );

    await client.query("COMMIT");

    res.json({ message: `${p.name} granted for ${duration} days.` });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /:userId/grant]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/:userId/extend
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:userId/extend", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { days, until_date } = req.body;
    const userId    = req.params.userId;
    const adminName = req.admin?.name ?? "Admin";

    if (!days && !until_date) {
      return res.status(400).json({ message: "days or until_date is required." });
    }

    await client.query("BEGIN");

    if (days) {
      await client.query(
        `UPDATE subscriptions
         SET expires_at = expires_at + ($1 || ' days')::INTERVAL, updated_at = NOW()
         WHERE user_id = $2 AND status = 'active'`,
        [safeInt(days, 30), userId]
      );
      await client.query(
        `UPDATE users
         SET subscription_expires_at = subscription_expires_at + ($1 || ' days')::INTERVAL,
             updated_at = NOW()
         WHERE id = $2`,
        [safeInt(days, 30), userId]
      );
    } else {
      await client.query(
        `UPDATE subscriptions
         SET expires_at = $1, updated_at = NOW()
         WHERE user_id = $2 AND status = 'active'`,
        [new Date(until_date), userId]
      );
      await client.query(
        `UPDATE users SET subscription_expires_at = $1, updated_at = NOW() WHERE id = $2`,
        [new Date(until_date), userId]
      );
    }

    const label = days ? `+${days} days` : `until ${until_date}`;
    await logAction(client, req.admin.id, adminName, `Extended subscription ${label}`, userId);
    await client.query("COMMIT");

    res.json({ message: `Subscription extended ${label}.` });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /:userId/extend]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/:userId/cancel
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:userId/cancel", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId    = req.params.userId;
    const adminName = req.admin?.name ?? "Admin";

    await client.query("BEGIN");

    await client.query(
      `UPDATE subscriptions
       SET status = 'cancelled', auto_renew = FALSE, updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    await client.query(
      `UPDATE users SET auto_renew = FALSE, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    await logAction(client, req.admin.id, adminName, "Cancelled subscription", userId);
    await client.query("COMMIT");

    res.json({ message: "Subscription cancelled. Access continues until expiry." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /:userId/cancel]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/:userId/suspend
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:userId/suspend", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId    = req.params.userId;
    const adminName = req.admin?.name ?? "Admin";

    await client.query("BEGIN");

    await client.query(
      `UPDATE subscriptions
       SET status = 'suspended', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    await client.query(
      `UPDATE users SET subscription_status = 'suspended', updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    await logAction(client, req.admin.id, adminName, "Suspended subscription", userId);
    await client.query("COMMIT");

    res.json({ message: "Subscription suspended." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /:userId/suspend]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/:userId/reactivate
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:userId/reactivate", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId    = req.params.userId;
    const adminName = req.admin?.name ?? "Admin";

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE subscriptions
       SET status = 'active', expires_at = $1, updated_at = NOW()
       WHERE user_id = $2
         AND status IN ('cancelled','expired','suspended')
       ORDER BY created_at DESC LIMIT 1
       RETURNING id, plan_slug, expires_at`,
      [expiresAt, userId]
    );

    if (rows.length) {
      await client.query(
        `UPDATE users
         SET subscription_status     = 'active',
             subscription_expires_at = $1,
             auto_renew              = FALSE,
             updated_at              = NOW()
         WHERE id = $2`,
        [expiresAt, userId]
      );
    }

    await logAction(
      client, req.admin.id, adminName,
      "Reactivated subscription for 30 days", userId
    );
    await client.query("COMMIT");

    res.json({ message: "Subscription reactivated for 30 days." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /:userId/reactivate]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/:userId/toggle-auto-renew
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:userId/toggle-auto-renew", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { autoRenew } = req.body;
    const userId    = req.params.userId;
    const adminName = req.admin?.name ?? "Admin";

    if (typeof autoRenew !== "boolean") {
      return res.status(400).json({ message: "autoRenew must be a boolean." });
    }

    await client.query("BEGIN");

    await client.query(
      `UPDATE subscriptions SET auto_renew = $1, updated_at = NOW()
       WHERE user_id = $2 AND status = 'active'`,
      [autoRenew, userId]
    );
    await client.query(
      `UPDATE users SET auto_renew = $1, updated_at = NOW() WHERE id = $2`,
      [autoRenew, userId]
    );

    await logAction(
      client, req.admin.id, adminName,
      `${autoRenew ? "Enabled" : "Disabled"} auto-renew`, userId
    );
    await client.query("COMMIT");

    res.json({ message: `Auto-renew ${autoRenew ? "enabled" : "disabled"}.`, autoRenew });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /:userId/toggle-auto-renew]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/:userId/refund
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:userId/refund", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { transaction_id, reason, amount } = req.body;
    const userId    = req.params.userId;
    const adminName = req.admin?.name ?? "Admin";

    if (!transaction_id) {
      return res.status(400).json({ message: "transaction_id is required." });
    }

    const { rows: txRows } = await client.query(
      `SELECT * FROM payment_transactions WHERE id = $1 AND user_id = $2`,
      [transaction_id, userId]
    );
    if (!txRows.length) return res.status(404).json({ message: "Transaction not found." });

    const tx = txRows[0];

    await client.query("BEGIN");

    await client.query(
      `UPDATE payment_transactions SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
      [tx.id]
    );

    await client.query(
      `INSERT INTO subscription_refunds
         (user_id, transaction_id, amount, reason, admin_id, admin_name, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
      [
        userId,
        tx.id,
        Math.round((amount ?? tx.amount / 100) * 100),
        reason ?? "Admin refund",
        req.admin.id,
        adminName,
      ]
    ).catch(() => {});

    await logAction(
      client, req.admin.id, adminName,
      `Refunded ₦${amount ?? tx.amount / 100}`, userId,
      `Reason: ${reason ?? "Admin refund"} · Ref: ${tx.reference}`
    );

    await client.query("COMMIT");

    res.json({ message: "Refund recorded." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /:userId/refund]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/:userId/feature-override
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:userId/feature-override", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { key, value } = req.body;
    const userId    = req.params.userId;
    const adminName = req.admin?.name ?? "Admin";

    if (!key) return res.status(400).json({ message: "key is required." });

    await client.query(
      `INSERT INTO subscription_feature_overrides
         (user_id, feature_key, feature_value, admin_id, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (user_id, feature_key)
       DO UPDATE SET feature_value = $3, admin_id = $4, updated_at = NOW()`,
      [userId, key, String(value), req.admin.id]
    ).catch(() => {});

    await logAction(
      client, req.admin.id, adminName,
      `Override: ${key} = ${value}`, userId
    );

    res.json({ message: `Feature "${key}" set to "${value}".` });
  } catch (err) {
    console.error("[POST /:userId/feature-override]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/:userId/notify
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:userId/notify", verifyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { type }  = req.body;
    const userId    = req.params.userId;
    const adminName = req.admin?.name ?? "Admin";

    // ── Plug your email provider here ─────────────────────────────────────
    // const { rows: [user] } = await client.query(
    //   `SELECT email, name FROM users WHERE id = $1`, [userId]
    // );
    // await sendEmail({ to: user.email, template: type, name: user.name });
    // ──────────────────────────────────────────────────────────────────────

    await logAction(
      client, req.admin.id, adminName,
      `Sent notification: ${type}`, userId
    );

    res.json({ message: `Notification "${type}" queued.` });
  } catch (err) {
    console.error("[POST /:userId/notify]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});


export default router;