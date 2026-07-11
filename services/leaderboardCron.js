// ════════════════════════════════════════════════════════════
// FILE: services/leaderboardCron.js
//
// Runs automatically:
//   • 12:00 AM on the 1st of every month → monthly finalization
//   • 12:00 AM on January 1st            → yearly finalization
// ════════════════════════════════════════════════════════════

import { pool }             from "../config/db.js";
import { createNotification } from "./notifications.js";
import { sendEmail }          from "./email.js";

const IS_PROD = process.env.NODE_ENV === "production";

/* ════════════════════════════════════════════════════════════
   REWARD CONFIG — single source of truth
════════════════════════════════════════════════════════════ */
const MONTHLY_REWARDS = {
  1 : { amount: 15_000, label: "₦15,000", emoji: "🥇" },
  2 : { amount: 10_000, label: "₦10,000", emoji: "🥈" },
  3 : { amount:  5_000, label: "₦5,000",  emoji: "🥉" },
};

const YEARLY_REWARDS = {
  1 : { amount: 50_000, label: "₦50,000", emoji: "🥇" },
  2 : { amount: 30_000, label: "₦30,000", emoji: "🥈" },
  3 : { amount: 20_000, label: "₦20,000", emoji: "🥉" },
};

const VERIFIED      = `('rewarded', 'verified')`;
const BRAND         = process.env.EMAIL_BRAND   || "Loemart";
const SUPPORT       = process.env.EMAIL_SUPPORT || "support@loemart.com";
const FROM_ADDRESS  = process.env.EMAIL_FROM    || "Loemart <no-reply@loemart.com>";

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function currentPeriodKey(type) {
  const now = new Date();
  if (type === "monthly")
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return String(now.getFullYear());
}

function previousPeriodKey(type) {
  const now = new Date();
  if (type === "monthly") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return String(now.getFullYear() - 1);
}

function periodDateRange(type, key) {
  if (type === "monthly") {
    const [y, m] = key.split("-").map(Number);
    const start  = new Date(y, m - 1, 1);
    const end    = new Date(y, m, 0, 23, 59, 59);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const year  = Number(key);
  const start = new Date(year, 0, 1);
  const end   = new Date(year, 11, 31, 23, 59, 59);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatPeriodLabel(type, key) {
  if (type === "monthly") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1).toLocaleString("default", {
      month: "long", year: "numeric",
    });
  }
  return `Year ${key}`;
}

const RANK_LABELS = { 1: "1st", 2: "2nd", 3: "3rd" };

