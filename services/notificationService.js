// server/services/notificationService.js

import { pool }        from "../server.js";
import { sendEmail }   from "./emailService.js";
import * as templates  from "./emailTemplates.js";

// ═════════════════════════════════════════════════════════════
// EMAIL EVENT → TEMPLATE MAP
// ═════════════════════════════════════════════════════════════
const EMAIL_TEMPLATES = {
  // Buyer events
  payment_confirmed: (meta) =>
    templates.orderConfirmedBuyer(meta),
  payment_failed: (meta) =>
    templates.paymentFailedBuyer(meta),
  order_delivered_buyer: (meta) =>
    templates.orderDeliveredBuyer(meta),
  welcome_buyer: (meta) =>
    templates.welcomeBuyer(meta),

  // Seller events
  order_received: (meta) =>
    templates.newOrderSeller(meta),
  payout_sent: (meta) =>
    templates.payoutSentSeller(meta),
  payout_failed: (meta) =>
    templates.payoutFailedSeller(meta),
  withdrawal_approved: (meta) =>
    templates.withdrawalApprovedSeller(meta),
  withdrawal_rejected: (meta) =>
    templates.withdrawalRejectedSeller(meta),
  balance_released: (meta) =>
    templates.balanceReleasedSeller(meta),
  welcome_seller: (meta) =>
    templates.welcomeSeller(meta),

  // Security
  password_changed: (meta) =>
    templates.passwordChanged(meta),
};

// ═════════════════════════════════════════════════════════════
// SEND IN-APP NOTIFICATION + EMAIL
// ═════════════════════════════════════════════════════════════

/**
 * @param {{
 *   userId:    string,
 *   userType:  "buyer" | "seller" | "admin",
 *   type:      string,
 *   title:     string,
 *   message:   string,
 *   channel?:  "in_app" | "email" | "both",
 *   metadata?: object,
 *   client?:   pg.PoolClient,
 * }} params
 */
export const sendNotification = async ({
  userId,
  userType  = "buyer",
  type,
  title,
  message,
  channel   = "in_app",
  metadata  = {},
  client    = pool,
}) => {
  try {
    // ── Admin broadcast ───────────────────────────────────
    if (userType === "admin" && userId === "system") {
      await broadcastToAdmins({
        type, title, message, metadata, client,
      });
      return;
    }

    // ── Save in-app notification ──────────────────────────
    await client.query(
      `INSERT INTO public.notifications
         (user_id, user_type, type, title, message,
          channel, status, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7, NOW())
       ON CONFLICT DO NOTHING`,
      [
        userId,
        userType,
        type,
        title,
        message,
        channel,
        JSON.stringify(metadata),
      ]
    );

    // ── Send email if applicable ──────────────────────────
    await sendEmailForEvent({
      userId,
      userType,
      type,
      metadata,
      client,
    });

  } catch (err) {
    // NEVER throw — notifications must not break payments
    console.error("[Notification] Failed:", {
      userId,
      type,
      error: err.message,
    });
  }
};

// ═════════════════════════════════════════════════════════════
// SEND EMAIL FOR EVENT
// ═════════════════════════════════════════════════════════════
async function sendEmailForEvent({
  userId,
  userType,
  type,
  metadata,
  client,
}) {
  const templateFn = EMAIL_TEMPLATES[type];
  if (!templateFn) return; // no email for this event type

  try {
    // Fetch user email
    const table = userType === "seller"
      ? "market.users"
      : "public.users";

    const { rows } = await client.query(
      `SELECT name, email FROM ${table} WHERE id = $1`,
      [userId]
    );

    if (!rows.length || !rows[0].email) return;

    const { name, email } = rows[0];

    // Build email from template
    const emailData = templateFn({
      ...metadata,
      buyerName:  name,
      sellerName: name,
      storeName:  metadata.store_name ?? name,
    });

    // Send (non-blocking)
    sendEmail({
      to:      email,
      subject: emailData.subject,
      html:    emailData.html,
    }).catch((err) => {
      console.error("[Notification/Email] Send error:", err.message);
    });

  } catch (err) {
    console.error("[Notification/Email] Template error:", err.message);
  }
}

// ═════════════════════════════════════════════════════════════
// ADMIN BROADCAST
// ═════════════════════════════════════════════════════════════
async function broadcastToAdmins({ type, title, message, metadata, client }) {
  try {
    const { rows: admins } = await client.query(
      `SELECT id FROM public.users
       WHERE  role = 'admin' AND status = 'active'`
    );

    for (const admin of admins) {
      await client.query(
        `INSERT INTO public.notifications
           (user_id, user_type, type, title, message,
            channel, status, metadata, created_at)
         VALUES ($1, 'admin', $2, $3, $4,
                 'in_app', 'sent', $5, NOW())`,
        [
          admin.id,
          type,
          title,
          message,
          JSON.stringify(metadata),
        ]
      );
    }
  } catch (err) {
    console.error("[Notification/Admin broadcast]:", err.message);
  }
}

// ═════════════════════════════════════════════════════════════
// STANDALONE EMAIL HELPERS
// Call these directly when you need email without in-app notif
// ═════════════════════════════════════════════════════════════

/**
 * Send welcome email to new seller
 */
export const sendWelcomeEmailSeller = async ({
  email,
  sellerName,
  storeName,
}) => {
  const tpl = templates.welcomeSeller({ sellerName, storeName });
  return sendEmail({
    to:      email,
    subject: tpl.subject,
    html:    tpl.html,
  });
};

/**
 * Send welcome email to new buyer
 */
export const sendWelcomeEmailBuyer = async ({
  email,
  buyerName,
}) => {
  const tpl = templates.welcomeBuyer({ buyerName });
  return sendEmail({
    to:      email,
    subject: tpl.subject,
    html:    tpl.html,
  });
};

/**
 * Send password changed alert
 */
export const sendPasswordChangedEmail = async ({
  email,
  name,
}) => {
  const tpl = templates.passwordChanged({
    name,
    changedAt: new Date(),
  });
  return sendEmail({
    to:      email,
    subject: tpl.subject,
    html:    tpl.html,
  });
};