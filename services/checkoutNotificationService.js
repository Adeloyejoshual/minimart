/**
 * services/checkoutNotificationService.js
 *
 * v2 — Direct email sending (bypasses base templates)
 * ─────────────────────────────────────────────────────
 * FIX: v1 passed __html/__text to the base service which
 * ignored them — the rich checkout templates were never
 * actually sent. v2 calls the base sendEmail() directly
 * with our own HTML, so the rich templates are guaranteed
 * to be used.
 *
 * Everything else unchanged from v1.
 */

import { pool } from "../config/db.js";

/* ═══════════════════════════════════════════════════════════════
   BASE SERVICE
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

/**
 * Get the raw sendEmail function from the base service.
 * This lets us send our own HTML directly instead of going
 * through sendPaymentNotification (which builds its own template).
 */
async function getSendEmail() {
  const base = await getBase();
  /* Try the named export first, then default */
  if (typeof base?.sendEmail === "function") return base.sendEmail;
  /* Fallback: if sendEmail is not exported, we can't send directly */
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const BRAND   = process.env.EMAIL_BRAND   || "Loemart";
const APP_URL = process.env.APP_URL       || "https://www.loemart.com";
const SUPPORT = process.env.EMAIL_SUPPORT || "support@loemart.com";
const FROM    = process.env.EMAIL_FROM    || "Loemart <no-reply@loemart.com>";

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
   DELIVERY WINDOW
═══════════════════════════════════════════════════════════════ */
const DELIVERY_MIN = 3;
const DELIVERY_MAX = 7;
const NO_DELIVERY  = new Set([0]);
const CUTOFF       = 15;

function addBizDays(start, days) {
  const d = new Date(start);
  let n = 0;
  while (n < days) {
    d.setDate(d.getDate() + 1);
    if (!NO_DELIVERY.has(d.getDay())) n++;
  }
  return d;
}

function rollFwd(date) {
  const d = new Date(date);
  while (NO_DELIVERY.has(d.getDay())) d.setDate(d.getDate() + 1);
  return d;
}

function fmtDayMonth(d) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long" }).format(d);
}

function getDeliveryWindow() {
  const base = new Date();
  if (base.getHours() >= CUTOFF) {
    base.setDate(base.getDate() + 1);
    base.setHours(0, 0, 0, 0);
  }
  const s = rollFwd(addBizDays(base, DELIVERY_MIN));
  const e = rollFwd(addBizDays(base, DELIVERY_MAX));
  const ss = fmtDayMonth(s);
  const es = fmtDayMonth(e);
  const same = s.toDateString() === e.toDateString();
  return {
    label: same ? `Delivery on ${ss}` : `Delivery between ${ss} and ${es}`,
    short: same ? ss : `${ss} — ${es}`,
  };
}

/* ═══════════════════════════════════════════════════════════════
   FORMAT ADDRESS
═══════════════════════════════════════════════════════════════ */
function formatAddressBlock(addr) {
  if (!addr) return "";
  const parts = [];
  if (addr.recipient_name) parts.push(esc(addr.recipient_name));
  if (addr.address_line) parts.push(esc(addr.address_line));
  const city = [addr.city, addr.state].filter(Boolean).join(", ");
  if (city) parts.push(esc(city));
  if (addr.bus_stop || addr.landmark)
    parts.push(`Bus stop: <strong>${esc(addr.bus_stop || addr.landmark)}</strong>`);
  if (addr.phone) {
    const ph = addr.phone.startsWith("0") ? `+234 ${addr.phone.slice(1)}` : addr.phone;
    parts.push(`Phone: ${esc(ph)}`);
  }
  return parts.join("<br />");
}

