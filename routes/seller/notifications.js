/**
 * routes/seller/notifications.js
 *
 * GET    /api/seller/notifications              — list
 * GET    /api/seller/notifications/unread-count — lightweight poll
 * PATCH  /api/seller/notifications/:id/read     — mark one read
 * PATCH  /api/seller/notifications/read-all     — mark all read
 */
import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

/* Auth guard */
router.use((req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: "Auth required" });
  }
  next();
});

/* GET /api/seller/notifications */
router.get("/", async (req, res) => {
  const sellerId = req.user.id;
  const page     = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit    = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset   = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT id, type, title, message, link, meta,
              read, read_at, created_at
       FROM public.notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [sellerId, limit, offset]
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM public.notifications
       WHERE user_id = $1 AND read = false`,
      [sellerId]
    );

    res.json({
      success: true,
      data: {
        notifications: rows,
        unread_count:  Number(count),
        pagination:    { page, limit },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      debug:   { message: err.message, code: err.code },
    });
  }
});

/* GET /api/seller/notifications/unread-count */
router.get("/unread-count", async (req, res) => {
  try {
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM public.notifications
       WHERE user_id = $1 AND read = false`,
      [req.user.id]
    );
    res.json({ success: true, count: Number(count) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* PATCH /api/seller/notifications/read-all */
router.patch("/read-all", async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.notifications
       SET read = true, read_at = NOW()
       WHERE user_id = $1 AND read = false`,
      [req.user.id]
    );
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* PATCH /api/seller/notifications/:id/read */
router.patch("/:id/read", async (req, res) => {
  try {
    const { rows: [n] } = await pool.query(
      `UPDATE public.notifications
       SET read = true, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!n) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;