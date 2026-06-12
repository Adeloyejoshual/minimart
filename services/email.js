// services/email.js

import nodemailer from "nodemailer";

// ═════════════════════════════════════════════════════════════
// SINGLETON TRANSPORTER
// ═════════════════════════════════════════════════════════════
let _transporter = null;

const getTransporter = () => {
  if (_transporter) return _transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  // ── No SMTP config — skip silently ───────────────────────
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn(
      "[Email] SMTP not configured — emails will be skipped.\n" +
      "  Set SMTP_HOST, SMTP_USER, SMTP_PASS in your .env"
    );
    return null;
  }

  _transporter = nodemailer.createTransport({
    host:             SMTP_HOST,
    port:             Number(SMTP_PORT ?? 587),
    secure:           SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    pool:             true,
    maxConnections:   5,
    maxMessages:      100,
  });

  // Verify on first creation
  _transporter.verify((err) => {
    if (err) {
      console.error("[Email] SMTP verify failed:", err.message);
      _transporter = null;
    } else {
      console.log("[Email] ✅ SMTP ready:", SMTP_HOST);
    }
  });

  return _transporter;
};

// ── Strip HTML for plain text fallback ──────────────────────
const stripHtml = (html = "") =>
  html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

// ═════════════════════════════════════════════════════════════
// SEND EMAIL
// Never throws — email failure must never break request flow
// ═════════════════════════════════════════════════════════════

/**
 * Send a single email
 *
 * @param {{
 *   to:       string,
 *   subject:  string,
 *   html:     string,
 *   text?:    string,
 * }} options
 *
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
export async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();

  // ── No transporter = SMTP not configured ─────────────────
  if (!transporter) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Email] 📧 Would send to:", to);
      console.log("[Email] Subject:", subject);
    }
    return false;
  }

  if (!to || !subject || !html) {
    console.error("[Email] Missing required fields (to/subject/html)");
    return false;
  }

  try {
    const fromName  = process.env.SMTP_FROM_NAME  ?? "Minimart";
    const fromEmail = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER;

    const info = await transporter.sendMail({
      from:    `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text:    text ?? stripHtml(html),
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("[Email] ✅ Sent:", {
        to,
        subject,
        messageId: info.messageId,
      });
    }

    return true;

  } catch (err) {
    console.error("[Email] ❌ Failed:", {
      to,
      subject,
      error: err.message,
    });
    return false;
  }
}

// ═════════════════════════════════════════════════════════════
// COMMON EMAIL HELPERS
// ═════════════════════════════════════════════════════════════

const APP_NAME   = process.env.SMTP_FROM_NAME ?? "Minimart";
const BASE_URL   = process.env.FRONTEND_URL   ?? "https://minimart.com";

/**
 * Send OTP / verification code email
 */
export async function sendOtpEmail({ to, name, otp, expiresInMinutes = 10 }) {
  return sendEmail({
    to,
    subject: `${otp} — Your ${APP_NAME} Verification Code`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;background:#f1f5f9;padding:2rem;">
        <div style="max-width:480px;margin:0 auto;background:white;
          border-radius:16px;padding:2rem;text-align:center;">

          <h2 style="color:#1f2937;margin:0 0 0.5rem;">
            Verification Code
          </h2>
          <p style="color:#6b7280;font-size:0.9rem;margin:0 0 1.5rem;">
            Hi ${name ?? "there"}, use the code below to verify your account.
          </p>

          <div style="background:#f8fafc;border:2px dashed #e5e7eb;
            border-radius:12px;padding:1.5rem;margin:0 0 1.5rem;">
            <p style="font-size:2.5rem;font-weight:900;
              letter-spacing:0.25em;color:#6366f1;margin:0;">
              ${otp}
            </p>
          </div>

          <p style="color:#9ca3af;font-size:0.8rem;margin:0;">
            This code expires in <strong>${expiresInMinutes} minutes</strong>.
            Do not share it with anyone.
          </p>
        </div>
      </body>
      </html>
    `,
  });
}

/**
 * Send welcome email to new buyer
 */
export async function sendWelcomeBuyerEmail({ to, name }) {
  return sendEmail({
    to,
    subject: `Welcome to ${APP_NAME}! 🎉`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;background:#f1f5f9;padding:2rem;">
        <div style="max-width:480px;margin:0 auto;background:white;
          border-radius:16px;padding:2rem;text-align:center;">

          <div style="font-size:3rem;margin-bottom:1rem;">🛒</div>
          <h2 style="color:#1f2937;margin:0 0 0.5rem;">
            Welcome, ${name}!
          </h2>
          <p style="color:#6b7280;font-size:0.9rem;line-height:1.6;
            margin:0 0 1.5rem;">
            Your ${APP_NAME} account is ready.
            Discover amazing products from verified sellers across Nigeria.
          </p>

          <a href="${BASE_URL}"
            style="display:inline-block;padding:0.875rem 2rem;
              background:linear-gradient(135deg,#6366f1,#8b5cf6);
              color:white;text-decoration:none;border-radius:12px;
              font-weight:700;font-size:0.95rem;">
            Start Shopping →
          </a>
        </div>
      </body>
      </html>
    `,
  });
}

