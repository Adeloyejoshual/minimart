import mongoose from "mongoose";

const performanceSchema = new mongoose.Schema({
  adminEmail: String,
  count: { type: Number, default: 0 }, // disputes resolved
});

export default mongoose.model("AdminPerformance", performanceSchema);