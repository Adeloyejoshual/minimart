import mongoose from "mongoose";

const marketplaceProductSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    subcategory: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
    },

    country: {
      type: String,
      default: "Nigeria",
    },

    state: {
      type: String,
      required: true,
    },

    city: {
      type: String,
      required: true,
    },

    image: {
      type: String, // store image path or URL
      required: true,
    },
  },
  { timestamps: true }
);

const MarketplaceProduct = mongoose.model(
  "MarketplaceProduct",
  marketplaceProductSchema
);

export default MarketplaceProduct;