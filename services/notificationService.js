/**
 * services/notifications.js
 * Central notification service — DB insert + future push/WS hook.
 *
 * Exports:
 *   createNotification({ userId, type, title, message, metadata })
 *   sendNotification({ userId, userType, type, title, message, metadata, client })
 *
 * sendNotification is an alias for createNotification with a compatible
 * signature so existing files that import it continue to work unchanged.
 */

import { pool } from "../config/db.js";

/**
 * Create a notification record.
 * Fire-and-forget safe — always resolves, never throws.
 *
 * @param {{ userId, type, title, message, metadata? }} opts
 * @returns {Promise<string|null>} notification id or null
 */
export const createNotification = async ({
  userId,
  type     = "general",
  title,
  message,
  metadata = null,
}) => {
  if (!userId || !title || !message) {
    console.warn(
      "[notifications] createNotification: missing required fields",
      { userId: !!userId, title: !!title, message: !!message }
    );
    return null;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications
         (user_id, type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        userId,
        type,
        title,
        message,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    /* Future hook: emit via WebSocket / push service here */
    // socketEmit(userId, "notification", rows[0]);

    return rows[0]?.id ?? null;

  } catch (err) {
    console.error("[notifications] createNotification error:", err.message);
    return null;
  }
};

/**
 * sendNotification — drop-in compatible alias for createNotification.
 *
 * Accepts the broader signature used by older service files:
 *   { userId, userType, type, title, message, metadata, client }
 *
 * Extra fields (userType, client) are accepted but ignored —
 * notifications always use the shared pool, never a transaction client,
 * because they must not roll back if the parent transaction fails.
 *
 * @param {{
 *   userId    : string,
 *   userType ?: string,   — accepted, ignored (buyer|seller|admin)
 *   type     ?: string,
 *   title     : string,
 *   message   : string,
 *   metadata ?: object,
 *   client   ?: object,   — accepted, ignored
 * }} opts
 * @returns {Promise<string|null>}
 */
export const sendNotification = async ({
  userId,
  type     = "general",
  title,
  message,
  metadata = null,
  /* eslint-disable no-unused-vars */
  userType,   // accepted for compatibility — not used
  client,     // accepted for compatibility — not used
  /* eslint-enable no-unused-vars */
}) => {
  return createNotification({ userId, type, title, message, metadata });
};

/**
 * sendPaymentNotification — deduplicated payment notification.
 * Inserts only if no row exists for (userId, type, payment_id).
 * Prevents webhook + verify both firing "Payment Confirmed".
 *
 * @param {{ userId, type, title, message, paymentId }} opts
 */
export const sendPaymentNotification = async ({
  userId,
  type,
  title,
  message,
  paymentId,
}) => {
  if (!userId || !title || !message) {
    console.warn("[notifications] sendPaymentNotification: missing fields");
    return null;
  }

  try {
    await pool.query(
      `INSERT INTO notifications
         (user_id, type, title, message, metadata)
       SELECT $1, $2, $3, $4, $5
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE  user_id              = $1
           AND  type                 = $2
           AND  metadata->>'payment_id' = $6
       )`,
      [
        userId,
        type,
        title,
        message,
        JSON.stringify({ payment_id: String(paymentId) }),
        String(paymentId),
      ]
    );
  } catch (err) {
    console.error(
      "[notifications] sendPaymentNotification error:", err.message
    );
  }
};