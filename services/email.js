/**
 * services/email.js
 *
 * All outbound email for the verification flow.
 * Transport: Resend SDK
 * Fallback : console log when RESEND_API_KEY is missing (development)
 */

import { Resend } from "resend";

/* ─── config ──────────────────────────────────────────────────────────────── */
const FROM      = "Loemart <no-reply@loemart.com>";
const BRAND     = "Loemart";
const SUPPORT   = "support@loemart.com";
const YEAR      = new Date().getFullYear();

let resend = null;

const getResend = () => {
  if (resend) return resend;

  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "[email] RESEND_API_KEY not set — emails will be logged to console only."
    );
    return null;
  }

  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
};

/* ─── send helper ─────────────────────────────────────────────────────────── */
async function send({ to, subject, html, text }) {
  // Validate
  if (!to || !subject || !html) {
    throw new Error("[email] send() missing required fields: to, subject, html");
  }

  const client = getResend();

  // Development fallback — log and return a fake success
  if (!client) {
    console.log("─".repeat(60));
    console.log("[email] DEV MODE — would send email:");
    console.log(`  To      : ${to}`);
    console.log(`  Subject : ${subject}`);
    console.log(`  Text    :\n${text ?? "(no plain-text version)"}`);
    console.log("─".repeat(60));
    return { id: `dev-${Date.now()}` };
  }

  const result = await client.emails.send({
    from    : FROM,
    to      : Array.isArray(to) ? to : [to],
    subject,
    html,
    text    : text ?? stripHtml(html),
  });

  // Resend returns { data: { id }, error: null } on success
  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  console.log(`[email] Sent "${subject}" → ${to} (id: ${result.data?.id})`);
  return result.data;
}

