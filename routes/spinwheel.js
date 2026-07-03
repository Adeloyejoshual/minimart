// ════════════════════════════════════════════════════════════
// FILE: routes/spinwheel.js — v2 (Referral Bonus Spins)
// Base: /api/spinwheel
// ════════════════════════════════════════════════════════════

import express      from "express";
import rateLimit    from "express-rate-limit";
import { pool }     from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ══════════════════════════════════════════════════════════════
   WHEEL SEGMENTS
   Probabilities add up to 100 — NEVER exposed to frontend
══════════════════════════════════════════════════════════════ */
const WHEEL_SEGMENTS = [
  {
    id          : 1,
    label       : "Try Again",
    type        : "none",
    value       : 0,
    color       : "#6b7280",
    bg          : "#f3f4f6",
    emoji       : "😅",
    probability : 35,
    is_big_win  : false,
  },
  {
    id          : 2,
    label       : "₦100 Coupon",
    type        : "fixed",
    value       : 100,
    color       : "#e8630a",
    bg          : "#fff0e6",
    emoji       : "🎟️",
    probability : 25,
    is_big_win  : false,
  },
  {
    id          : 3,
    label       : "5% Discount",
    type        : "percentage",
    value       : 5,
    color       : "#6366f1",
    bg          : "#eef2ff",
    emoji       : "%",
    probability : 15,
    is_big_win  : false,
  },
  {
    id          : 4,
    label       : "₦500 Coupon",
    type        : "fixed",
    value       : 500,
    color       : "#16a34a",
    bg          : "#f0fdf4",
    emoji       : "💰",
    probability : 10,
    is_big_win  : false,
  },
  {
    id          : 5,
    label       : "₦100 Airtime",
    type        : "airtime",
    value       : 100,
    color       : "#0891b2",
    bg          : "#f0f9ff",
    emoji       : "📱",
    probability : 7,
    is_big_win  : false,
  },
  {
    id          : 6,
    label       : "Free Shipping",
    type        : "free_shipping",
    value       : 0,
    color       : "#d97706",
    bg          : "#fffbeb",
    emoji       : "🚚",
    probability : 5,
    is_big_win  : true,
  },
  {
    id          : 7,
    label       : "10% Discount",
    type        : "percentage",
    value       : 10,
    color       : "#dc2626",
    bg          : "#fef2f2",
    emoji       : "🔥",
    probability : 3,
    is_big_win  : true,
  },
];

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const MAX_FREE_DAILY     = 1;
const MAX_BONUS_STACKED  = 10;
const COUPON_EXPIRY_DAYS = 30;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const fail  = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  req.socket?.remoteAddress ??
  null;

/** Weighted random spin — server-side only */
function spinWheel() {
  const rand  = Math.random() * 100;
  let   cumul = 0;

  for (const seg of WHEEL_SEGMENTS) {
    cumul += seg.probability;
    if (rand < cumul) return seg;
  }

  return WHEEL_SEGMENTS[0]; // fallback: "Try Again"
}

/** Generate unique coupon code */
function generateCouponCode(prefix = "SPIN") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let   code  = `${prefix}-`;
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Calculate time until midnight */
function timeUntilMidnight() {
  const now  = new Date();
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  const ms   = next - now;
  const hrs  = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor(ms / 1_000);
  return {
    label   : `${hrs}h ${mins}m`,
    iso     : next.toISOString(),
    seconds : secs,
  };
}

/** Strip probabilities from segments (frontend-safe) */
function safeSegments() {
  return WHEEL_SEGMENTS.map((s) => ({
    id    : s.id,
    label : s.label,
    type  : s.type,
    value : s.value,
    color : s.color,
    bg    : s.bg,
    emoji : s.emoji,
  }));
}

