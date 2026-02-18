import express from "express";
import MarketplaceProduct from "../models/MarketplaceProduct.js";
import { verifyPaystackPayment } from "../utils/paystackHelper.js"; // Backend helper

const router = express.Router();

/**
 * GET all marketplace products
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
 * GET single product by ID
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
 * POST new product
 * If `promoted` is true, verify Paystack payment before saving
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
      payment_reference, // REQUIRED for promoted products
      country,
      state,
      city,
      engine,
      mileage,
      year,
      fuel_type,
      transmission,
      age_range,
      bedrooms,
      bathrooms,
      size,
      furnished,
    } = req.body;

    // Basic validation
    if (!title?.trim() || !price) {
      return res.status(400).json({ message: "Title and price are required" });
    }

    // If promotion selected → verify Paystack
    if (promoted && promo_plan) {
      if (!payment_reference) {
        return res.status(400).json({ message: "Payment reference required for promotion" });
      }

      const verification = await verifyPaystackPayment(payment_reference);

      if (!verification.success) {
        return res.status(400).json({ message: "Promotion payment not verified" });
      }
    }

    // Save product
    const product = await MarketplaceProduct.create({
      title: title.trim(),
      description: description?.trim() || "",
      price: parseFloat(price),
      images: Array.isArray(images) ? images : [],
      category: category || "",
      subcategory: subcategory || "",
      brand: brand || "",
      model: model || "",
      condition: condition || "",
      ram: ram || "",
      storage: storage || "",
      color: color || "",
      sim: sim || [],
      features: features || [],
      exchange_possible: exchange_possible || false,
      phone_number: phone_number || "",
      poster_name: poster_name || "",
      location: location || "",
      video_link: video_link || "",
      delivery: delivery || {},
      promoted: promoted || false,
      promo_plan: promo_plan || "",
      payment_reference: payment_reference || null,
      country: country || "Nigeria",
      state: state || "",
      city: city || "",
      engine: engine || "",
      mileage: mileage ? parseFloat(mileage) : null,
      year: year ? parseInt(year) : null,
      fuel_type: fuel_type || "",
      transmission: transmission || "",
      age_range: age_range || "",
      bedrooms: bedrooms ? parseInt(bedrooms) : null,
      bathrooms: bathrooms ? parseInt(bathrooms) : null,
      size: size || "",
      furnished: furnished || false,
    });

    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    console.error("POST /api/marketplace error:", err);
    res.status(500).json({ message: "Failed to add Marketplace product" });
  }
});

/**
 * DELETE product by ID
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