// services/email.js
import nodemailer from "nodemailer";

/* ══════════════════════════════════════════════════════════════════════════════
   CONFIG — maps directly to your .env variables
   SMTP_FROM     → sender address  (your@gmail.com)
   SMTP_USER     → auth username   (your@gmail.com)
   SMTP_PASS     → app password    (generated in Google account)
   APP_NAME      → display name in emails
   APP_URL       → base URL for links
   SUPPORT_URL   → support page link
══════════════════════════════════════════════════════════════════════════════ */
const EMAIL_CONFIG = {
  APP_NAME    : process.env.APP_NAME    || "Marketplace",
  APP_URL     : process.env.APP_URL     || "https://yourapp.com",
  SUPPORT_URL : process.env.SUPPORT_URL || "https://yourapp.com/support",
  FROM_NAME   : process.env.APP_NAME    || "Marketplace",
  FROM_EMAIL  : process.env.SMTP_FROM,  // ← your SMTP_FROM variable
};

/* ══════════════════════════════════════════════════════════════════════════════
   TRANSPORTER — lazy singleton
   Built once on first use, reused for all sends
   Prevents crash on startup if SMTP env vars are not yet set
══════════════════════════════════════════════════════════════════════════════ */
let _transporter = null;

const getTransporter = () => {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host   : process.env.SMTP_HOST,                          // smtp.gmail.com
    port   : parseInt(process.env.SMTP_PORT || "587", 10),   // 587
    secure : process.env.SMTP_SECURE === "true",             // false for port 587
    auth   : {
      user : process.env.SMTP_USER,                          // your@gmail.com
      pass : process.env.SMTP_PASS,                          // app password
    },
    pool              : true,   // reuse connections
    maxConnections    : 3,
    maxMessages       : 50,
    connectionTimeout : 10_000,
    greetingTimeout   : 5_000,
    socketTimeout     : 15_000,
  });

  return _transporter;
};

/* ══════════════════════════════════════════════════════════════════════════════
   BASE TEMPLATE
══════════════════════════════════════════════════════════════════════════════ */
const baseTemplate = ({ preheader, content }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${EMAIL_CONFIG.APP_NAME}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                   Roboto, Helvetica, Arial, sans-serif;
      background-color: #0a0a0a;
      color: #ffffff;
      -webkit-font-smoothing: antialiased;
    }

    .wrapper {
      width: 100%;
      background-color: #0a0a0a;
      padding: 48px 16px;
    }

    .container {
      max-width: 480px;
      margin: 0 auto;
      background-color: #111111;
      border-radius: 16px;
      border: 1px solid #222222;
      overflow: hidden;
    }

    .header {
      padding: 28px 40px;
      border-bottom: 1px solid #1a1a1a;
    }

    .logo {
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.3px;
      text-decoration: none;
    }

    .body {
      padding: 32px 40px;
    }

    .title {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.4px;
      margin-bottom: 8px;
      line-height: 1.3;
    }

    .subtitle {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 28px;
    }

    .otp-block {
      background-color: #0f1629;
      border: 1px solid #1e3a5f;
      border-radius: 12px;
      padding: 28px;
      text-align: center;
      margin-bottom: 24px;
    }

    .otp-label {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .otp-code {
      font-size: 42px;
      font-weight: 900;
      color: #60a5fa;
      letter-spacing: 10px;
      font-family: "Courier New", Courier, monospace;
      line-height: 1;
    }

    .otp-expiry {
      font-size: 12px;
      color: #4b5563;
      margin-top: 14px;
    }

    .otp-expiry strong {
      color: #f59e0b;
    }

    .info-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 0;
      border-top: 1px solid #1a1a1a;
    }

    .info-icon {
      font-size: 14px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .info-text {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.5;
    }

    .info-text strong {
      color: #9ca3af;
    }

    .footer {
      padding: 20px 40px 28px;
      border-top: 1px solid #1a1a1a;
    }

    .footer-text {
      font-size: 12px;
      color: #374151;
      line-height: 1.6;
      text-align: center;
    }

    .footer-text a {
      color: #4b5563;
      text-decoration: none;
    }

    .divider {
      height: 1px;
      background-color: #1a1a1a;
      margin: 20px 0;
    }

    @media only screen and (max-width: 520px) {
      .header,
      .body,
      .footer {
        padding-left: 24px;
        padding-right: 24px;
      }

      .otp-code {
        font-size: 34px;
        letter-spacing: 7px;
      }
    }
  </style>
</head>
<body>
  <!-- Hidden preheader text -->
  <div style="display:none;max-height:0;overflow:hidden;">
    ${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <div class="wrapper">
    <div class="container">

      <div class="header">
        <a href="${EMAIL_CONFIG.APP_URL}" class="logo">
          ${EMAIL_CONFIG.APP_NAME}
        </a>
      </div>

      <div class="body">
        ${content}
      </div>

      <div class="footer">
        <p class="footer-text">
          This email was sent by ${EMAIL_CONFIG.APP_NAME}.
          If you did not request this, you can safely ignore it.
        </p>
        <p class="footer-text" style="margin-top:8px;">
          <a href="${EMAIL_CONFIG.SUPPORT_URL}">Support</a>
          &nbsp;&middot;&nbsp;
          <a href="${EMAIL_CONFIG.APP_URL}">Visit site</a>
        </p>
      </div>

    </div>
  </div>
</body>
</html>
`;

/* ══════════════════════════════════════════════════════════════════════════════
   SEND HELPER
══════════════════════════════════════════════════════════════════════════════ */
const send = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from    : `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.FROM_EMAIL}>`,
    to,
    subject,
    html,
    text,
  });

  console.log(`[email] Sent → ${to} | id: ${info.messageId}`);
  return info;
};

/* ══════════════════════════════════════════════════════════════════════════════
   VERIFICATION EMAIL
══════════════════════════════════════════════════════════════════════════════ */
export const sendVerificationEmail = async ({ to, name, otp }) => {
  const firstName = name?.split(" ")[0] || "there";

  const html = baseTemplate({
    preheader : `Your verification code is ${otp}. Valid for 10 minutes.`,
    content   : `
      <h1 class="title">Verify your email</h1>
      <p class="subtitle">
        Hi ${firstName}, enter the code below to verify your
        ${EMAIL_CONFIG.APP_NAME} account.
      </p>

      <div class="otp-block">
        <p class="otp-label">Verification Code</p>
        <p class="otp-code">${otp}</p>
        <p class="otp-expiry">
          Expires in <strong>10 minutes</strong>
        </p>
      </div>

      <div class="info-row">
        <span class="info-icon">🔒</span>
        <p class="info-text">
          <strong>Do not share this code.</strong>
          Our team will never ask for your verification code.
        </p>
      </div>

      <div class="info-row">
        <span class="info-icon">⚠️</span>
        <p class="info-text">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  const text = `
${EMAIL_CONFIG.APP_NAME} — Email Verification

Hi ${firstName},

Your verification code is: ${otp}

Valid for 10 minutes.
Do not share this code with anyone.

If you did not request this, ignore this email.

— ${EMAIL_CONFIG.APP_NAME}
  `.trim();

  return send({
    to,
    subject : `${otp} — Your verification code`,
    html,
    text,
  });
};

