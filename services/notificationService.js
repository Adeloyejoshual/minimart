/**
 * services/notificationService.js
 *
 * Central notification service for Loemart.
 * Handles all email sending via Resend + in-app notifications.
 *
 * v2 — Modern & Professional
 * ────────────────────────────
 * ✓ Beautiful, branded email templates
 * ✓ Product images + itemized details in payment emails
 * ✓ Different templates for buyer vs seller
 * ✓ COD vs online payment distinction
 * ✓ Mobile-optimized (mso-friendly)
 * ✓ Rich order status tracking
 * ✓ Withdrawal + refund emails
 * ✓ All original functions preserved (backward compatible)
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
 *  sendPaymentNotification     → Payment received (with items!)
 *  sendOrderStatusEmail        → Order status update
 *  sendNewOrderToSeller        → NEW: Seller-specific new order email
 *  sendOrderConfirmationToBuyer → NEW: Buyer-specific order confirmation
 *  sendWithdrawalStatusEmail   → Withdrawal status
 *  sendRefundNotification      → NEW: Refund issued
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

// ═════════════════════════════════════════════════════════════
// CONFIG
// ═════════════════════════════════════════════════════════════
const FROM_ADDRESS = process.env.EMAIL_FROM    || "Loemart <no-reply@loemart.com>";
const SUPPORT      = process.env.EMAIL_SUPPORT || "support@loemart.com";
const BRAND        = process.env.EMAIL_BRAND   || "Loemart";
const APP_URL      = process.env.APP_URL       || "https://www.loemart.com";

/* Brand colors */
const BRAND_ORANGE  = "#FF5722";
const BRAND_INDIGO  = "#4F46E5";
const SUCCESS_GREEN = "#16A34A";
const DANGER_RED    = "#DC2626";
const WARNING_AMBER = "#F59E0B";
const NEUTRAL_GRAY  = "#6B7280";

// ═════════════════════════════════════════════════════════════
// RESEND CLIENT (lazy singleton)
// ═════════════════════════════════════════════════════════════
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

