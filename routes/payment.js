import express from "express";
import crypto  from "crypto";
import { pool } from "../config/db.js";   // shared pool — don't create a second one

const router        = express.Router();
const webhookRouter = express.Router({ mergeParams: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * promotion_plans.id is INT8 — never treat it as a UUID.
 * Returns a valid integer or null.
 */
const cleanInt = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Products / users use UUID primary keys.
 */
const cleanUuid = (value) => {
  const v = String(value ?? "").trim();
  return v && v !== "null" && v !== "undefined" ? v : null;
};

const cleanString = (value) => {
  const v = String(value ?? "").trim();
  return v || null;
};

const amountToNumber = (amount) => {
  const n = Number(amount);
  return Number.isFinite(n) ? n : null;
};

const getWebhookSignature = (req) => {
  const header = req.headers["x-paystack-signature"];
  return Array.isArray(header) ? header[0] : (header ?? null);
};

const verifyPaystackSignature = (rawBody, secret, signature) => {
  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
};

// ─── POST /initiate ────────────────────────────────────────────────────────────

router.post("/initiate", async (req, res) => {
  // Support both camelCase and snake_case keys from the frontend
  const { email, amount, plan_id, product_id, planId, productId } = req.body;

  const finalPlanId    = cleanInt(plan_id    ?? planId);     // INT8
  const finalProductId = cleanUuid(product_id ?? productId); // UUID
  const paymentEmail   = cleanString(email);
  const paymentAmount  = amountToNumber(amount);

  if (!paymentEmail) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }
  if (!paymentAmount || paymentAmount <= 0) {
    return res.status(400).json({ success: false, message: `Invalid amount: ${amount}` });
  }
  if (!finalPlanId) {
    return res.status(400).json({ success: false, message: "Valid numeric plan_id required" });
  }
  if (!finalProductId) {
    return res.status(400).json({ success: false, message: "Valid product_id required" });
  }

  // ── Validate + lock product in DB ────────────────────────────────────────────

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: productRows } = await client.query(
      `SELECT id, status, is_active FROM products WHERE id = $1 FOR UPDATE`,
      [finalProductId]
    );

    if (!productRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: `Product ${finalProductId} not found`,
      });
    }

    const { status: currentStatus, is_active } = productRows[0];

    if (currentStatus === "active" && is_active) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Product is already active",
      });
    }

    if (currentStatus !== "draft" && currentStatus !== "pending_payment") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Product cannot be paid from status '${currentStatus}'`,
      });
    }

    // Mark as pending so the user cannot submit twice
    await client.query(
      `UPDATE products SET status = 'pending_payment', updated_at = NOW() WHERE id = $1`,
      [finalProductId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Product validation error:", err);
    return res.status(500).json({ success: false, message: "Database validation failed" });
  } finally {
    client.release();
  }

  // ── Call Paystack ─────────────────────────────────────────────────────────────

  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY not configured");
    }

    const callbackUrl = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/payment/success`;

    const paystackRes = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email:        paymentEmail,
          amount:       Math.round(paymentAmount * 100), // kobo
          callback_url: callbackUrl,
          metadata: {
            // Store both shapes so the webhook can find them reliably
            planId:     finalPlanId,
            productId:  finalProductId,
            plan_id:    finalPlanId,
            product_id: finalProductId,
            custom_fields: [
              { display_name: "Plan ID",    variable_name: "plan_id",    value: String(finalPlanId) },
              { display_name: "Product ID", variable_name: "product_id", value: finalProductId },
            ],
          },
        }),
      }
    );

    const data = await paystackRes.json();

    if (!paystackRes.ok || !data.status || !data.data?.authorization_url) {
      console.error("Paystack response:", data);
      return res.status(502).json({
        success: false,
        message: data.message ?? "Paystack initialization failed",
      });
    }

    return res.json({
      success:           true,
      reference:         data.data.reference,
      authorization_url: data.data.authorization_url,
    });
  } catch (err) {
    console.error("Payment init error:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message ?? "Payment service unavailable",
    });
  }
});

// ─── GET /verify/:reference ────────────────────────────────────────────────────

