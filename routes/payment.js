// routes/payment.js
import express from "express";
import { pool } from "../server.js"; // Reuse server pool
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* ================= PAYSTACK INIT (Frontend) ================= */
router.post("/initiate", async (req, res) => {
  console.log("🔸 PAYMENT INIT:", req.body);

  const { email, amount, planId, productId } = req.body;

  // ✅ Validate ALL required fields
  if (!email || !amount || !planId || !productId) {
    return res.status(400).json({
      success: false,
      message: "Missing: email, amount, planId, productId",
    });
  }

  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid amount",
    });
  }

  try {
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(amount * 100), // kobo
          callback_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/success`,
          metadata: {
            planId,
            productId,
            // ✅ Backend expects these exact fields
            plan_id: planId,
            product_id: productId,
          },
        }),
      }
    );

    const data = await paystackResponse.json();
    
    if (!paystackResponse.ok || !data.status) {
      console.error("Paystack error:", data);
      return res.status(500).json({
        success: false,
        message: data.message || "Paystack failed",
      });
    }

    console.log("✅ Paystack init success:", data.data.reference);
    
    res.json({
      success: true,
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    });

  } catch (err) {
    console.error("💥 Payment init error:", err.message);
    res.status(500).json({
      success: false,
      message: "Payment service unavailable",
    });
  }
});

/* ================= FREE / ADMIN ACTIVATION ================= */
router.post("/products/:id/activate", async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { promotion_id: planId } = req.body;

    // ✅ Idempotent - only activate drafts
    const result = await pool.query(`
      UPDATE products 
      SET
        status = 'active',
        is_active = true,
        is_promoted = $1,
        promotion_id = $2,
        promotion_start = NOW(),
        promotion_expires_at = NULL,
        updated_at = NOW()
      WHERE id = $3 AND status IN ('draft', 'pending_payment')
      RETURNING id, status
    `, [!!planId, planId || null, productId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "No draft/pending product found",
      });
    }

    console.log("✅ Free activation:", productId);
    res.json({
      success: true,
      product_id: result.rows[0].id,
      new_status: result.rows[0].status,
    });

  } catch (err) {
    console.error("Activate error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Activation failed" 
    });
  }
});

/* ================= VERIFY (Frontend callback) ================= */
router.get("/verify/:reference", async (req, res) => {
  try {
    const { reference } = req.params;
    
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await response.json();
    
    if (!data.status || data.data.status !== "success") {
      return res.json({ success: false, message: "Payment not verified" });
    }

    res.json({ 
      success: true, 
      data: data.data,
      message: "Payment verified successfully" 
    });

  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
});

/* ================= WEBHOOK ROUTER (Separate for raw body) ================= */
const webhookRouter = express.Router();

webhookRouter.post("/", async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const rawBody = req.body.toString();

    // ✅ Signature verification
    const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
    const signature = req.headers["x-paystack-signature"];

    if (hash !== signature) {
      console.log("❌ Invalid webhook signature");
      return res.status(401).send("Unauthorized");
    }

    const event = JSON.parse(rawBody);

    if (event.event !== "charge.success") {
      return res.status(200).send("OK");
    }

    const data = event.data;
    const metadata = data.metadata || {};

    // ✅ Extract from multiple sources
    const productId = metadata.productId || metadata.product_id || 
                     metadata.custom_fields?.find(f => f.variable_name === "product_id")?.value;
    
    const planId = metadata.planId || metadata.plan_id;

    if (!productId) {
      console.log("❌ No productId in webhook");
      return res.status(200).send("OK");
    }

    // ✅ Prevent double activation
    const existing = await pool.query(
      "SELECT status FROM products WHERE id = $1", [productId]
    );

    if (!existing.rows.length || existing.rows[0].status === "active") {
      console.log("⚠️ Already active:", productId);
      return res.status(200).send("OK");
    }

    // ✅ Get plan duration
    const planRes = await pool.query(
      "SELECT duration FROM promotion_plans WHERE id = $1", [planId]
    );
    
    let expiresAt = null;
    if (planRes.rows[0]?.duration && planRes.rows[0].duration !== "Always") {
      const days = parseInt(planRes.rows[0].duration);
      if (!isNaN(days)) {
        expiresAt = `NOW() + INTERVAL '${days} days'`;
      }
    }

    // ✅ Activate product
    await pool.query(`
      UPDATE products 
      SET status = 'active', is_active = true, is_promoted = true,
          promotion_id = $1, promotion_start = NOW(),
          promotion_expires_at = $2, updated_at = NOW()
      WHERE id = $3
    `, [planId, expiresAt, productId]);

    console.log("✅ Webhook activated:", productId);
    res.status(200).send("OK");

  } catch (err) {
    console.error("🔥 Webhook error:", err);
    res.status(500).send("Internal error");
  }
});

/* ================= EXPORTS ================= */
export default router;
export { webhookRouter };