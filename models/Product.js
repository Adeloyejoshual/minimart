// models/Product.js - ✅ PERFECT MATCH WITH ROUTES + ADDPRODUCT
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  // ✅ BASIC (All Optional in Form → Required in DB with defaults)
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
  
  // ✅ CATEGORY FIELDS (Dynamic from config)
  category: { 
    type: String, 
    required: [true, 'Category required'],
    enum: Object.keys(brands) // From your config
  },
  subcategory: String,
  brand: String,
  model: String,
  condition: String,
  used_detail: String,
  
  // ✅ SPECS (Electronics/Vehicles)
  ram: String,
  storage: String,
  color: String,
  sim: [String],
  engine: String,
  mileage: Number,
  year: Number,
  fuel_type: String,
  transmission: String,
  
  // ✅ LOCATION (Required but defaults from Nigeria)
  country: { type: String, default: 'Nigeria' },
  state: { 
    type: String, 
    required: [true, 'State required'],
    default: 'Lagos'
  },
  city: String,
  location: String,
  
  // ✅ CONTACT (Required with smart defaults)
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
  
  // ✅ MEDIA
  images: [{
    type: String,
    match: [/^https://res.cloudinary.com//, 'Valid Cloudinary URL required']
  }],
  video_link: String,
  
  // ✅ BUSINESS FIELDS (From your AddProduct form)
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
  
  // ✅ SELLER TRACKING (REQUIRED for routes)
  seller_id: { 
    type: String, 
    required: true,  // Auth0 user.sub
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

// Virtual for full name
productSchema.virtual('full_location').get(function() {
  return `${this.city || ''}, ${this.state}, Nigeria`.trim().replace(/, /, ', ');
});

export default mongoose.models.Product || mongoose.model('Product', productSchema);