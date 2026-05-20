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

const cleanBigInt = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s : null;
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
   GET /plans
========================================================= */

router.get("/plans", async (_, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id::text,
        name,
        price,
        discount_percent,
        duration,
        duration_days,
        priority,
        features,
        (price * (1 - discount_percent / 100.0)) AS effective_price
      FROM promotion_plans
      WHERE is_active = true
      ORDER BY sort_order ASC, price ASC
    `);

    return res.json({ success: true, plans: rows });

  } catch (err) {
    console.error("[PAYMENT] GET /plans error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to load plans",
    });
  }
});

/* =========================================================
   POST /initiate
========================================================= */

router.post("/initiate", authenticate, async (req, res) => {

  console.log("[PAYMENT] /initiate called", {
    user:     req.user?.id,
    planId:   req.body.plan_id,
    planType: typeof req.body.plan_id,
  });

  const sellerId  = cleanUuid(req.user?.id);
  const productId = cleanUuid(req.body.product_id);
  const planId    = cleanBigInt(req.body.plan_id);
  const email     = cleanEmail(req.body.email);

  if (!sellerId)
    return res.status(401).json({ success: false, message: "Authentication required" });
  if (!productId)
    return res.status(400).json({ success: false, message: "Product ID required" });
  if (!planId)
    return res.status(400).json({
      success: false,
      message: `Plan ID required — received: ${JSON.stringify(req.body.plan_id)}`,
    });
  if (!email)
    return res.status(400).json({ success: false, message: "Valid email required" });

  // ── Look up plan outside transaction ─────────────────────
  let plan;
  let finalAmount;

  try {
    const { rows } = await pool.query(
      `SELECT
         id::text,
         name,
         price,
         discount_percent,
         duration_days,
         priority,
         (price * (1 - discount_percent / 100.0)) AS effective_price
       FROM promotion_plans
       WHERE id = $1 AND is_active = true`,
      [planId]
    );

    if (!rows.length)
      return res.status(400).json({
        success: false,
        message: `Promotion plan not found for id: ${planId}`,
      });

    plan        = rows[0];
    finalAmount = Number(plan.effective_price);

    if (!Number.isFinite(finalAmount) || finalAmount < 0)
      return res.status(500).json({
        success: false,
        message: "Invalid plan amount calculated",
      });

  } catch (err) {
    console.error("[PAYMENT] Plan lookup error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to verify plan" });
  }

  const reference = `mm_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
  const client    = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: productRows } = await client.query(
      `SELECT id, seller_id, status, is_active
       FROM products
       WHERE id = $1 AND seller_id = $2
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
      return res.status(409).json({ success: false, message: "Product already active" });
    }

    if (!["draft", "pending_payment"].includes(product.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Cannot pay from status '${product.status}'`,
      });
    }

    await client.query(
      `UPDATE products SET status = 'pending_payment', updated_at = NOW() WHERE id = $1`,
      [productId]
    );

    // ── Insert payment row ───────────────────────────────────
    let paymentId;
    let savedReference;

    try {
      const { rows: paymentRows } = await client.query(
        `INSERT INTO payments
           (seller_id, product_id, plan_id, amount, email,
            reference, status, type, method, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'promotion', 'paystack', $7)
         RETURNING id, reference`,
        [
          sellerId,
          productId,
          planId,
          finalAmount,
          email,
          reference,
          JSON.stringify({
            original_price:   plan.price,
            discount_percent: plan.discount_percent,
            effective_price:  finalAmount,
          }),
        ]
      );

      paymentId      = paymentRows[0].id;
      savedReference = paymentRows[0].reference;

      console.log("[PAYMENT] Payment row created:", paymentId);

    } catch (insertErr) {
      await client.query("ROLLBACK");
      console.error("[PAYMENT] Payment INSERT failed:", {
        message:    insertErr.message,
        code:       insertErr.code,
        column:     insertErr.column,
        detail:     insertErr.detail,
        constraint: insertErr.constraint,
      });
      return res.status(500).json({
        success:    false,
        message:    insertErr.message,
        code:       insertErr.code,
        detail:     insertErr.detail,
        column:     insertErr.column,
        constraint: insertErr.constraint,
      });
    }

    await client.query("COMMIT");

    // ── Call Paystack after commit ───────────────────────────
    let paystackData;
    try {
      const paystackRes = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method:  "POST",
          headers: {
            Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            amount:       Math.round(finalAmount * 100),
            reference:    savedReference,
            callback_url: `${process.env.FRONTEND_URL}/payment/success`,
            metadata: {
              paymentId,
              productId,
              sellerId,
              planId,
            },
          }),
        }
      );

      paystackData = await paystackRes.json();
      console.log("[PAYMENT] Paystack response status:", paystackData.status);

      if (!paystackRes.ok || !paystackData.status) {
        // Revert so seller can retry
        await pool.query(
          `UPDATE products SET status = 'draft', updated_at = NOW() WHERE id = $1`,
          [productId]
        );
        await pool.query(
          `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
          [paymentId]
        );
        return res.status(502).json({
          success: false,
          message: paystackData.message ?? "Payment initialization failed",
        });
      }

    } catch (paystackErr) {
      await pool.query(
        `UPDATE products SET status = 'draft', updated_at = NOW() WHERE id = $1`,
        [productId]
      );
      await pool.query(
        `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [paymentId]
      );
      console.error("[PAYMENT] Paystack network error:", paystackErr.message);
      return res.status(502).json({
        success: false,
        message: "Could not reach payment provider — please try again",
      });
    }

    return res.json({
      success:           true,
      reference:         savedReference,
      authorization_url: paystackData.data.authorization_url,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[PAYMENT] Unexpected error:", {
      message:    err.message,
      code:       err.code,
      detail:     err.detail,
      constraint: err.constraint,
    });
    return res.status(500).json({
      success:    false,
      message:    err.message,
      code:       err.code,
      detail:     err.detail,
      constraint: err.constraint,
    });
  } finally {
    client.release();
  }
});

