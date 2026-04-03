import express from "express";
import crypto from "crypto";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= PRODUCTION PAYSTACK WEBHOOK ================= */
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let client;
  
  try {
    /* ================= 1. VERIFY SIGNATURE ================= */
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.error("❌ PAYSTACK_SECRET_KEY missing");
      return res.sendStatus(500);
    }

    const hash = crypto.createHmac("sha512", secret)
      .update(req.body)
      .digest("hex");

    const signature = req.headers["x-paystack-signature"];
    if (hash !== signature) {
      console.warn("❌ Webhook signature invalid");
      return res.status(401).send("Unauthorized");
    }

    const event = JSON.parse(req.body.toString());
    console.log(`📨 Webhook: ${event.event} (${event.data.reference})`);

    /* ================= 2. HANDLE ONLY SUCCESS PAYMENTS ================= */
    if (event.event !== "charge.success") {
      console.log(`⏭️ Skipping event: ${event.event}`);
      return res.status(200).send("OK");
    }

    const { reference, metadata } = event.data;
    const productId = Number(metadata?.productId || metadata?.product_id);
    const planId = Number(metadata?.planId || metadata?.plan_id);

    /* ================= 3. EARLY VALIDATION ================= */
    if (!Number.isFinite(productId) || !Number.isFinite(planId)) {
      console.warn("❌ Missing productId/planId in metadata:", metadata);
      return res.status(200).send("OK");
    }

    client = await pool.connect();
    await client.query("BEGIN");

    /* ================= 4. IDEMPOTENCY CHECKS ================= */
    // Check payment already processed
    const paymentCheck = await client.query(
      "SELECT 1 FROM payments WHERE reference = $1 AND status = 'success'",
      [reference]
    );
    
    if (paymentCheck.rows.length > 0) {
      console.log(`⚠️ Duplicate webhook: ${reference}`);
      await client.query("COMMIT");
      client.release();
      return res.status(200).send("Already processed");
    }

    // Check product exists + not already active
    const productCheck = await client.query(
      `SELECT state FROM products WHERE id = $1 FOR UPDATE`,
      [productId]
    );

    if (!productCheck.rows.length) {
      console.warn(`❌ Product ${productId} not found`);
      await client.query("COMMIT");
      client.release();
      return res.status(200).send("OK");
    }

    const currentState = productCheck.rows[0].state;
    if (currentState === 'active') {
      console.log(`⚠️ Product ${productId} already active (state: ${currentState})`);
      await client.query("COMMIT");
      client.release();
      return res.status(200).send("Already active");
    }

    /* ================= 5. FETCH PLAN ================= */
    const planRes = await client.query(
      "SELECT id, name, duration, priority FROM promotion_plans WHERE id = $1",
      [planId]
    );

    const plan = planRes.rows[0];
    if (!plan) {
      console.warn(`❌ Plan ${planId} not found`);
      await client.query("COMMIT");
      client.release();
      return res.status(200).send("OK");
    }

    /* ================= 6. CALCULATE EXPIRY ================= */
    let expiresAt = null;
    if (plan.duration && plan.duration !== "Always") {
      // ✅ FIXED: Parse "7 days" → 7
      const daysMatch = plan.duration.match(/(d+)/);
      const days = daysMatch ? parseInt(daysMatch[1], 10) : 0;
      
      if (days > 0) {
        expiresAt = `now() + INTERVAL '${days} days'`;
      }
    }

    /* ================= 7. MARK PAYMENT SUCCESS ================= */
    await client.query(
      "INSERT INTO payments (reference, amount, status, product_id, plan_id, metadata, created_at) VALUES ($1, $2, 'success', $3, $4, $5, now()) ON CONFLICT (reference) DO NOTHING",
      [
        reference,
        event.data.amount / 100,
        productId,
        planId,
        JSON.stringify(metadata)
      ]
    );

    /* ================= 8. ACTIVATE PROMOTION ================= */
    // ✅ FIXED: UNIFIED SCHEMA MATCHING MAIN ROUTES
    const updateRes = await client.query(`
      UPDATE products SET
        state = 'active',
        is_active = true,
        is_promoted = true,
        promotion_id = $1,
        promotion_priority = COALESCE($2, 1),
        promotion_start = now(),
        promotion_expires_at = ${expiresAt || 'NULL'},
        updated_at = now()
      WHERE id = $3 AND state != 'active'
      RETURNING id, state, is_promoted
    `, [planId, plan.priority, productId]);

    await client.query("COMMIT");

    if (updateRes.rowCount > 0) {
      console.log(`✅ Webhook activated: Product ${productId} (${plan.name}) until ${expiresAt || 'forever'}`);
    } else {
      console.log(`⚠️ Webhook skipped (already active): ${productId}`);
    }

    res.status(200).send("OK");

  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(console.error);
      client.release();
    }
    
    console.error("❌ Webhook CRASH:", {
      event: event?.event,
      reference: event?.data?.reference,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).send("Internal error");
  }
});

/* ================= HEALTH CHECK ================= */
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;