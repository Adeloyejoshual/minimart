import mongoose from "mongoose";

const referralSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Firebase UID
  friendEmail: { type: String, required: true },
  reward: { type: Number, default: 500 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Referral", referralSchema);