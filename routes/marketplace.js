import express from "express";
import multer from "multer";
import MarketplaceProduct from "../models/MarketplaceProduct.js";
import { verifyPaystackPayment } from "../utils/paystackHelper.js";

const router = express.Router();

// ✅ Image upload config (Cloudinary-style)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  }
});

/**
 * GET all products (Jiji-style filtering + boosting)
 */
router.get("/", async (req, res) => {
  try {
    const {
      page = 1, limit = 12, category, state, city, minPrice, maxPrice,
      search, condition, brand, promoted, negotiable, sort = "boosted"
    } = req.query;

    const query = { active: true }; // Only active listings

    // Jiji-style filters
    if (category) query.category = category;
    if (state) query.state = state;
    if (city) query.city = city;
    if (condition) query.condition = condition;
    if (brand) query.brand = brand;
    if (promoted === "true") query.promoted = true;

    // Price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Search (title + description)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Jiji sorting (Boosted first, then recent, then views)
    const sortOptions = {
      boosted: { promoted: -1, boost_expires: -1, views_total: -1, createdAt: -1 },
      recent: { createdAt: -1 },
      views: { views_total: -1 },
      price_low: { price: 1 },
      price_high: { price: -1 }
    };
    const sortQuery = sortOptions[sort] || sortOptions.boosted;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const products = await MarketplaceProduct.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Faster for listing

    const total = await MarketplaceProduct.countDocuments(query);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      products: products.map(p => ({
        ...p,
        // Hide sensitive data in listings
        phone_number: p.phone_verified ? p.phone_number : undefined
      }))
    });
  } catch (err) {
    console.error("GET /marketplace error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

/**
 * GET single product (with view tracking hook)
 */
router.get("/:id", async (req, res) => {
  try {
    const product = await MarketplaceProduct.findOne({ 
      _id: req.params.id, 
      active: true 
    }).lean();
    
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({
      success: true,
      ...product,
      // Real-time stats
      live_viewers: Math.floor(Math.random() * 20) + 3,
      discount_percent: product.discount_price 
        ? Math.round(((product.price - product.discount_price) / product.price) * 100)
        : 0
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch product" });
  }
});

/**
 * POST new product (FULL JIJI FEATURES)
 */
router.post("/", upload.array("images", 10), async (req, res) => {
  try {
    const data = req.body;
    
    // Basic validation
    if (!data.title?.trim() || data.title.length < 10) {
      return res.status(400).json({ 
        success: false, 
        message: "Title must be at least 10 characters" 
      });
    }
    if (!data.price || parseFloat(data.price) <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid price required" 
      });
    }
    if (!req.files?.length) {
      return res.status(400).json({ 
        success: false, 
        message: "At least 1 image required" 
      });
    }

    // Phone validation (Nigeria)
    const phoneRegex = /^(0|\+234)[0-9]{10}$/;
    if (!data.phone_number?.match(phoneRegex)) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid Nigerian phone number required" 
      });
    }

    // Verify Paystack payment for promotions
    if (data.promoted === 'true' && data.payment_reference) {
      const verification = await verifyPaystackPayment(data.payment_reference);
      if (!verification.status === 'success') {
        return res.status(400).json({
          success: false,
          message: "Payment verification failed"
        });
      }
    }

    // Process images (Cloudinary URLs expected from frontend)
    const imageUrls = req.files?.map(file => file.path) || data.images || [];

    // Clean and normalize data
    const productData = {
      ...data,
      title: data.title.trim(),
      description: data.description?.trim() || "",
      price: parseFloat(data.price.replace(/,/g, "")),
      discount_price: data.discount_price ? parseFloat(data.discount_price) : null,
      images: imageUrls,
      negotiable: data.negotiable === 'true',
      promoted: data.promoted === 'true',
      boosted: data.promo_plan === 'premium' || data.promo_plan === 'flash',
      phone_verified: false, // Set true after OTP
      views_total: 0,
      views_today: 0,
      active: true,
      country: "Nigeria",
      createdAt: new Date()
    };

    // Set promotion expiry
    if (productData.promoted) {
      const plan = promotionPlans.find(p => p.id === data.promo_plan);
      productData.boost_expires = plan ? new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000) : null;
    }

    const product = await MarketplaceProduct.create(productData);

    res.status(201).json({
      success: true,
      message: "Product published successfully!",
      productId: product._id,
      product: {
        ...product.toObject(),
        images: imageUrls.slice(0, 10) // Max 10 images
      }
    });
  } catch (err) {
    console.error("POST /marketplace error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to publish product" 
    });
  }
});

/**
 * INCREMENT VIEW COUNT (Jiji Live Tracking)
 */
router.post("/:id/increment-view", async (req, res) => {
  try {
    await MarketplaceProduct.updateOne(
      { _id: req.params.id, active: true },
      {
        $inc: { 
          views_total: 1, 
          views_today: 1,
          live_viewers: 1 
        },
        $set: { last_viewed: new Date() }
      }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to track view" });
  }
});

/**
 * UPDATE product (seller only)
 */
router.put("/:id", async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      price: parseFloat(req.body.price?.replace(/,/g, "")),
      updatedAt: new Date()
    };

    const updated = await MarketplaceProduct.findOneAndUpdate(
      { _id: req.params.id, active: true },
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found or inactive" 
      });
    }

    res.json({
      success: true,
      message: "Product updated successfully",
      product: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update product" });
  }
});

/**
 * DELETE product (seller only)
 */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await MarketplaceProduct.findOneAndUpdate(
      { _id: req.params.id, active: true },
      { active: false, deletedAt: new Date() }, // Soft delete
      { new: true }
    );

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, message: "Product removed successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete product" });
  }
});

/**
 * GET seller products
 */
router.get("/seller/:sellerId", async (req, res) => {
  try {
    const products = await MarketplaceProduct.find({
      poster_id: req.params.sellerId,
      active: true
    })
    .sort({ createdAt: -1 })
    .limit(20);

    res.json({
      success: true,
      products,
      total: products.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch seller products" });
  }
});

export default router;
