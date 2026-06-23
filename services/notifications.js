/**
 * services/notifications.js
 */

import { pool } from "../config/db.js";

export const createNotification = async ({
  userId,
  type     = "general",
  title,
  message,
  metadata = null,
}) => {
  if (!userId || !title || !message) {
    console.warn("[notifications] createNotification: missing required fields");
    return null;
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications
         (user_id, type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, type, title, message, metadata ? JSON.stringify(metadata) : null]
    );
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("[notifications] createNotification error:", err.message);
    return null;
  }
};

/**
 * Alias — accepted by all existing job files that import sendNotification.
 * userType and client are accepted for compatibility but ignored.
 */
export const sendNotification = async ({
  userId,
  type     = "general",
  title,
  message,
  metadata = null,
  userType,   // ignored
  client,     // ignored — always uses pool directly
} = {}) => {
  return createNotification({ userId, type, title, message, metadata });
};

/**
 * Deduplicated payment notification.
 * Only inserts if no matching (userId, type, payment_id) row exists.
 */
export const sendPaymentNotification = async ({
  userId,
  type,
  title,
  message,
  paymentId,
}) => {
  if (!userId || !title || !message) return null;
  try {
    await pool.query(
      `INSERT INTO notifications
         (user_id, type, title, message, metadata)
       SELECT $1, $2, $3, $4, $5
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE  user_id                 = $1
           AND  type                   = $2
           AND  metadata->>'payment_id' = $6
       )`,
      [
        userId, type, title, message,
        JSON.stringify({ payment_id: String(paymentId) }),
        String(paymentId),
      ]
    );
  } catch (err) {
    console.error("[notifications] sendPaymentNotification error:", err.message);
  }
};