// ════════════════════════════════════════════════════════════
// FILE: routes/leaderboard.js
// Base: /api/leaderboard
//
// Schema facts (from your exported CockroachDB table):
//   referrals.inviter_id  UUID NOT NULL
//   referrals.invitee_id  UUID NOT NULL  ← legacy NOT NULL col
//   referrals.referee_id  UUID NULL      ← new col
//
// Rules applied everywhere:
//   COUNT(DISTINCT ...) uses COALESCE(r.referee_id, r.invitee_id)
//   name concat uses COALESCE(col, '') to avoid NULL crashes
// ════════════════════════════════════════════════════════════

import express   from "express";
import rateLimit from "express-rate-limit";
import jwt       from "jsonwebtoken";
import { pool }  from "../config/db.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const fail = (res, status, message, extra = {}) => {
  console.error(`[leaderboard] ✗ ${status} — ${message}`);
  return res.status(status).json({ success: false, message, ...extra });
};

const failErr = (res, status, userMsg, err) => {
  console.error(`[leaderboard] ✗ ${userMsg}:`, err?.message);
  console.error(err?.stack);
  return res.status(status).json({
    success : false,
    message : IS_PROD ? userMsg : `${userMsg}: ${err?.message}`,
    ...(IS_PROD ? {} : { error: err?.message }),
  });
};

const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  null;

/* ── Avatar color from name ── */
const AVATAR_COLORS = [
  "#2563eb","#10b981","#f59e0b","#8b5cf6",
  "#ef4444","#0891b2","#e8630a","#059669",
  "#7c3aed","#0284c7","#dc2626","#16a34a",
];

const colorFor = (str = "") =>
  AVATAR_COLORS[
    [...str].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  ];

const initialsOf = (name = "") =>
  (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

/* ── Format a leaderboard row ── */
const formatEntry = (row, rank, currentUserId) => {
  const name = row.display_name || "Loemart User";
  return {
    rank,
    user_id            : row.user_id,
    display_name       : name,
    initials           : initialsOf(name),
    color              : colorFor(name),
    avatar_url         : row.avatar_url         || null,
    referral_code      : row.referral_code       || null,
    total_referrals    : Number(row.total_referrals    || 0),
    total_spins_earned : Number(row.total_spins_earned || 0),
    is_verified        : Boolean(row.identity_verified || row.store_verified),
    last_referral_at   : row.last_referral_at    || null,
    member_since       : row.member_since        || null,
    is_current_user    : row.user_id === currentUserId,
  };
};

/* ════════════════════════════════════════════════════════════
   OPTIONAL AUTH
   Reads JWT if present — never fails on missing/invalid token.
════════════════════════════════════════════════════════════ */
function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      const token   = header.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.currentUserId = decoded?.id ?? null;
    } else {
      req.currentUserId = null;
    }
  } catch (_) {
    req.currentUserId = null;
  }
  next();
}

/* ════════════════════════════════════════════════════════════
   RATE LIMITERS
════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60_000,
    max             : IS_PROD ? max : max * 30,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) =>
      String(req.currentUserId ?? req.user?.id ?? getIp(req)),
    handler : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const leaderboardLimiter = makeLimiter({
  windowMin : 1,
  max       : 30,
  message   : "Too many requests. Please slow down.",
});

const myRankLimiter = makeLimiter({
  windowMin : 1,
  max       : 20,
  message   : "Too many requests.",
});

/* ════════════════════════════════════════════════════════════
   VALID PERIODS + DATE FILTER
════════════════════════════════════════════════════════════ */
const VALID_PERIODS = ["all", "month", "week", "today"];

const PERIOD_LABELS = {
  all   : "All Time",
  month : "This Month",
  week  : "This Week",
  today : "Today",
};

function buildDateFilter(period) {
  const now = new Date();
  let cutoff = null;

  if (period === "today") {
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "week") {
    cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);
  } else if (period === "month") {
    cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return cutoff ? cutoff.toISOString() : null;
}

