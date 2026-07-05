/**
 * jobs/listingExpiry.js
 *
 * Runs every hour:
 *  1. Expire free listings past active_until (verified sellers)
 *  2. Expire trial listings past active_until (unverified sellers)
 *  3. Expire ended promotions
 *  4. Send expiry warning notifications (3 days, 1 day before)
 */

import { pool } from "../config/db.js";
import { createNotification } from "../services/notifications.js";

/* ══════════════════════════════════════════════════════════════
   EXPIRE FREE LISTINGS  (verified sellers — 30-day expiry)
══════════════════════════════════════════════════════════════ */
async function expireFreeListings() {
  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE public.products
       SET
         is_active  = false,
         status     = 'paused',
         updated_at = NOW()
       WHERE is_active     = true
         AND is_deleted     = false
         AND status         = 'active'
         AND active_until  IS NOT NULL
         AND active_until   < NOW()
       RETURNING id, title, seller_id`
    );

    if (!rowCount) return;

    console.log(`[expiry] Expired ${rowCount} free listing(s)`);

    const bySeller = rows.reduce((acc, r) => {
      (acc[r.seller_id] ??= []).push(r);
      return acc;
    }, {});

    for (const [sellerId, products] of Object.entries(bySeller)) {
      const count  = products.length;
      const titles = products
        .slice(0, 3)
        .map((p) => `"${p.title}"`)
        .join(", ");
      const more = count > 3 ? ` and ${count - 3} more` : "";

      await createNotification({
        userId:  sellerId,
        type:    "listing_expired",
        title:   count === 1
          ? "Your listing has expired"
          : `${count} listings have expired`,
        message: count === 1
          ? `${titles} has expired and is now hidden from buyers. Tap "Renew" to reactivate for free.`
          : `${titles}${more} have expired. Renew them to stay visible to buyers.`,
        metadata: {
          product_ids: products.map((p) => p.id),
          count,
        },
      });
    }
  } catch (err) {
    console.error("[expiry] expireFreeListings error:", err.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   EXPIRE TRIAL LISTINGS  (unverified sellers — 7-day expiry)
══════════════════════════════════════════════════════════════ */
async function expireTrialListings() {
  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE public.products
       SET
         is_active  = false,
         status     = 'paused',
         updated_at = NOW()
       WHERE is_active     = true
         AND is_deleted     = false
         AND status         = 'active_limited'
         AND active_until  IS NOT NULL
         AND active_until   < NOW()
         AND seller_id IN (
           SELECT id FROM public.users WHERE identity_verified = false
         )
       RETURNING id, title, seller_id`
    );

    if (!rowCount) return;

    console.log(`[expiry] Expired ${rowCount} trial listing(s)`);

    const bySeller = rows.reduce((acc, r) => {
      (acc[r.seller_id] ??= []).push(r);
      return acc;
    }, {});

    for (const [sellerId, products] of Object.entries(bySeller)) {
      const count = products.length;
      await createNotification({
        userId:  sellerId,
        type:    "listings_paused",
        title:   "Trial Listings Expired",
        message:
          `${count} listing${count !== 1 ? "s" : ""} paused because your ` +
          "7-day trial has ended. Verify your identity to restore them permanently.",
        metadata: {
          product_ids: products.map((p) => p.id),
          count,
          reason: "trial_expired",
        },
      });
    }
  } catch (err) {
    console.error("[expiry] expireTrialListings error:", err.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   EXPIRE PROMOTIONS
══════════════════════════════════════════════════════════════ */
async function expirePromotions() {
  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE public.products
       SET
         is_promoted        = false,
         promotion_type     = NULL,
         promotion_id       = NULL,
         promotion_priority = 0,
         boost_score        = GREATEST(0, COALESCE(boost_score, 0) - 50),
         updated_at         = NOW()
       WHERE is_promoted         = true
         AND promotion_end      IS NOT NULL
         AND promotion_end       < NOW()
         AND is_deleted          = false
       RETURNING id, title, seller_id`
    );

    if (!rowCount) return;

    console.log(`[expiry] Expired ${rowCount} promotion(s)`);

    for (const p of rows) {
      await createNotification({
        userId:  p.seller_id,
        type:    "promotion_expired",
        title:   "Promotion Ended",
        message:
          `Your promotion for "${p.title}" has ended. ` +
          "Promote again to boost visibility.",
        metadata: { product_id: p.id },
      });
    }
  } catch (err) {
    console.error("[expiry] expirePromotions error:", err.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   SEND EXPIRY WARNINGS  (3 days and 1 day before)
══════════════════════════════════════════════════════════════ */
async function sendExpiryWarnings() {
  const warnings = [
    { days: 3, label: "3 days" },
    { days: 1, label: "tomorrow" },
  ];

  for (const { days, label } of warnings) {
    try {
      const { rows } = await pool.query(
        `SELECT
           p.id, p.title, p.seller_id, p.active_until, p.status
         FROM public.products p
         WHERE p.is_active     = true
           AND p.is_deleted     = false
           AND p.active_until  IS NOT NULL
           AND p.active_until   BETWEEN NOW() + (($1 - 1) || ' days')::INTERVAL
                                    AND NOW() + ($1 || ' days')::INTERVAL
           AND p.status        IN ('active', 'active_limited')
           AND NOT EXISTS (
             SELECT 1 FROM public.notifications n
             WHERE n.user_id                 = p.seller_id
               AND n.type                   = 'listing_expiry_warning'
               AND n.metadata->>'product_id' = p.id::text
               AND n.metadata->>'days'       = $2
               AND n.created_at             > NOW() - INTERVAL '25 hours'
           )`,
        [days, String(days)]
      );

      if (!rows.length) continue;

      console.log(`[expiry] Sending ${rows.length} expiry warning(s) — ${label}`);

      for (const p of rows) {
        const isTrialListing = p.status === "active_limited";
        await createNotification({
          userId:  p.seller_id,
          type:    "listing_expiry_warning",
          title:   `Listing expires ${label}`,
          message: isTrialListing
            ? `"${p.title}" expires ${label}. Verify your identity to keep it permanently.`
            : `"${p.title}" expires ${label}. Tap "Renew" to keep it active for free.`,
          metadata: {
            product_id: p.id,
            days:       String(days),
          },
        });
      }
    } catch (err) {
      console.error(`[expiry] warning (${days}d) error:`, err.message);
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   MAIN JOB
══════════════════════════════════════════════════════════════ */
export async function runListingExpiryJob() {
  const start = Date.now();
  console.log(`[expiry] Running — ${new Date().toISOString()}`);

  await Promise.allSettled([
    expireFreeListings(),
    expireTrialListings(),
    expirePromotions(),
    sendExpiryWarnings(),
  ]);

  console.log(`[expiry] Done in ${Date.now() - start}ms`);
}

/* ══════════════════════════════════════════════════════════════
   SCHEDULER
══════════════════════════════════════════════════════════════ */
export function startListingExpiryJob() {
  const INTERVAL = 60 * 60 * 1000; // every hour

  runListingExpiryJob();

  const timer = setInterval(runListingExpiryJob, INTERVAL);
  timer.unref();

  console.log("[expiry] ⏰ Scheduled — runs every hour");
  return timer;
}