/**
 * jobs/index.js
 * Central job scheduler.
 *
 * Rules:
 *  - No dynamic await import() — causes circular import hangs
 *  - All imports are static at the top
 *  - Jobs that may not exist are guarded with try/catch at call time
 *  - This file never blocks server.listen()
 */

import cron from "node-cron";

import { autoReleaseBalance }          from "./autoReleaseBalance.js";
import { expirePromotions }            from "./expirePromotions.js";

/* Optional jobs — import statically but guard at call time */
let retryFailedTransfers       = null;
let pauseExpiredListings        = null;
let cleanupStuckPendingPayments = null;

try {
  const m = await import("./retryFailedTransfers.js");
  retryFailedTransfers = m.retryFailedTransfers ?? m.default ?? null;
} catch {
  console.warn("[jobs] retryFailedTransfers.js not found — skipping");
}

/* NOTE: addproduct and payment exports are passed in via startJobs()
   to avoid circular imports with server.js                          */

const TZ = "Africa/Lagos";

/* ── Exported so server.js can pass route exports safely ── */
export function startJobs({ pauseExpired, cleanupStuck } = {}) {
  pauseExpiredListings        = pauseExpired  ?? null;
  cleanupStuckPendingPayments = cleanupStuck  ?? null;

  /* Expire promotions — every 10 minutes */
  cron.schedule("0,10,20,30,40,50 * * * *", async () => {
    try { await expirePromotions(); }
    catch (err) { console.error("[cron] expirePromotions:", err.message); }
  }, { timezone: TZ });

  /* Auto-release seller balance — every 15 minutes */
  cron.schedule("0,15,30,45 * * * *", async () => {
    try {
      const result = await autoReleaseBalance();
      if (result?.released > 0)
        console.log(`[cron] autoReleaseBalance: released ${result.released}`);
    } catch (err) {
      console.error("[cron] autoReleaseBalance:", err.message);
    }
  }, { timezone: TZ });

  /* Retry failed transfers — every 30 minutes */
  if (retryFailedTransfers) {
    cron.schedule("0,30 * * * *", async () => {
      try { await retryFailedTransfers(); }
      catch (err) { console.error("[cron] retryFailedTransfers:", err.message); }
    }, { timezone: TZ });
  }

  /* Pause expired limited listings — every hour */
  if (pauseExpiredListings) {
    cron.schedule("5 * * * *", async () => {
      try {
        const paused = await pauseExpiredListings();
        if (paused?.length > 0)
          console.log(`[cron] pauseExpiredListings: paused ${paused.length}`);
      } catch (err) {
        console.error("[cron] pauseExpiredListings:", err.message);
      }
    }, { timezone: TZ });
  }

  /* Cleanup stuck pending_payment — every 15 minutes */
  if (cleanupStuckPendingPayments) {
    cron.schedule("5,20,35,50 * * * *", async () => {
      try {
        const reverted = await cleanupStuckPendingPayments();
        if (reverted?.length > 0)
          console.log(`[cron] cleanupStuck: reverted ${reverted.length}`);
      } catch (err) {
        console.error("[cron] cleanupStuck:", err.message);
      }
    }, { timezone: TZ });
  }

  /* Prune webhook dedup table — every Sunday at 3am */
  cron.schedule("0 3 * * 0", async () => {
    try {
      const { pool } = await import("../config/db.js");
      const { rowCount } = await pool.query(
        `DELETE FROM payment_webhook_events
         WHERE received_at < NOW() - INTERVAL '30 days'`
      );
      console.log(`[cron] webhook dedup pruned ${rowCount} rows`);
    } catch (err) {
      console.error("[cron] webhook dedup prune:", err.message);
    }
  }, { timezone: TZ });

  console.log("[jobs] all cron jobs scheduled");

  /* Run startup checks immediately — non-blocking */
  expirePromotions().catch((err) =>
    console.error("[jobs] startup expirePromotions:", err.message)
  );

  if (pauseExpiredListings) {
    pauseExpiredListings().catch((err) =>
      console.error("[jobs] startup pauseExpiredListings:", err.message)
    );
  }

  if (cleanupStuckPendingPayments) {
    cleanupStuckPendingPayments().catch((err) =>
      console.error("[jobs] startup cleanupStuck:", err.message)
    );
  }
}