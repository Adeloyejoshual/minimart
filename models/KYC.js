// models/KYC.js
import mongoose from "mongoose";

const kycSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },

  fullName: String,
  idNumber: String,
  idType: String,
  documentUrl: String,

  status: {
    type: String,
    enum: ["not_submitted", "pending", "approved", "rejected"],
    default: "not_submitted",
  },

  locked: { type: Boolean, default: false }, // prevents user editing after approval

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

kycSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("KYC", kycSchema);