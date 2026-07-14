import express  from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscription/plans
// Public — all active plans with display features and machine-readable keys.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const { rows: plans } = await client.query(
      `SELECT
         id,
         slug,
         name,
         badge,
         monthly_price,
         yearly_price,
         rank,
         features
       FROM subscription_plans
       WHERE is_active = TRUE
       ORDER BY rank ASC`
    );

    if (!plans.length) {
      return res.json({ plans: [] });
    }

    // All feature rows for every active plan in one round-trip
    const { rows: featureRows } = await client.query(
      `SELECT
         sf.plan_id,
         sf.feature_key,
         sf.feature_value
       FROM subscription_features sf
       INNER JOIN subscription_plans sp
         ON sp.id = sf.plan_id
       WHERE sp.is_active = TRUE
       ORDER BY sf.plan_id, sf.feature_key`
    );

    // Group feature rows by plan_id → { planId: { key: value } }
    const featuresByPlanId = featureRows.reduce((acc, row) => {
      if (!acc[row.plan_id]) acc[row.plan_id] = {};
      acc[row.plan_id][row.feature_key] = row.feature_value;
      return acc;
    }, {});

    const formatted = plans.map((plan) => ({
      id:                plan.id,
      slug:              plan.slug,
      name:              plan.name,
      badge:             plan.badge,
      monthlyPrice:      parseInt(plan.monthly_price),
      yearlyPrice:       parseInt(plan.yearly_price),
      monthlyPriceNaira: parseInt(plan.monthly_price) / 100,
      yearlyPriceNaira:  parseInt(plan.yearly_price)  / 100,
      rank:              plan.rank,
      features:          plan.features,                   // JSONB display strings
      featureKeys:       featuresByPlanId[plan.id] ?? {}, // machine-readable flags
    }));

    res.json({ plans: formatted });
  } catch (error) {
    console.error("[GET /plans] error:", error);
    res.status(500).json({ message: "Failed to fetch subscription plans." });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscription/plans/compare/all
// Public — all plans side-by-side for a comparison table.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compare/all", async (req, res) => {
  const client = await pool.connect();

  try {
    const { rows: plans } = await client.query(
      `SELECT
         id,
         slug,
         name,
         badge,
         monthly_price,
         yearly_price,
         rank
       FROM subscription_plans
       WHERE is_active = TRUE
       ORDER BY rank ASC`
    );

    const { rows: featureRows } = await client.query(
      `SELECT
         sf.plan_id,
         sf.feature_key,
         sf.feature_value
       FROM subscription_features sf
       INNER JOIN subscription_plans sp
         ON sp.id = sf.plan_id
       WHERE sp.is_active = TRUE
       ORDER BY sf.feature_key, sp.rank`
    );

    // Unique feature keys in insertion order
    const featureKeySet = [
      ...new Set(featureRows.map((r) => r.feature_key)),
    ];

    // Group by plan_id
    const featuresByPlanId = featureRows.reduce((acc, row) => {
      if (!acc[row.plan_id]) acc[row.plan_id] = {};
      acc[row.plan_id][row.feature_key] = row.feature_value;
      return acc;
    }, {});

    const formattedPlans = plans.map((plan) => ({
      id:                plan.id,
      slug:              plan.slug,
      name:              plan.name,
      badge:             plan.badge,
      monthlyPriceNaira: parseInt(plan.monthly_price) / 100,
      yearlyPriceNaira:  parseInt(plan.yearly_price)  / 100,
      rank:              plan.rank,
      featureKeys:       featuresByPlanId[plan.id] ?? {},
    }));

    res.json({
      plans:       formattedPlans,
      featureKeys: featureKeySet,
    });
  } catch (error) {
    console.error("[GET /plans/compare/all] error:", error);
    res.status(500).json({ message: "Failed to fetch comparison data." });
  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscription/plans/:slug
// Public — single plan by slug with its feature keys.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:slug", async (req, res) => {
  const client = await pool.connect();

  try {
    const { slug } = req.params;

    const { rows: planRows } = await client.query(
      `SELECT
         id,
         slug,
         name,
         badge,
         monthly_price,
         yearly_price,
         rank,
         features
       FROM subscription_plans
       WHERE slug      = $1
         AND is_active = TRUE`,
      [slug]
    );

    if (!planRows.length) {
      return res.status(404).json({ message: `Plan "${slug}" not found.` });
    }

    const plan = planRows[0];

    const { rows: featureRows } = await client.query(
      `SELECT feature_key, feature_value
       FROM subscription_features
       WHERE plan_id = $1
       ORDER BY feature_key`,
      [plan.id]
    );

    const featureKeys = featureRows.reduce((acc, row) => {
      acc[row.feature_key] = row.feature_value;
      return acc;
    }, {});

    res.json({
      plan: {
        id:                plan.id,
        slug:              plan.slug,
        name:              plan.name,
        badge:             plan.badge,
        monthlyPrice:      parseInt(plan.monthly_price),
        yearlyPrice:       parseInt(plan.yearly_price),
        monthlyPriceNaira: parseInt(plan.monthly_price) / 100,
        yearlyPriceNaira:  parseInt(plan.yearly_price)  / 100,
        rank:              plan.rank,
        features:          plan.features,
        featureKeys,
      },
    });
  } catch (error) {
    console.error("[GET /plans/:slug] error:", error);
    res.status(500).json({ message: "Failed to fetch plan details." });
  } finally {
    client.release();
  }
});


export default router;