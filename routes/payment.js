import express from "express";
import axios from "axios";

const router = express.Router();

/* ================= PAYSTACK INIT ================= */
router.post("/initialize", async (req, res) => {
  let { email, amount, productId, planId } = req.body;

  try {
    /* ================= VALIDATION ================= */
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    amount = Number(amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    /* ================= PAYLOAD ================= */
    const payload = {
      email,
      amount: Math.round(amount * 100),

      /* 🔥 CRITICAL FOR MARKETPLACE */
      metadata: {
        productId,
        planId,
      },

      /* OPTIONAL BUT RECOMMENDED */
      callback_url: `${process.env.FRONTEND_URL}/payment/success`,
    };

    console.log("🔥 PAYSTACK INIT:", payload);

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