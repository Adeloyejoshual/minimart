// server/services/emailTemplates.js

const APP_NAME  = process.env.SMTP_FROM_NAME  ?? "MiniMart";
const LOGO_URL  = process.env.LOGO_URL        ?? "";
const BASE_URL  = process.env.FRONTEND_URL    ?? "https://minimart.com";
const YEAR      = new Date().getFullYear();

// ─────────────────────────────────────────────────────────────
// BASE WRAPPER — shared by every template
// ─────────────────────────────────────────────────────────────
const base = ({ title, preview, content, ctaText, ctaUrl }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background:  #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont,
                   "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size:   16px;
      color:       #1f2937;
      -webkit-font-smoothing: antialiased;
    }
    a { color: #6366f1; text-decoration: none; }
    a:hover { text-decoration: underline; }
    img { border: 0; display: block; }

    .wrapper {
      max-width:   600px;
      margin:      0 auto;
      padding:     32px 16px;
    }

    /* Header */
    .header {
      text-align:    center;
      margin-bottom: 24px;
    }
    .header__logo {
      font-size:   1.5rem;
      font-weight: 800;
      color:       #6366f1;
      letter-spacing: -0.02em;
    }

    /* Card */
    .card {
      background:    white;
      border-radius: 20px;
      overflow:      hidden;
      box-shadow:    0 4px 24px rgba(0,0,0,0.06);
    }

    /* Card top band */
    .card__band {
      height:     6px;
      background: linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4);
    }

    /* Card body */
    .card__body { padding: 40px 40px 32px; }

    /* Emoji icon */
    .icon {
      width:          64px;
      height:         64px;
      border-radius:  18px;
      display:        flex;
      align-items:    center;
      justify-content:center;
      font-size:      2rem;
      margin:         0 auto 20px;
    }

    /* Headings */
    h1 {
      font-size:     1.5rem;
      font-weight:   800;
      color:         #1f2937;
      text-align:    center;
      margin-bottom: 8px;
      line-height:   1.3;
    }
    .subtitle {
      text-align:    center;
      color:         #6b7280;
      font-size:     0.9rem;
      margin-bottom: 28px;
      line-height:   1.6;
    }

    /* Info table */
    .info-table {
      width:         100%;
      border-radius: 12px;
      overflow:      hidden;
      border:        1px solid #f3f4f6;
      margin-bottom: 24px;
    }
    .info-table__row {
      display:         flex;
      justify-content: space-between;
      align-items:     center;
      padding:         12px 16px;
      border-bottom:   1px solid #f9fafb;
    }
    .info-table__row:last-child { border-bottom: none; }
    .info-table__row:nth-child(even) { background: #f8fafc; }
    .info-table__label {
      color:     #6b7280;
      font-size: 0.82rem;
    }
    .info-table__value {
      font-weight: 700;
      font-size:   0.85rem;
      color:       #1f2937;
      text-align:  right;
    }

    /* Amount hero */
    .amount-hero {
      background:    linear-gradient(135deg, #4f46e5, #7c3aed);
      border-radius: 14px;
      padding:       24px;
      text-align:    center;
      margin-bottom: 24px;
      color:         white;
    }
    .amount-hero__label {
      font-size:  0.78rem;
      opacity:    0.75;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .amount-hero__value {
      font-size:   2rem;
      font-weight: 800;
      line-height: 1;
    }

    /* CTA button */
    .cta-wrap { text-align: center; margin: 28px 0 8px; }
    .cta-btn {
      display:       inline-block;
      padding:       14px 36px;
      background:    linear-gradient(135deg, #6366f1, #8b5cf6);
      color:         white !important;
      border-radius: 12px;
      font-weight:   700;
      font-size:     0.95rem;
      text-decoration: none !important;
    }

    /* Notice */
    .notice {
      border-radius: 12px;
      padding:       14px 16px;
      font-size:     0.82rem;
      line-height:   1.5;
      margin-bottom: 20px;
      border:        1px solid;
    }
    .notice--warn {
      background:   #fffbeb;
      border-color: #fde68a;
      color:        #92400e;
    }
    .notice--info {
      background:   #eff6ff;
      border-color: #bfdbfe;
      color:        #1e40af;
    }
    .notice--success {
      background:   #ecfdf5;
      border-color: #a7f3d0;
      color:        #065f46;
    }
    .notice--danger {
      background:   #fef2f2;
      border-color: #fecaca;
      color:        #991b1b;
    }

    /* Footer */
    .footer {
      text-align:  center;
      padding:     24px 16px 0;
      color:       #9ca3af;
      font-size:   0.78rem;
      line-height: 1.6;
    }
    .footer a { color: #6b7280; }

    /* Divider */
    .divider {
      border:     none;
      border-top: 1px solid #f3f4f6;
      margin:     24px 0;
    }

    /* Step list */
    .steps { list-style: none; padding: 0; margin: 0 0 24px; }
    .steps li {
      display:       flex;
      align-items:   flex-start;
      gap:           10px;
      padding:       8px 0;
      font-size:     0.875rem;
      color:         #374151;
      border-bottom: 1px solid #f9fafb;
    }
    .steps li:last-child { border-bottom: none; }
    .steps__num {
      min-width:       24px;
      height:          24px;
      border-radius:   50%;
      background:      #6366f1;
      color:           white;
      font-size:       0.72rem;
      font-weight:     700;
      display:         flex;
      align-items:     center;
      justify-content: center;
      flex-shrink:     0;
    }

    /* Mobile */
    @media (max-width: 480px) {
      .card__body { padding: 28px 20px 24px; }
      .amount-hero__value { font-size: 1.6rem; }
      h1 { font-size: 1.25rem; }
    }
  </style>
</head>
<body>
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;color:#f1f5f9;">
    ${preview}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <div class="wrapper">

    <!-- Header -->
    <div class="header">
      ${LOGO_URL
        ? `<img src="${LOGO_URL}" alt="${APP_NAME}"
               height="40" style="margin:0 auto 8px;" />`
        : `<div class="header__logo">${APP_NAME}</div>`
      }
    </div>

    <!-- Card -->
    <div class="card">
      <div class="card__band"></div>
      <div class="card__body">
        ${content}

        ${ctaText && ctaUrl ? `
          <div class="cta-wrap">
            <a href="${ctaUrl}" class="cta-btn">${ctaText}</a>
          </div>
        ` : ""}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>
        &copy; ${YEAR} ${APP_NAME} · All rights reserved
      </p>
      <p style="margin-top:4px;">
        <a href="${BASE_URL}/unsubscribe">Unsubscribe</a>
        &nbsp;·&nbsp;
        <a href="${BASE_URL}/privacy">Privacy Policy</a>
      </p>
    </div>

  </div>
</body>
</html>
`;

// ─────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────
const fmt = (v) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-NG", {
        day:    "2-digit",
        month:  "long",
        year:   "numeric",
        hour:   "2-digit",
        minute: "2-digit",
      })
    : "—";

// ═════════════════════════════════════════════════════════════
// 1. ORDER CONFIRMED (Buyer)
// ═════════════════════════════════════════════════════════════
export const orderConfirmedBuyer = ({
  buyerName,
  orderId,
  reference,
  grandTotal,
  items = [],
  shippingAddress,
  paymentMethod,
}) => ({
  subject: `✅ Order Confirmed — ${reference}`,
  html: base({
    title:   "Order Confirmed",
    preview: `Your order of ${fmt(grandTotal)} has been confirmed!`,
    ctaText: "Track My Order",
    ctaUrl:  `${BASE_URL}/orders/${orderId}`,
    content: `
      <div class="icon" style="background:#ecfdf5;">✅</div>
      <h1>Order Confirmed!</h1>
      <p class="subtitle">
        Hi ${buyerName}, your order has been received
        and is being processed.
      </p>

      <div class="amount-hero">
        <p class="amount-hero__label">Total Paid</p>
        <p class="amount-hero__value">${fmt(grandTotal)}</p>
      </div>

      <div class="info-table">
        <div class="info-table__row">
          <span class="info-table__label">Order ID</span>
          <span class="info-table__value">${orderId}</span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Reference</span>
          <span class="info-table__value">${reference}</span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Payment</span>
          <span class="info-table__value">
            ${paymentMethod === "CASH_ON_DELIVERY"
              ? "💵 Cash on Delivery"
              : "💳 Online Payment"}
          </span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Deliver To</span>
          <span class="info-table__value">
            ${shippingAddress?.city ?? ""},
            ${shippingAddress?.state ?? ""}
          </span>
        </div>
      </div>

      ${items.length ? `
        <p style="font-weight:700;color:#374151;
          font-size:0.85rem;margin-bottom:10px;">
          Your Items (${items.length})
        </p>
        ${items.map((item) => `
          <div class="info-table__row" style="border:1px solid #f3f4f6;
            border-radius:10px;margin-bottom:6px;background:white;">
            <span class="info-table__label">
              ${item.name} × ${item.quantity}
            </span>
            <span class="info-table__value">
              ${fmt(item.total_price)}
            </span>
          </div>
        `).join("")}
      ` : ""}

      <div class="notice notice--info" style="margin-top:20px;">
        📦 Your seller is preparing your order.
        You'll receive another email when it ships.
      </div>
    `,
  }),
});

// ═════════════════════════════════════════════════════════════
// 2. PAYMENT FAILED (Buyer)
// ═════════════════════════════════════════════════════════════
export const paymentFailedBuyer = ({
  buyerName,
  orderId,
  reference,
  grandTotal,
}) => ({
  subject: `❌ Payment Failed — ${reference}`,
  html: base({
    title:   "Payment Failed",
    preview: `Your payment of ${fmt(grandTotal)} failed.`,
    ctaText: "Retry Payment",
    ctaUrl:  `${BASE_URL}/payment-failed/${orderId}`,
    content: `
      <div class="icon" style="background:#fef2f2;">❌</div>
      <h1>Payment Failed</h1>
      <p class="subtitle">
        Hi ${buyerName}, your payment was not successful.
        Don't worry — your order is saved and you can retry.
      </p>

      <div class="info-table">
        <div class="info-table__row">
          <span class="info-table__label">Order ID</span>
          <span class="info-table__value">${orderId}</span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Amount</span>
          <span class="info-table__value">${fmt(grandTotal)}</span>
        </div>
      </div>

      <div class="notice notice--warn">
        💡 Common reasons: insufficient balance, card not enabled
        for online payments, or session timed out.
      </div>
    `,
  }),
});

// ═════════════════════════════════════════════════════════════
// 3. ORDER DELIVERED (Buyer)
// ═════════════════════════════════════════════════════════════
export const orderDeliveredBuyer = ({
  buyerName,
  orderId,
  reference,
  grandTotal,
}) => ({
  subject: `📦 Order Delivered — ${reference}`,
  html: base({
    title:   "Order Delivered",
    preview: "Your order has been delivered!",
    ctaText: "Confirm & Leave a Review",
    ctaUrl:  `${BASE_URL}/orders/${orderId}`,
    content: `
      <div class="icon" style="background:#ecfdf5;">📦</div>
      <h1>Your Order is Here!</h1>
      <p class="subtitle">
        Hi ${buyerName}, your order has been delivered.
        We hope you love it!
      </p>

      <div class="info-table">
        <div class="info-table__row">
          <span class="info-table__label">Order ID</span>
          <span class="info-table__value">${orderId}</span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Total</span>
          <span class="info-table__value">${fmt(grandTotal)}</span>
        </div>
      </div>

      <div class="notice notice--success">
        ⭐ Please confirm delivery and leave a review.
        Your feedback helps other buyers!
      </div>
    `,
  }),
});

// ═════════════════════════════════════════════════════════════
// 4. NEW ORDER (Seller)
// ═════════════════════════════════════════════════════════════
export const newOrderSeller = ({
  storeName,
  orderId,
  vendorAmount,
  items = [],
  buyerCity,
}) => ({
  subject: `🎉 New Order — ${fmt(vendorAmount)} incoming`,
  html: base({
    title:   "New Order Received",
    preview: `You received a new order worth ${fmt(vendorAmount)}!`,
    ctaText: "View Order",
    ctaUrl:  `${BASE_URL}/seller/dashboard/orders`,
    content: `
      <div class="icon" style="background:#ecfdf5;">🎉</div>
      <h1>New Order!</h1>
      <p class="subtitle">
        Hi ${storeName}, you have a new order to fulfill.
        Process it quickly to delight your buyer!
      </p>

      <div class="amount-hero">
        <p class="amount-hero__label">Your Earnings</p>
        <p class="amount-hero__value">${fmt(vendorAmount)}</p>
      </div>

      <div class="info-table">
        <div class="info-table__row">
          <span class="info-table__label">Order ID</span>
          <span class="info-table__value">${orderId}</span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Ship To</span>
          <span class="info-table__value">${buyerCity ?? "Nigeria"}</span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Items</span>
          <span class="info-table__value">${items.length}</span>
        </div>
      </div>

      ${items.length ? `
        ${items.map((item) => `
          <div class="info-table__row"
            style="border:1px solid #f3f4f6;border-radius:10px;
              margin-bottom:6px;">
            <span class="info-table__label">
              ${item.name} × ${item.quantity}
            </span>
            <span class="info-table__value">
              ${fmt(item.unit_price * item.quantity)}
            </span>
          </div>
        `).join("")}
      ` : ""}

      <ul class="steps" style="margin-top:20px;">
        <li>
          <span class="steps__num">1</span>
          Pack the items carefully
        </li>
        <li>
          <span class="steps__num">2</span>
          Mark as ready for pickup in your dashboard
        </li>
        <li>
          <span class="steps__num">3</span>
          Rider will collect and deliver to buyer
        </li>
      </ul>
    `,
  }),
});

// ═════════════════════════════════════════════════════════════
// 5. PAYOUT SENT (Seller)
// ═════════════════════════════════════════════════════════════
export const payoutSentSeller = ({
  storeName,
  netAmount,
  fee,
  bankName,
  accountNumber,
  txRef,
  withdrawalId,
}) => ({
  subject: `💸 Payout Sent — ${fmt(netAmount)}`,
  html: base({
    title:   "Payout Sent",
    preview: `${fmt(netAmount)} has been sent to your bank account.`,
    ctaText: "View Payout History",
    ctaUrl:  `${BASE_URL}/seller/dashboard/payouts`,
    content: `
      <div class="icon" style="background:#ecfdf5;">💸</div>
      <h1>Payout Sent!</h1>
      <p class="subtitle">
        Hi ${storeName}, your withdrawal has been processed
        and sent to your bank account.
      </p>

      <div class="amount-hero">
        <p class="amount-hero__label">Amount Sent to Your Bank</p>
        <p class="amount-hero__value">${fmt(netAmount)}</p>
      </div>

      <div class="info-table">
        <div class="info-table__row">
          <span class="info-table__label">Bank</span>
          <span class="info-table__value">${bankName}</span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Account</span>
          <span class="info-table__value">
            ****${accountNumber?.slice(-4)}
          </span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Transfer Fee</span>
          <span class="info-table__value">
            ${Number(fee) === 0 ? "🎁 Free" : fmt(fee)}
          </span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Reference</span>
          <span class="info-table__value"
            style="font-family:monospace;font-size:0.78rem;">
            ${txRef}
          </span>
        </div>
      </div>

      <div class="notice notice--info">
        ⏱️ Bank transfers typically arrive within 5–30 minutes.
        If you don't receive it within 2 hours, please contact support.
      </div>
    `,
  }),
});

// ═════════════════════════════════════════════════════════════
// 6. PAYOUT FAILED (Seller)
// ═════════════════════════════════════════════════════════════
export const payoutFailedSeller = ({
  storeName,
  amount,
  reason,
  txRef,
}) => ({
  subject: `❌ Payout Failed — ${fmt(amount)}`,
  html: base({
    title:   "Payout Failed",
    preview: `Your withdrawal of ${fmt(amount)} failed. Balance restored.`,
    ctaText: "Try Again",
    ctaUrl:  `${BASE_URL}/seller/dashboard/payouts`,
    content: `
      <div class="icon" style="background:#fef2f2;">❌</div>
      <h1>Payout Failed</h1>
      <p class="subtitle">
        Hi ${storeName}, your withdrawal could not be completed.
        Your balance has been fully restored.
      </p>

      <div class="info-table">
        <div class="info-table__row">
          <span class="info-table__label">Amount</span>
          <span class="info-table__value">${fmt(amount)}</span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Reason</span>
          <span class="info-table__value"
            style="color:#ef4444;">
            ${reason ?? "Transfer declined"}
          </span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Reference</span>
          <span class="info-table__value"
            style="font-family:monospace;font-size:0.78rem;">
            ${txRef}
          </span>
        </div>
      </div>

      <div class="notice notice--success">
        ✅ Your balance has been restored.
        You can request a new withdrawal from your dashboard.
      </div>

      <div class="notice notice--warn" style="margin-top:12px;">
        💡 Common reasons: incorrect bank details, account dormant,
        or bank maintenance. Update your bank details in Settings
        if needed.
      </div>
    `,
  }),
});

// ═════════════════════════════════════════════════════════════
// 7. WITHDRAWAL APPROVED (Seller)
// ═════════════════════════════════════════════════════════════
export const withdrawalApprovedSeller = ({
  storeName,
  amount,
  netAmount,
  bankName,
  accountNumber,
}) => ({
  subject: `👍 Withdrawal Approved — ${fmt(amount)}`,
  html: base({
    title:   "Withdrawal Approved",
    preview: `Your withdrawal of ${fmt(amount)} has been approved.`,
    ctaText: "View Dashboard",
    ctaUrl:  `${BASE_URL}/seller/dashboard/payouts`,
    content: `
      <div class="icon" style="background:#eff6ff;">👍</div>
      <h1>Withdrawal Approved!</h1>
      <p class="subtitle">
        Hi ${storeName}, your withdrawal request has been
        approved and is being processed.
      </p>

      <div class="info-table">
        <div class="info-table__row">
          <span class="info-table__label">Amount Requested</span>
          <span class="info-table__value">${fmt(amount)}</span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">You Receive</span>
          <span class="info-table__value"
            style="color:#10b981;">
            ${fmt(netAmount)}
          </span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Destination</span>
          <span class="info-table__value">
            ${bankName} ****${accountNumber?.slice(-4)}
          </span>
        </div>
      </div>

      <div class="notice notice--info">
        ⚡ Transfer is in progress.
        You'll receive another email when money hits your account.
      </div>
    `,
  }),
});

// ═════════════════════════════════════════════════════════════
// 8. WITHDRAWAL REJECTED (Seller)
// ═════════════════════════════════════════════════════════════
export const withdrawalRejectedSeller = ({
  storeName,
  amount,
  reason,
}) => ({
  subject: `🚫 Withdrawal Rejected — ${fmt(amount)}`,
  html: base({
    title:   "Withdrawal Rejected",
    preview: `Your withdrawal of ${fmt(amount)} was rejected.`,
    ctaText: "Contact Support",
    ctaUrl:  `${BASE_URL}/support`,
    content: `
      <div class="icon" style="background:#fff7ed;">🚫</div>
      <h1>Withdrawal Rejected</h1>
      <p class="subtitle">
        Hi ${storeName}, your withdrawal request has been rejected.
        Your balance has been fully restored.
      </p>

      <div class="info-table">
        <div class="info-table__row">
          <span class="info-table__label">Amount</span>
          <span class="info-table__value">${fmt(amount)}</span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Reason</span>
          <span class="info-table__value"
            style="color:#ef4444;max-width:200px;text-align:right;">
            ${reason ?? "Not specified"}
          </span>
        </div>
      </div>

      <div class="notice notice--success">
        ✅ Your balance has been restored.
      </div>

      <div class="notice notice--warn" style="margin-top:12px;">
        If you believe this is an error, please contact our
        support team with your transaction reference.
      </div>
    `,
  }),
});

// ═════════════════════════════════════════════════════════════
// 9. WELCOME EMAIL (Seller)
// ═════════════════════════════════════════════════════════════
export const welcomeSeller = ({
  storeName,
  sellerName,
}) => ({
  subject: `🎉 Welcome to ${APP_NAME}, ${storeName}!`,
  html: base({
    title:   `Welcome to ${APP_NAME}`,
    preview: `Your seller account is ready. Start listing products!`,
    ctaText: "Go to Dashboard",
    ctaUrl:  `${BASE_URL}/seller/dashboard`,
    content: `
      <div class="icon"
        style="background:linear-gradient(135deg,#6366f1,#8b5cf6);
          font-size:2rem;">
        🛒
      </div>
      <h1>Welcome to ${APP_NAME}!</h1>
      <p class="subtitle">
        Hi ${sellerName}, your seller account for
        <strong>${storeName}</strong> is now active.
        Start listing products and making sales!
      </p>

      <ul class="steps">
        <li>
          <span class="steps__num">1</span>
          Add your bank details so you can receive payouts
        </li>
        <li>
          <span class="steps__num">2</span>
          List your first product
        </li>
        <li>
          <span class="steps__num">3</span>
          Share your store link with customers
        </li>
        <li>
          <span class="steps__num">4</span>
          Receive orders and ship them out
        </li>
        <li>
          <span class="steps__num">5</span>
          Withdraw your earnings anytime
        </li>
      </ul>

      <div class="notice notice--info">
        💡 First 3 withdrawals every day are <strong>free</strong>.
        No hidden fees!
      </div>
    `,
  }),
});

// ═════════════════════════════════════════════════════════════
// 10. WELCOME EMAIL (Buyer)
// ═════════════════════════════════════════════════════════════
export const welcomeBuyer = ({ buyerName }) => ({
  subject: `👋 Welcome to ${APP_NAME}!`,
  html: base({
    title:   `Welcome to ${APP_NAME}`,
    preview: "Your account is ready. Start shopping!",
    ctaText: "Start Shopping",
    ctaUrl:  BASE_URL,
    content: `
      <div class="icon"
        style="background:linear-gradient(135deg,#6366f1,#8b5cf6);
          font-size:2rem;">
        🛍️
      </div>
      <h1>Welcome, ${buyerName}!</h1>
      <p class="subtitle">
        Your ${APP_NAME} account is ready.
        Discover thousands of products from verified sellers.
      </p>

      <div class="notice notice--success">
        🔒 Your payments are secured by Flutterwave.
        Shop with confidence!
      </div>
    `,
  }),
});

// ═════════════════════════════════════════════════════════════
// 11. PASSWORD CHANGED
// ═════════════════════════════════════════════════════════════
export const passwordChanged = ({ name, changedAt }) => ({
  subject: "🔒 Password Changed",
  html: base({
    title:   "Password Changed",
    preview: "Your account password was recently changed.",
    ctaText: "Go to Dashboard",
    ctaUrl:  BASE_URL,
    content: `
      <div class="icon" style="background:#eff6ff;">🔒</div>
      <h1>Password Changed</h1>
      <p class="subtitle">
        Hi ${name}, your account password was changed successfully.
      </p>

      <div class="info-table">
        <div class="info-table__row">
          <span class="info-table__label">Changed At</span>
          <span class="info-table__value">${fmtDate(changedAt)}</span>
        </div>
      </div>

      <div class="notice notice--danger">
        🚨 If you did NOT make this change, contact support
        immediately and secure your account.
      </div>
    `,
  }),
});

// ═════════════════════════════════════════════════════════════
// 12. BALANCE RELEASED (Seller)
// ═════════════════════════════════════════════════════════════
export const balanceReleasedSeller = ({
  storeName,
  amount,
  orderId,
  newAvailableBalance,
}) => ({
  subject: `💰 Balance Released — ${fmt(amount)} available`,
  html: base({
    title:   "Balance Released",
    preview: `${fmt(amount)} is now available for withdrawal.`,
    ctaText: "Withdraw Now",
    ctaUrl:  `${BASE_URL}/seller/dashboard/payouts`,
    content: `
      <div class="icon" style="background:#ecfdf5;">💰</div>
      <h1>Balance Released!</h1>
      <p class="subtitle">
        Hi ${storeName}, your earnings from a delivered order
        are now available for withdrawal.
      </p>

      <div class="amount-hero">
        <p class="amount-hero__label">Released Amount</p>
        <p class="amount-hero__value">${fmt(amount)}</p>
      </div>

      <div class="info-table">
        <div class="info-table__row">
          <span class="info-table__label">Order ID</span>
          <span class="info-table__value">${orderId}</span>
        </div>
        <div class="info-table__row">
          <span class="info-table__label">Available Balance</span>
          <span class="info-table__value"
            style="color:#10b981;">
            ${fmt(newAvailableBalance)}
          </span>
        </div>
      </div>

      <div class="notice notice--info">
        💸 You can withdraw your balance anytime from your
        Payouts dashboard. First 3 withdrawals daily are free!
      </div>
    `,
  }),
});