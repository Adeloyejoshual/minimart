// routes/products.js

import express from "express";
import Product from "../models/Product.js";
import { checkJwt } from "../middleware/checkJwt.js";

const router = express.Router();

/* --------------------------------------------------
   CREATE PRODUCT
-------------------------------------------------- */
router.post("/", checkJwt, async (req, res) => {
  try {
    const product = new Product({
      ...req.body,
      user_id: req.auth.payload.sub,
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
});

/* --------------------------------------------------
   GET ALL PRODUCTS
-------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

/* --------------------------------------------------
   GET SINGLE PRODUCT
-------------------------------------------------- */
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

/* --------------------------------------------------
   DELETE PRODUCT (Owner Only)
-------------------------------------------------- */
router.delete("/:id", checkJwt, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    if (product.user_id !== req.auth.payload.sub) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await product.deleteOne();

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;