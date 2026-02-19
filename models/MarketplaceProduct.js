// models/MarketplaceProduct.js
const mongoose = require('mongoose');

const deliveryRegionSchema = new mongoose.Schema({
  state: { type: String, required: true },
  city: { type: String, required: true },
  method: { type: String, default: 'Courier' },
  from: { type: String, required: true }, // delivery days
  to: { type: String, required: true }, // delivery days
  chargeFee: { type: Boolean, default: true },
  fee: { type: String }, // price as string to match form
  expressAvailable: { type: Boolean, default: false },
  warehouseAddress: { type: String },
  isFreeDelivery: { type: Boolean, default: false }
}, { _id: false });

const marketplaceProductSchema = new mongoose.Schema({
  // Core product info
  title: { type: String, required: [true, 'Title is required'], minlength: 30 },
  description: { type: String, required: [true, 'Description is required'], minlength: 50 },
  price: { type: String, required: [true, 'Price is required'] }, // String to match form format
  discount_price: { type: String },
  
  // Categorization
  category: { type: String, required: true },
  subcategory: { type: String },
  brand: { type: String },
  model: { type: String },
  
  // Condition & specs
  condition: { type: String },
  used_detail: { type: String },
  ram: { type: String },
  storage: { type: String },
  color: { type: String },
  sim: [{ type: String }],
  features: [{ type: String }],
  
  // Vehicle specific
  engine: { type: String },
  mileage: { type: String },
  year: { type: String },
  fuel_type: { type: String },
  transmission: { type: String },
  
  // Media
  images: [{ type: String, required: [true, 'At least one image is required'] }], // Cloudinary URLs
  video_link: { type: String },
  
  // Seller info
  quantity: { type: String },
  phone_number: { 
    type: String, 
    required: true,
    match: [/^(0|\+234)[0-9]{10}$/, 'Valid Nigerian phone number required']
  },
  additional_phone: { type: String },
  poster_name: { type: String, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  location: { type: String },
  social_link: { type: String },
  
  // Business options
  promoted: { type: Boolean, default: false },
  promo_plan: { type: String },
  promo_status: { type: String, enum: ['free', 'paid', 'pending'] },
  payment_reference: { type: String }, // Paystack reference
  flash_sale: { type: Boolean, default: false },
  exchange_possible: { type: Boolean, default: false },
  negotiable: { type: Boolean, default: false },
  
  // Delivery
  deliveryRegions: [deliveryRegionSchema],
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for better search performance
marketplaceProductSchema.index({ category: 1, brand: 1, state: 1 });
marketplaceProductSchema.index({ title: 'text', description: 'text', brand: 'text' });
marketplaceProductSchema.index({ promoted: 1, createdAt: -1 });
marketplaceProductSchema.index({ state: 1, city: 1 });

module.exports = mongoose.model('MarketplaceProduct', marketplaceProductSchema);
