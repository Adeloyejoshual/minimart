const express = require("express");
const router = express.Router();
const MartProduct = require("../models/MartProduct");

// CREATE product
router.post("/", async (req, res) => {
  try {
    const { name, price, description, userId, userEmail } = req.body;

    if (!name || !price || !userId) {
      return res.status(400).json({ error: "Name, price, and userId are required" });
    }

    const newProduct = new MartProduct({
      name,
      price,
      description: description || "",
      userId,      // Firebase UID of the seller
      userEmail,   // Optional for displaying seller email
      createdAt: new Date(),
    });

    await newProduct.save();
    res.status(201).json({ message: "Product saved", product: newProduct });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;