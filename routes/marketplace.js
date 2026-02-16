// src/routes/marketplace.js
import express from "express";
import MarketplaceProduct from "../models/MarketplaceProduct.js";

const router = express.Router();

/**
 * GET /api/marketplace
 * Fetch all marketplace products, sorted by newest first
 */
router.get("/", async (req, res) => {
  try {
    const products = await MarketplaceProduct.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("GET /api/marketplace error:", err);
    res.status(500).json({ message: "Failed to fetch Marketplace products" });
  }
});

/**
 * GET /api/marketplace/:id
 * Fetch a single product by ID
 */
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

/**
 * POST /api/marketplace
 * Add a new product
 * Expects JSON body:
 * {
 *   title, description, price, images[], category, brand, model, condition,
 *   country, state, city, etc.
 * }
 */
router.post("/", async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      images,
      category,
      subcategory,
      brand,
      model,
      condition,
      ram,
      storage,
      color,
      sim,
      features,
      exchange_possible,
      phone_number,
      poster_name,
      location,
      video_link,
      delivery,
      promoted,
      promo_plan,
    } = req.body;

    // Basic validation
    if (!title || !price) {
      return res.status(400).json({ message: "Title and price are required" });
    }

    const product = await MarketplaceProduct.create({
      title: title.trim(),
      description: description?.trim() || "",
      price: parseFloat(price),
      images: images || [],           // array of Cloudinary URLs
      category: category || "",
      subcategory: subcategory || "",
      brand: brand || "",
      model: model || "",
      condition: condition || "",
      ram: ram || "",
      storage: storage || "",
      color: color || "",
      sim: sim || "",
      features: features || "",
      exchange_possible: exchange_possible || false,
      phone_number: phone_number || "",
      poster_name: poster_name || "",
      location: location || "",
      video_link: video_link || "",
      delivery: delivery || {},
      promoted: promoted || false,
      promo_plan: promo_plan || "",
      country: req.body.country || "Nigeria",
      state: req.body.state || "",
      city: req.body.city || "",
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("POST /api/marketplace error:", err);
    res.status(500).json({ message: "Failed to add Marketplace product" });
  }
});

/**
 * DELETE /api/marketplace/:id
 * Remove a product by ID
 */
router.delete("/:id", async (req, res) => {
  try {
    const product = await MarketplaceProduct.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("DELETE /api/marketplace/:id error:", err);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

export default router;