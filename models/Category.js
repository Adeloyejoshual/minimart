// models/Category.js
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  subCategories: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Category", categorySchema);