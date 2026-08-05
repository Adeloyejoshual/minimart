/**
 * services/notificationService.js
 *
 * Central notification service for Loemart.
 * Handles all email sending via Resend.
 *
 * Functions:
 *  ── Auth ──────────────────────────────────────────────────
 *  sendVerificationCode        → OTP for email verification
 *  sendPasswordResetCode       → OTP for password reset
 *
 *  ── Account ───────────────────────────────────────────────
 *  sendWelcomeEmail            → After email verified
 *  sendPasswordChangedEmail    → After password changed
 *  sendEmailChangeConfirmation → After email updated
 *
 *  ── Identity / Store ──────────────────────────────────────
 *  sendIdentityStatusEmail     → KYC approved / rejected
 *  sendStoreStatusEmail        → Store approved / rejected
 *
 *  ── Orders & Payments ─────────────────────────────────────
 *  sendOrderStatusEmail        → Order status update
 *  sendPaymentNotification     → Payment received
 *  sendWithdrawalStatusEmail   → Withdrawal status update
 *
 *  ── In-app ────────────────────────────────────────────────
 *  createNotification          → Insert DB notification
 *  sendNotification            → createNotification alias
 */

import { Resend } from "resend";

// ── Re-export in-app notification helpers ─────────────────────
export {
  createNotification,
  sendNotification,
} from "./notifications.js";

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const FROM_ADDRESS = process.env.EMAIL_FROM    || "Loemart <no-reply@loemart.com>";
const SUPPORT      = process.env.EMAIL_SUPPORT || "support@loemart.com";
const BRAND        = process.env.EMAIL_BRAND   || "Loemart";
const APP_URL      = process.env.APP_URL       || "https://loemart.com";

// ─────────────────────────────────────────────────────────────
// Resend client (lazy singleton)
// ─────────────────────────────────────────────────────────────
let _resend = null;

function getResend() {
  if (_resend) return _resend;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[notificationService] ⚠️  RESEND_API_KEY not set — emails will be skipped");
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

// ─────────────────────────────────────────────────────────────
// Base email sender
// ─────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  const client = getResend();

  if (!client) return null;

  try {
    const { data, error } = await client.emails.send({
      from:    FROM_ADDRESS,
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });

    if (error) {
      console.error("[notificationService] ❌ Resend error:", error);
      return null;
    }

    console.log(`[notificationService] ✅ Email sent → ${to} | id: ${data?.id}`);
    return data;

  } catch (err) {
    console.error("[notificationService] ❌ sendEmail threw:", err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Shared layout wrapper
// ─────────────────────────────────────────────────────────────
function layout({ title, body }) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>${title}</title>
    </head>
    <body style="
      margin: 0; padding: 0;
      background-color: #F9FAFB;
      font-family: Arial, sans-serif;
    ">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            ">

              <!-- Header -->
              <tr>
                <td style="
                  background-color: #4F46E5;
                  padding: 24px 40px;
                  text-align: center;
                ">
                  <span style="
                    color: #ffffff;
                    font-size: 24px;
                    font-weight: bold;
                    letter-spacing: 1px;
                  ">${BRAND}</span>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 40px;">
                  ${body}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="
                  background-color: #F3F4F6;
                  padding: 20px 40px;
                  text-align: center;
                ">
                  <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                    © ${new Date().getFullYear()} ${BRAND}. All rights reserved.
                  </p>
                  <p style="margin: 6px 0 0; font-size: 12px; color: #9CA3AF;">
                    Need help?
                    <a href="mailto:${SUPPORT}"
                       style="color: #4F46E5; text-decoration: none;">
                      ${SUPPORT}
                    </a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ─────────────────────────────────────────────────────────────
// OTP block helper
// ─────────────────────────────────────────────────────────────
function otpBlock(code, color = "#4F46E5", bg = "#EEF2FF") {
  return `
    <div style="text-align: center; margin: 32px 0;">
      <div style="
        display:          inline-block;
        padding:          18px 40px;
        background-color: ${bg};
        border-radius:    12px;
        letter-spacing:   12px;
        font-size:        36px;
        font-weight:      bold;
        color:            ${color};
      ">${code}</div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// Shared text styles
// ─────────────────────────────────────────────────────────────
const h1 = (text) =>
  `<h2 style="margin: 0 0 16px; color: #111827; font-size: 22px;">${text}</h2>`;

const p = (text) =>
  `<p style="margin: 0 0 12px; color: #374151; font-size: 15px; line-height: 1.6;">${text}</p>`;

const small = (text) =>
  `<p style="margin: 16px 0 0; font-size: 12px; color: #9CA3AF;">${text}</p>`;

const btn = (href, label, color = "#4F46E5") => `
  <div style="text-align: center; margin: 28px 0;">
    <a href="${href}" style="
      display:          inline-block;
      padding:          14px 32px;
      background-color: ${color};
      color:            #ffffff;
      text-decoration:  none;
      border-radius:    8px;
      font-size:        15px;
      font-weight:      bold;
    ">${label}</a>
  </div>
`;

// ═════════════════════════════════════════════════════════════
// AUTH EMAILS
// ═════════════════════════════════════════════════════════════

/**
 * sendVerificationCode
 * Sends a 6-digit OTP to verify the user's email on registration.
 *
 * @param {{ to: string, name: string, code: string }} opts
 */
export const sendVerificationCode = async ({ to, name, code }) => {
  if (!to) return null;
  const safeName = String(name || "there");

  return sendEmail({
    to,
    subject: `${code} is your ${BRAND} verification code`,
    html: layout({
      title: "Verify your email",
      body: `
        ${h1("Verify your email address")}
        ${p(`Hi ${safeName}, welcome to ${BRAND}!`)}
        ${p("Use the code below to verify your email address. This code expires in <strong>1 hour</strong>.")}
        ${otpBlock(code, "#4F46E5", "#EEF2FF")}
        ${small("If you didn't create an account, you can safely ignore this email.")}
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `Welcome to ${BRAND}!`,
      `Your verification code is: ${code}`,
      `This code expires in 1 hour.`,
      ``,
      `If you didn't create an account, ignore this email.`,
    ].join("\n"),
  });
};

