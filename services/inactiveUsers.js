// ════════════════════════════════════════════════════════════
// FILE: services/inactiveUsers.js
// ════════════════════════════════════════════════════════════
//
// Inactive-user re-engagement service — powered by Resend.
//
// What it does:
//  1. Finds users who haven't logged in for X days, whose
//     listings (if any) are going stale or already expired.
//  2. Sends a staged sequence of re-engagement emails:
//        Stage 1 — "We miss you"          (14 days idle)
//        Stage 2 — "Your listings expiring" (30 days idle)
//        Stage 3 — "Last chance"           (60 days idle)
//  3. Optionally pauses/deactivates very old idle listings
//     after 90 days so the marketplace stays fresh.
//  4. All sends are logged to inactive_user_logs (idempotent —
//     safe to re-run; same stage won't send twice per window).
//
// Designed to be called from a daily cron job.
//
// ════════════════════════════════════════════════════════════

import { Resend } from "resend";
import { pool }   from "../config/db.js";

/* ════════════════════════════════════════════════════════════
   RESEND CLIENT  (lazy singleton)
════════════════════════════════════════════════════════════ */
let _resend = null;

function getClient() {
  if (_resend) return _resend;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(
      "[inactive] ⚠  RESEND_API_KEY not set — dry-run/console fallback"
    );
    return null;
  }

  try {
    _resend = new Resend(key);
    console.log("[inactive] ✓ Resend client ready");
    return _resend;
  } catch (err) {
    console.error("[inactive] ✗ Resend init failed:", err.message);
    return null;
  }
}

getClient();

/* ════════════════════════════════════════════════════════════
   BRAND / ENV
════════════════════════════════════════════════════════════ */
const FROM_ADDRESS = process.env.EMAIL_FROM     || "Loemart <no-reply@loemart.com>";
const BRAND        = process.env.EMAIL_BRAND    || "Loemart";
const SUPPORT      = process.env.EMAIL_SUPPORT  || "support@loemart.com";
const FRONTEND_URL = (process.env.FRONTEND_URL  || "https://loemart.com").replace(/\/$/, "");
const YEAR         = new Date().getFullYear();
const IS_PROD      = process.env.NODE_ENV === "production";

/* ════════════════════════════════════════════════════════════
   CONFIG
════════════════════════════════════════════════════════════ */
const CFG = Object.freeze({
  BATCH_SIZE           : parseInt(process.env.IU_BATCH_SIZE      ?? "40",   10),
  BATCH_DELAY_MS       : parseInt(process.env.IU_BATCH_DELAY_MS  ?? "1200", 10),
  MAX_RETRIES          : 2,
  RETRY_DELAY_MS       : 800,
  DRY_RUN              : process.env.IU_DRY_RUN === "true" || !IS_PROD,

  /** Stage definitions — days since last_login_at */
  STAGES: [
    { key: "miss_you",         daysIdle: 14,  minGapDays: 13 },
    { key: "listings_expiring", daysIdle: 30,  minGapDays: 14 },
    { key: "last_chance",      daysIdle: 60,  minGapDays: 28 },
  ],

  /** Auto-deactivate listings after this many days idle */
  AUTO_DEACTIVATE_DAYS : 90,

  /** Max users processed per run (safety cap) */
  MAX_PER_RUN          : parseInt(process.env.IU_MAX_PER_RUN ?? "2000", 10),
});

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const formatNumber = (n) =>
  new Intl.NumberFormat("en-NG").format(Number(n ?? 0));

const escHtml = (str) =>
  String(str ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");

const daysAgo = (d) =>
  Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);

const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

/* ════════════════════════════════════════════════════════════
   DATA FETCHERS
════════════════════════════════════════════════════════════ */

/**
 * Fetch users idle for at least `minDays`, optionally capped.
 * Excludes banned/deleted/flagged and already-emailed within minGapDays.
 */
