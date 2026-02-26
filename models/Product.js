// models/Product.js - ENTERPRISE SCHEMA ✅
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Title required'] },
  description: { type: String, required: [true, 'Description required'] },
  price: { type: Number, required: [true, 'Price required'], min: 0 },
  discount_price: { type: Number, min: 0 },
  category: { type: String, required: [true, 'Category required'] },
  subcategory: String,
  brand: String,
  model: String,
  condition: String,
  used_detail: String,
  
  // Electronics
  ram: String,
  storage: String,
  color: String,
  sim: [String],
  
  // Vehicles
  engine: String,
  mileage: String,
  year: String,
  fuel_type: String,
  transmission: String,
  
  // Contact
  phone_number: { type: String, required: [true, 'Phone number required'] },
  additional_phone: String,
  poster_name: { type: String, required: [true, 'Poster name required'] },
  
  // Location
  state: { type: String, required: [true, 'State required'] },
  city: String,
  
  // Media
  images: [String],
  video_link: String,
  
  // Features
  features: [String],
  
  // Promotions
  promoted: { type: Boolean, default: false },
  promo_plan: String,
  flash_sale: { type: Boolean, default: false },
  exchange_possible: { type: Boolean, default: false },
  negotiable: { type: Boolean, default: false },
  
  // Delivery
  deliveryRegions: [String],
  social_link: String,
  
  // Stats
  views: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive', 'sold'], default: 'active' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
productSchema.index({ category: 1, state: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ promoted: -1, createdAt: -1 });
productSchema.index({ price: 1 });

export default mongoose.models.Product || mongoose.model('Product', productSchema);