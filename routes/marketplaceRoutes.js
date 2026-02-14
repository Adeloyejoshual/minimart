// routes/marketplaceRoutes.js
import express from "express";
import multer from "multer";
import MarketplaceProduct from "../models/MarketplaceProduct.js";
import { authMiddleware } from "../middleware/auth.js"; // optional: protects routes

const router = express.Router();

// ---------------- Multer Setup for Images ----------------
const storage = multer.memoryStorage(); // or diskStorage
const upload = multer({ storage });

// ---------------- Add a Product ----------------
router.post("/", authMiddleware, upload.array("images", 5), async (req, res) => {
  try {
    const { title, description, category, subCategory, price, country, state, city, negotiable, flashSale } = req.body;

    // Handle images: ideally upload to Cloudinary
    const images = req.files?.map(file => file.path) || []; // replace with Cloudinary upload later

    const product = new MarketplaceProduct({
      title,
      description,
      category,
      subCategory,
      price,
      country,
      state,
      city,
      negotiable: negotiable === "true",
      flashSale: flashSale === "true",
      images,
      ownerId: req.user._id, // authMiddleware sets req.user
    });

    await product.save();
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add product" });
  }
});

// ---------------- Get All Products ----------------
router.get("/", async (req, res) => {
  try {
    const products = await MarketplaceProduct.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ---------------- Get Product by ID ----------------
router.get("/:id", async (req, res) => {
  try {
    const product = await MarketplaceProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// ---------------- Update Product ----------------
router.put("/:id", authMiddleware, upload.array("images", 5), async (req, res) => {
  try {
    const product = await MarketplaceProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (!product.ownerId.equals(req.user._id)) return res.status(403).json({ error: "Not allowed" });

    Object.assign(product, req.body);

    if (req.files?.length) {
      const newImages = req.files.map(file => file.path); // replace with Cloudinary URL
      product.images.push(...newImages);
    }

    await product.save();
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// ---------------- Delete Product ----------------
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const product = await MarketplaceProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (!product.ownerId.equals(req.user._id)) return res.status(403).json({ error: "Not allowed" });

    await product.remove();
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;