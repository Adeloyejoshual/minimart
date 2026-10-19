// FILE: routes/spinwheel.js
// Base: /api/spinwheel

import express   from "express";
import rateLimit from "express-rate-limit";
import crypto    from "crypto";
import { pool }  from "../config/db.js";        // ← FIXED: two levels up
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";

// REMOVED: No more static config imports
// import { WHEEL_SEGMENTS, EARN_TASKS_DEF, TASK_MAP, SPIN_CONSTANTS } from "../config/spinwheel.config.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ════════════════════════════════════════════════════════════
   DB-BACKED CONFIG LOADING
════════════════════════════════════════════════════════════ */
let _cachedConfig = null;
let _cacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

async function loadConfigFromDB() {
  const now = Date.now();
  if (_cachedConfig && (now - _cacheTime) < CACHE_TTL) {
    return _cachedConfig;
  }

  try {
    const [prizesRes, tasksRes, settingsRes] = await Promise.all([
      pool.query(`
        SELECT id, segment_key, label, reward_type, reward_value,
               probability, color, background_color, emoji,
               is_big_win, is_active, display_order
        FROM spinwheel_prizes
        WHERE is_active = true
        ORDER BY display_order
      `),
      pool.query(`
        SELECT id, task_key, label, platform, task_type, category,
               spins_reward, verification_type, destination_url,
               is_active, display_order
        FROM spinwheel_tasks
        WHERE is_active = true
        ORDER BY display_order
      `),
      pool.query(`SELECT setting_key, setting_value FROM spinwheel_settings`)
    ]);

    const settings = {};
    for (const row of settingsRes.rows) {
      settings[row.setting_key] = row.setting_value?.value ?? row.setting_value;
    }

    const config = {
      segments: prizesRes.rows.map(p => ({
        id: p.segment_key,
        label: p.label,
        type: p.reward_type,
        value: Number(p.reward_value),
        probability: Number(p.probability),
        color: p.color,
        bg: p.background_color,
        emoji: p.emoji,
        is_big_win: p.is_big_win,
      })),
      tasks: tasksRes.rows.map(t => ({
        id: t.task_key,
        label: t.label,
        platform: t.platform,
        type: t.task_type,
        category: t.category,
        spins_reward: Number(t.spins_reward),
        verify_type: t.verification_type,
        url: t.destination_url,
      })),
      settings: {
        MAX_FREE_DAILY: settings.max_free_daily ?? 1,
        MAX_BONUS_STACKED: settings.max_bonus_stacked ?? 10,
        COUPON_EXPIRY_DAYS: settings.coupon_expiry_days ?? 30,
      },
    };

    _cachedConfig = config;
    _cacheTime = now;
    return config;
  } catch (err) {
    console.error("[spinwheel] DB config load failed:", err.message);
    // Fallback to empty config — fail gracefully
    return { segments: [], tasks: [], settings: { MAX_FREE_DAILY: 1, MAX_BONUS_STACKED: 10, COUPON_EXPIRY_DAYS: 30 } };
  }
}

// Clear cache on config changes (called from admin when updated)
export function clearSpinCache() {
  _cachedConfig = null;
  _cacheTime = 0;
}

/* ════════════════════════════════════════════════════════════
   HELPERS (updated to use DB config)
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

async function spinWheel(segments) {
  const rand  = Math.random() * 100;
  let   cumul = 0;
  for (const seg of segments) {
    cumul += seg.probability;
    if (rand < cumul) return seg;
  }
  return segments[0];
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateDiscountCode() {
  let code = "SPIN-";
  for (let i = 0; i < 8; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

function generateAirtimeCode(amount) {
  return `AIR${amount}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
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

function safeSegments(segments) {
  return segments.map(
    ({ id, label, type, value, color, bg, emoji, is_big_win }) => ({
      id, label, type, value, color, bg, emoji, is_big_win,
    })
  );
}

/* ════════════════════════════════════════════════════════════
   RATE LIMITERS (unchanged)
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

const configLimiter  = makeLimiter({ windowMin: 1, max: 30, message: "Too many requests."                    });
const spinLimiter    = (_req, _res, next) => next();
const historyLimiter = makeLimiter({ windowMin: 1, max: 20, message: "Too many requests."                    });
const taskLimiter    = makeLimiter({ windowMin: 1, max: 20, message: "Too many requests."                    });
const claimLimiter   = makeLimiter({ windowMin: 5, max: 10, message: "Too many claim attempts. Please wait." });

/* ════════════════════════════════════════════════════════════
   ENSURE TABLES + INDEXES (unchanged - keep your existing)
════════════════════════════════════════════════════════════ */
async function ensureTables() {
  // ... keep your existing ensureTables function ...
}

