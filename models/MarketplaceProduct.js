import mongoose from "mongoose";

const marketplaceProductSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    price: {
      type: Number,
      required: true,
    },
    image: String,
  },
  { timestamps: true }
);

const MarketplaceProduct = mongoose.model(
  "MarketplaceProduct",
  marketplaceProductSchema
);

export default MarketplaceProduct;