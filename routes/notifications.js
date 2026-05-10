import express from "express";
import { pool } from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();

// ─── GET notifications ─────────────────────────────
router.get("/", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, title, message, is_read, created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [req.user.id]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Fetch notifications error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET unread count ─────────────────────────────
router.get("/unread-count", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT COUNT(*) FROM notifications
      WHERE user_id = $1 AND is_read = false
      `,
      [req.user.id]
    );

    res.json({
      success: true,
      count: Number(rows[0].count),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false });
  }
});

// ─── MARK AS READ ─────────────────────────────
router.post("/read/:id", authenticate, async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, req.user.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false });
  }
});

// ─── MARK ALL AS READ ─────────────────────────────
router.post("/read-all", authenticate, async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE user_id = $1
      `,
      [req.user.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false });
  }
});

export default router;