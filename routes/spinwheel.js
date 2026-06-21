// routes/spinwheel.js
import express      from "express";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   WHEEL SEGMENTS
   Probabilities must add up to 100
═══════════════════════════════════════════════════════════════ */
const WHEEL_SEGMENTS = [
  {
    id          : 1,
    label       : "Try Again",
    type        : "none",
    value       : 0,
    color       : "#6b7280",
    bg          : "#f3f4f6",
    emoji       : "😅",
    probability : 35, // 35% chance
    coupon_code : null,
  },
  {
    id          : 2,
    label       : "₦100 Coupon",
    type        : "fixed",
    value       : 100,
    color       : "#e8630a",
    bg          : "#fff0e6",
    emoji       : "🎟️",
    probability : 25, // 25% chance
    coupon_code : null, // generated dynamically
  },
  {
    id          : 3,
    label       : "5% Discount",
    type        : "percentage",
    value       : 5,
    color       : "#6366f1",
    bg          : "#eef2ff",
    emoji       : "%",
    probability : 15, // 15% chance
    coupon_code : null,
  },
  {
    id          : 4,
    label       : "₦500 Coupon",
    type        : "fixed",
    value       : 500,
    color       : "#16a34a",
    bg          : "#f0fdf4",
    emoji       : "💰",
    probability : 10, // 10% chance
    coupon_code : null,
  },
  {
    id          : 5,
    label       : "₦100 Airtime",
    type        : "airtime",
    value       : 100,
    color       : "#0891b2",
    bg          : "#f0f9ff",
    emoji       : "📱",
    probability : 7,  // 7% chance
    coupon_code : null,
  },
  {
    id          : 6,
    label       : "Free Shipping",
    type        : "free_shipping",
    value       : 0,
    color       : "#d97706",
    bg          : "#fffbeb",
    emoji       : "🚚",
    probability : 5,  // 5% chance
    coupon_code : null,
  },
  {
    id          : 7,
    label       : "10% Discount",
    type        : "percentage",
    value       : 10,
    color       : "#dc2626",
    bg          : "#fef2f2",
    emoji       : "🔥",
    probability : 3,  // 3% chance
    coupon_code : null,
  },
];

