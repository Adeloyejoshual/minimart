import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../config/db.js";
import { invalidateUserCache } from "./coupons.js";

const router = express.Router();

const VIBRANT_PALETTE = [
  "#FF4500", "#6366F1", "#10B981", "#EC4899",
  "#4B5563", "#8B5CF6", "#06B6D4", "#F59E0B"
];

function parseSettingValue(raw, defaultValue) {
  if (raw === undefined || raw === null) return defaultValue;
  let val = raw;
  if (typeof val === "string") {
    try { val = JSON.parse(val); } catch (e) {}
  }
  if (typeof val === "object" && val !== null && "value" in val) {
    val = val.value;
  }
  const num = Number(val);
  return isNaN(num) ? defaultValue : num;
}

function formatCountdown(seconds) {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

function isValidUUID(str) {
  if (!str || typeof str !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ---------------------------------------------------------
// AUTH MIDDLEWARES
// ---------------------------------------------------------
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }
  try {
    const token = authHeader.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
  } catch (err) {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please log in to perform this action." });
  }
  try {
    const token = authHeader.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    next();
  } catch (err) {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}

// ---------------------------------------------------------
// CORE WHEEL FUNCTIONS
// ---------------------------------------------------------
async function loadSegmentsAndSettings() {
  const [prizesRes, settingsRes] = await Promise.all([
    pool.query(`
      SELECT DISTINCT ON (segment_key) id, segment_key, label, reward_type, reward_value, probability, color, background_color, emoji, is_big_win, display_order 
      FROM spinwheel_prizes 
      WHERE is_active = true 
      ORDER BY segment_key, display_order ASC
    `),
    pool.query(`SELECT setting_key, setting_value FROM spinwheel_settings`)
  ]);

  const settingsObj = {};
  for (const row of settingsRes.rows) {
    settingsObj[row.setting_key] = row.setting_value;
  }
  const maxFreeDaily = parseSettingValue(settingsObj.max_free_daily, 5);

  const segments = prizesRes.rows.map((p, index) => {
    let sliceBg = p.background_color;
    if (!sliceBg || sliceBg === "#FFFFFF" || sliceBg === "#fff") {
      sliceBg = p.color && p.color !== "#FFFFFF" && p.color !== "#fff" 
        ? p.color : VIBRANT_PALETTE[index % VIBRANT_PALETTE.length];
    }
    return {
      id: p.segment_key, db_id: p.id, label: p.label, type: p.reward_type,
      value: Number(p.reward_value), probability: Number(p.probability),
      color: sliceBg, bg: sliceBg, background_color: sliceBg, backgroundColor: sliceBg, fillColor: sliceBg,
      textColor: "#FFFFFF", fontColor: "#FFFFFF",
      emoji: p.emoji || "🎁", is_big_win: Boolean(p.is_big_win)
    };
  });
  return { segments, maxFreeDaily };
}

async function getSpinStatusForUser(userId, maxFreeDaily, guestSessionId = null) {
  let spinsToday = 0;
  let bonusSpinsRemaining = 0;

  if (userId) {
    const spinsTodayRes = await pool.query(
      `SELECT COUNT(*) as count FROM spinwheel_spins WHERE user_id = $1 AND created_at >= (NOW() AT TIME ZONE 'UTC')::date`,
      [String(userId)]
    );
    spinsToday = Number(spinsTodayRes.rows[0]?.count || 0);

    const userRes = await pool.query(`SELECT bonus_spins FROM users WHERE id = $1`, [String(userId)]);
    bonusSpinsRemaining = Number(userRes.rows[0]?.bonus_spins || 0);
  } 
  else if (guestSessionId) {
    // SECURITY: Limit guests to exactly 1 spin total (not daily) based on their session ID
    const guestSpinsRes = await pool.query(
      `SELECT COUNT(*) as count FROM spinwheel_spins WHERE guest_session_id = $1`,
      [guestSessionId]
    );
    spinsToday = Number(guestSpinsRes.rows[0]?.count || 0);
    maxFreeDaily = 1; 
  }

  const freeSpinsRemaining = Math.max(0, maxFreeDaily - spinsToday);
  const canFreeSpin = freeSpinsRemaining > 0;
  const canSpin = canFreeSpin || bonusSpinsRemaining > 0;

  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const nextSpinSeconds = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));

  return {
    can_free_spin: canFreeSpin,
    can_spin: canSpin,
    free_spins_remaining: freeSpinsRemaining,
    spins_used_today: spinsToday,
    max_daily_spins: maxFreeDaily,
    bonus_spins_remaining: bonusSpinsRemaining,
    next_spin_in: formatCountdown(nextSpinSeconds),
    next_spin_seconds: nextSpinSeconds,
    streak: 1,
    is_guest: !userId
  };
}

