/**
 * services/checkoutNotificationService.js
 *
 * Dedicated notification service for checkout flow.
 * Wraps the base notificationService.js with rich,
 * checkout-specific templates and orchestration.
 *
 * v1 — Production
 * ─────────────────────────────────────────────────────
 * Why separate from notificationService.js?
 *   • Checkout emails need richer detail (items, address,
 *     delivery timeline, payment breakdown)
 *   • COD vs Online branching lives in ONE place
 *   • Buyer + Seller notifications dispatched together
 *   • Fetches seller/buyer data automatically
 *   • Handles delivery date calculation
 *   • Non-blocking — email failures never break the order
 *
 * Exports:
 *   dispatchOrderNotifications({ order, kind })
 *     → orchestrates ALL emails + in-app notifications
 *
 *   sendBuyerOrderEmail({...})
 *     → detailed buyer email (COD or Paid variant)
 *
 *   sendSellerOrderEmail({...})
 *     → detailed seller email (COD or Paid variant)
 *
 *   sendOrderStatusUpdate({...})
 *     → generic status change (shipped, delivered, cancelled)
 *
 *   sendRefundIssuedEmail({...})
 *     → refund notification with reason
 */

import { pool } from "../config/db.js";

/* ═══════════════════════════════════════════════════════════════
   BASE SERVICE (lazy import to avoid hard dependency)
═══════════════════════════════════════════════════════════════ */
let _base = null;