/* ════════════════════════════════════════════════════════════
   CORE SELECT FRAGMENT
   Used by the main leaderboard query.

   ✅ name concat uses COALESCE(col,'') — no NULL crash
   ✅ No referee_id reference here — ranking is by inviter_id
════════════════════════════════════════════════════════════ */
const LEADERBOARD_SELECT = `
  SELECT
    r.inviter_id                                                   AS user_id,
    COUNT(r.id)::INT                                               AS total_referrals,
    COALESCE(SUM(r.reward_value), 0)::INT                          AS total_spins_earned,
    MAX(r.reward_given_at)                                         AS last_referral_at,
    COALESCE(
      NULLIF(TRIM(
        COALESCE(u.first_name, '') || ' ' ||
        COALESCE(u.last_name,  '')
      ), ''),
      u.name,
      u.username,
      'Loemart User'
    )                                                              AS display_name,
    u.profile_image                                                AS avatar_url,
    u.referral_code,
    u.identity_verified,
    u.store_verified,
    u.created_at                                                   AS member_since
  FROM   referrals r
  JOIN   users     u ON u.id = r.inviter_id
  WHERE  r.status = 'rewarded'
    AND  u.status NOT IN ('banned', 'suspended', 'flagged')
`;

/* ════════════════════════════════════════════════════════════
   RANK SUBQUERY FRAGMENT
   Reused by GET / (my rank) and GET /me.
   Parameterised: caller provides dateWhere + userParam.

   ✅ COALESCE on name to avoid NULL crashes
════════════════════════════════════════════════════════════ */
const buildRankSubquery = (dateWhere = "", userParam = "$1") => `
  SELECT
    sub.rank,
    sub.total_referrals,
    sub.total_spins_earned,
    sub.last_referral_at,
    sub.display_name,
    sub.avatar_url,
    sub.referral_code,
    sub.identity_verified,
    sub.store_verified,
    sub.member_since
  FROM (
    SELECT
      r.inviter_id,
      COUNT(r.id)::INT                       AS total_referrals,
      COALESCE(SUM(r.reward_value), 0)::INT  AS total_spins_earned,
      MAX(r.reward_given_at)                 AS last_referral_at,
      COALESCE(
        NULLIF(TRIM(
          COALESCE(u.first_name, '') || ' ' ||
          COALESCE(u.last_name,  '')
        ), ''),
        u.name,
        u.username,
        'Loemart User'
      )                                      AS display_name,
      u.profile_image                        AS avatar_url,
      u.referral_code,
      u.identity_verified,
      u.store_verified,
      u.created_at                           AS member_since,
      RANK() OVER (
        ORDER BY COUNT(r.id) DESC, MAX(r.reward_given_at) ASC
      )::INT                                 AS rank
    FROM   referrals r
    JOIN   users     u ON u.id = r.inviter_id
    WHERE  r.status = 'rewarded'
      AND  u.status NOT IN ('banned', 'suspended', 'flagged')
      ${dateWhere}
    GROUP BY
      r.inviter_id,
      u.first_name, u.last_name, u.name, u.username,
      u.profile_image, u.referral_code,
      u.identity_verified, u.store_verified, u.created_at
  ) sub
  WHERE sub.inviter_id = ${userParam}
`;

