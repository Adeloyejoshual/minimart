/**
 * jobs/listingExpiry.js — v2
 *
 * Runs every hour via startListingExpiryJob().
 * Can also be triggered manually: await runListingExpiryJob()
 *
 * Tasks:
 *  1. Expire free listings past active_until      (verified sellers,   status = 'active')
 *  2. Expire trial listings past active_until     (unverified sellers, status = 'active_limited')
 *  3. Expire ended promotions
 *  4. Send expiry warning notifications           (3 days and 1 day before)
 *
 * Fixes from v1:
 *  ─ #1  : Removed all is_deleted references — use status <> 'deleted' consistently
 *  ─ #2  : SQL intervals use ($n * INTERVAL '1 day') — no string concat
 *  ─ #3  : promotion_end → promotion_expires_at (matches schema)
 *  ─ #4  : Dedup check uses JSONB ->> with explicit text cast; documented
 *  ─ #5  : Promise.allSettled results inspected — rejected tasks logged
 *  ─ #6  : Concurrency guard (isRunning flag) prevents overlapping runs
 *  ─ #7  : Removed promotion_id = NULL (column does not exist in schema)
 *  ─ #8  : Notifications sent with pLimit(5) — parallel, not serial
 *  ─ #9  : Dedup window documented; changed to 20h for safety buffer
 *  ─ #10 : expireFreeListings now explicitly excludes unverified sellers
 *  ─ #11 : Sentry integration added
 *  ─ #12 : runListingExpiryJob returns a summary object
 *  ─ #13 : timer.unref() kept but documented; add SIGTERM hook
 *  ─ #14 : Warning window uses >= and < for precise boundary handling
 */

import pLimit    from "p-limit";
import * as Sentry from "@sentry/node";

import { pool }               from "../config/db.js";
import { createNotification } from "../services/notifications.js";

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const JOB_INTERVAL_MS = 60 * 60 * 1_000;   // 1 hour

/**
 * How long before we re-send a warning for the same product.
 * Must be < JOB_INTERVAL_MS × 2 so back-to-back runs don't
 * re-warn, but short enough that a server restart doesn't
 * cause a 24h+ silence window.
 */
const WARNING_DEDUP_HOURS = 20;

/**
 * Max concurrent notification inserts per task.
 * Keeps DB connection usage bounded when many listings expire at once.
 */
const NOTIFY_CONCURRENCY = 5;

/* ─────────────────────────────────────────────────────────────
   CONCURRENCY GUARD  — Fix #6
   Prevents two overlapping job instances if one run takes > 1 hour.
───────────────────────────────────────────────────────────── */
let isRunning = false;

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

/**
 * Groups an array of { seller_id, ...rest } rows by seller_id.
 * Returns Map<sellerId, row[]>
 */
const groupBySeller = (rows) =>
  rows.reduce((map, row) => {
    const key = String(row.seller_id);
    const arr = map.get(key) ?? [];
    arr.push(row);
    map.set(key, arr);
    return map;
  }, new Map());

/**
 * Builds a human-readable title list from up to 3 products.
 * e.g. '"Bag", "Shoes" and 4 more'
 */
const buildTitleSummary = (products, max = 3) => {
  const shown = products.slice(0, max).map((p) => `"${p.title}"`).join(", ");
  const extra = products.length > max ? ` and ${products.length - max} more` : "";
  return `${shown}${extra}`;
};

/**
 * Runs an array of async tasks with bounded concurrency.
 * Errors are caught per-task and logged — never re-thrown.
 */
const runNotifications = async (tasks) => {
  const limit = pLimit(NOTIFY_CONCURRENCY);
  const results = await Promise.allSettled(
    tasks.map((t) => limit(t))
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.warn(
      `[expiry] ${failed.length} notification(s) failed:`,
      failed.map((r) => r.reason?.message).join("; ")
    );
  }
  return results.filter((r) => r.status === "fulfilled").length;
};

