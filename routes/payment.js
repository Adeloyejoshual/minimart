import express from "express";
import axios from "axios";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

router.post("/initialize", async (req, res) => {
  const { productData, email, amount } = req.body;

  try {
    /* ================= VALIDATION ================= */
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Invalid amount (must be > 0)" });
    }

    if (!productData?.name || !productData?.price) {
      return res.status(400).json({ error: "Missing product data" });
    }

    /* ================= CREATE PRODUCT ================= */
    const result = await pool.query(
      `INSERT INTO products (name, price, description, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [
        productData.name,
        productData.price,
        productData.description || "",
      ]
    );

    const productId = result.rows[0].id;

    /* ================= PAYSTACK INIT ================= */
    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: Math.round(amount * 100),
        metadata: {
          productId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.json({
      success: true,
      authorization_url: paystackRes.data.data.authorization_url,
      reference: paystackRes.data.data.reference,
      productId,
    });

  } catch (err) {
    /* ================= REAL ERROR OUTPUT ================= */
    console.error("❌ PAYSTACK ERROR:");
    console.error(err.response?.data || err.message);

    return res.status(500).json({
      error: "Payment init failed",
      details: err.response?.data || err.message,
    });
  }
});

export default router;