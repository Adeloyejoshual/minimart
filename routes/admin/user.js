import express from "express";
import { pool } from "../../config/db.js";     // ← fix: use config/db not server.js
import { verifyAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users
// Supports ?q= search param so AssignPlanModal fallback works
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const q      = (req.query.q ?? req.query.search ?? "").trim();
    const limit  = Math.min(200, parseInt(req.query.limit ?? "100"));
    const offset = Math.max(0,   parseInt(req.query.offset ?? "0"));

    let rows;

    if (q) {
      const lower  = q.toLowerCase();
      const search = `%${lower}%`;

      ({ rows } = await pool.query(
        `SELECT
           id, name, email, phone, phone_number,
           username, business_name, store_name,
           city, state, status,
           subscription_plan, subscription_status,
           profile_image, verified, store_verified,
           created_at, last_login
         FROM public.users
         WHERE
           LOWER(CAST(name          AS TEXT)) LIKE $1
           OR LOWER(CAST(email      AS TEXT)) LIKE $1
           OR CAST(phone            AS TEXT)  LIKE $2
           OR CAST(phone_number     AS TEXT)  LIKE $2
           OR LOWER(CAST(username   AS TEXT)) LIKE $1
           OR LOWER(CAST(business_name AS TEXT)) LIKE $1
         ORDER BY name ASC
         LIMIT $3 OFFSET $4`,
        [search, `%${q}%`, limit, offset]
      ));
    } else {
      ({ rows } = await pool.query(
        `SELECT
           id, name, email, phone, phone_number,
           username, business_name, store_name,
           city, state, status,
           subscription_plan, subscription_status,
           profile_image, verified, store_verified,
           created_at, last_login
         FROM public.users
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ));
    }

    res.json(rows);
  } catch (err) {
    console.error("[GET /admin/users]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         id, name, email, phone, phone_number,
         username, business_name, store_name, store_slug,
         city, state, country, status, role,
         subscription_plan, subscription_status,
         subscription_expires_at, billing_cycle, auto_renew,
         profile_image, verified, store_verified,
         trust_score, rating, total_sales,
         created_at, last_login, last_seen
       FROM public.users
       WHERE id = $1`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: "User not found." });

    res.json(rows[0]);
  } catch (err) {
    console.error("[GET /admin/users/:id]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users/:id/ban
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/ban", async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.users SET status = 'banned', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'ban_user', 'user', $2, $3)`,
      [req.admin.id, req.params.id, `Banned user ${req.params.id}`]
    ).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error("[POST /admin/users/:id/ban]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users/:id/unban
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/unban", async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.users SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'unban_user', 'user', $2, $3)`,
      [req.admin.id, req.params.id, `Unbanned user ${req.params.id}`]
    ).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error("[POST /admin/users/:id/unban]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;