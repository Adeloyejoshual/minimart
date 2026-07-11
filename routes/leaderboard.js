// ════════════════════════════════════════════════════════════
// FILE: routes/leaderboard.js
// Base: /api/leaderboard
// ════════════════════════════════════════════════════════════

import express   from "express";
import rateLimit from "express-rate-limit";
import jwt       from "jsonwebtoken";
import { pool }  from "../config/db.js";
import { finalizeLeaderboard } from "../services/leaderboardCron.js";

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

const VERIFIED      = `('rewarded', 'verified')`;
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
  const first = row.first_name?.trim();
  const last  = row.last_name?.trim();
  if (first || last)
    return [first, last].filter(Boolean).map(maskWord).join(" ");

  const name = (row.name ?? row.raw_name)?.trim();
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
    .split(" ").slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

/* ════════════════════════════════════════════════════════════
   FORMAT ENTRY
════════════════════════════════════════════════════════════ */
const formatEntry = (row, rank, currentUserId, rewardMap = null) => {
  const masked = buildMaskedName({
    first_name : row.first_name,
    last_name  : row.last_name,
    name       : row.raw_name ?? row.name,
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
};

/* ════════════════════════════════════════════════════════════
   COUNTDOWN HELPERS
════════════════════════════════════════════════════════════ */
function endOfMonth() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const ms  = end - now;
  const d   = Math.floor(ms / 86_400_000);
  const h   = Math.floor((ms % 86_400_000) / 3_600_000);
  const m   = Math.floor((ms % 3_600_000)  / 60_000);
  return {
    iso     : end.toISOString(),
    seconds : Math.floor(ms / 1_000),
    label   : d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`,
  };
}

function endOfYear() {
  const now = new Date();
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
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
   DATE CUTOFF
════════════════════════════════════════════════════════════ */
function dateCutoff(period) {
  const now = new Date();
  if (period === "today")
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  if (period === "month")
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if (period === "year")
    return new Date(now.getFullYear(), 0, 1).toISOString();
  return null;
}

/* ════════════════════════════════════════════════════════════
   OPTIONAL AUTH
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
   QUERY BUILDERS
════════════════════════════════════════════════════════════ */
function buildLeaderboardQuery(dateWhere, limitParam) {
  return `
    SELECT
      r.inviter_id          AS user_id,
      COUNT(r.id)::INT      AS total_referrals,
      MAX(r.created_at)     AS last_referral_at,
      u.first_name, u.last_name,
      u.name                AS raw_name,
      u.username, u.email,
      u.profile_image       AS avatar_url
    FROM   referrals r
    JOIN   users     u ON u.id = r.inviter_id
    WHERE  r.status IN ${VERIFIED}
      AND  u.status NOT IN ('banned', 'suspended', 'flagged')
      AND  u.email_verified = true
      ${dateWhere}
    GROUP BY
      r.inviter_id,
      u.first_name, u.last_name, u.name,
      u.username, u.email, u.profile_image
    ORDER BY total_referrals DESC, last_referral_at ASC
    LIMIT ${limitParam}
  `;
}

function buildRankQuery(dateWhere, userParam) {
  return `
    SELECT sub.rank, sub.total_referrals
    FROM (
      SELECT
        r.inviter_id          AS user_id,
        COUNT(r.id)::INT      AS total_referrals,
        RANK() OVER (
          ORDER BY COUNT(r.id) DESC, MAX(r.created_at) ASC
        )::INT                AS rank
      FROM   referrals r
      JOIN   users     u ON u.id = r.inviter_id
      WHERE  r.status IN ${VERIFIED}
        AND  u.status NOT IN ('banned', 'suspended', 'flagged')
        AND  u.email_verified = true
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
    ? req.query.period : "all";
  const limit  = Math.min(
    Math.max(parseInt(req.query.limit ?? "20", 10) || 20, 1), 50
  );
  const userId    = req.currentUserId ?? null;
  const cutoff    = dateCutoff(period);
  const rewardMap = period === "month" ? MONTHLY_REWARDS
    : period === "year" ? YEARLY_REWARDS : null;
  const countdown = period === "month" ? endOfMonth()
    : period === "year" ? endOfYear() : null;

  try {
    /* ── Top N ── */
    const params = [];
    let dateWhere = "";
    if (cutoff) {
      params.push(cutoff);
      dateWhere = `AND r.created_at >= $${params.length}`;
    }
    params.push(limit);

    const { rows: topRows } = await pool.query(
      buildLeaderboardQuery(dateWhere, `$${params.length}`),
      params
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
          const { rows: [row] } = await pool.query(buildRankQuery(dw, up), rp);
          if (row) {
            myRank = {
              rank            : Number(row.rank),
              total_referrals : Number(row.total_referrals),
              is_current_user : true,
              reward          : rewardMap?.[row.rank]
                ? { ...rewardMap[row.rank], currency: "NGN" }
                : null,
            };
          }
        } catch (e) {
          console.warn("[leaderboard] my rank:", e.message);
        }
      }
    }

    /* ── Total inviters ── */
    let totalInviters = 0;
    try {
      const sp = cutoff ? [cutoff] : [];
      const sd = cutoff ? `AND r.created_at >= $1` : "";
      const { rows: [c] } = await pool.query(
        `SELECT COUNT(DISTINCT r.inviter_id)::INT AS cnt
         FROM referrals r
         JOIN users u ON u.id = r.inviter_id
         WHERE r.status IN ${VERIFIED}
           AND u.email_verified = true
           ${sd}`,
        sp
      );
      totalInviters = Number(c?.cnt || 0);
    } catch (_) {}

    /* ── Previous winners ── */
    let previousWinners = null;
    if (period === "month" || period === "year") {
      try {
        const ptype = period === "month" ? "monthly" : "yearly";
        const { rows: pw } = await pool.query(
          `SELECT
             lw.rank, lw.period_key, lw.total_referrals,
             lw.reward_amount, lw.reward_status,
             u.first_name, u.last_name, u.name AS raw_name,
             u.username, u.email,
             u.profile_image AS avatar_url
           FROM   leaderboard_winners lw
           JOIN   users              u ON u.id = lw.user_id
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
      } catch (e) {
        console.warn("[leaderboard] previous winners:", e.message);
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
            rank: Number(rank), ...r, currency: "NGN",
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
            buildRankQuery(dw, up), params
          );
          results[period] = row
            ? { rank: Number(row.rank), total_referrals: Number(row.total_referrals), on_leaderboard: true }
            : { rank: null, total_referrals: 0, on_leaderboard: false };
        } catch (_) {
          results[period] = { rank: null, total_referrals: 0, on_leaderboard: false };
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
   POST /api/leaderboard/finalize  — Admin + Cron
════════════════════════════════════════════════════════════ */
router.post("/finalize", optionalAuth, async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" ||
    req.user?.is_admin === true ||
    req.currentUserId === process.env.ADMIN_USER_ID;

  if (!isAdmin) return fail(res, 403, "Admin access required.");

  const { type, period_key } = req.body;
  if (!["monthly", "yearly"].includes(type))
    return fail(res, 400, "type must be 'monthly' or 'yearly'.");

  try {
    const result = await finalizeLeaderboard(type, period_key ?? null);
    return res.json(result);
  } catch (err) {
    return failErr(res, 500, "Finalization failed", err);
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
      `SELECT id, first_name, last_name, name, username, email,
              profile_image AS avatar_url, status
       FROM   users WHERE id = $1`,
      [userId]
    );

    if (!user) return fail(res, 404, "User not found.");
    if (["banned","suspended","flagged"].includes(user.status))
      return fail(res, 403, "Profile not available.");

    const masked = buildMaskedName(user);

    const { rows: [stats] } = await pool.query(
      `SELECT COUNT(r.id)::INT AS total_referrals
       FROM   referrals r
       WHERE  r.inviter_id = $1 AND r.status IN ${VERIFIED}`,
      [userId]
    );

    let rank = null;
    try {
      const { rows: [r] } = await pool.query(
        `SELECT sub.rank FROM (
           SELECT r.inviter_id AS user_id,
             RANK() OVER (ORDER BY COUNT(r.id) DESC, MAX(r.created_at) ASC)::INT AS rank
           FROM   referrals r
           JOIN   users u ON u.id = r.inviter_id
           WHERE  r.status IN ${VERIFIED}
             AND  u.status NOT IN ('banned','suspended','flagged')
             AND  u.email_verified = true
           GROUP BY r.inviter_id
         ) sub WHERE sub.user_id = $1`,
        [userId]
      );
      rank = r?.rank ?? null;
    } catch (_) {}

    const { rows: wins } = await pool.query(
      `SELECT period_type, period_key, rank, reward_amount, reward_status
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
         AND u.email_verified = true`
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

export default router;