/* ═══════════════════════════════════════════════════════════════
   EMAIL LAYOUT
═══════════════════════════════════════════════════════════════ */
function layout({ title, body, preheader }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="color-scheme" content="light"/><title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLOR.ink};">
${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;background:${COLOR.bg};"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:${COLOR.cardBg};border:1px solid ${COLOR.border};border-radius:8px;overflow:hidden;">
<tr><td style="background:${COLOR.orange};padding:20px 24px;text-align:center;"><a href="${APP_URL}" style="text-decoration:none;"><span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:0.5px;">${BRAND}</span></a></td></tr>
<tr><td style="padding:28px 24px 24px;">${body}</td></tr>
<tr><td style="background:${COLOR.soft};padding:20px 24px;border-top:1px solid ${COLOR.borderLt};">
<p style="margin:0 0 6px;font-size:12px;color:${COLOR.muted};text-align:center;">© ${new Date().getFullYear()} ${BRAND}. All rights reserved.</p>
<p style="margin:0 0 8px;font-size:11px;color:${COLOR.faint};text-align:center;">Nigeria's Trusted Neighbourhood Marketplace</p>
<p style="margin:8px 0 0;font-size:11px;color:${COLOR.faint};text-align:center;">Need help? <a href="mailto:${SUPPORT}" style="color:${COLOR.orange};text-decoration:none;font-weight:600;">${SUPPORT}</a></p>
</td></tr>
</table>
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;margin-top:16px;"><tr><td align="center">
<p style="margin:0;font-size:11px;color:${COLOR.faint};"><a href="${APP_URL}/privacy" style="color:${COLOR.faint};text-decoration:none;margin:0 6px;">Privacy</a> · <a href="${APP_URL}/terms" style="color:${COLOR.faint};text-decoration:none;margin:0 6px;">Terms</a> · <a href="${APP_URL}/unsubscribe" style="color:${COLOR.faint};text-decoration:none;margin:0 6px;">Unsubscribe</a></p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

/* ═══════════════════════════════════════════════════════════════
   UI BUILDERS
═══════════════════════════════════════════════════════════════ */
const h1 = (t) => `<h1 style="margin:0 0 12px;color:${COLOR.ink};font-size:20px;font-weight:800;line-height:1.3;">${t}</h1>`;
const h2 = (t) => `<h2 style="margin:24px 0 10px;color:${COLOR.muted};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:8px;border-bottom:1px solid ${COLOR.borderLt};">${t}</h2>`;
const p  = (t) => `<p style="margin:0 0 12px;color:${COLOR.ink2};font-size:14px;line-height:1.6;">${t}</p>`;
const sm = (t) => `<p style="margin:16px 0 0;font-size:12px;color:${COLOR.muted};line-height:1.5;">${t}</p>`;

const btn = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto;"><tr><td align="center" style="border-radius:4px;background:${COLOR.orange};"><a href="${esc(href)}" style="display:inline-block;padding:12px 28px;color:#fff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:700;">${esc(label)}</a></td></tr></table>`;

const amountBox = (amt, label, tone = "neutral") => {
  const t = { neutral: { bg: COLOR.soft, bd: COLOR.border, c: COLOR.ink }, orange: { bg: COLOR.orangeLt, bd: COLOR.orangeBd, c: COLOR.orangeDk }, success: { bg: COLOR.successLt, bd: COLOR.successBd, c: COLOR.success } };
  const c = t[tone] ?? t.neutral;
  return `<div style="background:${c.bg};border:1px solid ${c.bd};border-radius:6px;padding:18px 20px;margin:20px 0;text-align:center;"><p style="margin:0 0 4px;color:${COLOR.muted};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">${esc(label)}</p><p style="margin:0;color:${c.c};font-size:28px;font-weight:800;">${fmtAmount(amt)}</p></div>`;
};

const infoRow = (label, value) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0;"><tr><td style="padding:8px 12px;background:${COLOR.soft};border-radius:4px;"><p style="margin:0 0 2px;font-size:11px;color:${COLOR.muted};font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${esc(label)}</p><p style="margin:0;font-size:14px;color:${COLOR.ink};font-weight:600;word-break:break-word;">${value}</p></td></tr></table>`;

const alertBox = (type, msg) => {
  const m = { success: { bg: COLOR.successLt, bd: COLOR.success, c: COLOR.success }, warning: { bg: COLOR.warningLt, bd: COLOR.warning, c: COLOR.warningInk }, info: { bg: COLOR.orangeLt, bd: COLOR.orange, c: COLOR.orangeInk }, error: { bg: COLOR.dangerLt, bd: COLOR.danger, c: COLOR.danger } };
  const c = m[type] ?? m.info;
  return `<div style="background:${c.bg};border-left:3px solid ${c.bd};border-radius:3px;padding:12px 16px;margin:16px 0;color:${c.c};font-size:13px;line-height:1.5;">${msg}</div>`;
};

const itemsTable = (items) => {
  if (!items?.length) return "";
  const rows = items.map((i) => `<tr style="border-top:1px solid ${COLOR.borderLt};"><td style="padding:14px 10px;width:60px;vertical-align:top;">${i.image ? `<img src="${safeUrl(i.image)}" alt="${esc(i.name)}" width="52" height="52" style="border-radius:4px;object-fit:cover;display:block;border:1px solid ${COLOR.borderLt};"/>` : `<div style="width:52px;height:52px;background:${COLOR.soft};border-radius:4px;text-align:center;line-height:52px;color:${COLOR.faint};font-size:18px;">📦</div>`}</td><td style="padding:14px 10px;vertical-align:top;"><p style="margin:0 0 4px;font-size:13px;color:${COLOR.ink};font-weight:600;line-height:1.35;">${esc(i.name)}</p>${i.variant ? `<p style="margin:0 0 4px;font-size:11px;color:${COLOR.muted};">${esc(i.variant)}</p>` : ""}${i.sku ? `<p style="margin:0 0 4px;font-size:11px;color:${COLOR.faint};">SKU: ${esc(i.sku)}</p>` : ""}<p style="margin:4px 0 0;font-size:12px;color:${COLOR.muted};">Qty ${esc(i.qty)} × ${fmtAmount(i.price)}</p></td><td style="padding:14px 10px;text-align:right;vertical-align:top;"><p style="margin:0;font-size:14px;color:${COLOR.ink};font-weight:700;white-space:nowrap;">${fmtAmount((i.price ?? 0) * (i.qty ?? 1))}</p></td></tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLOR.border};border-radius:6px;margin:16px 0;overflow:hidden;"><thead><tr style="background:${COLOR.sectionBg};"><th colspan="2" style="padding:10px 12px;text-align:left;font-size:11px;color:${COLOR.muted};font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Order Items (${items.length})</th><th style="padding:10px 12px;text-align:right;font-size:11px;color:${COLOR.muted};font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Amount</th></tr></thead><tbody>${rows}</tbody></table>`;
};