// ═════════════════════════════════════════════════════════════
// BASE EMAIL SENDER
// ═════════════════════════════════════════════════════════════
async function sendEmail({ to, subject, html, text, replyTo }) {
  const client = getResend();
  if (!client) return null;

  try {
    const emailData = {
      from:    FROM_ADDRESS,
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    };

    if (replyTo) emailData.reply_to = replyTo;

    const { data, error } = await client.emails.send(emailData);

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

// ═════════════════════════════════════════════════════════════
// SHARED LAYOUT (modernized)
// ═════════════════════════════════════════════════════════════
function layout({ title, body, headerColor = BRAND_INDIGO, preheader }) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <title>${title}</title>
      <!--[if mso]>
      <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
      <![endif]-->
    </head>
    <body style="
      margin: 0;
      padding: 0;
      background-color: #F9FAFB;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    ">

      ${preheader ? `
        <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
          ${preheader}
        </div>
      ` : ""}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px; background-color: #F9FAFB;">
        <tr>
          <td align="center">

            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="
              max-width: 600px;
              width: 100%;
              background: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 4px 24px rgba(0,0,0,0.06);
            ">

              <!-- Header -->
              <tr>
                <td style="
                  background: linear-gradient(135deg, ${headerColor}, ${headerColor}dd);
                  padding: 28px 40px;
                  text-align: center;
                ">
                  <a href="${APP_URL}" style="text-decoration: none;">
                    <span style="
                      color: #ffffff;
                      font-size: 28px;
                      font-weight: 800;
                      letter-spacing: 1px;
                      text-decoration: none;
                    ">${BRAND}</span>
                  </a>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 40px 40px 32px;">
                  ${body}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="
                  background-color: #F9FAFB;
                  padding: 24px 40px;
                  border-top: 1px solid #E5E7EB;
                ">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <p style="margin: 0 0 8px; font-size: 13px; color: #6B7280;">
                          © ${new Date().getFullYear()} ${BRAND}. All rights reserved.
                        </p>
                        <p style="margin: 0 0 8px; font-size: 12px; color: #9CA3AF;">
                          Nigeria's Trusted Neighbourhood Marketplace
                        </p>
                        <p style="margin: 12px 0 0; font-size: 12px; color: #9CA3AF;">
                          Need help? Contact us at
                          <a href="mailto:${SUPPORT}" style="color: ${BRAND_INDIGO}; text-decoration: none; font-weight: 600;">
                            ${SUPPORT}
                          </a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>

            <!-- Social links -->
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; margin-top: 20px;">
              <tr>
                <td align="center" style="padding: 0 40px;">
                  <p style="margin: 0; font-size: 11px; color: #9CA3AF;">
                    <a href="${APP_URL}/privacy" style="color: #9CA3AF; text-decoration: none; margin: 0 8px;">Privacy</a>
                    ·
                    <a href="${APP_URL}/terms" style="color: #9CA3AF; text-decoration: none; margin: 0 8px;">Terms</a>
                    ·
                    <a href="${APP_URL}/unsubscribe" style="color: #9CA3AF; text-decoration: none; margin: 0 8px;">Unsubscribe</a>
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

// ═════════════════════════════════════════════════════════════
// UI HELPERS
// ═════════════════════════════════════════════════════════════

const h1 = (text) =>
  `<h1 style="margin: 0 0 16px; color: #111827; font-size: 24px; font-weight: 800; line-height: 1.3;">${text}</h1>`;

const h2 = (text) =>
  `<h2 style="margin: 24px 0 12px; color: #111827; font-size: 18px; font-weight: 700;">${text}</h2>`;

const p = (text) =>
  `<p style="margin: 0 0 14px; color: #374151; font-size: 15px; line-height: 1.6;">${text}</p>`;

const small = (text) =>
  `<p style="margin: 20px 0 0; font-size: 12px; color: #9CA3AF; line-height: 1.5;">${text}</p>`;

const btn = (href, label, color = BRAND_INDIGO) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px auto;">
    <tr>
      <td align="center" style="border-radius: 10px; background: linear-gradient(135deg, ${color}, ${color}cc);">
        <a href="${href}" style="
          display: inline-block;
          padding: 14px 32px;
          color: #ffffff;
          text-decoration: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
        ">${label}</a>
      </td>
    </tr>
  </table>
`;

const otpBlock = (code, color = BRAND_INDIGO, bg = "#EEF2FF") => `
  <div style="text-align: center; margin: 32px 0;">
    <div style="
      display: inline-block;
      padding: 20px 44px;
      background-color: ${bg};
      border: 2px dashed ${color};
      border-radius: 14px;
      letter-spacing: 14px;
      font-size: 38px;
      font-weight: 800;
      color: ${color};
      font-family: 'Courier New', monospace;
    ">${code}</div>
  </div>
`;

const amountBadge = (amount, currency = "₦", color = SUCCESS_GREEN) => {
  const bg = color === SUCCESS_GREEN ? "#F0FDF4"
           : color === DANGER_RED    ? "#FEF2F2"
           : color === WARNING_AMBER ? "#FFFBEB"
           : "#EFF6FF";
  const borderColor = color === SUCCESS_GREEN ? "#BBF7D0"
                    : color === DANGER_RED    ? "#FECACA"
                    : color === WARNING_AMBER ? "#FDE68A"
                    : "#BFDBFE";

  return `
    <div style="
      background: ${bg};
      border: 1px solid ${borderColor};
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      text-align: center;
    ">
      <p style="margin: 0; color: ${color}; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
        Amount
      </p>
      <p style="margin: 8px 0 0; color: ${color}; font-size: 32px; font-weight: 900;">
        ${currency}${Number(amount).toLocaleString("en-NG")}
      </p>
    </div>
  `;
};

const infoBox = (label, value, color = "#374151", bg = "#F9FAFB") => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
    background: ${bg};
    border-radius: 8px;
    margin: 16px 0;
  ">
    <tr>
      <td style="padding: 14px 18px;">
        <p style="margin: 0 0 4px; font-size: 12px; color: #6B7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
          ${label}
        </p>
        <p style="margin: 0; font-size: 15px; color: ${color}; font-weight: 700;">
          ${value}
        </p>
      </td>
    </tr>
  </table>
`;

const alertBox = (type, message) => {
  const config = {
    success: { color: SUCCESS_GREEN, bg: "#F0FDF4", border: "#BBF7D0", icon: "✅" },
    error:   { color: DANGER_RED,    bg: "#FEF2F2", border: "#FECACA", icon: "❌" },
    warning: { color: WARNING_AMBER, bg: "#FFFBEB", border: "#FDE68A", icon: "⚠️" },
    info:    { color: BRAND_INDIGO,  bg: "#EEF2FF", border: "#C7D2FE", icon: "ℹ️" },
  };
  const c = config[type] ?? config.info;

  return `
    <div style="
      background: ${c.bg};
      border-left: 4px solid ${c.color};
      border-radius: 6px;
      padding: 14px 18px;
      margin: 20px 0;
      color: ${c.color};
      font-size: 14px;
      line-height: 1.5;
    ">
      <span style="font-size: 16px; margin-right: 8px;">${c.icon}</span>
      ${message}
    </div>
  `;
};

/**
 * Renders a table of order items with images.
 */
const itemsTable = (items) => {
  if (!items?.length) return "";

  const rows = items.map((item) => `
    <tr style="border-top: 1px solid #E5E7EB;">
      <td style="padding: 12px 8px; width: 60px;">
        ${item.image ? `
          <img src="${item.image}"
            alt="${item.name}"
            width="52" height="52"
            style="
              border-radius: 8px;
              object-fit: cover;
              display: block;
              border: 1px solid #E5E7EB;
            " />
        ` : `
          <div style="
            width: 52px;
            height: 52px;
            background: #F3F4F6;
            border-radius: 8px;
            text-align: center;
            line-height: 52px;
            font-size: 20px;
          ">📦</div>
        `}
      </td>
      <td style="padding: 12px 8px; vertical-align: middle;">
        <p style="margin: 0; font-size: 14px; color: #111827; font-weight: 600; line-height: 1.3;">
          ${item.name}
        </p>
        ${item.variant ? `
          <p style="margin: 4px 0 0; font-size: 12px; color: #6B7280;">
            ${item.variant}
          </p>
        ` : ""}
        <p style="margin: 4px 0 0; font-size: 12px; color: #6B7280;">
          Qty: <strong>${item.qty}</strong>
        </p>
      </td>
      <td style="padding: 12px 8px; text-align: right; vertical-align: middle;">
        <p style="margin: 0; font-size: 14px; color: #111827; font-weight: 700;">
          ₦${Number((item.price ?? 0) * (item.qty ?? 1)).toLocaleString("en-NG")}
        </p>
      </td>
    </tr>
  `).join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      margin: 20px 0;
      overflow: hidden;
    ">
      <thead>
        <tr style="background: #F9FAFB;">
          <th colspan="2" style="padding: 12px; text-align: left; font-size: 12px; color: #6B7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            Order Items
          </th>
          <th style="padding: 12px; text-align: right; font-size: 12px; color: #6B7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
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

// ═════════════════════════════════════════════════════════════
// AUTH EMAILS
// ═════════════════════════════════════════════════════════════

export const sendVerificationCode = async ({ to, name, code }) => {
  if (!to) return null;
  const safeName = String(name || "there");

  return sendEmail({
    to,
    subject: `${code} is your ${BRAND} verification code`,
    html: layout({
      title: "Verify your email",
      preheader: `Your verification code is ${code}`,
      body: `
        ${h1("Verify your email address")}
        ${p(`Hi ${safeName}, welcome to ${BRAND}! 🎉`)}
        ${p("Use the code below to verify your email address. This code expires in <strong>1 hour</strong>.")}
        ${otpBlock(code, BRAND_INDIGO, "#EEF2FF")}
        ${alertBox("info", "For security, never share this code with anyone.")}
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

export const sendPasswordResetCode = async ({ to, name, code }) => {
  if (!to) return null;
  const safeName = String(name || "there");

  return sendEmail({
    to,
    subject: `${code} is your ${BRAND} password reset code`,
    html: layout({
      title: "Reset your password",
      preheader: `Password reset code: ${code}`,
      headerColor: DANGER_RED,
      body: `
        ${h1("🔒 Reset your password")}
        ${p(`Hi ${safeName},`)}
        ${p("Use the code below to reset your password. This code expires in <strong>15 minutes</strong>.")}
        ${otpBlock(code, DANGER_RED, "#FEF2F2")}
        ${alertBox("warning", "For security, this code can only be used once.")}
        ${small("If you didn't request a password reset, you can safely ignore this email — your password remains unchanged.")}
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

export const sendWelcomeEmail = async ({ to, name }) => {
  if (!to) return null;
  const safeName = String(name || "there");

  return sendEmail({
    to,
    subject: `Welcome to ${BRAND}! 🎉`,
    html: layout({
      title: `Welcome to ${BRAND}`,
      preheader: "Your account is ready — start shopping or selling today",
      body: `
        ${h1(`Welcome to ${BRAND}, ${safeName}! 🎉`)}
        ${p("Your email has been verified and your account is ready.")}
        ${p("You can now browse thousands of products, chat with sellers, or start your own store.")}
        ${btn(`${APP_URL}/dashboard`, "Go to Dashboard")}

        ${h2("Get started")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0;">
              🛍️ <a href="${APP_URL}" style="color: ${BRAND_INDIGO}; text-decoration: none;">Browse marketplace</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              💰 <a href="${APP_URL}/minimart/post-ad" style="color: ${BRAND_INDIGO}; text-decoration: none;">Start selling</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              📱 <a href="${APP_URL}/download" style="color: ${BRAND_INDIGO}; text-decoration: none;">Get the mobile app</a>
            </td>
          </tr>
        </table>

        ${small("Need help getting started? Reply to this email or visit our help center.")}
      `,
    }),
    text: [
      `Welcome to ${BRAND}, ${safeName}!`,
      ``,
      `Your account is ready. Visit your dashboard: ${APP_URL}/dashboard`,
      ``,
      `Need help? Contact us at ${SUPPORT}`,
    ].join("\n"),
  });
};

export const sendPasswordChangedEmail = async ({ to, name }) => {
  if (!to) return null;
  const safeName = String(name || "there");

  return sendEmail({
    to,
    subject: `Your ${BRAND} password has been changed`,
    html: layout({
      title: "Password Changed",
      preheader: "Your password was successfully updated",
      body: `
        ${h1("Password changed successfully ✓")}
        ${p(`Hi ${safeName},`)}
        ${p("Your password was successfully changed on " + new Date().toLocaleString("en-NG"))}
        ${alertBox("warning", `If you did not make this change, contact us immediately at <a href="mailto:${SUPPORT}" style="color:${DANGER_RED};font-weight:600;">${SUPPORT}</a>`)}
        ${btn(`${APP_URL}/settings/security`, "Review Security Settings")}
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

export const sendEmailChangeConfirmation = async ({ to, name, newEmail }) => {
  if (!to) return null;
  const safeName = String(name || "there");

  return sendEmail({
    to,
    subject: `Your ${BRAND} email has been updated`,
    html: layout({
      title: "Email Address Updated",
      body: `
        ${h1("Email address updated ✓")}
        ${p(`Hi ${safeName},`)}
        ${p(`Your email address has been updated to <strong>${newEmail}</strong>.`)}
        ${alertBox("warning", `If you did not make this change, contact us immediately at <a href="mailto:${SUPPORT}" style="color:${DANGER_RED};font-weight:600;">${SUPPORT}</a>`)}
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

export const sendIdentityStatusEmail = async ({ to, name, status, reason }) => {
  if (!to) return null;
  const safeName   = String(name || "there");
  const approved   = status === "approved";
  const color      = approved ? SUCCESS_GREEN : DANGER_RED;

  return sendEmail({
    to,
    subject: `Identity verification ${status} — ${BRAND}`,
    html: layout({
      title: `Identity ${status}`,
      headerColor: color,
      body: `
        ${h1(approved ? "✅ Identity Verified!" : "❌ Verification Rejected")}
        ${p(`Hi ${safeName},`)}
        ${
          approved
            ? p("Congratulations! Your identity has been verified. You can now access all seller features including higher payout limits.")
            : p("Unfortunately, your identity verification was not approved.")
        }
        ${reason ? alertBox(approved ? "success" : "error", `<strong>Reason:</strong> ${reason}`) : ""}
        ${approved
          ? btn(`${APP_URL}/dashboard`, "Go to Dashboard", SUCCESS_GREEN)
          : btn(`${APP_URL}/seller/identity`, "Try Again", DANGER_RED)
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

export const sendStoreStatusEmail = async ({ to, name, storeName, status, reason }) => {
  if (!to) return null;
  const safeName   = String(name || "there");
  const approved   = status === "approved";
  const color      = approved ? SUCCESS_GREEN : DANGER_RED;

  return sendEmail({
    to,
    subject: `Your store "${storeName}" has been ${status}`,
    html: layout({
      title: `Store ${status}`,
      headerColor: color,
      body: `
        ${h1(approved ? "🎉 Store Approved!" : "Store Rejected")}
        ${p(`Hi ${safeName},`)}
        ${
          approved
            ? p(`Great news! Your store <strong>${storeName}</strong> has been approved. You can now start listing products and receiving orders.`)
            : p(`Your store <strong>${storeName}</strong> was not approved.`)
        }
        ${reason ? alertBox(approved ? "success" : "error", `<strong>Reason:</strong> ${reason}`) : ""}
        ${approved
          ? btn(`${APP_URL}/seller/dashboard`, "Open Store Dashboard", SUCCESS_GREEN)
          : btn(`${APP_URL}/seller/store/edit`, "Update & Resubmit", DANGER_RED)
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
 * sendPaymentNotification
 * Sent to BUYER when payment is received (or COD confirmed).
 *
 * @param {{
 *   to: string,
 *   name: string,
 *   amount: number,
 *   orderId: string,
 *   reference?: string,
 *   items?: Array<{name, qty, price, image?, variant?}>,
 *   paymentMethod?: string,
 *   deliveryAddress?: string,
 *   isCOD?: boolean,
 * }} opts
 */
export const sendPaymentNotification = async ({
  to,
  name,
  amount,
  orderId,
  reference,
  items = [],
  paymentMethod,
  deliveryAddress,
  isCOD = false,
}) => {
  if (!to) return null;
  const safeName = String(name || "there");
  const amtFmt   = `₦${Number(amount).toLocaleString("en-NG")}`;

  const title       = isCOD ? "Order Placed Successfully! 📦" : "Payment Confirmed! ✅";
  const subject     = isCOD
    ? `Order ${orderId} confirmed — Pay ${amtFmt} on delivery`
    : `Payment of ${amtFmt} received — Order ${orderId}`;
  const message = isCOD
    ? `Your order has been placed. You will pay <strong>${amtFmt}</strong> when the rider arrives.`
    : `We've received your payment of <strong>${amtFmt}</strong>. The seller has been notified and will prepare your order for shipping.`;

  return sendEmail({
    to,
    subject,
    html: layout({
      title: isCOD ? "Order Placed" : "Payment Received",
      preheader: subject,
      headerColor: SUCCESS_GREEN,
      body: `
        ${h1(title)}
        ${p(`Hi ${safeName},`)}
        ${p(message)}

        ${amountBadge(amount, "₦", SUCCESS_GREEN)}

        ${itemsTable(items)}

        ${infoBox("Order ID", orderId, BRAND_INDIGO)}

        ${reference && !isCOD ? infoBox("Payment Reference", reference) : ""}

        ${paymentMethod ? infoBox("Payment Method", paymentMethod) : ""}

        ${deliveryAddress ? infoBox("Delivering To", deliveryAddress) : ""}

        ${h2("What happens next?")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${isCOD ? `
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;">✅ Order confirmed</td></tr>
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;">📦 Seller prepares your items</td></tr>
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;">🚚 Rider picks up your order</td></tr>
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;">💵 Pay rider on delivery — <strong>${amtFmt}</strong></td></tr>
          ` : `
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;">✅ Payment confirmed</td></tr>
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;">📦 Seller prepares your items</td></tr>
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;">🚚 Order shipped to your address</td></tr>
            <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;">🎁 Delivered — enjoy!</td></tr>
          `}
        </table>

        ${btn(`${APP_URL}/shop/orders/${orderId}`, "Track My Order", SUCCESS_GREEN)}

        ${small("Questions about your order? Reply to this email or contact our support team anytime.")}
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      isCOD
        ? `Order ${orderId} placed successfully. Pay ${amtFmt} on delivery.`
        : `Payment of ${amtFmt} received for order ${orderId}.`,
      reference ? `Reference: ${reference}` : "",
      ``,
      `Track your order: ${APP_URL}/shop/orders/${orderId}`,
    ].filter(Boolean).join("\n"),
  });
};

/**
 * sendNewOrderToSeller
 * Sent to SELLER when they receive a new order.
 *
 * @param {{
 *   to: string,
 *   sellerName: string,
 *   buyerName?: string,
 *   orderId: string,
 *   amount: number,
 *   itemCount: number,
 *   items?: Array,
 *   isCOD?: boolean,
 *   deliveryAddress?: string,
 * }} opts
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
  const safeName = String(sellerName || "there");
  const amtFmt   = `₦${Number(amount).toLocaleString("en-NG")}`;

  return sendEmail({
    to,
    subject: `🎉 New ${isCOD ? "COD " : ""}order received — ${amtFmt}`,
    html: layout({
      title: "New Order",
      preheader: `You have a new order worth ${amtFmt}`,
      headerColor: BRAND_ORANGE,
      body: `
        ${h1("🎉 New Order Received!")}
        ${p(`Hi ${safeName},`)}
        ${p(`Great news! You have a new ${isCOD ? "<strong>Cash on Delivery</strong>" : "<strong>paid</strong>"} order${buyerName ? ` from <strong>${buyerName}</strong>` : ""}.`)}

        ${amountBadge(amount, "₦", BRAND_ORANGE)}

        ${itemsTable(items)}

        ${infoBox("Order ID", orderId, BRAND_INDIGO)}
        ${infoBox("Items", `${itemCount} item(s)`)}
        ${infoBox("Payment", isCOD ? "💵 Cash on Delivery" : "💳 Paid Online", isCOD ? WARNING_AMBER : SUCCESS_GREEN)}

        ${deliveryAddress ? infoBox("Delivering To", deliveryAddress) : ""}

        ${isCOD ? alertBox("warning", `The buyer will pay <strong>${amtFmt}</strong> to the rider on delivery. You will receive your payout after delivery is confirmed.`) : alertBox("success", "Payment has been received. Prepare the order for shipping.")}

        ${h2("Next steps")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;">📦 Prepare items for shipping</td></tr>
          <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;">✅ Mark order as ready in your dashboard</td></tr>
          <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;">🚚 Rider will pick up from your location</td></tr>
        </table>

        ${btn(`${APP_URL}/seller-dashboard/orders/${orderId}`, "View & Fulfill Order", BRAND_ORANGE)}

        ${small("Fulfill orders quickly to maintain your seller rating and get more sales.")}
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `New ${isCOD ? "COD " : "paid "}order received!`,
      `Order ID: ${orderId}`,
      `Amount: ${amtFmt}`,
      `Items: ${itemCount}`,
      ``,
      `Fulfill order: ${APP_URL}/seller-dashboard/orders/${orderId}`,
    ].join("\n"),
  });
};

/**
 * sendOrderConfirmationToBuyer
 * Alias for sendPaymentNotification for clarity.
 */
export const sendOrderConfirmationToBuyer = sendPaymentNotification;

/**
 * sendOrderStatusEmail
 * Generic order status update.
 */
export const sendOrderStatusEmail = async ({ to, name, orderId, status, message, statusColor }) => {
  if (!to) return null;
  const safeName = String(name || "there");

  /* Auto-detect status color */
  const color = statusColor
    ?? (
      ["delivered", "completed", "confirmed", "paid"].includes(status.toLowerCase())
        ? SUCCESS_GREEN
        : ["cancelled", "rejected", "failed", "refunded"].includes(status.toLowerCase())
          ? DANGER_RED
          : ["shipped", "processing", "preparing"].includes(status.toLowerCase())
            ? BRAND_INDIGO
            : WARNING_AMBER
    );

  /* Auto-detect emoji */
  const emoji = {
    "paid":       "✅",
    "processing": "⏳",
    "preparing":  "📦",
    "shipped":    "🚚",
    "delivered":  "🎁",
    "completed":  "✅",
    "cancelled":  "❌",
    "rejected":   "❌",
    "failed":     "❌",
    "refunded":   "💰",
  }[status.toLowerCase()] ?? "📋";

  return sendEmail({
    to,
    subject: `Order ${orderId} — ${status}`,
    html: layout({
      title: `Order ${status}`,
      headerColor: color,
      body: `
        ${h1(`${emoji} Order ${status}`)}
        ${p(`Hi ${safeName},`)}
        ${p(`Your order <strong>${orderId}</strong> has been updated to <strong style="color:${color};">${status}</strong>.`)}
        ${message ? alertBox("info", message) : ""}
        ${btn(`${APP_URL}/shop/orders/${orderId}`, "View Order Details", color)}
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `Order ${orderId} — ${status}.`,
      message ?? "",
      ``,
      `View order: ${APP_URL}/shop/orders/${orderId}`,
    ].filter(Boolean).join("\n"),
  });
};

/**
 * sendWithdrawalStatusEmail
 */
export const sendWithdrawalStatusEmail = async ({ to, name, amount, status, reference, bankName, accountNumber }) => {
  if (!to) return null;
  const safeName = String(name || "there");
  const amtFmt   = `₦${Number(amount).toLocaleString("en-NG")}`;
  const approved = ["approved", "completed", "success", "successful"].includes(status.toLowerCase());
  const color    = approved ? SUCCESS_GREEN : DANGER_RED;

  return sendEmail({
    to,
    subject: `Withdrawal ${status} — ${amtFmt}`,
    html: layout({
      title: `Withdrawal ${status}`,
      headerColor: color,
      body: `
        ${h1(approved ? "💰 Withdrawal Successful!" : "❌ Withdrawal " + status)}
        ${p(`Hi ${safeName},`)}
        ${p(`Your withdrawal request has been ${approved ? "processed successfully" : status}.`)}

        ${amountBadge(amount, "₦", color)}

        ${bankName ? infoBox("Bank", bankName) : ""}
        ${accountNumber ? infoBox("Account", `••••${String(accountNumber).slice(-4)}`) : ""}
        ${infoBox("Reference", reference, BRAND_INDIGO)}

        ${approved
          ? alertBox("success", "Funds should reflect in your bank account within a few minutes.")
          : alertBox("error", "Contact support if you believe this is an error.")
        }

        ${btn(`${APP_URL}/seller/wallet`, "View Wallet", color)}
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `Withdrawal of ${amtFmt} — ${status}.`,
      `Reference: ${reference}`,
      ``,
      `View wallet: ${APP_URL}/seller/wallet`,
    ].join("\n"),
  });
};

/**
 * sendRefundNotification
 * Sent when a refund is issued.
 */
export const sendRefundNotification = async ({ to, name, amount, orderId, reason }) => {
  if (!to) return null;
  const safeName = String(name || "there");
  const amtFmt   = `₦${Number(amount).toLocaleString("en-NG")}`;

  return sendEmail({
    to,
    subject: `💰 Refund of ${amtFmt} processed — Order ${orderId}`,
    html: layout({
      title: "Refund Processed",
      headerColor: SUCCESS_GREEN,
      body: `
        ${h1("💰 Refund Processed")}
        ${p(`Hi ${safeName},`)}
        ${p(`A refund has been processed for order <strong>${orderId}</strong>.`)}
        ${amountBadge(amount, "₦", SUCCESS_GREEN)}
        ${reason ? infoBox("Reason", reason) : ""}
        ${alertBox("info", "Funds will appear in your account within 3-5 business days.")}
        ${btn(`${APP_URL}/shop/orders/${orderId}`, "View Order Details", SUCCESS_GREEN)}
      `,
    }),
    text: [
      `Hi ${safeName},`,
      ``,
      `Refund of ${amtFmt} processed for order ${orderId}.`,
      reason ? `Reason: ${reason}` : "",
      ``,
      `View order: ${APP_URL}/shop/orders/${orderId}`,
    ].filter(Boolean).join("\n"),
  });
};