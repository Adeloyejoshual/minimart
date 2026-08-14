/**
 * services/orderShipNotification.js
 *
 * Triggered when a seller marks an order "shipped".
 * Uses the same Resend + layout system as checkoutNotificationService.js
 *
 * Sends:
 *   1. Email  → Buyer   "Your shipment is on its way"
 *   2. Email  → Seller  "Shipment confirmed — Loemart Express will collect"
 *   3. Email  → Dispatch team (internal alert)
 *   4. In-app → Buyer
 *   5. In-app → Seller
 */

import { pool } from "../config/db.js";

/* ═══════════════════════════════════════════════════════════════
   CONFIG  (mirrors checkoutNotificationService.js)
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
  ship     : "#0EA5E9",
  shipLt   : "#F0F9FF",
  shipBd   : "#BAE6FD",
  shipDk   : "#0369A1",
  shipInk  : "#0C4A6E",
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
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

function fmtDateTime(d = new Date()) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(d));
}

/* ═══════════════════════════════════════════════════════════════
   EMAIL LAYOUT  (identical to checkoutNotificationService.js)
═══════════════════════════════════════════════════════════════ */
function layout({ title, body, preheader }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="color-scheme" content="light"/>
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.bg};
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
             color:${COLOR.ink};">

${preheader
  ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;
                 max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>`
  : ""}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="padding:24px 12px;background:${COLOR.bg};">
  <tr><td align="center">

    <table role="presentation" width="560" cellpadding="0" cellspacing="0"
           style="max-width:560px;width:100%;background:${COLOR.cardBg};
                  border:1px solid ${COLOR.border};border-radius:8px;overflow:hidden;">

      <!-- Brand header -->
      <tr>
        <td style="background:${COLOR.orange};padding:20px 24px;text-align:center;">
          <a href="${APP_URL}" style="text-decoration:none;">
            <span style="color:#fff;font-size:22px;font-weight:800;
                         letter-spacing:0.5px;">${BRAND}</span>
          </a>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:28px 24px 24px;">${body}</td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:${COLOR.soft};padding:20px 24px;
                   border-top:1px solid ${COLOR.borderLt};">
          <p style="margin:0 0 6px;font-size:12px;color:${COLOR.muted};text-align:center;">
            © ${new Date().getFullYear()} ${BRAND}. All rights reserved.
          </p>
          <p style="margin:0 0 8px;font-size:11px;color:${COLOR.faint};text-align:center;">
            Nigeria's Trusted Neighbourhood Marketplace
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:${COLOR.faint};text-align:center;">
            Need help?
            <a href="mailto:${SUPPORT}"
               style="color:${COLOR.orange};text-decoration:none;font-weight:600;">
              ${SUPPORT}
            </a>
          </p>
        </td>
      </tr>
    </table>

    <!-- Sub-footer links -->
    <table role="presentation" width="560" cellpadding="0" cellspacing="0"
           style="max-width:560px;margin-top:16px;">
      <tr>
        <td align="center">
          <p style="margin:0;font-size:11px;color:${COLOR.faint};">
            <a href="${APP_URL}/privacy"
               style="color:${COLOR.faint};text-decoration:none;margin:0 6px;">Privacy</a>
            ·
            <a href="${APP_URL}/terms"
               style="color:${COLOR.faint};text-decoration:none;margin:0 6px;">Terms</a>
            ·
            <a href="${APP_URL}/unsubscribe"
               style="color:${COLOR.faint};text-decoration:none;margin:0 6px;">Unsubscribe</a>
          </p>
        </td>
      </tr>
    </table>

  </td></tr>
</table>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════
   UI BUILDERS  (mirrors checkoutNotificationService.js)
═══════════════════════════════════════════════════════════════ */
const h1 = (t) =>
  `<h1 style="margin:0 0 12px;color:${COLOR.ink};font-size:20px;
              font-weight:800;line-height:1.3;">${t}</h1>`;

const h2 = (t) =>
  `<h2 style="margin:24px 0 10px;color:${COLOR.muted};font-size:12px;
              font-weight:700;text-transform:uppercase;letter-spacing:0.06em;
              padding-bottom:8px;border-bottom:1px solid ${COLOR.borderLt};">${t}</h2>`;

const p = (t) =>
  `<p style="margin:0 0 12px;color:${COLOR.ink2};font-size:14px;
             line-height:1.6;">${t}</p>`;

const sm = (t) =>
  `<p style="margin:16px 0 0;font-size:12px;color:${COLOR.muted};
             line-height:1.5;">${t}</p>`;

const btn = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0"
          style="margin:20px auto;">
    <tr>
      <td align="center"
          style="border-radius:4px;background:${COLOR.orange};">
        <a href="${esc(href)}"
           style="display:inline-block;padding:12px 28px;color:#fff;
                  text-decoration:none;border-radius:4px;
                  font-size:14px;font-weight:700;">
          ${esc(label)}
        </a>
      </td>
    </tr>
  </table>`;

const infoRow = (label, value) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="margin:6px 0;">
    <tr>
      <td style="padding:8px 12px;background:${COLOR.soft};border-radius:4px;">
        <p style="margin:0 0 2px;font-size:11px;color:${COLOR.muted};
                  font-weight:600;text-transform:uppercase;
                  letter-spacing:0.05em;">${esc(label)}</p>
        <p style="margin:0;font-size:14px;color:${COLOR.ink};
                  font-weight:600;word-break:break-word;">${value}</p>
      </td>
    </tr>
  </table>`;

const alertBox = (type, msg) => {
  const m = {
    success: { bg: COLOR.successLt, bd: COLOR.success,  c: COLOR.success   },
    warning: { bg: COLOR.warningLt, bd: COLOR.warning,  c: COLOR.warningInk },
    info   : { bg: COLOR.orangeLt,  bd: COLOR.orange,   c: COLOR.orangeInk  },
    ship   : { bg: COLOR.shipLt,    bd: COLOR.ship,     c: COLOR.shipDk     },
    error  : { bg: COLOR.dangerLt,  bd: COLOR.danger,   c: COLOR.danger     },
  };
  const c = m[type] ?? m.info;
  return `<div style="background:${c.bg};border-left:3px solid ${c.bd};
                      border-radius:3px;padding:12px 16px;margin:16px 0;
                      color:${c.c};font-size:13px;line-height:1.5;">${msg}</div>`;
};

const amountBox = (amt, label, tone = "neutral") => {
  const t = {
    neutral: { bg: COLOR.soft,     bd: COLOR.border,   c: COLOR.ink     },
    success: { bg: COLOR.successLt, bd: COLOR.successBd, c: COLOR.success },
    ship   : { bg: COLOR.shipLt,    bd: COLOR.shipBd,    c: COLOR.shipDk  },
  };
  const c = t[tone] ?? t.neutral;
  return `<div style="background:${c.bg};border:1px solid ${c.bd};
                      border-radius:6px;padding:18px 20px;margin:20px 0;
                      text-align:center;">
    <p style="margin:0 0 4px;color:${COLOR.muted};font-size:11px;
              font-weight:700;text-transform:uppercase;
              letter-spacing:0.08em;">${esc(label)}</p>
    <p style="margin:0;color:${c.c};font-size:28px;font-weight:800;">
      ${fmtAmount(amt)}
    </p>
  </div>`;
};

const stepList = (steps) => {
  if (!steps?.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0"
                 cellspacing="0" style="margin:12px 0;">
    ${steps.map((s, i) => `
    <tr>
      <td style="padding:6px 0;vertical-align:middle;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:24px;height:24px;background:${COLOR.orangeLt};
                       color:${COLOR.orange};border-radius:50%;text-align:center;
                       font-size:12px;font-weight:800;line-height:24px;">
              ${i + 1}
            </td>
            <td style="padding-left:10px;font-size:13px;color:${COLOR.ink2};
                       line-height:1.5;">
              ${esc(s)}
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join("")}
  </table>`;
};

const itemsTable = (items) => {
  if (!items?.length) return "";
  const rows = items.map((i) => `
    <tr style="border-top:1px solid ${COLOR.borderLt};">
      <td style="padding:14px 10px;width:60px;vertical-align:top;">
        ${i.image
          ? `<img src="${safeUrl(i.image)}" alt="${esc(i.name)}"
                  width="52" height="52"
                  style="border-radius:4px;object-fit:cover;display:block;
                         border:1px solid ${COLOR.borderLt};"/>`
          : `<div style="width:52px;height:52px;background:${COLOR.soft};
                         border-radius:4px;text-align:center;line-height:52px;
                         color:${COLOR.faint};font-size:18px;">📦</div>`
        }
      </td>
      <td style="padding:14px 10px;vertical-align:top;">
        <p style="margin:0 0 4px;font-size:13px;color:${COLOR.ink};
                  font-weight:600;line-height:1.35;">${esc(i.name)}</p>
        ${i.variant ? `<p style="margin:0 0 4px;font-size:11px;color:${COLOR.muted};">${esc(i.variant)}</p>` : ""}
        ${i.sku     ? `<p style="margin:0 0 4px;font-size:11px;color:${COLOR.faint};">SKU: ${esc(i.sku)}</p>` : ""}
        <p style="margin:4px 0 0;font-size:12px;color:${COLOR.muted};">
          Qty ${esc(i.qty)} × ${fmtAmount(i.price)}
        </p>
      </td>
      <td style="padding:14px 10px;text-align:right;vertical-align:top;">
        <p style="margin:0;font-size:14px;color:${COLOR.ink};
                  font-weight:700;white-space:nowrap;">
          ${fmtAmount((i.price ?? 0) * (i.qty ?? 1))}
        </p>
      </td>
    </tr>`).join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="border:1px solid ${COLOR.border};border-radius:6px;
                        margin:16px 0;overflow:hidden;">
    <thead>
      <tr style="background:${COLOR.sectionBg};">
        <th colspan="2" style="padding:10px 12px;text-align:left;font-size:11px;
                                color:${COLOR.muted};font-weight:700;
                                text-transform:uppercase;letter-spacing:0.05em;">
          Shipment Items (${items.length})
        </th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;
                   color:${COLOR.muted};font-weight:700;
                   text-transform:uppercase;letter-spacing:0.05em;">
          Amount
        </th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
};

/* ═══════════════════════════════════════════════════════════════
   RESEND SENDER
   Mirrors the fallback in checkoutNotificationService.js exactly.
═══════════════════════════════════════════════════════════════ */
async function sendEmail({ to, subject, html, text }) {
  if (!to) {
    console.warn("[orderShipNotification] sendEmail called with no recipient");
    return null;
  }

  /* Try base notificationService first */
  try {
    const base = await import("./notificationService.js");
    if (typeof base?.sendEmail === "function") {
      return await base.sendEmail({ to, subject, html, text });
    }
  } catch {
    /* base service not available — fall through to direct Resend */
  }

  /* Direct Resend */
  try {
    const { Resend } = await import("resend");
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn("[orderShipNotification] RESEND_API_KEY not set — skipping email");
      return null;
    }

    const resend = new Resend(key);
    const plainText = text
      ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    const { data, error } = await resend.emails.send({
      from   : FROM,
      to,
      subject,
      html,
      text   : plainText,
    });

    if (error) {
      console.warn(`[orderShipNotification] Resend error → ${to}:`, error);
      return null;
    }

    console.log(`[orderShipNotification] ✅ Email sent → ${to} | id: ${data?.id}`);
    return data;

  } catch (err) {
    console.warn(`[orderShipNotification] Email failed → ${to}:`, err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   IN-APP NOTIFICATION
═══════════════════════════════════════════════════════════════ */
async function createInAppNotification({ userId, type, title, message, link, meta }) {
  if (!userId) return null;
  try {
    const base = await import("./notificationService.js");
    if (!base?.createNotification) return null;
    return await base.createNotification({ userId, type, title, message, link, meta });
  } catch (err) {
    console.warn("[orderShipNotification] in-app failed:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   DATA FETCHER
   Single query — gets everything needed for all notifications.
═══════════════════════════════════════════════════════════════ */
async function fetchShipmentData(orderId) {
  const { rows: [row] } = await pool.query(
    `SELECT
       /* Sub-order */
       o.id                AS order_id,
       o.tracking_id,
       o.subtotal,

       /* Parent group */
       og.id               AS order_group_id,
       og.tracking_id      AS parent_tracking_id,
       og.grand_total,
       og.delivery_fee,

       /* Buyer */
       u.id                AS buyer_id,
       u.name              AS buyer_name,
       u.email             AS buyer_email,

       /* Seller */
       s.id                AS seller_id,
       s.name              AS seller_name,
       s.email             AS seller_email,

       /* Delivery address */
       a.recipient_name,
       a.address_line,
       a.bus_stop,
       a.landmark,
       a.city,
       a.state,
       a.phone             AS buyer_phone,

       /* Seller earnings net for this sub-order */
       se.net_amount

     FROM public.orders o
     JOIN public.order_groups          og ON og.id = o.order_group_id
     JOIN market.users                 u  ON u.id  = og.user_id
     JOIN market.users                 s  ON s.id  = o.seller_id
     LEFT JOIN public.user_addresses   a  ON a.id  = og.address_id
     LEFT JOIN public.seller_earnings  se ON se.order_id = o.id
     WHERE o.id = $1`,
    [orderId]
  );
  return row ?? null;
}

async function fetchShipmentItems(orderId) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(oi.quantity, oi.qty,       0) AS qty,
       COALESCE(oi.price,    oi.unit_price, 0) AS price,
       COALESCE(oi.image,    oi.image_url    ) AS image,
       oi.variant_name                         AS variant,
       oi.sku,
       p.name                                  AS name
     FROM public.order_items oi
     LEFT JOIN market.products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
     ORDER BY oi.id`,
    [orderId]
  );
  return rows;
}

/* ═══════════════════════════════════════════════════════════════
   EMAIL — BUYER  "Your shipment is on its way"
═══════════════════════════════════════════════════════════════ */
function buildBuyerShippedEmail({ d, items, orderUrl, shippedAt }) {
  const track  = esc(d.tracking_id);
  const parent = esc(d.parent_tracking_id ?? "");
  const seller = esc(d.seller_name);

  const subject    = `🚚 Your order ${d.tracking_id} has shipped — Loemart Express is on it`;
  const preheader  = `${seller} has packed your order. Loemart Express will deliver it soon.`;

  const html = layout({
    title: "Your Shipment is on its Way",
    preheader,
    body: `
      ${h1("Your shipment is on its way! 🚚")}
      ${p(`Hi <strong>${esc(d.buyer_name ?? "there")}</strong>,`)}
      ${p(`<strong>${seller}</strong> has packed your order and
           it's been handed to <strong>Loemart Express</strong> for delivery.
           Our agent will be at your bus stop soon!`)}

      ${h2("Shipment Details")}
      ${infoRow("Shipment ID", `<span style="font-family:monospace;font-weight:800;
                                             color:${COLOR.shipDk};">${track}</span>`)}
      ${parent && parent !== track
        ? infoRow("Part of Order", `<span style="font-family:monospace;">${parent}</span>`)
        : ""}
      ${infoRow("Packed by",  seller)}
      ${infoRow("Shipped at", fmtDateTime(shippedAt))}
      ${infoRow("Delivered by", "Loemart Express 🚚")}

      ${alertBox("ship",
        `<strong>What's next?</strong> Loemart Express will collect the package
         from the seller and head to your delivery address.
         You'll receive another notification when the agent is on the way.`
      )}

      ${h2("Items in this Shipment")}
      ${itemsTable(items)}

      ${amountBox(d.subtotal, "Shipment Value", "ship")}

      ${h2("What Happens Next")}
      ${stepList([
        "Loemart Express collects from seller",
        "Agent heads to your delivery address",
        "You receive a notification when agent is nearby",
        "Collect and confirm receipt to complete your order",
      ])}

      ${btn(orderUrl, "Track My Order")}

      ${sm(`Questions about your delivery? Contact us at
            <a href="mailto:${SUPPORT}"
               style="color:${COLOR.orange};font-weight:600;">${SUPPORT}</a>`)}
    `,
  });

  return { subject, html };
}

/* ═══════════════════════════════════════════════════════════════
   EMAIL — SELLER  "Shipment confirmed"
═══════════════════════════════════════════════════════════════ */
function buildSellerShippedEmail({ d, items, dashboardUrl, shippedAt }) {
  const track   = esc(d.tracking_id);
  const subject = `✅ Shipment ${d.tracking_id} confirmed — Loemart Express pickup incoming`;
  const preheader = `Your shipment is confirmed. Our agent will collect the package from you shortly.`;

  const html = layout({
    title: "Shipment Confirmed",
    preheader,
    body: `
      ${h1("Shipment Confirmed! ✅")}
      ${p(`Hi <strong>${esc(d.seller_name ?? "there")}</strong>,`)}
      ${p(`You've successfully marked shipment <strong style="font-family:monospace;">
           ${track}</strong> as shipped.
           A <strong>Loemart Express</strong> agent will come to collect
           the package from you shortly.`)}

      ${alertBox("warning",
        `<strong>⏰ Action needed:</strong> Please ensure the package is
         securely packed and clearly labelled with the shipment ID
         <strong style="font-family:monospace;">${track}</strong>
         before the agent arrives.`
      )}

      ${h2("Shipment Summary")}
      ${infoRow("Shipment ID",   `<span style="font-family:monospace;">${track}</span>`)}
      ${infoRow("Buyer",         esc(d.buyer_name ?? "Customer"))}
      ${infoRow("Shipped At",    fmtDateTime(shippedAt))}
      ${infoRow("Order Value",   fmtAmount(d.subtotal))}
      ${infoRow("Your Earnings", `<span style="color:${COLOR.success};font-weight:800;">
                                   ${fmtAmount(d.net_amount ?? d.subtotal)}
                                  </span>
                                  <span style="font-size:11px;color:${COLOR.muted};">
                                   (released after buyer confirms receipt)
                                  </span>`)}

      ${h2("Items")}
      ${itemsTable(items)}

      ${h2("Next Steps")}
      ${stepList([
        "Keep package ready and labelled with shipment ID",
        "Loemart Express agent will collect from you",
        "Agent delivers to the buyer",
        "Buyer confirms receipt → your earnings are released",
      ])}

      ${btn(dashboardUrl, "View in Dashboard")}

      ${sm(`Your earnings of <strong>${fmtAmount(d.net_amount ?? d.subtotal)}</strong>
            will be cleared once the buyer confirms receipt or after
            the 48-hour auto-confirm window.`)}
    `,
  });

  return { subject, html };
}

/* ═══════════════════════════════════════════════════════════════
   EMAIL — DISPATCH TEAM  (internal alert)
═══════════════════════════════════════════════════════════════ */
function buildDispatchAlertEmail({ d, items, adminUrl, shippedAt }) {
  const track  = esc(d.tracking_id);
  const buyer  = [d.recipient_name, d.address_line, d.bus_stop || d.landmark, d.city, d.state]
    .filter(Boolean).join(", ");

  const subject    = `🔔 [Loemart Express] New pickup: ${d.tracking_id} from ${d.seller_name}`;
  const preheader  = `New shipment ready for pickup. Assign an agent.`;

  const html = layout({
    title: "New Pickup Request",
    preheader,
    body: `
      ${h1("New Pickup Request 🔔")}
      ${p("A seller has marked their order as shipped. Please assign a delivery agent.")}

      ${alertBox("warning",
        `<strong>Action required:</strong> Assign an agent to collect
         shipment <strong style="font-family:monospace;">${track}</strong>
         from the seller.`
      )}

      ${h2("Shipment Details")}
      ${infoRow("Shipment ID",   `<span style="font-family:monospace;font-size:16px;
                                               font-weight:900;">${track}</span>`)}
      ${infoRow("Seller",        esc(d.seller_name))}
      ${infoRow("Items",         `${items.length} item(s) — ${fmtAmount(d.subtotal)}`)}
      ${infoRow("Delivery To",   buyer || "See order details")}
      ${infoRow("Shipped At",    fmtDateTime(shippedAt))}

      ${h2("Items")}
      ${itemsTable(items)}

      ${btn(adminUrl, "Assign Agent →")}

      ${sm("This is an internal Loemart Express dispatch notification.")}
    `,
  });

  return { subject, html };
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT — sendShipmentNotifications
   ─────────────────────────────────────────────────────────────
   Called by routes/seller/order.js after PATCH /:orderId/status
   when newStatus === "shipped".  Fire-and-forget.

   @param {string} orderId        — public.orders.id (sub-order)
   @param {string} orderGroupId   — public.order_groups.id
   @param {string} sellerId       — seller user id
   @param {Date}   [shippedAt]    — timestamp of shipment
═══════════════════════════════════════════════════════════════ */
export async function sendShipmentNotifications({
  orderId,
  orderGroupId,
  sellerId,
  shippedAt = new Date(),
}) {
  console.log(`[orderShipNotification] Starting for order=${orderId}`);

  /* ── 1. Fetch data ── */
  let d, items;
  try {
    [d, items] = await Promise.all([
      fetchShipmentData(orderId),
      fetchShipmentItems(orderId),
    ]);
    if (!d) {
      console.warn(`[orderShipNotification] No data for orderId=${orderId}`);
      return;
    }
  } catch (err) {
    console.error("[orderShipNotification] DB fetch failed:", err.message);
    return;
  }

  /* ── 2. Build URLs ── */
  const origin         = process.env.CLIENT_ORIGIN
    ?? process.env.APP_URL
    ?? "https://www.loemart.com";

  const buyerOrderUrl  = `${origin}/shop/orders/${d.parent_tracking_id ?? orderGroupId}`;
  const sellerDashUrl  = `${origin}/seller/orders/${d.tracking_id ?? orderId}`;
  const adminDashUrl   = `${origin}/admin/orders/${d.tracking_id ?? orderId}/dispatch`;
  const dispatchEmail  = process.env.DISPATCH_EMAIL ?? process.env.ADMIN_EMAIL;

  /* ── 3. Build + send all notifications concurrently ── */
  const jobs = [];

  /* EMAIL → Buyer */
  if (d.buyer_email) {
    const { subject, html } = buildBuyerShippedEmail({
      d, items, orderUrl: buyerOrderUrl, shippedAt,
    });
    jobs.push(
      sendEmail({ to: d.buyer_email, subject, html })
        .then(() => console.log(`[orderShipNotification] ✓ Buyer email → ${d.buyer_email}`))
        .catch((err) => console.warn("[orderShipNotification] Buyer email failed:", err.message))
    );
  }

  /* EMAIL → Seller */
  if (d.seller_email) {
    const { subject, html } = buildSellerShippedEmail({
      d, items, dashboardUrl: sellerDashUrl, shippedAt,
    });
    jobs.push(
      sendEmail({ to: d.seller_email, subject, html })
        .then(() => console.log(`[orderShipNotification] ✓ Seller email → ${d.seller_email}`))
        .catch((err) => console.warn("[orderShipNotification] Seller email failed:", err.message))
    );
  }

  /* EMAIL → Dispatch team */
  if (dispatchEmail) {
    const { subject, html } = buildDispatchAlertEmail({
      d, items, adminUrl: adminDashUrl, shippedAt,
    });
    jobs.push(
      sendEmail({ to: dispatchEmail, subject, html })
        .then(() => console.log(`[orderShipNotification] ✓ Dispatch alert → ${dispatchEmail}`))
        .catch((err) => console.warn("[orderShipNotification] Dispatch email failed:", err.message))
    );
  }

  /* IN-APP → Buyer */
  if (d.buyer_id) {
    jobs.push(
      createInAppNotification({
        userId : d.buyer_id,
        type   : "order_shipped",
        title  : "Your order is on its way! 🚚",
        message: `Shipment ${d.tracking_id} from ${d.seller_name} has been handed to Loemart Express.`,
        link   : buyerOrderUrl,
        meta   : {
          orderId,
          orderGroupId,
          trackingId      : d.tracking_id,
          parentTrackingId: d.parent_tracking_id,
          status          : "shipped",
          sellerId        : d.seller_id,
        },
      }).then(() => console.log(`[orderShipNotification] ✓ In-app → buyer=${d.buyer_id}`))
        .catch((err) => console.warn("[orderShipNotification] Buyer in-app failed:", err.message))
    );
  }

  /* IN-APP → Seller */
  if (sellerId) {
    jobs.push(
      createInAppNotification({
        userId : sellerId,
        type   : "shipment_confirmed",
        title  : "Shipment confirmed ✅",
        message: `Your shipment ${d.tracking_id} is confirmed. Loemart Express will collect it shortly.`,
        link   : sellerDashUrl,
        meta   : {
          orderId,
          orderGroupId,
          trackingId: d.tracking_id,
          status    : "shipped",
        },
      }).then(() => console.log(`[orderShipNotification] ✓ In-app → seller=${sellerId}`))
        .catch((err) => console.warn("[orderShipNotification] Seller in-app failed:", err.message))
    );
  }

  const results = await Promise.allSettled(jobs);
  const ok      = results.filter((r) => r.status === "fulfilled").length;
  const fail    = results.filter((r) => r.status === "rejected").length;

  console.log(
    `[orderShipNotification] ✅ Done for ${d.tracking_id}`,
    `| ${ok} ok | ${fail} failed`
  );
}