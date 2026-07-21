/**
 * services/email.js
 * Transport: Resend SDK
 *
 * New exports added (subscription + listing lifecycle):
 *  - sendListingExpiryEmail
 *  - sendListingExpiryWarningEmail
 *  - sendTrialExpiredEmail
 *  - sendSubscriptionExpiryWarningEmail
 *  - sendSubscriptionExpiredEmail        (grace period started)
 *  - sendSubscriptionGraceExpiredEmail   (grace period ended, listings paused)
 */

import { Resend } from "resend";

/* ── config ─────────────────────────────────────────────────────────────── */
const FROM_ADDRESS = process.env.EMAIL_FROM    || "Loemart <no-reply@loemart.com>";
const BRAND        = process.env.EMAIL_BRAND   || "Loemart";
const SUPPORT      = process.env.EMAIL_SUPPORT || "support@loemart.com";
const FRONTEND_URL = process.env.FRONTEND_URL  || "https://loemart.com";
const YEAR         = new Date().getFullYear();
const IS_PROD      = process.env.NODE_ENV === "production";

/* ── singleton ──────────────────────────────────────────────────────────── */
let _resend = null;

function getClient() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] ⚠  RESEND_API_KEY not set — dev console fallback active");
    return null;
  }
  try {
    _resend = new Resend(key);
    console.log("[email] ✓ Resend client ready");
    return _resend;
  } catch (err) {
    console.error("[email] ✗ Failed to create Resend client:", err.message);
    return null;
  }
}

getClient();

