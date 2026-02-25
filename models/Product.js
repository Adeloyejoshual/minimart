// models/Product.js - COMPLETE FOR YOUR MARKETPLACE
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  // ✅ BASIC FIELDS
  title: { 
    type: String, 
    required: [true, 'Title is required'] 
  },
  description: String,
  price: { 
    type: Number, 
    required: [true, 'Price is required'],
    min: [0, 'Price must be positive']
  },
  discount_price: Number,
  category: String,
  brand: String,
  model: String,
  
  // ✅ SELLER INFO
  phone_number: { 
    type: String, 
    required: [true, 'Phone number required']
  },
  sellerId: {
    type: String,
    required: true,
    index: true  // Fast seller queries
  },
  
  // ✅ LOCATION
  state: String,
  city: String,
  
  // ✅ CATEGORY SPECIFIC (phones, laptops, cars, etc.)
  condition: String,
  ram: String,
  storage: String,
  color: String,
  engine: String,
  fuel_type: String,
  
  // ✅ IMAGES & MEDIA
  images: [{
    type: String,  // Cloudinary URLs
    default: []
  }],
  
  // ✅ STATUS & FEATURES
  status: { 
    type: String, 
    enum: ['draft', 'published', 'sold', 'expired'],
    default: 'draft'
  },
  views: { 
    type: Number, 
    default: 0 
  },
  features: {
    type: mongoose.Schema.Types.Mixed,  // Dynamic features by category
    default: {}
  },
  
  // ✅ PROMOTION
  promotion_plan: String,
  promoted_until: Date,
  
  // ✅ METADATA
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ VIRTUAL FIELDS
productSchema.virtual('is_promoted').get(function() {
  return this.promoted_until > new Date();
});

// ✅ INDEXES FOR FAST QUERIES
productSchema.index({ category: 1, status: 1 });
productSchema.index({ state: 1, city: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ sellerId: 1, status: 1 });

export default mongoose.model('Product', productSchema);