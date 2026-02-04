// src/models/Listing.js
import mongoose from "mongoose";

const listingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  location: String,
  images: [String],
  isPromoted: { type: Boolean, default: false },
  isProSeller: { type: Boolean, default: false },
  category: String,
  createdAt: { type: Date, default: Date.now },
});

export const Listing = mongoose.model("Listing", listingSchema);