async function fetchIdleUsers(stage) {
  const { rows } = await pool.query(
    `SELECT
       u.id,
       u.email,
       u.name,
       u.last_login_at,
       u.created_at,
       (
         SELECT COUNT(*)::INT
         FROM   public.products p
         WHERE  p.seller_id = u.id
           AND  p.status IN ('active', 'active_limited')
           AND  p.is_active = TRUE
       ) AS active_listings,
       (
         SELECT COUNT(*)::INT
         FROM   public.products p
         WHERE  p.seller_id = u.id
           AND  p.status    = 'active_limited'
           AND  p.active_until IS NOT NULL
           AND  p.active_until <= NOW() + INTERVAL '7 days'
       ) AS expiring_listings,
       (
         SELECT COUNT(*)::INT
         FROM   public.products p
         WHERE  p.seller_id = u.id
       ) AS total_listings
     FROM   public.users u
     WHERE  u.email_verified = TRUE
       AND  u.status NOT IN ('banned', 'deleted', 'flagged')
       AND  u.last_login_at IS NOT NULL
       AND  u.last_login_at <= NOW() - INTERVAL '${stage.daysIdle} days'
       AND  NOT EXISTS (
         SELECT 1 FROM public.inactive_user_logs il
         WHERE  il.user_id   = u.id
           AND  il.stage_key = $1
           AND  il.sent_at   >= NOW() - INTERVAL '${stage.minGapDays} days'
           AND  il.status    = 'sent'
       )
     ORDER  BY u.last_login_at ASC
     LIMIT  $2`,
    [stage.key, CFG.MAX_PER_RUN]
  );
  return rows;
}

/** Count of new listings created this week (for the email) */
async function fetchNewListingsCount() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::INT AS count
     FROM   public.products
     WHERE  created_at >= NOW() - INTERVAL '7 days'
       AND  status <> 'deleted'`
  );
  return rows[0]?.count ?? 0;
}

/** Active user count (social proof) */
async function fetchActiveUserCount() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::INT AS count
     FROM   public.users
     WHERE  last_login_at >= NOW() - INTERVAL '7 days'
       AND  status NOT IN ('banned', 'deleted')`
  );
  return rows[0]?.count ?? 0;
}

/* ════════════════════════════════════════════════════════════
   AUTO-DEACTIVATE STALE LISTINGS
════════════════════════════════════════════════════════════ */
async function deactivateStaleListings() {
  const { rowCount } = await pool.query(
    `UPDATE public.products
     SET    is_active   = FALSE,
            status      = 'paused',
            updated_at  = NOW()
     WHERE  is_active   = TRUE
       AND  status      IN ('active', 'active_limited')
       AND  seller_id   IN (
         SELECT id FROM public.users
         WHERE  last_login_at IS NOT NULL
           AND  last_login_at <= NOW() - INTERVAL '${CFG.AUTO_DEACTIVATE_DAYS} days'
           AND  status NOT IN ('banned', 'deleted')
       )
     RETURNING id`
  );

  if (rowCount > 0) {
    console.log(
      `[inactive] ✓ Auto-deactivated ${rowCount} stale listing(s) ` +
      `(owners idle >${CFG.AUTO_DEACTIVATE_DAYS} days)`
    );
  }

  return rowCount;
}

