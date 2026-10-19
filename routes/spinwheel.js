import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

const router = express.Router();

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

// --- AUTH MIDDLEWARE ---

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
    return res.status(401).json({ message: "Please log in to spin or claim tasks." });
  }
  try {
    const token = authHeader.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    next();
  } catch (err) {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}

// --- DB LOADERS ---

async function loadSegmentsAndSettings() {
  const [prizesRes, settingsRes] = await Promise.all([
    pool.query(`
      SELECT DISTINCT ON (segment_key) id, segment_key, label, reward_type, reward_value, probability, color, background_color, emoji, is_big_win 
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

  const segments = prizesRes.rows.map(p => ({
    id: p.segment_key,
    db_id: p.id,
    label: p.label,
    type: p.reward_type,
    value: Number(p.reward_value),
    probability: Number(p.probability),
    color: p.color || "#FFFFFF",
    bg: p.background_color || "#3B82F6",
    emoji: p.emoji || "🎁",
    is_big_win: Boolean(p.is_big_win)
  }));

  return { segments, maxFreeDaily };
}

async function getSpinStatusForUser(userId, maxFreeDaily) {
  let spinsToday = 0;
  let bonusSpinsRemaining = 0;

  if (userId) {
    const spinsTodayRes = await pool.query(
      `SELECT COUNT(*) as count 
       FROM spinwheel_spins 
       WHERE user_id = $1 
         AND created_at >= (NOW() AT TIME ZONE 'UTC')::date`,
      [String(userId)]
    );
    spinsToday = Number(spinsTodayRes.rows[0]?.count || 0);

    const bonusRes = await pool.query(
      `SELECT reward_snapshot FROM spinwheel_rewards 
       WHERE user_id = $1 AND claim_status = 'task_completed'`,
      [String(userId)]
    );

    let totalBonusEarned = 0;
    for (const row of bonusRes.rows) {
      const snapshot = typeof row.reward_snapshot === "string" ? JSON.parse(row.reward_snapshot) : (row.reward_snapshot || {});
      totalBonusEarned += Number(snapshot.spins_reward || 1);
    }

    const totalSpinsUsedRes = await pool.query(
      `SELECT COUNT(*) as count FROM spinwheel_spins WHERE user_id = $1`,
      [String(userId)]
    );
    const totalSpinsUsed = Number(totalSpinsUsedRes.rows[0]?.count || 0);
    bonusSpinsRemaining = Math.max(0, totalBonusEarned - Math.max(0, totalSpinsUsed - spinsToday));
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
    streak: 1
  };
}

// --- API ENDPOINTS ---

// 1. GET /api/spinwheel/config
router.get("/config", optionalAuth, async (req, res) => {
  try {
    const { segments, maxFreeDaily } = await loadSegmentsAndSettings();
    const userId = req.user ? req.user.id : null;
    const spinStatus = await getSpinStatusForUser(userId, maxFreeDaily);

    res.json({
      segments,
      spin_status: spinStatus
    });
  } catch (error) {
    console.error("[spinwheel] /config error:", error);
    res.status(500).json({ message: "Failed to load wheel configuration." });
  }
});

// 2. GET /api/spinwheel/history
router.get("/history", optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ history: [], stats: { total_wins: 0, streak: 0 } });
    }

    const userId = String(req.user.id);

    const historyRes = await pool.query(
      `SELECT s.id, s.prize_snapshot, s.created_at, r.claim_status, r.expires_at
       FROM spinwheel_spins s
       LEFT JOIN spinwheel_rewards r ON r.spin_id = s.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [userId]
    );

    const winsCountRes = await pool.query(
      `SELECT COUNT(*) as count FROM spinwheel_spins WHERE user_id = $1`,
      [userId]
    );

    const history = historyRes.rows.map(row => {
      const snapshot = typeof row.prize_snapshot === "string" ? JSON.parse(row.prize_snapshot) : (row.prize_snapshot || {});
      return {
        id: row.id,
        segment_id: snapshot.id || snapshot.segment_key,
        label: snapshot.label || "Prize",
        reward_type: snapshot.type || snapshot.reward_type || "none",
        reward_value: Number(snapshot.value || snapshot.reward_value || 0),
        emoji: snapshot.emoji || "🎁",
        color: snapshot.color || "#FFFFFF",
        bg: snapshot.bg || snapshot.background_color || "#3B82F6",
        claim_status: row.claim_status || "completed",
        created_at: row.created_at
      };
    });

    res.json({
      history,
      stats: {
        total_wins: Number(winsCountRes.rows[0]?.count || 0),
        streak: 1
      }
    });
  } catch (error) {
    console.error("[spinwheel] /history error:", error);
    res.status(500).json({ message: "Failed to fetch spin history." });
  }
});

// 3. GET /api/spinwheel/referral-spins
router.get("/referral-spins", optionalAuth, async (req, res) => {
  res.json({ referral_spins: [] });
});

