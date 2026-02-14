// routes/marketplace.js
import express from "express";
import multer from "multer";
import { MarketplaceProduct } from "../models/MarketplaceProduct.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // temp storage

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { title, description, price, category, state, city } = req.body;
    const image = req.file ? req.file.path : null;

    if (!title || !price || !category || !state || !city) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const product = await MarketplaceProduct.create({
      title,
      description,
      price,
      category,
      state,
      city,
      images: image ? [image] : [],
    });

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;