// ════════════════════════════════════════════════════════════
// FILE: routes/admin/leaderboard.js
// Base: /api/admin/leaderboard
// ════════════════════════════════════════════════════════════

import express   from "express";
import { pool }  from "../../config/db.js";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";
import { finalizeLeaderboard } from "../../services/leaderboardCron.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   GET /api/admin/leaderboard/current
   Live snapshot of current month + year top 10 (admin sees real names)
════════════════════════════════════════════════════════════ */
router.get("/current", verifyAdmin, async (req, res) => {
  const VERIFIED = `('rewarded','verified','pending')`;

  try {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const yearStart  = new Date(now.getFullYear(), 0, 1).toISOString();

    const [monthRows, yearRows] = await Promise.all([
      pool.query(
        `SELECT
           r.inviter_id                    AS user_id,
           COUNT(r.id)::INT                AS total_referrals,
           u.name,
           u.first_name,
           u.email
         FROM   referrals r
         JOIN   users     u ON u.id = r.inviter_id
         WHERE  r.status IN ${VERIFIED}
           AND  r.created_at >= $1
           AND  u.status NOT IN ('banned','suspended','flagged')
           AND  u.email_verified = true
         GROUP BY r.inviter_id, u.name, u.first_name, u.email
         ORDER BY total_referrals DESC
         LIMIT 10`,
        [monthStart]
      ),
      pool.query(
        `SELECT
           r.inviter_id                    AS user_id,
           COUNT(r.id)::INT                AS total_referrals,
           u.name,
           u.first_name,
           u.email
         FROM   referrals r
         JOIN   users     u ON u.id = r.inviter_id
         WHERE  r.status IN ${VERIFIED}
           AND  r.created_at >= $1
           AND  u.status NOT IN ('banned','suspended','flagged')
           AND  u.email_verified = true
         GROUP BY r.inviter_id, u.name, u.first_name, u.email
         ORDER BY total_referrals DESC
         LIMIT 10`,
        [yearStart]
      ),
    ]);

    const fmt = (row, rank) => ({
      rank,
      user_id         : row.user_id,
      name            : row.first_name?.trim() || row.name?.trim() || row.email,
      email           : row.email,
      total_referrals : row.total_referrals,
    });

    return res.json({
      success : true,
      month   : {
        period     : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}`,
        leaderboard: monthRows.rows.map((r, i) => fmt(r, i + 1)),
        rewards    : { 1: "₦15,000", 2: "₦10,000", 3: "₦5,000" },
      },
      year    : {
        period     : String(now.getFullYear()),
        leaderboard: yearRows.rows.map((r, i) => fmt(r, i + 1)),
        rewards    : { 1: "₦50,000", 2: "₦30,000", 3: "₦20,000" },
      },
    });

  } catch (err) {
    console.error("[admin/leaderboard/current]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/* GET /api/admin/leaderboard/winners */
router.get("/winners", verifyAdmin, async (req, res) => {
  const type  = req.query.type === "yearly" ? "yearly" : "monthly";
  const limit = Math.min(parseInt(req.query.limit ?? "12", 10), 36);

  try {
    const { rows } = await pool.query(
      `SELECT
         lw.rank, lw.period_key, lw.period_type,
         lw.total_referrals, lw.reward_amount,
         lw.reward_status, lw.paid_at,
         u.first_name, u.last_name,
         u.name          AS raw_name,
         u.username, u.email,
         u.profile_image AS avatar_url
       FROM   leaderboard_winners lw
       JOIN   users              u ON u.id = lw.user_id
       WHERE  lw.period_type = $1
       ORDER  BY lw.period_key DESC, lw.rank ASC
       LIMIT  $2`,
      [type, limit * 3]
    );

    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.period_key]) {
        grouped[row.period_key] = { period_key: row.period_key, winners: [] };
      }
      grouped[row.period_key].winners.push({
        rank            : row.rank,
        display_name    : row.first_name?.trim() || row.name?.trim() || row.email,
        total_referrals : Number(row.total_referrals),
        reward_amount   : Number(row.reward_amount),
        reward_label    : `₦${Number(row.reward_amount).toLocaleString()}`,
        reward_status   : row.reward_status,
        paid_at         : row.paid_at,
      });
    }

    return res.json({
      success : true,
      type,
      periods : Object.values(grouped),
    });

  } catch (err) {
    console.error("[admin/leaderboard/winners]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/* POST /api/admin/leaderboard/finalize */
router.post("/finalize", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { type, period_key } = req.body;

  if (!["monthly","yearly"].includes(type))
    return res.status(400).json({ error: "type must be 'monthly' or 'yearly'" });

  try {
    const result = await finalizeLeaderboard(type, period_key ?? null);
    return res.json(result);
  } catch (err) {
    console.error("[admin/leaderboard/finalize]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;