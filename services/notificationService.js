/**
 * services/notificationService.js
 *
 * Central notification service for Loemart.
 *
 * v3 — Simple flat design + COD wording fix
 * ─────────────────────────────────────────────────
 * ✓ COD emails NEVER say "Payment Confirmed"
 * ✓ Flat Jumia-style templates (single orange, no gradients)
 * ✓ HTML escaping on all user input (security)
 * ✓ Retry logic for transient failures
 * ✓ Recipient email validation
 * ✓ Timeout on Resend calls (15s)
 * ✓ All original exports preserved
 */

import { Resend } from "resend";

export {
  createNotification,
  sendNotification,
} from "./notifications.js";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const FROM_ADDRESS = process.env.EMAIL_FROM    || "Loemart <no-reply@loemart.com>";
const SUPPORT      = process.env.EMAIL_SUPPORT || "support@loemart.com";
const BRAND        = process.env.EMAIL_BRAND   || "Loemart";
const APP_URL      = process.env.APP_URL       || "https://www.loemart.com";

/* Flat brand palette — simple + consistent */
const COLOR = {
  orange   : "#F68B1E",
  orangeDk : "#E07A10",
  orangeLt : "#FFF5EB",
  orangeBd : "#FFD6B3",

  ink      : "#1A1A1A",
  ink2     : "#4A4A4A",
  muted    : "#6A6A6A",
  faint    : "#B8B8B8",

  bg       : "#F5F5F5",
  cardBg   : "#FFFFFF",
  sectionBg: "#EDEDED",
  soft     : "#F7F7F7",

  border   : "#E5E5E5",
  borderLt : "#F0F0F0",

  success  : "#16A34A",
  successLt: "#ECFDF5",
  successBd: "#BBF7D0",

  danger   : "#DC2626",
  dangerLt : "#FEF2F2",
  dangerBd : "#FECACA",

  warning  : "#F59E0B",
  warningLt: "#FEF3C7",
  warningBd: "#FDE68A",

  info     : "#0284C7",
  infoLt   : "#F0F9FF",
  infoBd   : "#BAE6FD",
};

/* ═══════════════════════════════════════════════════════════════
   RESEND CLIENT
═══════════════════════════════════════════════════════════════ */
let _resend = null;

