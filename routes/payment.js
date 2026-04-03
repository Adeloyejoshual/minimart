import express from "express";
import crypto from "crypto";
import axios from "axios";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= 1. INITIALIZE PAYMENT ================= */
router.post("/initialize", async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    const { email, amount, productId, planId } = req.body;

    /* VALIDATION */
    if (!email?.trim() || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }

    const product_id = productId; // UUID - no Number conversion
    const plan_id = planId ? BigInt(planId) : null; // INT8
    const amount_num = Number(amount);

    if (!product_id) {
      return res.status(400).json({ success: false, error: "Product ID required" });
    }

    if (!Number.isFinite(amount_num) || amount_num <= 0) {
      return res.status(400).json({ success: false, error: "Valid amount required" });
    }

    /* VERIFY PRODUCT EXISTS */
    const productCheck = await client.query(
      "SELECT id, state FROM products WHERE id = $1", [product_id]
    );

    if (!productCheck.rows.length) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    if (productCheck.rows[0].state === "active") {
      return res.status(400).json({ success: false, error: "Product already active" });
    }

    /* VERIFY PLAN (IF PROVIDED) */
    let plan = null;
    if (plan_id) {
      const planCheck = await client.query(
        "SELECT * FROM promotion_plans WHERE id = $1 AND price = $2 AND is_active = true", 
        [plan_id, amount_num]
      );
      plan = planCheck.rows[0];
      
      if (!plan) {
        return res.status(400).json({ success: false, error: "Invalid plan or price mismatch" });
      }
    }

    /* GENERATE UNIQUE REFERENCE + IDEMPOTENCY */
    const reference = `MINIMART_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const idempotency_key = crypto.randomUUID();

    /* SAVE PENDING PAYMENT - FULL SCHEMA */
    await client.query(
      `INSERT INTO payments (
        reference, amount, method, status, product_id, plan_id, 
        metadata, type, idempotency_key, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())`,
      [
        reference,
        amount_num,
        'paystack', // method
        'pending',  // status
        product_id,
        plan_id,
        JSON.stringify({ email: email.trim(), productId: product_id, planId: plan_id }),
        'promotion', // type
        idempotency_key
      ]
    );

    await client.query("COMMIT");

    console.log(`🔥 Payment init: ${reference} for product ${product_id} (${amount_num}₦)`);

    /* PAYSTACK REQUEST */
    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: email.trim(),
        amount: Math.round(amount_num * 100),
        currency: "NGN",
        reference,
        callback_url: `${process.env.FRONTEND_URL || ""}/add-product`,
        metadata: {
          productId: product_id,
          planId: plan_id,
          source: "minimart-marketplace"
        }
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );

    const paystackData = paystackRes.data.data;
    
    if (!paystackData.authorization_url) {
      throw new Error("Paystack returned invalid response");
    }

    res.json({
      success: true,
      authorization_url: paystackData.authorization_url,
      reference: paystackData.reference || reference,
      access_code: paystackData.access_code,
      idempotency_key
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("❌ Payment init failed:", error.message);
    res.status(500).json({ success: false, error: "Payment service unavailable" });
  } finally {
    client.release();
  }
});

/* ================= 2. PAYMENT VERIFY ================= */
router.post("/verify", async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { reference, productId: clientProductId } = req.body;
    const product_id = clientProductId;

    if (!reference?.trim()) {
      return res.status(400).json({ success: false, error: "Payment reference required" });
    }

    if (!product_id) {
      return res.status(400).json({ success: false, error: "Product ID required" });
    }

    console.log(`🔍 Verifying payment ${reference} for product ${product_id}`);

    await client.query("BEGIN");

    /* CHECK IDEMPOTENCY + STATUS_LOCK */
    const existingPayment = await client.query(
      `SELECT id, status, status_lock FROM payments 
       WHERE reference = $1 OR idempotency_key = $2 FOR UPDATE`,
      [reference.trim(), req.body.idempotency_key]
    );

    if (existingPayment.rows.length > 0) {
      const payment = existingPayment.rows[0];
      if (payment.status_lock) {
        await client.query("ROLLBACK");
        return res.status(409).json({ success: false, error: "Payment being processed" });
      }
      
      if (payment.status === 'success') {
        await client.query("ROLLBACK");
        return res.json({ success: true, message: "Payment already verified", status: payment.status });
      }
      
      if (payment.status === 'failed') {
        await client.query("ROLLBACK");
        return res.json({ success: false, error: "Payment failed" });
      }
    }

    /* UPDATE TO PROCESSING + LOCK */
    await client.query(
      "UPDATE payments SET status = 'processing', status_lock = true, updated_at = now() WHERE reference = $1",
      [reference.trim()]
    );

    /* VERIFY WITH PAYSTACK */
    const { data } = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference.trim()}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: 10000
      }
    );

    const paystackPayment = data.data;
    
    if (!paystackPayment || paystackPayment.status !== "success") {
      await client.query(
        "UPDATE payments SET status = 'failed', status_lock = false, updated_at = now() WHERE reference = $1",
        [reference.trim()]
      );
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "Payment not successful" });
    }

    /* VALIDATE PRODUCT */
    const verifiedProductId = paystackPayment.metadata?.productId || product_id;
    const productCheck = await client.query(
      "SELECT id, state FROM products WHERE id = $1 FOR UPDATE",
      [verifiedProductId]
    );

    if (!productCheck.rows.length || productCheck.rows[0].state === 'active') {
      await client.query(
        "UPDATE payments SET status = 'failed', status_lock = false, updated_at = now() WHERE reference = $1",
        [reference.trim()]
      );
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "Product invalid or active" });
    }

    /* GET PLAN INFO */
    const planId = paystackPayment.metadata?.planId ? BigInt(paystackPayment.metadata.planId) : null;
    let plan = null;
    let expiresAt = null;

    if (planId) {
      const planRes = await client.query(
        "SELECT * FROM promotion_plans WHERE id = $1 AND is_active = true",
        [planId]
      );
      plan = planRes.rows[0];

      if (plan?.duration && plan.duration !== "Always") {
        const daysMatch = plan.duration.match(/(d+)/);
        const days = daysMatch ? parseInt(daysMatch[1], 10) : 0;
        if (days > 0) {
          expiresAt = `now() + INTERVAL '${days} days'`;
        }
      }
    }

    /* UPDATE PAYMENT TO SUCCESS */
    await client.query(`
      UPDATE payments SET
        status = 'success',
        status_lock = false,
        method = 'paystack',
        amount = $2,
        updated_at = now()
      WHERE reference = $1
    `, [reference.trim(), paystackPayment.amount / 100]);

    /* ACTIVATE PRODUCT */
    const productUpdate = await client.query(`
      UPDATE products SET
        state = 'active',
        is_active = true,
        is_promoted = $2 IS NOT NULL,
        promotion_id = $2,
        promotion_priority = COALESCE((SELECT priority FROM promotion_plans WHERE id = $2), 1),
        promotion_start = CASE WHEN $2 IS NOT NULL THEN now() ELSE NULL END,
        promotion_expires_at = CASE WHEN $3 IS NOT NULL THEN $3 ELSE NULL END,
        updated_at = now()
      WHERE id = $1
      RETURNING id, title, state, is_promoted, promotion_expires_at
    `, [verifiedProductId, planId || null, expiresAt]);

    await client.query("COMMIT");

    console.log(`✅ Payment verified: ${reference} → Product ${verifiedProductId}`);

    res.json({
      success: true,
      reference: reference.trim(),
      product_id: verifiedProductId,
      product: productUpdate.rows[0],
      plan: plan ? { id: plan.id, name: plan.name, duration: plan.duration } : null
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(console.error);
    console.error("❌ Verify failed:", error.message);
    res.status(500).json({ success: false, error: "Verification failed" });
  } finally {
    client.release();
  }
});

/* ================= 3. PAYSTACK WEBHOOK ================= */
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let client;
  let event;
  
  try {
    /* VERIFY SIGNATURE */
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return res.sendStatus(500);

    const hash = crypto.createHmac("sha512", secret)
      .update(req.body)
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      console.warn("❌ Webhook signature invalid");
      return res.status(401).send("Unauthorized");
    }

    event = JSON.parse(req.body.toString());
    console.log(`📨 Webhook: ${event.event} (${event.data.reference})`);

    if (event.event !== "charge.success") {
      return res.status(200).send("OK");
    }

    const { reference, metadata, amount } = event.data;
    const productId = metadata?.productId || metadata?.product_id;
    const planId = metadata?.planId ? BigInt(metadata.planId) : null;

    if (!productId || !planId) {
      console.warn("❌ Missing metadata:", metadata);
      return res.status(200).send("OK");
    }

    client = await pool.connect();
    await client.query("BEGIN");

    /* IDEMPOTENCY + STATUS CHECK */
    const paymentCheck = await client.query(
      `SELECT status, status_lock FROM payments 
       WHERE reference = $1 FOR UPDATE`,
      [reference]
    );
    
    if (paymentCheck.rows.length > 0) {
      const payment = paymentCheck.rows[0];
      if (payment.status === 'success') {
        await client.query("COMMIT");
        client.release();
        return res.status(200).send("Already processed");
      }
      if (payment.status_lock) {
        await client.query("COMMIT");
        client.release();
        return res.status(200).send("Processing");
      }
    }

    /* LOCK + UPDATE TO SUCCESS */
    await client.query(`
      UPDATE payments SET
        status = 'success',
        status_lock = false,
        method = 'paystack',
        amount = $2,
        metadata = $3,
        updated_at = now()
      WHERE reference = $1
    `, [reference, amount / 100, JSON.stringify(metadata)]);

    /* VERIFY PRODUCT + ACTIVATE */
    const productCheck = await client.query(
      `SELECT state FROM products WHERE id = $1 FOR UPDATE`,
      [productId]
    );

    if (!productCheck.rows.length || productCheck.rows[0].state === 'active') {
      await client.query("COMMIT");
      client.release();
      return res.status(200).send("OK");
    }

    /* GET PLAN + CALCULATE EXPIRY */
    const planRes = await client.query(
      "SELECT id, name, duration, priority FROM promotion_plans WHERE id = $1 AND is_active = true",
      [planId]
    );

    const plan = planRes.rows[0];
    let expiresAt = null;
    
    if (plan?.duration && plan.duration !== "Always") {
      const daysMatch = plan.duration.match(/(d+)/);
      const days = daysMatch ? parseInt(daysMatch[1], 10) : 0;
      if (days > 0) {
        expiresAt = `now() + INTERVAL '${days} days'`;
      }
    }

    /* ACTIVATE PROMOTION */
    await client.query(`
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
    `, [planId, plan?.priority, productId]);

    await client.query("COMMIT");
    console.log(`✅ Webhook: Product ${productId} activated (${plan?.name || 'free'})`);

    res.status(200).send("OK");

  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(console.error);
      client.release();
    }
    console.error("❌ Webhook failed:", error.message);
    res.status(500).send("Internal error");
  }
});

/* ================= 4. FREE PLAN ================= */
router.post("/free-plan/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const client = await pool.connect();

    await client.query("BEGIN");

    /* CREATE FREE PAYMENT RECORD */
    const reference = `FREE_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await client.query(`
      INSERT INTO payments (reference, amount, method, status, product_id, plan_id, type, created_at, updated_at)
      VALUES ($1, 0, 'free', 'success', $2, 0, 'promotion', now(), now())
    `, [reference, productId]);

    /* ACTIVATE PRODUCT */
    const result = await client.query(`
      UPDATE products 
      SET state = 'active', 
          is_active = true, 
          is_promoted = true, 
          promotion_id = 0, 
          promotion_priority = 1,
          promotion_start = now(),
          updated_at = now()
      WHERE id = $1 AND state = 'draft'
      RETURNING *
    `, [productId]);

    await client.query("COMMIT");
    client.release();

    if (!result.rows.length) {
      return res.status(400).json({ success: false, error: "Cannot activate non-draft product" });
    }

    res.json({ 
      success: true, 
      product: result.rows[0],
      payment_reference: reference,
      message: "Product activated (free plan)"
    });

  } catch (error) {
    console.error("Free plan error:", error);
    res.status(500).json({ success: false, error: "Activation failed" });
  }
});

/* ================= HEALTH CHECK ================= */
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;