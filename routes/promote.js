// routes/promote.js
import express from "express";
import { Pool } from "pg";
import auth from "../middleware/authMiddleware.js";
import { initializePaystackTransaction } from "../services/paystack.js";

const router = express.Router();

// PostgreSQL / CockroachDB pool
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// ---------------- POST /promote/:productId ----------------
// Initialize product promotion via Paystack
router.post("/:productId", auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const { amount } = req.body; // promotion price

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: "Invalid promotion amount" });
    }

    // Verify ownership
    const { rows } = await pool.query(
      "SELECT id, seller_id FROM minimart_products WHERE id=$1",
      [productId]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (rows[0].seller_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "You are not authorized to promote this product" });
    }

    // Initialize Paystack payment
    const payment = await initializePaystackTransaction(req.user.email, Number(amount), {
      product_id: productId,
      action: "promote",
    });

    res.json({
      success: true,
      message: "Promotion initialized successfully",
      payment, // includes authorization_url, reference, etc.
    });
  } catch (error) {
    console.error("Promotion initialization error:", error.message);
    res.status(500).json({ success: false, message: "Failed to initialize promotion" });
  }
});

export default router;