import express      from "express";
import authenticate from "../../middleware/auth.js";
import { pool }     from "../../config/db.js";

import plansRouter               from "./plans.js";
import subscriptionPaymentsRouter from "./subscriptionPayments.js";

const router = express.Router();

// ── Mount sub-routers ─────────────────────────────────────────────────────────
router.use("/plans",    plansRouter);
router.use("/payments", subscriptionPaymentsRouter);


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscription
// Full subscription state for the authenticated user.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;

    const { rows: userRows } = await client.query(
      `SELECT
         u.subscription_plan,
         u.subscription_status,
         u.billing_cycle,
         u.subscription_started_at,
         u.subscription_expires_at,
         u.auto_renew,
         sp.id            AS plan_id,
         sp.name          AS plan_name,
         sp.badge         AS plan_badge,
         sp.features      AS plan_features,
         sp.rank          AS plan_rank,
         sp.monthly_price,
         sp.yearly_price
       FROM users u
       LEFT JOIN subscription_plans sp
         ON sp.slug      = u.subscription_plan
        AND sp.is_active = TRUE
       WHERE u.id = $1`,
      [userId]
    );

    if (!userRows.length) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = userRows[0];

    // Latest active subscription record
    const { rows: subRows } = await client.query(
      `SELECT
         id,
         plan_slug,
         billing_cycle,
         amount,
         payment_reference,
         status,
         auto_renew,
         started_at,
         expires_at,
         created_at
       FROM subscriptions
       WHERE user_id = $1
         AND status  = 'active'
       ORDER BY started_at DESC
       LIMIT 1`,
      [userId]
    );

    // Feature keys for the current plan
    let featureKeys = {};
    if (user.plan_id) {
      const { rows: featureRows } = await client.query(
        `SELECT feature_key, feature_value
         FROM subscription_features
         WHERE plan_id = $1`,
        [user.plan_id]
      );
      featureKeys = featureRows.reduce((acc, row) => {
        acc[row.feature_key] = row.feature_value;
        return acc;
      }, {});
    }

    const now       = new Date();
    const expiresAt = user.subscription_expires_at
      ? new Date(user.subscription_expires_at)
      : null;

    const isActive =
      user.subscription_status === "active" &&
      user.subscription_plan   !== "free"   &&
      expiresAt !== null                    &&
      expiresAt > now;

    const daysRemaining = expiresAt
      ? Math.max(
          0,
          Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
        )
      : 0;

    res.json({
      subscription: {
        plan:          user.subscription_plan,
        planId:        user.plan_id          ?? null,
        planName:      user.plan_name        ?? "Free Seller",
        planBadge:     user.plan_badge       ?? "",
        planFeatures:  user.plan_features    ?? [],
        planRank:      parseInt(user.plan_rank     ?? 0),
        monthlyPrice:  parseInt(user.monthly_price ?? 0),
        yearlyPrice:   parseInt(user.yearly_price  ?? 0),
        featureKeys,
        status:        user.subscription_status,
        billingCycle:  user.billing_cycle,
        startedAt:     user.subscription_started_at,
        expiresAt:     user.subscription_expires_at,
        autoRenew:     Boolean(user.auto_renew),
        isActive,
        daysRemaining,
        activeRecord:  subRows[0] ?? null,
      },
    });
  } catch (error) {
    console.error("[GET /subscription] error:", error);
    res.status(500).json({ message: "Failed to fetch subscription details." });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscription/status
// Lightweight — active/inactive state + plan identity only.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/status", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;

    const { rows } = await client.query(
      `SELECT
         u.subscription_plan,
         u.subscription_status,
         u.subscription_expires_at,
         u.auto_renew,
         sp.name  AS plan_name,
         sp.badge AS plan_badge,
         sp.rank  AS plan_rank
       FROM users u
       LEFT JOIN subscription_plans sp
         ON sp.slug      = u.subscription_plan
        AND sp.is_active = TRUE
       WHERE u.id = $1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = rows[0];

    const isActive =
      user.subscription_status === "active" &&
      user.subscription_plan   !== "free"   &&
      user.subscription_expires_at          &&
      new Date(user.subscription_expires_at) > new Date();

    res.json({
      plan:      user.subscription_plan,
      planName:  user.plan_name  ?? "Free Seller",
      planBadge: user.plan_badge ?? "",
      planRank:  parseInt(user.plan_rank ?? 0),
      status:    user.subscription_status,
      isActive,
      autoRenew: Boolean(user.auto_renew),
      expiresAt: user.subscription_expires_at,
    });
  } catch (error) {
    console.error("[GET /status] error:", error);
    res.status(500).json({ message: "Failed to fetch subscription status." });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscription/features
// All feature keys for the authenticated user's current plan.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/features", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;

    const { rows: userRows } = await client.query(
      `SELECT subscription_plan FROM users WHERE id = $1`,
      [userId]
    );

    if (!userRows.length) {
      return res.status(404).json({ message: "User not found." });
    }

    const planSlug = userRows[0].subscription_plan ?? "free";

    const { rows: featureRows } = await client.query(
      `SELECT sf.feature_key, sf.feature_value
       FROM subscription_features sf
       INNER JOIN subscription_plans sp
         ON sp.id = sf.plan_id
       WHERE sp.slug      = $1
         AND sp.is_active = TRUE`,
      [planSlug]
    );

    const features = featureRows.reduce((acc, row) => {
      acc[row.feature_key] = row.feature_value;
      return acc;
    }, {});

    res.json({ plan: planSlug, features });
  } catch (error) {
    console.error("[GET /features] error:", error);
    res.status(500).json({ message: "Failed to fetch plan features." });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscription/check-feature/:featureKey
// Whether the user's plan has a specific feature enabled.
// Example: GET /api/subscription/check-feature/featured_listings
// ─────────────────────────────────────────────────────────────────────────────
router.get("/check-feature/:featureKey", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId     = req.user.id;
    const featureKey = req.params.featureKey?.trim();

    if (!featureKey) {
      return res.status(400).json({ message: "featureKey param is required." });
    }

    const { rows } = await client.query(
      `SELECT sf.feature_value
       FROM users u
       INNER JOIN subscription_plans sp
         ON sp.slug      = u.subscription_plan
        AND sp.is_active = TRUE
       INNER JOIN subscription_features sf
         ON sf.plan_id    = sp.id
        AND sf.feature_key = $1
       WHERE u.id = $2`,
      [featureKey, userId]
    );

    if (!rows.length) {
      return res.json({
        featureKey,
        hasAccess:    false,
        featureValue: "false",
      });
    }

    const featureValue = rows[0].feature_value;
    const hasAccess    =
      featureValue !== "false" &&
      featureValue !== "0"     &&
      featureValue !== "";

    res.json({ featureKey, hasAccess, featureValue });
  } catch (error) {
    console.error("[GET /check-feature] error:", error);
    res.status(500).json({ message: "Failed to check feature access." });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscription/all
// Full subscription history for the authenticated user (all statuses).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/all", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;

    const { rows: subscriptions } = await client.query(
      `SELECT
         s.id,
         s.plan_slug,
         s.billing_cycle,
         s.amount,
         s.currency,
         s.payment_reference,
         s.status,
         s.auto_renew,
         s.started_at,
         s.expires_at,
         s.created_at,
         sp.name  AS plan_name,
         sp.badge AS plan_badge
       FROM subscriptions s
       LEFT JOIN subscription_plans sp
         ON sp.slug = s.plan_slug
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [userId]
    );

    res.json({
      subscriptions: subscriptions.map((sub) => ({
        ...sub,
        amountNaira: parseInt(sub.amount) / 100,
      })),
    });
  } catch (error) {
    console.error("[GET /all] error:", error);
    res.status(500).json({ message: "Failed to fetch subscription history." });
  } finally {
    client.release();
  }
});


export default router;