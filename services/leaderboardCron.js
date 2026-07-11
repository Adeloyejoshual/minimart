// ════════════════════════════════════════════════════════════
// FILE: services/leaderboardCron.js
// ════════════════════════════════════════════════════════════

import { pool }               from "../config/db.js";
import { createNotification } from "./notifications.js";

// ✅ Import only what email.js actually exports
// We do NOT import sendEmail — it's not exported.
// Winner emails are sent directly via Resend inside this file.

const IS_PROD      = process.env.NODE_ENV === "production";
const BRAND        = process.env.EMAIL_BRAND   || "Loemart";
const SUPPORT      = process.env.EMAIL_SUPPORT || "support@loemart.com";
const FROM_ADDRESS = process.env.EMAIL_FROM    || "Loemart <no-reply@loemart.com>";

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

const VERIFIED    = `('rewarded', 'verified')`;
const RANK_LABELS = { 1: "1st", 2: "2nd", 3: "3rd" };

/* ════════════════════════════════════════════════════════════
   RESEND CLIENT
   ✅ Self-contained — no dependency on email.js
════════════════════════════════════════════════════════════ */
let _resend = null;

function getResendClient() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(
      "[leaderboardCron] RESEND_API_KEY not set — winner emails skipped"
    );
    return null;
  }
  try {
    const { Resend } = await import("resend").catch(() => ({ Resend: null }));
    if (!Resend) return null;
    _resend = new Resend(key);
    return _resend;
  } catch {
    return null;
  }
}

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

