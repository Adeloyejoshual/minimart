// ════════════════════════════════════════════════════════════
// FILE: routes/leaderboard.js
// Base: /api/leaderboard
//
// Schema facts (from CockroachDB export):
//   users.name          STRING NOT NULL
//   users.first_name    STRING NULL
//   users.last_name     STRING NULL
//   users.username      STRING NULL
//   users.email         STRING NOT NULL
//   users.email_verified BOOL NULL DEFAULT false
//   users.status        STRING NULL DEFAULT 'active'
//   users.referral_code VARCHAR(20) NULL
//   users.bonus_spins   INT8 NOT NULL DEFAULT 0
//   users.total_referrals INT8 NOT NULL DEFAULT 0
//   users.profile_image STRING NULL
//
// Key rule: NO email_verified filter on the INVITER.
//   Only referral status determines leaderboard eligibility.
//   email_verified is only relevant for the REFEREE (triggers reward).
// ════════════════════════════════════════════════════════════

import express   from "express";
import rateLimit from "express-rate-limit";
import jwt       from "jsonwebtoken";
import { pool }  from "../config/db.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ════════════════════════════════════════════════════════════
   REWARD CONFIG
════════════════════════════════════════════════════════════ */
const MONTHLY_REWARDS = {
  1 : { amount: 15_000, label: "₦15,000", emoji: "🥇" },
  2 : { amount: 10_000, label: "₦10,000", emoji: "🥈" },
  3 : { amount:  5_000, label: "₦5,000",  emoji: "🥉" },
};

const YEARLY_REWARDS = {
  1 : { amount: 50_000, label: "₦50,000", emoji: "🥇" },
  2 : { amount: 30_000, label: "₦30,000", emoji: "🥈" },
  3 : { amount: 20_000, label: "₦20,000", emoji: "🥉" },
};

/* ════════════════════════════════════════════════════════════
   VERIFIED STATUSES
   Only these referral statuses count toward rankings.
   'pending' excluded — referee hasn't verified email yet.
════════════════════════════════════════════════════════════ */
const VERIFIED = `('rewarded', 'verified')`;

/* ════════════════════════════════════════════════════════════
   BANNED INVITER STATUSES
   Inviters with these statuses are excluded from rankings.
   Note: email_verified is NOT checked on the inviter.
════════════════════════════════════════════════════════════ */
const BANNED = `('banned', 'suspended', 'flagged')`;

/* ════════════════════════════════════════════════════════════
   VALID PERIODS
════════════════════════════════════════════════════════════ */
const VALID_PERIODS = ["all", "year", "month", "week", "today"];

const PERIOD_LABELS = {
  all   : "All Time",
  year  : "This Year",
  month : "This Month",
  week  : "This Week",
  today : "Today",
};

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const fail = (res, status, message, extra = {}) => {
  console.error(`[leaderboard] ✗ ${status} — ${message}`);
  return res.status(status).json({ success: false, message, ...extra });
};

const failErr = (res, status, userMsg, err) => {
  console.error(`[leaderboard] ✗ ${userMsg}:`, err?.message);
  return res.status(status).json({
    success : false,
    message : IS_PROD ? userMsg : `${userMsg}: ${err?.message}`,
  });
};

const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  null;

/* ════════════════════════════════════════════════════════════
   NAME MASKING
   Uses all available name columns from your schema:
     first_name, last_name, name, username, email
════════════════════════════════════════════════════════════ */
function maskWord(word) {
  if (!word) return "";
  const w = word.trim();
  if (w.length <= 1) return w;
  if (w.length === 2) return `${w[0]}*`;
  return `${w[0]}${"*".repeat(w.length - 2)}${w[w.length - 1]}`;
}

function maskEmail(email) {
  if (!email?.includes("@")) return "User";
  const [local, domain] = email.split("@");
  const parts = domain.split(".");
  return parts.length >= 2
    ? `${maskWord(local)}@${maskWord(parts[0])}.${parts.slice(1).join(".")}`
    : `${maskWord(local)}@${maskWord(domain)}`;
}

function buildMaskedName(row) {
  /* Priority: first_name+last_name → name → username → email */
  const first = row.first_name?.trim();
  const last  = row.last_name?.trim();
  if (first || last)
    return [first, last].filter(Boolean).map(maskWord).join(" ");

  const name = row.name?.trim();
  if (name) return name.split(/\s+/).map(maskWord).join(" ");

  const uname = row.username?.trim();
  if (uname) return maskWord(uname);

  const email = row.email?.trim();
  if (email) return maskEmail(email);

  return "User";
}