/* ══════════════════════════════════════════════════════════════════════════════
   WELCOME EMAIL
══════════════════════════════════════════════════════════════════════════════ */
export const sendWelcomeEmail = async ({ to, name }) => {
  const firstName = name?.split(" ")[0] || "there";

  const html = baseTemplate({
    preheader : `Welcome to ${EMAIL_CONFIG.APP_NAME}. Your account is verified.`,
    content   : `
      <h1 class="title">Email verified</h1>
      <p class="subtitle">
        Hi ${firstName}, your account is now verified and ready to use.
      </p>

      <div class="otp-block" style="text-align:left; padding:20px 24px;">
        <div class="info-row" style="border:none; padding:6px 0;">
          <span class="info-icon">✓</span>
          <p class="info-text">Browse and buy products</p>
        </div>
        <div class="info-row" style="padding:6px 0;">
          <span class="info-icon">✓</span>
          <p class="info-text">Chat with sellers</p>
        </div>
        <div class="info-row" style="border:none; padding:6px 0;">
          <span class="info-icon">✓</span>
          <p class="info-text">Post your own listings</p>
        </div>
      </div>

      <div class="divider"></div>

      <div class="info-row" style="border:none;">
        <p class="info-text">
          Visit your
          <a href="${EMAIL_CONFIG.APP_URL}/dashboard"
             style="color:#3b82f6; text-decoration:none;">
            dashboard
          </a>
          to get started.
        </p>
      </div>
    `,
  });

  const text = `
${EMAIL_CONFIG.APP_NAME} — Welcome

Hi ${firstName},

Your email is verified. Your account is ready.

What you can do:
- Browse and buy products
- Chat with sellers
- Post your own listings

Dashboard: ${EMAIL_CONFIG.APP_URL}/dashboard

— ${EMAIL_CONFIG.APP_NAME}
  `.trim();

  return send({
    to,
    subject : `Welcome to ${EMAIL_CONFIG.APP_NAME}`,
    html,
    text,
  });
};

/* ══════════════════════════════════════════════════════════════════════════════
   STORE APPROVED
══════════════════════════════════════════════════════════════════════════════ */
export const sendStoreApprovedEmail = async ({ to, name, storeName }) => {
  const firstName = name?.split(" ")[0] || "there";

  const html = baseTemplate({
    preheader : `Your store ${storeName} has been approved.`,
    content   : `
      <h1 class="title">Store approved</h1>
      <p class="subtitle">
        Hi ${firstName}, your store
        <strong style="color:#fff;">${storeName}</strong>
        has been verified and is now active.
      </p>

      <div class="otp-block" style="text-align:left; padding:20px 24px;">
        <div class="info-row" style="border:none; padding:6px 0;">
          <span class="info-icon">✓</span>
          <p class="info-text">Post and manage listings</p>
        </div>
        <div class="info-row" style="padding:6px 0;">
          <span class="info-icon">✓</span>
          <p class="info-text">Receive and process orders</p>
        </div>
        <div class="info-row" style="border:none; padding:6px 0;">
          <span class="info-icon">✓</span>
          <p class="info-text">Request fund withdrawals</p>
        </div>
      </div>
    `,
  });

  const text = `
${EMAIL_CONFIG.APP_NAME} — Store Approved

Hi ${firstName},

Your store "${storeName}" has been approved and is now active.

You can now post listings, receive orders, and request withdrawals.

Dashboard: ${EMAIL_CONFIG.APP_URL}/dashboard

— ${EMAIL_CONFIG.APP_NAME}
  `.trim();

  return send({
    to,
    subject : `Store approved — ${storeName}`,
    html,
    text,
  });
};

