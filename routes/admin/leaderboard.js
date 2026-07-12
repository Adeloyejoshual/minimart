// ════════════════════════════════════════════════════════════
// FILE: routes/admin/leaderboard.js
// Base: /api/admin/leaderboard
//
// Admin sees REAL names (not masked).
// Uses the same schema as routes/leaderboard.js.
//
// ✅ NO email_verified filter on the inviter.
// ✅ Selects all name columns: first_name, last_name, name,
//    username, email — matching your exact users table.
// ════════════════════════════════════════════════════════════

import express  from "express";
import { pool } from "../../config/db.js";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";
import { finalizeLeaderboard } from "../../services/leaderboardCron.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const VERIFIED = `('rewarded', 'verified')`;
const BANNED   = `('banned', 'suspended', 'flagged')`;

const MONTHLY_REWARDS = {
  1 : { amount: 15_000, label: "₦15,000", prize: "1st Place" },
  2 : { amount: 10_000, label: "₦10,000", prize: "2nd Place" },
  3 : { amount:  5_000, label: "₦5,000",  prize: "3rd Place" },
};

const YEARLY_REWARDS = {
  1 : { amount: 50_000, label: "₦50,000", prize: "1st Place" },
  2 : { amount: 30_000, label: "₦30,000", prize: "2nd Place" },
  3 : { amount: 20_000, label: "₦20,000", prize: "3rd Place" },
};

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const fail = (res, status, message) =>
  res.status(status).json({ success: false, error: message });

/**
 * Resolve a display name from all available name columns.
 * Admin sees REAL names — no masking.
 * Priority: first_name+last_name → name → username → email
 */
function resolveName(row) {
  const first = row.first_name?.trim();
  const last  = row.last_name?.trim();
  if (first || last)
    return [first, last].filter(Boolean).join(" ");

  const name = row.name?.trim();
  if (name) return name;

  const uname = row.username?.trim();
  if (uname) return uname;

  return row.email ?? "Unknown";
}

/* ════════════════════════════════════════════════════════════
   CORE LEADERBOARD SQL
   Used by /current endpoint.

   ✅ Selects all name columns (first_name, last_name, name,
      username, email) so resolveName() can pick the best.
   ✅ NO email_verified filter on the inviter.
   ✅ Uses parametrized cutoff to prevent SQL injection.
════════════════════════════════════════════════════════════ */
function buildAdminLeaderboardSQL(hasCutoff, limit = 10) {
  const dateWhere = hasCutoff ? `AND r.created_at >= $1` : "";
  const limitP    = hasCutoff ? `$2`                     : `$1`;

  return `
    SELECT
      r.inviter_id            AS user_id,
      COUNT(r.id)::INT        AS total_referrals,
      MAX(r.created_at)       AS last_referral_at,
      u.first_name,
      u.last_name,
      u.name,
      u.username,
      u.email
    FROM   referrals r
    JOIN   users     u ON u.id = r.inviter_id
    WHERE  r.status IN ${VERIFIED}
      AND  u.status NOT IN ${BANNED}
      ${dateWhere}
    GROUP BY
      r.inviter_id,
      u.first_name,
      u.last_name,
      u.name,
      u.username,
      u.email
    ORDER BY
      total_referrals  DESC,
      last_referral_at ASC
    LIMIT ${limitP}
  `;
}