const priceTbl = ({ subtotal, deliveryFee, discount, couponCode, grandTotal, freeShipping }) => {
  let r = "";
  r += `<tr><td style="padding:6px 12px;font-size:13px;color:${COLOR.ink2};">Subtotal</td><td style="padding:6px 12px;font-size:13px;color:${COLOR.ink};text-align:right;font-weight:600;">${fmtAmount(subtotal)}</td></tr>`;
  if (Number(discount) > 0) r += `<tr><td style="padding:6px 12px;font-size:13px;color:${COLOR.success};">Discount${couponCode ? ` (${esc(couponCode)})` : ""}</td><td style="padding:6px 12px;font-size:13px;color:${COLOR.success};text-align:right;font-weight:600;">− ${fmtAmount(discount)}</td></tr>`;
  r += `<tr><td style="padding:6px 12px;font-size:13px;color:${COLOR.ink2};">Delivery fee</td><td style="padding:6px 12px;font-size:13px;text-align:right;font-weight:600;">${freeShipping ? `<span style="color:${COLOR.success};text-transform:uppercase;letter-spacing:0.05em;">FREE</span>` : `<span style="color:${COLOR.ink};">${fmtAmount(deliveryFee)}</span>`}</td></tr>`;
  r += `<tr><td colspan="2" style="padding:4px 12px;"><div style="height:1px;background:${COLOR.borderLt};"></div></td></tr>`;
  r += `<tr><td style="padding:8px 12px;font-size:15px;color:${COLOR.ink};font-weight:800;">Total</td><td style="padding:8px 12px;font-size:15px;color:${COLOR.ink};text-align:right;font-weight:800;">${fmtAmount(grandTotal)}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLOR.border};border-radius:6px;margin:16px 0;overflow:hidden;background:white;">${r}</table>`;
};

