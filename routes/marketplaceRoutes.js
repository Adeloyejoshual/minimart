// backend/routes/marketplaceRoutes.js
const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const { auth } = require("express-oauth2-jwt-bearer");

// Auth0 middleware
const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
});

// GET /api/marketplace/listings
router.get("/listings", checkJwt, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    res.json(products);
  } catch (err) {
    console.error("Error fetching marketplace listings:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;