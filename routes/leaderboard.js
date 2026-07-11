// ════════════════════════════════════════════════════════════
// FILE: routes/leaderboard.js
// Base: /api/leaderboard
//
// ✅ Names are masked for privacy: "Joshua Adamu" → "J*****a A***u"
// ✅ Falls back through: first_name+last_name → name → username → email
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

/* ════════════════════════════════════════════════════════════
   MASKING — the core fix

   Examples:
     "Joshua"      → "J****a"
     "Jo"          → "J*"
     "J"           → "J"
     "Joshua Adamu"→ "J****a A***u"
     "jo@mail.com" → "j*@m***.com"
     null          → "User"
════════════════════════════════════════════════════════════ */
function maskWord(word) {
  if (!word) return "";
  const w = word.trim();
  if (w.length <= 1) return w;
  if (w.length === 2) return `${w[0]}*`;
  /* Show first char + stars + last char */
  return `${w[0]}${"*".repeat(w.length - 2)}${w[w.length - 1]}`;
}

function maskEmail(email) {
  if (!email || !email.includes("@")) return "User";
  const [local, domain] = email.split("@");
  const maskedLocal = maskWord(local);
  const domParts    = domain.split(".");
  if (domParts.length >= 2) {
    const maskedDom = maskWord(domParts[0]);
    return `${maskedLocal}@${maskedDom}.${domParts.slice(1).join(".")}`;
  }
  return `${maskedLocal}@${maskWord(domain)}`;
}

function maskName(raw) {
  if (!raw || !raw.trim()) return null;
  const words = raw.trim().split(/\s+/);
  return words.map(maskWord).join(" ");
}

/**
 * buildMaskedDisplayName
 * Takes a user row with all possible name fields and returns
 * a privacy-safe masked display name.
 *
 * Priority:
 *   1. first_name + last_name  → "J****a A***u"
 *   2. name (full name)        → "J****a A***u"
 *   3. username                → "j*****7"
 *   4. email                   → "j*@m***.com"
 *   5. fallback                → "User"
 */
function buildMaskedDisplayName(row) {
  /* 1. first_name + last_name */
  const first = row.first_name?.trim();
  const last  = row.last_name?.trim();
  if (first || last) {
    const parts = [first, last].filter(Boolean);
    return parts.map(maskWord).join(" ");
  }

  /* 2. name (full name field) */
  const name = row.name?.trim();
  if (name) return maskName(name);

  /* 3. username */
  const uname = row.username?.trim();
  if (uname) return maskWord(uname);

  /* 4. email */
  const email = row.email?.trim();
  if (email) return maskEmail(email);

  /* 5. fallback */
  return "User";
}

/* ════════════════════════════════════════════════════════════
   AVATAR HELPERS
════════════════════════════════════════════════════════════ */
const AVATAR_COLORS = [
  "#2563eb","#10b981","#f59e0b","#8b5cf6",
  "#ef4444","#0891b2","#e8630a","#059669",
  "#7c3aed","#0284c7","#dc2626","#16a34a",
];

const colorFor = (str = "") =>
  AVATAR_COLORS[
    [...str].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  ];

/**
 * initialsOf — generates initials from a masked name.
 * Uses the FIRST character of each word (which is NOT masked).
 * "J****a A***u" → "JA"
 */