/* ════════════════════════════════════════════════════════════
   AVATAR HELPERS
════════════════════════════════════════════════════════════ */
const COLORS = [
  "#2563eb","#10b981","#f59e0b","#8b5cf6",
  "#ef4444","#0891b2","#e8630a","#059669",
  "#7c3aed","#0284c7","#dc2626","#16a34a",
];

const colorFor = (str = "") =>
  COLORS[
    [...str].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length
  ];

const initialsOf = (name = "") =>
  (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

/* ════════════════════════════════════════════════════════════
   FORMAT ENTRY
   Builds the public-facing leaderboard row.
   Names are masked for privacy.
════════════════════════════════════════════════════════════ */
function formatEntry(row, rank, currentUserId, rewardMap = null) {
  const masked = buildMaskedName({
    first_name : row.first_name,
    last_name  : row.last_name,
    name       : row.name,
    username   : row.username,
    email      : row.email,
  });

  return {
    rank,
    user_id         : row.user_id,
    display_name    : masked,
    initials        : initialsOf(masked),
    color           : colorFor(masked),
    avatar_url      : row.avatar_url || null,
    total_referrals : Number(row.total_referrals || 0),
    is_current_user : row.user_id === currentUserId,
    reward          : rewardMap?.[rank]
      ? { ...rewardMap[rank], currency: "NGN" }
      : null,
  };
}

/* ════════════════════════════════════════════════════════════
   OPTIONAL AUTH
   Reads JWT if present — never fails on missing/invalid token.
════════════════════════════════════════════════════════════ */
function optionalAuth(req, _res, next) {
  try {
    const h = req.headers.authorization;
    if (h?.startsWith("Bearer ")) {
      const d = jwt.verify(h.slice(7), process.env.JWT_SECRET);
      req.currentUserId = d?.id ?? null;
    } else {
      req.currentUserId = null;
    }
  } catch (_) {
    req.currentUserId = null;
  }
  next();
}

/* ════════════════════════════════════════════════════════════
   RATE LIMITER
════════════════════════════════════════════════════════════ */
const limiter = rateLimit({
  windowMs        : 60_000,
  max             : IS_PROD ? 30 : 600,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) =>
    String(req.currentUserId ?? req.user?.id ?? getIp(req)),
  handler : (_req, res) =>
    res.status(429).json({ success: false, message: "Too many requests." }),
});

/* ════════════════════════════════════════════════════════════
   DATE CUTOFF
════════════════════════════════════════════════════════════ */
function dateCutoff(period) {
  const now = new Date();
  if (period === "today")
    return new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    ).toISOString();
  if (period === "week") {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString();
  }
  if (period === "month")
    return new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), 1)
    ).toISOString();
  if (period === "year")
    return new Date(
      Date.UTC(now.getFullYear(), 0, 1)
    ).toISOString();
  return null;
}

