import express from "express";
import axios from "axios";

const router = express.Router();

/* ================= TEST PAYSTACK INIT ONLY ================= */
router.post("/initialize", async (req, res) => {
  const { email, amount } = req.body;

  try {
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const payload = {
      email,
      amount: Math.round(Number(amount) * 100),
    };

    console.log("🔥 PAYSTACK REQUEST:", payload);

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.json({
      success: true,
      authorization_url: response.data.data.authorization_url,
      reference: response.data.data.reference,
    });

  } catch (err) {
    console.error("❌ PAYSTACK ERROR:");
    console.error(err.response?.data || err.message);

    return res.status(500).json({
      error: "Init failed",
      details: err.response?.data || err.message,
    });
  }
});

export default router;