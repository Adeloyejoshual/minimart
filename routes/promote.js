// routes/promote.js
import express from "express";
import auth from "../middleware/authMiddleware.js";
import { initializePaystackTransaction } from "../services/paystack.js";
import prisma from "../prisma.js";

const router = express.Router();

// ---------------- POST /promote/:productId ----------------
// Initialize product promotion via Paystack
router.post("/:productId", auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const { amount } = req.body;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: "Invalid promotion amount" });
    }

    // Verify product ownership using Prisma
    const product = await prisma.minimart_products.findUnique({
      where: { id: Number(productId) },
      select: { id: true, seller_id: true },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (product.seller_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "You are not authorized to promote this product" });
    }

    // Initialize Paystack transaction
    const payment = await initializePaystackTransaction(req.user.email, Number(amount), {
      product_id: productId,
      action: "promote",
    });

    res.json({
      success: true,
      message: "Promotion initialized successfully",
      payment,
    });
  } catch (error) {
    console.error("Promotion initialization error:", error.message);
    res.status(500).json({ success: false, message: "Failed to initialize promotion" });
  }
});

export default router;