async function getBase() {
  if (_base) return _base;
  try {
    _base = await import("./notificationService.js");
    return _base;
  } catch (err) {
    console.warn("[checkoutNotifications] Base service unavailable:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const BRAND   = process.env.EMAIL_BRAND || "Loemart";
const APP_URL = process.env.APP_URL     || "https://www.loemart.com";
const SUPPORT = process.env.EMAIL_SUPPORT || "support@loemart.com";

/* Flat brand palette — matches notificationService v3 */
const COLOR = {
  orange   : "#F68B1E",
  orangeDk : "#E07A10",
  orangeLt : "#FFF5EB",
  orangeBd : "#FFD6B3",
  orangeInk: "#9A3412",

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
  warningInk: "#92400E",
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmtAmount(v) {
  const n = Number(v);
  if (isNaN(n)) return "₦0";
  return `₦${n.toLocaleString("en-NG")}`;
}

function safeUrl(url) {
  if (!url) return "";
  const s = String(url);
  if (!/^https?:\/\//i.test(s)) return "";
  return esc(s);
}

/* ═══════════════════════════════════════════════════════════════
   DELIVERY DATE HELPER
   ─────────────────────────────────────────────────────────────
   Mirrors frontend logic — skip Sundays, respect 3pm cutoff.
   Returns { label, short } strings only (no Date objects to
   avoid serialization issues in email templates).
═══════════════════════════════════════════════════════════════ */
const DELIVERY_MIN_DAYS  = 3;
const DELIVERY_MAX_DAYS  = 7;
const NON_DELIVERY_DAYS  = new Set([0]);   /* Sundays */
const CUTOFF_HOUR        = 15;             /* 3pm */

function addBusinessDays(startDate, days) {
  const d = new Date(startDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (!NON_DELIVERY_DAYS.has(d.getDay())) added++;
  }
  return d;
}

function rollToDeliveryDay(date) {
  const d = new Date(date);
  while (NON_DELIVERY_DAYS.has(d.getDay())) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function formatDayMonth(date) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric", month: "long",
  }).format(date);
}

function getDeliveryWindow() {
  const base = new Date();
  if (base.getHours() >= CUTOFF_HOUR) {
    base.setDate(base.getDate() + 1);
    base.setHours(0, 0, 0, 0);
  }

  const start = rollToDeliveryDay(addBusinessDays(base, DELIVERY_MIN_DAYS));
  const end   = rollToDeliveryDay(addBusinessDays(base, DELIVERY_MAX_DAYS));

  const startStr = formatDayMonth(start);
  const endStr   = formatDayMonth(end);

  const isSame = start.toDateString() === end.toDateString();

  return {
    label: isSame
      ? `Delivery on ${startStr}`
      : `Delivery between ${startStr} and ${endStr}`,
    short: isSame ? startStr : `${startStr} — ${endStr}`,
  };
}

/* ═══════════════════════════════════════════════════════════════
   FORMAT ADDRESS FOR EMAIL
═══════════════════════════════════════════════════════════════ */
function formatAddressBlock(address) {
  if (!address) return "";

  const parts = [];
  if (address.recipient_name) parts.push(esc(address.recipient_name));
  if (address.address_line)   parts.push(esc(address.address_line));

  const cityLine = [address.city, address.state].filter(Boolean).join(", ");
  if (cityLine) parts.push(esc(cityLine));

  if (address.bus_stop || address.landmark) {
    parts.push(`Bus stop: <strong>${esc(address.bus_stop || address.landmark)}</strong>`);
  }

  if (address.phone) {
    const phone = address.phone.startsWith("0")
      ? `+234 ${address.phone.slice(1)}`
      : address.phone;
    parts.push(`Phone: ${esc(phone)}`);
  }

  return parts.join("<br />");
}

/* ═══════════════════════════════════════════════════════════════
   EMAIL LAYOUT — matches notificationService v3
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
<body style="margin: 0; padding: 0; background-color: ${COLOR.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: ${COLOR.ink};">

  ${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>` : ""}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding: 24px 12px; background-color: ${COLOR.bg};">
    <tr>
      <td align="center">

        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; background: ${COLOR.cardBg}; border: 1px solid ${COLOR.border}; border-radius: 8px; overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background: ${COLOR.orange}; padding: 20px 24px; text-align: center;">
              <a href="${APP_URL}" style="text-decoration: none;">
                <span style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">${BRAND}</span>
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
            <td style="background-color: ${COLOR.soft}; padding: 20px 24px; border-top: 1px solid ${COLOR.borderLt};">
              <p style="margin: 0 0 6px; font-size: 12px; color: ${COLOR.muted}; text-align: center;">
                © ${new Date().getFullYear()} ${BRAND}. All rights reserved.
              </p>
              <p style="margin: 0 0 8px; font-size: 11px; color: ${COLOR.faint}; text-align: center;">
                Nigeria's Trusted Neighbourhood Marketplace
              </p>
              <p style="margin: 8px 0 0; font-size: 11px; color: ${COLOR.faint}; text-align: center;">
                Need help?
                <a href="mailto:${SUPPORT}" style="color: ${COLOR.orange}; text-decoration: none; font-weight: 600;">${SUPPORT}</a>
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
   UI HELPERS (block builders)
═══════════════════════════════════════════════════════════════ */
const h1 = (text) =>
  `<h1 style="margin: 0 0 12px; color: ${COLOR.ink}; font-size: 20px; font-weight: 800; line-height: 1.3;">${text}</h1>`;

const h2 = (text) =>
  `<h2 style="margin: 24px 0 10px; color: ${COLOR.muted}; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding-bottom: 8px; border-bottom: 1px solid ${COLOR.borderLt};">${text}</h2>`;

const p = (text) =>
  `<p style="margin: 0 0 12px; color: ${COLOR.ink2}; font-size: 14px; line-height: 1.6;">${text}</p>`;

const small = (text) =>
  `<p style="margin: 16px 0 0; font-size: 12px; color: ${COLOR.muted}; line-height: 1.5;">${text}</p>`;

const btn = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px auto;">
    <tr>
      <td align="center" style="border-radius: 4px; background: ${COLOR.orange};">
        <a href="${esc(href)}" style="display: inline-block; padding: 12px 28px; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 700;">${esc(label)}</a>
      </td>
    </tr>
  </table>
`;

const amountBox = (amount, label, tone = "neutral") => {
  const tones = {
    neutral: { bg: COLOR.soft,      border: COLOR.border,    color: COLOR.ink },
    orange:  { bg: COLOR.orangeLt,  border: COLOR.orangeBd,  color: COLOR.orangeDk },
    success: { bg: COLOR.successLt, border: COLOR.successBd, color: COLOR.success },
  };
  const c = tones[tone] ?? tones.neutral;

  return `
    <div style="background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 6px; padding: 18px 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 4px; color: ${COLOR.muted}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">${esc(label)}</p>
      <p style="margin: 0; color: ${c.color}; font-size: 28px; font-weight: 800;">${fmtAmount(amount)}</p>
    </div>
  `;
};

const infoRow = (label, value) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 6px 0;">
    <tr>
      <td style="padding: 8px 12px; background: ${COLOR.soft}; border-radius: 4px;">
        <p style="margin: 0 0 2px; font-size: 11px; color: ${COLOR.muted}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">${esc(label)}</p>
        <p style="margin: 0; font-size: 14px; color: ${COLOR.ink}; font-weight: 600; word-break: break-word;">${value}</p>
      </td>
    </tr>
  </table>
`;

const alertBox = (type, message) => {
  const map = {
    success: { bg: COLOR.successLt, border: COLOR.success, color: COLOR.success },
    warning: { bg: COLOR.warningLt, border: COLOR.warning, color: COLOR.warningInk },
    info:    { bg: COLOR.orangeLt,  border: COLOR.orange,  color: COLOR.orangeInk },
    error:   { bg: COLOR.dangerLt,  border: COLOR.danger,  color: COLOR.danger },
  };
  const c = map[type] ?? map.info;

  return `
    <div style="background: ${c.bg}; border-left: 3px solid ${c.border}; border-radius: 3px; padding: 12px 16px; margin: 16px 0; color: ${c.color}; font-size: 13px; line-height: 1.5;">
      ${message}
    </div>
  `;
};

/*
 * Detailed items table with images, variants, and line totals
 */
const detailedItemsTable = (items) => {
  if (!items?.length) return "";

  const rows = items.map((item) => `
    <tr style="border-top: 1px solid ${COLOR.borderLt};">
      <td style="padding: 14px 10px; width: 60px; vertical-align: top;">
        ${item.image ? `
          <img src="${safeUrl(item.image)}"
            alt="${esc(item.name)}"
            width="52" height="52"
            style="border-radius: 4px; object-fit: cover; display: block; border: 1px solid ${COLOR.borderLt};" />
        ` : `
          <div style="width: 52px; height: 52px; background: ${COLOR.soft}; border-radius: 4px; text-align: center; line-height: 52px; color: ${COLOR.faint}; font-size: 18px;">📦</div>
        `}
      </td>
      <td style="padding: 14px 10px; vertical-align: top;">
        <p style="margin: 0 0 4px; font-size: 13px; color: ${COLOR.ink}; font-weight: 600; line-height: 1.35;">
          ${esc(item.name)}
        </p>
        ${item.variant ? `
          <p style="margin: 0 0 4px; font-size: 11px; color: ${COLOR.muted};">
            ${esc(item.variant)}
          </p>
        ` : ""}
        ${item.sku ? `
          <p style="margin: 0 0 4px; font-size: 11px; color: ${COLOR.faint};">
            SKU: ${esc(item.sku)}
          </p>
        ` : ""}
        <p style="margin: 4px 0 0; font-size: 12px; color: ${COLOR.muted};">
          Qty ${esc(item.qty)} × ${fmtAmount(item.price)}
        </p>
      </td>
      <td style="padding: 14px 10px; text-align: right; vertical-align: top;">
        <p style="margin: 0; font-size: 14px; color: ${COLOR.ink}; font-weight: 700; white-space: nowrap;">
          ${fmtAmount((item.price ?? 0) * (item.qty ?? 1))}
        </p>
      </td>
    </tr>
  `).join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${COLOR.border}; border-radius: 6px; margin: 16px 0; overflow: hidden;">
      <thead>
        <tr style="background: ${COLOR.sectionBg};">
          <th colspan="2" style="padding: 10px 12px; text-align: left; font-size: 11px; color: ${COLOR.muted}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
            Order Items (${items.length})
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
 * Price breakdown table (subtotal / delivery / discount / total)
 */
const priceBreakdown = ({ subtotal, deliveryFee, discount, couponCode, grandTotal, freeShipping }) => {
  const rows = [];

  rows.push(`
    <tr>
      <td style="padding: 6px 12px; font-size: 13px; color: ${COLOR.ink2};">Subtotal</td>
      <td style="padding: 6px 12px; font-size: 13px; color: ${COLOR.ink}; text-align: right; font-weight: 600;">${fmtAmount(subtotal)}</td>
    </tr>
  `);

  if (Number(discount) > 0) {
    rows.push(`
      <tr>
        <td style="padding: 6px 12px; font-size: 13px; color: ${COLOR.success};">
          Discount${couponCode ? ` (${esc(couponCode)})` : ""}
        </td>
        <td style="padding: 6px 12px; font-size: 13px; color: ${COLOR.success}; text-align: right; font-weight: 600;">− ${fmtAmount(discount)}</td>
      </tr>
    `);
  }

  rows.push(`
    <tr>
      <td style="padding: 6px 12px; font-size: 13px; color: ${COLOR.ink2};">Delivery fee</td>
      <td style="padding: 6px 12px; font-size: 13px; text-align: right; font-weight: 600;">
        ${freeShipping ? `<span style="color: ${COLOR.success}; text-transform: uppercase; letter-spacing: 0.05em;">FREE</span>` : `<span style="color: ${COLOR.ink};">${fmtAmount(deliveryFee)}</span>`}
      </td>
    </tr>
  `);

  rows.push(`
    <tr>
      <td colspan="2" style="padding: 4px 12px;"><div style="height: 1px; background: ${COLOR.borderLt};"></div></td>
    </tr>
  `);

  rows.push(`
    <tr>
      <td style="padding: 8px 12px; font-size: 15px; color: ${COLOR.ink}; font-weight: 800;">Total</td>
      <td style="padding: 8px 12px; font-size: 15px; color: ${COLOR.ink}; text-align: right; font-weight: 800;">${fmtAmount(grandTotal)}</td>
    </tr>
  `);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${COLOR.border}; border-radius: 6px; margin: 16px 0; overflow: hidden; background: white;">
      ${rows.join("")}
    </table>
  `;
};

/*
 * Numbered step list (matches checkout style)
 */
const stepList = (steps) => {
  if (!steps?.length) return "";

  const rows = steps.map((step, i) => `
    <tr>
      <td style="padding: 6px 0; vertical-align: middle;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 24px; height: 24px; background: ${COLOR.orangeLt}; color: ${COLOR.orange}; border-radius: 50%; text-align: center; font-size: 12px; font-weight: 800; line-height: 24px;">${i + 1}</td>
            <td style="padding-left: 10px; font-size: 13px; color: ${COLOR.ink2}; line-height: 1.5;">${esc(step)}</td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 12px 0;">${rows}</table>`;
};

/* ═══════════════════════════════════════════════════════════════
   BUYER EMAIL — with full order details
═══════════════════════════════════════════════════════════════ */
export async function sendBuyerOrderEmail({
  to,
  buyerName,
  orderId,
  trackingId,
  items = [],
  subtotal,
  deliveryFee,
  discount = 0,
  couponCode = null,
  grandTotal,
  isCOD = false,
  freeShipping = false,
  paymentReference = null,
  address = null,
  deliveryWindow = null,
}) {
  const base = await getBase();
  if (!base) return null;

  const amtFmt   = fmtAmount(grandTotal);
  const safeName = esc(buyerName || "there");
  const track    = esc(trackingId ?? orderId);

  /* ── COD vs Online branching ── */
  const subject = isCOD
    ? `Order ${track} placed — Pay ${amtFmt} on delivery`
    : `Payment of ${amtFmt} received — Order ${track}`;

  const preheader = isCOD
    ? `Your order is confirmed. Pay ${amtFmt} on delivery.`
    : `Payment confirmed for order ${track}`;

  const title = isCOD ? "Order Placed" : "Payment Received";

  const intro = isCOD
    ? `Your order has been placed. You'll pay <strong>${amtFmt}</strong> when the rider arrives at your bus stop.`
    : `We've received your payment of <strong>${amtFmt}</strong>. The seller has been notified and will prepare your order.`;

  const amountLabel = isCOD ? "Amount Due on Delivery" : "Amount Paid";
  const amountTone  = isCOD ? "orange" : "success";

  const nextSteps = isCOD
    ? [
        "Order confirmed",
        "Seller prepares your items",
        "Loemart Express picks up from seller",
        `Pay rider on delivery — ${amtFmt}`,
      ]
    : [
        "Payment confirmed",
        "Seller prepares your items",
        "Loemart Express picks up from seller",
        "Delivered to your bus stop",
      ];

  const window = deliveryWindow ?? getDeliveryWindow();

  const html = layout({
    title,
    preheader,
    body: `
      ${h1(title)}
      ${p(`Hi ${safeName},`)}
      ${p(intro)}

      ${amountBox(grandTotal, amountLabel, amountTone)}

      ${h2("Delivery")}
      ${alertBox("info", `<strong>${esc(window.label)}</strong><br /><span style="font-size:12px;opacity:0.8;">Delivered by Loemart Express to your bus stop</span>`)}

      ${address ? `
        ${h2("Delivering To")}
        <div style="padding: 12px 16px; background: ${COLOR.soft}; border-radius: 6px; font-size: 13px; color: ${COLOR.ink2}; line-height: 1.6;">
          ${formatAddressBlock(address)}
        </div>
      ` : ""}

      ${h2("Order Items")}
      ${detailedItemsTable(items)}

      ${h2("Payment Summary")}
      ${priceBreakdown({ subtotal, deliveryFee, discount, couponCode, grandTotal, freeShipping })}

      ${h2("Order Details")}
      ${infoRow("Tracking ID", track)}
      ${infoRow("Payment Method", isCOD ? "Cash on Delivery" : "Paid Online")}
      ${!isCOD && paymentReference ? infoRow("Payment Reference", paymentReference) : ""}
      ${couponCode ? infoRow("Coupon Applied", `${couponCode} — saved ${fmtAmount(discount)}`) : ""}

      ${h2("What Happens Next")}
      ${stepList(nextSteps)}

      ${btn(`${APP_URL}/shop/orders/${orderId}`, "Track My Order")}

      ${small(`Questions about your order? Reply to this email or contact us at <a href="mailto:${SUPPORT}" style="color: ${COLOR.orange}; font-weight: 600;">${SUPPORT}</a>`)}
    `,
  });

  const textLines = [
    `Hi ${buyerName || "there"},`,
    ``,
    isCOD
      ? `Order ${track} placed. Pay ${amtFmt} on delivery.`
      : `Payment of ${amtFmt} received for order ${track}.`,
    ``,
    `Delivery: ${window.label}`,
    ``,
    `Items:`,
    ...items.map((i) => `  • ${i.name} × ${i.qty} — ${fmtAmount((i.price ?? 0) * (i.qty ?? 1))}`),
    ``,
    `Subtotal: ${fmtAmount(subtotal)}`,
    Number(discount) > 0 ? `Discount: −${fmtAmount(discount)}` : "",
    freeShipping ? `Delivery: FREE` : `Delivery: ${fmtAmount(deliveryFee)}`,
    `Total: ${fmtAmount(grandTotal)}`,
    ``,
    !isCOD && paymentReference ? `Payment reference: ${paymentReference}` : "",
    ``,
    `Track: ${APP_URL}/shop/orders/${orderId}`,
  ].filter(Boolean).join("\n");

  /* Fall back to base sendPaymentNotification signature */
  return base.sendPaymentNotification({
    to,
    name         : buyerName,
    amount       : grandTotal,
    orderId      : track,
    isCOD,
    reference    : paymentReference,
    paymentMethod: isCOD ? "Cash on Delivery" : "Paid Online",
    items,
    /* Override with our richer HTML if base supports it */
    __html       : html,
    __text       : textLines,
  }).catch((err) => {
    console.warn("[checkoutNotifications] buyer email failed:", err.message);
    return null;
  });
}

/* ═══════════════════════════════════════════════════════════════
   SELLER EMAIL — new order details
═══════════════════════════════════════════════════════════════ */
export async function sendSellerOrderEmail({
  to,
  sellerName,
  buyerName,
  orderId,
  trackingId,
  items = [],
  subtotal,
  isCOD = false,
  address = null,
  deliveryWindow = null,
}) {
  const base = await getBase();
  if (!base) return null;

  const amtFmt   = fmtAmount(subtotal);
  const safeName = esc(sellerName || "there");
  const track    = esc(trackingId ?? orderId);
  const window   = deliveryWindow ?? getDeliveryWindow();

  const subject = `New ${isCOD ? "COD " : ""}order — ${amtFmt}`;
  const preheader = `You have a new order worth ${amtFmt}${buyerName ? ` from ${buyerName}` : ""}`;

  const html = layout({
    title: "New Order Received",
    preheader,
    body: `
      ${h1("New Order Received")}
      ${p(`Hi ${safeName},`)}
      ${p(`You have a new ${isCOD ? "<strong>Cash on Delivery</strong>" : "<strong>paid</strong>"} order${buyerName ? ` from <strong>${esc(buyerName)}</strong>` : ""}.`)}

      ${amountBox(subtotal, isCOD ? "Order Value (Awaiting Delivery)" : "Order Value (Paid)", isCOD ? "orange" : "success")}

      ${isCOD
        ? alertBox("warning", `The buyer will pay <strong>${amtFmt}</strong> to the rider on delivery. Your payout is released after delivery is confirmed.`)
        : alertBox("success", "Payment has been received. Prepare and hand over to the rider.")
      }

      ${h2("Order Items")}
      ${detailedItemsTable(items)}

      ${h2("Delivery")}
      ${infoRow("Expected Pickup Window", window.label)}
      ${address ? infoRow("Deliver To", `${esc(address.city || "")}, ${esc(address.state || "")}`) : ""}

      ${h2("Order Details")}
      ${infoRow("Tracking ID", track)}
      ${infoRow("Payment", isCOD ? "Cash on Delivery" : "Paid Online")}
      ${infoRow("Items", `${items.length} item${items.length === 1 ? "" : "s"}`)}

      ${h2("Next Steps")}
      ${stepList([
        "Prepare items for shipping",
        "Mark order as ready in your dashboard",
        "Loemart Express will pick up from your location",
        isCOD ? "You'll be paid after delivery is confirmed" : "You'll be paid on next payout cycle",
      ])}

      ${btn(`${APP_URL}/seller-dashboard/orders/${orderId}`, "View & Fulfill Order")}

      ${small("Fulfill orders quickly to maintain your seller rating and unlock more sales.")}
    `,
  });

  return base.sendNewOrderToSeller({
    to,
    sellerName,
    buyerName,
    orderId  : track,
    amount   : subtotal,
    itemCount: items.length,
    items,
    isCOD,
    __html   : html,
  }).catch((err) => {
    console.warn("[checkoutNotifications] seller email failed:", err.message);
    return null;
  });
}

/* ═══════════════════════════════════════════════════════════════
   ORDER STATUS UPDATE — shipped, delivered, cancelled
═══════════════════════════════════════════════════════════════ */
export async function sendOrderStatusUpdate({
  to,
  buyerName,
  orderId,
  trackingId,
  status,
  message = null,
}) {
  const base = await getBase();
  if (!base) return null;

  const safeName = esc(buyerName || "there");
  const track    = esc(trackingId ?? orderId);
  const safeStatus = esc(String(status || "updated"));

  const statusConfig = {
    confirmed:  { title: "Order Confirmed",   tone: "success", verb: "confirmed" },
    processing: { title: "Order Processing",  tone: "info",    verb: "being prepared" },
    shipped:    { title: "Order Shipped",     tone: "info",    verb: "on the way" },
    delivered:  { title: "Order Delivered",   tone: "success", verb: "delivered" },
    cancelled:  { title: "Order Cancelled",   tone: "error",   verb: "cancelled" },
  };

  const cfg = statusConfig[status.toLowerCase()] ?? {
    title: `Order ${safeStatus}`,
    tone : "info",
    verb : safeStatus,
  };

  const html = layout({
    title: cfg.title,
    preheader: `Your order ${track} is ${cfg.verb}`,
    body: `
      ${h1(cfg.title)}
      ${p(`Hi ${safeName},`)}
      ${p(`Your order <strong>${track}</strong> is now <strong>${cfg.verb}</strong>.`)}

      ${message ? alertBox(cfg.tone, esc(message)) : ""}

      ${btn(`${APP_URL}/shop/orders/${orderId}`, "View Order Details")}

      ${small(`Questions? Contact us at <a href="mailto:${SUPPORT}" style="color: ${COLOR.orange}; font-weight: 600;">${SUPPORT}</a>`)}
    `,
  });

  return base.sendOrderStatusEmail({
    to,
    name    : buyerName,
    orderId : track,
    status  : safeStatus,
    message,
    __html  : html,
  }).catch((err) => {
    console.warn("[checkoutNotifications] status update failed:", err.message);
    return null;
  });
}

/* ═══════════════════════════════════════════════════════════════
   REFUND ISSUED
═══════════════════════════════════════════════════════════════ */
export async function sendRefundIssuedEmail({
  to,
  buyerName,
  orderId,
  trackingId,
  amount,
  reason = null,
}) {
  const base = await getBase();
  if (!base) return null;

  const track = trackingId ?? orderId;

  return base.sendRefundNotification({
    to,
    name    : buyerName,
    amount,
    orderId : track,
    reason,
  }).catch((err) => {
    console.warn("[checkoutNotifications] refund email failed:", err.message);
    return null;
  });
}

/* ═══════════════════════════════════════════════════════════════
   IN-APP NOTIFICATIONS
   ─────────────────────────────────────────────────────────────
   Uses base createNotification. Wrapped for consistency.
═══════════════════════════════════════════════════════════════ */
async function createInAppNotification({
  userId,
  type,
  title,
  message,
  link,
  meta,
}) {
  const base = await getBase();
  if (!base?.createNotification) return null;

  return base.createNotification({
    userId,
    type,
    title,
    message,
    link,
    meta,
  }).catch((err) => {
    console.warn("[checkoutNotifications] in-app failed:", err.message);
    return null;
  });
}

/* ═══════════════════════════════════════════════════════════════
   FETCH SELLER (helper — avoids repeated queries in caller)
═══════════════════════════════════════════════════════════════ */
async function fetchSellerContact(sellerId) {
  try {
    const { rows: [row] } = await pool.query(
      `SELECT id, email, name FROM market.users WHERE id = $1`,
      [sellerId]
    );
    return row ?? null;
  } catch (err) {
    console.warn(
      `[checkoutNotifications] fetchSeller ${sellerId} failed:`, err.message
    );
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   FETCH ADDRESS (helper)
═══════════════════════════════════════════════════════════════ */
async function fetchAddress(addressId) {
  if (!addressId) return null;
  try {
    const { rows: [row] } = await pool.query(
      `SELECT id, recipient_name, phone, address_line,
              landmark, bus_stop, city, state
       FROM public.user_addresses WHERE id = $1`,
      [addressId]
    );
    return row ?? null;
  } catch (err) {
    console.warn("[checkoutNotifications] fetchAddress failed:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN ORCHESTRATOR — dispatch all order notifications
   ─────────────────────────────────────────────────────────────
   Single entry point used by createOrder.js.
   Fetches all needed data + dispatches all emails/notifications.
   Non-blocking: never throws.
   
   @param {Object} params
   @param {Object} params.user         Buyer { id, email, name }
   @param {String} params.orderGroupId
   @param {String} params.trackingId
   @param {Number} params.subtotal
   @param {Number} params.deliveryFee
   @param {Number} params.discount
   @param {String} params.couponCode
   @param {Number} params.grandTotal
   @param {Boolean} params.freeShipping
   @param {String} params.paymentMethod  "CASH_ON_DELIVERY" | "ONLINE_PAYMENT"
   @param {String} params.paymentReference (for online payments)
   @param {String} params.addressId
   @param {Array}  params.orders        Sub-orders per seller
═══════════════════════════════════════════════════════════════ */
export async function dispatchOrderNotifications({
  user,
  orderGroupId,
  trackingId,
  subtotal,
  deliveryFee,
  discount = 0,
  couponCode = null,
  grandTotal,
  freeShipping = false,
  paymentMethod,
  paymentReference = null,
  addressId,
  orders,
}) {
  const isCOD = paymentMethod === "CASH_ON_DELIVERY";
  const track = trackingId ?? orderGroupId.slice(0, 8).toUpperCase();

  console.log(
    `[checkoutNotifications] Dispatching for order ${orderGroupId}` +
    ` — kind: ${isCOD ? "COD" : "ONLINE"}`
  );

  /* Fetch address once */
  const address = await fetchAddress(addressId);

  /* Compute delivery window once */
  const deliveryWindow = getDeliveryWindow();

  /* Flatten all items for buyer email */
  const allItems = orders.flatMap((o) =>
    (o.items ?? []).map((item) => ({
      name    : item.name,
      qty     : item.qty,
      price   : item.price,
      image   : item.image,
      variant : item.variant?.name ?? null,
      sku     : item.variant?.sku  ?? null,
    }))
  );

  const jobs = [];

  /* ══ BUYER EMAIL ══ */
  if (user.email) {
    jobs.push(
      sendBuyerOrderEmail({
        to              : user.email,
        buyerName       : user.name,
        orderId         : orderGroupId,
        trackingId      : track,
        items           : allItems,
        subtotal,
        deliveryFee,
        discount,
        couponCode,
        grandTotal,
        isCOD,
        freeShipping,
        paymentReference,
        address,
        deliveryWindow,
      })
    );
  }

  /* ══ BUYER IN-APP ══ */
  jobs.push(
    createInAppNotification({
      userId : user.id,
      type   : isCOD ? "order_placed" : "payment_received",
      title  : isCOD ? "Order Placed" : "Payment Confirmed",
      message: isCOD
        ? `Your order ${track} is confirmed. Pay ${fmtAmount(grandTotal)} on delivery.`
        : `We received your payment of ${fmtAmount(grandTotal)} for order ${track}.`,
      link   : `/shop/orders/${orderGroupId}`,
      meta   : {
        orderGroupId,
        trackingId : track,
        amount     : Number(grandTotal),
        isCOD,
      },
    })
  );

  /* ══ SELLER EMAIL + IN-APP (per seller) ══ */
  for (const subOrder of orders) {
    const seller = await fetchSellerContact(subOrder.sellerId);

    /* Seller email */
    if (seller?.email) {
      jobs.push(
        sendSellerOrderEmail({
          to        : seller.email,
          sellerName: seller.name,
          buyerName : user.name,
          orderId   : subOrder.orderId,
          trackingId: track,
          items     : (subOrder.items ?? []).map((item) => ({
            name    : item.name,
            qty     : item.qty,
            price   : item.price,
            image   : item.image,
            variant : item.variant?.name ?? null,
            sku     : item.variant?.sku  ?? null,
          })),
          subtotal  : subOrder.subtotal,
          isCOD,
          address,
          deliveryWindow,
        })
      );
    }

    /* Seller in-app */
    jobs.push(
      createInAppNotification({
        userId : subOrder.sellerId,
        type   : "new_order",
        title  : isCOD ? "New COD Order" : "New Paid Order",
        message: `${isCOD ? "Cash on Delivery" : "Paid"} order ${track} — ${fmtAmount(subOrder.subtotal)}`,
        link   : `/seller-dashboard/orders/${subOrder.orderId}`,
        meta   : {
          orderId     : subOrder.orderId,
          orderGroupId,
          trackingId  : track,
          amount      : Number(subOrder.subtotal),
          paymentType : isCOD ? "COD" : "ONLINE",
        },
      })
    );
  }

  /* Run all in parallel — never block on notification failures */
  const results = await Promise.allSettled(jobs);
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed    = results.filter((r) => r.status === "rejected").length;

  console.log(
    `[checkoutNotifications] ✅ ${succeeded} succeeded, ${failed} failed` +
    ` (${orders.length} seller${orders.length === 1 ? "" : "s"})`
  );

  return { succeeded, failed };
}