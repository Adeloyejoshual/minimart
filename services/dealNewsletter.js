// ════════════════════════════════════════════════════════════
// FILE: services/dealNewsletter.js
// ════════════════════════════════════════════════════════════
//
// 4-Day Automated Product Deal Newsletter (AliExpress / Jumia Style)
// Powered by Homepage v7 Ranking Engine logic.
//
// What it does:
//  1. Selects 50 random verified users who haven't received an email in 4 days.
//  2. Pulls top 11 active, high-ranking products directly using homepage
//     visibility predicates and ranking rules.
//  3. Shapes images using homepage fallback (main_image -> thumbnail_url -> images[0]).
//  4. Builds a high-converting HTML email (Hero Grid + 3-column grid).
//  5. Sends via Resend with 200ms rate-limit protection.
//  6. Includes sendTestDealNewsletter() to test directly.
// ════════════════════════════════════════════════════════════

import { Resend } from "resend";
import { pool }   from "../config/db.js";

const FROM_ADDRESS = process.env.EMAIL_FROM     || "Loemart Deals <no-reply@loemart.com>";
const BRAND        = process.env.EMAIL_BRAND    || "Loemart";
const SUPPORT      = process.env.EMAIL_SUPPORT  || "support@loemart.com";
const FRONTEND_URL = (process.env.FRONTEND_URL  || "https://loemart.com").replace(/\/$/, "");
const YEAR         = new Date().getFullYear();

/* ── Resend Singleton ── */
let _resend = null;
function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[deal-newsletter] ⚠ RESEND_API_KEY missing — dry-run active");
    return null;
  }
  _resend = new Resend(key);
  return _resend;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Format price cleanly as ₦11,816.36 */
const formatPrice = (n) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));

const esc = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ════════════════════════════════════════════════════════════
   DATABASE FETCHERS (HOMEPAGE v7 RANKING)
════════════════════════════════════════════════════════════ */

/** Fetch 50 random verified users who haven't gotten an email in the last 4 days */
async function fetch50RandomSubscribers() {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name
     FROM   public.users u
     WHERE  u.email_verified = TRUE
       AND  u.status NOT IN ('banned', 'deleted', 'flagged')
       AND  NOT EXISTS (
         SELECT 1 FROM public.newsletter_logs nl
         WHERE  nl.user_id = u.id
           AND  nl.sent_at >= NOW() - INTERVAL '4 days'
       )
     ORDER  BY RANDOM()
     LIMIT  50`
  );
  return rows;
}

/** 
 * Fetch 11 Top Products using Homepage v7 Ranking Engine:
 *  1. Uses homepage LIVE_PREDICATE (filters out expired/deleted/inactive).
 *  2. Orders by: Promoted > Promotion Priority > Engagement Score > Recency.
 *  3. Shapes images using homepage fallback hierarchy.
 */
async function fetchDealProducts() {
  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.title,
       p.price,
       p.slug,
       p.main_image,
       p.thumbnail_url,
       p.images
     FROM  public.products p
     WHERE p.is_active = TRUE
       AND p.status IN ('active', 'active_limited')
       AND p.status <> 'deleted'
       AND (p.active_until IS NULL OR p.active_until > NOW())
       AND (p.promotion_expires_at IS NULL OR p.promotion_expires_at > NOW())
     ORDER BY
       p.is_promoted        DESC,
       p.promotion_priority DESC,
       p.engagement_score   DESC,
       p.created_at         DESC
     LIMIT 30`
  );

  if (!rows.length) return [];

  // Shuffle top pool slightly so consecutive newsletters aren't 100% identical
  const shuffled = [...rows].sort(() => 0.5 - Math.random()).slice(0, 11);

  return shuffled.map((p) => {
    /* Homepage v7 Image Extraction Logic */
    let image = p.main_image || p.thumbnail_url || null;
    if (!image && Array.isArray(p.images) && p.images.length > 0) {
      const first = p.images[0];
      image = typeof first === "string" ? first : first?.url ?? null;
    }

    return {
      id    : p.id,
      title : p.title,
      price : Number(p.price || 0),
      slug  : p.slug,
      image : image || "https://loemart.com/placeholder.png",
    };
  });
}