/* ════════════════════════════════════════════════════════════
   GET /api/leaderboard
   Main leaderboard — top inviters.

   Query params:
     period — "all" | "week" | "month" | "today" (default: "all")
     limit  — 1–50  (default: 20)
════════════════════════════════════════════════════════════ */
router.get("/", optionalAuth, leaderboardLimiter, async (req, res) => {
  const period = VALID_PERIODS.includes(req.query.period)
    ? req.query.period
    : "all";

  const limit = Math.min(
    Math.max(parseInt(req.query.limit ?? "20", 10) || 20, 1),
    50
  );

  const currentUserId = req.currentUserId ?? null;
  const cutoff        = buildDateFilter(period);

  console.log(
    `[leaderboard] GET /  period=${period}  limit=${limit}` +
    `  user=${currentUserId ?? "guest"}`
  );

  try {

    /* ════════════════════════════════
       1. TOP N LEADERBOARD
    ════════════════════════════════ */
    const params = [];
    let   dateClause = "";

    if (cutoff) {
      params.push(cutoff);
      dateClause = `AND r.reward_given_at >= $${params.length}`;
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    const { rows: topRows } = await pool.query(
      `${LEADERBOARD_SELECT}
       ${dateClause}
       GROUP BY
         r.inviter_id,
         u.first_name, u.last_name, u.name, u.username,
         u.profile_image, u.referral_code,
         u.identity_verified, u.store_verified, u.created_at
       ORDER BY total_referrals DESC, last_referral_at ASC
       LIMIT ${limitParam}`,
      params
    );

    const leaderboard = topRows.map((row, idx) =>
      formatEntry(row, idx + 1, currentUserId)
    );

    console.log(`[leaderboard] ✓ fetched ${leaderboard.length} entries`);

    /* ════════════════════════════════
       2. MY RANK (logged-in users)
    ════════════════════════════════ */
    let myRank = null;

    if (currentUserId) {
      /* Already in the top list? Use that entry directly */
      const inList = leaderboard.find((e) => e.user_id === currentUserId);

      if (inList) {
        myRank = inList;
        console.log(`[leaderboard] my rank=${inList.rank} (in top list)`);
      } else {
        console.log(
          `[leaderboard] fetching rank for user=${currentUserId}…`
        );
        try {
          const rankParams  = cutoff
            ? [cutoff, currentUserId]
            : [currentUserId];
          const dateWhere   = cutoff ? `AND r.reward_given_at >= $1` : "";
          const userParam   = cutoff ? "$2" : "$1";

          const { rows: [myRow] } = await pool.query(
            buildRankSubquery(dateWhere, userParam),
            rankParams
          );

          if (myRow) {
            const name = myRow.display_name || "You";
            myRank = {
              rank               : myRow.rank,
              user_id            : currentUserId,
              display_name       : name,
              initials           : initialsOf(name),
              color              : colorFor(name),
              avatar_url         : myRow.avatar_url         || null,
              referral_code      : myRow.referral_code       || null,
              total_referrals    : Number(myRow.total_referrals    || 0),
              total_spins_earned : Number(myRow.total_spins_earned || 0),
              is_verified        : Boolean(
                myRow.identity_verified || myRow.store_verified
              ),
              last_referral_at   : myRow.last_referral_at   || null,
              member_since       : myRow.member_since        || null,
              is_current_user    : true,
            };
            console.log(`[leaderboard] my rank=${myRank.rank}`);
          } else {
            console.log(`[leaderboard] user not on leaderboard yet`);
          }
        } catch (rankErr) {
          /* Non-fatal — leaderboard still loads without my rank */
          console.warn(
            "[leaderboard] my rank query (non-fatal):", rankErr.message
          );
        }
      }
    }

    /* ════════════════════════════════
       3. GLOBAL STATS
    ════════════════════════════════ */
    let globalStats = {
      total_inviters    : 0,
      total_referrals   : 0,
      total_spins_given : 0,
    };

    try {
      const statsParams    = cutoff ? [cutoff] : [];
      const statsDateWhere = cutoff
        ? `AND r.reward_given_at >= $1`
        : "";

      const { rows: [gs] } = await pool.query(
        `SELECT
           COUNT(DISTINCT r.inviter_id)::INT     AS total_inviters,
           COUNT(r.id)::INT                      AS total_referrals,
           COALESCE(SUM(r.reward_value), 0)::INT AS total_spins_given
         FROM referrals r
         WHERE r.status = 'rewarded'
           ${statsDateWhere}`,
        statsParams
      );

      if (gs) {
        globalStats = {
          total_inviters    : Number(gs.total_inviters    || 0),
          total_referrals   : Number(gs.total_referrals   || 0),
          total_spins_given : Number(gs.total_spins_given || 0),
        };
      }
    } catch (statsErr) {
      console.warn(
        "[leaderboard] global stats (non-fatal):", statsErr.message
      );
    }

    return res.json({
      success      : true,
      period,
      period_label : PERIOD_LABELS[period],
      limit,
      leaderboard,
      my_rank      : myRank,
      global_stats : globalStats,
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load leaderboard", err);
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/leaderboard/me
   Returns the current user's rank across all periods.
════════════════════════════════════════════════════════════ */
router.get("/me", optionalAuth, myRankLimiter, async (req, res) => {
  const userId = req.currentUserId;
  if (!userId) return fail(res, 401, "Login to see your rank.");

  console.log(`[leaderboard] GET /me  user=${userId}`);

  try {
    const results = {};

    /* Run each period in parallel for speed */
    await Promise.all(
      VALID_PERIODS.map(async (period) => {
        const cutoff    = buildDateFilter(period);
        const params    = cutoff ? [cutoff, userId] : [userId];
        const dateWhere = cutoff ? `AND r.reward_given_at >= $1` : "";
        const userParam = cutoff ? "$2" : "$1";

        /* Simplified rank subquery — no extra columns needed here */
        const rankOnlySubquery = `
          SELECT
            sub.rank,
            sub.total_referrals,
            sub.total_spins_earned,
            sub.last_referral_at
          FROM (
            SELECT
              r.inviter_id,
              COUNT(r.id)::INT                       AS total_referrals,
              COALESCE(SUM(r.reward_value), 0)::INT  AS total_spins_earned,
              MAX(r.reward_given_at)                 AS last_referral_at,
              RANK() OVER (
                ORDER BY COUNT(r.id) DESC,
                         MAX(r.reward_given_at) ASC
              )::INT                                 AS rank
            FROM   referrals r
            JOIN   users     u ON u.id = r.inviter_id
            WHERE  r.status = 'rewarded'
              AND  u.status NOT IN ('banned', 'suspended', 'flagged')
              ${dateWhere}
            GROUP BY r.inviter_id
          ) sub
          WHERE sub.inviter_id = ${userParam}
        `;

        try {
          const { rows: [row] } = await pool.query(rankOnlySubquery, params);

          results[period] = row
            ? {
                rank               : Number(row.rank              || 0),
                total_referrals    : Number(row.total_referrals   || 0),
                total_spins_earned : Number(row.total_spins_earned || 0),
                last_referral_at   : row.last_referral_at || null,
                on_leaderboard     : true,
              }
            : {
                rank               : null,
                total_referrals    : 0,
                total_spins_earned : 0,
                last_referral_at   : null,
                on_leaderboard     : false,
              };
        } catch (periodErr) {
          console.warn(
            `[leaderboard] /me period=${period}:`, periodErr.message
          );
          results[period] = {
            rank               : null,
            total_referrals    : 0,
            total_spins_earned : 0,
            last_referral_at   : null,
            on_leaderboard     : false,
          };
        }
      })
    );

    return res.json({
      success : true,
      user_id : userId,
      ranks   : results,
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load your rank", err);
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/leaderboard/user/:userId
   Public profile — view a specific user's leaderboard stats.

   ✅ name concat uses COALESCE(col,'') — no NULL crash
════════════════════════════════════════════════════════════ */
router.get("/user/:userId", optionalAuth, leaderboardLimiter, async (req, res) => {
  const { userId } = req.params;
  if (!userId) return fail(res, 400, "userId is required.");

  console.log(`[leaderboard] GET /user/${userId}`);

  try {
    /* ── User info ── */
    const { rows: [user] } = await pool.query(
      `SELECT
         id,
         COALESCE(
           NULLIF(TRIM(
             COALESCE(first_name, '') || ' ' ||
             COALESCE(last_name,  '')
           ), ''),
           name,
           username,
           'Loemart User'
         )              AS display_name,
         profile_image  AS avatar_url,
         referral_code,
         identity_verified,
         store_verified,
         created_at     AS member_since,
         status
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (!user) return fail(res, 404, "User not found.");

    if (["banned", "suspended", "flagged"].includes(user.status)) {
      return fail(res, 403, "This profile is not available.");
    }

    const name = user.display_name || "Loemart User";

    /* ── Their referral stats ── */
    const { rows: [stats] } = await pool.query(
      `SELECT
         COUNT(r.id)::INT                       AS total_referrals,
         COALESCE(SUM(r.reward_value), 0)::INT  AS total_spins_earned,
         MAX(r.reward_given_at)                 AS last_referral_at
       FROM referrals r
       WHERE r.inviter_id = $1
         AND r.status     = 'rewarded'`,
      [userId]
    );

    /* ── Their all-time rank ── */
    let rank = null;
    try {
      const { rows: [rankRow] } = await pool.query(
        `SELECT sub.rank
         FROM (
           SELECT
             r.inviter_id,
             RANK() OVER (
               ORDER BY COUNT(r.id) DESC,
                        MAX(r.reward_given_at) ASC
             )::INT AS rank
           FROM   referrals r
           JOIN   users     u ON u.id = r.inviter_id
           WHERE  r.status = 'rewarded'
             AND  u.status NOT IN ('banned', 'suspended', 'flagged')
           GROUP BY r.inviter_id
         ) sub
         WHERE sub.inviter_id = $1`,
        [userId]
      );
      rank = rankRow?.rank ?? null;
    } catch (rankErr) {
      /* Non-fatal */
      console.warn("[leaderboard] user rank:", rankErr.message);
    }

    return res.json({
      success : true,
      profile : {
        user_id            : user.id,
        display_name       : name,
        initials           : initialsOf(name),
        color              : colorFor(name),
        avatar_url         : user.avatar_url    || null,
        referral_code      : user.referral_code  || null,
        is_verified        : Boolean(
          user.identity_verified || user.store_verified
        ),
        member_since       : user.member_since   || null,
        total_referrals    : Number(stats?.total_referrals    || 0),
        total_spins_earned : Number(stats?.total_spins_earned || 0),
        last_referral_at   : stats?.last_referral_at || null,
        rank_all_time      : rank,
        is_current_user    : user.id === req.currentUserId,
      },
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load user profile", err);
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/leaderboard/stats
   Public community stats — lightweight, no auth required.

   ✅ COUNT(DISTINCT COALESCE(r.referee_id, r.invitee_id))
      so rows with only invitee_id are counted correctly.
════════════════════════════════════════════════════════════ */
router.get("/stats", leaderboardLimiter, async (_req, res) => {
  console.log("[leaderboard] GET /stats");

  try {
    const { rows: [gs] } = await pool.query(
      `SELECT
         COUNT(DISTINCT r.inviter_id)::INT                      AS total_inviters,
         COUNT(r.id)::INT                                       AS total_referrals,
         COUNT(DISTINCT
           COALESCE(r.referee_id, r.invitee_id)
         )::INT                                                 AS total_users_joined,
         COALESCE(SUM(r.reward_value), 0)::INT                  AS total_spins_given,
         COUNT(r.id) FILTER (
           WHERE r.reward_given_at >= NOW() - INTERVAL '7 days'
         )::INT                                                 AS referrals_this_week,
         COUNT(r.id) FILTER (
           WHERE r.reward_given_at >= NOW() - INTERVAL '30 days'
         )::INT                                                 AS referrals_this_month
       FROM referrals r
       WHERE r.status = 'rewarded'`
    );

    return res.json({
      success : true,
      stats   : {
        total_inviters       : Number(gs?.total_inviters       || 0),
        total_referrals      : Number(gs?.total_referrals      || 0),
        total_users_joined   : Number(gs?.total_users_joined   || 0),
        total_spins_given    : Number(gs?.total_spins_given    || 0),
        referrals_this_week  : Number(gs?.referrals_this_week  || 0),
        referrals_this_month : Number(gs?.referrals_this_month || 0),
      },
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load stats", err);
  }
});

export default router;