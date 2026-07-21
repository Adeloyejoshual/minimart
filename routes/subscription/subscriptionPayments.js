/**
 * routes/subscription/payments.js
 *
 * Change from previous version:
 *  - activateSubscription() now calls liftExpiryForSubscriber()
 *    inside the same transaction, so the moment a seller pays:
 *      • All their paused listings go back to active
 *      • All their active_limited listings become full active
 *      • active_until is set to NULL on all of them (never expires)
 *    This is immediate — no waiting for the hourly cron.
 */

import express  from "express";
import axios    from "axios";
import { pool } from "../../config/db.js";
import authenticate from "../../middleware/auth.js";

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const generateReference = () => {
  const rand = Math.random().toString(36).substring(2, 14).toUpperCase();
  return `LOEMART_${rand}_${Date.now()}`;
};

const getExpiryDate = (cycle) => {
  const date = new Date();
  cycle === "yearly"
    ? date.setFullYear(date.getFullYear() + 1)
    : date.setMonth(date.getMonth() + 1);
  return date;
};

const verifyPaystackPayment = async (reference) => {
  const response = await axios.get(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      timeout: 15_000,
    }
  );

  const body = response.data;
  if (!body.status || body.data?.status !== "success") {
    throw new Error(
      body.data?.gateway_response ?? body.message ?? "Payment was not successful."
    );
  }

  return body.data;
};

/* ─────────────────────────────────────────────────────────────
   liftExpiryForSubscriber
   Called inside activateSubscription() — same transaction.

   Sets active_until = NULL and status = 'active' on every
   listing that belongs to this seller and is currently either:
     • paused        (free listing that expired before they subscribed)
     • active_limited (trial listing)
     • active        (already live but had a future active_until)

   After this call all the seller's non-deleted listings are
   permanently active with no expiry date.
───────────────────────────────────────────────────────────── */
const liftExpiryForSubscriber = async (client, userId) => {
  const { rowCount } = await client.query(
    `UPDATE public.products
     SET
       is_active    = TRUE,
       status       = 'active',
       active_until = NULL,
       updated_at   = NOW()
     WHERE seller_id  = $1
       AND status    <> 'deleted'
       AND is_deleted  = FALSE
       AND (
         status IN ('paused', 'active_limited')
         OR (status = 'active' AND active_until IS NOT NULL)
       )`,
    [userId]
  );

  if (rowCount > 0) {
    console.log(
      `[subscription] liftExpiry: ${rowCount} listing(s) made permanent for seller ${userId}`
    );
  }

  return rowCount ?? 0;
};

/* ─────────────────────────────────────────────────────────────
   activateSubscription
   Runs inside an already-open transaction (client passed in).
    1. Confirm plan is active.
    2. Supersede any existing active subscription.
    3. Insert new subscription record.
    4. Mirror state onto the user row.
    5. Sync search_priority on all user listings.
    6. Lift expiry on all user listings (NEW).
   Returns { subscriptionId, expiresAt, listingsLifted }
───────────────────────────────────────────────────────────── */
const activateSubscription = async (
  client,
  userId,
  planSlug,
  billingCycle,
  amountKobo,
  reference,
  metadata = {}
) => {
  /* 1. Confirm plan */
  const { rows: planRows } = await client.query(
    `SELECT id, slug, name, rank
     FROM subscription_plans
     WHERE slug      = $1
       AND is_active = TRUE`,
    [planSlug]
  );

  if (!planRows.length)
    throw new Error(`Plan "${planSlug}" not found or is currently inactive.`);

  const plan      = planRows[0];
  const now       = new Date();
  const expiresAt = getExpiryDate(billingCycle);

  /* 2. Supersede existing active subscription */
  await client.query(
    `UPDATE subscriptions
     SET status     = 'superseded',
         updated_at = NOW()
     WHERE user_id = $1
       AND status  = 'active'`,
    [userId]
  );

  /* 3. Insert new subscription */
  const { rows: subRows } = await client.query(
    `INSERT INTO subscriptions
       (user_id, plan_id, plan_slug, billing_cycle, amount, currency,
        payment_reference, status, auto_renew,
        started_at, expires_at, metadata, created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, 'NGN', $6, 'active', TRUE,
        $7, $8, $9, NOW(), NOW())
     RETURNING id, expires_at`,
    [
      userId,
      plan.id,
      plan.slug,
      billingCycle,
      amountKobo,
      reference,
      now,
      expiresAt,
      JSON.stringify(metadata),
    ]
  );

  const { id: subscriptionId, expires_at: subExpiresAt } = subRows[0];

  /* 4. Mirror onto user row */
  await client.query(
    `UPDATE users
     SET subscription_plan       = $1,
         subscription_status     = 'active',
         billing_cycle           = $2,
         subscription_started_at = $3,
         subscription_expires_at = $4,
         auto_renew              = TRUE,
         updated_at              = NOW()
     WHERE id = $5`,
    [plan.slug, billingCycle, now, expiresAt, userId]
  );

  /* 5. Sync search_priority on all listings */
  await client.query(
    `UPDATE products
     SET search_priority = $1,
         updated_at      = NOW()
     WHERE seller_id = $2
       AND status   <> 'deleted'`,
    [plan.rank, userId]
  );

  /* 6. Lift expiry immediately — this is the key new step */
  const listingsLifted = await liftExpiryForSubscriber(client, userId);

  return { subscriptionId, expiresAt: subExpiresAt, listingsLifted };
};

