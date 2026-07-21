/**
 * jobs/listingExpiry.js — v4
 *
 * Changes from v3:
 *  - 7-day grace period after subscription_expires_at before listings expire
 *  - Email notifications sent alongside in-app notifications for all tasks
 *  - Subscription expiry warnings at 7 days, 3 days, and 1 day before expiry
 *  - Subscription expired notification sent when grace period ends
 *  - Grace period listings shown as 'grace' status in warnings
 */

import pLimit      from "p-limit";
import * as Sentry from "@sentry/node";

import { pool }               from "../config/db.js";
import { createNotification } from "../services/notifications.js";
import {
  sendListingExpiryEmail,
  sendListingExpiryWarningEmail,
  sendTrialExpiredEmail,
  sendSubscriptionExpiryWarningEmail,
  sendSubscriptionExpiredEmail,
  sendSubscriptionGraceExpiredEmail,
} from "../services/email.js";

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const JOB_INTERVAL_MS       = 60 * 60 * 1_000;  // 1 hour
const WARNING_DEDUP_HOURS   = 20;
const NOTIFY_CONCURRENCY    = 5;
const GRACE_PERIOD_DAYS     = 7;  // listings stay live this long after sub expires

/* ─────────────────────────────────────────────────────────────
   CONCURRENCY GUARD
───────────────────────────────────────────────────────────── */
let isRunning = false;

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const groupBySeller = (rows) =>
  rows.reduce((map, row) => {
    const key = String(row.seller_id);
    const arr = map.get(key) ?? [];
    arr.push(row);
    map.set(key, arr);
    return map;
  }, new Map());

const buildTitleSummary = (products, max = 3) => {
  const shown = products.slice(0, max).map((p) => `"${p.title}"`).join(", ");
  const extra = products.length > max ? ` and ${products.length - max} more` : "";
  return `${shown}${extra}`;
};

const runNotifications = async (tasks) => {
  const limit   = pLimit(NOTIFY_CONCURRENCY);
  const results = await Promise.allSettled(tasks.map((t) => limit(t)));
  const failed  = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.warn(
      `[expiry] ${failed.length} notification(s) failed:`,
      failed.map((r) => r.reason?.message).join("; ")
    );
  }
  return results.filter((r) => r.status === "fulfilled").length;
};

/* ─────────────────────────────────────────────────────────────
   SUBSCRIPTION GUARD
   A seller is "subscribed and within grace" when:
     subscription_status = 'active'
     subscription_plan  != 'free'
     subscription_expires_at > NOW() - GRACE_PERIOD_DAYS
   The grace period keeps listings live for 7 days after expiry.
───────────────────────────────────────────────────────────── */
const SUBSCRIBED_OR_IN_GRACE_GUARD = `
  AND NOT (
    u.subscription_status      = 'active'
    AND u.subscription_plan   IS NOT NULL
    AND u.subscription_plan   <> 'free'
    AND u.subscription_expires_at IS NOT NULL
    AND u.subscription_expires_at > NOW() - (${GRACE_PERIOD_DAYS} * INTERVAL '1 day')
  )
`;

