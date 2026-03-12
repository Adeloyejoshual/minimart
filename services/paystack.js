// services/paystack.js
import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

// Paystack config
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

// PostgreSQL / CockroachDB pool
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// ---------------- Verify Paystack Payment ----------------
export const verifyPaystackPayment = async (reference) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { status, data } = response.data;

    if (status && data.status === "success") {
      return {
        success: true,
        data: {
          reference: data.reference,
          amount: data.amount / 100, // Convert kobo -> naira
          customer: data.customer,
          metadata: data.metadata,
        },
      };
    }

    throw new Error("Payment verification failed");
  } catch (error) {
    console.error(
      "Paystack verification error:",
      error.response?.data || error.message
    );
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
        amount: Math.round(amount * 100), // Convert naira -> kobo
        metadata: { ...metadata, platform: "marketplace-app" },
        callback_url: `${process.env.FRONTEND_URL}/payment/success`,
        channels: ["card", "bank_transfer", "ussd"],
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return { success: true, data: response.data.data };
  } catch (error) {
    console.error(
      "Paystack initialization error:",
      error.response?.data || error.message
    );
    throw new Error("Failed to initialize payment");
  }
};

// ---------------- Handle Paystack Webhook ----------------
export const handlePaystackWebhook = async (req, res) => {
  try {
    // Validate webhook signature
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

      // ---------------- Handle Product Promotion ----------------
      if (verification.success && verification.data.metadata.action === "promote") {
        const productId = verification.data.metadata.product_id;

        // Update product in DB: mark as promoted
        await pool.query(
          "UPDATE minimart_products SET promoted=TRUE WHERE id=$1",
          [productId]
        );

        console.log(`✅ Product ${productId} promoted successfully!`);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Paystack webhook error:", error);
    res.status(400).send("Webhook error");
  }
};