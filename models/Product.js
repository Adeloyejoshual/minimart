// backend/models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: String,
  images: [String],
  imageUrl: String, // main image
  price: Number,
  promotionPlan: { type: String, default: "free" },
  views: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  searchHits: { type: Number, default: 0 },
  state: String,
  city: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Product", productSchema);