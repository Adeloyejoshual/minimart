// routes/promote.js
import express from "express";
import { Pool } from "pg";
import auth from "../middleware/authMiddleware.js";
import { initializePaystackTransaction } from "../services/paystack.js";

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// ---------------- Initialize Promotion ----------------
router.post("/:productId", auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const { amount } = req.body; // Promotion price set by you

    // Check product ownership
    const { rows } = await pool.query(
      "SELECT id, seller_id FROM minimart_products WHERE id=$1",
      [productId]
    );

    if (!rows[0]) return res.status(404).json({ success: false, message: "Product not found" });
    if (rows[0].seller_id !== req.user.id)
      return res.status(403).json({ success: false, message: "Not authorized to promote this product" });

    // Initialize Paystack payment
    const payment = await initializePaystackTransaction(req.user.email, amount, {
      product_id: productId,
      action: "promote",
    });

    res.json({ success: true, payment });
  } catch (error) {
    console.error("Promotion init error:", error.message);
    res.status(500).json({ success: false, message: "Failed to initialize promotion" });
  }
});

export default router;