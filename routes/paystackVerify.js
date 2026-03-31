import express from "express";
import axios from "axios";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= VERIFY PAYMENT (HARDENED) ================= */
router.post("/verify", async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    return res.status(400).json({ error: "Missing reference" });
  }

  const client = await pool.connect();

  try {
    /* ================= PAYSTACK VERIFY ================= */
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
      return res.status(400).json({ error: "Missing productId" });
    }

    /* ================= TRANSACTION START ================= */
    await client.query("BEGIN");

    /* ================= IDEMPOTENCY (ATOMIC) ================= */
    const existing = await client.query(
      `SELECT id FROM payments WHERE reference = $1 FOR UPDATE`,
      [reference]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.json({
        success: true,
        message: "Already processed",
      });
    }

    /* ================= PLAN FETCH ================= */
    let plan = null;

    if (planId) {
      const planRes = await client.query(
        `SELECT * FROM promotion_plans WHERE id = $1`,
        [planId]
      );
      plan = planRes.rows[0];
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

    /* ================= EXPIRY CALC ================= */
    let expiresAt = null;

    if (plan?.duration) {
      const days = parseInt(plan.duration.match(/\d+/)?.[0] || "0");

      if (days > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
      }
    }

    /* ================= PRODUCT UPDATE ================= */
    const update = await client.query(
      `
      UPDATE products
      SET
        status = 'active',
        is_active = true,

        is_promoted = $2 IS NOT NULL,
        promotion_id = $2,

        promotion_start = CASE WHEN $2 IS NOT NULL THEN now() ELSE NULL END,
        promotion_expires_at = $3,

        state = 'active',
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [productId, planId || null, expiresAt]
    );

    if (!update.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Product not found" });
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      product: update.rows[0],
    });

  } catch (err) {
    await client.query("ROLLBACK");

    console.error("❌ VERIFY ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: "Verification failed",
    });

  } finally {
    client.release();
  }
});

export default router;