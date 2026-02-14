import mongoose from "mongoose";

const { Schema } = mongoose;

const PromotionSchema = new Schema({
  id: { type: Number, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ["free", "paid"], required: true },
  price: { type: Number, default: 0 },
  days: { type: Number, default: 7 },
  startAt: { type: Date },
  endAt: { type: Date },
});

export default PromotionSchema;