// ---------------------------------------------------------
// GET /config - Public Wheel Config
// ---------------------------------------------------------
router.get("/config", optionalAuth, async (req, res) => {
  try {
    const { segments, maxFreeDaily } = await loadSegmentsAndSettings();
    const userId = req.user ? req.user.id : null;
    const guestSessionId = req.query.guest_session_id || null;
    
    const spinStatus = await getSpinStatusForUser(userId, maxFreeDaily, guestSessionId);

    res.json({ segments, spin_status: spinStatus });
  } catch (error) {
    console.error("[spinwheel] /config error:", error);
    res.status(500).json({ message: "Failed to load wheel configuration." });
  }
});

// ---------------------------------------------------------
// POST /spin - Executes a Spin (Guests & Authenticated)
// ---------------------------------------------------------
router.post("/spin", optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? String(req.user.id) : null;
    const guestSessionId = req.body.guest_session_id || null;

    if (!userId && !guestSessionId) {
      return res.status(400).json({ message: "Request missing identifier. Cannot process spin." });
    }

    const { segments, maxFreeDaily } = await loadSegmentsAndSettings();
    if (!segments || segments.length === 0) {
      return res.status(400).json({ message: "No active wheel segments found." });
    }

    const spinStatus = await getSpinStatusForUser(userId, maxFreeDaily, guestSessionId);
    
    if (!spinStatus.can_spin) {
      const msg = userId 
        ? `No spins remaining today. Next spin in ${spinStatus.next_spin_in}` 
        : `You have already used your free guest spin! Please log in to play again.`;
      return res.status(400).json({ message: msg });
    }

    const isConsumingBonusSpin = userId && spinStatus.free_spins_remaining <= 0 && spinStatus.bonus_spins_remaining > 0;

    // 1. Determine Winning Segment
    const totalProb = segments.reduce((sum, s) => sum + s.probability, 0);
    let rand = Math.random() * totalProb;
    let winningSegment = segments[0];

    for (const seg of segments) {
      if (rand < seg.probability) {
        winningSegment = seg;
        break;
      }
      rand -= seg.probability;
    }

    const prizeId = isValidUUID(winningSegment.db_id) ? winningSegment.db_id : null;

    // 2. Insert Spin Record
    const spinInsertRes = await pool.query(
      `INSERT INTO spinwheel_spins (user_id, guest_session_id, prize_id, prize_snapshot, spin_status)
       VALUES ($1, $2, $3::uuid, $4::jsonb, 'completed') RETURNING id`,
      [userId, guestSessionId, prizeId, JSON.stringify(winningSegment)]
    );
    const spinId = spinInsertRes.rows[0].id;
    const isWin = winningSegment.type !== "none";
    
    // Background stats update
    if (prizeId) {
      pool.query(`UPDATE spinwheel_prizes SET wins_count = COALESCE(wins_count, 0) + 1 WHERE id = $1::uuid`, [prizeId]).catch(()=>{});
    }

    // 3. Process the Reward
    if (isWin) {
      // Record internal Spin & Win claim
      await pool.query(
        `INSERT INTO spinwheel_rewards (user_id, guest_session_id, spin_id, prize_id, reward_snapshot, claim_status, expires_at)
         VALUES ($1, $2, $3::uuid, $4::uuid, $5::jsonb, 'unclaimed', NOW() + INTERVAL '30 days')`,
        [userId, guestSessionId, spinId, prizeId, JSON.stringify(winningSegment)]
      );

      // IF LOGGED IN: Instantly mint real, usable store coupons
      if (userId) {
        try {
          if (winningSegment.type === "airtime") {
            const code = `AIR-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
            await pool.query(
              `INSERT INTO airtime_coupons (code, amount, status, user_id) VALUES ($1, $2, 'available', $3)`,
              [code, winningSegment.value, userId]
            );
          } else if (["fixed", "percentage", "free_shipping"].includes(winningSegment.type)) {
            const code = `SPIN-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
            await pool.query(
              `INSERT INTO coupons (code, type, value, usage_limit, is_private, created_by, description, expires_at) 
               VALUES ($1, $2, $3, 1, true, $4, $5, NOW() + INTERVAL '30 days')`,
              [code, winningSegment.type, winningSegment.value, userId, `🎡 Spin & Win — ${winningSegment.label}`]
            );
          }
          await invalidateUserCache(userId).catch(()=>{});
        } catch (err) {
          console.error("[spinwheel] Failed to mint actual coupon:", err.message);
        }
      }
    }

    // Deduct bonus spin if they used one
    if (isConsumingBonusSpin) {
      pool.query(`UPDATE users SET bonus_spins = GREATEST(0, COALESCE(bonus_spins, 0) - 1) WHERE id = $1`, [userId]).catch(()=>{});
    }

    const updatedStatus = await getSpinStatusForUser(userId, maxFreeDaily, guestSessionId);
    if (isConsumingBonusSpin) {
      updatedStatus.bonus_spins_remaining = Math.max(0, updatedStatus.bonus_spins_remaining - 1);
    }

    res.json({
      segment_id: winningSegment.id,
      result: {
        is_win: isWin,
        label: winningSegment.label,
        emoji: winningSegment.emoji,
        type: winningSegment.type,
        value: winningSegment.value,
        is_big_win: winningSegment.is_big_win,
        color: "#FFFFFF",
        bg: winningSegment.bg
      },
      spin_status: updatedStatus,
      is_guest: !userId // Tells frontend to show the login prompt!
    });
  } catch (error) {
    console.error("[spinwheel] /spin error:", error.message);
    res.status(500).json({ message: "Failed to process spin. Please try again." });
  }
});

