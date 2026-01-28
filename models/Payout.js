// backend/models/Payout.js
import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema({
  sellerId: { type: String, required: true },
  amount: { type: Number, required: true },
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  approvedAt: Date,
});

export default mongoose.model("Payout", payoutSchema);