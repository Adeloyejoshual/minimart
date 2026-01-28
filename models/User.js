import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: String,
  fullName: String,
  role: { type: String, default: "User" }, // e.g., "SuperAdmin", "Moderator"
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);