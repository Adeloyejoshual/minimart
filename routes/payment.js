import express from "express";
import { Pool } from "pg";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* =====================================================
PAYSTACK INITIALIZE (Frontend calls this)
============================================================ */
router.post("/initialize", async (req, res) => {
  try {
    const { email, amount, planId, productId } = req.body;

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amount * 100, // kobo
        callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
        metadata: {
          planId,
          productId,
          custom_fields: [
            { display_name: "Product ID", variable_name: "product_id", value: productId },
          ],
        },
      }),
    });

    const data = await response.json();
    if (!data.status) throw new Error(data.message || "Payment initialize failed");

    res.json({
      success: true,
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    });
  } catch (err) {
    console.error("Payment init error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =====================================================
PAYSTACK WEBHOOK (Paystack calls this)
============================================================ */
router.post("/paystack", async (req, res) => {
  try {
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(400).send("Invalid signature");
    }

    const { event, data } = req.body;

    if (event === "charge.success") {
      const { metadata } = data;
      const productId = metadata.custom_fields?.[0]?.value;
      const planId = metadata.planId;

      if (!productId || !planId) {
        console.warn("Missing productId or planId in webhook metadata");
        return res.status(400).send("Missing metadata");
      }

      const result = await pool.query(
        `
        UPDATE products 
        SET status = 'active',
            is_active = true,
            promotion_id = $1,
            promotion_priority = COALESCE(promotion_priority, 0) + 1,
            updated_at = NOW()
        WHERE id = $2 AND status = 'draft'
        `,
        [planId, productId]
      );

      console.log(
        `✅ Webhook activated product: ${productId} (` +
          `promo: ${planId}, rows affected: ${result.rowCount})`
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("Webhook failed");
  }
});

/* =====================================================
ACTIVATE PRODUCT (Free plan or webhook fallback)
============================================================ */
router.post("/products/:id/activate", async (req, res) => {
  try {
    const { id } = req.params;
    const { promotion_id } = req.body;

    const result = await pool.query(
      `
      UPDATE products 
      SET status = 'active',
          is_active = true,
          promotion_id = $1,
          promotion_priority = COALESCE(promotion_priority, 0) + 1,
          updated_at = NOW()
      WHERE id = $2 AND status = 'draft'
      RETURNING id
      `,
      [promotion_id || null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Draft product not found or already published" });
    }

    res.json({
      success: true,
      message: "Product activated successfully",
      product_id: result.rows[0].id,
    });
  } catch (err) {
    console.error("Activate error:", err);
    res.status(500).json({ message: "Activation failed" });
  }
});

export default router;