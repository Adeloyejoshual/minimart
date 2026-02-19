import mongoose from "mongoose";

const deliveryRegionSchema = new mongoose.Schema(
  {
    state: { type: String, required: true },
    city: { type: String, required: true },
    method: { type: String, enum: ["Courier", "Pickup", "Self Delivery"], required: true },
    from: { type: Number, min: 0, required: true },
    to: { type: Number, min: 0, required: true },
    chargeFee: { type: Boolean, default: false },
    fee: { type: Number, min: 0 },
    expressAvailable: { type: Boolean, default: false },
    warehouseAddress: { type: String },
    isFreeDelivery: { type: Boolean, default: false }
  },
  { _id: false, timestamps: true }
);

const bulkPriceSchema = new mongoose.Schema(
  {
    from: { type: Number, min: 2, required: true },
    per_piece: { type: Number, min: 0, required: true }
  },
  { _id: false }
);

const marketplaceProductSchema = new mongoose.Schema(
  {
    // ✅ CORE PRODUCT INFO
    title: { type: String, required: [true, "Title required"], maxlength: 200, trim: true },
    description: { type: String, required: [true, "Description required"], maxlength: 5000, trim: true },
    category: { type: String, required: [true, "Category required"], trim: true },
    subcategory: { type: String, trim: true },

    // ✅ SPECIFIC ATTRIBUTES (All Categories)
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    condition: { 
      type: String, 
      enum: ["New", "Like New", "Very Good", "Good", "Fair"], 
      trim: true 
    },
    used_detail: { type: String, trim: true },
    
    // Electronics
    ram: { type: String, trim: true },
    storage: { type: String, trim: true },
    color: { type: String, trim: true },
    sim: { type: [String], default: [] },
    features: { type: [String], default: [] },

    // Automotive
    engine: { type: String, trim: trim: true },
    mileage: { type: Number, min: 0 },
    year: { type: Number, min: 1900, max: new Date().getFullYear() + 1 },
    fuel_type: { type: String, trim: true },
    transmission: { type: String, enum: ["Manual", "Automatic", "CVT"], trim: true },

    // Real Estate
    bedrooms: { type: Number, min: 0 },
    bathrooms: { type: Number, min: 0 },
    size: { type: String, trim: true }, // e.g. "120 sqm"
    furnished: { type: Boolean, default: false },

    // ✅ PRICING & AVAILABILITY
    price: { type: Number, required: [true, "Price required"], min: 0 },
    discount_price: { type: Number, min: 0 },
    quantity: { type: Number, min: 0, default: 1 },
    bulk_price: { type: bulkPriceSchema, default: () => ({}) },
    
    negotiable: { type: Boolean, default: true },
    exchange_possible: { type: Boolean, default: false },

    // ✅ SELLER INFO
    phone_number: { 
      type: String, 
      required: [true, "Phone number required"],
      match: [/^(0|\+234)[0-9]{10}$/, "Valid Nigerian phone required"]
    },
    additional_phone: { type: String, match: [/^(0|\+234)[0-9]{10}$/] },
    poster_name: { type: String, required: [true, "Seller name required"], trim: true },
    social_link: { type: String, trim: true },

    // ✅ LOCATION
    country: { type: String, default: "Nigeria", trim: true },
    state: { type: String, required: [true, "State required"], trim: true },
    city: { type: String, required: [true, "City required"], trim: true },
    location: { type: String, trim: true },

    // ✅ MEDIA
    images: [{ 
      type: String, 
      match: [/^https?:\/\//, "Valid image URL required"]
    }],
    video_link: { type: String, trim: true },

    // ✅ PROMOTIONS & BOOSTING (JIJI STYLE)
    promoted: { type: Boolean, default: false },
    promo_plan: { type: String, enum: ["basic", "standard", "premium", "flash", "gift"], default: "" },
    promo_status: { type: String, enum: ["active", "expired", "pending"], default: "" },
    payment_reference: { type: String },
    boost_expires: { type: Date },
    flash_sale: { type: Boolean, default: false },

    // ✅ DELIVERY
    deliveryRegions: { type: [deliveryRegionSchema], default: [] },

    // ✅ JIJI LIVE TRACKING (CRITICAL)
    views_total: { type: Number, default: 0, index: true },
    views_today: { type: Number, default: 0 },
    live_viewers: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 },
    last_viewed: { type: Date },

    // ✅ SELLER VERIFICATION
    phone_verified: { type: Boolean, default: false },
    id_verified: { type: Boolean, default: false },
    seller_rating: { type: Number, min: 0, max: 5, default: 0 },
    total_sales: { type: Number, default: 0 },

    // ✅ STATUS & LIFECYCLE
    status: {
      type: String,
      enum: ["active", "pending", "sold", "rejected", "expired"],
      default: "pending"
    },
    active: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date },
    
    // ✅ ASSOCIATIONS
    poster_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    tags: [{ type: String, trim: true }],

    // ✅ AUDIT
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejected_reason: { type: String }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true, transform: (doc, ret) => { delete ret.__v; return ret; } },
    toObject: { virtuals: true }
  }
);

// ✅ VIRTUAL FIELDS (Computed)
marketplaceProductSchema.virtual("discount_percent").get(function() {
  if (!this.discount_price || this.discount_price >= this.price) return 0;
  return Math.round(((this.price - this.discount_price) / this.price) * 100);
});

// ✅ INDEXES (Performance)
marketplaceProductSchema.index({ category: 1, active: 1 });
marketplaceProductSchema.index({ state: 1, city: 1, active: 1 });
marketplaceProductSchema.index({ price: 1, active: 1 });
marketplaceProductSchema.index({ promoted: -1, boost_expires: -1 });
marketplaceProductSchema.index({ views_total: -1 });
marketplaceProductSchema.index({ createdAt: -1 });
marketplaceProductSchema.index({ status: 1, active: 1 });
marketplaceProductSchema.index({ poster_id: 1 });

export default mongoose.model("MarketplaceProduct", marketplaceProductSchema);
