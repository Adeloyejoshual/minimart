// ════════════════════════════════════════════════════════════
// FILE: services/weeklyNewsletter.js
// ════════════════════════════════════════════════════════════
//
// Weekly newsletter service — powered by Resend.
//
// What it does:
//  1. Finds all opted-in, email-verified, non-restricted users
//     who have NOT received this week's edition yet.
//  2. Pulls the week's top products (promoted first, then
//     highest engagement).
//  3. Pulls top categories by active listing count.
//  4. Pulls platform stats for the past 7 days.
//  5. Sends a personalised HTML + plain-text email via Resend
//     in small batches (respects rate limits).
//  6. Logs every attempt to newsletter_logs (idempotent upsert).
//     Re-running in the same ISO week skips already-sent users.
//
// ════════════════════════════════════════════════════════════

import { Resend } from "resend";
import { pool }   from "../config/db.js";

/* ════════════════════════════════════════════════════════════
   RESEND CLIENT  (lazy singleton — mirrors your email service)
════════════════════════════════════════════════════════════ */
let _resend = null;

function getClient() {
  if (_resend) return _resend;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(
      "[newsletter] ⚠  RESEND_API_KEY not set — dry-run/console fallback active"
    );
    return null;
  }

  try {
    _resend = new Resend(key);
    console.log("[newsletter] ✓ Resend client ready");
    return _resend;
  } catch (err) {
    console.error("[newsletter] ✗ Failed to create Resend client:", err.message);
    return null;
  }
}

getClient();

/* ════════════════════════════════════════════════════════════
   BRAND / ENV  (matches your existing email service pattern)
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
  BATCH_SIZE       : parseInt(process.env.NL_BATCH_SIZE      ?? "50",   10),
  BATCH_DELAY_MS   : parseInt(process.env.NL_BATCH_DELAY_MS  ?? "1200", 10),
  TOP_PRODUCTS     : parseInt(process.env.NL_TOP_PRODUCTS    ?? "6",    10),
  TOP_CATEGORIES   : parseInt(process.env.NL_TOP_CATEGORIES  ?? "4",    10),
  MAX_RETRIES      : 2,
  RETRY_DELAY_MS   : 800,
  DRY_RUN          : process.env.NL_DRY_RUN === "true" || !IS_PROD,
  UNSUBSCRIBE_PATH : "/settings/notifications",
  BROWSE_PATH      : "/browse",
  SELL_PATH        : "/sell",
});

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */

/** ISO week key — e.g. "2025-W03" */
const getWeekKey = () => {
  const now  = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((now - jan1) / 86_400_000 + jan1.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const formatPrice = (n) =>
  new Intl.NumberFormat("en-NG", {
    style                : "currency",
    currency             : "NGN",
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0));

const formatNumber = (n) =>
  new Intl.NumberFormat("en-NG").format(Number(n ?? 0));

const escHtml = (str) =>
  String(str ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");

/* ════════════════════════════════════════════════════════════
   DATA FETCHERS
════════════════════════════════════════════════════════════ */

/** Opted-in users who haven't received this week's edition */
async function fetchSubscribers(weekKey) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.location_city, u.location_state
     FROM   public.users u
     WHERE  u.newsletter_opted_in = TRUE
       AND  u.email_verified      = TRUE
       AND  u.status NOT IN ('banned', 'flagged', 'deleted')
       AND  NOT EXISTS (
         SELECT 1 FROM public.newsletter_logs nl
         WHERE  nl.user_id  = u.id
           AND  nl.week_key = $1
           AND  nl.status   = 'sent'
       )
     ORDER  BY u.created_at DESC`,
    [weekKey]
  );
  return rows;
}

/** Top N products — promoted first, then most engaged */
async function fetchTopProducts() {
  const { rows } = await pool.query(
    `SELECT
       p.id,              p.title,        p.price,
       p.slug,            p.main_image,   p.thumbnail_url,
       p.location_city,   p.location_state,
       p.engagement_score, p.is_promoted,  p.promotion_type,
       u.name             AS seller_name,
       u.identity_verified AS seller_verified
     FROM  public.products p
     LEFT  JOIN public.users u ON u.id = p.seller_id
     WHERE p.is_active = TRUE
       AND p.status    IN ('active', 'active_limited')
       AND (p.active_until IS NULL OR p.active_until > NOW())
       AND (p.promotion_expires_at IS NULL OR p.promotion_expires_at > NOW())
     ORDER BY
       p.is_promoted      DESC,
       p.engagement_score DESC,
       p.created_at       DESC
     LIMIT $1`,
    [CFG.TOP_PRODUCTS]
  );
  return rows;
}

/** Top categories by active listing count */
async function fetchTopCategories() {
  const { rows } = await pool.query(
    `SELECT
       c.id,
       c.name,
       c.slug,
       COUNT(p.id)::INT AS listing_count
     FROM  public.categories c
     LEFT  JOIN public.products p
       ON  p.category_id = c.id
           AND p.is_active = TRUE
           AND p.status IN ('active', 'active_limited')
           AND (p.active_until IS NULL OR p.active_until > NOW())
     WHERE c.is_active = TRUE
     GROUP BY c.id, c.name, c.slug
     ORDER BY listing_count DESC
     LIMIT $1`,
    [CFG.TOP_CATEGORIES]
  );
  return rows;
}

/** Platform stats — last 7 days */
async function fetchWeeklyStats() {
  const [usersRes, listingsRes, activeRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::INT AS count
       FROM   public.users
       WHERE  created_at >= NOW() - INTERVAL '7 days'
         AND  status NOT IN ('banned', 'deleted')`
    ),
    pool.query(
      `SELECT COUNT(*)::INT AS count
       FROM   public.products
       WHERE  created_at >= NOW() - INTERVAL '7 days'
         AND  status <> 'deleted'`
    ),
    pool.query(
      `SELECT COUNT(*)::INT AS count
       FROM   public.products
       WHERE  is_active = TRUE
         AND  status IN ('active', 'active_limited')
         AND  (active_until IS NULL OR active_until > NOW())`
    ),
  ]);

  return {
    new_users       : usersRes.rows[0]?.count    ?? 0,
    new_listings    : listingsRes.rows[0]?.count ?? 0,
    active_listings : activeRes.rows[0]?.count   ?? 0,
  };
}

/* ════════════════════════════════════════════════════════════
   LOG HELPERS
════════════════════════════════════════════════════════════ */
async function logSend(userId, weekKey, status, errorMsg = null) {
  try {
    await pool.query(
      `INSERT INTO public.newsletter_logs
         (user_id, week_key, status, error_message, sent_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, week_key)
       DO UPDATE SET
         status        = EXCLUDED.status,
         error_message = EXCLUDED.error_message,
         sent_at       = NOW()`,
      [userId, weekKey, status, errorMsg]
    );
  } catch (err) {
    console.warn(`[newsletter] log write failed user=${userId}:`, err.message);
  }
}

/* ════════════════════════════════════════════════════════════
   EMAIL TEMPLATE
════════════════════════════════════════════════════════════ */

/* ── Shared inline styles ── */
const S = {
  body    : `margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;`,
  card    : `max-width:600px;width:100%;`,
  header  : `background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;`,
  body_td : `background:#fff;padding:36px 40px;`,
  footer  : `background:#f3f4f6;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;`,
  h2      : `margin:0 0 16px;font-size:18px;font-weight:700;color:#111827;`,
  ctaGreen: `display:inline-block;background:#16a34a;color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:.2px;`,
  ctaAmber: `display:inline-block;background:#d97706;color:#fff;font-size:14px;font-weight:700;padding:11px 28px;border-radius:7px;text-decoration:none;`,
  label   : `margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;`,
  stat    : `margin:0;font-size:22px;font-weight:800;color:#15803d;`,
  divider : `border:none;border-top:1px solid #f3f4f6;margin:0 0 32px;`,
};

