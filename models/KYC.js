import mongoose from "mongoose";

const kycSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  fullName: String,
  idNumber: String,
  idType: String, // National ID, Passport, Driver's License
  documentUrl: String,
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("KYC", kycSchema);