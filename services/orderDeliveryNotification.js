/**
 * services/orderDeliveryNotification.js
 *
 * Covers the full Loemart Express delivery pipeline:
 *
 *   sendOutForDeliveryNotifications()  — admin dispatches agent
 *   sendDeliveredNotifications()       — agent confirms drop-off
 *   sendReceivedNotifications()        — buyer confirms / auto 48h
 *   sendFailedDeliveryNotifications()  — agent couldn't deliver
 *
 * Uses the same Resend + layout system as checkoutNotificationService.js
 */

import { pool } from "../config/db.js";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const BRAND   = process.env.EMAIL_BRAND   || "Loemart";
const APP_URL = process.env.APP_URL       || "https://www.loemart.com";
const SUPPORT = process.env.EMAIL_SUPPORT || "support@loemart.com";
const FROM    = process.env.EMAIL_FROM    || "Loemart <no-reply@loemart.com>";

const COLOR = {
  orange    : "#F68B1E",
  orangeDk  : "#E07A10",
  orangeLt  : "#FFF5EB",
  orangeBd  : "#FFD6B3",
  orangeInk : "#9A3412",
  ink       : "#1A1A1A",
  ink2      : "#4A4A4A",
  muted     : "#6A6A6A",
  faint     : "#B8B8B8",
  bg        : "#F5F5F5",
  cardBg    : "#FFFFFF",
  sectionBg : "#EDEDED",
  soft      : "#F7F7F7",
  border    : "#E5E5E5",
  borderLt  : "#F0F0F0",
  success   : "#16A34A",
  successLt : "#ECFDF5",
  successBd : "#BBF7D0",
  danger    : "#DC2626",
  dangerLt  : "#FEF2F2",
  dangerBd  : "#FECACA",
  warning   : "#F59E0B",
  warningLt : "#FEF3C7",
  warningBd : "#FDE68A",
  warningInk: "#92400E",
  ship      : "#0EA5E9",
  shipLt    : "#F0F9FF",
  shipBd    : "#BAE6FD",
  shipDk    : "#0369A1",
  shipInk   : "#0C4A6E",
  purple    : "#7C3AED",
  purpleLt  : "#F5F3FF",
  purpleBd  : "#DDD6FE",
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

function fmtDateOnly(d = new Date()) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric", month: "long", year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(d));
}

