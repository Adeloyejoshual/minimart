// ════════════════════════════════════════════════════════════
// FILE: routes/spinwheel.js
// Base: /api/spinwheel
//
// Schema facts (from your exported CockroachDB table):
//   referrals.inviter_id  UUID NOT NULL
//   referrals.invitee_id  UUID NOT NULL  ← legacy NOT NULL col
//   referrals.referee_id  UUID NULL      ← new col
//   Every JOIN uses COALESCE(r.referee_id, r.invitee_id)
// ════════════════════════════════════════════════════════════

import express      from "express";
import rateLimit    from "express-rate-limit";
import { pool }     from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ════════════════════════════════════════════════════════════
   WHEEL SEGMENTS
════════════════════════════════════════════════════════════ */
const WHEEL_SEGMENTS = [
  { id: 1, label: "Try Again",     type: "none",          value: 0,   color: "#6b7280", bg: "#f3f4f6", emoji: "😅",  probability: 35, is_big_win: false },
  { id: 2, label: "₦100 Coupon",   type: "fixed",         value: 100, color: "#e8630a", bg: "#fff0e6", emoji: "🎟️", probability: 25, is_big_win: false },
  { id: 3, label: "5% Discount",   type: "percentage",    value: 5,   color: "#6366f1", bg: "#eef2ff", emoji: "%",   probability: 15, is_big_win: false },
  { id: 4, label: "₦500 Coupon",   type: "fixed",         value: 500, color: "#16a34a", bg: "#f0fdf4", emoji: "💰",  probability: 10, is_big_win: false },
  { id: 5, label: "₦100 Airtime",  type: "airtime",       value: 100, color: "#0891b2", bg: "#f0f9ff", emoji: "📱",  probability: 7,  is_big_win: false },
  { id: 6, label: "Free Shipping", type: "free_shipping", value: 0,   color: "#d97706", bg: "#fffbeb", emoji: "🚚",  probability: 5,  is_big_win: true  },
  { id: 7, label: "10% Discount",  type: "percentage",    value: 10,  color: "#dc2626", bg: "#fef2f2", emoji: "🔥",  probability: 3,  is_big_win: true  },
];

/* ════════════════════════════════════════════════════════════
   EARN TASKS DEFINITION
   Single source of truth — mirrors frontend EARN_TASKS.
   spins_reward MUST match the frontend config exactly.
════════════════════════════════════════════════════════════ */
const EARN_TASKS_DEF = [
  {
    id          : "follow_instagram",
    label       : "Follow on Instagram",
    platform    : "Instagram",
    type        : "follow",
    category    : "social",
    spins_reward: 3,
    verify_type : "honor",
  },
  {
    id          : "follow_tiktok",
    label       : "Follow on TikTok",
    platform    : "TikTok",
    type        : "follow",
    category    : "social",
    spins_reward: 3,
    verify_type : "honor",
  },
  {
    id          : "follow_facebook",
    label       : "Follow on Facebook",
    platform    : "Facebook",
    type        : "follow",
    category    : "social",
    spins_reward: 5,
    verify_type : "honor",
  },
  {
    id          : "join_telegram",
    label       : "Join Telegram Channel",
    platform    : "Telegram",
    type        : "join",
    category    : "community",
    spins_reward: 3,
    verify_type : "honor",
  },
  {
    id          : "join_whatsapp",
    label       : "Follow WhatsApp Channel",
    platform    : "WhatsApp Channel",
    type        : "join",
    category    : "community",
    spins_reward: 3,
    verify_type : "honor",
  },
];

/* Fast lookup map */
const TASK_MAP = Object.fromEntries(
  EARN_TASKS_DEF.map((t) => [t.id, t])
);

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const MAX_FREE_DAILY     = 1;
const MAX_BONUS_STACKED  = 10;
const COUPON_EXPIRY_DAYS = 30;

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const fail = (res, status, message, extra = {}) => {
  console.error(`[spinwheel] ✗ ${status} — ${message}`);
  return res.status(status).json({ success: false, message, ...extra });
};