function buildProductCard(p) {
  const image    = p.main_image || p.thumbnail_url || null;
  const location = [p.location_city, p.location_state].filter(Boolean).join(", ");
  const href     = `${FRONTEND_URL}/products/${escHtml(p.slug)}`;

  const badge = p.is_promoted
    ? `<span style="display:inline-block;background:#f97316;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;letter-spacing:.5px;margin-bottom:6px;text-transform:uppercase;">
         Featured
       </span>`
    : "";

  const imgBlock = image
    ? `<img src="${escHtml(image)}" alt="${escHtml(p.title)}" width="100%"
            style="display:block;height:160px;object-fit:cover;" />`
    : `<div style="height:160px;background:linear-gradient(135deg,#f3f4f6,#e5e7eb);
                   display:flex;align-items:center;justify-content:center;">
         <span style="font-size:32px;">🛍️</span>
       </div>`;

  return `
    <td style="width:46%;vertical-align:top;padding:10px;">
      <a href="${href}" style="text-decoration:none;color:inherit;">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;
                    overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);">
          ${imgBlock}
          <div style="padding:12px;">
            ${badge}
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#111827;
                      line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;
                      -webkit-box-orient:vertical;overflow:hidden;">
              ${escHtml(p.title)}
            </p>
            <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#16a34a;">
              ${formatPrice(p.price)}
            </p>
            ${location
              ? `<p style="margin:0;font-size:11px;color:#6b7280;">
                   📍 ${escHtml(location)}
                 </p>`
              : ""}
          </div>
        </div>
      </a>
    </td>`;
}

function buildCategoryPill(cat) {
  return `
    <a href="${FRONTEND_URL}${CFG.BROWSE_PATH}?category=${escHtml(cat.slug)}"
       style="display:inline-block;background:#f3f4f6;color:#374151;
              font-size:12px;font-weight:600;padding:6px 14px;
              border-radius:99px;text-decoration:none;margin:4px;
              border:1px solid #e5e7eb;">
      ${escHtml(cat.name)}
      <span style="color:#9ca3af;margin-left:4px;">
        ${formatNumber(cat.listing_count)}
      </span>
    </a>`;
}

