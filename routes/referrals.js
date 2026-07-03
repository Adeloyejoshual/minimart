// ════════════════════════════════════════════════════════════
// FILE: routes/referrals.js
// Base: /api/referrals
// ════════════════════════════════════════════════════════════

import express    from "express";
import rateLimit  from "express-rate-limit";
import { pool }   from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const fail    = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const getIp   = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  req.socket?.remoteAddress ??
  null;

const AVATAR_COLORS = [
  "#2563eb","#10b981","#f59e0b","#8b5cf6",
  "#ef4444","#0891b2","#e8630a","#059669",
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

const resolveDisplayName = (row) =>
  [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
  row.name        ||
  row.username    ||
  "Unknown";

/* ── Format a referral row into activity item ── */
const formatActivity = (row) => {
  const name = resolveDisplayName({
    first_name : row.referee_first_name,
    last_name  : row.referee_last_name,
    name       : row.referee_name,
    username   : row.referee_username,
  });

  return {
    id              : row.id,
    name,
    initials        : initialsOf(name),
    color           : colorFor(name),
    avatar_url      : row.referee_avatar || null,
    status          : row.status,
    reward_type     : row.reward_type,
    reward_value    : row.reward_value,
    joined_at       : row.joined_at,
    verified_at     : row.verified_at,
    reward_given_at : row.reward_given_at,
  };
};

/* ── Format an event log row ── */
const formatEvent = (row) => {
  const name = resolveDisplayName({
    first_name : row.referee_first_name,
    name       : row.referee_name,
    username   : row.referee_username,
  });

  return {
    type         : row.event_type,
    description  : row.description,
    referee_name : name,
    created_at   : row.created_at,
  };
};

/* ══════════════════════════════════════════════════════════════
   RATE LIMITERS
══════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60_000,
    max             : IS_PROD ? max : max * 20,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? getIp(req)),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const dashboardLimiter = makeLimiter({
  windowMin : 1,
  max       : IS_PROD ? 30 : 300,
  message   : "Too many requests. Please slow down.",
});

const recordLimiter = makeLimiter({
  windowMin : 60,
  max       : IS_PROD ? 5 : 100,
  message   : "Too many referral submissions.",
});

const validateLimiter = makeLimiter({
  windowMin : 5,
  max       : IS_PROD ? 20 : 200,
  message   : "Too many validation requests.",
});

/* ══════════════════════════════════════════════════════════════
   GET /api/referrals/dashboard
   Returns everything the Invitation page needs in one call:
   - referral_code
   - bonus_spins
   - stats (totals)
   - activity list (who joined, status, reward)
   - events feed (timestamped log)
══════════════════════════════════════════════════════════════ */
router.get("/dashboard", authenticate, dashboardLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {

    /* ── 1. User referral info ── */
    const { rows: [user] } = await pool.query(
      `SELECT
         referral_code,
         bonus_spins,
         total_referrals
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (!user) return fail(res, 404, "User not found.");

    /* ── 2. Aggregate stats ── */
    const { rows: [stats] } = await pool.query(
      `SELECT
         COUNT(*)::INT                                           AS total_invites,
         COUNT(*) FILTER (WHERE status = 'rewarded')::INT       AS successful_signups,
         COUNT(*) FILTER (WHERE status = 'pending')::INT        AS pending_invites,
         COUNT(*) FILTER (WHERE status = 'verified')::INT       AS verified_count,
         COALESCE(
           SUM(reward_value) FILTER (WHERE status = 'rewarded'),
           0
         )::INT                                                 AS total_spins_earned
       FROM referrals
       WHERE inviter_id = $1`,
      [userId]
    );

    /* ── 3. Activity list — who joined using my code ── */
    const { rows: activityRows } = await pool.query(
      `SELECT
         r.id,
         r.status,
         r.reward_type,
         r.reward_value,
         r.reward_given_at,
         r.created_at   AS joined_at,
         r.verified_at,
         -- referee details
         u.name         AS referee_name,
         u.first_name   AS referee_first_name,
         u.last_name    AS referee_last_name,
         u.username     AS referee_username,
         u.profile_image AS referee_avatar
       FROM  referrals r
       JOIN  users     u ON r.referee_id = u.id
       WHERE r.inviter_id = $1
       ORDER BY r.created_at DESC
       LIMIT 100`,
      [userId]
    );

    /* ── 4. Recent events feed ── */
    const { rows: eventRows } = await pool.query(
      `SELECT
         re.event_type,
         re.description,
         re.created_at,
         u.name       AS referee_name,
         u.first_name AS referee_first_name,
         u.username   AS referee_username
       FROM  referral_events re
       JOIN  referrals       r  ON re.referral_id = r.id
       JOIN  users           u  ON r.referee_id   = u.id
       WHERE r.inviter_id = $1
       ORDER BY re.created_at DESC
       LIMIT 30`,
      [userId]
    );

    return res.json({
      success : true,

      referral_code   : user.referral_code   ?? null,
      bonus_spins     : user.bonus_spins      ?? 0,
      total_referrals : user.total_referrals  ?? 0,

      stats: {
        total_invites          : stats.total_invites       ?? 0,
        successful_signups     : stats.successful_signups  ?? 0,
        pending_invites        : stats.pending_invites     ?? 0,
        verified_count         : stats.verified_count      ?? 0,
        total_spins_earned     : stats.total_spins_earned  ?? 0,
        bonus_spins_remaining  : user.bonus_spins          ?? 0,
      },

      activity : activityRows.map(formatActivity),
      events   : eventRows.map(formatEvent),
    });

  } catch (err) {
    console.error("[referrals/dashboard]", err.message, "\n", err.stack);
    return fail(res, 500, `Database error: ${err.message}`);
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/referrals/record
   Called during registration when an invite code is provided.
   This is called from auth.routes.js — no auth middleware needed
   because the user was JUST created and may not have a token yet.
══════════════════════════════════════════════════════════════ */
router.post("/record", recordLimiter, async (req, res) => {
  const { invite_code, referee_id } = req.body;
  const ip = getIp(req);

  /* ── Validate input ── */
  if (!invite_code || !referee_id) {
    return fail(res, 400, "invite_code and referee_id are required.");
  }

  const code = invite_code.toString().toUpperCase().trim();

  if (!/^[A-Z0-9]{4,20}$/.test(code)) {
    return fail(res, 400, "Invalid invite code format.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Find the inviter ── */
    const { rows: [inviter] } = await client.query(
      `SELECT id, status
       FROM   users
       WHERE  referral_code = $1`,
      [code]
    );

    if (!inviter) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Invalid invite code.");
    }

    /* ── Self-referral guard ── */
    if (inviter.id === referee_id) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Cannot use your own invite code.", {
        code: "SELF_REFERRAL",
      });
    }

    /* ── Inviter account health check ── */
    if (["banned", "suspended", "flagged"].includes(inviter.status)) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Invalid invite code.");
    }

    /* ── Referee can only be referred once ── */
    const { rows: [alreadyReferred] } = await client.query(
      `SELECT id FROM referrals WHERE referee_id = $1 LIMIT 1`,
      [referee_id]
    );

    if (alreadyReferred) {
      await client.query("ROLLBACK");
      /* Not an error — just silently skip */
      return res.json({
        success : false,
        message : "Already referred.",
        code    : "ALREADY_REFERRED",
      });
    }

    /* ── Create the referral record ── */
    const { rows: [referral] } = await client.query(
      `INSERT INTO referrals
         (inviter_id, referee_id, invite_code, status, reward_type, reward_value)
       VALUES ($1, $2, $3, 'pending', 'bonus_spin', 1)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [inviter.id, referee_id, code]
    );

    if (!referral) {
      /* ON CONFLICT fired — duplicate silently ignored */
      await client.query("ROLLBACK");
      return res.json({ success: false, message: "Duplicate referral.", code: "DUPLICATE" });
    }

    /* ── Store referred_by on the new user ── */
    await client.query(
      `UPDATE users SET referred_by = $1 WHERE id = $2`,
      [inviter.id, referee_id]
    );

    /* ── Log signed_up event ── */
    await client.query(
      `INSERT INTO referral_events
         (referral_id, event_type, description, metadata)
       VALUES ($1, 'signed_up',
               'New user signed up using invite code',
               $2::JSONB)`,
      [
        referral.id,
        JSON.stringify({
          invite_code : code,
          inviter_id  : inviter.id,
          referee_id,
        }),
      ]
    );

    await client.query("COMMIT");

    writeAudit({
      actorId    : referee_id,
      action     : "referral_recorded",
      targetType : "user",
      targetId   : inviter.id,
      metadata   : { invite_code: code, referral_id: referral.id },
      ipAddress  : ip,
    }).catch(() => {});

    console.log(
      `[referrals] ✓ recorded  ` +
      `inviter=${inviter.id}  referee=${referee_id}  code=${code}`
    );

    return res.status(201).json({
      success     : true,
      message     : "Referral recorded.",
      referral_id : referral.id,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});

    /* Unique constraint — treat as duplicate */
    if (err.code === "23505") {
      return res.json({ success: false, message: "Duplicate referral.", code: "DUPLICATE" });
    }

    console.error("[referrals/record]", err.message, "\n", err.stack);
    return fail(res, 500, `Database error: ${err.message}`);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/referrals/verify
   Called from verification.js after email is verified.
   Marks referral verified + calls grant_referral_reward().
   Already handled inside grantReferralRewardOnVerify() in
   verification.js — this endpoint exists as a manual fallback
   or for admin use.
══════════════════════════════════════════════════════════════ */
router.post("/verify", authenticate, async (req, res) => {
  const { referee_id } = req.body;
  const ip = getIp(req);

  if (!referee_id) return fail(res, 400, "referee_id is required.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Find pending referral ── */
    const { rows: [referral] } = await client.query(
      `SELECT id, inviter_id
       FROM   referrals
       WHERE  referee_id = $1
         AND  status     = 'pending'
       LIMIT  1`,
      [referee_id]
    );

    if (!referral) {
      await client.query("ROLLBACK");
      return res.json({
        success : false,
        message : "No pending referral found.",
        code    : "NOT_FOUND",
      });
    }

    /* ── Mark verified ── */
    await client.query(
      `UPDATE referrals
       SET    status = 'verified', verified_at = NOW()
       WHERE  id = $1 AND status = 'pending'`,
      [referral.id]
    );

    /* ── Log event ── */
    await client.query(
      `INSERT INTO referral_events
         (referral_id, event_type, description)
       VALUES ($1, 'email_verified', 'Referee verified their email address')`,
      [referral.id]
    );

    /* ── Grant reward ── */
    const { rows: [result] } = await client.query(
      `SELECT grant_referral_reward($1) AS result`,
      [referral.id]
    );

    await client.query("COMMIT");

    const reward = result?.result;

    writeAudit({
      actorId    : referee_id,
      action     : "referral_verified",
      targetType : "user",
      targetId   : referral.inviter_id,
      metadata   : { referral_id: referral.id, reward },
      ipAddress  : ip,
    }).catch(() => {});

    console.log(
      `[referrals] ✓ verified  referral=${referral.id}  ` +
      `inviter=${referral.inviter_id}  reward=${JSON.stringify(reward)}`
    );

    return res.json({
      success : true,
      message : "Referral verified and reward granted.",
      reward  : reward ?? null,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[referrals/verify]", err.message, "\n", err.stack);
    return fail(res, 500, `Database error: ${err.message}`);
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/referrals/validate/:code
   Called from the registration form in real-time to preview
   who owns this invite code before the user submits.
   No authentication required.
══════════════════════════════════════════════════════════════ */
router.get("/validate/:code", validateLimiter, async (req, res) => {
  const code = (req.params.code ?? "").toUpperCase().trim();

  /* ── Format check ── */
  if (!code || !/^[A-Z0-9]{4,20}$/.test(code)) {
    return res.json({ valid: false, message: "Invalid code format." });
  }

  try {
    const { rows: [user] } = await pool.query(
      `SELECT
         id,
         COALESCE(
           NULLIF(TRIM(first_name || ' ' || COALESCE(last_name, '')), ''),
           NULLIF(TRIM(name), ''),
           username,
           'Loemart User'
         )                AS display_name,
         profile_image    AS avatar_url,
         referral_code
       FROM  users
       WHERE referral_code = $1
         AND status NOT IN ('banned', 'suspended', 'flagged')`,
      [code]
    );

    if (!user) {
      return res.json({ valid: false, message: "Invalid invite code." });
    }

    return res.json({
      valid        : true,
      display_name : user.display_name,
      avatar_url   : user.avatar_url   || null,
      referral_code: user.referral_code,
    });

  } catch (err) {
    console.error("[referrals/validate]", err.message, "\n", err.stack);
    return fail(res, 500, `Database error: ${err.message}`);
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/referrals/stats
   Lightweight stats-only endpoint.
   Used by SpinWheel to show bonus_spins_remaining.
══════════════════════════════════════════════════════════════ */
router.get("/stats", authenticate, dashboardLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows: [row] } = await pool.query(
      `SELECT
         u.referral_code,
         u.bonus_spins,
         u.total_referrals,
         COUNT(r.id)::INT                                           AS total_invites,
         COUNT(r.id) FILTER (WHERE r.status = 'rewarded')::INT     AS successful_signups,
         COUNT(r.id) FILTER (WHERE r.status = 'pending')::INT      AS pending_invites,
         COALESCE(
           SUM(r.reward_value) FILTER (WHERE r.status = 'rewarded'),
           0
         )::INT                                                     AS total_spins_earned
       FROM users u
       LEFT JOIN referrals r ON r.inviter_id = u.id
       WHERE u.id = $1
       GROUP BY u.id, u.referral_code, u.bonus_spins, u.total_referrals`,
      [userId]
    );

    if (!row) return fail(res, 404, "User not found.");

    return res.json({
      success : true,
      referral_code         : row.referral_code    ?? null,
      bonus_spins_remaining : row.bonus_spins       ?? 0,
      total_referrals       : row.total_referrals   ?? 0,
      total_invites         : row.total_invites      ?? 0,
      successful_signups    : row.successful_signups ?? 0,
      pending_invites       : row.pending_invites    ?? 0,
      total_spins_earned    : row.total_spins_earned ?? 0,
    });

  } catch (err) {
    console.error("[referrals/stats]", err.message, "\n", err.stack);
    return fail(res, 500, `Database error: ${err.message}`);
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/referrals/history
   Paginated referral activity list.
   Used by SpinWheel history tab.
══════════════════════════════════════════════════════════════ */
router.get("/history", authenticate, dashboardLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  const page  = Math.max(1, parseInt(req.query.page  ?? "1",  10));
  const limit = Math.min(50, parseInt(req.query.limit ?? "20", 10));
  const offset = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT
         r.id,
         r.status,
         r.reward_type,
         r.reward_value,
         r.reward_given_at,
         r.created_at    AS joined_at,
         r.verified_at,
         u.name          AS referee_name,
         u.first_name    AS referee_first_name,
         u.last_name     AS referee_last_name,
         u.username      AS referee_username,
         u.profile_image AS referee_avatar
       FROM  referrals r
       JOIN  users     u ON r.referee_id = u.id
       WHERE r.inviter_id = $1
       ORDER BY r.created_at DESC
       LIMIT  $2
       OFFSET $3`,
      [userId, limit, offset]
    );

    const { rows: [countRow] } = await pool.query(
      `SELECT COUNT(*)::INT AS total FROM referrals WHERE inviter_id = $1`,
      [userId]
    );

    return res.json({
      success  : true,
      page,
      limit,
      total    : countRow.total ?? 0,
      activity : rows.map(formatActivity),
    });

  } catch (err) {
    console.error("[referrals/history]", err.message, "\n", err.stack);
    return fail(res, 500, `Database error: ${err.message}`);
  }
});

export default router;