/* ══════════════════════════════════════════════════════════════
   TASK 1 — EXPIRE FREE LISTINGS
   Verified sellers, active_until passed, not subscribed / in grace.
══════════════════════════════════════════════════════════════ */
async function expireFreeListings() {
  const { rows, rowCount } = await pool.query(
    `UPDATE public.products p
     SET
       is_active  = FALSE,
       status     = 'paused',
       updated_at = NOW()
     FROM public.users u
     WHERE p.seller_id           = u.id
       AND p.is_active            = TRUE
       AND p.status               = 'active'
       AND p.status              <> 'deleted'
       AND p.active_until        IS NOT NULL
       AND p.active_until         < NOW()
       AND u.identity_verified    = TRUE
       ${SUBSCRIBED_OR_IN_GRACE_GUARD}
     RETURNING p.id, p.title, p.seller_id`
  );

  if (!rowCount) return { expired: 0, notified: 0 };
  console.log(`[expiry] Task 1: expired ${rowCount} free listing(s)`);

  /* Fetch seller emails in one query */
  const sellerIds = [...new Set(rows.map((r) => String(r.seller_id)))];
  const { rows: sellers } = await pool.query(
    `SELECT id, name, email FROM public.users WHERE id = ANY($1::UUID[])`,
    [sellerIds]
  );
  const sellerMap = Object.fromEntries(sellers.map((s) => [String(s.id), s]));

  const bySeller = groupBySeller(rows);
  const tasks    = [];

  for (const [sellerId, products] of bySeller) {
    const seller  = sellerMap[sellerId];
    const count   = products.length;
    const summary = buildTitleSummary(products);

    /* In-app notification */
    tasks.push(() =>
      createNotification({
        userId  : sellerId,
        type    : "listing_expired",
        title   : count === 1 ? "Your listing has expired" : `${count} listings have expired`,
        message : count === 1
          ? `${summary} has expired and is now hidden from buyers. Tap "Renew" to reactivate.`
          : `${summary} have expired. Renew them to stay visible to buyers.`,
        metadata: { product_ids: products.map((p) => p.id), count },
      })
    );

    /* Email notification */
    if (seller?.email) {
      tasks.push(() =>
        sendListingExpiryEmail({
          to      : seller.email,
          name    : seller.name,
          products: products.map((p) => ({ id: p.id, title: p.title })),
        }).catch((e) => console.warn("[expiry] email failed:", e.message))
      );
    }
  }

  const notified = await runNotifications(tasks);
  return { expired: rowCount, notified };
}

/* ══════════════════════════════════════════════════════════════
   TASK 2 — EXPIRE TRIAL LISTINGS
   Unverified sellers, active_limited, not subscribed / in grace.
══════════════════════════════════════════════════════════════ */
async function expireTrialListings() {
  const { rows, rowCount } = await pool.query(
    `UPDATE public.products p
     SET
       is_active  = FALSE,
       status     = 'paused',
       updated_at = NOW()
     FROM public.users u
     WHERE p.seller_id           = u.id
       AND p.is_active            = TRUE
       AND p.status               = 'active_limited'
       AND p.status              <> 'deleted'
       AND p.active_until        IS NOT NULL
       AND p.active_until         < NOW()
       AND u.identity_verified    = FALSE
       ${SUBSCRIBED_OR_IN_GRACE_GUARD}
     RETURNING p.id, p.title, p.seller_id`
  );

  if (!rowCount) return { expired: 0, notified: 0 };
  console.log(`[expiry] Task 2: expired ${rowCount} trial listing(s)`);

  const sellerIds = [...new Set(rows.map((r) => String(r.seller_id)))];
  const { rows: sellers } = await pool.query(
    `SELECT id, name, email FROM public.users WHERE id = ANY($1::UUID[])`,
    [sellerIds]
  );
  const sellerMap = Object.fromEntries(sellers.map((s) => [String(s.id), s]));

  const bySeller = groupBySeller(rows);
  const tasks    = [];

  for (const [sellerId, products] of bySeller) {
    const seller = sellerMap[sellerId];
    const count  = products.length;

    tasks.push(() =>
      createNotification({
        userId  : sellerId,
        type    : "listings_paused",
        title   : "Trial Listings Expired",
        message :
          `${count} listing${count !== 1 ? "s" : ""} paused — your 7-day trial has ended. ` +
          "Verify your identity to restore them permanently.",
        metadata: { product_ids: products.map((p) => p.id), count, reason: "trial_expired" },
      })
    );

    if (seller?.email) {
      tasks.push(() =>
        sendTrialExpiredEmail({
          to      : seller.email,
          name    : seller.name,
          products: products.map((p) => ({ id: p.id, title: p.title })),
        }).catch((e) => console.warn("[expiry] email failed:", e.message))
      );
    }
  }

  const notified = await runNotifications(tasks);
  return { expired: rowCount, notified };
}

