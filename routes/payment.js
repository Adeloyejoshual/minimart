// routes/payment.js
import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";
import { pool } from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();
const webhookRouter = express.Router();

/* =========================================================
   HELPERS
========================================================= */

const cleanInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const cleanUuid = (v) => {
  const s = String(v ?? "").trim();
  return s && s !== "null" && s !== "undefined" ? s : null;
};

const cleanEmail = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s.includes("@") ? s : null;
};

const verifySignature = (rawBody, secret, signature) => {
  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
};

/* =========================================================
   GET /plans  → Fetch all active promotion plans
========================================================= */

router.get("/plans", async (_, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id,
        name,
        price,
        duration,
        duration_days,
        priority,
        features
      FROM promotion_plans
      WHERE is_active = true
      ORDER BY sort_order ASC, price ASC
    `);

    return res.json({ success: true, plans: rows });
  } catch (err) {
    console.error("[PAYMENT] Load plans error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load plans" });
  }
});

/* =========================================================
   POST /initiate  → Start payment for a product
========================================================= */

router.post("/initiate", authenticate, async (req, res) => {
  const sellerId = cleanUuid(req.user.id);
  const productId = cleanUuid(req.body.product_id);
  const planId = cleanInt(req.body.plan_id);
  const email = cleanEmail(req.body.email);

  // ── Validation ──────────────────────────────────────
  if (!sellerId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  if (!productId) {
    return res.status(400).json({ success: false, message: "Product ID required" });
  }

  if (!planId) {
    return res.status(400).json({ success: false, message: "Plan ID required" });
  }

  if (!email) {
    return res.status(400).json({ success: false, message: "Valid email required" });
  }

  // ── Get plan price from DB (never trust frontend price) ──
  let planPrice;
  try {
    const { rows: planRows } = await pool.query(
      `SELECT id, price FROM promotion_plans WHERE id = $1 AND is_active = true`,
      [planId]
    );

    if (!planRows.length) {
      return res.status(400).json({ success: false, message: "Promotion plan not found" });
    }

    planPrice = Number(planRows[0].price);
  } catch (err) {
    console.error("[PAYMENT] Plan lookup error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to verify plan" });
  }

  // ── Lock + validate product ─────────────────────────
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify ownership + status
    const { rows: productRows } = await client.query(
      `SELECT id, seller_id, status, is_active
       FROM products
       WHERE id = $1
       AND seller_id = $2
       FOR UPDATE`,
      [productId, sellerId]
    );

    if (!productRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Product not found or not owned by you",
      });
    }

    const product = productRows[0];

    if (product.status === "active" && product.is_active) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Product is already active",
      });
    }

    if (!["draft", "pending_payment"].includes(product.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Cannot pay for product in '${product.status}' status`,
      });
    }

    // Mark as pending payment
    await client.query(
      `UPDATE products
       SET status = 'pending_payment', updated_at = NOW()
       WHERE id = $1`,
      [productId]
    );

    // Create payment record (pending)
    const { rows: paymentRows } = await client.query(
      `INSERT INTO payments
         (seller_id, product_id, plan_id, amount, email, status, type)
       VALUES ($1, $2, $3, $4, $5, 'pending', 'promotion')
       RETURNING id, reference`,
      [sellerId, productId, planId, planPrice, email]
    );

    const paymentId = paymentRows[0].id;

    await client.query("COMMIT");

    // ── Call Paystack ──────────────────────────────────
    if (!process.env.PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY not configured");
    }

    const paystackRes = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(planPrice * 100), // kobo
          callback_url: `${process.env.FRONTEND_URL}/payment/success`,
          reference: paymentRows[0].reference,
          metadata: {
            paymentId,
            productId,
            sellerId,
            planId,
          },
          custom_fields: [
            { display_name: "Seller ID", variable_name: "seller_id", value: sellerId },
            { display_name: "Product ID", variable_name: "product_id", value: productId },
            { display_name: "Plan ID", variable_name: "plan_id", value: String(planId) },
          ],
        }),
      }
    );

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      console.error("[PAYMENT] Paystack error:", paystackData);
      return res.status(502).json({
        success: false,
        message: paystackData.message ?? "Payment gateway failed",
      });
    }

    return res.json({
      success: true,
      reference: paystackData.data.reference,
      authorization_url: paystackData.data.authorization_url,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[PAYMENT] Initiate error:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message ?? "Payment initiation failed",
    });
  } finally {
    client.release();
  }
});

/* =========================================================
   GET /verify/:reference  → Manual verification
========================================================= */

router.get("/verify/:reference", authenticate, async (req, res) => {
  const reference = cleanUuid(req.params.reference);

  if (!reference) {
    return res.status(400).json({ success: false, message: "Reference required" });
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      }
    );

    const data = await response.json();

    if (!data.status || data.data?.status !== "success") {
      return res.json({ success: false, message: "Payment not successful" });
    }

    return res.json({ success: true, data: data.data });
  } catch (err) {
    console.error("[PAYMENT] Verify error:", err);
    return res.status(500).json({ success: false, message: "Verification failed" });
  }
});

/* =========================================================
   GET /seller/history  → Seller's payment history
========================================================= */

