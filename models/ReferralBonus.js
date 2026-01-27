import mongoose from "mongoose";

const referralBonusSchema = new mongoose.Schema({
  userId: String,
  friendEmail: String,
  reward: Number,
  status: String, // pending or claimed
  createdAt: Date,
});

export default mongoose.model("ReferralBonus", referralBonusSchema);