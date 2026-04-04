import express from "express";
import crypto from "crypto";
import axios from "axios";
import { Pool } from "pg";

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

const PAYSTACK_URL = "https://api.paystack.co";
const TIMEOUT = 10000;

// ================= 1. INITIALIZE PAYMENT =================
router.post("/initialize", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { email, amount, productId, planId } = req.body;
    
    // Input validation
    if (!email?.trim() || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }
    
    const product_id = productId;
    const plan_id = planId ? BigInt(planId) : null;
    const amount_num = Number(amount);

    if (!product_id || !Number.isFinite(amount_num) || amount_num <= 0) {
      return res.status(400).json({ success: false, error: "Valid product ID and amount required" });
    }

    // Check product eligibility
    const product = await client.query(
      "SELECT id, state FROM products WHERE id = $1 FOR UPDATE",
      [product_id]
    ).then(r => r.rows[0]);

    if (!product || product.state === "active") {
      return res.status(400).json({ success: false, error: "Product not found or already active" });
    }

    // Validate plan if provided
    let plan = null;
    if (plan_id) {
      const planRes = await client.query(
        "SELECT id, name, price FROM promotion_plans WHERE id = $1 AND price = $2 AND is_active = true",
        [plan_id, amount_num]
      );
      plan = planRes.rows[0];
      if (!plan) {
        return res.status(400).json({ success: false, error: "Invalid promotion plan" });
      }
    }

    // Generate payment references
    const reference = `MINIMART_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const idempotency_key = crypto.randomUUID();

    // Create pending payment record
    await client.query(
      `INSERT INTO payments (reference, idempotency_key, amount, method, status, 
       product_id, plan_id, metadata, type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())`,
      [
        reference, idempotency_key, amount_num, "paystack", "pending",
        product_id, plan_id, JSON.stringify({ email: email.trim(), productId: product_id, planId: plan_id }),
        "promotion"
      ]
    );

    await client.query("COMMIT");

    // Initialize Paystack payment
    const paystackRes = await axios.post(
      `${PAYSTACK_URL}/transaction/initialize`,
      {
        email: email.trim(),
        amount: Math.round(amount_num * 100),
        currency: "NGN",
        reference,
        callback_url: `${process.env.FRONTEND_URL || ""}/add-product`,
        metadata: { productId: product_id, planId: plan_id, source: "minimart-marketplace" },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: TIMEOUT,
      }
    );

    const paystackData = paystackRes.data?.data;
    res.json({
      success: true,
      authorization_url: paystackData.authorization_url,
      reference,
      access_code: paystackData.access_code,
      idempotency_key,
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Payment init failed:", error.message);
    res.status(500).json({ success: false, error: "Payment initialization failed" });
  } finally {
    client.release();
  }
});

// ================= 2. VERIFY PAYMENT =================
router.post("/verify", async (req, res) => {
  const client = await pool.connect();
  try {
    const { reference, productId } = req.body;
    
    if (!reference?.trim() || !productId) {
      return res.status(400).json({ success: false, error: "Reference and product ID required" });
    }

    await client.query("BEGIN");

    // Idempotency & lock check
    const payment = await client.query(
      `SELECT id, status, status_lock FROM payments 
       WHERE reference = $1 OR idempotency_key = $2 FOR UPDATE`,
      [reference.trim(), req.body.idempotency_key]
    ).then(r => r.rows[0]);

    if (payment?.status_lock) {
      return res.status(409).json({ success: false, error: "Payment being processed" });
    }
    if (payment?.status === "success") {
      return res.json({ success: true, message: "Already verified", status: "success" });
    }
    if (payment?.status === "failed") {
      return res.status(400).json({ success: false, error: "Payment failed" });
    }

    // Mark as processing
    await client.query(
      `UPDATE payments SET status = 'processing', status_lock = true, updated_at = now()
       WHERE reference = $1`,
      [reference.trim()]
    );

    // Verify with Paystack
    const verifyRes = await axios.get(
      `${PAYSTACK_URL}/transaction/verify/${reference.trim()}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: TIMEOUT,
      }
    );

    const paystackPayment = verifyRes.data?.data;
    if (!paystackPayment?.status || paystackPayment.status !== "success") {
      await client.query(
        `UPDATE payments SET status = 'failed', status_lock = false WHERE reference = $1`,
        [reference.trim()]
      );
      throw new Error("Payment not successful on Paystack");
    }

    const verifiedProductId = paystackPayment.metadata?.productId || productId;
    
    // Validate product state
    const product = await client.query(
      "SELECT state FROM products WHERE id = $1 FOR UPDATE",
      [verifiedProductId]
    ).then(r => r.rows[0]);

    if (!product || product.state === "active") {
      await client.query(
        `UPDATE payments SET status = 'failed', status_lock = false WHERE reference = $1`,
        [reference.trim()]
      );
      throw new Error("Product invalid or already active");
    }

    // Process promotion plan
    const plan_id = paystackPayment.metadata?.planId ? BigInt(paystackPayment.metadata.planId) : null;
    const promotionData = await getPromotionData(client, plan_id);

    // Update payment as success
    await client.query(
      `UPDATE payments SET 
       status = 'success', status_lock = false, amount = $2, updated_at = now()
       WHERE reference = $1`,
      [reference.trim(), paystackPayment.amount / 100]
    );

    // Activate product
    await activateProduct(client, verifiedProductId, promotionData);

    await client.query("COMMIT");

    res.json({
      success: true,
      reference: reference.trim(),
      product_id: verifiedProductId,
      message: "Payment verified and product activated",
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Verify failed:", error.message);
    res.status(500).json({ success: false, error: "Verification failed" });
  } finally {
    client.release();
  }
});

