const express = require("express");
const router = express.Router();
const MartProduct = require("../models/MartProduct");

// CREATE product
router.post("/", async (req, res) => {
  try {
    const { name, price } = req.body;

    const newProduct = new MartProduct({
      name,
      price,
      createdAt: new Date(),
    });

    await newProduct.save();
    res.status(201).json({ message: "Product saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;