/* ═══════════════════════════════════════════════════════════════
   LAYOUT  (identical to checkoutNotificationService.js)
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

      <tr>
        <td style="background:${COLOR.orange};padding:20px 24px;text-align:center;">
          <a href="${APP_URL}" style="text-decoration:none;">
            <span style="color:#fff;font-size:22px;font-weight:800;
                         letter-spacing:0.5px;">${BRAND}</span>
          </a>
        </td>
      </tr>

      <tr>
        <td style="padding:28px 24px 24px;">${body}</td>
      </tr>

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
   UI BUILDERS
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

const btn = (href, label, color = COLOR.orange) =>
  `<table role="presentation" cellpadding="0" cellspacing="0"
          style="margin:20px auto;">
    <tr>
      <td align="center" style="border-radius:4px;background:${color};">
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
    success: { bg: COLOR.successLt, bd: COLOR.success,  c: COLOR.success    },
    warning: { bg: COLOR.warningLt, bd: COLOR.warning,  c: COLOR.warningInk },
    info   : { bg: COLOR.orangeLt,  bd: COLOR.orange,   c: COLOR.orangeInk  },
    ship   : { bg: COLOR.shipLt,    bd: COLOR.ship,     c: COLOR.shipDk     },
    error  : { bg: COLOR.dangerLt,  bd: COLOR.danger,   c: COLOR.danger     },
    purple : { bg: COLOR.purpleLt,  bd: COLOR.purpleBd, c: COLOR.purple     },
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
    purple : { bg: COLOR.purpleLt,  bd: COLOR.purpleBd,  c: COLOR.purple  },
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

const stepList = (steps) =>
  `<table role="presentation" width="100%" cellpadding="0"
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
                       line-height:1.5;">${esc(s)}</td>
          </tr>
        </table>
      </td>
    </tr>`).join("")}
  </table>`;

const itemsTable = (items) => {
  if (!items?.length) return "";
  const rows = items.map((i) => `
    <tr style="border-top:1px solid ${COLOR.borderLt};">
      <td style="padding:12px 10px;width:60px;vertical-align:top;">
        ${i.image
          ? `<img src="${safeUrl(i.image)}" alt="${esc(i.name)}"
                  width="52" height="52"
                  style="border-radius:4px;object-fit:cover;display:block;
                         border:1px solid ${COLOR.borderLt};"/>`
          : `<div style="width:52px;height:52px;background:${COLOR.soft};
                         border-radius:4px;text-align:center;line-height:52px;
                         color:${COLOR.faint};font-size:18px;">📦</div>`}
      </td>
      <td style="padding:12px 10px;vertical-align:top;">
        <p style="margin:0 0 3px;font-size:13px;color:${COLOR.ink};
                  font-weight:600;line-height:1.35;">${esc(i.name)}</p>
        ${i.variant ? `<p style="margin:0 0 3px;font-size:11px;color:${COLOR.muted};">${esc(i.variant)}</p>` : ""}
        <p style="margin:3px 0 0;font-size:12px;color:${COLOR.muted};">
          Qty ${esc(i.qty)} × ${fmtAmount(i.price)}
        </p>
      </td>
      <td style="padding:12px 10px;text-align:right;vertical-align:top;">
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
          Items
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
   RESEND SENDER  (same pattern as checkoutNotificationService.js)
═══════════════════════════════════════════════════════════════ */
async function sendEmail({ to, subject, html, text }) {
  if (!to) return null;

  /* Try base notificationService.sendEmail first */
  try {
    const base = await import("./notificationService.js");
    if (typeof base?.sendEmail === "function") {
      return await base.sendEmail({ to, subject, html, text });
    }
  } catch { /* fall through */ }

  /* Direct Resend */
  try {
    const { Resend } = await import("resend");
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn("[deliveryNotification] RESEND_API_KEY not set — skipping");
      return null;
    }

    const resend    = new Resend(key);
    const plainText = text
      ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    const { data, error } = await resend.emails.send({
      from: FROM, to, subject, html, text: plainText,
    });

    if (error) {
      console.warn(`[deliveryNotification] Resend error → ${to}:`, error);
      return null;
    }

    console.log(`[deliveryNotification] ✅ Email sent → ${to} | id: ${data?.id}`);
    return data;

  } catch (err) {
    console.warn(`[deliveryNotification] Email failed → ${to}:`, err.message);
    return null;
  }
}

