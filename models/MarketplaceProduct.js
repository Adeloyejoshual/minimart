// models/MarketplaceProduct.js
import mongoose from "mongoose";

const marketplaceProductSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: { type: String, required: true },
  subCategory: { type: String },
  price: { type: Number, required: true },
  images: [{ type: String }], // URLs of uploaded images
  country: { type: String, default: "Nigeria" },
  state: { type: String },
  city: { type: String },
  negotiable: { type: Boolean, default: false },
  flashSale: { type: Boolean, default: false },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isPromoted: { type: Boolean, default: false },
  promotion: {
    plan: { type: String },
    price: { type: Number },
    startAt: { type: Date },
    endAt: { type: Date },
  },
});

export default mongoose.model("MarketplaceProduct", marketplaceProductSchema);