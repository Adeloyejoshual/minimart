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

// --- AUTH MIDDLEWARES ---

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
    return res.status(401).json({ message: "Please log in to spin or view history." });
  }
  try {
    const token = authHeader.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    next();
  } catch (err) {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}

// --- DATABASE LOADER ---

async function loadConfigFromDB() {
  const [prizesRes, tasksRes, settingsRes] = await Promise.all([
    pool.query(`
      SELECT id, segment_key, label, reward_type, reward_value, probability, color, background_color, emoji, is_big_win 
      FROM spinwheel_prizes 
      WHERE is_active = true 
      ORDER BY display_order ASC
    `),
    pool.query(`
      SELECT id, task_key, label, platform, spins_reward, destination_url 
      FROM spinwheel_tasks 
      WHERE is_active = true 
      ORDER BY display_order ASC
    `),
    pool.query(`SELECT setting_key, setting_value FROM spinwheel_settings`)
  ]);

  const settingsObj = {};
  for (const row of settingsRes.rows) {
    settingsObj[row.setting_key] = row.setting_value;
  }

  const maxDaily = parseSettingValue(settingsObj.max_free_daily, 5);
  const maxBonus = parseSettingValue(settingsObj.max_bonus_stacked, 10);
  const expiryDays = parseSettingValue(settingsObj.coupon_expiry_days, 30);

  return {
    segments: prizesRes.rows.map(p => ({
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
    })),
    tasks: tasksRes.rows.map(t => ({
      id: t.task_key,
      label: t.label,
      platform: t.platform,
      spins_reward: Number(t.spins_reward),
      url: t.destination_url
    })),
    settings: {
      MAX_FREE_DAILY: maxDaily,
      maxFreeDaily: maxDaily,
      max_free_daily: maxDaily,
      MAX_BONUS_STACKED: maxBonus,
      maxBonusStacked: maxBonus,
      COUPON_EXPIRY_DAYS: expiryDays,
      couponExpiryDays: expiryDays
    }
  };
}

// --- PUBLIC CONFIG ROUTE ---

router.get("/config", async (req, res) => {
  try {
    const config = await loadConfigFromDB();
    res.json(config);
  } catch (error) {
    console.error("[spinwheel] /config error:", error);
    res.status(500).json({ message: "Failed to load spinwheel config from DB" });
  }
});

// --- OPTIONAL AUTH STATE HANDLER ---

async function handleUserState(req, res) {
  try {
    const config = await loadConfigFromDB();
    const maxDaily = config.settings.MAX_FREE_DAILY || 5;

    if (!req.user) {
      return res.json({
        isGuest: true,
        spinsRemaining: maxDaily,
        spinsAvailable: maxDaily,
        freeSpinsAvailable: maxDaily,
        canSpin: true,
        hasSpunToday: false,
        nextSpinTime: null,
        bonusSpins: 0,
        completedTasks: []
      });
    }

    const userId = String(req.user.id);

    const spinsTodayRes = await pool.query(
      `SELECT COUNT(*) as count 
       FROM spinwheel_spins 
       WHERE user_id = $1 
         AND created_at >= (NOW() AT TIME ZONE 'UTC')::date`,
      [userId]
    );

    const spinsToday = Number(spinsTodayRes.rows[0]?.count || 0);
    const freeSpinsAvailable = Math.max(0, maxDaily - spinsToday);
    const canSpin = freeSpinsAvailable > 0;

    res.json({
      isGuest: false,
      spinsRemaining: freeSpinsAvailable,
      spinsAvailable: freeSpinsAvailable,
      freeSpinsAvailable: freeSpinsAvailable,
      canSpin: canSpin,
      hasSpunToday: !canSpin,
      nextSpinTime: canSpin ? null : new Date(Date.now() + 86400000).toISOString(),
      bonusSpins: 0,
      completedTasks: []
    });
  } catch (error) {
    console.error("[spinwheel] state error:", error);
    res.status(500).json({ message: "Failed to load user spin state" });
  }
}