/* =========================================================
   POST /verify
   Called by the frontend /payment/success page.
   Handles success, cancellation, and failed payments.
   Acts as a fallback if the webhook was slow or missed.
========================================================= */

router.post("/verify", authenticate, async (req, res) => {
  const reference = cleanUuid(req.body.reference);
  const sellerId  = cleanUuid(req.user?.id);

  if (!reference)
    return res.status(400).json({ success: false, message: "Reference required" });
  if (!sellerId)
    return res.status(401).json({ success: false, message: "Authentication required" });

  // ── Step 1: Ask Paystack what actually happened ───────────
  let paystackStatus;
  try {
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method:  "GET",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    const paystackData = await paystackRes.json();
    // "success" | "abandoned" | "failed" | "reversed"
    paystackStatus = paystackData?.data?.status;
    console.log("[VERIFY] Paystack status for", reference, ":", paystackStatus);
  } catch (err) {
    console.error("[VERIFY] Paystack verify error:", err.message);
    return res.status(502).json({
      success: false,
      message: "Could not reach payment provider",
    });
  }

  // ── Step 2: Find our payment row ──────────────────────────
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: paymentRows } = await client.query(
      `SELECT id, product_id, plan_id::text, status
       FROM payments
       WHERE reference = $1 AND seller_id = $2
       FOR UPDATE`,
      [reference, sellerId]
    );

    if (!paymentRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    const payment   = paymentRows[0];
    const productId = payment.product_id;
    const planId    = payment.plan_id;

    // Already successfully processed by webhook — just confirm
    if (payment.status === "success") {
      await client.query("ROLLBACK");
      return res.json({
        success: true,
        status:  "success",
        message: "Payment already confirmed — your product is live",
      });
    }

    // ── Step 3: Handle each Paystack status ──────────────────

    if (paystackStatus === "success") {
      // Webhook may have been slow — activate the product now
      // as a safe fallback. The webhook uses FOR UPDATE so
      // if both run at the same time, only one will proceed.
      const { rows: planRows } = await client.query(
        `SELECT name, duration_days, priority
         FROM promotion_plans
         WHERE id = $1`,
        [planId]
      );

      if (planRows.length) {
        const plan      = planRows[0];
        const expiresAt = new Date(
          Date.now() + plan.duration_days * 24 * 60 * 60 * 1000
        );

        await client.query(
          `UPDATE payments
           SET status = 'success', updated_at = NOW()
           WHERE id = $1`,
          [payment.id]
        );

        await client.query(
          `UPDATE products
           SET status               = 'active',
               is_active            = true,
               is_promoted          = true,
               promotion_id         = $1,
               promotion_start      = NOW(),
               promotion_end        = $2,
               promotion_expires_at = $2,
               promotion_type       = $3,
               promotion_priority   = $4,
               boost_score          = COALESCE(boost_score, 0) + 50,
               updated_at           = NOW()
           WHERE id = $5`,
          [planId, expiresAt, plan.name, plan.priority, productId]
        );
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        status:  "success",
        message: "Payment confirmed — your product is now live",
      });
    }

    // ── Cancelled ("abandoned") or failed — revert everything ─
    // "abandoned" = user closed the Paystack modal or pressed back
    // "failed"    = card was declined or insufficient funds
    const newPaymentStatus = paystackStatus === "abandoned"
      ? "cancelled"
      : "failed";

    await client.query(
      `UPDATE payments
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [newPaymentStatus, payment.id]
    );

    // Revert product to draft so the seller can edit and retry
    await client.query(
      `UPDATE products
       SET status    = 'draft',
           is_active = false,
           updated_at = NOW()
       WHERE id = $1`,
      [productId]
    );

    await client.query("COMMIT");

    console.log(
      `[VERIFY] Payment ${newPaymentStatus} — product ${productId} reverted to draft`
    );

    return res.json({
      success: false,
      status:  newPaymentStatus,
      message: paystackStatus === "abandoned"
        ? "Payment was cancelled — your listing has been saved as a draft"
        : "Payment failed — your listing has been saved as a draft. Please try again.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[VERIFY] DB error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Verification failed — please contact support",
    });
  } finally {
    client.release();
  }
});

/* =========================================================
   WEBHOOK — Paystack
   IMPORTANT: Mount with express.raw() in app.js:
   app.use("/api/payment/webhook", express.raw({ type: "*\/*" }), webhookRouter);
========================================================= */

webhookRouter.post("/", async (req, res) => {
  const secret    = process.env.PAYSTACK_SECRET_KEY;
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

  if (event.event !== "charge.success")
    return res.status(200).send("OK");

  const metadata  = event.data?.metadata ?? {};
  const paymentId = cleanUuid(metadata.paymentId);
  const productId = cleanUuid(metadata.productId);
  const sellerId  = cleanUuid(metadata.sellerId);
  const planId    = cleanBigInt(metadata.planId);

  if (!paymentId || !productId || !sellerId || !planId) {
    console.warn("[WEBHOOK] Missing metadata:", metadata);
    return res.status(200).send("OK");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // FOR UPDATE ensures webhook and /verify never double-process
    const { rows: paymentRows } = await client.query(
      `SELECT id, status FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId]
    );

    // Idempotency — already processed, do nothing
    if (!paymentRows.length || paymentRows[0].status === "success") {
      await client.query("ROLLBACK");
      return res.status(200).send("OK");
    }

    const { rows: planRows } = await client.query(
      `SELECT name, duration_days, priority
       FROM promotion_plans WHERE id = $1`,
      [planId]
    );

    if (!planRows.length) {
      await client.query("ROLLBACK");
      console.error(`[WEBHOOK] Plan ${planId} not found`);
      return res.status(200).send("OK");
    }

    const plan      = planRows[0];
    const expiresAt = new Date(
      Date.now() + plan.duration_days * 24 * 60 * 60 * 1000
    );

    await client.query(
      `UPDATE payments SET status = 'success', updated_at = NOW() WHERE id = $1`,
      [paymentId]
    );

    await client.query(
      `UPDATE products
       SET status               = 'active',
           is_active            = true,
           is_promoted          = true,
           promotion_id         = $1,
           promotion_start      = NOW(),
           promotion_end        = $2,
           promotion_expires_at = $2,
           promotion_type       = $3,
           promotion_priority   = $4,
           boost_score          = COALESCE(boost_score, 0) + 50,
           updated_at           = NOW()
       WHERE id = $5`,
      [planId, expiresAt, plan.name, plan.priority, productId]
    );

    await client.query("COMMIT");

    console.log(`✅ [WEBHOOK] Product ${productId} activated on plan ${plan.name}`);
    return res.status(200).send("OK");

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[WEBHOOK] Error:", err.message);
    return res.status(200).send("OK");
  } finally {
    client.release();
  }
});

export default router;
export { webhookRouter };