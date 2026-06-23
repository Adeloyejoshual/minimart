/**
 * services/notifications.js
 * Central notification service — DB insert + future push/WS hook.
 */

import { pool } from "../config/db.js";

/**
 * Create a notification record.
 * Fire-and-forget safe — always resolves, never throws.
 *
 * @param {{ userId, type, title, message, metadata? }} opts
 */
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

    /* Future hook: emit via WebSocket / push service here */
    // socketEmit(userId, "notification", rows[0]);

    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("[notifications] createNotification error:", err.message);
    return null;
  }
};