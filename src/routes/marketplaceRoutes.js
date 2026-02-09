// src/routes/marketplaceRoutes.js
import express from "express";
import multer from "multer";
import MarketplaceProduct from "../models/MarketplaceProduct.js";

const router = express.Router();

// Set up multer for file uploads (store locally in /uploads)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Add a new product
router.post("/products", upload.array("images", 5), async (req, res) => {
  try {
    const { title, description, price, userEmail } = req.body;

    // Save uploaded file paths
    const imagePaths = req.files.map((file) => `/uploads/${file.filename}`);

    const product = new MarketplaceProduct({
      title,
      description,
      price,
      images: imagePaths,
      userEmail,
    });

    await product.save();
    res.status(201).json({ message: "Product added", product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;