import express from "express";
import axios from "axios";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= COMPLETE PAYMENT INITIALIZE ================= */
router.post("/initialize", async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    const { email, amount, productId, planId } = req.body;

    /* ================= VALIDATION ================= */
    if (!email?.trim() || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Valid email required" });
    }

    const product_id = Number(productId);
    if (!Number.isFinite(product_id) || product_id <= 0) {
      return res.status(400).json({ success: false, error: "Valid product ID required" });
    }

    const plan_id = Number(planId);
    const amount_num = Number(amount);

    if (!Number.isFinite(amount_num) || amount_num <= 0) {
      return res.status(400).json({ success: false, error: "Valid amount required" });
    }

    if (plan_id && !Number.isFinite(plan_id)) {
      return res.status(400).json({ success: false, error: "Valid plan ID required" });
    }

    /* ================= VERIFY PRODUCT EXISTS ================= */
    const productCheck = await client.query(
      "SELECT id, state FROM products WHERE id = $1", [product_id]
    );

    if (!productCheck.rows.length) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    if (productCheck.rows[0].state === "active") {
      return res.status(400).json({ success: false, error: "Product already active" });
    }

    /* ================= VERIFY PLAN (IF PROVIDED) ================= */
    let plan = null;
    if (plan_id) {
      const planCheck = await client.query(
        "SELECT * FROM promotion_plans WHERE id = $1 AND price = $2", 
        [plan_id, amount_num]
      );
      plan = planCheck.rows[0];
      
      if (!plan) {
        return res.status(400).json({ success: false, error: "Invalid plan or price mismatch" });
      }
    }

    /* ================= GENERATE UNIQUE REFERENCE ================= */
    const reference = `MINIMART_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    /* ================= SAVE PENDING PAYMENT ================= */
    await client.query(
      `INSERT INTO payments (reference, amount, status, product_id, plan_id, metadata, created_at)
       VALUES ($1, $2, 'pending', $3, $4, $5, now())`,
      [
        reference,
        amount_num,
        product_id,
        plan_id || null,
        JSON.stringify({ email: email.trim(), productId: product_id, planId: plan_id })
      ]
    );

    await client.query("COMMIT");

    console.log(`🔥 Payment init: ${reference} for product ${product_id} (${amount_num}₦)`);

    /* ================= PAYSTACK REQUEST ================= */
    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: email.trim(),
        amount: Math.round(amount_num * 100), // Convert to kobo
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

    console.log(`✅ Initialized: ${reference} → ${paystackData.reference}`);

    res.json({
      success: true,
      authorization_url: paystackData.authorization_url,
      reference: paystackData.reference || reference,
      access_code: paystackData.access_code
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    
    console.error("❌ Payment init failed:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      body: req.body
    });

    // Don't expose internal errors to client
    const clientError = error.response?.status === 400 
      ? error.response.data?.message || "Invalid request"
      : "Payment service unavailable";

    res.status(500).json({ 
      success: false, 
      error: clientError 
    });

  } finally {
    client.release();
  }
});

/* ================= FREE PLAN ENDPOINT (BONUS) ================= */
router.post("/free-plan/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const client = await pool.connect();

    await client.query("BEGIN");

    const result = await client.query(`
      UPDATE products 
      SET state = 'active', is_active = true, is_promoted = true, 
          promotion_id = 0, promotion_priority = 1,
          updated_at = now()
      WHERE id = $1 AND state = 'draft'
      RETURNING *
    `, [productId]);

    await client.query("COMMIT");
    client.release();

    if (!result.rows.length) {
      return res.status(400).json({ success: false, error: "Cannot activate" });
    }

    res.json({ 
      success: true, 
      product: result.rows[0],
      message: "Product activated (free plan)"
    });

  } catch (error) {
    console.error("Free plan error:", error);
    res.status(500).json({ success: false, error: "Activation failed" });
  }
});

export default router;