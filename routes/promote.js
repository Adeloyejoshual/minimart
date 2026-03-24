// routes/promote.js
import express from "express";
import auth from "../middleware/authMiddleware.js";
import { initializePaystackTransaction } from "../services/paystack.js";

const router = express.Router();

/* =========================================================
   POST /promote
   Initialize promotion payment BEFORE product creation
========================================================= */
router.post("/", auth, async (req, res) => {
  try {
    const { amount, planId } = req.body;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({
        success: false,
        message: "Invalid promotion amount",
      });
    }

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Promotion plan is required",
      });
    }

    // Initialize Paystack transaction
    const payment = await initializePaystackTransaction(
      req.user.email,
      Number(amount),
      {
        action: "promote",
        plan_id: planId,
      }
    );

    res.json({
      success: true,
      message: "Payment initialized",
      payment,
    });
  } catch (error) {
    console.error("Promotion init error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to initialize promotion",
    });
  }
});

export default router;