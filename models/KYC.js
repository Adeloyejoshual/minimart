// models/KYC.js
import mongoose from "mongoose";

const kycSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },

    fullName: { type: String, required: true },
    idNumber: { type: String, required: true },
    idType: { type: String, required: true }, // e.g., "Passport", "Driver's License"
    documentUrl: { type: String, required: true },

    status: {
      type: String,
      enum: ["not_submitted", "pending", "approved", "rejected"],
      default: "not_submitted",
    },

    locked: { type: Boolean, default: false }, // prevents editing after approval
  },
  {
    timestamps: true, // automatically adds createdAt and updatedAt
  }
);

// Optional: middleware to prevent editing if locked
kycSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.locked === true) {
    return next(new Error("This KYC record is locked and cannot be updated"));
  }
  next();
});

export default mongoose.model("KYC", kycSchema);