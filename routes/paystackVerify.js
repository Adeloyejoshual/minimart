import express from "express";
import axios from "axios";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= VERIFY PAYMENT ================= */
router.post("/verify", async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    return res.status(400).json({ error: "Missing reference" });
  }

  try {
    /* ================= VERIFY WITH PAYSTACK ================= */
    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = verifyRes.data.data;

    if (data.status !== "success") {
      return res.status(400).json({ error: "Payment not successful" });
    }

    const metadata = data.metadata || {};
    const productId = metadata.productId;
    const planId = metadata.planId;

    if (!productId) {
      return res.status(400).json({ error: "Missing productId in metadata" });
    }

    /* ================= IDEMPOTENCY CHECK ================= */
    const paymentCheck = await pool.query(
      `SELECT id FROM payments WHERE reference = $1 AND status = 'success'`,
      [reference]
    );

    if (paymentCheck.rows.length > 0) {
      return res.json({
        success: true,
        message: "Payment already processed",
      });
    }

    /* ================= GET PLAN ================= */
    let plan = null;

    if (planId) {
      const planRes = await pool.query(
        `SELECT * FROM promotion_plans WHERE id = $1`,
        [planId]
      );
      plan = planRes.rows[0];
    }

    /* ================= SAVE PAYMENT RECORD ================= */
    await pool.query(
      `
      INSERT INTO payments (
        reference,
        amount,
        status,
        product_id,
        plan_id,
        metadata,
        type
      )
      VALUES ($1, $2, 'success', $3, $4, $5, 'promotion')
      `,
      [
        reference,
        data.amount / 100,
        productId,
        planId || null,
        metadata,
      ]
    );

    /* ================= CALCULATE EXPIRY ================= */
    let expiresAt = null;

    if (plan?.duration) {
      const match = plan.duration.match(/\d+/);
      const days = match ? parseInt(match[0]) : null;

      if (days) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
      }
    }

    /* ================= ACTIVATE PRODUCT ================= */
    const result = await pool.query(
      `
      UPDATE products
      SET
        status = 'active',
        is_active = true,

        is_promoted = $2 IS NOT NULL,
        promotion_id = $2,

        promotion_start = CASE WHEN $2 IS NOT NULL THEN now() ELSE NULL END,
        promotion_expires_at = $3,

        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [productId, planId || null, expiresAt]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json({
      success: true,
      product: result.rows[0],
    });

  } catch (err) {
    console.error("❌ VERIFY ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: "Verification failed",
      details: err.response?.data || err.message,
    });
  }
});

export default router;