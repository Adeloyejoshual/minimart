const express = require("express");
const router = express.Router();
const Listing = require("../models/Listing"); // your Mongo model

// GET all marketplace listings
router.get("/listings", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 }).limit(20);
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;