import mongoose from "mongoose";

const marketplaceSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    price: Number,
    image: String,
    category: String,
    sellerId: String,
    isApproved: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model("MarketplaceProduct", marketplaceSchema);