router.get("/verify/:reference", async (req, res) => {
  const reference = cleanString(req.params.reference);

  if (!reference) {
    return res.status(400).json({ success: false, message: "Reference is required" });
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const data = await response.json();

    if (!data.status || data.data?.status !== "success") {
      return res.json({ success: false, message: "Payment not successful" });
    }

    return res.json({ success: true, data: data.data });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ success: false, message: "Verification failed" });
  }
});

// ─── POST /webhook ─────────────────────────────────────────────────────────────
//
//  Mounted in server.js with express.raw() before any body parsers, so
//  req.body is always a raw Buffer here.

webhookRouter.post("/", async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error("Missing PAYSTACK_SECRET_KEY");
    return res.sendStatus(500);
  }

  const signature = getWebhookSignature(req);
  const rawBody   = Buffer.isBuffer(req.body)
    ? req.body.toString("utf-8")
    : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body ?? {});

  if (!signature || !verifyPaystackSignature(rawBody, secret, signature)) {
    console.warn("Invalid webhook signature");
    return res.status(401).send("Unauthorized");
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  // Only handle successful charges — acknowledge everything else silently
  if (event.event !== "charge.success") {
    return res.status(200).send("OK");
  }

  const metadata = event.data?.metadata ?? {};
  const customFields = Array.isArray(metadata.custom_fields) ? metadata.custom_fields : [];

  const findCustom = (name) =>
    customFields.find((f) => f.variable_name === name)?.value ?? null;

  const productId = cleanUuid(
    metadata.productId   ??
    metadata.product_id  ??
    findCustom("product_id")
  );

  // INT8 plan id
  const planId = cleanInt(
    metadata.planId      ??
    metadata.plan_id     ??
    findCustom("plan_id")
  );

  if (!productId) {
    console.warn("Webhook: no productId in metadata", metadata);
    return res.status(200).send("OK");
  }

  try {
    // ── Guard: skip if already active ──────────────────────────────────────
    const { rows: existing } = await pool.query(
      `SELECT status, is_active FROM products WHERE id = $1`,
      [productId]
    );

    if (!existing.length) {
      console.warn("Webhook: product not found", productId);
      return res.status(200).send("OK");
    }

    if (existing[0].status === "active" && existing[0].is_active) {
      return res.status(200).send("OK");
    }

    // ── Look up plan to compute expiry ────────────────────────────────────
    //    Use duration_days (INT8) directly — don't parse the duration STRING
    let expiresAt          = null;
    let promotionPriority  = 0;
    let promotionType      = "standard";

    if (planId) {
      const { rows: planRows } = await pool.query(
        `SELECT name, duration_days, priority
         FROM promotion_plans
         WHERE id = $1 AND is_active = true`,
        [planId]
      );

      if (planRows.length) {
        const plan = planRows[0];
        promotionPriority = plan.priority ?? 0;
        promotionType     = plan.name     ?? "standard";

        if (plan.duration_days && plan.duration_days > 0) {
          expiresAt = new Date(
            Date.now() + plan.duration_days * 24 * 60 * 60 * 1000
          );
        }
      }
    }

    // ── Activate ──────────────────────────────────────────────────────────
    await pool.query(
      `UPDATE products
       SET
         status               = 'active',
         is_active            = true,
         is_promoted          = $1,
         promotion_id         = $2,
         promotion_start      = COALESCE(promotion_start, NOW()),
         promotion_end        = $3,
         promotion_expires_at = $3,
         promotion_priority   = $4,
         promotion_type       = $5,
         updated_at           = NOW()
       WHERE id = $6`,
      [
        planId != null,   // $1 — is_promoted true only when there's a real paid plan
        planId,           // $2
        expiresAt,        // $3 — both promotion_end and promotion_expires_at
        promotionPriority,// $4
        promotionType,    // $5
        productId,        // $6
      ]
    );

    console.log(`✅ Webhook activated product ${productId} with plan ${planId}`);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook DB error:", err.message);
    // Always return 200 to Paystack — retrying a DB error won't help
    // and Paystack will keep retrying on non-200s causing duplicate activations.
    return res.status(200).send("OK");
  }
});

export default router;
export { webhookRouter };
