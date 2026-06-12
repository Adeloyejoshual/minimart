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

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn(
      "[Email] SMTP not configured — emails will be logged only.\n" +
      "  Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable sending."
    );
    return null;
  }

  _transporter = nodemailer.createTransport({
    host:           SMTP_HOST,
    port:           Number(SMTP_PORT ?? 587),
    secure:         SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    pool:           true,
    maxConnections: 5,
    maxMessages:    100,
  });

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

// ── Strip HTML → plain text fallback ────────────────────────
const stripHtml = (html = "") =>
  html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const APP_NAME = process.env.SMTP_FROM_NAME ?? "Minimart";
const BASE_URL = process.env.FRONTEND_URL   ?? "https://minimart.com";
const fmt      = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG")}`;

// ═════════════════════════════════════════════════════════════
// CORE SEND — never throws
// ═════════════════════════════════════════════════════════════
export async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();

  if (!transporter) {
    // Log in dev, silently skip in prod
    if (process.env.NODE_ENV !== "production") {
      console.log("[Email] 📧 SKIP (no SMTP) →", to, "|", subject);
    }
    return false;
  }

  if (!to || !subject || !html) {
    console.error("[Email] Missing to/subject/html");
    return false;
  }

  try {
    const fromName  = process.env.SMTP_FROM_NAME  ?? "Minimart";
    const fromEmail =
      process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER;

    await transporter.sendMail({
      from:  `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text:  text ?? stripHtml(html),
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("[Email] ✅ Sent →", to, "|", subject);
    }
    return true;

  } catch (err) {
    console.error("[Email] ❌ Failed →", to, "|", err.message);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════
// sendVerificationEmail
// Used by: routes/verification.js
// Sends email/phone verification link or OTP
// ═════════════════════════════════════════════════════════════
export async function sendVerificationEmail({
  to,
  name,
  verificationLink,
  otp,
  expiresInMinutes = 30,
}) {
  // ── Support both link-based and OTP-based verification ──
  const isOtp = !!otp && !verificationLink;

  const subject = isOtp
    ? `${otp} — Your ${APP_NAME} Verification Code`
    : `Verify your ${APP_NAME} account`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${subject}</title>
    </head>
    <body style="
      margin:0;padding:0;background:#f1f5f9;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">
      <div style="max-width:520px;margin:2rem auto;padding:1rem;">

        <!-- Card -->
        <div style="
          background:white;border-radius:20px;overflow:hidden;
          box-shadow:0 4px 24px rgba(0,0,0,0.07);
        ">
          <!-- Top band -->
          <div style="
            height:5px;
            background:linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4);
          "></div>

          <!-- Body -->
          <div style="padding:2.5rem 2rem;text-align:center;">

            <!-- Icon -->
            <div style="
              width:64px;height:64px;border-radius:18px;
              background:linear-gradient(135deg,#eef2ff,#ede9fe);
              display:inline-flex;align-items:center;justify-content:center;
              font-size:2rem;margin-bottom:1.25rem;
            ">
              ${isOtp ? "🔐" : "✉️"}
            </div>

            <!-- Title -->
            <h2 style="
              color:#1f2937;font-size:1.35rem;font-weight:800;
              margin:0 0 0.5rem;
            ">
              ${isOtp ? "Your Verification Code" : "Verify Your Account"}
            </h2>

            <!-- Greeting -->
            <p style="color:#6b7280;font-size:0.9rem;
              line-height:1.6;margin:0 0 1.5rem;">
              Hi ${name ?? "there"}, ${
                isOtp
                  ? "use the code below to complete verification."
                  : "click the button below to verify your email address."
              }
            </p>

            ${isOtp ? `
              <!-- OTP Box -->
              <div style="
                background:#f8fafc;border:2px dashed #e5e7eb;
                border-radius:14px;padding:1.5rem;margin:0 0 1.5rem;
              ">
                <p style="
                  font-size:2.75rem;font-weight:900;letter-spacing:0.3em;
                  color:#6366f1;margin:0;font-family:monospace;
                ">
                  ${otp}
                </p>
              </div>
              <p style="color:#9ca3af;font-size:0.8rem;margin:0 0 1rem;">
                This code expires in
                <strong style="color:#374151;">${expiresInMinutes} minutes</strong>.
                Never share it with anyone.
              </p>
            ` : `
              <!-- CTA Button -->
              <a href="${verificationLink}"
                style="
                  display:inline-block;padding:0.9rem 2.25rem;
                  background:linear-gradient(135deg,#6366f1,#8b5cf6);
                  color:white;text-decoration:none;border-radius:12px;
                  font-weight:700;font-size:0.95rem;margin:0 0 1.25rem;
                "
              >
                Verify My Account →
              </a>
              <p style="color:#9ca3af;font-size:0.78rem;margin:0 0 1rem;">
                This link expires in
                <strong style="color:#374151;">${expiresInMinutes} minutes</strong>.
              </p>
              <p style="color:#9ca3af;font-size:0.75rem;margin:0;">
                Or copy this link:<br/>
                <span style="color:#6366f1;word-break:break-all;">
                  ${verificationLink}
                </span>
              </p>
            `}

          </div>
        </div>

        <!-- Footer -->
        <p style="
          text-align:center;color:#9ca3af;font-size:0.75rem;
          margin:1rem 0 0;line-height:1.6;
        ">
          &copy; ${new Date().getFullYear()} ${APP_NAME} Technologies Ltd.
          · If you didn't request this, ignore this email.
        </p>

      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
}

// ═════════════════════════════════════════════════════════════
// sendWelcomeEmail
// Used by: routes/verification.js (after account verified)
// Generic welcome — works for both buyers and sellers
// ═════════════════════════════════════════════════════════════
export async function sendWelcomeEmail({
  to,
  name,
  role = "buyer",    // "buyer" | "seller"
  storeName,         // only for sellers
}) {
  const isSeller = role === "seller";

  const subject = isSeller
    ? `🎉 Welcome to ${APP_NAME}, ${storeName ?? name}!`
    : `👋 Welcome to ${APP_NAME}, ${name}!`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${subject}</title>
    </head>
    <body style="
      margin:0;padding:0;background:#f1f5f9;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">
      <div style="max-width:520px;margin:2rem auto;padding:1rem;">

        <!-- Card -->
        <div style="
          background:white;border-radius:20px;overflow:hidden;
          box-shadow:0 4px 24px rgba(0,0,0,0.07);
        ">
          <!-- Top band -->
          <div style="
            height:5px;
            background:linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4);
          "></div>

          <!-- Body -->
          <div style="padding:2.5rem 2rem;text-align:center;">

            <!-- Icon -->
            <div style="
              width:64px;height:64px;border-radius:18px;
              background:linear-gradient(135deg,#6366f1,#8b5cf6);
              display:inline-flex;align-items:center;justify-content:center;
              font-size:2rem;margin-bottom:1.25rem;color:white;
            ">
              ${isSeller ? "🏪" : "🛍️"}
            </div>

            <!-- Title -->
            <h2 style="
              color:#1f2937;font-size:1.35rem;font-weight:800;
              margin:0 0 0.5rem;
            ">
              Welcome${isSeller && storeName ? `, ${storeName}` : `, ${name}`}!
            </h2>

            <!-- Body -->
            <p style="color:#6b7280;font-size:0.9rem;
              line-height:1.6;margin:0 0 1.75rem;">
              ${isSeller
                ? `Your seller account is now active. Start listing products and earning today!`
                : `Your ${APP_NAME} account is ready. Discover thousands of products from verified sellers.`
              }
            </p>

            <!-- Steps -->
            <div style="
              background:#f8fafc;border-radius:14px;
              padding:1.25rem;margin:0 0 1.75rem;text-align:left;
            ">
              ${isSeller ? `
                <p style="font-weight:700;color:#374151;
                  font-size:0.82rem;margin:0 0 0.75rem;
                  text-transform:uppercase;letter-spacing:0.05em;">
                  Get Started
                </p>
                ${[
                  ["🏦", "Add your bank account for withdrawals"],
                  ["📦", "List your first product"],
                  ["📣", "Share your store link"],
                  ["💸", "Receive orders and get paid"],
                ].map(([icon, text]) => `
                  <div style="display:flex;align-items:center;
                    gap:0.6rem;padding:0.4rem 0;font-size:0.85rem;
                    color:#374151;border-bottom:1px solid #f3f4f6;">
                    <span>${icon}</span><span>${text}</span>
                  </div>
                `).join("")}
              ` : `
                <p style="font-weight:700;color:#374151;
                  font-size:0.82rem;margin:0 0 0.75rem;
                  text-transform:uppercase;letter-spacing:0.05em;">
                  What you can do
                </p>
                ${[
                  ["🔍", "Browse thousands of products"],
                  ["🛒", "Add items to your cart"],
                  ["💳", "Pay securely with Flutterwave"],
                  ["📦", "Track your deliveries"],
                ].map(([icon, text]) => `
                  <div style="display:flex;align-items:center;
                    gap:0.6rem;padding:0.4rem 0;font-size:0.85rem;
                    color:#374151;border-bottom:1px solid #f3f4f6;">
                    <span>${icon}</span><span>${text}</span>
                  </div>
                `).join("")}
              `}
            </div>

            <!-- CTA -->
            <a
              href="${isSeller
                ? `${BASE_URL}/seller/dashboard`
                : BASE_URL
              }"
              style="
                display:inline-block;padding:0.9rem 2.25rem;
                background:linear-gradient(135deg,#6366f1,#8b5cf6);
                color:white;text-decoration:none;border-radius:12px;
                font-weight:700;font-size:0.95rem;
              "
            >
              ${isSeller ? "Go to Dashboard →" : "Start Shopping →"}
            </a>

          </div>
        </div>

        <!-- Footer -->
        <p style="
          text-align:center;color:#9ca3af;font-size:0.75rem;
          margin:1rem 0 0;line-height:1.6;
        ">
          &copy; ${new Date().getFullYear()} ${APP_NAME} Technologies Ltd.
          · <a href="${BASE_URL}/unsubscribe"
            style="color:#9ca3af;">Unsubscribe</a>
        </p>

      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
}

// ═════════════════════════════════════════════════════════════
// sendOtpEmail — alias used by some routes
// ═════════════════════════════════════════════════════════════
export async function sendOtpEmail({ to, name, otp, expiresInMinutes = 10 }) {
  return sendVerificationEmail({ to, name, otp, expiresInMinutes });
}

// ═════════════════════════════════════════════════════════════
// sendPasswordResetEmail
// ═════════════════════════════════════════════════════════════
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
      <body style="margin:0;padding:0;background:#f1f5f9;
        font-family:sans-serif;">
        <div style="max-width:480px;margin:2rem auto;padding:1rem;">
          <div style="background:white;border-radius:20px;
            padding:2rem;text-align:center;
            box-shadow:0 4px 24px rgba(0,0,0,0.07);">

            <div style="font-size:2.5rem;margin-bottom:1rem;">🔒</div>
            <h2 style="color:#1f2937;margin:0 0 0.5rem;">
              Password Reset
            </h2>
            <p style="color:#6b7280;font-size:0.9rem;
              line-height:1.6;margin:0 0 1.5rem;">
              Hi ${name ?? "there"}, click below to reset your password.
              This link expires in <strong>${expiresInMinutes} minutes</strong>.
            </p>

            <a href="${resetLink}" style="
              display:inline-block;padding:0.9rem 2rem;
              background:#6366f1;color:white;
              text-decoration:none;border-radius:12px;
              font-weight:700;margin-bottom:1.5rem;
            ">
              Reset Password →
            </a>

            <p style="color:#9ca3af;font-size:0.78rem;margin:0;">
              If you didn't request this, ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

// ═════════════════════════════════════════════════════════════
// sendOrderConfirmationEmail
// ═════════════════════════════════════════════════════════════
export async function sendOrderConfirmationEmail({
  to,
  buyerName,
  orderId,
  reference,
  grandTotal,
  paymentMethod,
}) {
  return sendEmail({
    to,
    subject: `✅ Order Confirmed — ${reference}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f1f5f9;font-family:sans-serif;">
        <div style="max-width:480px;margin:2rem auto;padding:1rem;">
          <div style="background:white;border-radius:20px;
            padding:2rem;text-align:center;
            box-shadow:0 4px 24px rgba(0,0,0,0.07);">

            <div style="font-size:2.5rem;margin-bottom:1rem;">✅</div>
            <h2 style="color:#1f2937;margin:0 0 0.5rem;">
              Order Confirmed!
            </h2>
            <p style="color:#6b7280;font-size:0.9rem;
              margin:0 0 1.5rem;">
              Hi ${buyerName}, your order has been placed.
            </p>

            <div style="background:#f8fafc;border-radius:12px;
              padding:1rem;margin-bottom:1.5rem;text-align:left;">
              <div style="display:flex;justify-content:space-between;
                padding:0.35rem 0;font-size:0.85rem;">
                <span style="color:#6b7280;">Order ID</span>
                <span style="font-weight:600;">${orderId}</span>
              </div>
              <div style="display:flex;justify-content:space-between;
                padding:0.35rem 0;font-size:0.85rem;">
                <span style="color:#6b7280;">Total</span>
                <span style="font-weight:700;">
                  ₦${Number(grandTotal ?? 0).toLocaleString("en-NG")}
                </span>
              </div>
              <div style="display:flex;justify-content:space-between;
                padding:0.35rem 0;font-size:0.85rem;">
                <span style="color:#6b7280;">Payment</span>
                <span style="font-weight:600;">
                  ${paymentMethod === "CASH_ON_DELIVERY"
                    ? "💵 Pay on Delivery"
                    : "💳 Paid Online"}
                </span>
              </div>
            </div>

            <a href="${BASE_URL}/orders/${orderId}" style="
              display:inline-block;padding:0.875rem 2rem;
              background:linear-gradient(135deg,#6366f1,#8b5cf6);
              color:white;text-decoration:none;border-radius:12px;
              font-weight:700;
            ">
              Track My Order →
            </a>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

// ═════════════════════════════════════════════════════════════
// DEFAULT EXPORT — all functions as object
// ═════════════════════════════════════════════════════════════
export default {
  sendEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
};