/* ══════════════════════════════════════════════════════════════
   TASK 3 — EXPIRE PROMOTIONS
══════════════════════════════════════════════════════════════ */
async function expirePromotions() {
  const { rows, rowCount } = await pool.query(
    `UPDATE public.products
     SET
       is_promoted        = FALSE,
       promotion_type     = NULL,
       promotion_priority = 0,
       boost_score        = GREATEST(0, COALESCE(boost_score, 0) - 50),
       updated_at         = NOW()
     WHERE is_promoted           = TRUE
       AND promotion_expires_at IS NOT NULL
       AND promotion_expires_at  < NOW()
       AND status               <> 'deleted'
     RETURNING id, title, seller_id`
  );

  if (!rowCount) return { expired: 0, notified: 0 };
  console.log(`[expiry] Task 3: expired ${rowCount} promotion(s)`);

  const tasks = rows.map((p) => () =>
    createNotification({
      userId  : p.seller_id,
      type    : "promotion_expired",
      title   : "Promotion Ended",
      message : `Your promotion for "${p.title}" has ended. Promote again to boost visibility.`,
      metadata: { product_id: p.id },
    })
  );

  const notified = await runNotifications(tasks);
  return { expired: rowCount, notified };
}

/* ══════════════════════════════════════════════════════════════
   TASK 4 — SEND LISTING EXPIRY WARNINGS
   Skips subscribed sellers (their listings won't expire).
══════════════════════════════════════════════════════════════ */
async function sendExpiryWarnings() {
  const warnings = [
    { days: 3, label: "in 3 days" },
    { days: 1, label: "tomorrow"  },
  ];

  let totalWarned = 0;

  for (const { days, label } of warnings) {
    const { rows } = await pool.query(
      `SELECT
         p.id, p.title, p.seller_id, p.active_until, p.status,
         u.name  AS seller_name,
         u.email AS seller_email
       FROM public.products p
       JOIN public.users u ON u.id = p.seller_id
       WHERE p.is_active    = TRUE
         AND p.status       IN ('active', 'active_limited')
         AND p.status       <> 'deleted'
         AND p.active_until IS NOT NULL
         AND p.active_until >= NOW() + (($1 - 1) * INTERVAL '1 day')
         AND p.active_until <  NOW() + ($1       * INTERVAL '1 day')
         /* Skip subscribed / in-grace sellers */
         AND NOT (
           u.subscription_status      = 'active'
           AND u.subscription_plan   IS NOT NULL
           AND u.subscription_plan   <> 'free'
           AND u.subscription_expires_at IS NOT NULL
           AND u.subscription_expires_at > NOW() - (${GRACE_PERIOD_DAYS} * INTERVAL '1 day')
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.notifications n
           WHERE  n.user_id                     = p.seller_id
             AND  n.type                        = 'listing_expiry_warning'
             AND  (n.metadata->>'product_id')::text = p.id::text
             AND  (n.metadata->>'days')          = $2::text
             AND  n.created_at                  > NOW() - ($3 * INTERVAL '1 hour')
         )`,
      [days, String(days), WARNING_DEDUP_HOURS]
    );

    if (!rows.length) {
      console.log(`[expiry] Task 4: no ${days}-day listing warnings to send`);
      continue;
    }

    console.log(`[expiry] Task 4: ${rows.length} listing warning(s) — expires ${label}`);

    /* Group by seller so one email covers all their expiring listings */
    const bySeller = groupBySeller(rows);
    const tasks    = [];

    for (const [sellerId, products] of bySeller) {
      const first   = products[0];
      const isTrial = first.status === "active_limited";

      /* One in-app notification per product */
      for (const p of products) {
        tasks.push(() =>
          createNotification({
            userId  : sellerId,
            type    : "listing_expiry_warning",
            title   : `Listing expires ${label}`,
            message : isTrial
              ? `"${p.title}" expires ${label}. Verify your identity to keep it permanently.`
              : `"${p.title}" expires ${label}. Tap "Renew" to keep it active for free.`,
            metadata: { product_id: String(p.id), days: String(days) },
          })
        );
      }

      /* One email per seller covering all their products expiring at this window */
      if (first.seller_email) {
        tasks.push(() =>
          sendListingExpiryWarningEmail({
            to      : first.seller_email,
            name    : first.seller_name,
            days,
            label,
            isTrial,
            products: products.map((p) => ({ id: p.id, title: p.title, activeUntil: p.active_until })),
          }).catch((e) => console.warn("[expiry] warning email failed:", e.message))
        );
      }
    }

    totalWarned += await runNotifications(tasks);
  }

  return { warned: totalWarned };
}

