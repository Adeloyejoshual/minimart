// routes/marketplace.js
import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { initializePaystackTransaction } from "../services/paystack.js";
import auth from "../middleware/authMiddleware.js";

// Config imports
import { brands } from "../src/config/brands.js";
import { colors } from "../src/config/colors.js";
import { categoryFields } from "../src/config/categoryFields.js";
import { conditions, usedDetails } from "../src/config/conditions.js";
import { featuresByCategory } from "../src/config/featuresByCategory.js";
import { models } from "../src/config/models.js";
import { ramOptions } from "../src/config/ramOptions.js";
import { sims } from "../src/config/sims.js";
import { storageOptions } from "../src/config/storageOptions.js";
import { years } from "../src/config/years.js";
import { engines } from "../src/config/engines.js";
import { fuelTypes } from "../src/config/fuelTypes.js";
import { locationsByState } from "../src/config/locationsByState.js";
import { promotionPlans, getActivePrice } from "../src/config/promotions.js";

dotenv.config();
const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer
const upload = multer({ storage: multer.memoryStorage() });

/* =========================================================
   INITIATE PRODUCT PROMOTION PAYMENT
   (Step 1: Before product creation)
========================================================= */
router.post("/products/initiate", auth, upload.array("images"), async (req, res) => {
  try {
    const { title, description, price, category_id, subcategory_id, dynamicFields, promotion_id } = req.body;

    // Validation
    if (!title || !price || !category_id) return res.status(400).json({ message: "Title, price, and category are required" });

    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) return res.status(400).json({ message: "Invalid price" });

    // Fetch category
    const { rows: categoryRows } = await pool.query("SELECT id, name, fields_key FROM categories WHERE id = $1", [category_id]);
    if (!categoryRows.length) return res.status(400).json({ message: "Invalid category_id" });
    const category = categoryRows[0];

    // Clean dynamic fields
    let parsedFields = {};
    try {
      parsedFields = typeof dynamicFields === "string" ? JSON.parse(dynamicFields) : dynamicFields || {};
    } catch {
      return res.status(400).json({ message: "Invalid dynamicFields format" });
    }
    const allowedKeys = categoryFields[category.fields_key] || [];
    const cleanedFields = Object.fromEntries(
      Object.entries(parsedFields).filter(([k]) => allowedKeys.includes(k))
    );

    // Upload images to Cloudinary immediately
    const uploadedImages = req.files?.length
      ? await Promise.all(
          req.files.map(file =>
            new Promise((resolve, reject) => {
              const stream = cloudinary.uploader.upload_stream({ folder: "minimart_temp" }, (err, result) => err ? reject(err) : resolve(result.secure_url));
              stream.end(file.buffer);
            })
          )
        )
      : [];

    // Determine promotion price
    let activePrice = priceNum;
    let promotionPlan = null;
    if (promotion_id) {
      promotionPlan = promotionPlans.find(p => p.id == promotion_id) || null;
      if (promotionPlan) activePrice = getActivePrice(priceNum, promotionPlan.discount);
    }

    // Initialize Paystack transaction
    const payment = await initializePaystackTransaction(req.user.email, activePrice, {
      action: "create_product",
      user_id: req.user.id,
      product_data: {
        title,
        description,
        price: activePrice,
        category_id,
        subcategory_id,
        dynamicFields: cleanedFields,
        images: uploadedImages,
        promotion_id: promotion_id || null,
      },
    });

    res.json({ success: true, payment });
  } catch (err) {
    console.error("Initiate product promotion payment error:", err);
    res.status(500).json({ message: "Failed to initialize promotion payment" });
  }
});

export default router;