/** Log sent email to prevent duplicate sends within 4 days */
async function logNewsletterSend(userId, status, error = null) {
  try {
    await pool.query(
      `INSERT INTO public.newsletter_logs (user_id, week_key, status, error_message, sent_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, `4DAY-${Date.now()}`, status, error]
    );
  } catch (err) {
    console.warn(`[deal-newsletter] Log error user=${userId}:`, err.message);
  }
}

/* ════════════════════════════════════════════════════════════
   EMAIL HTML TEMPLATE (AliExpress / Jumia Style Grid)
════════════════════════════════════════════════════════════ */

function buildDealEmailHtml(subscriber, products) {
  const name     = esc((subscriber.name ?? "").split(" ")[0] || "Customer");
  const heroBig  = products[0];
  const hero4    = products.slice(1, 5);
  const grid6    = products.slice(5, 11);

  const exploreUrl = `${FRONTEND_URL}/browse`;
  const unsubUrl   = `${FRONTEND_URL}/settings/notifications`;

  /* Build Top 2x2 Mini Grid */
  const hero4Cards = hero4.map((p) => {
    const pUrl = `${FRONTEND_URL}/products/${esc(p.slug)}`;
    return `
      <td width="50%" style="padding:3px;vertical-align:top;">
        <a href="${pUrl}" style="text-decoration:none;display:block;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #f0f0f0;">
          <div style="height:100px;background:#fafafa;">
            <img src="${esc(p.image)}" alt="${esc(p.title)}" width="100%" height="100" style="object-fit:cover;display:block;" />
          </div>
          <div style="padding:6px 4px;background:#fff;">
            <span style="font-size:11px;font-weight:800;color:#111827;">${formatPrice(p.price)}</span>
          </div>
        </a>
      </td>`;
  });

  /* Build 3-Column Product Grid */
  const gridRows = [];
  for (let i = 0; i < grid6.length; i += 3) {
    const chunk = grid6.slice(i, i + 3);
    const cols  = chunk.map((p) => {
      const pUrl = `${FRONTEND_URL}/products/${esc(p.slug)}`;
      return `
        <td width="33.33%" style="padding:4px;vertical-align:top;">
          <a href="${pUrl}" style="text-decoration:none;display:block;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee;">
            <div style="height:120px;background:#f9fafb;">
              <img src="${esc(p.image)}" alt="${esc(p.title)}" width="100%" height="120" style="object-fit:cover;display:block;" />
            </div>
            <div style="padding:8px 6px;">
              <p style="margin:0 0 4px;font-size:11px;color:#374151;height:28px;overflow:hidden;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
                ${esc(p.title)}
              </p>
              <div>
                <span style="font-size:12px;font-weight:900;color:#000;">${formatPrice(p.price)}</span>
              </div>
            </div>
          </a>
        </td>`;
    });

    while (cols.length < 3) cols.push(`<td width="33.33%"></td>`);
    gridRows.push(`<tr>${cols.join("")}</tr>`);
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Hot Deals on ${BRAND}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:20px 0;">
  <tr>
    <td align="center">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
        
        <!-- HEADER -->
        <tr>
          <td style="padding:16px 20px;background:#ffffff;border-bottom:1px solid #f0f0f0;">
            <table width="100%">
              <tr>
                <td style="font-size:20px;font-weight:900;color:#16a34a;letter-spacing:-0.5px;">${BRAND}</td>
                <td align="right" style="font-size:12px;color:#6b7280;">Recommended for <strong>${name}</strong></td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TOP HERO SECTION (1 Big + 2x2 Mini) -->
        <tr>
          <td style="padding:12px;background:#edf7ed;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- Big Hero Product (Left) -->
                ${heroBig ? `
                <td width="50%" style="padding:3px;vertical-align:top;">
                  <a href="${FRONTEND_URL}/products/${esc(heroBig.slug)}" style="text-decoration:none;display:block;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">
                    <div style="height:210px;background:#fafafa;">
                      <img src="${esc(heroBig.image)}" alt="${esc(heroBig.title)}" width="100%" height="210" style="object-fit:cover;display:block;" />
                    </div>
                    <div style="padding:10px;background:#fff;">
                      <span style="font-size:14px;font-weight:900;color:#000;">${formatPrice(heroBig.price)}</span>
                    </div>
                  </a>
                </td>` : ""}

                <!-- 2x2 Mini Grid (Right) -->
                <td width="50%" style="vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>${hero4Cards[0] || ""} ${hero4Cards[1] || ""}</tr>
                    <tr>${hero4Cards[2] || ""} ${hero4Cards[3] || ""}</tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- EXPLORE DEALS BUTTON -->
        <tr>
          <td align="center" style="padding:18px 12px;background:#ffffff;">
            <a href="${exploreUrl}" style="display:inline-block;background:#000000;color:#ffffff;font-size:14px;font-weight:700;padding:12px 48px;border-radius:4px;text-decoration:none;letter-spacing:0.5px;">
              Explore deals
            </a>
          </td>
        </tr>

        <!-- 3-COLUMN PRODUCT GRID -->
        <tr>
          <td style="padding:8px 12px 20px 12px;background:#ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              ${gridRows.join("")}
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:20px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;font-size:11px;color:#9ca3af;">
            <p style="margin:0 0 8px;">You are receiving this because you're a registered member on ${BRAND}.</p>
            <p style="margin:0;">
              <a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a> &nbsp;•&nbsp;
              <a href="${FRONTEND_URL}/privacy" style="color:#6b7280;text-decoration:underline;">Privacy Policy</a>
            </p>
            <p style="margin:8px 0 0;">© ${YEAR} ${BRAND}. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`.trim();
}

/* ════════════════════════════════════════════════════════════
   MAIN AUTOMATED DISPATCH (50 RANDOM USERS)
════════════════════════════════════════════════════════════ */

export async function send4DayDealNewsletter() {
  const resend = getResend();
  const startedAt = Date.now();

  console.log(`\n[deal-newsletter] ══ STARTING 4-DAY DEALS DISPATCH ══`);

  // 1. Fetch 50 random eligible users
  const subscribers = await fetch50RandomSubscribers();
  if (!subscribers.length) {
    console.log(`[deal-newsletter] No eligible users found (all received in last 4 days).`);
    return { sent: 0, total: 0 };
  }

  // 2. Fetch 11 products using homepage ranking
  const products = await fetchDealProducts();
  if (products.length < 3) {
    console.log(`[deal-newsletter] Not enough active products in database.`);
    return { sent: 0, total: subscribers.length, error: "Not enough products" };
  }

  console.log(`[deal-newsletter] Sending to ${subscribers.length} users with ${products.length} products...`);

  let sent = 0;
  let failed = 0;

  // 3. Loop and send via Resend
  for (const subscriber of subscribers) {
    const html = buildDealEmailHtml(subscriber, products);

    if (!resend) {
      console.log(`[deal-newsletter] DRY-RUN -> Would send to: ${subscriber.email}`);
      await logNewsletterSend(subscriber.id, "sent");
      sent++;
      continue;
    }

    try {
      const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [subscriber.email],
        reply_to: SUPPORT,
        subject: `🛒 Fresh deals picked for you on ${BRAND}`,
        html: html,
        headers: {
          "List-Unsubscribe": `<${FRONTEND_URL}/settings/notifications>`,
          "Precedence": "bulk",
        },
      });

      if (error) throw new Error(error.message);

      await logNewsletterSend(subscriber.id, "sent");
      sent++;
    } catch (err) {
      console.error(`[deal-newsletter] Failed to send to ${subscriber.email}:`, err.message);
      await logNewsletterSend(subscriber.id, "failed", err.message);
      failed++;
    }

    // Delay 200ms per email to respect Resend rate limits
    await sleep(200);
  }

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[deal-newsletter] ══ FINISHED: Sent ${sent}/${subscribers.length} emails in ${duration}s ══\n`);

  return { total: subscribers.length, sent, failed, duration_seconds: duration };
}

/* ════════════════════════════════════════════════════════════
   TEST FUNCTION — SENDS SINGLE TEST EMAIL
════════════════════════════════════════════════════════════ */

export async function sendTestDealNewsletter(targetEmail = "adeloyejoshua2020@gmail.com") {
  const resend = getResend();

  console.log(`\n[deal-newsletter] 🧪 SENDING TEST EMAIL TO: ${targetEmail}`);

  const mockSubscriber = {
    id: "test-user-id",
    email: targetEmail,
    name: "Joshua",
  };

  // Fetch 11 real products using Homepage ranking
  const products = await fetchDealProducts();
  if (!products.length) {
    console.error("[deal-newsletter] ❌ No active products found in DB!");
    return { success: false, error: "No active products in DB" };
  }

  const html = buildDealEmailHtml(mockSubscriber, products);

  if (!resend) {
    console.log(`[deal-newsletter] ⚠️ Dry-run active (RESEND_API_KEY missing). Email HTML generated.`);
    return { success: true, dryRun: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [targetEmail],
      reply_to: SUPPORT,
      subject: `🛒 [TEST] Fresh deals picked for you on ${BRAND}`,
      html: html,
    });

    if (error) throw new Error(error.message);

    console.log(`[deal-newsletter] ✅ Test email sent successfully to ${targetEmail}! ID: ${data?.id}`);
    return { success: true, targetEmail, productsCount: products.length, resendId: data?.id };
  } catch (err) {
    console.error(`[deal-newsletter] ❌ Failed to send test email:`, err.message);
    return { success: false, error: err.message };
  }
}