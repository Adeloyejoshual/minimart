const mongoose = require('mongoose');

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
  ram: String,
  storage: String,
  color: String,
  engine: String,
  fuelType: String,
  year: String,
  transmission: String,
  simSupport: [String],
  features: [String],
  
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0 },
  description: String,
  videoUrl: String,
  
  state: { type: String, required: true },
  city: { type: String, required: true },
  
  phonePrimary: { type: String, required: true },
  phoneSecondary: String,
  posterName: { type: String, required: true },
  
  deliveryRegions: [deliveryRegionSchema],
  
  isNegotiable: { type: Boolean, default: false },
  isExchange: { type: Boolean, default: false },
  isFlashSale: { type: Boolean, default: false },
  socialLink: String,
  
  // Promotion
  isPromoted: { type: Boolean, default: false },
  promotionPlan: {
    id: String,
    name: String,
    duration: String,
    price: Number
  },
  
  // Media
  images: [{ type: String, required: true }], // Cloudinary URLs
  
  // Auth0 User
  ownerId: { type: String, required: true, index: true }, // Auth0 sub
  ownerEmail: { type: String, required: true },
  ownerName: String,
  
  // Stats
  views: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive', 'sold'], default: 'active' },
  
  // Indexes for performance
}, { timestamps: true });

productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ state: 1, city: 1 });
productSchema.index({ brand: 1, model: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ isPromoted: 1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);