ensureTables().catch((err) =>
  console.error("[spinwheel] ✗ table init FAILED:", err.message, "\n", err.stack)
);

/* ════════════════════════════════════════════════════════════
   SHARED: getSpinStatus (updated to use DB settings)
════════════════════════════════════════════════════════════ */
async function getSpinStatus(userId) {
  const config = await loadConfigFromDB();
  const { MAX_FREE_DAILY, MAX_BONUS_STACKED } = config.settings;

  console.log(`[spinwheel] getSpinStatus → user=${userId}`);

  const { rows: [spinConfig] } = await pool.query(
    `INSERT INTO public.spin_config
       (user_id, spins_today, last_spin_at, total_spins,
        total_wins, streak, last_streak_date)
     VALUES ($1, 0, NULL, 0, 0, 0, NULL)
     ON CONFLICT (user_id) DO UPDATE
       SET spins_today = CASE
         WHEN spin_config.last_spin_at IS NULL              THEN 0
         WHEN DATE(spin_config.last_spin_at) < CURRENT_DATE THEN 0
         ELSE spin_config.spins_today
       END
     RETURNING *`,
    [userId]
  );

  const { rows: [user] } = await pool.query(
    `SELECT bonus_spins, referral_code FROM public.users WHERE id = $1`,
    [userId]
  );

  if (!user) throw new Error(`User not found: ${userId}`);

  const bonusSpins  = Math.min(Number(user.bonus_spins ?? 0), MAX_BONUS_STACKED);
  const lastSpinAt  = spinConfig.last_spin_at ? new Date(spinConfig.last_spin_at) : null;
  const today       = new Date();
  const isNewDay    = !lastSpinAt || lastSpinAt.toDateString() !== today.toDateString();
  const spinsToday  = isNewDay ? 0 : Number(spinConfig.spins_today || 0);
  const canFreeSpin = spinsToday < MAX_FREE_DAILY;
  const canSpin     = canFreeSpin || bonusSpins > 0;
  const midnight    = timeUntilMidnight();

  /* ── streak ── */
  let streak = Number(spinConfig.streak || 0);
  const lastStreakDate = spinConfig.last_streak_date
    ? new Date(spinConfig.last_streak_date).toDateString()
    : null;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    lastStreakDate !== today.toDateString() &&
    lastStreakDate !== yesterday.toDateString()
  ) {
    streak = 0;
  }

  return {
    config: spinConfig,
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
      total_spins           : Number(spinConfig.total_spins || 0),
      total_wins            : Number(spinConfig.total_wins  || 0),
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
   GET /api/spinwheel/config (updated to use DB)
════════════════════════════════════════════════════════════ */
router.get("/config", authenticate, configLimiter, async (req, res) => {
  const userId = req.user?.id;
  console.log(`[spinwheel] GET /config → user=${userId}`);
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const dbConfig = await loadConfigFromDB();
    const { status } = await getSpinStatus(userId);

    /* latest referral name — non-fatal */
    try {
      const { rows: [latest] } = await pool.query(
        `SELECT
           COALESCE(
             NULLIF(TRIM(
               COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')
             ), ''),
             u.name, u.username, 'Someone'
           ) AS name
         FROM  public.referrals r
         JOIN  public.users     u ON u.id = COALESCE(r.referee_id, r.invitee_id)
         WHERE r.inviter_id = $1
           AND r.status     = 'rewarded'
         ORDER BY r.reward_given_at DESC
         LIMIT 1`,
        [userId]
      );
      if (latest?.name) status.latest_referral_name = latest.name;
    } catch (refErr) {
      console.warn("[spinwheel] referral name (non-fatal):", refErr.message);
    }

    return res.json({
      success     : true,
      segments    : safeSegments(dbConfig.segments),
      spin_status : status,
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load spin config", err);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/spinwheel/spin (updated to use DB config)
════════════════════════════════════════════════════════════ */
router.post("/spin", authenticate, spinLimiter, async (req, res) => {
  const userId   = req.user?.id;
  const ip       = getIp(req);
  const spinType = req.body?.spin_type || "free";

  console.log(`\n[spinwheel] POST /spin → user=${userId} spin_type=${spinType}`);

  if (!userId) return fail(res, 401, "Not authenticated.");
  if (!["free", "bonus"].includes(spinType))
    return fail(res, 400, "spin_type must be 'free' or 'bonus'.");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Load DB config
    const dbConfig = await loadConfigFromDB();
    const { MAX_FREE_DAILY, MAX_BONUS_STACKED, COUPON_EXPIRY_DAYS } = dbConfig.settings;

    /* ── 1. Read spin status ── */
    let spinData;
    try {
      spinData = await getSpinStatus(userId);
    } catch (statusErr) {
      await client.query("ROLLBACK");
      return failErr(res, 500, "Failed to read spin status", statusErr);
    }

    const { canFreeSpin, bonusSpins } = spinData;

    /* ── 2. Resolve actual spin type ── */
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

    /* ── 3. DB-level double-check ── */
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
      const dbSpins  = lastDate === new Date().toDateString()
        ? Number(check?.spins_today || 0)
        : 0;

      if (dbSpins >= MAX_FREE_DAILY) {
        await client.query("ROLLBACK");
        return fail(res, 429, "Free spin already used today.");
      }
    }

    if (actualType === "bonus") {
      const { rows: [check] } = await client.query(
        `SELECT bonus_spins FROM public.users WHERE id = $1`,
        [userId]
      );
      if (!check || Number(check.bonus_spins) <= 0) {
        await client.query("ROLLBACK");
        return fail(res, 429, "No bonus spins remaining.");
      }
    }

    /* ── 4. Spin the wheel (using DB segments) ── */
    const result = await spinWheel(dbConfig.segments);
    const isWin  = result.type !== "none";

    /* ── 5. Create reward ── */
    let couponId   = null;
    let couponCode = null;

    if (isWin && result.type === "airtime") {
      couponCode = generateAirtimeCode(result.value);
      try {
        await client.query(
          `INSERT INTO public.airtime_coupons (code, amount, user_id, status)
           VALUES ($1, $2, $3, 'available')`,
          [couponCode, result.value, userId]
        );
        console.log(`[spinwheel] ✓ airtime coupon created: ${couponCode}`);
      } catch (airtimeErr) {
        console.warn("[spinwheel] airtime coupon insert failed:", airtimeErr.message);
        couponCode = null;
      }

    } else if (isWin) {
      couponCode = generateDiscountCode();
      const expiry      = new Date();
      expiry.setDate(expiry.getDate() + COUPON_EXPIRY_DAYS);
      const maxDiscount = result.type === "percentage" && result.value >= 10 ? 5000 : null;

      try {
        const { rows: [coupon] } = await client.query(
          `INSERT INTO public.coupons
             (code, type, value, min_purchase, max_discount,
              usage_limit, expires_at, description, created_by, is_private)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            couponCode,
            result.type,
            result.value,
            0,
            maxDiscount,
            1,
            expiry,
            `🎡 Spin & Win — ${result.label}`,
            userId,
            true,
          ]
        );
        couponId = coupon?.id ?? null;
        console.log(`[spinwheel] ✓ discount coupon created: ${couponCode} (private)`);
      } catch (couponErr) {
        console.warn("[spinwheel] discount coupon insert failed:", couponErr.message);
        couponId   = null;
        couponCode = null;
      }
    }

    /* ── 6. Record spin_history ── */
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

    /* ── 7. Update spin_config ── */
    const todayDate = new Date().toISOString().slice(0, 10);
    const yest      = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestDate  = yest.toISOString().slice(0, 10);

    await client.query(
      `INSERT INTO public.spin_config
         (user_id, spins_today, last_spin_at, total_spins,
          total_wins, streak, last_streak_date)
       VALUES ($1, $2, NOW(), 1, $3, 1, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET spins_today = CASE
               WHEN spin_config.last_spin_at IS NULL              THEN $2
               WHEN DATE(spin_config.last_spin_at) < CURRENT_DATE THEN $2
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

    /* ── 8. Deduct bonus spin if applicable ── */
    if (actualType === "bonus") {
      await client.query(
        `UPDATE public.users
         SET    bonus_spins = GREATEST(0, bonus_spins - 1),
                updated_at  = NOW()
         WHERE  id = $1`,
        [userId]
      );
    }

    await client.query("COMMIT");
    console.log(`[spinwheel] ✓ spin committed — ${result.label}`);

    /* ── Remaining bonus spins (post-commit read) ── */
    let spinsRemaining = 0;
    try {
      const { rows: [afterUser] } = await pool.query(
        `SELECT bonus_spins FROM public.users WHERE id = $1`,
        [userId]
      );
      spinsRemaining = Number(afterUser?.bonus_spins ?? 0);
    } catch (_) { /* non-fatal */ }

    /* ── Audit log ── */
    writeAudit({
      actorId    : userId,
      action     : "spinwheel_spin",
      targetType : "user",
      targetId   : userId,
      metadata   : {
        spin_type  : actualType,
        segment_id : result.id,
        label      : result.label,
        is_win     : isWin,
        coupon_code: couponCode,
        is_big_win : result.is_big_win,
      },
      ipAddress : ip,
    }).catch((e) => console.warn("[spinwheel] audit failed:", e.message));

    /* ── Win message ── */
    let message;
    if (!isWin) {
      message = "😅 Better luck next time! Come back tomorrow for another spin.";
    } else if (result.type === "airtime") {
      message = couponCode
        ? `🎉 You won ₦${result.value} airtime! Check your Airtime Coupons tab.`
        : `🎉 You won ₦${result.value} airtime! We will credit it to your account shortly.`;
    } else {
      message = couponCode
        ? `🎉 You won ${result.label}! Use code ${couponCode} at checkout.`
        : `🎉 You won ${result.label}!`;
    }

    return res.json({
      success    : true,
      segment_id : result.id,
      result: {
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
        message,
        expires_in      : isWin && couponCode ? `${COUPON_EXPIRY_DAYS} days` : null,
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
   GET /api/spinwheel/history (unchanged)
════════════════════════════════════════════════════════════ */
router.get("/history", authenticate, historyLimiter, async (req, res) => {
  // ... keep your existing history endpoint ...
});

/* ════════════════════════════════════════════════════════════
   GET /api/spinwheel/referral-spins (unchanged)
════════════════════════════════════════════════════════════ */
router.get("/referral-spins", authenticate, historyLimiter, async (req, res) => {
  // ... keep your existing referral-spins endpoint ...
});

/* ════════════════════════════════════════════════════════════
   GET /api/spinwheel/tasks (updated to use DB)
════════════════════════════════════════════════════════════ */
router.get("/tasks", authenticate, taskLimiter, async (req, res) => {
  const userId = req.user?.id;
  console.log(`[spinwheel] GET /tasks → user=${userId}`);
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const dbConfig = await loadConfigFromDB();

    const { rows } = await pool.query(
      `SELECT task_id, spins_awarded, completed_at
       FROM   public.spin_task_completions
       WHERE  user_id = $1
       ORDER  BY completed_at ASC`,
      [userId]
    );

    const completedTaskIds = rows.map((r) => r.task_id);
    const totalEarned      = rows.reduce(
      (sum, r) => sum + Number(r.spins_awarded || 0), 0
    );

    const completedSet    = new Set(completedTaskIds);
    const completedDetail = Object.fromEntries(
      rows.map((r) => [r.task_id, r])
    );

    const tasks = dbConfig.tasks.map((t) => ({
      id           : t.id,
      label        : t.label,
      platform     : t.platform,
      type         : t.type,
      category     : t.category,
      spins_reward : t.spins_reward,
      verify_type  : t.verify_type,
      url          : t.url,
      completed    : completedSet.has(t.id),
      completed_at : completedDetail[t.id]?.completed_at ?? null,
    }));

    const taskCount = dbConfig.tasks.length;
    const maxTaskSpins = dbConfig.tasks.reduce((s, t) => s + t.spins_reward, 0);

    return res.json({
      success            : true,
      tasks,
      completed_task_ids : completedTaskIds,
      completed_detail   : rows.map((r) => ({
        task_id       : r.task_id,
        spins_awarded : Number(r.spins_awarded),
        completed_at  : r.completed_at,
      })),
      stats: {
        total_tasks     : taskCount,
        completed_count : completedTaskIds.length,
        pending_count   : taskCount - completedTaskIds.length,
        total_earned    : totalEarned,
        max_possible    : maxTaskSpins,
      },
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load task completions", err);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/spinwheel/earn-task (updated to use DB)
════════════════════════════════════════════════════════════ */
router.post("/earn-task", authenticate, claimLimiter, async (req, res) => {
  const userId = req.user?.id;
  const ip     = getIp(req);
  const taskId = req.body?.task_id;

  console.log(`\n[spinwheel] POST /earn-task → user=${userId} task=${taskId}`);

  if (!userId) return fail(res, 401, "Not authenticated.");
  if (!taskId) return fail(res, 400, "task_id is required.");

  const dbConfig = await loadConfigFromDB();
  const taskDef = dbConfig.tasks.find(t => t.id === taskId);

  if (!taskDef) {
    return fail(
      res, 404,
      `Unknown task: "${taskId}". Valid: ${dbConfig.tasks.map(t => t.id).join(", ")}`
    );
  }

  console.log(`[spinwheel] task: "${taskDef.label}" → +${taskDef.spins_reward} spins`);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* duplicate check */
    const { rows: [existing] } = await client.query(
      `SELECT id, completed_at
       FROM   public.spin_task_completions
       WHERE  user_id = $1 AND task_id = $2
       LIMIT  1`,
      [userId, taskId]
    );

    if (existing) {
      await client.query("ROLLBACK");
      return fail(
        res, 409,
        `You have already claimed the reward for "${taskDef.label}".`,
        { completed_at: existing.completed_at }
      );
    }

    /* insert completion */
    try {
      await client.query(
        `INSERT INTO public.spin_task_completions
           (user_id, task_id, platform, spins_awarded, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, taskId, taskDef.platform, taskDef.spins_reward, ip]
      );
    } catch (insertErr) {
      await client.query("ROLLBACK");
      const isDup =
        insertErr.code === "23505" ||
        insertErr.message?.toLowerCase().includes("unique") ||
        insertErr.message?.toLowerCase().includes("duplicate");

      if (isDup) {
        return fail(
          res, 409,
          `You have already claimed the reward for "${taskDef.label}".`
        );
      }
      return failErr(res, 500, "Failed to record task completion", insertErr);
    }

    const { MAX_BONUS_STACKED } = dbConfig.settings;

    /* credit bonus spins */
    const { rows: [updated] } = await client.query(
      `UPDATE public.users
       SET    bonus_spins = LEAST(bonus_spins + $1, $2),
              updated_at  = NOW()
       WHERE  id = $3
       RETURNING bonus_spins`,
      [taskDef.spins_reward, MAX_BONUS_STACKED, userId]
    );

    const newBonusSpins = Number(updated?.bonus_spins ?? 0);

    await client.query("COMMIT");
    console.log(
      `[spinwheel] ✓ earn-task committed — user now has ${newBonusSpins} bonus spins`
    );

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
      ipAddress : ip,
    }).catch((e) => console.warn("[spinwheel] audit failed:", e.message));

    return res.json({
      success       : true,
      task_id       : taskId,
      task_label    : taskDef.label,
      platform      : taskDef.platform,
      spins_awarded : taskDef.spins_reward,
      bonus_spins   : newBonusSpins,
      message:
        `🎡 +${taskDef.spins_reward} bonus spin` +
        `${taskDef.spins_reward > 1 ? "s" : ""} added for ` +
        `completing "${taskDef.label}"!`,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return failErr(res, 500, "Failed to claim task reward", err);
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/spinwheel/tasks/all   (admin / debug only)
════════════════════════════════════════════════════════════ */
router.get("/tasks/all", authenticate, async (req, res) => {
  const isAdmin = req.user?.role === "admin" || req.user?.is_admin === true;
  if (!isAdmin && IS_PROD) return fail(res, 403, "Admin access required.");

  try {
    const dbConfig = await loadConfigFromDB();

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

    const countMap = Object.fromEntries(counts.map((r) => [r.task_id, r]));

    const tasks = dbConfig.tasks.map((t) => ({
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
      total_tasks        : dbConfig.tasks.length,
      max_spins_possible : dbConfig.tasks.reduce((s, t) => s + t.spins_reward, 0),
    });

  } catch (err) {
    return failErr(res, 500, "Failed to load all tasks", err);
  }
});

export default router;