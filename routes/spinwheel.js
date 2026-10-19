import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

const router = express.Router();

// Fallback Wheel Config (Used if DB tables are empty or unreachable)
const FALLBACK_SEGMENTS = [
  { id: "seg_1", label: "₦100 Airtime", type: "airtime", value: 100, probability: 23, color: "#FF5C00", bg: "#FFF3EE", emoji: "📱", is_big_win: false },
  { id: "seg_2", label: "₦100 Coupon", type: "fixed", value: 100, probability: 14, color: "#10B981", bg: "#ECFDF5", emoji: "🎫", is_big_win: false },
  { id: "seg_3", label: "5% Discount", type: "percentage", value: 5, probability: 15, color: "#3B82F6", bg: "#EFF6FF", emoji: "🏷️", is_big_win: false },
  { id: "seg_4", label: "₦500 Coupon", type: "fixed", value: 500, probability: 7, color: "#8B5CF6", bg: "#F5F3FF", emoji: "💰", is_big_win: false },
  { id: "seg_5", label: "Try Again", type: "none", value: 0, probability: 33, color: "#6B7280", bg: "#F3F4F6", emoji: "😅", is_big_win: false },
  { id: "seg_6", label: "Free Shipping", type: "free_shipping", value: 0, probability: 5, color: "#F59E0B", bg: "#FFFBEB", emoji: "🚚", is_big_win: false },
  { id: "seg_7", label: "10% Discount", type: "percentage", value: 10, probability: 3, color: "#EF4444", bg: "#FEF2F2", emoji: "🎉", is_big_win: true }
];

const FALLBACK_TASKS = [
  { id: "inst_fol", label: "Follow on Instagram", platform: "instagram", spins_reward: 1, url: "https://instagram.com/loemart" },
  { id: "tg_join", label: "Join Telegram", platform: "telegram", spins_reward: 2, url: "https://t.me/loemart" }
];

const FALLBACK_SETTINGS = {
  MAX_FREE_DAILY: 1,
  MAX_BONUS_STACKED: 10,
  COUPON_EXPIRY_DAYS: 30
};

// --- MIDDLEWARES ---

// Optional Auth: Attaches user to req if token exists, but doesn't block guests
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    req.user = decoded;
  } catch (err) {
    req.user = null;
  }
  next();
}

// Strict Auth: Blocks request if user is not logged in
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please log in to perform this action" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
  }
}

// Helper: Fetch Config from DB with Fallback
async function loadConfigFromDB() {
  try {
    const prizesRes = await pool.query(`
      SELECT segment_key, label, reward_type, reward_value, probability, color, background_color, emoji, is_big_win
      FROM spinwheel_prizes
      WHERE is_active = true
      ORDER BY display_order
    `);

    if (prizesRes.rows.length > 0) {
      const tasksRes = await pool.query(`
        SELECT task_key, label, platform, spins_reward, destination_url
        FROM spinwheel_tasks
        WHERE is_active = true
        ORDER BY display_order
      `);

      const settingsRes = await pool.query(`SELECT setting_key, setting_value FROM spinwheel_settings`);
      const dbSettings = {};
      for (const row of settingsRes.rows) {
        dbSettings[row.setting_key] = row.setting_value?.value ?? row.setting_value;
      }

      return {
        segments: prizesRes.rows.map(p => ({
          id: p.segment_key,
          label: p.label,
          type: p.reward_type,
          value: Number(p.reward_value),
          probability: Number(p.probability),
          color: p.color,
          bg: p.background_color,
          emoji: p.emoji,
          is_big_win: p.is_big_win
        })),
        tasks: tasksRes.rows.map(t => ({
          id: t.task_key,
          label: t.label,
          platform: t.platform,
          spins_reward: Number(t.spins_reward),
          url: t.destination_url
        })),
        settings: {
          MAX_FREE_DAILY: dbSettings.max_free_daily ?? FALLBACK_SETTINGS.MAX_FREE_DAILY,
          MAX_BONUS_STACKED: dbSettings.max_bonus_stacked ?? FALLBACK_SETTINGS.MAX_BONUS_STACKED,
          COUPON_EXPIRY_DAYS: dbSettings.coupon_expiry_days ?? FALLBACK_SETTINGS.COUPON_EXPIRY_DAYS
        }
      };
    }
  } catch (err) {
    console.warn("[spinwheel] DB load failed, using fallback config:", err.message);
  }

  return {
    segments: FALLBACK_SEGMENTS,
    tasks: FALLBACK_TASKS,
    settings: FALLBACK_SETTINGS
  };
}

