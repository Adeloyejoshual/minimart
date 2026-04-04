import express from "express";
import axios from "axios";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

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

    /* ================= METADATA ================= */
    const { productId, planId } = data.metadata || {};

    if (!productId || planId === undefined) {
      return res.status(400).json({ error: "Invalid metadata" });
    }

    /* ================= FETCH PLAN ================= */
    const planRes = await pool.query(
      `SELECT * FROM promotion_plans WHERE id = $1`,
      [planId]
    );

    if (!planRes.rows.length) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const plan = planRes.rows[0];

    /* ================= AMOUNT VALIDATION ================= */
    const expectedAmount = Number(plan.price) * 100;

    if (Number(data.amount) !== expectedAmount) {
      return res.status(400).json({
        error: "Amount mismatch",
      });
    }

    /* ================= PREVENT DOUBLE ACTIVATION ================= */
    const existing = await pool.query(
      `SELECT status FROM products WHERE id = $1`,
      [productId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (existing.rows[0].status === "active") {
      return res.json({
        success: true,
        message: "Already activated",
      });
    }

    /* ================= CALCULATE EXPIRY ================= */
    let expiresAt = null;

    if (plan.duration && plan.duration !== "Always") {
      const days = parseInt(plan.duration);
      if (!isNaN(days)) {
        expiresAt = `now() + interval '${days} days'`;
      }
    }

    /* ================= UPDATE PRODUCT ================= */
    const updateQuery = `
      UPDATE products
      SET
        status = 'active',
        is_active = true,
        is_promoted = $2,
        promotion_id = $3,
        promotion_start = now(),
        promotion_expires_at = ${
          expiresAt ? expiresAt : "NULL"
        }
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      productId,
      planId > 0,
      planId,
    ]);

    return res.json({
      success: true,
      product: result.rows[0],
      plan,
    });

  } catch (err) {
    console.error("❌ VERIFY ERROR:");
    console.error(err.response?.data || err.message);

    return res.status(500).json({
      error: "Verification failed",
    });
  }
});

export default router;