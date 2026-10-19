import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

const router = express.Router();

// --- MIDDLEWARES ---

// Optional Auth: Attaches req.user if token is present, allows guest access
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

// Strict Auth: Blocks unauthenticated users
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

// --- DATABASE LOADER (100% DB-DRIVEN) ---

async function loadConfigFromDB() {
  const [prizesRes, tasksRes, settingsRes] = await Promise.all([
    pool.query(`
      SELECT segment_key, label, reward_type, reward_value, probability, color, background_color, emoji, is_big_win 
      FROM spinwheel_prizes 
      WHERE is_active = true 
      ORDER BY display_order ASC
    `),
    pool.query(`
      SELECT task_key, label, platform, spins_reward, destination_url 
      FROM spinwheel_tasks 
      WHERE is_active = true 
      ORDER BY display_order ASC
    `),
    pool.query(`SELECT setting_key, setting_value FROM spinwheel_settings`)
  ]);

  const settingsObj = {};
  for (const row of settingsRes.rows) {
    settingsObj[row.setting_key] = row.setting_value?.value ?? row.setting_value;
  }

  return {
    segments: prizesRes.rows.map(p => ({
      id: p.segment_key,
      label: p.label,
      type: p.reward_type,
      value: Number(p.reward_value),
      probability: Number(p.probability),
      color: p.color || "#FFFFFF",
      bg: p.background_color || "#3B82F6",
      emoji: p.emoji || "🎁",
      is_big_win: Boolean(p.is_big_win)
    })),
    tasks: tasksRes.rows.map(t => ({
      id: t.task_key,
      label: t.label,
      platform: t.platform,
      spins_reward: Number(t.spins_reward),
      url: t.destination_url
    })),
    settings: {
      MAX_FREE_DAILY: Number(settingsObj.max_free_daily || 1),
      MAX_BONUS_STACKED: Number(settingsObj.max_bonus_stacked || 10),
      COUPON_EXPIRY_DAYS: Number(settingsObj.coupon_expiry_days || 30)
    }
  };
}

// --- PUBLIC CONFIG ROUTE ---

// GET /api/spinwheel/config (Loads wheel configuration directly from DB)
router.get("/config", async (req, res) => {
  try {
    const config = await loadConfigFromDB();
    res.json(config);
  } catch (error) {
    console.error("[spinwheel] /config error:", error);
    res.status(500).json({ message: "Failed to load spinwheel config from DB" });
  }
});

// --- OPTIONAL AUTH STATE ROUTE ---

// GET /api/spinwheel/state
router.get("/state", optionalAuth, async (req, res) => {
  try {
    const config = await loadConfigFromDB();

    if (!req.user) {
      return res.json({
        isGuest: true,
        spinsRemaining: 0,
        freeSpinsAvailable: 0,
        bonusSpins: 0,
        completedTasks: []
      });
    }

    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);

    const userSpinsRes = await pool.query(
      `SELECT last_free_spin_date, daily_spins_used, bonus_spins_balance FROM spinwheel_user_spins WHERE user_id = $1`,
      [userId]
    );

    let freeSpinsAvailable = config.settings.MAX_FREE_DAILY;
    let bonusSpins = 0;

    if (userSpinsRes.rows.length > 0) {
      const row = userSpinsRes.rows[0];
      const lastDate = row.last_free_spin_date ? new Date(row.last_free_spin_date).toISOString().slice(0, 10) : null;
      if (lastDate === today) {
        freeSpinsAvailable = Math.max(0, config.settings.MAX_FREE_DAILY - row.daily_spins_used);
      }
      bonusSpins = row.bonus_spins_balance || 0;
    }

    const tasksRes = await pool.query(
      `SELECT task_id FROM spinwheel_claims WHERE user_id = $1`,
      [userId]
    );

    res.json({
      isGuest: false,
      spinsRemaining: freeSpinsAvailable + bonusSpins,
      freeSpinsAvailable,
      bonusSpins,
      completedTasks: tasksRes.rows.map(r => r.task_id)
    });
  } catch (error) {
    console.error("[spinwheel] /state error:", error);
    res.status(500).json({ message: "Failed to load spinwheel user state" });
  }
});

