import mongoose from "mongoose";
import PromotionSchema from "./schemas/Promotion.js";
import ImageSchema from "./schemas/Image.js";

const { Schema, model } = mongoose;

const ProductSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  discountPrice: { type: Number },
  negotiable: { type: Boolean, default: false },
  category: { type: String, required: true },
  subcategory: { type: String },
  brand: { type: String },
  model: { type: String },
  condition: { type: String, enum: ["New", "Used", "Refurbished"], default: "New" },
  usedDetail: { type: String },
  country: { type: String, required: true },
  state: { type: String },
  city: { type: String },
  images: [ImageSchema],
  promotionPlan: PromotionSchema,
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

export default model("MarketplaceProduct", ProductSchema);