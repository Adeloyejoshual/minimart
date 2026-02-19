import mongoose from "mongoose";

const deliveryRegionSchema = new mongoose.Schema(
  {
    state: { type: String, default: "" },
    city: { type: String, default: "" },
    method: { type: String, default: "" },
    from: { type: Number, default: null },
    to: { type: Number, default: null },
    chargeFee: { type: Boolean, default: false },
    fee: { type: Number, default: null },
    expressAvailable: { type: Boolean, default: false },
    warehouseAddress: { type: String, default: "" },
    isFreeDelivery: { type: Boolean, default: false }
  },
  { _id: false }
);

const bulkPriceSchema = new mongoose.Schema(
  {
    from: { type: Number, default: null },
    per_piece: { type: Number, default: null }
  },
  { _id: false }
);

const marketplaceProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    subcategory: { type: String, default: "", trim: true },

    brand: { type: String, default: "", trim: true },
    model: { type: String, default: "", trim: true },
    condition: { type: String, default: "", trim: true },
    used_detail: { type: String, default: "", trim: true },
    ram: { type: String, default: "", trim: true },
    storage: { type: String, default: "", trim: true },
    color: { type: String, default: "", trim: true },
    sim: { type: [String], default: [] },
    features: { type: [String], default: [] },

    engine: { type: String, default: "", trim: true },
    mileage: { type: Number, default: null },
    year: { type: Number, default: null },
    fuel_type: { type: String, default: "", trim: true },
    transmission: { type: String, default: "", trim: true },

    bedrooms: { type: Number, default: null },
    bathrooms: { type: Number, default: null },
    size: { type: String, default: "", trim: true },
    furnished: { type: Boolean, default: false },

    price: { type: Number, required: true },
    discount_price: { type: Number, default: null },
    quantity: { type: Number, default: 1 },
    bulk_price: { type: bulkPriceSchema, default: () => ({}) },

    negotiable: { type: Boolean, default: false },
    exchange_possible: { type: Boolean, default: false },

    phone_number: { type: String, required: true, trim: true },
    additional_phone: { type: String, default: "", trim: true },
    poster_name: { type: String, default: "", trim: true },
    social_link: { type: String, default: "", trim: true },

    country: { type: String, default: "Nigeria", trim: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    location: { type: String, default: "", trim: true },

    images: { type: [String], default: [] },
    video_link: { type: String, default: "", trim: true },

    promoted: { type: Boolean, default: false },
    promo_plan: { type: String, default: "", trim: true },
    promo_status: { type: String, default: "", trim: true },
    payment_reference: { type: String, default: "", trim: true },
    flash_sale: { type: Boolean, default: false },

    deliveryRegions: { type: [deliveryRegionSchema], default: [] },

    status: {
      type: String,
      enum: ["active", "pending", "sold", "rejected"],
      default: "active"
    },

    views: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.model("MarketplaceProduct", marketplaceProductSchema);