/* ════════════════════════════════════════════════════════════
   COUNTDOWN HELPERS
════════════════════════════════════════════════════════════ */
function endOfMonth() {
  const now = new Date();
  const end = new Date(
    Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  );
  const ms  = end - now;
  const d   = Math.floor(ms / 86_400_000);
  const h   = Math.floor((ms % 86_400_000) / 3_600_000);
  const m   = Math.floor((ms % 3_600_000) / 60_000);
  return {
    iso     : end.toISOString(),
    seconds : Math.floor(ms / 1_000),
    label   : d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`,
  };
}

function endOfYear() {
  const now = new Date();
  const end = new Date(Date.UTC(now.getFullYear(), 11, 31, 23, 59, 59));
  const ms  = end - now;
  const d   = Math.floor(ms / 86_400_000);
  const h   = Math.floor((ms % 86_400_000) / 3_600_000);
  return {
    iso     : end.toISOString(),
    seconds : Math.floor(ms / 1_000),
    label   : `${d}d ${h}h`,
  };
}

/* ════════════════════════════════════════════════════════════
   CORE LEADERBOARD QUERY
   Selects all name columns so JS masking can pick the best.

   ✅ NO email_verified filter on the inviter (u table).
      Only referral.status determines eligibility.
   ✅ Uses all name columns: first_name, last_name, name,
      username, email — matching your exact users schema.
════════════════════════════════════════════════════════════ */
function buildLeaderboardSQL(dateWhere, limitParam) {
  return `
    SELECT
      r.inviter_id            AS user_id,
      COUNT(r.id)::INT        AS total_referrals,
      MAX(r.created_at)       AS last_referral_at,
      u.first_name,
      u.last_name,
      u.name,
      u.username,
      u.email,
      u.profile_image         AS avatar_url
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
      u.email,
      u.profile_image
    ORDER BY
      total_referrals  DESC,
      last_referral_at ASC
    LIMIT ${limitParam}
  `;
}

/* ════════════════════════════════════════════════════════════
   RANK SUBQUERY
   Used when the current user is NOT in the top-N list.

   ✅ NO email_verified filter on the inviter.
════════════════════════════════════════════════════════════ */
function buildRankSQL(dateWhere, userParam) {
  return `
    SELECT sub.rank, sub.total_referrals
    FROM (
      SELECT
        r.inviter_id            AS user_id,
        COUNT(r.id)::INT        AS total_referrals,
        RANK() OVER (
          ORDER BY COUNT(r.id) DESC, MAX(r.created_at) ASC
        )::INT                  AS rank
      FROM   referrals r
      JOIN   users     u ON u.id = r.inviter_id
      WHERE  r.status IN ${VERIFIED}
        AND  u.status NOT IN ${BANNED}
        ${dateWhere}
      GROUP BY r.inviter_id
    ) sub
    WHERE sub.user_id = ${userParam}
  `;
}

/* ════════════════════════════════════════════════════════════
   GET /api/leaderboard
════════════════════════════════════════════════════════════ */
router.get("/", optionalAuth, limiter, async (req, res) => {
  const period = VALID_PERIODS.includes(req.query.period)
    ? req.query.period
    : "all";

  const limit = Math.min(
    Math.max(parseInt(req.query.limit ?? "20", 10) || 20, 1),
    50
  );

  const userId    = req.currentUserId ?? null;
  const cutoff    = dateCutoff(period);
  const rewardMap =
    period === "month" ? MONTHLY_REWARDS :
    period === "year"  ? YEARLY_REWARDS  : null;
  const countdown =
    period === "month" ? endOfMonth() :
    period === "year"  ? endOfYear()  : null;

  const dateWhere  = cutoff ? `AND r.created_at >= '${cutoff}'` : "";

  try {
    /* ── Top N ── */
    const { rows: topRows } = await pool.query(
      buildLeaderboardSQL(dateWhere, limit)
    );

    console.log(
      `[leaderboard] period=${period} cutoff=${cutoff ?? "none"}` +
      ` rows=${topRows.length}`
    );

    const leaderboard = topRows.map((row, i) =>
      formatEntry(row, i + 1, userId, rewardMap)
    );

    /* ── My rank ── */
    let myRank = null;

    if (userId) {
      const inList = leaderboard.find((e) => e.is_current_user);

      if (inList) {
        myRank = inList;
      } else {
        try {
          const rp = cutoff ? [cutoff, userId] : [userId];
          const dw = cutoff ? `AND r.created_at >= $1` : "";
          const up = cutoff ? "$2" : "$1";

          const { rows: [myRow] } = await pool.query(
            buildRankSQL(dw, up), rp
          );

          if (myRow) {
            myRank = {
              rank            : Number(myRow.rank),
              total_referrals : Number(myRow.total_referrals),
              is_current_user : true,
              reward          : rewardMap?.[myRow.rank]
                ? { ...rewardMap[myRow.rank], currency: "NGN" }
                : null,
            };
          }
        } catch (rankErr) {
          console.warn("[leaderboard] my rank:", rankErr.message);
        }
      }
    }

    /* ── Total inviters ── */
    let totalInviters = 0;
    try {
      const { rows: [c] } = await pool.query(
        `SELECT COUNT(DISTINCT r.inviter_id)::INT AS cnt
         FROM referrals r
         JOIN users u ON u.id = r.inviter_id
         WHERE r.status IN ${VERIFIED}
           AND u.status NOT IN ${BANNED}
           ${dateWhere}`
      );
      totalInviters = Number(c?.cnt || 0);
    } catch (_) {}

    /* ── Previous winners (month / year tabs) ── */
    let previousWinners = null;
    if (period === "month" || period === "year") {
      try {
        const ptype = period === "month" ? "monthly" : "yearly";
        const { rows: pw } = await pool.query(
          `SELECT
             lw.rank,
             lw.period_key,
             lw.total_referrals,
             lw.reward_amount,
             lw.reward_status,
             u.first_name,
             u.last_name,
             u.name,
             u.username,
             u.email,
             u.profile_image AS avatar_url
           FROM   leaderboard_winners lw
           JOIN   users               u ON u.id = lw.user_id
           WHERE  lw.period_type = $1
           ORDER  BY lw.period_key DESC, lw.rank ASC
           LIMIT  30`,
          [ptype]
        );

        const grouped = {};
        for (const row of pw) {
          if (!grouped[row.period_key]) grouped[row.period_key] = [];
          const masked = buildMaskedName(row);
          grouped[row.period_key].push({
            rank            : row.rank,
            display_name    : masked,
            initials        : initialsOf(masked),
            color           : colorFor(masked),
            avatar_url      : row.avatar_url || null,
            total_referrals : Number(row.total_referrals),
            reward_amount   : Number(row.reward_amount),
            reward_label    : `₦${Number(row.reward_amount).toLocaleString()}`,
            reward_status   : row.reward_status,
          });
        }
        previousWinners = grouped;
      } catch (pwErr) {
        console.warn("[leaderboard] previous winners:", pwErr.message);
      }
    }

    return res.json({
      success          : true,
      period,
      period_label     : PERIOD_LABELS[period],
      leaderboard,
      my_rank          : myRank,
      total_inviters   : totalInviters,
      countdown,
      rewards          : rewardMap
        ? Object.entries(rewardMap).map(([rank, r]) => ({
            rank     : Number(rank),
            ...r,
            currency : "NGN",
          }))
        : null,
      previous_winners : previousWinners,
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load leaderboard", err);
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/leaderboard/me
════════════════════════════════════════════════════════════ */
router.get("/me", optionalAuth, limiter, async (req, res) => {
  const userId = req.currentUserId;
  if (!userId) return fail(res, 401, "Login to see your rank.");

  try {
    const results = {};

    await Promise.all(
      VALID_PERIODS.map(async (period) => {
        const cutoff = dateCutoff(period);
        const params = cutoff ? [cutoff, userId] : [userId];
        const dw     = cutoff ? `AND r.created_at >= $1` : "";
        const up     = cutoff ? "$2" : "$1";

        try {
          const { rows: [row] } = await pool.query(
            buildRankSQL(dw, up), params
          );
          results[period] = row
            ? {
                rank            : Number(row.rank),
                total_referrals : Number(row.total_referrals),
                on_leaderboard  : true,
              }
            : {
                rank            : null,
                total_referrals : 0,
                on_leaderboard  : false,
              };
        } catch (_) {
          results[period] = {
            rank: null, total_referrals: 0, on_leaderboard: false,
          };
        }
      })
    );

    return res.json({ success: true, user_id: userId, ranks: results });

  } catch (err) {
    return failErr(res, 500, "Failed to load your rank", err);
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/leaderboard/winners  — Hall of Fame
════════════════════════════════════════════════════════════ */
router.get("/winners", optionalAuth, limiter, async (req, res) => {
  const type  = req.query.type === "yearly" ? "yearly" : "monthly";
  const limit = Math.min(parseInt(req.query.limit ?? "12", 10), 36);

  try {
    const { rows } = await pool.query(
      `SELECT
         lw.rank,
         lw.period_key,
         lw.period_type,
         lw.total_referrals,
         lw.reward_amount,
         lw.reward_status,
         lw.paid_at,
         u.first_name,
         u.last_name,
         u.name,
         u.username,
         u.email,
         u.profile_image AS avatar_url
       FROM   leaderboard_winners lw
       JOIN   users               u ON u.id = lw.user_id
       WHERE  lw.period_type = $1
       ORDER  BY lw.period_key DESC, lw.rank ASC
       LIMIT  $2`,
      [type, limit * 3]
    );

    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.period_key]) {
        grouped[row.period_key] = {
          period_key : row.period_key,
          winners    : [],
        };
      }
      const masked = buildMaskedName(row);
      grouped[row.period_key].winners.push({
        rank            : row.rank,
        display_name    : masked,
        initials        : initialsOf(masked),
        color           : colorFor(masked),
        avatar_url      : row.avatar_url || null,
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
      rewards : type === "monthly" ? MONTHLY_REWARDS : YEARLY_REWARDS,
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load winners", err);
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/leaderboard/user/:userId
════════════════════════════════════════════════════════════ */
router.get("/user/:userId", optionalAuth, limiter, async (req, res) => {
  const { userId } = req.params;
  if (!userId) return fail(res, 400, "userId is required.");

  try {
    const { rows: [user] } = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         name,
         username,
         email,
         profile_image AS avatar_url,
         status
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (!user) return fail(res, 404, "User not found.");
    if (["banned","suspended","flagged"].includes(user.status))
      return fail(res, 403, "Profile not available.");

    const masked = buildMaskedName(user);

    const { rows: [stats] } = await pool.query(
      `SELECT
         COUNT(r.id)::INT AS total_referrals,
         MAX(r.created_at) AS last_referral_at
       FROM referrals r
       WHERE r.inviter_id = $1
         AND r.status IN ${VERIFIED}`,
      [userId]
    );

    let rank = null;
    try {
      const { rows: [r] } = await pool.query(
        `SELECT sub.rank FROM (
           SELECT
             r.inviter_id AS user_id,
             RANK() OVER (
               ORDER BY COUNT(r.id) DESC, MAX(r.created_at) ASC
             )::INT AS rank
           FROM   referrals r
           JOIN   users     u ON u.id = r.inviter_id
           WHERE  r.status IN ${VERIFIED}
             AND  u.status NOT IN ${BANNED}
           GROUP  BY r.inviter_id
         ) sub
         WHERE sub.user_id = $1`,
        [userId]
      );
      rank = r?.rank ?? null;
    } catch (_) {}

    /* Their past wins */
    const { rows: wins } = await pool.query(
      `SELECT period_type, period_key, rank,
              reward_amount, reward_status
       FROM   leaderboard_winners
       WHERE  user_id = $1
       ORDER  BY period_key DESC`,
      [userId]
    ).catch(() => ({ rows: [] }));

    return res.json({
      success : true,
      profile : {
        user_id         : user.id,
        display_name    : masked,
        initials        : initialsOf(masked),
        color           : colorFor(masked),
        avatar_url      : user.avatar_url || null,
        total_referrals : Number(stats?.total_referrals || 0),
        last_referral_at: stats?.last_referral_at || null,
        rank,
        is_current_user : user.id === req.currentUserId,
        wins            : wins.map((w) => ({
          period_type   : w.period_type,
          period_key    : w.period_key,
          rank          : w.rank,
          reward_label  : `₦${Number(w.reward_amount).toLocaleString()}`,
          reward_status : w.reward_status,
        })),
      },
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load profile", err);
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/leaderboard/stats
════════════════════════════════════════════════════════════ */
router.get("/stats", limiter, async (_req, res) => {
  try {
    const { rows: [s] } = await pool.query(
      `SELECT
         COUNT(DISTINCT r.inviter_id)::INT AS total_inviters,
         COUNT(r.id)::INT                  AS total_referrals,
         COUNT(r.id) FILTER (
           WHERE r.created_at >= DATE_TRUNC('month', NOW())
         )::INT                            AS referrals_this_month,
         COUNT(r.id) FILTER (
           WHERE r.created_at >= DATE_TRUNC('year', NOW())
         )::INT                            AS referrals_this_year
       FROM referrals r
       JOIN users u ON u.id = r.inviter_id
       WHERE r.status IN ${VERIFIED}
         AND u.status NOT IN ${BANNED}`
    );

    return res.json({
      success         : true,
      stats           : {
        total_inviters       : Number(s?.total_inviters       || 0),
        total_referrals      : Number(s?.total_referrals      || 0),
        referrals_this_month : Number(s?.referrals_this_month || 0),
        referrals_this_year  : Number(s?.referrals_this_year  || 0),
      },
      monthly_rewards : MONTHLY_REWARDS,
      yearly_rewards  : YEARLY_REWARDS,
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load stats", err);
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/leaderboard/debug  — dev only
════════════════════════════════════════════════════════════ */
router.get("/debug", async (req, res) => {
  if (IS_PROD) return fail(res, 403, "Not available.");

  try {
    const [referrals, topAll] = await Promise.all([
      pool.query(
        `SELECT
           r.id,
           r.status,
           r.created_at,
           r.inviter_id,
           COALESCE(r.referee_id, r.invitee_id) AS referee_id,
           ui.name          AS inviter_name,
           ui.email         AS inviter_email,
           ui.email_verified AS inviter_email_verified,
           ui.status        AS inviter_status
         FROM   referrals r
         JOIN   users      ui ON ui.id = r.inviter_id
         ORDER  BY r.created_at DESC
         LIMIT  20`
      ),
      pool.query(
        `SELECT
           r.inviter_id,
           COUNT(r.id)::INT AS total,
           u.name,
           u.email,
           u.email_verified,
           u.status
         FROM   referrals r
         JOIN   users     u ON u.id = r.inviter_id
         WHERE  r.status IN ${VERIFIED}
         GROUP  BY r.inviter_id, u.name, u.email, u.email_verified, u.status
         ORDER  BY total DESC`
      ),
    ]);

    return res.json({
      success    : true,
      referrals  : referrals.rows,
      top_all    : topAll.rows,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;