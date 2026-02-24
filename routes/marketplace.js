// routes/marketplace.js
import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

// POST /api/marketplace/products
router.post("/products", async (req, res) => {
  try {
    const productData = {
      ...req.body,
      ownerId: req.auth.sub,
      ownerEmail: req.auth.email,
      ownerName: req.auth.name || "Seller", // ✅ REMOVED posterName dependency
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: {
        id: product._id,
        slug: `${product.title.toLowerCase().replace(/s+/g, '-')}-${product._id}`,
        ...product.toObject(),
      },
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// GET /api/marketplace/products - Public listing
router.get("/products", async (req, res) => {
  try {
    const { category, state, city, brand, maxPrice, page = 1, limit = 20 } = req.query;
    const filters = { status: "active" };

    if (category) filters.category = category;
    if (state) filters.state = state;
    if (city) filters.city = city;
    if (brand) filters.brand = brand;
    if (maxPrice) filters.price = { $lte: Number(maxPrice) };

    const skip = (Number(page) - 1) * Number(limit);
    const products = await Product.find(filters)
      .sort({ isPromoted: -1, createdAt: -1 })
      .limit(Number(limit))
      .skip(skip)
      .select("-ownerEmail -phonePrimary -phoneSecondary")
      .lean();

    const total = await Product.countDocuments(filters);

    res.json({
      success: true,
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/marketplace/products/:id
router.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .select("-ownerEmail")
      .lean();
    
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    
    await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router; // ✅ FIXED: Default export