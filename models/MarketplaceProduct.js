// models/MarketplaceProduct.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const deliveryRegionSchema = new Schema({
  state: { type: String, required: [true, 'State required'], trim: true, lowercase: true },
  city: { type: String, required: [true, 'City required'], trim: true, lowercase: true },
  method: { type: String, enum: ['Courier', 'Pickup', 'Express'], default: 'Courier' },
  from: { type: Number, required: [true, '"From" days required'], min: 0 },
  to: { 
    type: Number, 
    required: [true, '"To" days required'], 
    min: 0,
    validate: {
      validator: function(v) { return v >= this.from; },
      message: '"To" days must be ≥ "From" days'
    }
  },
  chargeFee: { type: Boolean, default: false },
  fee: { 
    type: Number, 
    default: 0, 
    min: 0,
    validate: {
      validator: function(v) { return !this.chargeFee || v > 0; },
      message: 'Fee must be > 0 when charging'
    }
  },
  expressAvailable: { type: Boolean, default: false },
  warehouseAddress: { type: String, default: '', trim: true },
  isFreeDelivery: { type: Boolean, default: false }
}, { _id: false });

const MarketplaceProductSchema = new Schema({
  title: { type: String, required: [true, 'Title required (15-150 chars)'], trim: true, minlength: 15, maxlength: 150 },
  description: { type: String, required: [true, 'Description required (50+ chars)'], trim: true, minlength: 50, maxlength: 5000 },
  category: { type: String, required: [true, 'Category required'], index: true },
  price: { type: Number, required: [true, 'Price required'], min: 0 },
  phone_number: { 
    type: String, 
    required: [true, 'Phone number required'],
    validate: {
      validator: function(v) { return /^(\+234|0)?[789]\d{9}$/.test(v.replace(/\s/g, '')); },
      message: 'Valid Nigerian number (080/070/090/+234) required'
    }
  },
  poster_name: { type: String, required: [true, 'Seller name required'], trim: true, minlength: 2 },
  state: { type: String, required: [true, 'State required'], lowercase: true, trim: true },
  city: { type: String, required: [true, 'City required'], lowercase: true, trim: true },
  images: { 
    type: [String], 
    required: [true, 'At least 1 image required'],
    validate: {
      validator: function(v) { return Array.isArray(v) && v.length > 0; },
      message: 'At least 1 image URL required'
    }
  },
  subcategory: { type: String, default: '', trim: true },
  brand: { type: String, default: '', trim: true },
  model: { type: String, default: '', trim: true },
  discount_price: { type: Number, default: 0, min: 0 },
  quantity: { type: Number, default: 1, min: 1 },
  condition: { type: String, enum: ['Brand New', 'Used', 'Refurbished'], default: 'Brand New' },
  used_detail: { type: String, enum: ['Like New', 'Good', 'Fair', 'For Parts'], default: '' },
  ram: { type: String, default: '', trim: true },
  storage: { type: String, default: '', trim: true },
  color: { type: String, default: '', trim: true },
  sim: { type: [String], default: [] },
  features: { type: [String], default: [] },
  engine: { type: String, default: '', trim: true },
  mileage: { type: String, default: '', trim: true },
  year: { type: String, default: '' },
  fuel_type: { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'], default: '' },
  transmission: { type: String, enum: ['Manual', 'Automatic', 'CVT'], default: '' },
  video_link: { type: String, default: '', trim: true },
  deliveryRegions: { type: [deliveryRegionSchema], default: [] },
  location: { type: String, default: '', trim: true },
  promoted: { type: Boolean, default: false },
  promo_plan: { type: String, enum: ['basic', 'standard', 'premium', 'flash', 'gift', ''], default: '' },
  promo_status: { type: String, enum: ['normal', 'free', 'paid'], default: 'normal' },
  payment_reference: { type: String, default: '' },
  flash_sale: { type: Boolean, default: false },
  exchange_possible: { type: Boolean, default: false },
  negotiable: { type: Boolean, default: false },
  additional_phone: { 
    type: String, 
    default: '',
    validate: {
      validator: function(v) { return !v || /^(\+234|0)?[789]\d{9}$/.test(v.replace(/\s/g, '')); },
      message: 'Valid Nigerian number required'
    }
  },
  social_link: { type: String, default: '', trim: true },
  status: { type: String, enum: ['active', 'inactive', 'sold', 'archived'], default: 'active', index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

MarketplaceProductSchema.virtual('formattedPrice').get(function() {
  return this.price ? this.price.toLocaleString() : '0';
});
MarketplaceProductSchema.virtual('formattedDiscountPrice').get(function() {
  return this.discount_price > 0 ? this.discount_price.toLocaleString() : null;
});
MarketplaceProductSchema.virtual('hasDiscount').get(function() {
  return this.discount_price > 0 && this.discount_price < this.price;
});
MarketplaceProductSchema.virtual('discountPercentage').get(function() {
  if (!this.hasDiscount) return 0;
  return Math.round((this.price - this.discount_price) / this.price * 100);
});

MarketplaceProductSchema.methods.softDelete = async function() {
  this.deleted = true;
  this.deletedAt = new Date();
  await this.save();
  return this;
};

MarketplaceProductSchema.query.active = function() {
  return this.where({ status: 'active', deleted: false });
};
MarketplaceProductSchema.query.promoted = function() {
  return this.where({ promoted: true }).active();
};
MarketplaceProductSchema.query.notDeleted = function() {
  return this.where({ deleted: false });
};
MarketplaceProductSchema.query.inStock = function() {
  return this.where({ quantity: { $gt: 0 } });
};

MarketplaceProductSchema.pre('save', function(next) {
  if (typeof this.price === 'string') {
    this.price = Number(this.price.replace(/,/g, ''));
  }
  if (typeof this.discount_price === 'string') {
    this.discount_price = Number(this.discount_price.replace(/,/g, ''));
  }
  if (this.discount_price >= this.price || this.discount_price <= 0) {
    this.discount_price = 0;
  }
  if (this.promoted) {
    if (this.payment_reference) {
      this.promo_status = 'paid';
    } else if (this.promo_plan === 'gift') {
      this.promo_status = 'free';
    } else {
      this.promo_status = 'normal';
    }
  } else {
    this.promo_status = 'normal';
  }
  if (this.phone_number) {
    this.phone_number = this.phone_number.replace(/\s/g, '');
  }
  if (this.additional_phone) {
    this.additional_phone = this.additional_phone.replace(/\s/g, '');
  }
  next();
});

MarketplaceProductSchema.index({ category: 1, brand: 1 });
MarketplaceProductSchema.index({ price: -1 });
MarketplaceProductSchema.index({ promoted: 1, createdAt: -1 });
MarketplaceProductSchema.index({ state: 1, city: 1 });
MarketplaceProductSchema.index({ status: 1, deleted: 1 });
MarketplaceProductSchema.index({ 
  title: 'text', 
  description: 'text', 
  brand: 'text', 
  model: 'text', 
  category: 'text' 
}, { name: 'full_text_search' });

export default mongoose.model('MarketplaceProduct', MarketplaceProductSchema);