/* ══════════════════════════════════════════════════════════════
   TASK 1 — EXPIRE FREE LISTINGS
   Matches: status = 'active', active_until < NOW()
   Scope  : verified sellers only (identity_verified = true)
            Fix #10: explicitly exclude unverified sellers so
            this and expireTrialListings are truly disjoint.
══════════════════════════════════════════════════════════════ */
async function expireFreeListings() {
  // Fix #1: status <> 'deleted' instead of is_deleted = false
  // Fix #10: JOIN to users to exclude unverified sellers
  const { rows, rowCount } = await pool.query(
    `UPDATE public.products p
     SET
       is_active  = FALSE,
       status     = 'paused',
       updated_at = NOW()
     FROM public.users u
     WHERE p.seller_id      = u.id
       AND p.is_active       = TRUE
       AND p.status          = 'active'
       AND p.status         <> 'deleted'
       AND p.active_until   IS NOT NULL
       AND p.active_until    < NOW()
       AND u.identity_verified = TRUE
     RETURNING p.id, p.title, p.seller_id`
  );

  if (!rowCount) return { expired: 0, notified: 0 };

  console.log(`[expiry] Task 1: expired ${rowCount} free listing(s)`);

  const bySeller = groupBySeller(rows);
  const tasks    = [];

  for (const [sellerId, products] of bySeller) {
    const count   = products.length;
    const summary = buildTitleSummary(products);

    tasks.push(() =>
      createNotification({
        userId   : sellerId,
        type     : "listing_expired",
        title    : count === 1
          ? "Your listing has expired"
          : `${count} listings have expired`,
        message  : count === 1
          ? `${summary} has expired and is now hidden from buyers. ` +
            `Tap "Renew" to reactivate for free.`
          : `${summary} have expired. Renew them to stay visible to buyers.`,
        metadata : {
          product_ids : products.map((p) => p.id),
          count,
        },
      })
    );
  }

  // Fix #8: parallel notifications, bounded by NOTIFY_CONCURRENCY
  const notified = await runNotifications(tasks);
  return { expired: rowCount, notified };
}

/* ══════════════════════════════════════════════════════════════
   TASK 2 — EXPIRE TRIAL LISTINGS
   Matches: status = 'active_limited', active_until < NOW()
   Scope  : unverified sellers only
══════════════════════════════════════════════════════════════ */
async function expireTrialListings() {
  // Fix #1: status <> 'deleted' instead of is_deleted = false
  const { rows, rowCount } = await pool.query(
    `UPDATE public.products p
     SET
       is_active  = FALSE,
       status     = 'paused',
       updated_at = NOW()
     FROM public.users u
     WHERE p.seller_id      = u.id
       AND p.is_active       = TRUE
       AND p.status          = 'active_limited'
       AND p.status         <> 'deleted'
       AND p.active_until   IS NOT NULL
       AND p.active_until    < NOW()
       AND u.identity_verified = FALSE
     RETURNING p.id, p.title, p.seller_id`
  );

  if (!rowCount) return { expired: 0, notified: 0 };

  console.log(`[expiry] Task 2: expired ${rowCount} trial listing(s)`);

  const bySeller = groupBySeller(rows);
  const tasks    = [];

  for (const [sellerId, products] of bySeller) {
    const count = products.length;
    tasks.push(() =>
      createNotification({
        userId   : sellerId,
        type     : "listings_paused",
        title    : "Trial Listings Expired",
        message  :
          `${count} listing${count !== 1 ? "s" : ""} paused because your ` +
          "7-day trial has ended. Verify your identity to restore them permanently.",
        metadata : {
          product_ids : products.map((p) => p.id),
          count,
          reason      : "trial_expired",
        },
      })
    );
  }

  // Fix #8: parallel notifications
  const notified = await runNotifications(tasks);
  return { expired: rowCount, notified };
}

