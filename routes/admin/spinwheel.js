// FILE: routes/admin/spinwheel.js
// Base: /api/admin/spinwheel
//
// Protected admin endpoints for managing Spin & Win prizes,
// tasks and settings stored in the new spinwheel_* tables.
//
// The existing routes/spinwheel.js continues to read from
// spinwheel.config.js until you explicitly switch it over.

import express from "express";
import { pool } from "../../config/db.js";
import { authenticate } from "../../middleware/auth.js";

import {
  WHEEL_SEGMENTS,
  EARN_TASKS_DEF,
  SPIN_CONSTANTS,
} from "../../config/spinwheel.config.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   AUTH GUARD
════════════════════════════════════════════════════════════ */
const requireAdmin = (req, res, next) => {
  if (req.user?.role === "admin" || req.user?.is_admin === true) {
    return next();
  }
  return res.status(403).json({ success: false, message: "Admin access required." });
};

router.use(authenticate, requireAdmin);

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

/* ════════════════════════════════════════════════════════════
   SEED — populate new tables from static config (one-time)
   POST /api/admin/spinwheel/seed
════════════════════════════════════════════════════════════ */
router.post("/seed", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Prizes ── */
    const { rows: existingPrizes } = await client.query(
      "SELECT COUNT(*)::INT AS cnt FROM spinwheel_prizes"
    );
    if (existingPrizes[0].cnt === 0) {
      for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
        const s = WHEEL_SEGMENTS[i];
        await client.query(
          `INSERT INTO spinwheel_prizes
             (segment_key, label, reward_type, reward_value,
              probability, color, background_color, emoji,
              is_big_win, is_active, display_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (segment_key) DO NOTHING`,
          [
            `seg_${s.id}`, s.label, s.type, s.value,
            s.probability, s.color, s.bg, s.emoji,
            s.is_big_win ?? false, true, i,
          ]
        );
      }
    }

    /* ── Tasks ── */
    const { rows: existingTasks } = await client.query(
      "SELECT COUNT(*)::INT AS cnt FROM spinwheel_tasks"
    );
    if (existingTasks[0].cnt === 0) {
      for (let i = 0; i < EARN_TASKS_DEF.length; i++) {
        const t = EARN_TASKS_DEF[i];
        await client.query(
          `INSERT INTO spinwheel_tasks
             (task_key, label, platform, task_type, category,
              spins_reward, verification_type, destination_url,
              is_active, display_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (task_key) DO NOTHING`,
          [
            t.id, t.label, t.platform, t.type, t.category,
            t.spins_reward, t.verify_type ?? "honor", t.url ?? "",
            true, i,
          ]
        );
      }
    }

    /* ── Settings ── */
    const { rows: existingSettings } = await client.query(
      "SELECT COUNT(*)::INT AS cnt FROM spinwheel_settings"
    );
    if (existingSettings[0].cnt === 0) {
      const defaults = [
        ["max_free_daily",     SPIN_CONSTANTS.MAX_FREE_DAILY,     "Free spins per user per day"],
        ["max_bonus_stacked",  SPIN_CONSTANTS.MAX_BONUS_STACKED,  "Maximum bonus spins a user can hold"],
        ["coupon_expiry_days", SPIN_CONSTANTS.COUPON_EXPIRY_DAYS, "Days before a spin coupon expires"],
      ];
      for (const [key, val, desc] of defaults) {
        await client.query(
          `INSERT INTO spinwheel_settings (setting_key, setting_value, description)
           VALUES ($1, $2, $3)
           ON CONFLICT (setting_key) DO NOTHING`,
          [key, JSON.stringify({ value: val }), desc]
        );
      }
    }

    await client.query("COMMIT");
    return res.json({ success: true, message: "Seed complete." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin/spinwheel] seed error:", err.message);
    return fail(res, 500, "Seed failed.");
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   PRIZES
════════════════════════════════════════════════════════════ */

// GET /api/admin/spinwheel/prizes
router.get("/prizes", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, segment_key, label, reward_type, reward_value,
              probability, color, background_color, emoji,
              is_big_win, is_active, display_order,
              max_wins, wins_count, created_at, updated_at
       FROM   spinwheel_prizes
       ORDER  BY display_order`
    );
    return res.json({ success: true, prizes: rows });
  } catch (err) {
    console.error("[admin/spinwheel] get prizes:", err.message);
    return fail(res, 500, "Failed to load prizes.");
  }
});

// PUT /api/admin/spinwheel/prizes  (bulk upsert)
router.put("/prizes", async (req, res) => {
  const prizes = req.body?.prizes;
  if (!Array.isArray(prizes) || prizes.length === 0) {
    return fail(res, 400, "prizes array is required.");
  }

  /* ── Validate probabilities ── */
  const activePrizes = prizes.filter((p) => p.is_active !== false);
  const totalProb = activePrizes.reduce(
    (sum, p) => sum + Number(p.probability || 0), 0
  );
  if (Math.abs(totalProb - 100) > 0.01) {
    return fail(
      res, 400,
      `Active prize probabilities must sum to 100%. Current total: ${totalProb.toFixed(2)}%`
    );
  }

  /* ── Validate each prize ── */
  const validTypes = ["airtime", "fixed", "percentage", "free_shipping", "none"];
  for (const p of prizes) {
    if (!p.segment_key) return fail(res, 400, "Each prize needs a segment_key.");
    if (!validTypes.includes(p.reward_type)) {
      return fail(res, 400, `Invalid reward_type "${p.reward_type}".`);
    }
    if (Number(p.probability) < 0 || Number(p.probability) > 100) {
      return fail(res, 400, `Probability must be 0–100 for "${p.label}".`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (let i = 0; i < prizes.length; i++) {
      const p = prizes[i];
      await client.query(
        `INSERT INTO spinwheel_prizes
           (segment_key, label, reward_type, reward_value,
            probability, color, background_color, emoji,
            is_big_win, is_active, display_order, max_wins)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (segment_key) DO UPDATE SET
           label            = EXCLUDED.label,
           reward_type      = EXCLUDED.reward_type,
           reward_value     = EXCLUDED.reward_value,
           probability      = EXCLUDED.probability,
           color            = EXCLUDED.color,
           background_color = EXCLUDED.background_color,
           emoji            = EXCLUDED.emoji,
           is_big_win       = EXCLUDED.is_big_win,
           is_active        = EXCLUDED.is_active,
           display_order    = EXCLUDED.display_order,
           max_wins         = EXCLUDED.max_wins,
           updated_at       = now()`,
        [
          p.segment_key,
          p.label,
          p.reward_type,
          Number(p.reward_value || 0),
          Number(p.probability || 0),
          p.color || "#FF5C00",
          p.background_color || "#FFF3EE",
          p.emoji || "🎁",
          !!p.is_big_win,
          p.is_active !== false,
          i,
          p.max_wins != null ? Number(p.max_wins) : null,
        ]
      );
    }

    await client.query("COMMIT");
    return res.json({ success: true, message: "Prizes saved." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin/spinwheel] save prizes:", err.message);
    return fail(res, 500, "Failed to save prizes.");
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   TASKS
════════════════════════════════════════════════════════════ */

// GET /api/admin/spinwheel/tasks
router.get("/tasks", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, task_key, label, platform, task_type, category,
              spins_reward, verification_type, destination_url,
              is_active, display_order, created_at, updated_at
       FROM   spinwheel_tasks
       ORDER  BY display_order`
    );
    return res.json({ success: true, tasks: rows });
  } catch (err) {
    console.error("[admin/spinwheel] get tasks:", err.message);
    return fail(res, 500, "Failed to load tasks.");
  }
});