/* ─── strip HTML for plain-text fallback ──────────────────────────────────── */
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ─── XSS guard — never inject raw user input into HTML ──────────────────── */
function esc(str) {
  return String(str ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}

/* ─── base template ───────────────────────────────────────────────────────── */
function baseHtml({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>${esc(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    body{margin:0;padding:0;background:#060b14;font-family:
      -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
    table{border-spacing:0;}
    td{padding:0;}
    img{border:0;display:block;}
    .wrapper{background:#060b14;padding:40px 16px;}
    .card{background:#0d1523;border-radius:16px;max-width:520px;
      margin:0 auto;overflow:hidden;
      border:1px solid rgba(255,255,255,0.07);}
    .brand{padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.07);}
    .brand-name{font-size:22px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px;}
    .brand-dot{color:#3b82f6;}
    .content{padding:32px;}
    .footer{padding:20px 32px 28px;border-top:1px solid rgba(255,255,255,0.07);
      font-size:11px;color:#475569;text-align:center;line-height:1.6;}
    .footer a{color:#3b82f6;text-decoration:none;}
    h2{font-size:20px;font-weight:700;color:#f1f5f9;margin:0 0 8px;}
    p{font-size:14px;color:#94a3b8;line-height:1.6;margin:0 0 16px;}
    p:last-child{margin-bottom:0;}
    .highlight{color:#f1f5f9;}
    .btn{display:inline-block;background:#3b82f6;color:#fff !important;
      font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;
      text-decoration:none;margin:4px 0;}
    .alert-box{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);
      border-radius:8px;padding:12px 16px;margin:16px 0;
      font-size:13px;color:#fcd34d;line-height:1.5;}
    @media (max-width:480px){
      .content{padding:24px 20px;}
      .brand{padding:20px;}
      .footer{padding:16px 20px 24px;}
    }
  </style>
</head>
<body>
  <!-- preview text -->
  <div style="display:none;max-height:0;overflow:hidden;color:#060b14;">
    ${esc(preheader)}&nbsp;
  </div>
  <div class="wrapper">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center">
        <div class="card">
          <!-- brand bar -->
          <div class="brand">
            <span class="brand-name">Loe<span class="brand-dot">mart</span></span>
          </div>
          <!-- body -->
          <div class="content">
            ${body}
          </div>
          <!-- footer -->
          <div class="footer">
            <p style="margin:0 0 4px;">
              Need help? <a href="mailto:${SUPPORT}">${SUPPORT}</a>
            </p>
            <p style="margin:0;">
              &copy; ${YEAR} ${BRAND}. All rights reserved.<br/>
              You received this because you have an account on Loemart.
            </p>
          </div>
        </div>
      </td></tr>
    </table>
  </div>
</body>
</html>`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLIC API
══════════════════════════════════════════════════════════════════════════════ */

/**
 * sendVerificationEmail
 * Sends a 6-digit OTP to verify the user's email address.
 */
export async function sendVerificationEmail({ to, name, otp }) {
  if (!to || !otp) throw new Error("sendVerificationEmail: to and otp are required");
  if (!/^\d{6}$/.test(String(otp))) throw new Error("sendVerificationEmail: otp must be 6 digits");

  const safeName = esc(name || "there");
  const safeOtp  = esc(String(otp));

  const body = `
    <h2>Verify your email</h2>
    <p>Hi <span class="highlight">${safeName}</span>,</p>
    <p>Use the code below to verify your Loemart account.
       It expires in <span class="highlight">10 minutes</span>.</p>

    <!-- OTP block -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:24px 0;">
      <tr>
        <td align="center">
          <div style="
            display:inline-block;
            background:#111c2d;
            border:2px dashed rgba(59,130,246,0.4);
            border-radius:12px;
            padding:20px 40px;
          ">
            <span style="
              font-size:38px;
              font-weight:800;
              letter-spacing:10px;
              color:#f1f5f9;
              font-family:monospace;
            ">${safeOtp}</span>
          </div>
        </td>
      </tr>
    </table>

    <div class="alert-box">
      <strong>Security notice:</strong> Never share this code with anyone.
      Loemart staff will <strong>never</strong> ask for your OTP.
    </div>

    <p style="font-size:13px;">
      If you did not request this, you can safely ignore this email.
    </p>
  `;

  return send({
    to,
    subject : `${safeOtp} is your Loemart verification code`,
    html    : baseHtml({
      title     : "Verify your Loemart account",
      preheader : `Your verification code is ${safeOtp}. It expires in 10 minutes.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your Loemart verification code is: ${otp}`,
      ``,
      `This code expires in 10 minutes.`,
      ``,
      `Never share this code with anyone. Loemart staff will never ask for it.`,
      ``,
      `If you did not request this, ignore this email.`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/**
 * sendWelcomeEmail
 * Sent after the user successfully verifies their email.
 */
export async function sendWelcomeEmail({ to, name }) {
  if (!to) throw new Error("sendWelcomeEmail: to is required");

  const safeName = esc(name || "there");

  const body = `
    <h2>Welcome to Loemart 🎉</h2>
    <p>Hi <span class="highlight">${safeName}</span>,</p>
    <p>
      Your email address has been verified and your account is now active.
      You can now browse, buy, and sell on Loemart.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:24px 0 8px;">
      <tr>
        <td>
          <p style="font-size:13px;font-weight:600;color:#94a3b8;margin:0 0 12px;">
            NEXT STEPS
          </p>
          ${[
            ["Complete identity verification", "Increases your trust score and unlocks seller features."],
            ["Set up your store profile",       "Start selling to thousands of buyers on Loemart."],
            ["Explore the marketplace",          "Discover great deals from verified sellers."],
          ].map(([title, desc]) => `
            <div style="
              display:flex;gap:12px;align-items:flex-start;
              margin-bottom:12px;
              padding:12px 14px;
              background:#111c2d;
              border-radius:8px;
              border:1px solid rgba(255,255,255,0.06);
            ">
              <div style="
                width:8px;height:8px;border-radius:50%;
                background:#3b82f6;flex-shrink:0;margin-top:4px;
              "></div>
              <div>
                <p style="
                  font-size:13px;font-weight:600;
                  color:#f1f5f9;margin:0 0 3px;
                ">${esc(title)}</p>
                <p style="font-size:12px;color:#64748b;margin:0;">
                  ${esc(desc)}
                </p>
              </div>
            </div>
          `).join("")}
        </td>
      </tr>
    </table>
  `;

  return send({
    to,
    subject : `Welcome to ${BRAND} — account verified`,
    html    : baseHtml({
      title     : `Welcome to ${BRAND}`,
      preheader : "Your account is verified and ready. Here is what to do next.",
      body,
    }),
    text: [
      `Welcome to ${BRAND}, ${name || "there"}!`,
      ``,
      `Your email has been verified and your account is now active.`,
      ``,
      `Next steps:`,
      `  1. Complete identity verification`,
      `  2. Set up your store profile`,
      `  3. Explore the marketplace`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/**
 * sendIdentityStatusEmail
 * Notifies user when their ID submission is approved or rejected by admin.
 */
export async function sendIdentityStatusEmail({ to, name, approved, reason }) {
  if (!to) throw new Error("sendIdentityStatusEmail: to is required");

  const safeName = esc(name || "there");
  const status   = approved ? "approved" : "rejected";

  const body = approved
    ? `
        <h2>Identity Verified ✓</h2>
        <p>Hi <span class="highlight">${safeName}</span>,</p>
        <p>
          Great news — your identity has been verified. Your trust score has
          been updated and you now have access to all seller features on Loemart.
        </p>
      `
    : `
        <h2>Identity Verification Update</h2>
        <p>Hi <span class="highlight">${safeName}</span>,</p>
        <p>
          Unfortunately, we were unable to verify your identity. Here is the
          reason provided by our review team:
        </p>
        <div style="
          background:#111c2d;
          border-left:3px solid #ef4444;
          border-radius:0 8px 8px 0;
          padding:12px 16px;
          margin:16px 0;
          font-size:13px;
          color:#fca5a5;
          line-height:1.5;
        ">
          ${esc(reason || "Your documents did not meet our verification requirements.")}
        </div>
        <p>
          Please re-submit your identity documents from your account settings.
          If you believe this is an error, contact our support team.
        </p>
      `;

  return send({
    to,
    subject : approved
      ? `Identity verified — ${BRAND}`
      : `Action required: identity verification — ${BRAND}`,
    html    : baseHtml({
      title     : `Identity ${status} — ${BRAND}`,
      preheader : approved
        ? "Your identity has been successfully verified."
        : "Your identity verification needs attention.",
      body,
    }),
    text: approved
      ? `Hi ${name},\n\nYour identity has been verified on ${BRAND}.\n\n— ${BRAND}`
      : `Hi ${name},\n\nYour identity verification was not approved.\n\nReason: ${reason ?? "See your account for details."}\n\nPlease resubmit from your account settings.\n\n— ${BRAND}`,
  });
}

/**
 * sendStoreStatusEmail
 * Notifies user when their store submission is approved or rejected.
 */
export async function sendStoreStatusEmail({ to, name, storeName, approved, reason }) {
  if (!to) throw new Error("sendStoreStatusEmail: to is required");

  const safeName  = esc(name  || "there");
  const safeStore = esc(storeName || "your store");

  const body = approved
    ? `
        <h2>Store Approved ✓</h2>
        <p>Hi <span class="highlight">${safeName}</span>,</p>
        <p>
          <span class="highlight">${safeStore}</span> has been approved and
          is now live on Loemart. Buyers can find your store and purchase
          your listings.
        </p>
      `
    : `
        <h2>Store Verification Update</h2>
        <p>Hi <span class="highlight">${safeName}</span>,</p>
        <p>
          Your store <span class="highlight">${safeStore}</span> was not
          approved. Reason:
        </p>
        <div style="
          background:#111c2d;
          border-left:3px solid #ef4444;
          border-radius:0 8px 8px 0;
          padding:12px 16px;
          margin:16px 0;
          font-size:13px;
          color:#fca5a5;
          line-height:1.5;
        ">
          ${esc(reason || "Your store profile did not meet our requirements.")}
        </div>
        <p>Please update your store profile and resubmit.</p>
      `;

  return send({
    to,
    subject : approved
      ? `Store approved — ${BRAND}`
      : `Action required: store verification — ${BRAND}`,
    html    : baseHtml({
      title     : `Store ${approved ? "approved" : "update"} — ${BRAND}`,
      preheader : approved
        ? `${storeName} is now live on ${BRAND}.`
        : "Your store verification needs attention.",
      body,
    }),
    text: approved
      ? `Hi ${name},\n\n${storeName} has been approved on ${BRAND}.\n\n— ${BRAND}`
      : `Hi ${name},\n\nYour store was not approved.\n\nReason: ${reason ?? "See your account."}\n\n— ${BRAND}`,
  });
}