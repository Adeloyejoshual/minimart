// models/MarketplaceProduct.js
import mongoose from "mongoose";

const MarketplaceProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    image: { type: String },
    country: { type: String, default: "Nigeria" },
    state: { type: String },
    city: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("MarketplaceProduct", MarketplaceProductSchema);