/**
 * Send welcome email to new seller
 */
export async function sendWelcomeSellerEmail({
  to,
  sellerName,
  storeName,
}) {
  return sendEmail({
    to,
    subject: `🎉 Welcome to ${APP_NAME}, ${storeName}!`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;background:#f1f5f9;padding:2rem;">
        <div style="max-width:480px;margin:0 auto;background:white;
          border-radius:16px;padding:2rem;text-align:center;">

          <div style="font-size:3rem;margin-bottom:1rem;">🏪</div>
          <h2 style="color:#1f2937;margin:0 0 0.5rem;">
            Welcome, ${sellerName}!
          </h2>
          <p style="color:#6b7280;font-size:0.9rem;line-height:1.6;
            margin:0 0 1.5rem;">
            Your seller account for <strong>${storeName}</strong>
            is now active. Start listing products and making sales!
          </p>

          <a href="${BASE_URL}/seller/dashboard"
            style="display:inline-block;padding:0.875rem 2rem;
              background:linear-gradient(135deg,#10b981,#059669);
              color:white;text-decoration:none;border-radius:12px;
              font-weight:700;font-size:0.95rem;">
            Go to Dashboard →
          </a>
        </div>
      </body>
      </html>
    `,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail({
  to,
  name,
  resetLink,
  expiresInMinutes = 30,
}) {
  return sendEmail({
    to,
    subject: `Reset Your ${APP_NAME} Password`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;background:#f1f5f9;padding:2rem;">
        <div style="max-width:480px;margin:0 auto;background:white;
          border-radius:16px;padding:2rem;text-align:center;">

          <div style="font-size:2.5rem;margin-bottom:1rem;">🔒</div>
          <h2 style="color:#1f2937;margin:0 0 0.5rem;">
            Password Reset
          </h2>
          <p style="color:#6b7280;font-size:0.9rem;line-height:1.6;
            margin:0 0 1.5rem;">
            Hi ${name ?? "there"}, click the button below to reset
            your password. This link expires in
            <strong>${expiresInMinutes} minutes</strong>.
          </p>

          <a href="${resetLink}"
            style="display:inline-block;padding:0.875rem 2rem;
              background:#6366f1;color:white;text-decoration:none;
              border-radius:12px;font-weight:700;font-size:0.95rem;
              margin-bottom:1.5rem;">
            Reset Password
          </a>

          <p style="color:#9ca3af;font-size:0.78rem;margin:0;">
            If you didn't request this, ignore this email.
            Your password won't change.
          </p>
        </div>
      </body>
      </html>
    `,
  });
}

/**
 * Send order confirmation to buyer
 */
export async function sendOrderConfirmationEmail({
  to,
  buyerName,
  orderId,
  reference,
  grandTotal,
  paymentMethod,
}) {
  const fmt = (n) =>
    `₦${Number(n ?? 0).toLocaleString("en-NG")}`;

  return sendEmail({
    to,
    subject: `✅ Order Confirmed — ${reference}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;background:#f1f5f9;padding:2rem;">
        <div style="max-width:480px;margin:0 auto;background:white;
          border-radius:16px;padding:2rem;text-align:center;">

          <div style="font-size:2.5rem;margin-bottom:1rem;">✅</div>
          <h2 style="color:#1f2937;margin:0 0 0.5rem;">
            Order Confirmed!
          </h2>
          <p style="color:#6b7280;font-size:0.9rem;margin:0 0 1.5rem;">
            Hi ${buyerName}, your order has been placed successfully.
          </p>

          <div style="background:#f8fafc;border-radius:12px;
            padding:1rem;margin-bottom:1.5rem;text-align:left;">
            <div style="display:flex;justify-content:space-between;
              padding:0.4rem 0;font-size:0.85rem;">
              <span style="color:#6b7280;">Order ID</span>
              <span style="font-weight:600;">${orderId}</span>
            </div>
            <div style="display:flex;justify-content:space-between;
              padding:0.4rem 0;font-size:0.85rem;">
              <span style="color:#6b7280;">Total</span>
              <span style="font-weight:700;">${fmt(grandTotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;
              padding:0.4rem 0;font-size:0.85rem;">
              <span style="color:#6b7280;">Payment</span>
              <span style="font-weight:600;">
                ${paymentMethod === "CASH_ON_DELIVERY"
                  ? "💵 Pay on Delivery"
                  : "💳 Paid Online"}
              </span>
            </div>
          </div>

          <a href="${BASE_URL}/orders/${orderId}"
            style="display:inline-block;padding:0.875rem 2rem;
              background:linear-gradient(135deg,#6366f1,#8b5cf6);
              color:white;text-decoration:none;border-radius:12px;
              font-weight:700;font-size:0.95rem;">
            Track My Order →
          </a>
        </div>
      </body>
      </html>
    `,
  });
}

// ── Default export (all functions) ──────────────────────────
export default {
  sendEmail,
  sendOtpEmail,
  sendWelcomeBuyerEmail,
  sendWelcomeSellerEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
};