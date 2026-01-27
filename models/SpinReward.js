// models/SpinReward.js
import mongoose from "mongoose";

const spinRewardSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Firebase UID
  rewardLabel: { type: String, required: true },
  rewardType: { type: String, required: true },
  rewardValue: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("SpinReward", spinRewardSchema);