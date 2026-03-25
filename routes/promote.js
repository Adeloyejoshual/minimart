// routes/promote.js
import express from "express";
import { Pool } from "pg";
import auth from "../middleware/authMiddleware.js";
import { verifyPaystackTransaction } from "../services/paystack.js";

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// POST /api/promote/verify
router.post("/verify", auth, async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ message: "Reference required" });

    // Verify with Paystack
    const paymentData = await verifyPaystackTransaction(reference);

    if (!paymentData.status || paymentData.status !== "success") {
      return res.status(400).json({ message: "Payment failed or pending" });
    }

    // Extract metadata from transaction
    const metadata = paymentData.metadata || {};
    const {
      title,
      description,
      category_id,
      subcategory_id,
      dynamicFields,
      images,
      price,
      promotion_id,
    } = metadata;

    // ---------- UPLOAD IMAGES ----------
    const uploadedImages = images.length
      ? await Promise.all(
          images.map(
            (file) =>
              new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                  { folder: "minimart_products" },
                  (err, result) => (err ? reject(err) : resolve(result.secure_url))
                );
                stream.end(Buffer.from(file, "base64"));
              })
          )
        )
      : [];

    // ---------- SAVE PRODUCT ----------
    const { rows } = await pool.query(
      `
      INSERT INTO products
      (title, description, price, category_id, subcategory_id, images, dynamic_fields, promotion_id, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
      RETURNING *
      `,
      [
        title,
        description || null,
        price,
        category_id,
        subcategory_id || null,
        uploadedImages.length ? JSON.stringify(uploadedImages) : null,
        Object.keys(dynamicFields || {}).length ? JSON.stringify(dynamicFields) : null,
        promotion_id || null,
      ]
    );

    const product = rows[0];

    res.json({
      success: true,
      message: "Payment verified and product saved",
      product,
    });
  } catch (err) {
    console.error("POST /promote/verify error:", err);
    res.status(500).json({ message: "Failed to verify payment" });
  }
});

export default router;