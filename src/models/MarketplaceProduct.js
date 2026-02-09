// src/models/MarketplaceProduct.js
import mongoose from "mongoose";

const MarketplaceProductSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  images: [{ type: String }], // URLs after upload
  userEmail: { type: String, required: true }, // store who added the product
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("MarketplaceProduct", MarketplaceProductSchema);