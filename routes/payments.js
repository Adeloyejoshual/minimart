// routes/payments.js
import express from "express";
import { initializePaystackTransaction, verifyPaystackPayment, handlePaystackWebhook } from "../services/paystack.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

// ---------------- Initialize Payment ----------------
router.post("/init", auth, async (req, res) => {
  const { amount, metadata } = req.body;
  if (!amount) return res.status(400).json({ success: false, message: "Amount is required" });

  try {
    const transaction = await initializePaystackTransaction(req.user.email, amount, {
      ...metadata,
      userId: req.user.id
    });

    res.json({ success: true, data: transaction.data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- Verify Payment ----------------
router.get("/verify", async (req, res) => {
  const { reference } = req.query;
  if (!reference) return res.status(400).json({ success: false, message: "Reference is required" });

  try {
    const verification = await verifyPaystackPayment(reference);
    res.json({ success: true, data: verification.data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- Webhook ----------------
router.post("/webhook", express.json({ type: 'application/json' }), handlePaystackWebhook);

export default router;