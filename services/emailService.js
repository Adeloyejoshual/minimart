// server/services/emailService.js

import nodemailer from "nodemailer";

// ═════════════════════════════════════════════════════════════
// SINGLETON TRANSPORTER
// Created once — reused for all emails
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
      "[Email] ⚠️  SMTP not configured — emails will be skipped"
    );
    return null;
  }

  _transporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   Number(SMTP_PORT ?? 587),
    secure: SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    // Retry on temporary failures
    pool:             true,
    maxConnections:   5,
    maxMessages:      100,
    rateDelta:        1000,
    rateLimit:        10,   // max 10 emails per second
  });

  // Verify connection on first use
  _transporter.verify((err) => {
    if (err) {
      console.error("[Email] SMTP connection failed:", err.message);
      _transporter = null;
    } else {
      console.log("[Email] ✅ SMTP connected:", SMTP_HOST);
    }
  });

  return _transporter;
};

// ═════════════════════════════════════════════════════════════
// SEND EMAIL
// Never throws — email failure must never break a payment flow
// ═════════════════════════════════════════════════════════════

/**
 * @param {{
 *   to:      string,
 *   subject: string,
 *   html:    string,
 *   text?:   string,
 * }} options
 * @returns {Promise<boolean>} true if sent, false if failed
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();

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
    const info = await transporter.sendMail({
      from:    `"${process.env.SMTP_FROM_NAME ?? "MiniMart"}" <${
                  process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER
               }>`,
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
    console.error("[Email] ❌ Send failed:", {
      to,
      subject,
      error: err.message,
    });
    return false;
  }
};

// ── Strip HTML tags for plain-text fallback ──────────────────
const stripHtml = (html = "") =>
  html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();