/* ════════════════════════════════════════════════════════════
   LOG HELPER
════════════════════════════════════════════════════════════ */
async function logSend(userId, stageKey, status, errorMsg = null) {
  try {
    await pool.query(
      `INSERT INTO public.inactive_user_logs
         (user_id, stage_key, status, error_message, sent_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, stageKey, status, errorMsg]
    );
  } catch (err) {
    console.warn(`[inactive] log write failed user=${userId}:`, err.message);
  }
}

/* ════════════════════════════════════════════════════════════
   EMAIL TEMPLATES
════════════════════════════════════════════════════════════ */

/* ── Shared inline styles ── */
const S = {
  body    : `margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;`,
  card    : `max-width:600px;width:100%;`,
  header  : `border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;`,
  bodyTd  : `background:#fff;padding:36px 40px;`,
  footer  : `background:#f3f4f6;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;`,
  h1      : `margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-.3px;`,
  h2      : `margin:0 0 16px;font-size:18px;font-weight:700;color:#111827;`,
  p       : `margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;`,
  ctaGreen: `display:inline-block;background:#16a34a;color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:.2px;`,
  ctaBlue : `display:inline-block;background:#2563eb;color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:.2px;`,
  ctaAmber: `display:inline-block;background:#d97706;color:#fff;font-size:14px;font-weight:700;padding:11px 28px;border-radius:7px;text-decoration:none;`,
  stat    : `margin:0;font-size:22px;font-weight:800;color:#15803d;`,
  label   : `margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;`,
  divider : `border:none;border-top:1px solid #f3f4f6;margin:0 0 28px;`,
  alert   : `background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px 24px;margin-bottom:28px;`,
  info    : `background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin-bottom:28px;`,
};

/** Per-stage content config */
const STAGE_CONTENT = {
  miss_you: {
    emoji      : "👋",
    subject    : `We miss you on ${BRAND}!`,
    headline   : "We Miss You! 👋",
    headerBg   : "linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)",
    previewText: `It's been a while — here's what you've been missing on ${BRAND}`,
    getBody    : (user, stats) => {
      const firstName = escHtml((user.name ?? "").split(" ")[0] || "there");
      const idle      = daysAgo(user.last_login_at);
      return `
        <p style="${S.p}">
          Hi <strong>${firstName}</strong>,
        </p>
        <p style="${S.p}">
          It's been <strong>${idle} days</strong> since you last visited
          ${escHtml(BRAND)}. A lot has happened while you were away!
        </p>

        <!-- Stats -->
        <div style="${S.info}">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding:8px;">
                <p style="${S.stat}">${formatNumber(stats.newListings)}</p>
                <p style="${S.label}">New Listings This Week</p>
              </td>
              <td align="center" style="padding:8px;">
                <p style="${S.stat}">${formatNumber(stats.activeUsers)}</p>
                <p style="${S.label}">Active Users</p>
              </td>
            </tr>
          </table>
        </div>

        <p style="${S.p}">
          Whether you're looking to buy or sell, there's never been a
          better time to jump back in. New deals are posted every minute!
        </p>`;
    },
    ctaText  : "See What's New →",
    ctaUrl   : `${FRONTEND_URL}/browse`,
    ctaStyle : "ctaBlue",
  },

  listings_expiring: {
    emoji      : "⏰",
    subject    : `Your listings need attention on ${BRAND}`,
    headline   : "Your Listings Need You ⏰",
    headerBg   : "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)",
    previewText: "Some of your listings are about to expire — take action now",
    getBody    : (user, _stats) => {
      const firstName = escHtml((user.name ?? "").split(" ")[0] || "there");
      const idle      = daysAgo(user.last_login_at);
      return `
        <p style="${S.p}">
          Hi <strong>${firstName}</strong>,
        </p>
        <p style="${S.p}">
          You haven't logged in for <strong>${idle} days</strong>, and
          some of your listings need attention.
        </p>

        <!-- Alert box -->
        <div style="${S.alert}">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:4px 0;">
                <p style="margin:0;font-size:14px;color:#991b1b;">
                  <strong>📦 Active listings:</strong> ${user.active_listings}
                </p>
              </td>
            </tr>
            ${user.expiring_listings > 0
              ? `<tr>
                   <td style="padding:4px 0;">
                     <p style="margin:0;font-size:14px;color:#991b1b;">
                       <strong>⚠️ Expiring soon:</strong> ${user.expiring_listings}
                     </p>
                   </td>
                 </tr>`
              : ""}
            <tr>
              <td style="padding:4px 0;">
                <p style="margin:0;font-size:14px;color:#991b1b;">
                  <strong>📅 Days since last visit:</strong> ${idle}
                </p>
              </td>
            </tr>
          </table>
        </div>

        <p style="${S.p}">
          Buyers are searching for items like yours right now.
          Log in to refresh your listings, update prices, or add
          new products to keep the sales coming.
        </p>`;
    },
    ctaText  : "Manage Your Listings →",
    ctaUrl   : `${FRONTEND_URL}/dashboard/listings`,
    ctaStyle : "ctaAmber",
  },

  last_chance: {
    emoji      : "🚨",
    subject    : `Last chance — your ${BRAND} listings may be removed`,
    headline   : "Last Chance Before Cleanup 🚨",
    headerBg   : "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)",
    previewText: `Your listings will be paused soon if you don't log in to ${BRAND}`,
    getBody    : (user, _stats) => {
      const firstName = escHtml((user.name ?? "").split(" ")[0] || "there");
      const idle      = daysAgo(user.last_login_at);
      const daysLeft  = Math.max(0, CFG.AUTO_DEACTIVATE_DAYS - idle);
      return `
        <p style="${S.p}">
          Hi <strong>${firstName}</strong>,
        </p>
        <p style="${S.p}">
          It's been <strong>${idle} days</strong> since you last
          visited ${escHtml(BRAND)}.
        </p>

        <div style="${S.alert}">
          <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#991b1b;">
            ⚠️ Automatic cleanup in ${daysLeft > 0 ? `${daysLeft} days` : "progress"}
          </p>
          <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.6;">
            To keep our marketplace fresh, we automatically pause
            listings from accounts that have been inactive for
            ${CFG.AUTO_DEACTIVATE_DAYS}+ days.
            ${user.active_listings > 0
              ? `<br /><br />Your <strong>${user.active_listings} active listing${
                  user.active_listings !== 1 ? "s" : ""
                }</strong> will be paused unless you log in.`
              : ""}
          </p>
        </div>

        <p style="${S.p}">
          <strong>All you need to do is log in</strong> — your listings
          will stay active and visible to buyers. It takes 10 seconds.
        </p>`;
    },
    ctaText  : "Log In Now →",
    ctaUrl   : `${FRONTEND_URL}/login`,
    ctaStyle : "ctaGreen",
  },
};

/* ── Build full HTML for any stage ── */
function buildHtml(stageKey, user, stats) {
  const cfg       = STAGE_CONTENT[stageKey];
  const body      = cfg.getBody(user, stats);
  const unsubUrl  = `${FRONTEND_URL}/settings/notifications`;
  const ctaStyle  = S[cfg.ctaStyle] ?? S.ctaGreen;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escHtml(cfg.subject)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="${S.body}">

<!-- PREVIEW TEXT -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
  ${escHtml(cfg.previewText)}
  &nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;
</div>

<!-- OUTER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#f9fafb;padding:32px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0"
             style="${S.card}">

        <!-- HEADER -->
        <tr>
          <td style="${S.header}background:${cfg.headerBg};">
            <h1 style="${S.h1}">${escHtml(cfg.headline)}</h1>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="${S.bodyTd}">
            ${body}

            <hr style="${S.divider}" />

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${escHtml(cfg.ctaUrl)}"
                     style="${ctaStyle}">
                    ${escHtml(cfg.ctaText)}
                  </a>
                </td>
              </tr>
            </table>

            <!-- Sell CTA (all stages) -->
            <div style="background:linear-gradient(135deg,#fefce8,#fef9c3);
                         border:1px solid #fde68a;border-radius:12px;
                         padding:20px 24px;">
              <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#92400e;">
                💡 Tip: Fresh listings get 5× more views
              </h3>
              <p style="margin:0 0 14px;font-size:14px;color:#78350f;line-height:1.6;">
                Update your prices, add new photos, or list something new
                to boost your visibility on ${escHtml(BRAND)}.
              </p>
              <a href="${FRONTEND_URL}/sell" style="${S.ctaAmber}">
                Post a Free Listing →
              </a>
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="${S.footer}">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.6;">
              You're receiving this because you have an account on
              <strong>${escHtml(BRAND)}</strong>.<br />
              We only send re-engagement emails when you've been away.
            </p>
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">
              Questions? Contact us at
              <a href="mailto:${escHtml(SUPPORT)}"
                 style="color:#6b7280;">${escHtml(SUPPORT)}</a>
            </p>
            <p style="margin:0;font-size:12px;">
              <a href="${unsubUrl}"
                 style="color:#6b7280;text-decoration:underline;">
                Manage notification preferences
              </a>
              &nbsp;·&nbsp;
              <a href="${FRONTEND_URL}/privacy"
                 style="color:#6b7280;text-decoration:underline;">
                Privacy Policy
              </a>
            </p>
            <p style="margin:12px 0 0;font-size:11px;color:#d1d5db;">
              © ${YEAR} ${escHtml(BRAND)}. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`.trim();
}

/* ── Plain-text fallback ── */
function buildText(stageKey, user, stats) {
  const cfg       = STAGE_CONTENT[stageKey];
  const firstName = (user.name ?? "").split(" ")[0] || "there";
  const idle      = daysAgo(user.last_login_at);

  const lines = [
    `Hi ${firstName},`,
    ``,
  ];

  switch (stageKey) {
    case "miss_you":
      lines.push(
        `It's been ${idle} days since you last visited ${BRAND}.`,
        `A lot has happened while you were away!`,
        ``,
        `This week:`,
        `  New listings : ${formatNumber(stats.newListings)}`,
        `  Active users : ${formatNumber(stats.activeUsers)}`,
        ``,
        `See what's new: ${cfg.ctaUrl}`,
      );
      break;

    case "listings_expiring":
      lines.push(
        `You haven't logged in for ${idle} days, and some of your`,
        `listings need attention.`,
        ``,
        `  Active listings  : ${user.active_listings}`,
        `  Expiring soon    : ${user.expiring_listings}`,
        ``,
        `Manage your listings: ${cfg.ctaUrl}`,
      );
      break;

    case "last_chance": {
      const daysLeft = Math.max(0, CFG.AUTO_DEACTIVATE_DAYS - idle);
      lines.push(
        `It's been ${idle} days since you last visited ${BRAND}.`,
        ``,
        `To keep the marketplace fresh, we automatically pause`,
        `listings from accounts idle for ${CFG.AUTO_DEACTIVATE_DAYS}+ days.`,
        daysLeft > 0
          ? `Your listings will be paused in ${daysLeft} days.`
          : `Cleanup is already in progress.`,
        ``,
        `All you need to do is log in: ${cfg.ctaUrl}`,
      );
      break;
    }
  }

  lines.push(
    ``,
    `── POST A FREE LISTING ──────────────────────────`,
    `  ${FRONTEND_URL}/sell`,
    ``,
    `── MANAGE PREFERENCES ───────────────────────────`,
    `  ${FRONTEND_URL}/settings/notifications`,
    ``,
    `Questions? Contact us at ${SUPPORT}`,
    ``,
    `© ${YEAR} ${BRAND}. All rights reserved.`,
  );

  return lines.join("\n");
}