const failErr = (res, status, userMsg, err, extra = {}) => {
  const detail = err?.message || String(err);
  const stack  = err?.stack   || "";
  console.error(`[spinwheel] ✗ ERROR — ${userMsg}`);
  console.error(`            → ${detail}`);
  if (stack) console.error(stack);
  return res.status(status).json({
    success : false,
    message : IS_PROD ? userMsg : `${userMsg}: ${detail}`,
    ...(IS_PROD ? {} : {
      error : detail,
      stack : stack.split("\n").slice(0, 6),
    }),
    ...extra,
  });
};

const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  req.socket?.remoteAddress ??
  null;

function spinWheel() {
  const rand  = Math.random() * 100;
  let   cumul = 0;
  for (const seg of WHEEL_SEGMENTS) {
    cumul += seg.probability;
    if (rand < cumul) return seg;
  }
  return WHEEL_SEGMENTS[0];
}

function generateCouponCode(prefix = "SPIN") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let   code  = `${prefix}-`;
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function timeUntilMidnight() {
  const now  = new Date();
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  const ms = next - now;
  return {
    label   : `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`,
    iso     : next.toISOString(),
    seconds : Math.floor(ms / 1_000),
  };
}

function safeSegments() {
  return WHEEL_SEGMENTS.map(({ id, label, type, value, color, bg, emoji }) => ({
    id, label, type, value, color, bg, emoji,
  }));
}

/* ════════════════════════════════════════════════════════════
   RATE LIMITERS
════════════════════════════════════════════════════════════ */
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

const configLimiter  = makeLimiter({ windowMin: 1, max: 30, message: "Too many requests."  });
const spinLimiter    = makeLimiter({ windowMin: 1, max: 5,  message: "Slow down."           });
const historyLimiter = makeLimiter({ windowMin: 1, max: 20, message: "Too many requests."  });
const taskLimiter    = makeLimiter({ windowMin: 1, max: 20, message: "Too many requests."  });
const claimLimiter   = makeLimiter({ windowMin: 5, max: 10, message: "Too many claim attempts. Please wait." });

