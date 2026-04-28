// routes/marketplace.js
import express from "express";
import authenticate from "../middleware/auth.js";
import { upload } from "../utils/multer.js";

import { v2 as cloudinary } from "cloudinary"; // ✅ top‑level import

import {
  getProductsHandler,
  getProductHandler,
  getProductByIdHandler,
  createProductHandler,
} from "../controllers/product.controller.js";

const router = express.Router();

// Cloudinary signature
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

// --- Product routes ---
router.get("/products", getProductsHandler);
router.get("/product/:slug", getProductHandler); // SEO slug route
router.get("/products/:id", getProductByIdHandler);
router.post("/products", authenticate, upload.array("images", 6), createProductHandler);

export default router;