// ================= 3. PAYSTACK WEBHOOK =================
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let client;
  try {
    // Verify webhook signature
    const signature = req.headers["x-paystack-signature"];
    const hash = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(req.body).digest("hex");

    if (hash !== signature) {
      console.warn("Invalid webhook signature");
      return res.status(401).send("Unauthorized");
    }

    const event = JSON.parse(req.body.toString());
    if (event.event !== "charge.success") {
      return res.status(200).send("OK");
    }

    const { reference, metadata } = event.data;
    const productId = metadata?.productId;
    const planId = metadata?.planId ? BigInt(metadata.planId) : null;

    if (!productId) {
      return res.status(200).send("OK");
    }

    client = await pool.connect();
    await client.query("BEGIN");

    // Idempotency check
    const payment = await client.query(
      `SELECT status, status_lock FROM payments WHERE reference = $1 FOR UPDATE`,
      [reference]
    ).then(r => r.rows[0]);

    if (payment?.status === "success" || payment?.status_lock) {
      await client.query("COMMIT");
      return res.status(200).send("OK");
    }

    // Mark payment success
    await client.query(
      `UPDATE payments SET status = 'success', status_lock = false, updated_at = now()
       WHERE reference = $1`,
      [reference]
    );

    // Activate product promotion
    const promotionData = await getPromotionData(client, planId);
    await activateProduct(client, productId, promotionData);

    await client.query("COMMIT");
    console.log(`✅ Webhook processed: ${reference}`);

    res.status(200).send("OK");
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Webhook failed:", error.message);
    res.status(500).send("Internal error");
  } finally {
    client?.release();
  }
});

// ================= 4. FREE PROMOTION =================
router.post("/free-plan/:productId", async (req, res) => {
  const client = await pool.connect();
  try {
    const { productId } = req.params;
    await client.query("BEGIN");

    const reference = `FREE_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Create free payment record
    await client.query(
      `INSERT INTO payments (reference, amount, method, status, product_id, plan_id, type)
       VALUES ($1, 0, 'free', 'success', $2, 0, 'promotion')`,
      [reference, productId]
    );

    // Activate with free promotion (priority 1)
    await activateProduct(client, productId, { plan_id: 0, priority: 1, expires_at: null });

    await client.query("COMMIT");

    res.json({
      success: true,
      reference,
      message: "Product activated with free promotion",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Free plan failed:", error);
    res.status(500).json({ success: false, error: "Activation failed" });
  } finally {
    client.release();
  }
});

// ================= UTILITY FUNCTIONS =================
async function getPromotionData(client, plan_id) {
  if (!plan_id || plan_id === 0n) {
    return { plan_id: 0n, priority: 1, expires_at: null };
  }

  const plan = await client.query(
    "SELECT id, duration, priority FROM promotion_plans WHERE id = $1 AND is_active = true",
    [plan_id]
  ).then(r => r.rows[0]);

  let expires_at = null;
  if (plan?.duration && plan.duration !== "Always") {
    const days = parseInt(plan.duration) || 0;
    if (days > 0) {
      expires_at = `now() + INTERVAL '${days} days'`;
    }
  }

  return {
    plan_id,
    priority: plan?.priority || 1,
    expires_at,
    plan_name: plan?.name
  };
}

async function activateProduct(client, product_id, promotionData) {
  await client.query(
    `UPDATE products SET
      state = 'active',
      is_active = true,
      is_promoted = $2 IS NOT NULL,
      promotion_id = $2,
      promotion_priority = $3,
      promotion_start = now(),
      promotion_expires_at = CASE 
        WHEN $4 IS NOT NULL THEN $4 
        ELSE NULL 
      END,
      updated_at = now()
     WHERE id = $1 AND state != 'active'`,
    [
      product_id,
      promotionData.plan_id,
      promotionData.priority,
      promotionData.expires_at
    ]
  );
}

// ================= HEALTH CHECK =================
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;