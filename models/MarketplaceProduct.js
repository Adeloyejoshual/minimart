// src/models/MarketplaceProduct.js
import mongoose from "mongoose";

const deliveryRegionSchema = new mongoose.Schema(
  {
    state: String,
    city: String,
    method: String, // Courier / Pickup
    from: Number,   // delivery days (min)
    to: Number,     // delivery days (max)
    chargeFee: Boolean,
    fee: Number,
    expressAvailable: Boolean,
    warehouseAddress: String,
    isFreeDelivery: Boolean
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
    // Basic Info
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    subcategory: { type: String, default: "" },

    // Electronics / Phones
    brand: { type: String, default: "" },
    model: { type: String, default: "" },
    condition: { type: String, default: "" },
    used_detail: { type: String, default: "" },
    ram: { type: String, default: "" },
    storage: { type: String, default: "" },
    color: { type: String, default: "" },
    sim: { type: [String], default: [] }, // FIXED
    features: { type: [String], default: [] }, // FIXED

    // Vehicles
    engine: { type: String, default: "" },
    mileage: { type: Number, default: null },
    year: { type: Number, default: null },
    fuel_type: { type: String, default: "" },
    transmission: { type: String, default: "" },

    // Property
    bedrooms: { type: Number, default: null },
    bathrooms: { type: Number, default: null },
    size: { type: String, default: "" },
    furnished: { type: Boolean, default: false },

    // Pricing
    price: { type: Number, required: true },
    discount_price: { type: Number, default: null },
    quantity: { type: Number, default: 1 },
    bulk_price: { type: bulkPriceSchema, default: () => ({}) },

    // Negotiation & Exchange
    negotiable: { type: Boolean, default: false },
    exchange_possible: { type: Boolean, default: false },

    // Seller Info
    phone_number: { type: String, required: true },
    additional_phone: { type: String, default: "" },
    poster_name: { type: String, default: "" },
    social_link: { type: String, default: "" },

    // Location
    country: { type: String, default: "Nigeria" },
    state: { type: String, required: true },
    city: { type: String, required: true },
    location: { type: String, default: "" },

    // Media
    images: { type: [String], default: [] },
    video_link: { type: String, default: "" },

    // Promotion
    promoted: { type: Boolean, default: false },
    promo_plan: { type: String, default: "" },
    promo_status: { type: String, default: "" }, // paid / free
    payment_reference: { type: String, default: "" },
    flash_sale: { type: Boolean, default: false },

    // Delivery
    deliveryRegions: { type: [deliveryRegionSchema], default: [] },

    // Status
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