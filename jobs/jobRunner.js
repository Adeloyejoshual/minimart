// server/jobs/jobRunner.js

import { autoReleaseBalance }    from "./autoReleaseBalance.js";
import { retryFailedTransfers }  from "./retryFailedTransfers.js";
import { autoConfirmDelivery }   from "./autoConfirmDelivery.js";
import { cleanupWebhookEvents }  from "./cleanupWebhookEvents.js";
import { dailyReconciliation }   from "./dailyReconciliation.js";
import { stalledWithdrawals }    from "./stalledWithdrawals.js";

// ═════════════════════════════════════════════════════════════
// JOB REGISTRY
//
// name:     Human-readable label
// fn:       The async function to run
// interval: How often to run (ms)
// enabled:  Master switch (can be overridden by env)
// ═════════════════════════════════════════════════════════════
const JOBS = [
  {
    name:     "Auto Release Balance",
    fn:       autoReleaseBalance,
    interval: 15 * 60 * 1000,   // every 15 minutes
    enabled:  true,
  },
  {
    name:     "Retry Failed Transfers",
    fn:       retryFailedTransfers,
    interval: 30 * 60 * 1000,   // every 30 minutes
    enabled:  true,
  },
  {
    name:     "Auto Confirm Delivery",
    fn:       autoConfirmDelivery,
    interval: 60 * 60 * 1000,   // every 1 hour
    enabled:  true,
  },
  {
    name:     "Stalled Withdrawals",
    fn:       stalledWithdrawals,
    interval: 20 * 60 * 1000,   // every 20 minutes
    enabled:  true,
  },
  {
    name:     "Cleanup Webhook Events",
    fn:       cleanupWebhookEvents,
    interval: 24 * 60 * 60 * 1000,  // every 24 hours
    enabled:  true,
  },
  {
    name:     "Daily Reconciliation",
    fn:       dailyReconciliation,
    interval: 24 * 60 * 60 * 1000,  // every 24 hours
    enabled:  true,
  },
];

// ═════════════════════════════════════════════════════════════
// RUNNER
// ═════════════════════════════════════════════════════════════
const timers = [];

/**
 * Run a single job with error handling + timing
 */
async function runJob(job) {
  const label = `[Job: ${job.name}]`;
  const start = Date.now();

  try {
    console.log(`${label} ⏳ Starting...`);
    const result = await job.fn();

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(
      `${label} ✅ Done in ${elapsed}s`,
      result ? `— ${JSON.stringify(result)}` : ""
    );

  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.error(
      `${label} ❌ Failed after ${elapsed}s:`,
      err.message
    );
  }
}

/**
 * Start all background jobs
 */
export function startJobRunner() {
  const disabled = process.env.DISABLE_JOBS === "true";

  if (disabled) {
    console.log("[Jobs] ⏸️  Background jobs disabled (DISABLE_JOBS=true)");
    return;
  }

  console.log("[Jobs] 🚀 Starting background job runner...");
  console.log("[Jobs] ──────────────────────────────────────");

  for (const job of JOBS) {
    // Check env override (e.g. DISABLE_JOB_RETRY_FAILED_TRANSFERS=true)
    const envKey = `DISABLE_JOB_${job.name
      .toUpperCase()
      .replace(/\s+/g, "_")}`;

    if (process.env[envKey] === "true") {
      console.log(`[Jobs] ⏭️  ${job.name} — disabled via env`);
      continue;
    }

    if (!job.enabled) {
      console.log(`[Jobs] ⏭️  ${job.name} — disabled`);
      continue;
    }

    const intervalMin = Math.round(job.interval / 60000);
    console.log(`[Jobs] ✅ ${job.name} — every ${intervalMin}min`);

    // Run once on startup (with initial delay to let DB warm up)
    const startupDelay = Math.floor(Math.random() * 30000) + 5000;
    setTimeout(() => runJob(job), startupDelay);

    // Then on interval
    const timer = setInterval(() => runJob(job), job.interval);
    timers.push(timer);
  }

  console.log("[Jobs] ──────────────────────────────────────");
  console.log(`[Jobs] ${timers.length} jobs scheduled`);
}

/**
 * Stop all jobs (for graceful shutdown)
 */
export function stopJobRunner() {
  for (const timer of timers) {
    clearInterval(timer);
  }
  timers.length = 0;
  console.log("[Jobs] 🛑 All background jobs stopped");
}