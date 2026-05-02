import express from "express";
import { Pool } from "pg";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const webhookRouter = express.Router({ mergeParams: true });

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

router.use(express.json({ limit: "10mb" }));
router.use(express.urlencoded({ extended: true }));

router.use((req, res, next) => {
  if (req.method === "POST" && req.path.includes("initiate")) {
    console.log(`🔸 [${new Date().toISOString()}] ${req.path}:`, {
      body: req.body,
      headers: { "content-type": req.get("content-type") },
    });
  }
  next();
});

const cleanUuid = (value) => {
  const v = String(value || "").trim();
  return v && v !== "null" && v !== "undefined" ? v : null;
};

const cleanString = (value) => {
  const v = String(value || "").trim();
  return v || null;
};

const amountToNumber = (amount) => {
  const n = Number(amount);
  return Number.isFinite(n) ? n : null;
};

const getWebhookSignature = (req) => {
  const header = req.headers["x-paystack-signature"];
  return Array.isArray(header) ? header[0] : header;
};

const verifyPaystackSignature = (rawBody, secret, signature) => {
  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
};

/* ===================== PAYSTACK INITIATE ===================== */
router.post("/initiate", async (req, res) => {
  const { email, amount, plan_id, product_id, planId, productId } = req.body;

  const finalPlanId = cleanUuid(plan_id || planId);
  const finalProductId = cleanUuid(product_id || productId);
  const paymentEmail = cleanString(email);
  const paymentAmount = amountToNumber(amount);

  if (!paymentEmail) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  if (!paymentAmount || paymentAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: `Invalid amount: ${amount}`,
    });
  }

  if (!finalPlanId) {
    return res.status(400).json({
      success: false,
      message: "plan_id or planId required",
    });
  }

  if (!finalProductId) {
    return res.status(400).json({
      success: false,
      message: "product_id or productId required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productCheck = await client.query(
      "SELECT id, status, is_active FROM products WHERE id = $1 FOR UPDATE",
      [finalProductId]
    );

    if (!productCheck.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: `Product ${finalProductId} not found`,
      });
    }

    const currentStatus = productCheck.rows[0].status;

    if (currentStatus === "active" && productCheck.rows[0].is_active) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Product ${finalProductId} is already active`,
      });
    }

    if (currentStatus !== "draft" && currentStatus !== "pending_payment") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Product ${finalProductId} cannot be paid from status ${currentStatus}`,
      });
    }

    await client.query(
      `UPDATE products
       SET status = 'pending_payment',
           updated_at = NOW()
       WHERE id = $1`,
      [finalProductId]
    );

    await client.query("COMMIT");
  } catch (dbErr) {
    await client.query("ROLLBACK");
    console.error("Product validation error:", dbErr);
    return res.status(500).json({
      success: false,
      message: "Database validation failed",
    });
  } finally {
    client.release();
  }

  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY not configured");
    }

    const callbackUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/success`;

    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: paymentEmail,
          amount: Math.round(paymentAmount * 100),
          callback_url: callbackUrl,
          metadata: {
            planId: finalPlanId,
            productId: finalProductId,
            plan_id: finalPlanId,
            product_id: finalProductId,
            custom_fields: [
              {
                display_name: "Plan ID",
                variable_name: "plan_id",
                value: finalPlanId,
              },
              {
                display_name: "Product ID",
                variable_name: "product_id",
                value: finalProductId,
              },
            ],
          },
        }),
      }
    );

    const data = await paystackResponse.json();

    if (!paystackResponse.ok || !data.status || !data.data?.authorization_url) {
      console.error("Paystack response:", data);
      return res.status(500).json({
        success: false,
        message: data.message || "Paystack initialization failed",
      });
    }

    return res.json({
      success: true,
      status: true,
      reference: data.data.reference,
      authorization_url: data.data.authorization_url,
    });
  } catch (err) {
    console.error("💥 Payment init ERROR:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Payment service unavailable",
    });
  }
});

/* ===================== ACTIVATE PRODUCT ===================== */
router.post("/products/:id/activate", async (req, res) => {
  try {
    const { id: productId } = req.params;
    const planId = cleanUuid(req.body?.promotion_id);

    const result = await pool.query(
      `
      UPDATE products
      SET
        status = 'active',
        is_active = true,
        is_promoted = false,
        promotion_id = $1,
        promotion_start = NOW(),
        promotion_expires_at = NULL,
        updated_at = NOW()
      WHERE id = $2
        AND status IN ('draft', 'pending_payment')
      RETURNING id, status
      `,
      [planId, productId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No draft/pending product found",
      });
    }

    return res.json({
      success: true,
      product_id: result.rows[0].id,
      new_status: result.rows[0].status,
    });
  } catch (err) {
    console.error("Activate error:", err);
    return res.status(500).json({
      success: false,
      message: "Activation failed",
    });
  }
});

/* ===================== VERIFY PAYMENT ===================== */
router.get("/verify/:reference", async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reference is required",
      });
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (!data.status || data.data?.status !== "success") {
      return res.json({
        success: false,
        message: "Payment verification failed",
      });
    }

    return res.json({
      success: true,
      data: data.data,
      message: "Payment verified successfully",
    });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({
      success: false,
      message: "Verification failed",
    });
  }
});

/* ===================== WEBHOOK HANDLER ===================== */
webhookRouter.post("/", async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.error("❌ Missing PAYSTACK_SECRET_KEY");
      return res.sendStatus(500);
    }

    const signature = getWebhookSignature(req);
    const rawBody =
      typeof req.body === "string"
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString("utf-8")
          : JSON.stringify(req.body || {});

    if (!signature || !verifyPaystackSignature(rawBody, secret, signature)) {
      console.log("❌ Invalid webhook signature");
      return res.status(401).send("Unauthorized");
    }

    const event = JSON.parse(rawBody);

    if (event.event !== "charge.success") {
      return res.status(200).send("OK");
    }

    const data = event.data || {};
    const metadata = data.metadata || {};

    const productId =
      cleanUuid(metadata.productId) ||
      cleanUuid(metadata.product_id) ||
      cleanUuid(metadata.custom_fields?.find((f) => f.variable_name === "product_id")?.value);

    const planId =
      cleanUuid(metadata.planId) ||
      cleanUuid(metadata.plan_id) ||
      cleanUuid(metadata.custom_fields?.find((f) => f.variable_name === "plan_id")?.value);

    if (!productId) {
      return res.status(200).send("OK");
    }

    const existing = await pool.query(
      "SELECT status, is_active, promotion_id FROM products WHERE id = $1",
      [productId]
    );

    if (!existing.rows.length) {
      return res.status(200).send("OK");
    }

    if (existing.rows[0].status === "active" && existing.rows[0].is_active) {
      return res.status(200).send("OK");
    }

    let expiresAt = null;

    if (planId) {
      const planRes = await pool.query(
        "SELECT duration FROM promotion_plans WHERE id = $1",
        [planId]
      );

      const planDuration = planRes.rows[0]?.duration;

      if (planDuration && planDuration !== "Always") {
        const days = parseInt(planDuration, 10);
        if (!Number.isNaN(days) && days > 0) {
          expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        }
      }
    }

    await pool.query(
      `
      UPDATE products
      SET
        status = 'active',
        is_active = true,
        is_promoted = true,
        promotion_id = $1,
        promotion_start = COALESCE(promotion_start, NOW()),
        promotion_expires_at = $2,
        updated_at = NOW()
      WHERE id = $3
      `,
      [planId, expiresAt, productId]
    );

    return res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 WEBHOOK ERROR:", err.message);
    return res.status(500).send("Internal error");
  }
});

export default router;
export { webhookRouter };