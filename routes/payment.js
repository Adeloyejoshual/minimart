import express from "express";
import axios from "axios";

const router = express.Router();

/* ================= PAYSTACK INIT ================= */
router.post("/initialize", async (req, res) => {
  let { email, amount, productId, planId } = req.body;

  try {
    /* ================= VALIDATION ================= */
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    if (!productId) {
      return res.status(400).json({ error: "Missing productId" });
    }

    amount = Number(amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    /* ================= NORMALIZE ================= */
    const amountKobo = Math.round(amount * 100);

    /* ================= METADATA ================= */
    const metadata = {
      productId: String(productId),
      planId: planId ? String(planId) : null,
    };

    /* ================= PAYLOAD ================= */
    const payload = {
      email,
      amount: amountKobo,
      currency: "NGN",

      metadata,

      callback_url: `${process.env.FRONTEND_URL}/payment/success`,

      // Optional but useful for tracing
      custom_fields: [
        {
          display_name: "Product ID",
          variable_name: "product_id",
          value: String(productId),
        },
        {
          display_name: "Plan ID",
          variable_name: "plan_id",
          value: String(planId || ""),
        },
      ],
    };

    console.log("🔥 INIT REQUEST:", {
      email,
      amount: amountKobo,
      metadata,
    });

    /* ================= PAYSTACK CALL ================= */
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

    const data = response.data?.data;

    if (!data?.authorization_url) {
      throw new Error("Invalid Paystack response");
    }

    console.log("✅ INIT SUCCESS:", {
      reference: data.reference,
      productId,
      planId,
    });

    /* ================= RESPONSE ================= */
    return res.json({
      success: true,
      authorization_url: data.authorization_url,
      reference: data.reference,
    });

  } catch (err) {
    console.error("❌ PAYSTACK INIT ERROR:", {
      message: err.message,
      data: err.response?.data,
    });

    return res.status(500).json({
      error: "Payment initialization failed",
      details: err.response?.data || err.message,
    });
  }
});

export default router;