// --- PUBLIC ROUTE ---

// GET /api/spinwheel/config -> Loads wheel structure for EVERYONE (Guests & Logged In Users)
router.get("/config", async (req, res) => {
  try {
    const config = await loadConfigFromDB();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: "Failed to load wheel configuration" });
  }
});

// --- OPTIONAL AUTH ROUTE ---

// GET /api/spinwheel/state -> Returns user state if logged in, or default state if guest
router.get("/state", optionalAuth, async (req, res) => {
  try {
    const config = await loadConfigFromDB();

    // If Guest (Not Logged In)
    if (!req.user) {
      return res.json({
        isGuest: true,
        spinsRemaining: 0,
        freeSpinsAvailable: 0,
        bonusSpins: 0,
        completedTasks: [],
        activeCoupons: []
      });
    }

    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);

    // Fetch user spin stats from CockroachDB
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

    // Fetch user completed tasks
    const tasksRes = await pool.query(
      `SELECT task_id FROM spinwheel_claims WHERE user_id = $1`,
      [userId]
    );

    res.json({
      isGuest: false,
      spinsRemaining: freeSpinsAvailable + bonusSpins,
      freeSpinsAvailable,
      bonusSpins,
      completedTasks: tasksRes.rows.map(r => r.task_id),
    });
  } catch (error) {
    console.error("[spinwheel] /state error:", error);
    res.status(500).json({ message: "Failed to fetch user spin state" });
  }
});

// --- PROTECTED ROUTES (LOGGED-IN USERS ONLY) ---

// POST /api/spinwheel/spin -> Execute spin action
router.post("/spin", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const config = await loadConfigFromDB();
    const today = new Date().toISOString().slice(0, 10);

    // Check user spin balance
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
      return res.status(400).json({ message: "No spins available. Complete tasks to earn more!" });
    }

    // Determine winning segment based on probabilities
    const segments = config.segments;
    const totalProb = segments.reduce((acc, s) => acc + s.probability, 0);
    let rand = Math.random() * totalProb;
    let winningSegment = segments[0];

    for (const seg of segments) {
      if (rand < seg.probability) {
        winningSegment = seg;
        break;
      }
      rand -= seg.probability;
    }

    // Deduct spin count
    let useBonus = freeAvailable <= 0;
    if (useBonus) {
      bonusSpins -= 1;
    } else {
      dailyUsed += 1;
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

    // Record prize log
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
    res.status(500).json({ message: "Failed to process spin" });
  }
});

// POST /api/spinwheel/claim-task -> Claim extra spins from social tasks
router.post("/claim-task", requireAuth, async (req, res) => {
  try {
    const { taskId } = req.body;
    const userId = req.user.id;
    const config = await loadConfigFromDB();

    const task = config.tasks.find(t => t.id === taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check if task already claimed
    const existing = await pool.query(
      `SELECT id FROM spinwheel_claims WHERE user_id = $1 AND task_id = $2`,
      [userId, taskId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Task already claimed" });
    }

    // Record claim
    await pool.query(
      `INSERT INTO spinwheel_claims (user_id, task_id) VALUES ($1, $2)`,
      [userId, taskId]
    );

    // Add bonus spins
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