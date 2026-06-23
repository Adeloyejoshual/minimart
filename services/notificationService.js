/**
 * services/notificationService.js
 *
 * Legacy compatibility shim.
 * All exports delegate to the correct service:
 *   - Notification functions → services/notifications.js
 *   - Email functions        → services/email.js
 *
 * Do not add new business logic here.
 * Migrate each import to the correct service when you touch that file.
 */

/* ── Notification functions ── */
export {
  createNotification,
  sendNotification,
  sendPaymentNotification,
} from "./notifications.js";

/* ── Email functions ── */
export {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendIdentityStatusEmail,
  sendStoreStatusEmail,
} from "./email.js";

/* ── Extra email stubs used by seller/settings and other routes ──
   These wrap email.js functions with the names the old service used.
   Replace each one in the importing file when you have time.        */

import {
  sendVerificationEmail as _sendVerification,
} from "./email.js";

import { Resend } from "resend";

const FROM_ADDRESS = process.env.EMAIL_FROM    || "Loemart <no-reply@loemart.com>";
const SUPPORT      = process.env.EMAIL_SUPPORT || "support@loemart.com";
const BRAND        = process.env.EMAIL_BRAND   || "Loemart";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  try { return new Resend(key); } catch { return null; }
}

async function sendEmail({ to, subject, html, text }) {
  const client = getResend();
  if (!client) {
    console.warn("[notificationService] RESEND_API_KEY not set — email skipped");
    return null;
  }
  try {
    const result = await client.emails.send({
      from: FROM_ADDRESS, to, subject, html,
      text: text ?? html.replace(/<[^>]+>/g, " ").trim(),
    });
    return result;
  } catch (err) {
    console.error("[notificationService] sendEmail error:", err.message);
    return null;
  }
}

/**
 * sendPasswordChangedEmail
 * Imported by routes/seller/settings.js
 */
export const sendPasswordChangedEmail = async ({ to, name }) => {
  if (!to) return null;
  const safeName = String(name || "there");
  return sendEmail({
    to,
    subject : `Your ${BRAND} password has been changed`,
    html    : `
      <p>Hi ${safeName},</p>
      <p>Your password was successfully changed.</p>
      <p>If you did not make this change, contact us immediately at
         <a href="mailto:${SUPPORT}">${SUPPORT}</a>.</p>
      <p>— ${BRAND} Team</p>
    `,
    text    : [
      `Hi ${safeName},`,
      ``,
      `Your password was successfully changed.`,
      ``,
      `If you did not make this change, contact us at ${SUPPORT}.`,
      ``,
      `— ${BRAND} Team`,
    ].join("\n"),
  });
};

/**
 * sendEmailChangeConfirmation
 * Common in account settings flows.
 */
export const sendEmailChangeConfirmation = async ({ to, name, newEmail }) => {
  if (!to) return null;
  const safeName = String(name || "there");
  return sendEmail({
    to,
    subject : `Your ${BRAND} email address has been updated`,
    html    : `
      <p>Hi ${safeName},</p>
      <p>Your email address has been updated to <strong>${newEmail}</strong>.</p>
      <p>If you did not make this change, contact us immediately at
         <a href="mailto:${SUPPORT}">${SUPPORT}</a>.</p>
      <p>— ${BRAND} Team</p>
    `,
    text    : [
      `Hi ${safeName},`,
      ``,
      `Your email has been updated to ${newEmail}.`,
      ``,
      `If you did not make this change, contact us at ${SUPPORT}.`,
      ``,
      `— ${BRAND} Team`,
    ].join("\n"),
  });
};

/**
 * sendOrderStatusEmail
 * Used by order/checkout flows.
 */
export const sendOrderStatusEmail = async ({
  to, name, orderId, status, message,
}) => {
  if (!to) return null;
  const safeName = String(name || "there");
  return sendEmail({
    to,
    subject : `Order ${orderId} — ${status}`,
    html    : `
      <p>Hi ${safeName},</p>
      <p>Your order <strong>${orderId}</strong> status: <strong>${status}</strong>.</p>
      ${message ? `<p>${message}</p>` : ""}
      <p>— ${BRAND} Team</p>
    `,
    text    : [
      `Hi ${safeName},`,
      `Order ${orderId} — ${status}.`,
      message ?? "",
      `— ${BRAND} Team`,
    ].join("\n"),
  });
};

/**
 * sendWithdrawalStatusEmail
 * Used by wallet/payout flows.
 */
export const sendWithdrawalStatusEmail = async ({
  to, name, amount, status, reference,
}) => {
  if (!to) return null;
  const safeName = String(name || "there");
  const amtFmt   = Number(amount).toLocaleString("en-NG", {
    style: "currency", currency: "NGN",
  });
  return sendEmail({
    to,
    subject : `Withdrawal ${status} — ${BRAND}`,
    html    : `
      <p>Hi ${safeName},</p>
      <p>Your withdrawal of <strong>${amtFmt}</strong>
         (ref: ${reference}) is <strong>${status}</strong>.</p>
      <p>Questions? <a href="mailto:${SUPPORT}">${SUPPORT}</a></p>
      <p>— ${BRAND} Team</p>
    `,
    text    : [
      `Hi ${safeName},`,
      `Withdrawal of ${amtFmt} (ref: ${reference}) is ${status}.`,
      `Questions? ${SUPPORT}`,
      `— ${BRAND} Team`,
    ].join("\n"),
  });
};