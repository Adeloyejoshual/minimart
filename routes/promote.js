// routes/promote.js
import express from "express";
import auth from "../middleware/authMiddleware.js";
import { initializePaystackTransaction } from "../services/paystack.js";

const router = express.Router();

/* =========================================================
   POST /promote/init
   - Initialize Paystack payment for product promotion
   - Expects { amount }
   - Returns authorization_url for frontend redirect
========================================================= */
router.post("/init", auth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Invalid promotion amount" });
    }

    // Initialize Paystack transaction
    const payment = await initializePaystackTransaction(req.user.email, Number(amount), {
      action: "promote",
      user_id: req.user.id,
    });

    res.json({
      success: true,
      message: "Payment initialized",
      data: payment.data, // includes authorization_url
    });
  } catch (err) {
    console.error("Promotion init error:", err);
    res.status(500).json({ success: false, message: "Failed to initialize payment" });
  }
});

export default router;