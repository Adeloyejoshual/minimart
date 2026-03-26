import express from "express";
import { Pool } from "pg";
import dotenv from "dotenv";
import cloudinary from "cloudinary";
import auth from "../middleware/authMiddleware.js";
import { verifyPaystackTransaction } from "../services/paystack.js";

dotenv.config();

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// ---------------- CLOUDINARY CONFIG ----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// POST /api/promote/verify
router.post("/verify", auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ message: "Reference required" });

    // Verify Paystack payment
    const paymentData = await verifyPaystackTransaction(reference);
    if (paymentData.status !== "success") {
      return res.status(400).json({ message: "Payment failed or pending" });
    }

    const metadata = paymentData.metadata || {};
    const {
      title,
      description,
      category_id,
      subcategory_id,
      dynamicFields,
      images = [],
      price,
      promotion_id,
    } = metadata;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing required product fields" });
    }

    await client.query("BEGIN");

    // 1️⃣ Insert product
    const { rows } = await client.query(
      `
      INSERT INTO products
      (title, description, price, category_id, subcategory_id, dynamic_fields, promotion_id, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7, now())
      RETURNING *
      `,
      [
        title,
        description || null,
        price,
        category_id,
        subcategory_id || null,
        Object.keys(dynamicFields || {}).length ? JSON.stringify(dynamicFields) : null,
        promotion_id || null,
      ]
    );

    const product = rows[0];

    // 2️⃣ Upload images to Cloudinary & save in product_images
    if (images.length) {
      const uploadedUrls = await Promise.all(
        images.map((img) => 
          new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "minimart_products" },
              (err, result) => (err ? reject(err) : resolve(result.secure_url))
            );
            stream.end(Buffer.from(img, "base64"));
          })
        )
      );

      await Promise.all(
        uploadedUrls.map((url, index) =>
          client.query(
            "INSERT INTO product_images (product_id, image_url, position) VALUES ($1,$2,$3)",
            [product.id, url, index]
          )
        )
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Payment verified and product promoted successfully!",
      product,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /promote/verify error:", err);
    res.status(500).json({ message: "Failed to verify payment" });
  } finally {
    client.release();
  }
});

export default router;