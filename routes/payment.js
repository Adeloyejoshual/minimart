import express from "express";
import axios from "axios";
import crypto from "crypto";

const router = express.Router();

/* ================= PAYSTACK INIT ================= */
router.post("/initialize", async (req, res) => {
  try {
    let { email, amount, productId, planId, userId } = req.body;

    /* ================= VALIDATION ================= */
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    amount = Number(amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    /* ================= SAFE REFERENCE ================= */
    const reference = `PSK_${crypto.randomBytes(12).toString("hex")}`;

    /* ================= PAYLOAD ================= */
    const payload = {
      email,
      amount: Math.round(amount * 100),

      reference,

      /* 🔥 CRITICAL MARKETPLACE CONTEXT */
      metadata: {
        productId: productId || null,
        planId: planId || null,
        userId: userId || null,
        email,
      },

      callback_url: `${process.env.FRONTEND_URL}/payment/success?ref=${reference}`,
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
      reference,
      authorization_url: response.data.data.authorization_url,
    });

  } catch (err) {
    console.error("❌ PAYSTACK INIT ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: "Init failed",
      details: err.response?.data || err.message,
    });
  }
});

export default router;