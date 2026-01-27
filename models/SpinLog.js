import mongoose from "mongoose";

const userCouponSchema = new mongoose.Schema({
  userId: String,
  couponId: Number,
  label: String,
  type: String,
  value: Number,
  status: String,
  createdAt: Date,
  expiry: Date,
});

export default mongoose.model("UserCoupon", userCouponSchema);

const spinLogSchema = new mongoose.Schema({
  userId: String,
  result: String,
  couponId: Number,
  value: Number,
  createdAt: Date,
});

export default mongoose.model("SpinLog", spinLogSchema);