// --- PROTECTED ACTION ROUTES ---

// POST /api/spinwheel/spin
router.post("/spin", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const config = await loadConfigFromDB();
    const today = new Date().toISOString().slice(0, 10);

    if (!config.segments || config.segments.length === 0) {
      return res.status(400).json({ message: "No active wheel segments found in database." });
    }

    const userSpinsRes = await pool.query(
      `SELECT last_free_spin_date, daily_spins_used, bonus_spins_balance FROM spinwheel_user_spins WHERE user_id = $1`,
      [userId]
    );

    let dailyUsed = 0;
    let bonusSpins = 0;
    let lastDate = null;

    if (userSpinsRes.rows.length > 0) {
      const row = userSpinsRes.rows[0];
      lastDate = row.last_free_spin_date ? new Date(row.last_free_spin_date).toISOString().slice(0, 10) : null;
      dailyUsed = lastDate === today ? row.daily_spins_used : 0;
      bonusSpins = row.bonus_spins_balance || 0;
    }

    const freeAvailable = Math.max(0, config.settings.MAX_FREE_DAILY - dailyUsed);
    if (freeAvailable <= 0 && bonusSpins <= 0) {
      return res.status(400).json({ message: "No spins remaining today. Complete tasks for extra spins!" });
    }

    // Weighted Probability Engine
    const segments = config.segments;
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

    if (freeAvailable > 0) {
      dailyUsed += 1;
    } else {
      bonusSpins -= 1;
    }

    await pool.query(
      `INSERT INTO spinwheel_user_spins (user_id, last_free_spin_date, daily_spins_used, bonus_spins_balance)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         last_free_spin_date = EXCLUDED.last_free_spin_date,
         daily_spins_used = EXCLUDED.daily_spins_used,
         bonus_spins_balance = EXCLUDED.bonus_spins_balance`,
      [userId, today, dailyUsed, bonusSpins]
    );

    // Record win in database log
    await pool.query(
      `INSERT INTO spinwheel_logs (user_id, segment_key, prize_label, reward_type, reward_value)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, winningSegment.id, winningSegment.label, winningSegment.type, winningSegment.value]
    );

    res.json({
      winningSegment,
      spinsRemaining: Math.max(0, config.settings.MAX_FREE_DAILY - dailyUsed) + bonusSpins
    });
  } catch (error) {
    console.error("[spinwheel] /spin error:", error);
    res.status(500).json({ message: "Failed to execute spin" });
  }
});

// POST /api/spinwheel/claim-task
router.post("/claim-task", requireAuth, async (req, res) => {
  try {
    const { taskId } = req.body;
    const userId = req.user.id;
    const config = await loadConfigFromDB();

    const task = config.tasks.find(t => t.id === taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const existing = await pool.query(
      `SELECT id FROM spinwheel_claims WHERE user_id = $1 AND task_id = $2`,
      [userId, taskId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Task already claimed" });
    }

    await pool.query(
      `INSERT INTO spinwheel_claims (user_id, task_id) VALUES ($1, $2)`,
      [userId, taskId]
    );

    await pool.query(
      `INSERT INTO spinwheel_user_spins (user_id, bonus_spins_balance)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         bonus_spins_balance = spinwheel_user_spins.bonus_spins_balance + EXCLUDED.bonus_spins_balance`,
      [userId, task.spins_reward]
    );

    res.json({ message: "Task claimed successfully!", spinsReward: task.spins_reward });
  } catch (error) {
    console.error("[spinwheel] /claim-task error:", error);
    res.status(500).json({ message: "Failed to claim task" });
  }
});

export default router;