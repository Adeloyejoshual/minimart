import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { pool } from "../config/db.js";
import authenticate from "../middleware/auth.js";
import { detectSpamListing, updateSellerTrust } from "../utils/listingUtils.js";

const router = express.Router();

/* ─────────────────────────────────────────────
   Cloudinary Config
───────────────────────────────────────────── */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Fail fast check
{
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  if (!cloud_name || !api_key || !api_secret) {
    console.error(
      "⚠️ CLOUDINARY NOT CONFIGURED — uploads will fail."
    );
  }
}

/* ─────────────────────────────────────────────
   Multer (memory)
───────────────────────────────────────────── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* ─────────────────────────────────────────────
   Cloudinary Upload (INLINE)
───────────────────────────────────────────── */
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "minimart/products",
        transformation: [
          { width: 1000, height: 1000, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

/* ─────────────────────────────────────────────
   Safe JSON
───────────────────────────────────────────── */
const safeJSON = (data) => {
  try {
    return JSON.parse(data || "[]");
  } catch {
    return [];
  }
};

/* ─────────────────────────────────────────────
   POST /api/postads
───────────────────────────────────────────── */
router.post(
  "/",
  authenticate,
  upload.array("images", 5),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const {
        name,
        description,
        category,
        condition,
        price,
        originalPrice,
        negotiable,
        keyFeatures,
        specifications,
        whatsInBox,
        phone,
      } = req.body;

      const sellerId = req.user.id;

      // Basic validation
      if (!name || !category || !condition || !price) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      // Upload images first
      const uploads = await Promise.all(
        (req.files || []).map((f) => uploadToCloudinary(f.buffer))
      );

      const mainImage = uploads[0]?.secure_url || null;

      // Spam detection BEFORE insert
      const spamCheck = await detectSpamListing({
        title: name,
        description,
        price,
        seller_id: sellerId,
        main_image: mainImage,
      });

      // Insert product
      const productResult = await client.query(
        `INSERT INTO market.products
        (name, description, category, condition, price, original_price,
         negotiable, phone, seller_id, fraud_score, is_flagged)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id`,
        [
          name,
          description || null,
          category,
          condition,
          price,
          originalPrice || null,
          negotiable === "true" || negotiable === true,
          phone || null,
          sellerId,
          spamCheck.score,
          spamCheck.isSpam,
        ]
      );

      const productId = productResult.rows[0].id;

      // Save images
      for (let i = 0; i < uploads.length; i++) {
        await client.query(
          `INSERT INTO market.product_images
           (product_id, image_url, is_primary)
           VALUES ($1,$2,$3)`,
          [productId, uploads[i].secure_url, i === 0]
        );
      }

      // Features
      for (const f of safeJSON(keyFeatures)) {
        await client.query(
          `INSERT INTO market.product_features (product_id, feature)
           VALUES ($1,$2)`,
          [productId, f]
        );
      }

      // Specs
      for (const s of safeJSON(specifications)) {
        await client.query(
          `INSERT INTO market.product_specifications
           (product_id, spec_key, spec_value)
           VALUES ($1,$2,$3)`,
          [productId, s.key, s.value]
        );
      }

      // Box items
      for (const item of safeJSON(whatsInBox)) {
        await client.query(
          `INSERT INTO market.product_box_items (product_id, item)
           VALUES ($1,$2)`,
          [productId, item]
        );
      }

      await client.query("COMMIT");

      // Update trust score async (non-blocking)
      updateSellerTrust(sellerId);

      res.json({
        success: true,
        productId,
        fraud: spamCheck,
        message: "Product posted successfully",
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);

      res.status(500).json({
        success: false,
        message: "Failed to create product",
      });
    } finally {
      client.release();
    }
  }
);

export default router;