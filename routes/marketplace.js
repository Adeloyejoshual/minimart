// routes/marketplace.js

import express from "express";
import authenticate from "../middleware/auth.js";
import rateLimit from "express-rate-limit";

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

/* ===================== RATE LIMITING ===================== */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // protect feed endpoints
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // protect upload spam
});

/* ===================== APPLY GLOBAL LIMITER ===================== */
router.use(apiLimiter);

/* ===================== CLOUDINARY SIGNATURE ===================== */
router.get("/cloudinary-signature", authenticate, (req, res) => {
  try {
    const timestamp = Math.round(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder: "products",
      },
      process.env.CLOUDINARY_API_SECRET
    );

    return res.json({
      timestamp,
      signature,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    console.error("Cloudinary signature error:", err);
    return res.status(500).json({ error: "Signature generation failed" });
  }
});

/* ===================== PRODUCT ROUTES ===================== */
router.get("/products", getProductsHandler);

router.get("/product/:slug", getProductHandler);

router.get("/products/:id", getProductByIdHandler);

router.post(
  "/products",
  authenticate,
  uploadLimiter,
  upload.array("images", 6),
  createProductHandler
);

/* ===================== CATEGORY ROUTES ===================== */
router.get("/categories", getCategoriesHandler);

export default router;