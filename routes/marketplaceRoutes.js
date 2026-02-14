import express from "express";
import MarketplaceProduct from "../models/MarketplaceProduct.js";
import axios from "axios";

const router = express.Router();

// Add a new product
router.post("/products", async (req, res) => {
  try {
    const {
      title,
      category,
      subcategory,
      brand,
      model,
      condition,
      usedDetail,
      price,
      discountPrice,
      negotiable,
      description,
      specifications,
      country,
      state,
      city,
      images, // array of URLs from frontend (Cloudinary)
      promotionPlan,
      ownerId,
    } = req.body;

    if (!title || !price || !images || images.length === 0)
      return res.status(400).json({ error: "Title, price, and images are required" });

    // Format images to match schema
    const formattedImages = images.map((url) => ({ url, alt: "" }));

    const product = new MarketplaceProduct({
      title,
      category,
      subcategory,
      brand,
      model,
      condition,
      usedDetail,
      price,
      discountPrice,
      negotiable,
      description,
      specifications: specifications || [],
      country,
      state,
      city,
      images: formattedImages,
      promotionPlan: promotionPlan || {},
      ownerId,
    });

    await product.save();

    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    console.error("Error adding product:", err);
    res.status(500).json({ error: "Server error adding product" });
  }
});

export default router;