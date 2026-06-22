/**
 * services/email.js
 * Transport : Resend SDK
 * Fallback  : console log when RESEND_API_KEY is absent (development)
 */

import { Resend } from "resend";

/* ── config ─────────────────────────────────────────────────────────────── */
const FROM_ADDRESS = process.env.EMAIL_FROM    || "Loemart <no-reply@loemart.com>";
const BRAND        = process.env.EMAIL_BRAND   || "Loemart";
const SUPPORT      = process.env.EMAIL_SUPPORT || "support@loemart.com";
const YEAR         = new Date().getFullYear();
const IS_PROD      = process.env.NODE_ENV === "production";

/* ── singleton Resend client ────────────────────────────────────────────── */
let _resend = null;

function getClient() {
  if (_resend) return _resend;

  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] ⚠  RESEND_API_KEY is not set — dev console fallback active");
    return null;
  }

  _resend = new Resend(process.env.RESEND_API_KEY);
  console.log("[email] Resend client initialised");
  return _resend;
}

/* ── XSS guard ──────────────────────────────────────────────────────────── */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}

/* ── plain-text extractor ───────────────────────────────────────────────── */
function toText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ── base email shell ───────────────────────────────────────────────────── */
function shell({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${esc(title)}</title>
  <style>
    body,table,td,div,p{margin:0;padding:0;}
    body{background:#060b14;font-family:-apple-system,BlinkMacSystemFont,
      'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
    table{border-spacing:0;border-collapse:collapse;}
    img{border:0;display:block;max-width:100%;}

    .outer{background:#060b14;padding:40px 16px 60px;}
    .card {background:#0d1523;border-radius:16px;max-width:520px;
           margin:0 auto;overflow:hidden;
           border:1px solid rgba(255,255,255,0.07);}

    .brand-bar{padding:24px 32px;
               border-bottom:1px solid rgba(255,255,255,0.07);}
    .brand-name{font-size:22px;font-weight:800;
                color:#f1f5f9;letter-spacing:-0.5px;}
    .brand-dot{color:#3b82f6;}

    .body{padding:32px;}

    h2{font-size:20px;font-weight:700;color:#f1f5f9;margin:0 0 12px;}
    p {font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 14px;}
    p:last-child{margin-bottom:0;}
    strong{color:#f1f5f9;}
    .hi{color:#f1f5f9;font-weight:600;}

    .otp-wrap{text-align:center;margin:28px 0;}
    .otp-box {display:inline-block;
              background:#111c2d;
              border:2px dashed rgba(59,130,246,0.45);
              border-radius:14px;padding:22px 44px;}
    .otp-code{font-size:40px;font-weight:800;letter-spacing:12px;
              color:#f1f5f9;font-family:monospace;}

    .warning{background:rgba(245,158,11,0.08);
             border:1px solid rgba(245,158,11,0.22);
             border-radius:9px;padding:13px 16px;margin:18px 0;
             font-size:13px;color:#fcd34d;line-height:1.55;}

    .info-box{background:#111c2d;
              border-left:3px solid #ef4444;
              border-radius:0 8px 8px 0;
              padding:13px 16px;margin:16px 0;
              font-size:13px;color:#fca5a5;line-height:1.55;}

    .step-row{display:flex;gap:12px;align-items:flex-start;
              margin-bottom:10px;padding:12px 14px;
              background:#111c2d;border-radius:8px;
              border:1px solid rgba(255,255,255,0.05);}
    .step-dot{width:8px;height:8px;border-radius:50%;
              background:#3b82f6;flex-shrink:0;margin-top:5px;}
    .step-title{font-size:13px;font-weight:600;
                color:#f1f5f9;margin:0 0 3px;}
    .step-desc{font-size:12px;color:#64748b;margin:0;}

    .footer{padding:18px 32px 26px;
            border-top:1px solid rgba(255,255,255,0.07);
            font-size:11px;color:#475569;
            text-align:center;line-height:1.7;}
    .footer a{color:#3b82f6;text-decoration:none;}

    @media(max-width:480px){
      .body{padding:24px 18px;}
      .brand-bar{padding:20px 18px;}
      .footer{padding:16px 18px 24px;}
      .otp-code{font-size:32px;letter-spacing:8px;}
      .otp-box{padding:18px 28px;}
    }
  </style>
</head>
<body>
  <!--preview text-->
  <div style="display:none;max-height:0;overflow:hidden;
              mso-hide:all;color:#060b14;">
    ${esc(preheader)}&nbsp;&#847;&nbsp;&#847;&nbsp;
  </div>

  <div class="outer">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center">
        <div class="card">

          <!--brand-->
          <div class="brand-bar">
            <span class="brand-name">
              Loe<span class="brand-dot">mart</span>
            </span>
          </div>

          <!--body-->
          <div class="body">
            ${body}
          </div>

          <!--footer-->
          <div class="footer">
            Questions? <a href="mailto:${SUPPORT}">${SUPPORT}</a><br />
            &copy; ${YEAR} ${BRAND}. All rights reserved.<br />
            You received this because you have a ${BRAND} account.
          </div>

        </div>
      </td></tr>
    </table>
  </div>
</body>
</html>`;
}

/* ── core send ──────────────────────────────────────────────────────────── */
async function send({ to, subject, html, text }) {
  if (!to || !subject || !html) {
    throw new Error("[email] send() — to, subject and html are all required");
  }

  const toArr  = Array.isArray(to) ? to : [to];
  const client = getClient();

  /* development / no-key fallback */
  if (!client) {
    console.log("\n" + "═".repeat(62));
    console.log("[email] 📧  DEV — email NOT sent (no RESEND_API_KEY)");
    console.log(`  To      : ${toArr.join(", ")}`);
    console.log(`  Subject : ${subject}`);
    if (text) {
      console.log(`  Body    :\n${text.split("\n").map((l) => "  " + l).join("\n")}`);
    }
    console.log("═".repeat(62) + "\n");
    return { id: `dev-${Date.now()}` };
  }

  const result = await client.emails.send({
    from : FROM_ADDRESS,
    to   : toArr,
    subject,
    html,
    text : text ?? toText(html),
  });

  /* Resend SDK v4 returns { data: { id }, error: null } on success */
  if (result.error) {
    throw new Error(`Resend API error: ${result.error.message}`);
  }

  console.log(`[email] ✓ sent "${subject}" → ${toArr.join(", ")} (id: ${result.data?.id})`);
  return result.data;
}

/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC EXPORTS
════════════════════════════════════════════════════════════════════════════ */

/**
 * sendVerificationEmail
 * Sends the 6-digit OTP that proves the user owns the address.
 */
export async function sendVerificationEmail({ to, name, otp }) {
  if (!to)  throw new Error("sendVerificationEmail: `to` is required");
  if (!otp) throw new Error("sendVerificationEmail: `otp` is required");

  const otpStr = String(otp).trim();
  if (!/^\d{6}$/.test(otpStr)) {
    throw new Error(`sendVerificationEmail: otp must be 6 digits — got "${otpStr}"`);
  }

  const safeName = esc(name  || "there");
  const safeOtp  = esc(otpStr);

  const body = `
    <h2>Verify your email address</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>
      Enter the code below to verify your <strong>${BRAND}</strong> account.
      It expires in <strong>10&nbsp;minutes</strong> — do not share it with anyone.
    </p>

    <div class="otp-wrap">
      <div class="otp-box">
        <div class="otp-code">${safeOtp}</div>
      </div>
    </div>

    <div class="warning">
      <strong>Security notice:</strong> ${BRAND} staff will
      <strong>never</strong> ask for this code. If you did not request it,
      ignore this email — your account is safe.
    </div>
  `;

  return send({
    to,
    subject : `${safeOtp} — your ${BRAND} verification code`,
    html    : shell({
      title     : `Verify your ${BRAND} account`,
      preheader : `Your verification code is ${safeOtp}. Expires in 10 minutes.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your ${BRAND} verification code is:`,
      ``,
      `  ${otpStr}`,
      ``,
      `This code expires in 10 minutes.`,
      `Never share it with anyone — ${BRAND} staff will never ask for it.`,
      ``,
      `If you did not request this, ignore this email.`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/**
 * sendWelcomeEmail
 * Fired in the background after a user successfully verifies their email.
 */
export async function sendWelcomeEmail({ to, name }) {
  if (!to) throw new Error("sendWelcomeEmail: `to` is required");

  const safeName = esc(name || "there");

  const steps = [
    {
      title : "Complete identity verification",
      desc  : "Upload a government-issued ID and selfie to raise your trust score.",
    },
    {
      title : "Set up your store profile",
      desc  : "Start selling to thousands of buyers across Nigeria.",
    },
    {
      title : "Explore the marketplace",
      desc  : "Discover great deals from verified sellers.",
    },
  ];

  const stepsHtml = steps.map(({ title, desc }) => `
    <div class="step-row">
      <div class="step-dot"></div>
      <div>
        <p class="step-title">${esc(title)}</p>
        <p class="step-desc">${esc(desc)}</p>
      </div>
    </div>
  `).join("");

  const body = `
    <h2>Welcome to ${esc(BRAND)} 🎉</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>
      Your email has been verified and your account is now active.
      Here is what to do next:
    </p>
    <div style="margin:20px 0;">${stepsHtml}</div>
    <p style="font-size:13px;color:#64748b;">
      If you have any questions, reply to this email or contact
      <a href="mailto:${SUPPORT}" style="color:#3b82f6;">${SUPPORT}</a>.
    </p>
  `;

  return send({
    to,
    subject : `Welcome to ${BRAND} — you're verified`,
    html    : shell({
      title     : `Welcome to ${BRAND}`,
      preheader : `Your ${BRAND} account is active. Here is what to do next.`,
      body,
    }),
    text: [
      `Welcome to ${BRAND}, ${name || "there"}!`,
      ``,
      `Your email is verified and your account is active.`,
      ``,
      `Next steps:`,
      ...steps.map((s, i) => `  ${i + 1}. ${s.title}`),
      ``,
      `Questions? ${SUPPORT}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/**
 * sendIdentityStatusEmail
 * Called by admin routes after approving or rejecting an identity submission.
 */
export async function sendIdentityStatusEmail({ to, name, approved, reason }) {
  if (!to) throw new Error("sendIdentityStatusEmail: `to` is required");

  const safeName = esc(name || "there");

  const body = approved
    ? `
        <h2>Identity Verified ✓</h2>
        <p>Hi <span class="hi">${safeName}</span>,</p>
        <p>
          Your identity has been successfully verified. Your trust score has
          been updated and you now have full access to all seller features.
        </p>
      `
    : `
        <h2>Identity Verification Update</h2>
        <p>Hi <span class="hi">${safeName}</span>,</p>
        <p>
          Unfortunately we could not verify your identity. The reason provided
          by our review team is shown below.
        </p>
        <div class="info-box">
          ${esc(reason || "Your documents did not meet our verification requirements.")}
        </div>
        <p>
          Please log in to your account and resubmit your documents.
          If you believe this decision is an error, contact
          <a href="mailto:${SUPPORT}" style="color:#3b82f6;">${SUPPORT}</a>.
        </p>
      `;

  return send({
    to,
    subject : approved
      ? `Identity verified — ${BRAND}`
      : `Action required: identity verification — ${BRAND}`,
    html    : shell({
      title     : approved ? `Identity verified — ${BRAND}` : `Identity update — ${BRAND}`,
      preheader : approved
        ? "Your identity has been successfully verified."
        : "Your identity verification needs your attention.",
      body,
    }),
    text: approved
      ? [
          `Hi ${name || "there"},`,
          ``,
          `Your identity has been verified on ${BRAND}.`,
          ``,
          `— ${BRAND}`,
        ].join("\n")
      : [
          `Hi ${name || "there"},`,
          ``,
          `Your identity verification was not approved.`,
          ``,
          `Reason: ${reason ?? "Your documents did not meet our requirements."}`,
          ``,
          `Please log in and resubmit your documents.`,
          `Questions? ${SUPPORT}`,
          ``,
          `— ${BRAND}`,
        ].join("\n"),
  });
}

/**
 * sendStoreStatusEmail
 * Called by admin routes after approving or rejecting a store submission.
 */
export async function sendStoreStatusEmail({ to, name, storeName, approved, reason }) {
  if (!to) throw new Error("sendStoreStatusEmail: `to` is required");

  const safeName  = esc(name      || "there");
  const safeStore = esc(storeName || "your store");

  const body = approved
    ? `
        <h2>Store Approved ✓</h2>
        <p>Hi <span class="hi">${safeName}</span>,</p>
        <p>
          <strong>${safeStore}</strong> has been approved and is now live
          on ${esc(BRAND)}. Buyers can find your store and purchase your listings.
        </p>
      `
    : `
        <h2>Store Verification Update</h2>
        <p>Hi <span class="hi">${safeName}</span>,</p>
        <p>
          Your store <strong>${safeStore}</strong> was not approved.
          The reason provided is shown below.
        </p>
        <div class="info-box">
          ${esc(reason || "Your store profile did not meet our requirements.")}
        </div>
        <p>
          Please update your store profile and resubmit.
          Questions? <a href="mailto:${SUPPORT}" style="color:#3b82f6;">${SUPPORT}</a>.
        </p>
      `;

  return send({
    to,
    subject : approved
      ? `Store approved — ${BRAND}`
      : `Action required: store verification — ${BRAND}`,
    html    : shell({
      title     : approved ? `Store approved — ${BRAND}` : `Store update — ${BRAND}`,
      preheader : approved
        ? `${storeName} is now live on ${BRAND}.`
        : "Your store verification needs your attention.",
      body,
    }),
    text: approved
      ? [
          `Hi ${name || "there"},`,
          ``,
          `${storeName} has been approved on ${BRAND}.`,
          ``,
          `— ${BRAND}`,
        ].join("\n")
      : [
          `Hi ${name || "there"},`,
          ``,
          `Your store was not approved.`,
          ``,
          `Reason: ${reason ?? "Your store profile did not meet our requirements."}`,
          ``,
          `Please update your store profile and resubmit.`,
          `Questions? ${SUPPORT}`,
          ``,
          `— ${BRAND}`,
        ].join("\n"),
  });
}