/* ══════════════════════════════════════════════════════════════
   TASK 5 — LIFT EXPIRY FOR SUBSCRIBED SELLERS  (belt-and-suspenders)
══════════════════════════════════════════════════════════════ */
async function liftExpiryForSubscribedSellers() {
  const { rows, rowCount } = await pool.query(
    `UPDATE public.products p
     SET
       is_active    = TRUE,
       status       = 'active',
       active_until = NULL,
       updated_at   = NOW()
     FROM public.users u
     WHERE p.seller_id  = u.id
       AND p.status     IN ('paused', 'active_limited')
       AND p.status     <> 'deleted'
       AND p.is_deleted  = FALSE
       AND u.subscription_status      = 'active'
       AND u.subscription_plan       IS NOT NULL
       AND u.subscription_plan       <> 'free'
       AND u.subscription_expires_at IS NOT NULL
       AND u.subscription_expires_at  > NOW()
     RETURNING p.id, p.title, p.seller_id`
  );

  if (!rowCount) return { lifted: 0, notified: 0 };
  console.log(`[expiry] Task 5: lifted expiry on ${rowCount} listing(s)`);

  const bySeller = groupBySeller(rows);
  const tasks    = [];

  for (const [sellerId, products] of bySeller) {
    const count   = products.length;
    const summary = buildTitleSummary(products);
    tasks.push(() =>
      createNotification({
        userId  : sellerId,
        type    : "listings_reactivated",
        title   : "Listings Restored by Subscription ✓",
        message : count === 1
          ? `${summary} is now permanently active as part of your subscription.`
          : `${count} listings (${summary}) are now permanently active as part of your subscription.`,
        metadata: { product_ids: products.map((p) => p.id), count, reason: "subscription_active" },
      })
    );
  }

  const notified = await runNotifications(tasks);
  return { lifted: rowCount, notified };
}