const initialsOf = (name = "") =>
  (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

/* ════════════════════════════════════════════════════════════
   FORMAT LEADERBOARD ENTRY
   Takes a raw DB row + computes masked display name, initials,
   avatar color, etc.
════════════════════════════════════════════════════════════ */
const formatEntry = (row, rank, currentUserId) => {
  const maskedName = buildMaskedDisplayName({
    first_name : row.first_name,
    last_name  : row.last_name,
    name       : row.raw_name,
    username   : row.username,
    email      : row.email,
  });

  return {
    rank,
    user_id            : row.user_id,
    display_name       : maskedName,
    initials           : initialsOf(maskedName),
    color              : colorFor(maskedName),
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
   PERIODS + DATE FILTER
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
   CORE SELECT
   ✅ Fetches ALL name fields so buildMaskedDisplayName
      can pick the best one and mask it.
   ✅ No COALESCE/name logic in SQL — done in JS for control.
════════════════════════════════════════════════════════════ */
const LEADERBOARD_SELECT = `
  SELECT
    r.inviter_id                            AS user_id,
    COUNT(r.id)::INT                        AS total_referrals,
    COALESCE(SUM(r.reward_value), 0)::INT   AS total_spins_earned,
    MAX(r.reward_given_at)                  AS last_referral_at,
    u.first_name,
    u.last_name,
    u.name                                  AS raw_name,
    u.username,
    u.email,
    u.profile_image                         AS avatar_url,
    u.referral_code,
    u.identity_verified,
    u.store_verified,
    u.created_at                            AS member_since
  FROM   referrals r
  JOIN   users     u ON u.id = r.inviter_id
  WHERE  r.status IN ('rewarded', 'verified', 'pending')
    AND  u.status NOT IN ('banned', 'suspended', 'flagged')
`;

const LEADERBOARD_GROUP = `
  GROUP BY
    r.inviter_id,
    u.first_name, u.last_name, u.name, u.username, u.email,
    u.profile_image, u.referral_code,
    u.identity_verified, u.store_verified, u.created_at
`;

/* ════════════════════════════════════════════════════════════
   RANK SUBQUERY BUILDER
════════════════════════════════════════════════════════════ */
const buildRankSubquery = (dateWhere = "", userParam = "$1") => `
  SELECT
    sub.rank,
    sub.total_referrals,
    sub.total_spins_earned,
    sub.last_referral_at,
    sub.first_name,
    sub.last_name,
    sub.raw_name,
    sub.username,
    sub.email,
    sub.avatar_url,
    sub.referral_code,
    sub.identity_verified,
    sub.store_verified,
    sub.member_since
  FROM (
    SELECT
      r.inviter_id                            AS user_id,
      COUNT(r.id)::INT                        AS total_referrals,
      COALESCE(SUM(r.reward_value), 0)::INT   AS total_spins_earned,
      MAX(r.reward_given_at)                  AS last_referral_at,
      u.first_name,
      u.last_name,
      u.name                                  AS raw_name,
      u.username,
      u.email,
      u.profile_image                         AS avatar_url,
      u.referral_code,
      u.identity_verified,
      u.store_verified,
      u.created_at                            AS member_since,
      RANK() OVER (
        ORDER BY COUNT(r.id) DESC, MAX(r.reward_given_at) ASC
      )::INT                                  AS rank
    FROM   referrals r
    JOIN   users     u ON u.id = r.inviter_id
    WHERE  r.status IN ('rewarded', 'verified', 'pending')
      AND  u.status NOT IN ('banned', 'suspended', 'flagged')
      ${dateWhere}
    ${LEADERBOARD_GROUP}
  ) sub
  WHERE sub.user_id = ${userParam}
`;

/* ════════════════════════════════════════════════════════════
   GET /api/leaderboard
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
    /* ── 1. Top N ── */
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
       ${LEADERBOARD_GROUP}
       ORDER BY total_referrals DESC, last_referral_at ASC
       LIMIT ${limitParam}`,
      params
    );

    const leaderboard = topRows.map((row, idx) =>
      formatEntry(row, idx + 1, currentUserId)
    );

    console.log(`[leaderboard] ✓ ${leaderboard.length} entries`);

    /* ── 2. My rank ── */
    let myRank = null;

    if (currentUserId) {
      const inList = leaderboard.find((e) => e.user_id === currentUserId);

      if (inList) {
        myRank = inList;
      } else {
        try {
          const rankParams = cutoff
            ? [cutoff, currentUserId]
            : [currentUserId];
          const dateWhere  = cutoff ? `AND r.reward_given_at >= $1` : "";
          const userParam  = cutoff ? "$2" : "$1";

          const { rows: [myRow] } = await pool.query(
            buildRankSubquery(dateWhere, userParam),
            rankParams
          );

          if (myRow) {
            myRank = formatEntry(
              { ...myRow, user_id: currentUserId },
              myRow.rank,
              currentUserId
            );
          }
        } catch (rankErr) {
          console.warn(
            "[leaderboard] my rank (non-fatal):", rankErr.message
          );
        }
      }
    }

    /* ── 3. Global stats ── */
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
         WHERE r.status IN ('rewarded', 'verified', 'pending')
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
      console.warn("[leaderboard] stats (non-fatal):", statsErr.message);
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
════════════════════════════════════════════════════════════ */
router.get("/me", optionalAuth, myRankLimiter, async (req, res) => {
  const userId = req.currentUserId;
  if (!userId) return fail(res, 401, "Login to see your rank.");

  console.log(`[leaderboard] GET /me  user=${userId}`);

  try {
    const results = {};

    await Promise.all(
      VALID_PERIODS.map(async (period) => {
        const cutoff    = buildDateFilter(period);
        const params    = cutoff ? [cutoff, userId] : [userId];
        const dateWhere = cutoff ? `AND r.reward_given_at >= $1` : "";
        const userParam = cutoff ? "$2" : "$1";

        const rankQuery = `
          SELECT sub.rank, sub.total_referrals,
                 sub.total_spins_earned, sub.last_referral_at
          FROM (
            SELECT
              r.inviter_id AS user_id,
              COUNT(r.id)::INT                       AS total_referrals,
              COALESCE(SUM(r.reward_value), 0)::INT  AS total_spins_earned,
              MAX(r.reward_given_at)                 AS last_referral_at,
              RANK() OVER (
                ORDER BY COUNT(r.id) DESC,
                         MAX(r.reward_given_at) ASC
              )::INT                                 AS rank
            FROM   referrals r
            JOIN   users     u ON u.id = r.inviter_id
            WHERE  r.status IN ('rewarded', 'verified', 'pending')
              AND  u.status NOT IN ('banned', 'suspended', 'flagged')
              ${dateWhere}
            GROUP BY r.inviter_id
          ) sub
          WHERE sub.user_id = ${userParam}
        `;

        try {
          const { rows: [row] } = await pool.query(rankQuery, params);
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
        } catch (e) {
          console.warn(`[leaderboard] /me period=${period}:`, e.message);
          results[period] = {
            rank: null, total_referrals: 0,
            total_spins_earned: 0, on_leaderboard: false,
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
════════════════════════════════════════════════════════════ */
router.get("/user/:userId", optionalAuth, leaderboardLimiter, async (req, res) => {
  const { userId } = req.params;
  if (!userId) return fail(res, 400, "userId is required.");

  console.log(`[leaderboard] GET /user/${userId}`);

  try {
    const { rows: [user] } = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         name,
         username,
         email,
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
    if (["banned","suspended","flagged"].includes(user.status)) {
      return fail(res, 403, "This profile is not available.");
    }

    const maskedName = buildMaskedDisplayName({
      first_name : user.first_name,
      last_name  : user.last_name,
      name       : user.name,
      username   : user.username,
      email      : user.email,
    });

    const { rows: [stats] } = await pool.query(
      `SELECT
         COUNT(r.id)::INT                       AS total_referrals,
         COALESCE(SUM(r.reward_value), 0)::INT  AS total_spins_earned,
         MAX(r.reward_given_at)                 AS last_referral_at
       FROM referrals r
       WHERE r.inviter_id = $1
         AND r.status IN ('rewarded', 'verified', 'pending')`,
      [userId]
    );

    let rank = null;
    try {
      const { rows: [rankRow] } = await pool.query(
        `SELECT sub.rank FROM (
           SELECT
             r.inviter_id AS user_id,
             RANK() OVER (
               ORDER BY COUNT(r.id) DESC,
                        MAX(r.reward_given_at) ASC
             )::INT AS rank
           FROM   referrals r
           JOIN   users     u ON u.id = r.inviter_id
           WHERE  r.status IN ('rewarded', 'verified', 'pending')
             AND  u.status NOT IN ('banned', 'suspended', 'flagged')
           GROUP BY r.inviter_id
         ) sub
         WHERE sub.user_id = $1`,
        [userId]
      );
      rank = rankRow?.rank ?? null;
    } catch (e) {
      console.warn("[leaderboard] user rank:", e.message);
    }

    return res.json({
      success : true,
      profile : {
        user_id            : user.id,
        display_name       : maskedName,
        initials           : initialsOf(maskedName),
        color              : colorFor(maskedName),
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
       WHERE r.status IN ('rewarded', 'verified', 'pending')`
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

/* ════════════════════════════════════════════════════════════
   GET /api/leaderboard/debug  (dev only)
════════════════════════════════════════════════════════════ */
router.get("/debug", async (req, res) => {
  if (IS_PROD) return fail(res, 403, "Not available.");

  try {
    const { rows } = await pool.query(
      `SELECT
         r.id,
         r.inviter_id,
         COALESCE(r.referee_id, r.invitee_id) AS referee_id,
         r.invite_code,
         r.status,
         r.reward_value,
         r.reward_given_at,
         r.verified_at,
         r.created_at,
         ui.name  AS inviter_name,
         ui.email AS inviter_email,
         ue.name  AS referee_name,
         ue.email AS referee_email
       FROM   referrals r
       JOIN   users     ui ON ui.id = r.inviter_id
       JOIN   users     ue
              ON ue.id = COALESCE(r.referee_id, r.invitee_id)
       ORDER  BY r.created_at DESC
       LIMIT  20`
    );

    return res.json({ success: true, count: rows.length, referrals: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;