/**
 * sendPasswordResetCode
 * Sends a 6-digit OTP to reset the user's password.
 *
 * @param {{ to: string, name: string, code: string }} opts
 */
export const sendPasswordResetCode = async ({ to, name, code }) => {
  if (!to) return null;
  const safeName = String(name || "there");

  return sendEmail({
    to,
    subject: `${code} is your ${BRAND} password reset code`,
    html: layout({
      title: "Reset your password",
      body: `
        ${h1("Reset your password")}
        ${p(`Hi ${safeName},`)}
        ${p("Use the code below to reset your password. This code expires in <strong>15 minutes</strong>.")}
        ${otpBlock(code, "#DC2626", "#FEF2F2")}
        ${p("For security, this code can only be used once.")}
        ${small("If you didn't request a password reset, you can safely ignore this email.")}
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `Your ${BRAND} password reset code is: ${code}`,
      `This code expires in 15 minutes.`,
      ``,
      `If you didn't request this, ignore this email.`,
    ].join("\n"),
  });
};

// ═════════════════════════════════════════════════════════════
// ACCOUNT EMAILS
// ═════════════════════════════════════════════════════════════

/**
 * sendWelcomeEmail
 * Sent after the user successfully verifies their email.
 *
 * @param {{ to: string, name: string }} opts
 */
export const sendWelcomeEmail = async ({ to, name }) => {
  if (!to) return null;
  const safeName = String(name || "there");

  return sendEmail({
    to,
    subject: `Welcome to ${BRAND}! 🎉`,
    html: layout({
      title: `Welcome to ${BRAND}`,
      body: `
        ${h1(`Welcome to ${BRAND}, ${safeName}! 🎉`)}
        ${p("Your email has been verified and your seller account is ready.")}
        ${p("You can now set up your store, list products, and start selling.")}
        ${btn(`${APP_URL}/dashboard`, "Go to Dashboard")}
        ${small("Need help getting started? Reply to this email or contact our support team.")}
      `,
    }),
    text: [
      `Welcome to ${BRAND}, ${safeName}!`,
      ``,
      `Your email has been verified and your seller account is ready.`,
      `Visit your dashboard: ${APP_URL}/dashboard`,
      ``,
      `Need help? Contact us at ${SUPPORT}`,
    ].join("\n"),
  });
};

/**
 * sendPasswordChangedEmail
 * Sent after a successful password change.
 *
 * @param {{ to: string, name: string }} opts
 */
export const sendPasswordChangedEmail = async ({ to, name }) => {
  if (!to) return null;
  const safeName = String(name || "there");

  return sendEmail({
    to,
    subject: `Your ${BRAND} password has been changed`,
    html: layout({
      title: "Password Changed",
      body: `
        ${h1("Password changed successfully")}
        ${p(`Hi ${safeName},`)}
        ${p("Your password was successfully changed.")}
        ${p(`If you did not make this change, contact us immediately at <a href="mailto:${SUPPORT}" style="color:#4F46E5;">${SUPPORT}</a>.`)}
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `Your ${BRAND} password was successfully changed.`,
      ``,
      `If you did not make this change, contact us at ${SUPPORT}.`,
    ].join("\n"),
  });
};

/**
 * sendEmailChangeConfirmation
 * Sent after the user updates their email address.
 *
 * @param {{ to: string, name: string, newEmail: string }} opts
 */
export const sendEmailChangeConfirmation = async ({ to, name, newEmail }) => {
  if (!to) return null;
  const safeName = String(name || "there");

  return sendEmail({
    to,
    subject: `Your ${BRAND} email address has been updated`,
    html: layout({
      title: "Email Address Updated",
      body: `
        ${h1("Email address updated")}
        ${p(`Hi ${safeName},`)}
        ${p(`Your email address has been updated to <strong>${newEmail}</strong>.`)}
        ${p(`If you did not make this change, contact us immediately at <a href="mailto:${SUPPORT}" style="color:#4F46E5;">${SUPPORT}</a>.`)}
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `Your ${BRAND} email has been updated to ${newEmail}.`,
      ``,
      `If you did not make this change, contact us at ${SUPPORT}.`,
    ].join("\n"),
  });
};

// ═════════════════════════════════════════════════════════════
// IDENTITY / STORE EMAILS
// ═════════════════════════════════════════════════════════════

/**
 * sendIdentityStatusEmail
 * Sent when KYC is approved or rejected.
 *
 * @param {{ to: string, name: string, status: "approved"|"rejected", reason?: string }} opts
 */
export const sendIdentityStatusEmail = async ({ to, name, status, reason }) => {
  if (!to) return null;
  const safeName   = String(name || "there");
  const approved   = status === "approved";
  const color      = approved ? "#16A34A" : "#DC2626";
  const bg         = approved ? "#F0FDF4" : "#FEF2F2";
  const statusText = approved ? "✅ Approved" : "❌ Rejected";

  return sendEmail({
    to,
    subject: `Identity verification ${status} — ${BRAND}`,
    html: layout({
      title: `Identity ${status}`,
      body: `
        ${h1(`Identity verification ${statusText}`)}
        ${p(`Hi ${safeName},`)}
        ${
          approved
            ? p("Your identity has been verified. You can now access all seller features.")
            : p("Unfortunately, your identity verification was not approved.")
        }
        ${reason ? `
          <div style="
            background-color: ${bg};
            border-left: 4px solid ${color};
            border-radius: 4px;
            padding: 12px 16px;
            margin: 16px 0;
            color: ${color};
            font-size: 14px;
          ">
            <strong>Reason:</strong> ${reason}
          </div>
        ` : ""}
        ${approved
          ? btn(`${APP_URL}/dashboard`, "Go to Dashboard", "#16A34A")
          : btn(`${APP_URL}/seller/identity`, "Try Again", "#DC2626")
        }
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `Identity verification ${status}.`,
      reason ? `Reason: ${reason}` : "",
      ``,
      `Visit: ${APP_URL}/dashboard`,
    ].filter(Boolean).join("\n"),
  });
};

/**
 * sendStoreStatusEmail
 * Sent when a store is approved or rejected.
 *
 * @param {{ to: string, name: string, storeName: string, status: "approved"|"rejected", reason?: string }} opts
 */
export const sendStoreStatusEmail = async ({ to, name, storeName, status, reason }) => {
  if (!to) return null;
  const safeName   = String(name || "there");
  const approved   = status === "approved";
  const color      = approved ? "#16A34A" : "#DC2626";
  const bg         = approved ? "#F0FDF4" : "#FEF2F2";
  const statusText = approved ? "✅ Approved" : "❌ Rejected";

  return sendEmail({
    to,
    subject: `Your store "${storeName}" has been ${status} — ${BRAND}`,
    html: layout({
      title: `Store ${status}`,
      body: `
        ${h1(`Store ${statusText}`)}
        ${p(`Hi ${safeName},`)}
        ${
          approved
            ? p(`Great news! Your store <strong>${storeName}</strong> has been approved. You can now start listing products.`)
            : p(`Your store <strong>${storeName}</strong> was not approved.`)
        }
        ${reason ? `
          <div style="
            background-color: ${bg};
            border-left: 4px solid ${color};
            border-radius: 4px;
            padding: 12px 16px;
            margin: 16px 0;
            color: ${color};
            font-size: 14px;
          ">
            <strong>Reason:</strong> ${reason}
          </div>
        ` : ""}
        ${approved
          ? btn(`${APP_URL}/seller/store`, "Manage Store", "#16A34A")
          : btn(`${APP_URL}/seller/store/edit`, "Update & Resubmit", "#DC2626")
        }
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `Your store "${storeName}" has been ${status}.`,
      reason ? `Reason: ${reason}` : "",
      ``,
      `Visit: ${APP_URL}/seller/store`,
    ].filter(Boolean).join("\n"),
  });
};

// ═════════════════════════════════════════════════════════════
// ORDER & PAYMENT EMAILS
// ═════════════════════════════════════════════════════════════

/**
 * sendOrderStatusEmail
 * Sent on order status updates.
 *
 * @param {{ to: string, name: string, orderId: string, status: string, message?: string }} opts
 */
export const sendOrderStatusEmail = async ({ to, name, orderId, status, message }) => {
  if (!to) return null;
  const safeName = String(name || "there");

  return sendEmail({
    to,
    subject: `Order ${orderId} — ${status}`,
    html: layout({
      title: `Order ${status}`,
      body: `
        ${h1(`Order Update`)}
        ${p(`Hi ${safeName},`)}
        ${p(`Your order <strong>${orderId}</strong> status has been updated to <strong>${status}</strong>.`)}
        ${message ? p(message) : ""}
        ${btn(`${APP_URL}/orders/${orderId}`, "View Order")}
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `Order ${orderId} — ${status}.`,
      message ?? "",
      ``,
      `View order: ${APP_URL}/orders/${orderId}`,
    ].filter(Boolean).join("\n"),
  });
};

/**
 * sendPaymentNotification
 * Sent when a payment is received.
 *
 * @param {{ to: string, name: string, amount: number, orderId: string, reference?: string }} opts
 */
export const sendPaymentNotification = async ({ to, name, amount, orderId, reference }) => {
  if (!to) return null;
  const safeName = String(name || "there");
  const amtFmt   = Number(amount).toLocaleString("en-NG", {
    style: "currency", currency: "NGN",
  });

  return sendEmail({
    to,
    subject: `Payment received for order ${orderId} — ${BRAND}`,
    html: layout({
      title: "Payment Received",
      body: `
        ${h1("Payment received ✅")}
        ${p(`Hi ${safeName},`)}
        ${p(`We've received a payment of <strong>${amtFmt}</strong> for order <strong>${orderId}</strong>.`)}
        ${reference ? p(`Reference: <strong>${reference}</strong>`) : ""}
        ${btn(`${APP_URL}/orders/${orderId}`, "View Order", "#16A34A")}
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `Payment of ${amtFmt} received for order ${orderId}.`,
      reference ? `Reference: ${reference}` : "",
      ``,
      `View order: ${APP_URL}/orders/${orderId}`,
    ].filter(Boolean).join("\n"),
  });
};

/**
 * sendWithdrawalStatusEmail
 * Sent on withdrawal status updates.
 *
 * @param {{ to: string, name: string, amount: number, status: string, reference: string }} opts
 */
export const sendWithdrawalStatusEmail = async ({ to, name, amount, status, reference }) => {
  if (!to) return null;
  const safeName = String(name || "there");
  const amtFmt   = Number(amount).toLocaleString("en-NG", {
    style: "currency", currency: "NGN",
  });
  const approved = status.toLowerCase() === "approved" || status.toLowerCase() === "completed";
  const color    = approved ? "#16A34A" : "#DC2626";

  return sendEmail({
    to,
    subject: `Withdrawal ${status} — ${BRAND}`,
    html: layout({
      title: `Withdrawal ${status}`,
      body: `
        ${h1(`Withdrawal ${status}`)}
        ${p(`Hi ${safeName},`)}
        ${p(`Your withdrawal of <strong>${amtFmt}</strong> (ref: <strong>${reference}</strong>) is <strong style="color:${color};">${status}</strong>.`)}
        ${p(`Questions? <a href="mailto:${SUPPORT}" style="color:#4F46E5;">${SUPPORT}</a>`)}
        ${btn(`${APP_URL}/wallet`, "View Wallet", color)}
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `Withdrawal of ${amtFmt} (ref: ${reference}) is ${status}.`,
      ``,
      `Questions? ${SUPPORT}`,
    ].join("\n"),
  });
};