/* ═══════════════════════════════════════════════════════════════
   ENSURE TABLES EXIST
═══════════════════════════════════════════════════════════════ */
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.spin_history (
      id          UUID      NOT NULL DEFAULT gen_random_uuid(),
      user_id     UUID      NOT NULL,
      segment_id  INT8      NOT NULL,
      label       STRING    NOT NULL,
      type        STRING    NOT NULL,
      value       DECIMAL   NOT NULL DEFAULT 0,
      coupon_id   UUID      NULL,
      coupon_code STRING    NULL,
      spun_at     TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT spin_history_pkey PRIMARY KEY (id ASC),
      INDEX idx_spin_user   (user_id ASC),
      INDEX idx_spin_spun_at (spun_at DESC)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.spin_config (
      id            UUID      NOT NULL DEFAULT gen_random_uuid(),
      user_id       UUID      NOT NULL,
      spins_today   INT8      NOT NULL DEFAULT 0,
      last_spin_at  TIMESTAMP NULL,
      total_spins   INT8      NOT NULL DEFAULT 0,
      CONSTRAINT spin_config_pkey PRIMARY KEY (id ASC),
      UNIQUE INDEX unique_spin_config_user (user_id ASC)
    )
  `);
}

ensureTables().catch((err) =>
  console.warn("[spinwheel] table init:", err.message)
);

/* ═══════════════════════════════════════════════════════════════
   SPIN ALGORITHM
   Weighted random selection
═══════════════════════════════════════════════════════════════ */
function spinWheel() {
  const rand  = Math.random() * 100;
  let   cumul = 0;

  for (const seg of WHEEL_SEGMENTS) {
    cumul += seg.probability;
    if (rand < cumul) return seg;
  }

  // Fallback — return "Try Again"
  return WHEEL_SEGMENTS[0];
}

/* ═══════════════════════════════════════════════════════════════
   GENERATE UNIQUE COUPON CODE
═══════════════════════════════════════════════════════════════ */
function generateCode(prefix = "SPIN") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let   code  = `${prefix}-`;
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/spinwheel/config
   Returns wheel segments + user's spin status
═══════════════════════════════════════════════════════════════ */
router.get("/config", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    /* Get or create spin config for user */
    const { rows } = await pool.query(
      `INSERT INTO public.spin_config (user_id, spins_today, last_spin_at, total_spins)
       VALUES ($1, 0, NULL, 0)
       ON CONFLICT (user_id) DO UPDATE
         SET spins_today = CASE
           WHEN DATE(spin_config.last_spin_at) < CURRENT_DATE THEN 0
           ELSE spin_config.spins_today
         END
       RETURNING *`,
      [userId]
    );

    const config      = rows[0];
    const lastSpinAt  = config.last_spin_at ? new Date(config.last_spin_at) : null;
    const today       = new Date();
    const isNewDay    = !lastSpinAt || lastSpinAt.toDateString() !== today.toDateString();
    const spinsToday  = isNewDay ? 0 : Number(config.spins_today || 0);
    const MAX_DAILY   = 1; // 1 free spin per day
    const canSpin     = spinsToday < MAX_DAILY;

    /* Next spin time — midnight tonight */
    const nextSpin = new Date();
    nextSpin.setHours(24, 0, 0, 0);
    const msUntilNext = nextSpin - today;
    const hrsUntil    = Math.floor(msUntilNext / 3_600_000);
    const minsUntil   = Math.floor((msUntilNext % 3_600_000) / 60_000);

    return res.json({
      success     : true,
      segments    : WHEEL_SEGMENTS.map((s) => ({
        id    : s.id,
        label : s.label,
        type  : s.type,
        value : s.value,
        color : s.color,
        bg    : s.bg,
        emoji : s.emoji,
        // Don't expose probabilities to frontend
      })),
      spin_status : {
        can_spin      : canSpin,
        spins_today   : spinsToday,
        max_daily     : MAX_DAILY,
        total_spins   : Number(config.total_spins || 0),
        next_spin_in  : canSpin ? null : `${hrsUntil}h ${minsUntil}m`,
        next_spin_at  : canSpin ? null : nextSpin.toISOString(),
      },
    });

  } catch (err) {
    console.error("[spinwheel] GET /config:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/spinwheel/spin
   Execute a spin — server-side result
═══════════════════════════════════════════════════════════════ */
router.post("/spin", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    /* ── Check if user can spin ── */
    const { rows: configRows } = await pool.query(
      `SELECT * FROM public.spin_config WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    const config     = configRows[0];
    const today      = new Date();
    const lastSpinAt = config?.last_spin_at ? new Date(config.last_spin_at) : null;
    const isNewDay   = !lastSpinAt || lastSpinAt.toDateString() !== today.toDateString();
    const spinsToday = isNewDay ? 0 : Number(config?.spins_today || 0);
    const MAX_DAILY  = 1;

    if (spinsToday >= MAX_DAILY) {
      const nextSpin = new Date();
      nextSpin.setHours(24, 0, 0, 0);
      const msLeft   = nextSpin - today;
      const hrsLeft  = Math.floor(msLeft / 3_600_000);
      const minsLeft = Math.floor((msLeft % 3_600_000) / 60_000);

      return res.status(429).json({
        success : false,
        message : `You've used your free spin today! Come back in ${hrsLeft}h ${minsLeft}m`,
        next_spin_at : nextSpin.toISOString(),
      });
    }

    /* ── Execute spin ── */
    const result = spinWheel();

    /* ── Process reward ── */
    let couponId   = null;
    let couponCode = null;

    if (result.type !== "none" && result.type !== "airtime") {
      /* Create a coupon in the DB */
      couponCode = generateCode("SPIN");

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // expires in 30 days

      try {
        const { rows: couponRows } = await pool.query(
          `INSERT INTO public.coupons
             (code, type, value, min_purchase, max_discount, usage_limit, expires_at, description, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            couponCode,
            result.type,
            result.value,
            0,                          // no minimum purchase
            result.type === "percentage" && result.value >= 10 ? 5000 : null, // cap big discounts
            1,                          // one use
            expiresAt,
            `🎡 Spin & Win — ${result.label}`,
            userId,
          ]
        );
        couponId = couponRows[0]?.id || null;
      } catch (e) {
        console.warn("[spinwheel] coupon insert:", e.message);
        /* Table may not exist yet — still record the spin */
      }
    }

    /* ── Record spin in history ── */
    await pool.query(
      `INSERT INTO public.spin_history
         (user_id, segment_id, label, type, value, coupon_id, coupon_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        result.id,
        result.label,
        result.type,
        result.value,
        couponId,
        couponCode,
      ]
    );

    /* ── Update spin config ── */
    await pool.query(
      `INSERT INTO public.spin_config (user_id, spins_today, last_spin_at, total_spins)
       VALUES ($1, 1, NOW(), 1)
       ON CONFLICT (user_id) DO UPDATE
         SET spins_today  = CASE
           WHEN DATE(spin_config.last_spin_at) < CURRENT_DATE THEN 1
           ELSE spin_config.spins_today + 1
         END,
             last_spin_at = NOW(),
             total_spins  = spin_config.total_spins + 1`,
      [userId]
    );

    /* ── Build response ── */
    const isWin = result.type !== "none";

    return res.json({
      success    : true,
      segment_id : result.id,
      result     : {
        id         : result.id,
        label      : result.label,
        type       : result.type,
        value      : result.value,
        emoji      : result.emoji,
        color      : result.color,
        is_win     : isWin,
        coupon_code: couponCode,
        coupon_id  : couponId,
        message    : isWin
          ? result.type === "airtime"
            ? `🎉 You won ₦${result.value} airtime! We'll credit it shortly.`
            : couponCode
              ? `🎉 You won ${result.label}! Use code ${couponCode} at checkout.`
              : `🎉 You won ${result.label}!`
          : "😅 Better luck next time! Come back tomorrow for another spin.",
        expires_in : isWin && couponCode ? "30 days" : null,
      },
    });

  } catch (err) {
    console.error("[spinwheel] POST /spin:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/spinwheel/history
   User's spin history
═══════════════════════════════════════════════════════════════ */
router.get("/history", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit  = Math.min(Number(req.query.limit) || 10, 50);

    const { rows } = await pool.query(
      `SELECT
         id, segment_id, label, type, value,
         coupon_code, spun_at
       FROM public.spin_history
       WHERE user_id = $1
       ORDER BY spun_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    const wins  = rows.filter((r) => r.type !== "none");
    const total = rows.length;

    return res.json({
      success : true,
      history : rows.map((r) => ({
        ...r,
        value  : Number(r.value || 0),
        is_win : r.type !== "none",
      })),
      stats : {
        total_spins : total,
        total_wins  : wins.length,
        win_rate    : total > 0 ? Math.round((wins.length / total) * 100) : 0,
      },
    });

  } catch (err) {
    console.error("[spinwheel] GET /history:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;