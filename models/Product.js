const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 100 },
  description: { type: String, required: true, maxlength: 1000 },
  category: { type: String, required: true },
  brand: String,
  model: String,
  condition: String,
  ram: String,
  storage: String,
  color: String,
  sim: [String],
  features: [String],
  engine: String,
  mileage: String,
  year: String,
  fuel_type: String,
  transmission: String,
  price: { type: Number, required: true },
  discount_price: { type: Number, default: 0 },
  phone_number: { type: String, required: true },
  state: String,
  city: String,
  promoted: { type: Boolean, default: false },
  promo_plan: String,
  flash_sale: Boolean,
  negotiable: { type: Boolean, default: false },
  images: [String],
  sellerId: { type: String, required: true }, // Auth0 user.sub
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);