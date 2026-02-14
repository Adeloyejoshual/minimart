// src/routes/marketplaceRoutes.js
import express from "express";
import MarketplaceProduct from "../models/MarketplaceProduct.js";

const router = express.Router();

// Add a new product
router.post("/products", async (req, res) => {
  try {
    const data = req.body;

    if (!data.ownerId) return res.status(400).json({ error: "ownerId is required" });
    if (!data.title || !data.price || !data.images || !data.images.length)
      return res.status(400).json({ error: "Title, price, and images are required" });

    // Convert images to ImageSchema format
    const images = data.images.map((url) => ({ url, alt: "" }));

    // Build product object
    const product = new MarketplaceProduct({
      ...data,
      images,
    });

    await product.save();
    res.status(201).json({ message: "Product added", product });
  } catch (err) {
    console.error("Error adding product:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;