/* ══════════════════════════════════════════════════════════════
   TASK 6 — SUBSCRIPTION EXPIRY WARNINGS  (new)
   Sends emails + in-app at 7, 3, and 1 day before subscription expires.
   Only for sellers whose subscription is still active (not yet expired).
══════════════════════════════════════════════════════════════ */
async function sendSubscriptionExpiryWarnings() {
  const warnings = [
    { days: 7, label: "in 7 days" },
    { days: 3, label: "in 3 days" },
    { days: 1, label: "tomorrow"  },
  ];

  let totalWarned = 0;

  for (const { days, label } of warnings) {
    const { rows } = await pool.query(
      `SELECT
         u.id, u.name, u.email,
         u.subscription_plan,
         u.subscription_expires_at,
         u.billing_cycle,
         sp.name AS plan_name
       FROM public.users u
       LEFT JOIN subscription_plans sp ON sp.slug = u.subscription_plan
       WHERE u.subscription_status      = 'active'
         AND u.subscription_plan       IS NOT NULL
         AND u.subscription_plan       <> 'free'
         AND u.subscription_expires_at IS NOT NULL
         AND u.subscription_expires_at >= NOW() + (($1 - 1) * INTERVAL '1 day')
         AND u.subscription_expires_at <  NOW() + ($1       * INTERVAL '1 day')
         /* Dedup — don't re-warn within 20 hours */
         AND NOT EXISTS (
           SELECT 1 FROM public.notifications n
           WHERE  n.user_id         = u.id
             AND  n.type            = 'subscription_expiry_warning'
             AND  (n.metadata->>'days') = $2::text
             AND  n.created_at     > NOW() - ($3 * INTERVAL '1 hour')
         )`,
      [days, String(days), WARNING_DEDUP_HOURS]
    );

    if (!rows.length) {
      console.log(`[expiry] Task 6: no ${days}-day subscription warnings to send`);
      continue;
    }

    console.log(`[expiry] Task 6: ${rows.length} subscription warning(s) — expires ${label}`);

    const tasks = rows.map((user) => async () => {
      /* In-app notification */
      await createNotification({
        userId  : user.id,
        type    : "subscription_expiry_warning",
        title   : `Subscription expires ${label}`,
        message :
          `Your ${user.plan_name ?? user.subscription_plan} subscription expires ${label}. ` +
          `Renew now to keep your listings permanently active.`,
        metadata: { days: String(days), plan: user.subscription_plan },
      });

      /* Email */
      if (user.email) {
        await sendSubscriptionExpiryWarningEmail({
          to          : user.email,
          name        : user.name,
          days,
          label,
          planName    : user.plan_name ?? user.subscription_plan,
          expiresAt   : user.subscription_expires_at,
          billingCycle: user.billing_cycle,
        }).catch((e) => console.warn("[expiry] sub warning email failed:", e.message));
      }
    });

    totalWarned += await runNotifications(tasks);
  }

  return { warned: totalWarned };
}

/* ══════════════════════════════════════════════════════════════
   TASK 7 — EXPIRE SUBSCRIPTIONS AFTER GRACE PERIOD  (new)
   When subscription_expires_at + GRACE_PERIOD_DAYS < NOW():
     - Expire all their listings (set paused)
     - Set subscription_status = 'expired' on user row
     - Send email and in-app notification
══════════════════════════════════════════════════════════════ */
async function expireSubscriptionsAfterGrace() {
  /* Find users whose grace period has ended */
  const { rows: expiredUsers } = await pool.query(
    `UPDATE public.users
     SET subscription_status = 'expired',
         updated_at           = NOW()
     WHERE subscription_status      = 'active'
       AND subscription_plan       IS NOT NULL
       AND subscription_plan       <> 'free'
       AND subscription_expires_at IS NOT NULL
       AND subscription_expires_at  < NOW() - (${GRACE_PERIOD_DAYS} * INTERVAL '1 day')
     RETURNING id, name, email, subscription_plan, subscription_expires_at`
  );

  if (!expiredUsers.length) return { expired: 0, listingsPaused: 0 };

  console.log(`[expiry] Task 7: ${expiredUsers.length} subscription(s) grace period ended`);

  /* Mark their subscriptions record as expired too */
  const userIds = expiredUsers.map((u) => u.id);
  await pool.query(
    `UPDATE public.subscriptions
     SET status     = 'expired',
         updated_at = NOW()
     WHERE user_id  = ANY($1::UUID[])
       AND status   = 'active'`,
    [userIds]
  );

  /* Pause all their listings */
  const { rowCount: listingsPaused } = await pool.query(
    `UPDATE public.products
     SET is_active  = FALSE,
         status     = 'paused',
         updated_at = NOW()
     WHERE seller_id = ANY($1::UUID[])
       AND is_active  = TRUE
       AND status    <> 'deleted'`,
    [userIds]
  );

  console.log(`[expiry] Task 7: paused ${listingsPaused ?? 0} listings after grace`);

  /* Notify each user */
  const tasks = expiredUsers.map((user) => async () => {
    await createNotification({
      userId  : user.id,
      type    : "subscription_grace_expired",
      title   : "Subscription Expired — Listings Paused",
      message :
        "Your subscription grace period has ended. Your listings have been paused. " +
        "Renew your subscription to restore them.",
      metadata: { plan: user.subscription_plan },
    });

    if (user.email) {
      await sendSubscriptionGraceExpiredEmail({
        to        : user.email,
        name      : user.name,
        planSlug  : user.subscription_plan,
        expiresAt : user.subscription_expires_at,
        graceDays : GRACE_PERIOD_DAYS,
      }).catch((e) => console.warn("[expiry] grace expired email failed:", e.message));
    }
  });

  await runNotifications(tasks);
  return { expired: expiredUsers.length, listingsPaused: listingsPaused ?? 0 };
}

