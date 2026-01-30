// server/routes/products.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const Product = require("../models/Product");
const upload = multer({ dest: "uploads/" }); // simple temp storage

router.post("/", upload.array("images"), async (req, res) => {
  try {
    const data = req.body;
    const images = req.files.map(f => `/uploads/${f.filename}`); // for now store path, later S3/Cloudinary
    const product = new Product({
      ...data,
      images,
      createdAt: new Date(),
    });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;