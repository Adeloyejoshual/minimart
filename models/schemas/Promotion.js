// models/schemas/Promotion.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const PromotionSchema = new Schema({
  label: { type: String, required: true },
  price: { type: Number, default: 0 },
  days: { type: Number, default: 0 },
  startAt: { type: Date },
  endAt: { type: Date },
});

export default PromotionSchema;