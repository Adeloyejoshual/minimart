// models/Product.js - ✅ PAYSTACK + PROMOTION PLANS + MULTER READY
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
    default: ''
  },
  price: { 
    type: Number, 
    required: [true, 'Price required'], 
    min: 0 
  },
  
  // ✅ CATEGORY FIELDS
  category: { 
    type: String, 
    required: [true, 'Category required']
  },
  brand: String,
  model: String,
  condition: String,
  used_detail: String,
  
  // ✅ SPECS - All your 13 configs
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
  state: { 
    type: String, 
    required: [true, 'State required']
  },
  city: String,
  location: String,
  
  // ✅ CONTACT - FIXED VALIDATION
  phone_number: { 
    type: String, 
    required: [true, 'Phone required']
    // ✅ REMOVED STRICT REGEX - Global support
  },
  poster_name: { 
    type: String, 
    required: [true, 'Poster name required'],
    default: 'Anonymous Seller'
  },
  
  // ✅ MEDIA - Cloudinary URLs
  images: [{
    type: String,
    default: []
  }],
  video_link: String,
  
  // ✅ BUSINESS FIELDS
  features: [{
    type: String,
    default: []
  }],
  negotiation: { 
    type: String, 
    enum: ['no', 'slight', 'moderate', 'open'], 
    default: 'no' 
  },
  exchange_possible: { 
    type: Boolean, 
    default: false 
  },
  
  // ✅ 🔥 PAYSTACK PROMOTION SYSTEM
  promotion_plan: {
    type: Number,  // 1-7 from promotionPlans
    min: 0,
    max: 7
  },
  promoted: { 
    type: Boolean, 
    default: false 
  },
  promo_expires: Date,
  promo_purchased_at: Date,
  paystack_reference: String,  // Payment proof
  promo_status: {
    type: String,
    enum: ['active', 'expired', 'pending', 'cancelled'],
    default: 'pending'
  },
  
  // ✅ STATS & STATUS
  views: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['active', 'promoted', 'pending', 'sold', 'deleted'], 
    default: 'active' 
  },
  
  // ✅ SELLER TRACKING - No Auth0 dependency
  seller_id: String,
  seller_name: String,
  seller_email: String,
  seller_phone: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 🔥 PROMOTION VIRTUALS
productSchema.virtual('isPromotedActive').get(function() {
  if (!this.promoted || !this.promo_expires) return false;
  return this.promo_expires > new Date();
});

// 🏎️ ULTRA PERFORMANCE INDEXES
productSchema.index({ category: 1, status: 1 });
productSchema.index({ state: 1, city: 1 });
productSchema.index({ promoted: -1, promo_expires: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ promotion_plan: 1 });
productSchema.index({ seller_email: 1 });

// 🛡️ PRE-SAVE HOOK - Auto manage promotions
productSchema.pre('save', function(next) {
  // Auto-set promoted status
  if (this.promotion_plan && this.promotion_plan > 0) {
    this.promoted = true;
    this.status = 'promoted';
    
    // Set expiry based on plan (from promotionPlans config)
    const days = [0, 7, 30, 14, 30, 7, 60, 90][this.promotion_plan] || 0;
    if (days > 0) {
      this.promo_expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
  } else {
    this.promoted = false;
    this.status = 'active';
  }
  
  next();
});

export default mongoose.models.Product || mongoose.model('Product', productSchema);