// ---------------------------------------------------------
// POST /sync-guest - Mints pending guest rewards after Login
// ---------------------------------------------------------
router.post("/sync-guest", requireAuth, async (req, res) => {
  const { guest_session_id } = req.body;
  const userId = String(req.user.id);

  if (!guest_session_id) {
    return res.status(400).json({ success: false, message: "No guest session ID provided." });
  }

  try {
    // 1. Validate Eligibility: STRICT check to ensure we only grab unclaimed rewards that have no user yet
    const guestRewards = await pool.query(
      `SELECT id, reward_snapshot FROM spinwheel_rewards 
       WHERE guest_session_id = $1 
         AND user_id IS NULL 
         AND claim_status = 'unclaimed'`,
      [guest_session_id]
    );

    if (guestRewards.rows.length === 0) {
      return res.json({ success: true, message: "No pending rewards to sync." });
    }

    // 2. Claim the History: Tie history to the user, change claim_status so it can NEVER be synced again.
    await pool.query(
      `UPDATE spinwheel_spins SET user_id = $1 WHERE guest_session_id = $2 AND user_id IS NULL`, 
      [userId, guest_session_id]
    );
    await pool.query(
      `UPDATE spinwheel_rewards SET user_id = $1, claim_status = 'synced' WHERE guest_session_id = $2 AND user_id IS NULL AND claim_status = 'unclaimed'`, 
      [userId, guest_session_id]
    );

    // 3. Mint the Actual Real Rewards into the store tables
    for (const reward of guestRewards.rows) {
      const snap = typeof reward.reward_snapshot === "string" ? JSON.parse(reward.reward_snapshot) : reward.reward_snapshot;
      
      if (snap.type === "airtime") {
        const code = `AIR-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        await pool.query(
          `INSERT INTO airtime_coupons (code, amount, status, user_id) VALUES ($1, $2, 'available', $3)`,
          [code, snap.value, userId]
        );
      } else if (["fixed", "percentage", "free_shipping"].includes(snap.type)) {
        const code = `SPIN-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        await pool.query(
          `INSERT INTO coupons (code, type, value, usage_limit, is_private, created_by, description, expires_at) 
           VALUES ($1, $2, $3, 1, true, $4, $5, NOW() + INTERVAL '30 days')`,
          [code, snap.type, snap.value, userId, `🎡 Spin & Win — ${snap.label}`]
        );
      }
    }

    // Clear coupon cache so they see it instantly on their dashboard
    await invalidateUserCache(userId).catch(()=>{});
    
    res.json({ 
      success: true, 
      synced_count: guestRewards.rows.length,
      message: "Rewards successfully transferred to your account!" 
    });
  } catch (error) {
    console.error("[spinwheel] /sync-guest error:", error.message);
    res.status(500).json({ success: false, message: "Failed to sync guest data." });
  }
});

// ---------------------------------------------------------
// OTHER GET ROUTES (History, Referrals, Tasks)
// ---------------------------------------------------------
router.get("/history", requireAuth, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const historyRes = await pool.query(
      `SELECT s.id, s.prize_snapshot, s.created_at, r.claim_status
       FROM spinwheel_spins s
       LEFT JOIN spinwheel_rewards r ON r.spin_id = s.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC LIMIT 50`,
      [userId]
    );

    const winsCountRes = await pool.query(`SELECT COUNT(*) as count FROM spinwheel_spins WHERE user_id = $1`, [userId]);

    const history = historyRes.rows.map(row => {
      const snap = typeof row.prize_snapshot === "string" ? JSON.parse(row.prize_snapshot) : (row.prize_snapshot || {});
      return {
        id: row.id, segment_id: snap.id || snap.segment_key, label: snap.label || "Prize",
        reward_type: snap.type || "none", reward_value: Number(snap.value || 0),
        emoji: snap.emoji || "🎁", color: "#FFFFFF", bg: snap.bg || "#3B82F6",
        claim_status: row.claim_status || "completed", created_at: row.created_at
      };
    });

    res.json({ history, stats: { total_wins: Number(winsCountRes.rows[0]?.count || 0), streak: 1 } });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch spin history." });
  }
});