/* ════════════════════════════════════════════════════════════
   GET /api/admin/leaderboard/current
   Live snapshot — All Time + This Month + This Year
   Admin sees real names and emails.
════════════════════════════════════════════════════════════ */
router.get("/current", verifyAdmin, async (req, res) => {
  try {
    const now        = new Date();
    const monthStart = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), 1)
    ).toISOString();
    const yearStart  = new Date(
      Date.UTC(now.getFullYear(), 0, 1)
    ).toISOString();

    console.log(
      `[admin/leaderboard/current] ` +
      `monthStart=${monthStart}  yearStart=${yearStart}`
    );

    /* Run all three queries in parallel */
    const [allRows, monthRows, yearRows] = await Promise.all([
      pool.query(buildAdminLeaderboardSQL(false, 10), [10]),
      pool.query(buildAdminLeaderboardSQL(true,  10), [monthStart, 10]),
      pool.query(buildAdminLeaderboardSQL(true,  10), [yearStart,  10]),
    ]);

    console.log(
      `[admin/leaderboard/current] results: ` +
      `all=${allRows.rows.length}  ` +
      `month=${monthRows.rows.length}  ` +
      `year=${yearRows.rows.length}`
    );

    /* Log for debugging when empty */
    if (allRows.rows.length === 0) {
      console.warn(
        "[admin/leaderboard/current] ⚠ all-time returned 0 rows"
      );

      /* Extra raw debug query */
      const { rows: raw } = await pool.query(
        `SELECT
           r.id,
           r.status,
           r.created_at,
           u.name,
           u.email,
           u.status AS user_status
         FROM   referrals r
         JOIN   users     u ON u.id = r.inviter_id
         ORDER  BY r.created_at DESC
         LIMIT  5`
      );
      console.log("[admin/leaderboard/current] raw referrals:", raw);
    }

    const fmt = (row, rank) => ({
      rank,
      user_id         : row.user_id,
      name            : resolveName(row),
      email           : row.email,
      total_referrals : Number(row.total_referrals),
    });

    return res.json({
      success : true,

      /* All time — no prizes, just raw rankings */
      all: {
        period     : "All Time",
        leaderboard: allRows.rows.map((r, i) => fmt(r, i + 1)),
      },

      /* Monthly — includes prize map */
      month: {
        period     : `${now.getFullYear()}-${
          String(now.getMonth() + 1).padStart(2, "0")
        }`,
        leaderboard: monthRows.rows.map((r, i) => fmt(r, i + 1)),
        rewards    : MONTHLY_REWARDS,
      },

      /* Yearly — includes prize map */
      year: {
        period     : String(now.getFullYear()),
        leaderboard: yearRows.rows.map((r, i) => fmt(r, i + 1)),
        rewards    : YEARLY_REWARDS,
      },

      /* Debug info (hidden in prod) */
      ...(process.env.NODE_ENV !== "production" ? {
        debug: {
          monthStart,
          yearStart,
          counts: {
            all   : allRows.rows.length,
            month : monthRows.rows.length,
            year  : yearRows.rows.length,
          },
        },
      } : {}),
    });

  } catch (err) {
    console.error("[admin/leaderboard/current]", err.message, err.stack);
    return fail(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/admin/leaderboard/winners
   Past winners — grouped by period.
   Admin sees real names.
════════════════════════════════════════════════════════════ */
router.get("/winners", verifyAdmin, async (req, res) => {
  const type  = req.query.type === "yearly" ? "yearly" : "monthly";
  const limit = Math.min(parseInt(req.query.limit ?? "12", 10), 36);

  try {
    const { rows } = await pool.query(
      `SELECT
         lw.id,
         lw.rank,
         lw.period_key,
         lw.period_type,
         lw.total_referrals,
         lw.reward_amount,
         lw.reward_status,
         lw.paid_at,
         lw.notes,
         u.id         AS user_id,
         u.first_name,
         u.last_name,
         u.name,
         u.username,
         u.email
       FROM   leaderboard_winners lw
       JOIN   users               u ON u.id = lw.user_id
       WHERE  lw.period_type = $1
       ORDER  BY lw.period_key DESC, lw.rank ASC
       LIMIT  $2`,
      [type, limit * 3]
    );

    /* Group by period */
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.period_key]) {
        grouped[row.period_key] = {
          period_key : row.period_key,
          winners    : [],
        };
      }
      grouped[row.period_key].winners.push({
        id              : row.id,
        rank            : row.rank,
        display_name    : resolveName(row),
        user_email      : row.email,
        total_referrals : Number(row.total_referrals),
        reward_amount   : Number(row.reward_amount),
        reward_label    : `₦${Number(row.reward_amount).toLocaleString()}`,
        reward_status   : row.reward_status,
        paid_at         : row.paid_at,
        notes           : row.notes,
      });
    }

    return res.json({
      success : true,
      type,
      periods : Object.values(grouped),
      rewards : type === "monthly" ? MONTHLY_REWARDS : YEARLY_REWARDS,
    });

  } catch (err) {
    console.error("[admin/leaderboard/winners]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/admin/leaderboard/winners/:id/status
   Update payment status: pending → processing → paid → failed
════════════════════════════════════════════════════════════ */
router.patch(
  "/winners/:id/status",
  verifyAdmin,
  async (req, res) => {
    const { status, notes } = req.body;
    const VALID = ["pending", "processing", "paid", "failed"];

    if (!VALID.includes(status))
      return fail(res, 400, `status must be one of: ${VALID.join(", ")}`);

    try {
      const { rows: [winner] } = await pool.query(
        `UPDATE leaderboard_winners
         SET    reward_status = $1,
                notes         = COALESCE($2, notes),
                paid_at       = CASE
                  WHEN $1 = 'paid' THEN now()
                  ELSE paid_at
                END
         WHERE  id = $3
         RETURNING
           id, period_type, period_key, rank,
           reward_amount, reward_status, paid_at, notes`,
        [status, notes ?? null, req.params.id]
      );

      if (!winner) return fail(res, 404, "Winner record not found.");

      /* Notify winner when marked paid */
      if (status === "paid") {
        pool.query(
          `INSERT INTO notifications
             (user_id, type, title, message)
           SELECT
             lw.user_id,
             'reward_paid',
             'Your prize has been sent!',
             'Your ₦' || lw.reward_amount::TEXT ||
               ' prize for the ' || lw.period_type ||
               ' leaderboard (' || lw.period_key ||
               ') has been processed.'
           FROM leaderboard_winners lw
           WHERE lw.id = $1`,
          [req.params.id]
        ).catch((e) =>
          console.warn("[admin/leaderboard] paid notification:", e.message)
        );
      }

      return res.json({ success: true, winner });

    } catch (err) {
      console.error("[admin/leaderboard/winners/:id/status]", err.message);
      return fail(res, 500, err.message);
    }
  }
);

/* ════════════════════════════════════════════════════════════
   POST /api/admin/leaderboard/finalize
   Manually trigger finalization (superadmin only).
════════════════════════════════════════════════════════════ */
router.post(
  "/finalize",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const { type, period_key } = req.body;

    if (!["monthly", "yearly"].includes(type))
      return fail(res, 400, "type must be 'monthly' or 'yearly'.");

    try {
      const result = await finalizeLeaderboard(type, period_key ?? null);
      return res.json(result);
    } catch (err) {
      console.error("[admin/leaderboard/finalize]", err.message);
      return fail(res, 500, err.message);
    }
  }
);

/* ════════════════════════════════════════════════════════════
   GET /api/admin/leaderboard/referrals
   All referrals — paginated, filterable by status.
   Admin sees real names and emails.
════════════════════════════════════════════════════════════ */
router.get("/referrals", verifyAdmin, async (req, res) => {
  const status = req.query.status ?? "all";
  const limit  = Math.min(parseInt(req.query.limit  ?? "50"), 200);
  const offset = Math.max(parseInt(req.query.offset ?? "0"),  0);

  const VALID = ["all","pending","verified","rewarded","rejected"];
  if (!VALID.includes(status))
    return fail(res, 400, `status must be one of: ${VALID.join(", ")}`);

  try {
    const statusClause = status === "all"
      ? ""
      : `AND r.status = '${status}'`;

    const { rows } = await pool.query(
      `SELECT
         r.id,
         r.status,
         r.invite_code,
         r.reward_value,
         r.reward_given_at,
         r.verified_at,
         r.created_at,
         ui.id                AS inviter_id,
         ui.first_name        AS inviter_first_name,
         ui.last_name         AS inviter_last_name,
         ui.name              AS inviter_name,
         ui.username          AS inviter_username,
         ui.email             AS inviter_email,
         ui.email_verified    AS inviter_email_verified,
         ue.id                AS referee_id,
         ue.first_name        AS referee_first_name,
         ue.last_name         AS referee_last_name,
         ue.name              AS referee_name,
         ue.username          AS referee_username,
         ue.email             AS referee_email,
         ue.email_verified    AS referee_email_verified
       FROM   referrals r
       JOIN   users     ui ON ui.id = r.inviter_id
       JOIN   users     ue ON ue.id = COALESCE(r.referee_id, r.invitee_id)
       WHERE  1=1 ${statusClause}
       ORDER  BY r.created_at DESC
       LIMIT  $1 OFFSET $2`,
      [limit, offset]
    );

    const { rows: [cnt] } = await pool.query(
      `SELECT COUNT(*)::INT AS total FROM referrals
       ${status === "all" ? "" : `WHERE status = '${status}'`}`
    );

    /* Resolve display names for admin view */
    const referrals = rows.map((r) => ({
      id                      : r.id,
      status                  : r.status,
      invite_code             : r.invite_code,
      reward_value            : r.reward_value,
      reward_given_at         : r.reward_given_at,
      verified_at             : r.verified_at,
      created_at              : r.created_at,
      inviter_id              : r.inviter_id,
      inviter_name            : resolveName({
        first_name : r.inviter_first_name,
        last_name  : r.inviter_last_name,
        name       : r.inviter_name,
        username   : r.inviter_username,
        email      : r.inviter_email,
      }),
      inviter_email           : r.inviter_email,
      inviter_email_verified  : r.inviter_email_verified,
      referee_id              : r.referee_id,
      referee_name            : resolveName({
        first_name : r.referee_first_name,
        last_name  : r.referee_last_name,
        name       : r.referee_name,
        username   : r.referee_username,
        email      : r.referee_email,
      }),
      referee_email           : r.referee_email,
      referee_email_verified  : r.referee_email_verified,
    }));

    return res.json({
      success   : true,
      total     : cnt.total,
      limit,
      offset,
      referrals,
    });

  } catch (err) {
    console.error("[admin/leaderboard/referrals]", err.message);
    return fail(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/admin/leaderboard/referrals/:id/force-reward
   Manually grant a reward for a stuck referral.
   Superadmin only.
════════════════════════════════════════════════════════════ */
router.post(
  "/referrals/:id/force-reward",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const { id } = req.params;

    try {
      const { rows: [referral] } = await pool.query(
        `SELECT id, inviter_id, status FROM referrals WHERE id = $1`,
        [id]
      );

      if (!referral)         return fail(res, 404, "Referral not found.");
      if (referral.status === "rewarded")
        return fail(res, 400, "Referral already rewarded.");

      /* Force to rewarded */
      await pool.query(
        `UPDATE referrals
         SET    status          = 'rewarded',
                verified_at     = COALESCE(verified_at, now()),
                reward_value    = 1,
                reward_given_at = now()
         WHERE  id = $1`,
        [id]
      );

      /* Credit inviter +1 bonus spin */
      const { rows: [updated] } = await pool.query(
        `UPDATE users
         SET    bonus_spins = COALESCE(bonus_spins, 0) + 1,
                updated_at  = now()
         WHERE  id = $1
         RETURNING bonus_spins`,
        [referral.inviter_id]
      );

      /* Sync total_referrals */
      await pool.query(
        `UPDATE users
         SET    total_referrals = (
           SELECT COUNT(*)::INT
           FROM   referrals
           WHERE  inviter_id = $1
             AND  status IN ('rewarded', 'verified')
         ),
         updated_at = now()
         WHERE id = $1`,
        [referral.inviter_id]
      );

      /* Log event */
      pool.query(
        `INSERT INTO referral_events
           (referral_id, event_type, description, metadata)
         VALUES ($1, 'reward_forced',
                 'Reward manually granted by admin',
                 $2::JSONB)`,
        [
          id,
          JSON.stringify({
            admin_id    : req.admin?.id,
            admin_email : req.admin?.email,
          }),
        ]
      ).catch(() => {});

      return res.json({
        success         : true,
        message         : "Reward granted successfully.",
        referral_id     : id,
        inviter_id      : referral.inviter_id,
        new_bonus_spins : updated?.bonus_spins ?? 0,
      });

    } catch (err) {
      console.error("[admin/leaderboard/force-reward]", err.message);
      return fail(res, 500, err.message);
    }
  }
);

export default router;