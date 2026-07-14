// ════════════════════════════════════════════════════════════
// FILE: routes/admin/user.js
// Base: /api/admin/users
// ════════════════════════════════════════════════════════════

import express from "express";
import { pool } from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

/* ─── helpers ────────────────────────────────────────────────────────────── */
const safeInt = (v, fb = 0) => { const n = parseInt(v); return isNaN(n) ? fb : n; };

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users
// Returns users list. Supports ?q= for search.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const q      = (req.query.q ?? req.query.search ?? "").trim();
    const limit  = Math.min(200, safeInt(req.query.limit,  100));
    const offset = Math.max(0,   safeInt(req.query.offset, 0));

    const SELECT = `
      SELECT
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
      FROM public.users`;

    let rows;

    if (q) {
      const search = `%${q.toLowerCase()}%`;
      ({ rows } = await client.query(
        `${SELECT}
         WHERE
           LOWER(CAST(name          AS TEXT)) LIKE $1
           OR LOWER(CAST(email      AS TEXT)) LIKE $1
           OR CAST(phone            AS TEXT)  LIKE $2
           OR CAST(phone_number     AS TEXT)  LIKE $2
           OR LOWER(CAST(username   AS TEXT)) LIKE $1
           OR LOWER(CAST(business_name AS TEXT)) LIKE $1
           OR LOWER(CAST(store_name    AS TEXT)) LIKE $1
         ORDER BY
           CASE WHEN LOWER(CAST(email AS TEXT)) = $3 THEN 0 ELSE 1 END,
           name ASC
         LIMIT $4 OFFSET $5`,
        [search, `%${q}%`, q.toLowerCase(), limit, offset]
      ));
    } else {
      ({ rows } = await client.query(
        `${SELECT}
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ));
    }

    res.json(rows);
  } catch (err) {
    console.error("[GET /admin/users]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users/:id
// ─────────────────────────────────────────────────────────────────────────────
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
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: "User not found." });
    res.json(rows[0]);
  } catch (err) {
    console.error("[GET /admin/users/:id]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users/:id/ban
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/ban", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE public.users
       SET status = 'banned', banned_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await client.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'ban_user', 'user', $2, $3)`,
      [req.admin.id, req.params.id, `Banned user ${req.params.id}`]
    ).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error("[POST /admin/users/:id/ban]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users/:id/unban
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/unban", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE public.users
       SET status = 'active', banned_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await client.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'unban_user', 'user', $2, $3)`,
      [req.admin.id, req.params.id, `Unbanned user ${req.params.id}`]
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