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

    /* ================= FIX METADATA ================= */
    const { productId, planId } = data.metadata || {};

    if (!productId) {
      return res.status(400).json({ error: "Missing productId in metadata" });
    }

    /* ================= GET PLAN FROM DB ================= */
    let plan = null;

    if (planId) {
      const planRes = await pool.query(
        `SELECT * FROM promotion_plans WHERE id = $1`,
        [planId]
      );
      plan = planRes.rows[0];
    }

    /* ================= PREVENT DUPLICATES ================= */
    const existing = await pool.query(
      `SELECT id FROM products WHERE id = $1 AND is_active = true`,
      [productId]
    );

    if (existing.rows.length && data.metadata?.verified_once) {
      return res.json({ success: true, message: "Already processed" });
    }

    /* ================= ACTIVATE PRODUCT ================= */
    const result = await pool.query(
      `
      UPDATE products
      SET
        status = 'active',
        is_active = true,

        is_promoted = CASE WHEN $2::int IS NOT NULL THEN true ELSE false END,
        promotion_id = $2,

        promotion_start = CASE WHEN $2::int IS NOT NULL THEN now() ELSE NULL END,
        promotion_expires_at = CASE 
          WHEN $2::int IS NOT NULL AND $3::int IS NOT NULL
          THEN now() + ($3 || ' days')::interval
          ELSE NULL
        END,

        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        productId,
        planId || null,
        plan?.duration_days || null,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      success: true,
      product: result.rows[0],
    });
  } catch (err) {
    console.error("❌ VERIFY ERROR:", err.response?.data || err.message);

    res.status(500).json({
      error: "Verification failed",
    });
  }
});

export default router;