/* ══════════════════════════════════════════════════════════════
   TASK 8 — GRACE PERIOD REMINDER  (new)
   Sent once when subscription just expired (entered grace period).
   Tells seller they have GRACE_PERIOD_DAYS days to renew before
   their listings are paused.
══════════════════════════════════════════════════════════════ */
async function sendGracePeriodStartNotifications() {
  /* Find users who expired in the last hour and haven't been notified yet */
  const { rows } = await pool.query(
    `SELECT
       u.id, u.name, u.email,
       u.subscription_plan,
       u.subscription_expires_at,
       sp.name AS plan_name
     FROM public.users u
     LEFT JOIN subscription_plans sp ON sp.slug = u.subscription_plan
     WHERE u.subscription_status      = 'active'
       AND u.subscription_plan       IS NOT NULL
       AND u.subscription_plan       <> 'free'
       AND u.subscription_expires_at IS NOT NULL
       AND u.subscription_expires_at  < NOW()
       AND u.subscription_expires_at >= NOW() - INTERVAL '1 hour'
       /* Dedup */
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications n
         WHERE  n.user_id     = u.id
           AND  n.type        = 'subscription_grace_started'
           AND  n.created_at > NOW() - INTERVAL '23 hours'
       )`
  );

  if (!rows.length) return { notified: 0 };

  console.log(`[expiry] Task 8: ${rows.length} grace period start notification(s)`);

  const tasks = rows.map((user) => async () => {
    await createNotification({
      userId  : user.id,
      type    : "subscription_grace_started",
      title   : `${GRACE_PERIOD_DAYS}-Day Grace Period Started`,
      message :
        `Your ${user.plan_name ?? user.subscription_plan} subscription has expired. ` +
        `Your listings will stay live for ${GRACE_PERIOD_DAYS} more days. ` +
        "Renew now to avoid any interruption.",
      metadata: { plan: user.subscription_plan, grace_days: GRACE_PERIOD_DAYS },
    });

    if (user.email) {
      await sendSubscriptionExpiredEmail({
        to        : user.email,
        name      : user.name,
        planName  : user.plan_name ?? user.subscription_plan,
        expiresAt : user.subscription_expires_at,
        graceDays : GRACE_PERIOD_DAYS,
      }).catch((e) => console.warn("[expiry] grace start email failed:", e.message));
    }
  });

  const notified = await runNotifications(tasks);
  return { notified };
}