/* ════════════════════════════════════════════════════════════
   SEND WINNER EMAIL
════════════════════════════════════════════════════════════ */
async function sendWinnerEmail({ to, name, rank, reward, periodLabel }) {
  if (!to) return;

  const rankLabel   = RANK_LABELS[rank] || `${rank}th`;
  const subject     = `🏆 You won ${reward.label}! ${rankLabel} Place — ${BRAND} Referral`;
  const compType    = reward.amount >= 20_000 ? "Yearly" : "Monthly";

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#1e3a5f;padding:32px;text-align:center;border-radius:8px 8px 0 0">
        <div style="font-size:48px">${reward.emoji}</div>
        <h1 style="color:#fff;margin:12px 0 4px">Congratulations, ${name}!</h1>
        <p style="color:#93c5fd;margin:0">${BRAND} Referral Leaderboard</p>
      </div>

      <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
        <p style="font-size:18px;color:#111">
          You finished <strong>${rankLabel} place</strong> in the
          <strong>${compType} Referral Competition</strong> for
          <strong>${periodLabel}</strong>!
        </p>

        <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;
                    padding:24px;text-align:center;margin:24px 0">
          <p style="margin:0;color:#15803d;font-size:14px;font-weight:600">YOUR PRIZE</p>
          <p style="margin:8px 0 0;font-size:36px;font-weight:800;color:#15803d">
            ${reward.label}
          </p>
        </div>

        <p style="color:#374151">
          Our team will contact you within <strong>3–5 business days</strong>
          to process your payment. Make sure your account details are up to date.
        </p>

        <p style="color:#374151">
          Keep inviting friends — the next competition is already running! 🚀
        </p>

        <div style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:16px">
          <p style="color:#6b7280;font-size:13px;margin:0">
            Questions? Contact us at
            <a href="mailto:${SUPPORT}" style="color:#2563eb">${SUPPORT}</a>
          </p>
        </div>
      </div>
    </div>
  `;

  const text = [
    `Congratulations, ${name}!`,
    ``,
    `You finished ${rankLabel} place in the ${compType} Referral Competition`,
    `for ${periodLabel}!`,
    ``,
    `Your prize: ${reward.label}`,
    ``,
    `Our team will contact you within 3-5 business days to process your payment.`,
    ``,
    `Questions? ${SUPPORT}`,
    `— ${BRAND} Team`,
  ].join("\n");

  try {
    const { Resend } = await import("resend");
    const client = new Resend(process.env.RESEND_API_KEY);
    await client.emails.send({ from: FROM_ADDRESS, to, subject, html, text });
    console.log(`[leaderboardCron] ✓ winner email sent → ${to}`);
  } catch (err) {
    console.error(`[leaderboardCron] winner email failed: ${err.message}`);
  }
}

/* ════════════════════════════════════════════════════════════
   CORE FINALIZE FUNCTION
   Called by cron OR by POST /api/leaderboard/finalize
════════════════════════════════════════════════════════════ */
export async function finalizeLeaderboard(type, overridePeriodKey = null) {
  const periodType = type; // "monthly" | "yearly"
  const rewardMap  = type === "monthly" ? MONTHLY_REWARDS : YEARLY_REWARDS;

  /* Use the PREVIOUS period key when called by cron
     (cron runs on the 1st of new month / Jan 1st of new year) */
  const pKey = overridePeriodKey ?? previousPeriodKey(type);
  const { start, end } = periodDateRange(type, pKey);
  const periodLabel    = formatPeriodLabel(type, pKey);

  console.log(
    `[leaderboardCron] finalizing ${type}  period=${pKey}` +
    `  range=${start} → ${end}`
  );

  /* ── Guard: already finalized? ── */
  const { rowCount: exists } = await pool.query(
    `SELECT 1 FROM leaderboard_winners
     WHERE period_type = $1 AND period_key = $2 LIMIT 1`,
    [periodType, pKey]
  );

  if (exists) {
    console.log(`[leaderboardCron] ${pKey} already finalized — skipping`);
    return { skipped: true, reason: "already_finalized", period_key: pKey };
  }

  /* ── Top 3 for this period ── */
  const { rows: top3 } = await pool.query(
    `SELECT
       r.inviter_id                AS user_id,
       COUNT(r.id)::INT            AS total_referrals,
       u.name,
       u.first_name,
       u.email
     FROM   referrals r
     JOIN   users     u ON u.id = r.inviter_id
     WHERE  r.status IN ${VERIFIED}
       AND  r.created_at >= $1
       AND  r.created_at <= $2
       AND  u.status NOT IN ('banned', 'suspended', 'flagged')
       AND  u.email_verified = true
     GROUP BY r.inviter_id, u.name, u.first_name, u.email
     ORDER BY total_referrals DESC, MAX(r.created_at) ASC
     LIMIT 3`,
    [start, end]
  );

  if (top3.length === 0) {
    console.log(`[leaderboardCron] no qualifying referrals for ${pKey}`);
    return { skipped: true, reason: "no_qualifying_referrals", period_key: pKey };
  }

  const winners = [];

  for (let i = 0; i < top3.length; i++) {
    const rank   = i + 1;
    const row    = top3[i];
    const reward = rewardMap[rank];
    const name   = row.first_name?.trim() || row.name?.trim() || "Winner";

    /* ── Insert winner record ── */
    await pool.query(
      `INSERT INTO leaderboard_winners
         (period_type, period_key, rank, user_id,
          total_referrals, reward_amount, reward_currency, reward_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'NGN', 'pending')
       ON CONFLICT (period_type, period_key, rank) DO NOTHING`,
      [periodType, pKey, rank, row.user_id, row.total_referrals, reward.amount]
    );

    /* ── In-app notification ── */
    try {
      await createNotification({
        userId  : row.user_id,
        type    : "leaderboard_win",
        title   : `${reward.emoji} You won ${reward.label}!`,
        message :
          `Congratulations! You finished ${RANK_LABELS[rank]} place ` +
          `in the ${type === "monthly" ? "Monthly" : "Yearly"} ` +
          `Referral Competition for ${periodLabel}. ` +
          `Your prize of ${reward.label} will be processed within 3–5 business days.`,
        metadata: {
          period_type  : periodType,
          period_key   : pKey,
          rank,
          reward_amount: reward.amount,
          reward_label : reward.label,
        },
      });
    } catch (notifErr) {
      console.warn(
        `[leaderboardCron] notification failed for user=${row.user_id}:`,
        notifErr.message
      );
    }

    /* ── Winner email ── */
    if (row.email) {
      await sendWinnerEmail({
        to          : row.email,
        name,
        rank,
        reward,
        periodLabel,
      });
    }

    winners.push({
      rank,
      user_id         : row.user_id,
      name,
      total_referrals : row.total_referrals,
      reward_amount   : reward.amount,
      reward_label    : reward.label,
    });

    console.log(
      `[leaderboardCron] ✓ winner  rank=${rank}  user=${row.user_id}` +
      `  referrals=${row.total_referrals}  reward=${reward.label}`
    );
  }

  /* ── Announce to all users (optional global notification) ── */
  try {
    const announcement =
      `🏆 ${periodLabel} Referral Competition has ended! ` +
      `Congratulations to our top inviters. Check the leaderboard to see the winners!`;

    await pool.query(
      `INSERT INTO notifications
         (user_id, type, title, message, metadata)
       SELECT
         id,
         'leaderboard_announcement',
         '🏆 Leaderboard Winners Announced!',
         $1,
         $2::JSONB
       FROM users
       WHERE status NOT IN ('banned', 'suspended', 'flagged')
         AND email_verified = true`,
      [
        announcement,
        JSON.stringify({ period_type: periodType, period_key: pKey }),
      ]
    ).catch((e) =>
      console.warn("[leaderboardCron] bulk announcement failed:", e.message)
    );
  } catch (_) {}

  console.log(
    `[leaderboardCron] ✓ finalized  type=${type}  period=${pKey}` +
    `  winners=${winners.length}`
  );

  return { success: true, period_key: pKey, type, winners };
}

/* ════════════════════════════════════════════════════════════
   CRON SCHEDULER
   Call initLeaderboardCron() once at app startup.
════════════════════════════════════════════════════════════ */
export function initLeaderboardCron() {
  if (!IS_PROD) {
    console.log("[leaderboardCron] dev mode — cron disabled");
    return;
  }

  console.log("[leaderboardCron] initializing cron jobs…");

  /* ── Check every minute ── */
  setInterval(async () => {
    const now = new Date();
    const h   = now.getHours();
    const m   = now.getMinutes();
    const d   = now.getDate();
    const mo  = now.getMonth(); // 0-indexed

    /* Monthly: 1st of every month at 00:00 */
    if (d === 1 && h === 0 && m === 0) {
      console.log("[leaderboardCron] ⏰ running monthly finalization…");
      finalizeLeaderboard("monthly").catch((err) =>
        console.error("[leaderboardCron] monthly error:", err.message)
      );
    }

    /* Yearly: January 1st at 00:00 */
    if (d === 1 && mo === 0 && h === 0 && m === 0) {
      console.log("[leaderboardCron] ⏰ running yearly finalization…");
      finalizeLeaderboard("yearly").catch((err) =>
        console.error("[leaderboardCron] yearly error:", err.message)
      );
    }
  }, 60_000); // check every minute

  console.log("[leaderboardCron] ✓ cron jobs active");
}