/* ════════════════════════════════════════════════════════════
   SEND WINNER EMAIL
   ✅ Uses Resend directly — no dependency on email.js
════════════════════════════════════════════════════════════ */
async function sendWinnerEmail({ to, name, rank, reward, periodLabel, type }) {
  if (!to) {
    console.warn("[leaderboardCron] sendWinnerEmail — no email address, skipping");
    return;
  }

  const rankLabel = RANK_LABELS[rank] || `${rank}th`;
  const compType  = type === "yearly" ? "Yearly" : "Monthly";
  const subject   = `${reward.emoji} You won ${reward.label}! — ${BRAND} ${compType} Leaderboard`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${subject}</title>
  <style>
    body{margin:0;padding:0;background:#060b14;
         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
    .outer{padding:40px 16px 60px;background:#060b14;}
    .card{background:#0d1523;border-radius:16px;max-width:520px;
          margin:0 auto;overflow:hidden;
          border:1px solid rgba(255,255,255,0.07);}
    .top{padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.07);}
    .brand{font-size:22px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px;}
    .brand-dot{color:#FF5C00;}
    .body{padding:32px;}
    h2{font-size:20px;font-weight:700;color:#f1f5f9;margin:0 0 12px;}
    p{font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 14px;}
    strong{color:#f1f5f9;}
    .prize-box{
      background:rgba(22,163,74,0.10);
      border:1px solid rgba(22,163,74,0.30);
      border-radius:12px;padding:24px;
      margin:24px 0;text-align:center;
    }
    .prize-label{font-size:13px;font-weight:700;
                 color:#4ade80;text-transform:uppercase;letter-spacing:1px;}
    .prize-amount{font-size:40px;font-weight:800;color:#4ade80;margin:8px 0 0;}
    .info{background:#111c2d;border-radius:10px;
          padding:14px 18px;margin:16px 0;
          font-size:13px;color:#94a3b8;line-height:1.6;}
    .footer{padding:18px 32px 24px;
            border-top:1px solid rgba(255,255,255,0.07);
            font-size:11px;color:#475569;text-align:center;}
    .footer a{color:#FF5C00;text-decoration:none;}
  </style>
</head>
<body>
  <div class="outer">
    <div class="card">
      <div class="top">
        <span class="brand">Loe<span class="brand-dot">mart</span></span>
      </div>
      <div class="body">
        <h2>Congratulations, ${name}! ${reward.emoji}</h2>
        <p>
          You finished <strong>${rankLabel} place</strong> in the
          <strong>${compType} Referral Competition</strong> for
          <strong>${periodLabel}</strong>.
        </p>
        <div class="prize-box">
          <div class="prize-label">Your Prize</div>
          <div class="prize-amount">${reward.label}</div>
        </div>
        <div class="info">
          Our team will contact you within <strong style="color:#f1f5f9">
          3–5 business days</strong> to process your payment.
          Make sure your account details are up to date.
        </div>
        <p>
          Keep inviting — the next competition is already running! 🚀
        </p>
        <p>
          Questions?
          <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a>
        </p>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} ${BRAND}. All rights reserved.<br/>
        <a href="mailto:${SUPPORT}">${SUPPORT}</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = [
    `Congratulations, ${name}!`,
    ``,
    `You finished ${rankLabel} place in the ${compType} Referral Competition`,
    `for ${periodLabel}.`,
    ``,
    `Your prize: ${reward.label}`,
    ``,
    `Our team will contact you within 3-5 business days to process payment.`,
    ``,
    `Questions? ${SUPPORT}`,
    `— ${BRAND}`,
  ].join("\n");

  /* ── Dev mode: print to console instead of sending ── */
  if (!IS_PROD) {
    console.log("\n" + "═".repeat(60));
    console.log("[leaderboardCron] 📧 DEV — winner email (not sent)");
    console.log(`   To      : ${to}`);
    console.log(`   Subject : ${subject}`);
    console.log(`   Prize   : ${reward.label}`);
    console.log("═".repeat(60) + "\n");
    return;
  }

  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn("[leaderboardCron] RESEND_API_KEY not set — email skipped");
      return;
    }
    const { Resend } = await import("resend");
    const client = new Resend(key);
    const result = await client.emails.send({
      from    : FROM_ADDRESS,
      to,
      subject,
      html,
      text,
    });
    console.log(`[leaderboardCron] ✓ winner email sent → ${to}  id=${result?.data?.id ?? "?"}`);
  } catch (err) {
    /* Non-fatal — winner is still recorded even if email fails */
    console.error(`[leaderboardCron] winner email failed: ${err.message}`);
  }
}

/* ════════════════════════════════════════════════════════════
   CORE FINALIZE
════════════════════════════════════════════════════════════ */
export async function finalizeLeaderboard(type, overridePeriodKey = null) {
  const rewardMap = type === "monthly" ? MONTHLY_REWARDS : YEARLY_REWARDS;

  /* When called by cron use PREVIOUS period;
     when called manually use current or override */
  const pKey = overridePeriodKey ?? previousPeriodKey(type);
  const { start, end } = periodDateRange(type, pKey);
  const periodLabel    = formatPeriodLabel(type, pKey);
  const periodType     = type === "monthly" ? "monthly" : "yearly";

  console.log(
    `[leaderboardCron] finalizing ${type}  period=${pKey}` +
    `  range=${start} → ${end}`
  );

  /* ── Already finalized? ── */
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
    return {
      skipped    : true,
      reason     : "no_qualifying_referrals",
      period_key : pKey,
    };
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
      [periodType, pKey, rank, row.user_id,
       row.total_referrals, reward.amount]
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
        `[leaderboardCron] notification failed user=${row.user_id}:`,
        notifErr.message
      );
    }

    /* ── Winner email ── */
    await sendWinnerEmail({
      to          : row.email,
      name,
      rank,
      reward,
      periodLabel,
      type,
    });

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

  /* ── Global announcement ── */
  try {
    const msg =
      `${formatPeriodLabel(type, pKey)} Referral Competition has ended! ` +
      `Check the leaderboard to see the winners!`;

    await pool.query(
      `INSERT INTO notifications
         (user_id, type, title, message, metadata)
       SELECT
         id,
         'leaderboard_announcement',
         'Leaderboard Winners Announced',
         $1,
         $2::JSONB
       FROM users
       WHERE status NOT IN ('banned', 'suspended', 'flagged')
         AND email_verified = true`,
      [
        msg,
        JSON.stringify({ period_type: periodType, period_key: pKey }),
      ]
    ).catch((e) =>
      console.warn("[leaderboardCron] bulk announce failed:", e.message)
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
   Call once at app startup.
════════════════════════════════════════════════════════════ */
export function initLeaderboardCron() {
  if (!IS_PROD) {
    console.log("[leaderboardCron] dev mode — cron disabled (won't run)");
    return;
  }

  console.log("[leaderboardCron] ✓ cron initialized — checking every minute");

  setInterval(() => {
    const now = new Date();
    const h   = now.getUTCHours();
    const m   = now.getUTCMinutes();
    const d   = now.getUTCDate();
    const mo  = now.getUTCMonth(); // 0-indexed

    /* Monthly: 1st of every month at 00:00 UTC */
    if (d === 1 && h === 0 && m === 0) {
      console.log("[leaderboardCron] ⏰ triggering monthly finalization…");
      finalizeLeaderboard("monthly").catch((err) =>
        console.error("[leaderboardCron] monthly error:", err.message)
      );
    }

    /* Yearly: January 1st at 00:00 UTC */
    if (d === 1 && mo === 0 && h === 0 && m === 0) {
      console.log("[leaderboardCron] ⏰ triggering yearly finalization…");
      finalizeLeaderboard("yearly").catch((err) =>
        console.error("[leaderboardCron] yearly error:", err.message)
      );
    }
  }, 60_000);
}