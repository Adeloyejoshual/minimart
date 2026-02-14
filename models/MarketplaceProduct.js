import mongoose from "mongoose";

const marketplaceProductSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    image: {
      type: String, // Cloudinary URL
    },
  },
  { timestamps: true }
);

export default mongoose.model("MarketplaceProduct", marketplaceProductSchema);