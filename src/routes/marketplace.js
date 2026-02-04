// src/routes/marketplace.js
import express from "express";
import { Listing } from "../models/Listing.js";

const router = express.Router();

// GET all listings
router.get("/listings", async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 }).limit(20);
    res.json(listings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch listings" });
  }
});

// POST new listing
router.post("/listings", async (req, res) => {
  try {
    const newListing = new Listing(req.body);
    await newListing.save();
    res.status(201).json(newListing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add listing" });
  }
});

export default router;