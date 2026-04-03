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

  const client = await pool.connect();

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

    const payment = verifyRes.data?.data;

    if (!payment || payment.status !== "success") {
      return res.status(400).json({
        error: "Payment not successful",
      });
    }

    /* ================= EXTRACT METADATA ================= */
    const metadata = payment.metadata || {};

    // Fallback support (important if metadata wasn't sent correctly)
    const productId =
      metadata.productId ||
      metadata.product_id ||
      req.body.productId;

    const planId =
      metadata.planId ||
      metadata.plan_id ||
      req.body.planId ||
      null;

    if (!productId) {
      return res.status(400).json({
        error: "Missing productId in metadata",
      });
    }

    /* ================= BEGIN TRANSACTION ================= */
    await client.query("BEGIN");

    /* ================= IDEMPOTENCY CHECK ================= */
    const existing = await client.query(
      `SELECT id FROM payments WHERE reference = $1 FOR UPDATE`,
      [reference]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.json({
        success: true,
        message: "Payment already processed",
      });
    }

    /* ================= FETCH PLAN ================= */
    let plan = null;

    if (planId) {
      const planRes = await client.query(
        `SELECT * FROM promotion_plans WHERE id = $1`,
        [planId]
      );
      plan = planRes.rows[0] || null;
    }

    /* ================= CALCULATE EXPIRY ================= */
    let expiresAt = null;

    if (plan?.duration) {
      // Extract number from strings like "7 days", "30 days"
      const match = plan.duration.match(/\d+/);
      const days = match ? parseInt(match[0], 10) : 0;

      if (days > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
      }
    }

    /* ================= SAVE PAYMENT ================= */
    await client.query(
      `
      INSERT INTO payments (
        reference,
        amount,
        status,
        product_id,
        plan_id,
        metadata,
        type,
        created_at
      )
      VALUES ($1, $2, 'success', $3, $4, $5, 'promotion', now())
      `,
      [
        reference,
        payment.amount / 100,
        productId,
        planId,
        metadata,
      ]
    );

    /* ================= UPDATE PRODUCT ================= */
    const updateRes = await client.query(
      `
      UPDATE products
      SET
        status = 'active',
        is_active = true,

        is_promoted = CASE
          WHEN $2 IS NOT NULL AND $3 IS NOT NULL THEN TRUE
          ELSE FALSE
        END,

        promotion_id = $2,
        promotion_start = CASE
          WHEN $2 IS NOT NULL THEN now()
          ELSE NULL
        END,
        promotion_expires_at = $3,

        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [productId, planId, expiresAt]
    );

    if (!updateRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Product not found",
      });
    }

    /* ================= COMMIT ================= */
    await client.query("COMMIT");

    return res.json({
      success: true,
      product: updateRes.rows[0],
    });

  } catch (err) {
    await client.query("ROLLBACK");

    console.error("❌ VERIFY ERROR:", {
      message: err.message,
      data: err.response?.data,
    });

    return res.status(500).json({
      error: "Payment verification failed",
    });

  } finally {
    client.release();
  }
});

export default router;