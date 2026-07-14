import express      from "express";
import axios        from "axios";
import { pool }     from "../../config/db.js";
import authenticate from "../../middleware/auth.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
      timeout: 15000,
    }
  );

  const body = response.data;

  if (!body.status || body.data?.status !== "success") {
    throw new Error(
      body.data?.gateway_response ??
        body.message ??
        "Payment was not successful."
    );
  }

  return body.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// activateSubscription
// Runs inside an already-open transaction (client passed in).
// 1. Confirms plan is active.
// 2. Supersedes any existing active subscription.
// 3. Inserts new subscription record.
// 4. Mirrors state onto the user row.
// 5. Syncs search_priority on all user listings.
// Returns { subscriptionId, expiresAt }
// ─────────────────────────────────────────────────────────────────────────────
const activateSubscription = async (
  client,
  userId,
  planSlug,
  billingCycle,
  amountKobo,
  reference,
  metadata = {}
) => {
  const { rows: planRows } = await client.query(
    `SELECT id, slug, name, rank
     FROM subscription_plans
     WHERE slug      = $1
       AND is_active = TRUE`,
    [planSlug]
  );

  if (!planRows.length) {
    throw new Error(`Plan "${planSlug}" not found or is currently inactive.`);
  }

  const plan      = planRows[0];
  const now       = new Date();
  const expiresAt = getExpiryDate(billingCycle);

  // Supersede any currently active subscription
  await client.query(
    `UPDATE subscriptions
     SET status     = 'superseded',
         updated_at = NOW()
     WHERE user_id = $1
       AND status  = 'active'`,
    [userId]
  );

  // Insert the new subscription record
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

  // Mirror subscription state onto user row for fast lookups
  await client.query(
    `UPDATE users
     SET subscription_plan        = $1,
         subscription_status      = 'active',
         billing_cycle            = $2,
         subscription_started_at  = $3,
         subscription_expires_at  = $4,
         auto_renew               = TRUE,
         updated_at               = NOW()
     WHERE id = $5`,
    [plan.slug, billingCycle, now, expiresAt, userId]
  );

  // Sync search_priority on all of this user's listings
  await client.query(
    `UPDATE listings
     SET search_priority = $1,
         updated_at      = NOW()
     WHERE user_id = $2`,
    [plan.rank, userId]
  );

  return { subscriptionId, expiresAt: subExpiresAt };
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscription/payments/history?page=1&limit=10
// Paginated payment transaction history for the authenticated user.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/history", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const page   = Math.max(1, parseInt(req.query.page  ?? "1"));
    const limit  = Math.min(50, parseInt(req.query.limit ?? "10"));
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
      `SELECT COUNT(*) AS total
       FROM payment_transactions
       WHERE user_id = $1`,
      [userId]
    );

    const total      = parseInt(countRows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      transactions: transactions.map((tx) => ({
        ...tx,
        amountNaira: parseInt(tx.amount) / 100,
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


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscription/payments/initiate
// Body: { planSlug, cycle }
// Initializes a Paystack transaction and returns the authorization URL.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/initiate", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const { planSlug, cycle } = req.body;
    const userId = req.user.id;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!planSlug || typeof planSlug !== "string") {
      return res.status(400).json({ message: "planSlug is required." });
    }

    if (!["monthly", "yearly"].includes(cycle)) {
      return res.status(400).json({
        message: "cycle must be 'monthly' or 'yearly'.",
      });
    }

    // ── Fetch the selected plan ───────────────────────────────────────────────
    const { rows: planRows } = await client.query(
      `SELECT id, slug, name, monthly_price, yearly_price, rank
       FROM subscription_plans
       WHERE slug      = $1
         AND is_active = TRUE
         AND slug     != 'free'`,
      [planSlug]
    );

    if (!planRows.length) {
      return res.status(400).json({
        message: "Invalid or inactive plan selected.",
      });
    }

    const plan = planRows[0];

    // ── Fetch user ────────────────────────────────────────────────────────────
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

    if (!userRows.length) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = userRows[0];

    // ── Guard: already on this exact plan and active ──────────────────────────
    const alreadyOnThisPlan =
      user.subscription_status === "active"  &&
      user.subscription_plan   === planSlug  &&
      user.subscription_expires_at           &&
      new Date(user.subscription_expires_at) > new Date();

    if (alreadyOnThisPlan) {
      return res.status(400).json({
        message: "You are already subscribed to this plan.",
      });
    }

    // ── Calculate charge amount with proration for upgrades ───────────────────
    let amountKobo =
      cycle === "yearly"
        ? parseInt(plan.yearly_price)
        : parseInt(plan.monthly_price);

    const userIsActive =
      user.subscription_status === "active" &&
      user.subscription_plan   !== "free"   &&
      user.subscription_expires_at          &&
      new Date(user.subscription_expires_at) > new Date();

    if (userIsActive) {
      const { rows: currentPlanRows } = await client.query(
        `SELECT monthly_price, yearly_price
         FROM subscription_plans
         WHERE slug = $1`,
        [user.subscription_plan]
      );

      if (currentPlanRows.length) {
        const cp           = currentPlanRows[0];
        const currentPrice =
          user.billing_cycle === "yearly"
            ? parseInt(cp.yearly_price)
            : parseInt(cp.monthly_price);

        const totalDays = user.billing_cycle === "yearly" ? 365 : 30;

        const daysRemaining = Math.max(
          0,
          Math.ceil(
            (new Date(user.subscription_expires_at) - new Date()) /
              (1000 * 60 * 60 * 24)
          )
        );

        const unusedValue = Math.floor(
          (currentPrice * daysRemaining) / totalDays
        );

        amountKobo = Math.max(0, amountKobo - unusedValue);
      }
    }

    if (amountKobo === 0) {
      return res.status(400).json({
        message:
          "No payment required — your upgrade credit covers the full amount. " +
          "Contact support if you need assistance.",
      });
    }

    // ── Initialize Paystack transaction ───────────────────────────────────────
    const reference   = generateReference();
    const callbackUrl = `${process.env.FRONTEND_URL}/subscription/callback/paystack`;

    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email:        user.email,
        amount:       amountKobo,
        reference,
        currency:     "NGN",
        callback_url: callbackUrl,
        metadata: {
          user_id:       userId,
          plan_slug:     plan.slug,
          plan_name:     plan.name,
          billing_cycle: cycle,
          type:          "subscription",
          cancel_action: `${process.env.FRONTEND_URL}/seller/subscription`,
        },
      },
      {
        headers: {
          Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    if (!paystackRes.data.status) {
      throw new Error(
        paystackRes.data.message ?? "Paystack initialization failed."
      );
    }

    const authorizationUrl = paystackRes.data.data.authorization_url;

    // ── Save pending transaction record ───────────────────────────────────────
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
      amount:      amountKobo,
      amountNaira: amountKobo / 100,
      plan:        plan.slug,
      planName:    plan.name,
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


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscription/payments/verify/paystack
// Body: { reference }
// Verifies the Paystack payment then activates the subscription.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/verify/paystack", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const { reference } = req.body;
    const userId = req.user.id;

    if (!reference || typeof reference !== "string") {
      return res.status(400).json({ message: "reference is required." });
    }

    // ── Guard against double-processing ──────────────────────────────────────
    const { rows: existingRows } = await client.query(
      `SELECT id, status
       FROM payment_transactions
       WHERE reference = $1`,
      [reference]
    );

    if (existingRows.length && existingRows[0].status === "success") {
      return res.status(409).json({
        message: "This payment reference has already been processed.",
      });
    }

    // ── Verify with Paystack ──────────────────────────────────────────────────
    const verifiedData = await verifyPaystackPayment(reference);

    const meta     = verifiedData.metadata ?? {};
    const planSlug = meta.plan_slug;
    const cycle    = meta.billing_cycle;

    if (!planSlug || !cycle) {
      throw new Error(
        "Plan details are missing from the payment metadata. " +
          "Please contact support."
      );
    }

    if (meta.user_id && meta.user_id !== userId) {
      return res.status(403).json({
        message: "This payment does not belong to your account.",
      });
    }

    const amountKobo = parseInt(verifiedData.amount);

    // ── Begin transaction ─────────────────────────────────────────────────────
    await client.query("BEGIN");

    const { subscriptionId, expiresAt } = await activateSubscription(
      client,
      userId,
      planSlug,
      cycle,
      amountKobo,
      reference,
      verifiedData
    );

    // Mark transaction as successful and link to the new subscription
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
    // ── End transaction ───────────────────────────────────────────────────────

    // Fetch plan display info for the success response
    const { rows: planRows } = await client.query(
      `SELECT name, badge
       FROM subscription_plans
       WHERE slug = $1`,
      [planSlug]
    );

    const planName  = planRows[0]?.name  ?? planSlug;
    const planBadge = planRows[0]?.badge ?? "";

    res.json({
      message:      `${planBadge} Your ${planName} subscription is now active!`,
      plan:         planSlug,
      planName,
      planBadge,
      expiresAt,
      billingCycle: cycle,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("[POST /payments/verify/paystack] error:", error);

    // Mark transaction as failed so the user can retry
    if (req.body?.reference) {
      await pool
        .query(
          `UPDATE payment_transactions
           SET status     = 'failed',
               updated_at = NOW()
           WHERE reference = $1`,
          [req.body.reference]
        )
        .catch(() => {});
    }

    res.status(400).json({
      message:
        error.message ??
        "Payment verification failed. Contact support if you were charged.",
    });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscription/payments/cancel
// Cancels the active subscription.
// User retains access until subscription_expires_at.
// Actual revert to Free plan is handled by the cron job.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/cancel", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;

    const { rows: userRows } = await client.query(
      `SELECT subscription_status, subscription_expires_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (!userRows.length) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = userRows[0];

    const isActive =
      user.subscription_status === "active" &&
      user.subscription_expires_at          &&
      new Date(user.subscription_expires_at) > new Date();

    if (!isActive) {
      return res.status(400).json({
        message: "You have no active subscription to cancel.",
      });
    }

    await client.query("BEGIN");

    await client.query(
      `UPDATE subscriptions
       SET status     = 'cancelled',
           auto_renew = FALSE,
           updated_at = NOW()
       WHERE user_id = $1
         AND status  = 'active'`,
      [userId]
    );

    // Only disable auto_renew on user — plan and expiry stay unchanged.
    // The cron job handles the actual revert to free when expires_at passes.
    await client.query(
      `UPDATE users
       SET auto_renew = FALSE,
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    await client.query("COMMIT");

    res.json({
      message:
        "Your subscription has been cancelled. " +
        "You will retain access until it expires.",
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


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscription/payments/toggle-auto-renew
// Body: { autoRenew: true | false }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/toggle-auto-renew", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId    = req.user.id;
    const autoRenew = req.body.autoRenew;

    if (typeof autoRenew !== "boolean") {
      return res.status(400).json({
        message: "autoRenew must be a boolean (true or false).",
      });
    }

    const { rows: userRows } = await client.query(
      `SELECT subscription_status, subscription_expires_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (!userRows.length) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = userRows[0];

    const isActive =
      user.subscription_status === "active" &&
      user.subscription_expires_at          &&
      new Date(user.subscription_expires_at) > new Date();

    if (!isActive) {
      return res.status(400).json({
        message: "You have no active subscription to update.",
      });
    }

    await client.query("BEGIN");

    await client.query(
      `UPDATE users
       SET auto_renew = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [autoRenew, userId]
    );

    await client.query(
      `UPDATE subscriptions
       SET auto_renew = $1,
           updated_at = NOW()
       WHERE user_id = $2
         AND status  = 'active'`,
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