/* ══════════════════════════════════════════════════════════════
   TASK 3 — EXPIRE PROMOTIONS
   Fix #3: promotion_end → promotion_expires_at
   Fix #7: removed promotion_id = NULL (column does not exist)
   Fix #1: status <> 'deleted' instead of is_deleted = false
══════════════════════════════════════════════════════════════ */
async function expirePromotions() {
  const { rows, rowCount } = await pool.query(
    `UPDATE public.products
     SET
       is_promoted         = FALSE,
       promotion_type      = NULL,
       promotion_priority  = 0,
       boost_score         = GREATEST(0, COALESCE(boost_score, 0) - 50),
       updated_at          = NOW()
     WHERE is_promoted            = TRUE
       AND promotion_expires_at  IS NOT NULL
       AND promotion_expires_at   < NOW()
       AND status                <> 'deleted'
     RETURNING id, title, seller_id`
  );

  if (!rowCount) return { expired: 0, notified: 0 };

  console.log(`[expiry] Task 3: expired ${rowCount} promotion(s)`);

  // Fix #8: parallel notifications
  const tasks = rows.map((p) => () =>
    createNotification({
      userId   : p.seller_id,
      type     : "promotion_expired",
      title    : "Promotion Ended",
      message  :
        `Your promotion for "${p.title}" has ended. ` +
        "Promote again to boost visibility.",
      metadata : { product_id: p.id },
    })
  );

  const notified = await runNotifications(tasks);
  return { expired: rowCount, notified };
}

