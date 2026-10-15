// ════════════════════════════════════════════════════════════
// FILE: routes/admin/newsletter.js
// Base: /api/admin/newsletter
// ════════════════════════════════════════════════════════════

import express         from "express";
import { pool }        from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";
import {
  sendTestDealNewsletter,
  send4DayDealNewsletter,
} from "../../services/weeklyNewsletter.js";

const router = express.Router();
router.use(verifyAdmin);

// ─────────────────────────────────────────────────────────────
// POST /api/admin/newsletter/test
// Sends a test deal newsletter to a specific email
// ─────────────────────────────────────────────────────────────
router.post("/test", async (req, res) => {
  try {
    const targetEmail = (req.body?.email || "adeloyejoshua2020@gmail.com").trim();
    const result      = await sendTestDealNewsletter(targetEmail);

    if (!result.success) {
      return res.status(400).json(result);
    }

    /* Log admin action */
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, details)
       VALUES ($1, 'send_test_newsletter', 'newsletter', $2)`,
      [req.admin.id, `Sent test deal newsletter to ${targetEmail}`]
    ).catch(() => {});

    return res.json(result);
  } catch (err) {
    console.error("[POST /admin/newsletter/test]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/newsletter/trigger-4day
// Manually triggers the 50-random-users deal dispatch
// ─────────────────────────────────────────────────────────────
router.post("/trigger-4day", async (req, res) => {
  try {
    /* Run asynchronously so API returns immediately */
    send4DayDealNewsletter().catch((err) =>
      console.error("[newsletter-manual-trigger-err]", err.message)
    );

    /* Log admin action */
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, details)
       VALUES ($1, 'trigger_4day_newsletter', 'newsletter', 'Triggered 50-user deal newsletter batch')`,
      [req.admin.id]
    ).catch(() => {});

    return res.json({
      success : true,
      message : "4-Day deal newsletter dispatch started in background for 50 random users.",
    });
  } catch (err) {
    console.error("[POST /admin/newsletter/trigger-4day]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/newsletter/stats
// Overall stats: Total Sent, Sent in Last 4 Days, Eligible Users, Failed
// ─────────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const [totalSent, recent4Days, totalEligible, totalFailed] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS c FROM public.newsletter_logs WHERE status = 'sent'`),
      pool.query(`SELECT COUNT(*)::int AS c FROM public.newsletter_logs WHERE status = 'sent' AND sent_at >= NOW() - INTERVAL '4 days'`),
      pool.query(`SELECT COUNT(*)::int AS c FROM public.users WHERE email_verified = TRUE AND status NOT IN ('banned','deleted','flagged')`),
      pool.query(`SELECT COUNT(*)::int AS c FROM public.newsletter_logs WHERE status = 'failed'`),
    ]);

    return res.json({
      success: true,
      stats: {
        total_sent     : totalSent.rows[0]?.c || 0,
        sent_last_4days: recent4Days.rows[0]?.c || 0,
        eligible_users : totalEligible.rows[0]?.c || 0,
        total_failed   : totalFailed.rows[0]?.c || 0,
      },
    });
  } catch (err) {
    console.error("[GET /admin/newsletter/stats]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/newsletter/logs
// Recent email send logs
// ─────────────────────────────────────────────────────────────
router.get("/logs", async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit) || 50);

    const { rows } = await pool.query(
      `SELECT
         nl.id,
         nl.week_key,
         nl.status,
         nl.error_message,
         nl.sent_at,
         u.email AS user_email,
         u.name  AS user_name
       FROM public.newsletter_logs nl
       LEFT JOIN public.users u ON u.id = nl.user_id
       ORDER BY nl.sent_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ success: true, logs: rows });
  } catch (err) {
    console.error("[GET /admin/newsletter/logs]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;