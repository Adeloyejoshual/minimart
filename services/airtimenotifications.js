/**
 * services/airtimenotifications.js
 * Email templates for the airtime giveaway lifecycle.
 * Transport: Resend SDK (via services/email.js utilities pattern)
 *
 * Exports:
 *  - sendAirtimeClaimSubmittedEmail
 *  - sendAirtimeClaimApprovedEmail
 *  - sendAirtimeClaimCompletedEmail
 *  - sendAirtimeClaimRejectedEmail
 *  - sendAirtimePhoneChangedEmail
 *  - sendAirtimeFraudWarningEmail
 *  - sendAirtimeGiveawaysSuspendedEmail
 *  - sendAirtimeCooldownReminderEmail
 */

import { Resend } from "resend";

/* ── config ─────────────────────────────────────────────────────────────── */
const FROM_ADDRESS = process.env.EMAIL_FROM    || "Loemart <no-reply@loemart.com>";
const BRAND        = process.env.EMAIL_BRAND   || "Loemart";
const SUPPORT      = process.env.EMAIL_SUPPORT || "support@loemart.com";
const FRONTEND_URL = process.env.FRONTEND_URL  || "https://loemart.com";
const YEAR         = new Date().getFullYear();

/* ── singleton ──────────────────────────────────────────────────────────── */
let _resend = null;

function getClient() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[airtime-email] ⚠  RESEND_API_KEY not set — dev fallback active");
    return null;
  }
  try {
    _resend = new Resend(key);
    console.log("[airtime-email] ✓ Resend client ready");
    return _resend;
  } catch (err) {
    console.error("[airtime-email] ✗ Failed to create Resend client:", err.message);
    return null;
  }
}

getClient();

