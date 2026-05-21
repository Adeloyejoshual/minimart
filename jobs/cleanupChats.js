import cron   from "node-cron";
import { pool } from "../server.js";

/**
 * Runs daily at 03:00
 * - Hard-deletes messages from chats deleted 90+ days ago (not under review)
 * - Hard-deletes those conversation rows when both sides deleted
 * - Reported chats are skipped (is_under_review = true)
 */
export function startChatCleanupJob() {
  cron.schedule("0 3 * * *", async () => {
    const client = await pool.connect();
    console.log("[cron] chat cleanup started");

    try {
      await client.query("BEGIN");

      /* 1. Delete messages from single-side deleted threads (90 days old) */
      const { rowCount: msgCount } = await client.query(`
        DELETE FROM public.chat_messages
        WHERE conversation_id IN (
          SELECT id FROM public.chat_threads
          WHERE is_under_review = false
            AND (
              (deleted_by_buyer  = true AND deleted_at_buyer  < NOW() - INTERVAL '90 days')
              OR
              (deleted_by_seller = true AND deleted_at_seller < NOW() - INTERVAL '90 days')
            )
        )
        AND deleted = true
      `);

      /* 2. Delete conversation rows only when BOTH sides deleted 90+ days ago */
      const { rowCount: convCount } = await client.query(`
        DELETE FROM public.chat_threads
        WHERE is_under_review  = false
          AND deleted_by_buyer  = true
          AND deleted_by_seller = true
          AND deleted_at_buyer  < NOW() - INTERVAL '90 days'
          AND deleted_at_seller < NOW() - INTERVAL '90 days'
      `);

      await client.query("COMMIT");

      console.log(
        `[cron] cleanup done — messages: ${msgCount}, convs: ${convCount}`
      );
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[cron] cleanup failed:", err.message);
    } finally {
      client.release();
    }
  });

  console.log("[cron] chat cleanup job registered (daily 03:00)");
}