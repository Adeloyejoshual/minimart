/**
 * jobs/index.js
 *
 * No top-level await import() — prevents circular import deadlock.
 * Route exports are passed in as arguments from server.js.
 */

import cron from "node-cron";
import { expirePromotions }   from "./expirePromotions.js";
import { autoReleaseBalance } from "./autoReleaseBalance.js";

const TZ = "Africa/Lagos";

let _retryFailedTransfers = null;

/* retryFailedTransfers is optional — load it without await at top level */
try {
  const mod = await import("./retryFailedTransfers.js");
  _retryFailedTransfers = mod.retryFailedTransfers ?? mod.default ?? null;
  if (_retryFailedTransfers)
    console.log("[jobs] retryFailedTransfers loaded");
} catch {
  console.warn("[jobs] retryFailedTransfers.js not found — skipping");
}

/**
 * startJobs({ pauseExpired, cleanupStuck })
 *
 * Called from server.js INSIDE the server.listen() callback.
 * pauseExpired and cleanupStuck are passed in from server.js
 * so this file never needs to import from routes/* directly.
 */
export function startJobs({ pauseExpired = null, cleanupStuck = null } = {}) {

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
  if (_retryFailedTransfers) {
    cron.schedule("0,30 * * * *", async () => {
      try { await _retryFailedTransfers(); }
      catch (err) { console.error("[cron] retryFailedTransfers:", err.message); }
    }, { timezone: TZ });
  }

  /* Pause expired limited listings — every hour at :05 */
  if (pauseExpired) {
    cron.schedule("5 * * * *", async () => {
      try {
        const paused = await pauseExpired();
        if (paused?.length > 0)
          console.log(`[cron] pauseExpiredListings: paused ${paused.length}`);
      } catch (err) {
        console.error("[cron] pauseExpiredListings:", err.message);
      }
    }, { timezone: TZ });
  }

  /* Cleanup stuck pending_payment — every 15 minutes at :05 */
  if (cleanupStuck) {
    cron.schedule("5,20,35,50 * * * *", async () => {
      try {
        const reverted = await cleanupStuck();
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

  /* Run startup checks immediately — fire and forget */
  expirePromotions().catch((err) =>
    console.error("[jobs] startup expirePromotions:", err.message)
  );

  if (pauseExpired) {
    pauseExpired().catch((err) =>
      console.error("[jobs] startup pauseExpiredListings:", err.message)
    );
  }

  if (cleanupStuck) {
    cleanupStuck().catch((err) =>
      console.error("[jobs] startup cleanupStuck:", err.message)
    );
  }
}