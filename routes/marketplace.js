import express from "express";
import auth from "../middleware/authMiddleware.js";
import { initializePaystackTransaction, verifyPaystackTransaction } from "../services/paystack.js";

const router = express.Router();

// ------------------ INITIATE TEST PROMOTION ------------------
router.post("/init", auth, async (req, res) => {
  try {
    const { title, price, promotion_id } = req.body;
    if (!title || !price || !promotion_id)
      return res.status(400).json({ message: "Title, price, and promotion_id are required" });

    const metadata = {
      user_id: req.user.id,
      title,
      price,
      promotion_id,
      images: [
        // dummy small base64 image
        "iVBORw0KGgoAAAANSUhEUgAAAAUA" +
        "AAAFCAYAAACNbyblAAAAHElEQVQI12P4" +
        "//8/w38GIAXDIBKE0DHxgljNBAAO" +
        "9TXL0Y4OHwAAAABJRU5ErkJggg=="
      ]
    };

    const payment = await initializePaystackTransaction(req.user.email, Number(price), metadata);

    res.json({
      success: true,
      message: "Paystack transaction initialized",
      payment: payment.data
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to initiate promotion" });
  }
});

// ------------------ VERIFY TEST PROMOTION ------------------
router.post("/verify", auth, async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ message: "Reference required" });

    const paymentData = await verifyPaystackTransaction(reference);

    if (!paymentData.status || paymentData.status !== "success")
      return res.status(400).json({ message: "Payment failed or pending" });

    console.log("✅ Test promotion successful:", paymentData);
    res.json({ success: true, message: "Test payment verified successfully", payment: paymentData });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to verify test promotion" });
  }
});

export default router;