async function createInAppNotification({ userId, type, title, message, link, meta }) {
  if (!userId) return null;
  try {
    const base = await import("./notificationService.js");
    if (!base?.createNotification) return null;
    return await base.createNotification({ userId, type, title, message, link, meta });
  } catch (err) {
    console.warn("[deliveryNotification] in-app failed:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   DATA FETCHER  (single query for all four functions)
═══════════════════════════════════════════════════════════════ */
async function fetchDeliveryData(orderId) {
  const { rows: [row] } = await pool.query(
    `SELECT
       o.id                AS order_id,
       o.tracking_id,
       o.subtotal,
       o.status,

       og.id               AS order_group_id,
       og.tracking_id      AS parent_tracking_id,

       u.id                AS buyer_id,
       u.name              AS buyer_name,
       u.email             AS buyer_email,

       s.id                AS seller_id,
       s.name              AS seller_name,
       s.email             AS seller_email,

       a.recipient_name,
       a.address_line,
       a.bus_stop,
       a.landmark,
       a.city,
       a.state,
       a.phone             AS buyer_phone,

       se.net_amount,

       d.dispatch_code,
       d.estimated_at,
       d.failure_reason,

       da.name             AS agent_name,
       da.phone            AS agent_phone,

       dc.auto_confirm_at

     FROM public.orders o
     JOIN public.order_groups              og ON og.id   = o.order_group_id
     JOIN market.users                     u  ON u.id    = og.user_id
     JOIN market.users                     s  ON s.id    = o.seller_id
     LEFT JOIN public.user_addresses       a  ON a.id    = og.address_id
     LEFT JOIN public.seller_earnings      se ON se.order_id = o.id
     LEFT JOIN public.order_dispatches     d  ON d.order_id  = o.id
     LEFT JOIN public.delivery_agents      da ON da.id   = d.agent_id
     LEFT JOIN public.delivery_confirmations dc ON dc.order_id = o.id
     WHERE o.id = $1`,
    [orderId]
  );
  return row ?? null;
}

async function fetchItems(orderId) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(oi.quantity, oi.qty,       0) AS qty,
       COALESCE(oi.price,    oi.unit_price, 0) AS price,
       COALESCE(oi.image,    oi.image_url    ) AS image,
       oi.variant_name                         AS variant,
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
   SHARED URL BUILDER
═══════════════════════════════════════════════════════════════ */
function buildUrls(d, orderGroupId, orderId) {
  const origin = process.env.CLIENT_ORIGIN
    ?? process.env.APP_URL
    ?? "https://www.loemart.com";
  return {
    buyerOrderUrl  : `${origin}/shop/orders/${d.parent_tracking_id ?? orderGroupId}`,
    sellerDashUrl  : `${origin}/seller/orders/${d.tracking_id ?? orderId}`,
    sellerEarnUrl  : `${origin}/seller/earnings`,
    adminDashUrl   : `${origin}/admin/orders/${d.tracking_id ?? orderId}/dispatch`,
  };
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT 1 — sendOutForDeliveryNotifications
   Called by: routes/admin/delivery.js  POST /:orderId/dispatch
═══════════════════════════════════════════════════════════════ */
export async function sendOutForDeliveryNotifications({ orderId, orderGroupId }) {
  let d;
  try {
    d = await fetchDeliveryData(orderId);
    if (!d) return;
  } catch (err) {
    console.error("[deliveryNotification] OFD fetch failed:", err.message);
    return;
  }

  const { buyerOrderUrl } = buildUrls(d, orderGroupId, orderId);
  const track             = esc(d.tracking_id);
  const agent             = esc(d.agent_name ?? "Loemart Express Agent");
  const buyerAddress      = [
    d.recipient_name, d.address_line, d.bus_stop || d.landmark, d.city, d.state,
  ].filter(Boolean).join(", ");

  /* ── EMAIL → Buyer ── */
  if (d.buyer_email) {
    const html = layout({
      title     : "Agent is on the way!",
      preheader : `Your Loemart Express agent is heading to you now.`,
      body: `
        ${h1("Your agent is on the way! 🏃")}
        ${p(`Hi <strong>${esc(d.buyer_name ?? "there")}</strong>,`)}
        ${p(`Your shipment <strong style="font-family:monospace;">${track}</strong>
             is now <strong>out for delivery</strong>.
             Our Loemart Express agent is heading to your address right now.`)}

        ${h2("Delivery Agent")}
        ${infoRow("Agent Name", agent)}
        ${d.agent_phone
          ? infoRow("Agent Contact",
              `<a href="tel:${esc(d.agent_phone)}"
                  style="color:${COLOR.orange};font-weight:700;">
                ${esc(d.agent_phone)}
              </a>`)
          : ""}
        ${d.estimated_at
          ? infoRow("Estimated Arrival", fmtDateTime(d.estimated_at))
          : ""}
        ${infoRow("Delivering To", esc(buyerAddress) || "Your registered address")}

        ${alertBox("warning",
          `<strong>⚠️ Please be available:</strong>
           Keep your phone on. The agent may call before arriving.
           Ensure someone is at the delivery address.`
        )}

        ${h2("Tips for Smooth Delivery")}
        ${stepList([
          "Keep your phone on — agent may call ahead",
          "Be at your delivery address or have someone there",
          "Have your order ID ready: " + d.tracking_id,
          "Inspect items before signing",
        ])}

        ${btn(buyerOrderUrl, "Track My Order")}

        ${sm(`Issues? Contact us at
              <a href="mailto:${SUPPORT}"
                 style="color:${COLOR.orange};font-weight:600;">${SUPPORT}</a>`)}
      `,
    });

    await sendEmail({
      to     : d.buyer_email,
      subject: `🏃 Your order ${d.tracking_id} is out for delivery — agent on the way`,
      html,
    }).then(() =>
      console.log(`[deliveryNotification] ✓ OFD email → buyer ${d.buyer_email}`)
    ).catch((err) =>
      console.warn("[deliveryNotification] OFD buyer email failed:", err.message)
    );
  }

  /* ── IN-APP → Buyer ── */
  if (d.buyer_id) {
    await createInAppNotification({
      userId : d.buyer_id,
      type   : "order_out_for_delivery",
      title  : "Agent is on the way! 🏃",
      message: `Your shipment ${d.tracking_id} is out for delivery. Agent: ${d.agent_name ?? "Loemart Express"}.`,
      link   : buyerOrderUrl,
      meta   : {
        orderId,
        orderGroupId,
        trackingId: d.tracking_id,
        status    : "out_for_delivery",
        agentName : d.agent_name,
        agentPhone: d.agent_phone,
      },
    }).then(() =>
      console.log(`[deliveryNotification] ✓ OFD in-app → buyer=${d.buyer_id}`)
    ).catch((err) =>
      console.warn("[deliveryNotification] OFD in-app failed:", err.message)
    );
  }

  console.log(`[deliveryNotification] ✅ OFD done for ${d.tracking_id}`);
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT 2 — sendDeliveredNotifications
   Called by: routes/admin/delivery.js  POST /:orderId/delivered
═══════════════════════════════════════════════════════════════ */
export async function sendDeliveredNotifications({ orderId, orderGroupId }) {
  let d, items;
  try {
    [d, items] = await Promise.all([
      fetchDeliveryData(orderId),
      fetchItems(orderId),
    ]);
    if (!d) return;
  } catch (err) {
    console.error("[deliveryNotification] delivered fetch failed:", err.message);
    return;
  }

  const { buyerOrderUrl, sellerDashUrl } = buildUrls(d, orderGroupId, orderId);
  const track      = esc(d.tracking_id);
  const autoDate   = d.auto_confirm_at ? fmtDateOnly(d.auto_confirm_at) : "48 hours from now";

  const jobs = [];

  /* ── EMAIL → Buyer ── */
  if (d.buyer_email) {
    const html = layout({
      title     : "Order Delivered!",
      preheader : `Your order ${d.tracking_id} has been delivered. Please confirm receipt.`,
      body: `
        ${h1("Your order has been delivered! 📦")}
        ${p(`Hi <strong>${esc(d.buyer_name ?? "there")}</strong>,`)}
        ${p(`Great news! Your shipment <strong style="font-family:monospace;">${track}</strong>
             has been delivered by Loemart Express.
             We hope everything arrived perfectly!`)}

        ${h2("Items Delivered")}
        ${itemsTable(items)}
        ${amountBox(d.subtotal, "Order Value", "success")}

        ${alertBox("success",
          `<strong>✅ Please confirm receipt</strong><br/>
           Tap the button below to confirm you received your order.
           If you don't confirm, it will be auto-confirmed on
           <strong>${autoDate}</strong>.`
        )}

        ${btn(buyerOrderUrl, "✅ Confirm I Received It", COLOR.success)}

        ${alertBox("error",
          `<strong>⚠️ Problem with your order?</strong>
           If the package is damaged, missing, or incorrect, please
           <a href="mailto:${SUPPORT}"
              style="color:${COLOR.danger};font-weight:700;">contact support</a>
           immediately — before the auto-confirm window closes on ${autoDate}.`
        )}

        ${sm(`Thank you for shopping on <strong>${BRAND}</strong>!`)}
      `,
    });

    jobs.push(
      sendEmail({
        to     : d.buyer_email,
        subject: `📦 Order ${d.tracking_id} delivered — please confirm receipt`,
        html,
      }).then(() =>
        console.log(`[deliveryNotification] ✓ Delivered email → buyer ${d.buyer_email}`)
      )
    );
  }

  /* ── EMAIL → Seller ── */
  if (d.seller_email) {
    const html = layout({
      title    : "Delivery Successful!",
      preheader: `Shipment ${d.tracking_id} has been delivered. Waiting for buyer confirmation.`,
      body: `
        ${h1("Delivery Successful! 🎉")}
        ${p(`Hi <strong>${esc(d.seller_name ?? "there")}</strong>,`)}
        ${p(`Loemart Express has successfully delivered shipment
             <strong style="font-family:monospace;">${track}</strong>
             to <strong>${esc(d.buyer_name ?? "the buyer")}</strong>.`)}

        ${amountBox(d.net_amount ?? d.subtotal, "Your Earnings (Pending Confirmation)", "purple")}

        ${alertBox("warning",
          `<strong>⏳ Awaiting buyer confirmation</strong><br/>
           Your earnings will be released once the buyer confirms receipt
           or after the 48-hour auto-confirm window closes on
           <strong>${autoDate}</strong>.`
        )}

        ${infoRow("Shipment ID",     `<span style="font-family:monospace;">${track}</span>`)}
        ${infoRow("Buyer",           esc(d.buyer_name ?? "Customer"))}
        ${infoRow("Auto-Confirm At", autoDate)}

        ${btn(sellerDashUrl, "View Order")}

        ${sm("Your rating improves with every successful delivery.")}
      `,
    });

    jobs.push(
      sendEmail({
        to     : d.seller_email,
        subject: `🎉 Delivery successful — ${d.tracking_id} | Earnings pending`,
        html,
      }).then(() =>
        console.log(`[deliveryNotification] ✓ Delivered email → seller ${d.seller_email}`)
      )
    );
  }

  /* ── IN-APP → Buyer ── */
  if (d.buyer_id) {
    jobs.push(
      createInAppNotification({
        userId : d.buyer_id,
        type   : "order_delivered",
        title  : "Order delivered! Confirm receipt ✅",
        message: `Shipment ${d.tracking_id} has been delivered. Please confirm you received it.`,
        link   : buyerOrderUrl,
        meta   : {
          orderId, orderGroupId,
          trackingId   : d.tracking_id,
          autoConfirmAt: d.auto_confirm_at,
          status       : "delivered",
        },
      }).then(() =>
        console.log(`[deliveryNotification] ✓ Delivered in-app → buyer=${d.buyer_id}`)
      )
    );
  }

  /* ── IN-APP → Seller ── */
  if (d.seller_id) {
    jobs.push(
      createInAppNotification({
        userId : d.seller_id,
        type   : "order_delivered",
        title  : "Delivery successful! 🎉",
        message: `Shipment ${d.tracking_id} delivered to ${d.buyer_name ?? "buyer"}. Earnings pending confirmation.`,
        link   : sellerDashUrl,
        meta   : {
          orderId, orderGroupId,
          trackingId: d.tracking_id,
          status    : "delivered",
        },
      }).then(() =>
        console.log(`[deliveryNotification] ✓ Delivered in-app → seller=${d.seller_id}`)
      )
    );
  }

  await Promise.allSettled(jobs);
  console.log(`[deliveryNotification] ✅ Delivered notifications done for ${d.tracking_id}`);
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT 3 — sendReceivedNotifications
   Called by: routes/buyer/receipt.js  OR  jobs/autoConfirm.js
   confirmedBy: 'buyer' | 'system'
═══════════════════════════════════════════════════════════════ */
export async function sendReceivedNotifications({
  orderId,
  orderGroupId,
  confirmedBy = "system",
}) {
  let d;
  try {
    d = await fetchDeliveryData(orderId);
    if (!d) return;
  } catch (err) {
    console.error("[deliveryNotification] received fetch failed:", err.message);
    return;
  }

  const { buyerOrderUrl, sellerEarnUrl } = buildUrls(d, orderGroupId, orderId);
  const track    = esc(d.tracking_id);
  const isAuto   = confirmedBy === "system";
  const isBuyer  = confirmedBy === "buyer";

  const jobs = [];

  /* ── EMAIL → Seller (earnings cleared) ── */
  if (d.seller_email) {
    const html = layout({
      title    : "Earnings Cleared!",
      preheader: isAuto
        ? `${d.tracking_id} auto-confirmed. Your earnings have been cleared.`
        : `${d.buyer_name ?? "Buyer"} confirmed receipt. Your earnings are cleared.`,
      body: `
        ${h1("Earnings Cleared! 💰")}
        ${p(`Hi <strong>${esc(d.seller_name ?? "there")}</strong>,`)}
        ${p(isAuto
          ? `The 48-hour confirmation window for shipment
             <strong style="font-family:monospace;">${track}</strong>
             has passed and the order has been <strong>auto-confirmed</strong>.`
          : `<strong>${esc(d.buyer_name ?? "The buyer")}</strong> has confirmed
             receipt of shipment
             <strong style="font-family:monospace;">${track}</strong>.`
        )}
        ${p("Your earnings have been <strong>cleared</strong> and will be paid out in the next payout cycle.")}

        ${amountBox(d.net_amount ?? d.subtotal, "Amount Cleared", "success")}

        ${alertBox("success",
          `<strong>✅ ${isAuto ? "Auto-confirmed" : "Buyer confirmed"}</strong><br/>
           ${isAuto
             ? "Your order was auto-confirmed after the 48-hour window."
             : "The buyer has confirmed they received their order."}`
        )}

        ${infoRow("Shipment ID",     `<span style="font-family:monospace;">${track}</span>`)}
        ${infoRow("Confirmed By",    isAuto ? "Auto-confirm (48h)" : `${esc(d.buyer_name ?? "Buyer")}`)}
        ${infoRow("Amount Cleared",  fmtAmount(d.net_amount ?? d.subtotal))}

        ${btn(sellerEarnUrl, "View Earnings")}
      `,
    });

    jobs.push(
      sendEmail({
        to     : d.seller_email,
        subject: `💰 Earnings cleared — ${d.tracking_id} | ${isAuto ? "Auto-confirmed" : "Buyer confirmed"}`,
        html,
      }).then(() =>
        console.log(`[deliveryNotification] ✓ Received email → seller ${d.seller_email}`)
      )
    );
  }

  /* ── EMAIL → Buyer (if they manually confirmed — thank you) ── */
  if (isBuyer && d.buyer_email) {
    const html = layout({
      title    : "Order Complete!",
      preheader: `Thank you for confirming! Your order is now complete.`,
      body: `
        ${h1("Order Complete! 🎊")}
        ${p(`Hi <strong>${esc(d.buyer_name ?? "there")}</strong>,`)}
        ${p(`Thank you for confirming receipt of shipment
             <strong style="font-family:monospace;">${track}</strong>.
             Your order is now complete.`)}

        ${alertBox("success",
          `<strong>✅ Receipt confirmed</strong><br/>
           The seller has been notified and their earnings have been released.
           Thank you for shopping on ${BRAND}!`
        )}

        ${btn(buyerOrderUrl, "View Order")}

        ${sm(`We hope you love your purchase! Leave a review to help other shoppers.`)}
      `,
    });

    jobs.push(
      sendEmail({
        to     : d.buyer_email,
        subject: `✅ Order ${d.tracking_id} complete — thank you!`,
        html,
      }).then(() =>
        console.log(`[deliveryNotification] ✓ Received email → buyer ${d.buyer_email}`)
      )
    );
  }

  /* ── IN-APP → Seller ── */
  if (d.seller_id) {
    jobs.push(
      createInAppNotification({
        userId : d.seller_id,
        type   : "earnings_cleared",
        title  : "Earnings cleared! 💰",
        message: isAuto
          ? `${d.tracking_id} auto-confirmed after 48h. Your earnings are cleared.`
          : `${d.buyer_name ?? "Buyer"} confirmed receipt of ${d.tracking_id}. Earnings cleared.`,
        link: sellerEarnUrl,
        meta: { orderId, orderGroupId, trackingId: d.tracking_id, confirmedBy, status: "received" },
      }).then(() =>
        console.log(`[deliveryNotification] ✓ Received in-app → seller=${d.seller_id}`)
      )
    );
  }

  /* ── IN-APP → Buyer (if manually confirmed) ── */
  if (isBuyer && d.buyer_id) {
    jobs.push(
      createInAppNotification({
        userId : d.buyer_id,
        type   : "order_received",
        title  : "Order complete! 🎊",
        message: `You've confirmed receipt of ${d.tracking_id}. Thank you for shopping on ${BRAND}!`,
        link   : buyerOrderUrl,
        meta   : { orderId, orderGroupId, trackingId: d.tracking_id, status: "received" },
      }).then(() =>
        console.log(`[deliveryNotification] ✓ Received in-app → buyer=${d.buyer_id}`)
      )
    );
  }

  await Promise.allSettled(jobs);
  console.log(
    `[deliveryNotification] ✅ Received notifications done for ${d.tracking_id}`,
    `(by ${confirmedBy})`
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT 4 — sendFailedDeliveryNotifications
   Called by: routes/admin/delivery.js  POST /:orderId/failed
═══════════════════════════════════════════════════════════════ */
export async function sendFailedDeliveryNotifications({
  orderId,
  orderGroupId,
  reason,
}) {
  let d;
  try {
    d = await fetchDeliveryData(orderId);
    if (!d) return;
  } catch (err) {
    console.error("[deliveryNotification] failed-delivery fetch failed:", err.message);
    return;
  }

  const { buyerOrderUrl } = buildUrls(d, orderGroupId, orderId);
  const track  = esc(d.tracking_id);
  const agent  = esc(d.agent_name ?? "Loemart Express");
  const whyMsg = reason ?? d.failure_reason ?? "Delivery could not be completed";

  const jobs = [];

  /* ── EMAIL → Buyer ── */
  if (d.buyer_email) {
    const html = layout({
      title    : "Delivery Attempt Unsuccessful",
      preheader: `Our agent couldn't deliver ${d.tracking_id}. We'll try again soon.`,
      body: `
        ${h1("Delivery Attempt Unsuccessful 😔")}
        ${p(`Hi <strong>${esc(d.buyer_name ?? "there")}</strong>,`)}
        ${p(`Our agent <strong>${agent}</strong> attempted to deliver
             your shipment <strong style="font-family:monospace;">${track}</strong>
             but was unable to complete the delivery.`)}

        ${alertBox("error",
          `<strong>Reason:</strong> ${esc(whyMsg)}`
        )}

        ${alertBox("warning",
          `<strong>⏰ What happens next?</strong><br/>
           Loemart Express will schedule a re-delivery attempt.
           Please ensure someone is available at your delivery address.
           If you need to change your delivery schedule, contact our support team.`
        )}

        ${h2("Need Help?")}
        ${stepList([
          "Ensure someone is at your address for the next attempt",
          "Keep your phone on — agent will call before arriving",
          "Contact support if you need to reschedule",
        ])}

        ${btn(buyerOrderUrl, "View Order")}

        <table role="presentation" cellpadding="0" cellspacing="0"
               style="margin:0 auto;">
          <tr>
            <td align="center"
                style="border-radius:4px;border:1px solid ${COLOR.border};">
              <a href="mailto:${SUPPORT}"
                 style="display:inline-block;padding:10px 24px;
                        color:${COLOR.ink2};text-decoration:none;
                        border-radius:4px;font-size:13px;font-weight:600;">
                Contact Support
              </a>
            </td>
          </tr>
        </table>

        ${sm(`We apologise for the inconvenience. We'll get your order to you!`)}
      `,
    });

    jobs.push(
      sendEmail({
        to     : d.buyer_email,
        subject: `⚠️ Delivery attempt failed — ${d.tracking_id} | We'll try again`,
        html,
      }).then(() =>
        console.log(`[deliveryNotification] ✓ Failed email → buyer ${d.buyer_email}`)
      )
    );
  }

  /* ── IN-APP → Buyer ── */
  if (d.buyer_id) {
    jobs.push(
      createInAppNotification({
        userId : d.buyer_id,
        type   : "delivery_failed",
        title  : "Delivery attempt failed ⚠️",
        message: `Our agent couldn't deliver ${d.tracking_id}. We'll try again. Reason: ${whyMsg}`,
        link   : buyerOrderUrl,
        meta   : {
          orderId, orderGroupId,
          trackingId: d.tracking_id,
          reason    : whyMsg,
          status    : "failed_delivery",
        },
      }).then(() =>
        console.log(`[deliveryNotification] ✓ Failed in-app → buyer=${d.buyer_id}`)
      )
    );
  }

  await Promise.allSettled(jobs);
  console.log(`[deliveryNotification] ✅ Failed-delivery notifications done for ${d.tracking_id}`);
}