// PUT /api/admin/spinwheel/tasks  (bulk upsert)
router.put("/tasks", async (req, res) => {
  const tasks = req.body?.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return fail(res, 400, "tasks array is required.");
  }

  const validTypes = ["follow", "join"];
  const validCats  = ["social", "community"];

  for (const t of tasks) {
    if (!t.task_key) return fail(res, 400, "Each task needs a task_key.");
    if (!validTypes.includes(t.task_type)) {
      return fail(res, 400, `Invalid task_type "${t.task_type}".`);
    }
    if (!validCats.includes(t.category)) {
      return fail(res, 400, `Invalid category "${t.category}".`);
    }
    if (Number(t.spins_reward) < 1) {
      return fail(res, 400, `spins_reward must be ≥ 1 for "${t.label}".`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      await client.query(
        `INSERT INTO spinwheel_tasks
           (task_key, label, platform, task_type, category,
            spins_reward, verification_type, destination_url,
            is_active, display_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (task_key) DO UPDATE SET
           label             = EXCLUDED.label,
           platform          = EXCLUDED.platform,
           task_type         = EXCLUDED.task_type,
           category          = EXCLUDED.category,
           spins_reward      = EXCLUDED.spins_reward,
           verification_type = EXCLUDED.verification_type,
           destination_url   = EXCLUDED.destination_url,
           is_active         = EXCLUDED.is_active,
           display_order     = EXCLUDED.display_order,
           updated_at        = now()`,
        [
          t.task_key,
          t.label,
          t.platform,
          t.task_type,
          t.category,
          Number(t.spins_reward || 1),
          t.verification_type || "honor",
          t.destination_url || "",
          t.is_active !== false,
          i,
        ]
      );
    }

    await client.query("COMMIT");
    return res.json({ success: true, message: "Tasks saved." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin/spinwheel] save tasks:", err.message);
    return fail(res, 500, "Failed to save tasks.");
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   SETTINGS
════════════════════════════════════════════════════════════ */

// GET /api/admin/spinwheel/settings
router.get("/settings", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT setting_key, setting_value, description, updated_at
       FROM   spinwheel_settings
       ORDER  BY setting_key`
    );

    const settings = {};
    for (const r of rows) {
      settings[r.setting_key] = {
        value: r.setting_value?.value ?? r.setting_value,
        description: r.description,
        updated_at: r.updated_at,
      };
    }

    return res.json({ success: true, settings });
  } catch (err) {
    console.error("[admin/spinwheel] get settings:", err.message);
    return fail(res, 500, "Failed to load settings.");
  }
});

// PUT /api/admin/spinwheel/settings
router.put("/settings", async (req, res) => {
  const settings = req.body?.settings;
  if (!settings || typeof settings !== "object") {
    return fail(res, 400, "settings object is required.");
  }

  const allowedKeys = ["max_free_daily", "max_bonus_stacked", "coupon_expiry_days"];
  for (const key of Object.keys(settings)) {
    if (!allowedKeys.includes(key)) {
      return fail(res, 400, `Unknown setting: "${key}".`);
    }
    if (typeof settings[key] !== "number" || settings[key] < 0) {
      return fail(res, 400, `"${key}" must be a non-negative number.`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const [key, val] of Object.entries(settings)) {
      await client.query(
        `INSERT INTO spinwheel_settings (setting_key, setting_value)
         VALUES ($1, $2)
         ON CONFLICT (setting_key) DO UPDATE SET
           setting_value = EXCLUDED.setting_value,
           updated_at    = now()`,
        [key, JSON.stringify({ value: val })]
      );
    }

    await client.query("COMMIT");
    return res.json({ success: true, message: "Settings saved." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin/spinwheel] save settings:", err.message);
    return fail(res, 500, "Failed to save settings.");
  } finally {
    client.release();
  }
});

/* ════════════════════════════════════════════════════════════
   STATS — quick overview from existing spin_history
════════════════════════════════════════════════════════════ */
router.get("/stats", async (_req, res) => {
  try {
    const [totalRes, todayRes, winRes] = await Promise.all([
      pool.query("SELECT COUNT(*)::INT AS total FROM spin_history"),
      pool.query(
        `SELECT COUNT(*)::INT AS total FROM spin_history
         WHERE spun_at >= CURRENT_DATE`
      ),
      pool.query(
        `SELECT COUNT(*)::INT AS total FROM spin_history
         WHERE is_win = true`
      ),
    ]);

    return res.json({
      success: true,
      stats: {
        total_spins:  totalRes.rows[0]?.total ?? 0,
        today_spins:  todayRes.rows[0]?.total ?? 0,
        total_wins:   winRes.rows[0]?.total ?? 0,
      },
    });
  } catch (err) {
    console.error("[admin/spinwheel] stats:", err.message);
    return fail(res, 500, "Failed to load stats.");
  }
});

export default router;