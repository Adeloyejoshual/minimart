import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  reportedUserId: { type: String, required: true }, // Firebase UID
  reportedUserName: String,
  reason: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  status: { type: String, enum: ["Pending", "Resolved", "Escalated"], default: "Pending" },
  moderatorNotes: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Report", reportSchema);