router.get("/seller/history", authenticate, async (req, res) => {
  const sellerId = cleanUuid(req.user.id);

  try {
    const { rows } = await pool.query(
      `SELECT 
         p.id,
         p.reference,
         p.amount,
         p.status,
         p.created_at,
         p.updated_at,
         pl.name AS plan_name,
         pr.title AS product_title
       FROM payments p
       LEFT JOIN promotion_plans pl ON pl.id = p.plan_id
       LEFT JOIN products pr ON pr.id = p.product_id
       WHERE p.seller_id = $1
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [sellerId]
    );

    return res.json({ success: true, history: rows });
  } catch (err) {
    console.error("[PAYMENT] History error:", err);
    return res.status(500).json({ success: false, message: "Failed to load history" });
  }
});

/* =========================================================
   GET /seller/stats  → Seller's promotion stats
========================================================= */

router.get("/seller/stats", authenticate, async (req, res) => {
  const sellerId = cleanUuid(req.user.id);

  try {
    // Active promotions count
    const { rows: activeRows } = await pool.query(
      `SELECT COUNT(*) AS active_count
       FROM products
       WHERE seller_id = $1 AND is_promoted = true AND status = 'active'`,
      [sellerId]
    );

    // Total paid promotions
    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*) AS total_paid, COALESCE(SUM(amount), 0) AS total_spent
       FROM payments
       WHERE seller_id = $1 AND status = 'success'`,
      [sellerId]
    );

    // Currently promoted products
    const { rows: promotedProducts } = await pool.query(
      `SELECT 
         id, title, slug, promotion_end, promotion_type
       FROM products
       WHERE seller_id = $1 AND is_promoted = true AND status = 'active'
       ORDER BY promotion_end DESC`,
      [sellerId]
    );

    return res.json({
      success: true,
      stats: {
        activePromotions: Number(activeRows[0].active_count),
        totalPaidPromotions: Number(totalRows[0].total_paid),
        totalSpent: Number(totalRows[0].total_spent),
        promotedProducts,
      },
    });
  } catch (err) {
    console.error("[PAYMENT] Stats error:", err);
    return res.status(500).json({ success: false, message: "Failed to load stats" });
  }
});

/* =========================================================
   WEBHOOK — /webhook (mounted with express.raw)
========================================================= */

webhookRouter.post("/", async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    console.error("[WEBHOOK] Missing PAYSTACK_SECRET_KEY");
    return res.sendStatus(500);
  }

  const signature = req.headers["x-paystack-signature"];

  if (!signature || !verifySignature(req.body, secret, signature)) {
    console.warn("[WEBHOOK] Invalid signature");
    return res.status(401).send("Invalid signature");
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf-8"));
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  // Only process successful charges
  if (event.event !== "charge.success") {
    return res.status(200).send("OK");
  }

  const reference = cleanUuid(event.data.reference);
  const metadata = event.data.metadata || {};
  const paymentId = cleanUuid(metadata.paymentId);
  const productId = cleanUuid(metadata.productId);
  const sellerId = cleanUuid(metadata.sellerId);
  const planId = cleanInt(metadata.planId);

  // Validate required fields
  if (!reference || !paymentId || !productId || !sellerId || !planId) {
    console.warn("[WEBHOOK] Missing metadata:", metadata);
    return res.status(200).send("OK");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Idempotency: Check if already processed ───────
    const { rows: existingPayment } = await client.query(
      `SELECT id, status FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId]
    );

    if (!existingPayment.length) {
      await client.query("ROLLBACK");
      console.warn("[WEBHOOK] Payment record not found:", paymentId);
      return res.status(200).send("OK");
    }

    if (existingPayment[0].status === "success") {
      await client.query("COMMIT");
      console.log("[WEBHOOK] Already processed, skipping:", reference);
      return res.status(200).send("OK");
    }

    // ── Verify product ownership ──────────────────────
    const { rows: productRows } = await client.query(
      `SELECT id, seller_id, status FROM products WHERE id = $1 FOR UPDATE`,
      [productId]
    );

    if (!productRows.length || productRows[0].seller_id !== sellerId) {
      await client.query("ROLLBACK");
      console.warn("[WEBHOOK] Product not found or ownership mismatch");
      return res.status(200).send("OK");
    }

    // ── Get plan details ──────────────────────────────
    const { rows: planRows } = await client.query(
      `SELECT id, name, duration_days, priority
       FROM promotion_plans
       WHERE id = $1 AND is_active = true`,
      [planId]
    );

    if (!planRows.length) {
      await client.query("ROLLBACK");
      console.warn("[WEBHOOK] Plan not found:", planId);
      return res.status(200).send("OK");
    }

    const plan = planRows[0];
    const expiresAt = new Date(Date.now() + (plan.duration_days * 24 * 60 * 60 * 1000));

    // ── Update payment record ─────────────────────────
    await client.query(
      `UPDATE payments
       SET status = 'success',
           updated_at = NOW(),
           metadata = $1
       WHERE id = $2`,
      [JSON.stringify({ paystack: event.data }), paymentId]
    );

    // ── Activate product ──────────────────────────────
    await client.query(
      `UPDATE products
       SET status = 'active',
           is_active = true,
           is_promoted = true,
           promotion_id = $1,
           promotion_start = NOW(),
           promotion_end = $2,
           promotion_expires_at = $2,
           promotion_type = $3,
           promotion_priority = $4,
           boost_score = COALESCE(boost_score, 0) + 50,
           updated_at = NOW()
       WHERE id = $5`,
      [planId, expiresAt, plan.name, plan.priority, productId]
    );

    // ── Increment seller's promoted count ─────────────
    await client.query(
      `UPDATE users
       SET products_count = COALESCE(products_count, 0) + 1
       WHERE id = $1`,
      [sellerId]
    );

    await client.query("COMMIT");

    console.log(`✅ [WEBHOOK] Activated: product=${productId} plan=${planId} seller=${sellerId}`);

    return res.status(200).send("OK");

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[WEBHOOK] Error:", err.message, err.stack);
    return res.status(200).send("OK"); // Always 200 to prevent retries
  } finally {
    client.release();
  }
});

export default router;
export { webhookRouter };