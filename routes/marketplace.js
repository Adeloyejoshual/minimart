import express from "express";
import MarketplaceProduct from "../models/MarketplaceProduct.js";
import { verifyPaystackPayment } from "../utils/paystackHelper.js";

const router = express.Router();

/**
 * GET all products (with filtering + pagination)
 */
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      state,
      city,
      minPrice,
      maxPrice,
      search,
    } = req.query;

    const query = {};

    if (category) query.category = category;
    if (state) query.state = state;
    if (city) query.city = city;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const products = await MarketplaceProduct.find(query)
      .sort({ promoted: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await MarketplaceProduct.countDocuments(query);

    res.json({
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      products,
    });
  } catch (err) {
    console.error("GET marketplace error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/**
 * GET single product
 */
router.get("/:id", async (req, res) => {
  try {
    const product = await MarketplaceProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/**
 * POST new product
 */
router.post("/", async (req, res) => {
  try {
    const data = req.body;

    if (!data.title?.trim() || !data.price) {
      return res.status(400).json({ message: "Title and price are required" });
    }

    // Verify Paystack if promoted
    if (data.promoted && data.promo_plan) {
      if (!data.payment_reference) {
        return res.status(400).json({
          message: "Payment reference required for promotion",
        });
      }

      const verification = await verifyPaystackPayment(
        data.payment_reference
      );

      if (!verification.success) {
        return res.status(400).json({
          message: "Promotion payment not verified",
        });
      }
    }

    const product = await MarketplaceProduct.create({
      ...data,
      title: data.title.trim(),
      description: data.description?.trim() || "",
      price: parseFloat(data.price),
      mileage: data.mileage ? parseFloat(data.mileage) : null,
      year: data.year ? parseInt(data.year) : null,
      bedrooms: data.bedrooms ? parseInt(data.bedrooms) : null,
      bathrooms: data.bathrooms ? parseInt(data.bathrooms) : null,
      country: data.country || "Nigeria",
    });

    res.status(201).json({
      message: "Product added successfully",
      product,
    });
  } catch (err) {
    console.error("POST marketplace error:", err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

/**
 * UPDATE product
 */
router.put("/:id", async (req, res) => {
  try {
    const updated = await MarketplaceProduct.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Product not found" });

    res.json({
      message: "Product updated successfully",
      product: updated,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to update product" });
  }
});

/**
 * DELETE product
 */
router.delete("/:id", async (req, res) => {
  try {
    const product = await MarketplaceProduct.findByIdAndDelete(
      req.params.id
    );

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete product" });
  }
});

export default router;