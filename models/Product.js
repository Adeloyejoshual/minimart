import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  sellerId: { type: String, required: true, trim: true, description: "Firebase UID of the seller" },
  sellerName: { type: String, trim: true, default: "Unknown Seller" },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: "" },
  images: { type: [String], default: [] },
  category: { type: String, trim: true, default: "Uncategorized" },
  price: { type: Number, required: true, min: 0, default: 0 },
  status: { type: String, enum: ["Pending", "Approved", "Rejected", "Flagged"], default: "Pending" },
  moderatorNotes: { type: String, trim: true, default: "" },
}, { timestamps: true });

// Optional indexes for faster queries
productSchema.index({ sellerId: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });

export default mongoose.model("Product", productSchema);