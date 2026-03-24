// services/paystack.js
import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import { Pool } from "pg";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

// ---------------- CONFIG ----------------
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------------- VERIFY PAYMENT ----------------
export const verifyPaystackPayment = async (reference) => {
  try {
    const response = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

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
  } catch (error) {
    console.error("Paystack verification error:", error.response?.data || error.message);
    throw new Error("Payment verification failed");
  }
};

// ---------------- INITIALIZE PAYMENT ----------------
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
  } catch (error) {
    console.error("Paystack initialization error:", error.response?.data || error.message);
    throw new Error("Failed to initialize payment");
  }
};

// ---------------- HANDLE WEBHOOK ----------------
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
      if (!verification.success) throw new Error("Payment verification failed");

      const metadata = verification.data.metadata;

      // Only handle promotion products
      if (metadata.promotion_id) {
        // Upload images if provided (base64 or URLs from frontend metadata)
        let uploadedImages = [];
        if (metadata.images && Array.isArray(metadata.images) && metadata.images.length) {
          uploadedImages = await Promise.all(
            metadata.images.map((file) =>
              new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                  { folder: "minimart_products" },
                  (err, result) => (err ? reject(err) : resolve(result.secure_url))
                );
                // If file is base64 string, convert to buffer
                const buffer = Buffer.from(file.split(",")[1], "base64");
                stream.end(buffer);
              })
            )
          );
        }

        // Insert promoted product into DB
        const query = `
          INSERT INTO products
          (title, description, price, category_id, subcategory_id, images, dynamic_fields, promotion_id, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
          RETURNING *
        `;
        const { rows } = await pool.query(query, [
          metadata.title,
          metadata.description || null,
          metadata.price,
          metadata.category_id,
          metadata.subcategory_id || null,
          uploadedImages.length ? JSON.stringify(uploadedImages) : null,
          Object.keys(metadata.dynamicFields || {}).length
            ? JSON.stringify(metadata.dynamicFields)
            : null,
          metadata.promotion_id,
        ]);

        console.log(`✅ Promoted product created successfully: ${rows[0].id}`);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Paystack webhook error:", error);
    res.status(400).send("Webhook error");
  }
};