/* ══════════════════════════════════════════════════════════════════════════════
   STORE REJECTED
══════════════════════════════════════════════════════════════════════════════ */
export const sendStoreRejectedEmail = async ({ to, name, storeName, reason }) => {
  const firstName = name?.split(" ")[0] || "there";

  const html = baseTemplate({
    preheader : `Your store verification for ${storeName} was not approved.`,
    content   : `
      <h1 class="title">Store verification unsuccessful</h1>
      <p class="subtitle">
        Hi ${firstName}, your store
        <strong style="color:#fff;">${storeName}</strong>
        could not be verified at this time.
      </p>

      ${reason ? `
      <div class="otp-block"
           style="background:#1a0a0a; border-color:#3f1515;
                  text-align:left; padding:20px 24px;">
        <p class="otp-label" style="color:#6b7280;">Review Result</p>
        <p style="font-size:14px; color:#fca5a5;
                  line-height:1.6; margin-top:8px;">
          ${reason}
        </p>
      </div>
      ` : ""}

      <div class="info-row">
        <span class="info-icon">↩</span>
        <p class="info-text">
          You can resubmit after addressing the feedback above.
          <a href="${EMAIL_CONFIG.APP_URL}/verification"
             style="color:#3b82f6; text-decoration:none;">
            Reapply here
          </a>
        </p>
      </div>

      <div class="info-row">
        <p class="info-text">
          Need help?
          <a href="${EMAIL_CONFIG.SUPPORT_URL}"
             style="color:#3b82f6; text-decoration:none;">
            Contact support
          </a>
        </p>
      </div>
    `,
  });

  const text = `
${EMAIL_CONFIG.APP_NAME} — Store Verification Unsuccessful

Hi ${firstName},

Your store "${storeName}" could not be verified at this time.

${reason ? `Review result:\n${reason}\n` : ""}
Reapply: ${EMAIL_CONFIG.APP_URL}/verification
Support: ${EMAIL_CONFIG.SUPPORT_URL}

— ${EMAIL_CONFIG.APP_NAME}
  `.trim();

  return send({
    to,
    subject : `Store verification update — ${storeName}`,
    html,
    text,
  });
};

/* ══════════════════════════════════════════════════════════════════════════════
   ACCOUNT FLAGGED
══════════════════════════════════════════════════════════════════════════════ */
export const sendAccountFlaggedEmail = async ({ to, name }) => {
  const firstName = name?.split(" ")[0] || "there";

  const html = baseTemplate({
    preheader : `Your ${EMAIL_CONFIG.APP_NAME} account has been restricted.`,
    content   : `
      <h1 class="title">Account restricted</h1>
      <p class="subtitle">
        Hi ${firstName}, your account has been temporarily restricted
        due to suspicious activity.
      </p>

      <div class="info-row">
        <span class="info-icon">⚠️</span>
        <p class="info-text">
          If this was you, please
          <a href="${EMAIL_CONFIG.SUPPORT_URL}"
             style="color:#3b82f6; text-decoration:none;">
            contact support
          </a>
          to restore access.
        </p>
      </div>

      <div class="info-row">
        <span class="info-icon">🔒</span>
        <p class="info-text">
          If you did not attempt to verify your email multiple times,
          your account may have been targeted. Our team will review it.
        </p>
      </div>
    `,
  });

  const text = `
${EMAIL_CONFIG.APP_NAME} — Account Restricted

Hi ${firstName},

Your account has been temporarily restricted due to suspicious activity.

Contact support to restore access: ${EMAIL_CONFIG.SUPPORT_URL}

— ${EMAIL_CONFIG.APP_NAME}
  `.trim();

  return send({
    to,
    subject : `Account restricted — ${EMAIL_CONFIG.APP_NAME}`,
    html,
    text,
  });
};

/* ══════════════════════════════════════════════════════════════════════════════
   VERIFY TRANSPORTER — call on server startup
══════════════════════════════════════════════════════════════════════════════ */
export const verifyEmailTransporter = async () => {
  try {
    await getTransporter().verify();
    console.log("✅ SMTP connected:", process.env.SMTP_HOST);
  } catch (err) {
    console.error("❌ SMTP connection failed:", err.message);
    // Do not throw — app starts anyway, emails fail gracefully at send time
  }
};