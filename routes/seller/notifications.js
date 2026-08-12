/**
 * routes/seller/notifications.js
 * v2 — Added JWT authentication
 */
import express from "express";
import jwt     from "jsonwebtoken";
import { pool } from "../../config/db.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

/* ✅ Same auth middleware as orders.js */
async function authenticateSeller(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      code:    "NO_TOKEN",
    });
  }

  try {
    const token   = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { rows } = await pool.query(
      `SELECT id, name, email, status FROM market.users WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length || rows[0].status !== "active") {
      return res.status(401).json({
        success: false,
        message: "Invalid session",
      });
    }

    req.user = {
      id:    rows[0].id,
      name:  rows[0].name,
      email: rows[0].email,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

router.use(authenticateSeller);

/* GET /api/seller/notifications */
router.get("/", async (req, res) => {
  const sellerId = req.user.id;
  const page     = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit    = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset   = (page - 1) * limit;

  try {
    /* Try with user_type filter first, fall back without */
    let rows;
    try {
      const result = await pool.query(
        `SELECT id, type, title, message, link, meta,
                read, read_at, created_at
         FROM public.notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [sellerId, limit, offset]
      );
      rows = result.rows;
    } catch (err) {
      if (err.code === "42P01") {
        /* Table doesn't exist yet — return empty */
        rows = [];
      } else {
        throw err;
      }
    }

    let count = 0;
    try {
      const result = await pool.query(
        `SELECT COUNT(*) FROM public.notifications
         WHERE user_id = $1 AND read = false`,
        [sellerId]
      );
      count = Number(result.rows[0].count);
    } catch {
      count = 0;
    }

    res.json({
      success: true,
      data: {
        notifications: rows,
        unread_count:  count,
        pagination:    { page, limit },
      },
    });
  } catch (err) {
    console.error("[GET /api/seller/notifications]", err.message);
    /* Non-critical — return empty rather than 500 */
    res.json({
      success: true,
      data: {
        notifications: [],
        unread_count:  0,
        pagination:    { page, limit },
      },
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
  } catch {
    res.json({ success: true, count: 0 });
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
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* PATCH /api/seller/notifications/:id/read */
router.patch("/:id/read", async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.notifications
       SET read = true, read_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;