/* ─────────────────────────────────────────────────────────────
   GET /history
───────────────────────────────────────────────────────────── */
router.get("/history", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const page   = Math.max(1, parseInt(req.query.page  ?? "1", 10));
    const limit  = Math.min(50, parseInt(req.query.limit ?? "10", 10));
    const offset = (page - 1) * limit;

    const { rows: transactions } = await client.query(
      `SELECT
         pt.id,
         pt.reference,
         pt.provider,
         pt.amount,
         pt.currency,
         pt.status,
         pt.type,
         pt.paid_at,
         pt.created_at,
         s.plan_slug,
         sp.name  AS plan_name,
         sp.badge AS plan_badge
       FROM payment_transactions pt
       LEFT JOIN subscriptions s
         ON s.id = pt.subscription_id
       LEFT JOIN subscription_plans sp
         ON sp.slug = s.plan_slug
       WHERE pt.user_id = $1
       ORDER BY pt.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) AS total FROM payment_transactions WHERE user_id = $1`,
      [userId]
    );

    const total      = parseInt(countRows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    res.json({
      transactions: transactions.map((tx) => ({
        ...tx,
        amountNaira: parseInt(tx.amount, 10) / 100,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[GET /payments/history] error:", error);
    res.status(500).json({ message: "Failed to fetch payment history." });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /initiate
───────────────────────────────────────────────────────────── */
router.post("/initiate", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const { planSlug, cycle } = req.body;
    const userId = req.user.id;

    if (!planSlug || typeof planSlug !== "string")
      return res.status(400).json({ message: "planSlug is required." });

    if (!["monthly", "yearly"].includes(cycle))
      return res.status(400).json({ message: "cycle must be 'monthly' or 'yearly'." });

    const { rows: planRows } = await client.query(
      `SELECT id, slug, name, monthly_price, yearly_price, rank
       FROM subscription_plans
       WHERE slug      = $1
         AND is_active = TRUE
         AND slug     != 'free'`,
      [planSlug]
    );

    if (!planRows.length)
      return res.status(400).json({ message: "Invalid or inactive plan selected." });

    const plan = planRows[0];

    const { rows: userRows } = await client.query(
      `SELECT
         email,
         name,
         subscription_plan,
         subscription_status,
         subscription_expires_at,
         billing_cycle
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (!userRows.length)
      return res.status(404).json({ message: "User not found." });

    const user = userRows[0];

    const alreadyOnThisPlan =
      user.subscription_status    === "active" &&
      user.subscription_plan      === planSlug &&
      user.subscription_expires_at             &&
      new Date(user.subscription_expires_at) > new Date();

    if (alreadyOnThisPlan)
      return res.status(400).json({ message: "You are already subscribed to this plan." });

    /* Calculate charge with proration for upgrades */
    let amountKobo =
      cycle === "yearly"
        ? parseInt(plan.yearly_price,  10)
        : parseInt(plan.monthly_price, 10);

    const userIsActive =
      user.subscription_status === "active"   &&
      user.subscription_plan   !== "free"      &&
      user.subscription_expires_at             &&
      new Date(user.subscription_expires_at) > new Date();

    if (userIsActive) {
      const { rows: currentPlanRows } = await client.query(
        `SELECT monthly_price, yearly_price FROM subscription_plans WHERE slug = $1`,
        [user.subscription_plan]
      );

      if (currentPlanRows.length) {
        const cp           = currentPlanRows[0];
        const currentPrice =
          user.billing_cycle === "yearly"
            ? parseInt(cp.yearly_price,  10)
            : parseInt(cp.monthly_price, 10);

        const totalDays = user.billing_cycle === "yearly" ? 365 : 30;
        const daysRemaining = Math.max(
          0,
          Math.ceil(
            (new Date(user.subscription_expires_at) - new Date()) / 86_400_000
          )
        );
        const unusedValue = Math.floor((currentPrice * daysRemaining) / totalDays);
        amountKobo = Math.max(0, amountKobo - unusedValue);
      }
    }

    if (amountKobo === 0)
      return res.status(400).json({
        message:
          "No payment required — your upgrade credit covers the full amount. " +
          "Contact support if you need assistance.",
      });

    const reference   = generateReference();
    const callbackUrl = `${process.env.FRONTEND_URL}/subscription/callback/paystack`;

    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email       : user.email,
        amount      : amountKobo,
        reference,
        currency    : "NGN",
        callback_url: callbackUrl,
        metadata    : {
          user_id      : userId,
          plan_slug    : plan.slug,
          plan_name    : plan.name,
          billing_cycle: cycle,
          type         : "subscription",
          cancel_action: `${process.env.FRONTEND_URL}/seller/subscription`,
        },
      },
      {
        headers: {
          Authorization : `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15_000,
      }
    );

    if (!paystackRes.data.status)
      throw new Error(paystackRes.data.message ?? "Paystack initialization failed.");

    const authorizationUrl = paystackRes.data.data.authorization_url;

    await client.query(
      `INSERT INTO payment_transactions
         (user_id, reference, provider, amount, currency,
          status, type, created_at, updated_at)
       VALUES
         ($1, $2, 'paystack', $3, 'NGN', 'pending', 'subscription', NOW(), NOW())`,
      [userId, reference, amountKobo]
    );

    res.json({
      authorizationUrl,
      reference,
      amount      : amountKobo,
      amountNaira : amountKobo / 100,
      plan        : plan.slug,
      planName    : plan.name,
      cycle,
    });
  } catch (error) {
    console.error("[POST /payments/initiate] error:", error);
    res.status(500).json({
      message: error.message ?? "Payment initiation failed. Please try again.",
    });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /verify/paystack
───────────────────────────────────────────────────────────── */
router.post("/verify/paystack", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const { reference } = req.body;
    const userId = req.user.id;

    if (!reference || typeof reference !== "string")
      return res.status(400).json({ message: "reference is required." });

    /* Guard against double-processing */
    const { rows: existingRows } = await client.query(
      `SELECT id, status FROM payment_transactions WHERE reference = $1`,
      [reference]
    );

    if (existingRows.length && existingRows[0].status === "success")
      return res.status(409).json({
        message: "This payment reference has already been processed.",
      });

    const verifiedData = await verifyPaystackPayment(reference);

    const meta     = verifiedData.metadata ?? {};
    const planSlug = meta.plan_slug;
    const cycle    = meta.billing_cycle;

    if (!planSlug || !cycle)
      throw new Error("Plan details are missing from the payment metadata. Please contact support.");

    if (meta.user_id && meta.user_id !== userId)
      return res.status(403).json({ message: "This payment does not belong to your account." });

    const amountKobo = parseInt(verifiedData.amount, 10);

    await client.query("BEGIN");

    const { subscriptionId, expiresAt, listingsLifted } = await activateSubscription(
      client,
      userId,
      planSlug,
      cycle,
      amountKobo,
      reference,
      verifiedData
    );

    await client.query(
      `UPDATE payment_transactions
       SET status            = 'success',
           subscription_id   = $1,
           provider_response = $2,
           paid_at           = NOW(),
           updated_at        = NOW()
       WHERE reference = $3`,
      [subscriptionId, JSON.stringify(verifiedData), reference]
    );

    await client.query("COMMIT");

    const { rows: planRows } = await client.query(
      `SELECT name, badge FROM subscription_plans WHERE slug = $1`,
      [planSlug]
    );

    const planName  = planRows[0]?.name  ?? planSlug;
    const planBadge = planRows[0]?.badge ?? "";

    res.json({
      message       : `${planBadge} Your ${planName} subscription is now active!`,
      plan          : planSlug,
      planName,
      planBadge,
      expiresAt,
      billingCycle  : cycle,
      listingsLifted,   // how many listings were made permanent immediately
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /payments/verify/paystack] error:", error);

    if (req.body?.reference) {
      await pool.query(
        `UPDATE payment_transactions
         SET status = 'failed', updated_at = NOW()
         WHERE reference = $1`,
        [req.body.reference]
      ).catch(() => {});
    }

    res.status(400).json({
      message: error.message ?? "Payment verification failed. Contact support if you were charged.",
    });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /cancel
───────────────────────────────────────────────────────────── */
router.post("/cancel", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;

    const { rows: userRows } = await client.query(
      `SELECT subscription_status, subscription_expires_at FROM users WHERE id = $1`,
      [userId]
    );

    if (!userRows.length)
      return res.status(404).json({ message: "User not found." });

    const user = userRows[0];
    const isActive =
      user.subscription_status === "active"   &&
      user.subscription_expires_at             &&
      new Date(user.subscription_expires_at) > new Date();

    if (!isActive)
      return res.status(400).json({ message: "You have no active subscription to cancel." });

    await client.query("BEGIN");

    await client.query(
      `UPDATE subscriptions
       SET status = 'cancelled', auto_renew = FALSE, updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    /*
     * Only disable auto_renew — plan and expiry stay unchanged.
     * Listings continue running until subscription_expires_at.
     * The cron job's SUBSCRIBED_SELLER_GUARD checks expires_at > NOW()
     * so they stay live until then, then expire normally.
     */
    await client.query(
      `UPDATE users SET auto_renew = FALSE, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    await client.query("COMMIT");

    res.json({
      message  : "Your subscription has been cancelled. You will retain access until it expires.",
      expiresAt: user.subscription_expires_at,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /payments/cancel] error:", error);
    res.status(500).json({ message: "Failed to cancel subscription." });
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /toggle-auto-renew
───────────────────────────────────────────────────────────── */
router.post("/toggle-auto-renew", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId    = req.user.id;
    const autoRenew = req.body.autoRenew;

    if (typeof autoRenew !== "boolean")
      return res.status(400).json({ message: "autoRenew must be a boolean (true or false)." });

    const { rows: userRows } = await client.query(
      `SELECT subscription_status, subscription_expires_at FROM users WHERE id = $1`,
      [userId]
    );

    if (!userRows.length)
      return res.status(404).json({ message: "User not found." });

    const user = userRows[0];
    const isActive =
      user.subscription_status === "active"   &&
      user.subscription_expires_at             &&
      new Date(user.subscription_expires_at) > new Date();

    if (!isActive)
      return res.status(400).json({ message: "You have no active subscription to update." });

    await client.query("BEGIN");

    await client.query(
      `UPDATE users SET auto_renew = $1, updated_at = NOW() WHERE id = $2`,
      [autoRenew, userId]
    );

    await client.query(
      `UPDATE subscriptions SET auto_renew = $1, updated_at = NOW()
       WHERE user_id = $2 AND status = 'active'`,
      [autoRenew, userId]
    );

    await client.query("COMMIT");

    res.json({
      message: autoRenew
        ? "Auto-renew enabled. Your subscription will renew automatically."
        : "Auto-renew disabled. Your subscription will expire without renewing.",
      autoRenew,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /payments/toggle-auto-renew] error:", error);
    res.status(500).json({ message: "Failed to update auto-renew setting." });
  } finally {
    client.release();
  }
});

export default router;