/* ── helpers ────────────────────────────────────────────────────────────── */
function esc(v) {
  return String(v ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}

function toText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDate(d) {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function naira(n) {
  const num = parseFloat(n);
  return isNaN(num) ? "₦0" : "₦" + num.toLocaleString("en-NG");
}

/* ── email shell (matches your Loemart theme) ───────────────────────────── */
function shell({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${esc(title)}</title>
  <style>
    body,table,td,div,p{margin:0;padding:0;}
    body{background:#060b14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
    table{border-spacing:0;border-collapse:collapse;}
    .outer{background:#060b14;padding:40px 16px 60px;}
    .card{background:#0d1523;border-radius:16px;max-width:520px;margin:0 auto;overflow:hidden;border:1px solid rgba(255,255,255,0.07);}
    .brand-bar{padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.07);}
    .brand-name{font-size:22px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px;}
    .brand-dot{color:#FF5C00;}
    .body{padding:32px;}
    h2{font-size:20px;font-weight:700;color:#f1f5f9;margin:0 0 12px;}
    p{font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 14px;}
    p:last-child{margin-bottom:0;}
    strong{color:#f1f5f9;}
    .hi{color:#f1f5f9;font-weight:600;}
    .banner-green{background:rgba(22,163,74,0.10);border:1px solid rgba(22,163,74,0.30);border-radius:12px;padding:20px 24px;margin:20px 0;text-align:center;}
    .banner-green .icon{font-size:36px;margin-bottom:8px;}
    .banner-green .headline{font-size:18px;font-weight:800;color:#4ade80;margin-bottom:6px;}
    .banner-green .sub{font-size:13px;color:#86efac;line-height:1.6;}
    .banner-red{background:rgba(220,38,38,0.10);border:1px solid rgba(220,38,38,0.30);border-radius:12px;padding:20px 24px;margin:20px 0;text-align:center;}
    .banner-red .icon{font-size:36px;margin-bottom:8px;}
    .banner-red .headline{font-size:18px;font-weight:800;color:#f87171;margin-bottom:6px;}
    .banner-red .sub{font-size:13px;color:#fca5a5;line-height:1.6;}
    .banner-amber{background:rgba(217,119,6,0.10);border:1px solid rgba(217,119,6,0.30);border-radius:12px;padding:20px 24px;margin:20px 0;text-align:center;}
    .banner-amber .icon{font-size:36px;margin-bottom:8px;}
    .banner-amber .headline{font-size:18px;font-weight:800;color:#fbbf24;margin-bottom:6px;}
    .banner-amber .sub{font-size:13px;color:#fde68a;line-height:1.6;}
    .banner-blue{background:rgba(59,130,246,0.10);border:1px solid rgba(59,130,246,0.30);border-radius:12px;padding:20px 24px;margin:20px 0;text-align:center;}
    .banner-blue .icon{font-size:36px;margin-bottom:8px;}
    .banner-blue .headline{font-size:18px;font-weight:800;color:#60a5fa;margin-bottom:6px;}
    .banner-blue .sub{font-size:13px;color:#93c5fd;line-height:1.6;}
    .info-box{background:#111c2d;border-left:3px solid #FF5C00;border-radius:0 8px 8px 0;padding:13px 16px;margin:16px 0;font-size:13px;color:#fdba74;line-height:1.55;}
    .warning{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:9px;padding:13px 16px;margin:18px 0;font-size:13px;color:#fcd34d;line-height:1.55;}
    .amount-display{background:#111c2d;border:1px solid rgba(255,92,0,0.30);border-radius:14px;padding:24px;margin:20px 0;text-align:center;}
    .amount-value{font-size:38px;font-weight:800;color:#FF8040;line-height:1;margin-bottom:6px;}
    .amount-label{font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;}
    .claim-detail{background:#111c2d;border-radius:10px;padding:14px 20px;margin:16px 0;font-size:13px;color:#94a3b8;}
    .claim-detail .row{padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;}
    .claim-detail .row:last-child{border-bottom:none;}
    .claim-detail .row .label{color:#64748b;}
    .claim-detail .row .value{color:#f1f5f9;font-weight:600;}
    .cta{display:inline-block;margin:18px 0 4px;padding:13px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;}
    .cta-orange{background:#FF5C00;color:#fff;}
    .cta-blue{background:#3b82f6;color:#fff;}
    .cta-red{background:#dc2626;color:#fff;}
    .footer{padding:18px 32px 26px;border-top:1px solid rgba(255,255,255,0.07);font-size:11px;color:#475569;text-align:center;line-height:1.7;}
    .footer a{color:#FF5C00;text-decoration:none;}
    @media(max-width:480px){
      .body{padding:24px 18px;}
      .brand-bar{padding:20px 18px;}
      .amount-value{font-size:32px;}
    }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;color:#060b14;">${esc(preheader)}&nbsp;</div>
  <div class="outer">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center">
        <div class="card">
          <div class="brand-bar">
            <span class="brand-name">Loe<span class="brand-dot">mart</span></span>
          </div>
          <div class="body">${body}</div>
          <div class="footer">
            Questions? <a href="mailto:${SUPPORT}">${SUPPORT}</a><br />
            &copy; ${YEAR} ${BRAND}. All rights reserved.
          </div>
        </div>
      </td></tr>
    </table>
  </div>
</body>
</html>`;
}

/* ── core sender ────────────────────────────────────────────────────────── */
async function send({ to, subject, html, text }) {
  if (!to)      throw new Error("[airtime-email] `to` is required");
  if (!subject) throw new Error("[airtime-email] `subject` is required");
  if (!html)    throw new Error("[airtime-email] `html` is required");

  const toArr  = Array.isArray(to) ? to : [to];
  const client = getClient();

  if (!client) {
    console.log("\n" + "═".repeat(64));
    console.log("[airtime-email] 📧  DEV — NOT sent (RESEND_API_KEY missing)");
    console.log(`  To      : ${toArr.join(", ")}`);
    console.log(`  Subject : ${subject}`);
    if (text) text.split("\n").forEach((l) => console.log("    " + l));
    console.log("═".repeat(64) + "\n");
    return { id: `dev-${Date.now()}` };
  }

  console.log(`[airtime-email] sending "${subject}" → ${toArr.join(", ")}`);

  let result;
  try {
    result = await client.emails.send({
      from : FROM_ADDRESS,
      to   : toArr,
      subject,
      html,
      text : text ?? toText(html),
    });
  } catch (sdkErr) {
    console.error("[airtime-email] SDK threw:", sdkErr.message);
    throw new Error(`Email SDK error: ${sdkErr.message}`);
  }

  if (result?.error) {
    console.error("[airtime-email] Resend API error:", result.error);
    throw new Error(`Resend API error: ${result.error.message}`);
  }

  const id = result?.data?.id ?? result?.id ?? "unknown";
  console.log(`[airtime-email] ✓ delivered  id=${id}`);
  return { id };
}

/* ════════════════════════════════════════════════════════════════════════════
   1) CLAIM SUBMITTED — right after user submits claim
════════════════════════════════════════════════════════════════════════════ */
export async function sendAirtimeClaimSubmittedEmail({
  to, name, amount, phone, network, slaHours = 24,
}) {
  if (!to)     throw new Error("sendAirtimeClaimSubmittedEmail: `to` is required");
  if (!amount) throw new Error("sendAirtimeClaimSubmittedEmail: `amount` is required");

  const safeName    = esc(name    || "there");
  const safePhone   = esc(phone   || "");
  const safeNetwork = esc(network || "N/A");
  const historyUrl  = `${FRONTEND_URL}/coupons?tab=airtime`;

  const body = `
    <h2>🎁 Airtime claim submitted!</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>We've received your airtime claim on <strong>${esc(BRAND)}</strong>.
       Our team will process it within <strong>${slaHours} hours</strong>.</p>
    <div class="amount-display">
      <div class="amount-value">${esc(naira(amount))}</div>
      <div class="amount-label">Airtime to be sent</div>
    </div>
    <div class="claim-detail">
      <div class="row">
        <span class="label">Recipient:</span>
        <span class="value">${safePhone}</span>
      </div>
      <div class="row">
        <span class="label">Network:</span>
        <span class="value">${safeNetwork}</span>
      </div>
      <div class="row">
        <span class="label">Status:</span>
        <span class="value" style="color:#fbbf24;">Pending</span>
      </div>
    </div>
    <div class="banner-blue">
      <div class="icon">⏱️</div>
      <div class="headline">Processing within ${slaHours} hours</div>
      <div class="sub">You'll receive an email once your airtime is sent.</div>
    </div>
    <p style="text-align:center;">
      <a href="${esc(historyUrl)}" class="cta cta-orange">View Claim Status</a>
    </p>
    <p style="font-size:13px;color:#64748b;">
      Didn't submit this? Please contact <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a> immediately.
    </p>
  `;

  return send({
    to,
    subject: `${naira(amount)} airtime claim submitted — ${BRAND}`,
    html: shell({
      title    : `Airtime claim submitted — ${BRAND}`,
      preheader: `${naira(amount)} claim for ${phone} is being processed.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your ${naira(amount)} airtime claim has been submitted!`,
      ``,
      `Recipient : ${phone}`,
      `Network   : ${network || "N/A"}`,
      `Status    : Pending review`,
      ``,
      `We'll process it within ${slaHours} hours.`,
      ``,
      `Track: ${historyUrl}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   2) CLAIM APPROVED — admin approved, about to send
════════════════════════════════════════════════════════════════════════════ */
export async function sendAirtimeClaimApprovedEmail({
  to, name, amount, phone, network,
}) {
  if (!to || !amount) throw new Error("sendAirtimeClaimApprovedEmail: `to`, `amount` required");

  const safeName    = esc(name    || "there");
  const safePhone   = esc(phone   || "");
  const safeNetwork = esc(network || "N/A");

  const body = `
    <h2>✅ Your claim has been approved</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Great news! Your airtime claim has been approved and is now being sent.</p>
    <div class="amount-display">
      <div class="amount-value">${esc(naira(amount))}</div>
      <div class="amount-label">Approved for sending</div>
    </div>
    <div class="claim-detail">
      <div class="row">
        <span class="label">Recipient:</span>
        <span class="value">${safePhone}</span>
      </div>
      <div class="row">
        <span class="label">Network:</span>
        <span class="value">${safeNetwork}</span>
      </div>
      <div class="row">
        <span class="label">Status:</span>
        <span class="value" style="color:#60a5fa;">Approved — Sending</span>
      </div>
    </div>
    <div class="banner-blue">
      <div class="icon">📤</div>
      <div class="headline">Sending Airtime Now</div>
      <div class="sub">You'll receive a confirmation once delivered.</div>
    </div>
  `;

  return send({
    to,
    subject: `${naira(amount)} airtime approved — sending now`,
    html: shell({
      title    : `Claim approved — ${BRAND}`,
      preheader: `Your ${naira(amount)} airtime is being sent to ${phone}.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your ${naira(amount)} airtime claim has been APPROVED!`,
      ``,
      `Recipient : ${phone}`,
      `Network   : ${network || "N/A"}`,
      ``,
      `Sending now — you'll get a confirmation shortly.`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   3) CLAIM COMPLETED — airtime successfully sent
════════════════════════════════════════════════════════════════════════════ */
export async function sendAirtimeClaimCompletedEmail({
  to, name, amount, phone, network,
}) {
  if (!to || !amount) throw new Error("sendAirtimeClaimCompletedEmail: `to`, `amount` required");

  const safeName    = esc(name    || "there");
  const safePhone   = esc(phone   || "");
  const safeNetwork = esc(network || "N/A");
  const spinUrl     = `${FRONTEND_URL}/spin-wheel`;

  const body = `
    <h2>🎉 Airtime sent successfully!</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Your airtime has been credited. Check your phone!</p>
    <div class="amount-display">
      <div class="amount-value">${esc(naira(amount))}</div>
      <div class="amount-label">Airtime credited ✓</div>
    </div>
    <div class="claim-detail">
      <div class="row">
        <span class="label">Sent to:</span>
        <span class="value">${safePhone}</span>
      </div>
      <div class="row">
        <span class="label">Network:</span>
        <span class="value">${safeNetwork}</span>
      </div>
      <div class="row">
        <span class="label">Status:</span>
        <span class="value" style="color:#4ade80;">Completed ✓</span>
      </div>
    </div>
    <div class="banner-green">
      <div class="icon">📱</div>
      <div class="headline">Delivered Successfully</div>
      <div class="sub">
        Dial <strong>*310#</strong> (MTN) or your network's balance code to confirm.
      </div>
    </div>
    <p style="text-align:center;">
      <a href="${esc(spinUrl)}" class="cta cta-orange">Spin & Win More 🎡</a>
    </p>
    <p style="font-size:13px;color:#64748b;">
      Didn't receive it? Contact <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a> within 24 hours.
    </p>
  `;

  return send({
    to,
    subject: `🎉 ${naira(amount)} airtime sent to ${phone}`,
    html: shell({
      title    : `Airtime delivered — ${BRAND}`,
      preheader: `Your ${naira(amount)} airtime has been sent successfully.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `🎉 Your ${naira(amount)} airtime has been sent!`,
      ``,
      `Sent to   : ${phone}`,
      `Network   : ${network || "N/A"}`,
      ``,
      `Dial *310# (MTN) or your network's balance code to confirm.`,
      ``,
      `Win more: ${spinUrl}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   4) CLAIM REJECTED
════════════════════════════════════════════════════════════════════════════ */
export async function sendAirtimeClaimRejectedEmail({
  to, name, amount, phone, remarks,
}) {
  if (!to) throw new Error("sendAirtimeClaimRejectedEmail: `to` is required");

  const safeName    = esc(name    || "there");
  const safePhone   = esc(phone   || "");
  const safeRemarks = esc(remarks || "Your claim did not pass our review checks.");
  const couponsUrl  = `${FRONTEND_URL}/coupons?tab=airtime`;

  const body = `
    <h2>Your airtime claim was rejected</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Unfortunately, we were unable to process your airtime claim.</p>
    ${amount ? `
      <div class="claim-detail">
        <div class="row">
          <span class="label">Amount:</span>
          <span class="value">${esc(naira(amount))}</span>
        </div>
        <div class="row">
          <span class="label">Recipient:</span>
          <span class="value">${safePhone}</span>
        </div>
        <div class="row">
          <span class="label">Status:</span>
          <span class="value" style="color:#f87171;">Rejected</span>
        </div>
      </div>
    ` : ""}
    <div class="banner-red">
      <div class="icon">❌</div>
      <div class="headline">Claim Rejected</div>
      <div class="sub">See the reason below and try again if applicable.</div>
    </div>
    <div class="info-box"><strong>Reason:</strong> ${safeRemarks}</div>
    <p>Your coupon has been restored — you can submit a new claim from your dashboard.</p>
    <p style="text-align:center;">
      <a href="${esc(couponsUrl)}" class="cta cta-orange">View My Coupons</a>
    </p>
    <p style="font-size:13px;color:#64748b;">
      Believe this was a mistake? Reach out to <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a>.
    </p>
  `;

  return send({
    to,
    subject: `Airtime claim rejected — ${BRAND}`,
    html: shell({
      title    : `Claim rejected — ${BRAND}`,
      preheader: `Your airtime claim was rejected. Reason: ${remarks || "review failed"}.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your airtime claim was rejected.`,
      ``,
      `Reason: ${remarks || "Did not pass review"}`,
      ``,
      `Your coupon has been restored.`,
      `Retry: ${couponsUrl}`,
      ``,
      `Questions? ${SUPPORT}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   5) PHONE CHANGED — security alert
════════════════════════════════════════════════════════════════════════════ */
export async function sendAirtimePhoneChangedEmail({
  to, name, newMasked, oldMasked, ip, changedAt,
}) {
  if (!to) throw new Error("sendAirtimePhoneChangedEmail: `to` is required");

  const safeName = esc(name       || "there");
  const safeNew  = esc(newMasked  || "");
  const safeOld  = esc(oldMasked  || "not set");
  const safeIp   = esc(ip         || "unknown");
  const timestamp = changedAt ? formatDate(changedAt) : formatDate(new Date());
  const supportUrl = `mailto:${SUPPORT}?subject=Unauthorized%20phone%20change`;

  const body = `
    <h2>Your airtime number was changed</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>The default airtime number on your <strong>${esc(BRAND)}</strong> account has been updated.</p>
    <div class="claim-detail">
      <div class="row">
        <span class="label">Previous number:</span>
        <span class="value">${safeOld}</span>
      </div>
      <div class="row">
        <span class="label">New number:</span>
        <span class="value">${safeNew}</span>
      </div>
      <div class="row">
        <span class="label">When:</span>
        <span class="value">${timestamp}</span>
      </div>
      <div class="row">
        <span class="label">IP address:</span>
        <span class="value">${safeIp}</span>
      </div>
    </div>
    <div class="banner-blue">
      <div class="icon">🔔</div>
      <div class="headline">Change Recorded</div>
      <div class="sub">This number will receive all future airtime rewards.</div>
    </div>
    <div class="warning">
      🔒 <strong>Didn't do this?</strong> Change your password immediately and
      <a href="${supportUrl}" style="color:#FF5C00;text-decoration:underline;">contact support</a>.
    </div>
  `;

  return send({
    to,
    subject: `Airtime number changed — ${BRAND}`,
    html: shell({
      title    : `Airtime number changed — ${BRAND}`,
      preheader: `Your default airtime number was changed to ${newMasked}.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your default airtime number on ${BRAND} was changed.`,
      ``,
      `Previous : ${oldMasked || "not set"}`,
      `New      : ${newMasked}`,
      `When     : ${timestamp}`,
      `IP       : ${ip || "unknown"}`,
      ``,
      `Didn't do this? Contact ${SUPPORT} immediately.`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   6) FRAUD WARNING — user hit warned threshold
════════════════════════════════════════════════════════════════════════════ */
export async function sendAirtimeFraudWarningEmail({ to, name }) {
  if (!to) throw new Error("sendAirtimeFraudWarningEmail: `to` is required");

  const safeName   = esc(name || "there");
  const supportUrl = `mailto:${SUPPORT}?subject=Airtime%20account%20review`;

  const body = `
    <h2>⚠️ Unusual activity on your account</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>We've detected unusual activity in your recent airtime giveaway claims on
       <strong>${esc(BRAND)}</strong>.</p>
    <div class="banner-amber">
      <div class="icon">⚠️</div>
      <div class="headline">Account Under Watch</div>
      <div class="sub">Please review our giveaway rules to avoid restrictions.</div>
    </div>
    <div class="info-box">
      <strong style="color:#fdba74;">Common causes:</strong><br />
      • Repeatedly trying to bypass the phone-change cooldown<br />
      • Attempting to share a phone across too many accounts<br />
      • Multiple rejected claims<br />
      • Suspicious IP or device patterns
    </div>
    <p>If this activity was <strong>not you</strong>, please secure your account
       immediately and <a href="${supportUrl}" style="color:#FF5C00;">contact support</a>.</p>
    <p>Continued violations may result in <strong>giveaway suspension</strong>.</p>
  `;

  return send({
    to,
    subject: `⚠️ Unusual activity detected — ${BRAND}`,
    html: shell({
      title    : `Account notice — ${BRAND}`,
      preheader: "We've detected unusual activity on your airtime giveaway account.",
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `We've detected unusual activity on your ${BRAND} airtime giveaway account.`,
      ``,
      `Common causes:`,
      `  • Bypassing the phone-change cooldown`,
      `  • Sharing a phone across too many accounts`,
      `  • Multiple rejected claims`,
      ``,
      `If this wasn't you, secure your account and contact ${SUPPORT}.`,
      ``,
      `Continued violations may result in giveaway suspension.`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   7) GIVEAWAYS SUSPENDED
════════════════════════════════════════════════════════════════════════════ */
export async function sendAirtimeGiveawaysSuspendedEmail({
  to, name, reason,
}) {
  if (!to) throw new Error("sendAirtimeGiveawaysSuspendedEmail: `to` is required");

  const safeName   = esc(name   || "there");
  const safeReason = esc(reason || "Multiple policy violations detected on your account.");
  const supportUrl = `mailto:${SUPPORT}?subject=Airtime%20suspension%20appeal`;

  const body = `
    <h2>🚫 Giveaway access suspended</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Your access to <strong>${esc(BRAND)}</strong> airtime giveaways has been
       <strong>suspended</strong>.</p>
    <div class="banner-red">
      <div class="icon">🚫</div>
      <div class="headline">Giveaway Access Suspended</div>
      <div class="sub">You can no longer submit airtime claims.</div>
    </div>
    <div class="info-box"><strong>Reason:</strong> ${safeReason}</div>
    <p style="color:#94a3b8;">
      <strong style="color:#f1f5f9;">Note:</strong> Your account remains active for
      buying and selling. Only airtime giveaways are affected.
    </p>
    <p style="text-align:center;">
      <a href="${supportUrl}" class="cta cta-red">Appeal This Decision</a>
    </p>
    <p style="font-size:13px;color:#64748b;">
      Include your account email and a brief explanation. We respond within 48 hours.
    </p>
  `;

  return send({
    to,
    subject: `Airtime giveaway access suspended — ${BRAND}`,
    html: shell({
      title    : `Access suspended — ${BRAND}`,
      preheader: `Your airtime giveaway access has been suspended. Reason: ${reason || "review"}.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your airtime giveaway access on ${BRAND} has been SUSPENDED.`,
      ``,
      `Reason: ${reason || "Multiple violations"}`,
      ``,
      `Your account remains active for buying and selling.`,
      `Only airtime giveaways are affected.`,
      ``,
      `Appeal: ${SUPPORT}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   8) COOLDOWN REMINDER — sent when user tries to change during cooldown
════════════════════════════════════════════════════════════════════════════ */
export async function sendAirtimeCooldownReminderEmail({
  to, name, currentMasked, nextChangeAt, daysLeft,
}) {
  if (!to) throw new Error("sendAirtimeCooldownReminderEmail: `to` is required");

  const safeName    = esc(name || "there");
  const safeCurrent = esc(currentMasked || "");
  const nextDate    = nextChangeAt ? formatDate(nextChangeAt) : "soon";
  const claimUrl    = `${FRONTEND_URL}/coupons?tab=airtime`;

  const body = `
    <h2>Your airtime number is currently locked</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>To prevent giveaway abuse, your default airtime number can only be
       changed once every <strong>30 days</strong>.</p>
    <div class="claim-detail">
      <div class="row">
        <span class="label">Current number:</span>
        <span class="value">${safeCurrent}</span>
      </div>
      <div class="row">
        <span class="label">Days remaining:</span>
        <span class="value" style="color:#fbbf24;">${daysLeft} day${daysLeft !== 1 ? "s" : ""}</span>
      </div>
      <div class="row">
        <span class="label">Next change:</span>
        <span class="value">${nextDate}</span>
      </div>
    </div>
    <div class="banner-blue">
      <div class="icon">🔒</div>
      <div class="headline">One-Time Sends Still Allowed</div>
      <div class="sub">
        You can still send airtime to a <strong>different number this time only</strong>
        without changing your saved default.
      </div>
    </div>
    <p style="text-align:center;">
      <a href="${esc(claimUrl)}" class="cta cta-orange">View My Coupons</a>
    </p>
  `;

  return send({
    to,
    subject: `Your airtime number is locked for ${daysLeft} more day${daysLeft !== 1 ? "s" : ""}`,
    html: shell({
      title    : `Airtime number locked — ${BRAND}`,
      preheader: `Your default airtime number is locked until ${nextDate}.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your default airtime number is currently locked.`,
      ``,
      `Current      : ${currentMasked}`,
      `Days left    : ${daysLeft}`,
      `Next change  : ${nextDate}`,
      ``,
      `You can still send airtime to a different number one-time only.`,
      ``,
      `Coupons: ${claimUrl}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}