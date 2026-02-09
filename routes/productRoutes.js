import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

// Get all products
router.get("/", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// Add new product
router.post("/", async (req, res) => {
  const { name, description, price, images } = req.body;
  const product = new Product({ name, description, price, images });
  await product.save();
  res.status(201).json(product);
});

export default router;