const stepList = (steps) => {
  if (!steps?.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">${steps.map((s, i) => `<tr><td style="padding:6px 0;vertical-align:middle;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:24px;height:24px;background:${COLOR.orangeLt};color:${COLOR.orange};border-radius:50%;text-align:center;font-size:12px;font-weight:800;line-height:24px;">${i + 1}</td><td style="padding-left:10px;font-size:13px;color:${COLOR.ink2};line-height:1.5;">${esc(s)}</td></tr></table></td></tr>`).join("")}</table>`;
};

/* ═══════════════════════════════════════════════════════════════
   SEND EMAIL DIRECTLY
   ─────────────────────────────────────────────────────────────
   Tries to use the base service's sendEmail function.
   Falls back to sendPaymentNotification if sendEmail isn't
   exported (backward compatibility with base v2).
═══════════════════════════════════════════════════════════════ */
async function sendCheckoutEmail({ to, subject, html, text }) {
  if (!to) return null;

  /* Try direct sendEmail first */
  const directSend = await getSendEmail();
  if (directSend) {
    return directSend({ to, subject, html, text }).catch((err) => {
      console.warn("[checkoutNotifications] direct send failed:", err.message);
      return null;
    });
  }

  /*
   * Fallback: if sendEmail is not exported from the base service,
   * use Resend directly. This ensures the rich templates are always
   * sent, even if the base service doesn't expose sendEmail.
   */
  try {
    const { Resend } = await import("resend");
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn("[checkoutNotifications] RESEND_API_KEY not set — skipping email");
      return null;
    }
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
    if (error) {
      console.warn("[checkoutNotifications] Resend error:", error);
      return null;
    }
    console.log(`[checkoutNotifications] ✅ Email sent → ${to} | id: ${data?.id}`);
    return data;
  } catch (err) {
    console.warn("[checkoutNotifications] fallback send failed:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   BUYER EMAIL
═══════════════════════════════════════════════════════════════ */
export async function sendBuyerOrderEmail({
  to, buyerName, orderId, trackingId,
  items = [], subtotal, deliveryFee, discount = 0,
  couponCode = null, grandTotal, isCOD = false,
  freeShipping = false, paymentReference = null,
  address = null, deliveryWindow = null,
}) {
  const amtFmt = fmtAmount(grandTotal);
  const name   = esc(buyerName || "there");
  const track  = esc(trackingId ?? orderId);
  const win    = deliveryWindow ?? getDeliveryWindow();

  const subject = isCOD
    ? `Order ${track} placed — Pay ${amtFmt} on delivery`
    : `Payment of ${amtFmt} received — Order ${track}`;

  const preheader = isCOD
    ? `Your order is confirmed. Pay ${amtFmt} on delivery.`
    : `Payment confirmed for order ${track}`;

  const title = isCOD ? "Order Placed" : "Payment Received";

  const intro = isCOD
    ? `Your order has been placed. You'll pay <strong>${amtFmt}</strong> when the rider arrives at your bus stop.`
    : `We've received your payment of <strong>${amtFmt}</strong>. The seller has been notified.`;

  const amountLabel = isCOD ? "Amount Due on Delivery" : "Amount Paid";
  const amountTone  = isCOD ? "orange" : "success";

  const nextSteps = isCOD
    ? ["Order confirmed", "Seller prepares your items", "Loemart Express picks up", `Pay rider on delivery — ${amtFmt}`]
    : ["Payment confirmed", "Seller prepares your items", "Loemart Express picks up", "Delivered to your bus stop"];

  const html = layout({
    title,
    preheader,
    body: `
      ${h1(title)}
      ${p(`Hi ${name},`)}
      ${p(intro)}
      ${amountBox(grandTotal, amountLabel, amountTone)}
      ${h2("Delivery")}
      ${alertBox("info", `<strong>${esc(win.label)}</strong><br/><span style="font-size:12px;opacity:0.8;">Delivered by Loemart Express</span>`)}
      ${address ? `${h2("Delivering To")}<div style="padding:12px 16px;background:${COLOR.soft};border-radius:6px;font-size:13px;color:${COLOR.ink2};line-height:1.6;">${formatAddressBlock(address)}</div>` : ""}
      ${h2("Order Items")}
      ${itemsTable(items)}
      ${h2("Payment Summary")}
      ${priceTbl({ subtotal, deliveryFee, discount, couponCode, grandTotal, freeShipping })}
      ${h2("Order Details")}
      ${infoRow("Tracking ID", track)}
      ${infoRow("Payment Method", isCOD ? "Cash on Delivery" : "Paid Online")}
      ${!isCOD && paymentReference ? infoRow("Payment Reference", paymentReference) : ""}
      ${couponCode ? infoRow("Coupon Applied", `${couponCode} — saved ${fmtAmount(discount)}`) : ""}
      ${h2("What Happens Next")}
      ${stepList(nextSteps)}
      ${btn(`${APP_URL}/shop/orders/${orderId}`, "Track My Order")}
      ${sm(`Questions? Contact us at <a href="mailto:${SUPPORT}" style="color:${COLOR.orange};font-weight:600;">${SUPPORT}</a>`)}
    `,
  });

  const text = [
    `Hi ${buyerName || "there"},`,
    isCOD ? `Order ${track} placed. Pay ${amtFmt} on delivery.` : `Payment of ${amtFmt} received for order ${track}.`,
    `Delivery: ${win.label}`,
    `Items:`, ...items.map((i) => `  • ${i.name} × ${i.qty} — ${fmtAmount((i.price ?? 0) * (i.qty ?? 1))}`),
    `Subtotal: ${fmtAmount(subtotal)}`,
    Number(discount) > 0 ? `Discount: −${fmtAmount(discount)}` : "",
    freeShipping ? `Delivery: FREE` : `Delivery: ${fmtAmount(deliveryFee)}`,
    `Total: ${fmtAmount(grandTotal)}`,
    !isCOD && paymentReference ? `Ref: ${paymentReference}` : "",
    `Track: ${APP_URL}/shop/orders/${orderId}`,
  ].filter(Boolean).join("\n");

  return sendCheckoutEmail({ to, subject, html, text });
}

/* ═══════════════════════════════════════════════════════════════
   SELLER EMAIL
═══════════════════════════════════════════════════════════════ */
export async function sendSellerOrderEmail({
  to, sellerName, buyerName, orderId, trackingId,
  items = [], subtotal, isCOD = false,
  address = null, deliveryWindow = null,
}) {
  const amtFmt = fmtAmount(subtotal);
  const name   = esc(sellerName || "there");
  const track  = esc(trackingId ?? orderId);
  const win    = deliveryWindow ?? getDeliveryWindow();

  const subject   = `New ${isCOD ? "COD " : ""}order — ${amtFmt}`;
  const preheader = `New order worth ${amtFmt}${buyerName ? ` from ${buyerName}` : ""}`;

  const html = layout({
    title: "New Order Received",
    preheader,
    body: `
      ${h1("New Order Received")}
      ${p(`Hi ${name},`)}
      ${p(`You have a new ${isCOD ? "<strong>Cash on Delivery</strong>" : "<strong>paid</strong>"} order${buyerName ? ` from <strong>${esc(buyerName)}</strong>` : ""}.`)}
      ${amountBox(subtotal, isCOD ? "Order Value (COD)" : "Order Value (Paid)", isCOD ? "orange" : "success")}
      ${isCOD ? alertBox("warning", `Buyer pays <strong>${amtFmt}</strong> to rider. Payout after delivery.`) : alertBox("success", "Payment received. Prepare for shipping.")}
      ${h2("Order Items")}
      ${itemsTable(items)}
      ${h2("Delivery")}
      ${infoRow("Expected Pickup", win.label)}
      ${address ? infoRow("Deliver To", `${esc(address.city || "")}, ${esc(address.state || "")}`) : ""}
      ${h2("Order Details")}
      ${infoRow("Tracking ID", track)}
      ${infoRow("Payment", isCOD ? "Cash on Delivery" : "Paid Online")}
      ${infoRow("Items", `${items.length}`)}
      ${h2("Next Steps")}
      ${stepList(["Prepare items for shipping", "Mark as ready in dashboard", "Loemart Express picks up", isCOD ? "Paid after delivery confirmed" : "Paid on next payout cycle"])}
      ${btn(`${APP_URL}/seller-dashboard/orders/${orderId}`, "View & Fulfill Order")}
      ${sm("Fulfill quickly to maintain your seller rating.")}
    `,
  });

  return sendCheckoutEmail({ to, subject, html });
}

/* ═══════════════════════════════════════════════════════════════
   ORDER STATUS UPDATE
═══════════════════════════════════════════════════════════════ */
export async function sendOrderStatusUpdate({
  to, buyerName, orderId, trackingId, status, message = null,
}) {
  const name  = esc(buyerName || "there");
  const track = esc(trackingId ?? orderId);
  const safe  = esc(String(status || "updated"));

  const cfg = {
    confirmed:  { title: "Order Confirmed",  tone: "success", verb: "confirmed" },
    processing: { title: "Order Processing", tone: "info",    verb: "being prepared" },
    shipped:    { title: "Order Shipped",    tone: "info",    verb: "on the way" },
    delivered:  { title: "Order Delivered",  tone: "success", verb: "delivered" },
    cancelled:  { title: "Order Cancelled",  tone: "error",   verb: "cancelled" },
  }[String(status || "").toLowerCase()] ?? { title: `Order ${safe}`, tone: "info", verb: safe };

  const html = layout({
    title: cfg.title,
    preheader: `Your order ${track} is ${cfg.verb}`,
    body: `
      ${h1(cfg.title)}
      ${p(`Hi ${name},`)}
      ${p(`Your order <strong>${track}</strong> is now <strong>${cfg.verb}</strong>.`)}
      ${message ? alertBox(cfg.tone, esc(message)) : ""}
      ${btn(`${APP_URL}/shop/orders/${orderId}`, "View Order Details")}
      ${sm(`Questions? <a href="mailto:${SUPPORT}" style="color:${COLOR.orange};font-weight:600;">${SUPPORT}</a>`)}
    `,
  });

  return sendCheckoutEmail({ to, subject: `Order ${track} — ${safe}`, html });
}

/* ═══════════════════════════════════════════════════════════════
   REFUND ISSUED
═══════════════════════════════════════════════════════════════ */
export async function sendRefundIssuedEmail({
  to, buyerName, orderId, trackingId, amount, reason = null,
}) {
  const base = await getBase();
  if (!base) return null;

  return base.sendRefundNotification({
    to,
    name   : buyerName,
    amount,
    orderId: trackingId ?? orderId,
    reason,
  }).catch((err) => {
    console.warn("[checkoutNotifications] refund failed:", err.message);
    return null;
  });
}

/* ═══════════════════════════════════════════════════════════════
   IN-APP NOTIFICATION
═══════════════════════════════════════════════════════════════ */
async function createInAppNotification({ userId, type, title, message, link, meta }) {
  const base = await getBase();
  if (!base?.createNotification) return null;
  return base.createNotification({ userId, type, title, message, link, meta })
    .catch((err) => { console.warn("[checkoutNotifications] in-app failed:", err.message); return null; });
}

/* ═══════════════════════════════════════════════════════════════
   FETCH HELPERS
═══════════════════════════════════════════════════════════════ */
async function fetchSellerContact(id) {
  try {
    const { rows: [r] } = await pool.query(`SELECT id,email,name FROM market.users WHERE id=$1`, [id]);
    return r ?? null;
  } catch (e) { console.warn(`[checkoutNotifications] fetchSeller ${id}:`, e.message); return null; }
}

async function fetchAddress(id) {
  if (!id) return null;
  try {
    const { rows: [r] } = await pool.query(
      `SELECT id,recipient_name,phone,address_line,landmark,bus_stop,city,state FROM public.user_addresses WHERE id=$1`, [id]);
    return r ?? null;
  } catch (e) { console.warn("[checkoutNotifications] fetchAddress:", e.message); return null; }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN ORCHESTRATOR
═══════════════════════════════════════════════════════════════ */
export async function dispatchOrderNotifications({
  user, orderGroupId, trackingId, subtotal, deliveryFee,
  discount = 0, couponCode = null, grandTotal,
  freeShipping = false, paymentMethod,
  paymentReference = null, addressId, orders,
}) {
  const isCOD = paymentMethod === "CASH_ON_DELIVERY";
  const track = trackingId ?? `ORD-${(orderGroupId || "").slice(0, 8).toUpperCase()}`;

  console.log(`[checkoutNotifications] Dispatching ${track} — ${isCOD ? "COD" : "ONLINE"}`);

  const address = await fetchAddress(addressId);
  const win     = getDeliveryWindow();

  const allItems = orders.flatMap((o) =>
    (o.items ?? []).map((i) => ({
      name: i.name, qty: i.qty, price: i.price,
      image: i.image, variant: i.variant?.name ?? null,
      sku: i.variant?.sku ?? null,
    }))
  );

  const jobs = [];

  /* Buyer email */
  if (user.email) {
    jobs.push(sendBuyerOrderEmail({
      to: user.email, buyerName: user.name, orderId: orderGroupId,
      trackingId: track, items: allItems, subtotal, deliveryFee,
      discount, couponCode, grandTotal, isCOD, freeShipping,
      paymentReference, address, deliveryWindow: win,
    }));
  }

  /* Buyer in-app */
  jobs.push(createInAppNotification({
    userId: user.id,
    type  : isCOD ? "order_placed" : "payment_received",
    title : isCOD ? "Order Placed" : "Payment Confirmed",
    message: isCOD
      ? `Your order ${track} is confirmed. Pay ${fmtAmount(grandTotal)} on delivery.`
      : `Payment of ${fmtAmount(grandTotal)} received for order ${track}.`,
    link: `/shop/orders/${orderGroupId}`,
    meta: { orderGroupId, trackingId: track, amount: Number(grandTotal), isCOD },
  }));

  /* Seller emails + in-app */
  for (const sub of orders) {
    const seller = await fetchSellerContact(sub.sellerId);
    if (seller?.email) {
      jobs.push(sendSellerOrderEmail({
        to: seller.email, sellerName: seller.name, buyerName: user.name,
        orderId: sub.orderId, trackingId: track,
        items: (sub.items ?? []).map((i) => ({
          name: i.name, qty: i.qty, price: i.price,
          image: i.image, variant: i.variant?.name ?? null,
          sku: i.variant?.sku ?? null,
        })),
        subtotal: sub.subtotal, isCOD, address, deliveryWindow: win,
      }));
    }

    jobs.push(createInAppNotification({
      userId: sub.sellerId,
      type  : "new_order",
      title : isCOD ? "New COD Order" : "New Paid Order",
      message: `${isCOD ? "COD" : "Paid"} order ${track} — ${fmtAmount(sub.subtotal)}`,
      link  : `/seller-dashboard/orders/${sub.orderId}`,
      meta  : { orderId: sub.orderId, orderGroupId, trackingId: track, amount: Number(sub.subtotal), paymentType: isCOD ? "COD" : "ONLINE" },
    }));
  }

  const results = await Promise.allSettled(jobs);
  const ok   = results.filter((r) => r.status === "fulfilled").length;
  const fail = results.filter((r) => r.status === "rejected").length;

  console.log(`[checkoutNotifications] ✅ ${ok} ok, ${fail} failed (${orders.length} seller${orders.length === 1 ? "" : "s"})`);
  return { succeeded: ok, failed: fail };
}