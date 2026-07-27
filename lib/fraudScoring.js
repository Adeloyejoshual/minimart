/**
 * lib/fraudScoring.js
 * Point-based fraud detection for airtime giveaways.
 *
 * Flow:
 *   fraud event → points added to user.fraud_score
 *   ├── score ≥ warn_threshold      → user gets email warning
 *   ├── score ≥ review_threshold    → flagged for manual admin review
 *   └── score ≥ suspend_threshold   → giveaways auto-suspended
 *
 * Exports:
 *  - addFraudPoints(userId, event, extra)
 *  - isSuspended(userId)
 *  - clearFraudScore(userId, adminId)
 *  - getUserFraudProfile(userId)
 *  - EVENT_POINTS  (for reference)
 */

import { pool } from "../config/db.js";
import {
  sendAirtimeFraudWarningEmail,
  sendAirtimeGiveawaysSuspendedEmail,
} from "../services/airtimenotifications.js";

/* ═══════════════════════════════════════════════════════════════
   FRAUD EVENT → POINT MAP
   Higher = more serious offense
═══════════════════════════════════════════════════════════════ */
export const EVENT_POINTS = {
  /* Phone-sharing abuse */
  phone_limit_reached        : 3,
  suspicious_phone_pattern   : 3,   // same phone across many users historically

  /* Cooldown bypass attempts */
  cooldown_bypass_attempt    : 4,

  /* Rate limiting */
  excessive_rate_limits      : 2,
  many_requests_same_endpoint: 2,

  /* Multi-account fraud */
  many_accounts_same_ip      : 5,
  many_accounts_same_device  : 5,
  multiple_ips_same_user     : 2,

  /* Admin actions */
  claim_rejected_by_admin    : 5,
  manual_flag_by_admin       : 10,

  /* Repeat offenses (compound) */
  repeat_offender            : 3,
};

/* ═══════════════════════════════════════════════════════════════
   THRESHOLD CACHE (5-min TTL)
═══════════════════════════════════════════════════════════════ */
let thresholdCache = null;
let cacheTime      = 0;
const CACHE_TTL_MS = 5 * 60_000;