// 4. GET /api/spinwheel/tasks
router.get("/tasks", optionalAuth, async (req, res) => {
  try {
    const tasksRes = await pool.query(
      `SELECT id, task_key, label, platform, spins_reward, destination_url 
       FROM spinwheel_tasks 
       WHERE is_active = true 
       ORDER BY display_order ASC`
    );

    let completedTaskIds = [];
    let totalEarned = 0;

    if (req.user) {
      const claimsRes = await pool.query(
        `SELECT reward_snapshot FROM spinwheel_rewards 
         WHERE user_id = $1 AND claim_status = 'task_completed'`,
        [String(req.user.id)]
      );

      completedTaskIds = claimsRes.rows.map(row => {
        const snap = typeof row.reward_snapshot === "string" ? JSON.parse(row.reward_snapshot) : row.reward_snapshot;
        totalEarned += Number(snap?.spins_reward || 1);
        return snap?.task_id;
      }).filter(Boolean);
    }

    res.json({
      tasks: tasksRes.rows.map(t => ({
        id: t.task_key || t.id,
        label: t.label,
        platform: t.platform,
        spins_reward: Number(t.spins_reward),
        url: t.destination_url
      })),
      completed_task_ids: completedTaskIds,
      stats: { total_earned: totalEarned }
    });
  } catch (error) {
    console.error("[spinwheel] /tasks error:", error);
    res.status(500).json({ message: "Failed to fetch tasks." });
  }
});

// 5. POST /api/spinwheel/earn-task & /claim-task
const handleTaskClaim = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const taskId = req.body.task_id || req.body.taskId || req.body.task_key;

    if (!taskId) {
      return res.status(400).json({ message: "Task ID is required." });
    }

    const taskRes = await pool.query(
      `SELECT task_key, label, spins_reward FROM spinwheel_tasks WHERE (task_key = $1 OR id::text = $1) AND is_active = true`,
      [taskId]
    );

    const spinsReward = taskRes.rows.length > 0 ? Number(taskRes.rows[0].spins_reward) : 1;
    const taskLabel = taskRes.rows.length > 0 ? taskRes.rows[0].label : "Earn Task";

    const existingRes = await pool.query(
      `SELECT id FROM spinwheel_rewards 
       WHERE user_id = $1 
         AND claim_status = 'task_completed' 
         AND (reward_snapshot->>'task_id' = $2 OR reward_snapshot->>'task_key' = $2)`,
      [userId, taskId]
    );

    if (existingRes.rows.length > 0) {
      return res.status(400).json({ message: "Task already claimed." });
    }

    const snapshot = {
      task_id: taskId,
      task_key: taskId,
      label: taskLabel,
      spins_reward: spinsReward
    };

    await pool.query(
      `INSERT INTO spinwheel_rewards (user_id, claim_status, reward_snapshot)
       VALUES ($1, 'task_completed', $2::jsonb)`,
      [userId, JSON.stringify(snapshot)]
    );

    res.json({
      success: true,
      message: `Task claimed! You earned +${spinsReward} bonus spin(s).`,
      spins_awarded: spinsReward
    });
  } catch (error) {
    console.error("[spinwheel] claim-task error:", error);
    res.status(500).json({ message: "Failed to claim task." });
  }
};

router.post("/earn-task", requireAuth, handleTaskClaim);
router.post("/claim-task", requireAuth, handleTaskClaim);

// 6. POST /api/spinwheel/spin (COCKROACHDB TYPE SAFE)
router.post("/spin", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = String(req.user.id);
    const { segments, maxFreeDaily } = await loadSegmentsAndSettings();

    if (!segments || segments.length === 0) {
      client.release();
      return res.status(400).json({ message: "No active wheel segments found in database." });
    }

    const spinStatus = await getSpinStatusForUser(userId, maxFreeDaily);
    if (!spinStatus.can_spin) {
      client.release();
      return res.status(400).json({ message: `No spins remaining today. Next spin in ${spinStatus.next_spin_in}` });
    }

    // Weighted Random Segment Selection
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

    // START TRANSACTION
    await client.query("BEGIN");

    // 1. Insert Spin (with explicit type casting)
    const spinInsertRes = await client.query(
      `INSERT INTO spinwheel_spins (user_id, prize_id, prize_snapshot, spin_status)
       VALUES ($1, $2::uuid, $3::jsonb, 'completed')
       RETURNING id`,
      [userId, prizeId, JSON.stringify(winningSegment)]
    );
    const spinId = spinInsertRes.rows[0].id;

    // 2. Increment Win Count
    if (prizeId) {
      await client.query(
        `UPDATE spinwheel_prizes SET wins_count = COALESCE(wins_count, 0) + 1 WHERE id = $1::uuid`,
        [prizeId]
      );
    }

    // 3. Record Reward (with explicit type casting)
    const isWin = winningSegment.type !== "none";
    if (isWin) {
      await client.query(
        `INSERT INTO spinwheel_rewards (user_id, spin_id, prize_id, reward_snapshot, claim_status, expires_at)
         VALUES ($1, $2::uuid, $3::uuid, $4::jsonb, 'unclaimed', NOW() + INTERVAL '30 days')`,
        [userId, spinId, prizeId, JSON.stringify(winningSegment)]
      );
    }

    // COMMIT TRANSACTION
    await client.query("COMMIT");

    res.json({
      segment_id: winningSegment.id,
      result: {
        is_win: isWin,
        label: winningSegment.label,
        emoji: winningSegment.emoji,
        type: winningSegment.type,
        value: winningSegment.value,
        is_big_win: winningSegment.is_big_win,
        color: winningSegment.color,
        bg: winningSegment.bg
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[spinwheel] /spin error:", error.message, error.stack);
    res.status(500).json({ message: "Failed to process spin. Please try again." });
  } finally {
    client.release();
  }
});

export default router;