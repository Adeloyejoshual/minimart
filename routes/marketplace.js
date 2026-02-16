import express from "express";
import MarketplaceProduct from "../models/MarketplaceProduct.js";

const router = express.Router();

// GET all products
router.get("/", async (req, res) => {
  try {
    const products = await MarketplaceProduct.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("GET /api/marketplace error:", err);
    res.status(500).json({ message: "Failed to fetch Marketplace products" });
  }
});

// GET single product
router.get("/:id", async (req, res) => {
  try {
    const product = await MarketplaceProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error("GET /api/marketplace/:id error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// POST new product (JSON only)
router.post("/", async (req, res) => {
  try {
    const { title, description, price, image, country, state, city } = req.body;
    if (!title || !price) return res.status(400).json({ message: "Title and price are required" });

    const product = await MarketplaceProduct.create({
      title: title.trim(),
      description: description?.trim() || "",
      price: parseFloat(price),
      image: image || null,
      country: country || "Nigeria",
      state: state || "",
      city: city || "",
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("POST /api/marketplace error:", err);
    res.status(500).json({ message: "Failed to add Marketplace product" });
  }
});

// DELETE product
router.delete("/:id", async (req, res) => {
  try {
    const product = await MarketplaceProduct.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("DELETE /api/marketplace/:id error:", err);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

export default router;