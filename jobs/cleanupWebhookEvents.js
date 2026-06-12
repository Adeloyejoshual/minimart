// server/jobs/cleanupWebhookEvents.js

import { pool } from "../server.js";

// ═════════════════════════════════════════════════════════════
// CLEANUP WEBHOOK EVENTS
//
// Deletes processed webhook events older than DAYS.
// Keeps unprocessed events indefinitely for debugging.
// ═════════════════════════════════════════════════════════════

const RETENTION_DAYS = parseInt(
  process.env.WEBHOOK_RETENTION_DAYS ?? "30"
);

export async function cleanupWebhookEvents() {
  const { rowCount } = await pool.query(
    `DELETE FROM public.webhook_events
     WHERE  processed  = TRUE
       AND  created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`
  );

  return { deleted: rowCount };
}