/* ════════════════════════════════════════════════════════════
   ENSURE TABLES
════════════════════════════════════════════════════════════ */
async function ensureTables() {
  console.log("[spinwheel] ensuring tables…");

  /* ── spin_history ── */
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
      INDEX       idx_spin_spun_at (user_id ASC, spun_at DESC)
    )
  `);
  console.log("[spinwheel] ✓ spin_history ready");

  /* ── spin_config ── */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.spin_config (
      id               UUID      NOT NULL DEFAULT gen_random_uuid(),
      user_id          UUID      NOT NULL,
      spins_today      INT8      NOT NULL DEFAULT 0,
      last_spin_at     TIMESTAMP NULL,
      total_spins      INT8      NOT NULL DEFAULT 0,
      total_wins       INT8      NOT NULL DEFAULT 0,
      streak           INT8      NOT NULL DEFAULT 0,
      last_streak_date DATE      NULL,
      CONSTRAINT  spin_config_pkey  PRIMARY KEY (id ASC),
      UNIQUE INDEX unique_spin_config_user (user_id ASC)
    )
  `);
  console.log("[spinwheel] ✓ spin_config ready");

  /* ── spin_task_completions ── */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.spin_task_completions (
      id            UUID      NOT NULL DEFAULT gen_random_uuid(),
      user_id       UUID      NOT NULL,
      task_id       STRING    NOT NULL,
      platform      STRING    NOT NULL,
      spins_awarded INT8      NOT NULL DEFAULT 0,
      ip_address    STRING    NULL,
      completed_at  TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT    stc_pkey PRIMARY KEY (id ASC),
      UNIQUE INDEX  unique_task_per_user (user_id ASC, task_id ASC),
      INDEX         idx_stc_user (user_id ASC)
    )
  `);
  console.log("[spinwheel] ✓ spin_task_completions ready");

  /* ── Safe column migrations ── */
  const migrations = [
    `ALTER TABLE public.spin_history ADD COLUMN IF NOT EXISTS is_win    BOOL   NOT NULL DEFAULT FALSE`,
    `ALTER TABLE public.spin_history ADD COLUMN IF NOT EXISTS spin_type STRING NOT NULL DEFAULT 'free'`,
    `ALTER TABLE public.spin_config  ADD COLUMN IF NOT EXISTS total_wins       INT8 NOT NULL DEFAULT 0`,
    `ALTER TABLE public.spin_config  ADD COLUMN IF NOT EXISTS streak           INT8 NOT NULL DEFAULT 0`,
    `ALTER TABLE public.spin_config  ADD COLUMN IF NOT EXISTS last_streak_date DATE NULL`,
    `ALTER TABLE public.users        ADD COLUMN IF NOT EXISTS bonus_spins      INT8 NOT NULL DEFAULT 0`,
    `ALTER TABLE public.users        ADD COLUMN IF NOT EXISTS total_referrals  INT8 NOT NULL DEFAULT 0`,
    `ALTER TABLE public.users        ADD COLUMN IF NOT EXISTS referred_by      UUID NULL`,
  ];

  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (e) {
      if (!e.message.includes("already exists")) {
        console.warn("[spinwheel] migration warning:", e.message);
      }
    }
  }

  console.log("[spinwheel] ✓ migrations applied");
}

ensureTables().catch((err) =>
  console.error(
    "[spinwheel] ✗ table init FAILED:",
    err.message, "\n", err.stack
  )
);

/* ════════════════════════════════════════════════════════════
   GET SPIN STATUS  (shared by /config and /spin)
════════════════════════════════════════════════════════════ */
async function getSpinStatus(userId) {
  console.log(`[spinwheel] getSpinStatus → user=${userId}`);

  /* Upsert spin_config and reset spins_today if it's a new day */
  const { rows: [config] } = await pool.query(
    `INSERT INTO public.spin_config
       (user_id, spins_today, last_spin_at, total_spins,
        total_wins, streak, last_streak_date)
     VALUES ($1, 0, NULL, 0, 0, 0, NULL)
     ON CONFLICT (user_id) DO UPDATE
       SET spins_today = CASE
         WHEN spin_config.last_spin_at IS NULL
              THEN 0
         WHEN DATE(spin_config.last_spin_at) < CURRENT_DATE
              THEN 0
         ELSE spin_config.spins_today
       END
     RETURNING *`,
    [userId]
  );

  const { rows: [user] } = await pool.query(
    `SELECT bonus_spins, referral_code FROM users WHERE id = $1`,
    [userId]
  );

  if (!user) throw new Error(`User not found in DB: ${userId}`);

  const bonusSpins = Math.min(
    Number(user.bonus_spins ?? 0),
    MAX_BONUS_STACKED
  );
  const lastSpinAt = config.last_spin_at
    ? new Date(config.last_spin_at)
    : null;
  const today     = new Date();
  const isNewDay  = !lastSpinAt ||
    lastSpinAt.toDateString() !== today.toDateString();
  const spinsToday  = isNewDay ? 0 : Number(config.spins_today || 0);
  const canFreeSpin = spinsToday < MAX_FREE_DAILY;
  const canSpin     = canFreeSpin || bonusSpins > 0;
  const midnight    = timeUntilMidnight();

  /* Streak calculation */
  let streak = Number(config.streak || 0);
  const lastStreakDate = config.last_streak_date
    ? new Date(config.last_streak_date).toDateString()
    : null;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (lastStreakDate === today.toDateString()) {
    /* Already counted today */
  } else if (lastStreakDate !== yesterday.toDateString()) {
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
    referralCode : user.referral_code ?? null,
    status: {
      can_spin              : canSpin,
      can_free_spin         : canFreeSpin,
      spins_today           : spinsToday,
      max_daily             : MAX_FREE_DAILY,
      total_spins           : Number(config.total_spins || 0),
      total_wins            : Number(config.total_wins  || 0),
      bonus_spins_remaining : bonusSpins,
      streak,
      next_spin_in          : canFreeSpin ? null : midnight.label,
      next_spin_at          : canFreeSpin ? null : midnight.iso,
      next_spin_seconds     : canFreeSpin ? null : midnight.seconds,
      latest_referral_name  : null,
    },
  };
}

/* ════════════════════════════════════════════════════════════
   GET /api/spinwheel/config
════════════════════════════════════════════════════════════ */
router.get("/config", authenticate, configLimiter, async (req, res) => {
  const userId = req.user?.id;
  console.log(`[spinwheel] GET /config → user=${userId}`);
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const { status } = await getSpinStatus(userId);

    /* Latest referral name — non-critical, uses COALESCE for schema compat */
    try {
      const { rows: [latest] } = await pool.query(
        `SELECT
           COALESCE(
             NULLIF(
               TRIM(
                 COALESCE(u.first_name, '') || ' ' ||
                 COALESCE(u.last_name,  '')
               ), ''
             ),
             u.name,
             u.username,
             'Someone'
           ) AS name
         FROM  referrals r
         JOIN  users     u
               ON u.id = COALESCE(r.referee_id, r.invitee_id)
         WHERE r.inviter_id = $1
           AND r.status     = 'rewarded'
         ORDER BY r.reward_given_at DESC
         LIMIT 1`,
        [userId]
      );
      if (latest?.name) status.latest_referral_name = latest.name;
    } catch (refErr) {
      /* Non-fatal */
      console.warn(
        "[spinwheel] referral name fetch (non-fatal):", refErr.message
      );
    }

    return res.json({
      success     : true,
      segments    : safeSegments(),
      spin_status : status,
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load spin config", err);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/spinwheel/spin
════════════════════════════════════════════════════════════ */
router.post("/spin", authenticate, spinLimiter, async (req, res) => {
  const userId   = req.user?.id;
  const ip       = getIp(req);
  const spinType = req.body?.spin_type || "free";

  console.log(
    `\n[spinwheel] POST /spin → user=${userId} spin_type=${spinType}`
  );

  if (!userId) return fail(res, 401, "Not authenticated.");
  if (!["free", "bonus"].includes(spinType))
    return fail(res, 400, "spin_type must be 'free' or 'bonus'.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Step 1: Spin status ── */
    let spinData;
    try {
      spinData = await getSpinStatus(userId);
    } catch (statusErr) {
      await client.query("ROLLBACK");
      return failErr(res, 500, "Failed to read spin status", statusErr);
    }

    const { canFreeSpin, bonusSpins } = spinData;

    /* ── Step 2: Resolve actual spin type ── */
    let actualType = spinType;

    if (actualType === "free" && !canFreeSpin) {
      if (bonusSpins > 0) {
        actualType = "bonus";
      } else {
        await client.query("ROLLBACK");
        const midnight = timeUntilMidnight();
        return fail(
          res, 429,
          `No spins available. Come back in ${midnight.label}.`,
          { next_spin_at: midnight.iso }
        );
      }
    }

    if (actualType === "bonus" && bonusSpins <= 0) {
      if (canFreeSpin) {
        actualType = "free";
      } else {
        await client.query("ROLLBACK");
        return fail(res, 429, "No spins available.");
      }
    }

    /* ── Step 3: DB race-condition guard ── */
    try {
      if (actualType === "free") {
        const { rows: [check] } = await client.query(
          `SELECT spins_today, last_spin_at
           FROM   public.spin_config
           WHERE  user_id = $1`,
          [userId]
        );
        const lastDate = check?.last_spin_at
          ? new Date(check.last_spin_at).toDateString()
          : null;
        const dbSpins = lastDate === new Date().toDateString()
          ? Number(check?.spins_today || 0)
          : 0;
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
        if (!check || Number(check.bonus_spins) <= 0) {
          await client.query("ROLLBACK");
          return fail(res, 429, "No bonus spins remaining.");
        }
      }
    } catch (checkErr) {
      await client.query("ROLLBACK");
      return failErr(res, 500, "DB double-check failed", checkErr);
    }

    /* ── Step 4: Spin the wheel ── */
    const result = spinWheel();
    const isWin  = result.type !== "none";

    /* ── Step 5: Create coupon if won ── */
    let couponId   = null;
    let couponCode = null;

    if (isWin && result.type !== "airtime") {
      couponCode = generateCouponCode("SPIN");
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
      } catch (couponErr) {
        console.warn(
          "[spinwheel] coupon insert failed (non-fatal):", couponErr.message
        );
        couponId   = null;
        couponCode = null;
      }
    }

    /* ── Step 6: Record spin_history ── */
    try {
      await client.query(
        `INSERT INTO public.spin_history
           (user_id, segment_id, label, type, value,
            is_win, spin_type, coupon_id, coupon_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId, result.id, result.label, result.type, result.value,
          isWin, actualType, couponId, couponCode,
        ]
      );
    } catch (histErr) {
      await client.query("ROLLBACK");
      return failErr(res, 500, "Failed to record spin history", histErr);
    }

    /* ── Step 7: Update spin_config ── */
    const today     = new Date();
    const todayDate = today.toISOString().slice(0, 10);
    const yest      = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const yestDate  = yest.toISOString().slice(0, 10);

    try {
      await client.query(
        `INSERT INTO public.spin_config
           (user_id, spins_today, last_spin_at, total_spins, total_wins,
            streak, last_streak_date)
         VALUES ($1, $2, NOW(), 1, $3, 1, $4)
         ON CONFLICT (user_id) DO UPDATE
           SET spins_today = CASE
                 WHEN spin_config.last_spin_at IS NULL
                      THEN $2
                 WHEN DATE(spin_config.last_spin_at) < CURRENT_DATE
                      THEN $2
                 ELSE spin_config.spins_today + $2
               END,
               last_spin_at     = NOW(),
               total_spins      = spin_config.total_spins + 1,
               total_wins       = spin_config.total_wins  + $3,
               streak           = CASE
                 WHEN spin_config.last_streak_date = $4 THEN spin_config.streak
                 WHEN spin_config.last_streak_date = $5 THEN spin_config.streak + 1
                 ELSE 1
               END,
               last_streak_date = $4`,
        [
          userId,
          actualType === "free" ? 1 : 0,
          isWin ? 1 : 0,
          todayDate,
          yestDate,
        ]
      );
    } catch (configErr) {
      await client.query("ROLLBACK");
      return failErr(res, 500, "Failed to update spin config", configErr);
    }

    /* ── Step 8: Deduct bonus spin ── */
    if (actualType === "bonus") {
      try {
        await client.query(
          `UPDATE users
           SET    bonus_spins = GREATEST(0, bonus_spins - 1),
                  updated_at  = NOW()
           WHERE  id = $1`,
          [userId]
        );
      } catch (deductErr) {
        await client.query("ROLLBACK");
        return failErr(res, 500, "Failed to deduct bonus spin", deductErr);
      }
    }

    await client.query("COMMIT");
    console.log(`[spinwheel] ✓ spin committed — ${result.label}`);

    /* ── Remaining spins (after commit) ── */
    let spinsRemaining = 0;
    try {
      const { rows: [afterUser] } = await pool.query(
        `SELECT bonus_spins FROM users WHERE id = $1`,
        [userId]
      );
      spinsRemaining = Number(afterUser?.bonus_spins ?? 0);
    } catch (_) { /* non-fatal */ }

    /* ── Audit ── */
    writeAudit({
      actorId    : userId,
      action     : "spinwheel_spin",
      targetType : "user",
      targetId   : userId,
      metadata   : {
        spin_type   : actualType,
        segment_id  : result.id,
        label       : result.label,
        is_win      : isWin,
        coupon_code : couponCode,
        is_big_win  : result.is_big_win,
      },
      ipAddress  : ip,
    }).catch((e) =>
      console.warn("[spinwheel] audit failed:", e.message)
    );

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
        is_big_win      : result.is_big_win ?? false,
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
        expires_in : isWin && couponCode ? `${COUPON_EXPIRY_DAYS} days` : null,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return failErr(res, 500, "Spin failed", err);
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/spinwheel/history
════════════════════════════════════════════════════════════ */
router.get("/history", authenticate, historyLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  const page   = Math.max(1,  parseInt(req.query.page  ?? "1",  10));
  const limit  = Math.min(50, parseInt(req.query.limit ?? "20", 10));
  const offset = (page - 1) * limit;

  try {
    const [histRes, countRes, configRes, bonusRes] = await Promise.all([
      pool.query(
        `SELECT id, segment_id, label, type, value,
                is_win, spin_type, coupon_code, spun_at
         FROM   public.spin_history
         WHERE  user_id = $1
         ORDER  BY spun_at DESC
         LIMIT  $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::INT AS total
         FROM   public.spin_history
         WHERE  user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT total_spins, total_wins, streak
         FROM   public.spin_config
         WHERE  user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::INT AS cnt
         FROM   public.spin_history
         WHERE  user_id  = $1
           AND  spin_type = 'bonus'`,
        [userId]
      ),
    ]);

    const config     = configRes.rows[0];
    const totalSpins = Number(config?.total_spins || 0);
    const totalWins  = Number(config?.total_wins  || 0);

    return res.json({
      success : true,
      page,
      limit,
      total   : countRes.rows[0]?.total ?? 0,
      history : histRes.rows.map((r) => ({
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
        bonus_spins_used : bonusRes.rows[0]?.cnt ?? 0,
        streak           : Number(config?.streak || 0),
      },
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load spin history", err);
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/spinwheel/referral-spins

   ✅ JOIN uses COALESCE(r.referee_id, r.invitee_id)
      so rows inserted before the migration are still visible.
════════════════════════════════════════════════════════════ */
router.get("/referral-spins", authenticate, historyLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows } = await pool.query(
      `SELECT
         r.id,
         r.reward_value    AS spins_awarded,
         r.reward_given_at AS created_at,
         r.status,
         COALESCE(
           NULLIF(
             TRIM(
               COALESCE(u.first_name, '') || ' ' ||
               COALESCE(u.last_name,  '')
             ), ''
           ),
           u.name,
           u.username,
           'Unknown'
         )               AS referred_name,
         u.profile_image AS avatar_url
       FROM  referrals r
       JOIN  users      u
             ON u.id = COALESCE(r.referee_id, r.invitee_id)
       WHERE r.inviter_id = $1
         AND r.status     = 'rewarded'
       ORDER BY r.reward_given_at DESC
       LIMIT 50`,
      [userId]
    );

    const COLORS = [
      "#2563eb","#10b981","#f59e0b","#8b5cf6",
      "#ef4444","#0891b2","#e8630a","#059669",
    ];

    const referralSpins = rows.map((r) => {
      const name     = r.referred_name || "?";
      const initials = name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || "")
        .join("");
      const color = COLORS[
        [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length
      ];
      return {
        id            : r.id,
        referred_name : name,
        initials,
        color,
        avatar_url    : r.avatar_url || null,
        spins_awarded : Number(r.spins_awarded || 0),
        created_at    : r.created_at,
        status        : r.status,
      };
    });

    return res.json({
      success        : true,
      referral_spins : referralSpins,
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load referral spins", err);
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/spinwheel/tasks
   Returns which tasks this user has already completed
   + aggregate stats for the earn tab header.
════════════════════════════════════════════════════════════ */
router.get("/tasks", authenticate, taskLimiter, async (req, res) => {
  const userId = req.user?.id;
  console.log(`[spinwheel] GET /tasks → user=${userId}`);
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows: completedRows } = await pool.query(
      `SELECT task_id, spins_awarded, completed_at
       FROM   public.spin_task_completions
       WHERE  user_id = $1
       ORDER  BY completed_at ASC`,
      [userId]
    );

    const completedTaskIds = completedRows.map((r) => r.task_id);
    const totalEarned = completedRows.reduce(
      (sum, r) => sum + Number(r.spins_awarded || 0), 0
    );
    const completedDetail = completedRows.map((r) => ({
      task_id       : r.task_id,
      spins_awarded : Number(r.spins_awarded),
      completed_at  : r.completed_at,
    }));

    console.log(
      `[spinwheel] ✓ GET /tasks — ${completedTaskIds.length} completed,` +
      ` ${totalEarned} total spins earned`
    );

    return res.json({
      success            : true,
      completed_task_ids : completedTaskIds,
      completed_detail   : completedDetail,
      stats : {
        total_tasks     : EARN_TASKS_DEF.length,
        completed_count : completedTaskIds.length,
        pending_count   : EARN_TASKS_DEF.length - completedTaskIds.length,
        total_earned    : totalEarned,
        max_possible    : EARN_TASKS_DEF.reduce(
          (s, t) => s + t.spins_reward, 0
        ),
      },
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load task completions", err);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/spinwheel/earn-task
   Called when user clicks "Verify & Claim".

   Flow:
   1. Validate task_id exists in EARN_TASKS_DEF
   2. Check not already completed
   3. Insert completion record
   4. Credit bonus_spins (capped at MAX_BONUS_STACKED)
   5. Return new spin totals
════════════════════════════════════════════════════════════ */
router.post("/earn-task", authenticate, claimLimiter, async (req, res) => {
  const userId = req.user?.id;
  const ip     = getIp(req);
  const taskId = req.body?.task_id;

  console.log(
    `\n[spinwheel] POST /earn-task → user=${userId} task=${taskId}`
  );

  if (!userId) return fail(res, 401, "Not authenticated.");
  if (!taskId) return fail(res, 400, "task_id is required.");

  /* ── Validate task exists ── */
  const taskDef = TASK_MAP[taskId];
  if (!taskDef) {
    return fail(
      res, 404,
      `Unknown task: ${taskId}. ` +
      `Valid tasks: ${Object.keys(TASK_MAP).join(", ")}`
    );
  }

  console.log(
    `[spinwheel] task found: "${taskDef.label}" → +${taskDef.spins_reward} spins`
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Step 1: Already completed? ── */
    const { rows: [existing] } = await client.query(
      `SELECT id, completed_at
       FROM   public.spin_task_completions
       WHERE  user_id = $1
         AND  task_id = $2
       LIMIT  1`,
      [userId, taskId]
    );

    if (existing) {
      await client.query("ROLLBACK");
      console.log(
        `[spinwheel] task already done at ${existing.completed_at}`
      );
      return fail(
        res, 409,
        `You've already claimed the reward for "${taskDef.label}".`,
        { completed_at: existing.completed_at }
      );
    }

    /* ── Step 2: Insert completion ── */
    try {
      await client.query(
        `INSERT INTO public.spin_task_completions
           (user_id, task_id, platform, spins_awarded, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, taskId, taskDef.platform, taskDef.spins_reward, ip]
      );
      console.log(`[spinwheel] ✓ task completion inserted`);
    } catch (insertErr) {
      await client.query("ROLLBACK");

      /* Race condition / double-submit */
      const isDup =
        insertErr.message?.toLowerCase().includes("unique") ||
        insertErr.code === "23505"                          ||
        insertErr.message?.toLowerCase().includes("duplicate");

      if (isDup) {
        return fail(
          res, 409,
          `You've already claimed the reward for "${taskDef.label}".`
        );
      }
      return failErr(res, 500, "Failed to record task completion", insertErr);
    }

    /* ── Step 3: Credit bonus spins ── */
    let newBonusSpins = 0;
    try {
      const { rows: [updated] } = await client.query(
        `UPDATE users
         SET    bonus_spins = LEAST(bonus_spins + $1, $2),
                updated_at  = NOW()
         WHERE  id = $3
         RETURNING bonus_spins`,
        [taskDef.spins_reward, MAX_BONUS_STACKED, userId]
      );
      newBonusSpins = Number(updated?.bonus_spins ?? 0);
      console.log(
        `[spinwheel] ✓ bonus spins updated → user now has ${newBonusSpins}`
      );
    } catch (creditErr) {
      await client.query("ROLLBACK");
      return failErr(res, 500, "Failed to credit bonus spins", creditErr);
    }

    await client.query("COMMIT");
    console.log(`[spinwheel] ✓ POST /earn-task COMMIT`);

    /* ── Audit ── */
    writeAudit({
      actorId    : userId,
      action     : "spinwheel_earn_task",
      targetType : "user",
      targetId   : userId,
      metadata   : {
        task_id       : taskId,
        task_label    : taskDef.label,
        platform      : taskDef.platform,
        spins_awarded : taskDef.spins_reward,
        bonus_spins   : newBonusSpins,
      },
      ipAddress  : ip,
    }).catch((e) =>
      console.warn("[spinwheel] audit failed:", e.message)
    );

    return res.json({
      success       : true,
      task_id       : taskId,
      task_label    : taskDef.label,
      platform      : taskDef.platform,
      spins_awarded : taskDef.spins_reward,
      bonus_spins   : newBonusSpins,
      message       :
        `🎡 +${taskDef.spins_reward} bonus spin` +
        `${taskDef.spins_reward > 1 ? "s" : ""} added for ` +
        `completing "${taskDef.label}"!`,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(
      "[spinwheel] ✗ UNHANDLED in POST /earn-task:", err.message
    );
    return failErr(res, 500, "Failed to claim task reward", err);
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/spinwheel/tasks/all
   Admin / debug endpoint — task completion stats.
   Blocked in production unless user has admin role.
════════════════════════════════════════════════════════════ */
router.get("/tasks/all", authenticate, async (req, res) => {
  const isAdmin =
    req.user?.role === "admin" || req.user?.is_admin === true;

  if (!isAdmin && IS_PROD) {
    return fail(res, 403, "Admin access required.");
  }

  try {
    const { rows: counts } = await pool.query(
      `SELECT
         task_id,
         COUNT(*)::INT           AS total_completions,
         SUM(spins_awarded)::INT AS total_spins_awarded,
         MIN(completed_at)       AS first_completed_at,
         MAX(completed_at)       AS last_completed_at
       FROM   public.spin_task_completions
       GROUP  BY task_id`
    );

    const countMap = Object.fromEntries(
      counts.map((r) => [r.task_id, r])
    );

    const tasks = EARN_TASKS_DEF.map((t) => ({
      ...t,
      stats: countMap[t.id] ?? {
        total_completions   : 0,
        total_spins_awarded : 0,
        first_completed_at  : null,
        last_completed_at   : null,
      },
    }));

    return res.json({
      success            : true,
      tasks,
      total_tasks        : tasks.length,
      max_spins_possible : EARN_TASKS_DEF.reduce(
        (s, t) => s + t.spins_reward, 0
      ),
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load all tasks", err);
  }
});

export default router;