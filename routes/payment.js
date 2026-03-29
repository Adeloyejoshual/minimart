// routes/payment.js
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
    // 1️⃣ Create product as pending
    const result = await pool.query(
      `INSERT INTO products (name, price, description, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [productData.name, productData.price, productData.description]
    );

    const productId = result.rows[0].id;

    // 2️⃣ Initialize Paystack transaction
    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount * 100,
        metadata: {
          productId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    res.json({
      authorization_url: paystackRes.data.data.authorization_url,
      reference: paystackRes.data.data.reference,
      productId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Payment init failed" });
  }
});

export default router;