async function getThresholds() {
  if (thresholdCache && Date.now() - cacheTime < CACHE_TTL_MS) {
    return thresholdCache;
  }

  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM public.airtime_settings
       WHERE  key IN (
         'fraud_score_warn',
         'fraud_score_review',
         'fraud_score_suspend'
       )`
    );
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    thresholdCache = {
      warn    : parseInt(map.fraud_score_warn    ?? "5",  10),
      review  : parseInt(map.fraud_score_review  ?? "10", 10),
      suspend : parseInt(map.fraud_score_suspend ?? "20", 10),
    };
    cacheTime = Date.now();
    return thresholdCache;

  } catch (err) {
    console.warn("[fraud-scoring] threshold fetch failed:", err.message);
    /* Sensible fallback */
    return { warn: 5, review: 10, suspend: 20 };
  }
}

export const invalidateThresholds = () => { thresholdCache = null; };

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION HELPER — safe, non-blocking
═══════════════════════════════════════════════════════════════ */
async function safeNotify(fn, ...args) {
  try {
    await fn(...args);
  } catch (err) {
    console.warn(`[fraud-scoring] notification failed:`, err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN: addFraudPoints
   Fire-and-forget from route handlers.
═══════════════════════════════════════════════════════════════ */
export async function addFraudPoints(userId, event, extra = {}) {
  if (!userId) {
    console.warn("[fraud-scoring] addFraudPoints called without userId");
    return null;
  }

  const points = EVENT_POINTS[event] ?? 1;

  try {
    const thresholds = await getThresholds();

    /* Update user score and get current state */
    const { rows } = await pool.query(
      `UPDATE public.users
       SET    fraud_score = fraud_score + $1,
              updated_at  = NOW()
       WHERE  id = $2
       RETURNING id, name, email, fraud_score, fraud_status,
                 giveaways_suspended`,
      [points, userId]
    );

    if (!rows.length) {
      console.warn(`[fraud-scoring] user not found: ${userId}`);
      return null;
    }

    const user     = rows[0];
    const score    = Number(user.fraud_score);
    const oldStatus = user.fraud_status;

    /* Log the fraud event separately for audit trail */
    await pool.query(
      `INSERT INTO public.airtime_fraud_log
         (user_id, event, metadata, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [userId, event, JSON.stringify({ points, score_after: score, ...extra })]
    ).catch(() => {});

    /* Determine new status */
    let newStatus = oldStatus;
    let suspend   = false;

    if (score >= thresholds.suspend && oldStatus !== "suspended") {
      newStatus = "suspended";
      suspend   = true;
    } else if (score >= thresholds.review && oldStatus === "clean") {
      newStatus = "review";
    } else if (score >= thresholds.warn && oldStatus === "clean") {
      newStatus = "warned";
    }

    /* Apply status change */
    if (newStatus !== oldStatus) {
      await pool.query(
        `UPDATE public.users
         SET    fraud_status         = $1,
                fraud_status_reason  = $2,
                fraud_status_at      = NOW(),
                giveaways_suspended  = CASE
                  WHEN $1 = 'suspended' THEN true
                  ELSE giveaways_suspended
                END
         WHERE  id = $3`,
        [newStatus, `Auto: ${event} (score=${score})`, userId]
      );

      console.log(
        `[fraud-scoring] user=${userId} event="${event}" +${points}pts ` +
        `score=${score} status: ${oldStatus} → ${newStatus}`
      );

      /* Send notifications (non-blocking) */
      if (newStatus === "warned") {
        safeNotify(sendAirtimeFraudWarningEmail, {
          to   : user.email,
          name : user.name,
        });
      }

      if (newStatus === "suspended") {
        safeNotify(sendAirtimeGiveawaysSuspendedEmail, {
          to     : user.email,
          name   : user.name,
          reason : `Multiple policy violations (final: ${event.replace(/_/g, " ")})`,
        });
      }
    } else {
      /* No status change, but still log the increment */
      console.log(
        `[fraud-scoring] user=${userId} event="${event}" +${points}pts ` +
        `score=${score} status unchanged (${oldStatus})`
      );
    }

    return {
      user_id       : userId,
      event,
      points_added  : points,
      score,
      old_status    : oldStatus,
      new_status    : newStatus,
      suspended     : suspend,
      thresholds,
    };

  } catch (err) {
    console.error("[fraud-scoring] failed:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   isSuspended — cheap read
═══════════════════════════════════════════════════════════════ */
export async function isSuspended(userId) {
  if (!userId) return false;
  try {
    const { rows } = await pool.query(
      `SELECT giveaways_suspended
       FROM   public.users
       WHERE  id = $1
       LIMIT  1`,
      [userId]
    );
    return rows[0]?.giveaways_suspended === true;
  } catch (err) {
    console.error("[fraud-scoring] isSuspended failed:", err.message);
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   clearFraudScore — admin override
═══════════════════════════════════════════════════════════════ */
export async function clearFraudScore(userId, adminId = null) {
  if (!userId) throw new Error("userId is required");

  try {
    await pool.query(
      `UPDATE public.users
       SET    fraud_score          = 0,
              fraud_status         = 'clean',
              fraud_status_reason  = $2,
              fraud_status_at      = NOW(),
              giveaways_suspended  = false,
              updated_at           = NOW()
       WHERE  id = $1`,
      [
        userId,
        adminId ? `Cleared by admin ${adminId}` : "Cleared by system",
      ]
    );

    /* Log the clear action */
    await pool.query(
      `INSERT INTO public.airtime_fraud_log
         (user_id, event, metadata, created_at)
       VALUES ($1, 'fraud_score_cleared', $2, NOW())`,
      [userId, JSON.stringify({ cleared_by: adminId || "system" })]
    ).catch(() => {});

    console.log(`[fraud-scoring] cleared score for user=${userId} by admin=${adminId || "system"}`);
    return { success: true, user_id: userId };

  } catch (err) {
    console.error("[fraud-scoring] clearFraudScore failed:", err.message);
    throw err;
  }
}

/* ═══════════════════════════════════════════════════════════════
   getUserFraudProfile — read full state
═══════════════════════════════════════════════════════════════ */
export async function getUserFraudProfile(userId) {
  if (!userId) return null;

  try {
    const [userRes, eventsRes] = await Promise.all([
      pool.query(
        `SELECT id, email, name,
                fraud_score, fraud_status, fraud_status_reason, fraud_status_at,
                giveaways_suspended
         FROM   public.users
         WHERE  id = $1
         LIMIT  1`,
        [userId]
      ),
      pool.query(
        `SELECT event, metadata, created_at
         FROM   public.airtime_fraud_log
         WHERE  user_id = $1
         ORDER  BY created_at DESC
         LIMIT  20`,
        [userId]
      ),
    ]);

    if (!userRes.rows.length) return null;

    const user       = userRes.rows[0];
    const thresholds = await getThresholds();

    return {
      user_id           : user.id,
      email             : user.email,
      name              : user.name,
      score             : Number(user.fraud_score),
      status            : user.fraud_status,
      status_reason     : user.fraud_status_reason,
      status_at         : user.fraud_status_at,
      suspended         : user.giveaways_suspended,
      thresholds,
      recent_events     : eventsRes.rows.map((r) => ({
        event      : r.event,
        metadata   : r.metadata,
        created_at : r.created_at,
      })),
      distance_to_warn    : Math.max(0, thresholds.warn    - user.fraud_score),
      distance_to_review  : Math.max(0, thresholds.review  - user.fraud_score),
      distance_to_suspend : Math.max(0, thresholds.suspend - user.fraud_score),
    };

  } catch (err) {
    console.error("[fraud-scoring] getUserFraudProfile failed:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Default export — for convenience
═══════════════════════════════════════════════════════════════ */
export default {
  EVENT_POINTS,
  addFraudPoints,
  isSuspended,
  clearFraudScore,
  getUserFraudProfile,
  invalidateThresholds,
};