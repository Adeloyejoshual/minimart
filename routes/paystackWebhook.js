// routes/paystackWebhook.js
import express from "express";
import crypto from "crypto";
import prisma from "../prisma.js";

const router = express.Router();

// ---------------- PAYSTACK SECRET ----------------
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// ---------------- PAYSTACK WEBHOOK ----------------
router.post("/", express.json({ type: "*/*" }), async (req, res) => {
  try {
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    // Verify signature
    if (req.headers["x-paystack-signature"] !== hash) {
      return res.status(401).send("Unauthorized: Invalid signature");
    }

    const event = req.body;

    // Only act on successful payments
    if (event.event === "charge.success") {
      const { reference, amount, metadata } = event.data;

      // metadata should contain product_id and promotion_id
      const { product_id, promotion_id } = metadata;

      if (!product_id || !promotion_id) {
        console.error("Missing metadata in Paystack webhook:", metadata);
        return res.status(400).send("Missing metadata");
      }

      // Update product with promotion info
      await prisma.minimart_products.update({
        where: { id: Number(product_id) },
        data: {
          promotion_id: Number(promotion_id),
          promotion_start: new Date(),
          promotion_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // Example: 7 days for promotion, can be dynamic
        },
      });

      console.log(`Promotion applied: Product ${product_id}, Plan ${promotion_id}`);
    }

    res.send("Webhook received");
  } catch (err) {
    console.error("Paystack webhook error:", err);
    res.status(500).send("Internal Server Error");
  }
});

export default router;