/* ════════════════════════════════════════════════════════════
   SEND ONE EMAIL  (with retry)
════════════════════════════════════════════════════════════ */
async function sendToOne(resend, user, stageKey, html, text) {
  const cfg = STAGE_CONTENT[stageKey];

  /* DRY RUN */
  if (CFG.DRY_RUN || !resend) {
    console.log(
      `[inactive] DRY-RUN — stage=${stageKey} ` +
      `user=${user.id} email=${user.email}`
    );
    await logSend(user.id, stageKey, "sent");
    return { ok: true };
  }

  let lastErr = null;

  for (let attempt = 1; attempt <= CFG.MAX_RETRIES + 1; attempt++) {
    try {
      const { error } = await resend.emails.send({
        from     : FROM_ADDRESS,
        to       : [user.email],
        reply_to : SUPPORT,
        subject  : cfg.subject,
        html,
        text,
        headers  : {
          "X-Reengagement-Stage": stageKey,
          "List-Unsubscribe"    : `<${FRONTEND_URL}/settings/notifications>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          "Precedence"          : "bulk",
        },
        tags: [
          { name: "category", value: "reengagement" },
          { name: "stage",    value: stageKey        },
        ],
      });

      if (error) throw new Error(error.message ?? JSON.stringify(error));

      await logSend(user.id, stageKey, "sent");
      return { ok: true };

    } catch (err) {
      lastErr = err;
      console.warn(
        `[inactive] send attempt ${attempt} failed ` +
        `stage=${stageKey} user=${user.id}: ${err.message}`
      );
      if (attempt <= CFG.MAX_RETRIES) {
        await sleep(CFG.RETRY_DELAY_MS * attempt);
      }
    }
  }

  await logSend(
    user.id,
    stageKey,
    "failed",
    lastErr?.message ?? "unknown error"
  );
  return { ok: false, error: lastErr?.message };
}

/* ════════════════════════════════════════════════════════════
   MAIN EXPORT
════════════════════════════════════════════════════════════ */

/**
 * processInactiveUsers()
 *
 * Runs all 3 re-engagement stages + optional auto-deactivation.
 * Safe to call daily — idempotent per stage per user per window.
 *
 * Returns:
 * {
 *   stages: [
 *     { key: "miss_you",          total: 120, sent: 118, failed: 2 },
 *     { key: "listings_expiring", total:  45, sent:  45, failed: 0 },
 *     { key: "last_chance",       total:  12, sent:  12, failed: 0 },
 *   ],
 *   deactivated_listings : 8,
 *   duration_ms          : 32100,
 * }
 */
export async function processInactiveUsers() {
  const startedAt = Date.now();
  const resend    = getClient();

  console.log(
    `\n[inactive] ══ START  dry_run=${CFG.DRY_RUN}  ` +
    `date=${todayKey()}  resend=${!!resend} ══`
  );

  /* ── Shared stats for email content ── */
  const [newListings, activeUsers] = await Promise.all([
    fetchNewListingsCount(),
    fetchActiveUserCount(),
  ]);
  const stats = { newListings, activeUsers };

  console.log(
    `[inactive] platform stats — ` +
    `newListings=${newListings}  activeUsers=${activeUsers}`
  );

  /* ── Process each stage ── */
  const stageResults = [];

  for (const stage of CFG.STAGES) {
    const users = await fetchIdleUsers(stage);

    console.log(
      `[inactive] stage="${stage.key}"  ` +
      `daysIdle>=${stage.daysIdle}  eligible=${users.length}`
    );

    if (users.length === 0) {
      stageResults.push({ key: stage.key, total: 0, sent: 0, failed: 0 });
      continue;
    }

    let sent   = 0;
    let failed = 0;
    const totalBatches = Math.ceil(users.length / CFG.BATCH_SIZE);

    for (let i = 0; i < users.length; i += CFG.BATCH_SIZE) {
      const batch    = users.slice(i, i + CFG.BATCH_SIZE);
      const batchNum = Math.floor(i / CFG.BATCH_SIZE) + 1;

      console.log(
        `[inactive] stage="${stage.key}"  ` +
        `batch ${batchNum}/${totalBatches}  ` +
        `(${i + 1}–${Math.min(i + CFG.BATCH_SIZE, users.length)})`
      );

      await Promise.all(
        batch.map(async (user) => {
          const html   = buildHtml(stage.key, user, stats);
          const text   = buildText(stage.key, user, stats);
          const result = await sendToOne(resend, user, stage.key, html, text);

          if (result.ok) {
            sent++;
          } else {
            failed++;
          }
        })
      );

      /* Pause between batches */
      if (i + CFG.BATCH_SIZE < users.length) {
        await sleep(CFG.BATCH_DELAY_MS);
      }
    }

    stageResults.push({ key: stage.key, total: users.length, sent, failed });
  }

  /* ── Auto-deactivate stale listings ── */
  let deactivatedListings = 0;
  if (!CFG.DRY_RUN) {
    try {
      deactivatedListings = await deactivateStaleListings();
    } catch (err) {
      console.error("[inactive] auto-deactivate failed:", err.message);
    }
  } else {
    console.log("[inactive] DRY-RUN — skipping auto-deactivation");
  }

  const duration_ms = Date.now() - startedAt;

  const summary = {
    stages                : stageResults,
    deactivated_listings  : deactivatedListings,
    duration_ms,
  };

  console.log(
    `[inactive] ══ DONE ══\n` +
    JSON.stringify(summary, null, 2)
  );

  return summary;
}