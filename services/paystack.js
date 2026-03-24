// services/paystack.js
import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// ---------------- Verify Paystack Payment ----------------
export const verifyPaystackPayment = async (reference) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    const { status, data } = response.data;
    if (status && data.status === "success") {
      return {
        success: true,
        data: {
          reference: data.reference,
          amount: data.amount / 100,
          customer: data.customer,
          metadata: data.metadata,
        },
      };
    }
    throw new Error("Payment verification failed");
  } catch (err) {
    console.error("Paystack verification error:", err.response?.data || err.message);
    throw new Error("Payment verification failed");
  }
};

// ---------------- Initialize Paystack Transaction ----------------
export const initializePaystackTransaction = async (email, amount, metadata = {}) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: Math.round(amount * 100),
        metadata: { ...metadata, platform: "marketplace-app" },
        callback_url: `${process.env.FRONTEND_URL}/payment/success`,
        channels: ["card", "bank_transfer", "ussd"],
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    return { success: true, data: response.data.data };
  } catch (err) {
    console.error("Paystack initialization error:", err.response?.data || err.message);
    throw new Error("Failed to initialize payment");
  }
};

// ---------------- Paystack Webhook ----------------
export const handlePaystackWebhook = async (req, res) => {
  try {
    // Validate signature
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(400).send("Invalid signature");
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const reference = event.data.reference;

      // Verify payment
      const verification = await verifyPaystackPayment(reference);
      if (!verification.success) throw new Error("Payment not verified");

      const metadata = verification.data.metadata;

      // Check if it's a promotion action
      if (metadata.action === "promote") {
        const { user_id, productData, images, promotion_id } = metadata;

        // Insert product into DB
        const query = `
          INSERT INTO products
          (title, description, price, category_id, subcategory_id, images, dynamic_fields, promotion_id, promoted, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
          RETURNING *
        `;

        const cleanedDynamic = productData.dynamic || {};

        const { rows } = await pool.query(query, [
          productData.title,
          productData.description || null,
          productData.price,
          productData.category_id,
          productData.subcategory_id || null,
          images && images.length ? JSON.stringify(images) : null,
          Object.keys(cleanedDynamic).length ? JSON.stringify(cleanedDynamic) : null,
          promotion_id || null,
          true, // promoted
        ]);

        console.log(`✅ Product ${rows[0].id} created and promoted successfully!`);
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(400).send("Webhook error");
  }
};