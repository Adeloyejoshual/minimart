import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  sellerId: { type: String, required: true }, // Firebase UID of seller
  sellerName: String,
  title: { type: String, required: true },
  description: String,
  images: [String],
  category: String,
  price: Number,
  status: { type: String, enum: ["Pending", "Approved", "Rejected", "Flagged"], default: "Pending" },
  moderatorNotes: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Product", productSchema);