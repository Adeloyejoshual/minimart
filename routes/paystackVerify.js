import express from "express";
import axios from "axios";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= PRODUCTION PAYMENT VERIFY ================= */
router.post("/verify", async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { reference, productId: clientProductId } = req.body;

    /* ================= INPUT VALIDATION ================= */
    if (!reference?.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: "Payment reference required" 
      });
    }

    const product_id = Number(clientProductId);
    if (!Number.isFinite(product_id) || product_id <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Valid product ID required" 
      });
    }

    console.log(`🔍 Verifying payment ${reference} for product ${product_id}`);

    await client.query("BEGIN");

    /* ================= 1. CHECK IDEMPOTENCY ================= */
    const existingPayment = await client.query(
      "SELECT id, status FROM payments WHERE reference = $1 FOR UPDATE",
      [reference.trim()]
    );

    if (existingPayment.rows.length > 0) {
      const status = existingPayment.rows[0].status;
      await client.query("ROLLBACK");
      
      if (status === 'success') {
        return res.json({ 
          success: true, 
          message: "Payment already verified", 
          status 
        });
      }
      
      return res.json({ 
        success: false, 
        error: `Payment ${status}, retry later` 
      });
    }

    /* ================= 2. VERIFY WITH PAYSTACK ================= */
    const { data } = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference.trim()}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: 10000
      }
    );

    const paystackPayment = data.data;
    
    if (!paystackPayment || paystackPayment.status !== "success") {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        success: false, 
        error: "Payment not successful or pending" 
      });
    }

    /* ================= 3. EXTRACT/VALIDATE PRODUCT ID ================= */
    const metadata = paystackPayment.metadata || {};
    const verifiedProductId = Number(
      metadata.productId || 
      metadata.product_id || 
      clientProductId
    );

    if (verifiedProductId !== product_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        success: false, 
        error: `Product ID mismatch (${verifiedProductId} vs ${product_id})` 
      });
    }

    /* ================= 4. VERIFY PRODUCT EXISTS + STATE ================= */
    const productCheck = await client.query(
      "SELECT id, state FROM products WHERE id = $1 FOR UPDATE",
      [verifiedProductId]
    );

    if (!productCheck.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    const productState = productCheck.rows[0].state;
    if (productState === 'active') {
      await client.query("ROLLBACK");
      return res.json({ 
        success: true, 
        message: "Product already active", 
        state: productState 
      });
    }

    /* ================= 5. GET PLAN INFO ================= */
    const planId = Number(metadata.planId || metadata.plan_id || req.body.planId);
    let plan = null;
    let expiresAt = null;

    if (planId > 0) {
      const planRes = await client.query(
        "SELECT * FROM promotion_plans WHERE id = $1",
        [planId]
      );
      plan = planRes.rows[0];

      // Calculate expiry
      if (plan?.duration && plan.duration !== "Always") {
        const days = parseInt(plan.duration.match(/d+/)?.[0] || "0");
        if (days > 0) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + days);
        }
      }
    }

    /* ================= 6. SAVE PAYMENT RECORD ================= */
    await client.query(`
      INSERT INTO payments (
        reference, amount, status, product_id, plan_id, 
        paystack_data, metadata, created_at
      ) VALUES ($1, $2, 'success', $3, $4, $5, $6, now())
    `, [
      reference.trim(),
      paystackPayment.amount / 100,
      verifiedProductId,
      planId || null,
      JSON.stringify(paystackPayment),
      JSON.stringify(metadata)
    ]);

    /* ================= 7. ACTIVATE PRODUCT ================= */
    const productUpdate = await client.query(`
      UPDATE products SET
        state = 'active',
        is_active = true,
        is_promoted = $2 IS NOT NULL,
        promotion_id = $2,
        promotion_priority = COALESCE((SELECT priority FROM promotion_plans WHERE id = $2), 1),
        promotion_start = CASE WHEN $2 IS NOT NULL THEN now() ELSE NULL END,
        promotion_expires_at = $3,
        updated_at = now()
      WHERE id = $1
      RETURNING id, title, state, is_promoted, promotion_expires_at
    `, [verifiedProductId, planId || null, expiresAt]);

    await client.query("COMMIT");

    console.log(`✅ Payment verified: ${reference} → Product ${verifiedProductId} activated`);

    res.json({
      success: true,
      reference: reference.trim(),
      product_id: verifiedProductId,
      product: productUpdate.rows[0],
      plan: plan ? { id: plan.id, name: plan.name, expires_at: expiresAt } : null,
      message: "Payment verified and product activated"
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(console.error);
    
    console.error("❌ Verify failed:", {
      reference: req.body.reference,
      productId: req.body.productId,
      error: error.message,
      stack: error.stack
    });

    const statusCode = error.response?.status === 400 ? 400 : 500;
    res.status(statusCode).json({ 
      success: false, 
      error: "Verification failed" 
    });

  } finally {
    client.release();
  }
});

export default router;