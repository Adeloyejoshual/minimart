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

    const { productId, promotionId } = data.metadata;

    if (!productId) {
      return res.status(400).json({ error: "Missing productId in metadata" });
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
        promotion_expires_at = CASE WHEN $2::int IS NOT NULL THEN now() + interval '30 days' ELSE NULL END
      WHERE id = $1
      RETURNING *
      `,
      [productId, promotionId || null]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      success: true,
      product: result.rows[0],
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;