// routes/marketplace.js
import express from "express";
import authenticate from "../middleware/auth.js";

import { upload } from "../utils/multer.js";
import { getCategoriesHandler } from "../controllers/category.controller.js";
import {
  getProductsHandler,
  getProductHandler,
  getProductByIdHandler,
  createProductHandler,
} from "../controllers/product.controller.js";

import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

// --- 1. Cloudinary upload signature (client‑side SDK) ---
router.get("/cloudinary-signature", (req, res) => {
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder: "products",
        transformation: [
          { width: 900, height: 900, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      timestamp,
      signature,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    console.error("Signature error:", err);
    res.status(500).json({ error: "Signature generation failed" });
  }
});

// --- 2. Product API ---
router.get("/products", getProductsHandler);                    // feed + trending
router.get("/product/:slug", getProductHandler);                // SEO slug route
router.get("/products/:id", getProductByIdHandler);             // direct by ID
router.post("/products", authenticate, upload.array("images", 6), createProductHandler);

// --- 3. Category API (for AddProduct.jsx dropdown) ---
router.get("/categories", getCategoriesHandler);

export default router;