/* ── helpers ────────────────────────────────────────────────────────────── */
function esc(value) {
  return String(value ?? "")
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

/* ── email shell ────────────────────────────────────────────────────────── */
function shell({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${esc(title)}</title>
  <style>
    body,table,td,div,p{margin:0;padding:0;}
    body{
      background:#060b14;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',
        Roboto,Helvetica,Arial,sans-serif;
    }
    table{border-spacing:0;border-collapse:collapse;}
    .outer{background:#060b14;padding:40px 16px 60px;}
    .card{
      background:#0d1523;border-radius:16px;
      max-width:520px;margin:0 auto;overflow:hidden;
      border:1px solid rgba(255,255,255,0.07);
    }
    .brand-bar{
      padding:24px 32px;
      border-bottom:1px solid rgba(255,255,255,0.07);
    }
    .brand-name{
      font-size:22px;font-weight:800;
      color:#f1f5f9;letter-spacing:-0.5px;
    }
    .brand-dot{color:#FF5C00;}
    .body{padding:32px;}
    h2{font-size:20px;font-weight:700;color:#f1f5f9;margin:0 0 12px;}
    p{font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 14px;}
    p:last-child{margin-bottom:0;}
    strong{color:#f1f5f9;}
    .hi{color:#f1f5f9;font-weight:600;}
    .otp-wrap{text-align:center;margin:28px 0;}
    .otp-box{
      display:inline-block;background:#111c2d;
      border:2px dashed rgba(59,130,246,0.5);
      border-radius:14px;padding:24px 48px;
    }
    .otp-code{
      font-size:42px;font-weight:800;
      letter-spacing:14px;color:#f1f5f9;
      font-family:'Courier New',Courier,monospace;
    }
    .otp-box-orange{
      display:inline-block;background:#111c2d;
      border:2px dashed rgba(255,92,0,0.5);
      border-radius:14px;padding:24px 48px;
    }
    .otp-code-orange{
      font-size:42px;font-weight:800;
      letter-spacing:14px;color:#FF8040;
      font-family:'Courier New',Courier,monospace;
    }
    .banner-green{
      background:rgba(22,163,74,0.10);
      border:1px solid rgba(22,163,74,0.30);
      border-radius:12px;padding:20px 24px;
      margin:20px 0;text-align:center;
    }
    .banner-green .icon{font-size:36px;margin-bottom:8px;}
    .banner-green .headline{font-size:18px;font-weight:800;color:#4ade80;margin-bottom:6px;}
    .banner-green .sub{font-size:13px;color:#86efac;line-height:1.6;}
    .banner-red{
      background:rgba(220,38,38,0.10);
      border:1px solid rgba(220,38,38,0.30);
      border-radius:12px;padding:20px 24px;
      margin:20px 0;text-align:center;
    }
    .banner-red .icon{font-size:36px;margin-bottom:8px;}
    .banner-red .headline{font-size:18px;font-weight:800;color:#f87171;margin-bottom:6px;}
    .banner-red .sub{font-size:13px;color:#fca5a5;line-height:1.6;}
    .banner-amber{
      background:rgba(217,119,6,0.10);
      border:1px solid rgba(217,119,6,0.30);
      border-radius:12px;padding:20px 24px;
      margin:20px 0;text-align:center;
    }
    .banner-amber .icon{font-size:36px;margin-bottom:8px;}
    .banner-amber .headline{font-size:18px;font-weight:800;color:#fbbf24;margin-bottom:6px;}
    .banner-amber .sub{font-size:13px;color:#fde68a;line-height:1.6;}
    .banner-blue{
      background:rgba(59,130,246,0.10);
      border:1px solid rgba(59,130,246,0.30);
      border-radius:12px;padding:20px 24px;
      margin:20px 0;text-align:center;
    }
    .banner-blue .icon{font-size:36px;margin-bottom:8px;}
    .banner-blue .headline{font-size:18px;font-weight:800;color:#60a5fa;margin-bottom:6px;}
    .banner-blue .sub{font-size:13px;color:#93c5fd;line-height:1.6;}
    .benefit-list{
      background:#111c2d;border-radius:10px;
      padding:16px 20px;margin:16px 0;
      list-style:none;
    }
    .benefit-list li{
      font-size:13px;color:#94a3b8;
      padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);
      display:flex;align-items:center;gap:10px;
    }
    .benefit-list li:last-child{border-bottom:none;}
    .benefit-list li span.tick{color:#4ade80;font-weight:700;font-size:15px;}
    .benefit-list li span.warn{color:#fbbf24;font-weight:700;font-size:15px;}
    .product-list{
      background:#111c2d;border-radius:10px;
      padding:12px 20px;margin:16px 0;list-style:none;
    }
    .product-list li{
      font-size:13px;color:#94a3b8;
      padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);
    }
    .product-list li:last-child{border-bottom:none;}
    .product-list li strong{color:#f1f5f9;}
    .info-box{
      background:#111c2d;
      border-left:3px solid #ef4444;
      border-radius:0 8px 8px 0;
      padding:13px 16px;margin:16px 0;
      font-size:13px;color:#fca5a5;line-height:1.55;
    }
    .warning{
      background:rgba(245,158,11,0.08);
      border:1px solid rgba(245,158,11,0.25);
      border-radius:9px;padding:13px 16px;margin:18px 0;
      font-size:13px;color:#fcd34d;line-height:1.55;
    }
    .cta{
      display:inline-block;margin:18px 0 4px;
      padding:13px 32px;border-radius:10px;
      font-size:14px;font-weight:700;text-decoration:none;
    }
    .cta-orange{background:#FF5C00;color:#fff;}
    .cta-blue  {background:#3b82f6;color:#fff;}
    .countdown{
      background:#111c2d;border-radius:10px;
      padding:16px 20px;margin:16px 0;
      text-align:center;
    }
    .countdown-days{
      font-size:48px;font-weight:800;color:#fbbf24;
      line-height:1;margin-bottom:4px;
    }
    .countdown-label{font-size:13px;color:#94a3b8;}
    .reset-banner{
      background:rgba(255,92,0,0.08);
      border:1px solid rgba(255,92,0,0.25);
      border-radius:12px;padding:20px 24px;
      margin:20px 0;text-align:center;
    }
    .reset-banner .icon    {font-size:36px;margin-bottom:8px;}
    .reset-banner .headline{font-size:18px;font-weight:800;color:#FF8040;margin-bottom:6px;}
    .reset-banner .sub     {font-size:13px;color:#FFAA80;line-height:1.6;}
    .reset-security{
      background:rgba(245,158,11,0.08);
      border:1px solid rgba(245,158,11,0.22);
      border-radius:9px;padding:12px 16px;
      margin:18px 0;font-size:12px;color:#fcd34d;line-height:1.55;
    }
    .footer{
      padding:18px 32px 26px;
      border-top:1px solid rgba(255,255,255,0.07);
      font-size:11px;color:#475569;
      text-align:center;line-height:1.7;
    }
    .footer a{color:#FF5C00;text-decoration:none;}
    @media(max-width:480px){
      .body{padding:24px 18px;}
      .brand-bar{padding:20px 18px;}
      .otp-code,.otp-code-orange{font-size:32px;letter-spacing:8px;}
      .otp-box,.otp-box-orange{padding:18px 24px;}
      .countdown-days{font-size:36px;}
    }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;color:#060b14;">
    ${esc(preheader)}&nbsp;
  </div>
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
  if (!to)      throw new Error("[email] `to` is required");
  if (!subject) throw new Error("[email] `subject` is required");
  if (!html)    throw new Error("[email] `html` is required");

  const toArr  = Array.isArray(to) ? to : [to];
  const client = getClient();

  if (!client) {
    console.log("\n" + "═".repeat(64));
    console.log("[email] 📧  DEV — email NOT sent (RESEND_API_KEY missing)");
    console.log(`  To      : ${toArr.join(", ")}`);
    console.log(`  Subject : ${subject}`);
    if (text) text.split("\n").forEach((l) => console.log("    " + l));
    console.log("═".repeat(64) + "\n");
    return { id: `dev-${Date.now()}` };
  }

  console.log(`[email] sending "${subject}" → ${toArr.join(", ")}`);

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
    console.error("[email] SDK threw:", sdkErr.message);
    throw new Error(`Email SDK error: ${sdkErr.message}`);
  }

  if (result?.error) {
    console.error("[email] Resend API error:", result.error);
    throw new Error(`Resend API error: ${result.error.message}`);
  }

  const id = result?.data?.id ?? result?.id ?? "unknown";
  console.log(`[email] ✓ delivered  id=${id}`);
  return { id };
}

/* ════════════════════════════════════════════════════════════════════════════
   EXISTING EMAILS  (unchanged)
════════════════════════════════════════════════════════════════════════════ */

export async function sendPasswordResetEmail({ to, name, otp, expiry = 15 }) {
  if (!to || !otp) throw new Error("sendPasswordResetEmail: `to` and `otp` are required");
  const otpStr = String(otp).trim();
  if (!/^\d{6}$/.test(otpStr)) throw new Error("otp must be 6 digits");

  const safeName = esc(name || "there");
  const safeOtp  = esc(otpStr);

  const body = `
    <h2>Reset your password</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Use the code below to reset your <strong>${esc(BRAND)}</strong> password.
       It expires in <strong>${expiry}&nbsp;minutes</strong>.</p>
    <div class="reset-banner">
      <div class="icon">🔑</div>
      <div class="headline">Password Reset Code</div>
      <div class="sub">Expires in ${expiry} minutes &nbsp;·&nbsp; One-time use only</div>
    </div>
    <div class="otp-wrap">
      <div class="otp-box-orange"><div class="otp-code-orange">${safeOtp}</div></div>
    </div>
    <div class="reset-security">
      <strong style="color:#f1f5f9;">Security notice:</strong>
      Never share this code. ${esc(BRAND)} staff will <strong>never</strong> ask for it.
    </div>
    <p>If you didn't request a reset, ignore this email.</p>
  `;

  return send({
    to, subject: `${safeOtp} — your ${esc(BRAND)} password reset code`,
    html: shell({ title: `Reset your ${BRAND} password`, preheader: `Your reset code: ${safeOtp}`, body }),
    text: `Hi ${name || "there"},\n\nYour ${BRAND} password reset code:\n\n    ${otpStr}\n\nExpires in ${expiry} minutes.\n\n— ${BRAND}`,
  });
}

export async function sendEmailVerificationOtp({ to, name, otp, expiry = 15 }) {
  if (!to || !otp) throw new Error("sendEmailVerificationOtp: `to` and `otp` are required");
  const otpStr   = String(otp).trim();
  const safeName = esc(name || "there");
  const safeOtp  = esc(otpStr);

  const body = `
    <h2>Verify your email address</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Welcome to <strong>${esc(BRAND)}</strong>! Your verification code expires in
       <strong>${expiry}&nbsp;minutes</strong>.</p>
    <div class="otp-wrap">
      <div class="otp-box"><div class="otp-code">${safeOtp}</div></div>
    </div>
    <div class="warning">Never share this code. ${esc(BRAND)} staff will never ask for it.</div>
  `;

  return send({
    to, subject: `${safeOtp} — verify your ${esc(BRAND)} account`,
    html: shell({ title: `Verify your ${BRAND} account`, preheader: `Verification code: ${safeOtp}`, body }),
    text: `Hi ${name || "there"},\n\nYour ${BRAND} verification code:\n\n    ${otpStr}\n\nExpires in ${expiry} minutes.\n\n— ${BRAND}`,
  });
}

export async function sendVerificationEmail({ to, name, otp }) {
  if (!to || !otp) throw new Error("sendVerificationEmail: `to` and `otp` are required");
  const otpStr   = String(otp).trim();
  const safeName = esc(name || "there");
  const safeOtp  = esc(otpStr);

  const body = `
    <h2>Verify your email address</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Use the code below to verify your <strong>${esc(BRAND)}</strong> account.
       It expires in <strong>10&nbsp;minutes</strong>.</p>
    <div class="otp-wrap">
      <div class="otp-box"><div class="otp-code">${safeOtp}</div></div>
    </div>
    <div class="warning">Never share this code. ${esc(BRAND)} staff will never ask for it.</div>
  `;

  return send({
    to, subject: `${safeOtp} — your ${esc(BRAND)} verification code`,
    html: shell({ title: `Verify your ${BRAND} account`, preheader: `Code: ${safeOtp}`, body }),
    text: `Hi ${name || "there"},\n\nVerification code: ${otpStr}\n\nExpires in 10 minutes.\n\n— ${BRAND}`,
  });
}

export async function sendWelcomeEmail({ to, name }) {
  if (!to) throw new Error("sendWelcomeEmail: `to` is required");
  const safeName = esc(name || "there");
  const body = `
    <h2>Welcome to ${esc(BRAND)} 🎉</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Your email is verified and your account is now active.
       You can browse, buy, and sell on ${esc(BRAND)}.</p>
  `;
  return send({
    to, subject: `Welcome to ${BRAND} — you're verified`,
    html: shell({ title: `Welcome to ${BRAND}`, preheader: `Your ${BRAND} account is active.`, body }),
    text: `Welcome to ${BRAND}, ${name || "there"}!\n\nYour account is active.\n\n— ${BRAND}`,
  });
}

export async function sendIdentityStatusEmail({ to, name, approved, reason }) {
  if (!to) throw new Error("sendIdentityStatusEmail: `to` is required");
  const safeName = esc(name || "there");
  const body = approved
    ? `<h2>Identity Verified ✓</h2><p>Hi <span class="hi">${safeName}</span>,</p>
       <p>Your identity has been verified. You now have full access to seller features.</p>`
    : `<h2>Identity Verification Update</h2><p>Hi <span class="hi">${safeName}</span>,</p>
       <p>We were unable to verify your identity. Reason:</p>
       <div class="info-box">${esc(reason || "Documents did not meet our requirements.")}</div>
       <p>Please log in and resubmit.</p>`;
  return send({
    to,
    subject: approved ? `Identity verified — ${BRAND}` : `Action required: identity verification — ${BRAND}`,
    html: shell({ title: `Identity ${approved ? "verified" : "update"} — ${BRAND}`, preheader: approved ? "Verified!" : "Action required", body }),
    text: approved
      ? `Hi ${name || "there"},\n\nYour identity is verified.\n\n— ${BRAND}`
      : `Hi ${name || "there"},\n\nNot approved. Reason: ${reason}\n\nPlease resubmit.\n\n— ${BRAND}`,
  });
}

export async function sendStoreStatusEmail({ to, name, storeName, approved, reason }) {
  if (!to) throw new Error("sendStoreStatusEmail: `to` is required");
  const safeName  = esc(name      || "there");
  const safeStore = esc(storeName || "your store");
  const body = approved
    ? `<h2>Store Approved ✓</h2><p>Hi <span class="hi">${safeName}</span>,</p>
       <p><strong>${safeStore}</strong> is now live on ${esc(BRAND)}.</p>`
    : `<h2>Store Verification Update</h2><p>Hi <span class="hi">${safeName}</span>,</p>
       <p><strong>${safeStore}</strong> was not approved.</p>
       <div class="info-box">${esc(reason || "Store profile did not meet our requirements.")}</div>`;
  return send({
    to,
    subject: approved ? `Store approved — ${BRAND}` : `Action required: store verification — ${BRAND}`,
    html: shell({ title: `Store ${approved ? "approved" : "update"} — ${BRAND}`, preheader: approved ? "Store live!" : "Action required", body }),
    text: approved
      ? `${storeName || "Your store"} is approved.\n\n— ${BRAND}`
      : `Not approved. Reason: ${reason}\n\nPlease resubmit.\n\n— ${BRAND}`,
  });
}

export async function sendVerificationApprovedEmail({ to, name }) {
  if (!to) throw new Error("sendVerificationApprovedEmail: `to` is required");
  const safeName = esc(name || "there");
  const body = `
    <h2>You're fully verified 🎉</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Your identity and store have been <strong>approved</strong>.</p>
    <div class="banner-green">
      <div class="icon">✅</div>
      <div class="headline">Account Fully Verified</div>
      <div class="sub">Identity confirmed &nbsp;·&nbsp; Trust score updated</div>
    </div>
    <ul class="benefit-list">
      <li><span class="tick">✓</span> Up to 100 listings per day</li>
      <li><span class="tick">✓</span> 500 active listings</li>
      <li><span class="tick">✓</span> Verified seller badge</li>
    </ul>
  `;
  return send({
    to, subject: `You're verified — ${BRAND}`,
    html: shell({ title: `Account verified — ${BRAND}`, preheader: "You're fully verified!", body }),
    text: `Hi ${name || "there"},\n\nYour account is fully verified on ${BRAND}.\n\n— ${BRAND}`,
  });
}

export async function sendVerificationRejectedEmail({ to, name, reason }) {
  if (!to) throw new Error("sendVerificationRejectedEmail: `to` is required");
  const safeName   = esc(name   || "there");
  const safeReason = esc(reason || "Your documents did not meet our requirements.");
  const body = `
    <h2>Verification Not Approved</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <div class="banner-red">
      <div class="icon">❌</div>
      <div class="headline">Verification Rejected</div>
      <div class="sub">Please review the reason and resubmit.</div>
    </div>
    <div class="info-box">${safeReason}</div>
    <p>Log in to resubmit. Questions? <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a></p>
  `;
  return send({
    to, subject: `Action required: verification rejected — ${BRAND}`,
    html: shell({ title: `Verification rejected — ${BRAND}`, preheader: "Please resubmit your documents.", body }),
    text: `Hi ${name || "there"},\n\nNot approved. Reason: ${reason}\n\nPlease resubmit.\n\n${SUPPORT}\n\n— ${BRAND}`,
  });
}

export async function sendVerificationResetEmail({ to, name, note }) {
  if (!to) throw new Error("sendVerificationResetEmail: `to` is required");
  const safeName = esc(name || "there");
  const safeNote = esc(note || "Please resubmit with clearer photos.");
  const body = `
    <h2>Please Resubmit Your Documents</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <div class="banner-amber">
      <div class="icon">🔄</div>
      <div class="headline">Resubmission Required</div>
      <div class="sub">Please upload new documents to continue.</div>
    </div>
    <div class="warning">${safeNote}</div>
    <p>Questions? <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a></p>
  `;
  return send({
    to, subject: `Action required: resubmit your documents — ${BRAND}`,
    html: shell({ title: `Resubmit documents — ${BRAND}`, preheader: "Resubmit your verification documents.", body }),
    text: `Hi ${name || "there"},\n\nPlease resubmit your documents.\n\nNote: ${note}\n\n— ${BRAND}`,
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   NEW — LISTING EXPIRY EMAILS
════════════════════════════════════════════════════════════════════════════ */

/**
 * sendListingExpiryEmail
 * Sent when one or more free listings have been paused (active_until passed).
 *
 * @param {{ to: string, name: string, products: { id: string, title: string }[] }} opts
 */
export async function sendListingExpiryEmail({ to, name, products = [] }) {
  if (!to) throw new Error("sendListingExpiryEmail: `to` is required");

  const safeName = esc(name || "there");
  const count    = products.length;
  const renewUrl = `${FRONTEND_URL}/dashboard`;

  const productListHtml = `
    <ul class="product-list">
      ${products.map((p) => `<li><strong>${esc(p.title)}</strong></li>`).join("")}
    </ul>`;

  const body = `
    <h2>${count === 1 ? "Your listing has expired" : `${count} listings have expired`}</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>The following listing${count !== 1 ? "s" : ""} on <strong>${esc(BRAND)}</strong>
       ${count !== 1 ? "have" : "has"} expired and ${count !== 1 ? "are" : "is"} now
       hidden from buyers:</p>
    ${productListHtml}
    <div class="banner-red">
      <div class="icon">⏰</div>
      <div class="headline">Listing${count !== 1 ? "s" : ""} Expired</div>
      <div class="sub">Renew for free to get back in front of buyers.</div>
    </div>
    <p style="text-align:center;">
      <a href="${esc(renewUrl)}" class="cta cta-orange">Renew My Listings</a>
    </p>
    <p style="font-size:13px;color:#64748b;">
      Renewal is free — your listing will go live again for 30 more days.
    </p>
  `;

  return send({
    to,
    subject: count === 1
      ? `Your listing has expired — renew for free on ${BRAND}`
      : `${count} listings have expired — renew for free on ${BRAND}`,
    html: shell({
      title    : `Listings expired — ${BRAND}`,
      preheader: `${count} listing${count !== 1 ? "s" : ""} expired. Renew free to stay visible.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `The following listing${count !== 1 ? "s" : ""} on ${BRAND} ${count !== 1 ? "have" : "has"} expired:`,
      ``,
      ...products.map((p) => `  • ${p.title}`),
      ``,
      `Renew for free: ${renewUrl}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/**
 * sendListingExpiryWarningEmail
 * Sent 3 days and 1 day before a listing expires.
 *
 * @param {{
 *   to: string, name: string, days: number, label: string,
 *   isTrial: boolean, products: { id: string, title: string, activeUntil: Date }[]
 * }} opts
 */
export async function sendListingExpiryWarningEmail({
  to, name, days, label, isTrial = false, products = [],
}) {
  if (!to) throw new Error("sendListingExpiryWarningEmail: `to` is required");

  const safeName  = esc(name || "there");
  const count     = products.length;
  const actionUrl = isTrial
    ? `${FRONTEND_URL}/verification`
    : `${FRONTEND_URL}/dashboard`;
  const actionLabel = isTrial ? "Verify My Identity" : "Renew My Listings";

  const productListHtml = `
    <ul class="product-list">
      ${products.map((p) => `
        <li>
          <strong>${esc(p.title)}</strong>
          ${p.activeUntil ? `<br/><span style="font-size:12px;color:#64748b;">Expires: ${formatDate(p.activeUntil)}</span>` : ""}
        </li>`).join("")}
    </ul>`;

  const body = `
    <h2>Your listing${count !== 1 ? "s expire" : " expires"} ${label}</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>${count === 1 ? "This listing" : `These ${count} listings`} will expire <strong>${label}</strong>:</p>
    ${productListHtml}
    <div class="countdown">
      <div class="countdown-days">${days}</div>
      <div class="countdown-label">day${days !== 1 ? "s" : ""} remaining</div>
    </div>
    <div class="banner-amber">
      <div class="icon">⚠️</div>
      <div class="headline">Act Before ${label.charAt(0).toUpperCase() + label.slice(1)}</div>
      <div class="sub">
        ${isTrial
          ? "Verify your identity to keep your listings live permanently."
          : "Renew for free to stay visible to buyers."}
      </div>
    </div>
    <p style="text-align:center;">
      <a href="${esc(actionUrl)}" class="cta cta-orange">${esc(actionLabel)}</a>
    </p>
  `;

  return send({
    to,
    subject: `⚠️ ${count === 1 ? "Your listing" : `${count} listings`} expire${count === 1 ? "s" : ""} ${label} — ${BRAND}`,
    html: shell({
      title    : `Listings expiring ${label} — ${BRAND}`,
      preheader: `${count} listing${count !== 1 ? "s" : ""} expire${count === 1 ? "s" : ""} ${label}. ${isTrial ? "Verify now." : "Renew free."}`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your listing${count !== 1 ? "s" : ""} expire${count === 1 ? "s" : ""} ${label}:`,
      ``,
      ...products.map((p) => `  • ${p.title}`),
      ``,
      isTrial
        ? `Verify your identity: ${actionUrl}`
        : `Renew for free: ${actionUrl}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/**
 * sendTrialExpiredEmail
 * Sent when an unverified seller's trial listings are paused.
 *
 * @param {{ to: string, name: string, products: { id: string, title: string }[] }} opts
 */
export async function sendTrialExpiredEmail({ to, name, products = [] }) {
  if (!to) throw new Error("sendTrialExpiredEmail: `to` is required");

  const safeName   = esc(name || "there");
  const count      = products.length;
  const verifyUrl  = `${FRONTEND_URL}/verification`;

  const productListHtml = `
    <ul class="product-list">
      ${products.map((p) => `<li><strong>${esc(p.title)}</strong></li>`).join("")}
    </ul>`;

  const body = `
    <h2>Your trial listing${count !== 1 ? "s have" : " has"} expired</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Your 7-day free trial has ended. The following listing${count !== 1 ? "s are" : " is"}
       now paused and hidden from buyers:</p>
    ${productListHtml}
    <div class="banner-amber">
      <div class="icon">🔒</div>
      <div class="headline">Trial Period Ended</div>
      <div class="sub">Verify your identity to restore your listings permanently.</div>
    </div>
    <ul class="benefit-list">
      <li><span class="tick">✓</span> Listings restored immediately after verification</li>
      <li><span class="tick">✓</span> Post up to 100 listings per day</li>
      <li><span class="tick">✓</span> Listings never expire</li>
      <li><span class="tick">✓</span> Verified seller badge</li>
    </ul>
    <p style="text-align:center;">
      <a href="${esc(verifyUrl)}" class="cta cta-orange">Verify My Identity</a>
    </p>
  `;

  return send({
    to,
    subject: `Your trial has ended — verify to restore your listings on ${BRAND}`,
    html: shell({
      title    : `Trial ended — ${BRAND}`,
      preheader: "Your free trial has ended. Verify your identity to restore your listings.",
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your 7-day free trial on ${BRAND} has ended.`,
      ``,
      `Paused listings:`,
      ...products.map((p) => `  • ${p.title}`),
      ``,
      `Verify your identity to restore them: ${verifyUrl}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   NEW — SUBSCRIPTION LIFECYCLE EMAILS
════════════════════════════════════════════════════════════════════════════ */

/**
 * sendSubscriptionExpiryWarningEmail
 * Sent at 7, 3, and 1 day before subscription expires.
 *
 * @param {{
 *   to: string, name: string, days: number, label: string,
 *   planName: string, expiresAt: Date, billingCycle: string
 * }} opts
 */
export async function sendSubscriptionExpiryWarningEmail({
  to, name, days, label, planName, expiresAt, billingCycle,
}) {
  if (!to) throw new Error("sendSubscriptionExpiryWarningEmail: `to` is required");

  const safeName    = esc(name     || "there");
  const safePlan    = esc(planName || "your plan");
  const renewUrl    = `${FRONTEND_URL}/seller/subscription`;
  const formattedDt = formatDate(expiresAt);

  const body = `
    <h2>Your subscription expires ${label}</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Your <strong>${safePlan}</strong> subscription on ${esc(BRAND)} expires
       <strong>${label}</strong> (${formattedDt}).</p>
    <div class="countdown">
      <div class="countdown-days">${days}</div>
      <div class="countdown-label">day${days !== 1 ? "s" : ""} left</div>
    </div>
    <div class="banner-amber">
      <div class="icon">⏳</div>
      <div class="headline">Renew to Keep Your Listings Active</div>
      <div class="sub">
        After expiry you have a <strong>7-day grace period</strong> before
        your listings are paused. Renew now to avoid any interruption.
      </div>
    </div>
    <ul class="benefit-list">
      <li><span class="tick">✓</span> Listings stay permanently active</li>
      <li><span class="tick">✓</span> No expiry date on any listing</li>
      <li><span class="tick">✓</span> Priority search placement</li>
      <li><span class="tick">✓</span> All ${safePlan} features retained</li>
    </ul>
    <p style="text-align:center;">
      <a href="${esc(renewUrl)}" class="cta cta-orange">Renew Subscription</a>
    </p>
    <p style="font-size:13px;color:#64748b;">
      Billed ${billingCycle === "yearly" ? "annually" : "monthly"}.
      Cancel anytime from your account settings.
    </p>
  `;

  return send({
    to,
    subject: `⚠️ Your ${planName} subscription expires ${label} — ${BRAND}`,
    html: shell({
      title    : `Subscription expiring ${label} — ${BRAND}`,
      preheader: `Your ${planName} subscription expires ${label}. Renew to keep listings active.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your ${planName} subscription on ${BRAND} expires ${label} (${formattedDt}).`,
      ``,
      `After expiry you have a 7-day grace period before your listings are paused.`,
      ``,
      `Renew now: ${renewUrl}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/**
 * sendSubscriptionExpiredEmail
 * Sent the moment the subscription expires — grace period has started.
 * Seller has GRACE_PERIOD_DAYS days to renew before listings are paused.
 *
 * @param {{
 *   to: string, name: string, planName: string,
 *   expiresAt: Date, graceDays: number
 * }} opts
 */
export async function sendSubscriptionExpiredEmail({
  to, name, planName, expiresAt, graceDays = 7,
}) {
  if (!to) throw new Error("sendSubscriptionExpiredEmail: `to` is required");

  const safeName    = esc(name     || "there");
  const safePlan    = esc(planName || "your plan");
  const renewUrl    = `${FRONTEND_URL}/seller/subscription`;
  const formattedDt = formatDate(expiresAt);
  const graceEndDt  = new Date(new Date(expiresAt).getTime() + graceDays * 86_400_000);

  const body = `
    <h2>Your subscription has expired</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Your <strong>${safePlan}</strong> subscription expired on
       <strong>${formattedDt}</strong>.</p>
    <div class="banner-amber">
      <div class="icon">⏰</div>
      <div class="headline">${graceDays}-Day Grace Period Active</div>
      <div class="sub">
        Your listings are <strong>still live</strong>. You have until
        <strong>${formatDate(graceEndDt)}</strong> to renew before they are paused.
      </div>
    </div>
    <div class="countdown">
      <div class="countdown-days">${graceDays}</div>
      <div class="countdown-label">days to renew before listings are paused</div>
    </div>
    <p style="text-align:center;">
      <a href="${esc(renewUrl)}" class="cta cta-orange">Renew Now — Keep Listings Live</a>
    </p>
    <p style="font-size:13px;color:#64748b;">
      If you do not renew by ${formatDate(graceEndDt)}, your listings will be
      paused automatically.
    </p>
  `;

  return send({
    to,
    subject: `Your ${planName} subscription has expired — ${graceDays}-day grace period started`,
    html: shell({
      title    : `Subscription expired — ${BRAND}`,
      preheader: `Grace period active. Your listings stay live for ${graceDays} more days. Renew now.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your ${planName} subscription on ${BRAND} expired on ${formattedDt}.`,
      ``,
      `Your listings are still live for ${graceDays} more days (until ${formatDate(graceEndDt)}).`,
      `Renew now to avoid any interruption.`,
      ``,
      `Renew: ${renewUrl}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/**
 * sendSubscriptionGraceExpiredEmail
 * Sent when the grace period ends and listings are paused.
 *
 * @param {{
 *   to: string, name: string, planSlug: string,
 *   expiresAt: Date, graceDays: number
 * }} opts
 */
export async function sendSubscriptionGraceExpiredEmail({
  to, name, planSlug, expiresAt, graceDays = 7,
}) {
  if (!to) throw new Error("sendSubscriptionGraceExpiredEmail: `to` is required");

  const safeName = esc(name     || "there");
  const safePlan = esc(planSlug || "your plan");
  const renewUrl = `${FRONTEND_URL}/seller/subscription`;

  const body = `
    <h2>Your listings have been paused</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>Your <strong>${safePlan}</strong> subscription expired and the
       <strong>${graceDays}-day grace period</strong> has ended.
       Your listings are now paused and hidden from buyers.</p>
    <div class="banner-red">
      <div class="icon">🔴</div>
      <div class="headline">Listings Paused</div>
      <div class="sub">
        Renew your subscription to restore all listings immediately.
      </div>
    </div>
    <ul class="benefit-list">
      <li><span class="warn">!</span> All your listings are currently hidden from buyers</li>
      <li><span class="tick">✓</span> Renewing restores them within minutes</li>
      <li><span class="tick">✓</span> No listings are deleted — they are safely paused</li>
    </ul>
    <p style="text-align:center;">
      <a href="${esc(renewUrl)}" class="cta cta-orange">Renew &amp; Restore Listings</a>
    </p>
    <p style="font-size:13px;color:#64748b;">
      Questions? <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a>
    </p>
  `;

  return send({
    to,
    subject: `Your listings have been paused — renew to restore on ${BRAND}`,
    html: shell({
      title    : `Listings paused — ${BRAND}`,
      preheader: "Your grace period ended. Renew your subscription to restore your listings.",
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your ${planSlug} subscription grace period has ended.`,
      `Your listings on ${BRAND} are now paused.`,
      ``,
      `Renew to restore them immediately: ${renewUrl}`,
      ``,
      `Your listings are not deleted — just paused until you renew.`,
      ``,
      `Questions? ${SUPPORT}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}