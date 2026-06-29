/**
 * services/email.js
 * Transport: Resend SDK
 */

import { Resend } from "resend";

/* ── config ─────────────────────────────────────────────────────────────── */
const FROM_ADDRESS = process.env.EMAIL_FROM    || "Loemart <no-reply@loemart.com>";
const BRAND        = process.env.EMAIL_BRAND   || "Loemart";
const SUPPORT      = process.env.EMAIL_SUPPORT || "support@loemart.com";
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
    /* OTP */
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
    /* OTP — orange variant (password reset) */
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
    /* status banners */
    .banner-green{
      background:rgba(22,163,74,0.10);
      border:1px solid rgba(22,163,74,0.30);
      border-radius:12px;padding:20px 24px;
      margin:20px 0;text-align:center;
    }
    .banner-green .icon{font-size:36px;margin-bottom:8px;}
    .banner-green .headline{
      font-size:18px;font-weight:800;color:#4ade80;margin-bottom:6px;
    }
    .banner-green .sub{font-size:13px;color:#86efac;line-height:1.6;}
    .banner-red{
      background:rgba(220,38,38,0.10);
      border:1px solid rgba(220,38,38,0.30);
      border-radius:12px;padding:20px 24px;
      margin:20px 0;text-align:center;
    }
    .banner-red .icon{font-size:36px;margin-bottom:8px;}
    .banner-red .headline{
      font-size:18px;font-weight:800;color:#f87171;margin-bottom:6px;
    }
    .banner-red .sub{font-size:13px;color:#fca5a5;line-height:1.6;}
    .banner-amber{
      background:rgba(217,119,6,0.10);
      border:1px solid rgba(217,119,6,0.30);
      border-radius:12px;padding:20px 24px;
      margin:20px 0;text-align:center;
    }
    .banner-amber .icon{font-size:36px;margin-bottom:8px;}
    .banner-amber .headline{
      font-size:18px;font-weight:800;color:#fbbf24;margin-bottom:6px;
    }
    .banner-amber .sub{font-size:13px;color:#fde68a;line-height:1.6;}
    /* benefit list */
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
    /* info box */
    .info-box{
      background:#111c2d;
      border-left:3px solid #ef4444;
      border-radius:0 8px 8px 0;
      padding:13px 16px;margin:16px 0;
      font-size:13px;color:#fca5a5;line-height:1.55;
    }
    /* warning */
    .warning{
      background:rgba(245,158,11,0.08);
      border:1px solid rgba(245,158,11,0.25);
      border-radius:9px;padding:13px 16px;margin:18px 0;
      font-size:13px;color:#fcd34d;line-height:1.55;
    }
    /* cta button */
    .cta{
      display:inline-block;margin:18px 0 4px;
      padding:13px 32px;border-radius:10px;
      font-size:14px;font-weight:700;text-decoration:none;
    }
    .cta-orange{background:#FF5C00;color:#fff;}
    .cta-blue  {background:#3b82f6;color:#fff;}
    /* reset-specific */
    .reset-banner{
      background:rgba(255,92,0,0.08);
      border:1px solid rgba(255,92,0,0.25);
      border-radius:12px;padding:20px 24px;
      margin:20px 0;text-align:center;
    }
    .reset-banner .icon    {font-size:36px;margin-bottom:8px;}
    .reset-banner .headline{
      font-size:18px;font-weight:800;color:#FF8040;margin-bottom:6px;
    }
    .reset-banner .sub     {font-size:13px;color:#FFAA80;line-height:1.6;}
    .reset-security{
      background:rgba(245,158,11,0.08);
      border:1px solid rgba(245,158,11,0.22);
      border-radius:9px;padding:12px 16px;
      margin:18px 0;font-size:12px;color:#fcd34d;line-height:1.55;
    }
    /* footer */
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
            <span class="brand-name">
              Loe<span class="brand-dot">mart</span>
            </span>
          </div>
          <div class="body">${body}</div>
          <div class="footer">
            Questions?
            <a href="mailto:${SUPPORT}">${SUPPORT}</a><br />
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
    console.log(`  From    : ${FROM_ADDRESS}`);
    console.log(`  To      : ${toArr.join(", ")}`);
    console.log(`  Subject : ${subject}`);
    if (text) {
      console.log("  Body:");
      text.split("\n").forEach((l) => console.log("    " + l));
    }
    console.log("═".repeat(64) + "\n");
    return { id: `dev-${Date.now()}` };
  }

  console.log(`[email] sending "${subject}" → ${toArr.join(", ")}`);

  let result;
  try {
    result = await client.emails.send({
      from    : FROM_ADDRESS,
      to      : toArr,
      subject,
      html,
      text    : text ?? toText(html),
    });
  } catch (sdkErr) {
    console.error("[email] SDK threw:", sdkErr.message);
    throw new Error(`Email SDK error: ${sdkErr.message}`);
  }

  console.log("[email] raw result:", JSON.stringify(result));

  if (result?.error) {
    console.error("[email] Resend API error:", result.error);
    throw new Error(`Resend API error: ${result.error.message}`);
  }

  const id = result?.data?.id ?? result?.id ?? "unknown";
  console.log(`[email] ✓ delivered  id=${id}`);
  return { id };
}

/* ════════════════════════════════════════════════════════════════════════════
   PASSWORD RESET OTP
   Called by: routes/forgotPassword.js
   POST /api/auth/forgot-password

   Sends a 6-digit OTP code (not a link).
   Replaces the old resetUrl-based version.
════════════════════════════════════════════════════════════════════════════ */

/**
 * sendPasswordResetEmail
 *
 * @param {{ to: string, name: string, otp: string, expiry: number }} opts
 */
export async function sendPasswordResetEmail({ to, name, otp, expiry = 15 }) {
  console.log("[email] sendPasswordResetEmail called", {
    to     : to   ?? "MISSING",
    name   : name ?? "MISSING",
    otp    : IS_PROD ? "******" : (otp ?? "MISSING"),
    expiry,
  });

  if (!to)  throw new Error("sendPasswordResetEmail: `to` is required");
  if (!otp) throw new Error("sendPasswordResetEmail: `otp` is required");

  const otpStr = String(otp).trim();
  if (!/^\d{6}$/.test(otpStr))
    throw new Error(
      `sendPasswordResetEmail: otp must be 6 digits — received "${otpStr}"`
    );

  const safeName = esc(name || "there");
  const safeOtp  = esc(otpStr);

  const body = `
    <h2>Reset your password</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>
      We received a request to reset the password for your
      <strong>${esc(BRAND)}</strong> account.
      Use the code below — it expires in
      <strong>${expiry}&nbsp;minutes</strong>.
    </p>

    <div class="reset-banner">
      <div class="icon">🔑</div>
      <div class="headline">Password Reset Code</div>
      <div class="sub">
        Expires in ${expiry} minutes &nbsp;·&nbsp; One-time use only
      </div>
    </div>

    <div class="otp-wrap">
      <div class="otp-box-orange">
        <div class="otp-code-orange">${safeOtp}</div>
      </div>
    </div>

    <div class="reset-security">
      <strong style="color:#f1f5f9;">Security notice:</strong>
      Never share this code with anyone.
      ${esc(BRAND)} staff will <strong>never</strong> ask for it.
      This code can only be used <strong>once</strong>.
    </div>

    <p>
      If you didn't request a password reset, you can safely ignore
      this email — your password will <strong>not</strong> change.
    </p>
  `;

  return send({
    to,
    subject : `${safeOtp} — your ${esc(BRAND)} password reset code`,
    html    : shell({
      title     : `Reset your ${BRAND} password`,
      preheader : `Your password reset code is ${safeOtp}. Expires in ${expiry} minutes.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your ${BRAND} password reset code is:`,
      ``,
      `    ${otpStr}`,
      ``,
      `This code expires in ${expiry} minutes.`,
      `It can only be used once.`,
      ``,
      `Security notice:`,
      `  • Never share this code with anyone`,
      `  • ${BRAND} staff will never ask for it`,
      ``,
      `If you didn't request this, ignore this email.`,
      `Your password will not change.`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   EMAIL VERIFICATION OTP  (sent after registration)
   Called by: routes/auth.routes.js  POST /api/auth/register
════════════════════════════════════════════════════════════════════════════ */

/**
 * sendEmailVerificationOtp
 *
 * @param {{ to: string, name: string, otp: string, expiry: number }} opts
 */
export async function sendEmailVerificationOtp({ to, name, otp, expiry = 15 }) {
  console.log("[email] sendEmailVerificationOtp called", {
    to     : to   ?? "MISSING",
    name   : name ?? "MISSING",
    otp    : IS_PROD ? "******" : (otp ?? "MISSING"),
    expiry,
  });

  if (!to)  throw new Error("sendEmailVerificationOtp: `to` is required");
  if (!otp) throw new Error("sendEmailVerificationOtp: `otp` is required");

  const otpStr = String(otp).trim();
  if (!/^\d{6}$/.test(otpStr))
    throw new Error(
      `sendEmailVerificationOtp: otp must be 6 digits — received "${otpStr}"`
    );

  const safeName = esc(name || "there");
  const safeOtp  = esc(otpStr);

  const body = `
    <h2>Verify your email address</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>
      Welcome to <strong>${esc(BRAND)}</strong>! Use the code below
      to verify your email address. It expires in
      <strong>${expiry}&nbsp;minutes</strong>.
    </p>

    <div class="otp-wrap">
      <div class="otp-box">
        <div class="otp-code">${safeOtp}</div>
      </div>
    </div>

    <div class="warning">
      <strong>Security notice:</strong>
      Never share this code with anyone.
      ${esc(BRAND)} staff will <strong>never</strong> ask for it.
    </div>

    <p style="font-size:13px;color:#64748b;">
      If you did not create an account, you can safely ignore this email.
    </p>
  `;

  return send({
    to,
    subject : `${safeOtp} — verify your ${esc(BRAND)} account`,
    html    : shell({
      title     : `Verify your ${BRAND} account`,
      preheader : `Your verification code is ${safeOtp}. Expires in ${expiry} minutes.`,
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Welcome to ${BRAND}!`,
      ``,
      `Your email verification code is:`,
      ``,
      `    ${otpStr}`,
      ``,
      `This code expires in ${expiry} minutes.`,
      `Never share it — ${BRAND} staff will never ask for it.`,
      ``,
      `If you did not create an account, ignore this email.`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   EXISTING EXPORTS (unchanged)
════════════════════════════════════════════════════════════════════════════ */

export async function sendVerificationEmail({ to, name, otp }) {
  console.log("[email] sendVerificationEmail called", {
    to   : to   ?? "MISSING",
    name : name ?? "MISSING",
    otp  : IS_PROD ? "******" : (otp ?? "MISSING"),
  });

  if (!to)  throw new Error("sendVerificationEmail: `to` is required");
  if (!otp) throw new Error("sendVerificationEmail: `otp` is required");

  const otpStr = String(otp).trim();
  if (!/^\d{6}$/.test(otpStr))
    throw new Error(`sendVerificationEmail: otp must be 6 digits — received "${otpStr}"`);

  const safeName = esc(name || "there");
  const safeOtp  = esc(otpStr);

  const body = `
    <h2>Verify your email address</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>
      Use the code below to verify your <strong>${esc(BRAND)}</strong> account.
      It expires in <strong>10&nbsp;minutes</strong>.
    </p>
    <div class="otp-wrap">
      <div class="otp-box">
        <div class="otp-code">${safeOtp}</div>
      </div>
    </div>
    <div class="warning">
      <strong>Security notice:</strong>
      Never share this code with anyone.
      ${esc(BRAND)} staff will <strong>never</strong> ask for it.
    </div>
    <p style="font-size:13px;color:#64748b;">
      If you did not request this, you can safely ignore this email.
    </p>
  `;

  return send({
    to,
    subject : `${safeOtp} — your ${esc(BRAND)} verification code`,
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
      `    ${otpStr}`,
      ``,
      `This code expires in 10 minutes.`,
      `Never share it — ${BRAND} staff will never ask for it.`,
      ``,
      `If you did not request this, ignore this email.`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

export async function sendWelcomeEmail({ to, name }) {
  console.log("[email] sendWelcomeEmail called", { to });
  if (!to) throw new Error("sendWelcomeEmail: `to` is required");

  const safeName = esc(name || "there");

  const body = `
    <h2>Welcome to ${esc(BRAND)} 🎉</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>
      Your email has been verified and your account is now active.
      You can now browse, buy, and sell on ${esc(BRAND)}.
    </p>
    <p style="font-size:13px;color:#64748b;margin-top:20px;">
      Questions?
      <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a>
    </p>
  `;

  return send({
    to,
    subject : `Welcome to ${BRAND} — you're verified`,
    html    : shell({
      title     : `Welcome to ${BRAND}`,
      preheader : `Your ${BRAND} account is active.`,
      body,
    }),
    text: [
      `Welcome to ${BRAND}, ${name || "there"}!`,
      ``,
      `Your email is verified and your account is active.`,
      ``,
      `Questions? ${SUPPORT}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

export async function sendIdentityStatusEmail({ to, name, approved, reason }) {
  if (!to) throw new Error("sendIdentityStatusEmail: `to` is required");

  const safeName = esc(name || "there");

  const body = approved
    ? `
        <h2>Identity Verified ✓</h2>
        <p>Hi <span class="hi">${safeName}</span>,</p>
        <p>
          Your identity has been verified. Your trust score has been
          updated and you now have full access to seller features.
        </p>
      `
    : `
        <h2>Identity Verification Update</h2>
        <p>Hi <span class="hi">${safeName}</span>,</p>
        <p>We were unable to verify your identity. Reason:</p>
        <div class="info-box">
          ${esc(reason || "Documents did not meet our requirements.")}
        </div>
        <p>
          Please log in and resubmit. Questions?
          <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a>
        </p>
      `;

  return send({
    to,
    subject : approved
      ? `Identity verified — ${BRAND}`
      : `Action required: identity verification — ${BRAND}`,
    html    : shell({
      title     : `Identity ${approved ? "verified" : "update"} — ${BRAND}`,
      preheader : approved
        ? "Your identity has been successfully verified."
        : "Your identity verification needs attention.",
      body,
    }),
    text: approved
      ? `Hi ${name || "there"},\n\nYour identity has been verified.\n\n— ${BRAND}`
      : [
          `Hi ${name || "there"},`,
          ``,
          `Identity not approved. Reason: ${reason ?? "See account."}`,
          ``,
          `Please resubmit. Questions? ${SUPPORT}`,
          ``,
          `— ${BRAND}`,
        ].join("\n"),
  });
}

export async function sendStoreStatusEmail({
  to, name, storeName, approved, reason,
}) {
  if (!to) throw new Error("sendStoreStatusEmail: `to` is required");

  const safeName  = esc(name      || "there");
  const safeStore = esc(storeName || "your store");

  const body = approved
    ? `
        <h2>Store Approved ✓</h2>
        <p>Hi <span class="hi">${safeName}</span>,</p>
        <p>
          <strong>${safeStore}</strong> is now live on ${esc(BRAND)}.
          Buyers can find your store and purchase your listings.
        </p>
      `
    : `
        <h2>Store Verification Update</h2>
        <p>Hi <span class="hi">${safeName}</span>,</p>
        <p>
          <strong>${safeStore}</strong> was not approved. Reason:
        </p>
        <div class="info-box">
          ${esc(reason || "Store profile did not meet our requirements.")}
        </div>
        <p>
          Please update and resubmit. Questions?
          <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a>
        </p>
      `;

  return send({
    to,
    subject : approved
      ? `Store approved — ${BRAND}`
      : `Action required: store verification — ${BRAND}`,
    html    : shell({
      title     : `Store ${approved ? "approved" : "update"} — ${BRAND}`,
      preheader : approved
        ? `${storeName || "Your store"} is now live.`
        : "Store verification needs attention.",
      body,
    }),
    text: approved
      ? `Hi ${name || "there"},\n\n${storeName || "Your store"} is approved.\n\n— ${BRAND}`
      : [
          `Hi ${name || "there"},`,
          ``,
          `Store not approved. Reason: ${reason ?? "See account."}`,
          ``,
          `Please resubmit. Questions? ${SUPPORT}`,
          ``,
          `— ${BRAND}`,
        ].join("\n"),
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   ADMIN VERIFICATION EMAILS
════════════════════════════════════════════════════════════════════════════ */

export async function sendVerificationApprovedEmail({ to, name }) {
  if (!to) throw new Error("sendVerificationApprovedEmail: `to` is required");

  const safeName = esc(name || "there");

  const body = `
    <h2>You're fully verified 🎉</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>
      Great news — your identity and store have been reviewed and
      <strong>approved</strong> by our team. Your account is now fully
      verified on ${esc(BRAND)}.
    </p>

    <div class="banner-green">
      <div class="icon">✅</div>
      <div class="headline">Account Fully Verified</div>
      <div class="sub">
        Identity confirmed &nbsp;·&nbsp; Store approved &nbsp;·&nbsp; Trust score updated
      </div>
    </div>

    <p style="font-size:13px;color:#94a3b8;margin-bottom:8px;">
      You now have access to:
    </p>
    <ul class="benefit-list">
      <li><span class="tick">✓</span> Up to 100 product listings per day</li>
      <li><span class="tick">✓</span> Up to 500 active listings at once</li>
      <li><span class="tick">✓</span> Listings never expire</li>
      <li><span class="tick">✓</span> Verified seller badge on your profile</li>
      <li><span class="tick">✓</span> Higher trust score — more buyer confidence</li>
    </ul>

    <p>Log in to your account to start listing.</p>

    <p style="font-size:13px;color:#64748b;margin-top:8px;">
      Questions?
      <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a>
    </p>
  `;

  return send({
    to,
    subject : `You're verified — ${BRAND}`,
    html    : shell({
      title     : `Account verified — ${BRAND}`,
      preheader : "Your identity and store have been approved. You're fully verified!",
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Great news — your identity and store have been approved!`,
      ``,
      `Your account is now fully verified on ${BRAND}.`,
      ``,
      `You now have access to:`,
      `  ✓ Up to 100 product listings per day`,
      `  ✓ Up to 500 active listings at once`,
      `  ✓ Listings never expire`,
      `  ✓ Verified seller badge`,
      `  ✓ Higher trust score`,
      ``,
      `Log in to start listing.`,
      ``,
      `Questions? ${SUPPORT}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

export async function sendVerificationRejectedEmail({ to, name, reason }) {
  if (!to) throw new Error("sendVerificationRejectedEmail: `to` is required");

  const safeName   = esc(name   || "there");
  const safeReason = esc(reason || "Your documents did not meet our requirements.");

  const body = `
    <h2>Verification Not Approved</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>
      After reviewing your submitted documents, we were unable to approve
      your verification at this time.
    </p>

    <div class="banner-red">
      <div class="icon">❌</div>
      <div class="headline">Verification Rejected</div>
      <div class="sub">Please review the reason below and resubmit.</div>
    </div>

    <p style="font-size:13px;color:#94a3b8;margin-bottom:4px;">
      <strong style="color:#f1f5f9;">Reason from our team:</strong>
    </p>
    <div class="info-box">${safeReason}</div>

    <p>
      You can log in and resubmit your documents at any time.
      Make sure your photos are clear, unobstructed, and match the
      document type you selected.
    </p>

    <p>
      If you believe this is a mistake or need help, contact us at
      <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a>.
    </p>
  `;

  return send({
    to,
    subject : `Action required: verification rejected — ${BRAND}`,
    html    : shell({
      title     : `Verification rejected — ${BRAND}`,
      preheader : "Your verification was not approved. Please resubmit your documents.",
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your verification was not approved.`,
      ``,
      `Reason: ${reason || "Documents did not meet our requirements."}`,
      ``,
      `Please log in and resubmit your documents.`,
      ``,
      `Need help? ${SUPPORT}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}

export async function sendVerificationResetEmail({ to, name, note }) {
  if (!to) throw new Error("sendVerificationResetEmail: `to` is required");

  const safeName = esc(name || "there");
  const safeNote = esc(
    note || "Please resubmit your documents with clearer, higher-quality photos."
  );

  const body = `
    <h2>Please Resubmit Your Documents</h2>
    <p>Hi <span class="hi">${safeName}</span>,</p>
    <p>
      Our team has reviewed your verification submission and is requesting
      that you resubmit your documents.
    </p>

    <div class="banner-amber">
      <div class="icon">🔄</div>
      <div class="headline">Resubmission Required</div>
      <div class="sub">
        Your verified status has been temporarily cleared.
        Please upload new documents to continue.
      </div>
    </div>

    <p style="font-size:13px;color:#94a3b8;margin-bottom:4px;">
      <strong style="color:#f1f5f9;">Note from our reviewer:</strong>
    </p>
    <div class="warning">${safeNote}</div>

    <p>
      Please log in and resubmit your identity documents and any store
      materials. Make sure everything is:
    </p>
    <ul class="benefit-list">
      <li><span class="tick">→</span> Clear and fully visible (no blurring or cut-off edges)</li>
      <li><span class="tick">→</span> Unedited originals — no filters or cropping</li>
      <li><span class="tick">→</span> Selfie matches the face on your document</li>
      <li><span class="tick">→</span> Document is valid and not expired</li>
    </ul>

    <p>
      Questions?
      <a href="mailto:${SUPPORT}" style="color:#FF5C00;">${SUPPORT}</a>
    </p>
  `;

  return send({
    to,
    subject : `Action required: resubmit your documents — ${BRAND}`,
    html    : shell({
      title     : `Resubmit documents — ${BRAND}`,
      preheader : "Our team needs you to resubmit your verification documents.",
      body,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Please resubmit your verification documents.`,
      ``,
      `Note from our team: ${note || "Resubmit with clearer photos."}`,
      ``,
      `Tips:`,
      `  → Clear and fully visible documents`,
      `  → No filters or cropping`,
      `  → Selfie matches your document`,
      `  → Document is not expired`,
      ``,
      `Questions? ${SUPPORT}`,
      ``,
      `— ${BRAND}`,
    ].join("\n"),
  });
}