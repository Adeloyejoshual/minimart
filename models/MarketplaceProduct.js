// src/models/MarketplaceProduct.js
import mongoose from 'mongoose';

const deliveryRegionSchema = new mongoose.Schema({
  state: { type: String, required: true, lowercase: true, trim: true },
  city: { type: String, required: true, lowercase: true, trim: true },
  method: { type: String, default: 'Courier' },
  from: { type: String, required: true },
  to: { type: String, required: true },
  chargeFee: { type: Boolean, default: true },
  fee: { type: Number, default: 0, min: [0, 'Delivery fee cannot be negative'] },
  expressAvailable: { type: Boolean, default: false },
  warehouseAddress: { type: String },
  isFreeDelivery: { type: Boolean, default: false }
}, { _id: false });

const marketplaceProductSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Title required'], minlength: [30], maxlength: [200], trim: true },
  description: { type: String, required: [true, 'Description required'], minlength: [50], maxlength: [2000], trim: true },
  price: { type: String, required: [true, 'Price required'] },
  price_num: { type: Number, required: true, min: [0] },
  discount_price: { type: String },
  discount_num: { type: Number, min: [0] },

  category: { type: String, required: true },
  subcategory: { type: String },
  brand: { type: String, lowercase: true, trim: true },
  model: { type: String, lowercase: true, trim: true },
  condition: { type: String },
  used_detail: { type: String },
  ram: { type: String },
  storage: { type: String },
  color: { type: String },
  sim: [{ type: String }],
  features: [{ type: String }],
  engine: { type: String },
  mileage: { type: String },
  year: { type: String },
  fuel_type: { type: String },
  transmission: { type: String },

  images: [{ type: String, validate: { validator: v => v.length > 0 && v.length <= 10, message: '1-10 images' } }],
  video_link: { type: String },

  location: { type: { type: String, default: 'Point' }, coordinates: { type: [Number] } },
  state: { type: String, required: [true, 'State required'], lowercase: true, trim: true },
  city: { type: String, required: [true, 'City required'], lowercase: true, trim: true },

  quantity: { type: String },
  phone_number: { type: String, required: [true, 'Phone required'], match: [/^(0|\+234)[0-9]{10}$/] },
  additional_phone: { type: String },
  poster_name: { type: String, required: [true, 'Poster name required'] },
  social_link: { type: String },

  promoted: { type: Boolean, default: false },
  promo_plan: { type: String },
  promo_status: { type: String, enum: ['free', 'paid', 'pending'], default: function() { return this.promoted ? 'paid' : 'free'; } },
  payment_reference: { type: String },
  flash_sale: { type: Boolean, default: false },
  exchange_possible: { type: Boolean, default: false },
  negotiable: { type: Boolean, default: false },

  deliveryRegions: [deliveryRegionSchema],
  status: { type: String, enum: ['pending', 'active', 'expired'], default: 'pending' },
  active: { type: Boolean, default: true },
  views_total: { type: Number, default: 0 },
  views_today: { type: Number, default: 0 },
  live_viewers: { type: Number, default: 0 },
  trending_score: { type: Number, default: 0 },
  last_viewed: { type: Date },
  poster_id: { type: String, default: 'anonymous' },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  toJSON: { virtuals: true, transform: (doc, ret) => { delete ret.__v; delete ret.phone_number; } },
  toObject: { virtuals: true }
});

marketplaceProductSchema.index({ location: '2dsphere' });
marketplaceProductSchema.index({ category: 1, brand: 1, state: 1 });
marketplaceProductSchema.index({ state: 1, city: 1 });
marketplaceProductSchema.index({ price_num: 1 });
marketplaceProductSchema.index({ status: 1, active: 1, deletedAt: 1 });
marketplaceProductSchema.index({ poster_id: 1, createdAt: -1 });
marketplaceProductSchema.index({ trending_score: -1, createdAt: -1, status: 1, active: 1 });
marketplaceProductSchema.index({ category: 1, price_num: 1 });
marketplaceProductSchema.index({ promoted: 1, trending_score: -1 });
marketplaceProductSchema.index(
  { title: 'text', description: 'text', brand: 'text', model: 'text' },
  { weights: { title: 10, brand: 5, description: 1 } }
);
marketplaceProductSchema.index({ '$**': 'text' });

marketplaceProductSchema.virtual('discount_percent').get(function() {
  if (!this.discount_num || !this.price_num || this.price_num === 0) return 0;
  return Math.round(((this.price_num - this.discount_num) / this.price_num) * 100);
});

marketplaceProductSchema.query.active = function() {
  return this.where({ active: true, status: 'active', deletedAt: null });
};

marketplaceProductSchema.query.trending = function() {
  return this.sort({ trending_score: -1, createdAt: -1 });
};

marketplaceProductSchema.methods.updateTrendingScore = function() {
  const now = Date.now();
  const ageHours = (now - this.createdAt.getTime()) / 3600000;
  const baseScore = this.promoted ? 15000 : 2000;
  const viewScore = this.views_total * 3 + this.views_today * 15;
  const decay = Math.max(0.05, 1 - ageHours * 0.015);
  this.trending_score = Math.round((baseScore + viewScore) * decay);
  this.last_viewed = new Date(now);
  return this;
};

marketplaceProductSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.isModified('price') && this.price) this.price_num = parseFloat(this.price.replace(/,/g, ''));
  if (this.isModified('discount_price')) this.discount_num = this.discount_price ? parseFloat(this.discount_price.replace(/,/g, '')) : null;
  if (this.deliveryRegions) this.deliveryRegions.forEach(region => region.fee = Math.max(0, region.fee));
  next();
});

const MarketplaceProduct = mongoose.model('MarketplaceProduct', marketplaceProductSchema);

export default MarketplaceProduct;