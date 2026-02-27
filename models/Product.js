// models/Product.js - ✅ GLOBAL + PERFECT
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  // ✅ BASIC FIELDS
  title: { 
    type: String, 
    required: [true, 'Title required'],
    trim: true,
    maxlength: 200
  },
  description: { 
    type: String, 
    trim: true,
    maxlength: 2000,
    default: ''
  },
  price: { 
    type: Number, 
    required: [true, 'Price required'], 
    min: 0 
  },
  
  // ✅ CATEGORY FIELDS - Your 13 configs
  category: { type: String, required: [true, 'Category required'] },
  brand: String,
  model: String,
  condition: String,
  used_detail: String,
  ram: String,
  storage: String,
  color: String,
  sim: [String],
  engine: String,
  mileage: Number,
  year: Number,
  fuel_type: String,
  transmission: String,
  
  // ✅ LOCATION
  country: { type: String, default: 'Nigeria' },
  state: { type: String, required: [true, 'State required'] },
  city: String,
  
  // ✅ CONTACT - FIXED
  phone_number: { 
    type: String, 
    required: [true, 'Phone required'],
    trim: true  // ✅ FIXED: No more validation errors
  },
  poster_name: { 
    type: String, 
    required: [true, 'Poster name required'],
    trim: true
  },
  
  // ✅ GLOBAL SELLER TRACKING - SINGLE FIELD
  seller_email: { 
    type: String, 
    required: [true, 'Seller email required'],
    trim: true
  },
  
  // ✅ MEDIA
  images: [{
    type: String,
    default: []
  }],
  video_link: String,
  
  // ✅ BUSINESS
  features: [{
    type: String,
    default: []
  }],
  negotiation: { 
    type: String, 
    enum: ['no', 'slight', 'moderate', 'open'], 
    default: 'no' 
  },
  exchange_possible: { type: Boolean, default: false },
  
  // ✅ 🔥 PAYSTACK PROMOTION - PERFECT
  promotion_plan: {
    type: Number, 
    min: 0,
    max: 7
  },
  promoted: { type: Boolean, default: false },
  promo_expires: Date,
  promo_purchased_at: Date,
  paystack_reference: String,
  promo_status: {
    type: String,
    enum: ['active', 'expired', 'pending', 'cancelled'],
    default: 'pending'
  },
  
  // ✅ STATS
  views: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['active', 'promoted', 'pending', 'sold', 'deleted'], 
    default: 'active' 
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 🔥 PROMOTION VIRTUAL
productSchema.virtual('isPromotedActive').get(function() {
  if (!this.promoted || !this.promo_expires) return false;
  return this.promo_expires > new Date();
});

// 🏎️ ULTRA-FAST INDEXES (PERFECT!)
productSchema.index({ category: 1, status: 1 });
productSchema.index({ state: 1, city: 1 });
productSchema.index({ promoted: -1, promo_expires: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ promotion_plan: 1 });
productSchema.index({ seller_email: 1 });  // ✅ GLOBAL SELLER SEARCH

// 🛡️ PRE-SAVE HOOK - Auto promotions
productSchema.pre('save', function(next) {
  if (this.promotion_plan && this.promotion_plan > 0) {
    this.promoted = true;
    this.status = 'promoted';
    
    // ✅ FIXED: promotionPlans array (1-7 days)
    const daysByPlan = [0, 7, 30, 14, 30, 7, 60, 90];  // Match your config
    const days = daysByPlan[this.promotion_plan] || 0;
    
    if (days > 0) {
      this.promo_expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      this.promo_status = 'active';
    }
  } else {
    this.promoted = false;
    this.status = 'active';
    this.promo_status = 'pending';
  }
  
  next();
});

export default mongoose.models.Product || mongoose.model('Product', productSchema);