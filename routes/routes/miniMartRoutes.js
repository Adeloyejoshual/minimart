import express from "express";
import MiniMartProduct from "../models/MiniMartProduct.js";

const router = express.Router();

// ✅ Get all MiniMart products
router.get("/api/mart-products", async (req, res) => {
  try {
    const products = await MiniMartProduct.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("Failed to fetch products:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// ✅ Add a product to MiniMart
router.post("/api/mart-products", async (req, res) => {
  try {
    const { sellerId, sellerName, userEmail, title, description, images, category, price } = req.body;

    const product = new MiniMartProduct({
      sellerId,
      sellerName,
      userEmail,
      title,
      description,
      images,
      category,
      price,
      status: "Approved" // Fully open
    });

    await product.save();
    res.status(201).json(product);
  } catch (err) {
    console.error("Failed to add product:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

export default router;