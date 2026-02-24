// models/Product.js
import mongoose from "mongoose";

const deliveryRegionSchema = new mongoose.Schema({
  regionName: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  freeShipping: { type: Boolean, default: false }
}, { _id: false });

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  category: { type: String, required: true },
  subcategory: { type: String, required: true },
  brand: String,
  model: String,
  condition: { type: String, enum: ['New', 'Used', 'Refurbished'] },
  usedDetail: String,
  ram: String, storage: String, color: String,
  engine: String, fuelType: String, year: String, transmission: String,
  simSupport: [String], features: [String],
  
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0 },
  description: String,
  videoUrl: String,
  
  state: { type: String, required: true },
  city: { type: String, required: true },
  
  phonePrimary: { type: String, required: true },
  phoneSecondary: String,
  
  deliveryRegions: [deliveryRegionSchema],
  
  isNegotiable: { type: Boolean, default: false },
  isExchange: { type: Boolean, default: false },
  isFlashSale: { type: Boolean, default: false },
  socialLink: String,
  
  isPromoted: { type: Boolean, default: false },
  promotionPlan: { id: String, name: String, duration: String, price: Number },
  
  images: [{ type: String, required: true }],
  
  ownerId: { type: String, required: true, index: true },
  ownerEmail: { type: String, required: true },
  ownerName: String,
  
  views: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive', 'sold'], default: 'active' }
}, { timestamps: true });

// Indexes
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ state: 1, city: 1 });
productSchema.index({ isPromoted: 1, createdAt: -1 });

export default mongoose.model("Product", productSchema);