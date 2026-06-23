/**
 * jobs/index.js
 * Central job scheduler — imported once by server.js
 */

import cron from "node-cron";

const TZ = "Africa/Lagos";

/* ── Import only jobs that exist in your project ── */
import { autoReleaseBalance }        from "./autoReleaseBalance.js";
import { expirePromotions }          from "./expirePromotions.js";

/* ── Conditionally import optional jobs ── */
let retryFailedTransfers = null;
try {
  const mod = await import("./retryFailedTransfers.js");
  retryFailedTransfers = mod.retryFailedTransfers ?? mod.default ?? null;
} catch {
  console.warn("[jobs] retryFailedTransfers.js not found — skipping");
}

let pauseExpiredListings = null;
try {
  const mod = await import("../routes/addproduct.js");
  pauseExpiredListings = mod.pauseExpiredListings ?? null;
} catch {
  console.warn("[jobs] pauseExpiredListings not found — skipping");
}

let cleanupStuckPendingPayments = null;
try {
  const mod = await import("../routes/payment.js");
  cleanupStuckPendingPayments = mod.cleanupStuckPendingPayments ?? null;
} catch {
  console.warn("[jobs] cleanupStuckPendingPayments not found — skipping");
}

/* ── Schedule jobs ── */

/* Expire promotions every 10 minutes */
cron.schedule("0,10,20,30,40,50 * * * *", async () => {
  try { await expirePromotions(); }
  catch (err) { console.error("[cron] expirePromotions error:", err.message); }
}, { timezone: TZ });

/* Auto-release seller balance every 15 minutes */
cron.schedule("0,15,30,45 * * * *", async () => {
  try {
    const result = await autoReleaseBalance();
    if (result.released > 0)
      console.log(`[cron] autoReleaseBalance: released ${result.released}`);
  } catch (err) {
    console.error("[cron] autoReleaseBalance error:", err.message);
  }
}, { timezone: TZ });

/* Retry failed transfers every 30 minutes */
if (retryFailedTransfers) {
  cron.schedule("0,30 * * * *", async () => {
    try { await retryFailedTransfers(); }
    catch (err) { console.error("[cron] retryFailedTransfers error:", err.message); }
  }, { timezone: TZ });
}

/* Pause expired limited listings every hour */
if (pauseExpiredListings) {
  cron.schedule("5 * * * *", async () => {
    try {
      const paused = await pauseExpiredListings();
      if (paused.length > 0)
        console.log(`[cron] pauseExpiredListings: paused ${paused.length}`);
    } catch (err) {
      console.error("[cron] pauseExpiredListings error:", err.message);
    }
  }, { timezone: TZ });
}

/* Cleanup stuck pending_payment every 15 minutes */
if (cleanupStuckPendingPayments) {
  cron.schedule("5,20,35,50 * * * *", async () => {
    try {
      const reverted = await cleanupStuckPendingPayments();
      if (reverted.length > 0)
        console.log(`[cron] cleanupStuck: reverted ${reverted.length}`);
    } catch (err) {
      console.error("[cron] cleanupStuckPendingPayments error:", err.message);
    }
  }, { timezone: TZ });
}

/* Prune webhook dedup table weekly — Sunday 3am */
cron.schedule("0 3 * * 0", async () => {
  try {
    const { pool } = await import("../config/db.js");
    const { rowCount } = await pool.query(
      `DELETE FROM payment_webhook_events
       WHERE received_at < NOW() - INTERVAL '30 days'`
    );
    console.log(`[cron] webhook dedup pruned ${rowCount} rows`);
  } catch (err) {
    console.error("[cron] webhook dedup prune error:", err.message);
  }
}, { timezone: TZ });

console.log("[jobs] all cron jobs scheduled");