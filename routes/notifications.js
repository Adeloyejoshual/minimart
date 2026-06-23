/**
 * routes/notifications.js
 *
 * GET    /api/notifications                  — list (paginated)
 * GET    /api/notifications/unread-count     — count only
 * POST   /api/notifications/read/:id         — mark one read
 * POST   /api/notifications/read-all         — mark all read
 * DELETE /api/notifications/:id              — delete one
 */

import express from "express";
import { pool } from "../config/db.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

const safeInt = (val, fallback, max = Infinity) => {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
};

/* ── GET / — list ── */
router.get("/", authenticate, async (req, res) => {
  const limit  = safeInt(req.query.limit,  50, 100);
  const offset = safeInt(req.query.offset,  0);
  const unread = req.query.unread === "true" ? true : null;

  try {
    const conditions = ["user_id = $1"];
    const params     = [req.user.id];

    if (unread !== null) {
      params.push(unread);
      conditions.push(`is_read = $${params.length}`);
    }

    const where    = `WHERE ${conditions.join(" AND ")}`;
    const listParams = [...params, limit, offset];

    const { rows } = await pool.query(
      `SELECT id, type, title, message, metadata, is_read, created_at
       FROM   notifications
       ${where}
       ORDER  BY created_at DESC
       LIMIT  $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const { rows: cr } = await pool.query(
      `SELECT COUNT(*)::INT AS total FROM notifications ${where}`,
      params
    );

    return res.json({
      success : true,
      data    : rows,
      total   : cr[0].total,
      limit,
      offset,
    });

  } catch (err) {
    console.error("[notifications GET /]", err.message);
    return fail(res, 500, "Server error");
  }
});

/* ── GET /unread-count ── */
router.get("/unread-count", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::INT AS count
       FROM   notifications
       WHERE  user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );

    return res.json({ success: true, count: rows[0].count });

  } catch (err) {
    console.error("[notifications /unread-count]", err.message);
    return fail(res, 500, "Server error");
  }
});

/* ── POST /read/:id ── */
router.post("/read/:id", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE notifications
       SET    is_read = TRUE
       WHERE  id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (!rows.length) return fail(res, 404, "Notification not found.");
    return res.json({ success: true });

  } catch (err) {
    console.error("[notifications /read/:id]", err.message);
    return fail(res, 500, "Server error");
  }
});

/* ── POST /read-all ── */
router.post("/read-all", authenticate, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE notifications
       SET    is_read = TRUE
       WHERE  user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );

    return res.json({ success: true, updated: rowCount });

  } catch (err) {
    console.error("[notifications /read-all]", err.message);
    return fail(res, 500, "Server error");
  }
});

/* ── DELETE /:id ── */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM notifications
       WHERE  id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (!rows.length) return fail(res, 404, "Notification not found.");
    return res.json({ success: true });

  } catch (err) {
    console.error("[notifications DELETE /:id]", err.message);
    return fail(res, 500, "Server error");
  }
});

export default router;