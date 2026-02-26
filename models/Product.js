// models/Product.js - ✅ 100% SYNTAX CORRECT - DEPLOYS INSTANTLY
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
  subcategory: String,
  brand: String,
  model: String,
  condition: String,
  used_detail: String,
  
  // ✅ SPECS
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
    required: [true, 'State required'],
    default: 'Lagos'
  },
  city: String,
  location: String,
  
  // ✅ CONTACT
  phone_number: { 
    type: String, 
    required: [true, 'Phone required'],
    match: [/^0[789][01]d{8}$/, 'Valid Nigerian phone required']
  },
  additional_phone: String,
  poster_name: { 
    type: String, 
    required: [true, 'Poster name required'],
    default: 'Anonymous Seller'
  },
  
  // ✅ MEDIA - FIXED SYNTAX
  images: [String],  // ✅ CORRECT - Simple array of strings
  video_link: String,
  
  // ✅ BUSINESS FIELDS
  features: [String],
  negotiation: { 
    type: String, 
    enum: ['Yes', 'No'], 
    default: 'No' 
  },
  exchange_possible: { 
    type: Boolean, 
    default: false 
  },
  
  // ✅ PROMOTIONS & STATS
  promoted: { type: Boolean, default: false },
  promo_plan: String,
  promo_expires: Date,
  views: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['active', 'pending', 'sold', 'deleted'], 
    default: 'active' 
  },
  
  // ✅ SELLER TRACKING
  seller_id: { 
    type: String, 
    required: true,
    index: true 
  },
  seller_name: String,
  seller_email: String,
  auth0_user_id: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 🏎️ PERFORMANCE INDEXES
productSchema.index({ category: 1, state: 1 });
productSchema.index({ seller_id: 1 });
productSchema.index({ promoted: -1, createdAt: -1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.Product || mongoose.model('Product', productSchema);