/* ══════════════════════════════════════════════════════════════
   RATE LIMITERS
══════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60_000,
    max             : IS_PROD ? max : max * 20,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? req.ip),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const configLimiter  = makeLimiter({ windowMin: 1,  max: 30,  message: "Too many requests." });
const spinLimiter    = makeLimiter({ windowMin: 1,  max: 5,   message: "Slow down." });
const historyLimiter = makeLimiter({ windowMin: 1,  max: 20,  message: "Too many requests." });

/* ══════════════════════════════════════════════════════════════
   ENSURE TABLES
══════════════════════════════════════════════════════════════ */
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.spin_history (
      id          UUID      NOT NULL DEFAULT gen_random_uuid(),
      user_id     UUID      NOT NULL,
      segment_id  INT8      NOT NULL,
      label       STRING    NOT NULL,
      type        STRING    NOT NULL,
      value       DECIMAL   NOT NULL DEFAULT 0,
      is_win      BOOL      NOT NULL DEFAULT FALSE,
      spin_type   STRING    NOT NULL DEFAULT 'free',
      coupon_id   UUID      NULL,
      coupon_code STRING    NULL,
      spun_at     TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT  spin_history_pkey PRIMARY KEY (id ASC),
      INDEX       idx_spin_user    (user_id ASC),
      INDEX       idx_spin_spun_at (user_id, spun_at DESC)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.spin_config (
      id            UUID      NOT NULL DEFAULT gen_random_uuid(),
      user_id       UUID      NOT NULL,
      spins_today   INT8      NOT NULL DEFAULT 0,
      last_spin_at  TIMESTAMP NULL,
      total_spins   INT8      NOT NULL DEFAULT 0,
      total_wins    INT8      NOT NULL DEFAULT 0,
      streak        INT8      NOT NULL DEFAULT 0,
      last_streak_date DATE   NULL,
      CONSTRAINT    spin_config_pkey PRIMARY KEY (id ASC),
      UNIQUE INDEX  unique_spin_config_user (user_id ASC)
    )
  `);
}

ensureTables().catch((err) =>
  console.warn("[spinwheel] table init:", err.message)
);

/* ══════════════════════════════════════════════════════════════
   GET SPIN STATUS
   Reads spin_config + users.bonus_spins to determine:
   - can_spin (free spin available?)
   - bonus_spins_remaining
   - total available spins
══════════════════════════════════════════════════════════════ */
async function getSpinStatus(userId) {
  /* ── Get or upsert spin config ── */
  const { rows: [config] } = await pool.query(
    `INSERT INTO public.spin_config
       (user_id, spins_today, last_spin_at, total_spins, total_wins, streak, last_streak_date)
     VALUES ($1, 0, NULL, 0, 0, 0, NULL)
     ON CONFLICT (user_id) DO UPDATE
       SET spins_today = CASE
         WHEN DATE(spin_config.last_spin_at) < CURRENT_DATE THEN 0
         ELSE spin_config.spins_today
       END
     RETURNING *`,
    [userId]
  );

  /* ── Get bonus spins from users table ── */
  const { rows: [user] } = await pool.query(
    `SELECT bonus_spins, referral_code FROM users WHERE id = $1`,
    [userId]
  );

  const bonusSpins = Math.min(user?.bonus_spins ?? 0, MAX_BONUS_STACKED);
  const lastSpinAt = config.last_spin_at ? new Date(config.last_spin_at) : null;
  const today      = new Date();
  const isNewDay   = !lastSpinAt || lastSpinAt.toDateString() !== today.toDateString();
  const spinsToday = isNewDay ? 0 : Number(config.spins_today || 0);
  const canFreeSpin = spinsToday < MAX_FREE_DAILY;
  const canSpin     = canFreeSpin || bonusSpins > 0;

  const midnight = timeUntilMidnight();

  /* ── Streak calculation ── */
  let streak = Number(config.streak || 0);
  const lastStreakDate = config.last_streak_date
    ? new Date(config.last_streak_date).toDateString()
    : null;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (lastStreakDate === today.toDateString()) {
    // already counted today
  } else if (lastStreakDate === yesterday.toDateString()) {
    // streak continues (will update on spin)
  } else {
    // streak broken
    streak = 0;
  }

  return {
    config,
    bonusSpins,
    canFreeSpin,
    canSpin,
    spinsToday,
    streak,
    midnight,
    referralCode: user?.referral_code ?? null,

    /* Pre-built status object for API response */
    status: {
      can_spin                : canSpin,
      can_free_spin           : canFreeSpin,
      spins_today             : spinsToday,
      max_daily               : MAX_FREE_DAILY,
      total_spins             : Number(config.total_spins || 0),
      total_wins              : Number(config.total_wins  || 0),
      bonus_spins_remaining   : bonusSpins,
      streak                  : streak,
      next_spin_in            : canFreeSpin ? null : midnight.label,
      next_spin_at            : canFreeSpin ? null : midnight.iso,
      next_spin_seconds       : canFreeSpin ? null : midnight.seconds,
      latest_referral_name    : null, // filled below if needed
    },
  };
}

/* ══════════════════════════════════════════════════════════════
   GET /api/spinwheel/config
   Wheel segments + user's spin status
══════════════════════════════════════════════════════════════ */
router.get("/config", authenticate, configLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const { status } = await getSpinStatus(userId);

    /* ── Get latest referral name for bonus toast ── */
    try {
      const { rows: [latest] } = await pool.query(
        `SELECT
           COALESCE(
             NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
             u.name,
             u.username,
             'Someone'
           ) AS name
         FROM  referrals r
         JOIN  users     u ON r.referee_id = u.id
         WHERE r.inviter_id = $1
           AND r.status     = 'rewarded'
         ORDER BY r.reward_given_at DESC
         LIMIT 1`,
        [userId]
      );
      if (latest) status.latest_referral_name = latest.name;
    } catch (_) { /* non-critical */ }

    return res.json({
      success     : true,
      segments    : safeSegments(),
      spin_status : status,
    });

  } catch (err) {
    console.error("[spinwheel] GET /config:", err.message);
    return fail(res, 500, "Server error.");
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/spinwheel/spin
   Execute a spin.
   Body: { spin_type: "free" | "bonus" }
══════════════════════════════════════════════════════════════ */
router.post("/spin", authenticate, spinLimiter, async (req, res) => {
  const userId    = req.user?.id;
  const ip        = getIp(req);
  const spinType  = req.body?.spin_type || "free";

  if (!userId) return fail(res, 401, "Not authenticated.");

  if (!["free", "bonus"].includes(spinType)) {
    return fail(res, 400, "spin_type must be 'free' or 'bonus'.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── 1. Check status ── */
    const spinData = await getSpinStatus(userId);
    const { canFreeSpin, bonusSpins, streak } = spinData;

    /* ── 2. Determine which type to use ── */
    let actualType = spinType;

    if (actualType === "free" && !canFreeSpin) {
      // Tried free but already used → try bonus
      if (bonusSpins > 0) {
        actualType = "bonus";
      } else {
        await client.query("ROLLBACK");
        const midnight = timeUntilMidnight();
        return fail(res, 429,
          `No spins available. Come back in ${midnight.label}.`,
          { next_spin_at: midnight.iso }
        );
      }
    }

    if (actualType === "bonus" && bonusSpins <= 0) {
      // Tried bonus but none left → try free
      if (canFreeSpin) {
        actualType = "free";
      } else {
        await client.query("ROLLBACK");
        return fail(res, 429,
          "No bonus spins remaining. Invite friends to earn more!",
          { bonus_spins_remaining: 0 }
        );
      }
    }

    /* ── 3. Double-check in DB (prevents race conditions) ── */
    if (actualType === "free") {
      const { rows: [check] } = await client.query(
        `SELECT spins_today, last_spin_at
         FROM   spin_config
         WHERE  user_id = $1`,
        [userId]
      );
      const lastDate = check?.last_spin_at
        ? new Date(check.last_spin_at).toDateString()
        : null;
      const todayStr = new Date().toDateString();
      const dbSpins  = (lastDate === todayStr) ? Number(check.spins_today || 0) : 0;

      if (dbSpins >= MAX_FREE_DAILY) {
        await client.query("ROLLBACK");
        return fail(res, 429, "Free spin already used today.");
      }
    }

    if (actualType === "bonus") {
      const { rows: [check] } = await client.query(
        `SELECT bonus_spins FROM users WHERE id = $1`,
        [userId]
      );
      if (!check || check.bonus_spins <= 0) {
        await client.query("ROLLBACK");
        return fail(res, 429, "No bonus spins remaining.");
      }
    }

    /* ── 4. Execute spin ── */
    const result = spinWheel();
    const isWin  = result.type !== "none";

    /* ── 5. Create coupon if applicable ── */
    let couponId   = null;
    let couponCode = null;

    if (isWin && result.type !== "airtime") {
      couponCode   = generateCouponCode("SPIN");
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + COUPON_EXPIRY_DAYS);

      try {
        const { rows: [coupon] } = await client.query(
          `INSERT INTO public.coupons
             (code, type, value, min_purchase, max_discount,
              usage_limit, expires_at, description, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            couponCode,
            result.type,
            result.value,
            0,
            result.type === "percentage" && result.value >= 10 ? 5000 : null,
            1,
            expiry,
            `🎡 Spin & Win — ${result.label}`,
            userId,
          ]
        );
        couponId = coupon?.id ?? null;
      } catch (e) {
        console.warn("[spinwheel] coupon insert:", e.message);
        couponCode = null;
      }
    }

    /* ── 6. Record spin in history ── */
    await client.query(
      `INSERT INTO public.spin_history
         (user_id, segment_id, label, type, value,
          is_win, spin_type, coupon_id, coupon_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId, result.id, result.label,
        result.type, result.value,
        isWin, actualType,
        couponId, couponCode,
      ]
    );

    /* ── 7. Update spin_config ── */
    const today      = new Date();
    const todayDate  = today.toISOString().slice(0, 10);
    const yesterday  = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yestDate   = yesterday.toISOString().slice(0, 10);

    await client.query(
      `INSERT INTO public.spin_config
         (user_id, spins_today, last_spin_at, total_spins, total_wins,
          streak, last_streak_date)
       VALUES ($1, $2, NOW(), 1, $3, 1, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET spins_today = CASE
               WHEN DATE(spin_config.last_spin_at) < CURRENT_DATE
                 THEN $2
               ELSE spin_config.spins_today + $2
             END,
             last_spin_at     = NOW(),
             total_spins      = spin_config.total_spins + 1,
             total_wins       = spin_config.total_wins + $3,
             streak           = CASE
               WHEN spin_config.last_streak_date = $5
                 THEN spin_config.streak
               WHEN spin_config.last_streak_date = $6
                 THEN spin_config.streak + 1
               ELSE 1
             END,
             last_streak_date = $4`,
      [
        userId,
        actualType === "free" ? 1 : 0,   // only count free spins toward daily limit
        isWin ? 1 : 0,
        todayDate,                        // last_streak_date
        todayDate,                        // for "already today" check
        yestDate,                         // for "yesterday" check (streak continues)
      ]
    );

    /* ── 8. Deduct bonus spin if used ── */
    if (actualType === "bonus") {
      await client.query(
        `UPDATE users
         SET    bonus_spins = GREATEST(bonus_spins - 1, 0)
         WHERE  id = $1`,
        [userId]
      );
    }

    await client.query("COMMIT");

    /* ── 9. Get remaining bonus spins ── */
    const { rows: [afterUser] } = await pool.query(
      `SELECT bonus_spins FROM users WHERE id = $1`,
      [userId]
    );

    const spinsRemaining = afterUser?.bonus_spins ?? 0;

    /* ── 10. Audit ── */
    writeAudit({
      actorId    : userId,
      action     : "spinwheel_spin",
      targetType : "user",
      targetId   : userId,
      metadata   : {
        spin_type    : actualType,
        segment_id   : result.id,
        label        : result.label,
        is_win       : isWin,
        coupon_code  : couponCode,
        is_big_win   : result.is_big_win,
      },
      ipAddress  : ip,
    }).catch(() => {});

    /* ── 11. Response ── */
    return res.json({
      success    : true,
      segment_id : result.id,
      result     : {
        id              : result.id,
        label           : result.label,
        type            : result.type,
        value           : result.value,
        emoji           : result.emoji,
        color           : result.color,
        is_win          : isWin,
        is_big_win      : result.is_big_win,
        spin_type       : actualType,
        coupon_code     : couponCode,
        coupon_id       : couponId,
        spins_remaining : spinsRemaining,
        message         : isWin
          ? result.type === "airtime"
            ? `🎉 You won ₦${result.value} airtime! We'll credit it shortly.`
            : couponCode
              ? `🎉 You won ${result.label}! Use code ${couponCode} at checkout.`
              : `🎉 You won ${result.label}!`
          : "😅 Better luck next time! Come back tomorrow for another spin.",
        expires_in      : isWin && couponCode ? `${COUPON_EXPIRY_DAYS} days` : null,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[spinwheel] POST /spin:", err.message, "\n", err.stack);
    return fail(res, 500, "Server error.");
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/spinwheel/history
   User's spin history + stats
══════════════════════════════════════════════════════════════ */
router.get("/history", authenticate, historyLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  const page   = Math.max(1, parseInt(req.query.page   ?? "1",  10));
  const limit  = Math.min(50, parseInt(req.query.limit  ?? "20", 10));
  const offset = (page - 1) * limit;

  try {
    /* ── History ── */
    const { rows } = await pool.query(
      `SELECT
         id, segment_id, label, type, value,
         is_win, spin_type,
         coupon_code, spun_at
       FROM  public.spin_history
       WHERE user_id = $1
       ORDER BY spun_at DESC
       LIMIT  $2
       OFFSET $3`,
      [userId, limit, offset]
    );

    /* ── Total count ── */
    const { rows: [countRow] } = await pool.query(
      `SELECT COUNT(*)::INT AS total FROM public.spin_history WHERE user_id = $1`,
      [userId]
    );

    /* ── Stats from spin_config ── */
    const { rows: [config] } = await pool.query(
      `SELECT total_spins, total_wins, streak
       FROM   public.spin_config
       WHERE  user_id = $1`,
      [userId]
    );

    /* ── Bonus spins used count ── */
    const { rows: [bonusCount] } = await pool.query(
      `SELECT COUNT(*)::INT AS cnt
       FROM   public.spin_history
       WHERE  user_id   = $1
         AND  spin_type = 'bonus'`,
      [userId]
    );

    const totalSpins = Number(config?.total_spins || 0);
    const totalWins  = Number(config?.total_wins  || 0);

    return res.json({
      success : true,
      page,
      limit,
      total   : countRow?.total ?? 0,
      history : rows.map((r) => ({
        id          : r.id,
        segment_id  : r.segment_id,
        label       : r.label,
        type        : r.type,
        value       : Number(r.value || 0),
        is_win      : r.is_win ?? r.type !== "none",
        spin_type   : r.spin_type || "free",
        coupon_code : r.coupon_code,
        spun_at     : r.spun_at,
      })),
      stats : {
        total_spins      : totalSpins,
        total_wins       : totalWins,
        win_rate         : totalSpins > 0
          ? Math.round((totalWins / totalSpins) * 100)
          : 0,
        bonus_spins_used : bonusCount?.cnt ?? 0,
        streak           : Number(config?.streak || 0),
      },
    });

  } catch (err) {
    console.error("[spinwheel] GET /history:", err.message);
    return fail(res, 500, "Server error.");
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/spinwheel/referral-spins
   Shows which referrals earned the user bonus spins
══════════════════════════════════════════════════════════════ */
router.get("/referral-spins", authenticate, historyLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows } = await pool.query(
      `SELECT
         r.id,
         r.reward_value  AS spins_awarded,
         r.reward_given_at AS created_at,
         r.status,
         COALESCE(
           NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
           u.name,
           u.username,
           'Unknown'
         )                         AS referred_name,
         u.profile_image           AS avatar_url
       FROM  referrals r
       JOIN  users     u ON r.referee_id = u.id
       WHERE r.inviter_id = $1
         AND r.status     = 'rewarded'
       ORDER BY r.reward_given_at DESC
       LIMIT 50`,
      [userId]
    );

    /* Add initials + color for avatar */
    const COLORS = [
      "#2563eb","#10b981","#f59e0b","#8b5cf6",
      "#ef4444","#0891b2","#e8630a","#059669",
    ];

    const referralSpins = rows.map((r) => {
      const name     = r.referred_name || "?";
      const initials = name.split(" ").slice(0, 2)
                           .map((w) => w[0]?.toUpperCase() || "")
                           .join("");
      const color    = COLORS[
        [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length
      ];

      return {
        id             : r.id,
        referred_name  : name,
        initials,
        color,
        avatar_url     : r.avatar_url || null,
        spins_awarded  : Number(r.spins_awarded || 0),
        created_at     : r.created_at,
        status         : r.status,
      };
    });

    return res.json({
      success        : true,
      referral_spins : referralSpins,
    });

  } catch (err) {
    console.error("[spinwheel] GET /referral-spins:", err.message);
    return fail(res, 500, "Server error.");
  }
});

export default router;