// Endpoint aliases to match whatever URL the frontend calls
router.get("/state", optionalAuth, handleUserState);
router.get("/user-state", optionalAuth, handleUserState);
router.get("/me", optionalAuth, handleUserState);

// --- USER HISTORY ROUTE ---

router.get("/history", requireAuth, async (req, res) => {
  try {
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

    res.json({
      history: historyRes.rows.map(row => {
        const snapshot = typeof row.prize_snapshot === "string" 
          ? JSON.parse(row.prize_snapshot) 
          : (row.prize_snapshot || {});

        return {
          id: row.id,
          segmentKey: snapshot.id || snapshot.segment_key,
          prizeLabel: snapshot.label || "Prize",
          rewardType: snapshot.type || snapshot.reward_type || "none",
          rewardValue: Number(snapshot.value || snapshot.reward_value || 0),
          emoji: snapshot.emoji || "🎁",
          color: snapshot.color || "#FFFFFF",
          bg: snapshot.bg || snapshot.background_color || "#3B82F6",
          claimStatus: row.claim_status || "completed",
          createdAt: row.created_at
        };
      })
    });
  } catch (error) {
    console.error("[spinwheel] /history error:", error);
    res.status(500).json({ message: "Failed to fetch spin history from database" });
  }
});

// --- PROTECTED SPIN ACTION ---

router.post("/spin", requireAuth, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const config = await loadConfigFromDB();
    const maxDaily = config.settings.MAX_FREE_DAILY || 5;

    if (!config.segments || config.segments.length === 0) {
      return res.status(400).json({ message: "No active wheel segments found in database." });
    }

    const spinsTodayRes = await pool.query(
      `SELECT COUNT(*) as count 
       FROM spinwheel_spins 
       WHERE user_id = $1 
         AND created_at >= (NOW() AT TIME ZONE 'UTC')::date`,
      [userId]
    );
    const spinsToday = Number(spinsTodayRes.rows[0]?.count || 0);
    const freeAvailable = Math.max(0, maxDaily - spinsToday);

    if (freeAvailable <= 0) {
      return res.status(400).json({ message: "No spins remaining today. Come back tomorrow!" });
    }

    // Weighted Probability Algorithm
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

    // Insert spin entry
    const spinInsertRes = await pool.query(
      `INSERT INTO spinwheel_spins (user_id, prize_id, prize_snapshot, spin_status)
       VALUES ($1, $2, $3, 'completed')
       RETURNING id`,
      [userId, winningSegment.db_id || null, JSON.stringify(winningSegment)]
    );
    const spinId = spinInsertRes.rows[0].id;

    // Increment wins_count
    if (winningSegment.db_id) {
      await pool.query(
        `UPDATE spinwheel_prizes SET wins_count = COALESCE(wins_count, 0) + 1 WHERE id = $1`,
        [winningSegment.db_id]
      );
    }

    // Record reward if not 'none'
    if (winningSegment.type !== "none") {
      const expiryDays = config.settings.COUPON_EXPIRY_DAYS || 30;
      await pool.query(
        `INSERT INTO spinwheel_rewards (user_id, spin_id, prize_id, reward_snapshot, claim_status, expires_at)
         VALUES ($1, $2, $3, $4, 'unclaimed', NOW() + INTERVAL '${expiryDays} days')`,
        [userId, spinId, winningSegment.db_id || null, JSON.stringify(winningSegment)]
      );
    }

    const spinsRemaining = Math.max(0, freeAvailable - 1);

    res.json({
      winningSegment,
      spinsRemaining,
      canSpin: spinsRemaining > 0
    });
  } catch (error) {
    console.error("[spinwheel] /spin error:", error);
    res.status(500).json({ message: "Failed to process spin" });
  }
});

export default router;