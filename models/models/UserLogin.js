import mongoose from "mongoose";

const userLoginSchema = new mongoose.Schema({
  userId: String,
  email: String,
  ip: String,
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("UserLogin", userLoginSchema);