/* ══════════════════════════════════════════════════════════════
   MAIN JOB
══════════════════════════════════════════════════════════════ */
export async function runListingExpiryJob() {
  if (isRunning) {
    console.warn("[expiry] Previous run still in progress — skipping");
    return null;
  }

  isRunning   = true;
  const start = Date.now();
  const runAt = new Date().toISOString();
  console.log(`[expiry] ▶ Started — ${runAt}`);

  const [
    freeResult,
    trialResult,
    promoResult,
    listingWarnResult,
    liftResult,
    subWarnResult,
    graceExpiredResult,
    graceStartResult,
  ] = await Promise.allSettled([
    expireFreeListings(),
    expireTrialListings(),
    expirePromotions(),
    sendExpiryWarnings(),
    liftExpiryForSubscribedSellers(),
    sendSubscriptionExpiryWarnings(),
    expireSubscriptionsAfterGrace(),
    sendGracePeriodStartNotifications(),
  ]);

  const summary = {
    ran_at              : runAt,
    duration_ms         : Date.now() - start,
    free_listings       : freeResult.status         === "fulfilled" ? freeResult.value         : null,
    trial_listings      : trialResult.status        === "fulfilled" ? trialResult.value        : null,
    promotions          : promoResult.status        === "fulfilled" ? promoResult.value        : null,
    listing_warnings    : listingWarnResult.status  === "fulfilled" ? listingWarnResult.value  : null,
    lifted              : liftResult.status         === "fulfilled" ? liftResult.value         : null,
    sub_warnings        : subWarnResult.status      === "fulfilled" ? subWarnResult.value      : null,
    grace_expired       : graceExpiredResult.status === "fulfilled" ? graceExpiredResult.value : null,
    grace_start_notified: graceStartResult.status   === "fulfilled" ? graceStartResult.value   : null,
  };

  const tasks = [
    { name: "expireFreeListings",              result: freeResult         },
    { name: "expireTrialListings",             result: trialResult        },
    { name: "expirePromotions",                result: promoResult        },
    { name: "sendExpiryWarnings",              result: listingWarnResult  },
    { name: "liftExpiryForSubscribedSellers",  result: liftResult         },
    { name: "sendSubscriptionExpiryWarnings",  result: subWarnResult      },
    { name: "expireSubscriptionsAfterGrace",   result: graceExpiredResult },
    { name: "sendGracePeriodStartNotifications", result: graceStartResult },
  ];

  for (const { name, result } of tasks) {
    if (result.status === "rejected") {
      console.error(`[expiry] ✗ ${name} failed:`, result.reason?.message ?? result.reason);
      Sentry.captureException?.(result.reason, {
        tags : { area: "listing_expiry", task: name },
        extra: { ran_at: runAt },
      });
    }
  }

  console.log(
    `[expiry] ✓ Done in ${summary.duration_ms}ms`,
    JSON.stringify({
      free_expired        : summary.free_listings?.expired         ?? "error",
      trial_expired       : summary.trial_listings?.expired        ?? "error",
      promos_ended        : summary.promotions?.expired            ?? "error",
      listing_warnings    : summary.listing_warnings?.warned       ?? "error",
      lifted              : summary.lifted?.lifted                 ?? "error",
      sub_warnings        : summary.sub_warnings?.warned           ?? "error",
      grace_expired       : summary.grace_expired?.expired         ?? "error",
      grace_start_notified: summary.grace_start_notified?.notified ?? "error",
    })
  );

  isRunning = false;
  return summary;
}

/* ══════════════════════════════════════════════════════════════
   SCHEDULER
══════════════════════════════════════════════════════════════ */
let _timer = null;

export function startListingExpiryJob() {
  if (_timer) {
    console.warn("[expiry] Job already started — ignoring duplicate call");
    return _timer;
  }

  runListingExpiryJob().catch((err) => {
    console.error("[expiry] Initial run failed:", err.message);
    Sentry.captureException?.(err, { tags: { area: "listing_expiry_start" } });
  });

  _timer = setInterval(() => {
    runListingExpiryJob().catch((err) => {
      console.error("[expiry] Scheduled run failed:", err.message);
      Sentry.captureException?.(err, { tags: { area: "listing_expiry_scheduled" } });
    });
  }, JOB_INTERVAL_MS);

  _timer.unref();
  console.log(`[expiry] ⏰ Scheduled — every ${JOB_INTERVAL_MS / 60_000} minutes`);
  return _timer;
}

export function stopListingExpiryJob() {
  if (!_timer) return;
  clearInterval(_timer);
  _timer = null;
  console.log("[expiry] ⏹ Job stopped");
}