/* ── Full HTML email ── */
function buildHtml({ subscriber, products, categories, stats, weekKey }) {
  const firstName   = escHtml((subscriber.name ?? "").split(" ")[0] || "there");
  const unsubUrl    = `${FRONTEND_URL}${CFG.UNSUBSCRIBE_PATH}`;
  const browseUrl   = `${FRONTEND_URL}${CFG.BROWSE_PATH}`;
  const sellUrl     = `${FRONTEND_URL}${CFG.SELL_PATH}`;

  /* Product grid — rows of 2 */
  const productRows = [];
  for (let i = 0; i < products.length; i += 2) {
    const left  = products[i]     ? buildProductCard(products[i])     : `<td></td>`;
    const right = products[i + 1] ? buildProductCard(products[i + 1]) : `<td></td>`;
    productRows.push(`<tr>${left}${right}</tr>`);
  }

  const categoryPills = categories.map(buildCategoryPill).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Your Weekly Picks — ${BRAND}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="${S.body}">

<!-- PREVIEW TEXT (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
  This week's top picks, trending categories &amp; highlights — just for you 🛍️
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
          <td style="${S.header}">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-.3px;">
              Your Weekly Picks 🛍️
            </h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px;">
              ${escHtml(weekKey)} &nbsp;·&nbsp; Curated just for you
            </p>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="${S.body_td}">

            <!-- Greeting -->
            <p style="margin:0 0 24px;font-size:16px;color:#111827;line-height:1.6;">
              Hi <strong>${firstName}</strong> 👋,<br />
              Here's what's hot on ${escHtml(BRAND)} this week.
              The best deals move fast — don't miss out!
            </p>

            <!-- STATS STRIP -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:#f0fdf4;border:1px solid #bbf7d0;
                           border-radius:12px;margin-bottom:32px;">
              <tr>
                <td align="center"
                    style="padding:18px 10px;border-right:1px solid #bbf7d0;">
                  <p style="${S.stat}">${formatNumber(stats.new_listings)}</p>
                  <p style="${S.label}">New Listings</p>
                </td>
                <td align="center"
                    style="padding:18px 10px;border-right:1px solid #bbf7d0;">
                  <p style="${S.stat}">${formatNumber(stats.active_listings)}</p>
                  <p style="${S.label}">Active Listings</p>
                </td>
                <td align="center" style="padding:18px 10px;">
                  <p style="${S.stat}">${formatNumber(stats.new_users)}</p>
                  <p style="${S.label}">New Members</p>
                </td>
              </tr>
            </table>

            <!-- TOP PRODUCTS -->
            <h2 style="${S.h2}">🔥 Top Picks This Week</h2>
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:32px;">
              ${productRows.join("\n")}
            </table>

            <!-- Browse CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:36px;">
              <tr>
                <td align="center">
                  <a href="${browseUrl}" style="${S.ctaGreen}">
                    Browse All Listings →
                  </a>
                </td>
              </tr>
            </table>

            <hr style="${S.divider}" />

            <!-- TRENDING CATEGORIES -->
            <h2 style="${S.h2}">📂 Trending Categories</h2>
            <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
              Numbers show active listings right now.
            </p>
            <div style="margin-bottom:32px;line-height:2.2;">
              ${categoryPills}
            </div>

            <hr style="${S.divider}" />

            <!-- SELL CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:linear-gradient(135deg,#fefce8,#fef9c3);
                            border:1px solid #fde68a;border-radius:12px;
                            padding:24px 28px;">
                  <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#92400e;">
                    💡 Got something to sell?
                  </h3>
                  <p style="margin:0 0 16px;font-size:14px;color:#78350f;line-height:1.6;">
                    Thousands of buyers are browsing ${escHtml(BRAND)} right now.
                    List your item in under 2 minutes — it's completely free!
                  </p>
                  <a href="${sellUrl}" style="${S.ctaAmber}">
                    Post a Free Listing →
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="${S.footer}">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.6;">
              You're receiving this because you subscribed to weekly updates
              from <strong>${escHtml(BRAND)}</strong>.<br />
              We send one email per week — no spam, ever.
            </p>
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">
              Questions? Reply to this email or contact
              <a href="mailto:${escHtml(SUPPORT)}"
                 style="color:#6b7280;">${escHtml(SUPPORT)}</a>
            </p>
            <p style="margin:0;font-size:12px;">
              <a href="${unsubUrl}"
                 style="color:#6b7280;text-decoration:underline;">
                Unsubscribe or manage preferences
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
function buildText({ subscriber, products, stats, weekKey }) {
  const firstName = (subscriber.name ?? "").split(" ")[0] || "there";

  const productLines = products.map(
    (p) =>
      `  • ${p.title}\n` +
      `    ${formatPrice(p.price)}  —  ${FRONTEND_URL}/products/${p.slug}`
  );

  return [
    `Hi ${firstName},`,
    ``,
    `Here's your ${BRAND} weekly digest for ${weekKey}.`,
    ``,
    `── PLATFORM THIS WEEK ──────────────────────────`,
    `  New listings   : ${formatNumber(stats.new_listings)}`,
    `  Active listings: ${formatNumber(stats.active_listings)}`,
    `  New members    : ${formatNumber(stats.new_users)}`,
    ``,
    `── TOP PICKS ────────────────────────────────────`,
    ...productLines,
    ``,
    `Browse all listings: ${FRONTEND_URL}${CFG.BROWSE_PATH}`,
    ``,
    `── POST A FREE LISTING ──────────────────────────`,
    `  ${FRONTEND_URL}${CFG.SELL_PATH}`,
    ``,
    `── MANAGE PREFERENCES ───────────────────────────`,
    `  ${FRONTEND_URL}${CFG.UNSUBSCRIBE_PATH}`,
    ``,
    `Questions? Contact us at ${SUPPORT}`,
    ``,
    `© ${YEAR} ${BRAND}. All rights reserved.`,
  ].join("\n");
}

/* ════════════════════════════════════════════════════════════
   SEND ONE EMAIL  (with retry)
════════════════════════════════════════════════════════════ */
async function sendToOne(resend, subscriber, html, text, weekKey) {
  /* DRY RUN — log only, no real send */
  if (CFG.DRY_RUN || !resend) {
    console.log(
      `[newsletter] DRY-RUN — would send to ${subscriber.email} (${weekKey})`
    );
    await logSend(subscriber.id, weekKey, "sent");
    return { ok: true };
  }

  let lastErr = null;

  for (let attempt = 1; attempt <= CFG.MAX_RETRIES + 1; attempt++) {
    try {
      const { error } = await resend.emails.send({
        from        : FROM_ADDRESS,
        to          : [subscriber.email],
        reply_to    : SUPPORT,
        subject     : `🛍️ Your Weekly Picks on ${BRAND}`,
        html,
        text,
        headers     : {
          "X-Newsletter-Week"    : weekKey,
          "List-Unsubscribe"     : `<${FRONTEND_URL}${CFG.UNSUBSCRIBE_PATH}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          "Precedence"           : "bulk",
        },
        tags: [
          { name: "category", value: "newsletter" },
          { name: "week",     value: weekKey       },
        ],
      });

      if (error) throw new Error(error.message ?? JSON.stringify(error));

      await logSend(subscriber.id, weekKey, "sent");
      return { ok: true };

    } catch (err) {
      lastErr = err;
      console.warn(
        `[newsletter] send attempt ${attempt} failed ` +
        `user=${subscriber.id} email=${subscriber.email}: ${err.message}`
      );
      if (attempt <= CFG.MAX_RETRIES) {
        await sleep(CFG.RETRY_DELAY_MS * attempt);
      }
    }
  }

  await logSend(
    subscriber.id,
    weekKey,
    "failed",
    lastErr?.message ?? "unknown error"
  );
  return { ok: false, error: lastErr?.message };
}

/* ════════════════════════════════════════════════════════════
   MAIN EXPORT
════════════════════════════════════════════════════════════ */

/**
 * sendWeeklyNewsletter()
 *
 * Safe to call multiple times in the same ISO week — already-sent
 * users are excluded via the newsletter_logs unique constraint.
 *
 * Returns a summary:
 * {
 *   week_key    : "2025-W03",
 *   total       : 1200,
 *   sent        : 1195,
 *   failed      : 5,
 *   duration_ms : 48200,
 * }
 */
export async function sendWeeklyNewsletter() {
  const weekKey   = getWeekKey();
  const startedAt = Date.now();
  const resend    = getClient();

  console.log(
    `\n[newsletter] ══ START  week=${weekKey}` +
    `  dry_run=${CFG.DRY_RUN}  resend=${!!resend} ══`
  );

  /* ── Fetch all shared data in parallel ── */
  const [subscribers, products, categories, stats] = await Promise.all([
    fetchSubscribers(weekKey),
    fetchTopProducts(),
    fetchTopCategories(),
    fetchWeeklyStats(),
  ]);

  const total = subscribers.length;

  console.log(
    `[newsletter] subscribers=${total}  ` +
    `products=${products.length}  categories=${categories.length}`
  );
  console.log(
    `[newsletter] stats — ` +
    `new_users=${stats.new_users}  ` +
    `new_listings=${stats.new_listings}  ` +
    `active_listings=${stats.active_listings}`
  );

  if (total === 0) {
    console.log("[newsletter] No eligible subscribers — nothing to send.");
    return {
      week_key    : weekKey,
      total       : 0,
      sent        : 0,
      failed      : 0,
      duration_ms : Date.now() - startedAt,
    };
  }

  let sent   = 0;
  let failed = 0;

  /* ── Process in batches ── */
  const totalBatches = Math.ceil(total / CFG.BATCH_SIZE);

  for (let i = 0; i < subscribers.length; i += CFG.BATCH_SIZE) {
    const batch    = subscribers.slice(i, i + CFG.BATCH_SIZE);
    const batchNum = Math.floor(i / CFG.BATCH_SIZE) + 1;

    console.log(
      `[newsletter] batch ${batchNum}/${totalBatches}  ` +
      `(${i + 1}–${Math.min(i + CFG.BATCH_SIZE, total)} of ${total})`
    );

    /* Build + send in parallel within the batch */
    await Promise.all(
      batch.map(async (subscriber) => {
        const html   = buildHtml({ subscriber, products, categories, stats, weekKey });
        const text   = buildText({ subscriber, products, stats, weekKey });
        const result = await sendToOne(resend, subscriber, html, text, weekKey);

        if (result.ok) {
          sent++;
        } else {
          failed++;
        }
      })
    );

    /* Pause between batches — respect Resend rate limits */
    if (i + CFG.BATCH_SIZE < subscribers.length) {
      await sleep(CFG.BATCH_DELAY_MS);
    }
  }

  const duration_ms = Date.now() - startedAt;

  const summary = { week_key: weekKey, total, sent, failed, duration_ms };

  console.log(
    `[newsletter] ══ DONE ══\n` +
    JSON.stringify(summary, null, 2)
  );

  return summary;
}