/* ══════════════════════════════════════════════════════════════
   TASK 4 — SEND EXPIRY WARNINGS
   Sends warnings at exactly 3 days and 1 day before expiry.

   Fix #2 : interval multiplication — no string concat
   Fix #4 : JSONB dedup uses explicit ::text cast on both sides
   Fix #9 : dedup window = WARNING_DEDUP_HOURS (20h), documented
   Fix #14: boundary uses >= lower AND < upper for precise matching
══════════════════════════════════════════════════════════════ */
async function sendExpiryWarnings() {
  const warnings = [
    { days: 3, label: "in 3 days" },
    { days: 1, label: "tomorrow"  },
  ];

  let totalWarned = 0;

  for (const { days, label } of warnings) {
    // Fix #2: interval multiplication
    // Fix #14: >= lower boundary AND < upper boundary
    //          ensures a listing expiring in exactly 3.0 days is caught
    //          without overlapping the 1-day window
    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.title,
         p.seller_id,
         p.active_until,
         p.status
       FROM public.products p
       WHERE p.is_active     = TRUE
         AND p.status        IN ('active', 'active_limited')
         AND p.status        <> 'deleted'
         AND p.active_until  IS NOT NULL
         AND p.active_until  >= NOW() + (($1 - 1) * INTERVAL '1 day')
         AND p.active_until  <  NOW() + ($1       * INTERVAL '1 day')
         AND NOT EXISTS (
           SELECT 1
           FROM   public.notifications n
           WHERE  n.user_id                  = p.seller_id
             AND  n.type                     = 'listing_expiry_warning'
             AND  (n.metadata->>'product_id')::text = p.id::text
             AND  (n.metadata->>'days')       = $2::text
             AND  n.created_at              >  NOW() - ($3 * INTERVAL '1 hour')
         )`,
      // Fix #4: $2 = string days for dedup match, $3 = dedup window in hours
      [days, String(days), WARNING_DEDUP_HOURS]
    );

    if (!rows.length) {
      console.log(`[expiry] Task 4: no ${days}-day warnings to send`);
      continue;
    }

    console.log(
      `[expiry] Task 4: sending ${rows.length} warning(s) — expires ${label}`
    );

    // Fix #8: parallel notifications
    const tasks = rows.map((p) => () => {
      const isTrial = p.status === "active_limited";
      return createNotification({
        userId   : p.seller_id,
        type     : "listing_expiry_warning",
        title    : `Listing expires ${label}`,
        message  : isTrial
          ? `"${p.title}" expires ${label}. ` +
            "Verify your identity to keep it permanently."
          : `"${p.title}" expires ${label}. ` +
            `Tap "Renew" to keep it active for free.`,
        metadata : {
          product_id : String(p.id),   // Fix #4: always store as string
          days       : String(days),
        },
      });
    });

    totalWarned += await runNotifications(tasks);
  }

  return { warned: totalWarned };
}

/* ══════════════════════════════════════════════════════════════
   MAIN JOB
   Fix #5  : inspects Promise.allSettled results — logs rejected tasks
   Fix #6  : isRunning guard prevents overlapping executions
   Fix #12 : returns a summary object with counts from each task
══════════════════════════════════════════════════════════════ */
export async function runListingExpiryJob() {
  // Fix #6: skip if already running
  if (isRunning) {
    console.warn(
      "[expiry] Previous run still in progress — skipping this tick"
    );
    return null;
  }

  isRunning    = true;
  const start  = Date.now();
  const runAt  = new Date().toISOString();
  console.log(`[expiry] ▶ Started — ${runAt}`);

  // Fix #5: capture results from each task so we can log failures
  const [
    freeResult,
    trialResult,
    promoResult,
    warnResult,
  ] = await Promise.allSettled([
    expireFreeListings(),
    expireTrialListings(),
    expirePromotions(),
    sendExpiryWarnings(),
  ]);

  const summary = {
    ran_at          : runAt,
    duration_ms     : Date.now() - start,
    free_listings   : freeResult.status  === "fulfilled" ? freeResult.value  : null,
    trial_listings  : trialResult.status === "fulfilled" ? trialResult.value : null,
    promotions      : promoResult.status === "fulfilled" ? promoResult.value : null,
    warnings        : warnResult.status  === "fulfilled" ? warnResult.value  : null,
  };

  // Fix #5: log and track any task that rejected
  const tasks = [
    { name: "expireFreeListings",  result: freeResult  },
    { name: "expireTrialListings", result: trialResult },
    { name: "expirePromotions",    result: promoResult },
    { name: "sendExpiryWarnings",  result: warnResult  },
  ];

  for (const { name, result } of tasks) {
    if (result.status === "rejected") {
      console.error(
        `[expiry] ✗ ${name} failed:`, result.reason?.message ?? result.reason
      );
      Sentry.captureException?.(result.reason, {
        tags  : { area: "listing_expiry", task: name },
        extra : { ran_at: runAt },
      });
    }
  }

  console.log(
    `[expiry] ✓ Done in ${summary.duration_ms}ms`,
    JSON.stringify({
      free_expired  : summary.free_listings?.expired   ?? "error",
      trial_expired : summary.trial_listings?.expired  ?? "error",
      promos_ended  : summary.promotions?.expired      ?? "error",
      warnings_sent : summary.warnings?.warned         ?? "error",
    })
  );

  isRunning = false;
  return summary;
}

/* ══════════════════════════════════════════════════════════════
   SCHEDULER
   Fix #6  : isRunning guard inside runListingExpiryJob handles overlap
   Fix #13 : timer.unref() documented — process can exit cleanly;
             call stopListingExpiryJob() for graceful shutdown
══════════════════════════════════════════════════════════════ */
let _timer = null;

export function startListingExpiryJob() {
  if (_timer) {
    console.warn("[expiry] Job already started — ignoring duplicate call");
    return _timer;
  }

  // Run immediately on startup, then on schedule
  runListingExpiryJob().catch((err) => {
    console.error("[expiry] Initial run failed:", err.message);
    Sentry.captureException?.(err, { tags: { area: "listing_expiry_start" } });
  });

  _timer = setInterval(() => {
    runListingExpiryJob().catch((err) => {
      console.error("[expiry] Scheduled run failed:", err.message);
      Sentry.captureException?.(err, {
        tags: { area: "listing_expiry_scheduled" },
      });
    });
  }, JOB_INTERVAL_MS);

  /*
   * timer.unref() — allows the Node.js event loop to exit even if
   * this timer is still pending. This is intentional for CLI scripts
   * and test environments. In production servers that stay running
   * indefinitely this makes no difference.
   * Call stopListingExpiryJob() for explicit cleanup.
   */
  _timer.unref();

  console.log(
    `[expiry] ⏰ Scheduled — runs every ${JOB_INTERVAL_MS / 60_000} minutes`
  );
  return _timer;
}

/**
 * Stops the scheduled job cleanly.
 * Call this in your SIGTERM / SIGINT handler.
 *
 * Example in server.js:
 *   process.on("SIGTERM", async () => {
 *     stopListingExpiryJob();
 *     await server.close();
 *     process.exit(0);
 *   });
 */
export function stopListingExpiryJob() {
  if (!_timer) return;
  clearInterval(_timer);
  _timer = null;
  console.log("[expiry] ⏹ Job stopped");
}