// backend/models/Payout.js
import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema({
  sellerId: { type: String, required: true },
  amount: { type: Number, required: true },
  approved: { type: Boolean, default: false },
  approvedAt: Date,
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

// Pre-save hook: set approvedAt when approved
payoutSchema.pre('save', function(next) {
  if (this.isModified('approved') && this.approved && !this.approvedAt) {
    this.approvedAt = new Date();
  }
  next();
});

export default mongoose.model("Payout", payoutSchema);