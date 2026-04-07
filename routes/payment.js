// routes/payment.js
import express from "express";
import { Pool } from "pg";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* ================= DATABASE ================= */
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= JSON PARSER For /api/payment ================= */
router.use(express.json({ limit: "10mb" }));
router.use(express.urlencoded({ extended: true }));

/* ================= PAYSTACK INIT (Frontend) ================= */
router.post("/initialize", async (req, res) => {
  console.log("🔸 PAYMENT INIT body:", req.body);
  console.log("🔸 content-type:", req.get("content-type"));

  const { email, amount, planId, productId } = req.body;

  if (!email || typeof amount !== "number" || !planId || !productId) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: email, amount, planId, productId",
    });
  }

  try {
    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amount * 100, // in kobo
          callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
          metadata: {
            planId,
            productId,
            custom_fields: [
              {
                display_name: "Product ID",
                variable_name: "product_id",
                value: productId,
              },
            ],
          },
        }),
      }
    );

    const data = await response.json();
    if (!data.status) {
      throw new Error(data.message || "Payment initialization failed");
    }

    res.json({
      success: true,
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    });
  } catch (err) {
    console.error("Payment init error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ================= PAYSTACK WEBHOOK (Raw body) ================= */
const webhookRouter = express.Router();

webhookRouter.use(express.raw({ type: "application/json" }));

webhookRouter.post("/", async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.error("Missing PAYSTACK_SECRET_KEY");
      return res.sendStatus(500);
    }

    const rawBody = req.body.toString("utf-8");
    const hash = crypto
      .createHmac("sha512", secret)
      .update(rawBody)
      .digest("hex");

    const signature = req.headers["x-paystack-signature"];
    if (hash !== signature) {
      console.log("❌ Invalid webhook signature");
      return res.sendStatus(401);
    }

    const event = JSON.parse(rawBody);

    if (event.event !== "charge.success") {
      return res.sendStatus(200);
    }

    const data = event.data;
    const metadata = data.metadata || {};

    // Try multiple sources for productId
    const productId =
      metadata.productId ||
      metadata.product_id ||
      metadata.custom_fields?.[0]?.value;

    const planId = metadata.planId;

    if (!productId) {
      console.log("❌ Missing productId in metadata");
      return res.sendStatus(200);
    }

    /* ================= GET PLAN ================= */
    const planRes = await pool.query(
      `SELECT * FROM promotion_plans WHERE id = $1`,
      [planId]
    );

    if (!planRes.rows.length) {
      console.log("❌ Invalid plan:", planId);
      return res.sendStatus(200);
    }

    const plan = planRes.rows[0];

    /* ================= PREVENT DOUBLE ACTIVATION ================= */
    const existing = await pool.query(
      `SELECT status, is_active FROM products WHERE id = $1`,
      [productId]
    );

    if (!existing.rows.length) {
      console.log("❌ Product not found:", productId);
      return res.sendStatus(200);
    }

    if (existing.rows[0].status === "active" && existing.rows[0].is_active) {
      console.log("⚠️ Product already active:", productId);
      return res.sendStatus(200);
    }

    /* ================= COMPUTE EXPIRY ================= */
    let expiresAtSql = "NULL";

    if (
      plan.duration &&
      plan.duration !== "Always" &&
      plan.duration !== "0"
    ) {
      const days = parseInt(plan.duration, 10);
      if (!isNaN(days) && days > 0) {
        expiresAtSql = `now() + interval '${days} days'`;
      }
    }

    /* ================= UPDATE PRODUCT ================= */
    const query = `
      UPDATE products
      SET
        status = 'active',
        is_active = true,
        is_promoted = $2,
        promotion_id = $3,
        promotion_start = now(),
        promotion_expires_at = $4,
        updated_at = now()
      WHERE id = $1
    `;

    await pool.query(query, [productId, !!planId, planId, expiresAtSql]);

    console.log("✅ Product activated via webhook:", productId);

    res.sendStatus(200);
  } catch (err) {
    console.error("🔥 WEBHOOK ERROR:", err.message);
    res.sendStatus(500);
  }
});

/* ================= FREE / ADMIN PROMOTION ACTIVATION ================= */
router.post("/products/:id/activate", async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { promotion_id: planId } = req.body;

    const query = `
      UPDATE products
      SET
        status = 'active',
        is_active = true,
        is_promoted = $1,
        promotion_id = $2,
        promotion_start = now(),
        promotion_expires_at = NULL,
        updated_at = now()
      WHERE id = $3 AND status = 'draft'
      RETURNING id
    `;

    const result = await pool.query(query, [
      !!planId,
      planId || null,
      productId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Draft product not found or already published",
      });
    }

    res.json({
      success: true,
      message: "Product activated successfully",
      product_id: result.rows[0].id,
    });
  } catch (err) {
    console.error("Activate error:", err);
    res.status(500).json({ message: "Activation failed" });
  }
});

/* ================= EXPORTS ================= */
export default router;

// Export webhook route separately so it can have raw body
export { webhookRouter };