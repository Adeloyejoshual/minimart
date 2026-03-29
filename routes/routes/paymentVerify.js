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

  try {
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

    // Activate product
    await pool.query(
      `
      UPDATE products
      SET is_active = true,
          status = 'active',
          is_promoted = CASE WHEN $2::int IS NOT NULL THEN true ELSE false END,
          promotion_id = $2,
          promotion_start = now(),
          promotion_expires_at = now() + interval '30 days'
      WHERE id = $1
      `,
      [productId, promotionId]
    );

    res.json({ success: true, productId });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;