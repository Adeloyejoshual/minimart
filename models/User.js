import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    auth0Id: { type: String, required: true, unique: true },
    name: String,
    email: String,
    picture: String,
    role: { type: String, enum: ["buyer","seller","admin"], default: "buyer" },
    wallet: { type: Number, default: 0 },
    kycStatus: { type: String, default: "pending" },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);