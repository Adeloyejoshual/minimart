import mongoose from "mongoose";

const { Schema, model } = mongoose;

// Image sub-schema
const ImageSchema = new Schema({
  url: { type: String, required: true },
  alt: { type: String, default: "" },
});

// Specification sub-schema
const SpecificationSchema = new Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
});

// Promotion sub-schema
const PromotionSchema = new Schema({
  label: { type: String, default: "None" },
  price: { type: Number, default: 0 },
  days: { type: Number, default: 0 },
  startAt: { type: Date },
  endAt: { type: Date },
});

const ProductSchema = new Schema({
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  subcategory: { type: String },
  brand: { type: String },
  model: { type: String },
  condition: { type: String, enum: ["New", "Used", "Refurbished"], default: "New" },
  usedDetail: { type: String },
  price: { type: Number, required: true },
  discountPrice: { type: Number },
  negotiable: { type: Boolean, default: false },
  description: { type: String, required: true },
  specifications: { type: [SpecificationSchema], default: [] },
  country: { type: String, required: true },
  state: { type: String },
  city: { type: String },
  images: { type: [ImageSchema], required: true },
  promotionPlan: { type: PromotionSchema, default: {} },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

export default model("MarketplaceProduct", ProductSchema);