function getResend() {
  if (_resend) return _resend;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[notificationService] ⚠️  RESEND_API_KEY not set — emails skipped");
    return null;
  }

  try {
    _resend = new Resend(key);
    return _resend;
  } catch (err) {
    console.error("[notificationService] ❌ Failed to init Resend:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   HTML ESCAPE (security — prevents template injection)
═══════════════════════════════════════════════════════════════ */
function esc(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(url) {
  if (!url) return "";
  const s = String(url);
  if (!/^https?:\/\//i.test(s)) return "";
  return esc(s);
}

function fmtAmount(v) {
  const n = Number(v);
  if (isNaN(n)) return "₦0";
  return `₦${n.toLocaleString("en-NG")}`;
}

/* ═══════════════════════════════════════════════════════════════
   SEND EMAIL (with retry + timeout)
═══════════════════════════════════════════════════════════════ */
const MAX_ATTEMPTS   = 3;
const RETRY_DELAY_MS = 1000;
const TIMEOUT_MS     = 15_000;

async function sendEmail({ to, subject, html, text, replyTo }, attempt = 1) {
  const client = getResend();
  if (!client) return null;

  /* Validate recipient */
  if (!to || typeof to !== "string" || !to.includes("@")) {
    console.warn(`[notificationService] ⚠️  Invalid recipient: ${to}`);
    return null;
  }

  try {
    const emailData = {
      from   : FROM_ADDRESS,
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    };
    if (replyTo) emailData.replyTo = replyTo;

    /* Race send vs timeout */
    const sendPromise = client.emails.send(emailData);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Resend timeout")), TIMEOUT_MS)
    );

    const { data, error } = await Promise.race([sendPromise, timeoutPromise]);

    if (error) {
      /* Retry on 5xx or missing status */
      const isRetryable = !error.statusCode || error.statusCode >= 500;
      if (isRetryable && attempt < MAX_ATTEMPTS) {
        console.warn(`[notificationService] Retrying ${attempt}/${MAX_ATTEMPTS}: ${error.message}`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        return sendEmail({ to, subject, html, text, replyTo }, attempt + 1);
      }
      console.error("[notificationService] ❌ Resend error:", error);
      return null;
    }

    console.log(`[notificationService] ✅ Email sent → ${to} | id: ${data?.id}`);
    return data;

  } catch (err) {
    if (attempt < MAX_ATTEMPTS) {
      console.warn(`[notificationService] Retrying after exception ${attempt}/${MAX_ATTEMPTS}: ${err.message}`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      return sendEmail({ to, subject, html, text, replyTo }, attempt + 1);
    }
    console.error("[notificationService] ❌ sendEmail threw:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   BASE LAYOUT — flat, simple, single orange accent
═══════════════════════════════════════════════════════════════ */
function layout({ title, body, preheader }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <title>${esc(title)}</title>
</head>
<body style="
  margin: 0;
  padding: 0;
  background-color: ${COLOR.bg};
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: ${COLOR.ink};
  -webkit-font-smoothing: antialiased;
">

  ${preheader ? `
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      ${esc(preheader)}
    </div>
  ` : ""}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding: 24px 12px; background-color: ${COLOR.bg};">
    <tr>
      <td align="center">

        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="
          max-width: 560px;
          width: 100%;
          background: ${COLOR.cardBg};
          border: 1px solid ${COLOR.border};
          border-radius: 8px;
          overflow: hidden;
        ">

          <!-- Header — flat orange bar -->
          <tr>
            <td style="
              background: ${COLOR.orange};
              padding: 20px 24px;
              text-align: center;
            ">
              <a href="${APP_URL}" style="text-decoration: none;">
                <span style="
                  color: #ffffff;
                  font-size: 22px;
                  font-weight: 800;
                  letter-spacing: 0.5px;
                ">${BRAND}</span>
              </a>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 28px 24px 24px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              background-color: ${COLOR.soft};
              padding: 20px 24px;
              border-top: 1px solid ${COLOR.borderLt};
            ">
              <p style="margin: 0 0 6px; font-size: 12px; color: ${COLOR.muted}; text-align: center;">
                © ${new Date().getFullYear()} ${BRAND}. All rights reserved.
              </p>
              <p style="margin: 0 0 8px; font-size: 11px; color: ${COLOR.faint}; text-align: center;">
                Nigeria's Trusted Neighbourhood Marketplace
              </p>
              <p style="margin: 8px 0 0; font-size: 11px; color: ${COLOR.faint}; text-align: center;">
                Need help?
                <a href="mailto:${SUPPORT}" style="color: ${COLOR.orange}; text-decoration: none; font-weight: 600;">
                  ${SUPPORT}
                </a>
              </p>
            </td>
          </tr>

        </table>

        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; margin-top: 16px;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 11px; color: ${COLOR.faint};">
                <a href="${APP_URL}/privacy" style="color: ${COLOR.faint}; text-decoration: none; margin: 0 6px;">Privacy</a>
                ·
                <a href="${APP_URL}/terms" style="color: ${COLOR.faint}; text-decoration: none; margin: 0 6px;">Terms</a>
                ·
                <a href="${APP_URL}/unsubscribe" style="color: ${COLOR.faint}; text-decoration: none; margin: 0 6px;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════
   UI HELPERS — flat, simple
═══════════════════════════════════════════════════════════════ */
const h1 = (text) =>
  `<h1 style="margin: 0 0 12px; color: ${COLOR.ink}; font-size: 20px; font-weight: 800; line-height: 1.3;">${text}</h1>`;

const h2 = (text) =>
  `<h2 style="margin: 20px 0 10px; color: ${COLOR.ink}; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${COLOR.muted};">${text}</h2>`;

const p = (text) =>
  `<p style="margin: 0 0 12px; color: ${COLOR.ink2}; font-size: 14px; line-height: 1.6;">${text}</p>`;

const small = (text) =>
  `<p style="margin: 16px 0 0; font-size: 12px; color: ${COLOR.muted}; line-height: 1.5;">${text}</p>`;

/*
 * Flat button — solid orange, no gradient
 */
const btn = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px auto;">
    <tr>
      <td align="center" style="border-radius: 4px; background: ${COLOR.orange};">
        <a href="${esc(href)}" style="
          display: inline-block;
          padding: 12px 28px;
          color: #ffffff;
          text-decoration: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.01em;
        ">${esc(label)}</a>
      </td>
    </tr>
  </table>
`;

/*
 * OTP block — dashed orange border, monospace
 */
const otpBlock = (code) => `
  <div style="text-align: center; margin: 24px 0;">
    <div style="
      display: inline-block;
      padding: 16px 32px;
      background-color: ${COLOR.orangeLt};
      border: 2px dashed ${COLOR.orange};
      border-radius: 8px;
      letter-spacing: 12px;
      font-size: 32px;
      font-weight: 800;
      color: ${COLOR.orange};
      font-family: 'Courier New', monospace;
    ">${esc(code)}</div>
  </div>
`;

/*
 * Amount box — subtle, orange-tinted for COD, green for paid
 */
const amountBox = (amount, label = "Amount", tone = "neutral") => {
  const tones = {
    neutral: { bg: COLOR.soft,      border: COLOR.border,    color: COLOR.ink },
    orange:  { bg: COLOR.orangeLt,  border: COLOR.orangeBd,  color: COLOR.orangeDk },
    success: { bg: COLOR.successLt, border: COLOR.successBd, color: COLOR.success },
    danger:  { bg: COLOR.dangerLt,  border: COLOR.dangerBd,  color: COLOR.danger },
  };
  const c = tones[tone] ?? tones.neutral;

  return `
    <div style="
      background: ${c.bg};
      border: 1px solid ${c.border};
      border-radius: 6px;
      padding: 16px 20px;
      margin: 20px 0;
      text-align: center;
    ">
      <p style="margin: 0 0 4px; color: ${COLOR.muted}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">
        ${esc(label)}
      </p>
      <p style="margin: 0; color: ${c.color}; font-size: 26px; font-weight: 800;">
        ${fmtAmount(amount)}
      </p>
    </div>
  `;
};

/*
 * Info row — flat two-column key/value pair
 */
const infoRow = (label, value) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
    margin: 8px 0;
    padding: 10px 14px;
    background: ${COLOR.soft};
    border-radius: 4px;
  ">
    <tr>
      <td style="padding: 0;">
        <p style="margin: 0 0 3px; font-size: 11px; color: ${COLOR.muted}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
          ${esc(label)}
        </p>
        <p style="margin: 0; font-size: 14px; color: ${COLOR.ink}; font-weight: 600;">
          ${esc(value)}
        </p>
      </td>
    </tr>
  </table>
`;

/*
 * Alert box — flat colored notice
 */
const alertBox = (type, message) => {
  const map = {
    success: { bg: COLOR.successLt, border: COLOR.success, color: COLOR.success },
    error:   { bg: COLOR.dangerLt,  border: COLOR.danger,  color: COLOR.danger },
    warning: { bg: COLOR.warningLt, border: COLOR.warning, color: "#92400E" },
    info:    { bg: COLOR.infoLt,    border: COLOR.info,    color: "#075985" },
  };
  const c = map[type] ?? map.info;

  return `
    <div style="
      background: ${c.bg};
      border-left: 3px solid ${c.border};
      border-radius: 3px;
      padding: 12px 16px;
      margin: 16px 0;
      color: ${c.color};
      font-size: 13px;
      line-height: 1.5;
    ">
      ${message}
    </div>
  `;
};

/*
 * Items table — flat, simple, image-friendly
 */
const itemsTable = (items) => {
  if (!items?.length) return "";

  const rows = items.map((item) => `
    <tr style="border-top: 1px solid ${COLOR.borderLt};">
      <td style="padding: 12px 8px; width: 56px;">
        ${item.image ? `
          <img src="${safeUrl(item.image)}"
            alt="${esc(item.name)}"
            width="48" height="48"
            style="border-radius: 4px; object-fit: cover; display: block; border: 1px solid ${COLOR.borderLt};" />
        ` : `
          <div style="
            width: 48px;
            height: 48px;
            background: ${COLOR.soft};
            border-radius: 4px;
            text-align: center;
            line-height: 48px;
            color: ${COLOR.faint};
            font-size: 16px;
          ">📦</div>
        `}
      </td>
      <td style="padding: 12px 8px; vertical-align: middle;">
        <p style="margin: 0; font-size: 13px; color: ${COLOR.ink}; font-weight: 600; line-height: 1.3;">
          ${esc(item.name)}
        </p>
        ${item.variant ? `
          <p style="margin: 3px 0 0; font-size: 12px; color: ${COLOR.muted};">
            ${esc(item.variant)}
          </p>
        ` : ""}
        <p style="margin: 3px 0 0; font-size: 12px; color: ${COLOR.muted};">
          Qty: ${esc(item.qty)}
        </p>
      </td>
      <td style="padding: 12px 8px; text-align: right; vertical-align: middle;">
        <p style="margin: 0; font-size: 13px; color: ${COLOR.ink}; font-weight: 700;">
          ${fmtAmount((item.price ?? 0) * (item.qty ?? 1))}
        </p>
      </td>
    </tr>
  `).join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
      border: 1px solid ${COLOR.border};
      border-radius: 6px;
      margin: 16px 0;
      overflow: hidden;
    ">
      <thead>
        <tr style="background: ${COLOR.sectionBg};">
          <th colspan="2" style="padding: 10px 12px; text-align: left; font-size: 11px; color: ${COLOR.muted}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
            Order Items
          </th>
          <th style="padding: 10px 12px; text-align: right; font-size: 11px; color: ${COLOR.muted}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

/*
 * Step list — numbered orange circles matching the checkout aesthetic
 */
const stepList = (steps) => {
  if (!steps?.length) return "";

  const rows = steps.map((step, i) => `
    <tr>
      <td style="padding: 6px 0; vertical-align: top;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="
              width: 22px;
              height: 22px;
              background: ${COLOR.orangeLt};
              color: ${COLOR.orange};
              border-radius: 50%;
              text-align: center;
              font-size: 12px;
              font-weight: 800;
              line-height: 22px;
              vertical-align: middle;
            ">${i + 1}</td>
            <td style="padding-left: 10px; font-size: 13px; color: ${COLOR.ink2}; line-height: 1.5;">
              ${esc(step)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 12px 0;">${rows}</table>`;
};

/* ═══════════════════════════════════════════════════════════════
   AUTH EMAILS
═══════════════════════════════════════════════════════════════ */

export const sendVerificationCode = async ({ to, name, code }) => {
  if (!to) return null;
  const safeName = esc(name || "there");

  return sendEmail({
    to,
    subject: `${code} is your ${BRAND} verification code`,
    html: layout({
      title: "Verify your email",
      preheader: `Your verification code is ${code}`,
      body: `
        ${h1("Verify your email address")}
        ${p(`Hi ${safeName}, welcome to ${BRAND}.`)}
        ${p("Use the code below to verify your email. This code expires in <strong>1 hour</strong>.")}
        ${otpBlock(code)}
        ${alertBox("info", "For security, never share this code with anyone.")}
        ${small("If you didn't create an account, you can safely ignore this email.")}
      `,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Welcome to ${BRAND}.`,
      `Your verification code: ${code}`,
      `Expires in 1 hour.`,
    ].join("\n"),
  });
};

export const sendPasswordResetCode = async ({ to, name, code }) => {
  if (!to) return null;
  const safeName = esc(name || "there");

  return sendEmail({
    to,
    subject: `${code} is your ${BRAND} password reset code`,
    html: layout({
      title: "Reset your password",
      preheader: `Password reset code: ${code}`,
      body: `
        ${h1("Reset your password")}
        ${p(`Hi ${safeName},`)}
        ${p("Use the code below to reset your password. This code expires in <strong>15 minutes</strong>.")}
        ${otpBlock(code)}
        ${alertBox("warning", "For security, this code can only be used once.")}
        ${small("If you didn't request a password reset, ignore this email — your password remains unchanged.")}
      `,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      `Your ${BRAND} password reset code: ${code}`,
      `Expires in 15 minutes.`,
    ].join("\n"),
  });
};

/* ═══════════════════════════════════════════════════════════════
   ACCOUNT EMAILS
═══════════════════════════════════════════════════════════════ */

export const sendWelcomeEmail = async ({ to, name }) => {
  if (!to) return null;
  const safeName = esc(name || "there");

  return sendEmail({
    to,
    subject: `Welcome to ${BRAND}`,
    html: layout({
      title: `Welcome to ${BRAND}`,
      preheader: "Your account is ready",
      body: `
        ${h1(`Welcome to ${BRAND}, ${safeName}`)}
        ${p("Your email has been verified and your account is ready.")}
        ${p("Browse thousands of products, chat with sellers, or start your own store today.")}
        ${btn(`${APP_URL}/dashboard`, "Go to Dashboard")}

        ${h2("Get started")}
        ${stepList([
          "Browse the marketplace to find great deals",
          "Add items to your cart and check out",
          "Track your orders from your dashboard",
        ])}

        ${small("Need help getting started? Contact us anytime at " + SUPPORT)}
      `,
    }),
    text: [
      `Welcome to ${BRAND}, ${name || "there"}.`,
      `Your account is ready.`,
      `Visit: ${APP_URL}/dashboard`,
    ].join("\n"),
  });
};

export const sendPasswordChangedEmail = async ({ to, name }) => {
  if (!to) return null;
  const safeName = esc(name || "there");

  return sendEmail({
    to,
    subject: `Your ${BRAND} password has been changed`,
    html: layout({
      title: "Password Changed",
      preheader: "Your password was successfully updated",
      body: `
        ${h1("Password changed")}
        ${p(`Hi ${safeName},`)}
        ${p(`Your password was successfully changed on ${new Date().toLocaleString("en-NG")}.`)}
        ${alertBox("warning", `If you did not make this change, contact us immediately at <a href="mailto:${SUPPORT}" style="color:${COLOR.danger};font-weight:600;">${SUPPORT}</a>`)}
        ${btn(`${APP_URL}/settings/security`, "Review Security Settings")}
      `,
    }),
    text: [
      `Hi ${name || "there"},`,
      `Your ${BRAND} password was changed.`,
      `If not you, contact ${SUPPORT}.`,
    ].join("\n"),
  });
};

export const sendEmailChangeConfirmation = async ({ to, name, newEmail }) => {
  if (!to) return null;
  const safeName = esc(name || "there");

  return sendEmail({
    to,
    subject: `Your ${BRAND} email has been updated`,
    html: layout({
      title: "Email Updated",
      body: `
        ${h1("Email address updated")}
        ${p(`Hi ${safeName},`)}
        ${p(`Your email address has been updated to <strong>${esc(newEmail)}</strong>.`)}
        ${alertBox("warning", `If you did not make this change, contact us at <a href="mailto:${SUPPORT}" style="color:${COLOR.danger};font-weight:600;">${SUPPORT}</a>`)}
      `,
    }),
    text: [
      `Hi ${name || "there"},`,
      `Your ${BRAND} email has been updated to ${newEmail}.`,
    ].join("\n"),
  });
};

/* ═══════════════════════════════════════════════════════════════
   IDENTITY / STORE EMAILS
═══════════════════════════════════════════════════════════════ */

export const sendIdentityStatusEmail = async ({ to, name, status, reason }) => {
  if (!to) return null;
  const safeName = esc(name || "there");
  const approved = status === "approved";

  return sendEmail({
    to,
    subject: `Identity verification ${status} — ${BRAND}`,
    html: layout({
      title: `Identity ${status}`,
      body: `
        ${h1(approved ? "Identity Verified" : "Verification Rejected")}
        ${p(`Hi ${safeName},`)}
        ${p(
          approved
            ? "Your identity has been verified. You can now access all seller features including higher payout limits."
            : "Unfortunately, your identity verification was not approved."
        )}
        ${reason ? alertBox(approved ? "success" : "error", `<strong>Reason:</strong> ${esc(reason)}`) : ""}
        ${btn(
          approved ? `${APP_URL}/dashboard` : `${APP_URL}/seller/identity`,
          approved ? "Go to Dashboard" : "Try Again"
        )}
      `,
    }),
    text: [
      `Hi ${name || "there"},`,
      `Identity verification ${status}.`,
      reason ? `Reason: ${reason}` : "",
    ].filter(Boolean).join("\n"),
  });
};

export const sendStoreStatusEmail = async ({ to, name, storeName, status, reason }) => {
  if (!to) return null;
  const safeName = esc(name || "there");
  const safeStore = esc(storeName);
  const approved  = status === "approved";

  return sendEmail({
    to,
    subject: `Your store "${storeName}" has been ${status}`,
    html: layout({
      title: `Store ${status}`,
      body: `
        ${h1(approved ? "Store Approved" : "Store Rejected")}
        ${p(`Hi ${safeName},`)}
        ${p(
          approved
            ? `Your store <strong>${safeStore}</strong> has been approved. You can now start listing products.`
            : `Your store <strong>${safeStore}</strong> was not approved.`
        )}
        ${reason ? alertBox(approved ? "success" : "error", `<strong>Reason:</strong> ${esc(reason)}`) : ""}
        ${btn(
          approved ? `${APP_URL}/seller/dashboard` : `${APP_URL}/seller/store/edit`,
          approved ? "Open Store Dashboard" : "Update & Resubmit"
        )}
      `,
    }),
    text: [
      `Hi ${name || "there"},`,
      `Your store "${storeName}" has been ${status}.`,
      reason ? `Reason: ${reason}` : "",
    ].filter(Boolean).join("\n"),
  });
};

/* ═══════════════════════════════════════════════════════════════
   ORDER & PAYMENT EMAILS
   ─────────────────────────────────────────────────────────────
   sendPaymentNotification handles BOTH COD and online orders.
   The isCOD flag determines the wording — this is critical!
═══════════════════════════════════════════════════════════════ */

/**
 * Sent to BUYER when payment is received (online) or order is placed (COD).
 *
 * @param {{
 *   to: string,
 *   name: string,
 *   amount: number,
 *   orderId: string,
 *   isCOD?: boolean,           // CRITICAL — determines wording
 *   reference?: string,        // Online payment tx reference
 *   paymentMethod?: string,
 *   items?: Array,
 *   deliveryAddress?: string,
 * }} opts
 */
export const sendPaymentNotification = async ({
  to,
  name,
  amount,
  orderId,
  isCOD = false,
  reference,
  paymentMethod,
  items = [],
  deliveryAddress,
}) => {
  if (!to) return null;

  const safeName = esc(name || "there");
  const amtFmt   = fmtAmount(amount);

  /* ── Wording branches — COD vs Online ── */
  const subject = isCOD
    ? `Order ${orderId} placed — Pay ${amtFmt} on delivery`
    : `Payment of ${amtFmt} received — Order ${orderId}`;

  const preheader = isCOD
    ? `Your order is confirmed. Pay ${amtFmt} to the rider on delivery.`
    : `Payment confirmed for order ${orderId}`;

  const title = isCOD
    ? "Order Placed"
    : "Payment Received";

  const intro = isCOD
    ? `Your order has been placed. You'll pay <strong>${amtFmt}</strong> when the rider arrives at your bus stop.`
    : `We've received your payment of <strong>${amtFmt}</strong>. The seller has been notified and will prepare your order.`;

  const amountTone = isCOD ? "orange" : "success";
  const amountLabel = isCOD ? "Amount Due on Delivery" : "Amount Paid";

  const nextSteps = isCOD
    ? [
        "Order confirmed",
        "Seller prepares your items",
        "Loemart Express picks up your order",
        `Pay rider on delivery — ${amtFmt}`,
      ]
    : [
        "Payment confirmed",
        "Seller prepares your items",
        "Loemart Express picks up your order",
        "Delivered to your bus stop",
      ];

  return sendEmail({
    to,
    subject,
    html: layout({
      title,
      preheader,
      body: `
        ${h1(title)}
        ${p(`Hi ${safeName},`)}
        ${p(intro)}

        ${amountBox(amount, amountLabel, amountTone)}

        ${itemsTable(items)}

        ${infoRow("Order ID", orderId)}
        ${paymentMethod ? infoRow("Payment Method", paymentMethod) : ""}
        ${!isCOD && reference ? infoRow("Payment Reference", reference) : ""}
        ${deliveryAddress ? infoRow("Delivering To", deliveryAddress) : ""}

        ${h2("What happens next")}
        ${stepList(nextSteps)}

        ${btn(`${APP_URL}/shop/orders/${orderId}`, "Track My Order")}

        ${small("Questions about your order? Reply to this email or contact " + SUPPORT)}
      `,
    }),
    text: [
      `Hi ${name || "there"},`,
      ``,
      isCOD
        ? `Order ${orderId} placed. Pay ${amtFmt} on delivery.`
        : `Payment of ${amtFmt} received for order ${orderId}.`,
      !isCOD && reference ? `Reference: ${reference}` : "",
      ``,
      `Track: ${APP_URL}/shop/orders/${orderId}`,
    ].filter(Boolean).join("\n"),
  });
};

/**
 * Sent to SELLER when they receive a new order.
 */
export const sendNewOrderToSeller = async ({
  to,
  sellerName,
  buyerName,
  orderId,
  amount,
  itemCount,
  items = [],
  isCOD = false,
  deliveryAddress,
}) => {
  if (!to) return null;

  const safeName  = esc(sellerName || "there");
  const safeBuyer = buyerName ? esc(buyerName) : null;
  const amtFmt    = fmtAmount(amount);

  return sendEmail({
    to,
    subject: `New ${isCOD ? "COD " : ""}order received — ${amtFmt}`,
    html: layout({
      title: "New Order",
      preheader: `You have a new order worth ${amtFmt}`,
      body: `
        ${h1("New Order Received")}
        ${p(`Hi ${safeName},`)}
        ${p(`You have a new ${isCOD ? "<strong>Cash on Delivery</strong>" : "<strong>paid</strong>"} order${safeBuyer ? ` from <strong>${safeBuyer}</strong>` : ""}.`)}

        ${amountBox(amount, isCOD ? "Order Total (COD)" : "Order Total (Paid)", isCOD ? "orange" : "success")}

        ${itemsTable(items)}

        ${infoRow("Order ID", orderId)}
        ${infoRow("Items", `${itemCount} item${itemCount === 1 ? "" : "s"}`)}
        ${infoRow("Payment", isCOD ? "Cash on Delivery" : "Paid Online")}
        ${deliveryAddress ? infoRow("Delivering To", deliveryAddress) : ""}

        ${isCOD
          ? alertBox("warning", `The buyer will pay <strong>${amtFmt}</strong> to the rider on delivery. Your payout is released after delivery is confirmed.`)
          : alertBox("success", "Payment has been received. Prepare the order for shipping.")
        }

        ${h2("Next steps")}
        ${stepList([
          "Prepare items for shipping",
          "Mark order as ready in your dashboard",
          "Rider will pick up from your location",
        ])}

        ${btn(`${APP_URL}/seller-dashboard/orders/${orderId}`, "View & Fulfill Order")}

        ${small("Fulfill orders quickly to maintain your seller rating.")}
      `,
    }),
    text: [
      `Hi ${sellerName || "there"},`,
      ``,
      `New ${isCOD ? "COD " : "paid "}order received.`,
      `Order ID: ${orderId}`,
      `Amount: ${amtFmt}`,
      `Items: ${itemCount}`,
      ``,
      `Fulfill: ${APP_URL}/seller-dashboard/orders/${orderId}`,
    ].join("\n"),
  });
};

/* Alias for backward compatibility */
export const sendOrderConfirmationToBuyer = sendPaymentNotification;

/**
 * Generic order status update.
 */
export const sendOrderStatusEmail = async ({ to, name, orderId, status, message }) => {
  if (!to) return null;

  const safeName   = esc(name || "there");
  const safeStatus = esc(String(status || "updated"));

  return sendEmail({
    to,
    subject: `Order ${orderId} — ${safeStatus}`,
    html: layout({
      title: `Order ${safeStatus}`,
      body: `
        ${h1(`Order ${safeStatus}`)}
        ${p(`Hi ${safeName},`)}
        ${p(`Your order <strong>${esc(orderId)}</strong> has been updated to <strong>${safeStatus}</strong>.`)}
        ${message ? alertBox("info", esc(message)) : ""}
        ${btn(`${APP_URL}/shop/orders/${orderId}`, "View Order Details")}
      `,
    }),
    text: [
      `Hi ${name || "there"},`,
      `Order ${orderId} — ${status}.`,
      message ?? "",
      ``,
      `View: ${APP_URL}/shop/orders/${orderId}`,
    ].filter(Boolean).join("\n"),
  });
};

/**
 * Withdrawal status update.
 */
export const sendWithdrawalStatusEmail = async ({ to, name, amount, status, reference, bankName, accountNumber }) => {
  if (!to) return null;

  const safeName = esc(name || "there");
  const amtFmt   = fmtAmount(amount);
  const approved = ["approved", "completed", "success", "successful"].includes(String(status || "").toLowerCase());

  return sendEmail({
    to,
    subject: `Withdrawal ${status} — ${amtFmt}`,
    html: layout({
      title: `Withdrawal ${status}`,
      body: `
        ${h1(approved ? "Withdrawal Successful" : `Withdrawal ${esc(status)}`)}
        ${p(`Hi ${safeName},`)}
        ${p(`Your withdrawal request has been ${approved ? "processed successfully" : esc(status)}.`)}

        ${amountBox(amount, "Amount", approved ? "success" : "danger")}

        ${bankName ? infoRow("Bank", bankName) : ""}
        ${accountNumber ? infoRow("Account", `••••${String(accountNumber).slice(-4)}`) : ""}
        ${reference ? infoRow("Reference", reference) : ""}

        ${approved
          ? alertBox("success", "Funds should reflect in your bank account within a few minutes.")
          : alertBox("error", "Contact support if you believe this is an error.")
        }

        ${btn(`${APP_URL}/seller/wallet`, "View Wallet")}
      `,
    }),
    text: [
      `Hi ${name || "there"},`,
      `Withdrawal of ${amtFmt} — ${status}.`,
      reference ? `Reference: ${reference}` : "",
    ].filter(Boolean).join("\n"),
  });
};

/**
 * Refund notification.
 */
export const sendRefundNotification = async ({ to, name, amount, orderId, reason }) => {
  if (!to) return null;

  const safeName = esc(name || "there");
  const amtFmt   = fmtAmount(amount);

  return sendEmail({
    to,
    subject: `Refund of ${amtFmt} processed — Order ${orderId}`,
    html: layout({
      title: "Refund Processed",
      body: `
        ${h1("Refund Processed")}
        ${p(`Hi ${safeName},`)}
        ${p(`A refund has been processed for order <strong>${esc(orderId)}</strong>.`)}
        ${amountBox(amount, "Refunded", "success")}
        ${reason ? infoRow("Reason", reason) : ""}
        ${alertBox("info", "Funds will appear in your account within 3–5 business days.")}
        ${btn(`${APP_URL}/shop/orders/${orderId}`, "View Order Details")}
      `,
    }),
    text: [
      `Hi ${name || "there"},`,
      `Refund of ${amtFmt} processed for order ${orderId}.`,
      reason ? `Reason: ${reason}` : "",
    ].filter(Boolean).join("\n"),
  });
};