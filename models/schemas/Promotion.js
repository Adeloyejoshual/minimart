// src/models/schemas/Promotion.js
import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema({
  label: { type: String, required: true },
  price: { type: Number, required: true },
  days: { type: Number, required: true },
  type: { type: String, enum: ["free", "paid"], default: "free" },
});

export default mongoose.model("Promotion", promotionSchema);