router.get("/referral-spins", requireAuth, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const userRes = await pool.query(`SELECT bonus_spins FROM users WHERE id = $1`, [userId]);
    const balance = Number(userRes.rows[0]?.bonus_spins || 0);

    const historyRes = await pool.query(
      `SELECT r.id, r.status, r.reward_value, r.reward_given_at, COALESCE(u.name, u.first_name, u.username, 'User') as referee_name
       FROM referrals r JOIN users u ON u.id = COALESCE(r.referee_id, r.invitee_id)
       WHERE r.inviter_id = $1 AND r.status = 'rewarded' ORDER BY r.reward_given_at DESC LIMIT 50`,
      [userId]
    );

    const history = historyRes.rows.map(r => ({
      id: r.id, name: r.referee_name, spins_earned: Number(r.reward_value || 0), date: r.reward_given_at
    }));
    
    res.json({ stats: { total_earned: history.reduce((sum, h) => sum + h.spins_earned, 0), balance: balance }, history: history });
  } catch (error) {
    res.status(500).json({ message: "Failed to load referral spins." });
  }
});

router.get("/tasks", optionalAuth, async (req, res) => {
  try {
    const tasksRes = await pool.query(`SELECT id, task_key, label, platform, spins_reward, destination_url FROM spinwheel_tasks WHERE is_active = true ORDER BY display_order ASC`);
    
    let completedTaskIds = [];
    let totalEarned = 0;

    if (req.user) {
      const claimsRes = await pool.query(`SELECT reward_snapshot FROM spinwheel_rewards WHERE user_id = $1 AND claim_status = 'task_completed'`, [String(req.user.id)]);
      completedTaskIds = claimsRes.rows.map(row => {
        const snap = typeof row.reward_snapshot === "string" ? JSON.parse(row.reward_snapshot) : row.reward_snapshot;
        totalEarned += Number(snap?.spins_reward || 1);
        return snap?.task_id;
      }).filter(Boolean);
    }

    res.json({
      tasks: tasksRes.rows.map(t => ({ id: t.task_key || t.id, label: t.label, platform: t.platform, spins_reward: Number(t.spins_reward), url: t.destination_url })),
      completed_task_ids: completedTaskIds, stats: { total_earned: totalEarned }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tasks." });
  }
});

// ---------------------------------------------------------
// POST /earn-task & /claim-task
// ---------------------------------------------------------
const handleTaskClaim = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const taskId = req.body.task_id || req.body.taskId || req.body.task_key;

    if (!taskId) return res.status(400).json({ message: "Task ID is required." });

    const taskRes = await pool.query(`SELECT task_key, label, spins_reward FROM spinwheel_tasks WHERE (task_key = $1 OR id::text = $1) AND is_active = true`, [taskId]);
    const spinsReward = taskRes.rows.length > 0 ? Number(taskRes.rows[0].spins_reward) : 1;
    const taskLabel = taskRes.rows.length > 0 ? taskRes.rows[0].label : "Earn Task";

    const existingRes = await pool.query(
      `SELECT id FROM spinwheel_rewards WHERE user_id = $1 AND claim_status = 'task_completed' AND (reward_snapshot->>'task_id' = $2 OR reward_snapshot->>'task_key' = $2)`,
      [userId, taskId]
    );

    if (existingRes.rows.length > 0) return res.status(400).json({ message: "Task already claimed." });

    const snapshot = { task_id: taskId, task_key: taskId, label: taskLabel, spins_reward: spinsReward };

    await pool.query(`INSERT INTO spinwheel_rewards (user_id, claim_status, reward_snapshot) VALUES ($1, 'task_completed', $2::jsonb)`, [userId, JSON.stringify(snapshot)]);
    await pool.query(`UPDATE users SET bonus_spins = COALESCE(bonus_spins, 0) + $1 WHERE id = $2`, [spinsReward, userId]);

    res.json({ success: true, message: `Task claimed! You earned +${spinsReward} bonus spin(s).`, spins_awarded: spinsReward });
  } catch (error) {
    console.error("[spinwheel] claim-task error:", error);
    res.status(500).json({ message: "Failed to claim task." });
  }
};

router.post("/earn-task", requireAuth, handleTaskClaim);
router.post("/claim-task", requireAuth, handleTaskClaim);

export default router;