import mongoose from "mongoose";

const marketplaceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.model(
  "MarketplaceProduct",
  marketplaceSchema
);